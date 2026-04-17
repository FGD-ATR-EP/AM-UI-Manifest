import { getConfig, updateConfig } from '../settings/config';

export class SettingsPanel {
  private panel: HTMLElement;
  private button: HTMLButtonElement;
  private apiInput: HTMLInputElement;
  private syncButton: HTMLButtonElement;

  constructor(private root: HTMLElement, private onUpdated: (message: string) => void) {
    this.panel = this.el<HTMLElement>('panel-settings');
    this.button = this.el<HTMLButtonElement>('btn-settings');
    this.apiInput = this.el<HTMLInputElement>('cfg-api');
    this.syncButton = this.el<HTMLButtonElement>('btn-connect');

    const cfg = getConfig();
    this.apiInput.value = cfg.apiBase;

    this.button.onclick = () => this.panel.classList.toggle('hidden');
    this.syncButton.onclick = () => {
      updateConfig({ apiBase: this.apiInput.value.trim() || cfg.apiBase });
      this.onUpdated('Gateway configuration updated.');
      this.panel.classList.add('hidden');
    };
  }

  private el<T extends HTMLElement>(id: string): T {
    const node = this.root.querySelector<T>(`#${id}`);
    if (!node) {
      throw new Error(`Settings element missing: ${id}`);
    }

    return node;
  }
}
