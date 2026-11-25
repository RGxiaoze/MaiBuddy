# 舞萌DX 伴侣 · MaiBuddy

浏览器端的舞萌DX 辅助工具：**查曲、记成绩、看 B50、算推分**。
纯前端应用，无后端服务器，所有成绩与偏好都存在你自己的浏览器里（IndexedDB），不上传。

**在线使用** → https://rgxiaoze.github.io/MaiBuddy/

---

## 核心能力

**① 曲目检索**
多关键词 AND 搜索（曲名 / 曲师 / 谱师 / 社区别名），按等级、定数、版本、难度组合筛选，分页浏览。定数只在用到相关筛选时才显示，避免列表过密。

**② 谱面详情**
单谱 DX Rating 对照表；全服达成分布（SSS / SSS+ / AP 率），带同档对比与样本可信度提示；拟合定数与官标定数并列对照。

**③ 成绩管理**
手动录入、JSON 备份导入导出、落雪 CSV 双向兼容（导出可直接回流到落雪）；成绩存 IndexedDB，可整体清除。

**④ 账号接入**
落雪 OAuth 或个人 API 密钥一键导入全部成绩；水鱼支持 OAuth（需自建换票代理，见 `workers/`）与 Import-Token 两种方式。

**⑤ B50 与推分**
本地 B50 与在线查分是**两套互相独立**的数据，卡片上分别标注来源；推分建议按 B35 / B15 双池给出三档目标，并标记拟合定数的「水分」；探索推荐基于社区口碑 + 难度适配 + 不感兴趣屏蔽。

---

## 数据来源

| 用途 | 来源 | 鉴权 |
|---|---|---|
| 曲库、全服统计、在线查分、完整成绩导入 | [Diving-Fish](https://www.diving-fish.com/maimaidx/prober/) | 公开接口；导入需账号凭据 |
| 曲绘、实装日期、成绩导入 | [落雪咖啡屋 LXNS](https://maimai.lxns.net/) | OAuth 或个人 API 密钥 |
| 社区曲目别名 | [Yuzu-ChaN / maimaiDX](https://github.com/Yuri-YuzuChaN/maimaiDX) | 免鉴权 |
| 水鱼 OAuth 换票代理 | 自建 Cloudflare Worker | 见 [`workers/df-oauth-proxy.js`](workers/df-oauth-proxy.js) |

---

## 技术栈

React 19 · TypeScript 6 · Vite 8 · TailwindCSS v4 · Zustand 5 · Dexie 4（IndexedDB）· ECharts 6 · vitest

---

## 本地运行

需要 **Node 20+**。

```bash
npm install
npm run dev     # 开发服务器；/api 与 /alias-api 由 Vite 代理转发
npm test        # 416 个用例
npm run build   # 产物输出到 dist/
```

---

## 暂未开放的板块

以下功能代码已实现但**对线上关闭**，开关在 [`src/config/features.ts`](src/config/features.ts)：

- **五维能力分析**（`ENABLE_DIMENSION_ANALYSIS`）—— 算法尚未经过小规模验证
- **定数阶梯策略面板**（`ENABLE_STRATEGY_PANEL`）—— 文案与预估周期缺乏数据支撑

---

## 已知限制

- **别名搜索依赖对方跨域策略**：社区别名接口若拒绝跨域，线上会退化为「仅按曲名 / 曲师 / 谱师搜索」，界面会给出提示
- **实装年是一次性快照**：新曲缺失时按版本号推断国服年份，个别「超前实装」曲目可能有 1 年偏差
- **宴会场谱面默认隐藏**：这类谱面没有定数与难度数据，可在高级筛选里手动开启

---

## 🤝 多人协作与开发规范

本项目已启用多人协作模式。AI 助手及所有贡献者在进行代码修改前，**必须阅读并严格遵守 [CONTRIBUTING.md](./CONTRIBUTING.md)**。

特别是：禁止直接向 main 分支提交、必须新建分支、必须走 PR 流程。

---

## 许可与致谢

[MIT](LICENSE)

核心算法参考了 maimaidx-prober、maimaiDX、MaimaiData、落雪咖啡屋 等开源项目；谱面分析知识库基于 [simai-sharp-ts](https://github.com/Shikochin/simai-sharp-ts) 与 AstroDX 布局模型构建。
