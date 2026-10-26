import { useCallback, useEffect, useRef, useState } from 'react'
import { wsUrl } from './ws'

// Viewer が Remote(スマホ)などに知らせる現在の状態(Go 側はこの JSON を文字列のまま中継する)
export type ViewerStatus = { page_index: number; pdf_path: string }

// QR コードのポップアップに出す接続の状態
export type SocketStatus = 'issuing' | 'issued' | 'closed' | 'error'

type Api = { sendStatus: (status: ViewerStatus) => void }

type Handlers = {
  // Remote からの操作('next' / 'prev' / 'ping' など)
  onRemoteCommand: (command: string, api: Api) => void
  // 同じ ID の別の Viewer(発表者モードの別ウィンドウなど)からの状態
  onPeerStatus: (status: Partial<ViewerStatus>) => void
}

type ServerMessage = { type: string; status?: number; data?: string }

// Viewer の WebSocket 接続。
// - existingId なし: 接続すると、サーバーが新しい ID を「生の文字列」で最初に送ってくる
// - existingId あり: /ws?id=... で既存の ID に参加する(別ウィンドウ用)
export function useViewerSocket(existingId: string | null, handlers: Handlers) {
  const wsRef = useRef<WebSocket | null>(null)
  const handlersRef = useRef(handlers)
  useEffect(() => {
    handlersRef.current = handlers
  })

  const [viewerId, setViewerId] = useState<string | null>(existingId)
  const [status, setStatus] = useState<SocketStatus>('issuing')

  const sendStatus = useCallback((s: ViewerStatus) => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'viewer_update', data: JSON.stringify(s) }))
    }
  }, [])

  useEffect(() => {
    const ws = new WebSocket(wsUrl(existingId ? `/ws?id=${encodeURIComponent(existingId)}` : '/ws'))
    wsRef.current = ws
    let id = existingId
    let everOpened = false

    ws.onopen = () => {
      everOpened = true
      if (id) setStatus('issued')
    }

    ws.onmessage = (evt) => {
      const text = String(evt.data)

      // 1. 接続直後にサーバーが送る Viewer ID
      if (id === null && !text.startsWith('{"type":')) {
        id = text
        setViewerId(text)
        setStatus('issued')
        return
      }

      // 2. JSON のメッセージ
      let message: ServerMessage
      try {
        message = JSON.parse(text)
      } catch (e) {
        console.error('Received unexpected message or error:', e, text)
        return
      }

      if (message.type === 'remote_control' && message.status === 200) {
        handlersRef.current.onRemoteCommand(message.data ?? '', { sendStatus })
      } else if (message.type === 'viewer_status' && message.status === 200) {
        try {
          handlersRef.current.onPeerStatus(JSON.parse(message.data ?? '{}'))
        } catch (e) {
          console.error('Failed to parse viewer_status data:', e)
        }
      } else if (message.type === 'error') {
        console.error('WebSocket Error:', message.data)
      }
    }

    ws.onerror = () => setStatus('error')
    // 繋がる前のエラーは、続く close で上書きせずエラー表示のままにする
    ws.onclose = () => setStatus((s) => (s === 'error' && !everOpened ? 'error' : 'closed'))

    return () => {
      ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null
      ws.close()
      wsRef.current = null
    }
  }, [existingId, sendStatus])

  return { viewerId, status, sendStatus }
}
