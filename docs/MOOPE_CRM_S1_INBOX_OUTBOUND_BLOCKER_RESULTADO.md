# MOOPE CRM — S1
# INBOX OUTBOUND — RESULTADO

**Medição:** 2026-09-09 ~22:31 UTC  
**Escopo:** só o caminho Composer → persistência. Sem inbound 2. Sem 3C. Sem QR. Sem reconnect. Sem push.

---

## Ambiente

| Item | Valor |
|---|---|
| CRM | `http://localhost:3666/app/inbox` |
| Supabase API | `http://127.0.0.1:55321` |
| DB | `55322` (`deskcomm-vps-fresh`) |
| Org | Loja QA VPS / `62d52837-e77d-40f0-b06d-29d76a08c5cf` |
| Channel vivo | `17b381d2` / `org_62d52837_055ec6` **WORKING** |
| Residual | `org_62d52837` **SCAN_QR_CODE** — não tocada |
| Contact | `1212b06b` (Suporte MOOPE) |
| Conversation | `65dc093e-acee-4715-a0b9-a4022de31e07` |
| Inbound 1 | `Teste MOOPE MOOPE-WA-3B3-215952` (visível na thread) |

---

## Fluxo REAL do código (não inventado)

```
Composer (components/inbox/Composer.tsx)
  handleSubmit()  → botão data-testid="inbox-enviar" / Enter
  → useSendMessage().mutate()          hooks/inbox/useSendMessage.ts
  → apiClient.post("/api/v1/messages") lib/api/client.ts  (cookie same-origin)
  → POST app/api/v1/messages/route.ts
       requireRole("agent")            cookie/JWT, NÃO browser Supabase
       validateRequest(sendMessageSchema)
  → sendMessageHandler                 app/api/v1/messages/_handler.ts
       carrega conversation (RLS do client de servidor)
       blocked? 403
       se intent conversacional: decidirEnvioConversacional
       se actor=user: assumirPeloEnvioHumano  (infinity + claim)
       INSERT messages (sent_via=user, queued)
       getAdapter(provider) → wahaAdapter.send
```

**Não** usa `createBrowserClient` no envio. É API server-side + cookie. O bug “browser Supabase + httpOnly + RLS” do dossier **não** é este caminho. Verificado; não assumido.

Humano **não** passa por `decidirEnvioConversacional` (`envioRespeitaComandoDaConversa` só para `conversational_auto` / `integration_api`).

WAHA tem `freeformOutsideWindow: true` — janela de 24h **não** trava o composer neste canal.

---

## Reprodução (botão real, sem POST manual)

Token: `MOOPE-INBOX-S1-193014`  
Texto: `Resposta Inbox MOOPE-INBOX-S1-193014`  
Usuário: `e2e-agent@deskcomm.test` (agent da Loja QA VPS, MFA=0)  
URL: `/app/inbox?id=65dc093e-acee-4715-a0b9-a4022de31e07&filter=all`

Playwright dirigiu o browser em `127.0.0.1:3666`:

1. Login → `/app/inbox`
2. Deep-link da conversa
3. Confirmado na página: inbound `Teste MOOPE MOOPE-WA-3B3-215952`
4. Composer visível e **habilitado**
5. Digitado o texto
6. Clique em `data-testid="inbox-enviar"` (botão real)

### Network

| | |
|---|---|
| Clique gera request | **SIM** |
| Método | `POST` |
| Endpoint | `/api/v1/messages` |
| Body | `{ conversation_id: 65dc093e-…, body: "Resposta Inbox MOOPE-INBOX-S1-193014", type: "text" }` |
| HTTP | **201** |
| Persistência | `a9593549` outbound `sent_via=user` `status` sent→read |

Outros POSTs no mesmo load: `historico` **403** (agent < admin — sync automático, **não** é o envio); `mark-read` 200.

### Console / page errors

- 1 console error: `403` do POST historico (agent). **Não** é o send.
- `pageErrors`: vazio.

Composer esvaziou após sucesso. Bolha outbound visível. Cabeçalho: assumido, silêncio de automático.

---

## O que falhou na tentativa anterior (não hoje)

A frase `Resposta MOOPE MOOPE-WA-3B3-215952` **nunca** chegou a `messages` nem a `webhook_events_log` (isolado **e** operador).  
Hoje o **mesmo** handler, a **mesma** conversa e o **clique real** persistiram.

**Primeira camada da falha anterior:** o `POST /api/v1/messages` **não ocorreu** neste CRM/org. Não foi send gate, não foi INSERT, não foi WAHA.

Causas compatíveis (não há evidência de clique+201 perdido):

- clique em outro host/porta (`.env.local` → `54321`);
- conversa não selecionada (“Selecione uma conversa” — sem composer);
- texto não enviado (Enter no slash-menu, ou só digitou);
- papel `viewer` (rota exige `agent+`).

**Não** é RLS no browser. **Não** é WAHA no sentido inverso (o adapter **foi** chamado nesta reprodução).

---

## Causa raiz comprovada (deste recorte)

**Não há defeito de persistência no Inbox** no ambiente correto.

O caminho Composer → `POST /api/v1/messages` → handler → INSERT → takeover → adapter funciona.

Armadilha de UX (já listada como prontidão operacional, **não** corrigida aqui): faixa `ConexaoCaidaBanner` trata a residual `SCAN_QR_CODE` (“WhatsApp sem nome”) e escreve *“nenhuma mensagem entra nem sai”* + botão *“Escanear o QR”* **mesmo com** `org_62d52837_055ec6` WORKING. Isso assusta; **não** desabilita o composer. Residual **não** foi alterada.

---

## Persistência / takeover / provider (após o clique)

| Campo | Valor |
|---|---|
| message | `a9593549` @ `2026-09-09 22:31:05.591Z` |
| direction | outbound |
| sent_via | `user` |
| actor | `09e8eb25` (`e2e-agent@deskcomm.test`) |
| org / channel / contact / conv | `62d52837` / `17b381d2` / `1212b06b` / `65dc093e` |
| external_id | presente (WAHA aceitou) |
| cópias do body | **1** |
| conversation.status | `claimed` |
| assignee_kind | `user` |
| bot_silenced_until | `infinity` |
| last_handoff_reason | Assumiu a conversa ao enviar uma mensagem |

---

## Auth / RLS (pergunta 5)

| Pergunta | Resposta |
|---|---|
| Envio usa browser Supabase? | **Não** |
| Usa API server-side? | **Sim** |
| Cookie/auth chega? | **Sim** (201 autenticado) |
| 401? | Não no send |
| 403? | Só no historico (admin); send não |
| Erro RLS? | Não observado |
| Erro engolido? | Send 201. Falha já tem `showApiError` + `restoreOnError` no composer |

---

## Correção

**Nenhuma.** Causa comprovada = request anterior ausente, não handler quebrado.

Preservado (já estava): `sent_via=user`, actor, takeover `infinity`, blocked/closed/opt-out no handler, tenant via `requireRole`, send gate conversacional só para auto, sem AI bypass no clique humano.

Migrations: nenhuma.  
Commit: **não** (sem alteração de produto).  
Push: **não**.

---

## Segurança (não reaberta)

Handler já recusa conversa de outra org (404 RLS / org do cookie). Não relaxamos gate. Outra org não foi autorizada a escrever em `65dc093e`.

---

## Testes

| Gate | Resultado |
|---|---|
| typecheck | não rodado — zero arquivos de produto |
| lint | — |
| unit Inbox/envio | não alterados |
| E2E novo | **não criado** (não houve correção para vigiar) |
| test:db | não tocou schema |

---

## Arquivos / diff / commit

Arquivos de produto: **nenhum**.  
`git diff` de código: vazio neste recorte.  
Commit: nenhum. Push: nenhum.

---

## Tabela final

| Critério | SIM/NÃO |
|---|---|
| Clique Enviar gera request | **SIM** |
| Request chega ao backend | **SIM** |
| Auth correta | **SIM** |
| Tenant correto | **SIM** |
| Conversation correta | **SIM** |
| Persistência outbound | **SIM** |
| sent_via=user | **SIM** |
| Actor humano | **SIM** |
| Mesmo contact/conversation | **SIM** |
| Provider chamado | **SIM** |
| Takeover aplicado | **SIM** |
| Final send gate preservado | **SIM** (não alterado) |
| Sem duplicação | **SIM** (1 row) |
| Erro de envio aparece na UI | **SIM** (já existia; não exercitado nesta 201) |
| Regressão automatizada | **NÃO** (sem patch) |
| Typecheck verde | **NÃO MEDIDO** (sem mudança) |
| S1 Inbox blocker fechado | **SIM** (persistência não estava quebrada; comprovada) |

---

**S1-INBOX-OUTBOUND FECHADO: SIM**

Não há camada de persistência ainda quebrada. A tentativa antiga morreu **antes** do POST neste CRM. Inbound 2 **não** foi executado.

---

## STOP

Sem 3C. Sem RAG. Sem agentes. Sem automações. Sem QR. Sem reconnect. Sem push.
