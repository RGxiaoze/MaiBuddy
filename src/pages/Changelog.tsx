// ============================================================
// Changelog page — rendered from public/changelog.json
// ============================================================

import { useEffect, useState } from 'react'
import { History } from 'lucide-react'

interface ChangelogCommit {
  hash: string
  type: string
  message: string
  label: string
  color: string
}

interface ChangelogEntry {
  date: string
  commits: ChangelogCommit[]
}

interface ChangelogData {
  entries: ChangelogEntry[]
}

const colorMap: Record<string, string> = {
  green: 'bg-green-100 text-green-700',
  amber: 'bg-amber-100 text-amber-700',
  blue: 'bg-blue-100 text-blue-700',
}

/** Format ISO date string to YYYY年MM月DD日 */
function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${y}年${parseInt(m)}月${parseInt(d)}日`
}

export default function Changelog() {
  const [data, setData] = useState<ChangelogData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/changelog.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(setData)
      .catch((e) => setError(`更新记录加载失败：${e.message}`))
  }, [])

  if (error) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <p className="text-error">{error}</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="max-w-2xl mx-auto py-12 flex justify-center">
        <div className="w-6 h-6 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (data.entries.length === 0) {
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
        {/* Vertical line */}
        <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-border" />

        <div className="space-y-6">
          {data.entries.map((entry) => (
            <div key={entry.date} className="relative pl-10">
              {/* Circle dot */}
              <div className="absolute left-2.5 top-1.5 w-3 h-3 rounded-full bg-primary border-2 border-white shadow-sm" />

              {/* Date heading */}
              <h2 className="text-sm font-semibold text-text mb-3">
                {formatDate(entry.date)}
              </h2>

              {/* Commits */}
              <div className="space-y-2">
                {entry.commits.map((c) => (
                  <div
                    key={c.hash}
                    className="bg-white rounded-lg px-4 py-2.5 shadow-sm
                               flex items-start gap-3"
                  >
                    <span
                      className={`shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${colorMap[c.color] || 'bg-gray-100 text-gray-600'}`}
                    >
                      {c.label}
                    </span>
                    <span className="text-sm text-text-secondary leading-relaxed">
                      {c.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
