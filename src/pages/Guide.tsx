// ============================================================
// Guide page — usage instructions for the companion app
// ============================================================

import {
  Search,
  Music,
  BarChart4,
  TrendingUp,
  Radar,
  BookOpen,
  Info,
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
      {/* Page header */}
      <div className="flex items-center gap-3 mb-8">
        <BookOpen className="w-7 h-7 text-primary" />
        <h1 className="text-2xl font-bold text-text">使用指南</h1>
      </div>

      {/* 1. Quick Start */}
      <Section icon={<Search size={20} />} title="快速开始">
        <div className="space-y-3 text-sm text-text-secondary leading-relaxed">
          <p>
            <strong className="text-text">舞萌DX 伴侣</strong>{' '}
            是一个面向舞萌 DX 玩家的数据辅助工具，帮助你追踪成绩、分析能力、规划上分路线。
          </p>
          <div className="space-y-2">
            <p className="font-medium text-text">基本流程：</p>
            <ol className="list-decimal list-inside space-y-1.5 ml-1">
              <li>
                <strong>曲目检索</strong> — 在曲目查询页搜索你想查看的曲目，支持多关键词、定数范围、版本、难度筛选。
              </li>
              <li>
                <strong>录入成绩</strong> — 在曲目详情页选择难度后，点击「录入成绩」按钮填写达成率、DX 分数等信息。
              </li>
              <li>
                <strong>一键导入</strong> — 在曲目查询页点击「导入成绩」按钮，使用 Diving-Fish 账号凭证一键拉取全部成绩。
              </li>
            </ol>
          </div>
          <p className="text-text-tertiary text-xs">
            提示：本工具所有数据均存储在你的浏览器本地（IndexedDB），不会上传到任何第三方服务器。
          </p>
        </div>
      </Section>

      {/* 2. B50 & Rating */}
      <Section icon={<BarChart4 size={20} />} title="B50 与 Rating">
        <div className="space-y-3 text-sm text-text-secondary leading-relaxed">
          <p>
            <strong className="text-text">B50</strong> 是舞萌 DX 的段位评分体系，由你历史最佳{' '}
            <strong>35 首旧版本曲目</strong>和<strong>15 首新版本曲目</strong>的最高 Rating 之和构成。
          </p>
          <div className="space-y-2">
            <p className="font-medium text-text">两种查分方式：</p>
            <ul className="list-disc list-inside space-y-1.5 ml-1">
              <li>
                <strong>在线查分</strong> — 输入 Diving-Fish 用户名，实时拉取官方 B50 数据和总 Rating。
              </li>
              <li>
                <strong>本地 B50</strong> — 基于你在本工具中录入/导入的成绩，在本地计算 B50 和总 Rating。
              </li>
            </ul>
          </div>
          <p className="text-sm">
            Rating 计算
            基于谱面定数 × 等级系数 × 达成率，最终向下取整。不同达成率区间采用不同的等级系数，详情见「全服达成分布」章节。
          </p>
        </div>
      </Section>

      {/* 3. Server Distribution */}
      <Section icon={<Music size={20} />} title="全服达成分布">
        <div className="space-y-3 text-sm text-text-secondary leading-relaxed">
          <p>
            在曲目详情页的每个难度卡片中，可以看到<strong className="text-text">三行对比数据</strong>：
          </p>
          <div className="bg-surface-light rounded-lg p-4 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="shrink-0 w-3 h-3 rounded bg-red-400" />
              <span>
                <strong>vs 官标等级</strong> — 与该难度等级（如 14+）全服玩家的 SSS/SSS+/AP 率均值对比
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="shrink-0 w-3 h-3 rounded bg-accent" />
              <span>
                <strong>vs 官标定数</strong> — 与相同官方定数（如 14.7）的全服均值对比
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="shrink-0 w-3 h-3 rounded bg-green-400" />
              <span>
                <strong>vs 拟合定数</strong> — 与社区拟合定数（如 14.9）相近谱面的全服均值对比
              </span>
            </div>
          </div>
          <p>
            颜色含义：<span className="text-green-600 font-medium">绿色</span> = 该谱面达成率{' '}
            <strong>高于</strong>同类均值（水分谱面），
            <span className="text-red-500 font-medium">红色</span> ={' '}
            <strong>低于</strong>同类均值（偏难谱面），灰色 = 差距不大。
          </p>
          <p className="text-text-tertiary text-xs">
            数据来源：Diving-Fish 社区全服统计，每日更新。
          </p>
        </div>
      </Section>

      {/* 4. Push Suggestions — brief */}
      <Section icon={<TrendingUp size={20} />} title="推分建议">
        <div className="space-y-3 text-sm text-text-secondary leading-relaxed">
          <div className="flex items-start gap-2 text-amber-600 bg-amber-50 rounded-lg p-3">
            <Info size={18} className="shrink-0 mt-0.5" />
            <p className="m-0 text-amber-800">
              ⚠️ 此功能持续迭代中，推分策略和判定逻辑可能随时间调整。
            </p>
          </div>
          <p>
            <strong className="text-text">推分建议</strong>的目标是帮玩家找到当前最值得投入练习的谱面——即花最少精力换取最大 Rating 提升。
          </p>
          <div className="space-y-2">
            <p className="font-medium text-text">当前进度：</p>
            <ul className="list-disc list-inside space-y-1 ml-1">
              <li>基于 B50 地板替换逻辑的增益计算</li>
              <li>按众数区间过滤 + SSS+ 率加权排序</li>
              <li>策略分段（冲击万四 → 冲击万六 → 冲击理论 Rating）</li>
            </ul>
          </div>
          <div className="space-y-2">
            <p className="font-medium text-text">后续计划：</p>
            <ul className="list-disc list-inside space-y-1 ml-1">
              <li>引入全服天花板数据，优化目标达成率的合理性</li>
              <li>增加推分路线的可视化呈现</li>
            </ul>
          </div>
        </div>
      </Section>

      {/* 5. Dimension Analysis — brief */}
      <Section icon={<Radar size={20} />} title="五维分析">
        <div className="space-y-3 text-sm text-text-secondary leading-relaxed">
          <div className="flex items-start gap-2 text-amber-600 bg-amber-50 rounded-lg p-3">
            <Info size={18} className="shrink-0 mt-0.5" />
            <p className="m-0 text-amber-800">
              ⚠️ 五维算法正在重构中，当前版本仅供参考，后续将有较大调整。
            </p>
          </div>
          <p>
            <strong className="text-text">五维分析</strong>从五个能力维度量化评估你的谱面表现：
            <span className="text-text font-medium">底力</span>（综合物量处理）、
            <span className="text-text font-medium">体力</span>（耐力谱面）、
            <span className="text-text font-medium">爆发</span>（高密短谱）、
            <span className="text-text font-medium">定位</span>（精确击打）、
            <span className="text-text font-medium">技巧</span>（复杂配置）。
          </p>
          <div className="space-y-2">
            <p className="font-medium text-text">当前进度：</p>
            <ul className="list-disc list-inside space-y-1 ml-1">
              <li>单雷达图 + 短板诊断 + 递进练习推荐 + 4 阶段推分路线</li>
            </ul>
          </div>
          <div className="space-y-2">
            <p className="font-medium text-text">后续计划：</p>
            <ul className="list-disc list-inside space-y-1 ml-1">
              <li>体力/爆发公式修正（引入 BPM 乘数 + 物量密度）</li>
              <li>按定数区间分组五维（舒适区 vs 极限区）</li>
              <li>双环雷达图展示成长空间</li>
              <li>短板分析基准化（引入全服对比）</li>
            </ul>
          </div>
        </div>
      </Section>
    </div>
  )
}
