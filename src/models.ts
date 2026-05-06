export interface Agent {
  id: string;
  name: string;
  category: string;
  createdAt: Date;
}

export interface Interaction {
  id: string;
  sourceAgentId: string;
  targetAgentId: string;
  timestamp: Date;
  outcome: 'success' | 'failure' | 'neutral';
  value: number; // Importance of the interaction
  feedback?: string;
  rating?: number; // 0 to 1
}

export interface TrustScore {
  agentId: string;
  score: number; // 0 to 1
  confidence: number; // 0 to 1
  lastUpdated: Date;
  history: ScoreHistoryEntry[];
}

export interface ScoreHistoryEntry {
  timestamp: Date;
  score: number;
}

export interface ReputationMetadata {
  totalInteractions: number;
  successfulInteractions: number;
  failedInteractions: number;
  averageRating: number;
  totalValue: number;
}

export interface FraudSignal {
  type: 'sybil' | 'collusion' | 'anomaly' | 'sudden_drop';
  severity: number; // 0 to 1
  timestamp: Date;
  details: string;
}
