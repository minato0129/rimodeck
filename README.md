# りもでっく (rimodeck)

PCでアップロードしたPDFスライドを、スマートフォンからリモート操作するためのプレゼン支援アプリです。
PCとスマホをQRコードで接続し、「次へ」「前へ」などの基本操作をスマホから行えます。発表者モードやスライドごとのメモ機能もあります。

## 構成

| 要素 | 内容 |
| --- | --- |
| サーバー | Go 1.24.9 以上 / Echo / GORM / gorilla/websocket (`go-server/src`) |
| データベース | PostgreSQL (`docker-compose.yaml` の `postgres-db`) |
| 画面 | `react-app/`。Vite + React + TypeScript + Tailwind(後述)。Go は画面を配信せず、API・WebSocket・PDF の配信だけを行う |

DBのテーブル(`Users`, `Note`)は、サーバー起動時に `AutoMigrate` で自動作成されます。

## 起動方法

どちらの方法でも、最初に設定ファイルを作ります。

```bash
mkdir -p go-server/src/config
cp app.env.example go-server/src/config/app.env
```

`go-server/src/config/` は `.gitignore` 対象です。コミットされません。

作った `app.env` の `SECRET_KEY=` に、ログインのトークンに署名する秘密の鍵を書きます。**空や32文字未満だと、サーバーは起動しません。**

```bash
openssl rand -hex 32   # 出力された文字列を SECRET_KEY= の右に貼る
```

この値は人に見せないでください(漏れると、他人がログイン済みのふりをできてしまいます)。変えると、ログイン済みの人はログインし直しになります。

### A. Docker Compose で全部起動する

```bash
docker compose up --build
```

`go-server` コンテナは `go-server/src/config/app.env` を読み込み、`postgres-db` の起動後に立ち上がります。ただし起動するだけ(`sleep infinity`)で、Go のサーバーは動きません。VS Code などでコンテナにアタッチして、`/app/src` で `go run .` を実行してください(コード変更後は、実行中の `go run .` を `Ctrl+C` で止めてからもう一度実行します)。
React(<http://localhost:3000/>)も同時に起動します。

### B. DBだけ Docker、サーバーはローカルで動かす

```bash
docker compose up -d postgres-db

cd go-server/src
set -a
source config/app.env
set +a
export DB_URL='postgres://rimodeck:rimodeck@localhost:5432/rimodeckdb?sslmode=disable'
go run .
```

`app.env` の `DB_URL` はコンテナ内用(ホスト名 `postgres-db`)なので、ローカル実行では上のように `localhost` へ上書きします。

## フロントエンド(React)

画面は `react-app/` の React 版です。以前の Go 側の HTML/CSS/JS(`go-server/src` の `index` / `login` / `signup` / `slide` / `phone`)は、5画面すべての移植が終わったため削除しました(Git の履歴には残っています)。

| ルート | 内容 |
| --- | --- |
| `/signup`, `/login` | 新規登録とログイン |
| `/` | PDFのアップロードと一覧 |
| `/viewer` | スライド表示画面(PC側)。メモ、全画面、発表者モード(別ウィンドウ)、QRコード |
| `/remote` | スマホ操作画面(前へ・次へ) |

### 起動

```bash
docker compose up --build
```

<http://localhost:3000/> が画面(React)、<http://localhost:1323/> が API を提供する Go サーバーです。画面は 3000 番ポートで開いてください。

ローカルで動かす場合(Node.js 22 以上):

```bash
cd react-app
npm install
npm run dev
```

Go サーバーは `http://localhost:1323` にある前提です。別の場所にある場合は `VITE_API_TARGET` で指定します。

### 本番での配信(nginx)

本番は、ビルドした React を nginx で配信します。`/login`・`/signup` の POST と `/logout` `/upload` `/pdfs` `/delete-pdf` `/note` `/assets/` `/ws` は nginx が Go サーバーに中継するので、画面と API が同じオリジンになり、Cookie や CORS の設定は要りません(振り分けは `react-app/nginx.conf`)。

```bash
mkdir -p go-server/src/config
cp app.env.example go-server/src/config/app.env   # 初回のみ
docker compose -f docker-compose.production.yaml up -d --build
```

<http://localhost/>(80番ポート)で開きます。スマホで QR を読み取るときは、上の「スマホで QR コードを読み取るとき」のとおり、LAN の IP(`http://192.168.x.x/`)で開いてください。

- 開発用の `docker-compose.yaml` とは別のファイルで、同時には起動しません。
- Go サーバーは外に公開せず、nginx からだけ呼びます。起動は `go run .` です(ソースをコンテナにマウントして、起動時にコンパイルします)。
- HTTP のみです。インターネットに公開する場合は、HTTPS(証明書)の設定を別途追加してください。

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

起動後、ブラウザで <http://localhost:3000/> を開きます(画面のルートは上の表のとおりです)。
スマホは、PC の `/viewer` に出る QR コードを読み取って `/remote` を開きます。

### 傾聴者に共有する(会場の後ろの席の人などが、自分のスマホでスライドを見る)

PC の `/viewer` で「傾聴者に共有」→「共有を開始」を押すと、傾聴者用の QR コード(`/watch/<トークン>`)が出ます。傾聴者はログイン不要で、QR コードを読み取るだけでスライドが見られます(QR コードを使うときの注意は、下の「スマホで QR コードを読み取るとき」と同じです)。

- 初めは**追従モード**で、発表者のページ移動に合わせて傾聴者の画面も動きます。
- 傾聴者が前後のボタンやスワイプでページを動かすと**自分で動かすモード**になり、発表者が進めても動きません。「発表者に追従」を押すと(または発表者と同じページに着くと)追従に戻ります。
- 共有は、発表者が「共有を停止」を押すまで続きます(止め忘れても12時間で無効になります)。リンクを知っている人は誰でも見られるので、終わったら止めてください。
- 共有の情報はサーバーのメモリ上だけにあり、Go サーバーを再起動すると消えます。
- ピンチ拡大は未対応です。

#### 傾聴者からの質問

傾聴者の画面の「質問する」から、発表者に**匿名で**質問を送れます(200文字まで。同じ傾聴者は5秒に1件まで)。

- どのスライドへの質問かは、ページ番号で保存されます。追従モードのときは質問するページを選べ(初期値は発表者のページ)、自分で動かすモードのときは、いま見ているページに固定されます。
- 発表者は、`/viewer` の「質問」ボタンから質問パネルを開きます。「このページ」と「すべて」で切り替えられ、ページ番号を押すとそのスライドへ移ります。新着はリアルタイムで届き、パネルを閉じているときはボタンの件数バッジと通知が出ます。
- 質問は PDF ごとに DB(`questions` テーブル)に保存され、発表者が削除するまで残ります。同じ PDF を何度共有しても、質問は同じ一覧にたまります。「回答済み」の印も付けられます。
- PDF を削除すると、その PDF への質問も消えます。
- 傾聴者には、他の人の質問は見えません。

#### 発表者モード(別ウィンドウ)

「プレゼンテーション」→ 発表者モードで開く別ウィンドウは、プロジェクターなどに映して**傾聴者みんなが見る画面**として使う想定です。メインの `/viewer` 画面は発表者が見ます。

- この別ウィンドウには、ログアウト・ファイル選択に戻るボタン・ユーザー名・スライドメモを出しません。
- 右側に、届いた質問を**自動で**映します(新しい質問が上、見るだけ)。そのため、不適切な質問もそのまま映ります。回答済みにする・削除する操作はメインの画面で行い、回答済み・削除すると、この画面から消えます。
- 質問を押すと、その質問のページへ移ります(メインの画面や、共有中の傾聴者の追従モードの画面も同じページに移ります)。
- この別ウィンドウを全画面にすると、スライドと一緒に質問の一覧も全画面に映ります(メインの画面の全画面は、これまでどおりスライドだけです)。
- メインの画面との連絡は、同じブラウザ内の `BroadcastChannel` で行います(ページ送りの同期と同じ仕組み)。

### スマホで QR コードを読み取るとき

QR コードには、PC でその画面を開いているアドレス(例: `http://localhost:3000`)が入ります。`localhost` や `127.0.0.1` は、スマホから見ると「スマホ自身」なので届きません。**PC のブラウザも、PC の LAN の IP アドレスで開いてください**(例: `http://192.168.1.10:3000/`)。スマホと PC は同じ Wi-Fi につなぎます。

PC の LAN の IP アドレスは、macOS は `ipconfig getifaddr en0`、Linux は `hostname -I`、Windows は `ipconfig` で調べられます。つながらないときは、PC のファイアウォールで 3000 番ポートが許可されているか確認してください。

ログインすると、サーバーがアクセストークン(JWT、12時間有効)を `HttpOnly` の Cookie(`token`)に入れます。以降の API(`/pdfs` `/upload` `/delete-pdf` `/note` `/assets/*`)は、この Cookie の署名・有効期限・発行済みかを確かめて本人確認します。期限が切れる(401)と、ログイン画面に戻ります。ログアウトすると、Cookie を消すだけでなく、サーバー側のトークンも失効させます(控えておいたトークンも使えなくなります)。期限切れのトークンは、ログインのたびに DB から削除されます。トークンの署名には `SECRET_KEY` を使います(上の「環境変数」を参照)。

Go サーバー(<http://localhost:1323/>)が提供するのは次のものです。画面は配信しません。

| パス | 内容 |
| --- | --- |
| `POST /login`, `POST /signup`, `POST /logout` | 認証 |
| `GET /pdfs`, `POST /upload`, `POST /delete-pdf` | PDF の一覧・アップロード・削除 |
| `GET /note`, `POST /note` | スライドメモ |
| `GET /assets/*` | ログイン中のユーザーの PDF |
| `/ws` | WebSocket(PCとスマホの通信) |
| `GET /questions`, `POST /question/answered`, `POST /question/delete` | 傾聴者からの質問の一覧・回答済みの印・削除(ログイン必須) |
| `POST /share`, `POST /share/stop` | 傾聴者共有の開始・停止(ログイン必須) |
| `GET /shared/:token/pdf`, `/ws/watch?token=`, `POST /shared/:token/question` | 共有中の PDF と、ページ同期の WebSocket(ログイン不要。共有リンクのトークンが鍵。最後は傾聴者の質問の送信) |

アップロードしたPDFは `go-server/src/assets/Slidepass/` 以下にユーザーごとに保存されます。

## 環境変数

| 変数 | 用途 |
| --- | --- |
| `DB_URL` | 必須。GORM が使う PostgreSQL の接続文字列 |
| `SECRET_KEY` | 必須(32文字以上)。ログインのアクセストークン(JWT)の署名鍵 |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `app.env` 内で `DB_URL` を組み立てるための値 |
| `GO_URL` | 現在のエントリポイント(`web_main`)では使われません。待ち受けは `0.0.0.0:1323` に固定されています |

## ブランチ

開発は `main` で行います。以前の作業ブランチは `archive/<名前>` タグとして残してあります。

## 既知の注意点

- `go-server/src/main.go` は `Debug()` 経由で `web_main()` を呼びます。`router.go` の `InitServer()` は現在使われていません。
- ローカルで確認する用途を想定した設定です(DBのパスワードは開発用の固定値)。公開環境では必ず変更してください。
