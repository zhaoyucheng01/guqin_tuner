export const DEFAULT_TUNING_ID = "zhengdiao";
export const A4_MIN = 240;
export const A4_MAX = 640;
export const A4_DEFAULT = 440;
export const TRANSPOSE_MIN = -6;
export const TRANSPOSE_MAX = 6;
export const IN_TUNE_CENTS = 10;
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
