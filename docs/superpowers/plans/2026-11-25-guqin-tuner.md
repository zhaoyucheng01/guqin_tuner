# 古琴调音器（Guqin Tuner）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一款面向手机浏览器及 PWA 的纯前端古琴实时麦克风调音器，具备古琴低频防八度 MPM 算法、6 种传统古琴调式预设、纯自动识弦联动、整体升降半音、A4 基准调节、简繁中文切换及宣纸墨绿一屏紧凑界面。

**Architecture:** 采用零外部依赖、零打包构建的原生 ES Modules 架构。核心领域逻辑（`src/tunings.js` 调式与自动识弦、`src/pitch.js` MPM 音高检测与平滑、`src/i18n.js` 简繁词条）完全与 DOM 解耦，可通过 Node.js 原生 `node --test` 验证；浏览器端由 `src/audio.js` 管理麦克风低通滤波采集与 Wake Lock 屏幕常亮，`src/app.js` 驱动 SVG 半圆指针表盘、右侧七弦联动与 `localStorage` 持久化。

**Tech Stack:** HTML5, CSS3, Vanilla JavaScript (ES Modules), Web Audio API, Screen Wake Lock API, PWA (Web App Manifest + Service Worker), Node.js v24 (`node --test`).

## Global Constraints

- 项目标识统一为 `guqin-tuner`（本地存储键名 `guqin-tuner-settings-v1`），不出现 `tiaoyin`。
- 零第三方运行时依赖，零构建打包工具（`package.json` 仅用于声明 `"type": "module"` 与 `"test": "node --test"`）。
- 仅做麦克风实时拾音调音与纯自动识弦，不做点击发声或手动锁弦。
- 支持 6 种古琴调式（正调、蕤宾调、慢角调、清商调、慢商调、无射调），整体移调 `-6..+6` 半音，A4 基准 `430..450 Hz`。
- 准音判定阈值为 `±5 音分`，右侧七弦自动高亮吸附范围为 `±1.5` 半音（`±150 音分`），静音读数保持 `1500 ms`。
- 视觉延续宣纸墨绿国风（`#f4f2ec` / `#fffefa` / `#29483d` / `#a27c3e` / `#2e7d5b`），手机竖屏（360px–430px）一屏紧凑显示，支持简繁中文切换。
- Git 提交遵循中文编号格式 `1、【动词】...；`，不自动 push。

---

## File Map

- `package.json`：声明 ES Modules 类型与 `npm test` 脚本（零依赖）。
- `src/tunings.js`：6 种古琴调式数据、频率与 MIDI 换算、音名格式化、自动识弦匹配（纯函数）。
- `src/pitch.js`：针对古琴低频与弱基频多泛音优化的 MPM 音高检测器与 `PitchSmoother` 平滑器（纯函数）。
- `src/i18n.js`：简体/繁体中文词条定义与查询辅助函数。
- `src/audio.js`：麦克风采集（关闭语音降噪/回声消除/AGC）、1000 Hz 二阶低通滤波、4096 点 AnalyserNode 与 Wake Lock 管理。
- `index.html`：手机竖屏一屏结构、SVG 半圆表盘、淡墨竹叶水印、七弦列与底部调式抽屉。
- `style.css`：宣纸墨绿主题样式、安全区适配与响应式排版。
- `src/app.js`：应用状态、持久化、事件绑定、`requestAnimationFrame` 采集渲染循环与 `visibilitychange` 自动休眠。
- `manifest.webmanifest` / `sw.js` / `icons/icon.svg`：PWA 安装与离线缓存。
- `tests/tunings.test.js` / `tests/pitch.test.js` / `tests/i18n.test.js`：Node.js 原生自动化单元测试。

---

### Task 1: 项目基础配置与古琴调式引擎 (`src/tunings.js`)

**Files:**
- Create: `package.json`
- Create: `src/tunings.js`
- Test: `tests/tunings.test.js`

**Interfaces:**
- Produces from `src/tunings.js`:
  - `TUNINGS`: `Array<{ id, keyLabel, baseMidis, jianpu, semitoneGaps }>`（6 种调式）
  - `DEFAULT_TUNING_ID = "zhengdiao"`
  - `A4_MIN = 430`, `A4_MAX = 450`, `A4_DEFAULT = 440`
  - `TRANSPOSE_MIN = -6`, `TRANSPOSE_MAX = 6`
  - `IN_TUNE_CENTS = 5`, `STRING_MATCH_SEMITONES = 1.5`
  - `getTuningById(id)` → tuning object
  - `midiToFreq(midi, a4 = 440)` → `number`
  - `freqToMidi(freq, a4 = 440)` → `number`
  - `formatMidiNote(midi, preferFlat = true)` → `{ letter, accidental, octave, shortName, fullName }`
  - `getEffectiveStrings(tuningId, transpose = 0, a4 = 440)` → `Array<{ index, stringNumber, midi, freq, note, jianpu }>`
  - `analyzePitch(freq, { tuningId, transpose, a4 })` → `{ freq, midi, nearestMidi, cents, note, inTune, matchedStrings, closestDeltaSemitones }`

- [ ] **Step 1: 创建 `package.json` 声明 ES Modules 与测试命令**

```json
{
  "name": "guqin-tuner",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test"
  }
}
```

- [ ] **Step 2: 编写 `tests/tunings.test.js` 失败测试**

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  TUNINGS,
  midiToFreq,
  freqToMidi,
  formatMidiNote,
  getEffectiveStrings,
  analyzePitch
} from "../src/tunings.js";

test("contains 6 traditional guqin tunings with zhengdiao first", () => {
  assert.equal(TUNINGS.length, 6);
  assert.equal(TUNINGS[0].id, "zhengdiao");
  assert.deepEqual(TUNINGS[0].baseMidis, [36, 38, 41, 43, 45, 48, 50]);
});

test("midiToFreq and freqToMidi round-trip accurately with custom A4", () => {
  assert.ok(Math.abs(midiToFreq(69, 440) - 440) < 1e-6);
  assert.ok(Math.abs(midiToFreq(69, 442) - 442) < 1e-6);
  assert.ok(Math.abs(midiToFreq(36, 440) - 65.406391) < 1e-4);
  assert.ok(Math.abs(freqToMidi(65.406391, 440) - 36) < 1e-4);
});

test("formatMidiNote formats naturals and accidentals cleanly", () => {
  assert.deepEqual(formatMidiNote(36), {
    letter: "C",
    accidental: "",
    octave: 2,
    shortName: "C",
    fullName: "C2"
  });
  assert.deepEqual(formatMidiNote(63, true), {
    letter: "E",
    accidental: "♭",
    octave: 4,
    shortName: "E♭",
    fullName: "E♭4"
  });
  assert.deepEqual(formatMidiNote(37, false), {
    letter: "C",
    accidental: "♯",
    octave: 2,
    shortName: "C♯",
    fullName: "C♯2"
  });
});

test("getEffectiveStrings applies transpose and clamps bounds", () => {
  const lowered = getEffectiveStrings("zhengdiao", -1, 440);
  assert.deepEqual(
    lowered.map((s) => s.midi),
    [35, 37, 40, 42, 44, 47, 49]
  );
  assert.equal(lowered[0].note.fullName, "B1");
});

test("analyzePitch matches single string, unison strings in manshang, and ignores far high overtones", () => {
  const c2 = midiToFreq(36, 440);
  const resZheng = analyzePitch(c2, { tuningId: "zhengdiao", transpose: 0, a4: 440 });
  assert.equal(resZheng.note.fullName, "C2");
  assert.equal(resZheng.inTune, true);
  assert.deepEqual(resZheng.matchedStrings, [0]);

  const resManshang = analyzePitch(c2, { tuningId: "manshang", transpose: 0, a4: 440 });
  assert.deepEqual(resManshang.matchedStrings, [0, 1]);

  const eb4 = midiToFreq(63, 440);
  const resFar = analyzePitch(eb4, { tuningId: "zhengdiao", transpose: -1, a4: 440 });
  assert.equal(resFar.note.fullName, "E♭4");
  assert.deepEqual(resFar.matchedStrings, []);
});
```

- [ ] **Step 3: 运行测试确认失败**

Run: `node --test tests/tunings.test.js`
Expected: FAIL with `Cannot find module '../src/tunings.js'`

- [ ] **Step 4: 实现 `src/tunings.js`**

```js
export const DEFAULT_TUNING_ID = "zhengdiao";
export const A4_MIN = 430;
export const A4_MAX = 450;
export const A4_DEFAULT = 440;
export const TRANSPOSE_MIN = -6;
export const TRANSPOSE_MAX = 6;
export const IN_TUNE_CENTS = 5;
export const STRING_MATCH_SEMITONES = 1.5;

export const TUNINGS = [
  {
    id: "zhengdiao",
    keyLabel: "1=F",
    preferFlat: true,
    baseMidis: [36, 38, 41, 43, 45, 48, 50],
    jianpu: [
      { digit: "5", dots: -2 },
      { digit: "6", dots: -2 },
      { digit: "1", dots: -1 },
      { digit: "2", dots: -1 },
      { digit: "3", dots: -1 },
      { digit: "5", dots: -1 },
      { digit: "6", dots: -1 }
    ]
  },
  {
    id: "ruibin",
    keyLabel: "1=B♭",
    preferFlat: true,
    baseMidis: [36, 38, 41, 43, 46, 48, 50],
    jianpu: [
      { digit: "2", dots: -2 },
      { digit: "3", dots: -2 },
      { digit: "5", dots: -2 },
      { digit: "6", dots: -2 },
      { digit: "1", dots: -1 },
      { digit: "2", dots: -1 },
      { digit: "3", dots: -1 }
    ]
  },
  {
    id: "manjiao",
    keyLabel: "1=C",
    preferFlat: false,
    baseMidis: [36, 38, 40, 43, 45, 48, 50],
    jianpu: [
      { digit: "1", dots: -1 },
      { digit: "2", dots: -1 },
      { digit: "3", dots: -1 },
      { digit: "5", dots: -1 },
      { digit: "6", dots: -1 },
      { digit: "1", dots: 0 },
      { digit: "2", dots: 0 }
    ]
  },
  {
    id: "qingshang",
    keyLabel: "1=E♭",
    preferFlat: true,
    baseMidis: [36, 39, 41, 43, 46, 48, 51],
    jianpu: [
      { digit: "6", dots: -2 },
      { digit: "1", dots: -1 },
      { digit: "2", dots: -1 },
      { digit: "3", dots: -1 },
      { digit: "5", dots: -1 },
      { digit: "6", dots: -1 },
      { digit: "1", dots: 0 }
    ]
  },
  {
    id: "manshang",
    keyLabel: "1=F",
    preferFlat: true,
    baseMidis: [36, 36, 41, 43, 45, 48, 50],
    jianpu: [
      { digit: "5", dots: -2 },
      { digit: "5", dots: -2 },
      { digit: "1", dots: -1 },
      { digit: "2", dots: -1 },
      { digit: "3", dots: -1 },
      { digit: "5", dots: -1 },
      { digit: "6", dots: -1 }
    ]
  },
  {
    id: "wuyi",
    keyLabel: "1=B♭",
    preferFlat: true,
    baseMidis: [34, 38, 41, 43, 46, 48, 50],
    jianpu: [
      { digit: "1", dots: -2 },
      { digit: "3", dots: -2 },
      { digit: "5", dots: -2 },
      { digit: "6", dots: -2 },
      { digit: "1", dots: -1 },
      { digit: "2", dots: -1 },
      { digit: "3", dots: -1 }
    ]
  }
];

const FLAT_NOTES = [
  ["C", ""], ["D", "♭"], ["D", ""], ["E", "♭"], ["E", ""], ["F", ""],
  ["G", "♭"], ["G", ""], ["A", "♭"], ["A", ""], ["B", "♭"], ["B", ""]
];

const SHARP_NOTES = [
  ["C", ""], ["C", "♯"], ["D", ""], ["D", "♯"], ["E", ""], ["F", ""],
  ["F", "♯"], ["G", ""], ["G", "♯"], ["A", ""], ["A", "♯"], ["B", ""]
];

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function getTuningById(id) {
  return TUNINGS.find((t) => t.id === id) || TUNINGS[0];
}

export function midiToFreq(midi, a4 = A4_DEFAULT) {
  return a4 * Math.pow(2, (midi - 69) / 12);
}

export function freqToMidi(freq, a4 = A4_DEFAULT) {
  return 69 + 12 * Math.log2(freq / a4);
}

export function formatMidiNote(midi, preferFlat = true) {
  const rounded = Math.round(midi);
  const pc = ((rounded % 12) + 12) % 12;
  const octave = Math.floor(rounded / 12) - 1;
  const [letter, accidental] = (preferFlat ? FLAT_NOTES : SHARP_NOTES)[pc];
  const shortName = `${letter}${accidental}`;
  return {
    letter,
    accidental,
    octave,
    shortName,
    fullName: `${shortName}${octave}`
  };
}

export function getEffectiveStrings(tuningId, transpose = 0, a4 = A4_DEFAULT) {
  const tuning = getTuningById(tuningId);
  const shift = clamp(Math.round(transpose), TRANSPOSE_MIN, TRANSPOSE_MAX);
  const refA4 = clamp(a4, A4_MIN, A4_MAX);
  return tuning.baseMidis.map((baseMidi, index) => {
    const midi = baseMidi + shift;
    const nextMidi = index < 6 ? tuning.baseMidis[index + 1] + shift : null;
    return {
      index,
      stringNumber: index + 1,
      midi,
      freq: midiToFreq(midi, refA4),
      note: formatMidiNote(midi, tuning.preferFlat),
      jianpu: tuning.jianpu[index],
      gapToNext: nextMidi === null ? 0 : Math.max(0, nextMidi - midi)
    };
  });
}

export function analyzePitch(freq, { tuningId = DEFAULT_TUNING_ID, transpose = 0, a4 = A4_DEFAULT } = {}) {
  if (!Number.isFinite(freq) || freq <= 0) return null;
  const tuning = getTuningById(tuningId);
  const refA4 = clamp(a4, A4_MIN, A4_MAX);
  const midi = freqToMidi(freq, refA4);
  const nearestMidi = Math.round(midi);
  const cents = (midi - nearestMidi) * 100;
  const note = formatMidiNote(nearestMidi, tuning.preferFlat);

  const strings = getEffectiveStrings(tuning.id, transpose, refA4);
  let minDiff = Infinity;
  for (const s of strings) {
    const diff = Math.abs(midi - s.midi);
    if (diff < minDiff) minDiff = diff;
  }

  const matchedStrings =
    minDiff <= STRING_MATCH_SEMITONES
      ? strings.filter((s) => Math.abs(Math.abs(midi - s.midi) - minDiff) < 1e-6).map((s) => s.index)
      : [];

  return {
    freq,
    midi,
    nearestMidi,
    cents,
    note,
    inTune: Math.abs(cents) <= IN_TUNE_CENTS,
    matchedStrings,
    closestDeltaSemitones: minDiff
  };
}
```

- [ ] **Step 5: 运行测试确认通过并提交**

Run: `node --test tests/tunings.test.js`
Expected: PASS (5 tests passing)

```powershell
git add package.json src/tunings.js tests/tunings.test.js
git commit -m "1、【新增】古琴六种传统调式数据与自动识弦核心逻辑；"
```

---

### Task 2: 手机端低频 MPM 音高检测与平滑器 (`src/pitch.js`)

**Files:**
- Create: `src/pitch.js`
- Test: `tests/pitch.test.js`

**Interfaces:**
- Produces from `src/pitch.js`:
  - `detectPitchMPM(buffer, sampleRate, options)` → `{ freq, clarity, rms } | null`
    - `options`: `{ minFreq = 45, maxFreq = 1200, rmsThreshold = 0.008, clarityThreshold = 0.55, peakRatio = 0.88 }`
  - `class PitchSmoother({ windowSize = 5, jumpCents = 80, holdMs = 1500 })`:
    - `push(freq, nowMs)` → `{ freq, isHeld } | null`
    - `reset()` → `void`

- [ ] **Step 1: 编写 `tests/pitch.test.js` 失败测试（含弱基频多泛音防八度场景）**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { detectPitchMPM, PitchSmoother } from "../src/pitch.js";

function synthWave(sampleRate, length, harmonics) {
  const buf = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    let v = 0;
    const t = i / sampleRate;
    for (const [freq, amp] of harmonics) {
      v += amp * Math.sin(2 * Math.PI * freq * t);
    }
    buf[i] = v;
  }
  return buf;
}

function centsDiff(measured, target) {
  return Math.abs(1200 * Math.log2(measured / target));
}

test("detectPitchMPM detects guqin low and mid frequencies within 2 cents", () => {
  const sr = 48000;
  const targets = [58.27, 65.41, 146.83, 440.0];
  for (const target of targets) {
    const buf = synthWave(sr, 4096, [[target, 0.5]]);
    const result = detectPitchMPM(buf, sr);
    assert.ok(result, `expected detection for ${target}Hz`);
    assert.ok(
      centsDiff(result.freq, target) <= 2,
      `expected ${target}Hz within 2 cents, got ${result.freq.toFixed(2)}Hz`
    );
  }
});

test("detectPitchMPM resists octave-up error on phone-mic weak-fundamental C2 harmonic wave", () => {
  const sr = 48000;
  const f0 = 65.41;
  // 模拟手机麦克风低频衰减：基频幅度仅为二倍频的 35%
  const buf = synthWave(sr, 4096, [
    [f0, 0.35],
    [f0 * 2, 1.0],
    [f0 * 3, 0.6],
    [f0 * 4, 0.25]
  ]);
  const result = detectPitchMPM(buf, sr);
  assert.ok(result, "expected harmonic C2 detection");
  assert.ok(
    centsDiff(result.freq, f0) <= 2,
    `expected fundamental ${f0}Hz without octave jump, got ${result.freq.toFixed(2)}Hz`
  );
});

test("detectPitchMPM returns null on silence and low-amplitude noise", () => {
  const sr = 48000;
  const silence = new Float32Array(4096);
  assert.equal(detectPitchMPM(silence, sr), null);

  const noise = new Float32Array(4096);
  let seed = 12345;
  for (let i = 0; i < noise.length; i++) {
    seed = (seed * 16807) % 2147483647;
    noise[i] = ((seed / 2147483647) * 2 - 1) * 0.05;
  }
  assert.equal(detectPitchMPM(noise, sr), null);
});

test("PitchSmoother filters transient spikes, switches fast on string change, and holds 1500ms", () => {
  const smoother = new PitchSmoother({ windowSize: 5, jumpCents: 80, holdMs: 1500 });
  assert.equal(smoother.push(65.4, 0).freq, 65.4);
  smoother.push(65.5, 20);
  smoother.push(65.3, 40);
  const smoothed = smoother.push(65.45, 60);
  assert.ok(Math.abs(smoothed.freq - 65.425) < 0.1);
  assert.equal(smoothed.isHeld, false);

  // 静音 1000ms 内应保持读数
  const held = smoother.push(null, 1060);
  assert.ok(held && held.isHeld === true);

  // 静音超过 1500ms 应回归待机
  const expired = smoother.push(null, 1600);
  assert.equal(expired, null);

  // 换弦跳变超过 80 音分应立即响应新弦
  smoother.push(65.4, 2000);
  smoother.push(65.4, 2020);
  const jumped = smoother.push(146.8, 2040);
  assert.equal(jumped.freq, 146.8);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/pitch.test.js`
Expected: FAIL with `Cannot find module '../src/pitch.js'`

- [ ] **Step 3: 实现 `src/pitch.js`**

```js
export function detectPitchMPM(buffer, sampleRate, options = {}) {
  const {
    minFreq = 45,
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

  // 收集正值区间内的局部极大值（MPM key maxima）
  const peaks = [];
  let inPositive = false;
  let peakIdx = -1;
  let peakVal = -Infinity;

  for (let tau = minLag; tau <= maxLag; tau++) {
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
      (p) => Math.abs(p.lag - doubleLagTarget) <= Math.max(3, chosen.lag * 0.04) && p.val >= chosen.val * 0.96 && p.val >= 0.85
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
```

- [ ] **Step 4: 运行测试确认通过并提交**

Run: `node --test tests/pitch.test.js`
Expected: PASS (4 tests passing)

```powershell
git add src/pitch.js tests/pitch.test.js
git commit -m "1、【新增】古琴低频 MPM 防八度音高检测与平滑滤波模块；"
```

---

### Task 3: 简繁国际化与麦克风/屏幕常亮会话封装 (`src/i18n.js`, `src/audio.js`)

**Files:**
- Create: `src/i18n.js`
- Create: `src/audio.js`
- Test: `tests/i18n.test.js`

**Interfaces:**
- Produces from `src/i18n.js`:
  - `SUPPORTED_LANGUAGES = ["zh-CN", "zh-TW"]`
  - `getDict(lang)` → 完整词条对象（含 6 种调式的 `name`、`alter`、`pieces`）
  - `STRING_NUMERALS = ["一", "二", "三", "四", "五", "六", "七"]`
- Produces from `src/audio.js`:
  - `class AudioTunerSession`:
    - `isRunning` (boolean)
    - `async start()` → `{ sampleRate }`（开启麦克风 + 1000Hz 低通 + 4096 AnalyserNode + Wake Lock）
    - `readTimeDomain(targetBuffer)` → `Float32Array | null`
    - `async stop()` → `void`（释放麦克风轨道、关闭 AudioContext、释放 Wake Lock）

- [ ] **Step 1: 编写 `tests/i18n.test.js` 失败测试**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { getDict, SUPPORTED_LANGUAGES } from "../src/i18n.js";
import { TUNINGS } from "../src/tunings.js";

test("all supported languages provide complete tuning labels", () => {
  for (const lang of SUPPORTED_LANGUAGES) {
    const dict = getDict(lang);
    assert.ok(dict.title);
    assert.ok(dict.startMic);
    assert.ok(dict.stopMic);
    for (const tuning of TUNINGS) {
      const info = dict.tunings[tuning.id];
      assert.ok(info && info.name && info.alter && info.pieces, `missing ${lang}.${tuning.id}`);
    }
  }
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/i18n.test.js`
Expected: FAIL with `Cannot find module '../src/i18n.js'`

- [ ] **Step 3: 实现 `src/i18n.js` 与 `src/audio.js`**

`src/i18n.js`:
```js
export const SUPPORTED_LANGUAGES = ["zh-CN", "zh-TW"];
export const STRING_NUMERALS = ["一", "二", "三", "四", "五", "六", "七"];

const DICT = {
  "zh-CN": {
    title: "古琴调音器",
    langToggle: "繁",
    langAria: "切换为繁体中文",
    startMic: "开始调音",
    stopMic: "暂停调音",
    listening: "拾音中 · 请拨弦",
    standby: "点击「开始调音」启用麦克风",
    pausedBackground: "已自动暂停（切回前台可继续）",
    inTune: "准音",
    flat: "偏低 · 宜紧弦",
    sharp: "偏高 · 宜松弦",
    centsUnit: "音分",
    lowerSemitone: "降半音",
    raiseSemitone: "升半音",
    resetA4Title: "点击重置为 440 Hz",
    resetTransposeTitle: "点击移调归零",
    tuningSuffix: "定弦",
    switchTuningHint: "点击切换调式",
    drawerTitle: "选择古琴调式",
    drawerClose: "关闭",
    installApp: "安装到桌面",
    errInsecure: "浏览器要求在 HTTPS 或 localhost 环境下才能使用麦克风。",
    errUnsupported: "当前浏览器不支持麦克风拾音，请改用 Safari 或 Chrome 打开。",
    errPermission: "未获得麦克风权限，请在浏览器地址栏或系统设置中允许后重试。",
    errNotFound: "未检测到可用的麦克风设备。",
    errUnknown: "无法启动麦克风，请检查设备权限后重试。",
    tunings: {
      zhengdiao: { name: "正调", alter: "标准定弦", pieces: "流水 · 平沙落雁 · 梅花三弄" },
      ruibin: { name: "蕤宾调", alter: "紧五弦", pieces: "潇湘水云 · 阳关三叠" },
      manjiao: { name: "慢角调", alter: "慢三弦", pieces: "风雷引 · 凤求凰" },
      qingshang: { name: "清商调", alter: "紧二五七弦", pieces: "捣衣 · 秋风词" },
      manshang: { name: "慢商调", alter: "慢二弦", pieces: "广陵散" },
      wuyi: { name: "无射调", alter: "紧五慢一弦", pieces: "胡笳十八拍 · 大胡笳" }
    }
  },
  "zh-TW": {
    title: "古琴調音器",
    langToggle: "简",
    langAria: "切換為簡體中文",
    startMic: "開始調音",
    stopMic: "暫停調音",
    listening: "拾音中 · 請撥弦",
    standby: "點擊「開始調音」啟用麥克風",
    pausedBackground: "已自動暫停（切回前景可繼續）",
    inTune: "準音",
    flat: "偏低 · 宜緊弦",
    sharp: "偏高 · 宜鬆弦",
    centsUnit: "音分",
    lowerSemitone: "降半音",
    raiseSemitone: "升半音",
    resetA4Title: "點擊重設為 440 Hz",
    resetTransposeTitle: "點擊移調歸零",
    tuningSuffix: "定弦",
    switchTuningHint: "點擊切換調式",
    drawerTitle: "選擇古琴調式",
    drawerClose: "關閉",
    installApp: "安裝到桌面",
    errInsecure: "瀏覽器要求在 HTTPS 或 localhost 環境下才能使用麥克風。",
    errUnsupported: "目前瀏覽器不支援麥克風拾音，請改用 Safari 或 Chrome 開啟。",
    errPermission: "未取得麥克風權限，請在瀏覽器網址列或系統設定中允許後重試。",
    errNotFound: "未偵測到可用的麥克風裝置。",
    errUnknown: "無法啟動麥克風，請檢查裝置權限後重試。",
    tunings: {
      zhengdiao: { name: "正調", alter: "標準定弦", pieces: "流水 · 平沙落雁 · 梅花三弄" },
      ruibin: { name: "蕤賓調", alter: "緊五弦", pieces: "瀟湘水雲 · 陽關三疊" },
      manjiao: { name: "慢角調", alter: "慢三弦", pieces: "風雷引 · 鳳求凰" },
      qingshang: { name: "清商調", alter: "緊二五七弦", pieces: "擣衣 · 秋風詞" },
      manshang: { name: "慢商調", alter: "慢二弦", pieces: "廣陵散" },
      wuyi: { name: "無射調", alter: "緊五慢一弦", pieces: "胡笳十八拍 · 大胡笳" }
    }
  }
};

export function getDict(lang) {
  return DICT[lang] || DICT["zh-CN"];
}
```

`src/audio.js`:
```js
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
      // ignore release failure
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
```

- [ ] **Step 4: 运行测试确认通过并提交**

Run: `node --test tests/i18n.test.js`
Expected: PASS

```powershell
git add src/i18n.js src/audio.js tests/i18n.test.js
git commit -m "1、【新增】简繁中文词条与麦克风低通采集、屏幕常亮会话模块；"
```

---

### Task 4: 宣纸墨绿国风一屏界面与主控联动 (`index.html`, `style.css`, `src/app.js`)

**Files:**
- Create: `index.html`
- Create: `style.css`
- Create: `src/app.js`

**Interfaces:**
- Consumes: `src/tunings.js`, `src/pitch.js`, `src/i18n.js`, `src/audio.js`
- Persists to `localStorage["guqin-tuner-settings-v1"]`: `{ tuningId, transpose, a4, language }`

- [ ] **Step 1: 创建 `index.html`（手机竖屏一屏布局 + SVG 半圆表盘 + 淡墨竹叶水印 + 调式抽屉）**

实现结构包含：
- 顶部精简栏：`#appTitle`、`#langBtn`、`#micBtn`
- 状态提示条：`#banner`（用于 HTTPS 提醒或权限错误）
- 上半区表盘：`#noteLetter`、`#noteAccidental`、`#noteOctave`、`#freqDisplay`、`#centsDisplay` + SVG 半圆表盘（`-50` / `-10` / `0` / `+10` / `+50` 刻度、准音绿弧、`#needleGroup` 指针）
- 中下主区：
  - 左区：A4 调节（`#a4Dec`、`#a4Value`、`#a4Inc`）+ 竹叶 SVG 水印 + 移调按钮（`#transposeDown`、`#transposeUp`）+ 底部定弦调式卡片（`#tuningCard`、`#tuningTitle`、`#transposeBadge`、`#jianpuRow`）
  - 右区：`#stringsColumn`（竖排一弦至七弦圆形徽章 + 旁侧半音间距圆点）
- 底部抽屉：`#tuningDrawer` + `#drawerBackdrop` + `#tuningList`

- [ ] **Step 2: 创建 `style.css`（宣纸墨绿国风 + `100dvh` 移动端一屏紧凑适配）**

核心变量：
- `--bg: #f4f2ec; --paper: #fffefa; --ink: #26332e; --muted: #77817b; --line: #e6e3d9; --green: #29483d; --green-soft: #e8eee9; --tune-ok: #2e7d5b; --gold: #a27c3e; --sharp: #b5563c;`
- 支持 `env(safe-area-inset-top)` / `env(safe-area-inset-bottom)`，在 `360x640` 至 `430x932` 手机竖屏下整屏无溢出。

- [ ] **Step 3: 创建 `src/app.js`**

完整串联：
- 启动时加载 `localStorage`（`guqin-tuner-settings-v1`）并校验范围
- 渲染七弦圆钮与半音间距圆点、简谱高低音点、调式卡片与抽屉列表
- 绑定 `micBtn`（启动/暂停 `AudioTunerSession`，映射权限错误提示）、`langBtn`、A4 加减与点击重置、升降半音与角标归零、抽屉开关
- `requestAnimationFrame` 循环读取 4096 点时域数据 → `detectPitchMPM` → `PitchSmoother` → `analyzePitch` → 阻尼平滑更新表盘指针（`currentAngle += (targetAngle - currentAngle) * 0.25`）与右侧七弦高亮
- 监听 `visibilitychange`：页面切至后台时自动暂停麦克风并提示

- [ ] **Step 4: 提交**

```powershell
git add index.html style.css src/app.js
git commit -m "1、【新增】宣纸墨绿国风手机端一屏调音界面与实时联动逻辑；"
```

---

### Task 5: PWA 离线配置与全链路验证 (`manifest.webmanifest`, `sw.js`, `icons/icon.svg`)

**Files:**
- Create: `manifest.webmanifest`
- Create: `sw.js`
- Create: `icons/icon.svg`

- [ ] **Step 1: 创建 `icons/icon.svg`、`manifest.webmanifest`、`sw.js`**
  - `manifest.webmanifest`：`name: "古琴调音器"`, `short_name: "古琴调音"`, `display: "standalone"`, `theme_color: "#29483d"`, `background_color: "#f4f2ec"`
  - `sw.js`：缓存所有静态资源（`./`, `./index.html`, `./style.css`, `./src/tunings.js`, `./src/pitch.js`, `./src/i18n.js`, `./src/audio.js`, `./src/app.js`, `./manifest.webmanifest`, `./icons/icon.svg`），并在 `index.html` 或 `src/app.js` 中注册（仅非 `file:` 协议）。

- [ ] **Step 2: 运行全量单元测试**

Run: `npm test`
Expected: 全部测试通过（0 failures）

- [ ] **Step 3: 本地静态服务 + 浏览器移动端视口验证**
  - 启动本地静态 HTTP 服务（Node.js 临时静态服务），用浏览器或无头检查确认：
    - 页面正常加载，无 404 或控制台 JS 报错
    - 手机竖屏（390×844）一屏完整展示
    - 切换调式抽屉、升降半音、A4 基准、简繁切换均生效且刷新后持久化恢复

- [ ] **Step 4: 提交**

```powershell
git add manifest.webmanifest sw.js icons/icon.svg
git commit -m "1、【新增】PWA 离线清单、矢量图标与静态资源缓存；"
```
