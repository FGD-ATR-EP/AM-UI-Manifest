import { EventBus } from './core/eventBus';
import type { AppEventMap } from './contracts/events';
import { ParticleEngine } from './render/particleEngine';
import { interpretIntent } from './runtime/intentInterpreter';
import { RuntimeStateMachine } from './runtime/stateMachine';
import { TelemetryStore } from './runtime/telemetry';
import { HUD } from './ui/hud';
import { SettingsPanel } from './ui/settingsPanel';

function mountAppShell(root: HTMLElement): void {
  root.innerHTML = `
    <div id="canvas-container" class="absolute inset-0 z-0"></div>
    <div class="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-4 sm:p-6 text-sm text-slate-100">
      <div class="pointer-events-auto flex justify-end w-full">
        <button id="btn-settings" aria-expanded="false" class="px-3 py-2 glass-panel rounded-full hover:bg-white/10 font-mono text-[11px] tracking-wide">
          SETTINGS
        </button>
      </div>

      <section id="settings-section" class="w-full hidden pointer-events-auto">
        <div class="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
          <div class="glass-panel rounded-xl p-4 space-y-3">
            <div class="flex justify-between items-center border-b border-white/10 pb-2">
              <span class="font-bold tracking-wider text-xs text-indigo-200 uppercase">Aetherium OS</span>
            </div>
            <div class="space-y-2 font-mono text-[10px]">
              <div class="flex justify-between"><span class="text-gray-400">STATE</span><span id="metric-state" class="text-cyan-400">IDLE</span></div>
              <div class="flex justify-between items-center"><span class="text-gray-400">ENERGY</span><div class="w-24 h-1 bg-gray-800 rounded-full overflow-hidden"><div id="bar-energy" class="h-full bg-cyan-400 w-[20%]"></div></div></div>
              <div class="flex justify-between items-center"><span class="text-gray-400">ENTROPY</span><div class="w-24 h-1 bg-gray-800 rounded-full overflow-hidden"><div id="bar-entropy" class="h-full bg-purple-400 w-[10%]"></div></div></div>
              <div class="flex justify-between items-center"><span class="text-gray-400">LOAD</span><div class="w-24 h-1 bg-gray-800 rounded-full overflow-hidden"><div id="bar-load" class="h-full bg-amber-400 w-[8%]"></div></div></div>
            </div>
            <div class="pt-2 border-t border-white/10 space-y-1 font-mono text-[10px]">
              <div class="flex justify-between"><span class="text-gray-400">REQUESTS</span><span id="metric-request-count" class="text-emerald-300">0 / 60s</span></div>
              <div class="flex justify-between"><span class="text-gray-400">IN-FLIGHT</span><span id="metric-in-flight" class="text-emerald-300">0</span></div>
              <div class="flex justify-between"><span class="text-gray-400">AVG LATENCY</span><span id="metric-avg-latency" class="text-emerald-300">0ms</span></div>
              <div class="flex justify-between"><span class="text-gray-400">ERROR RATE</span><span id="metric-error-rate" class="text-emerald-300">0%</span></div>
              <div class="flex justify-between"><span class="text-gray-400">THROUGHPUT</span><span id="metric-throughput" class="text-emerald-300">0/min</span></div>
              <div class="flex justify-between"><span class="text-gray-400">FALLBACKS</span><span id="metric-fallbacks" class="text-emerald-300">0 / 60s</span></div>
            </div>
            <div id="console-logs" class="h-20 overflow-y-auto pt-2 border-t border-white/10 font-mono text-[9px] text-gray-500 space-y-1 mt-2"><div>[SYS] Runtime ready.</div></div>
          </div>

          <div class="space-y-4">
            <div class="flex justify-end">
              <button id="btn-config" class="p-2 glass-panel rounded-full hover:bg-white/10" aria-expanded="false">⚙️</button>
            </div>

            <div id="panel-settings" class="glass-panel rounded-xl p-4 w-full max-w-md hidden transition-all">
              <h3 class="text-xs font-bold text-gray-300 mb-3 uppercase tracking-wider">Runtime Configuration</h3>
              <div class="space-y-3 font-mono text-[10px]"><label class="block text-gray-500 mb-1">Proxy Base Path</label><input type="text" id="cfg-base-path" placeholder="(optional) e.g. /internal" class="w-full bg-black/50 border border-white/10 rounded px-2 py-1 text-gray-300 font-mono"><button id="btn-connect" class="w-full bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/30 rounded py-1.5 transition-colors">Apply & Sync</button></div>
            </div>

            <div id="visual-target" class="glass-panel rounded-xl p-4 hidden">
              <div class="flex items-center justify-between border-b border-white/5 pb-2 mb-3"><span class="text-xs text-gray-400 font-mono">Cognitive Manifestation</span></div>
              <div id="target-content" class="text-sm text-gray-300"></div>
            </div>
          </div>
        </div>
      </section>

      <div class="w-full max-w-2xl mx-auto pointer-events-auto pb-4 sm:pb-8">
        <div class="glass-panel rounded-xl px-3 py-2 mb-3 text-[11px] sm:text-xs text-gray-300 font-mono text-center">
          Home mode: interactive field + intent input. Open Settings for HUD / logs / config.
        </div>
        <div id="composer-container" class="glass-panel rounded-2xl p-2 flex items-center space-x-2 transition-all duration-300 border border-white/10">
          <input type="text" id="composer-input" class="flex-1 bg-transparent text-white placeholder-gray-500 text-sm sm:text-base py-2 px-2" placeholder="ป้อนเจตจำนงเชิงปัญญา (Cognitive Intent)...">
          <button id="btn-emit" class="px-4 py-2 sm:py-3 bg-indigo-500/20 hover:bg-indigo-500/40 border border-indigo-500/30 text-indigo-200 hover:text-white rounded-xl transition-all">EMIT</button>
        </div>
      </div>
    </div>
  `;
}

function bootstrap(): void {
  const root = document.getElementById('app-root');
  if (!root) throw new Error('app-root missing');

  mountAppShell(root);

  const bus = new EventBus();
  const machine = new RuntimeStateMachine();
  const telemetry = new TelemetryStore();
  const hud = new HUD(root);
  const canvasContainer = root.querySelector<HTMLElement>('#canvas-container');

  if (!canvasContainer) throw new Error('canvas-container missing');

  const particles = new ParticleEngine(canvasContainer);
  new SettingsPanel(root, (msg) => hud.log(msg));

  const composer = root.querySelector<HTMLInputElement>('#composer-input');
  const emitButton = root.querySelector<HTMLButtonElement>('#btn-emit');
  const settingsButton = root.querySelector<HTMLButtonElement>('#btn-settings');
  const settingsSection = root.querySelector<HTMLElement>('#settings-section');
  if (!composer || !emitButton) throw new Error('composer controls missing');
  if (!settingsButton || !settingsSection) throw new Error('settings controls missing');

  settingsButton.onclick = () => {
    const willOpen = settingsSection.classList.contains('hidden');
    settingsSection.classList.toggle('hidden');
    settingsButton.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
  };

  const syncHUD = () => hud.updateState(telemetry.getSnapshot());
  const burstFromTouch = (touch: Touch, intensity: number, direction: 1 | -1): void => {
    particles.applyBurst(touch.clientX, touch.clientY, intensity, direction);
  };

  window.addEventListener('pointermove', (event) => {
    particles.applyBurst(event.clientX, event.clientY, 0.15, -1);
  });

  window.addEventListener('pointerdown', (event) => {
    particles.applyBurst(event.clientX, event.clientY, 1.0, 1);
  });

  window.addEventListener('touchstart', (event) => {
    const touch = event.touches[0];
    if (!touch) return;
    burstFromTouch(touch, 1.15, 1);
  }, { passive: true });

  window.addEventListener('touchmove', (event) => {
    const touch = event.touches[0];
    if (!touch) return;
    burstFromTouch(touch, 0.25, -1);
  }, { passive: true });

  window.addEventListener('intent:fallback', (event: Event) => {
    const detail = (event as CustomEvent<Record<string, unknown>>).detail;
    telemetry.recordEvent('fallback_triggered');
    syncHUD();
    hud.logStructured('fallback_triggered', {
      ...detail,
      timestamp: new Date().toISOString()
    }, 'ERR');
  });

  window.addEventListener('intent:provenance', (event: Event) => {
    const detail = (event as CustomEvent<Record<string, unknown>>).detail;
    hud.logStructured('intent_provenance', {
      ...detail,
      timestamp: new Date().toISOString()
    }, 'SYS');
  });

  const animate = () => {
    particles.render(machine.state);
    requestAnimationFrame(animate);
  };
  animate();

  const applyState = (next: Parameters<RuntimeStateMachine['transition']>[0]) => {
    const state = machine.transition(next);
    telemetry.updateRuntime(state);
    syncHUD();
  };

  bus.on('INTENT_SUBMITTED', async ({ intent }) => {
    const startedAt = performance.now();

    try {
      particles.transitionToTextFormation(intent);
      applyState('THINKING');
      telemetry.recordEvent('request_started');
      syncHUD();
      hud.logStructured('request_started', {
        intentPreview: intent.slice(0, 60),
        intentLength: intent.length,
        timestamp: new Date().toISOString()
      });

      const result = await interpretIntent(intent);
      const latencyMs = performance.now() - startedAt;
      telemetry.recordEvent('request_succeeded', Date.now(), latencyMs);
      syncHUD();
      hud.logStructured('request_succeeded', {
        latencyMs: Number(latencyMs.toFixed(1)),
        colors: result.colors,
        provider: result.provider ?? 'proxy',
        fallbackReason: result.fallbackReason ?? null,
        timestamp: new Date().toISOString()
      });
      bus.emit('MANIFEST_READY', { intent, result });
    } catch (cause) {
      const latencyMs = performance.now() - startedAt;
      telemetry.recordEvent('request_failed', Date.now(), latencyMs);
      syncHUD();
      const message = cause instanceof Error ? cause.message : 'Unknown runtime error';
      hud.logStructured('request_failed', {
        latencyMs: Number(latencyMs.toFixed(1)),
        message,
        timestamp: new Date().toISOString()
      }, 'ERR');
      bus.emit('ERROR', { message, cause });
    }
  });

  bus.on('MANIFEST_READY', ({ result }: AppEventMap['MANIFEST_READY']) => {
    applyState('EMITTING');
    machine.applyManifest(result.energy, result.entropy);
    telemetry.updateRuntime(machine.state);
    syncHUD();
    particles.applyColors(result.colors);
    hud.showManifest(result);
    hud.log('Manifest ready. Rendering field mutation.', 'API');
    bus.emit('RENDER_DONE', { state: 'EMITTING' });
  });

  bus.on('RENDER_DONE', () => {
    applyState('COOLDOWN');
    setTimeout(() => {
      applyState('IDLE');
      composer.disabled = false;
      emitButton.disabled = false;
    }, 1500);
  });

  bus.on('ERROR', ({ message }) => {
    hud.log(`Link Error: ${message}`, 'ERR');
    if (machine.state.mode !== 'COOLDOWN') {
      applyState('COOLDOWN');
      setTimeout(() => applyState('IDLE'), 500);
    }
    composer.disabled = false;
    emitButton.disabled = false;
  });

  const submitIntent = () => {
    const intent = composer.value.trim();
    if (!intent) return;
    composer.value = '';
    composer.disabled = true;
    emitButton.disabled = true;
    bus.emit('INTENT_SUBMITTED', { intent });
  };

  emitButton.onclick = submitIntent;
  composer.onkeypress = (e) => {
    if (e.key === 'Enter') submitIntent();
  };

  window.onresize = () => particles.resize();
  telemetry.updateRuntime(machine.state);
  syncHUD();
}

bootstrap();
