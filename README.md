# 古琴调音器

一款面向古琴演奏与日常练琴的实时麦克风调音器，采用宣纸墨绿宋韵极简界面，同时提供 **Android 离线安装包**、**网页模块化版（PWA）** 与 **单文件便携版** 三种使用形态。

## 核心特性

- **六种传统古琴调式**：支持正调、蕤宾调、慢角调、清商调、慢商调与无射调，同步展示七弦散音音名、目标频率与简谱。
- **低频防八度识别**：采用 MPM（McLeod Pitch Method）音高检测算法，针对手机麦克风拾取古琴一弦低音（如 `C2` 约 `65.4 Hz`）基频较弱的场景做防倍频误判，并配合音高平滑与 `1500ms` 尾音保持。
- **灵活基准与移调**：支持 `A4` 基准音在 `430 Hz ~ 450 Hz` 之间微调（默认 `440 Hz`），支持整体 `-6 ~ +6` 半音移调；偏差在 `±5` 音分内即判定为准音。
- **简繁一键切换**：内置简体中文与繁体中文两套界面词条。
- **多端离线可用**：Android 原生 WebView 壳通过 `WebViewAssetLoader` 映射安全源并原生申请麦克风权限，装机后完全离线可用且自动保持屏幕常亮；网页版内置 Service Worker（`sw.js`）支持 PWA 添加到桌面离线使用。

## 支持的传统调式

| 调式 | 调高 | 七弦散音（一弦至七弦） | 常见说明 |
| :--- | :--- | :--- | :--- |
| 正调 | `1=F` | `C D F G A C D` | 最常用标准定弦 |
| 蕤宾调 | `1=B♭` | `C D F G B♭ C D` | 紧五弦 |
| 慢角调 | `1=C` | `C D E G A C D` | 慢三弦 |
| 清商调 | `1=E♭` | `C E♭ F G B♭ C E♭` | 紧二、五、七弦 |
| 慢商调 | `1=F` | `C C F G A C D` | 慢二弦（一、二弦同音） |
| 无射调 | `1=B♭` | `B♭ D F G B♭ C D` | 慢一、紧五弦 |

## 快速使用

### 1. Android 手机直接安装（推荐）

直接下载仓库根目录的 `guqin_tuner.apk` 安装到 Android 手机（要求 Android 7.0 / API 24 及以上）。打开后点击右上角「开始调音」并允许麦克风权限即可离线使用。

### 2. 电脑本地网页运行

浏览器要求在 `https://` 或 `http://localhost` 安全上下文中才能调用麦克风，请勿直接用手机文件管理器以 `file://` 方式打开。电脑端可在项目根目录启动本地静态服务：

```bash
python -m http.server 8000
# 或使用 Node.js
npx serve .
```

随后在浏览器访问 `http://localhost:8000/`（模块化版）或 `http://localhost:8000/guqin_tuner.html`（单文件便携版）。

### 3. 自行编译 Android APK

本地已安装 Android Studio / Android SDK（JDK 17 及以上）时，可使用 Android Studio 打开 `android/` 目录直接构建，或在命令行执行：

```bash
cd android
gradle assembleDebug --no-daemon
```

编译产物位于 `android/app/build/outputs/apk/debug/app-debug.apk`。项目同时提供 `.github/workflows/build-apk.yml`，推送至 GitHub 仓库后可自动在云端编译并产出 APK。

## 运行单元测试

项目使用 Node.js 内置测试运行器，零第三方运行时依赖：

```bash
npm test
```

测试覆盖六种传统调式定义、移调边界、同音弦匹配、低频 MPM 防八度误判及音高平滑逻辑。

## 目录结构

```text
guqin_tuner/
├── index.html                  # 网页模块化版入口
├── style.css                   # 宣纸墨绿国风响应式样式
├── sw.js                       # PWA 离线缓存 Service Worker
├── manifest.webmanifest        # PWA 应用清单
├── guqin_tuner.html            # 单文件便携版（HTML/CSS/JS 全内联）
├── guqin_tuner.apk             # 预编译 Android 离线安装包
├── icons/                      # 网页与 PWA 图标资源
├── src/
│   ├── app.js                  # 主界面交互与状态管理
│   ├── audio.js                # Web Audio 麦克风采集封装
│   ├── pitch.js                # MPM 低频音高检测与平滑器
│   ├── tunings.js              # 古琴六调式与频率/音分引擎
│   └── i18n.js                 # 简繁中文词条
├── tests/                      # 单元测试
├── android/                    # Android 原生 WebView 壳工程（含自适应图标）
└── .github/workflows/          # GitHub Actions 云端编译 APK 工作流
```

## 开源许可

本项目基于 [MIT License](LICENSE) 开源。
