# 古琴调音器视觉底图与调音参数优化设计文档

**日期**：2026-11-27  
**状态**：待确认  
**目标范围**：底部水墨底图替换（大屏与小屏响应式适配）、表盘与判定准音区扩至 `±10` 音分、A4 基准频率扩至 `440 ± 200 Hz`（`240 ~ 640 Hz`）及交互与低频检测适配。

---

## 1. 底部水墨底图替换

### 1.1 视觉资产定稿

以宣纸底色 `#f4f2ec` 与主题墨绿 `#29483d` 统一风格，导出两套透明背景 WebP 资产（小体积、无白框、直接自然融进宣纸背景）：

| 资产路径 | 适用视口 | 来源与视觉内容 |
| :--- | :--- | :--- |
| `assets/ink-bg-mobile.webp` | 小屏（`< 820px`） | 基于定稿原图 `gen_mobile_poetic_birds_up.png` 裁剪顶部多余留白并转 `#29483d` 透明通道，保留简洁两重没骨远山、淡墨水色倒影、两只抬高飞鸟、微光琴徽、流水琴弦与抚琴手。 |
| `assets/ink-bg-desktop.webp` | 大屏（`>= 820px`） | 基于定稿桌面宽卷 `desk_art_unified_birds_rgba.png` 转透明通道，左侧衔接同款烟波远山与渐远飞鸟，中段琴身以轻雾淡化过渡，右侧抚琴手舒展落在卡片外侧，左右边缘做柔和羽化。 |

### 1.2 结构与响应式布局

- 替换 [index.html](file:///e:/code/tools/guqin_tuner/index.html#L110-L139) 中原有的 `.ink-wash-bg` 内嵌 SVG（三叠远山与淡竹），改为语义化 `<picture class="ink-bg-picture">`：
  - `<source media="(min-width: 820px)" srcset="assets/ink-bg-desktop.webp" type="image/webp">`
  - `<img class="ink-bg-img" src="assets/ink-bg-mobile.webp" alt="" decoding="async">`
- 保持 `.ink-wash-bg` 固定在视口底部（`position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); pointer-events: none; z-index: 0;`），绝不拉伸变形（`height: auto` 严格等比缩放）：
  - **常规手机（`< 820px` 且 `height > 720px`）**：`width: min(460px, 100%)`，`bottom: 0`，自然落在卡片下方空白区。
  - **矮屏手机（`< 820px` 且 `max-height: 720px`）**：`bottom: -18px`，`opacity: 0.55`，避免干扰底部定弦卡片与七弦圆钮。
  - **宽屏桌面（`>= 1200px` 且 `height > 780px`）**：`width: min(1440px, 98vw)`，`bottom: -42px`，上下左右均保留舒朗呼吸间距。
  - **中等宽屏 / 矮屏笔记本（`820px ~ 1199px` 或 `max-height: 780px`）**：`width: min(1180px, 100vw)`，`bottom: -64px`，`opacity: 0.72`，退居轻淡衬底不抢前景。

### 1.3 离线与多端同步

- 更新 [sw.js](file:///e:/code/tools/guqin_tuner/sw.js)：升级 `CACHE_NAME` 版本号，将 `./assets/ink-bg-mobile.webp` 与 `./assets/ink-bg-desktop.webp` 加入 `ASSETS` 离线预缓存列表。
- 同步更新单文件离线版 [guqin_tuner.html](file:///e:/code/tools/guqin_tuner/guqin_tuner.html) 与 Android 资源 [android/app/src/main/assets/guqin_tuner.html](file:///e:/code/tools/guqin_tuner/android/app/src/main/assets/guqin_tuner.html)（将两套 WebP 资产以内联 `data:image/webp;base64,...` 写入 `<picture>`，保证离线单文件与 APK 无需外网即可显示）。

---

## 2. 准音绿区改为 `±10` 音分

- **算法常量**：将 [src/tunings.js](file:///e:/code/tools/guqin_tuner/src/tunings.js#L7) 的 `IN_TUNE_CENTS` 由 `5` 修改为 `10`。所有准音判定（`analyzePitch().inTune`、指针与音名变绿、简谱高亮、右侧七弦中间绿灯）均自动统一为 `|cents| <= 10`。
- **表盘 SVG 绿弧**：将 [index.html](file:///e:/code/tools/guqin_tuner/index.html#L40-L41) 的 `.gauge-ok-arc` 从 `±5` 音分（`±9°`）扩展为 `±10` 音分（`±18°`，半径 `96`，圆心 `(120, 126)`）：
  - 起点：`x1 = 120 - 96 * sin(18°) = 90.3`，`y1 = 126 - 96 * cos(18°) = 34.7`
  - 终点：`x2 = 120 + 96 * sin(18°) = 149.7`，`y2 = 34.7`
  - 路径：`d="M 90.3 34.7 A 96 96 0 0 1 149.7 34.7"`（与 `-10`、`+10` 主刻度精准对齐）。
- **单文件同步**：同步更新 `guqin_tuner.html` 及 Android 副本中的 `IN_TUNE_CENTS` 与 `.gauge-ok-arc`。

---

## 3. A4 基准扩展至 `440 ± 200 Hz`（`240 ~ 640 Hz`）

- **范围放宽**：将 [src/tunings.js](file:///e:/code/tools/guqin_tuner/src/tunings.js#L2-L3) 的 `A4_MIN` 由 `430` 改为 `240`，`A4_MAX` 由 `450` 改为 `640`。
- **长按连续加速调节**：在 [src/app.js](file:///e:/code/tools/guqin_tuner/src/app.js) 中为 `#a4Dec` 与 `#a4Inc` 增加指针长按连发逻辑（兼容鼠标与触屏 `pointerdown` / `pointerup` / `pointercancel` / `pointerleave`）：
  - 单击 / 首次按下：立即步进 `±1 Hz`。
  - 按住 `380 ms` 后进入连发：前 8 步每 `90 ms` 步进 `±1 Hz`，第 9 ~ 18 步每 `75 ms` 步进 `±5 Hz`，之后每 `70 ms` 步进 `±10 Hz`。
  - 松开或触达边界（`240` / `640`）立即停止定时器并持久化设置。
  - 点击中间 `#a4Value` 保持一键重置为 `440 Hz`。
- **低频检测下限适配**：当 `A4 = 240 Hz` 时，正调一弦（MIDI 36）频率约为 `35.68 Hz`，无射调一弦（MIDI 34）约为 `31.79 Hz`。将 [src/pitch.js](file:///e:/code/tools/guqin_tuner/src/pitch.js#L3) 默认 `minFreq` 由 `45` 放宽至 `30` Hz，确保极低 A4 基准下仍可稳定拾音。
- **单文件同步**：同步更新 `guqin_tuner.html` 与 Android 副本。

---

## 4. 验证计划

1. 运行 `npm test`，补充并验证：
   - `IN_TUNE_CENTS = 10` 边界测试（`±9.5` 音分判准、`±10.5` 音分判偏）。
   - `A4_MIN = 240`、`A4_MAX = 640` 边界与 `getEffectiveStrings` / `analyzePitch` 测试。
   - `detectPitchMPM` 在低频 `35.7 Hz`（对应 `A4 = 240 Hz` 一弦）的准确识别测试。
2. 校验 `assets/ink-bg-mobile.webp` 与 `assets/ink-bg-desktop.webp` 文件存在、透明通道正常且体积轻量，校验 `guqin_tuner.html` 与 `android/app/src/main/assets/guqin_tuner.html` 内容一致。
