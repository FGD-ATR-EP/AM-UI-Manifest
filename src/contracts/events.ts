import type { ManifestResult, SystemState } from './workflow';

export type AppEventMap = {
  INTENT_SUBMITTED: { intent: string };
  MANIFEST_READY: { intent: string; result: ManifestResult };
  RENDER_DONE: { state: SystemState };
  ERROR: { message: string; cause?: unknown };
};

export type AppEventType = keyof AppEventMap;
