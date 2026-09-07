# MOOPE CRM — Checkpoint 2.7: árvore saneada e commit-base

**Data:** 2026-09-07  
**Escopo:** typecheck verde, `.changes` válidos, commit único da fundação. Sem MOOPE Vendas, sem feature nova.

**BASE DA FUNDAÇÃO PRONTA PARA INICIAR MOOPE VENDAS: SIM**

---

## 1. Estado inicial

A fundação (Etapas 1 + 2 + 2.5 + Checkpoint 2.6) já estava aprovada em comportamento.

- `test:db` verde: 130 arquivos, 1005 passed, 1 expected fail, 1 skipped (install + update).
- E2E Copilot + `inbox-quem-manda` verdes.
- `pnpm typecheck` vermelho em 5 arquivos de teste.
- Dois fragmentos `.changes` com frontmatter antigo (`tipo:` em vez de `impacto`/`secao`/`titulo`).
- Working tree suja; sem commit.

---

## 2–4. Cinco erros TypeScript

Nenhum tocou runtime.

| Arquivo | Causa | Correção | Por que não muda produto |
|---|---|---|---|
| `lib/channels/idade-do-numero.test.ts` | `warmupCapFor` pede `WarmupStep[]`; `efeito.warmup_daily_caps` é `ReadonlyArray` (`WARMUP_PULADO` é `as const`). | Espalhar para array mutável: `[...(e.warmup_daily_caps ?? [])]`. | Só o argumento do teste. |
| `lib/email/templates/boas-vindas-tenant.test.ts` | Fixture sem `origens`, agora obrigatório em `MarcaDeSaida`. | `origens: { nome: "padrao", cor: "padrao" }`. | Fixture. |
| `lib/moope/cliente-locadora.test.ts` | `vi.fn(async () => …)` infere zero args; `as [string]` não sobrepõe `[]`. | Hop `as unknown as [string]` / `[string, RequestInit]`. | Cast do dublê de `fetch`. |
| `lib/webhooks/secrets.test.ts` | Mock de `rpc` só tipava `(fn: string)`; o teste lia `calls[0][1]`. | Segundo parâmetro `_params?: Record<string, unknown>` — a RPC real já recebe `{ p_value }`. | Assinatura do dublê. |
| `tests/unit/email-marca-e-remetente.test.ts` | Mesmo caso do `fetch` sem args. | `as unknown as [string, { headers; body }]`. | Cast do dublê. |

---

## 5. `.changes` corrigidos

`canal-hospedado-mensagens` e `ofertas-no-atendimento-locadora` usavam `tipo: capacidade_nova`.

Passaram a:

```
impacto: capacidade_nova
secao: adicionado
titulo: …
```

Corpo comercial intacto. `pnpm release:conferir` e `tests/unit/fragmentos-de-release.test.ts` verdes.

---

## 6. Arquivos alterados neste checkpoint

Além da fundação já existente:

- os 5 testes de typecheck;
- os 2 fragmentos;
- `tests/unit/ai-cases-routes.test.ts` — mock da fila com `importOriginal` (`ABORT_REQUESTED_PREFIX`);
- `tests/unit/followup-canal-arquivado.test.ts` — o handler relê `job_queue.last_error` antes da conversa.

Não tocou schema, Inbox, harness de DB, nem runtime de produto.

---

## 7. Typecheck

`pnpm typecheck` — **verde**.

---

## 8. Lint

Arquivos deste checkpoint: **0 erros**.

`pnpm lint` da árvore inteira: 2 erros **preexistentes**, fora do escopo:

- `hooks/channels/useSincronizarContatosDoAparelho.ts` — `react-hooks/refs`
- `scripts/retomar-june.cjs` — `require()`

304 warnings herdados. Nenhum erro novo.

---

## 9. Unit tests

Suíte pontual da fundação + typecheck + fragmentos: **18 files / 146 passed**.

`pnpm test:unit` completo: **27 failed / 6496 passed / 1 expected fail** (10 arquivos). Classificação:

### A — introduzida pela fundação (corrigida)

- `ai-cases-routes` (6): mock da fila sem `ABORT_REQUESTED_PREFIX`.
- `followup-canal-arquivado` (2): primeira query passou a ser `job_queue.last_error`.

### B — preexistente, localizada, **não** corrigida (mudaria expectativa de escrita)

- `canal-arquivado-caminho-de-volta` (5): o dublê não tem `upsert`; o onboarding grava idade do número. Acrescentar `upsert` altera a conta de escritas que o teste afirma. Fora da fundação.

### C — flaky / timeout

- `lib/ai/dispatcher/rate-limit.test.ts` (5): 15s timeout no contador em memória.

### D — dívida fora do escopo

- `audit-resource-id-e-uuid` — rotas hosted/moope `ia-credencial`
- `baseline-constraint-reconstruida` — `channel_sessions_provider_*` 2× (vocabulário Twilio, não 0202)
- `branding-saida` — accent `#1a596b` vs `#506d48`
- `ingest-dedup-deixa-rastro` — 4 caminhos 23505 vs 3
- `messages-handler-desfechos` (3) — primeiro `fetch` é `contacts/check-exists` (JID), não o send
- `pacote-reserva-vaga-da-critica` — pacote `organizar` > teto 20
- 3 unhandled em `waha-carimbo-falho` (`avisarConversaAbertaSeNova`)

Nenhuma expectativa correta foi afrouxada.

---

## 10. test:db

**Não repetido.** Este checkpoint só mexeu em testes unitários e `.changes`. Sem runtime, schema, RLS ou harness. A suíte verde do 2.6 permanece a medição: 130 / 1005.

---

## 11. E2E

**Não repetido.** Nenhum arquivo de Inbox, Copilot ou runtime mudou neste checkpoint.

---

## 12. Revisão de secrets

Diff revisado. Sem token, senha, cookie ou chave. `.env.example` / `.env.hostgator.example` só documentam `AI_EXECUTION`. Placeholders de E2E (`webhook_secret_encrypted: "e2e"`) iguais aos specs já na `main`.

---

## 13. Arquivos excluídos do commit

- `.cursor/`
- `lib/agent-engine/golden-candidates/stage-divergence_1df15a32-….json`
- `.e2e-creds.json`, `.env.e2e`, `.env.local`, `test-results/` (já no `.gitignore`)

`.gitignore` já cobre `.env*` (exceto os `*.example`) e `test-results/`.

---

## 14–15. Commit

| Campo | Valor |
|---|---|
| Branch | `main` (local, **ahead 1**, sem push) |
| Hash completo | `3f4c4382cb29073cc321238272d148f816c4f1e0` |
| Hash curto | `3f4c4382` |
| Mensagem | `feat: fundação de copiloto e automação controlada com comando humano` |
| Arquivos | 111 |
| Diffstat | +7755 / −189 |

Tag local de checkpoint **não** foi criada: a doutrina de versionamento reserva `v*` ao CI a partir da `main` remota. Quem quiser um ponteiro local: `git tag checkpoint-2.7 3f4c4382` — só na máquina, sem push.

---

## 16. Working tree depois do commit

`main` 1 commit à frente de `origin/main`.

Fora do git (proposital):

- `.cursor/`
- `lib/agent-engine/golden-candidates/stage-divergence_1df15a32-….json`

Este relatório foi atualizado com o hash depois do commit; a linha do `HEAD` no disco pode incluir esse parágrafo além de `3f4c4382`.

---

## 17. Dívidas ainda existentes

As falhas D + B + C do §9. Os 2 erros de lint preexistentes. `pnpm test:unit` completo não está verde.

LLM ao vivo / `copilot_turn` no worker: **não medido** (já declarado no 2.6).

---

## 18. Decisão

```
BASE DA FUNDAÇÃO PRONTA PARA INICIAR MOOPE VENDAS: SIM
```

Typecheck verde, fragmentos válidos, testes da fundação verdes, `test:db` e E2E do 2.6 preservados, commit-base criado, sem push.

**Não iniciar MOOPE Vendas nesta sessão.**
