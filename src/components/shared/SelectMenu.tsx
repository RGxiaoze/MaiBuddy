// ============================================================
// SelectMenu — 单选下拉菜单
//
// 用于统计页的维度取值筛选：原先是一排横向滚动的标签，
// 手机上要左右拖才能看全，改为点开下拉选择。
// 与原生的 <select> 不同，支持分组标题（如评级 / FC / FS）。
// ============================================================

import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

export interface SelectOption {
  value: string
  label: string
  /** 分组标题，相邻同组选项会归在一起 */
  group?: string
}

interface SelectMenuProps {
  options: SelectOption[]
  value: string
  onChange: (next: string) => void
  /** 无匹配选项时的占位文案 */
  placeholder?: string
  /** 按钮左侧的说明文字（如「难度」） */
  label?: string
  className?: string
}

export default function SelectMenu({ options, value, onChange, placeholder = '全部', label, className = '' }: SelectMenuProps) {
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

  const current = options.find((o) => o.value === value)

  // 按 group 分段渲染（无 group 的归到同一段）
  const groups: { title?: string; items: SelectOption[] }[] = []
  for (const opt of options) {
    const last = groups[groups.length - 1]
    if (last && last.title === opt.group) last.items.push(opt)
    else groups.push({ title: opt.group, items: [opt] })
  }

  return (
    <div className={`relative ${className}`} ref={ref}>
      {label && <span className="text-xs text-text-tertiary mr-1.5 shrink-0">{label}</span>}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md border text-sm min-w-[7rem]
          bg-surface cursor-pointer transition-colors text-left
          ${open ? 'border-primary text-text' : 'border-border text-text-secondary hover:border-primary'}`}
      >
        <span className="truncate">{current?.label ?? placeholder}</span>
        <ChevronDown size={13} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 left-0 min-w-full max-h-72 overflow-y-auto rounded-md border border-border bg-surface shadow-lg py-1">
          {groups.map((g, gi) => (
            <div key={`${g.title ?? 'flat'}-${gi}`}>
              {g.title && (
                <p className="px-2.5 pt-1.5 pb-0.5 text-[10px] font-medium text-text-tertiary">{g.title}</p>
              )}
              {g.items.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { onChange(opt.value); setOpen(false) }}
                  className={`w-full text-left px-2.5 py-1.5 text-sm cursor-pointer border-none bg-transparent transition-colors
                    ${opt.value === value ? 'text-primary font-medium bg-primary/10' : 'text-text-secondary hover:bg-surface-light'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
