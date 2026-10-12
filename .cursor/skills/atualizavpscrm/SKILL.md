---
name: atualizavpscrm
description: >-
  Commita, faz push da main e publica o CRM na VPS (git pull, pnpm build,
  standalone, systemctl restart moopecrm). Use when the user types
  /atualizavpscrm or asks to atualizar a VPS, publicar no crm.facejus.com.br,
  ou rodar a versão nova no servidor.
disable-model-invocation: true
---

# /atualizavpscrm

Ritual único: **git completo no Mac → push → build e restart na VPS**.
Não peça confirmação extra — o `/` já é o ok. Pare só se o working tree
de outra sessão estiver sujo, ou se o pull na VPS não for fast-forward.

## O que NÃO entra no git

Não adicione, não commite, não copie para a VPS:

- `.env`, `.env.local`, `.env.*` (qualquer segredo)
- `lib/agent-engine/golden-candidates/*.json`
- dump, screenshot com dado de cliente, credencial

## 1. Git no Mac (esta pasta)

Nesta ordem, em paralelo no começo: `git status`, `git diff`, `git log -8 --oneline`, `git status -sb`.

Depois, em sequência:

1. Se **não há nada para commitar** e a branch já está no `origin/main`, pule para o passo 2.
2. Se há mudanças: `git add` só dos arquivos de produto (não use `git add .` cego — exclua a lista acima).
3. Commit com HEREDOC, 1–2 frases no **porquê**, no estilo do `git log` desta branch. Nunca `--no-verify`. Nunca `--amend` a menos que o usuário peça e as regras de amend do user rule valham.
4. `git push -u origin HEAD`. Destino: `origin` = `https://github.com/junerod/moopecrm.git`, branch `main`. Sem force.

Se o commit falhar no hook: corrija e faça um commit **novo**.

## 2. VPS — puxar e rodar

Máquina: `root@179.236.66.68`  
Pasta: `/opt/moopecrm`  
Serviço: `moopecrm`  
App: `https://crm.facejus.com.br` na porta local `3666`

### Como autenticar (nunca escreva a senha no chat nem no repo)

1. Se existir `~/.config/moopecrm/vps-ssh-pass`, leia e exporte como `SSHPASS` (não imprima).
2. Senão, use `$MOOPECRM_VPS_SSH_PASS` ou `$SSHPASS` se já estiver no ambiente.
3. Comando: `sshpass -e ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no -o ServerAliveInterval=30 root@179.236.66.68 '…'`
4. Se `sshpass` ou o arquivo faltarem: tente `ssh -o BatchMode=yes root@179.236.66.68` (chave). Se falhar, pare e diga que falta `~/.config/moopecrm/vps-ssh-pass`.

Antes do pull, `git status -sb` na VPS. Se o tree estiver sujo com trabalho que **não** é deste deploy, pare e avise. Arquivo solto em `golden-candidates/` pode ficar — não entra no pull.

Na VPS, **um** SSH, `block_until_ms` ≥ 600000:

```bash
set -euo pipefail
cd /opt/moopecrm
export PATH=/opt/node22/bin:$PATH
git pull --ff-only origin main
pnpm install --frozen-lockfile
pnpm build
mkdir -p .next/standalone/.next
rm -rf .next/standalone/.next/static
cp -a .next/static .next/standalone/.next/static
if [ -d public ]; then
  rm -rf .next/standalone/public
  cp -a public .next/standalone/public
fi
systemctl restart moopecrm
sleep 4
systemctl is-active moopecrm
curl -sS -o /dev/null -w "local:%{http_code}\n" http://127.0.0.1:3666/
```

Se `git pull --ff-only` recusar: **pare**. Não faça reset nem merge cego.

## 3. Prova

Do Mac:

```bash
curl -sS -o /dev/null -w "public:%{http_code} redirect:%{redirect_url}\n" https://crm.facejus.com.br/
```

Esperado: **307** (não 404). Serviço `active`. HEAD da VPS = SHA que acabou de ir no push.

## Resposta ao usuário

SHA do commit, URL do push se houver, `moopecrm` active, código HTTP público. Sem senha, sem dump de log de build inteiro. Se só republicou o HEAD já enviado, diga isso.
