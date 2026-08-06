// ============================================================
// QuickScoreEntry — 快捷录入成绩（搜索曲目 → 录入）
// 供 B50 页工具栏使用
// ============================================================

import { useState } from 'react'
import { X, Search } from 'lucide-react'
import { useSongStore } from '@/store/songStore'
import ScoreForm from '@/components/shared/ScoreForm'
import type { Song } from '@/types'

export default function QuickScoreEntry({ onClose }: { onClose: () => void }) {
  const { songs } = useSongStore()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Song | null>(null)

  const results = query.trim()
    ? songs
        .filter(s => s.title.toLowerCase().includes(query.trim().toLowerCase()))
        .slice(0, 15)
    : []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-surface rounded-xl border border-border shadow-lg p-4 sm:p-6 w-full max-w-[520px] max-h-[90vh] overflow-y-auto mx-2 sm:mx-0">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm sm:text-base font-semibold text-text">
            {selected ? '录入成绩' : '快捷录入成绩'}
          </h3>
          <button onClick={onClose} className="p-1 rounded text-text-tertiary hover:text-text hover:bg-surface-light transition-colors cursor-pointer border-none bg-transparent">
            <X size={18} />
          </button>
        </div>

        {!selected ? (
          <>
            <p className="text-xs text-text-secondary mb-3">搜索曲目后选择难度录入成绩</p>
            <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-surface focus-within:border-primary transition-colors">
              <Search size={14} className="text-text-tertiary shrink-0" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="输入曲名搜索..."
                className="flex-1 text-sm bg-transparent border-none outline-none text-text placeholder:text-text-tertiary"
              />
            </div>

            <div className="mt-3 space-y-1 max-h-[50vh] overflow-y-auto">
              {query.trim() && results.length === 0 && (
                <p className="text-xs text-text-secondary text-center py-4">未找到匹配曲目</p>
              )}
              {results.map(song => (
                <button
                  key={song.id}
                  onClick={() => setSelected(song)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md text-left cursor-pointer border-none bg-transparent hover:bg-surface-light transition-colors"
                >
                  <span className="text-sm font-medium text-text truncate">{song.title}</span>
                  <span className="text-[10px] text-text-tertiary shrink-0">
                    {song.difficulties?.standard?.length ? `标 ${song.difficulties.standard.length} 难度` : ''}
                    {song.difficulties?.dx?.length ? ` DX ${song.difficulties.dx.length} 难度` : ''}
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <ScoreForm
            song={selected}
            defaultLevelIndex={3}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  )
}
