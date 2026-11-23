import { useCallback, useEffect, useRef } from 'react'

// 同じブラウザの別ウィンドウ(メインと発表者モード)でページ番号をそろえる。現行版と同じチャンネル名とメッセージ。
const CHANNEL = 'rimodeck_slide_sync'

type SyncMessage = { type: 'sync_page'; data: { pageNum: number } } | { type: 'request_init' }

// - 相手からページ番号が届いたら onPage を呼ぶ
// - 発表者モードのウィンドウは、開いた直後に request_init で現在のページを尋ねる(メイン側が sync_page で答える)
// - メイン側は、発表者モードのウィンドウが開いたときに onPresenterOpened を呼ぶ(動画の音を、そちらだけで出すため)
export function usePageSync(
  presenter: boolean,
  getPage: () => number,
  onPage: (n: number) => void,
  onPresenterOpened?: () => void,
) {
  const channelRef = useRef<BroadcastChannel | null>(null)
  const getPageRef = useRef(getPage)
  const onPageRef = useRef(onPage)
  const onPresenterOpenedRef = useRef(onPresenterOpened)
  useEffect(() => {
    getPageRef.current = getPage
    onPageRef.current = onPage
    onPresenterOpenedRef.current = onPresenterOpened
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
        onPresenterOpenedRef.current?.()
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

const BLANK_CHANNEL = 'rimodeck_blank_sync'

type BlankMessage = { type: 'blank'; blank: boolean } | { type: 'request_blank' }

// 黒画面の入り切りを、メインと発表者モードの別ウィンドウでそろえる(スマホの「黒画面」ボタンはメインに届く)。
// 発表者モードのウィンドウは、開いた直後に request_blank で現在の状態を尋ねる。
export function useBlankSync(presenter: boolean, getBlank: () => boolean, onBlank: (blank: boolean) => void) {
  const channelRef = useRef<BroadcastChannel | null>(null)
  const getBlankRef = useRef(getBlank)
  const onBlankRef = useRef(onBlank)
  useEffect(() => {
    getBlankRef.current = getBlank
    onBlankRef.current = onBlank
  })

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return
    const channel = new BroadcastChannel(BLANK_CHANNEL)
    channelRef.current = channel
    channel.onmessage = (event: MessageEvent<BlankMessage>) => {
      const message = event.data
      if (message.type === 'blank') {
        onBlankRef.current(message.blank)
      } else if (message.type === 'request_blank' && !presenter) {
        channel.postMessage({ type: 'blank', blank: getBlankRef.current() } satisfies BlankMessage)
      }
    }
    if (presenter) channel.postMessage({ type: 'request_blank' } satisfies BlankMessage)
    return () => {
      channel.close()
      channelRef.current = null
    }
  }, [presenter])

  return useCallback((blank: boolean) => {
    channelRef.current?.postMessage({ type: 'blank', blank } satisfies BlankMessage)
  }, [])
}
