#!/usr/bin/env bash
# 各フォルダーの config/*.env.example から、まだ無い config/*.env を作る。
#   database/config/postgres.env
#   go-server/src/config/app.env
#   react-app/config/react.env
# - すでにある *.env は上書きしない
# - app.env の SECRET_KEY が空なら、ランダムな鍵(64文字)を作って書き込む
# 使い方: ./scripts/setup-env.sh
set -euo pipefail

cd "$(dirname "$0")/.."

for example in \
  database/config/postgres.env.example \
  go-server/src/config/app.env.example \
  react-app/config/react.env.example; do
  target="${example%.example}"
  if [ -e "$target" ]; then
    echo "skip   $target (すでにあります)"
  else
    cp "$example" "$target"
    echo "create $target"
  fi
done

go_env="go-server/src/config/app.env"
if grep -qE '^SECRET_KEY=$' "$go_env"; then
  if command -v openssl >/dev/null 2>&1; then
    key="$(openssl rand -hex 32)"
  elif command -v python3 >/dev/null 2>&1; then
    key="$(python3 -c 'import secrets; print(secrets.token_hex(32))')"
  else
    echo "openssl も python3 も見つかりません。README の手順で SECRET_KEY を作って、$go_env に書いてください。" >&2
    exit 1
  fi
  tmp="$(mktemp)"
  # 鍵を、ファイルの SECRET_KEY= の行だけに書き込む(画面には出さない)
  awk -v key="$key" '/^SECRET_KEY=$/ { print "SECRET_KEY=" key; next } { print }' "$go_env" > "$tmp"
  cat "$tmp" > "$go_env"
  rm -f "$tmp"
  echo "set    $go_env の SECRET_KEY を作りました"
else
  echo "keep   $go_env の SECRET_KEY(すでに設定されています)"
fi

echo "完了。database/config/postgres.env と $go_env の DB のユーザー名・パスワードがそろっているか確認してください。"
