// スマホのリモート画面の編集モード。
// - テンプレートから選ぶ
// - 本物と同じ並びで見せたボタンを、ドラッグして好きな場所へ動かす(矢印キーでも動かせる)
// - ボタンを押すと、そのボタンの大きさ(幅・高さ・文字)を変えられる
// - ボタンの追加・削除
import { useCallback, useEffect, useRef, useState } from 'react'
import Icon from './Icon'
import {
  BUTTONS,
  BUTTON_IDS,
  COLORS,
  HEIGHT_EDIT,
  HEIGHT_PREVIEW,
  LEVEL_NAMES,
  TEMPLATES,
  matchTemplate,
  newButton,
  type ButtonWidth,
  type LayoutButton,
  type Level,
  type RemoteLayout,
} from '../lib/remoteLayout'
import type { RemoteCommand } from '../lib/remote'

type Props = {
  draft: RemoteLayout
  onChange: (layout: RemoteLayout) => void
  onSave: () => void
  onCancel: () => void
  onReset: () => void
  saving: boolean
  error: string | null
}

const LEVELS: Level[] = ['s', 'm', 'l']
const WIDTHS: [ButtonWidth, string][] = [
  ['half', '半分'],
  ['full', '全幅'],
]
const EDGE_PX = 80 // 画面の上下の端に近づいたら、自動でスクロールする幅
const SCROLL_PX = 12

// buttons の中で、id のボタンを to 番目へ動かした配列
function moveTo(buttons: LayoutButton[], id: RemoteCommand, to: number): LayoutButton[] {
  const from = buttons.findIndex((b) => b.id === id)
  if (from < 0 || to < 0 || to >= buttons.length || from === to) return buttons
  const next = [...buttons]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

export default function RemoteLayoutEditor({ draft, onChange, onSave, onCancel, onReset, saving, error }: Props) {
  const buttons = draft.buttons
  const matched = matchTemplate(draft)
  const unused = BUTTON_IDS.filter((id) => !buttons.some((b) => b.id === id))
  const [selectedId, setSelectedId] = useState<RemoteCommand | null>(null)
  const selected = buttons.find((b) => b.id === selectedId) ?? null

  // --- ドラッグ ---
  // ドラッグ中は、指(ポインター)の下にあるボタンの位置へ、動かしているボタンを入れ替えていく
  const [dragId, setDragId] = useState<RemoteCommand | null>(null)
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null)
  const buttonsRef = useRef(buttons)
  const onChangeRef = useRef(onChange)
  const pointerYRef = useRef(0)
  useEffect(() => {
    buttonsRef.current = buttons
    onChangeRef.current = onChange
  })

  useEffect(() => {
    if (!dragId) return
    function onMove(e: PointerEvent) {
      setPointer({ x: e.clientX, y: e.clientY })
      pointerYRef.current = e.clientY
      const tile = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-tile-id]')
      const overId = tile?.dataset.tileId as RemoteCommand | undefined
      if (!overId || overId === dragId) return
      const to = buttonsRef.current.findIndex((b) => b.id === overId)
      const next = moveTo(buttonsRef.current, dragId!, to)
      if (next !== buttonsRef.current) onChangeRef.current({ buttons: next })
    }
    function end() {
      setDragId(null)
      setPointer(null)
    }
    // 上下の端に近づいたら、画面を動かす(長い配置でも、端まで運べるように)
    const timer = window.setInterval(() => {
      const y = pointerYRef.current
      if (y < EDGE_PX) window.scrollBy(0, -SCROLL_PX)
      else if (y > window.innerHeight - EDGE_PX) window.scrollBy(0, SCROLL_PX)
    }, 16)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
    }
  }, [dragId])

  const startDrag = useCallback((id: RemoteCommand, e: React.PointerEvent) => {
    e.preventDefault()
    pointerYRef.current = e.clientY
    setPointer({ x: e.clientX, y: e.clientY })
    setSelectedId(id)
    setDragId(id)
  }, [])

  function update(id: RemoteCommand, patch: Partial<LayoutButton>) {
    onChange({ buttons: buttons.map((b) => (b.id === id ? { ...b, ...patch } : b)) })
  }
  function remove(id: RemoteCommand) {
    onChange({ buttons: buttons.filter((b) => b.id !== id) })
    if (selectedId === id) setSelectedId(null)
  }
  function add(id: RemoteCommand) {
    onChange({ buttons: [...buttons, newButton(id)] })
    setSelectedId(id)
  }
  // 矢印キーでも動かせる(ドラッグしにくい人・キーボード操作の人向け)
  function onHandleKeyDown(id: RemoteCommand, e: React.KeyboardEvent) {
    const index = buttons.findIndex((b) => b.id === id)
    const delta = e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : 0
    if (delta === 0) return
    e.preventDefault()
    onChange({ buttons: moveTo(buttons, id, index + delta) })
  }

  return (
    <div className="flex grow flex-col gap-4 p-4 pt-2">
      <section aria-labelledby="template-title">
        <h2 id="template-title" className="mb-2 text-sm font-bold text-gray-700">
          テンプレートから選ぶ
        </h2>
        <ul className="grid grid-cols-3 gap-2">
          {TEMPLATES.map((template) => {
            const isSelected = matched?.id === template.id
            return (
              <li key={template.id}>
                <button
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => {
                    onChange(template.layout)
                    setSelectedId(null)
                  }}
                  className={`flex h-full w-full flex-col gap-2 rounded-[0.75rem] bg-white p-2 text-left shadow ${
                    isSelected ? 'ring-2 ring-primary-blue' : ''
                  }`}
                >
                  <TemplatePreview layout={template.layout} />
                  <span className="text-sm font-bold text-gray-800">{template.name}</span>
                  <span className="text-xs leading-snug text-gray-500">{template.description}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <section aria-labelledby="arrange-title">
        <h2 id="arrange-title" className="text-sm font-bold text-gray-700">
          ボタンの配置
        </h2>
        <p className="mb-2 text-xs text-gray-500">
          左の <Icon name="drag_indicator" className="align-middle text-base" /> をつかんで動かすと、並びを変えられます。
          ボタンを押すと、大きさを変えられます。
        </p>

        {buttons.length === 0 && (
          <p className="rounded-[0.75rem] bg-yellow-500/20 p-3 text-sm text-yellow-700">
            ボタンがありません。下から追加してください。
          </p>
        )}

        <div className="grid grid-cols-2 gap-3 rounded-[1rem] bg-gray-200/60 p-3">
          {buttons.map((button) => (
            <div
              key={button.id}
              data-tile-id={button.id}
              onClick={() => setSelectedId(button.id)}
              className={`relative flex flex-col items-center justify-center gap-1 rounded-[0.75rem] shadow ${
                button.width === 'full' ? 'col-span-2' : ''
              } ${HEIGHT_EDIT[button.height]} ${COLORS[button.color].button} ${
                selectedId === button.id ? 'ring-2 ring-primary-blue ring-offset-2' : ''
              } ${dragId === button.id ? 'opacity-40' : ''}`}
            >
              <Icon name={BUTTONS[button.id].icon} className="text-3xl opacity-70" />
              <span className="text-sm font-bold">{BUTTONS[button.id].label}</span>
              <button
                type="button"
                aria-label={`${BUTTONS[button.id].label}を動かす(ドラッグ、または矢印キー)`}
                onPointerDown={(e) => startDrag(button.id, e)}
                onKeyDown={(e) => onHandleKeyDown(button.id, e)}
                onClick={(e) => e.stopPropagation()}
                style={{ touchAction: 'none' }}
                className="absolute left-0 top-0 flex size-11 cursor-grab items-center justify-center rounded-br-[0.75rem] rounded-tl-[0.75rem] bg-black/10 active:cursor-grabbing"
              >
                <Icon name="drag_indicator" className="text-2xl" />
              </button>
              <button
                type="button"
                aria-label={`${BUTTONS[button.id].label}を削除`}
                onClick={(e) => {
                  e.stopPropagation()
                  remove(button.id)
                }}
                className="absolute right-0 top-0 flex size-11 items-center justify-center text-red-600"
              >
                <Icon name="close" className="text-2xl" />
              </button>
            </div>
          ))}
        </div>

        {selected ? (
          <div className="mt-3 rounded-[1rem] bg-white p-3 shadow">
            <p className="mb-1 font-bold text-gray-800">{BUTTONS[selected.id].label}の大きさ</p>
            <Row title="幅">
              {WIDTHS.map(([value, name]) => (
                <Choice key={value} selected={selected.width === value} onClick={() => update(selected.id, { width: value })}>
                  {name}
                </Choice>
              ))}
            </Row>
            <Row title="高さ">
              {LEVELS.map((level) => (
                <Choice key={level} selected={selected.height === level} onClick={() => update(selected.id, { height: level })}>
                  {LEVEL_NAMES[level]}
                </Choice>
              ))}
            </Row>
            <Row title="文字">
              {LEVELS.map((level) => (
                <Choice
                  key={level}
                  selected={selected.textSize === level}
                  onClick={() => update(selected.id, { textSize: level })}
                >
                  {LEVEL_NAMES[level]}
                </Choice>
              ))}
            </Row>
          </div>
        ) : (
          buttons.length > 0 && <p className="mt-2 text-xs text-gray-500">ボタンを押すと、ここに大きさの設定が出ます。</p>
        )}
      </section>

      {unused.length > 0 && (
        <div className="rounded-[1rem] border border-dashed border-gray-300 p-3">
          <p className="mb-2 text-sm font-medium text-gray-600">ボタンを追加</p>
          <div className="flex flex-wrap gap-2">
            {unused.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => add(id)}
                className="flex items-center gap-1 rounded-full bg-gray-800 px-4 py-2 text-sm font-medium text-white active:bg-gray-700"
              >
                <Icon name="add" className="text-lg" />
                {BUTTONS[id].label}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-[0.75rem] bg-red-500/20 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-auto flex flex-col gap-2 pt-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="flex-1 rounded-[0.75rem] bg-gray-200 py-3 font-bold text-gray-800 disabled:opacity-40"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="flex-1 rounded-[0.75rem] bg-primary-blue py-3 font-bold text-white disabled:opacity-40"
          >
            {saving ? '保存中...' : '完了'}
          </button>
        </div>
        <button
          type="button"
          onClick={onReset}
          disabled={saving}
          className="flex items-center justify-center gap-1 py-2 text-sm text-gray-500 disabled:opacity-40"
        >
          <Icon name="restart_alt" className="text-lg" />
          初期状態に戻す
        </button>
      </div>

      {/* ドラッグ中、指についてくる目印 */}
      {dragId && pointer && (
        <div
          aria-hidden="true"
          style={{ left: pointer.x, top: pointer.y }}
          className="pointer-events-none fixed z-50 flex -translate-x-1/2 -translate-y-full items-center gap-1 rounded-full bg-gray-900 px-4 py-2 text-sm font-bold text-white shadow-lg"
        >
          <Icon name={BUTTONS[dragId].icon} className="text-xl" />
          {BUTTONS[dragId].label}
        </div>
      )}
    </div>
  )
}

function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-2 flex items-center gap-3">
      <span className="w-10 shrink-0 text-sm text-gray-500">{title}</span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

function Choice({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`min-w-14 rounded-full px-4 py-2 text-sm font-medium ${
        selected ? 'bg-primary-blue text-white' : 'bg-gray-100 text-gray-700'
      }`}
    >
      {children}
    </button>
  )
}

// テンプレートの見た目の縮図(幅・高さ・色だけを小さく描く)
function TemplatePreview({ layout }: { layout: RemoteLayout }) {
  return (
    <div aria-hidden="true" className="grid grid-cols-2 gap-1 rounded-md bg-gray-100 p-1">
      {layout.buttons.map((b) => (
        <div
          key={b.id}
          className={`rounded-sm border border-gray-200 ${HEIGHT_PREVIEW[b.height]} ${COLORS[b.color].swatch} ${
            b.width === 'full' ? 'col-span-2' : ''
          }`}
        />
      ))}
    </div>
  )
}
