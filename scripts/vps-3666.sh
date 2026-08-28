#!/usr/bin/env bash
# Checa e sobe o CRM na porta 3666, sem tocar em 80/443 (Apache da VPS).
# Uso, na pasta do clone:
#   bash scripts/vps-3666.sh check
#   bash scripts/vps-3666.sh up
#   bash scripts/vps-3666.sh status
#   bash scripts/vps-3666.sh down
set -uo pipefail

cd "$(dirname "$0")/.."
PORTA="${PORTA:-3666}"

# Ubuntu 20 muitas vezes tem só `docker-compose` (v1), não o plugin `docker compose`.
if docker compose version >/dev/null 2>&1; then
  DC=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  DC=(docker-compose)
else
  DC=()
fi
dc() { "${DC[@]}" "$@"; }

ok()   { printf '  [ok] %s\n' "$*"; }
falha(){ printf '  [!!] %s\n' "$*"; }
info() { printf '  --  %s\n' "$*"; }

porta_livre() {
  if command -v ss >/dev/null 2>&1; then
    ! ss -lnt | grep -q ":$1 "
  else
    ! netstat -lnt 2>/dev/null | grep -q ":$1 "
  fi
}

cmd_check() {
  echo "== Docker =="
  if docker info >/dev/null 2>&1; then
    ok "Docker no ar"
    if [ "${#DC[@]}" -gt 0 ]; then
      dc version 2>/dev/null | head -1 | sed 's/^/  /'
    else
      falha "não achei 'docker compose' nem 'docker-compose'. No Ubuntu 20:"
      info "apt-get update && apt-get install -y docker-compose-plugin"
    fi
  else
    falha "Docker não responde. Instale ou suba o serviço: systemctl start docker"
    return 1
  fi

  echo
  echo "== Portas (a 3666 precisa estar livre; 80/443 o Apache já usa) =="
  for p in 3666 3030 8079 54321 54322; do
    if porta_livre "$p"; then
      ok "porta $p livre"
    else
      if [ "$p" = "3666" ]; then
        info "porta $p ocupada — se já for o CRM, ok; senão escolha outra"
      else
        info "porta $p ocupada"
      fi
    fi
  done
  if porta_livre 80; then
    info "80 livre (inesperado nesta VPS — o Apache costuma estar nela)"
  else
    ok "80 ocupada (Apache) — não vamos usá-la"
  fi

  echo
  echo "== Arquivos =="
  [ -f .env ] && ok ".env presente" || falha ".env AUSENTE — copie o do Mac para esta pasta"
  [ -f .env.local ] && ok ".env.local presente" || info ".env.local só precisa se for rodar pnpm dev (não a imagem de produção)"
  [ -f docker-compose.vps.yml ] && ok "docker-compose.vps.yml presente" || falha "falta docker-compose.vps.yml — dê git pull"

  echo
  echo "== Containers nossos =="
  docker ps --format '  {{.Names}}\t{{.Status}}\t{{.Ports}}' \
    | grep -E 'deskcomm|supabase_' || info "nenhum container deskcomm/supabase no ar ainda"

  echo
  echo "== Saúde do CRM (http://127.0.0.1:${PORTA}/api/v1/health) =="
  if out="$(curl -fsS -m 5 "http://127.0.0.1:${PORTA}/api/v1/health" 2>/dev/null)"; then
    printf '%s\n' "$out"
  else
    info "ainda não responde — normal se o app não subiu"
  fi
}

cmd_up() {
  [ "${#DC[@]}" -gt 0 ] || { falha "instale docker compose: apt-get install -y docker-compose-plugin"; exit 1; }
  [ -f .env ] || { falha "crie o .env nesta pasta antes"; exit 1; }
  echo "== Sobe WAHA + Redis (não sobe Caddy, não pega 80/443) =="
  dc up -d waha redis srh
  echo
  info "WAHA:  http://ESTE-IP:3030"
  info "CRM:   depois de subir o Next, http://ESTE-IP:${PORTA}"
  echo
  echo "Se for o mesmo modo do Mac (Next no host + Supabase local):"
  echo "  npx supabase start"
  echo "  export NVM_DIR=\"\$HOME/.nvm\"; . \"\$NVM_DIR/nvm.sh\"; nvm use 22"
  echo "  pnpm install && pnpm dev"
  echo
  echo "Se for imagem de produção (sem Node no host):"
  echo "  ${DC[*]} -f docker-compose.prod.yml -f docker-compose.vps.yml --env-file .env \\"
  echo "    up -d app worker waha redis srh scheduler"
}

cmd_status() {
  dc ps
  echo
  docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep -E 'NAMES|deskcomm|supabase' || true
  echo
  curl -sS -m 5 -w "\nHTTP %{http_code}\n" "http://127.0.0.1:${PORTA}/api/v1/health" || true
}

cmd_down() {
  dc stop waha redis srh
  if [ -f docker-compose.prod.yml ]; then
    dc -f docker-compose.prod.yml -f docker-compose.vps.yml stop 2>/dev/null || true
  fi
  info "parados. O Apache e o resto da VPS não foram tocados."
}

case "${1:-check}" in
  check)  cmd_check ;;
  up)     cmd_up ;;
  status) cmd_status ;;
  down)   cmd_down ;;
  *)
    echo "uso: bash scripts/vps-3666.sh {check|up|status|down}"
    exit 2
    ;;
esac
