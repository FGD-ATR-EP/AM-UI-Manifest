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
  provider?: "proxy" | "fallback-provider" | "local-heuristic";
  fallbackReason?: string;
  creative_intent?: CreativeIntent;
  provenance_audit?: Partial<ProvenanceAudit>;
}

export interface LanguageDetection {
  language: string;
  script: string;
  confidence: number;
  method: 'heuristic';
}

export interface NormalizedIntent {
  original_text: string;
  canonical_text: string;
  tokens: string[];
}

export interface CreativeIntent {
  prompt_text: string;
  goal_type: string;
  emotional_valence: number;
  energy_level: number;
  semantic_concepts: string[];
  normalized_intent: NormalizedIntent;
  language_detection: LanguageDetection;
  output_constraints: string[];
  source_language: string;
  source_script: string;
  language_confidence: number;
}

export interface ManifestationContract {
  state: string;
  shape: string;
  palette_mode: string;
  particle_density: number;
  turbulence: number;
  glow_intensity: number;
  cohesion: number;
  flicker: number;
  flow_direction: string;
  attractor_points: Array<{ x: number; y: number; z?: number }>;
  composition_hint: string;
  camera_hint: string;
  typography_hint: string;
}

export interface RenderJob {
  renderer_profile: string;
  quality_tier: string;
  fps_budget: number;
  shader_profile: string;
  export_profile: string;
}

export interface Artifact {
  preview_light_scene: string;
  final_image: string;
  layered_export: string;
  motion_clip: string;
  prompt_lineage: string[];
  approved_version: string;
}

export interface ProvenanceAudit {
  who_requested: string;
  brand_profile_used: string;
  policy_decisions: string[];
  rejected_transitions: string[];
  language_detection?: LanguageDetection;
  semantic_mapping_trace?: string[];
  generation_cost: number;
  session_replay_id: string;
  detected_language?: string;
  detected_script?: string;
  preprocessing_steps?: string[];
}

export interface WorkflowContracts {
  creative_intent: CreativeIntent;
  manifestation_contract: ManifestationContract;
  render_job: RenderJob;
  artifact: Artifact;
  provenance_audit: ProvenanceAudit;
}
