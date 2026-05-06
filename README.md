# Agent Trust Scoring Engine

A production-ready reputation and trust scoring system for autonomous AI agent ecosystems. This system provides weighted trust calculations, historical tracking, and multi-vector fraud detection to ensure agent-to-agent interactions are secure and reliable.

## Features

- **Weighted Trust Scoring**: Algorithm-based scoring that considers interaction value, outcome, and time-decay.
- **Confidence Calibration**: Numerical confidence scores based on interaction volume and consistency.
- **Fraud Detection**:
  - **Sybil Detection**: Identifies bursts of interactions from single sources.
  - **Collusion Analysis**: Detects reciprocal high-rating patterns.
  - **Anomaly Detection**: Flags sudden drops in trust scores.
- **Historical Tracking**: Persistent ledger of trust score evolution over time.
- **Agent Identity Integration**: Built to work with cryptographic agent passports and identities.

## Installation

```bash
bun add agent-trust-scoring-engine
```

## Quick Start

```typescript
import { AgentTrustSystem } from 'agent-trust-scoring-engine';

const system = new AgentTrustSystem();

// Register agents
const providerId = await system.registerAgent('DataService-Alpha', 'Provider');
const consumerId = await system.registerAgent('Analyst-Bot', 'Consumer');

// Record successful interaction
await system.recordInteraction(consumerId, providerId, 'success', 50, 0.98);

// Get trust report
const report = await system.getAgentTrustReport(providerId);
console.log(`Trust Score: ${report.score.score}`);
console.log(`Confidence: ${report.score.confidence}`);
```

## Architecture

### Scoring Algorithm
The engine uses a time-decayed weighted average:
$$Score = \frac{\sum (Rating_i \times Weight_{time,i})}{\sum Weight_{time,i}}$$
Where $Weight_{time}$ is calculated using a half-life decay model.

### Fraud Detection
The system monitors for three primary fraud vectors:
1. **Collusion**: Concentration of positive feedback from a single peer exceeding 80%.
2. **Sybil Attacks**: Rapid interaction accumulation exceeding threshold per unit of time.
3. **Trust Erosion**: Sudden significant drops in scoring compared to historical moving averages.

## API Reference

### `AgentTrustSystem`
- `registerAgent(name, category)`: Registers a new agent and returns its ID.
- `recordInteraction(sourceId, targetId, outcome, value, rating)`: Logs a new interaction and triggers score recalculation.
- `getAgentTrustReport(agentId)`: Returns the current `TrustScore` and any active `FraudSignal` objects.

## License

MIT - See [LICENSE](LICENSE) for details.

---
Built as part of the SCIEL AI Agent Infrastructure.
