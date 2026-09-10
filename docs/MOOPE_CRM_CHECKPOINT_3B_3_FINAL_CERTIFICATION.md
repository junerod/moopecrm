# MOOPE CRM — CHECKPOINT 3B.3
# FECHAMENTO FINAL DOS DOIS BLOCKERS DE CERTIFICAÇÃO

**Data:** 2026-09-08  
**Papel:** certificação. Sem Etapa 3C. Sem RAG. Sem vertical. Sem push.  
**Escopo:** somente S1-CERT-VPS e S1-CERT-WA.  
**Arquitetura 3B não reaberta.**

---

## 1. Resumo executivo

A instalação fresca **funciona** de ponta a ponta no ambiente para o qual o spec foi desenhado.

O WhatsApp real tem **inbound 1 real** (`Teste MOOPE MOOPE-WA-3B3-215952`). O **nível 4 não fechou**: outbound Inbox e inbound 2 **ausentes** no banco. Token `MOOPE-WA-3B3-215952`. Detalhe: `docs/MOOPE_CRM_S1_CERT_WA_NIVEL_4_RESULTADO.md`.

| Pergunta | Resposta |
|---|---|
| WHATSAPP REAL FUNCIONA END-TO-END | **NÃO** |
| INSTALAÇÃO FRESCA FUNCIONA END-TO-END | **SIM** |
| **MOOPE CRM CERTIFICADO PARA PILOTO COM CLIENTE REAL** | **NÃO** |

S1-CERT-VPS **fechado**. S1-CERT-WA **aberto só no nível 4** (outbound Inbox + inbound 2 + takeover).

Níveis WhatsApp medidos:

| Nível | Resultado |
|---|---|
| 1 — WAHA responde | **SIM** (`GET /ping` 200) |
| 2 — sessão + QR com conteúdo decodificável | **SIM** (HTTP 200, `image/png`, `naturalWidth=292`, jsQR `decoded=true`) |
| 3 — telefone QA escaneia → WORKING/CONNECTED | **SIM** — `org_62d52837_055ec6` WORKING, pushName Moope Tecnologia |
| 4 — inbound externo + outbound humano no telefone | **NÃO** — inbound 1 SIM; outbound Inbox e inbound 2 ausentes |

O quadrado branco da 3B.2 **não é CSS**. Em sessão WAHA `FAILED`, o proxy devolve **422 com body vazio**; o `<img class="… bg-white">` continua visível. Em sessão fresca `SCAN_QR_CODE`, o mesmo `<img>` carrega PNG real.

---

## 2. Commit inicial

`b2d2d2207d92176c3df0c8703681c912c7c2fda1` — `fix(crm): close pilot acceptance defects` (fechamento da 3B.2).

Relatório anterior: `docs/MOOPE_CRM_CHECKPOINT_3B_2_PILOT_ACCEPTANCE.md`.

Pré-existente no working tree (não incorporado):

- `M` menu/i18n/manual/followup specs e `README.md`
- `?? .cursor/`
- `?? docs/MOOPE_CRM_ETAPA_3A_READY_MODELS_AUDITORIA.md`
- `?? lib/agent-engine/golden-candidates/…`

---

## 3. Ambiente fresh

| Peça | Valor medido |
|---|---|
| OS | darwin 24.6.0 |
| Branch | `main` @ `b2d2d220` (antes do commit desta etapa) |
| App | `pnpm e2e:build` + Playwright `next start` :3001 |
| Browser | Chromium (Playwright) |
| Stack do operador (não zerado) | projeto `deskcomm-crm`, Kong `127.0.0.1:54321`, DB `54322`, **4 orgs** o tempo todo |
| Stack isolado 3B.3 | projeto `deskcomm-vps-fresh` em `/tmp/deskcomm-vps-fresh-3b3` |
| Isolado API | `http://127.0.0.1:55321` |
| Isolado DB | `127.0.0.1:55322` |
| WAHA | `deskcomm-waha` healthy, `127.0.0.1:3030/ping` → 200 |
| Redis | `deskcomm-redis` + SRH `127.0.0.1:8079` → 200 |
| Resend | ausente no servidor do teste (UI honesta: “não envia e-mail”) |

O banco de desenvolvimento do operador **não** foi resetado.

---

## 4. Como o banco fresh foi criado

1. Diretório temporário `/tmp/deskcomm-vps-fresh-3b3` com `supabase/config.toml` (`project_id = deskcomm-vps-fresh`), **migrations vazias** (mesmo contrato do CI: a cadeia fresh não sobe) e templates de e-mail copiados do repo.
2. Portas deslocadas para não colidir com `deskcomm-crm`: API **55321**, DB **55322**, studio 55323, inbucket 55324.
3. `npx supabase start` nesse diretório (CLI 2.117.0; imagens ECR inclusive `postgres:17.6.1.167`).
4. Extensões via `docker exec supabase_db_deskcomm-vps-fresh psql` — o mesmo prelúdio do `.github/workflows/e2e.yml`:

```sql
create schema if not exists extensions;
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists vector with schema public;
create extension if not exists citext with schema public;
create extension if not exists pg_trgm with schema public;
```

5. `psql -v ON_ERROR_STOP=1` de `supabase/baseline.sql` (o mesmo arquivo do `install.sh`).
6. Restart **somente** de `supabase_realtime_deskcomm-vps-fresh` (publication nasce no baseline, depois do Realtime já ter subido).

Contagem imediatamente após o baseline: **0 organizações**.

---

## 5. Bootstrap executado

Caminho real do produto, com env **explícito** para o stack isolado (para o script não herdar o `.env.local` do operador):

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55321
OWNER_EMAIL=dono@qa.local
OWNER_PASSWORD=QaVps!2026#Dono
OWNER_ORG_NAME='Minha Empresa'
pnpm exec tsx scripts/bootstrap-owner.ts
```

Saída observada:

- dono criado `87d1b715-a53a-41af-9448-afbb15354a18`
- org criada `62d52837-e77d-40f0-b06d-29d76a08c5cf`
- dono associado como `admin`
- dono promovido a `platform_admins`

Nenhum `INSERT` manual de organização de teste.

---

## 6. Número de orgs inicial

| Momento | Isolado (`:55322`) | Operador (`:54322`) |
|---|---|---|
| Após baseline | 0 | 4 |
| Após bootstrap | **1** | 4 |
| Após vps-fresh verde | **1** | 4 |

`orgRow().limit(1).single()` era válido: havia exatamente uma org.

---

## 7. Owner inicial

- e-mail: `dono@qa.local` (confirmado)
- org: `Minha Empresa`, `onboarded_at` **null**
- após a jornada: display `Loja QA VPS`, timezone `America/Sao_Paulo`, `onboarded_at` **preenchido**
- usuários no isolado ao fim: somente `dono@qa.local` (o convite de `atendente@qa.local` não cria usuário até o aceite)

---

## 8. Resultado vps-fresh

`tests/e2e/vps-fresh-onboarding.spec.ts` rodado **sem skip**, `--workers=1`, `AUTH_RATE_LIMIT_LOGIN_IP=1000`.

Rodada final (log `.superpowers/evidence/vps-qa/vps-fresh-3b3-retry2.log`):

```
12 passed (40.1s)
PLAYWRIGHT_EXIT:0
```

| Caso | Resultado |
|---|---|
| J1.2 senha errada | verde |
| J1.1 wizard (`onboarded_at` null) | verde |
| J1.12 `/app` bloqueado | verde |
| J1.3 + J1.4 termos / nome / timezone | verde |
| J1.5 QR com pixels + HTTP 200 | verde (5.5s) |
| J1.11 + J1.6 abandono e retomada | verde |
| J1.7 Simple Mode COPILOT comercial, 0 agentes | verde |
| J1.24 wizard não publica agente | verde |
| J1.8 convite sem Resend | verde (após alinhamento de copy — ver §9) |
| J1.9 `onboarded_at` + inbox | verde |
| J1.10 MFA + 10 recovery codes | verde (após locator do modal — ver §9) |
| J1.13 wizard não reabre | verde |

Screenshots em `.superpowers/evidence/vps-qa/` (gitignored).

---

## 9. Falhas encontradas

Nenhum defeito de **produto** na instalação fresca.

| Falha | Classe | O quê |
|---|---|---|
| J1.8 primeira rodada | **TESTE** | Spec pedia `/não está configurado neste servidor/`. A UI já dizia “Esta instalação não envia e-mail” e mostrava o link copiável. Contrato honesto intacto; copy do spec estava atrasada. |
| J1.10 segunda rodada | **TESTE** | `getByRole(heading, /verificação em duas etapas/i)` bateu em **dois** headings (página + modal `#mfa-title`). MFA abriu. Locator alargado demais. |

Nenhuma falha **INFRA** depois que o stack isolado ficou healthy. Nenhuma falha **CONFIGURAÇÃO** do produto: Resend ausente foi o estado certo.

`orgRow()` **não** foi alterado. Nenhum skip. Nenhuma assertion removida. Nenhum seed do estado final.

---

## 10. WAHA usado

- Contêiner: `deskcomm-waha` (já healthy no Docker do operador)
- Base: `http://127.0.0.1:3030`
- Auth: `X-Api-Key` presente, comprimento 64 (valor **não** registrado)
- `GET /ping` → 200, body `{"message":"pong"}`
- `GET /api/sessions` → 200

---

## 11. Sessão criada

| Campo | Valor de QA |
|---|---|
| Nome | `org_62d52837` (prefixo dos 8 primeiros chars do org id) |
| Org | `62d52837-e77d-40f0-b06d-29d76a08c5cf` |
| Estado no J1.5 | `SCAN_QR_CODE` |
| Duplicata | uma sessão `org_*` após o teste |
| Após evidência | `DELETE` → 200; lista restante **vazia** (QR de pareamento invalidado) |

Sessões `FAILED` herdadas da 3B.2 (`org_518866cc`, `org_b34f54cb`, `org_f1808ba6`) foram o cenário do quadrado branco. O `beforeAll` do spec apaga `org_*` antes da jornada.

---

## 12. Investigação QR

Cadeia medida:

UI `<img src="…/onboarding/whatsapp/qr">`  
→ `app/api/v1/onboarding/whatsapp/qr/route.ts`  
→ `GET {WAHA}/api/{session}/auth/qr?format=image`  
→ bytes / JSON de erro.

Causa do branco (3B.2):

1. Sessão no WAHA em `FAILED`.
2. Upstream **422**, `content-type: application/json`, body `{"error":"Sess…`.
3. O proxy, em `!upstream.ok`, devolve `NextResponse(null)` com o mesmo status.
4. O `<img>` permanece no DOM com fundo branco (`h-48 w-48 … bg-white`).
5. `qr_renderizado=true` na 3B.2 media só `visible`, não pixels.

Não é cache. Não é CSS sozinho. Não é session name errado quando a sessão é nova.

Em sessão fresca `SCAN_QR_CODE` o mesmo caminho devolve PNG.

Correção de produto **não** entrou: J1.5 passou em instalação limpa. O branco em sessão morta fica como S2 de UX (ver §27).

---

## 13. HTTP / content-type / bytes / naturalWidth

Medido no **proxy da UI** (J1.5, `.superpowers/evidence/vps-qa/j1.5-qr-http.json`):

| Checagem | Valor |
|---|---|
| HTTP | 200 |
| content-type | `image/png` |
| naturalWidth | 292 |
| naturalHeight | 292 |

Medido **direto no WAHA** (sessão de sonda `org_3b3probe`, depois apagada):

| Checagem | Valor |
|---|---|
| HTTP | 200 |
| content-type | `image/png` |
| bytes | 5323 |
| magic | `89504e47` (PNG) |
| PIL | 292×292, 2 cores, módulos pretos/brancos |

Sessão `FAILED` (contraste): HTTP 422, JSON, 156 bytes, magic `{`.

O spec permanente agora recusa “só o elemento visível”: exige 200 + `image/*` + `naturalWidth > 0` + `naturalHeight > 0`.

---

## 14. QR escaneável

**SIM** no nível 2 (conteúdo decodificável), **não** escaneado por telefone.

jsQR (one-off, fora do `package.json` do produto) sobre os PNGs gitignored:

| Arquivo | decoded | prefixo do payload | tamanho |
|---|---|---|---|
| `qr-waha-direct.png` | true | `https://wa.me/se` | 292×292 |
| `j1.5-qr-visivel.png` | true | `https://wa.me/se` | screenshot da tela |

Payload completo **não** foi gravado. Sessão de pareamento **apagada** depois da evidência.

---

## 15. Dispositivo QA

**SIM** (nível 3). O operador escaneou depois da 3B.3 inicial. Sessão viva: `org_62d52837_055ec6`. Número só pelo sufixo `…9343`. Detalhe em `docs/MOOPE_CRM_CHECKPOINT_3B_3_WHATSAPP_REAL_RESULTADO.md`.

**WHATSAPP REAL CONECTADO: SIM** (pareado). **WHATSAPP REAL FUNCIONA END-TO-END: NÃO** (inbound 1 real sim; outbound Inbox e inbound 2 ausentes).

---

## 16. Sessão conectada

**SIM.** WAHA `GET /api/sessions/org_62d52837_055ec6` → `WORKING`. Residual `org_62d52837` hoje em **SCAN_QR_CODE** (era FAILED; restart-all do Docker). Não escanear. Não há duas WORKING.

---

## 17. Inbound externo

**SIM** para `Teste MOOPE MOOPE-WA-3B3-215952` (LID real, `f1a23450` @ 01:03:07Z). A `Teste final MOOPE CRM` simulada (`e78831e0`) **não** conta.

`Resposta MOOPE MOOPE-WA-3B3-215952` e `Depois humano MOOPE-WA-3B3-215952`: **0** rows.

---

## 18. Inbox

**SIM** para o inbound 1: conversa `65dc093e`, preview = a frase do token. Sem screenshot de UI.

---

## 19. Lead / contact / conversation

Do inbound 1 real: contact `1212b06b` (`Suporte MOOPE`), conversa `65dc093e`, org `62d52837`. 1 contact / 1 conversation / 1 message. Sem tabela `leads`.

---

## 20. Outbound humano

**NÃO.** `Resposta MOOPE MOOPE-WA-3B3-215952` ausente. `sent_via=user` no isolado = 0.

---

## 21. Recebimento no telefone

**NÃO MEDIDO.** Sem outbound persistido e sem confirmação no contexto.

---

## 22. Duplicação

Inbound 1: **1:1** (1 webhook, 1 message, 1 external_id). Outbound e inbound 2: **não medido** (ações ausentes).

---

## 23. Takeover smoke

**NÃO.** Conversa do inbound 1 sem `assignee_kind`, sem `bot_silenced_until`. Humano não assumiu pelo Inbox. `sent_via=ai` após WORKING = 0 (não substitui takeover).

---

## 24. Testes

| Comando | Resultado |
|---|---|
| `pnpm exec playwright test tests/e2e/vps-fresh-onboarding.spec.ts --workers=1` | **12 passed (40.1s)** |
| Smoke WhatsApp real nível 3 | **SIM** (WORKING) |
| Smoke WhatsApp real nível 4 | **PARCIAL** — inbound 1 persistiu; outbound + inbound 2 ausentes |
| Teste permanente do QR | J1.5 reforçado (HTTP + MIME + `naturalWidth`/`naturalHeight`) |

---

## 25. Typecheck

`pnpm typecheck` → exit 0.

---

## 26. Lint

`pnpm exec eslint tests/e2e/vps-fresh-onboarding.spec.ts` → exit 0.

---

## 27. Bugs

### BUG-3B3-WA-01 — QR branco em sessão FAILED (S2, não bloqueia J1.5)

- **Severidade:** S2 (UX). Não é S1 desta certificação depois da instalação limpa.
- **Causa:** proxy `onboarding/whatsapp/qr` devolve body vazio quando o WAHA responde erro; a UI mantém `<img>` branco.
- **Reprodução:** sessão `org_*` em `FAILED`; abrir o passo QR; `<img>` visível, `naturalWidth=0`, screenshot branco.
- **Correção:** **não feita** neste checkpoint (J1.5 passou com sessão nova; briefing proibiu S2).
- **Regressão:** J1.5 agora falha se o PNG não carregar.
- **Evidência:** `.superpowers/evidence/pilot-whatsapp/qr-failed-session.json`.

### BUG-3B3-VPS-01

**Não aberto.** A instalação fresca não revelou defeito de produto.

S2/S3 da 3B.2 (Editar card, Continuar abaixo da dobra, copy de Locação, overlay de lost) **permanecem backlog**.

---

## 28. Correções

Somente o spec `tests/e2e/vps-fresh-onboarding.spec.ts`:

1. J1.5 — prova permanente: response 200 + `image/*` + `naturalWidth`/`naturalHeight` > 0 (não aceita quadrado branco).
2. J1.8 — assertion alinhada à copy atual (“Esta instalação não envia e-mail”). Continua exigindo link `/team/accept-invite/`.
3. J1.10 — heading do **modal** (`Configure a verificação…` / `#mfa-title`). Continua exigindo 10 recovery codes.

Nenhuma mudança de runtime, schema, UI de produto ou rota QR.

---

## 29. Migrations

**Nenhuma.**

---

## 30. Arquivos alterados (desta etapa)

- `tests/e2e/vps-fresh-onboarding.spec.ts`
- `docs/MOOPE_CRM_CHECKPOINT_3B_3_FINAL_CERTIFICATION.md`

Não versionados (evidência): `.superpowers/evidence/vps-qa/`, `.superpowers/evidence/pilot-whatsapp/`.  
`.env.e2e` foi apontado ao isolado + WAHA `:3030` durante o ensaio e **restaurado** aos placeholders (`54321` / `:3999` / `:3998`).

---

## 31. Commit final

Um commit local (sem push), se esta árvore o contiver:

`fix(crm): certify fresh install and whatsapp onboarding`

---

## 32. Working tree

Depois do commit desta etapa, o esperado é:

- arquivos da 3B.3 **limpos**
- sujeira pré-existente **intocada** (menu/i18n/manual, `.cursor/`, auditoria 3A, golden-candidate)

---

## 33. Confirmação sem push

**Nenhum push.** `main` remota não foi atualizada por esta sessão.

---

## 34. Riscos restantes

1. **S1-CERT-WA nível 4** — WORKING existe. As três frases do smoke não estão no banco como telefone + Inbox (`sent_via=user`). A inbound simulada não conta.
2. **BUG-3B3-WA-01 (S2)** — sessão FAILED ainda pinta quadrado branco; um operador que reabre o wizard em cima de sessão morta vê o mesmo sintoma da 3B.2.
3. S2/S3 da 3B.2 (Editar card, mobile, copy Locação, overlay lost).
4. Stack isolado em `/tmp/deskcomm-vps-fresh-3b3` continua no Docker local até `npx supabase stop` naquele diretório. Não é o banco do operador.
5. Aviso do servidor em J1.10 (`getSession()` vs `getUser()`) é pré-existente; não foi aberto como S1 aqui.

---

# Tabela final

| Critério | SIM/NÃO | Evidência |
|---|---|---|
| INSTALAÇÃO BASELINE LIMPA | **SIM** | baseline.sql no Postgres `55322`; 0 orgs antes do bootstrap |
| BOOTSTRAP OWNER REAL | **SIM** | `scripts/bootstrap-owner.ts` → `dono@qa.local` + 1 org |
| VPS FRESH COMPLETO PASSOU | **SIM** | 12/12, 40.1s, `vps-fresh-3b3-retry2.log` |
| WAHA REAL RESPONDE | **SIM** | `/ping` 200; `waha-nivel1.json` |
| SESSÃO WAHA FOI CRIADA | **SIM** | `org_62d52837` em `SCAN_QR_CODE` |
| QR POSSUI CONTEÚDO REAL | **SIM** | HTTP 200, `image/png`, 292×292, 5323 bytes no WAHA |
| QR É ESCANEÁVEL | **SIM** | jsQR `decoded=true` (`https://wa.me/se…`) |
| DISPOSITIVO QA CONECTOU | **SIM** | sessão `org_62d52837_055ec6`, pushName Moope Tecnologia |
| WHATSAPP FICOU CONNECTED/WORKING | **SIM** | WAHA status `WORKING` |
| MENSAGEM EXTERNA ENTROU | **SIM** | inbound 1 `f1a23450` @ 01:03:07Z (LID real) |
| MENSAGEM APARECEU NO INBOX | **SIM** | preview conv `65dc093e` |
| CONTATO/CONVERSA FORAM CRIADOS CORRETAMENTE | **SIM** | contact `1212b06b` / conv `65dc093e` |
| RESPOSTA HUMANA SAIU DO INBOX | **NÃO** | 0 `Resposta MOOPE…`; 0 `sent_via=user` |
| RESPOSTA CHEGOU NO TELEFONE | **NÃO MEDIDO** | sem outbound; sem confirmação explícita |
| NÃO HOUVE DUPLICAÇÃO | **PARCIAL** | inbound 1 = 1:1; outbound/inbound 2 ausentes |
| TAKEOVER CONTINUOU PROTEGIDO | **NÃO** | assignee/silence NULL |
| NENHUM S0 ABERTO | **SIM** | nenhum S0 nesta etapa |
| NENHUM S1 DE CERTIFICAÇÃO ABERTO | **NÃO** | S1-CERT-WA nível 4 |

---

## Smoke real final

Medição 2026-09-09 ~13:22 UTC. Detalhe: `docs/MOOPE_CRM_S1_CERT_WA_NIVEL_4_RESULTADO.md`.

| Prova | SIM/NÃO |
|---|---|
| Inbound real 1 | **SIM** |
| Webhook real | **SIM** |
| Persistência | **SIM** |
| Inbox | **SIM** |
| Outbound humano | **NÃO** |
| sent_via=user | **NÃO** |
| Provider aceitou | **NÃO** |
| Telefone recebeu | **NÃO MEDIDO** |
| Inbound real 2 | **NÃO** |
| Mesma conversa | **NÃO** |
| Takeover | **NÃO** |
| IA não respondeu | **SIM** |
| Sem duplicação | **PARCIAL** |
| Sessão final WORKING | **SIM** |
| S1-CERT-WA nível 4 fechado | **NÃO** |

# Veredito

**WHATSAPP REAL FUNCIONA END-TO-END: NÃO**

**MOOPE CRM CERTIFICADO PARA PILOTO COM CLIENTE REAL: NÃO**

S0/S1 restantes:

1. **S1-CERT-WA (nível 4)** — outbound Inbox `Resposta MOOPE MOOPE-WA-3B3-215952` (`sent_via=user`) na conv `65dc093e`; inbound 2 `Depois humano MOOPE-WA-3B3-215952`; takeover; confirmação explícita do telefone. Inbound 1 já está comprovado.

S1-CERT-VPS está **fechado**.

---

# Stop

Sem 3C. Sem RAG. Sem feature nova. Sem push. Esperar revisão final.

---

## Adendo 2026-09-09 ~22:43 UTC — tentativa de fecho nível 4

Não apaga o recorte de 13:22Z. Evidência nova no isolado:

| Prova | SIM/NÃO |
|---|---|
| Inbound real 1 | **SIM** `f1a23450` |
| Outbound humano | **SIM** `a9593549` `sent_via=user` |
| Inbound real 2 | **SIM** `ead997af` webhook `3dcba575` |
| Mesma conversa / contact | **SIM** `65dc093e` / `1212b06b` |
| Takeover após inbound 2 | **SIM** `user` + `infinity` |
| IA / automação | **SIM** (zero envio) |
| Sem duplicação | **SIM** 1:1 nas três frases |
| Sessão WORKING | **SIM** `org_62d52837_055ec6` |
| Telefone recebeu | **NÃO MEDIDO** |
| S1-CERT-WA nível 4 | **NÃO** |

**WHATSAPP REAL FUNCIONA END-TO-END: NÃO** (falta confirmação explícita do telefone)

**PRONTIDÃO OPERACIONAL WAHA PARA PILOTO: NÃO** (residual FAILED; banner/QR; CORE sem pin)

Detalhe: `docs/MOOPE_CRM_S1_CERT_WA_FECHAMENTO_FINAL.md`.

---

## Adendo 2026-09-10 ~00:35 UTC — fecho funcional + prontidão

Não apaga os recortes de 13:22Z nem de ~22:43 UTC (telefone ainda **NÃO MEDIDO** naquela hora).

O operador confirmou visualmente no WhatsApp externo:

`Resposta Inbox MOOPE-INBOX-S1-193014`

**TELEFONE EXTERNO RECEBEU: SIM**

**S1-CERT-WA NÍVEL 4: SIM**

**WHATSAPP REAL FUNCIONA END-TO-END: SIM**

**CERTIFICAÇÃO FUNCIONAL E2E: SIM**

A prontidão operacional (residual não domina status; QR protegido; pin de produção documentado) está em `docs/MOOPE_CRM_CHECKPOINT_3B_3_WAHA_OPERATIONAL_READINESS_RESULTADO.md`.

**PRONTIDÃO OPERACIONAL WAHA PARA PILOTO: SIM**

**MOOPE CRM 3B.3 PODE SER ENCERRADO: SIM**
