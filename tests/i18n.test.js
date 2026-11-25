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
