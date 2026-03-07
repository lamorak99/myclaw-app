# Ada - Personal AI Assistant

Electron desktop app for Ada, your personal AI assistant with voice interface.

## Features

- **Push-to-Talk Voice** - Hold spacebar to speak, see live waveform
- **Presentation Canvas** - Ada can show text, diagrams, and embedded web pages
- **Ada Lovelace Persona** - British accent, proactive, intelligent

## Prerequisites

The Ada backend must be running:

```bash
cd ~/Development/cursor-myclaw-core
source .venv/bin/activate
myclaw web
```

## Installation

```bash
npm install
```

## Running

```bash
npm start
```

Or for development with DevTools:

```bash
npm run dev
```

## Building

```bash
# macOS
npm run build:mac

# Windows
npm run build:win

# Linux
npm run build:linux
```

## Architecture

- `src/main.js` - Electron main process
- `src/preload.js` - IPC bridge
- `src/renderer.js` - UI logic, voice recording, canvas management
- `src/index.html` - App structure
- `src/styles.css` - Styling
- `assets/` - Images and icons

## Part of MyClaw

This is the desktop interface for the MyClaw personal AI assistant system:

- [myclaw](https://github.com/lamorak99/myclaw) - Foundation docs
- [myclaw-core](https://github.com/lamorak99/myclaw-core) - Backend
- **myclaw-app** (this repo) - Desktop app
- [myclaw-memory](https://github.com/lamorak99/myclaw-memory) - Personal data
