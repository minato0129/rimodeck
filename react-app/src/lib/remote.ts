import { useCallback, useEffect, useRef, useState } from 'react'
import { wsUrl } from './ws'

// Remote(スマホ)から Viewer(PC)へ送る操作
export type RemoteCommand = 'next' | 'prev' | 'fullscreen_start' | 'fullscreen_end'

// サーバーからのメッセージ(Go の ReturnMessage)
type ServerMessage = { type: string; status?: number; data?: string }

export type ConnectionState = 'missing-id' | 'connecting' | 'connected' | 'closed' | 'error'

// Remote 画面の WebSocket 接続。viewerId は URL の ?id=...(PC 側の QR コードに入っている)。
// 現行版と同じく /ws にはパラメータなしで接続し、ID は操作メッセージの中で指定する。
export function useRemote(viewerId: string | null, onServerError: (text: string) => void) {
  const wsRef = useRef<WebSocket | null>(null)
  const [connState, setConnState] = useState<ConnectionState>('connecting')

  // 最新のコールバックを ref に持つ(接続をつなぎ直さずに差し替えられるようにする)
  const errorHandler = useRef(onServerError)
  useEffect(() => {
    errorHandler.current = onServerError
  }, [onServerError])

  useEffect(() => {
    if (!viewerId) return
    const ws = new WebSocket(wsUrl('/ws'))
    wsRef.current = ws
    let everConnected = false

    ws.onopen = () => {
      everConnected = true
      setConnState('connected')
    }
    ws.onmessage = (evt) => {
      // 接続直後にサーバーが ID を生の文字列で送ってくる。JSON でないものは無視する。
      let message: ServerMessage
      try {
        message = JSON.parse(evt.data)
      } catch {
        return
      }
      if (message.type === 'error' && message.data) errorHandler.current(message.data)
    }
    ws.onerror = () => setConnState('error')
    // 繋がる前のエラーは、続く close で上書きせずエラー表示のままにする
    ws.onclose = () => setConnState((s) => (s === 'error' && !everConnected ? 'error' : 'closed'))

    return () => {
      ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null
      ws.close()
      wsRef.current = null
    }
  }, [viewerId])

  // 送信できたら true
  const send = useCallback(
    (command: RemoteCommand): boolean => {
      const ws = wsRef.current
      if (!ws || ws.readyState !== WebSocket.OPEN || !viewerId) return false
      // Go の Message 型に合わせる
      ws.send(JSON.stringify({ type: 'user_message', id: viewerId, data: command }))
      return true
    },
    [viewerId],
  )

  return { state: viewerId ? connState : ('missing-id' as const), send }
}
