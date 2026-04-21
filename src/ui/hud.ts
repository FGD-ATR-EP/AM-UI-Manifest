import type { ManifestResult } from '../contracts/workflow';
import type { TelemetrySnapshot } from '../runtime/telemetry';

export class HUD {
  private state: HTMLElement;
  private energy: HTMLElement;
  private entropy: HTMLElement;
  private load: HTMLElement;
  private requestCount: HTMLElement;
  private inFlight: HTMLElement;
  private avgLatency: HTMLElement;
  private errorRate: HTMLElement;
  private throughput: HTMLElement;
  private fallbackCount: HTMLElement;
  private logs: HTMLElement;
  private target: HTMLElement;
  private targetContent: HTMLElement;

  constructor(private root: HTMLElement) {
    this.state = this.el('metric-state');
    this.energy = this.el('bar-energy');
    this.entropy = this.el('bar-entropy');
    this.load = this.el('bar-load');
    this.requestCount = this.el('metric-request-count');
    this.inFlight = this.el('metric-in-flight');
    this.avgLatency = this.el('metric-avg-latency');
    this.errorRate = this.el('metric-error-rate');
    this.throughput = this.el('metric-throughput');
    this.fallbackCount = this.el('metric-fallbacks');
    this.logs = this.el('console-logs');
    this.target = this.el('visual-target');
    this.targetContent = this.el('target-content');
  }

  private el(id: string): HTMLElement {
    const node = this.root.querySelector<HTMLElement>(`#${id}`);
    if (!node) {
      throw new Error(`HUD element missing: ${id}`);
    }

    return node;
  }

  updateState(snapshot: TelemetrySnapshot): void {
    const { runtime, network } = snapshot;
    this.state.textContent = runtime.mode;
    this.energy.style.width = `${Math.min(runtime.energyLevel, 1.5) / 1.5 * 100}%`;
    this.entropy.style.width = `${Math.min(runtime.entropyLevel, 1.5) / 1.5 * 100}%`;
    this.load.style.width = `${Math.min(runtime.loadLevel, 1.5) / 1.5 * 100}%`;

    this.requestCount.textContent = `${network.requestCountWindow} / 60s`;
    this.inFlight.textContent = String(network.inFlightRequests);
    this.avgLatency.textContent = `${network.avgLatencyMs.toFixed(0)}ms`;
    this.errorRate.textContent = `${(network.errorRate * 100).toFixed(0)}%`;
    this.throughput.textContent = `${network.throughputPerMinute}/min`;
    this.fallbackCount.textContent = `${network.fallbackCountWindow} / 60s`;
  }

  log(message: string, type: 'SYS' | 'API' | 'ERR' = 'SYS'): void {
    const entry = document.createElement('div');
    entry.textContent = `[${type}] ${message}`;
    if (type === 'ERR') entry.classList.add('text-red-400');
    if (type === 'API') entry.classList.add('text-purple-400');
    this.logs.appendChild(entry);
    this.logs.scrollTop = this.logs.scrollHeight;
  }

  logStructured(event: string, payload: Record<string, unknown>, type: 'SYS' | 'API' | 'ERR' = 'API'): void {
    this.log(`${event} ${JSON.stringify(payload)}`, type);
  }

  showManifest(result: ManifestResult): void {
    this.targetContent.replaceChildren();

    const wrapper = document.createElement('div');
    wrapper.className = 'space-y-2';

    const interpretation = document.createElement('div');
    interpretation.className = 'p-3 bg-indigo-500/10 border border-indigo-500/20 rounded font-mono text-[11px] leading-relaxed';
    interpretation.textContent = `> ${result.interpretation}`;

    const colors = document.createElement('div');
    colors.className = 'flex space-x-2';

    result.colors
      .map((color) => this.sanitizeColor(color))
      .filter((color): color is string => color !== null)
      .forEach((color) => {
        const swatch = document.createElement('div');
        swatch.className = 'w-4 h-4 rounded-sm border border-white/10';
        swatch.style.backgroundColor = color;
        colors.appendChild(swatch);
      });

    wrapper.appendChild(interpretation);
    wrapper.appendChild(colors);
    this.targetContent.appendChild(wrapper);
    this.target.classList.remove('hidden');
  }

  private sanitizeColor(color: string): string | null {
    const value = color.trim();
    if (/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value)) {
      return value;
    }

    return null;
  }
}
