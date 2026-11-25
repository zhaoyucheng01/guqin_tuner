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
    standby: "待机 · 点右上角开始",
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
    standby: "待機 · 點右上角開始",
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
