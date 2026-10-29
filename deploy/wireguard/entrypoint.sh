#!/bin/sh
set -eu

CONFIG=/etc/wireguard/wg0.conf

if [ ! -s "$CONFIG" ]; then
  echo "Falta la configuración WireGuard protegida." >&2
  exit 1
fi

if ip link show wg0 >/dev/null 2>&1; then
  wg-quick down "$CONFIG" || ip link delete wg0
fi

wg-quick up "$CONFIG"

cleanup() {
  wg-quick down "$CONFIG" || true
}

stop() {
  trap - EXIT INT TERM
  cleanup
  exit 0
}

trap cleanup EXIT
trap stop INT TERM

while :; do
  sleep 3600 &
  wait "$!" || true
done
