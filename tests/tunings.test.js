import test from "node:test";
import assert from "node:assert/strict";
import {
  TUNINGS,
  A4_MIN,
  A4_MAX,
  IN_TUNE_CENTS,
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

test("A4 range spans 440 ± 200 Hz (240..640 Hz) and clamps cleanly", () => {
  assert.equal(A4_MIN, 240);
  assert.equal(A4_MAX, 640);

  const lowStrings = getEffectiveStrings("zhengdiao", 0, 240);
  assert.ok(Math.abs(lowStrings[0].freq - midiToFreq(36, 240)) < 1e-4);

  const highStrings = getEffectiveStrings("zhengdiao", 0, 640);
  assert.ok(Math.abs(highStrings[0].freq - midiToFreq(36, 640)) < 1e-4);

  const clampedLow = getEffectiveStrings("zhengdiao", 0, 100);
  assert.ok(Math.abs(clampedLow[0].freq - midiToFreq(36, 240)) < 1e-4);

  const clampedHigh = getEffectiveStrings("zhengdiao", 0, 900);
  assert.ok(Math.abs(clampedHigh[0].freq - midiToFreq(36, 640)) < 1e-4);
});

test("in-tune tolerance is ±10 cents", () => {
  assert.equal(IN_TUNE_CENTS, 10);
  const base = midiToFreq(36, 440);
  const plus9 = base * Math.pow(2, 9.5 / 1200);
  const minus9 = base * Math.pow(2, -9.5 / 1200);
  const plus11 = base * Math.pow(2, 10.5 / 1200);
  const minus11 = base * Math.pow(2, -10.5 / 1200);

  assert.equal(analyzePitch(plus9, { tuningId: "zhengdiao", a4: 440 }).inTune, true);
  assert.equal(analyzePitch(minus9, { tuningId: "zhengdiao", a4: 440 }).inTune, true);
  assert.equal(analyzePitch(plus11, { tuningId: "zhengdiao", a4: 440 }).inTune, false);
  assert.equal(analyzePitch(minus11, { tuningId: "zhengdiao", a4: 440 }).inTune, false);
});
