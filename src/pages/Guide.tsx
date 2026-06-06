// ============================================================
// Guide page — usage instructions for the companion app
// ============================================================

import {
  Search,
  BarChart4,
  Music,
  TrendingUp,
  Radar,
  BookOpen,
  Heart,
} from 'lucide-react'

const Section = ({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) => (
  <section className="bg-white rounded-xl shadow-sm p-6">
    <h2 className="flex items-center gap-3 text-lg font-semibold text-text mb-4">
      <span className="text-primary">{icon}</span>
      {title}
    </h2>
    {children}
  </section>
)

export default function Guide() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <BookOpen className="w-7 h-7 text-primary" />
        <h1 className="text-2xl font-bold text-text">使用指南</h1>
      </div>

      {/* Quick Start */}
      <Section icon={<Search size={20} />} title="快速开始">
        <div className="space-y-3 text-sm text-text-secondary leading-relaxed">
          <p>
            <strong className="text-text">舞萌DX 伴侣</strong>是一个面向舞萌 DX 玩家的数据辅助工具，帮助你追踪成绩、分析能力、规划上分路线。
          </p>
          <div className="space-y-2">
            <p className="font-medium text-text">基本流程：</p>
            <ol className="list-decimal list-inside space-y-1.5 ml-1">
              <li><strong>曲目检索</strong> — 搜索曲目，支持多关键词、定数范围、版本、难度筛选。</li>
              <li><strong>录入成绩</strong> — 曲目详情页选择难度后点击「录入成绩」，填写达成率、DX 分数等。</li>
              <li><strong>一键导入</strong> — 点击「导入成绩」使用 Diving-Fish 凭证拉取全部成绩。</li>
            </ol>
          </div>
          <p className="text-text-tertiary text-xs">所有数据存储在你的浏览器本地（IndexedDB），不会上传到任何第三方服务器。</p>
        </div>
      </Section>

      {/* B50 & Rating */}
      <Section icon={<BarChart4 size={20} />} title="B50 与 Rating">
        <div className="space-y-3 text-sm text-text-secondary leading-relaxed">
          <p>
            <strong className="text-text">B50</strong> 由历史最佳 <strong>35 首旧版本曲目</strong>和<strong>15 首新版本曲目</strong>的最高 Rating 之和构成。
          </p>
          <div className="space-y-2">
            <p className="font-medium text-text">两种查分方式：</p>
            <ul className="list-disc list-inside space-y-1.5 ml-1">
              <li><strong>在线查分</strong> — 输入 Diving-Fish 用户名拉取 B50 数据和总 Rating。</li>
              <li><strong>本地 B50</strong> — 基于录入/导入的成绩在本地计算 B50 和总 Rating。</li>
            </ul>
          </div>
          <p>Rating 计算基于谱面定数 × 等级系数 × 达成率，不同达成率区间采用不同的等级系数。</p>
        </div>
      </Section>

      {/* 达成分布 */}
      <Section icon={<Music size={20} />} title="达成率分布对比">
        <div className="space-y-3 text-sm text-text-secondary leading-relaxed">
          <p>曲目详情页每个难度卡片中可查看<strong className="text-text">三行对比数据</strong>：</p>
          <div className="bg-surface-light rounded-lg p-4 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="shrink-0 w-3 h-3 rounded bg-red-400" />
              <span><strong>vs 官标等级</strong> — 与相同难度等级（如 14+）的 SSS/SSS+/AP 率均值对比</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="shrink-0 w-3 h-3 rounded bg-accent" />
              <span><strong>vs 官标定数</strong> — 与相同官方定数（如 14.7）的均值对比</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="shrink-0 w-3 h-3 rounded bg-green-400" />
              <span><strong>vs 拟合定数</strong> — 与社区拟合定数（如 14.9）相近谱面的均值对比</span>
            </div>
          </div>
          <p>
            颜色含义：<span className="text-green-600 font-medium">绿色</span> = 该谱面达成率高于同类均值，
            <span className="text-red-500 font-medium">红色</span> = 低于同类均值，灰色 = 差距不大。
          </p>
          <p className="text-text-tertiary text-xs">数据来源：Diving-Fish 社区统计，每日更新。</p>
        </div>
      </Section>

      {/* Push Suggestions */}
      <Section icon={<TrendingUp size={20} />} title="推分建议">
        <div className="space-y-3 text-sm text-text-secondary leading-relaxed">
          <p>帮助玩家找到当前最值得投入练习的谱面——花最少精力换取最大 Rating 提升。</p>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li>基于 B50 地板替换逻辑的增益计算</li>
            <li>按众数区间过滤 + SSS+ 率加权排序</li>
            <li>3 档目标方案：SS+ 99% / SSS 100% / SSS+ 100.5%</li>
            <li>策略分段（冲击万四 → 冲击万六 → 冲击理论 Rating）</li>
            <li>手机端卡片式布局，三档增益横向排列</li>
          </ul>
        </div>
      </Section>

      {/* 五维分析 */}
      <Section icon={<Radar size={20} />} title="五维分析">
        <div className="space-y-3 text-sm text-text-secondary leading-relaxed">
          <p>从<span className="font-medium text-text">底力/体力/爆发/定位/技巧</span>五个维度，基于手臂位移量客观评估谱面表现。</p>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li><strong>底力</strong>：贯穿全程的基本功——让你在交互、双押、扫键等基础配置中游刃有余</li>
            <li><strong>体力</strong>：长时间高密度不掉速的耐力——扛住消耗、稳扎稳打出成绩</li>
            <li><strong>爆发</strong>：处理瞬时高密度的能力——从容面对超高速配置</li>
            <li><strong>定位</strong>：手臂移动中准确击中判定——应对变换位置的配置</li>
            <li><strong>技巧</strong>：利用协调与记忆力处理星星和 Touch 等非常规配置</li>
          </ul>
          <p className="text-text-tertiary text-xs">
            五维算法基于 simai 谱面数据的逐帧位移分析，结合机台布局几何（按钮正八边形 + 触摸区偏移），
            从"物量统计"升级为"手臂运动量评估"。
          </p>
        </div>
      </Section>

      {/* 致谢 */}
      <Section icon={<Heart size={20} />} title="致谢与参考">
        <div className="space-y-3 text-sm text-text-secondary leading-relaxed">
          <div className="space-y-2">
            <p className="font-medium text-text">数据来源</p>
            <ul className="list-disc list-inside space-y-1 ml-1">
              <li><strong>Diving-Fish API</strong> — 曲目元数据、全服统计、玩家成绩查询（maimaidx-prober）</li>
              <li><strong>Yuzu-ChaN 社区别名</strong> — maimaiDX 社区别名数据库</li>
            </ul>
          </div>
          <div className="space-y-2">
            <p className="font-medium text-text">参考项目</p>
            <ul className="list-disc list-inside space-y-1 ml-1">
              <li>maimaidx-prober (Diving-Fish) — Rating/B50 核心算法</li>
              <li>maimaiDX (Yuri-YuzuChaN) — API 封装与数据处理</li>
              <li>MaimaiData (PaperPig) — 版本判定与本地存储</li>
              <li>落雪咖啡屋 (Lxns-Network) — 类型枚举体系</li>
            </ul>
          </div>
          <div className="space-y-2">
            <p className="font-medium text-text">算法参考</p>
            <ul className="list-disc list-inside space-y-1 ml-1">
              <li>RemyWiki — Rating/B50 算法公式</li>
              <li>beatmania IIDX 非公式難易度表 — 底力/体力/爆发三层区分</li>
              <li>SOUND VOLTEX Effect Radar — 多维雷达图可视化</li>
            </ul>
          </div>
          <p className="text-text-tertiary text-xs">
            舞萌 / maimai DX 为 SEGA 商标。本项目为非官方社区工具，与 SEGA 无关。
            封面图版权归 SEGA 所有。全服统计数据由 Diving-Fish 社区汇总。
          </p>
        </div>
      </Section>
    </div>
  )
}
