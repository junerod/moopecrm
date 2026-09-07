# MOOPE CRM — Etapa 3B.1: fechamento do Ready Models MVP para piloto

**Data:** 2026-09-07  
**Tipo:** correção de arquitetura no gate de follow-up + E2E obrigatório do Simple Mode. Sem push. Sem Etapa 3C. Sem RAG no Copilot. Sem vertical novo. Sem migration.  
**Commit-base (3B, não reabrir):** `1d1c8c53f98cf70bf20b8eb419c08417f79495f3`  
**Relatório 3B:** `docs/MOOPE_CRM_ETAPA_3B_READY_MODELS_MVP_RESULTADO.md`

Arquitetura aprovada na 3B permanece:

```
READY MODEL → definition como dado → instalador genérico → cópia para tenant → core normal
```

---

## 1. Resumo executivo

O toggle do Simple Mode (“lembrar automaticamente clientes que pararam de responder”) instalava um follow-up determinístico de 24h, mas o enrollment automático ainda exigia agente publicado. Com `AI_MODE=off` o wizard não publica agente — o lembrete ficava inerte.

A correção classifica o **grafo**, não o Ready Model nem o `ai_mode`:

- fluxo sem nó de IA → enrolla sem agente; envio de `action`/`template` passa pelos send gates existentes, sem LLM;
- fluxo com `ai_classify`, `wait` `smart` ou `action`/`ai_message` → continua exigindo agente publicado.

O E2E do wizard, que a 3B atualizou e não rodou, foi executado de verdade nesta etapa: Serviços/COPILOT, Locação/máquinas/OFF + enrollment sem agente, e Advocacia/OFF.

**MOOPE CRM READY MODELS LIBERADO PARA PILOTO REAL: SIM**

---

## 2. Commit inicial

`1d1c8c53f98cf70bf20b8eb419c08417f79495f3` — `feat(crm): add generic ready models and simple onboarding`

Branch: `main`. Sem reset, sem force, sem push.

Working tree no início desta etapa (sujeira **prévia**, não incorporada):

- `M docs/MOOPE_CRM_CHECKPOINT_2_7_RESULTADO.md`
- `?? .cursor/`
- `?? docs/MOOPE_CRM_ETAPA_3A_READY_MODELS_AUDITORIA.md`
- `?? lib/agent-engine/golden-candidates/stage-divergence_1df15a32-dea2-41e9-83bf-e3c34c9c1766.json`

3A / 3B / 2.7 foram preservados no estado em que estavam.

---

## 3. Causa do gate de agente

`lib/followup/agent-followup-gate.ts` nasceu porque o follow-up era uma **capacidade do agente**:

1. um `ai_agent_versions` publicado com `followup.enabled=true` e o pointer em `followup.flow_pointer_ids` “armava” o fluxo;
2. `resolveAgentForAutomaticTrigger` pinava `agent_id` no enrollment (persona / fila);
3. o grafo originalmente podia (e ainda pode) conter nós que chamam LLM.

Enrollment **manual** (`POST /api/v1/ai/followups/enrollments`) já pulava este gate. O automático não.

Não havia motivo de segurança para um template fixo exigir agente: blocked, opt-out, comando da conversa, human takeover, closed/archived, send gate, last-second reload, invalidação de job, cancelamento por reply e won/lost já vivem **depois** do enrollment, no caminho de envio. Exigir agente no enrollment de um grafo só de template era acoplamento indevido, não defesa.

---

## 4. Callers auditados

Produtores automáticos (os três passaram a classificar o grafo):

| Caller | Papel |
|---|---|
| `lib/followup/silence-sweep.ts` | silêncio time-driven (`trigger_config.kind=silence`) — caminho do Ready Model 24h |
| `lib/followup/gatilho-etapa.ts` | `lead.stage_changed` |
| `lib/followup/gatilho-caso.ts` | caso aberto/fechado |

Ainda usam `resolveAgentForAutomaticTrigger` para o **pin** opcional. A decisão de enrollar é `decidirArmacaoAutomatica(graph, agentId)`.

`isPointerEnabledForAutomaticTrigger` permanece como gêmeo booleano (testes de query real contra `ai_agent_versions`). Enrollment manual não foi alterado.

Adapters de invariante atualizados: `followup-silence-sweep`, `followup-gatilho-etapa`, `followup-agendamento-do-banco`, `followup-reenrollment-apos-conclusao`.

---

## 5. Classificação flow determinístico vs IA

`lib/followup/fluxo-requer-ia.ts` — derivado do grafo publicado, nunca de `if locacao` / `if readyModel` / `if ai_mode`.

Nodes do graph (`lib/followup/graph-schema.ts`): `trigger`, `wait`, `condition`, `ai_classify`, `action`, `end`.

**Requer IA:**

- `ai_classify`
- `wait` com `mode: "smart"`
- `action` com `mode: "ai_message"`

**Determinístico** (seed do Ready Model: trigger → action `template` → end):

- `trigger`, `wait` `fixed`, `condition`, `action` `template`, `end`

`decidirArmacaoAutomatica`:

- grafo com IA + sem agente → recusa;
- grafo determinístico + sem agente → libera, `agent_id` pode ser `null`.

---

## 6. Alteração implementada

1. Classificação do grafo + decisão de armação automática.
2. Os três produtores carregam o fluxo publicado (`FluxoPublicado`) em vez de só o id do nó trigger.
3. `turnPayloadExtras` de action `template` agora leva `template_id` + `mode: "template"`.
4. Turno dirigido por fluxo com `purpose: send_message` + `template_id` envia o corpo de `message_templates` via `runBeforeSend` — **sem** `runAgentTurn`.
5. Se handoff / job invalidado / veto, o enrollment **não** é `complete({ kind: 'sent' })`.

Nenhuma ramificação por Ready Model id. Nenhuma migration.

---

## 7. Por que não cria bypass

O que saiu foi só a exigência de **agente publicado no enrollment** de grafo sem IA.

O envio de template ainda passa por:

- `isLeadInHandoff` (`force_human` / `bot_silenced_until`);
- `jobFoiInvalidado`;
- canal arquivado (dead-letter antes do turno);
- `contact.is_blocked` → `optedOutThisTurn` → `runBeforeSend`;
- comando da conversa / send gates da cadeia existente;
- last-second reload e sink idempotente (`sendTurnMessage`);
- reatividade: reply, won, lost, handoff.

Não há atalho `if ai_mode === off`. OFF não desliga a automação determinística; também não desliga os gates.

---

## 8. Comportamento OFF

Caso obrigatório exercitado no E2E: Locação / máquinas / `ai_mode=off` / follow-up SIM / zero `ai_agents`.

Cliente silencioso (inbound atrasado 26h no harness) → tick do cron `followup-flow-worker` → 1 enrollment `active` com `agent_id` null → zero `ai_agent_runs`.

Nenhum LLM no caminho de template. Nenhum agente precisa existir.

---

## 9. COPILOT

O spec serial do wizard (Serviços) escolhe Assistente IA, grava `ai_mode=copilot`, zero agentes. Follow-up determinístico não vira resposta do Copilot: o Copilot continua resumo / intenção / sugestão (`copilot-turn` / `gerar.ts` intocados nesta etapa). A decisão de enrollar **não lê** `ai_mode` (teste E).

---

## 10. CONTROLLED

Follow-up determinístico não consulta Action Policy da IA — não é decisão da IA.

O envio automático usa o sink existente: `enviarCorpoDeterministico` → `runBeforeSend` → `channel.send` → `sendTurnMessage` → `sendMessageHandler`. O handler recebe `actor.type: 'ai_agent'` sem `send_intent`; `resolverIntencaoDeEnvio` resolve **`conversational_auto`**. Os send gates conversacionais (comando da conversa inclusive) continuam no caminho.

---

## 11. AUTONOMOUS

Não alterado. Fluxo com nó de IA continua exigindo agente publicado e cai em `runAgentTurn` / classify / plan_timing. Autonomia não foi ampliada.

---

## 12. Human takeover

`sendFlowTemplateThroughGates` consulta `isLeadInHandoff` **antes** de carregar o template. Handoff → `skipped`, sem `runAgentTurn`, sem `complete(sent)`.

Prova: `tests/unit/followup-template-sem-llm.test.ts` (D/F). A proteção de `bot_silenced_until = infinity` permanece.

---

## 13. Reply cancellation

`lib/followup/reactivity.ts` — `message.received` + `cancel_on_reply` → cancela. Engine preservada. Invariantes de reatividade verdes no `test:db`.

---

## 14. Won / lost

Cancelamento genérico da 3B (`lead.won` / `lead.lost`) preservado. Provas: `tests/unit/followup-lead-fechado.test.ts` + invariantes de reatividade. Independente de `ai_mode`.

---

## 15. Channel archived

Guarda existente no `followup_turn` (dead-letter antes do turno) aplica-se também ao payload de template. Prova: caso J em `followup-template-sem-llm.test.ts` + `tests/unit/followup-canal-arquivado.test.ts`.

---

## 16. Blocked / opt-out

`enviarCorpoDeterministico` lê `contact.is_blocked` e passa `optedOutThisTurn` para `runBeforeSend`. O sink do handler também recusa blocked. Sem remoção desta camada.

---

## 17. Idempotência

Ready Model reaplicado continua no-op do pointer (`rm:<id>:silencio-24h` / `garantirFollowup`). O sweep respeita `idx_followup_enrollments_one_live`. Sem recriação de follow-up nesta etapa.

---

## 18. E2E ambiente

Harness existente. Sem harness novo.

- `.env.e2e` apontando para Supabase local (`http://127.0.0.1` / localhost); health `/auth/v1/health` = 200;
- `pnpm build` (Next 16.3.1) + `next start` na porta 3001 (`reuseExistingServer: false`);
- Playwright, 1 worker, Chromium;
- Redis do rate-limit de login **não** estava acessível (`fetch failed` → fallback in-memory). Não impediu o wizard.

`tests/e2e/vps-fresh-onboarding.spec.ts` **não** foi executado: está em `FORA_DO_CI` porque exige WAHA + Redis + Resend + Nuvemshop. Neste ambiente o Redis já falhou no rate-limit; rodar a jornada VPS sem esses serviços não seria prova — seria falso verde ou vermelho de harness.

---

## 19. E2E Locação / Máquinas

Org nova → Locação → Máquinas e equipamentos → pular WhatsApp → routing default → visualizar pipeline (`Cotação / Proposta`, `Fechamento`) → follow-up SIM → Sem IA → CRM.

Banco:

- `perfil_do_negocio.id=locacao`, `version=1.0`, `subtype=maquinas_e_equipamentos`;
- pipeline `Atendimento`; field `item_tipo` label **Equipamento**;
- `ai_mode=off`;
- zero `ai_agents`;
- pointer `rm:locacao:silencio-24h` existe.

**PASSOU** (8.6s).

---

## 20. E2E follow-up sem agente

Mesma org OFF. Contato + conversa com `last_inbound_at` há 26h. POST `/api/v1/cron/followup-flow-worker` (Bearer `INTERNAL_SECRET` do `.env.e2e`). Sem sleep de 24h.

Resultado: 1 enrollment `active`, `agent_id` null, zero `ai_agent_runs`.

**PASSOU** (419ms).

---

## 21. E2E Advocacia

Org nova → Advocacia → Sem IA → finalizar.

- `perfil.id=advocacia`, pipeline `Novos clientes` (Triagem / Contratação);
- field `area_juridica` presente, `item_tipo` ausente;
- zero pointers `*locacao*`;
- zero `moope_connections`;
- zero `ai_agents`.

**PASSOU** (8.9s).

---

## 22. Testes unitários

| ID | Prova |
|---|---|
| A | `fluxoRequerIa(grafoDeterministico()) === false`; sweep/gatilho enrollam sem agente |
| B | `ai_classify` / `ai_message` / `wait smart` exigem agente; invariante silence + etapa com `grafoComIa()` |
| C | sweep determinístico sem agente → `enrolled=1`, `agent_id=null` |
| D | `turnPayloadExtras` template sem `prompt_hint`; handler template + handoff não chama `runAgentTurn` |
| E | `decidirArmacaoAutomatica` / sweep não leem `ai_mode` |
| F | `isLeadInHandoff` no caminho de template → skip, sem complete sent |
| G | reatividade `cancel_on_reply` — suíte existente, `test:db` verde |
| H | `lead.won` cancela — `followup-lead-fechado` + invariantes |
| I | `lead.lost` cancela — idem |
| J | canal arquivado dead-letter também com payload de template |
| K | `is_blocked` → `runBeforeSend`; invariantes de STOP/blocked |
| L | `ready-models-arquitetura` varre `fluxo-requer-ia`, sweep, gatilhos, gate, `followup-turn` |

---

## 23. typecheck

`pnpm typecheck` — **verde** (`tsc --noEmit -p tsconfig.typecheck.json`).

---

## 24. lint

`eslint` nos arquivos alterados desta etapa — **0 errors**. 1 warning pré-existente de estilo (`import()` type) no teste novo, igual ao padrão de `followup-canal-arquivado.test.ts`. Sem correção cosmética.

---

## 25. test:unit

`pnpm test:unit`: **8 files failed / 590 passed** (598 arquivos); **19 failed / 6568 passed / 1 expected fail**.

Os 8 arquivos vermelhos são **os mesmos herdados da 3B/fundação**. Nenhum arquivo tocado por 3B.1 falhou. Ver §29.

Suíte dirigida 3B.1 + Ready Models: **9 files / 68 tests passed**.

---

## 26. test:db

`pnpm test:db` — **obrigatório e verde**.

- 130 arquivos passed
- 1007 passed / 1 expected fail / 1 skipped
- install + update do `baseline.sql` no `pgvector/pgvector:pg17`

(A 3B mediu 1005 passed; a diferença são os casos novos de grafo determinístico vs IA nos invariantes de silence/etapa.)

---

## 27. E2E

`pnpm test:e2e tests/e2e/wizard-do-funcionario.spec.ts`

**13 passed (58.3s).** Inclui o spec serial Serviços/COPILOT da 3B e as variantes Locação/OFF e Advocacia/OFF.

`vps-fresh-onboarding.spec.ts` não rodou — ver §18.

Não se pintou de verde: nenhuma assertion correta removida, nenhum timeout inflado, nenhum teste desligado.

---

## 28. Bugs reais encontrados / corrigidos

O defeito desta etapa era o da auditoria 3B:

1. enrollment automático de grafo determinístico exigia agente publicado;
2. mesmo após enrollar, `purpose: send_message` do fluxo sempre chamava `runAgentTurn` — o template do grafo nem ia no payload (`turnPayloadExtras` só tratava `ai_message`).

Os dois foram corrigidos. O E2E do wizard **não** revelou defeito novo de tela.

---

## 29. Falhas herdadas

Idênticas à 3B. Nenhum arquivo desta lista foi tocado para “ficar verde”:

| Arquivo | Falhas | Nota |
|---|---|---|
| `baseline-constraint-reconstruida.test.ts` | 1 | varredura de constraint |
| `ingest-dedup-deixa-rastro.test.ts` | 1 | âncora no fonte do ingest |
| `audit-resource-id-e-uuid.test.ts` | 1 | chave natural em coluna uuid |
| `pacote-reserva-vaga-da-critica.test.ts` | 1 | teto de pacote |
| `branding-saida.test.ts` | 2 | marca/hex |
| `canal-arquivado-caminho-de-volta.test.ts` | 5 | onboarding/canal |
| `messages-handler-desfechos.test.ts` | 3 | handler de mensagens |
| `lib/ai/dispatcher/rate-limit.test.ts` | 5 | Redis MISCONF / flaky |

3 unhandled rejections: `tests/unit/waha-carimbo-falho.test.ts` (mock incompleto em `lib/moope/emitir.ts`). Não introduzido aqui.

---

## 30. Migrations

**Nenhuma.** A classificação cabe no grafo já persistido em `followup_flow_versions.graph`.

---

## 31. Arquivos alterados

Novos: `lib/followup/fluxo-requer-ia.ts`, `fluxo-fixtures.ts`, testes de classificação/sweep/payload/template, `docs/MOOPE_CRM_ETAPA_3B_1_PILOTO_RESULTADO.md`.

Modificados: produtores (silence/etapa/caso), `engine.ts`, `followup-turn.ts`, `agent-followup-gate.ts` (comentário + papel), cron `followup-flow-worker` (comentário), invariantes, `wizard-do-funcionario.spec.ts`, `ready-models-arquitetura.test.ts`.

Não entram no commit: `.cursor/`, golden candidate, `docs/MOOPE_CRM_ETAPA_3A_READY_MODELS_AUDITORIA.md`, `docs/MOOPE_CRM_CHECKPOINT_2_7_RESULTADO.md`.

---

## 32. Diffstat

22 files changed, 1406 insertions(+), 114 deletions(-) — incluindo este relatório.

---

## 33. Commit / hash

Mensagem: `fix(crm): enable deterministic follow-ups without ai agent`

O hash é o `HEAD` após o commit único desta etapa (`git log -1 --format='%H %s'`). **Não houve push.**

---

## 34. Working tree

Após o commit, o que deve sobrar é só a sujeira prévia (§2). Conferir com `git status`.

---

## 35. Confirmação de push

**Não houve push.** Nenhum `git push` nesta etapa.

---

## 36. Riscos restantes

- `vps-fresh-onboarding` continua fora do CI e não foi rodado aqui. A jornada de instalação com WAHA real ainda não tem gate nesta máquina.
- Classify/promessa semântica no `runBeforeSend` **pode** chamar LLM se a org ligou essa camada de send-gate. Isso é gate de envio, não follow-up de IA. OFF não desliga essa camada se ela estiver ligada na org.
- Fluxo legado F3-04 (`payload.mode=template` sem `followup_enrollment_id`) continua no pointer de reentry-template do tenant, não no `message_templates.id` do grafo. O caminho novo do Ready Model é o dirigido por fluxo.
- `test:unit` da árvore inteira ainda carrega as 8 falhas herdadas.

---

## Respostas explícitas

| Pergunta | Resposta |
|---|---|
| FOLLOW-UP DETERMINÍSTICO FUNCIONA COM AI_MODE OFF | **SIM** |
| FOLLOW-UP DETERMINÍSTICO EXIGE AGENTE PUBLICADO | **NÃO** |
| FOLLOW-UP QUE USA IA CONTINUA PROTEGIDO | **SIM** |
| HUMAN TAKEOVER CONTINUA BLOQUEANDO ENVIO AUTOMÁTICO | **SIM** |
| WON/LOST CANCELA FOLLOW-UP | **SIM** |
| READY MODEL LOCAÇÃO/MÁQUINAS PASSOU E2E | **SIM** |
| READY MODEL ADVOCACIA PASSOU E2E | **SIM** |
| WIZARD NÃO PUBLICA AGENTE IMPLICITAMENTE | **SIM** |
| FUNDAÇÃO 1/2/2.5 CONTINUA PRESERVADA | **SIM** |

---

## Conclusão

**MOOPE CRM READY MODELS LIBERADO PARA PILOTO REAL: SIM**

A ressalva da 3B (toggle inerte sem agente + E2E não executado) está fechada. As falhas herdadas de `test:unit` e a spec VPS fresca fora do CI **não** bloqueiam este veredito — o E2E principal do Simple Mode passou, o runtime de follow-up foi exercitado no `test:db`, e o caminho OFF sem agente enrollou de verdade.

**STOP.** Não iniciar 3C. Não ligar RAG no Copilot. Não criar vertical. Não fazer push. Esperar revisão de engenharia.
