# りもでっく (rimodeck)

PCでアップロードしたPDFスライドを、スマートフォンからリモート操作するためのプレゼン支援アプリです。
PCとスマホをQRコードで接続し、「次へ」「前へ」などの基本操作をスマホから行えます。発表者モードやスライドごとのメモ機能もあります。

## 構成

| 要素 | 内容 |
| --- | --- |
| サーバー | Go 1.24.9 以上 / Echo / GORM / gorilla/websocket (`go-server/src`) |
| データベース | PostgreSQL (`docker-compose.yaml` の `postgres-db`) |
| 画面 | `go-server/src` の HTML(`index` / `login` / `signup` / `slide` / `phone`)と `assets/` の CSS・JS |

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
