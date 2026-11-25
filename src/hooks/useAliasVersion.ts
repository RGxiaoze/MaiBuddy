// ============================================================
// useAliasVersion — 订阅别名索引版本号
//
// 别名异步加载，而筛选结果是 useMemo 缓存。把这个版本号放进依赖数组，
// 别名到货时会自动重算，不需要用户再输入一次。
// ============================================================

import { useSyncExternalStore } from 'react'
import { getAliasVersion, subscribeAliasVersion } from '@/data/aliases'

export function useAliasVersion(): number {
  return useSyncExternalStore(subscribeAliasVersion, getAliasVersion, () => 0)
}
