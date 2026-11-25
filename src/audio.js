export class AudioTunerSession {
  constructor({ fftSize = 4096, lowpassHz = 1000 } = {}) {
    this.fftSize = fftSize;
    this.lowpassHz = lowpassHz;
    this.audioCtx = null;
    this.stream = null;
    this.source = null;
    this.filter = null;
    this.analyser = null;
    this.wakeLock = null;
    this.isRunning = false;
  }

  async start() {
    if (this.isRunning) {
      return { sampleRate: this.audioCtx.sampleRate };
    }
    if (!window.isSecureContext) {
      const err = new Error("INSECURE_CONTEXT");
      err.code = "INSECURE_CONTEXT";
      throw err;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const err = new Error("UNSUPPORTED");
      err.code = "UNSUPPORTED";
      throw err;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    });

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    const source = ctx.createMediaStreamSource(stream);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = this.lowpassHz;
    filter.Q.value = 0.707;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = this.fftSize;
    analyser.smoothingTimeConstant = 0;

    source.connect(filter);
    filter.connect(analyser);

    this.stream = stream;
    this.audioCtx = ctx;
    this.source = source;
    this.filter = filter;
    this.analyser = analyser;
    this.isRunning = true;

    await this.requestWakeLock();
    return { sampleRate: ctx.sampleRate };
  }

  readTimeDomain(buffer) {
    if (!this.isRunning || !this.analyser) return null;
    this.analyser.getFloatTimeDomainData(buffer);
    return buffer;
  }

  async requestWakeLock() {
    if (!("wakeLock" in navigator)) return;
    try {
      this.wakeLock = await navigator.wakeLock.request("screen");
    } catch {
      this.wakeLock = null;
    }
  }

  async releaseWakeLock() {
    if (!this.wakeLock) return;
    try {
      await this.wakeLock.release();
    } catch {
      // 忽略释放异常
    }
    this.wakeLock = null;
  }

  async stop() {
    this.isRunning = false;
    await this.releaseWakeLock();
    if (this.source) {
      try { this.source.disconnect(); } catch {}
    }
    if (this.filter) {
      try { this.filter.disconnect(); } catch {}
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
    }
    if (this.audioCtx) {
      try { await this.audioCtx.close(); } catch {}
    }
    this.source = null;
    this.filter = null;
    this.analyser = null;
    this.stream = null;
    this.audioCtx = null;
  }
}
