import type { SystemSnapshot, SystemState } from '../contracts/workflow';

export type TelemetryEventType = 'request_started' | 'request_succeeded' | 'request_failed' | 'fallback_triggered';

export interface TelemetrySnapshot {
  runtime: {
    mode: SystemState;
    energyLevel: number;
    entropyLevel: number;
    loadLevel: number;
  };
  network: {
    requestCountWindow: number;
    inFlightRequests: number;
    avgLatencyMs: number;
    errorRate: number;
    throughputPerMinute: number;
    fallbackCountWindow: number;
  };
}

interface RequestRecord {
  startedAt: number;
  latencyMs?: number;
  status: 'started' | 'succeeded' | 'failed';
}

interface FallbackRecord {
  at: number;
}

const WINDOW_MS = 60_000;

export class TelemetryStore {
  private runtime: SystemSnapshot = {
    mode: 'IDLE',
    energyLevel: 0.2,
    entropyLevel: 0.1
  };

  private records: RequestRecord[] = [];
  private fallbacks: FallbackRecord[] = [];

  updateRuntime(snapshot: SystemSnapshot): TelemetrySnapshot {
    this.runtime = { ...snapshot };
    return this.getSnapshot();
  }

  recordEvent(eventType: TelemetryEventType, now = Date.now(), latencyMs?: number): TelemetrySnapshot {
    this.prune(now);

    if (eventType === 'fallback_triggered') {
      this.fallbacks.push({ at: now });
      return this.getSnapshot(now);
    }

    if (eventType === 'request_started') {
      this.records.push({ startedAt: now, status: 'started' });
      return this.getSnapshot(now);
    }

    const target = [...this.records].reverse().find((item) => item.status === 'started');
    if (!target) {
      return this.getSnapshot(now);
    }

    target.status = eventType === 'request_succeeded' ? 'succeeded' : 'failed';
    target.latencyMs = Math.max(0, latencyMs ?? now - target.startedAt);

    return this.getSnapshot(now);
  }

  getSnapshot(now = Date.now()): TelemetrySnapshot {
    this.prune(now);

    const inFlightRequests = this.records.filter((item) => item.status === 'started').length;
    const completed = this.records.filter((item) => item.status !== 'started');
    const failures = completed.filter((item) => item.status === 'failed').length;
    const latencySamples = completed
      .map((item) => item.latencyMs)
      .filter((value): value is number => typeof value === 'number');

    const avgLatencyMs = latencySamples.length
      ? latencySamples.reduce((sum, value) => sum + value, 0) / latencySamples.length
      : 0;

    const errorRate = completed.length ? failures / completed.length : 0;
    const throughputPerMinute = completed.length;
    const requestCountWindow = this.records.length;
    const fallbackCountWindow = this.fallbacks.length;
    const loadLevel = Math.min(1.5, inFlightRequests * 0.3 + throughputPerMinute / 20 + this.runtime.energyLevel * 0.25);

    return {
      runtime: {
        mode: this.runtime.mode,
        energyLevel: this.runtime.energyLevel,
        entropyLevel: this.runtime.entropyLevel,
        loadLevel
      },
      network: {
        requestCountWindow,
        inFlightRequests,
        avgLatencyMs,
        errorRate,
        throughputPerMinute,
        fallbackCountWindow
      }
    };
  }

  private prune(now: number): void {
    this.records = this.records.filter((item) => now - item.startedAt <= WINDOW_MS);
    this.fallbacks = this.fallbacks.filter((item) => now - item.at <= WINDOW_MS);
  }
}
