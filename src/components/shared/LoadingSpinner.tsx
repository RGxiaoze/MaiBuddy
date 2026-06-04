// ============================================================
// Centered loading spinner
// ============================================================

interface LoadingSpinnerProps {
  message?: string
}

export default function LoadingSpinner({ message = '加载中...' }: LoadingSpinnerProps) {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="flex flex-col items-center gap-3 text-text-secondary">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">{message}</span>
      </div>
    </div>
  )
}
