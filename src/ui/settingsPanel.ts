import { getConfig, updateConfig } from '../settings/config';

export class SettingsPanel {
  private panel: HTMLElement;
  private button: HTMLButtonElement;
  private basePathInput: HTMLInputElement;
  private syncButton: HTMLButtonElement;

  constructor(private root: HTMLElement, private onUpdated: (message: string) => void) {
    this.panel = this.el<HTMLElement>('panel-settings');
    this.button = this.el<HTMLButtonElement>('btn-settings');
    this.basePathInput = this.el<HTMLInputElement>('cfg-base-path');
    this.syncButton = this.el<HTMLButtonElement>('btn-connect');

    const cfg = getConfig();
    this.basePathInput.value = cfg.apiBasePath;

    this.button.onclick = () => this.panel.classList.toggle('hidden');
    this.syncButton.onclick = () => {
      updateConfig({ apiBasePath: this.basePathInput.value.trim() });
      this.onUpdated('Safe runtime configuration updated.');
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
