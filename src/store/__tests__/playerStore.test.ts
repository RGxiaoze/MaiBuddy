import { describe, it, expect, beforeEach } from 'vitest'
import { usePlayerStore } from '../playerStore'

const emptyOnline = {
  onlinePlayerName: '',
  onlineRating: 0,
  onlineBest35: [],
  onlineBest15: [],
  onlineLoading: false,
  onlineError: null,
}

const emptyLocal = {
  localB50: null,
  importedPlayerName: '',
  importedRating: 0,
}

const localSample = {
  best35: [],
  best15: [],
  best35Total: 0,
  best15Total: 0,
  totalRating: 16223,
}

describe('playerStore：本地与在线两套数据互不干扰', () => {
  beforeEach(() => {
    usePlayerStore.setState({ ...emptyOnline, ...emptyLocal })
  })

  it('clearLocalPlayer 只清本地三项，在线数据原样保留', () => {
    usePlayerStore.setState({
      localB50: localSample,
      importedPlayerName: '本地玩家',
      importedRating: 16223,
      onlinePlayerName: '在线玩家',
      onlineRating: 16456,
    })

    usePlayerStore.getState().clearLocalPlayer()

    const s = usePlayerStore.getState()
    expect(s.localB50).toBeNull()
    expect(s.importedPlayerName).toBe('')
    expect(s.importedRating).toBe(0)
    // 在线那一套不应被牵连
    expect(s.onlinePlayerName).toBe('在线玩家')
    expect(s.onlineRating).toBe(16456)
  })

  it('clearQuery 只清在线数据，本地数据原样保留', () => {
    usePlayerStore.setState({
      localB50: localSample,
      importedPlayerName: '本地玩家',
      importedRating: 16223,
      onlinePlayerName: '在线玩家',
      onlineRating: 16456,
    })

    usePlayerStore.getState().clearQuery()

    const s = usePlayerStore.getState()
    expect(s.onlinePlayerName).toBe('')
    expect(s.onlineRating).toBe(0)
    // 本地那一套不应被牵连
    expect(s.localB50).not.toBeNull()
    expect(s.importedPlayerName).toBe('本地玩家')
    expect(s.importedRating).toBe(16223)
  })

  it('初始状态下两套数据都是空的', () => {
    const s = usePlayerStore.getState()
    expect(s.localB50).toBeNull()
    expect(s.onlinePlayerName).toBe('')
    expect(s.onlineBest35).toEqual([])
    expect(s.onlineBest15).toEqual([])
  })
})
