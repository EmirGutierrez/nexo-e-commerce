#!/bin/sh
set -eu

REPO_DIR=/opt/nexo-commerce
WRAPPER_DIR="$HOME/.local/bin"
WRAPPER_PATH="$WRAPPER_DIR/nexo-ssh-command"
BOOTSTRAP_COMMAND='cd /opt/nexo-commerce && git pull --ff-only origin develop && ./deploy/nexo-ssh-command.sh bootstrap'

if [ "$(id -u)" -eq 0 ]; then
  echo "La llave de despliegue no debe usar root." >&2
  exit 126
fi

if [ -n "${SSH_ORIGINAL_COMMAND:-}" ]; then
  case "$SSH_ORIGINAL_COMMAND" in
    "$BOOTSTRAP_COMMAND") action=bootstrap ;;
    sync-mfa) action=sync-mfa ;;
    sync-tunnel) action=sync-tunnel ;;
    sync-wireguard) action=sync-wireguard ;;
    deploy-app) action=deploy-app ;;
    monitor-smoke) action=monitor-smoke ;;
    wireguard-public-key) action=wireguard-public-key ;;
    health) action=health ;;
    *) echo "Comando SSH no permitido." >&2; exit 126 ;;
  esac
else
  case "${1:-}" in
    bootstrap) action=bootstrap ;;
    *) echo "Comando local no permitido." >&2; exit 126 ;;
  esac
fi

bootstrap() {
  if [ ! -d "$REPO_DIR/.git" ]; then
    git clone --branch develop --single-branch https://github.com/EmirGutierrez/nexo-e-commerce.git "$REPO_DIR"
  else
    git -C "$REPO_DIR" pull --ff-only origin develop
  fi

  install -d -m 700 "$WRAPPER_DIR"
  install -m 700 "$REPO_DIR/deploy/nexo-ssh-command.sh" "$WRAPPER_PATH"
  exec python3 "$REPO_DIR/deploy/restrict-deploy-key.py" "$WRAPPER_PATH"
}

sync_mfa() {
  exec python3 -c 'import base64,os,pathlib,stat,sys,tempfile; p=pathlib.Path("/opt/nexo-commerce/deploy/.env.production"); key=sys.stdin.readline().strip(); raw=base64.b64decode(key,validate=True); assert len(raw)==32; lines=[line for line in p.read_text().splitlines() if not line.startswith("MFA_ENCRYPTION_KEY=")]; lines.append("MFA_ENCRYPTION_KEY="+key); data=("\n".join(lines)+"\n").encode(); mode=stat.S_IMODE(p.stat().st_mode); fd,tmp=tempfile.mkstemp(dir=str(p.parent),prefix=".env.production."); os.fchmod(fd,mode); os.write(fd,data); os.fsync(fd); os.close(fd); os.replace(tmp,p); print("Clave MFA sincronizada")'
}

sync_tunnel() {
  exec python3 -c 'import os,pathlib,stat,sys,tempfile; p=pathlib.Path("/opt/nexo-commerce/deploy/.env.production"); token=sys.stdin.readline().rstrip("\r\n"); assert 32 <= len(token) <= 4096 and token.isascii() and not any(ch.isspace() for ch in token), "Token de Cloudflare inválido"; lines=[line for line in p.read_text().splitlines() if not line.startswith("CLOUDFLARE_TUNNEL_TOKEN=")]; lines.append("CLOUDFLARE_TUNNEL_TOKEN="+token); data=("\n".join(lines)+"\n").encode(); mode=stat.S_IMODE(p.stat().st_mode); fd,tmp=tempfile.mkstemp(dir=str(p.parent),prefix=".env.production."); os.fchmod(fd,mode); os.write(fd,data); os.fsync(fd); os.close(fd); os.replace(tmp,p); print("Token del túnel sincronizado")'
}

sync_wireguard() {
  exec python3 "$REPO_DIR/deploy/sync-wireguard-config.py" /opt/nexo-commerce/deploy/.runtime/wireguard/wg0.conf
}

deploy_app() {
  git -C "$REPO_DIR" pull --ff-only origin develop
  install -d -m 700 "$WRAPPER_DIR"
  install -m 700 "$REPO_DIR/deploy/nexo-ssh-command.sh" "$WRAPPER_PATH"
  python3 "$REPO_DIR/deploy/validate-monitoring-env.py" "$REPO_DIR/deploy/.env.production"
  set --
  if grep -Eq '^CLOUDFLARE_TUNNEL_TOKEN=[^[:space:]]+' "$REPO_DIR/deploy/.env.production"; then
    set -- "$@" --profile cloudflare-tunnel
  fi
  if [ -s "$REPO_DIR/deploy/.runtime/wireguard/wg0.conf" ]; then
    set -- "$@" --profile wireguard
  fi
  if ! docker compose "$@" --env-file "$REPO_DIR/deploy/.env.production" -f "$REPO_DIR/compose.prod.yaml" up -d --build --remove-orphans --wait --wait-timeout 300; then
    docker compose "$@" --env-file "$REPO_DIR/deploy/.env.production" -f "$REPO_DIR/compose.prod.yaml" ps --all || true
    docker compose "$@" --env-file "$REPO_DIR/deploy/.env.production" -f "$REPO_DIR/compose.prod.yaml" logs --tail=100 wireguard || true
    exit 1
  fi
  docker compose --env-file "$REPO_DIR/deploy/.env.production" -f "$REPO_DIR/compose.prod.yaml" up -d --no-deps --force-recreate caddy
}

health() {
  docker compose --env-file "$REPO_DIR/deploy/.env.production" -f "$REPO_DIR/compose.prod.yaml" ps
}

wireguard_public_key() {
  docker compose --profile wireguard --env-file "$REPO_DIR/deploy/.env.production" -f "$REPO_DIR/compose.prod.yaml" exec -T wireguard wg show wg0 public-key
}

monitor_smoke() {
  test_id="nexo-prod-$(date -u +%Y%m%dT%H%M%SZ)"
  docker compose --env-file "$REPO_DIR/deploy/.env.production" \
    -f "$REPO_DIR/compose.prod.yaml" \
    exec -T frontend node -e '(async()=>{for(let i=0;i<30;i++){try{const response=await fetch("http://grafana:3000/api/health");if(response.ok)process.exit(0)}catch{}await new Promise(resolve=>setTimeout(resolve,1000))}process.exit(1)})()'
  docker compose --profile loadtest \
    --env-file "$REPO_DIR/deploy/.env.production" \
    -f "$REPO_DIR/compose.prod.yaml" \
    run --rm \
    -e BASE_URL=http://frontend:3000 \
    -e K6_TEST_ID="$test_id" \
    -e K6_PROFILE=production \
    k6
}

case "$action" in
  bootstrap) bootstrap ;;
  sync-mfa) sync_mfa ;;
  sync-tunnel) sync_tunnel ;;
  sync-wireguard) sync_wireguard ;;
  deploy-app) deploy_app ;;
  monitor-smoke) monitor_smoke ;;
  wireguard-public-key) wireguard_public_key ;;
  health) health ;;
esac
