# MOOPE CRM — Etapa 2.5: resultado da implementação

**Data:** 2026-09-07  
**Escopo:** superfície de AI_MODE, Copilot real no Inbox, Policy Engine mínimo para CONTROLLED. Sem MOOPE Vendas, sem funil novo, sem templates, sem Automation Builder, sem campanhas, sem agente comercial de nicho.

**As Etapas 1 e 2 não foram enfraquecidas.** Continuam intactos:

- `decidirEnvioConversacional`
- last-second gate (`runBeforeSend`)
- takeover humano (`assumirPeloEnvioHumano`)
- invalidação de jobs (`CONVERSATIONAL_TURN_KINDS` — `copilot_turn` **não** entra)
- `resolveAiExecutionPolicy` e a hierarquia GLOBAL → TENANT → CHANNEL → AGENT → CONVERSATION
- classificação `send_intent`
- exceção explícita `operational_moope`

Três perguntas, três módulos:

| Pergunta | Módulo |
|---|---|
| Quem pode falar? | Comando da conversa (`lib/inbox/comando-da-conversa.ts`) |
| A IA pode trabalhar? | AI execution policy (`lib/ai/execucao/`) |
| Qual efeito a IA pode produzir? | Action Policy (`lib/ai/acoes/autorizar.ts`) |

---

## 1. Arquitetura

```
CLIENTE ESCREVE
  → pos-entrada
      → se deve_enfileirar_turno (AUTONOMOUS + comando permite)
          → ai_agent.dispatch_requested → inbound_turn
      → se deve_enfileirar_copiloto (COPILOT ou CONTROLLED)
          → ai_copilot.dispatch_requested → copilot_turn
  → Inbox: Assistente IA (resumo / intenção / rascunho)
  → [Usar resposta] preenche o composer (não envia)
  → atendente edita e envia → send_intent=human → Etapa 1 assume
```

CONTROLLED que tenta ação importante:

```
authorizeAiAction(move_lead_stage)
  → REQUIRE_CONFIRMATION
  → ai_action_requests (pending)
  → Inbox [Confirmar]
  → executa uma vez como ação humana
```

`copilot_turn` **não** reutiliza `inbound_turn`. Não há tools, não há `send_message`, não há mutação de CRM. O único write é a própria sugestão.

Humano no comando **não** mata o Copilot: a sugestão é para o atendente. Kill GLOBAL / TENANT / CHANNEL / AGENT continua matando sugestão e turno.

---

## 2. Telas

| Tela | O que ganhou |
|---|---|
| `/app/settings/atendimento` | Card **Modo da IA** (off / copilot / controlled / autonomous) + configurado vs efetivo |
| Inbox (ficha do contato) | Card **Assistente IA** no topo do `CRMSidePanel` |

Nenhum módulo novo de navegação. A porta já existia (`Distribuição de atendimento`); a descrição da porta agora menciona o modo da IA.

---

## 3. AI_MODE UI

Radios com a cópia pedida:

- **OFF** — IA desligada. CRM e automações normais continuam.
- **COPILOT** — IA ajuda o atendente, não executa sozinha.
- **CONTROLLED** — IA executa só o autorizado.
- **AUTONOMOUS** — agente atua sozinho dentro das regras.

A UI não contradiz a política: GET `/api/v1/settings/ai-mode` devolve `configured`, `effective` (`modoApresentado`), `kill_global`, `reason`, `agent_published`. Exemplo do TESTE 11: configurado AUTONOMOUS + kill global → efetivo OFF, motivo “IA desativada globalmente.”

Gate: manager+ (mesma linha de atendimento). Merge jsonb não-destrutivo. Não mistura com routing.

---

## 4. Copilot job

- Kind novo: `copilot_turn` (`lib/agent-engine/agent/copilot-turn.ts`)
- Evento: `ai_copilot.dispatch_requested`
- Drain: mesmo `drain.ts`, ramo separado — nunca enfileira `inbound_turn`
- Geração sob demanda: POST `/api/v1/conversations/:id/copilot` (botão Gerar / Gerar outra)
- Auto: nova mensagem inbound + COPILOT/CONTROLLED
- LLM sem tools (`purpose: copilot_suggestion`)
- Prompt genérico do atendente — **sem** “você é vendedor da MOOPE”, preços, frota, locadora

Saída:

```ts
{ summary, intent, suggestedReply, suggestedNextAction, extractedFields, confidence }
```

Intenções desta fase (vocabulário aberto a categorias futuras por tenant):

`PRICE | PRODUCT_INFO | DEMO | SUPPORT | COMPLAINT | PAYMENT | HUMAN_REQUEST | FOLLOW_UP | OTHER`

Confiança 0–1; a UI mostra Alta / Média / Baixa.

---

## 5. Idempotência

Unique `(organization_id, conversation_id, inbound_message_id)` em `ai_copilot_suggestions`.

- Auto: se já existe sugestão `ready`/`used` para aquela mensagem, não gera de novo (drain + `gerarSugestaoDoCopiloto`).
- “Gerar outra”: `force=true` sobrescreve a mesma chave.
- Jobs: `source_event_id` do event_log (23505), como o inbound.

`copilot_turn` **fora** de `CONVERSATIONAL_TURN_KINDS`: assumir no meio do voo não cancela a sugestão (TESTE 12). Side effect continua impossível.

---

## 6. Policy Engine

`authorizeAiAction(...)` → `ALLOW | DENY | REQUIRE_CONFIRMATION | REQUIRE_HUMAN`.

Não é prompt. Ausência de regra **nunca** é ALLOW.

Config opcional em `organizations.settings.ai_action_policy`: `{ allow: [], confirm: [] }`.

---

## 7. Matriz de ações

Allowlist inicial: `read_conversation`, `read_contact`, `read_lead`, `search_knowledge`, `suggest_reply`, `summarize`, `classify_intent`, `extract_fields`, `add_tag`, `create_task`, `move_lead_stage`, `send_message`, `call_external_api`, `operational_moope_action`.

| Modo | Leitura/sugestão | Leves (`add_tag`, `create_task`) | Importantes |
|---|---|---|---|
| OFF | DENY | DENY | DENY |
| COPILOT | ALLOW | DENY | DENY |
| CONTROLLED | ALLOW | ALLOW só se `allow[]` | `move_lead_stage` → REQUIRE_CONFIRMATION por default; `send_message` / API / MOOPE → DENY sem `allow`/`confirm` |
| AUTONOMOUS | ALLOW | ALLOW | ALLOW, ainda sujeito a kill + comando + tools + guardrails |

O runtime AUTONOMOUS **não** foi migrado inteiro para a Policy Engine. As ações críticas têm teste direto em `authorizeAiAction`; o envio continua passando pelo comando e pelo last-second gate.

---

## 8. REQUIRE_CONFIRMATION

Infra mínima + uma prova:

1. POST `/api/v1/conversations/:id/ai-actions` com `move_lead_stage`
2. Verdict `REQUIRE_CONFIRMATION` → linha em `ai_action_requests`
3. Inbox mostra [Confirmar]
4. POST `/api/v1/ai-actions/:id/confirm` executa o move como humano (`crm_leads.stage_id`)
5. Segunda confirmação devolve o mesmo resultado (`idempotent: true`)

Não há confirmação para dezenas de ações. Não há `deals` novos — o card é `crm_leads`.

---

## 9. Logs

| Canal | Quando |
|---|---|
| `logger.info("ai.copilot")` | cada execução (org, conversa, modelo, tokens, dedup) |
| `logger.info("ai.action")` | pedido / confirm / deny (sem secrets) |
| `logger.info("ai.execucao")` | skip de despacho (Etapa 2) |
| `api_audit_log` | `ai_mode.config_changed`, `ai_action.confirmed` |

---

## 10. Custos medidos

Instrumentação, sem faturamento:

- `ai.copilot`: `organization_id`, `conversation_id`, `model`, `prompt_tokens`, `completion_tokens`, `timestamp`
- Tokens vêm de `runModelCall` (já grava `llm_calls`)

Nenhuma chamada de produção foi medida nesta sessão (ambiente local sem worker + LLM). O gancho está no caminho quente.

---

## 11. Arquivos alterados nesta etapa (núcleo)

**Novos**

- `lib/ai/acoes/{autorizar,pedidos,confirmar,executar,auditar}.ts`
- `lib/ai/copiloto/{schema,gerar,persistir,medir}.ts`
- `lib/agent-engine/agent/copilot-turn.ts`
- `app/api/v1/settings/ai-mode/route.ts`
- `app/api/v1/conversations/[id]/copilot/route.ts`
- `app/api/v1/conversations/[id]/ai-actions/route.ts`
- `app/api/v1/ai-actions/[id]/confirm/route.ts`
- `app/app/settings/atendimento/_ai-mode.tsx`
- `components/inbox/AssistenteIa.tsx`
- `supabase/migrations/20260907140000_0202_copilot_e_action_policy.sql`
- testes em `tests/unit/ai-*.test.ts(x)` e `tests/invariants/copilot-schema.test.ts`
- `.changes/assistente-ia-e-modo.md`

**Ligados**

- `lib/ai/execucao/politica.ts` — campos `suggestion_allowed`, `deve_enfileirar_copiloto`, `modoApresentado` (hierarquia intacta)
- `lib/channels/pos-entrada.ts` — comando deny não impede copiloto
- `lib/agent-engine/edge/crm/drain.ts` + `queue.ts` (`copilot_turn`)
- `workers/agent-worker/main.ts`
- Inbox: `CRMSidePanel`, `Composer.aplicarRascunho`, `InboxLayout`
- `lib/schemas/settings.ts`, `lib/audit/actions.ts`, `lib/navigation/registry.ts`
- mapa `docs/architecture/agent-turn.workflow.json` (nó `copilot_turn`, ≥2 arestas)

**Não tocados de propósito:** `decidirEnvioConversacional`, before-send v7, `send_intent`, `operational_moope`.

---

## 12. Migrations

Tripla 0202:

1. `supabase/migrations/20260907140000_0202_copilot_e_action_policy.sql`
2. Apêndice idempotente no `baseline.sql` (tabelas + RLS). `copilot_turn` entra no **único** bloco de `job_queue_kind_check` / `job_queue_turn_needs_contact` (não reconstrói a constraint no apêndice).
3. Linha no `MANIFEST.md`

Tabelas tenant-aware + RLS `fn_user_org_ids()` + `fn_role_at_least(..., 'agent')`. Sem função `public` nova.

`ai_mode` / `ai_action_policy` continuam jsonb em `organizations.settings` — sem migration de chave.

---

## 13. Testes

| # | Aceite | Onde |
|---|---|---|
| 1 | OFF → nenhum Copilot | `ai-copilot-gerar`, `pos-entrada`, UI Assistente |
| 2 | COPILOT inbound → pode gerar, sem envio | `pos-entrada` emite só `ai_copilot.*`; `gerar` persiste rascunho |
| 3 | Sugestão não é outbound | `gerar` não tem send; drain de copiloto usa `copilot_turn` |
| 4 | Usar resposta → composer | `assistente-ia.test.tsx` — `onUsarResposta`, sem POST de envio |
| 5 | Editar e enviar = HUMAN | Caminho existente `assumirPeloEnvioHumano` + `send_intent=human` (Etapa 1) |
| 6 | CONTROLLED `send_message` sem auth → DENY | `ai-action-policy` |
| 7 | CONTROLLED `move_lead_stage` → REQUIRE_CONFIRMATION | `ai-action-policy` |
| 8 | Humano confirma → uma vez | `ai-action-confirm` |
| 9 | Confirmação duplicada → idempotente | `ai-action-confirm` |
| 10 | AUTONOMOUS não quebra | `pos-entrada` / `drain` / `ai-execucao-politica` TESTE 4 |
| 11 | GLOBAL OFF + tenant AUTONOMOUS → efetivo OFF | `ai-action-policy` + `ai-mode-ui` |
| 12 | Assume no meio do Copilot → sem side effect | `ai-copilot-gerar` + `suggestion_allowed` com conversation deny |
| 13 | Inbound duplicado → uma sugestão | unique + `deduped` |
| 14 | Tenant A não lê B | RLS nas duas tabelas + `organization_id` da sessão nas rotas. Prova comportamental: `tests/invariants/rls-isolation.test.ts` (seed incluído). **Não rodada** — Docker ausente nesta máquina. |

---

## 14. Resultado das suites

| Suite | Resultado |
|---|---|
| `tsc --noEmit` | 0 erros |
| eslint dos arquivos novos | 0 erros (warnings de `set-state-in-effect` iguais ao painel já existente) |
| Suíte pontual Etapa 2.5 | **159/159** verde (`ai-action-*`, `ai-copilot-gerar`, `assistente-ia`, `ai-mode-ui`, `ai-execucao-politica`, `pos-entrada`, `drain`, `mapas`) |
| `evento-comando-tem-consumidor` | verde após registrar `ai_copilot.dispatch_requested` no drain |
| `pnpm test:unit` | **31 failed / 6491 passed / 1 expected fail** (12 arquivos). Ver abaixo. |
| `pnpm test:db` | **não rodado** — Docker indisponível nesta sessão |
| E2E de atendimento | não reexecutado; heading “Distribuição de atendimento” e o form de routing permanecem |

### Falhas da `test:unit` — novas vs preexistentes

**Introduzidas e corrigidas nesta etapa**

- `evento-comando-tem-consumidor` — o helper de emit escondia o literal `p_event_type: "ai_agent.dispatch_requested"`. Voltamos aos literais + consumidor do copiloto.

**Preexistentes da árvore suja (Etapas 1–2 e dívida anterior) — não mascaradas**

| Arquivo | Nota |
|---|---|
| `baseline-constraint-reconstruida` | `channel_sessions_provider_*` 2× (apêndice 0201). Não mexemos nisso. |
| `fragmentos-de-release` | frontmatter inválido em **outros** `.changes/` (`canal-hospedado-mensagens`, `ofertas-no-atendimento-locadora`). O nosso é válido. |
| `messages-handler-desfechos` | mock incompleto (`admin.from`, audit) |
| `audit-resource-id-e-uuid` | chaves naturais já na árvore |
| `branding-saida` | accent do produto |
| `canal-arquivado-caminho-de-volta` | `gravarDeclaracaoDoNumero` |
| `ingest-dedup-deixa-rastro` | âncora no fonte |
| `pacote-reserva-vaga-da-critica` | teto de pacote |
| `lib/ai/dispatcher/rate-limit.test.ts` | timeout 15s (flaky) |
| `waha-carimbo-falho` | unhandled `lib/moope/emitir.ts` |
| `ai-cases-routes` | mock de `queue` sem `ABORT_REQUESTED_PREFIX` (cadeia Etapa 2: `assumir-pelo-envio` → `invalidar-jobs`) |
| `followup-canal-arquivado` | primeira query agora é `last_error` do job (Etapa 2) |

Etapa 2 nesta mesma árvore: 30 failed / 6470 passed / 11 arquivos. Agora: +1 failed líquido no total, +2 arquivos (os dois últimos da seção preexistente), +21 passed dos testes novos. Não “consertamos” a dívida alheia para pintar verde.

---

## 15. Riscos

- Copilot gasta LLM por inbound em COPILOT/CONTROLLED. Dedup por mensagem limita, mas tenant com volume alto precisa de teto de orçamento (já existe em `runModelCall`).
- Sem agente publicado o Copilot ainda tenta o modelo default do seam — se a org não tem credencial, a geração falha visível no card, sem envio.
- `test:db` não rodou: RLS e o CHECK de `copilot_turn` no baseline não foram exercitados nesta máquina.
- CONTROLLED ainda colapsa para COPILOT em `modoEfetivo` para **envio**. A Action Policy lê `ai_mode` configurado. Misturar as duas leituras no runtime AUTONOMOUS inteiro ainda é dívida explícita.
- Polling de 8s no Inbox (sem Realtime na tabela nova).

---

## 16. Dívidas

- Migrar o runtime AUTONOMOUS para passar toda tool por `authorizeAiAction`.
- UI para editar `ai_action_policy.allow/confirm` (hoje default + PATCH da API).
- Realtime de `ai_copilot_suggestions`.
- Confirmação para mais de uma ação.
- Categorias de intenção por tenant/modelo (o envelope já é extensível).
- `test:db` + E2E do fluxo Usar resposta → enviar.
- Regenerar `lib/database.types.ts` (as rotas usam `pg` / pool, não o client tipado).

---

## 17. Recomendação para MOOPE Vendas

**Parar aqui**, como pedido.

O próximo passo pode nascer em cima disto, sem reabrir Etapa 1/2:

1. Ligar o tenant MOOPE em **CONTROLLED** (não AUTONOMOUS).
2. Estender o vocabulário de intenção (veículo, contrato, cobrança) **sem** substituir o envelope.
3. Autorizar explicitamente só o que a operação precisa (`operational_moope_action` em `allow` ou `confirm`).
4. Escrever o agente de vendas **depois** que a Action Policy já barra o que não foi autorizado.

Não começar funil comercial novo, templates Locadora/Advocacia, Automation Builder nem campanhas até o fluxo desta etapa estar verde no `test:db` e numa conversa real.

---

## Living System Checklist — Assistente IA / Action Policy

1. **Quem me alimenta?** Inbound em `pos-entrada` (`ai_copilot.dispatch_requested`) e o botão Gerar no Inbox.
2. **Quem eu alimento?** Composer do atendente (`aplicarRascunho`); `ai_action_requests` → `crm_leads` só após confirmar.
3. **Que registro emito?** `ai.copilot`, `ai.action`, `ai_mode.config_changed`, `ai_action.confirmed`.
4. **Onde apareço na tela?** Card Assistente IA no Inbox; Modo da IA em Configurações → Distribuição de atendimento.
5. **Por qual porta?** `lib/navigation/registry.ts` → `/app/settings/atendimento`. Inbox já é a porta da conversa.
6. **Anti-morte?** Sugestão é ajuda, não demanda. Se a geração falha, o card mostra o erro e o botão Gerar de novo. Envio ao cliente continua sendo gesto humano.
7. **Onde se configura?** Card Modo da IA; efetivo vs configurado quando o kill global cala.
8. **Continuidade?** IA → humano: resumo + intenção + rascunho. Humano → IA: Usar resposta / Descartar / Confirmar; envio assume a conversa (Etapa 1).
9. **Laço de retorno?** Deny e confirmação gravados em `ai.action`; modo efetivo visível quando o kill está ligado. Orçamento futuro lê `ai.copilot`.
10. **Mapa?** Nó `copilot_turn` em `agent-turn.workflow.json` com arestas `ai_policy → copilot_turn` e `copilot_turn → handoff`.
