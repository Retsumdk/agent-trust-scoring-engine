import { Agent, Interaction, TrustScore, ScoreHistoryEntry } from './models';

export class TrustStorage {
  private agents: Map<string, Agent> = new Map();
  private interactions: Map<string, Interaction[]> = new Map();
  private scores: Map<string, TrustScore> = new Map();
  private history: Map<string, ScoreHistoryEntry[]> = new Map();

  public async registerAgent(agent: Agent) {
    this.agents.set(agent.id, agent);
  }

  public async getAgent(agentId: string): Promise<Agent | undefined> {
    return this.agents.get(agentId);
  }

  public async addInteraction(interaction: Interaction) {
    const list = this.interactions.get(interaction.targetAgentId) || [];
    list.push(interaction);
    this.interactions.set(interaction.targetAgentId, list);
  }

  public async getInteractions(agentId: string): Promise<Interaction[]> {
    return this.interactions.get(agentId) || [];
  }

  public async saveScore(score: TrustScore) {
    this.scores.set(score.agentId, score);
  }

  public async getScore(agentId: string): Promise<TrustScore | undefined> {
    return this.scores.get(agentId);
  }

  public async saveScoreHistory(agentId: string, entry: ScoreHistoryEntry) {
    const list = this.history.get(agentId) || [];
    list.push(entry);
    this.history.set(agentId, list);
  }

  public async getScoreHistory(agentId: string): Promise<ScoreHistoryEntry[]> {
    return this.history.get(agentId) || [];
  }

  // Helper for tests and demos
  public async seed() {
    const agentA: Agent = { id: 'agent-a', name: 'Alpha', category: 'General', createdAt: new Date() };
    const agentB: Agent = { id: 'agent-b', name: 'Beta', category: 'Finance', createdAt: new Date() };
    
    await this.registerAgent(agentA);
    await this.registerAgent(agentB);

    const interactions: Interaction[] = [
      { id: '1', sourceAgentId: 'agent-a', targetAgentId: 'agent-b', timestamp: new Date(Date.now() - 86400000 * 2), outcome: 'success', value: 10, rating: 0.9 },
      { id: '2', sourceAgentId: 'agent-a', targetAgentId: 'agent-b', timestamp: new Date(Date.now() - 86400000), outcome: 'success', value: 15, rating: 0.95 },
      { id: '3', sourceAgentId: 'agent-a', targetAgentId: 'agent-b', timestamp: new Date(), outcome: 'failure', value: 5, rating: 0.2 },
    ];

    for (const i of interactions) {
      await this.addInteraction(i);
    }
  }
}
