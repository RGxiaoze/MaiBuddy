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
- **音符密度**：有效音符数 ÷ 时间。与拍号（{4}/{8}/{16}/{32}等）**解耦**——{96} 下只有 5 个音符则密度仍是 5/拍
- **峰值密度**：滑动窗口内最大有效音符数
- **同时押比例**：含多个音符的 NoteCollection 占比

### 星星 `[a:b]` 时值公式

**与 Hold 不同**——星星使用独立公式（来源：simai-sharp-ts SlideReader.ts）：

```
星星时长(秒) = (bar_seconds / (a/4)) × b
```

其中 `bar_seconds` = 60/BPM × 4。

| 格式 | 含义 | 封焔例（BPM200, bar=1.2s） | Schwarzschild例（BPM188, bar=1.28s） |
|------|------|------|------|
| `[8:1]` | (bar/2)×1 | 0.6s | 0.64s |
| `[4:3]` | (bar/1)×3 | 3.6s | 3.83s |
| `[32:85]` | (bar/8)×85 | 12.75s | — |
| `[4:11]` | (bar/1)×11 | 13.2s | — |
| `[16:5]` | (bar/4)×5 | 1.5s | 1.6s |
| `[d##a:b]` | 延迟 d 秒+持续 | `[0.1613##0.1613]` | — |
| `[a]`无冒号 | a 直接为秒数 | — | — |

### 拍数命名公式（社区约定）

**拍号 ÷ 音符间逗号数 = 社区分**。0 逗号（紧接）时社区分 = 拍号本身。
多逗号空拍（如 5 逗号）**不构成独立的配置拍数**——对应段内原本的按键被换成了空拍，或为前后段的间隔。

| 判例 | 拍号 | 逗号 | 公式 | 社区分 | 等效 16 分 BPM | 来源谱面 |
|------|:--:|:--:|------|:--:|:--:|------|
| `1b,,5` | 48 | 2 | 48÷2 | **24** | 300 | 封焔 |
| `1x/5x,,,,1/5` | 48 | 4 | 48÷4 | **12** | 150 | 封焔 |
| `6,,,5` | 48 | 3 | 48÷3 | **16** | 188 | Schwarzschild |
| `5,,4` | 48 | 2 | 48÷2 | **24** | 282 | Schwarzschild |
| `4/7,,8` | 24 | 2 | 24÷2 | **12** | 141 | Schwarzschild |
| `2x,,2x,,2x` | 24 | 2 | 24÷2 | **12** | 115 | Sqlupp |
| `2x,3x,4x,5x` | 32 | 0 | 32 | **32** | 308 | Sqlupp |
| `1,8,1,8,1,8` | 32 | 0 | 32 | **32** | 308 | Sqlupp |

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

### 真实时间戳转换

```
BPM 固定：时间(秒) = (小节号 − 1) × 60/BPM × 4
BPM 变化：逐小节累加，每个小节时长 = 60/当前BPM × 4
```

例：BPM 188，小节 10 → (10−1) × 60/188 × 4 ≈ 11.5 秒 ≈ **0:11.5**。

### 谱面难度命名约定

SD 筐体（maimai FiNALE）：`inote_2`=Basic → `inote_3`=Advanced → `inote_4`=Expert → `inote_5`=Master → `inote_6`=Re:Master。
DX 筐体：`inote_2`=Advanced → `inote_3`=Expert → `inote_4`=Master → `inote_5`=Re:Master。

1. **可直接集成 simai-sharp-ts**：作为 npm 依赖，解析 simai 格式谱面文件
2. **谱面来源渠道**：AstroDX 牛奶机器人图表站提供大量社区谱面下载
3. **特征提取管线**：simai → MaiChart → NoteCollection[] → 统计特征 → 分类标签
4. **与现有体系对接**：提取的特征可作为增强版 `classifyChart` 的输入，替代当前的纯物量占比规则

---

## 六、社区术语词典

### 打法术语

| 术语 | 含义 |
|------|------|
| **正攻** | 按谱面默认方式处理（如一只手包圆一组扫键），不用简化打法 |
| **分页** | 左手管左半边(8-5)、右手管右半边(1-4)，各自扫各自的区域 |
| **出张** | 手跨越到另一侧屏幕去按键（如右手去按 7 号键） |
| **邪道** | 利用判定机制用非默认方式省力处理（如搓 Slide、双指替单手） |

### 配置术语

| 术语 | 定义 | 判例 |
|------|------|------|
| **星星** | 所有 Slide 音符统称 | `1-5[8:1]`, `3<8[4:1]` |
| **星星头** | Slide 起点的 Tap 部分，判定比身体严格 | — |
| **单双** | 单→双押→单→双押 交替 | `4/6,5,3/4,3` |
| **二纵** | 同一键位快速双击，每两个一组 | `1,8,1,8,1,8` 中 `1,8` 各是一组二纵 |
| **纵连** | 二纵的泛化，同一键位连续 3+ 次点击 | `2x,,2x,,2x`（12 分纵连） |
| **交互** | 双手交替击打不同键位 | 封焔 1b↔5b（24 分交互） |
| **位移交互** | 交互中组间需位移到下一组起点 | Schwarzschild 3↔4 四组交互 |
| **转圈交互** | 双手保持不舒服距离绕圈交互 | Schwarzschild 0:40 段 |
| **扫键** | 3 键及以上连续单向位移 | `1,2,3,4`、`8,7,6,5` |
| **圈** | 遍历 7+ 键位、覆盖半周以上的扫键 | `2,3,4,5,6,7,8,1,2` |
| **折返扫键** | 下行→原路上行的扫键，另一只手常被占用 | `4x,3x,2x,1x`→`5x,6x,7x,8x` |
| **1+2 / 2+1** | 一只手点 1 次另一只手点 2 次 | `6h,5,5`（12 分 1+2） |

### 星星术语

| 术语 | simai | 说明 |
|------|------|------|
| **直星星** | `-` | 直线型 |
| **方向星星** | `<` `>` | 顺时针/逆时针弧线 |
| **V 折星星** | `v` `V` | V 形折叠，方向变化一次 |
| **绕圈星星** | `p` | 中途绕小圈再滑到尾巴 |
| **QQ 星星** | `qq` | 快速曲线 |
| **S/Z 星星** | `s` `z` | S/Z 形路径 |
| **PP 星星** | `pp` | 特殊组合 |
| **W 星星** | `w` | 变形模式 |
| **双押星星** | `1-5/8-4` | 仅头部同时判定，身体路径和时长可自由设计 |
| **平行星星** | `*-` | 同头同尾同时长，视觉加粗，双押级分数 |
| **折线星星** | `*q` | 折返后接曲线 |

### 特殊标记

| 术语 | 说明 |
|------|------|
| **绝赞结尾** | 交互/扫键末尾紧跟 Break 单音→降低容错 |
| **0 预警爆发** | 无任何速度过渡直接从低速跳高速的配置 |
| **烟花 (C1f)** | C1 区烟花 Touch，视觉遮挡后续约 0.5s |
| **保护套** | Ex tap 全程覆盖的段，技巧权重极低 |
| **对称设计** | 谱面前后乐句配置对称；对称越少→记忆力要求越高 |
