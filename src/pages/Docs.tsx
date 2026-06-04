// ============================================================
// Docs page — renders docs/ markdown files
// ============================================================

import { useEffect, useState, useMemo } from 'react'
import { marked } from 'marked'
import { BookOpen, ExternalLink, FileText } from 'lucide-react'

interface DocEntry {
  path: string
  title: string
  content: string
}

export default function Docs() {
  const [docs, setDocs] = useState<DocEntry[] | null>(null)
  const [activePath, setActivePath] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/docs-index.json')
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
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookOpen className="w-7 h-7 text-primary" />
          <h1 className="text-2xl font-bold text-text">开发文档</h1>
        </div>
        <a
          href="#"
          className="flex items-center gap-1.5 text-sm text-primary hover:underline"
          title="GitHub（暂未开放）"
          target="_blank"
          rel="noopener noreferrer"
        >
          <ExternalLink size={16} />
          在 GitHub 查看
        </a>
      </div>

      {/* Layout: sidebar nav + content */}
      <div className="flex gap-6">
        {/* Doc list sidebar */}
        <nav className="w-52 shrink-0 space-y-1">
          {docs.map((doc) => (
            <button
              key={doc.path}
              onClick={() => setActivePath(doc.path)}
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

        {/* Content area */}
        <div className="flex-1 min-w-0">
          <article
            className="bg-white rounded-xl shadow-sm p-6 md:p-8
                       prose prose-sm max-w-none
                       prose-headings:text-text prose-headings:font-semibold
                       prose-h2:text-lg prose-h2:border-b prose-h2:border-border prose-h2:pb-2 prose-h2:mt-8 prose-h2:mb-4
                       prose-h3:text-base prose-h3:mt-6 prose-h3:mb-3
                       prose-p:text-text-secondary prose-p:leading-relaxed
                       prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                       prose-code:bg-surface-light prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
                       prose-pre:bg-surface-light prose-pre:rounded-lg
                       prose-table:border prose-table:border-border
                       prose-th:bg-surface-light prose-th:px-3 prose-th:py-2 prose-th:text-xs
                       prose-td:px-3 prose-td:py-2 prose-td:text-sm
                       prose-li:text-text-secondary
                       [&_table]:border-collapse"
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
          />
        </div>
      </div>
    </div>
  )
}
