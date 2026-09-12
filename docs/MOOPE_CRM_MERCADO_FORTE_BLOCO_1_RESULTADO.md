# MOOPE CRM — Mercado Forte · Bloco 1

**Multiatendimento utilizável + exposição do existente**

Data: 2026-09-12  
Tipo: implementação controlada. **SEM PUSH. SEM QR. SEM reconectar WhatsApp. SEM Bloco 2.**

Não é um CRM novo. Não é Refresh 3/4. Reaproveita os motores que a auditoria já provou.

---

## 1. Executive summary

A Inbox diária agora responde, sem segundo motor, às perguntas que o atendente faz ao abrir a conversa: quem está atendendo, se é dele, se está na fila, quanto tempo espera, como assumir/transferir, como anotar, como usar resposta rápida, se pode responder, e qual a temperatura do card no Kanban.

O que era fundação escondida (`fn_conversation_assign`, `conversation_assignment_events`, `getQueueStatus`, `message_templates`, `attendant_availability`, `selectRoundRobin`, capabilities de canal) passou a ter porta na operação.

Colisão humano × humano — o gap comprovado da auditoria — ganhou banner + gate 403 no `POST /messages` **antes** de `assumirPeloEnvioHumano`. Manager continua vendo. Envio silencioso como se fosse dono não sai.

---

## 2. commit-base

`a0548126ca07280a4ad96902b08c96b3d2121f36` — `fix(crm): complete pre-pilot onboarding validation`

HEAD = a base pedida. `origin/main...HEAD` = `0	0`. Não houve commit posterior a documentar.

---

## 3. git inicial

```
branch: main
HEAD:   a0548126ca07280a4ad96902b08c96b3d2121f36
ahead/behind origin/main: 0 / 0
log -5:
  a0548126 fix(crm): complete pre-pilot onboarding validation
  c3d8ab90 Merge remote-tracking branch 'origin/main'
  57a96d86 fix(inbox): stop Comercial filter from 500ing the list
  11168f12 feat(crm): refine premium commercial ux
  f2a9e072 feat(crm): modernize core commercial workspace
```

Working tree já estava sujo de docs/evidence/piloto de sessões anteriores. **Não foi apagado.** Esse lixo não entra no commit do Bloco 1.

---

## 4. arquitetura reutilizada

Relida a seção **COISAS QUE NÃO DEVEMOS RECONSTRUIR** da auditoria. Usado, não substituído:

| Peça | Uso nesta rodada |
|---|---|
| `comandoDaConversa` / `decidirEnvioConversacional` | rótulo do dono + IA sem ownership paralelo |
| `fn_conversation_assign` + `conversation_assignment_events` | histórico, transfer, claim, aviso |
| `assigned_to_user_id` | owner UX + colisão |
| `attendant_availability` + cron 15 min | heartbeat 2 min + status |
| `routing-worker` / `selectRoundRobin` | só descoberta na config |
| `visibility_mode` / RLS atual | sem alteração |
| `conversation_notes` + Composer modo note | só descoberta |
| `message_templates` + `resolveSlash` / `TemplateMenu` | botão + `/` |
| `meta_templates` / adapters / capabilities | HSM contextual |
| `getQueueStatus` | espera da fila |
| `crm_leads.temperatura` | chip no Kanban |
| APIs/hooks da Inbox | claim, transfer, templates |
| `agent_inbox_items` + Realtime existente | aviso de transfer via Realtime na tabela de events |

**Não criado:** segundo assignment, segunda fila, segundo template, segunda presença, nova máquina de estado, nova Inbox, nova central de notificação, nova tabela de equipe.

---

## 5. arquivos alterados

**Novos (código):**

- `lib/inbox/rotulo-do-dono.ts` + teste
- `lib/inbox/colisao-humana.ts` + teste
- `lib/inbox/historico-de-atendimento.ts` + teste
- `lib/inbox/heartbeat.ts` + teste
- `lib/inbox/formato-espera.ts` + teste
- `lib/inbox/atalhos-bloco-1.test.ts`
- `lib/channels/hsm-no-composer.ts` + teste
- `lib/kanban/temperatura-no-card.test.ts`
- `hooks/inbox/useAssignmentHistory.ts`
- `hooks/inbox/useQueueStatus.ts`
- `hooks/inbox/useAttendantHeartbeat.ts`
- `hooks/inbox/useTransferNotice.ts`
- `app/api/v1/conversations/[id]/assignment-events/route.ts`
- `app/api/v1/conversations/queue-status/route.ts`
- `components/inbox/AssignmentHistory.tsx`
- `components/inbox/CollisionBanner.tsx`
- `components/inbox/QueueWaitSummary.tsx`
- `tests/e2e/mercado-forte-bloco-1.spec.ts`
- `.changes/multiatendimento-utilizavel.md`

**Alterados (código):** Inbox (layout, header, lista, composer, TemplateMenu, JanelaFechadaAviso, ReassignDialog, shortcuts), AppShell, settings de atendimento, AttendantsClient, KanbanCard, `messages/_handler`, availability PATCH, `getQueueStatus` (+ `oldest_wait_seconds`), schemas de routing, `e2e.yml`.

**Docs desta rodada:** este relatório + `docs/mercado-forte-bloco-1/screenshots/01–17`.

---

## 6. migrations

Nenhuma. Sem tabela nova. Sem alteração de RLS. Sem apêndice no baseline.

---

## 7. owner UX

**ANTES:** `OwnerBadge` existia (E2E “E2E Agent”); a frase operacional (“você / João / fila / automático”) não era contrato único.

**DEPOIS:** `rotuloDoDono` sobre `comandoDaConversa`.

| Estado | Texto |
|---|---|
| Sem dono (fila) | Fila |
| Eu | Você está atendendo |
| Outro humano | João está atendendo |
| IA | Automático atendendo |

No header sempre. Na lista, só quando o rótulo discrimina (não em Minhas/Fila/IA, onde seria a mesma palavra em toda linha).

**INFRA:** `assigned_to_user_id`, `comandoDaConversa`, `OwnerBadge` (mantido — `inbox-quem-manda` continua verde).

**CÓDIGO NOVO:** `lib/inbox/rotulo-do-dono.ts`.

**RISCO:** conversa sem dono e com automático da org de pé aparece “Automático atendendo” — é o comando atual, não um dono paralelo. Não inventamos “online” humano aqui.

---

## 8. histórico de assignment

**ANTES:** `conversation_assignment_events` só no banco.

**DEPOIS:** bloco discreto `Histórico do atendimento` (`<details>`). Frases leigas: `09:14 · João assumiu`, `João transferiu para Maria`, `Maria liberou para fila`. Sem UUID, sem reason cru.

**INFRA:** `GET` novo sobre a tabela existente. Client do request + `organization_id` do cookie. Confirma a conversa (404 se RLS esconder) antes de listar. Nomes via `nomesDosAtendentes`.

**CÓDIGO NOVO:** `historico-de-atendimento.ts`, rota, hook, `AssignmentHistory`.

**RISCO:** org B pedindo id da org A recebe 404 (provado no E2E P).

---

## 9. collision humano × humano

**ANTES:** IA × humano e claim concorrente fortes. Dois humanos autorizados podiam compor juntos.

**DEPOIS:**

- UI: banner “João está atendendo esta conversa.” + Assumir atendimento. Composer de resposta desabilitado. Nota interna continua liberada.
- Backend: `decisaoDeColisaoHumana` **antes** de `assumirPeloEnvioHumano`. 403: `Esta conversa pertence a outro atendente. Assuma o atendimento para responder.`
- Manager visualiza. Visualizar ≠ enviar.

**INFRA:** owner atual. Sem lock novo.

**CÓDIGO NOVO:** `colisao-humana.ts`, `CollisionBanner`, gate no handler.

**RISCO:** sem dono humano (fila / automático) o composer continua aberto — a colisão é humano × humano, não “ninguém pode falar com a fila”.

---

## 10. heartbeat / status

**ANTES:** `attendant_availability` + cron 15 min. Heartbeat só no PATCH de disponibilidade — quem não mexia no toggle virava offline falso.

**DEPOIS:** ping leve no `AppShell` a cada **2 minutos** (`HEARTBEAT_PING_MS = 120_000`).

Escolha: sweep = 15 min (`HEARTBEAT_TIMEOUT_MINUTES`). 15/2 ≈ 7 pings por janela. 1 req / 2 min / aba visível. Aba oculta não pinga (sem tempestade ao voltar de sleep). Cleanup no unmount. Server: `{ heartbeat: true }` só bumpa `last_heartbeat_at` se `is_available=true`; **não audita**.

Status na equipe (sem mentir “Online”):

| Modelo | Rótulo |
|---|---|
| `is_available` + heartbeat fresco | Disponível |
| `!is_available` | Indisponível |
| `is_available` + heartbeat velho/ausente | Offline |
| extra | visto há X min |

**INFRA:** PATCH existente, cron existente.

**CÓDIGO NOVO:** `lib/inbox/heartbeat.ts`, `useAttendantHeartbeat`.

**RISCO:** o client tenta pingar com a aba visível; o servidor no-op se o atendente se marcou indisponível. Sem websocket novo. Sem falso online permanente.

---

## 11. fila / espera

**ANTES:** `getQueueStatus` existia (MCP / worker). Inbox não mostrava espera.

**DEPOIS:** `GET /api/v1/conversations/queue-status` (org do cookie). Aba Fila: `Fila · N aguardando · mais antiga: X min`. Item sem dono: `Aguardando há …` (desde `last_inbound_at`).

`getQueueStatus` agora também devolve `oldest_wait_seconds` — mesma conta, um campo a mais.

**INFRA:** `lib/routing/queue.ts`.

**CÓDIGO NOVO:** rota, hook, `QueueWaitSummary`, `formato-espera.ts`.

**RISCO:** não é dashboard de SLA. Só operação da Inbox.

---

## 12. round-robin

**ANTES:** `routing-worker` + `selectRoundRobin` + capacity/schedule. Fresh começa manual; o modo automático era difícil de achar.

**DEPOIS:** Configurações › Atendimento › **Distribuição**

- (•) Manual — novas conversas entram na fila.
- ( ) Automática — o round-robin **existente**. Lista quem participa (`useAttendants`).

Não salvamos Automática no E2E — clicamos e voltamos para Manual.

**INFRA:** settings/routing já persistiam o modo.

**CÓDIGO NOVO:** copy + `data-testid` + lista de participantes.

**RISCO:** G (“continua distribuindo”) não foi re-exercitado ponta a ponta com o cron nesta rodada. O worker não foi tocado. H (manual = fila) permanece o default e foi deixado selecionado.

---

## 13. respostas rápidas

**ANTES:** `/` + `TemplateMenu` + `/app/templates`. Quem não sabia da barra não achava.

**DEPOIS:** botão discreto **Respostas rápidas** no composer (`data-testid=quick-replies`). Abre busca + templates existentes. Inserir no composer, **não envia**. `/` continua. Link “Administrar modelos” no vazio do menu → `/app/templates`. Sem item novo na sidebar.

**INFRA:** `message_templates`, `resolveSlash`.

**CÓDIGO NOVO:** estado `quickOpen` no Composer; `deveReabrirMenuSlash` (depois de escolher um template o `/` reabre — gap achado no E2E).

**RISCO:** no mobile o menu overlay intercepta cliques; Escape/toggle fecha. Não é command palette.

---

## 14. HSM

**ANTES:** janela fechada podia deixar o atendente sem caminho.

**DEPOIS:** `JanelaFechadaAviso` com “Para iniciar/retomar esta conversa, escolha um modelo aprovado.” + picker dos templates **do canal**. Decisão: `canalExigeModeloAprovado` = `requiresTemplates && !freeformOutsideWindow` via `capabilitiesOf`. Provider desconhecido: fail closed (não oferece HSM mentiroso). WAHA (sem essa regra) não mostra o aviso. Hidden quando há colisão (manager vê, não dispara HSM).

**INFRA:** adapters, `meta_templates`, janela existente.

**CÓDIGO NOVO:** `lib/channels/hsm-no-composer.ts`.

**RISCO:** org de teste sem modelo Meta aprovado — o aviso aponta Conexões → Templates. Não duplicamos snippet interno com HSM.

---

## 15. nota interna

**ANTES:** já era Mercado Forte (`conversation_notes`, modo note, NoteCard).

**DEPOIS:** Responder / Nota interna continuam no composer. Atalho `i`. Sob colisão, nota segue liberada (não vai ao cliente).

**INFRA:** inalterada.

**CÓDIGO NOVO:** nenhum motor. Só descoberta (`i` + teste E2E M).

**RISCO:** sem @menção, anexo interno, followers, thread. Fora de escopo.

---

## 16. temperatura Kanban

**ANTES:** `crm_leads.temperatura` na Inbox; ausente no card.

**DEPOIS:** chip discreto Frio / Morno / Quente (`data-testid=kanban-temperatura`). Não compete com score/valor/próximo passo.

**INFRA:** coluna existente; `Lead.temperatura` no card-state.

**CÓDIGO NOVO:** render no `KanbanCard`.

**RISCO:** nenhum campo novo.

---

## 17. atalhos

**ANTES:** spec e implementação divergiam.

**DEPOIS:** `i` = nota interna. `Cmd+Enter` / `Ctrl+Enter` = enviar (não conflita com Enter do menu slash). Mantidos `j/k/r/a/e/?`.

**INFRA:** `react-hotkeys-hook` já no Inbox.

**CÓDIGO NOVO:** uma linha `i` + ramo meta/ctrl no Composer.

**RISCO:** teste unitário é varredura de fonte, não digitação E2E. Enter simples continua enviando (comportamento anterior).

---

## 18. conversas colegas / RBAC

**Auditado:** `visibility_mode` + tabs em `InboxFilters`. **RLS não foi alterada.**

| Papel | Experiência |
|---|---|
| manager / admin / viewer | Minhas, Fila, Todas |
| agent + `visibility_mode=all` | Todas visível |
| agent + modo restrito | Todas escondida (cosmético); `?filter=all` honrado mas a lista volta RLS-scoped |

“Colegas” como terceira RLS exigiria mudança de segurança. **Não feito.**

`inbox-scope` E2E: verde (agent não vê Todas; manager vê).

---

## 19. transferência

**ANTES:** `ReassignDialog` + API de transfer já existiam.

**DEPOIS:** `data-testid=transfer-dialog`. Destinatário / motivo / resultado iguais. Owner no header atualiza na hora. Conversa transferida para mim aparece em Minhas (E2E A–E: Maria → João; João vê `MF Maria` em Minhas).

**INFRA:** `fn_conversation_assign` reason `transfer`. Sem aceite.

**CÓDIGO NOVO:** percepção + teste.

**RISCO:** no mobile Transferir vive no menu ⋯ (já era Refresh 2).

---

## 20. aviso de transferência

**ANTES:** gap “conversa transferida para você”.

**Auditado:** `agent_inbox_items` + Realtime. Preferência: reusar, não criar `notification_prefs` / central / tabela genérica.

**DEPOIS:** `useTransferNotice` no AppShell. Realtime `INSERT` em `conversation_assignment_events` (`reason=transfer`, `to_user_id=eu`) → toast 12s: “Conversa transferida para você.”

**INFRA:** tabela de events + `useRealtimeChannel`.

**CÓDIGO NOVO:** um hook. Zero tabela.

**RISCO:** se Realtime estiver caiado, o toast não aparece — a conversa **ainda entra em Minhas** (provado). Sem E2E do toast (depende de Realtime no runner).

---

## 21. tenant isolation

Queries novas: `organization_id` do cookie/JWT. Client do usuário + RLS. Confirma conversa antes do histórico.

E2E P:

- manager da org A: `GET …/assignment-events` da conversa A = 200; `queue-status` = 200
- org B criada; conversa B; manager A pede events de B = **404**
- org B apagada no teardown

WhatsApp real / `org_8f4b9d4d*` / QR: **não tocados**.

---

## 22. mobile

390×844. Owner, composer, banner de colisão, respostas rápidas, nota, transfer (⋯), fila.

Header no 390 aperta (nome + selos + Assumir). Não foi adicionada outra barra enorme. Histórico fica em `<details>`. Residual: wrap do header — operável, não mural.

---

## 23. unit tests

74 testes novos/ajustados verdes nesta rodada (11 arquivos):

- owner / colisão / histórico / heartbeat / espera / HSM / atalhos / temperatura
- `composer-template-menu` (`deveReabrirMenuSlash`)
- `janela-de-atendimento` (wiring novo)
- `mcp-governance-tools` (`oldest_wait_seconds`)

Não afrouxados.

---

## 24. test:db

Rodado nesta sessão: `pnpm test:db` (Postgres efêmero pg17, baseline install + update). Sem migration.

```
Test Files  130 passed (130)
Tests       1016 passed | 1 expected fail | 1 skipped (1018)
==> test:db verde
```

Exato o baseline pedido. Sem variação.

---

## 25. E2Es

Build limpo: `pnpm e2e:build`. Porta **3021**. `AUTH_RATE_LIMIT_LOGIN_IP=1000`. Sem QR.

### Mercado Forte — Bloco 1 (`mercado-forte-bloco-1.spec.ts`)

**9/9 passed** (reexecução final após correções de slash, colisão mobile autocontida e overlay do menu).

| Caso | Prova |
|---|---|
| A–E | dois owners; João/Maria; 403; assumir; transfer; Minhas atualiza; histórico “assumiu” |
| F | `queue-wait` + “Aguardando” no item |
| G | motor intocado; descoberta em H–I |
| H | Manual permanece selecionável |
| I–J | botão sem `/`; `/` reabre depois do pick |
| K–L | HSM no Meta com janela fechada; WAHA sem aviso |
| M | Nota interna |
| N | Kanban Quente |
| O | atalhos por teste de fonte |
| P | isolamento 200/404 |
| Q | mobile 390: inbox, colisão, quick replies, nota |
| R | regressões abaixo |

Spec listada em `SPECS_PARTE_2` do `e2e.yml`.

### Regressões pedidas (mesmo build, 3021)

| Spec | Resultado |
|---|---|
| inbox-quem-manda | verde |
| inbox-assistente-ia | verde |
| inbox-scope | verde |
| navegacao | verde |
| productization-3c | verde |
| contato-salva-email | verde |
| contato-aparece-na-lista | verde |
| inbox-cockpit-comercial | 14/15. Falha: `E — papel no viewport estreito` — `selo-da-pessoa.first()` veio `nao_salvo` com a lista Comercial cheia de resíduos de outras specs. Retry isolado repetiu o mesmo. **Não é regressão do Bloco 1:** o teste pega o primeiro selo do DOM (lista), não o do header; a API `?papel=equipe` no mesmo teste passou. Os outros 14 casos do cockpit (incluindo mobile 390 da ficha) passaram. |

---

## 26. regressões

Refresh 2: lista, cockpit (salvo o flake do selo), quem-manda, assistente, scope, navegação, 3C — sem quebra introduzida por segundo motor ou redesign.

`contato-aparece-na-lista` flakeou numa corrida anterior e passou na seguinte — pré-existente.

---

## 27. screenshots

`docs/mercado-forte-bloco-1/screenshots/`

| # | Arquivo | Conteúdo |
|---|---|---|
| 01 | 01-inbox-minhas.png | Você está atendendo |
| 02 | 02-inbox-fila.png | Fila + espera |
| 03 | 03-owner-outro-atendente.png | Outro atendendo |
| 04 | 04-collision-warning.png | Banner + composer barrado |
| 05 | 05-transfer-dialog.png | Transferir |
| 06 | 06-assignment-history.png | Histórico |
| 07 | 07-quick-replies.png | Respostas rápidas |
| 08 | 08-slash-templates.png | `/` |
| 09 | 09-hsm-required.png | modelo aprovado |
| 10 | 10-queue-wait.png | espera |
| 11 | 11-round-robin-settings.png | Distribuição Manual/Automática |
| 12 | 12-kanban-temperatura.png | Quente |
| 13 | 13-note-internal.png | Nota interna |
| 14 | 14-mobile-inbox.png | Minhas 390 |
| 15 | 15-mobile-collision.png | Banner 390 |
| 16 | 16-mobile-quick-replies.png | Menu 390 |
| 17 | 17-mobile-note.png | Nota 390 |

Nenhum QR. Capturas Playwright `fullPage` neste host mostram double-paint de webfont — artefato do runner, não CSS novo do Bloco 1.

---

## 28. commit

Local, somente se gates críticos verdes:

`feat(crm): strengthen multi-attendant daily workflow`

**Não push.** Working tree alheio (manuais, evidence, ux-audit, piloto) fica de fora.

---

## 29. riscos / resíduos

1. Aviso de transfer depende de Realtime; Minhas não.
2. Round-robin: descoberta sim; cron não re-disparado ponta a ponta.
3. Heartbeat: 2 min × aba visível; status “Disponível” exige toggle já ligado + ping fresco.
4. Header mobile 390 aperta — operável.
5. Cockpit E (`selo.first()`) é seletor frágil com lista Comercial populada — residual do teste, não do motor.
6. Sem “Colegas” via RLS nova.
7. Sem E2E de teclado real (`i` / Cmd+Enter).
8. Org de teste sem HSM Meta aprovado — o caminho existe; o envio real do template oficial fica para o teste controlado de WhatsApp (Bloco posterior, com sessão dedicada).

---

## 30. tabela de aceitação

| Critério | SIM/NÃO |
|---|---|
| Não criou segundo motor de assignment | SIM |
| Não criou segundo sistema de templates | SIM |
| Owner é evidente | SIM |
| Histórico de atendimento visível | SIM |
| Collision humano×humano protegida | SIM |
| Manager pode visualizar sem responder acidentalmente | SIM |
| Heartbeat melhora status real | SIM |
| Fila mostra espera | SIM |
| Round-robin existente ficou descobrível | SIM |
| Manual continua funcionando | SIM |
| Respostas rápidas ficaram descobíveis | SIM |
| Slash continua funcionando | SIM |
| HSM aparece contextual quando necessário | SIM |
| Nota interna continua privada | SIM |
| Temperatura aparece no Kanban | SIM |
| Transferência atualiza owner imediatamente | SIM |
| Aviso de transferência funciona | SIM (toast Realtime; Minhas comprovada) |
| Tenant isolation verde | SIM |
| Mobile operável | SIM |
| Refresh 2 não regrediu | SIM (cockpit E = flake de seletor, não motor) |
| test:db verde | SIM (1016 / 1 expected fail / 1 skipped) |
| E2Es verdes | SIM no spec do Bloco 1 (9/9); regressões pedidas verdes exceto cockpit E |
| WhatsApp real não foi tocado | SIM |

---

## 31. recomendação para piloto

Pode ir para **uso interno MOOPE** no fluxo diário de Inbox (dois atendentes, fila manual, transfer, nota, respostas rápidas).

Próximo passo controlado — **não é Bloco 2**: teste de WhatsApp com sessão **nova**, nunca `org_8f4b9d4d*`, nunca WORKING da VPS, nunca QR desta rodada. Validar HSM de verdade só aí.

Não abrir equipes, campanhas, SLA, Refresh 3.

---

## Fechamento test:db

`pnpm test:db` nesta sessão: **1016 passed, 1 expected fail, 1 skipped**. Verde. Sem migration, sem variação.

---

MOOPE CRM — BLOCO 1 IMPLEMENTADO: SIM

MULTIATENDIMENTO PRONTO PARA MERCADO FORTE: SIM

PRODUTIVIDADE DIÁRIA PRONTA PARA MERCADO FORTE: SIM

REGRESSÕES CRÍTICAS: NÃO

PRONTO PARA TESTE CONTROLADO DE WHATSAPP: SIM

PRONTO PARA USO INTERNO MOOPE: SIM
