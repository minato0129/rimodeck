// スマホのリモート画面の配置(どのボタンを、どの大きさ・色で、どの順に並べるか)。
// 使える値は、サーバー(go-server/src/remote_layout.go)の検証と合わせる。
import { useEffect, useState } from 'react'
import type { RemoteCommand } from './remote'

export type ButtonWidth = 'half' | 'full'
export type Level = 's' | 'm' | 'l'
export type ButtonColor = 'white' | 'gray' | 'blue' | 'green' | 'red' | 'dark'

export type LayoutButton = {
  id: RemoteCommand
  width: ButtonWidth
  height: Level
  color: ButtonColor
  textSize: Level
}

export type RemoteLayout = { buttons: LayoutButton[] }

// ボタンの種類。id は、PC に送る操作の名前と同じ
export const BUTTONS: Record<RemoteCommand, { icon: string; label: string }> = {
  prev: { icon: 'arrow_back_ios', label: '前のスライド' },
  next: { icon: 'arrow_forward_ios', label: '次のスライド' },
  first: { icon: 'first_page', label: '最初へ' },
  last: { icon: 'last_page', label: '最後へ' },
  blank: { icon: 'visibility_off', label: '黒画面' },
}
export const BUTTON_IDS = Object.keys(BUTTONS) as RemoteCommand[]

export const COLORS: Record<ButtonColor, { name: string; button: string; swatch: string }> = {
  white: { name: '白', button: 'bg-white text-gray-700 active:bg-gray-100', swatch: 'bg-white border border-gray-300' },
  gray: { name: '灰', button: 'bg-gray-200 text-gray-800 active:bg-gray-300', swatch: 'bg-gray-200' },
  blue: { name: '青', button: 'bg-primary-blue text-white active:opacity-80', swatch: 'bg-primary-blue' },
  green: { name: '緑', button: 'bg-green-600 text-white active:bg-green-700', swatch: 'bg-green-600' },
  red: { name: '赤', button: 'bg-red-600 text-white active:bg-red-700', swatch: 'bg-red-600' },
  dark: { name: '黒', button: 'bg-gray-800 text-white active:bg-gray-700', swatch: 'bg-gray-800' },
}

export const LEVEL_NAMES: Record<Level, string> = { s: '小', m: '中', l: '大' }
// 高さは「これ以上」の値。余った空きは、行で分け合って広がる
export const HEIGHT_CLASS: Record<Level, string> = { s: 'min-h-20', m: 'min-h-32', l: 'min-h-48' }
export const TEXT_CLASS: Record<Level, string> = { s: 'text-base', m: 'text-lg', l: 'text-2xl' }
export const ICON_CLASS: Record<Level, string> = { s: 'text-[32px]', m: 'text-[48px]', l: 'text-[64px]' }

export function newButton(id: RemoteCommand): LayoutButton {
  return { id, width: 'half', height: 'm', color: 'white', textSize: 'm' }
}

// 初期状態(これまでと同じ、前・次の 2 ボタン)
export const DEFAULT_LAYOUT: RemoteLayout = {
  buttons: [
    { id: 'prev', width: 'half', height: 'l', color: 'white', textSize: 'm' },
    { id: 'next', width: 'half', height: 'l', color: 'white', textSize: 'm' },
  ],
}

export const MAX_BUTTONS = BUTTON_IDS.length

// サーバーの配置は信用しすぎず、知っている値だけ通す
function sanitize(value: unknown): RemoteLayout | null {
  if (typeof value !== 'object' || value === null || !Array.isArray((value as RemoteLayout).buttons)) return null
  const buttons: LayoutButton[] = []
  for (const b of (value as RemoteLayout).buttons) {
    if (!b || !(b.id in BUTTONS) || buttons.some((x) => x.id === b.id)) continue
    buttons.push({
      id: b.id,
      width: b.width === 'full' ? 'full' : 'half',
      height: b.height in LEVEL_NAMES ? b.height : 'm',
      color: b.color in COLORS ? b.color : 'white',
      textSize: b.textSize in LEVEL_NAMES ? b.textSize : 'm',
    })
  }
  return { buttons }
}

async function errorText(response: Response, fallback: string): Promise<string> {
  try {
    const body: { error?: string } = await response.json()
    return body.error ?? fallback
  } catch {
    return fallback
  }
}

const url = (viewerId: string) => `/remote-layout?id=${encodeURIComponent(viewerId)}`

async function fetchLayout(viewerId: string, signal: AbortSignal): Promise<RemoteLayout | null> {
  const response = await fetch(url(viewerId), { signal })
  if (!response.ok) throw new Error(await errorText(response, '配置を読み込めませんでした。'))
  const body: { layout: unknown } = await response.json()
  return body.layout === null ? null : sanitize(body.layout)
}

export async function saveLayout(viewerId: string, layout: RemoteLayout): Promise<RemoteLayout> {
  const response = await fetch(url(viewerId), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(layout),
  })
  if (!response.ok) throw new Error(await errorText(response, '配置を保存できませんでした。'))
  const body: { layout: unknown } = await response.json()
  return sanitize(body.layout) ?? layout
}

export async function resetLayout(viewerId: string): Promise<void> {
  const response = await fetch(url(viewerId), { method: 'DELETE' })
  if (!response.ok) throw new Error(await errorText(response, '配置を戻せませんでした。'))
}

// 保存してある配置を読み込む。読み込むまでは layout が undefined。
// 保存が無い・読み込めないときは初期状態にする(失敗の理由は error)
export function useRemoteLayout(viewerId: string | null) {
  const [layout, setLayout] = useState<RemoteLayout | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!viewerId) return
    const controller = new AbortController()
    fetchLayout(viewerId, controller.signal)
      .then((saved) => setLayout(saved ?? DEFAULT_LAYOUT))
      .catch((e: unknown) => {
        if (controller.signal.aborted) return
        setError(e instanceof Error ? e.message : String(e))
        setLayout(DEFAULT_LAYOUT)
      })
    return () => controller.abort()
  }, [viewerId])

  return { layout: viewerId ? layout : DEFAULT_LAYOUT, setLayout, error }
}
