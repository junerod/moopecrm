# MOOPE CRM — Etapa 2: resultado da implementação

**Data:** 2026-09-07  
**Escopo:** controle de execução + modos de IA + kill switch + invalidação de jobs. Sem MOOPE Vendas, sem funis novos, sem templates, sem Automation Builder, sem campanhas, sem Policy Engine, sem UX grande.

**A fundação da Etapa 1 não foi alterada.** O predicado `decidirEnvioConversacional` continua sendo a pergunta “quem manda nesta conversa?”. Esta etapa acrescenta uma pergunta **diferente**: mesmo com o automático autorizado, **o que a IA pode fazer?**

**Frase de aceite (agora tecnicamente verdadeira no backend):**

> HUMANO NO COMANDO = NENHUM ENVIO CONVERSACIONAL AUTOMÁTICO
>
> …e, por cima disso: AI_MODE + kill hierárquico decidem se a IA sequer começa a trabalhar; COPILOT não produz side effect; job antigo invalidado não ressuscita; MCP e webhook genérico não furam o comando; envio operacional da MOOPE continua explícito e permitido.

---

## 1. Arquitetura antes

A Etapa 1 fechou o **SEND**. O restante ainda estava aberto:

| Buraco | Efeito |
|---|---|
| Job `pending`/`running` após Assumir/Pausar | Continuava consumindo LLM, RAG e chegando ao gate |
| Sem modo de IA formal | “IA ligada” era só agente publicado + `ai_dispatch_mode` |
| Sem kill global | `AI_BUDGET_ENFORCEMENT` só corta gasto, não execução |
| MCP `crm_send_whatsapp_message` | `sendMessageHandler` sem o predicado da Etapa 1 |
| Runtime legado `pickToolsFromMcp` | Não filtrava `BLOCKED_TOOL_IDS` |
| Exceção operacional | Qualquer `actor.type = webhook_source` era indistinguível da MOOPE |
| Worker legado | Respeitava comando; não conhecia modo/kill |
| `pos-entrada` / drain | Pulavam despacho só quando o **comando** já negava |

Duas perguntas misturadas na operação: *quem manda* e *o que a IA pode fazer*.

---

## 2. Implementação realizada

Peças novas (núcleo):

| Arquivo | Papel |
|---|---|
| `lib/ai/execucao/modos.ts` | OFF / COPILOT / CONTROLLED / AUTONOMOUS + capacidades + `decidirEfeitoDaIa` |
| `lib/ai/execucao/politica.ts` | `resolveAiExecutionPolicy` — resolvedor **único** |
| `lib/ai/execucao/ler-camadas.ts` | Carrega as 5 camadas (pg + supabase); fail-open por camada |
| `lib/ai/execucao/intencao-de-envio.ts` | `send_intent` explícito — nunca inferido de `webhook_source` |
| `lib/ai/execucao/invalidar-jobs.ts` | Pending → `failed`; running → marca `abort_requested:` |
| `lib/ai/execucao/medir.ts` | Log estruturado (`ai.execucao`) |

Encaixes:

- Persistência: `organizations.settings.ai_mode` (Zod em `lib/schemas/settings.ts`)
- Kill global: `AI_EXECUTION` em `lib/env.ts` + `lib/agent-engine/env.ts` + `.env.example`
- Dispatch: `pos-entrada` e `drain` não criam job se `deve_enfileirar_turno` é falso
- Turno: `inbound-turn` / `followup-turn` abortam se o job foi invalidado ou o modo não autoriza side effect
- `send_message` do motor: `decidirEfeitoDaIa(..., { tipo: 'send_message' })` → DENY no COPILOT
- Worker legado: mesmo resolvedor; skip `ai_mode_off`
- Takeover: Assumir / Pausar / claim / envio humano / `performHumanHandoff` invalidam jobs
- Handler de envio: predicado da Etapa 1 para `conversational_auto` e `integration_api`
- MCP: `send_intent: 'integration_api'`
- MOOPE: `send_intent: 'operational_moope'`
- Runtime legado: `pickToolsFromMcp` filtra `BLOCKED_TOOL_IDS`
- Orgs novas: `ai_mode: 'off'` no insert (bootstrap, signup, admin, provisionamento MOOPE)

O last-second gate da Etapa 1 **não foi removido nem enfraquecido**.

---

## 3. Decisões de modelagem

1. **Duas perguntas, dois módulos.** Comando fica em `comando-da-conversa.ts`. Modo fica em `lib/ai/execucao/`. Não nasceu `conversation_mode`.
2. **Sem coluna nova.** `settings.ai_mode` no jsonb que já existe — mesmo padrão de `ai_dispatch_mode`. DIRC: não duplicar.
3. **CONTROLLED = COPILOT nesta etapa.** Não existe Policy Engine. Herdar AUTONOMOUS por ausência de regra seria o defeito. Documentado em `modos.ts`.
4. **COPILOT não enfileira `inbound_turn`.** Não há fluxo útil de sugestão no inbound ainda. Gastar LLM para descobrir que não pode enviar é o que o briefing proibiu. A superfície semântica (`decidirEfeitoDaIa`) prova sugestão sem side effect.
5. **Cancelamento seguro.** Pending → `failed` (terminal). Running → só `last_error = abort_requested:…`, sem roubar o lease. O turno relê a marca. O gate da Etapa 1 continua.
6. **Devolver não ressuscita.** `failed` não volta a `pending`. Job running marcado abort recusa envio mesmo se o comando já tiver sido devolvido. Inbound novo = evento novo = job novo.
7. **Intenção de envio é campo, não actor.** `webhook_source` sozinho é `conversational_auto`.
8. **Worker legado: opção A.** Mantido, submetido aos mesmos modo + kill + comando. O engine já é o dono da resposta quando há agente publicado (`engine_owns_reply`). Apagar o worker seria apagar um caminho que ainda é registrado.

---

## 4. Onde AI_MODE é persistido

`organizations.settings.ai_mode`

Valores: `off` | `copilot` | `controlled` | `autonomous`

Leitura: `aiModeSchema` — `.catch("autonomous")`.

Não reutiliza `ai_dispatch_mode` (native/external), `published_version_id`, `force_human` nem `AI_BUDGET_ENFORCEMENT`.

Canal (opcional): `channel_sessions.metadata.ai_mode = 'off'` entra como kill da camada CHANNEL.

Superfície de configuração nesta etapa: chave jsonb + env. **Sem tela nova** (dívida declarada do invariante 6 — Etapa 3/UI).

---

## 5. Compatibilidade com organizações existentes

| Situação | Comportamento |
|---|---|
| Org já instalada, chave ausente | `autonomous` — o agente publicado continua respondendo |
| Org já instalada com agente publicado | Não muda, a menos que alguém grave `ai_mode` |
| Org nova (signup, bootstrap, admin, provisionamento MOOPE) | `ai_mode: 'off'` no INSERT |
| Default de produto para tenant novo | OFF, não AUTONOMOUS |

Nenhuma linha existente é reescrita. Não há migration de backfill.

---

## 6. Hierarquia do kill switch

Resolvedor único: `resolveAiExecutionPolicy(camadas)`.

```
GLOBAL   AI_EXECUTION=off
  ↓
TENANT   settings.ai_mode=off
  ↓
CHANNEL  channel_sessions.metadata.ai_mode=off
  ↓
AGENT    pausado / sem published_version_id / archived
  ↓
CONVERSATION  decidirEnvioConversacional (humano / pausado / encerrado / bloqueado)
```

O **primeiro OFF vence**. Exemplo do briefing: global ON, tenant ON, channel ON, agent OFF → OFF (`kill_source=agent`).

Peças reutilizadas, não duplicadas: `decidirEnvioConversacional`, `bot_silenced_until`, `published_version_id`, pause/unpublish, `AI_BUDGET_ENFORCEMENT` (continua só orçamento).

---

## 7. Funcionamento de jobs cancelados

Lane: `job_queue.contact_id`. Kinds: `inbound_turn`, `followup_turn`, `case_reply_turn`.

| Estado | Ação | Efeito |
|---|---|---|
| `pending` | `status='failed'`, `last_error=abort_requested:human_takeover` | Terminal. Não há retry. Devolver não reabre. |
| `running` | só grava a marca no `last_error` | O worker relê; `send_message` recusa; o gate da Etapa 1 ainda veta o POST |
| `failed` com marca | permanece | Job antigo não ressuscita |

Chamadores: `assumirPeloEnvioHumano`, `pause-ai`, `claim`, `performHumanHandoff`.

Follow-up **determinístico** (template, sem LLM) continua válido com AI_MODE=OFF. Takeover humano também o invalida — é envio conversacional.

---

## 8. Tratamento do worker legado

**Opção A — mantido e submetido.**

`workers/ai-response-worker.ts` já usava `decidirEnvioConversacional` (Etapa 1). Agora também chama `lerPoliticaSupabase` e pula com `skip("ai_mode_off")` quando o modo não autoriza execução/side effect.

Não foi apagado: o engine substitui a **resposta** quando há agente publicado, mas o worker continua registrado no dispatcher. Prova de substituição integral exigiria apagar o registro — fora desta etapa.

---

## 9. MOOPE operacional × conversacional

Classificação em `HandlerCtx.send_intent`:

| Intent | Quem seta | Respeita comando da conversa? |
|---|---|---|
| `human` | Inbox (`actor.type=user`) | Não — o humano *é* o comando |
| `conversational_auto` | automação de envio; default de não-user | Sim |
| `integration_api` | MCP `crm_send_whatsapp_message` | Sim |
| `operational_moope` | **somente** `lib/moope/enviar.ts` | Não (bloqueio/opt-out continua) |
| `system_notice` | aviso de handoff | Não (texto de ciclo de vida, não fala da IA) |

`actor.type = webhook_source` **não** concede `operational_moope`.

Automação determinística sem IA (`send_whatsapp_message` com template, mover lead, tag, tarefa, webhook) **não** passa pelo AI_MODE. OFF = IA desligada, não CRM desligado. `send_ai_message` (gera texto com LLM) **passa** pelo resolvedor e não gasta modelo se OFF/COPILOT.

---

## 10. Tratamento específico de MCP

Pergunta do briefing: uma IA consegue chegar em `crm_send_whatsapp_message` e enviar sem o gate da Etapa 1?

**Antes: sim, pelo HTTP MCP.** O motor canônico já bloqueava a tool (`BLOCKED_TOOL_IDS`). O runtime legado (`pickToolsFromMcp` / `runAgent`) **não** filtrava. O handler não lia o comando.

**Agora:**

1. MCP HTTP seta `send_intent: 'integration_api'` → `decidirEnvioConversacional` no handler.
2. `pickToolsFromMcp` não monta `crm_send_whatsapp_message` nem `crm_request_human_handoff`.
3. Humano no comando → `409 state_conflict`. Sem bypass por `webhook_source`.

---

## 11. Arquivos alterados

**Novos**

- `lib/ai/execucao/modos.ts`
- `lib/ai/execucao/politica.ts`
- `lib/ai/execucao/ler-camadas.ts`
- `lib/ai/execucao/intencao-de-envio.ts`
- `lib/ai/execucao/invalidar-jobs.ts`
- `lib/ai/execucao/medir.ts`
- `tests/unit/ai-execucao-politica.test.ts`
- `tests/unit/ai-execucao-intencao-handler.test.ts`
- `.changes/ai-mode-e-kill-switch.md`
- `docs/MOOPE_CRM_ETAPA_2_RESULTADO.md`

**Tocados (fundação da Etapa 1 preservada)**

- `lib/schemas/settings.ts` — `AI_MODES`, semente de org nova
- `lib/api/handlers/types.ts` — `send_intent` opcional
- `lib/env.ts`, `lib/agent-engine/env.ts`, `.env.example`, `.env.hostgator.example`
- `lib/agent-engine/queue/queue.ts` — invalidate / abort / `jobFoiInvalidado`
- `lib/agent-engine/agent/inbound-turn.ts`, `followup-turn.ts`, `human-handoff.ts`
- `lib/agent-engine/edge/crm/drain.ts` + `drain.test.ts`
- `lib/channels/pos-entrada.ts`
- `lib/inbox/assumir-pelo-envio.ts`
- `app/api/v1/messages/_handler.ts`
- `app/api/v1/conversations/[id]/pause-ai/route.ts`
- `app/api/v1/conversations/[id]/claim/route.ts`
- `lib/mcp/tools/messages.ts`
- `lib/moope/enviar.ts`, `lib/moope/provisionar.ts`
- `lib/auth/provision.ts`, `scripts/bootstrap-owner.ts`
- `app/api/v1/admin/tenants/route.ts`
- `lib/ai/runtime/tools.ts`, `lib/ai/types.ts`, `lib/ai/handoff/aviso-ao-lead.ts`
- `lib/automation/actions/send-whatsapp.ts`, `send-ai-message.ts`
- `workers/ai-response-worker.ts`
- `docs/architecture/agent-turn.workflow.json` — nó `ai_policy` (≥2 arestas)
- `tests/unit/pos-entrada-efeitos-do-canal.test.ts`

`lib/inbox/comando-da-conversa.ts` **não** teve a assinatura nem os códigos de negação alterados.

---

## 12. Migrations

**Nenhuma.** Sem coluna, sem tabela, sem trigger. A chave vive no jsonb `organizations.settings`. Self-host antigo não precisa de `update.sh` de schema.

`pnpm test:db` não foi exigido por mudança de banco. Não rodado.

---

## 13. Testes

Os 15 do briefing:

| # | O quê | Onde |
|---|---|---|
| 1 | OFF → nenhum job LLM; automação determinística intacta | `ai-execucao-politica`, `pos-entrada`, `drain.test` |
| 2 | COPILOT sugere sem side effect | `decidirEfeitoDaIa` + política |
| 3 | COPILOT `send_message` → DENY | `decidirEfeitoDaIa` + `inbound-turn` |
| 4 | AUTONOMOUS continua | política |
| 5 | AUTONOMOUS + assume = Etapa 1 | `decidirEnvioConversacional` + política |
| 6 | pending invalidado | `invalidatePendingConversationalJobs` |
| 7 | running marcado abort, gate de pé | `requestAbortOnRunningConversationalJobs` + `jobFoiInvalidado` |
| 8 | devolver não ressuscita | marca `abort_requested:` sobrevive |
| 9 | GLOBAL OFF | `globalOff` / `AI_EXECUTION` |
| 10 | TENANT OFF | `kill_source=tenant` |
| 11 | AGENT OFF | `kill_source=agent` |
| 12 | CONVERSATION pausada | `DENY_PAUSED` + kill |
| 13 | MOOPE operacional + humano | handler com `operational_moope` envia |
| 14 | MCP + humano → DENY | handler com `integration_api` → 409 |
| 15 | `webhook_source` sem intent → não é MOOPE | handler → 409 |

---

## 14. Resultados

```
pnpm exec tsc --noEmit     → EXIT 0
eslint (arquivos tocados)  → 0 errors (warnings pré-existentes de console no bootstrap)
```

Suíte pontual desta etapa (política, handler de intenção, pos-entrada, before-send comando, silêncio humano, env-example, mapas, drain, worker/handoff): **verde**.

`pnpm test:unit` completo (2026-09-07):

| | |
|---|---|
| Arquivos | 11 failed / 571 passed (582) |
| Testes | 30 failed / 6470 passed / 1 expected fail |
| Duração | ~198 s |

A Etapa 1, na mesma árvore suja, mediu **22 failed / 6453 passed**. Esta etapa acrescentou testes verdes; a suíte completa continua vermelha pelos mesmos arquivos de dívida.

---

## 15. Regressões

### Falhas introduzidas por esta etapa

**Nenhuma identificada na suíte pontual.** Os três casos de `messages-handler-desfechos` (first-fetch `contacts/check-exists`, `error_message = waha_500: boom`) **já falhavam no HEAD** — documentados na Etapa 1.

### Falhas preexistentes no HEAD / árvore suja

As mesmas da Etapa 1, com ruído extra de timeout e fragmentos inválidos já no `.changes/`:

- `messages-handler-desfechos` — grafias do 9 / first-fetch
- `audit-resource-id-e-uuid`
- `baseline-constraint-reconstruida`
- `branding-saida`
- `canal-arquivado-caminho-de-volta`
- `fragmentos-de-release` — frontmatter inválido em fragmentos **já presentes** (não o desta etapa; o nosso é `capacidade_nova` / `adicionado`)
- `ingest-dedup-deixa-rastro`
- `pacote-reserva-vaga-da-critica`
- `lib/ai/dispatcher/rate-limit.test.ts` — timeout flaky do contador em memória
- Unhandled rejection `lib/moope/emitir.ts` no fake de `waha-carimbo-falho`

Não “consertadas” aqui.

**Não rodado (e por quê):**

- `pnpm test:db` — sem mudança de schema/RLS
- `pnpm test:e2e` — sem tela nova; o invariante 6 (configurar `ai_mode` pela UI) é dívida declarada

---

## 16. Riscos residuais

1. **COPILOT sem produto.** A IA pode sugerir em função pura; não há job de copiloto nem UI [EDITAR]/[ENVIAR]/[DESCARTAR]. Querer “a IA resume a conversa sozinha” nesta etapa gastaria LLM sem consumidor.
2. **CONTROLLED é COPILOT.** Ligar CONTROLLED hoje não executa workflow. Quem esperar autonomia vai se surpreender — de propósito.
3. **Cancelamento de running é cooperativo.** Sem preempção de lease. O last-second gate cobre o envio; o gasto de tokens do turno já em voo pode ocorrer até a próxima releitura.
4. **Invalidação por `contact_id`.** A lane da fila é o contato. Pausar uma conversa cancela turnos de todas as conversas daquele contato. Conservador e alinhado a `force_human`.
5. **Lookup de política fail-open.** Select quebrado não inventa OFF — o gate da Etapa 1 continua. Um OFF que o banco não conseguiu ler não cala o despacho.
6. **Sem UI de `ai_mode`.** Operador muda via SQL/jsonb ou, no global, via `AI_EXECUTION`. Invariante 6 em dívida.
7. **Worker legado ainda existe.** Dois caminhos de resposta possíveis se `engine_owns_reply` for contornado. Ambos agora respeitam modo + comando.
8. **`system_notice` não passa pelo comando.** Aviso de handoff ainda sai com humano assumindo no mesmo instante. É ciclo de vida, não fala da IA. Se no futuro um caminho genérico herdar esse intent, vira buraco — por isso só o aviso de escalação o seta.

---

## 17. Recomendação objetiva para a próxima etapa

**Não avançar para MOOPE Vendas ainda sem estes três cortes, nesta ordem:**

1. **Superfície de `ai_mode`.** Uma tela (ou um campo em Configurações › Atendimento) para ver/mudar OFF/COPILOT/CONTROLLED/AUTONOMOUS, com o default de org nova visível. Sem isso o kill existe e ninguém opera.
2. **Job de copiloto de verdade** (resumo / sugestão de resposta / intenção) que **não** chama `send_message`, gravado como atividade da conversa. Só então COPILOT deixa de ser só predicado.
3. **Policy Engine mínimo para CONTROLLED** — allowlist explícita de tools/ações. Até lá, CONTROLLED permanece COPILOT. Não “ligar CONTROLLED = autonomous com outro nome”.

Depois disso, e só depois: funil comercial da MOOPE, templates de nicho, campanhas.

**PARAR AQUI.** Não iniciar Etapa 3 nesta sessão.

---

## Living System Checklist — política de execução de IA

| # | Pergunta | Resposta (artefato) |
|---|---|---|
| 1 | Quem me alimenta? | `organizations.settings.ai_mode`, `AI_EXECUTION`, metadata do canal, `published_version_id`, `decidirEnvioConversacional` |
| 2 | Quem eu alimento? | `pos-entrada`, `drain`, `inbound-turn`, worker legado, `send-ai-message`, `sendMessageHandler` |
| 3 | Que registro eu emito? | `logger.info("ai.execucao")` com org/conversa/modo/decisão/kill/job; `job_queue.last_error` |
| 4 | Onde apareço na tela? | Dívida: sem dashboard. Timeline de takeover já existe (`registrarTrocaDeComando`) |
| 5 | Por qual porta? | Sem tela nova. Env + settings jsonb |
| 6 | Anti-morte? | OFF não mata CRM: lead, tag, template, webhook seguem. Follow-up determinístico segue |
| 7 | Onde se configura? | `settings.ai_mode` + `AI_EXECUTION`. Falta de chave = autonomous (compat). Org nova = off. **UI = dívida** |
| 8 | Continuidade? | Humano assume → jobs invalidated → automático só volta com Devolver + inbound novo |
| 9 | Laço de retorno? | `kill_source` + `execution_decision` no log. Consumidor humano/dashboard = próxima etapa |
| 10 | Mapa? | `docs/architecture/agent-turn.workflow.json` nó `ai_policy` com arestas eventlog→policy→turn e handoff→policy |
