import type { ManifestResult } from '../contracts/workflow';
import { preprocessIntent } from './language';
import { getConfig } from '../settings/config';

interface IntentResponsePayload {
  interpretation?: unknown;
  energy?: unknown;
  entropy?: unknown;
  colors?: unknown;
  creativeIntent?: unknown;
  provenanceAudit?: unknown;
}

type FallbackType = 'fallback-provider' | 'local-heuristic';

interface FallbackAuditEvent {
  type: FallbackType;
  reason: string;
  intentPreview: string;
  timestamp: string;
}

const DEFAULT_COLORS = ['#6366F1', '#06B6D4', '#8B5CF6'];
const REQUEST_TIMEOUT_MS = 8_000;
const MAX_RETRIES = 2;
const BACKOFF_BASE_MS = 350;
const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_COOLDOWN_MS = 20_000;

let consecutiveFailures = 0;
let circuitOpenUntil = 0;

export async function interpretIntent(intent: string): Promise<ManifestResult> {
  const cfg = getConfig();
  const preprocessed = preprocessIntent(intent);

  emitProvenanceAudit({
    stage: 'preprocess',
    creativeIntent: preprocessed.creativeIntent,
    provenanceAudit: preprocessed.provenanceAuditPatch,
    timestamp: new Date().toISOString()
  });

  if (!isCircuitOpen()) {
    try {
      const result = await executeWithRetry(buildEndpointUrl(cfg.apiBasePath, cfg.intentProxyPath), intent, preprocessed);
      markSuccess();
      return {
        ...result,
        provider: 'proxy',
        creativeIntent: result.creativeIntent ?? preprocessed.creativeIntent,
        provenanceAudit: { ...preprocessed.provenanceAuditPatch, ...result.provenanceAudit }
      };
    } catch (error) {
      markFailure();
      if (!cfg.featureFlags.enableFallbackProvider && !cfg.featureFlags.enableLocalHeuristicFallback) {
        throw error;
      }
    }
  }

  if (cfg.featureFlags.enableFallbackProvider) {
    try {
      const fallbackProviderUrl = buildEndpointUrl(cfg.apiBasePath, `${cfg.intentProxyPath}/fallback`);
      const result = await executeWithRetry(fallbackProviderUrl, intent, preprocessed, 1);
      emitFallbackAudit({
        type: 'fallback-provider',
        reason: isCircuitOpen() ? 'circuit_open' : 'upstream_failed',
        intentPreview: intent.slice(0, 80),
        timestamp: new Date().toISOString()
      });

      return {
        ...result,
        provider: 'fallback-provider',
        fallbackReason: isCircuitOpen() ? 'circuit_open' : 'upstream_failed',
        creativeIntent: result.creativeIntent ?? preprocessed.creativeIntent,
        provenanceAudit: { ...preprocessed.provenanceAuditPatch, ...result.provenanceAudit }
      };
    } catch {
      // Continue to local heuristic fallback.
    }
  }

  if (cfg.featureFlags.enableLocalHeuristicFallback) {
    emitFallbackAudit({
      type: 'local-heuristic',
      reason: isCircuitOpen() ? 'circuit_open_or_all_upstream_failed' : 'all_upstream_failed',
      intentPreview: intent.slice(0, 80),
      timestamp: new Date().toISOString()
    });
    return localHeuristicFallback(intent, preprocessed);
  }

  throw new Error('Intent provider unavailable and no fallback is enabled.');
}

async function executeWithRetry(
  url: string,
  intent: string,
  preprocessed: ReturnType<typeof preprocessIntent>,
  maxRetries = MAX_RETRIES
): Promise<ManifestResult> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await callIntentEndpoint(url, intent, preprocessed);
    } catch (error) {
      lastError = error;
      if (attempt === maxRetries) {
        break;
      }

      const waitMs = BACKOFF_BASE_MS * 2 ** attempt;
      await delay(waitMs);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Intent endpoint failed after retries.');
}

async function callIntentEndpoint(
  url: string,
  intent: string,
  preprocessed: ReturnType<typeof preprocessIntent>
): Promise<ManifestResult> {
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      intent,
      normalizedIntent: preprocessed.normalizedIntent,
      creativeIntent: preprocessed.creativeIntent,
      provenanceAudit: preprocessed.provenanceAuditPatch
    })
  }, REQUEST_TIMEOUT_MS);

  if (!response.ok) {
    throw new Error(`Intent API failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as IntentResponsePayload;
  return normalizeResult(data, preprocessed);
}

function normalizeResult(payload: IntentResponsePayload, preprocessed: ReturnType<typeof preprocessIntent>): ManifestResult {
  return {
    interpretation: typeof payload.interpretation === 'string' ? payload.interpretation : 'No interpretation',
    energy: sanitizeLevel(payload.energy, 0.2),
    entropy: sanitizeLevel(payload.entropy, 0.1),
    colors: Array.isArray(payload.colors) && payload.colors.every((color) => typeof color === 'string')
      ? payload.colors
      : DEFAULT_COLORS,
    creativeIntent: isCreativeIntent(payload.creativeIntent) ? payload.creativeIntent : preprocessed.creativeIntent,
    provenanceAudit: isProvenanceAudit(payload.provenanceAudit)
      ? { ...preprocessed.provenanceAuditPatch, ...payload.provenanceAudit }
      : preprocessed.provenanceAuditPatch
  };
}

function sanitizeLevel(raw: unknown, fallback: number): number {
  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.min(1.5, Math.max(0, numeric));
}

function localHeuristicFallback(intent: string, preprocessed: ReturnType<typeof preprocessIntent>): ManifestResult {
  const normalized = intent.trim().toLowerCase();
  const score = Math.min(1, normalized.length / 80);

  const highEnergy = /launch|urgent|power|boost|explode|intense|energy/.test(normalized);
  const calmEnergy = /calm|focus|quiet|still|zen|soft|meditate/.test(normalized);

  const energy = highEnergy ? 1.15 : calmEnergy ? 0.35 : 0.45 + score * 0.6;
  const entropy = calmEnergy ? 0.2 : highEnergy ? 0.9 : 0.3 + score * 0.4;
  const colors = calmEnergy
    ? ['#38BDF8', '#22D3EE', '#A78BFA']
    : highEnergy
      ? ['#F97316', '#EF4444', '#EAB308']
      : DEFAULT_COLORS;

  return {
    interpretation: `Local heuristic interpretation for: ${intent}`,
    energy,
    entropy,
    colors,
    provider: 'local-heuristic',
    fallbackReason: isCircuitOpen() ? 'circuit_open_or_all_upstream_failed' : 'all_upstream_failed',
    creativeIntent: preprocessed.creativeIntent,
    provenanceAudit: preprocessed.provenanceAuditPatch
  };
}

function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  return fetch(url, { ...init, signal: controller.signal }).finally(() => {
    clearTimeout(timeout);
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildEndpointUrl(basePath: string, endpointPath: string): string {
  const normalizedBase = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
  const normalizedEndpoint = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;
  return `${normalizedBase}${normalizedEndpoint}`;
}

function isCircuitOpen(now = Date.now()): boolean {
  return now < circuitOpenUntil;
}

function markFailure(now = Date.now()): void {
  consecutiveFailures += 1;
  if (consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
    circuitOpenUntil = now + CIRCUIT_BREAKER_COOLDOWN_MS;
  }
}

function markSuccess(): void {
  consecutiveFailures = 0;
  circuitOpenUntil = 0;
}

function emitFallbackAudit(event: FallbackAuditEvent): void {
  window.dispatchEvent(new CustomEvent<FallbackAuditEvent>('intent:fallback', { detail: event }));
}


function isCreativeIntent(value: unknown): value is ManifestResult['creativeIntent'] {
  return Boolean(value) && typeof value === 'object';
}

function isProvenanceAudit(value: unknown): value is ManifestResult['provenanceAudit'] {
  return Boolean(value) && typeof value === 'object';
}

function emitProvenanceAudit(payload: {
  stage: 'preprocess';
  creativeIntent: ManifestResult['creativeIntent'];
  provenanceAudit: ManifestResult['provenanceAudit'];
  timestamp: string;
}): void {
  window.dispatchEvent(new CustomEvent('intent:provenance', { detail: payload }));
}
