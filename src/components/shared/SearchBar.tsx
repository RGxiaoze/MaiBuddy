// ============================================================
// Search bar with real-time input
// ============================================================

import { Search } from 'lucide-react'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export default function SearchBar({ value, onChange, placeholder = '搜索曲名、作者、谱师或别名...' }: SearchBarProps) {
  return (
    <div className="relative">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-4 py-2.5 rounded-md border border-border bg-surface text-sm
                   focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary
                   placeholder:text-text-secondary"
      />
    </div>
  )
}
