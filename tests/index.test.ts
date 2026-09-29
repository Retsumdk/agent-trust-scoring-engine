import { describe, test, expect } from "bun:test";
import { TrustScoringEngine } from "../src/engine";
import { TrustStorage } from "../src/storage";
import { FraudDetector } from "../src/fraud";
import { Agent, Interaction } from "../src/models";

function interaction(overrides: Partial<Interaction>): Interaction {
  return {
    id: Math.random().toString(36).slice(2),
    sourceAgentId: "source-1",
    targetAgentId: "agent-1",
    timestamp: new Date(),
    outcome: "success",
    value: 1,
    ...overrides,
  };
}

describe("TrustScoringEngine", () => {
  test("neutral 0.5 score with zero confidence when no interactions exist", async () => {
    const engine = new TrustScoringEngine(new TrustStorage());
    const score = await engine.calculateScore("unknown-agent");
    expect(score.score).toBe(0.5);
    expect(score.confidence).toBe(0);
    expect(score.agentId).toBe("unknown-agent");
  });

  test("throws without an agent id", async () => {
    const engine = new TrustScoringEngine(new TrustStorage());
    // @ts-expect-error - exercising the runtime guard
    await expect(engine.calculateScore("")).rejects.toThrow("Agent ID is required");
  });

  test("recent successes score high, recent failures score low", async () => {
    const good = new TrustStorage();
    const bad = new TrustStorage();
    for (let i = 0; i < 5; i++) {
      await good.addInteraction(interaction({ outcome: "success", rating: 0.95, id: `g${i}` }));
      await bad.addInteraction(interaction({ outcome: "failure", rating: 0.05, id: `b${i}` }));
    }
    const engine = new TrustScoringEngine(good);
    const goodScore = await engine.calculateScore("agent-1");
    const badScore = await new TrustScoringEngine(bad).calculateScore("agent-1");
    expect(goodScore.score).toBeGreaterThan(0.9);
    expect(badScore.score).toBeLessThan(0.1);
    expect(goodScore.score).toBeGreaterThan(badScore.score);
  });

  test("confidence rises with interaction count (sigmoid over threshold 5)", async () => {
    const few = new TrustStorage();
    const many = new TrustStorage();
    for (let i = 0; i < 3; i++) await few.addInteraction(interaction({ id: `f${i}` }));
    for (let i = 0; i < 20; i++) await many.addInteraction(interaction({ id: `m${i}` }));
    const cFew = (await new TrustScoringEngine(few).calculateScore("agent-1")).confidence;
    const cMany = (await new TrustScoringEngine(many).calculateScore("agent-1")).confidence;
    expect(cMany).toBeGreaterThan(cFew);
    expect(cMany).toBeGreaterThan(0.9);
  });

  test("older interactions carry far less weight than fresh ones (30-day half-life)", async () => {
    // Weighted average is scale-invariant for a single interaction, so decay is
    // only observable in a mixed set: a fresh success plus a 90-day-old failure.
    const mixed = new TrustStorage();
    await mixed.addInteraction(interaction({ id: "fresh", rating: 1.0 }));
    await mixed.addInteraction(
      interaction({ id: "stale", rating: 0.0, timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 90) })
    );
    const score = (await new TrustScoringEngine(mixed).calculateScore("agent-1")).score;
    // With decay: weights 1 and 0.125 -> 1/1.125 = 0.889. Without decay it would be 0.5.
    expect(score).toBeGreaterThan(0.85);
    // Mirror case: a stale success cannot rescue a fresh failure.
    const mirror = new TrustStorage();
    await mirror.addInteraction(interaction({ id: "fresh-bad", rating: 0.0 }));
    await mirror.addInteraction(
      interaction({ id: "stale-good", rating: 1.0, timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 90) })
    );
    const mirrorScore = (await new TrustScoringEngine(mirror).calculateScore("agent-1")).score;
    expect(mirrorScore).toBeLessThan(0.15);
  });

  test("updateHistory persists score history through storage", async () => {
    const storage = new TrustStorage();
    const engine = new TrustScoringEngine(storage);
    await engine.updateHistory("agent-1", 0.75);
    await engine.updateHistory("agent-1", 0.4);
    const history = await storage.getScoreHistory("agent-1");
    expect(history.length).toBe(2);
    expect(history[1].score).toBe(0.4);
  });
});

describe("TrustStorage", () => {
  test("registers agents and stores/retrieves interactions by target", async () => {
    const storage = new TrustStorage();
    const agent: Agent = { id: "a1", name: "Alpha", category: "General", createdAt: new Date() };
    await storage.registerAgent(agent);
    expect((await storage.getAgent("a1"))?.name).toBe("Alpha");
    expect(await storage.getAgent("missing")).toBeUndefined();

    await storage.addInteraction(interaction({ targetAgentId: "a1" }));
    await storage.addInteraction(interaction({ targetAgentId: "a2" }));
    const forA1 = await storage.getInteractions("a1");
    expect(forA1.length).toBe(1);
    expect(await storage.getInteractions("nobody")).toEqual([]);
  });

  test("saves and retrieves scores", async () => {
    const storage = new TrustStorage();
    expect(await storage.getScore("agent-1")).toBeUndefined();
    await storage.saveScore({
      agentId: "agent-1",
      score: 0.8,
      confidence: 0.9,
      lastUpdated: new Date(),
      history: [],
    });
    expect((await storage.getScore("agent-1"))?.score).toBe(0.8);
  });
});

describe("FraudDetector", () => {
  test("flags a sybil burst (>10 interactions in the last hour)", async () => {
    const storage = new TrustStorage();
    for (let i = 0; i < 15; i++) {
      await storage.addInteraction(interaction({ id: `s${i}`, sourceAgentId: "sybil" }));
    }
    const signals = await new FraudDetector(storage).analyzeInteractions("agent-1");
    const sybil = signals.find((s) => s.type === "sybil");
    expect(sybil).toBeDefined();
    expect(sybil!.severity).toBeGreaterThan(0);
  });

  test("no signals for a healthy, spread-out interaction set", async () => {
    const storage = new TrustStorage();
    const sources = ["src-a", "src-b", "src-c"];
    for (let i = 0; i < 6; i++) {
      await storage.addInteraction(
        interaction({
          id: `h${i}`,
          sourceAgentId: sources[i % 3],
          timestamp: new Date(Date.now() - (i + 1) * 7200000),
          rating: 0.9,
        })
      );
    }
    const signals = await new FraudDetector(storage).analyzeInteractions("agent-1");
    expect(signals).toEqual([]);
  });
});
