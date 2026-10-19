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
    deploy-app) action=deploy-app ;;
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

deploy_app() {
  git -C "$REPO_DIR" pull --ff-only origin develop
  install -d -m 700 "$WRAPPER_DIR"
  install -m 700 "$REPO_DIR/deploy/nexo-ssh-command.sh" "$WRAPPER_PATH"
  docker compose --env-file "$REPO_DIR/deploy/.env.production" -f "$REPO_DIR/compose.prod.yaml" up -d --build --remove-orphans --wait --wait-timeout 300
  docker compose --env-file "$REPO_DIR/deploy/.env.production" -f "$REPO_DIR/compose.prod.yaml" up -d --no-deps --force-recreate caddy
}

health() {
  docker compose --env-file "$REPO_DIR/deploy/.env.production" -f "$REPO_DIR/compose.prod.yaml" ps
}

case "$action" in
  bootstrap) bootstrap ;;
  sync-mfa) sync_mfa ;;
  deploy-app) deploy_app ;;
  health) health ;;
esac
