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
  const targets = [35.68, 58.27, 65.41, 146.83, 440.0];
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

  const held = smoother.push(null, 1060);
  assert.ok(held && held.isHeld === true);

  const expired = smoother.push(null, 1600);
  assert.equal(expired, null);

  smoother.push(65.4, 2000);
  smoother.push(65.4, 2020);
  const jumped = smoother.push(146.8, 2040);
  assert.equal(jumped.freq, 146.8);
});
