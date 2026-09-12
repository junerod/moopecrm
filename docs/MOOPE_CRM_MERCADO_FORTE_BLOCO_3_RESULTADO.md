# MOOPE CRM — Mercado Forte · Bloco 3

**Campanhas + Supervisão + MOOPE no contexto comercial**

Data: 2026-09-12  
Tipo: implementação controlada. **SEM PUSH. SEM QR. SEM WhatsApp real. SEM reconectar VPS. SEM Bloco 4.**

Terceiro e último bloco "Mercado Forte". Depois disto a régua é uso interno + piloto + feedback real.

---

## 1. Executive summary

Nasceu **campanha comercial essencial** — entidade própria, não o disparo operacional da Gestão e não o alerta interno do atendente. Segmento → preview → worker em lote com pacing, opt-out fail-closed, cancelamento, métricas e atribuição de resposta. O envio desta rodada é **mock** (`campaign_commercial`). Lead **não** nasce no disparo.

**Desempenho** (`/app/metrics`) passou a expor o que já existia: `getQueueStatus`, `fn_attendant_metrics`, demandas, won/lost, funil e agora campanhas. Sem warehouse. Período Hoje / 7 / 30 dias. Manager+.

**Retrato MOOPE** no Inbox e no contato 360: leitura, cache se a API falhar, "Não consegui consultar agora." Copilot não inventa dado da Gestão. MCP write **não** foi liberado. Disponibilidade de veículo = residual (API não tem calendário).

IA: `campaign_dispatch` é DENY em COPILOT e AUTONOMOUS mesmo com allowlist; CONTROLLED pede confirmação. Disparo massivo continua humano.

---

## 2. base

Pedido: `05dbb626` — `feat(crm): unify commercial actions agenda and reminders`.

HEAD no início desta sessão = essa base. Branch `main`, `origin/main` 2 ahead (Blocos 1 e 2, ainda sem push).

---

## 3. Git inicial

```
branch: main
HEAD:   05dbb626 feat(crm): unify commercial actions agenda and reminders
ahead/behind origin/main: 2 / 0
log -5:
  05dbb626 feat(crm): unify commercial actions agenda and reminders
  41e086be feat(crm): strengthen multi-attendant daily workflow
  a0548126 fix(crm): complete pre-pilot onboarding validation
  c3d8ab90 Merge remote-tracking branch 'origin/main'
  57a96d86 fix(inbox): stop Comercial filter from 500ing the list
```

Working tree já estava sujo de docs/evidence/piloto de sessões anteriores. **Não foi apagado.** Esse lixo não entra no commit do Bloco 3.

---

## 4. arquitetura reutilizada

| Peça | Uso |
|---|---|
| `channels/capabilities` | WAHA = sem campanha real; Meta/Zernio/Twilio = template |
| `checarGuardasDeContato` / `is_blocked` / `consent.declined_at` | fail-closed do destinatário |
| `lib/opt-out/deteccao.ts` | vocabulário STOP inalterado |
| `PROACTIVE_THROTTLE_MS` (5s) | pacing da campanha |
| `event_log` / cron / `audit()` | tick só audita se houve efeito |
| `crm_leads` / pipelines / `garantirLeadDaConversa` | lead só no inbound normal |
| `demandas` / Hoje / Radar | supervisão lê, não duplica |
| `getQueueStatus` / `fn_attendant_metrics` | KPIs de atendimento |
| `getRetratoLocatario` / MCP locadora | retrato; só GET |
| Action Policy | `campaign_dispatch` |
| `source=moope` / `source_metadata.moope_external_id` | vínculo do retrato |

**Não criado:** segundo motor de mensagem, segundo opt-out, campaign provider, analytics warehouse, segundo CRM, inbox de campanha, MCP write na Gestão.

---

## 5. migrations

**0205** `20260912200000_0205_campanhas_comerciais.sql` + apêndice no `baseline.sql` + MANIFEST.

- `campaigns` — org, nome, status curto (`draft|scheduled|running|completed|cancelled|failed`), canal, template, `body_text`, `segment` jsonb, autor, scheduled/started/finished/`last_sent_at`
- `campaign_recipients` — contact, phone, status, timestamps, error, `lead_id` opcional, `message_id` opcional (FK para `messages` quando houver mensagem real)
- unique `(campaign_id, contact_id)`
- RLS `fn_user_org_ids()` + `fn_role_at_least(..., 'agent')`

**0206** `20260912210000_0206_lgpd_alcanca_destinatario_campanha.sql` — `fn_lgpd_cascade_redact_contact` zera `phone`/`error` do destinatário. Status e timestamps ficam. Sem isto o invariante de cascata LGPD reprova tabela nova com PII.

Supervisão: **zero** migration.  
Retrato MOOPE: **zero** migration.

Nesta rodada `message_id` permanece nulo: o mock não grava `messages`.

---

## 6. campanha — modelo

```
CANÔNICO:  campaigns + campaign_recipients
ENVIO:     campaign_commercial (mock). NÃO é operational_moope.
           NÃO é alerta_interno_atendente.
MENSAGEM:  quando existir de verdade, vive em messages (message_id).
LEAD:      não no envio. Nasce/associa na resposta ou ação humana.
INBOX:     a de sempre. Sem "inbox de campanha".
```

Decisão documentada: não duplicar `messages` no mock. Destinatário guarda status e telefone do momento do envio (PII → cascata 0206).

---

## 7. segmentação

`lib/campanhas/segmento.ts` + `carregar-contatos.ts`.

Filtros MVP: tags, papel, origem, responsável, pipeline, stage, temperatura, opt-in/bloqueado, IDs manuais. Sem query builder.

Estimativa antes do envio: `"N contatos selecionados"` (elegíveis) + excluídos (bloqueados/opt-out).

---

## 8. consent / opt-out

`destinatarioPodeReceberCampanha` reusa `checarGuardasDeContato`.

Nunca envia para `is_blocked`, sem telefone ou `consent.declined_at`. Recheck no tick do worker. Fail-closed.

Disparo operacional MOOPE **não** foi esticado.

---

## 9. templates

Capabilities reais:

- WAHA QR: **não** habilita campanha comercial real
- Meta / Zernio: template oficial
- Twilio: só se o adapter já exige template e não tem `banRisk`

UI não promete provider universal. Worker desta rodada é mock em todos.

---

## 10. preview

Variáveis conhecidas: `nome`, `telefone`, `email`. Desconhecida ou sem valor → bloqueia. Placeholder quebrado não sai.

E2E: `Olá {{nome}}` → `Olá Maria`.

---

## 11. worker

`POST/GET /api/v1/cron/campaign-dispatch` (`INTERNAL_SECRET` / cron secret).  
Scheduler: `*/5` em `docker/scheduler/entrypoint.sh`.

Por tick: promove `scheduled`, encerra `running` sem pending, processa até 10 campanhas, lote 20, opt-out recheck, preview, mock, unique impede duplicata (23505).

Não loopa 5.000 na request de start.

---

## 12. pacing

`PACING_CAMPANHA_MS` = `PROACTIVE_THROTTLE_MS` (5s). Não o conversacional 1,2s. Adapter/capability governa o que seria real; o mock ainda respeita o piso.

---

## 13. idempotência

Unique `(campaign_id, contact_id)`. Update de `pending` → `sent` com `.eq("status","pending")`. Segunda execução do cron: `enviados = 0`. E2E F.

---

## 14. cancelamento

`draft|scheduled|running` → `cancelled`. Pending vira `cancelled`. Completed não cancela. E2E G.

---

## 15. recipients / status

`pending|skipped|sent|delivered|read|replied|failed|cancelled`.

Mock marca sent+delivered no mesmo instante (não há webhook real). `read` existe no schema para o adapter futuro.

---

## 16. resposta / atribuição

Inbound normal na Inbox. Worker varre `messages` inbound após `sent_at` e marca `replied`. `garantirLeadDaConversa` carimba `source_metadata.campaign_id` se houver destinatário já enviado. Sem inbox paralela.

---

## 17. campanha → lead

Start **não** cria lead. E2E J: contagem de `crm_leads` igual antes/depois do envio.

---

## 18. métricas campanha

Tela de resultado + bloco no Desempenho: enviadas, entregues, lidas, respondidas, falharam, opt-outs (skipped), leads associados (recipient com `lead_id`). Sem ROAS.

---

## 19. supervisão

`GET /api/v1/metrics/supervisao?periodo=hoje|7d|30d` — **manager+**.  
`lib/supervisao/kpis.ts` agrega fontes existentes. Sem schema novo.

---

## 20. atendimento

Fila, espera mais antiga, primeira resposta média (`fn_attendant_metrics`), conversas abertas, conversas por atendente.

---

## 21. comercial

Leads novos no período, oportunidades abertas, sem próxima ação, atrasadas, ganhos, perdidos, conversão.

---

## 22. desempenho por atendente

Tabela: atendente, conversas, primeira resposta, resolvidas, leads, ganhos, atrasadas. Sem ranking gamificado. Só o que o RPC/demanda medem.

---

## 23. funil gerencial

Quantidade e valor (`value_cents`) por estágio. Ganho/perdido no período. Conversão. Sem forecast.

---

## 24. integração MOOPE auditada

GET existente: `getRetratoLocatario` / lookup / oferta.  
MCP locadora: tools de **leitura**.  
Write: 0 — deixado para feedback pós-piloto.

Disponibilidade calendário: **NAO_EXISTE**. Residual explícito.

---

## 25. retrato MOOPE

`RetratoMoope` no `BlocoNegocio` (Inbox) e `Contato360Comercial`.

Mostra o que o GET devolve: nome, veículo/placa, status, atraso, "Ver na Gestão" se `portal_url`.

Live com timeout curto; se falhar e houver `source_metadata.retrato_locadora`, usa cache. Sem vínculo: some. Falha sem cache: "Não consegui consultar agora."

---

## 26. MCP / RAG / IA

RAG não é dado operacional vivo. Copilot: se a pergunta pede Gestão e não há fatos do retrato → `"Não consegui consultar agora."` Overlay proíbe inventar.

`campaign_dispatch`: COPILOT/AUTONOMOUS = DENY (mesmo com allowlist). CONTROLLED = REQUIRE_CONFIRMATION. Campanha exige clique humano.

---

## 27. RBAC

| Ação | Role |
|---|---|
| Ver campanhas / segmento | agent+ |
| Criar / start / cancel | manager+ |
| Desempenho / supervisão | manager+ |
| Retrato MOOPE | agent+ (mesmo acesso do contato) |

Agent: 403 no POST campanhas e GET supervisao; sem botão "Nova campanha". E2E L.

---

## 28. tenant isolation

Campanha da org B não aparece no GET da org A. Retrato filtra `organization_id` do cookie. E2E T + RLS do `test:db`.

---

## 29. mobile

390×844: lista/detalhe de campanha, KPIs de Desempenho, retrato na Ficha. Wizard completo no celular **não** é requisito.

---

## 30. arquivos alterados (produto deste bloco)

**Novos:** `lib/campanhas/**`, `lib/supervisao/**`, `lib/moope/retrato-comercial.ts`, `app/api/v1/campanhas/**`, `app/api/v1/cron/campaign-dispatch/**`, `app/api/v1/metrics/supervisao/**`, `app/api/v1/contacts/[id]/moope-retrato/**`, `app/app/campanhas/**`, `components/moope/RetratoMoope.tsx`, hooks, `tests/e2e/mercado-forte-bloco-3.spec.ts`, migrations 0205/0206, `.changes/campanhas-supervisao-moope.md`.

**Tocados:** `nascimento-do-lead.ts` (atribuição fail-closed), Action Policy + Copilot, `MetricsClient`, nav + i18n, `BlocoNegocio` / `Contato360Comercial`, scheduler, `e2e.yml`, `baseline.sql`, `MANIFEST`, `database.types.ts`, `scripts/seed-e2e-radar.ts` (reset de dono/conversas do fixture — harness, não regra nova).

---

## 31. unit tests

Suíte alvo (campanha, supervisão, retrato, policy, nav, cron-audit, e2e-cobertura): **107 passed**.

Cobre: segmento, preview, capabilities WAHA, mock `campaign_commercial`, pacing 5s, cancel, métricas, atribuição sem `.not()`, policy DENY, cron só audita com efeito.

---

## 32. test:db

```
Test Files  130 passed (130)
Tests       1016 passed | 1 expected fail | 1 skipped (1018)
```

Igual ao baseline pedido. A primeira corrida (baseline antigo) falhou 1 caso LGPD — `campaign_recipients` fora da cascata. 0206 + passo no dump do baseline. Reexecução verde. Nascimento do lead deixou de estourar: atribuição não usa `.not()` (o adaptador `pgComoSupabase` não implementa).

---

## 33. E2Es

`pnpm e2e:build`. Porta **3021**. `AUTH_RATE_LIMIT_LOGIN_IP=1000`. `.env.e2e` → `127.0.0.1:54321`. Sem QR. Sem WhatsApp real.

`tests/e2e/mercado-forte-bloco-3.spec.ts` — **8/8 passed**.

| # | Cenário |
|---|---|
| A–E | wizard: draft, segmento, opt-out, preview, envio mock |
| C F G H J | skipped do bloqueado, 2º cron = 0, cancel, status, sem lead em massa |
| I | resposta inbound → `replied` |
| K–P | Desempenho + períodos + RBAC agent 403 |
| Q R S | retrato cache / falha segura / Copilot não inventa |
| T | org B invisível |
| U | mobile 390 |
| V W | fumaça Inbox / Agenda / Hoje / Kanban |

---

## 34. regressões

Mesmo build, porta 3022. Leva única: **64/65**. `risk-radar` "assume" falhou porque o seed zerava o lead e **uma** conversa, e o radar lia outra conversa do mesmo contato ainda com `assignee_kind=user`. **Produto não mudou.** O seed passou a resetar todas as conversas do contato + `owner_kind`. Reexecução `risk-radar`: **2/2**.

| Spec | Resultado |
|---|---|
| mercado-forte-bloco-1 | verde |
| mercado-forte-bloco-2 | verde |
| inbox-quem-manda | verde |
| inbox-scope | verde |
| inbox-assistente-ia | verde |
| inbox-cockpit-comercial | verde |
| kanban-comercial-go | verde |
| kanban-owner-filter | verde |
| agenda-tela-do-produto | verde |
| risk-radar | verde na reexecução (harness) |
| productization-3c | verde |
| navegacao | verde (inclui `/app/campanhas`) |

---

## 35. screenshots

`docs/mercado-forte-bloco-3/screenshots/` — gerados pela spec verde. Sem QR.

| # | Arquivo |
|---|---|
| 01 | 01-campanhas-lista.png |
| 02 | 02-campanha-nova-segmento.png |
| 03 | 03-campanha-template.png |
| 04 | 04-campanha-preview.png |
| 05 | 05-campanha-resultado.png |
| 06 | 06-desempenho-atendimento.png |
| 07 | 07-desempenho-comercial.png |
| 08 | 08-desempenho-atendentes.png |
| 09 | 09-funil-gerencial.png |
| 10 | 10-inbox-retrato-moope.png |
| 11 | 11-contato-360-moope.png |
| 12 | 12-moope-falha-segura.png |
| 13 | 13-mobile-campanhas.png |
| 14 | 14-mobile-desempenho.png |
| 15 | 15-mobile-moope-cockpit.png |

---

## 36. matrix final

[`docs/MOOPE_CRM_MERCADO_FORTE_MATRIX_FINAL.md`](./MOOPE_CRM_MERCADO_FORTE_MATRIX_FINAL.md)

Geral **57 → 70**. Campanhas **8 → 48**. Supervisão **42 → 64**. MOOPE **38 → 54**. Sem inventar linha P3.

---

## 37. riscos

- Envio de campanha é mock. Certificação WhatsApp real é passo operacional separado.
- WAHA QR continua sem disparo comercial real (política).
- Disponibilidade de veículo não existe na API — residual.
- MCP write na Gestão continua proibido.
- `message_id` vazio até existir adapter real.
- Lint do repo ainda tem 2 errors pré-existentes fora deste bloco.

---

## 38. blockers reais para piloto

Nenhum blocker de **produto** das funções essenciais.

**Blocker operacional (já declarado no pedido):** campanha e alerta interno ainda não passaram por número WhatsApp real. Isso **não** abre Bloco 4. Sequência: certificação controlada → uso interno → piloto → corrigir o que usuário mostrar.

---

## 39. nice to have (não é blocker)

P3 da auditoria: typing, SSO, CSAT/NPS, skills, forecast, app nativo, teams, email marketing, A/B, ads managers, omnichannel, disponibilidade calendário, parcelas, vistoria, MCP write.

---

## 40. tabela de aceitação

| Critério | SIM/NÃO |
|---|---|
| Campanha possui entidade própria | SIM |
| Não reutilizou disparo operacional MOOPE como campanha | SIM |
| Opt-out é respeitado | SIM |
| Segmentação funciona | SIM |
| Template respeita capabilities | SIM |
| Preview funciona | SIM |
| Worker é idempotente | SIM |
| Campanha pode ser cancelada | SIM |
| Métricas básicas existem | SIM |
| Resposta pode ser atribuída à campanha | SIM |
| Envio não cria lead em massa | SIM |
| Supervisor vê operação sem MCP | SIM |
| Fila/espera ficam visíveis | SIM |
| Primeira resposta fica visível | SIM |
| Conversão comercial fica visível | SIM |
| Desempenho por atendente existe | SIM |
| MOOPE aparece no contexto do cliente | SIM |
| Não duplicou Gestão dentro do CRM | SIM |
| MCP/RAG foram usados corretamente | SIM |
| IA não inventa dado operacional | SIM |
| Campanha exige humano | SIM |
| Tenant isolation verde | SIM |
| RBAC verde | SIM |
| Mobile operável | SIM |
| Bloco 1 não regrediu | SIM |
| Bloco 2 não regrediu | SIM |
| test:db verde | SIM |
| E2E verde | SIM |
| Nenhum WhatsApp real foi tocado | SIM |

---

## 41. recomendação final

**Parar de acrescentar feature por checklist.**

1. Certificação controlada de WhatsApp real (fora deste commit).  
2. Uso interno MOOPE com campanha mock/opt-in consciente.  
3. Piloto com cliente.  
4. Corrigir só o que usuário real mostrar.

Não abrir Bloco 4. Não abrir Refresh 3. P3 é backlog, não dívida de Mercado Forte.

---

## 42. commit

Gates críticos verdes (unit alvo, `test:db` 1016/1/1, E2E Bloco 3 8/8, regressões verdes). Commit **local**, sem push:

`feat(crm): add campaigns supervision and moope context`

---

## 47. VEREDICTO FINAL

MOOPE CRM — BLOCO 3 IMPLEMENTADO: **SIM**

CAMPANHAS COMERCIAIS PRONTAS PARA PILOTO: **SIM** (envio mock; WhatsApp real = certificação operacional)

SUPERVISÃO PRONTA PARA MERCADO FORTE: **SIM**

INTEGRAÇÃO MOOPE VISÍVEL NO FLUXO COMERCIAL: **SIM**

MOOPE CRM — MERCADO FORTE NAS FUNÇÕES ESSENCIAIS: **SIM**

REGRESSÕES CRÍTICAS: **NÃO**

PRONTO PARA USO INTERNO MOOPE: **SIM**

PRONTO PARA PILOTO COM CLIENTE: **SIM** — depois da certificação controlada de WhatsApp real (não é gap de checklist)

NÍVEL FINAL ESTIMADO DE MERCADO FORTE: **70%**

---

## 48. STOP DEFINITIVO

PARAR. Sem Bloco 4. Sem Refresh novo. Sem feature P3. Sem QR. Sem WhatsApp real. Sem reconectar VPS. Sem push.
