export function detectPitchMPM(buffer, sampleRate, options = {}) {
  const {
    minFreq = 30,
    maxFreq = 1200,
    rmsThreshold = 0.008,
    clarityThreshold = 0.55,
    peakRatio = 0.88
  } = options;

  const size = buffer.length;
  if (size < 512 || !sampleRate) return null;

  // 去直流偏置并计算 RMS
  let mean = 0;
  for (let i = 0; i < size; i++) mean += buffer[i];
  mean /= size;

  let sumSq = 0;
  const x = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    const v = buffer[i] - mean;
    x[i] = v;
    sumSq += v * v;
  }
  const rms = Math.sqrt(sumSq / size);
  if (rms < rmsThreshold) return null;

  const minLag = Math.max(2, Math.floor(sampleRate / maxFreq));
  const maxLag = Math.min(Math.floor(size / 2), Math.ceil(sampleRate / minFreq));
  if (maxLag <= minLag) return null;

  // 前缀平方和加速 NSDF 分母计算
  const prefixSq = new Float64Array(size + 1);
  for (let i = 0; i < size; i++) {
    prefixSq[i + 1] = prefixSq[i] + x[i] * x[i];
  }

  const nsdf = new Float32Array(maxLag + 1);
  for (let tau = minLag; tau <= maxLag; tau++) {
    const limit = size - tau;
    let acf = 0;
    for (let j = 0; j < limit; j++) {
      acf += x[j] * x[j + tau];
    }
    const m = prefixSq[limit] + (prefixSq[size] - prefixSq[tau]);
    nsdf[tau] = m > 1e-12 ? (2 * acf) / m : 0;
  }

  // 跳过 tau=0 初始主瓣：必须先等到 NSDF 首次向下过零后再收集周期极大值
  let startTau = minLag;
  while (startTau <= maxLag && nsdf[startTau] > 0) {
    startTau++;
  }

  // 收集正值区间内的局部极大值（MPM key maxima）
  const peaks = [];
  let inPositive = false;
  let peakIdx = -1;
  let peakVal = -Infinity;

  for (let tau = startTau; tau <= maxLag; tau++) {
    const v = nsdf[tau];
    if (v > 0) {
      if (!inPositive) {
        inPositive = true;
        peakIdx = tau;
        peakVal = v;
      } else if (v > peakVal) {
        peakIdx = tau;
        peakVal = v;
      }
    } else if (inPositive) {
      peaks.push({ lag: peakIdx, val: peakVal });
      inPositive = false;
      peakIdx = -1;
      peakVal = -Infinity;
    }
  }
  if (inPositive && peakIdx !== -1) {
    peaks.push({ lag: peakIdx, val: peakVal });
  }

  if (peaks.length === 0) return null;

  let maxPeak = 0;
  for (const p of peaks) {
    if (p.val > maxPeak) maxPeak = p.val;
  }
  if (maxPeak < clarityThreshold) return null;

  // 选取第一个超过动态阈值的显著峰，避免倍周期/高八度误判
  const threshold = maxPeak * peakRatio;
  let chosen = peaks[0];
  for (const p of peaks) {
    if (p.val >= threshold) {
      chosen = p;
      break;
    }
  }

  // 若存在接近 2 倍周期的更强基频峰（手机麦弱基频场景保护），优先取基频
  const doubleLagTarget = chosen.lag * 2;
  if (doubleLagTarget <= maxLag) {
    const subHarmonic = peaks.find(
      (p) =>
        Math.abs(p.lag - doubleLagTarget) <= Math.max(3, chosen.lag * 0.04) &&
        p.val >= chosen.val * 0.96 &&
        p.val >= 0.85
    );
    if (subHarmonic && subHarmonic.val > chosen.val + 0.02) {
      chosen = subHarmonic;
    }
  }

  // 抛物线插值精细化周期估计
  let refinedLag = chosen.lag;
  if (chosen.lag > minLag && chosen.lag < maxLag) {
    const y0 = nsdf[chosen.lag - 1];
    const y1 = nsdf[chosen.lag];
    const y2 = nsdf[chosen.lag + 1];
    const denom = 2 * (2 * y1 - y2 - y0);
    if (Math.abs(denom) > 1e-12) {
      const delta = (y2 - y0) / denom;
      if (Math.abs(delta) < 1) {
        refinedLag = chosen.lag + delta;
      }
    }
  }

  const freq = sampleRate / refinedLag;
  if (freq < minFreq || freq > maxFreq) return null;

  return {
    freq,
    clarity: chosen.val,
    rms
  };
}

export class PitchSmoother {
  constructor({ windowSize = 5, jumpCents = 80, holdMs = 1500 } = {}) {
    this.windowSize = windowSize;
    this.jumpCents = jumpCents;
    this.holdMs = holdMs;
    this.history = [];
    this.lastFreq = null;
    this.lastValidMs = 0;
  }

  reset() {
    this.history = [];
    this.lastFreq = null;
    this.lastValidMs = 0;
  }

  push(freq, nowMs) {
    if (!Number.isFinite(freq) || freq <= 0) {
      if (this.lastFreq !== null && nowMs - this.lastValidMs <= this.holdMs) {
        return { freq: this.lastFreq, isHeld: true };
      }
      this.reset();
      return null;
    }

    if (this.lastFreq !== null) {
      const cents = Math.abs(1200 * Math.log2(freq / this.lastFreq));
      if (cents > this.jumpCents) {
        this.history = [];
      }
    }

    this.history.push(freq);
    if (this.history.length > this.windowSize) {
      this.history.shift();
    }

    const sorted = [...this.history].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median =
      sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

    this.lastFreq = median;
    this.lastValidMs = nowMs;
    return { freq: median, isHeld: false };
  }
}
