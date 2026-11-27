import {
  TUNINGS,
  DEFAULT_TUNING_ID,
  A4_MIN,
  A4_MAX,
  A4_DEFAULT,
  TRANSPOSE_MIN,
  TRANSPOSE_MAX,
  IN_TUNE_CENTS,
  clamp,
  getTuningById,
  getEffectiveStrings,
  analyzePitch
} from "./tunings.js";
import { detectPitchMPM, PitchSmoother } from "./pitch.js";
import { getDict, SUPPORTED_LANGUAGES, STRING_NUMERALS, APP_VERSION, APP_AUTHOR } from "./i18n.js";
import { AudioTunerSession } from "./audio.js";

const SETTINGS_KEY = "guqin-tuner-settings-v1";
const FFT_SIZE = 4096;

const $ = (id) => document.getElementById(id);

const state = {
  tuningId: DEFAULT_TUNING_ID,
  transpose: 0,
  a4: A4_DEFAULT,
  language: "zh-CN",
  sampleRate: 48000,
  targetAngle: 0,
  currentAngle: 0,
  lastAnalysis: null,
  lastIsHeld: false,
  installPrompt: null
};

const session = new AudioTunerSession({ fftSize: FFT_SIZE, lowpassHz: 1000 });
const smoother = new PitchSmoother({ windowSize: 5, jumpCents: 80, holdMs: 1500 });
const timeBuffer = new Float32Array(FFT_SIZE);
let rafId = 0;

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (!saved || typeof saved !== "object") return;
    if (TUNINGS.some((t) => t.id === saved.tuningId)) state.tuningId = saved.tuningId;
    if (Number.isFinite(Number(saved.transpose))) {
      state.transpose = clamp(Math.round(Number(saved.transpose)), TRANSPOSE_MIN, TRANSPOSE_MAX);
    }
    if (Number.isFinite(Number(saved.a4))) {
      state.a4 = clamp(Math.round(Number(saved.a4)), A4_MIN, A4_MAX);
    }
    if (SUPPORTED_LANGUAGES.includes(saved.language)) state.language = saved.language;
  } catch {
    // 隐私模式或存储不可用时静默降级
  }
}

function saveSettings() {
  try {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        tuningId: state.tuningId,
        transpose: state.transpose,
        a4: state.a4,
        language: state.language
      })
    );
  } catch {
    // 忽略本地存储写入异常
  }
}

function showBanner(message) {
  const el = $("banner");
  if (!message) {
    el.hidden = true;
    el.textContent = "";
    return;
  }
  el.textContent = message;
  el.hidden = false;
}

function renderGaugeTicks() {
  const container = $("gaugeTicks");
  container.innerHTML = "";
  const cx = 120;
  const cy = 126;
  const rOuter = 96;

  for (let cents = -50; cents <= 50; cents += 5) {
    const isMajor = cents % 10 === 0;
    const deg = (cents / 50) * 90;
    const rad = (deg * Math.PI) / 180;
    const rInner = isMajor ? rOuter - 12 : rOuter - 7;
    const x1 = cx + rInner * Math.sin(rad);
    const y1 = cy - rInner * Math.cos(rad);
    const x2 = cx + rOuter * Math.sin(rad);
    const y2 = cy - rOuter * Math.cos(rad);

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", x1.toFixed(1));
    line.setAttribute("y1", y1.toFixed(1));
    line.setAttribute("x2", x2.toFixed(1));
    line.setAttribute("y2", y2.toFixed(1));
    line.setAttribute("class", isMajor ? "gauge-tick major" : "gauge-tick");
    container.appendChild(line);
  }
}

function renderStrings(analysis = null) {
  const strings = getEffectiveStrings(state.tuningId, state.transpose, state.a4);
  const matchedStrings = analysis ? analysis.matchedStrings : [];
  const col = $("stringsColumn");
  col.innerHTML = "";

  strings.forEach((s, idx) => {
    const isMatched = matchedStrings.includes(idx);
    const deltaCents = isMatched && analysis ? (analysis.midi - s.midi) * 100 : null;
    const isStringOk = deltaCents !== null && Math.abs(deltaCents) <= IN_TUNE_CENTS;
    const isStringLow = deltaCents !== null && deltaCents < -IN_TUNE_CENTS;
    const isStringHigh = deltaCents !== null && deltaCents > IN_TUNE_CENTS;

    const row = document.createElement("div");
    row.className = "string-row" + (isMatched ? (isStringOk ? " in-tune" : " active") : "");

    const peg = document.createElement("div");
    peg.className = "string-peg";
    peg.innerHTML = `<span class="string-note">${s.note.shortName}</span><span class="string-num">${STRING_NUMERALS[idx]}弦</span>`;

    const hzEl = document.createElement("span");
    hzEl.className = "string-hz";
    hzEl.textContent = `${s.freq.toFixed(1)} Hz`;

    const track = document.createElement("div");
    track.className = "string-dots-track";
    track.innerHTML =
      `<span class="track-dot dot-low${isStringLow ? " lit" : ""}"></span>` +
      `<span class="track-dot dot-ok${isStringOk ? " lit" : ""}"></span>` +
      `<span class="track-dot dot-high${isStringHigh ? " lit" : ""}"></span>`;

    row.appendChild(peg);
    row.appendChild(hzEl);
    row.appendChild(track);
    col.appendChild(row);
  });
}

function renderTuningCard(matchedStrings = [], inTune = false) {
  const dict = getDict(state.language);
  const tuning = getTuningById(state.tuningId);
  const meta = dict.tunings[tuning.id];

  $("tuningTitle").textContent = `${meta.name}${dict.tuningSuffix} ${tuning.keyLabel}`;
  $("switchTuningHint").textContent = `${dict.switchTuningHint} ▾`;

  const badge = $("transposeBadge");
  if (state.transpose === 0) {
    badge.hidden = true;
  } else {
    badge.hidden = false;
    badge.textContent = state.transpose > 0 ? `+${state.transpose}` : `${state.transpose}`;
    badge.title = dict.resetTransposeTitle;
  }

  const row = $("jianpuRow");
  row.innerHTML = "";
  tuning.jianpu.forEach((item, idx) => {
    const isMatched = matchedStrings.includes(idx);
    const cell = document.createElement("div");
    cell.className = "jianpu-cell" + (isMatched ? (inTune ? " in-tune" : " active") : "");

    const digit = document.createElement("span");
    digit.className = "jianpu-digit";
    digit.textContent = item.digit;

    const dots = document.createElement("span");
    dots.className = "jianpu-dots";
    const count = Math.abs(Math.min(0, item.dots));
    for (let i = 0; i < count; i++) {
      const dot = document.createElement("span");
      dot.className = "jianpu-dot";
      dots.appendChild(dot);
    }

    cell.appendChild(digit);
    cell.appendChild(dots);
    row.appendChild(cell);
  });
}

function renderDrawerList() {
  const dict = getDict(state.language);
  const list = $("tuningList");
  list.innerHTML = "";

  TUNINGS.forEach((t) => {
    const info = dict.tunings[t.id];
    const effective = getEffectiveStrings(t.id, state.transpose, state.a4);
    const notesText = effective.map((s) => s.note.shortName).join("  ");

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tuning-option" + (t.id === state.tuningId ? " selected" : "");
    btn.innerHTML = `
      <div class="tuning-option-top">
        <span class="tuning-option-name">${info.name} · ${info.alter}</span>
        <span class="tuning-option-key">${t.keyLabel}</span>
      </div>
      <div class="tuning-option-notes">${notesText}</div>
      <div class="tuning-option-meta">${info.pieces}</div>
    `;
    btn.addEventListener("click", () => {
      state.tuningId = t.id;
      saveSettings();
      closeDrawer();
      renderStaticUI();
    });
    list.appendChild(btn);
  });
}

function renderControls() {
  const dict = getDict(state.language);
  $("a4Value").textContent = `${state.a4} Hz`;
  $("a4Value").title = dict.resetA4Title;
  $("a4Dec").disabled = state.a4 <= A4_MIN;
  $("a4Inc").disabled = state.a4 >= A4_MAX;
  $("transposeDown").disabled = state.transpose <= TRANSPOSE_MIN;
  $("transposeUp").disabled = state.transpose >= TRANSPOSE_MAX;
}

function renderReadout(analysis, isHeld) {
  const noteDisplay = $("noteDisplay");
  const needle = $("needleGroup");

  if (!analysis) {
    $("noteLetter").textContent = "--";
    $("noteAccidental").textContent = "";
    $("noteOctave").textContent = "";
    $("freqDisplay").textContent = "--.- Hz";
    noteDisplay.className = "note-display";
    needle.setAttribute("class", "needle-group");
    state.targetAngle = 0;
    renderStrings(null);
    renderTuningCard([], false);
    return;
  }

  $("noteLetter").textContent = analysis.note.letter;
  $("noteAccidental").textContent = analysis.note.accidental;
  $("noteOctave").textContent = String(analysis.note.octave);
  $("freqDisplay").textContent = `${analysis.freq.toFixed(1)} Hz`;

  noteDisplay.className =
    "note-display" + (analysis.inTune ? " in-tune" : "") + (isHeld ? " is-held" : "");

  if (analysis.inTune) {
    needle.setAttribute("class", "needle-group in-tune");
  } else if (analysis.cents < 0) {
    needle.setAttribute("class", "needle-group flat");
  } else {
    needle.setAttribute("class", "needle-group sharp");
  }

  state.targetAngle = clamp((analysis.cents / 50) * 90, -90, 90);
  renderStrings(analysis);
  renderTuningCard(analysis.matchedStrings, analysis.inTune);
}

function renderStaticUI() {
  const dict = getDict(state.language);
  document.documentElement.lang = state.language;
  document.title = dict.title;
  $("appTitle").textContent = dict.title;
  $("langBtn").textContent = dict.langToggle;
  $("langBtn").setAttribute("aria-label", dict.langAria);
  $("installBtn").textContent = dict.installApp;
  $("micBtnText").textContent = session.isRunning ? dict.stopMic : dict.startMic;
  $("micBtn").classList.toggle("listening", session.isRunning);
  $("micBtn").setAttribute("aria-pressed", String(session.isRunning));
  $("transposeDown").textContent = dict.lowerSemitone;
  $("transposeUp").textContent = dict.raiseSemitone;
  $("drawerTitle").textContent = dict.drawerTitle;
  $("drawerClose").textContent = dict.drawerClose;

  renderControls();
  const matched = state.lastAnalysis ? state.lastAnalysis.matchedStrings : [];
  const inTune = state.lastAnalysis ? state.lastAnalysis.inTune : false;
  renderStrings(state.lastAnalysis);
  renderTuningCard(matched, inTune);
  renderDrawerList();
  renderAboutModal();
}

function renderAboutModal() {
  const dict = getDict(state.language);
  const { about } = dict;
  const verText = `v${APP_VERSION}`;
  $("aboutTitle").textContent = about.title;
  $("aboutClose").textContent = dict.drawerClose;
  $("aboutAppName").textContent = dict.title;
  $("aboutSubtitle").textContent = about.subtitle;
  $("aboutAuthorLabel").textContent = about.authorLabel;
  $("aboutAuthorValue").textContent = APP_AUTHOR;
  $("aboutVersionLabel").textContent = about.versionLabel;
  $("aboutVersionValue").textContent = verText;
  $("aboutThanksLabel").textContent = about.thanksLabel;
  $("aboutThanksValue").textContent = about.thanksText;
  $("aboutChangelogTitle").textContent = about.changelogTitle;

  const container = $("aboutChangelog");
  container.innerHTML = "";
  about.changelog.forEach((entry) => {
    const card = document.createElement("div");
    card.className = "changelog-entry";
    const itemsHtml = entry.items.map((item) => `<li>${item}</li>`).join("");
    card.innerHTML = `
      <div class="changelog-head">
        <span class="changelog-ver">${entry.version}</span>
        <span class="changelog-date">${entry.date}</span>
      </div>
      <ul class="changelog-list">${itemsHtml}</ul>
    `;
    container.appendChild(card);
  });
}

function openAboutModal() {
  renderAboutModal();
  $("aboutBackdrop").hidden = false;
  $("aboutModal").hidden = false;
}

function closeAboutModal() {
  $("aboutBackdrop").hidden = true;
  $("aboutModal").hidden = true;
}

function openDrawer() {
  renderDrawerList();
  $("drawerBackdrop").hidden = false;
  $("tuningDrawer").hidden = false;
}

function closeDrawer() {
  $("drawerBackdrop").hidden = true;
  $("tuningDrawer").hidden = true;
}

function mapAudioError(err) {
  const dict = getDict(state.language);
  const isLocalOpaque = location.protocol === "file:" || location.protocol === "content:";
  if (!err) return dict.errUnknown;
  if (err.code === "INSECURE_CONTEXT") return isLocalOpaque ? dict.errLocalFile : dict.errInsecure;
  if (err.code === "UNSUPPORTED") return dict.errUnsupported;
  if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
    return isLocalOpaque ? dict.errLocalFile : dict.errPermission;
  }
  if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") return dict.errNotFound;
  return dict.errUnknown;
}

function tick() {
  if (!session.isRunning) return;

  const buf = session.readTimeDomain(timeBuffer);
  const now = performance.now();
  if (buf) {
    const raw = detectPitchMPM(buf, state.sampleRate);
    const smoothed = smoother.push(raw ? raw.freq : null, now);
    if (smoothed) {
      state.lastAnalysis = analyzePitch(smoothed.freq, {
        tuningId: state.tuningId,
        transpose: state.transpose,
        a4: state.a4
      });
      state.lastIsHeld = smoothed.isHeld;
    } else {
      state.lastAnalysis = null;
      state.lastIsHeld = false;
    }
    renderReadout(state.lastAnalysis, state.lastIsHeld);
  }

  state.currentAngle += (state.targetAngle - state.currentAngle) * 0.25;
  $("needleGroup").setAttribute("transform", `rotate(${state.currentAngle.toFixed(2)} 120 126)`);

  rafId = requestAnimationFrame(tick);
}

async function startTuner() {
  showBanner("");
  try {
    const { sampleRate } = await session.start();
    state.sampleRate = sampleRate;
    smoother.reset();
    state.lastAnalysis = null;
    renderStaticUI();
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(tick);
  } catch (err) {
    showBanner(mapAudioError(err));
    renderStaticUI();
  }
}

async function stopTuner(statusOverride = "") {
  cancelAnimationFrame(rafId);
  await session.stop();
  smoother.reset();
  state.lastAnalysis = null;
  state.lastIsHeld = false;
  state.targetAngle = 0;
  state.currentAngle = 0;
  $("needleGroup").setAttribute("transform", "rotate(0 120 126)");
  renderStaticUI();
  renderReadout(null, false);
  if (statusOverride) {
    showBanner(statusOverride);
  }
}

function bindHoldRepeat(button, onStep) {
  let delayTimer = 0;
  let repeatTimer = 0;
  let stepCount = 0;
  let handledByPointer = false;

  const stop = () => {
    clearTimeout(delayTimer);
    clearTimeout(repeatTimer);
    delayTimer = 0;
    repeatTimer = 0;
    stepCount = 0;
  };

  const scheduleNext = () => {
    const delta = stepCount >= 18 ? 10 : stepCount >= 8 ? 5 : 1;
    const interval = stepCount >= 18 ? 70 : stepCount >= 8 ? 75 : 90;
    repeatTimer = setTimeout(() => {
      if (button.disabled) {
        stop();
        return;
      }
      stepCount += 1;
      onStep(delta);
      scheduleNext();
    }, interval);
  };

  button.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || button.disabled) return;
    handledByPointer = true;
    stop();
    onStep(1);
    delayTimer = setTimeout(() => {
      if (!button.disabled) {
        scheduleNext();
      }
    }, 380);
  });

  ["pointerup", "pointercancel", "pointerleave"].forEach((evt) => {
    button.addEventListener(evt, stop);
  });

  button.addEventListener("click", () => {
    if (handledByPointer) {
      handledByPointer = false;
      return;
    }
    if (!button.disabled) {
      onStep(1);
    }
  });
}

function adjustA4(delta) {
  const next = clamp(state.a4 + delta, A4_MIN, A4_MAX);
  if (next === state.a4) return;
  state.a4 = next;
  saveSettings();
  renderStaticUI();
}

function bindEvents() {
  $("micBtn").addEventListener("click", () => {
    if (session.isRunning) {
      stopTuner();
    } else {
      startTuner();
    }
  });

  $("langBtn").addEventListener("click", () => {
    state.language = state.language === "zh-CN" ? "zh-TW" : "zh-CN";
    saveSettings();
    renderStaticUI();
    if (state.lastAnalysis) {
      renderReadout(state.lastAnalysis, state.lastIsHeld);
    }
  });

  bindHoldRepeat($("a4Dec"), (step) => adjustA4(-step));
  bindHoldRepeat($("a4Inc"), (step) => adjustA4(step));

  $("a4Value").addEventListener("click", () => {
    state.a4 = A4_DEFAULT;
    saveSettings();
    renderStaticUI();
  });

  $("transposeDown").addEventListener("click", () => {
    state.transpose = clamp(state.transpose - 1, TRANSPOSE_MIN, TRANSPOSE_MAX);
    saveSettings();
    renderStaticUI();
  });

  $("transposeUp").addEventListener("click", () => {
    state.transpose = clamp(state.transpose + 1, TRANSPOSE_MIN, TRANSPOSE_MAX);
    saveSettings();
    renderStaticUI();
  });

  $("transposeBadge").addEventListener("click", (e) => {
    e.stopPropagation();
    state.transpose = 0;
    saveSettings();
    renderStaticUI();
  });

  $("tuningCard").addEventListener("click", openDrawer);
  $("tuningCard").addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openDrawer();
    }
  });
  $("drawerBackdrop").addEventListener("click", closeDrawer);
  $("drawerClose").addEventListener("click", closeDrawer);

  // 连击标题 5 次弹出关于弹窗
  let titleTapCount = 0;
  let titleLastTapMs = 0;
  $("appTitle").addEventListener("click", () => {
    const now = Date.now();
    if (now - titleLastTapMs > 600) {
      titleTapCount = 0;
    }
    titleLastTapMs = now;
    titleTapCount += 1;
    if (titleTapCount >= 5) {
      titleTapCount = 0;
      openAboutModal();
    }
  });
  $("aboutBackdrop").addEventListener("click", closeAboutModal);
  $("aboutClose").addEventListener("click", closeAboutModal);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!$("aboutModal").hidden) {
        closeAboutModal();
        return;
      }
      if (!$("tuningDrawer").hidden) {
        closeDrawer();
        return;
      }
    }
    if (e.code === "Space" && $("tuningDrawer").hidden && $("aboutModal").hidden) {
      const tag = document.activeElement?.tagName;
      if (tag !== "BUTTON" && tag !== "INPUT" && tag !== "SELECT") {
        e.preventDefault();
        if (session.isRunning) stopTuner();
        else startTuner();
      }
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && session.isRunning) {
      stopTuner(getDict(state.language).pausedBackground);
    }
  });

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    state.installPrompt = e;
    $("installBtn").hidden = false;
  });

  $("installBtn").addEventListener("click", async () => {
    if (!state.installPrompt) return;
    state.installPrompt.prompt();
    await state.installPrompt.userChoice;
    state.installPrompt = null;
    $("installBtn").hidden = true;
  });
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }
}

loadSettings();
renderGaugeTicks();
bindEvents();
renderStaticUI();
registerServiceWorker();

if (!window.isSecureContext) {
  showBanner(getDict(state.language).errInsecure);
}
