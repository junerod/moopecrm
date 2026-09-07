# MOOPE CRM — Checkpoint 2.6: validação da fundação

**Data:** 2026-09-07  
**Escopo:** provar a fundação das Etapas 1 + 2 + 2.5 integrada. Sem feature nova, sem MOOPE Vendas, sem funil, template, campanha ou agente novo.

**FUNDAÇÃO LIBERADA PARA MOOPE VENDAS: SIM**

Os oito critérios de produto passaram em comportamento. O commit único **não** foi criado: `pnpm typecheck` ainda falha em arquivos preexistentes fora deste checkpoint (ver §15 e §17).

---

## 1. Ambiente utilizado

| Peça | O que era |
|---|---|
| Máquina | macOS darwin 24.6.0, Node 22.23.2, pnpm, Docker Desktop 28.1.1 |
| `test:db` | `pgvector/pgvector:pg17` efêmero (`scripts/test-db.sh`) — install + update do `baseline.sql` com `ON_ERROR_STOP=1` |
| E2E | Supabase local (`127.0.0.1:54321` / Postgres `54322`) + `pnpm e2e:env` + `pnpm e2e:build` + Playwright Chromium |
| Org de teste | seed `scripts/seed-e2e-credentials.ts` → `e2e-test-org` |

Docker estava parado no início desta sessão. Subiu o Desktop; sem isso o `test:db` da Etapa 2.5 não tinha rodado.

O `pnpm e2e:env` gravou `WAHA_API_KEY=e2e-placeholder-nao-e-segredo`. Isso poluiu o harness de invariantes (ver §12).

---

## 2. Migrations executadas

### A. Banco existente (Supabase local)

O stack local **não** tinha as tabelas 0202 nem `copilot_turn` no CHECK de `job_queue`.

Aplicado, nesta ordem, via `psql` no container `supabase_db_deskcomm-crm`:

1. `20260907140000_0202_copilot_e_action_policy.sql` — criou `ai_copilot_suggestions`, `ai_action_requests`, índices, unique, RLS, `copilot_turn`.
2. `20260904200000_0201_canal_twilio_vocabulario.sql` — o envio humano do Inbox 500ia com `column channel_sessions_1.twilio_from does not exist`. A 0202 tinha sido aplicada isolada num banco atrasado. Não é defeito da 0202; é o banco local atrás da `main`. Depois: reload do PostgREST.

### B. Banco do baseline (harness)

`pnpm test:db` aplicou `supabase/baseline.sql` em **install** e de novo em **update** (`ON_ERROR_STOP=1`). As duas passadas verdes nesta sessão, inclusive na reexecução depois do isolamento de WAHA. Sem divergência: `copilot_turn` está no único bloco de `job_queue_*` do baseline; as duas tabelas + RLS no apêndice. MANIFEST tem a linha `0202_copilot_e_action_policy`.

---

## 3. test:db

| Corrida | Resultado |
|---|---|
| Completa, árvore da 2.5 (antes dos testes de escrita RLS) | **130 files / 1000 passed** / 1 expected fail / 1 skipped |
| Completa, depois dos testes de unique + escrita RLS | 4 falhas em `automation-send-whatsapp.test.ts` (`failed` em vez de `postponed`) |
| Pontual `copilot-schema` + `rls-isolation` | **2 files / 41 passed** — unique, índices, SELECT A↛B, escrita A↛B |
| Pontual `automation-send-whatsapp` **depois** de isolar WAHA do harness | **1 file / 9 passed** |
| Completa depois do isolamento WAHA | **130 files / 1005 passed** / 1 expected fail / 1 skipped — `test:db` verde |

O que a suíte **provou** no baseline fresco:

- kind `copilot_turn` com contato aceito; sem contato o CHECK recusa;
- `ai_copilot_suggestions` / `ai_action_requests` existem com RLS;
- unique `(organization_id, conversation_id, inbound_message_id)` impede duplicata;
- índices `idx_*_org_conv` e uniques de idempotência presentes;
- user A lê 0 linhas de B e ≥1 da própria org nas duas tabelas.

A falha de `send-whatsapp` **não** era regressão das Etapas 1–2.5 no produto. `sendMessageHandler` devolveu mensagem `failed` porque o processo herdou `WAHA_API_KEY` do `.env.e2e`; o FakeQuery do invariante então quebrou em `.gte()` no aviso da Central. Erro medido: `admin.from(...).select(...).eq(...).eq(...).eq(...).gte is not a function`.

Correção (harness, não produto): `vitest.db.config.ts` zera `WAHA_API_*`; `tests/db/banco-limpo-por-arquivo.ts` apaga as mesmas chaves depois do dotenv. O arquivo congelado `tests/invariants/automation-send-whatsapp.test.ts` **não** foi alterado.

---

## 4. RLS

Não foi só catálogo. O invariante `rls-isolation.test.ts` roda como `authenticated` com `request.jwt.claims.sub`:

| Prova | Resultado |
|---|---|
| A SELECT B em `ai_copilot_suggestions` | 0 |
| A SELECT B em `ai_action_requests` | 0 |
| A SELECT A (controle positivo) | ≥1 |
| A UPDATE status=`used` na sugestão de B; superuser conta `used` em B | 0 |
| A UPDATE status=`executed` no pedido de B; superuser conta `executed` em B | 0 |
| A UPDATE na própria sugestão | ≥1 |

As rotas de API filtram `organization_id` da sessão (`requireRole`), nunca do body. Service role + filtro manual.

---

## 5. Fluxo Copilot real

Caminho medido no E2E (sugestão no formato que `copilot_turn` grava). **LLM ao vivo não rodou** neste checkpoint: o Playwright não tem credencial de modelo, e o critério era a experiência operacional.

O que a tela mostrou (org em `ai_mode=copilot`, inbound “Quanto custa o plano para uns 25 veículos?”):

| Campo | Valor visto |
|---|---|
| Resumo | “Cliente perguntou preço para cerca de 25 veículos. Ainda não recebeu proposta.” |
| Intenção | Preço · confiança Alta |
| Resposta sugerida | “Segue o valor do plano que combinamos. Posso mandar a proposta?” |
| `inbound_message_id` | a mensagem inbound semeada (unique no banco) |
| Dedup | unique + unitário `ai-copilot-gerar` (`deduped`) |

Job: `copilot_turn` aceito no schema; drain/pos-entrada cobertos na suíte pontual. Sem side effect no persistir.

Evidência: `.superpowers/evidence/inbox-assistente-ia/1-sugestao-visivel.png`

---

## 6. UI validada (descrição objetiva)

Prints em `.superpowers/evidence/inbox-assistente-ia/`:

1. **1-sugestao-visivel** — Inbox 1440px; card Assistente IA no painel direito com Resumo / Intenção / Resposta; composer vazio; comando “Automático”.
2. **2-rascunho-no-composer** — depois de **Usar resposta**, o textarea do composer contém o rascunho. Nenhuma bolha outbound.
3. **3-envio-humano** — texto editado enviado; `sent_via=user`; `bot_silenced_until` = `infinity`.
4. **4-sugestao-com-humano-no-comando** — silêncio `infinity` + nova inbound; Assistente mostra sugestão nova; zero `sent_via=ai`.
5. **5-pedido-de-confirmacao** — caixa “A IA recomenda: mover o lead de estágio?” + **Confirmar**.
6. **6-lead-movido** — depois do clique, estágio mudou.
7. **7-off-sem-sugestao** — org OFF: “Nenhuma sugestão para esta conversa.” Sem resumo.

Configurações → Distribuição de atendimento: card Modo da IA (unitário: configurado AUTONOMOUS + kill global → efetivo OFF, motivo “IA desativada globalmente.”). Não reabrimos essa tela no Playwright (o kill global é env do processo).

---

## 7. Usar resposta → enviar

`tests/e2e/inbox-assistente-ia.spec.ts` — 4/4 verde após o schema local ter `twilio_from`.

| Passo | Medido |
|---|---|
| Usar resposta | textarea `inbox-composer` = rascunho |
| Sem outbound ainda | `count(direction=outbound)` = 0 |
| Editar | valor = rascunho + “(revisado pelo atendente)” |
| Enviar | `POST /api/v1/messages` 2xx |
| HUMAN | `sent_via=user`, `sent_by_user_id` = agent E2E |
| Takeover Etapa 1 | `bot_silenced_until` casa `/infinity/` |
| IA calada | `count(sent_via=ai)` = 0 |

Não-regressão Etapa 1 no mesmo ambiente: `inbox-quem-manda.spec.ts` **2/2 verde** (Assumir → infinity → devolver).

---

## 8. CONTROLLED

| Ação | Resultado |
|---|---|
| Copilot (leitura/sugestão) | card continua no Inbox |
| `move_lead_stage` | UI **Confirmar** → estágio muda **uma** vez |
| Segunda confirmação | `POST /api/v1/ai-actions/:id/confirm` → `{ idempotent: true }`; estágio igual |
| `send_message` sem policy | `authorizeAiAction` → **DENY** (unitário) |
| `call_external_api` / `operational_moope_action` sem policy | **DENY** (unitário) |

E2E + `tests/unit/ai-action-policy.test.ts` + `ai-action-confirm.test.ts`.

---

## 9. AUTONOMOUS

Não alteramos Etapa 1.

- `inbox-quem-manda`: automático no comando → Assumir → silêncio `infinity` → last-second / motor calado → devolver.
- `before-send-comando-humano` e `pos-entrada` (AUTONOMOUS ainda enfileira `inbound_turn` quando o comando permite).
- `deve_enfileirar_turno` intacto.

---

## 10. Kill global

Unitário + UI:

- `resolveAiExecutionPolicy({ globalOff: true, tenantMode: "autonomous" })` → sem turno, sem copiloto.
- `AiModeForm`: Configurado AUTONOMOUS, Efetivo OFF, motivo “IA desativada globalmente.”

Runtime com `AI_EXECUTION=off` no processo do Playwright **não** foi religado (exigiria rebuild/restart). A política e a UI foram medidas; o kill no worker é o mesmo resolvedor.

Automações determinísticas não passam por `deve_enfileirar_turno` / `copilot_turn`.

---

## 11. MOOPE operacional

Não mexemos na regra.

`ai-execucao-intencao-handler` + `ai-execucao-politica`:

- só `send_intent=operational_moope` é a exceção;
- `integration_api`, `conversational_auto`, `webhook_source` sem intent, IA — não herdam a exceção;
- opt-out/bloqueio continua no predicado do comando / before-send.

---

## 12. Bugs encontrados

1. **E2E sem funil** — o seed de credenciais não cria pipeline. O spec agora semeia funil+etapas se faltar.
2. **`getByLabel('Mensagem')` ambíguo** — casa também “Responder a esta mensagem”.
3. **`POST /messages` 500 `twilio_from`** — banco local sem migration 0201.
4. **afterAll do `copilot-schema`** — delete de `contacts` com conversa da prova de unique.
5. **Mocks `Queryable`** — `tsc` recusa `{ rows }` sem `command`/`rowCount`. Cast nos testes 2.5.
6. **`test:db` vermelho em `automation-send-whatsapp`** — `WAHA_API_KEY` do `.env.e2e` fez o handler tentar o canal; mensagem `failed`; FakeQuery sem `.gte()` no aviso. Isolado o harness.

Nada disso enfraqueceu comando, gate, takeover, invalidação, hierarquia, `send_intent` ou `operational_moope`.

---

## 13. Bugs corrigidos (só o checkpoint)

| Correção | Onde |
|---|---|
| Funil semeado no E2E se a org não tem | `inbox-assistente-ia.spec.ts` |
| `data-testid` no composer / enviar | `Composer.tsx` |
| Seletor e `waitForResponse` do envio | spec E2E |
| afterAll apaga sugestão → mensagem → conversa → sessão | `copilot-schema.test.ts` |
| Provas de unique, índice e escrita RLS A↛B | invariantes |
| Spec no CI (`SPECS_PARTE_2`) | `.github/workflows/e2e.yml` |
| Cast `Queryable` nos dublês 2.5 | unitários |
| Isolar WAHA do harness de invariantes | `vitest.db.config.ts` + `tests/db/banco-limpo-por-arquivo.ts` |

**Não** aplicamos 0201 no repositório — só no banco local atrasado.  
**Não** editamos o invariante congelado `automation-send-whatsapp.test.ts`.

---

## 14. Suites

| Suite | Resultado |
|---|---|
| `pnpm typecheck` | **vermelho** — 5 arquivos preexistentes (ver §15) |
| eslint dos arquivos deste checkpoint | sem erro novo |
| Suíte pontual 2.5 + e2e-cobertura | verde (84, depois 29 nos arquivos recastados) |
| `test:db` install+update | verde (medido de novo na reexecução) |
| `test:db` copilot+rls | 41 passed |
| `test:db` `automation-send-whatsapp` após isolamento | **9/9** |
| `test:db` completo após isolamento | **130 files / 1005 passed** / 1 expected fail / 1 skipped |
| E2E `inbox-assistente-ia` | **4/4** |
| E2E `inbox-quem-manda` | **2/2** |
| LLM ao vivo / worker `copilot_turn` em produção | **não medido** (sem chave no e2e) |

---

## 15. Falhas preexistentes / fora do escopo

### CORRIGIDO PELO CHECKPOINT

- afterAll do schema do copiloto;
- E2E sem pipeline;
- seletor do composer;
- schema local sem 0201 (só no banco desta máquina);
- casts `Queryable` dos testes 2.5;
- isolamento de `WAHA_API_*` no harness `test:db`.

### PREEXISTENTE / FORA DO ESCOPO

`tsc` ainda vermelho em arquivos que **não** são deste checkpoint (medido nesta sessão):

- `lib/channels/idade-do-numero.test.ts`
- `lib/email/templates/boas-vindas-tenant.test.ts`
- `lib/moope/cliente-locadora.test.ts`
- `lib/webhooks/secrets.test.ts`
- `tests/unit/email-marca-e-remetente.test.ts`

`pnpm test:unit` completo **não** foi reexecutado aqui (a Etapa 2.5 já separou a dívida: ~31 failed / 6491 passed). Não mascaramos essa lista.

Outros `.changes/` inválidos (`canal-hospedado-mensagens`, `ofertas-no-atendimento-locadora`) continuam na árvore — não tocamos.

---

## 16. git diff final

Working tree suja das Etapas 1 + 2 + 2.5 + este checkpoint. `git diff --stat` nos tracked: **56 files, +1337 / −178**.

Untracked relevantes (não secretos): rotas `ai-mode` / `copilot` / `ai-actions`, `lib/ai/{acoes,copiloto,execucao}`, migration 0202, spec E2E, invariantes, `.changes` das três etapas, `docs/MOOPE_CRM_ETAPA_*` e este arquivo.

**Fora de qualquer commit futuro:** `.e2e-creds.json`, `.env.e2e`, `.env.local`, `test-results/`, `.cursor/`, `lib/agent-engine/golden-candidates/stage-divergence_*.json`.

Nenhum secret no diff das etapas. `webhook_secret_encrypted: "e2e"` é placeholder do spec, igual ao `inbox-quem-manda`.

---

## 17. Commit criado ou não

**Não.**

A cláusula 12 pedia TypeScript verde no conjunto. Os erros preexistentes do §15 impedem um `tsc --noEmit` limpo. Não forcei correção fora do fluxo Copilot/RLS/Inbox/`test:db`. Sem push.

Quando o `tsc` da árvore inteira fechar, o commit único continua sendo o pedido: Etapas 1 + 2 + 2.5 + correções deste checkpoint.

---

## 18. Decisão

```
FUNDAÇÃO LIBERADA PARA MOOPE VENDAS: SIM
```

| # | Critério | |
|---|---|---|
| 1 | Migration funciona (incremental + baseline install/update) | sim |
| 2 | RLS funciona (leitura e escrita A↛B) | sim |
| 3 | Copilot ponta a ponta no Inbox | sim (persistido; LLM e2e não chamado) |
| 4 | Envio humano assume | sim (`infinity` + `sent_via=user`) |
| 5 | IA não interfere depois | sim |
| 6 | CONTROLLED confirma uma vez / idempotente | sim |
| 7 | AUTONOMOUS não regrediu | sim (`inbox-quem-manda`) |
| 8 | Kills funcionam | sim (resolvedor + UI; env do e2e não religado) |

**Não iniciar MOOPE Vendas nesta sessão.** Próximo passo recomendado: tenant MOOPE em CONTROLLED, vocabulário de intenção de vendas por cima do envelope genérico, allow/confirm explícitos — como a Etapa 2.5 já apontou.

---

## Living System (só o que este checkpoint tocou)

O Assistente IA / Action Policy já respondeu o checklist na Etapa 2.5. Aqui só entrou a **prova**: consumidor real = composer + `crm_leads.stage_id`; tela = Inbox + evidência em `.superpowers/evidence/`; porta = Inbox já existente + `/app/settings/atendimento`.
