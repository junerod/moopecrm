# MOOPE CRM — S1-CERT-WA
# Diagnóstico da “queda” da sessão WhatsApp real

**Data da medição:** 2026-09-09 ~01:08 UTC  
**Escopo:** só investigar. Sem QR. Sem restart. Sem apagar sessão. Sem feature. Sem 3C. Sem push.

| Campo | Valor |
|---|---|
| CRM | `http://localhost:3666` |
| Org | `62d52837-e77d-40f0-b06d-29d76a08c5cf` (Loja QA VPS) |
| DB | isolado `55322` |
| Channel vivo | `17b381d2` / `org_62d52837_055ec6` |
| Channel residual | `988c4125` / `org_62d52837` FAILED desde `2026-09-08 19:47:23Z` |
| T0 | `2026-09-09T00:59:52Z` |
| Token | `MOOPE-WA-3B3-215952` |

Nada neste arquivo contém número completo, segredo ou corpo de cliente além da frase de certificação.

---

## Veredito curto

A sessão WORKING **não caiu no inbound**. A mensagem real **chegou**.

O que o operador viu como “queda + espere para parear” casa com **dois fatos distintos**:

1. **UI** — a sessão FAILED velha ainda está na tela de Conexões, dentro da janela de 6h de `fraseEsperaPareamento` (“O WhatsApp pediu espera depois da queda…”). Essa copy é **nossa**, não um evento WAHA às 01:03.
2. **Socket** — às `01:07:11Z` (~4 min **depois** do inbound) o WhatsApp fechou o stream com **428 Connection Terminated**. O WAHA voltou sozinho: STARTING → WORKING em ~3 s. Estado final: **WORKING**.

---

## 1. Estado capturado (sem mutação)

Nenhum `DELETE` / `start` / `restart` / QR / limpeza de volume / restart de container foi feito nesta investigação.

### WAHA agora

| Sessão | Status | me | presence |
|---|---|---|---|
| `org_62d52837_055ec6` | **WORKING** | sim (cauda `9343`, pushName Moope Tecnologia) | offline / None |
| `org_62d52837` | **FAILED** | null | null |

`GET /api/server/version` → `2026.8.1` / engine **NOWEB** / tier **CORE**.

### Docker `deskcomm-waha`

| Campo | Valor |
|---|---|
| Image | `devlikeapro/waha:noweb` (tag móvel; image.version=noweb; created 2026-08-14) |
| Status | running, **healthy** |
| StartedAt | `2026-09-08T17:06:16Z` (antes do T0) |
| RestartCount | **0** |
| OOMKilled | **false** |
| ExitCode | 0 |
| FinishedAt | `2026-09-08T04:34:54Z` (ciclo anterior, não desta janela) |
| Volumes | `deskcommcrm_waha-data` → `/app/.sessions` (existe `noweb/`); `deskcommcrm_waha-media` → `/app/.media` |

**O container não reiniciou no incidente.**

Há um único container WAHA (`deskcomm-waha`). Não há segundo WAHA.

---

## 2. Timeline

| Marca | UTC | O quê |
|---|---|---|
| T-5 min | 00:54:52 | Sem evento de sessão no webhook da org. Sessão já era WORKING (health/API). |
| T0 | 00:59:52 | Início do smoke assistido. |
| T1 | 01:03:07.343 | WAHA: `identity key changed or new contact, session will be re-established` no **jid do remetente** (`…@lid`). Isto é sessão Signal **do contato**, não logout do chip. |
| T1 | 01:03:07.353–.477 | WAHA envia `message.any`; CRM responde **200**. |
| T1 | 01:03:07.370 | `webhook_events_log` `59ce5bf7` com o token. |
| T1 | 01:03:07.395 | `messages` `f1a23450` persistida. |
| T2 | 01:03:54–01:04:10 | GETs de chats/contacts/lids + `GET /api/sessions/org_62d52837_055ec6` **200**. Channel `17b381d2` ainda **WORKING**. Health check `01:04:10`. |
| T3 | 01:07:11.080 | Primeiro sinal de desconexão **desta** sessão viva: `state.change` `connection=close`, `lastDisconnect` **428 Precondition Required / Connection Terminated**. |
| T4 | 01:07:13.090 | `session.status=STARTING`. |
| T5 | 01:07:14.752 | `session.status=WORKING`. `connection=open`. Channel `last_status_change_at=01:07:14`. |
| Agora | ~01:08 | API WAHA **WORKING**, `has_me=true`. |

Não há `session.status` de FAILED/LOGOUT/STOPPED em `org_62d52837_055ec6` nesta janela.

---

## 3. A mensagem chegou?

Frase: `Teste MOOPE MOOPE-WA-3B3-215952`

| Camada | Resultado |
|---|---|
| WhatsApp → WAHA | **SIM** — log NOWEB + `message.any` |
| Webhook disparado | **SIM** — POST `http://host.docker.internal:3666/api/v1/webhooks/waha` |
| CRM recebeu | **SIM** — HTTP 200; row `59ce5bf7`; `is_sim=false` |
| Persistiu | **SIM** — `f1a23450`, inbound, `sent_via=external_device`, `status=delivered` |
| Contact | `1212b06b` display `Suporte MOOPE` (não é `QA Certificacao`) |
| Conversation | `65dc093e` |
| `external_id` | `false_…@lid_…` (LID real, não o `curl` `5551…0111`) |
| Cópias | **1** |
| Banco operador `54322` | **0** |

Sequência comprovada:

```
mensagem externa
→ WAHA viu
→ webhook 200
→ persistência
→ (4 min depois) socket 428 + auto-reconnect
```

Não foi: queda primeiro → mensagem nunca recebida.

---

## 4. Hipóteses A–L

| # | Hipótese | Veredito | Evidência |
|---|---|---|---|
| A | Logout/revogação WhatsApp do chip | **Não comprovado** | `me` continua; status final WORKING; sem LOGOUT |
| B | Conflito de sessão WAHA | **Parcial / residual** | Duas sessões no mesmo WAHA: FAILED antiga + WORKING. Só uma tem o número. Não desconectamos nada. |
| C | WhatsApp Web/Desktop concorrente | **Não medido** | Sem prova. `deviceJids=[]` às 01:01:39 não prova ausência de Web. |
| D | Restart/crash do container | **Não** | RestartCount 0, StartedAt 17:06Z, OOMKilled false |
| E | Persistência corrompida | **Não comprovado** | Volume `waha-data` intacto; sessão sobreviveu ao 428 |
| F | Timeout/reconnect WAHA | **Sim, depois** | 01:07:11 close → STARTING → WORKING ~3 s. Não é o T1. |
| G | Erro de websocket | **Sim, depois** | 428 Connection Terminated. Mais cedo hoje: `stream:error` **503** às 21:58 e 22:02 (também auto-recuperou). |
| H | Sessão substituída | **Não** | Mesmo nome `org_62d52837_055ec6` |
| I | Erro de webhook/app causou a queda | **Não** | Webhook 200 no T1; o 428 veio 4 min depois. Correlação ≠ causalidade. |
| J | Bloqueio/rate/cooldown WhatsApp | **Provável na UI; não no T1** | Copy de espera de 6h do **nosso** CRM sobre a FAILED de 19:47Z (janela até ~01:47Z). Operador relatou “aguardar antes de novo pareamento”. |
| K | Configuração WAHA | **Contribui ao risco, não ao T1** | Engine NOWEB; `WHATSAPP_RESTART_ALL_SESSIONS=True`; hook global no 3666; imagem **sem pin**; tier **CORE** (compose local), não Plus |
| L | Outro | **Sim** | “identity key changed” no contato novo é rotina NOWEB; assusta no log, não derruba o chip |

---

## 5. Conflitos mapeados (sem desconectar)

| Instância | Estado |
|---|---|
| `org_62d52837_055ec6` | WORKING, cauda 9343 |
| `org_62d52837` | FAILED, sem `me`, `last_status_change` 19:47:23Z |
| Outro container WAHA | não existe |
| Outra instância Deskcomm no 54322 | org/sessão ausentes |
| Next deste repo | só `*:3666` |

A tela `/app/connections` lista **os dois** canais. A FAILED oferece “Gerar novo QR” e, enquanto `now() < last_status_change + 6h`, a espera de pareamento.

Cálculo: `19:47:23Z + 6h = 01:47:23Z`. No horário do relato (~01:05Z) a espera **ainda valia** para a sessão morta.

Arquivo: `lib/channels/pareamento-cooldown.ts` (`fraseEsperaPareamento`).

---

## 6. Persistência

- Volume Docker nomeado `deskcommcrm_waha-data`, mount RW `/app/.sessions`.
- Árvore: `/data/noweb/` presente.
- `WHATSAPP_RESTART_ALL_SESSIONS=True` — sobrevive restart de container (não exercitado aqui).
- Sem evidência de corrupção. Storage **não** foi apagado.

---

## 7. Configuração WAHA (sem atualizar)

Compose local (`docker-compose.yml`):

- `image: devlikeapro/waha:noweb` (não é a tag pinada de `docker-compose.prod.yml`)
- `WHATSAPP_DEFAULT_ENGINE=NOWEB`
- `WHATSAPP_HOOK_URL=http://host.docker.internal:3666/api/v1/webhooks/waha`
- Eventos: `message.any,message.ack,message.edited,message.revoked,session.status,state.change`
- Dashboard **ligado**
- Sessão: `noweb.store.enabled=true`, `fullSync=false`, `markOnline=true`
- Ignora status/broadcast/channels/groups

Doutrina do repo pede WAHA **Plus** em produção. Este container responde **CORE**.

---

## 8. App / webhook

O ingest do token funcionou. Não há erro de app no T1 que explique queda.

O worker `deskcomm-agent-worker` estava em loop de restart **antes** deste incidente; não há evidência de que ele tenha fechado o socket WhatsApp.

Há risco de produto **depois**: se o operador clicar “Gerar novo QR” na FAILED residual, isso **pode** provocar logout/cooldown de verdade no mesmo chip. Nesta execução **não** vimos `SCAN_QR` pós-T0 na sessão viva.

---

## 9. Classificação

**CAUSA COMPROVADA (o que o sistema fez):** inbound real após T0; sessão viva permaneceu WORKING no T1; às 01:07 o WhatsApp encerrou o stream com 428 e o WAHA religou sozinho.

**CAUSA PROVÁVEL (o que o operador sentiu):** mensagem de espera do CRM na sessão FAILED residual (ainda dentro das 6h) e/ou o blip STARTING de 3 s às 01:07, lidos como “caiu, não pareie”.

**Não inventado:** logout do chip, segundo WhatsApp Web, OOM, webhook derrubando o WhatsApp.

| Família | Encaixa? |
|---|---|
| DEFEITO MOOPE | **Parcial** — duas linhas de canal (FAILED+WORKING) + copy de cooldown que parece queda atual |
| CONFIGURAÇÃO WAHA | Risco (CORE, tag móvel), não causa do T1 |
| INSTABILIDADE/RESTRIÇÃO WHATSAPP | **Sim** — 428 agora; 503 mais cedo no mesmo dia |
| CONFLITO DE SESSÃO | Residual FAILED no mesmo WAHA/org |
| INFRAESTRUTURA | Container estável |
| OUTRO | Rekey Signal do contato novo |

**Nível de confiança:** alto no “inbound chegou e o chip não foi deslogado”; médio no “a copy de 6h foi exatamente o que o operador leu”; baixo em Web concorrente.

**Impacto:** o smoke de inbound **passou**. O S1-CERT-WA **não** fecha (falta outbound Inbox + inbound 2 + takeover). Novo QR agora é **contraproducente**.

---

## 10. Decisão de produção

1. **Essa arquitetura QR/WAHA está suficientemente estável para piloto?**  
   **Ainda não.** Inbound real funcionou, mas o socket NOWEB já flapou 503 no mesmo dia e 428 após o teste; a UI mistura canal morto com canal vivo.

2. **O ocorrido é recuperável automaticamente?**  
   **O 428, sim** (3 s). Logout de verdade, não — exige QR depois do cooldown.

3. **Exige novo QR?**  
   **Não.** A sessão viva está WORKING. Novo QR viola o pedido do operador e a própria regra de espera.

4. **O CRM detecta a desconexão?**  
   Detecta `session.status` e grava o channel. O blip STARTING/WORKING de 3 s **não** deixa o canal em FAILED. A FAILED visível é **outra** linha, de 19:47Z.

5. **O usuário recebe mensagem clara?**  
   **Não o bastante.** A frase de espera atribui ao WhatsApp uma queda da sessão **errada**. A WORKING ao lado pode dizer “Conectado!” ao mesmo tempo.

6. **Existe estratégia de reconnect?**  
   Sim: `WHATSAPP_RESTART_ALL_SESSIONS`; `POST /api/v1/channel-sessions/[id]/reconnect` (suave vs `force` logout). Não usar `force` agora.

7. **Risco de mostrar “Conectado” com WAHA caído?**  
   Existe em tese (health 30 s). Neste incidente o inverso aconteceu: UI de **desconectado** (FAILED velha) com WAHA **WORKING**.

8. **WAHA em produção ou conveniência/beta?**  
   Manter como canal primário do produto, mas **não** certificar piloto enquanto: (a) o smoke nível 4 não fecha; (b) a UI não esconde FAILED residual quando há WORKING da mesma org; (c) produção usa imagem **Plus pinada**, não `waha:noweb` CORE.

---

## 11. Correção proposta (não implementada)

Não há bug de ingest a corrigir para o inbound.

Correção mínima **depois**, se autorizada:

| Peça | O quê | Regressão |
|---|---|---|
| `components/connections/ConnectionsClient.tsx` + lista de canais | Não oferecer “Gerar novo QR” / copy de queda numa FAILED se a org já tem outra sessão WORKING | UI: org com WORKING+FAILED mostra espera só se a WORKING não existir |
| `lib/channels/pareamento-cooldown.ts` | Copy não deve soar como “o número de agora caiu” | teste da frase + da janela de 6h |
| Onboarding de QR | Não deixar `org_<id>` FAILED viva ao criar `org_<id>_<suffix>` | invariante: no máximo uma sessão não-arquivada por org no WAHA, ou FAILED residual arquivada |

Não implementar nesta execução.

---

## 12. Logs sanitizados (relevantes)

```
01:03:07 NOWEB  identity key changed or new contact, session will be re-established  jid=…@lid
01:03:07 WebhookSender  event=message.any  POST …/webhooks/waha
01:03:07 WebhookSender  status code: 200
01:07:11 state.change  connection=close  lastDisconnect=428 Precondition Required / Connection Terminated
01:07:13 session.status=STARTING
01:07:14 session.status=WORKING  connection=open
```

Sem LOGOUT / CONFLICT / UNPAIRED / 401 / 409 / 429 nesta janela.

---

# Fecho

**WAHA/QR APROVADO PARA PILOTO: NÃO**

**S1-CERT-WA PODE CONTINUAR APÓS COOLDOWN: SIM**  
(a sessão viva já está WORKING; **não** escanear QR; abrir `http://localhost:3666/app/inbox` e a conversa de `Teste MOOPE MOOPE-WA-3B3-215952`)

**EXIGE CORREÇÃO DE CÓDIGO ANTES: NÃO**  
(para continuar o smoke. A UI de FAILED residual é dívida, não blocker do inbound.)

---

## Adendo 2026-09-09 ~13:22 UTC — Docker voltou / tentativa de nível 4

O daemon Docker estava parado na manhã seguinte. Subiu só para **medir** (sem QR, sem POST start). Efeito colateral de `WHATSAPP_RESTART_ALL_SESSIONS`:

| Sessão | 13:19:43 | depois |
|---|---|---|
| `org_62d52837_055ec6` | STARTING | WORKING ~13:19:46 (auto-recovery) |
| `org_62d52837` | STARTING | **SCAN_QR_CODE** (residual; era FAILED) |

Não escanear a residual.

Tentativa de nível 4: outbound `Resposta MOOPE…` e inbound 2 `Depois humano…` **ausentes** nos dois bancos. Ver `docs/MOOPE_CRM_S1_CERT_WA_NIVEL_4_RESULTADO.md`.

**S1-CERT-WA NÍVEL 4: NÃO**

---

## STOP

3C não iniciou. Sem reconectar. Sem QR. Sem push.
