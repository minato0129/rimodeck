#!/usr/bin/env bash
# 自己署名の HTTPS 証明書を certs/ に作る(LAN 内で試す用)。
#   使い方: ./scripts/make-self-signed-cert.sh 192.168.1.10 [rimodeck.local ...]
# 引数には、ブラウザ(PC・スマホ)がアクセスするときのアドレス(IP アドレスかホスト名)を渡す。
# localhost / 127.0.0.1 は自動で含める。
# 自己署名なので、ブラウザには「安全ではない」と警告が出る(許可すれば使える)。
# インターネットに公開する場合は、Let's Encrypt などの正式な証明書を使うこと(README 参照)。
set -euo pipefail

if [ $# -eq 0 ]; then
  echo "使い方: $0 <IPアドレスまたはホスト名> [...]" >&2
  echo "例:     $0 192.168.1.10" >&2
  exit 1
fi

cd "$(dirname "$0")/.."

san="DNS:localhost,IP:127.0.0.1"
for host in "$@"; do
  if [[ "$host" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || [[ "$host" == *:* ]]; then
    san+=",IP:$host"
  else
    san+=",DNS:$host"
  fi
done

mkdir -p certs
openssl req -x509 -newkey rsa:2048 -nodes -days 825 \
  -keyout certs/privkey.pem -out certs/fullchain.pem \
  -subj "/CN=$1" -addext "subjectAltName=$san" 2>/dev/null
chmod 600 certs/privkey.pem

echo "証明書を作りました: certs/fullchain.pem certs/privkey.pem"
echo "含めたアドレス: $san"
