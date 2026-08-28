#!/bin/bash
# CRM (Deskcomm) — Apache + Let's Encrypt para crm.facejus.com.br
#
# NÃO use o script do Facejus (script_cert.sh). Aquele manda:
#   /     → :3000  (site Facejus)
#   /api  → :5178  (API Facejus)
# O Deskcomm precisa de /api/v1 no próprio Next (3666). Desviar /api
# quebra login, webhook e o CRM inteiro.
#
# Uso (root, na VPS):
#   bash scripts/script-cert-crm.sh
#   bash scripts/script-cert-crm.sh --skip-certbot   # só HTTP, se o DNS ainda não bateu
#
# DNS (Registro.br): crm.facejus.com.br  A  →  147.79.83.207
set -euo pipefail

NOME_COMPLETO="crm.facejus.com.br"
DOMINIO_BASE="facejus.com.br"
CRM_PORT="${CRM_PORT:-3666}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-admin@${DOMINIO_BASE}}"
SKIP_CERTBOT=0
[[ "${1:-}" == "--skip-certbot" ]] && SKIP_CERTBOT=1

CONFIG_FILE="/etc/apache2/sites-available/${NOME_COMPLETO}.conf"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Execute como root: sudo bash $0"
  exit 1
fi

echo "=== CRM — Apache + Let's Encrypt ==="
echo "Host:   ${NOME_COMPLETO}"
echo "App:    http://127.0.0.1:${CRM_PORT}/"
echo "Config: ${CONFIG_FILE}"
echo ""

echo "[1/6] Módulos Apache..."
a2enmod proxy proxy_http headers rewrite ssl 2>/dev/null || true

echo "[2/6] Firewall 80/443 (a ${CRM_PORT} fica só no localhost)..."
if command -v ufw >/dev/null 2>&1; then
  ufw allow 80/tcp 2>/dev/null || true
  ufw allow 443/tcp 2>/dev/null || true
fi

echo "[3/6] App na ${CRM_PORT}..."
if ! curl -sf -o /dev/null "http://127.0.0.1:${CRM_PORT}/" 2>/dev/null; then
  echo "  AVISO: nada responde em :${CRM_PORT}."
  echo "         O vhost e o certbot podem ser feitos agora; o site só abre depois do pnpm dev."
fi

echo "[4/6] Gravando ${CONFIG_FILE}..."
# HTTP só. O certbot acrescenta o :443 e o redirect.
cat > "${CONFIG_FILE}" << EOF
# Gerado por scripts/script-cert-crm.sh — $(date -Iseconds)
# ${NOME_COMPLETO} → Next :${CRM_PORT} (CRM inteiro, inclusive /api)

<VirtualHost *:80>
    ServerName ${NOME_COMPLETO}
    ServerAdmin webmaster@${DOMINIO_BASE}

    ErrorLog \${APACHE_LOG_DIR}/crm-error.log
    CustomLog \${APACHE_LOG_DIR}/crm-access.log combined

    ProxyPreserveHost On
    ProxyRequests Off
    ProxyTimeout 300
    LimitRequestBody 104857600

    ProxyPass        / http://127.0.0.1:${CRM_PORT}/ retry=0 timeout=300
    ProxyPassReverse / http://127.0.0.1:${CRM_PORT}/

    RequestHeader set X-Forwarded-Proto "http"
    RequestHeader set X-Forwarded-Port "80"
    RequestHeader set X-Forwarded-For "%{REMOTE_ADDR}s"
</VirtualHost>
EOF

a2ensite "$(basename "${CONFIG_FILE}")"
apache2ctl configtest
systemctl reload apache2

if [[ "${SKIP_CERTBOT}" -eq 0 ]]; then
  echo "[5/6] Let's Encrypt (certbot --apache)..."
  if ! command -v certbot >/dev/null 2>&1; then
    apt update -qq
    apt install -y certbot python3-certbot-apache
  fi
  if ! dig +short "${NOME_COMPLETO}" | grep -q .; then
    echo "  AVISO: dig não resolveu ${NOME_COMPLETO}. O certbot vai falhar se o DNS não apontar para este IP."
  fi
  certbot --apache \
    -d "${NOME_COMPLETO}" \
    --non-interactive \
    --agree-tos \
    -m "${CERTBOT_EMAIL}" \
    --redirect \
    || {
      echo ""
      echo "  certbot falhou. Confira: dig +short ${NOME_COMPLETO}"
      echo "  Tem que ser 147.79.83.207. Depois:"
      echo "  certbot --apache -d ${NOME_COMPLETO} -m ${CERTBOT_EMAIL} --agree-tos --redirect"
      echo ""
    }
else
  echo "[5/6] SSL pulado (--skip-certbot)"
fi

echo "[6/6] Reload Apache..."
systemctl reload apache2

echo ""
echo "=== PRONTO ==="
echo "URL: https://${NOME_COMPLETO}/login"
echo "O Facejus em :3000 / :5178 não foi tocado."
echo ""
echo "Teste:"
echo "  curl -I https://${NOME_COMPLETO}/"
echo "  curl -s http://127.0.0.1:${CRM_PORT}/api/v1/health"
