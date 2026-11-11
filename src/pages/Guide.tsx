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
import { ENABLE_DIMENSION_ANALYSIS } from '@/config/features'

const Section = ({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) => (
  <section className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
    <h2 className="flex items-center gap-2 sm:gap-3 text-base sm:text-lg font-semibold text-text mb-3 sm:mb-4">
      <span className="text-primary">{icon}</span>
      {title}
    </h2>
    {children}
  </section>
)

export default function Guide() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-2 sm:gap-3 mb-6 sm:mb-8">
        <BookOpen className="w-6 h-6 sm:w-7 sm:h-7 text-primary" />
        <h1 className="text-xl sm:text-2xl font-bold text-text">使用指南</h1>
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
              <li><strong>一键导入</strong> — 点击「导入成绩」，用 Diving-Fish 账号一步登录并拉取全部成绩。也支持手动粘贴 Import-Token。</li>
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
          <p>曲目详情页每个难度卡片会显示一个<strong className="text-text">同类对比</strong>，说明这个谱面拿该评级的难度在同级里处于什么位置：</p>
          <div className="bg-surface-light rounded-lg p-4 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="shrink-0 w-3 h-3 rounded bg-green-400" />
              <span><strong>同实际难度</strong> — 与社区拟合定数（如 15.1）相近的谱面比较，最贴近实际体感</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="shrink-0 w-3 h-3 rounded bg-accent" />
              <span><strong>更多对比</strong> — 展开后可见「同官标定数」（如 14.9）与「同级」（如 14+）两级参照</span>
            </div>
          </div>
          <p>
            「略容易 / 明显偏难」描述的是达成率高低：
            <span className="text-green-600 font-medium">容易</span> = 比参照组更容易拿到该评级，
            <span className="text-red-500 font-medium">偏难</span> = 更难，灰色 = 差距不大。
          </p>
          <p className="text-text-tertiary text-xs">15 级谱面全服仅 3 首，同级对比没有统计意义，因此不显示。</p>
          <p className="text-text-tertiary text-xs">数据来源：Diving-Fish 社区统计，每日更新。</p>
        </div>
      </Section>

      {/* Push Suggestions */}
      <Section icon={<TrendingUp size={20} />} title="推分与探索">
        <div className="space-y-3 text-sm text-text-secondary leading-relaxed">
          <p>推荐页有两个 Tab，分别回答两个不同的问题：<strong className="text-text">「怎么把分推上去」</strong>和<strong className="text-text">「接下来打什么」</strong>。</p>

          <div className="space-y-2">
            <p className="font-medium text-text">推分</p>
            <ul className="list-disc list-inside space-y-1 ml-1">
              <li>基于 B50 地板替换逻辑计算增益，按最大收益排序</li>
              <li><strong>B15 池优先展开</strong>：池子小、每个版本理论上都能推；B35 对老玩家的可推空间往往已被历史成绩占满，默认折叠</li>
              <li>4 档目标方案：SS+ 99% / SSS 100% / SSS+ 100.5% / <strong className="text-success">AP +1</strong></li>
              <li>每张卡片直接标出「打它能涨多少分」</li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="font-medium text-text">探索</p>
            <ul className="list-disc list-inside space-y-1 ml-1">
              <li>只推荐<strong>你没打过</strong>的谱面，按社区投票喜好随机挑选</li>
              <li>数据来源：Diving-Fish 投票箱（二选一的累计结果），缓存 24 小时</li>
              <li>难度上限为你的 <strong>B15 最高定数 + 0.5</strong>，不会推打不动的谱</li>
              <li><strong>禁止降级</strong>：某首歌打过 Master 后，不会再推荐它的 Basic / Advanced / Expert</li>
              <li>「换一批」重新抽取，本次已看过的会优先排除</li>
              <li>不感兴趣的谱面点 <strong>×</strong> 隐藏，底部可一键恢复</li>
            </ul>
          </div>

          <p className="text-text-tertiary text-xs">推荐结果会在一定范围内随机，社区高人气不等于适合你——多翻几次往往能挖到惊喜。</p>
        </div>
      </Section>

      {/* 五维分析 —— 板块未开放时整节不渲染 */}
      {ENABLE_DIMENSION_ANALYSIS && (
      <Section icon={<Radar size={20} />} title="五维分析">
        <div className="space-y-3 text-sm text-text-secondary leading-relaxed">
          <p>从<span className="font-medium text-text">底力/体力/爆发/定位/技巧</span>五个维度，基于手臂位移量客观评估谱面表现。</p>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li><strong>底力</strong>：对 note 的掌控程度——拍速打得越稳越快，越能拿下 BPM 高但配置不出格的谱面</li>
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
      )}

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
              <li>落雪咖啡屋 (Lxns-Network) — 类型枚举体系</li>
              <li>Maichart-Converts (Neskol) — Simai 谱面公开数据集</li>
              <li>舞萌谱面预览 v.awmc.cc (AWMC TEAM) — 谱面预览与可视化参考</li>
              <li>dxrating (gekichumai) — DX Rating 工具</li>
            </ul>
          </div>
          <div className="space-y-2">
            <p className="font-medium text-text">算法参考</p>
            <ul className="list-disc list-inside space-y-1 ml-1">
              <li>RemyWiki — Rating/B50 算法公式</li>
              <li>beatmania IIDX 非公式難易度表 — 底力/体力/爆发三层区分</li>
              <li>SOUND VOLTEX Effect Radar — 多维雷达图可视化</li>
              <li>AstroDX — 机台布局几何模型（6 层传感器区域）</li>
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
