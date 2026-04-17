export type SystemState = 'IDLE' | 'THINKING' | 'EMITTING' | 'COOLDOWN';

export interface SystemSnapshot {
  mode: SystemState;
  energyLevel: number;
  entropyLevel: number;
}

export interface ManifestResult {
  interpretation: string;
  energy: number;
  entropy: number;
  colors: string[];
}
