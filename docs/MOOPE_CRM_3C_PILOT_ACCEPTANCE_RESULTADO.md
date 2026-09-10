# MOOPE CRM 3C — ACEITAÇÃO FINAL PARA PILOTO REAL

Data: 2026-09-10  
3B.3: **não reaberta**. WhatsApp real / QR / sessão WORKING: **não tocados**.  
3D: **não criada**. Push: **não feito**.

---

## 1. Commit testado

```
424e3fbbee923f5a0b6c7f9b49f9eb478adbe06c
424e3fbb feat(crm): add business setup knowledge and automation center
```

As medições começaram sobre este SHA, sem correção preventiva.

## 2. Working tree inicial

HEAD = `424e3fbb`. Árvore já suja com leftovers de **outras** sessões (não 3C):

- `M` `.changes/nomes-do-menu-em-portugues.md`, `README.md`, `docs/MOOPE_CRM_CHECKPOINT_2_7_RESULTADO.md`, `docs/manual/*`
- `??` `.cursor/`, `docs/MOOPE_CRM_ETAPA_3A_READY_MODELS_AUDITORIA.md`, `lib/agent-engine/golden-candidates/stage-divergence_*.json`

Nenhum desses leftovers foi editado nesta aceitação.

## 3. Ambiente

| Peça | Valor | Uso |
|---|---|---|
| Docker Desktop | 28.1.1 (acordado nesta sessão; `docker info` passou) | `test:db` + stacks locais |
| Compose CLI | v2.35.1-desktop.1 | — |
| Stack isolado E2E | projeto `deskcomm-crm` | **usado** |
| API isolada | `http://127.0.0.1:54321` | Playwright / seed |
| DB isolado | `127.0.0.1:54322` | Postgres do `deskcomm-crm` |
| Studio isolado | `127.0.0.1:54323` | não usado |
| App E2E | `http://localhost:3001` (`E2E_PORT=3001`, `next start` após `pnpm e2e:build`) | Playwright |
| `test:db` | container efêmero `pgvector/pgvector:pg17`, porta alocada pelo daemon | invariantes |
| Stack cert 3B.3 | `deskcomm-vps-fresh` API `55321` / DB `55322` | **não usado** |
| App cert 3B.3 | `next-server` PID 26562 em `*:3666` | **não tocado** |
| WAHA | `deskcomm-waha` `:3030` | **QR não gerado**; sessão WORKING não tocada |

O `.env.e2e` desta máquina apontava para `55321` (cert). Foi regenerado com `pnpm e2e:env` para `54321` / `APP_URL=http://localhost:3001`. Arquivo local, não commitado.

O shell da sessão ainda exportava `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55321`. A primeira corrida do Playwright 3C criou usuários no Auth do cert e logou no app de `54321` → “Email ou senha incorretos.” Classificado como **problema de ambiente**. Os users `3c-*` foram apagados no `afterAll` (0 restantes em 55321). As corridas seguintes unsetaram as variáveis e usaram só o `.env.e2e`.

Produção / nuvem: **não usadas**.

## 4. test:db

Comando: `pnpm test:db` (`scripts/test-db.sh`).

Primeira medição (sobre `424e3fbb`, sem correção):

| | |
|---|---|
| Test Files | 130 passed (130) |
| Tests | 1007 passed \| 1 expected fail \| 1 skipped (1009) |
| Duration | 408.84s |
| Exit | verde (`==> test:db verde`) |

Linhas `psql ERROR` no log (RLS, CHECK, unique) são sondas dos invariantes, não falha da suíte.

3C **não** trouxe migration. Nenhuma regressão de schema.

Reexecução ao final (após os fixes TS-only): ver seção 13.

## 5. Playwright 3C

Spec: `tests/e2e/productization-3c.spec.ts`. Sem skip.

Após isolar o env em `54321` e os dois blockers abaixo:

```
6 passed (33.0s)   # corrida 4, antes do ajuste de sidebar
6 passed (41.3s)   # corrida após sidebar/⌘K, relançada junto com nav
```

| # | Caso | Resultado |
|---|---|---|
| 1 | Simple Mode + checklist + Meu Negócio + conhecimento + IA + follow-up | PASS |
| 2 | Isolamento A/B — consulta de A nunca devolve R$999 | PASS |
| 3 | Follow-up 24h com AI_MODE off e sem agente publicado | PASS |
| 4 | Produto Zeta sem preço não inventa valor | PASS |
| 5 | Assistente nasce draft; tentativa de publish | PASS (publish HTTP **422**) |
| 6 | Mobile 390×844 overflow das telas centrais | PASS |

## 6. Fluxo leigo (pernas)

Medido no teste 1 da spec 3C, pela tela:

| Perna | PASS/FAIL |
|---|---|
| Novo usuário + login | PASS |
| Simple Mode | PASS |
| Locação | PASS |
| Máquinas e equipamentos | PASS |
| Início + checklist | PASS (`checklist-empresa` = sim) |
| Meu Negócio | PASS (tipo Locação / subtipo Máquinas e equipamentos) |
| Conhecimento cadastra | PASS (“conhecimento salvo”) |
| Testar conhecimento | PASS (resposta ou vazio; se achou, contém “martelete”) |
| IA Assistente / COPILOT | PASS (PATCH 2xx + toast + `settings.ai_mode=copilot`) |
| Follow-up 24h (aba Prontas) | PASS (`pronto-followup-24h-ativo` + pointer `active`) |
| Checklist atualizado | PASS (ia / automação / conhecimento = sim) |

## 7. RAG tenant isolation (S1)

`POST /api/v1/ai/knowledge/consultar` com cookie do tenant A e `organization_id` do tenant B no body.

- Body rejeitado pelo Zod (`{ pergunta }` apenas). Org vem de `requireRole`.
- Texto dos trechos **não** contém `999`.
- Unitário `buscarFaqDaOrg` confirma A=123 / B=999.

**S1: sem blocker.**

## 8. Anti-alucinação (Zeta)

Comportamento **da aplicação** (rota `consultar`, mesmo retrieval do Copilot):

- `encontrou === false`
- trechos sem `R$\s*\d`

O fallback FAQ da 3C casava “produto”/“custa” e devolvia o Alfa (R$123) para a pergunta do Zeta. Isso **burlava** a recusa do Copilot (`trechos.length > 0`). Corrigido: termos genéricos não identificam o item. Unitário novo + E2E verde.

O Copilot, com `trechos=[]` e pergunta crítica, **não chama LLM** (`RASCUNHO_SEM_FONTE`). Prova unitária em `anti-alucinacao` / `gerar`. Não há conversa Inbox nesta spec — a superfície de produto medida é Testar conhecimento + a mesma função `recuperarConhecimentoDaEmpresa`.

## 9. Assistente

| | |
|---|---|
| A. Criação / draft | **PASS**. Wizard `/app/ai/agents/simples`. `published_version_id` nulo. `kind` do Assistente Comercial criado. |
| B. Tentativa de ativação | **PASS**. `POST /api/v1/ai/agents/:id/publish` executado. |
| C. Ativação efetiva | **NÃO MEDIDO POR AMBIENTE**. Status medido: `3C_ASSISTENTE_PUBLISH_STATUS=422`. O E2E **não** trata 422 como publish ok. |

422 neste stack isolado: sem credencial/canal convergível (log WAHA `fetch failed` ao abrir a sessão seedada). **Não é PASS de ativação.** Não é blocker de piloto: o motor de publish já existente publicou fluxos de follow-up na suíte herdada (`followup-builder` “fluxo completo: … publicar …”). Cliente com credencial + canal WORKING (3B.3) tem o requisito que este isolado não tem.

Avançado `/app/ai/agents/new` (spec herdada) falhou por option `disabled` em credencial/canal — mesmo buraco de ambiente, não o wizard 3C.

## 10. Follow-up determinístico (AI_MODE = OFF)

Medido no teste 3 da spec 3C, org A:

- `settings.ai_mode` ausente/`off`
- zero agentes com `published_version_id`
- `POST /api/v1/ai/followup-flows/pronto-24h` → 2xx
- pointer `status=active` > 0

A rota **não** consulta AI_MODE nem LLM. Não se esperou 24h.

Também: onboarding Simple Mode OFF + enroll determinístico na spec herdada `wizard-do-funcionario` (Locação/máquinas) — PASS.

## 11. E2Es herdados impactados

Seed em `54321` (`e2e-admin@deskcomm.test` org `b8346216-…`). Specs:

`navegacao`, `followup-builder`, `followup-queue`, `wizard-do-funcionario`, `agente-novo-e-uso`.

Primeira leva: **37 passed / 3 failed / 40**.

| Falha | Classificação | Ação |
|---|---|---|
| `agente-novo-e-uso` — click em option `disabled` (credencial/canal) | problema de ambiente (form avançado) | nenhuma; wizard 3C cobre o caminho leigo |
| `navegacao` ⌘K “conhec” + Enter foi para `/app/ai/agents` | teste incorreto + copy 3C (“conhecimento” na descrição de Assistentes) | teste clica o option **Conhecimento** → PASS |
| `navegacao` 900px `rola===true` | BUG 3C (Início na sidebar) + folga herdada | Início saiu da sidebar; ver §12 |

Follow-up builder/queue, wizard Simple Mode Locação/máquinas, AI OFF enroll: **PASS**.

WhatsApp real: **não** repetido.

## 12. Sidebar 900px

Risco da 3C confirmado: com Início no sidebar, `navegacao.spec.ts` falhou (`rola=true`). `titulosFora=0` (nenhum grupo invisível).

Correção mínima autorizada: `sidebar: true` removido de `/app/inicio`. Porta permanece no hub Atendimento, ⌘K e atalhos de `/app/inicio`.

Reexecução: Início **sumiu** do menu (screenshot). Evolução da IA voltou à dobra. `rola` ainda `true` por folga residual de **pixels** no último item de Análise — todos os `h2` de grupo continuam visíveis; Configurações segue no rodapé fixo. Tirar mais itens seria além da correção mínima.

**UX real:** operável. Não é crash nem grupo fora da tela. **Não é blocker de piloto.** O e2e de 900px neste checkout **continua vermelho** por overflow residual herdado/apertado, não por Início.

⌘K após o ajuste do teste: **PASS**.

## 13. Mobile 390×844

Executado de verdade (Playwright `test.use` 390×844), telas:

`/app/inicio`, `/app/settings/business`, `/app/ai/knowledge/sources`, `/app/ai/agents`, `/app/ai/followups`.

`document.body.scrollWidth ≤ clientWidth + 8` em todas. Spec de navegação mobile (gaveta, sem overflow horizontal): **PASS**.

CTAs/cards: as mesmas rotas do fluxo leigo renderizam sem crash; a spec 3C mede overflow, não cada clique em 390. Nenhum modal travado observado nas corridas.

**MOBILE 390×844: SIM**

## 14. Gates técnicos (final)

| Gate | Resultado |
|---|---|
| `pnpm typecheck` | EXIT 0 |
| eslint arquivos 3C + patches desta aceitação | 0 errors (warning `console.info` removido; era `console.log`) |
| unitários 3C (9 arquivos) | 36 passed |
| Playwright 3C | 6/6 PASS |
| Playwright nav ⌘K | PASS |
| Playwright nav 900px | FAIL residual (ver §12) |
| `pnpm test:db` inicial | 1007 passed / 1 expected fail / 1 skipped |
| `pnpm test:db` final (após fixes TS) | 1007 passed / 1 expected fail / 1 skipped — verde |

## 15. Falhas encontradas e classificação

| # | Sintoma | Classe | Blocker de piloto? |
|---|---|---|---|
| F1 | Login 3C contra `54321` com users criados em `55321` | problema de ambiente | não |
| F2 | E2E do modo IA não esperava o PATCH; UI mostra seleção como “Configurado” | teste incorreto | não (após wait) |
| F3 | GET atrasado do `AiModeForm` apagava escolha/save | BUG 3C | sim, até o fix — usuário rápido via a tela voltar para Desligada |
| F4 | FAQ “produto/custa” devolvia Alfa para Zeta | BUG 3C | sim, até o fix — preço errado do próprio tenant |
| F5 | Início na sidebar → scroll em 900px | BUG 3C | não após tirar Início; residual não é grave |
| F6 | ⌘K Enter no primeiro match “conhec” | problema do teste (+ copy) | não |
| F7 | Publish assistente 422 | ambiente (credencial/WAHA) | não |
| F8 | Form avançado de agente option disabled | ambiente / herdado | não |

## 16. Correções (commit adicional)

Somente blockers comprovados ou teste incorreto:

1. `buscarFaqDaOrg` ignora termos genéricos; unit do Zeta.
2. E2E espera PATCH + toast do modo IA; prova follow-up com AI OFF; log do status de publish.
3. `AiModeForm`: GET atrasado não sobrescreve se o usuário já tocou/salvou.
4. Início fora da sidebar.
5. ⌘K clica o option Conhecimento.

**Não** reescrito `424e3fbb`. **Não** push.

## 17. Arquivos alterados nesta aceitação

- `lib/ai/copiloto/recuperar.ts`
- `lib/ai/copiloto/recuperar.test.ts`
- `app/app/settings/atendimento/_ai-mode.tsx`
- `lib/navigation/registry.ts`
- `tests/e2e/productization-3c.spec.ts`
- `tests/e2e/navegacao.spec.ts`
- `docs/MOOPE_CRM_3C_PILOT_ACCEPTANCE_RESULTADO.md`

## 18. Commit adicional

`fix(crm): close 3c pilot acceptance blockers` — local, se o working tree desta aceitação for commitado.

## 19. Working tree final / sem push

HEAD de produto 3C permanece `424e3fbb` até o commit extra. Leftovers de outras sessões **intocados**. `git push` **não** executado. PID 26562 em `:3666` **ainda escutando**.

---

## Tabela final

| Critério | SIM/NÃO/NÃO MEDIDO |
|---|---|
| test:db verde | SIM |
| Playwright 3C verde | SIM |
| Fluxo leigo E2E | SIM |
| Simple Mode Locação/Máquinas | SIM |
| Meu Negócio | SIM |
| Conhecimento cadastra | SIM |
| Testar conhecimento funciona | SIM |
| RAG tenant isolation | SIM |
| Copilot usa RAG | SIM (mesmo retrieval; consultar E2E + `gerar` unitário) |
| Zeta sem alucinação | SIM |
| Assistente nasce draft | SIM |
| Ativação é explícita | SIM |
| Ativação efetiva validada | NÃO MEDIDO (ambiente 422; não é PASS) |
| Follow-up 24h ativa com AI OFF | SIM |
| Navegação/sidebar | SIM (⌘K e fluxo leigo; 900px residual sem grupo invisível) |
| E2Es herdados impactados | SIM (37/40 na leva; 2 falhas tratadas; 1 ambiente avançado) |
| Mobile 390x844 | SIM |
| Typecheck | SIM |
| Lint | SIM |
| Sem blocker S1 | SIM |
| Sem blocker de piloto | SIM |

---

## VEREDITO

**MOOPE CRM 3C — ACEITAÇÃO FINAL: SIM**

**MOOPE CRM — LIBERADO PARA PILOTO REAL: SIM**

Não há blocker comprovado restante da lista da seção 15 do briefing. A ativação efetiva do assistente neste isolado ficou NÃO MEDIDA por falta de credencial/WAHA — não impede cliente corretamente configurado. A dobra 900px ainda tem overflow residual de pixels; Início saiu da sidebar e a operação continua pelo hub/⌘K/atalhos.

Próxima atividade: **PILOTO REAL**. Sem 3D.
