import { Interaction, FraudSignal, Agent } from './models';

export class FraudDetector {
  private readonly COLLUSION_THRESHOLD = 0.8;
  private readonly SYBIL_BURST_THRESHOLD = 10; // Max interactions per hour from same source

  constructor(private storage: any) {}

  public async analyzeInteractions(agentId: string): Promise<FraudSignal[]> {
    const interactions = await this.storage.getInteractions(agentId);
    const signals: FraudSignal[] = [];

    const collusionSignal = this.detectCollusion(interactions);
    if (collusionSignal) signals.push(collusionSignal);

    const sybilSignal = this.detectSybilPattern(interactions);
    if (sybilSignal) signals.push(sybilSignal);

    const suddenDropSignal = await this.detectSuddenDrop(agentId, interactions);
    if (suddenDropSignal) signals.push(suddenDropSignal);

    return signals;
  }

  private detectCollusion(interactions: Interaction[]): FraudSignal | null {
    const sourceMap = new Map<string, number>();
    interactions.forEach(i => {
      sourceMap.set(i.sourceAgentId, (sourceMap.get(i.sourceAgentId) || 0) + 1);
    });

    for (const [sourceId, count] of sourceMap.entries()) {
      if (count / interactions.length > this.COLLUSION_THRESHOLD && interactions.length > 5) {
        return {
          type: 'collusion',
          severity: count / interactions.length,
          timestamp: new Date(),
          details: `High concentration of interactions from single source: ${sourceId}`
        };
      }
    }
    return null;
  }

  private detectSybilPattern(interactions: Interaction[]): FraudSignal | null {
    const hourAgo = new Date(Date.now() - 3600000);
    const recentInteractions = interactions.filter(i => i.timestamp > hourAgo);

    if (recentInteractions.length > this.SYBIL_BURST_THRESHOLD) {
      return {
        type: 'sybil',
        severity: Math.min(recentInteractions.length / (this.SYBIL_BURST_THRESHOLD * 2), 1),
        timestamp: new Date(),
        details: `Burst of interactions detected: ${recentInteractions.length} in the last hour`
      };
    }
    return null;
  }

  private async detectSuddenDrop(agentId: string, interactions: Interaction[]): Promise<FraudSignal | null> {
    const history = await this.storage.getScoreHistory(agentId);
    if (history.length < 2) return null;

    const latest = history[history.length - 1];
    const previous = history[history.length - 2];

    const drop = previous.score - latest.score;
    if (drop > 0.3) {
      return {
        type: 'sudden_drop',
        severity: drop,
        timestamp: new Date(),
        details: `Trust score dropped suddenly from ${previous.score.toFixed(2)} to ${latest.score.toFixed(2)}`
      };
    }
    return null;
  }
}
