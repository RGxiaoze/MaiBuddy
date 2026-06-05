# simai 谱面格式研究报告

> 数据来源检索时间：2025-06-05
> 主要来源：simai-sharp-ts（Shikochin/simai-sharp-ts，MIT）、SimaiSharp（reflektone-games/SimaiSharp，AstroDX 项目）

## 一、simai 格式概述

simai 是 maimai 谱面的文本格式，广泛用于 AstroDX 等模拟器和谱面分享社区。每个谱面文件（`.txt` 或 `.maidata`）包含：

1. **元数据头**：key=value 行（title、artist、des、level 等）
2. **谱面数据**：`&inote_N=` 标记的文本体（N 为难度编号）

## 二、谱面数据结构

### 2.1 完整谱面（MaiChart）

| 字段 | 类型 | 说明 |
|------|------|------|
| finishTiming | number\|null | 谱面结束时间（秒） |
| noteCollections | NoteCollection[] | 按时间分组的音符集合 |
| timingChanges | TimingChange[] | 变速/节拍变化事件 |

### 2.2 音符集合（NoteCollection）

代表同一时刻同时出现的若干个音符。

| 字段 | 类型 | 说明 |
|------|------|------|
| time | number | 出现时间（秒） |
| eachStyle | EachStyle | 同时音符样式（Default/ForceBroken/ForceEach） |
| notes | Note[] | 该时间点所有音符 |

### 2.3 单个音符（Note）

| 字段 | 类型 | 说明 |
|------|------|------|
| location | Location | 位置（按键编号或触摸区 A-E） |
| type | NoteType | 类型：Tap=0 / Touch=1 / Hold=2 / Slide=3 / Break=4 |
| styles | NoteStyles | 装饰标记：Ex / Fireworks / Mine（位运算） |
| appearance | NoteAppearance | 视觉外观：Default / ForceStar / ForceStarSpinning / ForceNormal |
| length | number\|null | 持续时间（Hold 音符，秒） |
| slideMorph | SlideMorph | Slide 出现方式：FadeIn / SuddenIn |
| slidePaths | SlidePath[] | Slide 路径链（可多条用 `*` 连接） |

### 2.4 音符位置（Location）

maimai 的圆形判定区域分为两组：

| NoteGroup | 索引范围 | simai 表示 | 说明 |
|-----------|:--:|------|------|
| Tap | 0-7 | `1`~`8` | 8 个环形按键 |
| ASensor | 0-7 | `A1`~`A8` | 触摸区 A |
| BSensor | 0-7 | `B1`~`B8` | 触摸区 B |
| CSensor | 0 | `C` | 触摸区 C（屏幕中央） |
| DSensor | 0-7 | `D1`~`D8` | 触摸区 D |
| ESensor | 0-7 | `E1`~`E8` | 触摸区 E |

### 2.5 Slide 路径（SlidePath）

| 字段 | 类型 | 说明 |
|------|------|------|
| type | SlideType | 12 种路径类型 |
| duration | number | 持续时间（秒） |
| delay | number | 延迟开始（秒，仅非首段） |

**12 种 Slide 路径类型：**

| SlideType | 说明 |
|-----------|------|
| StraightLine | 直线（→→→） |
| RingCw | 环形顺时针 |
| RingCcw | 环形逆时针 |
| Fold | 对折（V形） |
| CurveCw | 曲线顺时针 |
| CurveCcw | 曲线逆时针 |
| ZigZagS | Z形 S 路径 |
| ZigZagZ | Z形 Z 路径 |
| EdgeFold | 边缘对折 |
| EdgeCurveCw | 边缘曲线顺 |
| EdgeCurveCcw | 边缘曲线逆 |
| Fan | 扇形 |

### 2.6 变速/节拍（TimingChange）

| 字段 | 类型 | 说明 |
|------|------|------|
| time | number | 时间（秒） |
| tempo | number | BPM |
| subdivisions | number | 每小节拍数 |

## 三、可提取的谱面特征

从 simai 数据结构中可计算以下分析指标：

### 3.1 密度特征
- **音符密度**：每秒音符数（NoteCollections 数量 / 总时长）
- **峰值密度**：滑动窗口最大 NoteCollection 数
- **同时押比例**：含多个 Tap 音符的 NoteCollection 占比

### 3.2 配置模式特征
- **交互密集度**：连续 Tap-only 的 NoteCollection 链长度（>4 个连续为密集交互）
- **纵连判定**：相邻 NoteCollection 中同一按键/传感器位置重复出现次数
- **出张跨度**：相邻 Tap 音符之间的位置差（最大 3=对侧出张）
- **Hold 覆盖率**：Hold 音符总时长 / 谱面总时长
- **Slide 复杂度**：Slide 路径类型多样性 + 多段 Slide 比例

### 3.3 触摸区使用特征
- **Touch 占比**：Touch 类型 NoteCollection 比例
- **滑动触摸**：同一个触摸区连续出现次数
- **触摸区切换频率**：相邻触摸音符在不同传感器组之间的切换次数

### 3.4 节奏特征
- **BPM 变化次数**：变速段数
- **BPM 范围**：最小/最大 BPM
- **主要节拍**：众数 subdivisions

## 四、参考开源项目

| 项目 | 作者 | 用途 | 许可 |
|------|------|------|------|
| [simai-sharp-ts](https://github.com/Shikochin/simai-sharp-ts) | Shikochin | TypeScript simai 解析器（本文档主要来源） | MIT |
| [SimaiSharp](https://github.com/reflektone-games/SimaiSharp) | reflektone-games (AstroDX) | C# simai 解析器（原始实现） | MIT? |
| [Maichart-Converter](https://github.com/Neskol/Maichart-Converter) | Neskol | 谱面格式转换工具 | — |
| [Majdata-Online](https://github.com/LingFeng-bbben/Majdata-Online) | LingFeng-bbben | 在线谱面编辑器 | — |
| [AstroDX](https://astrodx.milkbot.cn/) | Reflektone | maimai 移动端模拟器 | — |
| [DXRating](https://dxrating.net/search) | — | 谱面数据搜索/浏览器 | — |
| [simai 格式 Wiki](https://w.atwiki.jp/simai/) | — | simai 格式日文文档 | — |

## 五、对知识库构建的启示

1. **可直接集成 simai-sharp-ts**：作为 npm 依赖，解析 simai 格式谱面文件
2. **谱面来源渠道**：AstroDX 牛奶机器人图表站提供大量社区谱面下载
3. **特征提取管线**：simai → MaiChart → NoteCollection[] → 统计特征 → 分类标签
4. **与现有体系对接**：提取的特征可作为增强版 `classifyChart` 的输入，替代当前的纯物量占比规则
