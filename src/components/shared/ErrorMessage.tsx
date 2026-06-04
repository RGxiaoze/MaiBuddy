// ============================================================
// Error message card with optional retry
// ============================================================

interface ErrorMessageProps {
  message: string
  onRetry?: () => void
}

export default function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="flex flex-col items-center gap-4 max-w-md text-center">
        <span className="text-3xl">⚠️</span>
        <h2 className="text-base font-medium text-error m-0">加载失败</h2>
        <p className="text-sm text-text-secondary">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 rounded-md bg-primary text-white text-sm hover:bg-primary-dark transition-colors cursor-pointer"
          >
            重试
          </button>
        )}
      </div>
    </div>
  )
}
