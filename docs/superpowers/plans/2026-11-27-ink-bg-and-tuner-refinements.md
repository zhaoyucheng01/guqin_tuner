# 古琴调音器视觉底图与调音参数优化实施计划

**Goal:** 完成底部没骨水墨底图替换（大屏/小屏响应式）、准音绿区 `±10` 音分、A4 基准 `240 ~ 640 Hz` 及长按加速，并同步 PWA 缓存与单文件 / Android 离线资产。

**Architecture:** 导出两套轻量透明 WebP 水墨底图供 `<picture>` 按断点切换；核心音高常量与检测下限收口在 `src/tunings.js` 与 `src/pitch.js`；交互与表盘绿弧更新在 `index.html`、`style.css`、`src/app.js`、`sw.js`；最后同步更新单文件版 `guqin_tuner.html` 与 `android/app/src/main/assets/guqin_tuner.html`。

**Tech Stack:** 原生 HTML/CSS/ES Modules、Web Audio API、Node 内置测试 runner (`node --test`)、Pillow (WebP 资产导出)。

## Global Constraints

- 小屏底图严格基于 `gen_mobile_poetic_birds_up.png` 转 `#29483d` 透明 WebP，保持原笔触与两只抬高飞鸟。
- 大屏底图严格基于 `desk_art_unified_birds_rgba.png` 转透明 WebP，宽屏居中贴底并保留呼吸留白。
- `IN_TUNE_CENTS = 10`，表盘绿弧 `d="M 90.3 34.7 A 96 96 0 0 1 149.7 34.7"`。
- `A4_MIN = 240`、`A4_MAX = 640`，`detectPitchMPM` 默认 `minFreq = 30`。
- 禁止不经验证宣称完成；不自动 `git push`。

---

### Task 1: 导出透明 WebP 水墨底图资产

**Files:**
- Create: `assets/ink-bg-mobile.webp`
- Create: `assets/ink-bg-desktop.webp`

- [ ] **Step 1:** 用 Python/Pillow 将 `gen_mobile_poetic_birds_up.png` 裁掉顶部多余留白并转 `#29483d` 透明通道导出为 `assets/ink-bg-mobile.webp`（宽 960px，透明无损/高质量 WebP）。
- [ ] **Step 2:** 将 `desk_art_unified_birds_rgba.png` 导出为 `assets/ink-bg-desktop.webp`（宽 1440px，透明 WebP）。
- [ ] **Step 3:** 验证两文件存在、模式为 RGBA 且单文件体积合理（`< 100 KB`）。

### Task 2: 放宽 A4 范围、更新准音阈值与低频检测下限（TDD）

**Files:**
- Modify: `src/tunings.js`
- Modify: `src/pitch.js`
- Modify: `tests/tunings.test.js`
- Modify: `tests/pitch.test.js`

- [ ] **Step 1:** 在 `tests/tunings.test.js` 新增 `IN_TUNE_CENTS = 10` 边界用例及 `A4_MIN = 240` / `A4_MAX = 640` 用例；在 `tests/pitch.test.js` 新增 `35.68 Hz`（`A4 = 240 Hz` 一弦 C2）检测用例。
- [ ] **Step 2:** 运行 `npm test` 确认新用例失败。
- [ ] **Step 3:** 更新 `src/tunings.js`（`A4_MIN = 240`, `A4_MAX = 640`, `IN_TUNE_CENTS = 10`）与 `src/pitch.js`（`minFreq = 30`）。
- [ ] **Step 4:** 运行 `npm test` 确认全部通过。

### Task 3: 更新 Web 端界面、样式、长按加速与 PWA 缓存

**Files:**
- Modify: `index.html`
- Modify: `style.css`
- Modify: `src/app.js`
- Modify: `sw.js`

- [ ] **Step 1:** 修改 `index.html`：表盘 `.gauge-ok-arc` 改为 `±10` 音分路径；`.ink-wash-bg` 替换为 `<picture>` 加载 `assets/ink-bg-desktop.webp` / `assets/ink-bg-mobile.webp`。
- [ ] **Step 2:** 修改 `style.css`：为 `.ink-wash-bg`、`.ink-bg-picture`、`.ink-bg-img` 补齐手机常规屏、矮屏（`max-height: 720px`）、桌面宽屏（`>= 1200px`）与中等/矮屏桌面（`820px ~ 1199px` / `max-height: 780px`）响应式规则。
- [ ] **Step 3:** 修改 `src/app.js`：为 `#a4Dec` / `#a4Inc` 实现 `bindHoldRepeat`（短按 ±1 Hz，长按 380ms 后渐进加速至 ±5 / ±10 Hz），保留点击 `#a4Value` 重置 `440 Hz`。
- [ ] **Step 4:** 更新 `sw.js`：`CACHE_NAME` 升级为 `"guqin-tuner-v22"`，新增 `./assets/ink-bg-mobile.webp` 与 `./assets/ink-bg-desktop.webp`。

### Task 4: 同步单文件版 `guqin_tuner.html` 与 Android 资产

**Files:**
- Modify: `guqin_tuner.html`
- Modify: `android/app/src/main/assets/guqin_tuner.html`

- [ ] **Step 1:** 同步更新 `guqin_tuner.html` 中的 CSS、表盘 `±10` 音分绿弧、内联 Base64 WebP `<picture>` 底图、`A4_MIN/MAX`、`IN_TUNE_CENTS`、`minFreq` 及长按加速逻辑。
- [ ] **Step 2:** 将更新后的 `guqin_tuner.html` 完整复制到 `android/app/src/main/assets/guqin_tuner.html` 并验证两文件哈希一致。

### Task 5: 最终验证

- [ ] **Step 1:** 运行 `npm test`，确认全部测试通过且无回归。
- [ ] **Step 2:** 检查 `git status` 与关键文件校验结果，确认所有目标文件完整落盘。
