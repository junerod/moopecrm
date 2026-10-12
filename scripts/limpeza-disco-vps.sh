#!/bin/bash
# Lixo local da VPS. Não mexe em volume de banco nem na sessão do WhatsApp.
# Arquivo que precisa ficar guardado está no R2; o que sobra no disco é temporário.
set -euo pipefail
find /var/lib/docker/containers -name '*-json.log' -size +50M -exec truncate -s 0 {} \;
docker builder prune -af --filter until=48h >/dev/null 2>&1 || true
if docker exec supabase_storage_deskcomm-crm printenv STORAGE_BACKEND 2>/dev/null | grep -qx s3; then
  find /var/lib/docker/volumes/supabase_storage_deskcomm-crm/_data -type f -mtime +1 -delete 2>/dev/null || true
fi
