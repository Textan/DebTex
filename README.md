# ⚖️ Debate Prep Suite

[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61dafb.svg)](https://react.dev/)
[![Tauri](https://img.shields.io/badge/Tauri-v2-FFC131.svg)](https://tauri.app/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF.svg)](https://vitejs.dev/)
[![Storage](https://img.shields.io/badge/Storage-IndexedDB%20Enterprise-success.svg)](#storage-architecture)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> A modern, Windows-native and web-ready debate intelligence platform featuring **Deep Grounded Research**, **Voice Document Search**, **Live Debate Transcription & Contradiction Detection**, and an **Enterprise IndexedDB Cloud Vault**.

---

## 🌟 Highlights & Capabilities

- 🔍 **Part 1: Deep Research Engine**
  - Synthesizes verified, non-obvious argument angles with `[NICHE]` scoring badges.
  - Enforces committee **Freeze Dates** and automatic **Wikipedia exclusions**.
  - **One-Click Approval Bridge**: Approving an angle compiles and appends it directly to Part 2's active working document for immediate voice retrieval.

- 🎙️ **Part 2: Voice Document Search**
  - Ingests arbitrary user documents (PDF, DOCX, TXT, Markdown).
  - Web Speech API speech-to-text with audio waveform listener.
  - Natural spoken query intent resolution with **instant auto-scroll and pulse highlighting**.

- 🏛️ **Part 3: Live Debate Assistant**
  - Dual-mode listening: **In-Person Roster Attribution** and **Zoom SDK Bot** with explicit on-join consent gating.
  - **Real-Time Contradiction Matrix**: Detects policy flip-flops across floor speeches.
  - **Retroactive Reassignment**: Reassign misattributed speeches with instant dossier recalculation.
  - **Dynamic Committee Position Document**: Compiled on the fly with clickable speech timestamps.

- 💾 **Enterprise Storage Vault**
  - High-performance, quota-unlimited **IndexedDB** engine backed by a zero-flicker in-memory cache.
  - Automatic migration from legacy browser storage.
  - Project duplication / branching, live storage telemetry, and JSON backup export/import.

- 🔐 **Native Windows Security**
  - API keys (Brave Search, Zoom SDK) are stored in the **Windows Credential Manager** via DPAPI encryption—never in plain text.

---

## 🏛️ System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Windows 11 Fluent UI                            │
│   ┌───────────────────┬───────────────────┬────────────────────────┐   │
│   │ 1. Deep Research  │ 2. Voice Search   │ 3. Live Floor Assistant│   │
│   └─────────┬─────────┴─────────▲─────────┴────────────┬───────────┘   │
└─────────────┼───────────────────┼──────────────────────┼───────────────┘
              │ Approve Angle     │ Search / Scroll      │ Floor Speech
              ▼                   │                      ▼
┌─────────────────────────────────┴──────────────────────────────────────┐
│                    Reactive In-Memory Project Store                    │
│    (Zero-latency synchronous reads for instant, flicker-free renders)   │
└─────────────────────────────────┬──────────────────────────────────────┘
                                  │ Transactional Commits
        ┌─────────────────────────┴─────────────────────────┐
        ▼                                                   ▼
┌───────────────────────────────┐           ┌────────────────────────────┐
│      Tier 1: IndexedDB        │           │    Tier 2: Windows DPAPI   │
│   - Unlimited quota capacity  │           │   - Credential Manager     │
│   - Object stores & indices   │           │   - Brave Search API Key   │
│   - Auto-migration engine     │           │   - Zoom OAuth Credentials │
└───────────────────────────────┘           └────────────────────────────┘
```

---

## 🚀 Quick Start

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18+) or [Bun](https://bun.sh/) (v1.0+)
- *(Optional for Windows native app)*: [Rust](https://www.rust-lang.org/)

### 2. Installation
```bash
git clone https://github.com/<YOUR_USERNAME>/debate-prep-suite.git
cd debate-prep-suite
npm install
```

### 3. Run Automated Verification Tests
```bash
npm run test
```
*Executes all 25 automated end-to-end tests covering research synthesis, voice search, contradiction tracking, retroactive reassignment, and enterprise storage.*

### 4. Launch in Web / PWA Mode
```bash
npm run dev
```
Open **`http://localhost:5173/`** in Chrome or Edge. Click **Install App** in the browser address bar to run it as a standalone window!

### 5. Launch as a Windows Native App (Tauri v2)
```bash
npm run tauri dev
```
To bundle a production Windows `.msi` / `.exe` installer:
```bash
npm run tauri build
```

---

## ⌨️ Global Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| <kbd>Ctrl</kbd> + <kbd>1</kbd> | Switch to **Deep Research Engine** |
| <kbd>Ctrl</kbd> + <kbd>2</kbd> | Switch to **Voice Document Search** |
| <kbd>Ctrl</kbd> + <kbd>3</kbd> | Switch to **Live Debate Assistant** |
| <kbd>Ctrl</kbd> + <kbd>K</kbd> | Focus Spoken Query / Search Bar |
| <kbd>Ctrl</kbd> + <kbd>E</kbd> | Export Debate Session Brief |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>L</kbd> | Toggle Floor Listening Microphone |

---

## 📁 Repository Structure

```
debate-prep-suite/
├── DEBATE_PREP_SUITE_EXPLANATION.md # In-depth technical architecture breakdown
├── src/
│   ├── components/                 # Fluent UI React components
│   │   ├── DebateHome.tsx          # Debate Projects Hub & storage management
│   │   ├── DeepResearchEngine.tsx  # Part 1: Deep Research with freeze dates
│   │   ├── VoiceDocumentSearch.tsx # Part 2: Custom doc parser & voice search
│   │   ├── LiveDebateAssistant.tsx # Part 3: Floor listener & position paper
│   │   └── SettingsModal.tsx       # Credential Manager & keyboard shortcuts
│   ├── services/
│   │   ├── api.ts                  # IPC bridge (Tauri native & web engine)
│   │   └── cloudVault.ts           # Enterprise IndexedDB storage repository
│   ├── types/
│   │   └── index.ts                # TypeScript domain models
│   └── App.tsx                     # Main shell layout with project routing
├── src-tauri/                      # Windows native backend (Rust)
│   ├── src/credentials.rs          # Windows Credential Manager via keyring
│   ├── src/search_provider.rs      # Brave Search & freeze-date engine
│   ├── src/zoom_bot.rs             # Zoom Meeting SDK manager & consent gate
│   └── Cargo.toml                  # Rust dependencies
└── tests/
    ├── test_suite.mjs              # End-to-end capabilities test suite
    └── test_project_flow.mjs       # Storage, flow, and duplication test suite
```

---

## 📄 Documentation

For an exhaustive technical breakdown of every pipeline, the storage transition from `localStorage` to `IndexedDB`, and the Windows security architecture, read [DEBATE_PREP_SUITE_EXPLANATION.md](DEBATE_PREP_SUITE_EXPLANATION.md).

---

## ⚖️ License

Distributed under the MIT License. See `LICENSE` for more information.
