// ============================================================
// MultiSelect — 下拉多选菜单
//
// 原生 <select multiple> 在手机上体验很差（长按、误触），
// 这里用「按钮 + 浮层面板 + 复选框」实现，点外部关闭。
// ============================================================

import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

export interface MultiSelectOption {
  value: string
  label: string
}

interface MultiSelectProps {
  /** 未选中任何项时的显示文案 */
  placeholder: string
  options: MultiSelectOption[]
  selected: string[]
  onChange: (next: string[]) => void
}

export default function MultiSelect({ placeholder, options, selected, onChange }: MultiSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const toggle = (value: string) => {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value])
  }

  const summary = selected.length === 0
    ? placeholder
    : selected.length === 1
      ? (options.find((o) => o.value === selected[0])?.label ?? placeholder)
      : `已选 ${selected.length} 项`

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded border text-sm text-left
          bg-surface cursor-pointer transition-colors
          ${selected.length > 0 ? 'border-primary text-text' : 'border-border text-text-secondary'}`}
      >
        <span className="truncate">{summary}</span>
        <ChevronDown size={13} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full max-h-64 overflow-y-auto rounded-md border border-border bg-surface shadow-lg py-1">
          {options.map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-2 px-2.5 py-1.5 text-sm text-text-secondary hover:bg-surface-light cursor-pointer select-none"
            >
              <input
                type="checkbox"
                checked={selected.includes(opt.value)}
                onChange={() => toggle(opt.value)}
                className="w-3.5 h-3.5 rounded border-border cursor-pointer accent-primary"
              />
              <span className="truncate">{opt.label}</span>
            </label>
          ))}
          {selected.length > 0 && (
            <button
              onClick={() => { onChange([]); setOpen(false) }}
              className="w-full mt-1 pt-1.5 border-t border-border/60 text-[11px] text-primary hover:underline cursor-pointer bg-transparent"
            >
              清空
            </button>
          )}
        </div>
      )}
    </div>
  )
}
