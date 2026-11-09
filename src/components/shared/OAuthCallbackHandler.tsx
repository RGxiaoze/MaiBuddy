// ============================================================
// OAuthCallbackHandler
//
// 挂在应用顶层，负责接收水鱼账号授权后的回调：
// ?code=...&state=... → 换票 → 拉取完整成绩 → 写入本地
// ============================================================

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { readCallbackParams, consumeVerifier, exchangeCode, saveToken } from '@/services/dfOAuth'
import { usePlayerStore } from '@/store/playerStore'

type Status = 'idle' | 'working' | 'done' | 'error'

export default function OAuthCallbackHandler() {
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const cb = readCallbackParams()
    if (!cb) return

    // 立刻清掉 URL 上的授权码，避免刷新时重复消费（授权码是一次性的）
    window.history.replaceState({}, '', window.location.pathname)

    setStatus('working')
    ;(async () => {
      try {
        const verifier = consumeVerifier(cb.state)
        const token = await exchangeCode(cb.code, verifier)
        saveToken(token)

        const result = await usePlayerStore.getState().importScoresViaOAuth(token.accessToken)
        setMessage(`已授权并导入 ${result.imported + result.updated} 条成绩`)
        setStatus('done')
        setTimeout(() => { navigate('/player') }, 1500)
      } catch (err) {
        setMessage(err instanceof Error ? err.message : '授权失败，请重试')
        setStatus('error')
      }
    })()
  }, [navigate])

  if (status === 'idle') return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-surface border border-border rounded-lg p-6 max-w-sm w-full text-center shadow-lg">
        {status === 'working' && (
          <>
            <Loader2 size={28} className="mx-auto text-primary animate-spin" />
            <p className="text-sm font-medium text-text mt-3">正在完成授权并导入成绩…</p>
            <p className="text-xs text-text-tertiary mt-1">请勿关闭页面</p>
          </>
        )}
        {status === 'done' && (
          <>
            <CheckCircle2 size={28} className="mx-auto text-success" />
            <p className="text-sm font-medium text-text mt-3">{message}</p>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle size={28} className="mx-auto text-error" />
            <p className="text-sm font-medium text-text mt-3">授权未完成</p>
            <p className="text-xs text-text-secondary mt-1 break-words">{message}</p>
            <button
              onClick={() => { setStatus('idle'); navigate('/songs') }}
              className="mt-4 px-4 py-2 rounded-md text-xs font-medium bg-primary text-white border-none cursor-pointer hover:bg-primary-dark transition-colors"
            >
              返回
            </button>
          </>
        )}
      </div>
    </div>
  )
}
