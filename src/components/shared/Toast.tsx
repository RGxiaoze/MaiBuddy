// ============================================================
// Toast — 操作结果的短时提示
//
// 固定在视口顶部居中，不占布局、不受滚动影响。
// 用于「导入完成 / 导入失败」这类操作反馈：
// 此前它们内联在面板底部，面板一长用户就看不到。
// ============================================================

import { useEffect } from 'react'
import { CheckCircle2, XCircle, Info } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'info'

const TOAST_STYLE: Record<ToastType, { icon: typeof CheckCircle2; color: string }> = {
  success: { icon: CheckCircle2, color: '#16A34A' },
  error: { icon: XCircle, color: '#DC2626' },
  info: { icon: Info, color: '#5BA4CF' },
}

export interface ToastProps {
  message: string
  type?: ToastType
  /** 自动消失时间（毫秒）；传 0 表示不自动消失，只能手动关闭 */
  duration?: number
  onClose: () => void
}

export default function Toast({ message, type = 'success', duration = 3000, onClose }: ToastProps) {
  const { icon: Icon, color } = TOAST_STYLE[type]

  useEffect(() => {
    if (duration <= 0) return
    const timer = setTimeout(onClose, duration)
    return () => clearTimeout(timer)
  }, [duration, onClose])

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] max-w-[calc(100vw-2rem)] w-max
                 flex items-start gap-2 px-4 py-2.5 rounded-lg shadow-lg
                 bg-surface border border-border animate-in fade-in slide-in-from-top-2"
      onClick={onClose}
    >
      <Icon size={16} className="shrink-0 mt-0.5" style={{ color }} />
      <span className="text-sm text-text leading-snug break-words">{message}</span>
    </div>
  )
}
