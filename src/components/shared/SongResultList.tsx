// ============================================================
// SongResultList — 曲目结果列表（含分页）
//
// 检索页与统计页共用。行内包含曲绘、难度徽章、标/DX 配对跳转。
// ============================================================

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Music } from 'lucide-react'
import Pagination from './Pagination'
import { useSongStore } from '@/store/songStore'
import { LEVEL_INDEX_MAP, LEVEL_BADGE_CLASS, getCoverUrl } from '@/data/constants'
import { getVersionDisplay } from '@/data/versions'
import type { LevelIndex, Song } from '@/types'

const DEFAULT_PAGE_SIZE = 50

interface SongResultListProps {
  songs: Song[]
  pageSize?: number
  /** 列表为空时的提示文案 */
  emptyText?: string
}

export default function SongResultList({ songs, pageSize = DEFAULT_PAGE_SIZE, emptyText = '未找到匹配曲目' }: SongResultListProps) {
  const navigate = useNavigate()
  const allSongs = useSongStore((s) => s.songs)
  const [page, setPage] = useState(0)

  // 筛选/排序结果变化后回到第一页
  useEffect(() => {
    setPage(0)
  }, [songs])

  const totalPages = Math.max(1, Math.ceil(songs.length / pageSize))
  const pagedSongs = useMemo(
    () => songs.slice(page * pageSize, (page + 1) * pageSize),
    [songs, page, pageSize],
  )

  // 标 / DX 是同一首曲的两个独立条目（DX 条目 ID = 基础 + 10000）
  const pairMap = useMemo(() => {
    const map = new Map<string, { standard?: Song; dx?: Song }>()
    for (const s of allSongs) {
      const key = `${s.title}|${s.artist}|${s.bpm}`
      const entry = map.get(key) || {}
      if (s.difficulties.standard.length > 0) entry.standard = s
      if (s.difficulties.dx.length > 0) entry.dx = s
      map.set(key, entry)
    }
    return map
  }, [allSongs])

  const rows = useMemo(() => {
    return pagedSongs.map((song) => {
      const key = `${song.title}|${song.artist}|${song.bpm}`
      const pair = pairMap.get(key)
      const hasPair = pair && pair.standard && pair.dx

      const levelLabels: { idx: LevelIndex; label: string; levelValue: number; badgeBg: string; badgeFg: string }[] = []
      for (const d of [...song.difficulties.standard, ...song.difficulties.dx]) {
        if (d.level && d.level !== '0') {
          const colors = LEVEL_INDEX_MAP[d.levelIndex]
          if (colors) levelLabels.push({ idx: d.levelIndex, label: d.level, levelValue: d.levelValue, badgeBg: colors.badgeBg, badgeFg: colors.badgeFg })
        }
      }
      levelLabels.sort((a, b) => a.idx - b.idx)

      return { song, levelLabels, hasPair: !!hasPair, pair }
    })
  }, [pagedSongs, pairMap])

  const handlePageChange = (p: number) => {
    setPage(p)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <>
      <p className="text-xs text-text-secondary mb-3">
        共 {songs.length} 首曲目
        {songs.length > pageSize && ` · 第 ${page + 1}/${totalPages} 页`}
      </p>

      {songs.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-text-secondary">
          <Music size={28} className="text-text-tertiary" />
          <p className="text-sm">{emptyText}</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            {rows.map(({ song, levelLabels, hasPair, pair }) => (
              <button
                key={song.id}
                onClick={() => navigate(`/songs/${song.id}`)}
                className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-3 rounded-lg bg-surface border border-border/50
                           shadow-sm hover:border-primary hover:shadow-md transition-all text-left cursor-pointer w-full"
              >
                <div className="flex items-center gap-3 sm:gap-4">
                  <img
                    src={getCoverUrl(song.id, 'thumb')}
                    alt={song.title}
                    className="w-12 h-12 rounded object-cover shrink-0 bg-bg-gray"
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      // 缩略图缺失（宴会场等无曲绘的曲目）先回退原图，再失败才用占位符
                      const img = e.target as HTMLImageElement
                      if (img.dataset.fallback !== '1') {
                        img.dataset.fallback = '1'
                        img.src = getCoverUrl(song.id, 'full')
                        return
                      }
                      img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect fill="%23EBEEF3" width="48" height="48"/><text x="24" y="28" text-anchor="middle" fill="%23999" font-size="14">♪</text></svg>'
                    }}
                  />
                  <div className="sm:hidden flex-1 min-w-0">
                    <div className="font-medium text-sm text-text truncate">{song.title}</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {levelLabels.map(({ idx, label, levelValue, badgeBg, badgeFg }) => (
                        <span key={idx} className="inline-flex items-center gap-0.5">
                          <span
                            className={`${LEVEL_BADGE_CLASS} py-0.5 rounded text-[10px] font-medium leading-tight`}
                            style={{ backgroundColor: badgeBg, color: badgeFg }}
                          >
                            {label}
                          </span>
                          {levelValue > 0 && (
                            <span className="text-[10px] text-text-tertiary tabular-nums">{levelValue.toFixed(1)}</span>
                          )}
                        </span>
                      ))}
                      {song.difficulties.standard.length > 0 && (
                        <span
                          className={`px-1 py-0.5 rounded text-[9px] leading-tight border border-border/50 shrink-0
                            ${hasPair ? 'cursor-pointer hover:border-primary' : 'text-text-tertiary bg-surface-light'}`}
                          onClick={(e) => { if (hasPair && pair?.standard) { e.stopPropagation(); navigate('/songs/' + pair.standard.id) } }}
                        >标</span>
                      )}
                      {song.difficulties.dx.length > 0 && (
                        <span
                          className={`px-1 py-0.5 rounded text-[9px] leading-tight shrink-0
                            ${hasPair ? 'cursor-pointer hover:bg-primary/20' : 'text-primary bg-primary/10'}`}
                          onClick={(e) => { if (hasPair && pair?.dx) { e.stopPropagation(); navigate('/songs/' + pair.dx.id) } }}
                        >DX</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="hidden sm:block flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-sm text-text truncate">{song.title}</span>
                    {song.difficulties.standard.length > 0 && (
                      <span
                        className={`px-1 py-0.5 rounded text-[9px] leading-tight border border-border/50 shrink-0
                          ${hasPair ? 'cursor-pointer hover:border-primary' : 'text-text-tertiary bg-surface-light'}`}
                        onClick={(e) => { if (hasPair && pair?.standard) { e.stopPropagation(); navigate('/songs/' + pair.standard.id) } }}
                      >标</span>
                    )}
                    {song.difficulties.dx.length > 0 && (
                      <span
                        className={`px-1 py-0.5 rounded text-[9px] leading-tight shrink-0
                          ${hasPair ? 'cursor-pointer hover:bg-primary/20' : 'text-primary bg-primary/10'}`}
                        onClick={(e) => { if (hasPair && pair?.dx) { e.stopPropagation(); navigate('/songs/' + pair.dx.id) } }}
                      >DX</span>
                    )}
                  </div>
                  <div className="text-xs text-text-secondary truncate">{song.artist}</div>
                </div>

                <div className="sm:hidden flex items-center gap-2 text-xs text-text-secondary pt-0.5">
                  <span className="truncate">{song.artist}</span>
                  <span className="text-text-tertiary">|</span>
                  <span className="tabular-nums shrink-0">BPM {song.bpm}</span>
                  <span className="text-text-tertiary">|</span>
                  <span className="truncate shrink-0">{getVersionDisplay(song.from)}</span>
                </div>

                <div className="hidden sm:flex items-center gap-2 shrink-0 flex-wrap justify-end">
                  <div className="flex gap-1">
                    {levelLabels.map(({ idx, label, levelValue, badgeBg, badgeFg }) => (
                      <span key={idx} className="inline-flex items-center gap-0.5">
                        <span
                          className={`${LEVEL_BADGE_CLASS} py-0.5 rounded text-[11px] font-medium leading-tight`}
                          style={{ backgroundColor: badgeBg, color: badgeFg }}
                        >
                          {label}
                        </span>
                        {levelValue > 0 && (
                          <span className="text-[10px] text-text-tertiary tabular-nums">{levelValue.toFixed(1)}</span>
                        )}
                      </span>
                    ))}
                  </div>
                  <span className="text-xs text-text-secondary tabular-nums w-14 text-right">{song.bpm}</span>
                  <span className="text-[10px] text-text-tertiary w-16 text-right">{song.from}</span>
                </div>
              </button>
            ))}
          </div>

          <Pagination currentPage={page} totalPages={totalPages} onPageChange={handlePageChange} />
        </>
      )}
    </>
  )
}
