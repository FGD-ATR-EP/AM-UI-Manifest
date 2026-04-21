import type { ManifestResult } from '../contracts/workflow';
import { getConfig } from '../settings/config';
import { preprocessIntent, type IntentPreprocessResult } from './language';

interface IntentResponsePayload {
  interpretation?: unknown;
  energy?: unknown;
  entropy?: unknown;
  colors?: unknown;
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
  const preprocess = preprocessIntent(intent);
  emitPreprocessAudit(preprocess);
  const intentForInference = preprocess.normalized_intent.canonical_text;

  if (!isCircuitOpen()) {
    try {
      const result = await executeWithRetry(buildEndpointUrl(cfg.apiBasePath, cfg.intentProxyPath), intentForInference, preprocess);
      markSuccess();
      return enrichWithContracts(result, intent, preprocess, 'proxy');
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
      const result = await executeWithRetry(fallbackProviderUrl, intentForInference, preprocess, 1);
      emitFallbackAudit({
        type: 'fallback-provider',
        reason: isCircuitOpen() ? 'circuit_open' : 'upstream_failed',
        intentPreview: intent.slice(0, 80),
        timestamp: new Date().toISOString()
      });

      return enrichWithContracts({
        ...result,
        provider: 'fallback-provider',
        fallbackReason: isCircuitOpen() ? 'circuit_open' : 'upstream_failed'
      }, intent, preprocess, 'fallback-provider');
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
    return enrichWithContracts(localHeuristicFallback(intentForInference), intent, preprocess, 'local-heuristic');
  }

  throw new Error('Intent provider unavailable and no fallback is enabled.');
}

async function executeWithRetry(url: string, intent: string, preprocess: IntentPreprocessResult, maxRetries = MAX_RETRIES): Promise<ManifestResult> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await callIntentEndpoint(url, intent, preprocess);
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

async function callIntentEndpoint(url: string, intent: string, preprocess: IntentPreprocessResult): Promise<ManifestResult> {
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      intent,
      languageDetection: preprocess.language_detection,
      normalizedIntent: preprocess.normalized_intent,
      semanticConcepts: preprocess.semantic_concepts
    })
  }, REQUEST_TIMEOUT_MS);

  if (!response.ok) {
    throw new Error(`Intent API failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as IntentResponsePayload;
  return normalizeResult(data);
}

function normalizeResult(payload: IntentResponsePayload): ManifestResult {
  return {
    interpretation: typeof payload.interpretation === 'string' ? payload.interpretation : 'No interpretation',
    energy: sanitizeLevel(payload.energy, 0.2),
    entropy: sanitizeLevel(payload.entropy, 0.1),
    colors: Array.isArray(payload.colors) && payload.colors.every((color) => typeof color === 'string')
      ? payload.colors
      : DEFAULT_COLORS
  };
}

function sanitizeLevel(raw: unknown, fallback: number): number {
  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.min(1.5, Math.max(0, numeric));
}

function localHeuristicFallback(intent: string): ManifestResult {
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
    fallbackReason: isCircuitOpen() ? 'circuit_open_or_all_upstream_failed' : 'all_upstream_failed'
  };
}

function enrichWithContracts(
  result: ManifestResult,
  rawIntent: string,
  preprocess: IntentPreprocessResult,
  provider: NonNullable<ManifestResult['provider']>
): ManifestResult {
  return {
    ...result,
    provider,
    creative_intent: {
      prompt_text: rawIntent,
      goal_type: preprocess.inferred_goal_type,
      emotional_valence: preprocess.emotional_valence,
      energy_level: sanitizeLevel(result.energy, 0.5),
      semantic_concepts: preprocess.semantic_concepts,
      normalized_intent: preprocess.normalized_intent,
      language_detection: preprocess.language_detection,
      output_constraints: []
    },
    provenance_audit: {
      who_requested: 'runtime-user',
      brand_profile_used: 'default',
      policy_decisions: [],
      rejected_transitions: [],
      language_detection: preprocess.language_detection,
      semantic_mapping_trace: preprocess.semantic_mapping_trace,
      generation_cost: 0,
      session_replay_id: `runtime-${Date.now()}`
    }
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

function emitPreprocessAudit(preprocess: IntentPreprocessResult): void {
  window.dispatchEvent(new CustomEvent('intent:provenance', {
    detail: {
      languageDetection: preprocess.language_detection,
      semanticConcepts: preprocess.semantic_concepts,
      semanticMappingTrace: preprocess.semantic_mapping_trace,
      normalizedIntent: preprocess.normalized_intent
    }
  }));
}
