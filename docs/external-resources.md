# 外部资源索引

> 本文档汇总舞萌DX伴侣项目依赖和参考的外部资源，包括谱面数据公开库、CDN 静态资源、第三方工具和查分器平台。
>
> API 端点详情见 [02-技术选型.md](./02-技术选型.md)。

---

## 一、谱面数据公开库

> **获取谱面文件时的第一查阅入口。**

### 1.1 Maichart-Converts

| 属性 | 内容 |
|------|------|
| **名称** | Maichart-Converts |
| **地址** | https://github.com/Neskol/Maichart-Converts |
| **说明** | 储存由 MaichartConverter 转换的 maimai Simai 谱面，按分类（POPSアニメ、東方Project、niconicoボーカロイド、ゲームバラエティ、オンゲキCHUNITHM、宴会場 等）组织目录结构，含 `index.json` 索引文件。持续更新中。 |
| **许可证** | 未指定（仓库未声明开源许可证） |
| **Stars** | 483 |
| **注意** | 谱面版权归 SEGA 及相关方所有，仅供学习研究使用 |

**获取方式：**

```bash
# 克隆完整仓库（包含所有分类的谱面文件）
git clone https://github.com/Neskol/Maichart-Converts.git

# 下载最新 Release 包
# 访问 https://github.com/Neskol/Maichart-Converts/releases
```

```bash
# 下载单个谱面文件（从 GitHub raw）
# 格式：https://raw.githubusercontent.com/Neskol/Maichart-Converts/master/{分类}/{文件名}
# 示例（PANDORA PARADOXXX Re:MASTER）：
curl -O https://raw.githubusercontent.com/Neskol/Maichart-Converts/master/maimai/834_15.txt
```

### 1.2 MaichartConverter

| 属性 | 内容 |
|------|------|
| **名称** | MaichartConverter |
| **地址** | https://github.com/Neskol/MaichartConverter |
| **说明** | maimai 谱面格式转换工具（ma2 → simai），Maichart-Converts 的上游转换器 |
| **许可证** | 待确认 |

### 1.3 MaichartConverterSimpleGUI

| 属性 | 内容 |
|------|------|
| **名称** | MaichartConverterSimpleGUI |
| **地址** | https://github.com/Neskol/MaichartConverterSimpleGUI |
| **说明** | MaichartConverter 的 GUI 前端，提供 ma2 → simai 快速转换界面（C#，2022 年后停更） |
| **许可证** | 待确认 |

---

## 二、LXNS CDN 静态资源

> maimai.lxns.net（落雪咖啡屋）托管的静态文件，可直接通过 HTTP GET 访问，无需认证。

### 2.1 谱面文件（Simai 格式）

- **URL 格式**：`https://assets2.lxns.net/maimai/chart/{song_id}.txt`
- **示例**：[`https://assets2.lxns.net/maimai/chart/834.txt`](https://assets2.lxns.net/maimai/chart/834.txt)（PANDORA PARADOXXX）
- **格式**：Simai 变体。`&` 开头为元数据行（title、artist、bpm、版本等），`&lv_N=` 标记各难度谱面（`lv_0`=Basic / `lv_1`=Advanced / `lv_2`=Expert / `lv_3`=Master / `lv_4`=Re:Master），`&base_N=` 为对应定数。谱面数据使用标准 simai 记号。
- **获取方式**：HTTP GET，无需认证
- **文件大小**：约 5–30 KB/首
- **版权**：数据版权归 SEGA 及相关方所有，仅供学习研究

### 2.2 曲绘

- **URL 格式**：`https://assets.lxns.net/maimai/jacket/{song_id}.png!webp`
- **示例**：[`https://assets.lxns.net/maimai/jacket/834.png!webp`](https://assets.lxns.net/maimai/jacket/834.png!webp)
- **格式**：WebP
- **获取方式**：HTTP GET，无需认证

### 2.3 音频

- **URL 格式**：`https://assets2.lxns.net/maimai/music/{song_id}.mp3`
- **示例**：`https://assets2.lxns.net/maimai/music/834.mp3`
- **格式**：MP3
- **获取方式**：HTTP GET，无需认证

---

## 三、第三方工具与网站

### 3.1 v.awmc.cc — 舞萌谱面预览

| 属性 | 内容 |
|------|------|
| **地址** | https://v.awmc.cc |
| **说明** | 在线 Simai 谱面预览/播放器。技术栈 React 19 + Mantine UI + Vite，支持速度调节、镜像、判定线显示切换、音频偏移等设置。三步操作流程：搜索曲目 → 选择难度 → 预览播放。 |
| **作者** | P1Meng（GitHub 账号已不存在） |
| **托管** | AWMC TEAM Hosting |
| **数据来源** | maimai.lxns.net API + assets2.lxns.net CDN |
| **许可证** | 源码未公开 |
| **获取方式** | 浏览器直接访问 |

### 3.2 dxrating

| 属性 | 内容 |
|------|------|
| **地址** | https://dxrating.net / https://github.com/gekichumai/dxrating |
| **说明** | maimai DX Rating 相关工具，支持日服/国际服数据导入和 Best 50 生成（114⭐） |
| **许可证** | 待确认 |
| **获取方式** | 浏览器访问 https://dxrating.net，或 `git clone https://github.com/gekichumai/dxrating.git` |

### 3.3 astrodx.milkbot.cn ⚠️ 已终止

| 属性 | 内容 |
|------|------|
| ~~地址~~ | ~~https://astrodx.milkbot.cn~~ |
| **状态** | **已于 2026/06/06 正式终止运行**（运营 29 个月，累计下载 1,745,547 次） |
| **访问限制** | 当前仅显示关站告别页，不再提供谱面搜索/下载 |
| **替代方案** | 直接使用 [Maichart-Converts](#11-maichart-converts) GitHub 仓库或 Release 包 |

---

## 四、查分器平台入口

> API 端点细节见 [02-技术选型.md](./02-技术选型.md)，此处仅列平台入口和基本说明。

### 4.1 落雪咖啡屋 (LXNS)

| 属性 | 内容 |
|------|------|
| **名称** | 落雪咖啡屋 maimai DX 查分器 |
| **地址** | https://maimai.lxns.net |
| **运营方** | Lxns Network |
| **支持游戏** | 舞萌 DX、中二节奏 |
| **核心功能** | 成绩同步（HTTP 代理上传）、成绩管理、历史查询（B40/B50/DX Rating 趋势）、曲目别名投票、开发者 API |
| **API 基础 URL** | `https://maimai.lxns.net/api/v0/` |

### 4.2 水鱼查分器 (Diving-Fish)

| 属性 | 内容 |
|------|------|
| **名称** | Diving-Fish 舞萌 DX 查分器 |
| **地址** | https://maimai.diving-fish.com |
| **仓库** | https://github.com/Diving-Fish/maimaidx-prober（1004⭐） |
| **API 基础 URL** | `https://www.diving-fish.com/api/maimaidxprober` |
| **API 文档** | https://maimai.diving-fish.com/manual/docs/developer/zh-api-document |

---

## 五、社区生态项目（参考）

以下为落雪咖啡屋页面列出的第三方工具，供参考：

| 名称 | 类型 | 说明 |
|------|------|------|
| 软糖酱 @LxBot | QQ 机器人 | 查询 maimai DX 查分器数据 |
| 秋葉 @AkihaBot | Telegram 机器人 | 支持多种音游数据查询 |
| Mizuki Bot | QQ 机器人 | 整合落雪 + 水鱼查分器 |
| MaiProberPlus | Android 应用 | 基于 VPN 的分数上传器 |
| Salt | Discord 机器人 | 支持生成成绩图 |
| Reisasol | QQ 机器人 | 通用 Best 50 查分器 |
| Sakiko | QQ 机器人 | 国服中二节奏查分 |
