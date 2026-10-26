// WebSocket の接続先。開発サーバーのプロキシ経由(/ws)で Go に繋がる。
export function wsUrl(path = '/ws'): string {
  const scheme = location.protocol === 'https:' ? 'wss' : 'ws'
  return `${scheme}://${location.host}${path}`
}
