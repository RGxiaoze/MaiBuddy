// ============================================================
// Changelog page — 数据在编译期内联（src/data/changelog.generated.ts）
//
// 早先是从 public/changelog.json 运行时 fetch，但 CI 用 `npx vite build`
// 不触发 prebuild，产物里没有该文件 → 线上 404。改为静态导入后无任何运行时请求。
// ============================================================

import { useState } from 'react'
import { History } from 'lucide-react'
import { CHANGELOG, type ChangelogCommit, type ChangelogEntry } from '@/data/changelog.generated'

const colorMap: Record<string, string> = {
  green: 'bg-green-100 text-green-700',
  amber: 'bg-amber-100 text-amber-700',
  blue: 'bg-blue-100 text-blue-700',
}

/** 咬文嚼字类的小修：不单独占一张卡，归到「细节修正」里一笔带过 */
const MINOR_PATTERN = /文案|措辞|笔误|排版|命名|注释/

/** 每天默认最多展开的卡片数，其余折叠 */
const VISIBLE_PER_DAY = 4

/** Format ISO date string to YYYY年MM月DD日 */
function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${y}年${parseInt(m)}月${parseInt(d)}日`
}

function CommitCard({ c }: { c: ChangelogCommit }) {
  return (
    <div className="bg-white rounded-lg px-4 py-2.5 shadow-sm flex items-start gap-3">
      <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${colorMap[c.color] || 'bg-gray-100 text-gray-600'}`}>
        {c.label}
      </span>
      <span className="text-sm text-text-secondary leading-relaxed">{c.message}</span>
    </div>
  )
}

function DaySection({ entry }: { entry: ChangelogEntry }) {
  const [expanded, setExpanded] = useState(false)
  const [showMinor, setShowMinor] = useState(false)

  const minor = entry.commits.filter((c) => MINOR_PATTERN.test(c.message))
  const main = entry.commits.filter((c) => !MINOR_PATTERN.test(c.message))
  const visible = expanded ? main : main.slice(0, VISIBLE_PER_DAY)
  const hiddenCount = main.length - visible.length

  return (
    <div className="relative pl-10">
      {/* Circle dot */}
      <div className="absolute left-2.5 top-1.5 w-3 h-3 rounded-full bg-primary border-2 border-white shadow-sm" />

      <h2 className="text-sm font-semibold text-text mb-3">{formatDate(entry.date)}</h2>

      <div className="space-y-2">
        {visible.map((c) => <CommitCard key={c.hash} c={c} />)}

        {hiddenCount > 0 && (
          <button
            onClick={() => setExpanded(true)}
            className="w-full text-xs text-primary hover:underline cursor-pointer border-none bg-transparent py-1"
          >
            展开其余 {hiddenCount} 条
          </button>
        )}

        {/* 细节修正：一行带过，需要时才展开 */}
        {minor.length > 0 && (
          <div className="pt-1">
            <button
              onClick={() => setShowMinor((v) => !v)}
              className="text-xs text-text-tertiary hover:text-text-secondary cursor-pointer border-none bg-transparent p-0"
            >
              细节修正 {minor.length} 项 {showMinor ? '▾' : '▸'}
            </button>
            {showMinor && (
              <ul className="mt-1.5 space-y-1 pl-1">
                {minor.map((c) => (
                  <li key={c.hash} className="text-xs text-text-tertiary leading-relaxed">· {c.message}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function Changelog() {
  const entries = CHANGELOG

  if (entries.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center text-text-tertiary">
        暂无更新记录
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <History className="w-7 h-7 text-primary" />
        <h1 className="text-2xl font-bold text-text">更新记录</h1>
      </div>

      {/* Timeline */}
      <div className="relative">
        <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-border" />
        <div className="space-y-6">
          {entries.map((entry) => <DaySection key={entry.date} entry={entry} />)}
        </div>
      </div>
    </div>
  )
}
