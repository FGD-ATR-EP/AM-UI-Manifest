import type { SystemSnapshot, SystemState } from '../contracts/workflow';

const stateTargets: Record<SystemState, Pick<SystemSnapshot, 'energyLevel' | 'entropyLevel'>> = {
  IDLE: { energyLevel: 0.2, entropyLevel: 0.1 },
  THINKING: { energyLevel: 0.5, entropyLevel: 0.7 },
  EMITTING: { energyLevel: 1.2, entropyLevel: 0.3 },
  COOLDOWN: { energyLevel: 0.4, entropyLevel: 0.2 }
};

const transitions: Record<SystemState, SystemState[]> = {
  IDLE: ['THINKING'],
  THINKING: ['EMITTING'],
  EMITTING: ['COOLDOWN'],
  COOLDOWN: ['IDLE']
};

export class RuntimeStateMachine {
  private snapshot: SystemSnapshot = {
    mode: 'IDLE',
    ...stateTargets.IDLE
  };

  get state(): SystemSnapshot {
    return { ...this.snapshot };
  }

  transition(nextState: SystemState): SystemSnapshot {
    const allowed = transitions[this.snapshot.mode];
    if (!allowed.includes(nextState)) {
      throw new Error(`Invalid transition ${this.snapshot.mode} -> ${nextState}`);
    }

    this.snapshot = {
      mode: nextState,
      ...stateTargets[nextState]
    };

    return this.state;
  }

  applyManifest(energy: number, entropy: number): SystemSnapshot {
    this.snapshot = {
      ...this.snapshot,
      energyLevel: Math.max(0, Math.min(1.5, energy)),
      entropyLevel: Math.max(0, Math.min(1.5, entropy))
    };

    return this.state;
  }
}
