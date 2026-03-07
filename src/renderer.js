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
  log('INIT', 'Ada app initializing');
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
      body: 'text=' + encodeURIComponent("Hello Doug. Ada here, ready to assist you.")
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

// Process voice input
async function processVoiceInput(audioBlob) {
  log('API', 'Processing voice input', { blobSize: audioBlob.size });
  setStatus('thinking', 'Processing...');

  try {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');

    log('API', 'Sending POST to /voice');
    const startTime = Date.now();

    const response = await fetch(`${API_BASE}/voice`, {
      method: 'POST',
      body: formData
    });

    const elapsed = Date.now() - startTime;
    log('API', 'Response received', { status: response.status, elapsedMs: elapsed });

    const data = await response.json();
    log('API', 'Response data', {
      hasTranscript: !!data.transcript,
      transcriptLength: data.transcript?.length,
      transcript: data.transcript,
      hasResponse: !!data.response,
      responseLength: data.response?.length,
      hasAudio: !!data.audio,
      error: data.error
    });

    if (data.error) {
      log('ERROR', 'API returned error', { error: data.error });
      showStatusMessage(data.error, true);
      setStatus('ready', 'Ready');
      return;
    }

    // Show transcript
    if (data.transcript) {
      log('UI', 'Showing transcript', { text: data.transcript });
      transcriptArea.classList.add('visible');
      transcriptText.textContent = data.transcript;
    }

    // Show response in canvas
    if (data.response) {
      log('UI', 'Showing response in canvas');
      showAdaResponse(data.response);
    }

    // Play audio response
    if (data.audio) {
      log('AUDIO', 'Playing response audio', { base64Length: data.audio.length });
      setStatus('speaking', 'Speaking...');
      adaImage.classList.add('speaking');

      await playBase64Audio(data.audio);

      adaImage.classList.remove('speaking');
      log('AUDIO', 'Response audio complete');
    }

    setStatus('ready', 'Ready');
    log('API', 'Voice processing complete');

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

  canvasTitle.textContent = 'Ada';

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
