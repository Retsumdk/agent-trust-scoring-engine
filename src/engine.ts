import { Interaction, TrustScore, Agent, ReputationMetadata } from './models';

export class TrustScoringEngine {
  private readonly DECAY_HALF_LIFE_DAYS = 30;
  private readonly CONFIDENCE_THRESHOLD = 5; // Minimum interactions for high confidence

  constructor(private storage: any) {}

  public async calculateScore(agentId: string): Promise<TrustScore> {
    if (!agentId) throw new Error('Agent ID is required');
    
    const interactions = await this.storage.getInteractions(agentId);
    const metadata = this.calculateMetadata(interactions);
    
    if (interactions.length === 0) {
      return {
        agentId,
        score: 0.5, // Neutral starting score
        confidence: 0,
        lastUpdated: new Date(),
        history: []
      };
    }

    const weightedScore = this.calculateWeightedScore(interactions);
    const confidence = this.calculateConfidence(interactions.length);

    return {
      agentId,
      score: weightedScore,
      confidence,
      lastUpdated: new Date(),
      history: [] // History should be fetched/updated separately
    };
  }

  private calculateWeightedScore(interactions: Interaction[]): number {
    if (interactions.length === 0) return 0.5;

    const now = Date.now();
    let totalWeight = 0;
    let weightedSum = 0;

    for (const interaction of interactions) {
      const ageInDays = (now - interaction.timestamp.getTime()) / (1000 * 60 * 60 * 24);
      const timeWeight = Math.pow(0.5, ageInDays / this.DECAY_HALF_LIFE_DAYS);
      const interactionValue = interaction.rating ?? (interaction.outcome === 'success' ? 1 : 0);
      
      // Basic weighted average
      weightedSum += interactionValue * timeWeight;
      totalWeight += timeWeight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0.5;
  }

  private calculateConfidence(interactionCount: number): number {
    // Sigmoid-like function for confidence
    return 1 / (1 + Math.exp(-(interactionCount - this.CONFIDENCE_THRESHOLD)));
  }

  private calculateMetadata(interactions: Interaction[]): ReputationMetadata {
    const successful = interactions.filter(i => i.outcome === 'success').length;
    const failed = interactions.filter(i => i.outcome === 'failure').length;
    const totalRating = interactions.reduce((sum, i) => sum + (i.rating ?? 0), 0);
    const totalValue = interactions.reduce((sum, i) => sum + i.value, 0);

    return {
      totalInteractions: interactions.length,
      successfulInteractions: successful,
      failedInteractions: failed,
      averageRating: interactions.length > 0 ? totalRating / interactions.length : 0,
      totalValue
    };
  }

  public async updateHistory(agentId: string, currentScore: number) {
    await this.storage.saveScoreHistory(agentId, {
      timestamp: new Date(),
      score: currentScore
    });
  }
}
