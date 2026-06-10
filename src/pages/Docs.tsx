// ============================================================
// Docs page — renders docs/ markdown files
// ============================================================

import { useEffect, useState, useMemo } from 'react'
import { marked } from 'marked'
import { BookOpen, ExternalLink, FileText, ChevronDown, ChevronRight } from 'lucide-react'

interface DocEntry {
  path: string
  title: string
  content: string
}

export default function Docs() {
  const [docs, setDocs] = useState<DocEntry[] | null>(null)
  const [activePath, setActivePath] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [navOpen, setNavOpen] = useState(false)

  useEffect(() => {
    fetch(import.meta.env.BASE_URL + 'docs-index.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data: DocEntry[]) => {
        setDocs(data)
        if (data.length > 0) setActivePath(data[0].path)
      })
      .catch((e) => setError(`文档加载失败：${e.message}`))
  }, [])

  const activeDoc = useMemo(
    () => (activePath ? docs?.find((d) => d.path === activePath) : undefined),
    [docs, activePath]
  )

  const renderedHtml = useMemo(() => {
    if (!activeDoc) return ''
    return marked.parse(activeDoc.content) as string
  }, [activeDoc])

  const selectDoc = (path: string) => {
    setActivePath(path)
    setNavOpen(false)
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center">
        <p className="text-error">{error}</p>
      </div>
    )
  }

  if (!docs) {
    return (
      <div className="max-w-4xl mx-auto py-12 flex justify-center">
        <div className="w-6 h-6 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 md:gap-3">
          <BookOpen className="w-6 h-6 md:w-7 md:h-7 text-primary" />
          <h1 className="text-xl md:text-2xl font-bold text-text">开发文档</h1>
        </div>
        <a
          href="#"
          className="flex items-center gap-1.5 text-sm text-primary hover:underline"
          title="GitHub（暂未开放）"
          target="_blank"
          rel="noopener noreferrer"
        >
          <ExternalLink size={16} />
          <span className="hidden sm:inline">在 GitHub 查看</span>
        </a>
      </div>

      {/* Layout */}
      <div className="flex flex-col md:flex-row gap-4 md:gap-6">
        {/* Desktop sidebar */}
        <nav className="hidden md:flex flex-col w-52 shrink-0 space-y-0.5">
          {docs.map((doc) => (
            <button
              key={doc.path}
              onClick={() => selectDoc(doc.path)}
              className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                         transition-colors cursor-pointer border-none
                         ${activePath === doc.path
                           ? 'bg-primary/10 text-primary font-medium'
                           : 'text-text-secondary hover:bg-surface-light hover:text-text bg-transparent'
                         }`}
            >
              <FileText size={14} className="shrink-0" />
              <span className="truncate">{doc.title}</span>
            </button>
          ))}
        </nav>

        {/* Mobile nav — collapsible */}
        <div className="md:hidden">
          <button
            onClick={() => setNavOpen(!navOpen)}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-border
                       bg-surface text-sm font-medium text-text cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <FileText size={14} className="text-primary" />
              {activeDoc?.title || '选择文档'}
            </span>
            <ChevronDown size={16} className={`transition-transform ${navOpen ? 'rotate-180' : ''}`} />
          </button>
          {navOpen && (
            <div className="mt-1 border border-border rounded-lg bg-surface overflow-hidden">
              {docs.map((doc) => (
                <button
                  key={doc.path}
                  onClick={() => selectDoc(doc.path)}
                  className={`w-full text-left flex items-center gap-2 px-3 py-2.5 text-sm
                             transition-colors cursor-pointer border-none border-b border-border/50 last:border-b-0
                             ${activePath === doc.path
                               ? 'bg-primary/10 text-primary font-medium'
                               : 'text-text-secondary hover:bg-surface-light hover:text-text bg-transparent'
                             }`}
                >
                  <ChevronRight size={14} className="shrink-0" />
                  <span>{doc.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Content area */}
        <div className="flex-1 min-w-0">
          <article
            className="bg-white rounded-xl shadow-sm p-4 sm:p-6 md:p-8
                       prose prose-sm max-w-none
                       prose-headings:text-text prose-headings:font-semibold prose-headings:tracking-tight
                       prose-h1:text-2xl prose-h1:mt-10 prose-h1:mb-6 prose-h1:pb-3 prose-h1:border-b-2 prose-h1:border-primary/30
                       prose-h2:text-lg prose-h2:mt-8 prose-h2:mb-4 prose-h2:pb-2 prose-h2:border-b prose-h2:border-border
                       prose-h3:text-base prose-h3:mt-6 prose-h3:mb-3 prose-h3:text-primary
                       prose-p:text-text-secondary prose-p:leading-7 prose-p:mt-3 prose-p:mb-3
                       prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                       prose-strong:text-text prose-strong:font-semibold
                       prose-code:bg-surface-light prose-code:text-primary prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[13px] prose-code:font-normal
                       prose-pre:bg-gray-50 prose-pre:border prose-pre:border-border prose-pre:rounded-xl prose-pre:shadow-sm
                       prose-pre:px-4 prose-pre:py-3 prose-pre:text-[13px] prose-pre:leading-relaxed
                       prose-table:border prose-table:border-border prose-table:rounded-lg
                       prose-th:bg-surface-light prose-th:px-3 prose-th:py-2.5 prose-th:text-xs prose-th:font-semibold prose-th:text-text
                       prose-td:px-3 prose-td:py-2 prose-td:text-sm prose-td:text-text-secondary
                       prose-tr:border-b prose-tr:border-border/50
                       prose-li:text-text-secondary prose-li:leading-relaxed prose-li:my-1
                       prose-ul:my-3 prose-ol:my-3
                       prose-blockquote:border-l-3 prose-blockquote:border-primary/30 prose-blockquote:bg-primary/5
                       prose-blockquote:rounded-r-lg prose-blockquote:px-4 prose-blockquote:py-2 prose-blockquote:my-4
                       prose-blockquote:text-text-secondary prose-blockquote:not-italic
                       prose-img:rounded-lg
                       [&_table]:border-collapse [&_table]:overflow-hidden
                       [&_hr]:my-8 [&_hr]:border-border"
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
          />
        </div>
      </div>
    </div>
  )
}
