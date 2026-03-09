// Ada Electron App - Renderer Process
// With comprehensive logging for debugging

const API_BASE = 'http://127.0.0.1:8000';

// Logging system
const logs = [];
function log(category, message, data = null) {
  const timestamp = new Date().toISOString().substr(11, 12);
  const entry = { timestamp, category, message, data };
  logs.push(entry);

  // Console output
  const dataStr = data ? ` | ${JSON.stringify(data)}` : '';
  console.log(`[${timestamp}] [${category}] ${message}${dataStr}`);

  // Update UI log panel
  updateLogPanel();
}

function updateLogPanel() {
  const logPanel = document.getElementById('logPanel');
  if (!logPanel) return;

  const recentLogs = logs.slice(-100);
  logPanel.innerHTML = recentLogs.map(l => {
    const dataStr = l.data ? ` <span class="log-data">${JSON.stringify(l.data)}</span>` : '';
    return `<div class="log-entry log-${l.category}"><span class="log-time">${l.timestamp}</span> <span class="log-cat">[${l.category}]</span> ${l.message}${dataStr}</div>`;
  }).join('');

  logPanel.scrollTop = logPanel.scrollHeight;
}

// DOM Elements
const adaImage = document.getElementById('adaImage');
const adaStatus = document.getElementById('adaStatus');
const pttButton = document.getElementById('pttButton');
const waveformContainer = document.getElementById('waveformContainer');
const waveformCanvas = document.getElementById('waveformCanvas');
const recordingIndicator = document.getElementById('recordingIndicator');
const transcriptArea = document.getElementById('transcriptArea');
const transcriptText = document.getElementById('transcriptText');
const canvasTitle = document.getElementById('canvasTitle');
const canvasContent = document.getElementById('canvasContent');
const canvasFrame = document.getElementById('canvasFrame');
const clearCanvasBtn = document.getElementById('clearCanvasBtn');
const welcomeMessage = document.getElementById('welcomeMessage');

// Audio context and recording
let audioContext = null;
let analyser = null;
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let animationFrameId = null;
let recordingStartTime = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  log('INIT', 'Gerty app initializing');
  createLogPanel();
  setupEventListeners();
  playGreeting();
  log('INIT', 'Initialization complete');
});

function createLogPanel() {
  // Add log panel toggle button
  const toggleBtn = document.createElement('button');
  toggleBtn.id = 'logToggle';
  toggleBtn.className = 'log-toggle';
  toggleBtn.innerHTML = '&#9650; Logs';
  toggleBtn.onclick = toggleLogPanel;
  document.body.appendChild(toggleBtn);

  // Add log panel to the UI
  const logPanel = document.createElement('div');
  logPanel.id = 'logPanel';
  logPanel.className = 'log-panel collapsed';
  document.body.appendChild(logPanel);

  // Add styles for log panel
  const style = document.createElement('style');
  style.textContent = `
    .log-toggle {
      position: fixed;
      bottom: 0;
      right: 20px;
      background: #1a1a2e;
      border: 1px solid #e94560;
      border-bottom: none;
      border-radius: 8px 8px 0 0;
      color: #e94560;
      padding: 6px 16px;
      font-size: 12px;
      font-family: 'SF Mono', Monaco, monospace;
      cursor: pointer;
      z-index: 10000;
      transition: all 0.2s;
    }
    .log-toggle:hover {
      background: #e94560;
      color: white;
    }
    .log-toggle.expanded {
      bottom: 300px;
    }
    .log-panel {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: 300px;
      background: #0a0a15;
      border-top: 2px solid #e94560;
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 12px;
      overflow-y: scroll;
      padding: 10px 15px;
      z-index: 9999;
      transition: transform 0.3s ease;
      -webkit-app-region: no-drag;
    }
    .log-panel.collapsed {
      transform: translateY(100%);
    }
    .log-panel::-webkit-scrollbar {
      width: 12px;
    }
    .log-panel::-webkit-scrollbar-track {
      background: #1a1a2e;
    }
    .log-panel::-webkit-scrollbar-thumb {
      background: #444;
      border-radius: 6px;
    }
    .log-panel::-webkit-scrollbar-thumb:hover {
      background: #666;
    }
    .log-entry {
      padding: 4px 0;
      border-bottom: 1px solid #1a1a2e;
      line-height: 1.4;
    }
    .log-time { color: #888; }
    .log-cat { color: #64b5f6; font-weight: bold; margin: 0 5px; }
    .log-data { color: #aaa; margin-left: 10px; display: block; }
    .log-RECORD .log-cat { color: #e94560; }
    .log-AUDIO .log-cat { color: #4ade80; }
    .log-API .log-cat { color: #fbbf24; }
    .log-ERROR .log-cat { color: #ff0000; }
    .log-KEY .log-cat { color: #ff6b6b; }
  `;
  document.head.appendChild(style);
}

let logPanelExpanded = false;
function toggleLogPanel() {
  const panel = document.getElementById('logPanel');
  const toggle = document.getElementById('logToggle');
  logPanelExpanded = !logPanelExpanded;

  if (logPanelExpanded) {
    panel.classList.remove('collapsed');
    toggle.classList.add('expanded');
    toggle.innerHTML = '&#9660; Logs';
  } else {
    panel.classList.add('collapsed');
    toggle.classList.remove('expanded');
    toggle.innerHTML = '&#9650; Logs';
  }
}

function setupEventListeners() {
  log('INIT', 'Setting up event listeners');

  // Spacebar push-to-talk
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !e.repeat && !isRecording) {
      e.preventDefault();
      log('KEY', 'Spacebar pressed - starting recording');
      startRecording();
    }
    // Backtick toggles log panel
    if (e.code === 'Backquote') {
      e.preventDefault();
      toggleLogPanel();
    }
  });

  document.addEventListener('keyup', (e) => {
    if (e.code === 'Space' && isRecording) {
      e.preventDefault();
      const duration = recordingStartTime ? ((Date.now() - recordingStartTime) / 1000).toFixed(2) : 'unknown';
      log('KEY', `Spacebar released - stopping recording`, { durationSec: duration });
      stopRecording();
    }
  });

  // Mouse/touch on PTT button
  pttButton.addEventListener('mousedown', () => {
    if (!isRecording) {
      log('MOUSE', 'PTT button pressed');
      startRecording();
    }
  });
  pttButton.addEventListener('mouseup', () => {
    if (isRecording) {
      log('MOUSE', 'PTT button released');
      stopRecording();
    }
  });
  pttButton.addEventListener('mouseleave', () => {
    if (isRecording) {
      log('MOUSE', 'PTT button mouse left');
      stopRecording();
    }
  });

  // Touch support
  pttButton.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (!isRecording) {
      log('TOUCH', 'PTT touch start');
      startRecording();
    }
  });
  pttButton.addEventListener('touchend', (e) => {
    e.preventDefault();
    if (isRecording) {
      log('TOUCH', 'PTT touch end');
      stopRecording();
    }
  });

  // Clear canvas
  clearCanvasBtn.addEventListener('click', clearCanvas);

  log('INIT', 'Event listeners ready');
}

// Play greeting on startup
async function playGreeting() {
  log('GREET', 'Playing startup greeting');
  setStatus('thinking', 'Connecting...');

  try {
    const response = await fetch(`${API_BASE}/speak`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'text=' + encodeURIComponent("Hello Doug. Gerty here, ready to assist you.")
    });

    if (response.ok) {
      log('GREET', 'Greeting audio received');
      const blob = await response.blob();
      await playAudioBlob(blob);
      setStatus('ready', 'Ready');
      log('GREET', 'Greeting complete');
    } else {
      log('ERROR', 'Greeting API failed', { status: response.status });
      setStatus('ready', 'Ready');
      showStatusMessage('Backend not connected. Start with: myclaw web', true);
    }
  } catch (e) {
    log('ERROR', 'Greeting error', { error: e.message });
    setStatus('ready', 'Offline');
    showStatusMessage('Backend not running', true);
  }
}

// Recording functions
async function startRecording() {
  log('RECORD', '=== STARTING RECORDING ===');
  recordingStartTime = Date.now();

  try {
    log('RECORD', 'Requesting microphone access');
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true  // Simple config - let browser decide best settings
    });
    log('RECORD', 'Microphone access granted');

    // Log audio tracks info
    const audioTrack = stream.getAudioTracks()[0];
    const settings = audioTrack.getSettings();
    log('AUDIO', 'Audio track settings', {
      deviceId: settings.deviceId?.substring(0, 20),
      sampleRate: settings.sampleRate,
      channelCount: settings.channelCount,
      echoCancellation: settings.echoCancellation,
      autoGainControl: settings.autoGainControl
    });

    // Set up audio context for visualization
    audioContext = new AudioContext();
    log('AUDIO', 'AudioContext created', { sampleRate: audioContext.sampleRate, state: audioContext.state });

    analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    analyser.fftSize = 256;

    // Try different codecs - prefer MP4/AAC on macOS for better compatibility
    let mimeType = 'audio/webm';
    const codecs = [
      'audio/mp4',
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus'
    ];
    for (const codec of codecs) {
      if (MediaRecorder.isTypeSupported(codec)) {
        mimeType = codec;
        break;
      }
    }
    log('RECORD', 'MediaRecorder setup', { mimeType, supported: MediaRecorder.isTypeSupported(mimeType) });

    mediaRecorder = new MediaRecorder(stream, {
      mimeType,
      audioBitsPerSecond: 128000  // 128 kbps for good quality
    });
    audioChunks = [];

    mediaRecorder.ondataavailable = (e) => {
      log('AUDIO', 'Chunk received', { size: e.data.size, totalChunks: audioChunks.length + 1 });
      if (e.data.size > 0) {
        audioChunks.push(e.data);
      }
    };

    mediaRecorder.onerror = (e) => {
      log('ERROR', 'MediaRecorder error', { error: e.error });
    };

    mediaRecorder.onstart = () => {
      log('RECORD', 'MediaRecorder onstart fired', { state: mediaRecorder.state });
    };

    // Request data every 500ms
    mediaRecorder.start(500);
    isRecording = true;
    log('RECORD', 'MediaRecorder started', { state: mediaRecorder.state });

    // Update UI
    pttButton.classList.add('active');
    adaImage.classList.add('listening');
    waveformContainer.classList.add('visible');
    recordingIndicator.classList.add('visible');
    setStatus('recording', 'Listening...');

    // Start waveform visualization
    drawWaveform();

  } catch (e) {
    log('ERROR', 'Recording start failed', { error: e.message });
    showStatusMessage(`Microphone error: ${e.message}`, true);
  }
}

async function stopRecording() {
  if (!mediaRecorder || !isRecording) {
    log('RECORD', 'Stop called but not recording');
    return;
  }

  const recordingDuration = ((Date.now() - recordingStartTime) / 1000).toFixed(2);
  log('RECORD', `=== STOPPING RECORDING === Duration: ${recordingDuration}s`);
  isRecording = false;

  // Update UI immediately
  pttButton.classList.remove('active');
  adaImage.classList.remove('listening');
  waveformContainer.classList.remove('visible');
  recordingIndicator.classList.remove('visible');

  // Stop visualization
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  return new Promise((resolve) => {
    mediaRecorder.onstop = async () => {
      log('RECORD', 'MediaRecorder stopped event fired');
      log('AUDIO', 'Chunks collected', { count: audioChunks.length });

      // Stop all tracks
      mediaRecorder.stream.getTracks().forEach(track => {
        track.stop();
        log('AUDIO', 'Track stopped', { kind: track.kind, label: track.label });
      });

      // Close audio context
      if (audioContext) {
        audioContext.close();
        audioContext = null;
        log('AUDIO', 'AudioContext closed');
      }

      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      log('AUDIO', 'Audio blob created', {
        size: audioBlob.size,
        type: audioBlob.type,
        chunks: audioChunks.length,
        durationSec: recordingDuration
      });

      // Need at least 2KB of audio to be useful (about 0.5 seconds)
      if (audioBlob.size > 2000) {
        log('API', 'Sending audio to backend');
        await processVoiceInput(audioBlob);
      } else {
        log('RECORD', 'Recording too short, ignoring', { size: audioBlob.size, minRequired: 2000 });
        setStatus('ready', 'Ready');
        showStatusMessage('Recording too short - hold spacebar longer', false);
      }

      resolve();
    };

    log('RECORD', 'Calling mediaRecorder.stop()');
    mediaRecorder.stop();
  });
}

// Waveform visualization
function drawWaveform() {
  if (!analyser || !isRecording) return;

  const canvas = waveformCanvas;
  const ctx = canvas.getContext('2d');
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  analyser.getByteFrequencyData(dataArray);

  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const barWidth = (canvas.width / bufferLength) * 2.5;
  let x = 0;

  for (let i = 0; i < bufferLength; i++) {
    const barHeight = (dataArray[i] / 255) * canvas.height;

    ctx.fillStyle = `rgb(233, 69, ${96 + barHeight})`;
    ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

    x += barWidth + 1;
  }

  animationFrameId = requestAnimationFrame(drawWaveform);
}

// Audio queue for streaming playback
const audioQueue = [];
let isPlayingAudio = false;

async function playNextInQueue() {
  if (isPlayingAudio || audioQueue.length === 0) return;

  isPlayingAudio = true;
  const base64Audio = audioQueue.shift();

  try {
    await playBase64Audio(base64Audio);
  } catch (e) {
    log('ERROR', 'Queue audio playback failed', { error: e.message });
  }

  isPlayingAudio = false;

  // Play next if available
  if (audioQueue.length > 0) {
    playNextInQueue();
  } else {
    // All audio done
    adaImage.classList.remove('speaking');
    setStatus('ready', 'Ready');
    log('AUDIO', 'All streaming audio complete');
  }
}

function queueAudio(base64Audio) {
  audioQueue.push(base64Audio);
  log('AUDIO', 'Audio queued', { queueLength: audioQueue.length });

  if (!isPlayingAudio) {
    setStatus('speaking', 'Speaking...');
    adaImage.classList.add('speaking');
    playNextInQueue();
  }
}

// Process voice input with streaming
async function processVoiceInput(audioBlob) {
  log('API', 'Processing voice input (streaming)', { blobSize: audioBlob.size });
  setStatus('thinking', 'Processing...');

  // Clear audio queue
  audioQueue.length = 0;
  isPlayingAudio = false;

  try {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');

    log('API', 'Sending POST to /voice/stream');
    const startTime = Date.now();

    const response = await fetch(`${API_BASE}/voice/stream`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    log('API', 'Stream connected', { status: response.status });

    // Read the SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullResponse = '';
    let firstTextReceived = false;

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        log('API', 'Stream ended');
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE messages
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            const elapsed = Date.now() - startTime;

            switch (data.type) {
              case 'transcript':
                log('API', 'Transcript received', { text: data.text, elapsedMs: elapsed });
                transcriptArea.classList.add('visible');
                transcriptText.textContent = data.text;
                setStatus('thinking', 'Processing...');
                break;

              case 'acknowledgment':
                log('API', 'Acknowledgment received', { text: data.text, elapsedMs: elapsed });
                setStatus('speaking', 'Gerty is responding...');
                adaImage.classList.add('speaking');
                // Play acknowledgment immediately (not queued)
                await playBase64Audio(data.audio);
                adaImage.classList.remove('speaking');
                setStatus('thinking', 'Researching...');
                break;

              case 'text':
                // Legacy: streaming text chunks (no longer used but kept for compatibility)
                fullResponse += data.chunk;
                break;

              case 'display':
                // New: full display text arrives after audio is queued
                log('API', 'Display text received', { elapsedMs: elapsed, length: data.text?.length });
                welcomeMessage.style.display = 'none';
                canvasFrame.classList.add('hidden');
                canvasContent.style.display = 'block';
                canvasTitle.textContent = 'Gerty';
                canvasContent.innerHTML = `<div class="ada-content"><div class="ada-text">${parseMarkdown(data.text)}</div></div>`;
                break;

              case 'audio':
                log('AUDIO', 'Audio chunk received', { elapsedMs: elapsed, base64Length: data.data.length });
                queueAudio(data.data);
                break;

              case 'done':
                log('API', 'Stream complete', { elapsedMs: elapsed });
                break;

              case 'error':
                log('ERROR', 'Stream error', { message: data.message });
                showStatusMessage(data.message, true);
                setStatus('ready', 'Ready');
                break;
            }
          } catch (e) {
            log('ERROR', 'Failed to parse SSE data', { line, error: e.message });
          }
        }
      }
    }

    // If no audio was queued, set ready status
    if (audioQueue.length === 0 && !isPlayingAudio) {
      setStatus('ready', 'Ready');
    }

    log('API', 'Voice processing complete', { totalElapsedMs: Date.now() - startTime });

  } catch (e) {
    log('ERROR', 'Voice processing failed', { error: e.message });
    showStatusMessage(`Error: ${e.message}`, true);
    setStatus('ready', 'Ready');
  }
}

// Audio playback
async function playBase64Audio(base64Audio) {
  return new Promise((resolve) => {
    const audio = new Audio(`data:audio/mpeg;base64,${base64Audio}`);
    audio.onended = () => {
      log('AUDIO', 'Playback ended');
      resolve();
    };
    audio.onerror = (e) => {
      log('ERROR', 'Audio playback error', { error: e.message });
      resolve();
    };
    audio.play().catch(e => {
      log('ERROR', 'Audio play() failed', { error: e.message });
      resolve();
    });
  });
}

async function playAudioBlob(blob) {
  return new Promise((resolve) => {
    const audio = new Audio(URL.createObjectURL(blob));
    audio.onended = () => {
      URL.revokeObjectURL(audio.src);
      resolve();
    };
    audio.onerror = (e) => {
      log('ERROR', 'Blob audio error', { error: e.message });
      resolve();
    };
    audio.play().catch(e => {
      log('ERROR', 'Blob play() failed', { error: e.message });
      resolve();
    });
  });
}

// Canvas / Presentation functions
function showAdaResponse(text) {
  welcomeMessage.style.display = 'none';
  canvasFrame.classList.add('hidden');
  canvasContent.style.display = 'block';

  canvasTitle.textContent = 'Gerty';

  // Parse and render the response
  const html = parseMarkdown(text);

  canvasContent.innerHTML = `
    <div class="ada-content">
      <div class="ada-text">${html}</div>
    </div>
  `;
}

function showWebPage(url, title = 'Web Content') {
  welcomeMessage.style.display = 'none';
  canvasContent.style.display = 'none';
  canvasFrame.classList.remove('hidden');

  canvasTitle.textContent = title;
  canvasFrame.src = url;
}

function showHtmlContent(html, title = 'Content') {
  welcomeMessage.style.display = 'none';
  canvasFrame.classList.add('hidden');
  canvasContent.style.display = 'block';

  canvasTitle.textContent = title;
  canvasContent.innerHTML = `<div class="ada-content">${html}</div>`;
}

function clearCanvas() {
  canvasContent.innerHTML = '';
  canvasFrame.src = '';
  canvasFrame.classList.add('hidden');
  canvasContent.style.display = 'block';
  welcomeMessage.style.display = 'block';
  canvasContent.appendChild(welcomeMessage);
  canvasTitle.textContent = 'Welcome';

  transcriptArea.classList.remove('visible');
  transcriptText.textContent = '';
  log('UI', 'Canvas cleared');
}

// Simple markdown parser
function parseMarkdown(text) {
  return text
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Headers
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    // Bold
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
    // Lists
    .replace(/^\* (.*$)/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    // Numbered lists
    .replace(/^\d+\. (.*$)/gm, '<li>$1</li>')
    // Line breaks to paragraphs
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(.+)$/gm, (match) => {
      if (match.startsWith('<')) return match;
      return match;
    });
}

// UI helpers
function setStatus(type, text) {
  const statusDot = adaStatus.querySelector('.status-dot');
  const statusText = adaStatus.querySelector('.status-text');

  statusDot.className = 'status-dot';
  if (type === 'recording') statusDot.classList.add('recording');
  if (type === 'thinking') statusDot.classList.add('thinking');
  if (type === 'speaking') statusDot.classList.add('speaking');

  statusText.textContent = text;
}

function showStatusMessage(message, isError = false) {
  log(isError ? 'ERROR' : 'INFO', `Status message: ${message}`);

  // Remove existing message
  const existing = document.querySelector('.status-message');
  if (existing) existing.remove();

  const msg = document.createElement('div');
  msg.className = `status-message ${isError ? 'error' : ''}`;
  msg.textContent = message;
  document.body.appendChild(msg);

  setTimeout(() => msg.remove(), 5000);
}

// Expose functions for Ada to call (via backend instructions)
window.ada = {
  showWebPage,
  showHtmlContent,
  showAdaResponse,
  clearCanvas,
  log
};

// ============================================
// Dashboard Module
// ============================================

class DashboardView {
  constructor() {
    this.refreshInterval = 60000; // 60 seconds
    this.refreshTimer = null;
    this.isLoading = false;
    this.lastUpdate = null;

    // DOM elements
    this.overallStatus = document.getElementById('overallStatus');
    this.overallStatusLabel = document.getElementById('overallStatusLabel');
    this.dashboardUptime = document.getElementById('dashboardUptime');
    this.dashboardUpdated = document.getElementById('dashboardUpdated');
    this.refreshBtn = document.getElementById('refreshDashboard');
    this.activityFilter = document.getElementById('activityFilter');
    this.dismissErrorsBtn = document.getElementById('dismissErrorsBtn');

    // Track dismissed errors timestamp
    this.dismissedErrorsUntil = localStorage.getItem('dismissedErrorsUntil') || null;

    this.setupEventListeners();
  }

  setupEventListeners() {
    // Refresh button
    this.refreshBtn?.addEventListener('click', () => this.refresh());

    // Activity filter
    this.activityFilter?.addEventListener('change', () => this.loadActivity());

    // Dismiss errors button
    this.dismissErrorsBtn?.addEventListener('click', () => this.dismissErrors());
  }

  dismissErrors() {
    // Store current time - any errors before this will be hidden
    const now = new Date().toISOString();
    this.dismissedErrorsUntil = now;
    localStorage.setItem('dismissedErrorsUntil', now);
    log('DASH', 'Errors dismissed until', { until: now });

    // Hide the panel immediately
    const panel = document.getElementById('errorsPanel');
    if (panel) panel.classList.add('hidden');
  }

  async start() {
    log('DASH', 'Starting dashboard');
    await this.refresh();
    this.startAutoRefresh();
  }

  stop() {
    log('DASH', 'Stopping dashboard');
    this.stopAutoRefresh();
  }

  startAutoRefresh() {
    if (this.refreshTimer) return;
    this.refreshTimer = setInterval(() => this.refresh(), this.refreshInterval);
    log('DASH', 'Auto-refresh started', { intervalMs: this.refreshInterval });
  }

  stopAutoRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
      log('DASH', 'Auto-refresh stopped');
    }
  }

  async refresh() {
    if (this.isLoading) return;

    this.isLoading = true;
    this.refreshBtn?.classList.add('refreshing');
    log('DASH', 'Refreshing dashboard');

    try {
      await Promise.all([
        this.loadSummary(),
        this.loadServices(),
        this.loadScheduler(),
        this.loadHeartbeat(),
        this.loadActivity(),
        this.loadErrors()
      ]);

      this.lastUpdate = new Date();
      this.updateTimestamp();
      log('DASH', 'Dashboard refresh complete');
    } catch (e) {
      log('ERROR', 'Dashboard refresh failed', { error: e.message });
    } finally {
      this.isLoading = false;
      this.refreshBtn?.classList.remove('refreshing');
    }
  }

  updateTimestamp() {
    if (this.dashboardUpdated && this.lastUpdate) {
      this.dashboardUpdated.textContent = `Updated ${this.formatTime(this.lastUpdate)}`;
    }
  }

  async loadSummary() {
    try {
      const response = await fetch(`${API_BASE}/api/dashboard/summary`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();

      // Update overall status
      this.overallStatus.className = `status-indicator ${data.status}`;
      this.overallStatusLabel.textContent = this.capitalizeFirst(data.status);

      // Update uptime
      if (data.uptime_seconds && this.dashboardUptime) {
        this.dashboardUptime.textContent = `Uptime: ${this.formatDuration(data.uptime_seconds)}`;
      }

    } catch (e) {
      log('ERROR', 'Failed to load summary', { error: e.message });
      this.overallStatus.className = 'status-indicator';
      this.overallStatusLabel.textContent = 'Offline';
    }
  }

  async loadServices() {
    const content = document.getElementById('servicesContent');
    if (!content) return;

    try {
      const response = await fetch(`${API_BASE}/api/dashboard/services`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();

      content.innerHTML = `
        <table class="services-table">
          <thead>
            <tr>
              <th>Service</th>
              <th>Status</th>
              <th>Last Active</th>
              <th>Errors (24h)</th>
            </tr>
          </thead>
          <tbody>
            ${data.services.map(s => `
              <tr>
                <td>${this.capitalizeFirst(s.name)}</td>
                <td>
                  <span class="service-status">
                    <span class="service-dot ${s.state}"></span>
                    ${this.capitalizeFirst(s.state)}
                  </span>
                </td>
                <td>${s.last_active ? this.formatRelativeTime(s.last_active) : '-'}</td>
                <td>${s.error_count_24h || 0}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } catch (e) {
      log('ERROR', 'Failed to load services', { error: e.message });
      content.innerHTML = '<div class="empty-state">Failed to load services</div>';
    }
  }

  async loadScheduler() {
    const content = document.getElementById('schedulerContent');
    const badge = document.getElementById('schedulerBadge');
    if (!content) return;

    try {
      const response = await fetch(`${API_BASE}/api/dashboard/scheduler`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();

      // Update badge
      if (badge) {
        badge.textContent = data.running ? 'Running' : 'Stopped';
        badge.className = `panel-badge ${data.running ? 'running' : 'stopped'}`;
      }

      content.innerHTML = `
        <div class="detail-row">
          <span class="detail-label">Jobs</span>
          <span class="detail-value">${data.enabled_job_count} enabled / ${data.job_count} total</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Next Run</span>
          <span class="detail-value">${data.next_job ? `${data.next_job} at ${this.formatTime(data.next_run)}` : 'None scheduled'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Recent Failures</span>
          <span class="detail-value">${data.recent_failures || 0}</span>
        </div>
        ${data.jobs.length > 0 ? `
          <div class="job-list">
            ${data.jobs.slice(0, 5).map(job => `
              <div class="job-item">
                <div>
                  <span class="job-name">${job.name}</span>
                  <span class="job-schedule">${job.schedule}</span>
                </div>
                <span class="job-status">
                  <span class="service-dot ${job.last_status === 'success' ? 'online' : job.last_status === 'failed' ? 'error' : 'idle'}"></span>
                </span>
              </div>
            `).join('')}
          </div>
        ` : ''}
      `;
    } catch (e) {
      log('ERROR', 'Failed to load scheduler', { error: e.message });
      content.innerHTML = '<div class="empty-state">Failed to load scheduler</div>';
    }
  }

  async loadHeartbeat() {
    const content = document.getElementById('heartbeatContent');
    const badge = document.getElementById('heartbeatBadge');
    if (!content) return;

    try {
      const response = await fetch(`${API_BASE}/api/dashboard/heartbeat`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();

      // Update badge
      if (badge) {
        const status = data.enabled ? (data.is_active_hours ? 'Active' : 'Idle') : 'Disabled';
        badge.textContent = status;
        badge.className = `panel-badge ${data.enabled && data.is_active_hours ? 'running' : ''}`;
      }

      content.innerHTML = `
        <div class="detail-row">
          <span class="detail-label">Status</span>
          <span class="detail-value">${data.enabled ? (data.is_active_hours ? 'Active' : 'Outside active hours') : 'Disabled'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Frequency</span>
          <span class="detail-value">Every ${data.frequency_minutes} minutes</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Active Hours</span>
          <span class="detail-value">${data.active_hours_start} - ${data.active_hours_end}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Timezone</span>
          <span class="detail-value">${data.timezone}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Last Run</span>
          <span class="detail-value">${data.last_run ? this.formatRelativeTime(data.last_run) : 'Never'}</span>
        </div>
        ${data.tasks.length > 0 ? `
          <div class="job-list">
            ${data.tasks.map(task => `
              <div class="job-item">
                <div>
                  <span class="job-name">${task.name}</span>
                </div>
                <span class="job-status">
                  <span class="service-dot ${task.enabled ? 'online' : 'offline'}"></span>
                </span>
              </div>
            `).join('')}
          </div>
        ` : ''}
      `;
    } catch (e) {
      log('ERROR', 'Failed to load heartbeat', { error: e.message });
      content.innerHTML = '<div class="empty-state">Failed to load heartbeat</div>';
    }
  }

  async loadActivity() {
    const content = document.getElementById('activityContent');
    if (!content) return;

    const filterValue = this.activityFilter?.value || '';
    const typesParam = filterValue ? `&types=${filterValue}` : '';

    try {
      const response = await fetch(`${API_BASE}/api/dashboard/activity?limit=30${typesParam}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();

      if (data.items.length === 0) {
        content.innerHTML = '<div class="empty-state">No recent activity</div>';
        return;
      }

      content.innerHTML = data.items.map(item => `
        <div class="activity-item">
          <span class="activity-time">${this.formatTime(item.timestamp)}</span>
          <span class="activity-icon ${item.type}">${this.getActivityIcon(item.type)}</span>
          <div class="activity-details">
            <span class="activity-action">${item.action}</span>
            <span class="activity-source">[${item.source}]</span>
            ${item.preview ? `<div class="activity-preview">${this.escapeHtml(item.preview)}</div>` : ''}
          </div>
        </div>
      `).join('');
    } catch (e) {
      log('ERROR', 'Failed to load activity', { error: e.message });
      content.innerHTML = '<div class="empty-state">Failed to load activity</div>';
    }
  }

  async loadErrors() {
    const panel = document.getElementById('errorsPanel');
    const content = document.getElementById('errorsContent');
    const badge = document.getElementById('errorsBadge');
    if (!content || !panel) return;

    try {
      const response = await fetch(`${API_BASE}/api/dashboard/errors?hours=24`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();

      // Filter out errors that were dismissed
      const dismissedUntil = this.dismissedErrorsUntil ? new Date(this.dismissedErrorsUntil) : null;

      const filteredErrors = dismissedUntil
        ? data.errors.filter(e => new Date(e.timestamp) > dismissedUntil)
        : data.errors;
      const filteredWarnings = dismissedUntil
        ? data.warnings.filter(w => new Date(w.timestamp) > dismissedUntil)
        : data.warnings;

      const totalErrors = filteredErrors.length + filteredWarnings.length;

      if (totalErrors === 0) {
        panel.classList.add('hidden');
        return;
      }

      panel.classList.remove('hidden');

      if (badge) {
        badge.textContent = `${filteredErrors.length} errors, ${filteredWarnings.length} warnings`;
      }

      const allItems = [
        ...filteredErrors.map(e => ({ ...e, level: 'error' })),
        ...filteredWarnings.map(w => ({ ...w, level: 'warning' }))
      ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 10);

      content.innerHTML = allItems.map(item => `
        <div class="error-item">
          <div class="error-header">
            <span class="error-level ${item.level}">${item.level.toUpperCase()}</span>
            <span class="error-meta">${this.formatRelativeTime(item.timestamp)}</span>
          </div>
          <div class="error-message">${this.escapeHtml(item.message)}</div>
          <div class="error-meta">Source: ${item.source}</div>
        </div>
      `).join('');
    } catch (e) {
      log('ERROR', 'Failed to load errors', { error: e.message });
      panel.classList.add('hidden');
    }
  }

  // Utility functions
  getActivityIcon(type) {
    const icons = {
      inbound: '&#8592;',   // ←
      outbound: '&#8594;',  // →
      action: '&#9881;',    // ⚙
      error: '&#9888;',     // ⚠
      system: '&#9670;'     // ◆
    };
    return icons[type] || '&#8226;';
  }

  formatTime(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  formatRelativeTime(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString();
  }

  formatDuration(seconds) {
    if (!seconds) return '-';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Tab Management
let dashboardView = null;

function setupTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;

      // Update button states
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Update content visibility
      tabContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === `${tabId}Tab`) {
          content.classList.add('active');
        }
      });

      // Start/stop dashboard refresh
      if (tabId === 'dashboard') {
        if (!dashboardView) {
          dashboardView = new DashboardView();
        }
        dashboardView.start();
      } else if (dashboardView) {
        dashboardView.stop();
      }

      log('UI', `Switched to ${tabId} tab`);
    });
  });
}

// Initialize tabs on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
});
