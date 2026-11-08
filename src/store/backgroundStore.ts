// ============================================================
// 全局页面背景
//
// 每个页面把「本页出现的第一个封面」注册进来，MainLayout 统一渲染。
// 页面若没有封面（使用指南、更新记录等），保留上一个页面的，
// 避免背景突然消失造成闪烁。
// ============================================================

import { create } from 'zustand'

interface BackgroundState {
  /** 当前背景图 URL（null 表示尚无） */
  coverUrl: string | null
  /** 设置背景；页面卸载时不要清空，以便下一个无封面页面继承 */
  setCover: (url: string) => void
}

export const useBackgroundStore = create<BackgroundState>((set) => ({
  coverUrl: null,
  setCover: (url) => set((state) => (state.coverUrl === url ? state : { coverUrl: url })),
}))
