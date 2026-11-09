// ============================================================
// SongSortBar — 排序下拉 + 升降序切换
//
// 检索页与统计页共用；状态直接读写 songStore。
// compact 用于移动端（更小的字号与内边距）。
// ============================================================

import { useSongStore, SORT_OPTIONS } from '@/store/songStore'

interface SongSortBarProps {
  compact?: boolean
}

export default function SongSortBar({ compact = false }: SongSortBarProps) {
  const sortBy = useSongStore((s) => s.sortBy)
  const sortOrder = useSongStore((s) => s.sortOrder)
  const setSortBy = useSongStore((s) => s.setSortBy)
  const toggleSortOrder = useSongStore((s) => s.toggleSortOrder)

  const size = compact ? 'text-xs px-2 py-1.5' : 'text-sm px-2 py-2'

  return (
    <>
      <select
        value={sortBy}
        onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
        className={`rounded-md border border-border bg-surface text-text-secondary
                   focus:outline-none focus:border-primary cursor-pointer ${size}`}
        title="排序方式"
      >
        {SORT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <button
        onClick={toggleSortOrder}
        className={`rounded-md border border-border bg-surface text-text-secondary
                   hover:border-primary transition-colors cursor-pointer whitespace-nowrap ${size}`}
        title={sortOrder === 'desc' ? '降序 ↓' : '升序 ↑'}
      >
        {/* 移动端只有一个箭头看不懂，compact 时补上文字 */}
        {compact ? (sortOrder === 'desc' ? '降序 ↓' : '升序 ↑') : (sortOrder === 'desc' ? '↓' : '↑')}
      </button>
    </>
  )
}
