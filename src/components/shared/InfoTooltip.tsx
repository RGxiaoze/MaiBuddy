// ============================================================
// InfoTooltip — hoverable info icon with popover explanation
// ============================================================

import { Info } from 'lucide-react'

interface InfoTooltipProps {
  /** Explanation text (supports line breaks with \n) */
  content: string
  /** Optional icon size in px (default 14) */
  size?: number
}

/**
 * A small info icon that shows a tooltip on hover.
 * Use to explain how a value is calculated without cluttering the UI.
 *
 * @example
 * <InfoTooltip content="该值通过公式 floor(系数 × 定数 × 达成率 / 100) 计算" />
 */
export default function InfoTooltip({ content, size = 14 }: InfoTooltipProps) {
  return (
    <span className="relative inline-flex items-center group/ml-1">
      <Info
        size={size}
        className="text-text-tertiary hover:text-text-secondary cursor-help transition-colors"
        aria-label={content.replace(/\n/g, ' ')}
      />
      <span
        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1.5
                   bg-gray-800 text-white text-xs rounded-md whitespace-pre-line
                   opacity-0 invisible group-hover:opacity-100 group-hover:visible
                   transition-opacity duration-150 z-50 max-w-64 text-center
                   pointer-events-none shadow-lg"
        style={{ lineHeight: '1.5' }}
      >
        {content}
      </span>
    </span>
  )
}
