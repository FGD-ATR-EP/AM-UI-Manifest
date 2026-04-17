export interface RuntimeFeatureFlags {
  enableFallbackProvider: boolean;
  enableLocalHeuristicFallback: boolean;
}

export interface RuntimeConfig {
  apiBasePath: string;
  intentProxyPath: string;
  featureFlags: RuntimeFeatureFlags;
}

const defaultConfig: RuntimeConfig = {
  apiBasePath: '',
  intentProxyPath: '/api/intent/interpret',
  featureFlags: {
    enableFallbackProvider: true,
    enableLocalHeuristicFallback: true
  }
};

let runtimeConfig: RuntimeConfig = { ...defaultConfig, featureFlags: { ...defaultConfig.featureFlags } };

export function getConfig(): RuntimeConfig {
  return {
    ...runtimeConfig,
    featureFlags: { ...runtimeConfig.featureFlags }
  };
}

export function updateConfig(patch: Partial<RuntimeConfig>): RuntimeConfig {
  runtimeConfig = {
    ...runtimeConfig,
    ...patch,
    featureFlags: {
      ...runtimeConfig.featureFlags,
      ...(patch.featureFlags ?? {})
    }
  };

  return getConfig();
}
