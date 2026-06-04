// ============================================================
// Footer — page footer with sponsor/GitHub links + version
// ============================================================

import { ExternalLink, Heart } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="mt-6 pt-4 border-t border-border">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Version */}
        <span className="text-xs text-text-tertiary">
          舞萌DX 伴侣 v0.4.0
        </span>

        {/* Links */}
        <div className="flex items-center gap-4">
          <a
            href="#"
            className="flex items-center gap-1.5 text-xs text-text-tertiary no-underline
                       hover:text-primary transition-colors"
            title="支持开发（暂未开放）"
          >
            <Heart size={14} />
            <span>支持开发</span>
          </a>
          <a
            href="#"
            className="flex items-center gap-1.5 text-xs text-text-tertiary no-underline
                       hover:text-primary transition-colors"
            title="GitHub（暂未开放）"
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink size={14} />
            <span>GitHub</span>
          </a>
        </div>
      </div>
    </footer>
  )
}
