import { EventBus } from './core/eventBus';
import type { AppEventMap } from './contracts/events';
import { ParticleEngine } from './render/particleEngine';
import { interpretIntent } from './runtime/intentInterpreter';
import { RuntimeStateMachine } from './runtime/stateMachine';
import { TelemetryStore } from './runtime/telemetry';
import { HUD } from './ui/hud';
import { SettingsPanel } from './ui/settingsPanel';

type SpeechRecognitionAlternativeLike = { transcript: string };
type SpeechRecognitionResultLike = { isFinal: boolean; [index: number]: SpeechRecognitionAlternativeLike };
type SpeechRecognitionResultListLike = { length: number; [index: number]: SpeechRecognitionResultLike };
type SpeechRecognitionEventLike = { resultIndex: number; results: SpeechRecognitionResultListLike };
type SpeechRecognitionErrorEventLike = { error: string };

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type BrowserSpeechRecognitionCtor = new () => BrowserSpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: BrowserSpeechRecognitionCtor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionCtor;
  }
}

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
          Home mode: multimodal intent input (text + voice + attachments). Open Settings for HUD, logs, and runtime configuration.
        </div>
        <div id="composer-container" class="glass-panel rounded-2xl p-2 flex items-center space-x-2 transition-all duration-300 border border-white/10">
          <button id="btn-attach" type="button" class="px-3 py-2 rounded-xl border border-white/10 text-gray-300 hover:bg-white/10 transition-colors" aria-label="Attach files">📎</button>
          <button id="btn-voice" type="button" class="px-3 py-2 rounded-xl border border-cyan-500/30 text-cyan-200 hover:bg-cyan-500/20 transition-colors" aria-label="Start voice input">🎙️</button>
          <input type="text" id="composer-input" class="flex-1 bg-transparent text-white placeholder-gray-500 text-sm sm:text-base py-2 px-2" placeholder="ป้อนเจตจำนงเชิงปัญญา (Cognitive intent)...">
          <button id="btn-emit" class="px-4 py-2 sm:py-3 bg-indigo-500/20 hover:bg-indigo-500/40 border border-indigo-500/30 text-indigo-200 hover:text-white rounded-xl transition-all">EMIT</button>
        </div>
        <input id="attachment-input" type="file" class="hidden" multiple>
        <div class="mt-2 px-2 text-[11px] text-gray-400 font-mono flex items-center justify-between gap-2">
          <span id="attachment-summary">No attachment selected</span>
          <span id="voice-status">Voice: standby</span>
        </div>
        <div class="mt-1 h-1 w-full rounded-full overflow-hidden bg-white/5">
          <div id="voice-level" class="h-full w-[2%] bg-cyan-400/80 transition-[width] duration-75"></div>
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
  const attachButton = root.querySelector<HTMLButtonElement>('#btn-attach');
  const attachmentInput = root.querySelector<HTMLInputElement>('#attachment-input');
  const attachmentSummary = root.querySelector<HTMLElement>('#attachment-summary');
  const voiceButton = root.querySelector<HTMLButtonElement>('#btn-voice');
  const voiceStatus = root.querySelector<HTMLElement>('#voice-status');
  const voiceLevel = root.querySelector<HTMLElement>('#voice-level');
  const settingsButton = root.querySelector<HTMLButtonElement>('#btn-settings');
  const settingsSection = root.querySelector<HTMLElement>('#settings-section');
  if (!composer || !emitButton || !attachButton || !attachmentInput || !attachmentSummary) throw new Error('composer controls missing');
  if (!voiceButton || !voiceStatus || !voiceLevel) throw new Error('voice controls missing');
  if (!settingsButton || !settingsSection) throw new Error('settings controls missing');

  const REQUEST_TIMEOUT_MS = 15000;
  let submitLockTimer: number | undefined;
  let isSubmitLocked = false;
  let currentRequestToken = 0;

  const clearSubmitLockTimer = () => {
    if (submitLockTimer !== undefined) {
      window.clearTimeout(submitLockTimer);
      submitLockTimer = undefined;
    }
  };

  const setSubmitLocked = (locked: boolean) => {
    isSubmitLocked = locked;
    composer.disabled = locked;
    emitButton.disabled = locked;
    attachButton.disabled = locked;
    voiceButton.disabled = locked;
    emitButton.setAttribute('aria-busy', locked ? 'true' : 'false');
  };

  const unlockSubmit = () => {
    clearSubmitLockTimer();
    setSubmitLocked(false);
  };

  const lockSubmitWithTimeoutGuard = () => {
    clearSubmitLockTimer();
    setSubmitLocked(true);
    const requestTokenAtLock = currentRequestToken;
    submitLockTimer = window.setTimeout(() => {
      if (!isSubmitLocked || requestTokenAtLock !== currentRequestToken) return;
      currentRequestToken += 1;
      bus.emit('ERROR', {
        message: `Request timed out after ${REQUEST_TIMEOUT_MS}ms`,
        cause: new Error('request timeout')
      });
    }, REQUEST_TIMEOUT_MS);
  };

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
    }, 'API');
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
    const requestToken = currentRequestToken;
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
      if (requestToken !== currentRequestToken) return;
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
      if (requestToken !== currentRequestToken) return;
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
      unlockSubmit();
    }, 1500);
  });

  bus.on('ERROR', ({ message }) => {
    hud.log(`Runtime error: ${message}`, 'ERR');
    if (machine.state.mode !== 'COOLDOWN') {
      applyState('COOLDOWN');
      setTimeout(() => applyState('IDLE'), 500);
    }
    unlockSubmit();
  });

  const submitIntent = () => {
    if (isSubmitLocked) return;
    const intent = composer.value.trim();
    if (!intent) return;
    currentRequestToken += 1;
    composer.value = '';
    lockSubmitWithTimeoutGuard();
    bus.emit('INTENT_SUBMITTED', { intent });
  };

  emitButton.onclick = submitIntent;
  composer.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    const isVirtualKeyboardComposing = event.isComposing || event.keyCode === 229;
    if (isVirtualKeyboardComposing) return;
    if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey || event.repeat) return;
    event.preventDefault();
    submitIntent();
  });

  attachButton.onclick = () => attachmentInput.click();
  attachmentInput.onchange = () => {
    const files = attachmentInput.files;
    if (!files || files.length === 0) {
      attachmentSummary.textContent = 'No attachment selected';
      return;
    }

    const names = Array.from(files).map((file) => file.name);
    const preview = names.slice(0, 2).join(', ');
    attachmentSummary.textContent = files.length > 2
      ? `${preview}, +${files.length - 2} more`
      : preview;
    hud.log(`Attachment queued (${files.length}): ${names.join(', ')}`, 'SYS');
  };

  const SpeechRecognitionCtor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
  if (!SpeechRecognitionCtor) {
    voiceButton.disabled = true;
    voiceStatus.textContent = 'Voice: unavailable on this browser';
  } else {
    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'th-TH';

    let micStream: MediaStream | null = null;
    let audioContext: AudioContext | null = null;
    let analyzer: AnalyserNode | null = null;
    let rafId = 0;
    let isListening = false;

    const stopVoiceLevelMeter = () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      }
      if (audioContext) {
        void audioContext.close();
        audioContext = null;
      }
      micStream?.getTracks().forEach((track) => track.stop());
      micStream = null;
      analyzer = null;
      voiceLevel.style.width = '2%';
    };

    const startVoiceLevelMeter = async () => {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(micStream);
      analyzer = audioContext.createAnalyser();
      analyzer.fftSize = 256;
      source.connect(analyzer);

      const bins = new Uint8Array(analyzer.frequencyBinCount);
      const tick = () => {
        if (!analyzer) return;
        analyzer.getByteFrequencyData(bins);
        const sum = bins.reduce((acc, value) => acc + value, 0);
        const avg = sum / bins.length / 255;
        const width = Math.max(2, Math.min(100, Math.round(avg * 180)));
        voiceLevel.style.width = `${width}%`;
        rafId = window.requestAnimationFrame(tick);
      };
      tick();
    };

    const beginListening = async () => {
      if (isListening || isSubmitLocked) return;
      try {
        await startVoiceLevelMeter();
        recognition.start();
      } catch (error) {
        stopVoiceLevelMeter();
        voiceStatus.textContent = 'Voice: microphone permission denied';
        hud.log(`Voice input failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'ERR');
      }
    };

    const endListening = () => {
      if (!isListening) return;
      recognition.stop();
    };

    recognition.onstart = () => {
      isListening = true;
      voiceStatus.textContent = 'Voice: listening...';
      voiceButton.classList.add('bg-cyan-500/30');
    };

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      const transcripts: string[] = [];
      for (let i = 0; i < event.results.length; i += 1) {
        transcripts.push(event.results[i]?.[0]?.transcript ?? '');
      }
      const transcript = transcripts.join(' ').trim();
      composer.value = transcript;
      if (event.results[event.resultIndex]?.isFinal) {
        voiceStatus.textContent = 'Voice: transcript ready';
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
      voiceStatus.textContent = `Voice: ${event.error}`;
      hud.log(`Voice recognition error: ${event.error}`, 'ERR');
    };

    recognition.onend = () => {
      isListening = false;
      voiceButton.classList.remove('bg-cyan-500/30');
      voiceStatus.textContent = 'Voice: standby';
      stopVoiceLevelMeter();
    };

    voiceButton.onclick = () => {
      if (isListening) {
        endListening();
        return;
      }
      void beginListening();
    };
  }

  window.onresize = () => particles.resize();
  telemetry.updateRuntime(machine.state);
  syncHUD();
}

bootstrap();
