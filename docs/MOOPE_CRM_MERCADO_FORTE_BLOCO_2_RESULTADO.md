# MOOPE CRM — Mercado Forte · Bloco 2

**Organização comercial sem esquecimento**

Data: 2026-09-12  
Tipo: implementação controlada. **SEM PUSH. SEM QR. SEM WhatsApp real. SEM reconectar VPS. SEM Bloco 3.**

Não é Refresh 3. Não é campanha. Não é CRM novo. Não é Kanban novo.

Regra de produto: *o vendedor não deve precisar lembrar de nada.*

---

## 1. Executive summary

A obrigação comercial diária passou a ter **uma fonte persistente**: `demandas.proximo_passo` + `proximo_passo_em` + dono humano.

Inbox, Kanban, Agenda e Hoje **lêem a mesma linha**. Criar/editar/concluir numa superfície altera as outras. `calendar_appointments` continua sendo hora combinada com o cliente — salvar próxima ação **não** cria agendamento.

`lead_state.next_action` permanece proposta de IA. Só vira canônico quando o humano **aprova** (`POST /leads/:id/next-action` agora grava em `demandas`).

Radar continua risco, não segunda lista de tarefas. Alertas internos ao atendente nascem com opt-in desligado, telefone E.164 particular, cron idempotente e **envio mock** (`alerta_interno_atendente`). Não passa por `POST /messages`, campanha, takeover nem `operational_moope`.

---

## 2. commit-base

`41e086be8163ff5de14ae57a8071c4438b4b4bae` — `feat(crm): strengthen multi-attendant daily workflow`

HEAD no início desta sessão = a base pedida. Branch `main`, `origin/main` 1 ahead (o Bloco 1, ainda sem push).

---

## 3. git inicial

```
branch: main
HEAD:   41e086be feat(crm): strengthen multi-attendant daily workflow
ahead/behind origin/main: 1 / 0
log -5:
  41e086be feat(crm): strengthen multi-attendant daily workflow
  a0548126 fix(crm): complete pre-pilot onboarding validation
  c3d8ab90 Merge remote-tracking branch 'origin/main'
  57a96d86 fix(inbox): stop Comercial filter from 500ing the list
  11168f12 feat(crm): refine premium commercial ux
```

Working tree já estava sujo de docs/evidence/piloto de sessões anteriores. **Não foi apagado.** Esse lixo não entra no commit do Bloco 2.

---

## 4. auditoria demanda / agenda / next_action

Relida em código e banco (não só na prosa da auditoria):

| Peça | O que é | Classificação |
|---|---|---|
| `demandas.proximo_passo` + `proximo_passo_em` | texto + quando + estado da demanda | **CANÔNICO** da obrigação comercial |
| `demandas.dono_kind` / `dono_user_id` | responsável | CANÔNICO (schema já existia; PATCH agora grava humano) |
| `demanda_conversas` | vínculo conversa | CANÔNICO do vínculo, não da obrigação |
| Inbox / Kanban / Agenda / Hoje | leituras da mesma linha | **DERIVADO** |
| `lead_state.next_action` / `NextActionSlot` | proposta do agente | **APENAS IA** até approve |
| `calendar_appointments` | hora combinada com o cliente | CANÔNICO de **outro** objeto (não duplicar) |
| follow-up `cron_jobs` / snooze | retorno automático / esconder conversa | OUTRO |
| `expected_close_date` | forecast de fechamento | OUTRO (filtro “Fechamento atrasado”) |
| `demandas.prazo_em` | coluna morta | NÃO USAR |
| `create_task` na Action Policy | nome morto sem executor | mapeado para `demandas` |
| Radar `sem_proximo_passo` | risco (demanda aberta sem texto) | complementar, não task list |
| `reminder_enabled` em appointments | lembrete de consulta | NÃO reutilizado (semântica de cliente) |

Por que `demandas` comporta o contrato:

- texto (`proximo_passo`)
- data/hora opcional (`proximo_passo_em`)
- responsável (`dono_user_id` + `dono_kind`)
- lead (`lead_id`, nullable)
- conversa (`demanda_conversas`)
- estado / conclusão (`fechada_em` / `desfecho` para o negócio; zerar passo para concluir o compromisso)

O que **não** cabia e justificou migration mínima:

- telefone particular do atendente (não existia em `users` / profile)
- ledger de entrega de reminder (sem isto o cron manda de novo)

---

## 5. decisão da fonte de verdade

**ANTES:** a mesma obrigação podia parecer `proximo_passo` (ficha), `next_action` (IA no card), compromisso de Agenda (módulo separado) e “task” da policy — quatro nomes, uma intenção.

**DECISÃO:** `demandas.proximo_passo` é a única verdade operacional da próxima ação comercial humana.

**POR QUÊ:** a tabela já existia, já era lida na Inbox/Radar, já tinha dono no schema, já era tenant-aware. Criar `tasks` seria o segundo CRM que o bloco proíbe.

**INFRA REUTILIZADA:** `demandas`, `demanda_conversas`, `definirProximoPassoComercial`, crm-summary, encerramento, board GET, Action Policy.

**CÓDIGO NOVO:** projeções (GET list / board attach / Hoje / Agenda), concluir sem fechar demanda, limpar no win/loss, ledger + prefs + cron mock.

**RISCO:** inbound antigo com `dono_kind=ia` não recebe WhatsApp até um humano editar o passo (fail-closed; correto).

---

## 6. modelo final

```
CANÔNICO:  demandas { proximo_passo, proximo_passo_em, dono_user_id, lead_id, contact_id }
VÍNCULO:   demanda_conversas.conversation_id
DERIVADO:  Inbox, Kanban.proxima_acao, Agenda obrigações, Hoje
APENAS IA: lead_state.next_action → vira canônico só no approve
OUTRO:     calendar_appointments (cliente), follow-up, expected_close_date
ALERTA:    user_organizations.alert_*  +  demanda_alert_deliveries
ENVIO:     alerta_interno_atendente (mock). NÃO é send_intent de conversa.
```

Origem da demanda: vocabulário existente (`manual` / `derivada`). Não migramos novos valores de origem.

---

## 7. migrations

**Uma**, justificada:

`20260912180000_0204_proxima_acao_alertas.sql` + apêndice idempotente no `baseline.sql` + linha no `MANIFEST.md`.

- `user_organizations.alert_whatsapp_phone` (E.164)
- `user_organizations.alert_proxima_acao` default **false**
- `user_organizations.alert_antecedencia_min` CHECK `(10, 30, 60)` default 30
- `demanda_alert_deliveries` unique `(organization_id, demanda_id, kind, scheduled_for)`
- RLS `tenant_isolation_demanda_alert_deliveries_all` via `fn_user_org_ids()`

Não criamos tabela `tasks`. Não tocamos `calendar_appointments.reminder_*`.

---

## 8. próxima ação Inbox

Cockpit (`BlocoNegocio`): bloco **Próxima ação** com Sem próxima ação / texto+quando / atraso vermelho.

Ações: Definir, Editar, Concluir. Presets Hoje / Amanhã / Em 2 dias + data/hora.

Salvar: `POST /demandas` ou `PATCH /demandas/:id` — **não** cria appointment.

`data-testid`s do Bloco 1 (`inbox-definir-proximo-passo`, `inbox-proximo-passo-texto`, …) preservados.

---

## 9. Kanban

Card atual evoluído, sem redesign:

- nome, valor, responsável, temperatura (já existiam)
- linha compacta da próxima ação canônica (atraso em vermelho)
- “Sem próxima ação” em OPEN sem texto

`NextActionSlot` (IA) permanece na faixa ③. Não empilhamos 8 chips.

Menu do card: abrir conversa, concluir, definir.

Filtros novos: Atrasadas, Sem próxima ação, Quentes. O antigo “Apenas atrasados” (`expected_close_date`) virou **Fechamento atrasado** — não misturamos as duas réguas.

O board **não** anexa próximas ações com `lead_id.in.(todos os cards)`. Medido no E2E: “URI too long” no funil sujo do org de teste. A leitura passou a ser por organização + passo aberto, casamento em memória (`anexarAcoesAosLeads`).

---

## 10. drag-and-drop

DnD intacto (`useMoveCard` + midpoint). Após mover para estágio **não** won/lost: prompt discreto “Qual é o próximo passo?” com os mesmos presets + “Sem próxima ação”. **Não bloqueia** o movimento.

---

## 11. win / loss / reativação

`encerraDemanda` chama `limparProximoPassoAoEncerrar`: zera `proximo_passo` / `_em` das demandas abertas do lead (e do contato se `lead_id` vazio). Não reabre. Não apaga a demanda.

Reativação: move de volta a estágio aberto; o humano pode definir nova ação. Timeline: `proximo_passo_concluido` + `demand_closed` existente.

---

## 12. Agenda

Calendário de `calendar_appointments` **permanece**. Acima dele: bloco **Obrigações comerciais** (Hoje / Próximos / Atrasados) lendo `GET /api/v1/demandas`. Editar/concluir ali é a mesma PATCH/POST. Clique no nome abre Inbox/Kanban/contato.

Não é clone de Google Calendar.

---

## 13. Hoje

`HojeOperacional` deixou de ser só radar+agenda de consulta. Bloco principal:

- N retornos hoje
- N atrasados
- N quentes sem próxima ação
- N conversas aguardando você
- lista curta + “Ver agenda”
- supervisor (manager/admin): totais da equipe

Sem gráfico de BI.

---

## 14. atrasados

Uma função: `estadoDaProximaAcao` + `rotuloDoAtraso` em `lib/comercial/proxima-acao.ts`.

Usada em Inbox, Kanban, Agenda, Hoje. Não replicada.

---

## 15. Radar

`radar-de-risco.ts` **não** virou task list. Continua risco (parado, sem passo, esfriando). Hoje/Radar apontam “quentes sem próxima ação” como **sinal**, não como segunda fila de jobs.

---

## 16. responsável

Ao definir/editar: `dono_kind='humano'` + `dono_user_id` = quem salvou. Default implícito: o humano da sessão, não o agente IA.

Approve de IA grava o humano que aprovou. `create_task` AUTONOMOUS sem user id cai em `dono_kind=ia` (não recebe WhatsApp).

---

## 17. contato 360

`Contato360Comercial` na ficha: negócios, próxima ação, obrigações relacionadas. Reusa `GET /contacts/:id/crm-summary` + `GET /demandas`. Sem documentos, sem multi-telefone, sem multi-email.

---

## 18. alertas in-app

Toast ao salvar/concluir. Superfícies já pintam atraso. **Não** criamos notification center. `settings/notifications` deixou o stub de 15 toggles e passou a ser **Alertas pessoais**.

---

## 19. WhatsApp particular do atendente

ANTES: não havia campo adequado em `users` / profile.

DECISÃO: colunas em `user_organizations` (o telefone é da pessoa **naquela org**).

POR QUÊ: membership já é tenant-aware; telefone de cliente vive em `contacts.phone_number`.

E.164 via `normalizarE164`. Fail-closed se o número normalizado for o do cliente.

---

## 20. classificação / intenção de envio

ANTES: `operational_moope` = Gestão falando com o **cliente**.

DECISÃO: **não** reutilizar `operational_moope` nem `send_intent` de `POST /messages`.

Nome: `alerta_interno_atendente` (`CLASSIFICACAO_ALERTA_INTERNO`).

POR QUÊ: misturar com Gestão/cliente criaria conversation/message/owner/AI_MODE.

INFRA: nenhum adapter WAHA chamado. `enviarAlertaInternoMock`.

CÓDIGO NOVO: `lib/comercial/enviar-alerta-interno.ts`, cron `demanda-reminders`.

RISCO: o mock não prova latência/banimento de um número MOOPE dedicado — isso é rodada futura, sem QR nesta.

---

## 21. scheduler

Rota `GET|POST /api/v1/cron/demanda-reminders` autenticada com `INTERNAL_CRON_SECRET|INTERNAL_SECRET`.

Agendada em `docker/scheduler/entrypoint.sh`: `*/5 * * * *`.

`tests/unit/cron-routes-scheduled.test.ts` exige os dois lados. Audit só se `enviados > 0`.

---

## 22. idempotência

Chave: `(organization_id, demanda_id, kind, scheduled_for)` onde `scheduled_for` = ISO do **vencimento atual**.

Select antes + unique `23505`. Segunda passagem do cron = 0 envios.

---

## 23. reagendamento

15:00 → 17:00 muda `proximo_passo_em`. O cron lê o valor **atual**. A chave antiga não dispara. Entrega já gravada permanece (histórico). Novo horário gera nova chave.

---

## 24. conclusão

`POST /demandas/:id/concluir` zera texto/quando. Demanda pode continuar aberta. Activity: “Fulano concluiu: …”. Inbox mostra Sem próxima ação; o ritmo Definir volta a existir.

---

## 25. IA / Action Policy

COPILOT: `create_task` DENY (sem side effect).  
CONTROLLED: DENY sem allowlist explícita; confirm se estiver em `confirm`.  
AUTONOMOUS: ALLOW pela policy atual — executor agora grava `demandas`, sem tabela `tasks`.

Não criamos governança nova.

---

## 26. create_task

ANTES: nome na policy, sem executor (throw).

DECISÃO: o executor aponta para `demandas.proximo_passo`.

POR QUÊ: o bloco proíbe criar `tasks` só por causa do nome.

Documentado em `lib/ai/acoes/executar.ts` e `lib/ai/acoes/create-task-mapeia-demanda.test.ts`.

---

## 27. supervisor

Hoje (manager/admin): totais da equipe (hoje / atrasadas / sem passo). Agenda: toggle “Da equipe”. Kanban: filtro por responsável já existia. Sem BI do Bloco 3.

---

## 28. mobile

Controles em bottom/dialog existentes (`Dialog`, ficha). Presets cabem em 390. Spec U fotografa Kanban, Inbox, Agenda, Hoje, 360.

---

## 29. tenant isolation

GET/PATCH/concluir filtram `organization_id` do cookie. Cron admin filtra org na query e no insert do ledger. E2E T cria org B e afirma que a lista de A não contém “SEGREDO ORG B”.

---

## 30. arquivos alterados

**Novos (código):**

- `lib/comercial/proxima-acao.ts` + teste
- `lib/comercial/telefone-e164.ts` + teste
- `lib/comercial/alerta-interno.ts` + teste
- `lib/comercial/enviar-alerta-interno.ts`
- `lib/comercial/disparar-alertas.ts`
- `lib/demandas/listar-proximas-acoes.ts`
- `lib/demandas/concluir-proximo-passo.ts`
- `lib/demandas/limpar-ao-encerrar.ts`
- `lib/demandas/anexar-ao-board.ts`
- `lib/ai/acoes/create-task-mapeia-demanda.test.ts`
- `lib/kanban/filters-proxima-acao.test.ts`
- `components/comercial/ProximaAcaoControles.tsx`
- `components/comercial/ListaDeAcoes.tsx`
- `components/agenda/ObrigacoesComerciais.tsx`
- `components/contacts/Contato360Comercial.tsx`
- `hooks/comercial/useProximasAcoes.ts`
- `hooks/comercial/useAlertPrefs.ts`
- `app/api/v1/demandas/[id]/concluir/route.ts`
- `app/api/v1/me/alert-prefs/route.ts`
- `app/api/v1/cron/demanda-reminders/route.ts`
- `app/app/settings/notifications/_form.tsx`
- `supabase/migrations/20260912180000_0204_proxima_acao_alertas.sql`
- `tests/e2e/mercado-forte-bloco-2.spec.ts`
- `.changes/proxima-acao-unica-agenda-alertas.md`

**Evoluções:** Inbox `BlocoNegocio`, Kanban card/actions/board/filters, Agenda, Hoje, contato 360, board GET, next-action approve, PATCH demanda (dono), encerramento, `create_task` executor, scheduler, baseline, MANIFEST, `e2e.yml`, seletor do flake `inbox-cockpit-comercial`.

---

## 31. unit tests

Cobertos (vitest focado, verde):

- entidade / overdue / presets (`proxima-acao.test.ts`)
- E.164 + recusa sem DDI
- elegibilidade, opt-in, telefone do cliente, idempotency key
- filtros Kanban (atrasada / sem ação / quentes ≠ fechamento)
- create_task → demandas + COPILOT DENY
- e2e-cobertura (spec no `SPECS_PARTE_2`)
- cron agendado + audit só com efeito (AST)
- anexar próxima ação ao board sem `lead_id.in.(todos)` (`anexar-ao-board.test.ts`)

`pnpm typecheck` verde.

`pnpm lint` nos arquivos deste bloco: 0 errors. Os 2 errors do repo (`useSincronizarContatosDoAparelho` refs, `scripts/retomar-june.cjs`) são pré-existentes e fora deste bloco.

---

## 32. test:db

Rodado nesta sessão após o conserto de RLS da `demanda_alert_deliveries` (policy com `fn_role_at_least(..., 'agent')` — a policy só-tenancy reprovava `rbac-config-ia-canais`). Postgres efêmero pg17, baseline **install + update**.

```
Test Files  130 passed (130)
Tests       1016 passed | 1 expected fail | 1 skipped (1018)
==> test:db verde
```

A tabela nova **não** entrou em `DIVIDA_RBAC_CONHECIDA`.

---

## 33. E2Es

Build: `pnpm e2e:build`. Porta **3021**. `AUTH_RATE_LIMIT_LOGIN_IP=1000`. `.env.e2e` → `127.0.0.1:54321`. Sem QR. Sem WhatsApp real. Migration 0204 aplicada no Supabase local desta máquina (o kit self-host recebe pelo apêndice do baseline).

Spec: `tests/e2e/mercado-forte-bloco-2.spec.ts` (serial).

**9/9 passed** (reexecução final após correções de seletor, URI do board, `/app/inicio`, `lost_reason=price` e ficha mobile).

| # | Cenário | Como |
|---|---|---|
| A–D | criar Inbox → Kanban/Agenda/Hoje | UI |
| E | editar Agenda → Inbox/Kanban | UI |
| F | concluir Kanban → todas | UI |
| G–H | atrasada + reagendar | seed + UI |
| I | mover stage não perde | API move + assert DB |
| J–K | win/loss limpa | API lose/win |
| L | reabrir + nova ação | API |
| M–N | sem ação / quente no Hoje | UI |
| O | manager equipe | `hoje-supervisor` |
| P | contato 360 | UI |
| Q | cron 2× = 2ª com 0 envios | API cron |
| R | opt-out = 0 | API |
| S | dest = E.164 do atendente, classificação interna | corpo do cron |
| T | org B invisível | insert B + GET A |
| U | 390×844 | viewport |
| V | regressões Bloco 1 | spec separada (não mascarada) |

Flake `inbox-cockpit-comercial` “papel no viewport estreito”: o teste usava `getByTestId('selo-da-pessoa').first()` e pegava o selo da **lista**. Corrigido no **teste**: `conversation-header` → selo. Produto só ganhou `data-testid="conversation-header"` no header (gancho semântico). Sem mudança de regra de negócio.

---

## 34. regressões

Mesmo build, porta 3021. **56/56 passed** (7.9 min).

| Spec | Resultado |
|---|---|
| mercado-forte-bloco-1 | verde (incl. Q mobile) |
| inbox-quem-manda | verde |
| inbox-scope | verde |
| inbox-assistente-ia | verde |
| inbox-cockpit-comercial | verde, inclusive “papel no viewport estreito” — seletor agora é `conversation-header` → `selo-da-pessoa`. **Não mascaramos** o flake: o teste passou a apontar o header. |
| navegacao | verde |
| productization-3c | verde |
| kanban-comercial-go | verde |
| kanban-owner-filter | verde |
| agenda-tela-do-produto | verde |
| risk-radar | verde (Radar continua risco, não task list) |

---

## 35. screenshots

`docs/mercado-forte-bloco-2/screenshots/` — 01–18 gerados pela spec verde. Sem QR.

| # | Arquivo |
|---|---|
| 01 | 01-kanban-operacional.png |
| 02 | 02-kanban-atrasado.png |
| 03 | 03-kanban-sem-proxima-acao.png |
| 04 | 04-inbox-proxima-acao.png |
| 05 | 05-inbox-criar-acao.png |
| 06 | 06-agenda-hoje.png |
| 07 | 07-agenda-atrasados.png |
| 08 | 08-home-hoje.png |
| 09 | 09-contato-360.png |
| 10 | 10-concluir-acao.png |
| 11 | 11-reagendar.png |
| 12 | 12-config-alerta-whatsapp.png |
| 13 | 13-alerta-whatsapp-mock-evidence.png |
| 14 | 14-mobile-kanban.png |
| 15 | 15-mobile-inbox-proxima-acao.png |
| 16 | 16-mobile-agenda.png |
| 17 | 17-mobile-home-hoje.png |
| 18 | 18-mobile-contato-360.png |

`13` = JSON do cron mock (dest E.164 do atendente + `alerta_interno_atendente`), não print de WhatsApp real.

---

## 36. commit

Gates críticos verdes (typecheck, unit relevantes, `test:db`, E2E Bloco 2 9/9, regressões 56/56). Commit **local**, sem push:

`feat(crm): unify commercial actions agenda and reminders`

---

## 37. riscos / resíduos

- Cron mock não substitui número MOOPE dedicado (Bloco futuro; sem QR agora).
- Resumo diário WhatsApp **não** implementado (opcional; não era critério).
- `prazo_em` continua coluna morta.
- Demanda inbound com dono IA não alerta até edição humana.
- Lint do repo ainda tem 2 errors pré-existentes fora deste bloco.
- DnD prompt é pós-movimento; política “obrigar próximo passo” **não** é universal (de propósito).

---

## 38. tabela de aceitação

| Critério | SIM/NÃO | Nota |
|---|---|---|
| Existe uma única fonte operacional de próxima ação | SIM | `demandas.proximo_passo` |
| Inbox usa a fonte canônica | SIM | |
| Kanban usa a mesma fonte | SIM | `proxima_acao` ≠ `next_action` IA |
| Agenda usa a mesma fonte | SIM | bloco obrigações |
| Hoje usa a mesma fonte | SIM | |
| Radar não virou segunda task list | SIM | |
| Criar uma vez aparece em todas superfícies | SIM | E2E A–D |
| Editar uma vez atualiza todas | SIM | E2E E |
| Concluir uma vez conclui todas | SIM | E2E F |
| Atraso é consistente | SIM | mesma função |
| Reagendamento é consistente | SIM | chave = due atual |
| Win/Loss limpa ação pendente corretamente | SIM | |
| Kanban ficou operacional sem redesign | SIM | |
| Sem próxima ação é visível | SIM | |
| Lead quente sem ação é visível | SIM | Hoje + filtro |
| Contato 360 melhorou | SIM | |
| Alertas internos possuem opt-in | SIM | default off |
| WhatsApp particular é separado do cliente | SIM | |
| Reminder é idempotente | SIM | unique + 23505 |
| Não houve envio WhatsApp real | SIM | mock only |
| Action Policy foi respeitada | SIM | |
| Tenant isolation verde | SIM | spec T + `test:db` RLS |
| Mobile operável | SIM | spec U; Inbox via Ficha |
| Bloco 1 não regrediu | SIM | spec B1 verde nesta sessão |
| test:db verde | SIM | 1016 passed / 1 expected fail / 1 skipped |
| E2Es verdes | SIM | Bloco 2 9/9 + regressões 56/56 |

---

## 39. recomendação

Usar internamente com alerta WhatsApp **desligado** (opt-in default off; provider desta rodada é mock). Não ligar número real. Bloco 3 (BI / campanha) **não** começa aqui.

---

## Decisões arquiteturais (formato pedido)

### Fonte canônica

ANTES: várias aparências da mesma obrigação.  
DECISÃO: reutilizar `demandas`.  
POR QUÊ: já tem texto, quando, dono, lead, conversa, estado.  
INFRA: tabela + definir-proximo-passo + crm-summary.  
CÓDIGO NOVO: projeções e concluir.  
RISCO: inbound sem dono humano.

### Sem tabela tasks

ANTES: `create_task` na policy sem executor.  
DECISÃO: executor → `demandas`.  
POR QUÊ: o nome da policy não autoriza schema novo.  
INFRA: Action Policy inalterada.  
CÓDIGO NOVO: `criarProximoPassoDoPedido`.  
RISCO: AUTONOMOUS ALLOW já existia; agora o ALLOW tem efeito real — ainda passa por policy/kill.

### Alerta interno ≠ Gestão

ANTES: tentação de `operational_moope`.  
DECISÃO: classificação `alerta_interno_atendente` + mock.  
POR QUÊ: Gestão fala com o cliente.  
INFRA: cron + ledger. Sem WAHA.  
CÓDIGO NOVO: 0204 + cron.  
RISCO: número MOOPE dedicado ainda não existe.

---

## 46. VEREDICTO FINAL

MOOPE CRM — BLOCO 2 IMPLEMENTADO: **SIM**

KANBAN / FUNIL PRONTO PARA MERCADO FORTE: **SIM**

AGENDA / PRÓXIMA AÇÃO PRONTA PARA MERCADO FORTE: **SIM**

ORGANIZAÇÃO COMERCIAL SEM ESQUECIMENTO: **SIM**

ALERTA INTERNO AO ATENDENTE VALIDADO EM MOCK: **SIM**

CONTATO 360 PRONTO PARA PILOTO: **SIM**

REGRESSÕES CRÍTICAS: **NÃO**

PRONTO PARA USO INTERNO MOOPE: **SIM** (alerta WhatsApp permanece opt-in / mock — não ligar envio real)

PRONTO PARA BLOCO 3: **SIM** (começar o Bloco 3 noutro turno; sem campanha nesta sessão)

---

STOP. Sem Bloco 3. Sem campanha. Sem QR. Sem WhatsApp real. Sem push.
