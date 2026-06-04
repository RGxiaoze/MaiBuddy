// ============================================================
// Pagination — page navigation with ellipsis for large ranges
// ============================================================

interface PaginationProps {
  currentPage: number      // 0-based
  totalPages: number
  onPageChange: (page: number) => void
}

/** Generate page number array with ellipsis gaps (null = ellipsis placeholder) */
function buildPages(current: number, total: number): (number | null)[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i)
  }

  // Always include first, last, current, and neighbors
  const pages: (number | null)[] = [0]

  const start = Math.max(1, current - 1)
  const end = Math.min(total - 2, current + 1)

  // Gap after first page
  if (start > 2) {
    pages.push(null)
  } else if (start === 2) {
    pages.push(1)
  }

  // Current neighborhood
  for (let i = start; i <= end; i++) {
    pages.push(i)
  }

  // Gap before last page
  if (end < total - 3) {
    pages.push(null)
  } else if (end === total - 3) {
    pages.push(total - 2)
  }

  pages.push(total - 1)

  return pages
}

export default function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  // Don't render if 1 or fewer pages
  if (totalPages <= 1) return null

  const pages = buildPages(currentPage, totalPages)

  return (
    <nav className="flex items-center justify-center gap-1 mt-6" aria-label="分页导航">
      {/* Previous */}
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 0}
        className="px-3 py-1.5 rounded-md text-sm border border-border bg-surface text-text-secondary
                   hover:bg-surface-light hover:border-primary transition-colors cursor-pointer
                   disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-surface disabled:hover:border-border"
        aria-label="上一页"
      >
        ‹
      </button>

      {/* Page numbers */}
      {pages.map((page, i) =>
        page === null ? (
          <span key={`e${i}`} className="px-1 text-text-tertiary text-sm select-none">
            …
          </span>
        ) : (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`w-8 h-8 rounded-md text-sm font-medium transition-colors cursor-pointer border-none
              ${page === currentPage
                ? 'bg-primary text-white'
                : 'bg-surface text-text-secondary hover:bg-surface-light'
              }`}
            aria-label={`第 ${page + 1} 页`}
            aria-current={page === currentPage ? 'page' : undefined}
          >
            {page + 1}
          </button>
        )
      )}

      {/* Next */}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages - 1}
        className="px-3 py-1.5 rounded-md text-sm border border-border bg-surface text-text-secondary
                   hover:bg-surface-light hover:border-primary transition-colors cursor-pointer
                   disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-surface disabled:hover:border-border"
        aria-label="下一页"
      >
        ›
      </button>
    </nav>
  )
}
