节拍叠加器 · 项目文档

一、项目简介

一套纯前端（HTML + Web Audio API）的节拍检测与音效叠加工具：用户上传一段音乐，程序扫描短时能量找出节拍点，再把一段内置的"叮"声（Base64 编码的 MP3）叠加到每个节拍上，最后可播放或导出 WAV。

技术栈：原生 HTML/CSS/JS，Web Audio API（AudioContext、decodeAudioData、AudioBuffer、AudioBufferSourceNode），手写 WAV 编码器。无构建，双击即可运行。

7 个文件记录了一条清晰的演进：从"内置音效硬编码"到"内置音效失败可降级"，从"检测即用"到"节拍可手工增删 + 音量音调可调"。

---

二、文件总览

文件 阶段 核心变化
节拍叠加器（冰冰冰）.html 基线 深色 UI；Base64 直接 atob；节拍检测 + 混音 + WAV 导出 + 假 MP3 导出
(1).html 健壮化 atob 前 .replace(/\s/g,'')；Base64 解码失败降级为程序化 click 音效；加 usingFallback 标记
(2).html 换肤 极简白底 UI；逻辑同 (1)
(3).html 微调 与 (2) 几乎相同（反复保存）
(4).html 微调 与 (2)(3) 几乎相同
(5).html 大升级 节拍可增删、音效设置面板（原曲/节拍音量、音调、灵敏度）、变调用 playbackRate + 线性插值
(6).html 压缩 逻辑同 (5)，HTML 空白压缩成一行

主线：(0) → (1) → (5)。(2)(3)(4) 是 UI 换肤后的反复保存，无逻辑差异；(6) 是 (5) 的 minify 版。

阅读建议：只看 (0)（理解基线）、(1)（理解降级）、(5)（理解最终形态）。

---

三、核心机制

3.1 内置音效：Base64 → Blob → AudioBuffer

内置的"叮"声以 Base64 字符串硬编码在源码里，运行时解码成可播放的 AudioBuffer。三步链路：

```js
// 1. Base64 → Blob（注意：必须先去掉换行）
function base64ToBlob(base64, mime = 'audio/mpeg') {
  const cleaned = base64.replace(/\s/g, '');   // ← (1) 起的关键修复
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

// 2. Blob → AudioBuffer
const arrayBuffer = await builtinAudioBlob.arrayBuffer();
builtinAudioBuffer = await ctx.decodeAudioData(arrayBuffer);
```

为什么必须 .replace(/\s/g,'')：Base64 字符串在源码里按 76 字符折行（这是 MIME 规范），atob() 遇到换行会抛 InvalidCharacterError。基线 (0) 直接 atob(BUILTIN_BASE64) 在带换行的数据上会失败，(1) 起修复。

为什么需要降级方案：即使 Base64 合法，decodeAudioData 也可能失败——某些浏览器对特定 MP3 编码（如某些 LAME 版本、低采样率）支持不全。(1) 起加了程序化生成的点击音效作为兜底：

```js
function createFallbackClickBuffer(ctx) {
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * 0.06);   // 60ms
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const env = Math.exp(-t / 0.02);              // 指数衰减包络
    data[i] = Math.sin(2 * Math.PI * 1500 * t) * env * 0.8;  // 1500Hz 正弦
  }
  return buffer;
}
```

这个 fallback 是"保证功能可用"的典型做法：优雅降级的不是体验，而是"至少能响"。

3.2 节拍检测：短时能量 + 局部阈值 + 峰值

核心思路是经典的能量法（不依赖 FFT，计算量小）：

Step 1 · 分帧算能量

以 10ms 为窗口、5ms 为 hop，逐帧算均方能量：

```js
const windowSize = Math.floor(sampleRate * 0.01);   // 10ms
const hopSize = Math.floor(windowSize / 2);         // 5ms
const energy = [];
for (let i = 0; i < len - windowSize; i += hopSize) {
  let sum = 0;
  for (let j = 0; j < windowSize; j++) sum += data[i+j] * data[i+j];
  energy.push(sum / windowSize);
}
```

Step 2 · 动态阈值

不用全局阈值（整首歌响度不同，固定阈值要么漏检要么误检），改用局部滑动平均 × 系数：

```js
const windowAvgSize = 20;   // 前后各 20 帧（约 100ms）
const thresholdMultiplier = 1.4;
const avg = 局部窗口内的 energy 均值;
const localThreshold = avg * thresholdMultiplier;
```

Step 3 · 峰值判定

当前帧能量 > 局部阈值，且大于前后邻居，才算一个峰：

```js
if (energy[i] > localThreshold &&
    energy[i] > energy[i-1] &&
    energy[i] > energy[i+1]) {
  const time = (i * hopSize) / sampleRate;
  // Step 4 · 最小间隔去重（防连击）
  if (peaks.length === 0 || time - peaks[peaks.length-1] >= 0.18) {
    peaks.push(time);
  }
}
```

参数 默认值 含义 调大 调小
threshold 1.4 局部均值的倍数 检测更少、更"重"的节拍 检测更多、含弱拍
minInterval 0.18s 两拍最小间隔 防止密集连击 允许更快的节奏
windowSize 10ms 能量窗口 平滑但丢瞬态 灵敏但噪声敏感

这套参数对"鼓点清晰"的流行乐效果好，对古典乐/人声为主的曲子容易误检。(5) 起把 threshold 做成可调滑杆（1.0–2.5），让用户自己试。

3.3 混音：叠加 + 软限幅

把内置音效按节拍时间点叠加到原曲上，逐声道相加：

```js
for (const beatTime of beatTimes) {
  const startSample = Math.floor(beatTime * sampleRate);
  const copyLength = Math.min(builtinLength, length - startSample);
  if (copyLength <= 0) continue;

  for (let ch = 0; ch < numChannels; ch++) {
    const mixedData = mixedBuffer.getChannelData(ch);
    for (let i = 0; i < copyLength; i++) {
      mixedData[startSample + i] += builtinData[i] * gain;
    }
  }
}
```

叠加后可能超过 [-1, 1]（数字音频的上限），不做处理会削波成方波（刺耳的"炸音"）。解法是软限幅（直接钳制）：

```js
for (let ch = 0; ch < numChannels; ch++) {
  const data = mixedBuffer.getChannelData(ch);
  for (let i = 0; i < data.length; i++) {
    if (data[i] > 1) data[i] = 1;
    else if (data[i] < -1) data[i] = -1;
  }
}
```

更专业的做法是 tanh 软削波或前瞻限幅器，但直接钳制在"叠加少量短音效"场景下够用，不会听出明显失真。

增益参数：(0)–(4) 里 gain = 0.85 硬编码；(5) 起拆成"原曲音量"和"节拍音量"两个独立滑杆（0–200% / 0–300%）。

3.4 WAV 编码：手写 RIFF 头

浏览器没有内置的 WAV 编码器，需要手动构造 44 字节 RIFF 头 + PCM 采样数据：

```js
// RIFF 头结构（小端序）
writeString(view, 0,  'RIFF');
view.setUint32(4,  totalSize - 8, true);       // 文件总长 - 8
writeString(view, 8,  'WAVE');
writeString(view, 12, 'fmt ');
view.setUint32(16, 16, true);                  // fmt chunk 长度
view.setUint16(20, 1, true);                   // PCM = 1
view.setUint16(22, numChannels, true);
view.setUint32(24, sampleRate, true);
view.setUint32(28, sampleRate * blockAlign, true);  // 字节率
view.setUint16(32, blockAlign, true);
view.setUint16(34, 16, true);                  // 位深
writeString(view, 36, 'data');
view.setUint32(40, dataSize, true);
```

采样值从 Float32（-1.0 ~ 1.0）转 Int16（-32768 ~ 32767）：

```js
const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
view.setInt16(offset, intSample, true);
```

注意 sample * 0x8000（负数）和 sample * 0x7FFF（正数）不对称，这是 Int16 的取值范围决定的（负数多一个值）。写成对称会导致正半周削顶。

3.5 变调（(5) 新增）：playbackRate + 线性插值

(5) 加了"低沉/标准/明亮/高亢"四档音调。做法不是用音高偏移（那需要相位声码器），而是改播放速率——播放速率变快，音调自然升高：

```js
const step = playbackRate;   // 0.5 / 1.0 / 1.5 / 2.0
const outLength = Math.floor(beatLength / step);   // 时长 = 原长 / 速率

for (let i = 0; i < outLength; i++) {
  const srcIdx = i * step;
  const idx0 = Math.floor(srcIdx);
  const idx1 = Math.min(idx0 + 1, beatLength - 1);
  const frac = srcIdx - idx0;
  const sample = beatData[idx0] * (1 - frac) + beatData[idx1] * frac;
  dst[startSample + i] += sample * beatVol;
}
```

关键点：

· outLength 要除以 step，否则播放速率 2.0 时会越界读源数据
· 线性插值是因为 srcIdx 通常是小数，取最近邻会有明显量化噪声
· 降级音效（程序化 click）不用 playbackRate，而是直接在 createFallbackClickBuffer 里改频率——因为正弦波重采样和改频率效果一样，但前者多一次计算

playbackRate 变调的副作用是音效时长跟着变：低沉档（0.5×）会响 120ms，高亢档（2.0×）只响 30ms。这是"物理正确"的（就像磁带快放），不是 bug。

3.6 假 MP3 导出

工具栏有"导出 MP3 (模拟)"按钮，点下去生成的是 .txt 文件，内容是说明文字。原因很简单：浏览器没有内置 MP3 编码器（MP3 有专利，虽然已过期但主流浏览器仍未集成）。

```js
const msg = `本应导出 MP3 文件（混合音频，时长 ${mixedAudioBuffer.duration.toFixed(2)} 秒...`
          + `因浏览器无内置 MP3 编码器，此文件为占位说明。`;
```

要真导出 MP3 需要引入 lamejs 或 @breezystack/lamejs 这样的纯 JS 编码器（约 200KB），或用 WebCodecs 的 AudioEncoder（新 API，兼容性有限）。项目选择了"不引依赖，诚实告知"。

---

四、技术要点汇总

· Base64 折行是必修坑：atob 前必须 replace(/\s/g,'')，这是所有内嵌 Base64 资源的通用规则。
· decodeAudioData 可能失败：即使数据合法，浏览器对某些编码的支持也有差异，必须有降级方案。
· AudioContext 需要用户手势解锁：new AudioContext() 初始是 suspended，必须在用户交互（点击上传）后 await ctx.resume()。
· AudioBuffer 不可变：混音必须 ctx.createBuffer() 新建再 set() 复制，不能原地改。
· 软限幅不是可选项：叠加后必有削波风险，直接钳制是最低成本的保底。
· WAV 头是小端序：setUint32(offset, value, true) 的第三个参数 true 必须写，否则生成的文件播放器认不出来。
· 变调用 playbackRate 最省事：音高偏移（pitch shift）需要相位声码器，复杂度高一个量级。
· source.onended 是唯一的结束信号：AudioBufferSourceNode 播完会自动触发，用它重置 isPlaying 和按钮文案。

---

五、目录结构建议

若整理成项目：

```
beat-overlay/
├── index.html              # (5).html 重命名（推荐版）
├── css/
│   └── app.css             # 从内联抽出
├── js/
│   ├── audio/
│   │   ├── decode.js       # base64ToBlob + decodeAudioData + fallback
│   │   ├── detect.js       # detectBeats 能量法
│   │   ├── mix.js          # mixBeatsIntoAudio + 软限幅
│   │   ├── resample.js     # playbackRate 线性插值（(5) 起）
│   │   └── wav.js          # audioBufferToWav
│   └── app.js              # UI 绑定 + 状态机
├── assets/
│   └── click.mp3.base64    # 内置音效 Base64
└── legacy/                 # 演进留档
    ├── v0-baseline.html    # 节拍叠加器（冰冰冰）.html
    ├── v1-fallback.html    # (1).html
    └── v5-editable.html    # (5).html
```

当前单文件形态适合分发，上述结构适合二次开发。

---

六、使用说明

运行

双击任意 HTML 即可。无需服务器——所有音频处理都在本地完成。

首次上手

1. 上传一段有清晰鼓点的音乐（流行/电子/摇滚效果最好）
2. 等待"处理完成"（解码 + 检测 + 混音，通常 1–3 秒）
3. 看"检测到的节拍"列表——如果节拍位置不对，(5) 起可手动删除/添加
4. 点"播放混合音频"试听
5. 满意后点"导出 WAV"下载

环境要求

· 现代浏览器（Chrome / Edge / Safari / Firefox）
· 需支持 Web Audio API（几乎所有现代浏览器都有）
· (5) 的音效设置面板需要 input[type=range] 的正常渲染（旧 Safari 可能样式异常）

---

七、已知注意事项

1. atob 遇换行会崩：(0) 基线直接 atob(BUILTIN_BASE64)，如果 Base64 字符串里有换行（通常有），会抛 InvalidCharacterError。(1) 起加了 .replace(/\s/g,'') 修复。抄代码时别抄 (0) 的 base64ToBlob。
2. 内置 MP3 可能解码失败：不是所有浏览器都支持同一套 MP3 编码。(1) 起加了 createFallbackClickBuffer 兜底——Base64 解码失败或 decodeAudioData 失败时，用程序化生成的正弦波代替。(0) 没有这个兜底，失败就整个流程中断。
3. AudioContext 初始是 suspended：new AudioContext() 后状态是 suspended，必须 await ctx.resume() 才能出声。项目在 handleAudioFile 里做了，但如果你重构代码，别漏了这步——漏了会导致"解码成功但播放没声"。
4. 节拍检测参数是手调的：threshold=1.4、minInterval=0.18 这两个值是作者在特定音乐上试出来的。换一批风格差异大的音频（古典、人声、环境音），检测效果会明显变差。(5) 把 threshold 做成滑杆就是为了让用户自己试。
5. "导出 MP3"是假的：按钮生成的是 .txt 文件，内容是说明文字。别以为下载下来的是真 MP3——浏览器没有内置 MP3 编码器，要真导出需要引入 lamejs（约 200KB 依赖）。
6. 变调会改变音效时长：(5) 的音调档用 playbackRate 实现，低沉档（0.5×）音效响 120ms，高亢档（2.0×）只响 30ms。这是物理正确的，但和"只改音高、时长不变"的直觉不符——后者需要相位声码器，复杂得多。
7. (2)(3)(4) 是重复文件：逻辑和 (1) 完全一样，只是 UI 换肤后的反复保存。(6) 是 (5) 的 minify 版，逻辑相同。选代表文件读即可，别浪费时间逐字对比。
8. decodeAudioData 是异步的：它返回 Promise，必须 await。如果写成同步调用（const buf = ctx.decodeAudioData(ab)），拿到的是 Promise 而非 AudioBuffer，后续 getChannelData 会报错。

---

八、快速选择指南

你想… 用这个文件
直接能用的最终版 (5).html
理解基线逻辑（最简） 节拍叠加器（冰冰冰）.html
学 Base64 解码的坑与降级 (1).html
学节拍检测的完整实现 (1).html 的 detectBeats
学 WAV 手写编码 任意版本，audioBufferToWav
学变调（playbackRate + 插值） (5).html 的 remixAudio
学可编辑节拍（增删 UI） (5).html 的 beatListDiv 事件委托
看 minify 版 (6).html（不建议读，逻辑同 (5)）

---

九、结语

这 7 个文件的核心演进只有两个关键节点：(1) 的健壮化（Base64 折行 + 降级兜底）和 (5) 的可编辑化（节拍增删 + 音量音调可调）。中间 (2)(3)(4) 是换肤后的反复保存，(6) 是 minify，没有新知识。

若只能读两份：(1).html（理解 Base64/降级的坑）+ (5).html（理解最终形态），覆盖了 90% 的知识点。

(0) 基线价值在于"看到问题原始状态"——不带 .replace 的 atob 就是最经典的坑，读它比读修复版更能记住教训。