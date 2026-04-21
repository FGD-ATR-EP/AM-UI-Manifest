# AM-UI-Manifest

## Project overview
**TH:** โครงการนี้เป็นตัวอย่างอินเทอร์เฟซเชิงรับรู้ (perceptual UI) ที่แปลง “เจตจำนง” ของผู้ใช้ให้กลายเป็นพฤติกรรมภาพแบบเรียลไทม์ผ่านระบบอนุภาค (particle field) โดยมี HUD สำหรับติดตามสถานะระบบ เทเลเมทรี และเส้นทาง fallback เพื่อให้เห็นการตอบสนองของระบบ AI ได้อย่างโปร่งใสและเข้าใจง่าย

**EN:** AM-UI-Manifest is a perceptual UI prototype that turns user intent into real-time visual behavior through a particle field. It includes a runtime HUD, telemetry, and fallback tracing so AI-state transitions remain observable, testable, and easy to reason about.

## System architecture
The runtime is intentionally modular and centered around five subsystems:

1. **EventBus**
   - Publishes and subscribes to app-level events (`INTENT_SUBMITTED`, `MANIFEST_READY`, `RENDER_DONE`, `ERROR`).
   - Decouples UI controls from runtime orchestration.

2. **StateMachine**
   - Manages deterministic state transitions: `IDLE -> THINKING -> EMITTING -> COOLDOWN -> IDLE`.
   - Prevents invalid transitions and clamps energy/entropy levels.

3. **ParticleEngine**
   - Renders the interactive field and reacts to pointer/touch bursts.
   - Applies color/pattern output from interpreted intent.

4. **HUD**
   - Displays runtime/network telemetry: state, energy, entropy, load, latency, error rate, throughput, and fallback count.
   - Shows manifest interpretation and structured logs.

5. **Settings**
   - Provides runtime configuration (e.g., proxy base path).
   - Supports operation tuning without rebuilding the app.

## Data contracts A/B/C/D/E
The workflow contracts are organized as five canonical stages:

- **A. Creative Intent**
  - Captures prompt text, goals, emotional valence, semantic concepts, and normalized intent metadata.

- **B. Manifestation Contract**
  - Defines visual behavior: palette mode, particle density, turbulence, flow direction, attractor points, and composition hints.

- **C. Render Job**
  - Encodes renderer profile, quality tier, FPS budget, shader profile, and export profile.

- **D. Artifact**
  - Tracks generated outputs (preview/final/layered/motion) and prompt lineage for reproducibility.

- **E. Provenance Audit**
  - Records request origin, policy decisions, rejected transitions, language-detection traces, and replay/session metadata.

## Runtime states and interaction model
### Runtime states
- **IDLE**: baseline visual drift, waiting for intent input.
- **THINKING**: inference and contract preparation are in progress.
- **EMITTING**: interpreted result is applied to the visual field.
- **COOLDOWN**: short stabilization window before returning to IDLE.

### Interaction model
- **Mouse / pointer**
  - `pointermove`: low-intensity negative burst for subtle motion shaping.
  - `pointerdown`: high-intensity positive burst for explicit activation.

- **Touch**
  - `touchstart`: stronger initial burst to compensate for coarse touch input.
  - `touchmove`: lighter drag bursts for continuous control.

- **Text formation / intent pipeline**
  - User submits text intent.
  - Input is preprocessed (language/semantic normalization).
  - Runtime attempts proxy inference with retries + timeout.
  - On failure, fallback-provider and then local heuristic paths may activate.
  - Manifest result updates field color/behavior and HUD diagnostics.

## Security & fallback policy
- **Input validation & output safety**
  - Runtime sanitizes numeric ranges (energy/entropy clamped).
  - HUD color rendering uses CSS color sanitization to avoid unsafe values.

- **Resilience controls**
  - Timeout + retry with exponential backoff.
  - Circuit breaker opens after repeated failures and auto-cools down.

- **Fallback order**
  1. Primary proxy provider
  2. Optional fallback provider
  3. Local heuristic fallback

- **Auditability**
  - Fallback and provenance signals are emitted as structured events for HUD logs and diagnostics.

## Known limitations and roadmap
### Known limitations
- Current visuals are intentionally abstract and do not enforce domain-specific semantics.
- Contract mapping quality depends on preprocessing heuristics and provider response quality.
- No built-in persistence layer for long-term telemetry storage yet.
- Accessibility and multilingual UX polish are still evolving.

### Roadmap
- Add stronger schema validation for all contract boundaries.
- Improve language-aware intent normalization and goal inference.
- Expand telemetry export (JSON/NDJSON) for offline analysis.
- Add configurable policy presets for reliability vs. latency.
- Improve mobile ergonomics and accessibility (ARIA, contrast, keyboard flow).
