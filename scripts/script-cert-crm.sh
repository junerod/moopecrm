#!/bin/bash
# CRM — Let's Encrypt + Apache :443 na VPS Facejus.
#
# Nesta máquina a porta 80 é do Tomcat (/opt/tomcat7). O Apache SÓ escuta 443.
# O Facejus já emite certificado assim:
#   certbot certonly --webroot -w /opt/tomcat7/webapps/ROOT -d <host>
# NÃO use certbot --apache (tenta a :80 e o systemd do Apache está "failed").
# NÃO use o script_cert.sh do Facejus (desvia /api para :5178).
#
# Recarregar Apache: apache2ctl graceful   (não systemctl reload)
#
# Uso (root):
#   bash scripts/script-cert-crm.sh
#   bash scripts/script-cert-crm.sh --skip-certbot
set -euo pipefail

NOME_COMPLETO="crm.facejus.com.br"
DOMINIO_BASE="facejus.com.br"
CRM_PORT="${CRM_PORT:-3666}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-admin@${DOMINIO_BASE}}"
WEBROOT="/opt/tomcat7/webapps/ROOT"
CONFIG_FILE="/etc/apache2/sites-available/${NOME_COMPLETO}.conf"
SKIP_CERTBOT=0
[[ "${1:-}" == "--skip-certbot" ]] && SKIP_CERTBOT=1

if [[ "${EUID}" -ne 0 ]]; then
  echo "Execute como root: sudo bash $0"
  exit 1
fi

echo "=== CRM — Let's Encrypt (webroot Tomcat) + Apache :443 ==="
echo "Host:    ${NOME_COMPLETO}"
echo "App:     http://127.0.0.1:${CRM_PORT}/"
echo "Webroot: ${WEBROOT}"
echo ""

echo "[0/5] Pré-voo (quem tem 80/443)..."
DONO_80="$(ss -lntp | awk '/:80 /{print; exit}')"
DONO_443="$(ss -lntp | awk '/:443 /{print; exit}')"
echo "  :80  → ${DONO_80:-livre}"
echo "  :443 → ${DONO_443:-livre}"

if echo "${DONO_80}" | grep -q 'apache2'; then
  echo "ERRO: Apache está na 80. Nesta VPS a 80 é do Tomcat — pare e revise."
  exit 1
fi
if echo "${DONO_80}" | grep -qE 'java|tomcat'; then
  echo "  OK: porta 80 é do Tomcat. Certbot vai pelo webroot, sem tocar nela."
elif [[ -n "${DONO_80}" ]]; then
  echo "  AVISO: 80 ocupada por outro processo. ACME só funciona se esse processo servir ${WEBROOT}."
else
  echo "ERRO: nada na 80. Let's Encrypt HTTP-01 precisa do Tomcat servindo o ROOT."
  exit 1
fi

if [[ ! -d "${WEBROOT}" ]]; then
  echo "ERRO: webroot inexistente: ${WEBROOT}"
  exit 1
fi
mkdir -p "${WEBROOT}/.well-known/acme-challenge"
TOKEN="crm-preflight-$$"
echo "${TOKEN}" > "${WEBROOT}/.well-known/acme-challenge/${TOKEN}"
RESPOSTA="$(curl -fsS -m 8 "http://127.0.0.1/.well-known/acme-challenge/${TOKEN}" || true)"
rm -f "${WEBROOT}/.well-known/acme-challenge/${TOKEN}"
if [[ "${RESPOSTA}" != "${TOKEN}" ]]; then
  echo "ERRO: Tomcat na 80 não serviu o webroot ACME."
  echo "      Esperado: ${TOKEN}"
  echo "      Obtido:   ${RESPOSTA:-<vazio>}"
  echo "      Sem isso o certbot não consegue o certificado."
  exit 1
fi
echo "  OK: ACME via Tomcat responde em http://127.0.0.1/.well-known/"

if ! systemctl is-active --quiet apache2; then
  echo "  AVISO: systemd apache2 não está 'active' (comum aqui)."
  echo "         Recarregar com apache2ctl graceful, não systemctl reload."
fi

echo "[1/5] Módulos Apache..."
a2enmod proxy proxy_http headers rewrite ssl 2>/dev/null || true

echo "[2/5] Certificado Let's Encrypt..."
if [[ "${SKIP_CERTBOT}" -eq 0 ]]; then
  if ! command -v certbot >/dev/null 2>&1; then
    apt update -qq
    apt install -y certbot
  fi
  mkdir -p "${WEBROOT}/.well-known/acme-challenge"
  certbot certonly --webroot \
    -w "${WEBROOT}" \
    -d "${NOME_COMPLETO}" \
    --non-interactive \
    --agree-tos \
    -m "${CERTBOT_EMAIL}" \
    --keep-until-expiring \
    || {
      echo ""
      echo "  certbot falhou. Teste: echo ok > ${WEBROOT}/.well-known/acme-challenge/ping"
      echo "  curl -s http://${NOME_COMPLETO}/.well-known/acme-challenge/ping"
      echo "  Tem que devolver 'ok' (Tomcat na 80 servindo o ROOT)."
      exit 1
    }
else
  echo "  SSL pulado (--skip-certbot)"
  if [[ ! -f "/etc/letsencrypt/live/${NOME_COMPLETO}/fullchain.pem" ]]; then
    echo "  Sem certificado ainda. Rode sem --skip-certbot."
    exit 1
  fi
fi

echo "[3/5] Vhost Apache SÓ na 443 (a 80 fica com o Tomcat)..."
cat > "${CONFIG_FILE}" << EOF
# Gerado por scripts/script-cert-crm.sh — $(date -Iseconds)
# ${NOME_COMPLETO} → Next :${CRM_PORT}
# Apache somente :443. Porta 80 = Tomcat.

<IfModule mod_ssl.c>
<VirtualHost *:443>
    ServerName ${NOME_COMPLETO}
    ServerAdmin webmaster@${DOMINIO_BASE}

    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/${NOME_COMPLETO}/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/${NOME_COMPLETO}/privkey.pem

    ErrorLog \${APACHE_LOG_DIR}/crm-ssl-error.log
    CustomLog \${APACHE_LOG_DIR}/crm-ssl-access.log combined

    ProxyPreserveHost On
    ProxyRequests Off
    ProxyTimeout 300
    LimitRequestBody 104857600

    ProxyPass        / http://127.0.0.1:${CRM_PORT}/ retry=0 timeout=300
    ProxyPassReverse / http://127.0.0.1:${CRM_PORT}/

    RequestHeader set X-Forwarded-Proto "https"
    RequestHeader set X-Forwarded-Port "443"
    RequestHeader set X-Forwarded-For "%{REMOTE_ADDR}s"
</VirtualHost>
</IfModule>
EOF

a2ensite "$(basename "${CONFIG_FILE}")"
apache2ctl configtest

echo "[4/5] Recarregando Apache (graceful — systemd está 'failed' de propósito)..."
apache2ctl graceful

echo "[5/5] Conferindo certificado..."
ls -l "/etc/letsencrypt/live/${NOME_COMPLETO}/fullchain.pem"

echo ""
echo "=== PRONTO ==="
echo "URL: https://${NOME_COMPLETO}/login"
echo "O Facejus (:3000/:5178) e o Tomcat (:80) não foram mexidos."
echo ""
echo "O site só abre quando o Next estiver na ${CRM_PORT}:  pnpm dev"
echo "Teste:  curl -sI https://${NOME_COMPLETO}/"
