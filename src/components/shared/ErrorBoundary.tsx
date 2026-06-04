// ============================================================
// ErrorBoundary — catch render errors and show fallback UI
// ============================================================

import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** Optional custom title for the error display */
  title?: string
}

interface State {
  error: Error | null
  hasError: boolean
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { error: null, hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { error, hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error.message, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-surface border border-border rounded-lg p-6 text-center max-w-lg mx-auto mt-8">
          <h3 className="text-base font-semibold text-error mb-2">
            {this.props.title || '页面渲染出错'}
          </h3>
          <pre className="text-xs text-text-secondary bg-bg-gray rounded p-3 text-left overflow-auto max-h-48 mb-3 whitespace-pre-wrap break-all">
            {this.state.error?.message || '未知错误'}
          </pre>
          <button
            onClick={() => this.setState({ error: null, hasError: false })}
            className="px-4 py-1.5 text-sm bg-primary text-white rounded hover:bg-primary/90 transition-colors cursor-pointer border-none"
          >
            重试
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
