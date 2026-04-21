import type { CreativeIntent, ProvenanceAudit } from '../contracts/workflow';

export interface LanguageDetectionResult {
  languageCode: string;
  script: string;
  confidence: number;
  normalizedText: string;
  semanticConcepts: string[];
}

export interface IntentPreprocessResult {
  normalizedIntent: string;
  detection: LanguageDetectionResult;
  creativeIntent: CreativeIntent;
  provenanceAuditPatch: Partial<ProvenanceAudit>;
}

const SCRIPT_PATTERNS: Array<{ script: string; regex: RegExp; defaultLanguage: string }> = [
  { script: 'Thai', regex: /[\u0E00-\u0E7F]/, defaultLanguage: 'th' },
  { script: 'Han', regex: /[\u4E00-\u9FFF]/, defaultLanguage: 'zh' },
  { script: 'HiraganaKatakana', regex: /[\u3040-\u30FF]/, defaultLanguage: 'ja' },
  { script: 'Hangul', regex: /[\uAC00-\uD7AF]/, defaultLanguage: 'ko' },
  { script: 'Cyrillic', regex: /[\u0400-\u04FF]/, defaultLanguage: 'ru' },
  { script: 'Arabic', regex: /[\u0600-\u06FF]/, defaultLanguage: 'ar' },
  { script: 'Latin', regex: /[A-Za-z]/, defaultLanguage: 'en' }
];

const SEMANTIC_DICTIONARY: Array<{ concept: string; patterns: RegExp[] }> = [
  { concept: 'urgency', patterns: [/ด่วน/, /asap/i, /urgent/i, /ทันที/] },
  { concept: 'launch', patterns: [/เปิดตัว/, /launch/i, /debut/i] },
  { concept: 'calm', patterns: [/สงบ/, /ผ่อนคลาย/, /zen/i, /calm/i, /focus/i] },
  { concept: 'growth', patterns: [/เติบโต/, /scale/i, /expand/i, /growth/i] },
  { concept: 'celebration', patterns: [/เฉลิมฉลอง/, /celebrate/i, /festival/i] },
  { concept: 'premium', patterns: [/หรู/, /luxury/i, /premium/i] },
  { concept: 'innovation', patterns: [/นวัตกรรม/, /innovat/i, /future/i] },
  { concept: 'trust', patterns: [/น่าเชื่อถือ/, /มั่นใจ/, /trust/i, /reliable/i] }
];

const LOCAL_GOAL_HINTS: Array<{ goalType: string; patterns: RegExp[] }> = [
  { goalType: 'marketing-campaign', patterns: [/campaign/i, /แคมเปญ/, /promot/i] },
  { goalType: 'brand-story', patterns: [/brand/i, /แบรนด์/, /story/i, /narrative/i] },
  { goalType: 'product-launch', patterns: [/launch/i, /เปิดตัว/, /new product/i] }
];

export function preprocessIntent(intent: string): IntentPreprocessResult {
  const normalizedIntent = normalizeIntentText(intent);
  const detection = detectLanguageAndScript(normalizedIntent);
  const semanticConcepts = mapLocalExpressionsToConcepts(normalizedIntent);
  const goalType = inferGoalType(normalizedIntent);
  const energyLevel = inferEnergyLevel(normalizedIntent, semanticConcepts);
  const emotionalValence = inferEmotionalValence(normalizedIntent, semanticConcepts);

  const creativeIntent: CreativeIntent = {
    prompt_text: normalizedIntent,
    goal_type: goalType,
    emotional_valence: emotionalValence,
    energy_level: energyLevel,
    semantic_concepts: semanticConcepts,
    output_constraints: [],
    source_language: detection.languageCode,
    source_script: detection.script,
    language_confidence: detection.confidence
  };

  return {
    normalizedIntent,
    detection: {
      ...detection,
      semanticConcepts
    },
    creativeIntent,
    provenanceAuditPatch: {
      detected_language: detection.languageCode,
      detected_script: detection.script,
      preprocessing_steps: [
        'normalize_intent_text',
        'detect_language_script',
        'map_local_idioms_to_semantic_concepts'
      ]
    }
  };
}

export function normalizeIntentText(intent: string): string {
  return intent
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim();
}

export function detectLanguageAndScript(input: string): LanguageDetectionResult {
  for (const { script, regex, defaultLanguage } of SCRIPT_PATTERNS) {
    if (regex.test(input)) {
      return {
        languageCode: defaultLanguage,
        script,
        confidence: script === 'Latin' ? 0.65 : 0.9,
        normalizedText: input,
        semanticConcepts: []
      };
    }
  }

  return {
    languageCode: 'und',
    script: 'Unknown',
    confidence: 0.3,
    normalizedText: input,
    semanticConcepts: []
  };
}

export function mapLocalExpressionsToConcepts(input: string): string[] {
  const concepts = new Set<string>();

  for (const item of SEMANTIC_DICTIONARY) {
    if (item.patterns.some((pattern) => pattern.test(input))) {
      concepts.add(item.concept);
    }
  }

  if (concepts.size === 0) {
    concepts.add('general-intent');
  }

  return [...concepts];
}

function inferGoalType(input: string): string {
  const matched = LOCAL_GOAL_HINTS.find((item) => item.patterns.some((pattern) => pattern.test(input)));
  return matched?.goalType ?? 'general-creative';
}

function inferEnergyLevel(input: string, concepts: string[]): number {
  if (/intense|power|urgent|ด่วน|เร่ง/i.test(input) || concepts.includes('urgency')) {
    return 1.1;
  }

  if (/calm|soft|zen|สงบ|ละมุน/i.test(input) || concepts.includes('calm')) {
    return 0.35;
  }

  return 0.6;
}

function inferEmotionalValence(input: string, concepts: string[]): number {
  if (/happy|joy|celebrate|ดีใจ|สนุก/i.test(input) || concepts.includes('celebration')) {
    return 0.8;
  }

  if (/serious|strict|วิตก|กังวล/i.test(input)) {
    return 0.3;
  }

  return 0.6;
}
