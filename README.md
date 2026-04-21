# AM-UI-Manifest

Perceptual UI prototype that maps user intent to real-time visual behavior.

## Overview

AM-UI-Manifest receives text intent from users, interprets it into manifestation contracts, then renders a responsive particle field while exposing internal runtime state through a HUD. The architecture is intentionally modular so each stage (intent, runtime transitions, rendering, telemetry) can be tested independently.

## Repository structure

```text
.
├── .github/workflows/
│   ├── ci.yml                  # Typecheck + build on PR/push
│   ├── codeql.yml              # Code scanning for TS/JS
│   ├── dependency-review.yml   # PR dependency risk gate
│   └── pages.yml               # Build and deploy static site to GitHub Pages
├── index.html                  # App shell and mount point
├── src/
│   ├── contracts/
│   │   ├── events.ts           # Runtime event contracts
│   │   └── workflow.ts         # Intent/manifest contract schema
│   ├── core/
│   │   └── eventBus.ts         # Pub/sub event bus
│   ├── render/
│   │   ├── particleEngine.ts   # Visual engine
│   │   └── textField.ts        # Intent input bindings
│   ├── runtime/
│   │   ├── intentInterpreter.ts# Intent -> manifest logic
│   │   ├── language.ts         # Language normalization
│   │   ├── stateMachine.ts     # Deterministic runtime states
│   │   └── telemetry.ts        # Runtime diagnostics
│   ├── settings/
│   │   └── config.ts           # Runtime configuration
│   ├── ui/
│   │   ├── hud.ts              # HUD + runtime logs
│   │   └── settingsPanel.ts    # UI runtime controls
│   └── main.ts                 # Application composition root
├── package.json
├── tsconfig.json
└── SECURITY.md
```

## Runtime architecture

### 1) Event bus
Central event dispatch layer for `INTENT_SUBMITTED`, `MANIFEST_READY`, `RENDER_DONE`, and `ERROR` events.

### 2) State machine
Deterministic transitions:

`IDLE -> THINKING -> EMITTING -> COOLDOWN -> IDLE`

Energy/entropy are clamped to prevent invalid transitions.

### 3) Intent interpreter
Transforms normalized user intent into manifestation parameters such as palette, density, flow, turbulence, and attractor behavior.

### 4) Particle engine
Applies manifest settings to visual rendering and responds to pointer/touch bursts.

### 5) HUD and telemetry
Surfaces current state, latency, throughput, error/fallback counts, and trace logs for observability.

## Data contracts (A-E)

- **A: Creative Intent** — user goals, emotion, semantic hints.
- **B: Manifestation Contract** — visual behavior settings.
- **C: Render Job** — quality, FPS, profile constraints.
- **D: Artifact** — output lineage and generated previews.
- **E: Provenance Audit** — request origin, policy/fallback traces.

## Development

### Requirements
- Node.js 20+ (Node 22 recommended)
- npm

### Install

```bash
npm install
```

### Local checks

```bash
npm run typecheck
npm run build
# or combined
npm run check
```

### Dev mode

```bash
npm run dev
```

This runs esbuild in watch mode.

## CI/CD workflows

- **CI (`ci.yml`)**: runs `npm install`, `npm run typecheck`, `npm run build` on pull requests, pushes to `main`, and manual dispatch.
- **Dependency Review (`dependency-review.yml`)**: checks introduced dependencies on pull requests.
- **CodeQL (`codeql.yml`)**: weekly + PR/push static code scanning for TypeScript/JavaScript.
- **Pages (`pages.yml`)**: builds static assets and deploys `index.html` + `dist/` to GitHub Pages.

## Security and resilience

- Numeric guardrails for runtime signals (energy/entropy clamps).
- CSS color sanitization in visual output paths.
- Timeout + retry + cooldown/circuit-breaker fallback behavior.
- Structured fallback/provenance signals emitted for auditability.
