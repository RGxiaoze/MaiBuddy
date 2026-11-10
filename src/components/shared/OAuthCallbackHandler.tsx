// ============================================================
// OAuthCallbackHandler
//
// 挂在应用顶层，负责接收账号授权后的回调：
// ?code=...&state=... → 按来源换票 → 拉取完整成绩 → 写入本地
//
// 支持水鱼（df）与落雪（lxns）两家，来源由发起授权时写入的 provider id 决定。
// ============================================================

import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { readCallbackError, readCallbackParams, readPendingProviderId } from '@/services/oauthCore'
import type { TokenSet } from '@/services/oauthCore'
import * as dfOAuth from '@/services/dfOAuth'
import * as lxnsOAuth from '@/services/lxnsOAuth'
import { usePlayerStore } from '@/store/playerStore'

type Status = 'idle' | 'working' | 'done' | 'error'

interface CallbackProvider {
  name: string
  consumeVerifier: (state: string) => string
  exchangeCode: (code: string, verifier: string) => Promise<TokenSet>
  saveToken: (token: TokenSet) => void
  importScores: (accessToken: string) => Promise<{ imported: number; updated: number }>
}

const PROVIDERS: Record<string, CallbackProvider> = {
  df: {
    name: '水鱼',
    consumeVerifier: dfOAuth.consumeVerifier,
    exchangeCode: dfOAuth.exchangeCode,
    saveToken: dfOAuth.saveToken,
    importScores: (accessToken) => usePlayerStore.getState().importScoresViaOAuth(accessToken),
  },
  lxns: {
    name: '落雪',
    consumeVerifier: lxnsOAuth.consumeVerifier,
    exchangeCode: lxnsOAuth.exchangeCode,
    saveToken: lxnsOAuth.saveToken,
    importScores: (accessToken) => usePlayerStore.getState().importScoresViaLxns(accessToken),
  },
}

/** 常见回调错误的友好文案；未列出的回落到 error_description 或原始 error */
const CALLBACK_ERROR_TEXT: Record<string, string> = {
  access_denied: '你在授权页拒绝了授权申请，未获得任何数据',
}

export default function OAuthCallbackHandler() {
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    // 拒绝授权等失败回调只有 error、没有 code，先于正常流程处理
    const cbError = readCallbackError()
    if (cbError) {
      window.history.replaceState({}, '', window.location.pathname)
      setMessage(
        CALLBACK_ERROR_TEXT[cbError.error]
          ?? (cbError.description || `授权未完成（${cbError.error}）`),
      )
      setStatus('error')
      return
    }

    const cb = readCallbackParams()
    if (!cb) return

    // 立刻清掉 URL 上的授权码，避免刷新时重复消费（授权码是一次性的）
    window.history.replaceState({}, '', window.location.pathname)

    setStatus('working')
    ;(async () => {
      try {
        const provider = PROVIDERS[readPendingProviderId() ?? '']
        if (!provider) throw new Error('找不到本次授权的来源，请重新发起登录')

        const verifier = provider.consumeVerifier(cb.state)
        const token = await provider.exchangeCode(cb.code, verifier)
        provider.saveToken(token)

        const result = await provider.importScores(token.accessToken)
        setMessage(`${provider.name}授权成功，已导入 ${result.imported + result.updated} 条成绩`)
        setStatus('done')
      } catch (err) {
        setMessage(err instanceof Error ? err.message : '授权失败，请重试')
        setStatus('error')
      }
    })()
  }, [navigate])

  /** 成功后收起提示：1 秒自动消失，或用户点任意处立刻收起 */
  const dismissDone = useCallback(() => {
    setStatus('idle')
    navigate('/player')
  }, [navigate])

  useEffect(() => {
    if (status !== 'done') return
    const timer = setTimeout(dismissDone, 1000)
    return () => clearTimeout(timer)
  }, [status, dismissDone])

  if (status === 'idle') return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={status === 'done' ? dismissDone : undefined}
    >
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
