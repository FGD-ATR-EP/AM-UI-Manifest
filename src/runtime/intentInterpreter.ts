import type { ManifestResult } from '../contracts/workflow';
import { getConfig } from '../settings/config';

export async function interpretIntent(intent: string): Promise<ManifestResult> {
  const { apiBase, apiKey } = getConfig();
  const url = `${apiBase}/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: `Analyze intent: "${intent}". Return JSON: {interpretation: string, energy: number (0-1.5), entropy: number (0-1.5), colors: [hex1, hex2, hex3]}`
            }
          ]
        }
      ],
      generationConfig: { responseMimeType: 'application/json' }
    })
  });

  if (!response.ok) {
    throw new Error(`Intent API failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const payload = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!payload) {
    throw new Error('Intent API returned empty payload');
  }

  const parsed = JSON.parse(payload);
  return {
    interpretation: parsed.interpretation ?? 'No interpretation',
    energy: Number(parsed.energy ?? 0.2),
    entropy: Number(parsed.entropy ?? 0.1),
    colors: Array.isArray(parsed.colors) ? parsed.colors : ['#6366F1', '#06B6D4', '#8B5CF6']
  };
}
