import { useCallback, useEffect, useRef } from 'react'

// 同じブラウザの別ウィンドウ(メインと発表者モード)でページ番号をそろえる。現行版と同じチャンネル名とメッセージ。
const CHANNEL = 'rimodeck_slide_sync'

type SyncMessage = { type: 'sync_page'; data: { pageNum: number } } | { type: 'request_init' }

// - 相手からページ番号が届いたら onPage を呼ぶ
// - 発表者モードのウィンドウは、開いた直後に request_init で現在のページを尋ねる(メイン側が sync_page で答える)
export function usePageSync(presenter: boolean, getPage: () => number, onPage: (n: number) => void) {
  const channelRef = useRef<BroadcastChannel | null>(null)
  const getPageRef = useRef(getPage)
  const onPageRef = useRef(onPage)
  useEffect(() => {
    getPageRef.current = getPage
    onPageRef.current = onPage
  })

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return // 古いブラウザでは、同期なしで動かす
    const channel = new BroadcastChannel(CHANNEL)
    channelRef.current = channel
    channel.onmessage = (event: MessageEvent<SyncMessage>) => {
      const message = event.data
      if (message.type === 'sync_page') {
        onPageRef.current(message.data.pageNum)
      } else if (message.type === 'request_init' && !presenter) {
        const page = getPageRef.current()
        if (page > 0) channel.postMessage({ type: 'sync_page', data: { pageNum: page } } satisfies SyncMessage)
      }
    }
    if (presenter) channel.postMessage({ type: 'request_init' } satisfies SyncMessage)
    return () => {
      channel.close()
      channelRef.current = null
    }
  }, [presenter])

  return useCallback((pageNum: number) => {
    channelRef.current?.postMessage({ type: 'sync_page', data: { pageNum } } satisfies SyncMessage)
  }, [])
}

// 発表者モードのウィンドウを、いまの URL に presenter=true を付けて開く
export function openPresenterWindow() {
  const url = new URL(window.location.href)
  url.searchParams.set('presenter', 'true')
  window.open(
    url.toString(),
    'PresenterMode',
    `width=${screen.availWidth},height=${screen.availHeight},menubar=no,toolbar=no,location=no,status=no`,
  )
}
