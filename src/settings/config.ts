export interface RuntimeConfig {
  apiBase: string;
  apiKey: string;
}

const defaultConfig: RuntimeConfig = {
  apiBase: 'https://generativelanguage.googleapis.com/v1beta',
  apiKey: ''
};

let runtimeConfig: RuntimeConfig = { ...defaultConfig };

export function getConfig(): RuntimeConfig {
  return { ...runtimeConfig };
}

export function updateConfig(patch: Partial<RuntimeConfig>): RuntimeConfig {
  runtimeConfig = { ...runtimeConfig, ...patch };
  return getConfig();
}
