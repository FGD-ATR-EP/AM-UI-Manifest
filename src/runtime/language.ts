import type { LanguageDetection, NormalizedIntent } from '../contracts/workflow';

export interface IntentPreprocessResult {
  language_detection: LanguageDetection;
  normalized_intent: NormalizedIntent;
  semantic_concepts: string[];
  semantic_mapping_trace: string[];
  inferred_goal_type: string;
  emotional_valence: number;
}

type ScriptLabel = 'thai' | 'latin' | 'cyrillic' | 'han' | 'kana' | 'arabic' | 'devanagari' | 'unknown';

const SEMANTIC_CONCEPT_MAP: Array<{ pattern: RegExp; concept: string }> = [
  { pattern: /\blaunch|เปิดตัว|release\b/i, concept: 'launch' },
  { pattern: /\burgent|ด่วน|asap\b/i, concept: 'urgency' },
  { pattern: /\bcalm|สงบ|นิ่ง|zen\b/i, concept: 'calm' },
  { pattern: /\bfocus|โฟกัส|concentraci[oó]n\b/i, concept: 'focus' },
  { pattern: /\benergy|พลัง|energ[ií]a\b/i, concept: 'energy' },
  { pattern: /\bsoft|ละมุน|gentle\b/i, concept: 'softness' },
  { pattern: /\bbold|ชัด|กล้า\b/i, concept: 'boldness' },
  { pattern: /\bminimal|มินิมอล|minimalista\b/i, concept: 'minimalism' },
  { pattern: /\btrust|เชื่อถือ|confianza\b/i, concept: 'trust' },
  { pattern: /\bluxury|หรู|lujo\b/i, concept: 'luxury' }
];

const GOAL_MAP: Array<{ pattern: RegExp; goal: string }> = [
  { pattern: /\blaunch|เปิดตัว|release\b/i, goal: 'launch_campaign' },
  { pattern: /\bbrand|แบรนด์\b/i, goal: 'brand_presence' },
  { pattern: /\bad|โฆษณา|campaign\b/i, goal: 'marketing_asset' }
];

export function preprocessIntent(intent: string): IntentPreprocessResult {
  const normalizedText = normalizeWhitespace(intent);
  const script = detectScript(normalizedText);
  const language_detection = detectLanguage(normalizedText, script);
  const canonical_text = canonicalize(normalizedText);
  const tokens = canonical_text.split(/\s+/).filter(Boolean);
  const semantic_mapping_trace: string[] = [];
  const semantic_concepts = extractSemanticConcepts(normalizedText, semantic_mapping_trace);
  const inferred_goal_type = inferGoalType(normalizedText);
  const emotional_valence = inferEmotionalValence(normalizedText, semantic_concepts);

  return {
    language_detection,
    normalized_intent: {
      original_text: intent,
      canonical_text,
      tokens
    },
    semantic_concepts,
    semantic_mapping_trace,
    inferred_goal_type,
    emotional_valence
  };
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function canonicalize(text: string): string {
  return text.normalize('NFKC').toLowerCase();
}

function detectScript(text: string): ScriptLabel {
  if (/[ก-๙]/.test(text)) return 'thai';
  if (/[\u3040-\u30ff]/.test(text)) return 'kana';
  if (/[\u4e00-\u9fff]/.test(text)) return 'han';
  if (/[\u0600-\u06ff]/.test(text)) return 'arabic';
  if (/[\u0900-\u097f]/.test(text)) return 'devanagari';
  if (/[\u0400-\u04ff]/.test(text)) return 'cyrillic';
  if (/[a-z]/i.test(text)) return 'latin';
  return 'unknown';
}

function detectLanguage(text: string, script: ScriptLabel): LanguageDetection {
  if (script === 'thai') {
    return { language: 'th', script, confidence: 0.97, method: 'heuristic' };
  }
  if (script === 'kana' || script === 'han') {
    return { language: 'ja', script, confidence: 0.7, method: 'heuristic' };
  }
  if (script === 'cyrillic') {
    return { language: 'ru', script, confidence: 0.7, method: 'heuristic' };
  }
  if (script === 'arabic') {
    return { language: 'ar', script, confidence: 0.8, method: 'heuristic' };
  }
  if (script === 'devanagari') {
    return { language: 'hi', script, confidence: 0.8, method: 'heuristic' };
  }
  if (script === 'latin') {
    const lower = text.toLowerCase();
    if (/\b(el|la|para|con|energ[ií]a)\b/.test(lower)) {
      return { language: 'es', script, confidence: 0.6, method: 'heuristic' };
    }
    return { language: 'en', script, confidence: 0.6, method: 'heuristic' };
  }

  return { language: 'und', script, confidence: 0.2, method: 'heuristic' };
}

function extractSemanticConcepts(text: string, trace: string[]): string[] {
  const concepts = new Set<string>();

  for (const mapper of SEMANTIC_CONCEPT_MAP) {
    if (mapper.pattern.test(text)) {
      concepts.add(mapper.concept);
      trace.push(`${mapper.pattern.source} -> ${mapper.concept}`);
    }
  }

  if (concepts.size === 0) {
    concepts.add('general_intent');
    trace.push('default -> general_intent');
  }

  return Array.from(concepts);
}

function inferGoalType(text: string): string {
  for (const goal of GOAL_MAP) {
    if (goal.pattern.test(text)) {
      return goal.goal;
    }
  }

  return 'open_exploration';
}

function inferEmotionalValence(text: string, concepts: string[]): number {
  const positive = /\bhappy|joy|ดีใจ|สดใส|success|win\b/i.test(text);
  const negative = /\bsad|angry|เครียด|fear|risk\b/i.test(text);

  if (positive) return 0.75;
  if (negative) return 0.25;
  if (concepts.includes('calm')) return 0.55;
  if (concepts.includes('urgency')) return 0.45;
  return 0.5;
}
