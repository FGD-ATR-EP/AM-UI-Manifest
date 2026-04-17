import type { ManifestResult, SystemSnapshot } from '../contracts/workflow';

export class HUD {
  private state: HTMLElement;
  private energy: HTMLElement;
  private entropy: HTMLElement;
  private logs: HTMLElement;
  private target: HTMLElement;
  private targetContent: HTMLElement;

  constructor(private root: HTMLElement) {
    this.state = this.el('metric-state');
    this.energy = this.el('bar-energy');
    this.entropy = this.el('bar-entropy');
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

  updateState(snapshot: SystemSnapshot): void {
    this.state.textContent = snapshot.mode;
    this.energy.style.width = `${Math.min(snapshot.energyLevel, 1) * 100}%`;
    this.entropy.style.width = `${Math.min(snapshot.entropyLevel, 1) * 100}%`;
  }

  log(message: string, type: 'SYS' | 'API' | 'ERR' = 'SYS'): void {
    const entry = document.createElement('div');
    entry.textContent = `[${type}] ${message}`;
    if (type === 'ERR') entry.classList.add('text-red-400');
    if (type === 'API') entry.classList.add('text-purple-400');
    this.logs.appendChild(entry);
    this.logs.scrollTop = this.logs.scrollHeight;
  }

  showManifest(result: ManifestResult): void {
    this.targetContent.innerHTML = `
      <div class="space-y-2">
        <div class="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded font-mono text-[11px] leading-relaxed">
          > ${result.interpretation}
        </div>
        <div class="flex space-x-2">
          ${result.colors
            .map((c) => `<div class="w-4 h-4 rounded-sm border border-white/10" style="background:${c}"></div>`)
            .join('')}
        </div>
      </div>
    `;
    this.target.classList.remove('hidden');
  }
}
