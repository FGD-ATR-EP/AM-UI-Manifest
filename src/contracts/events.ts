import type { SystemState, WorkflowContracts } from './workflow';

export type AppEventMap = {
  INTENT_SUBMITTED: { intent: string };
  MANIFEST_READY: { intent: string; contracts: WorkflowContracts };
  RENDER_DONE: { state: SystemState };
  ERROR: { message: string; cause?: unknown };
};

export type AppEventType = keyof AppEventMap;
