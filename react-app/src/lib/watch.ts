import { useEffect, useState } from 'react'
import { wsUrl } from './ws'

// 傾聴者の接続状態
// - connecting: 接続中 / live: 接続済み / reconnecting: 切れたので再接続中 / ended: 共有が終了した(または無効なリンク)
export type WatchStatus = 'connecting' | 'live' | 'reconnecting' | 'ended'

type ServerMessage = { type: string; status?: number; data?: string }

const RECONNECT_MS = 2000

// 発表者のページを WebSocket で受け取る。スマホは画面を閉じると切れるので、切れたら繋ぎ直す。
// serverPage: 発表者がいま表示しているページ(まだ分からない間は null)
export function useWatchSocket(token: string) {
  const [serverPage, setServerPage] = useState<number | null>(null)
  const [status, setStatus] = useState<WatchStatus>('connecting')

  useEffect(() => {
    let ws: WebSocket | null = null
    let timer = 0
    let stopped = false

    function connect() {
      ws = new WebSocket(wsUrl(`/ws/watch?token=${encodeURIComponent(token)}`))
      ws.onopen = () => setStatus('live')
      ws.onmessage = (evt) => {
        let message: ServerMessage
        try {
          message = JSON.parse(String(evt.data))
        } catch (e) {
          console.error('Unexpected message:', e)
          return
        }
        if (message.type === 'share_state') {
          try {
            const state: { page: number } = JSON.parse(message.data ?? '{}')
            if (state.page >= 1) setServerPage(state.page)
          } catch (e) {
            console.error('Failed to parse share_state:', e)
          }
        } else if (message.type === 'share_page') {
          const page = Number(message.data)
          if (page >= 1) setServerPage(page)
        } else if (message.type === 'share_ended') {
          stopped = true
          setStatus('ended')
        }
      }
      ws.onclose = () => {
        if (stopped) return
        setStatus('reconnecting')
        timer = window.setTimeout(connect, RECONNECT_MS)
      }
    }
    connect()

    return () => {
      stopped = true
      window.clearTimeout(timer)
      if (ws) {
        ws.onopen = ws.onmessage = ws.onclose = null
        ws.close()
      }
    }
  }, [token])

  return { serverPage, status }
}
