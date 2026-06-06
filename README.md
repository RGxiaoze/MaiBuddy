# 舞萌DX 伴侣 (MaiBuddy)

浏览器端舞萌DX辅助工具，支持曲目检索、成绩管理、B50 分析、推分建议和五维能力评估。

## 已完成功能

- **曲目检索** — 多关键词搜索、别名搜索、定数/版本/难度筛选、分页浏览
- **谱面详情** — DX Rating 对照表、全服达成率对比（SSS/SSS+/AP 率 + 同级/拟合定数）
- **成绩管理** — 手动录入、批量导入、IndexedDB 本地存储
- **玩家信息** — Diving-Fish 在线查分、本地 B50 计算、B15 空位提醒
- **推分建议** — 三档目标（SS+/SSS/SSS+）、水分曲优先、配置标签（底力/爆发/技巧/综合）
- **定数阶梯策略** — 10 段数据驱动建议（基于 Rating 公式反推 B50 均分）
- **使用指南 / 更新记录** — 完整中英文档

## 🚧 开发中

- **五维分析（位移驱动）** — 基于 simai 谱面数据的逐帧位移分析，替代原有物量统计算法
  - 底力/体力/爆发/技巧/定位 五维评分管线已搭建
  - 配置识别模块（交互/扫键/圈/二纵等 9 种）已完成
  - 归一化参数待 15 级谱面校准
- **AP +1 Rating** — 公式层已就绪（`computeRating` 支持 fcType），推分建议 AP 列待接入
- **推分路线规划** — 7 阶段官方等级标签，理论值调侃提示、新手鼓励

## 数据来源与致谢

本项目依赖 [Diving-Fish API](https://www.diving-fish.com/maimaidx/prober/)、[Yuzu-ChaN 社区别名](https://github.com/Yuri-YuzuChaN/maimaiDX) 等社区免费服务。

核心算法参考了 maimaidx-prober、maimaiDX、MaimaiData、落雪咖啡屋 等开源项目。谱面分析知识库基于 [simai-sharp-ts](https://github.com/Shikochin/simai-sharp-ts) 和 AstroDX 布局模型构建。

## 技术栈

React 19 + TypeScript + Vite + TailwindCSS v4 + Zustand + Dexie.js + ECharts + simai-sharp

## 开发

```bash
npm install
npm run dev
npm run build
npm test
```

## 许可

[MIT](LICENSE)
