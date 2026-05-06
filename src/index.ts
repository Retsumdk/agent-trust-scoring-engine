import { TrustScoringEngine } from './engine';
import { FraudDetector } from './fraud';
import { TrustStorage } from './storage';
import { Agent, Interaction, TrustScore, FraudSignal } from './models';

export * from './models';
export * from './engine';
export * from './fraud';
export * from './storage';

export class AgentTrustSystem {
  private engine: TrustScoringEngine;
  private detector: FraudDetector;
  private storage: TrustStorage;

  constructor() {
    this.storage = new TrustStorage();
    this.engine = new TrustScoringEngine(this.storage);
    this.detector = new FraudDetector(this.storage);
  }

  public async registerAgent(name: string, category: string): Promise<string> {
    const id = `agent-${Math.random().toString(36).substr(2, 9)}`;
    await this.storage.registerAgent({
      id,
      name,
      category,
      createdAt: new Date()
    });
    return id;
  }

  public async recordInteraction(sourceId: string, targetId: string, outcome: 'success' | 'failure', value: number, rating?: number) {
    const interaction: Interaction = {
      id: `int-${Math.random().toString(36).substr(2, 9)}`,
      sourceAgentId: sourceId,
      targetAgentId: targetId,
      timestamp: new Date(),
      outcome,
      value,
      rating
    };
    await this.storage.addInteraction(interaction);
    
    // Auto-update score
    const score = await this.engine.calculateScore(targetId);
    await this.storage.saveScore(score);
    await this.engine.updateHistory(targetId, score.score);
  }

  public async getAgentTrustReport(agentId: string): Promise<{
    score: TrustScore;
    fraudSignals: FraudSignal[];
  }> {
    const score = await this.storage.getScore(agentId);
    const fraudSignals = await this.detector.analyzeInteractions(agentId);

    if (!score) {
      const initialScore = await this.engine.calculateScore(agentId);
      return { score: initialScore, fraudSignals };
    }

    return { score, fraudSignals };
  }

  // Admin/Utility methods
  public getStorage() {
    return this.storage;
  }
}

// Example usage if run directly
if (require.main === module) {
  (async () => {
    const system = new AgentTrustSystem();
    console.log('--- Initializing Agent Trust System ---');
    
    const aliceId = await system.registerAgent('Alice', 'Service');
    const bobId = await system.registerAgent('Bob', 'Provider');

    console.log(`Registered agents: Alice (${aliceId}), Bob (${bobId})`);

    console.log('Recording interactions...');
    await system.recordInteraction(aliceId, bobId, 'success', 10, 0.95);
    await system.recordInteraction(aliceId, bobId, 'success', 15, 0.9);
    
    const report = await system.getAgentTrustReport(bobId);
    console.log('Trust Report for Bob:', JSON.stringify(report, null, 2));

    console.log('Simulating collusion...');
    for (let i = 0; i < 10; i++) {
      await system.recordInteraction(aliceId, bobId, 'success', 5, 1.0);
    }

    const fraudReport = await system.getAgentTrustReport(bobId);
    console.log('Fraud Report for Bob after suspected collusion:', JSON.stringify(fraudReport, null, 2));
  })();
}
