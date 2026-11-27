import test from "node:test";
import assert from "node:assert/strict";
import { getDict, SUPPORTED_LANGUAGES, APP_VERSION, APP_AUTHOR } from "../src/i18n.js";
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

test("app metadata and about changelog are complete for all languages", () => {
  assert.equal(APP_VERSION, "1.1.0");
  assert.equal(APP_AUTHOR, "朝雨");
  for (const lang of SUPPORTED_LANGUAGES) {
    const { about } = getDict(lang);
    assert.ok(about && about.title && about.subtitle && about.changelogTitle);
    assert.ok(Array.isArray(about.changelog) && about.changelog.length >= 2);
    for (const entry of about.changelog) {
      assert.ok(entry.version && entry.date && entry.items.length > 0);
    }
  }
});
