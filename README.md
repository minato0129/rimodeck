# りもでっく (rimodeck)

PCでアップロードしたPDFスライドを、スマートフォンからリモート操作するためのプレゼン支援アプリです。
PCとスマホをQRコードで接続し、「次へ」「前へ」などの基本操作をスマホから行えます。発表者モードやスライドごとのメモ機能もあります。

## 構成

| 要素 | 内容 |
| --- | --- |
| サーバー | Go 1.24.9 以上 / Echo / GORM / gorilla/websocket (`go-server/src`) |
| データベース | PostgreSQL (`docker-compose.yaml` の `postgres-db`) |
| 画面(現行) | `go-server/src` の HTML(`index` / `login` / `signup` / `slide` / `phone`)と `assets/` の CSS・JS |
| 画面(移行中) | `react-app/`。Vite + React + TypeScript + Tailwind。1画面ずつ移植中(後述) |

DBのテーブル(`Users`, `Note`)は、サーバー起動時に `AutoMigrate` で自動作成されます。

## 起動方法

どちらの方法でも、最初に設定ファイルを作ります。

```bash
mkdir -p config
cp app.env.example config/app.env
```

`config/` は `.gitignore` 対象です。コミットされません。

### A. Docker Compose で全部起動する

```bash
docker compose up --build
```

`go-server` は `config/app.env` を読み込み、`postgres-db` の起動後に立ち上がります。
DBの準備が間に合わず落ちた場合は `restart: always` で自動的に再起動されます。

### B. DBだけ Docker、サーバーはローカルで動かす

```bash
docker compose up -d postgres-db

cd go-server/src
set -a
source ../../config/app.env
set +a
export DB_URL='postgres://rimodeck:rimodeck@localhost:5432/rimodeckdb?sslmode=disable'
go run .
```

`app.env` の `DB_URL` はコンテナ内用(ホスト名 `postgres-db`)なので、ローカル実行では上のように `localhost` へ上書きします。

## React 版フロントエンド(移行中)

画面を HTML/JS から React に移しています。未移植の画面は「未移植」と表示されます。
移植元は `go-server/src` の同名の画面(`index` / `login` / `signup` / `slide` / `phone`)です。

| React のルート | 移植元 | 状況 |
| --- | --- | --- |
| `/` | `index.html` / `index.js` | 移植済み |
| `/login` | `login.html` / `login.js` | 移植済み |
| `/signup` | `signup.html` / `signup.js` | 移植済み |
| `/viewer` | `slide.html` / `slide.js` | 未移植 |
| `/remote` | `phone.html` / `phone.js` | 未移植 |

Go 版の HTML/JS は、5画面すべての移植が終わってから、まとめて削除します。

### 起動

```bash
docker compose up --build
```

<http://localhost:3000/> が React 版、<http://localhost:1323/> が現行の Go 版です。

ローカルで動かす場合(Node.js 22 以上):

```bash
cd react-app
npm install
npm run dev
```

Go サーバーは `http://localhost:1323` にある前提です。別の場所にある場合は `VITE_API_TARGET` で指定します。

### API の接続

開発サーバー(`vite.config.ts`)が、Go の API と WebSocket を中継します。画面側は `/pdfs` や `/ws` のように、同じオリジンのパスで呼べます(Cookie も同じオリジンで扱えます)。

- 中継するパス: `/login` `/signup` `/logout` `/upload` `/pdfs` `/delete-pdf` `/note` `/assets` `/ws`
- `/login` と `/signup` はページ(GET)とAPI(POST)で同じ URL を使っているため、ブラウザのページ遷移だけは React が受けます。
- ビルド成果物は `/static/` 以下に出ます。Go が PDF を `/assets/*` で配信していて、衝突を避けるためです。
- 本番は React を別サーバーで配信する想定です。配信方法と、その場合の API の接続先(CORS・Cookie の扱いを含む)は未定です。

### コマンド

| コマンド | 内容 |
| --- | --- |
| `npm run dev` | 開発サーバー(3000番ポート) |
| `npm run build` | 型チェックとビルド |
| `npm run lint` | oxlint |

## 使い方

起動後、ブラウザで <http://localhost:1323/> を開きます。

| パス | 内容 |
| --- | --- |
| `/signup`, `/login` | 新規登録とログイン |
| `/` | PDFのアップロードと一覧 |
| `/viewer` | スライド表示画面(PC側) |
| `/remote` | スマホ操作画面 |
| `/ws` | WebSocket(PCとスマホの通信) |

アップロードしたPDFは `go-server/src/assets/Slidepass/` 以下にユーザーごとに保存されます。

## 環境変数

| 変数 | 用途 |
| --- | --- |
| `DB_URL` | 必須。GORM が使う PostgreSQL の接続文字列 |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `app.env` 内で `DB_URL` を組み立てるための値 |
| `GO_URL` | 現在のエントリポイント(`web_main`)では使われません。待ち受けは `0.0.0.0:1323` に固定されています |

## ブランチ

開発は `main` で行います。以前の作業ブランチは `archive/<名前>` タグとして残してあります。

## 既知の注意点

- `go-server/src/main.go` は `Debug()` 経由で `web_main()` を呼びます。`router.go` の `InitServer()` は現在使われていません。
- ローカルで確認する用途を想定した設定です(DBのパスワードは開発用の固定値)。公開環境では必ず変更してください。
