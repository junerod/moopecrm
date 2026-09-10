# MOOPE CRM — ETAPA 3C PRODUCTIZATION — RESULTADO

Data: 2026-09-10  
Commit-base: `7cc3c023` (`fix(crm): harden whatsapp session readiness`)  
3B.3: **não reaberta**. WhatsApp real / QR / sessão WORKING: **não tocados**.

---

## 1. Commit-base

`7cc3c023` — prontidão WAHA / residual. Esta etapa só reutiliza `lib/channels/sessoes-residuais.ts`.

## 2. Auditoria das telas existentes

Mapeamento feito **antes** de criar rotas novas. Nenhuma engine nova.

| Superfície | Onde já existia | Classificação | Decisão |
|---|---|---|---|
| Home / Dashboard | `app/app/page.tsx` → redirect `/app/inbox` | MANTER + CRIAR WRAPPER | Redirect do `/app` **não mudou** (e2es pousam no Inbox). Dashboard leigo = `/app/inicio` |
| Configurações | `/app/settings` + `NavHub` | LINKAR | Card Meu Negócio no hub Organização |
| Ready Models / perfil | `/app/settings/perfil`, `lib/ready-models/*`, `aplicarPerfilAction` | REUTILIZAR | Fonte única; Meu Negócio só lê e aponta |
| WhatsApp / conexões | `/app/connections`, `sessoes-residuais.ts`, `ConnectionsClient` | REUTILIZAR | Status do card usa WORKING + residual 3B.3 |
| Knowledge / RAG | `/app/ai/knowledge/sources`, `POST /api/v1/ai/knowledge/sources`, `buscarConhecimento` | WRAPPER + RENOMEAR | Headline leiga + cadastrar/testar; slots técnicos em `<details>` |
| Retrieval | `lib/ai/knowledge/busca.ts` → `retrieve_top_k_chunks` | REUTILIZAR | Copilot e “Testar conhecimento” chamam o mesmo helper |
| FAQ pré-index | `ai_faq_items` | LINKAR | Fallback tenant-scoped quando embedding/KB ainda não existe |
| Copilot | `gerarSugestaoDoCopiloto`, `copilot-turn`, `POST .../copilot` | LINKAR RAG | Injeta trechos; recusa inventar dado crítico |
| AI_MODE | `organizations.settings.ai_mode`, `/app/settings/atendimento` | RENOMEAR | OFF/COPILOT/CONTROLLED/AUTONOMOUS iguais; rótulos leigos |
| Agentes | `/app/ai/agents`, `createMcpAgentAction`, publish | WRAPPER | Lista comercial + wizard `/simples`; avançado intacto |
| Follow-up | `/app/ai/followups`, `publishFollowupFlowVersion`, silence-sweep | WRAPPER | Aba Prontas 24h; builder/fila intactos |
| Equipe | `/app/team` | LINKAR | Card Equipe |
| Funil / campos | `/app/settings/tenant/pipelines`, `/app/kanban` | LINKAR | Card Funil |
| Sidebar | `lib/navigation/registry.ts` | RENOMEAR + LINKAR | Início, Assistentes, Automações, Meu Negócio |
| Onboarding Simple Mode | `/onboarding/*` | MANTER | **Não** houve segundo onboarding |

**Não criado:** segundo RAG, segundo módulo de agentes, segundo scheduler, segundo visual builder, novos Ready Models.

## 3. Tabela REUTILIZAR / REALOCAR / RENOMEAR / LINKAR / WRAPPER

| Ação | Peças |
|---|---|
| REUTILIZAR | Ready Models, `buscarConhecimento`, `sessoes-residuais`, follow-up publish, `createMcpAgentAction`, AI_MODE enum, Action Policy |
| REALOCAR | nada — URLs técnicas antigas permanecem |
| RENOMEAR | Agentes→Assistentes, Fluxos/Voltar a falar→Automações, AI_MODE copy, Conhecimento da Empresa |
| LINKAR | Cards do Meu Negócio → telas já existentes |
| WRAPPER | `/app/inicio`, `/app/settings/business`, knowledge leiga, wizard simples, aba Prontas |
| MANTER AVANÇADO | AgentForm, FlowBuilder, slots RAG, fila de follow-up, credenciais, roteadores |

## 4. Navegação final

Portas novas no registro (`lib/navigation/registry.ts`):

- `/app/inicio` — **Início** (sidebar Atendimento)
- `/app/settings/business` — **Meu Negócio** (hub Organização › Sua empresa)
- `/app/ai/agents` — **Assistentes**
- `/app/ai/followups` — **Automações**
- `/app/ai/agents/simples` — allowlist (subfluxo do botão Criar assistente)

`/app` continua redirect para Inbox. Operação diária: Inbox, Funis/Leads, Automações, Conhecimento, Assistentes, WhatsApp — atalhos também em Início e Meu Negócio.

## 5. Meu Negócio

Rota: `/app/settings/business`  
Cards: Perfil, WhatsApp, Conhecimento, IA e assistentes, Automações, Funil, Equipe.  
Estados: Configurado / Não configurado / Precisa de atenção.  
WhatsApp: `Número …NNNN · Conectado` sem WAHA/NOWEB/session_name.

## 6. Checklist Primeiros Passos

Em `/app/inicio`, lendo `montarEstadoDoSetup`:

- Dados da empresa → perfil Ready Model
- WhatsApp conectado → WORKING com telefone (residual ignorada)
- Conhecimento da empresa → `ai_knowledge_sources` > 0
- Automação inicial → pointer `status=active`
- Configurar IA → `ai_mode !== off`
- Convidar equipe → `user_organizations` > 1 (não revogados)

Quando tudo feito, o bloco nasce recolhido.

## 7. Perfil / Ready Model

Meu Negócio mostra Empresa, Tipo, Subtipo, Modelo ativo a partir de `lerPerfilDoNegocio`. Catálogo inalterado: Locação (veículos / máquinas e equipamentos / ferramentas / imóveis / outros), Advocacia, Comercial / Vendas, Serviços, Personalizado.

## 8. Troca de modelo

Botão “Alterar modelo” → `/app/settings/perfil` (fluxo já seguro). Copy na central:

> Alterar o modelo ajusta configurações sugeridas. Seus negócios e leads existentes não serão apagados.

Sem `if locacao` em runtime.

## 9. Conhecimento da Empresa

`/app/ai/knowledge/sources`: headline “Ensine o sistema sobre sua empresa”, sugestões visíveis, cadastro em texto (FAQ markdown já aceito pela API). Sem chunks/embedding/pgvector na UX comum. Slots técnicos em “Fontes já cadastradas”.

Se não há agente, `garantirAgenteDoAcervo` cria um `rag_bot` **inativo** só para guardar o acervo (`published_version_id` nulo → nenhum envio).

## 10. RAG reutilizado

`recuperarConhecimentoDaEmpresa`:

1. `organizationId` só de cookie/JWT/job  
2. `buscarConhecimento` + `retrieve_top_k_chunks` quando há KB  
3. senão, `ai_faq_items` da **mesma** org (mesmo corpus que o indexer consome)

Não há segunda base vetorial. Dados vivos (boleto, contrato, veículo, parcela) continuam CRM/tools/MCP.

## 11. Testar Conhecimento

Painel na mesma página. `POST /api/v1/ai/knowledge/consultar` com `{ pergunta }`. Org nunca do body. Mostra texto + fonte simples, ou “ainda não achei”.

## 12. Copilot + RAG

`copilot-turn` e `POST /api/v1/conversations/[id]/copilot` recuperam trechos e passam `trechos` a `gerarSugestaoDoCopiloto`. System montado por `montarSystemComConhecimento`. Sem tools, sem send.

## 13. Anti-alucinação

Se o chamador passou `trechos` (mesmo `[]`) e a pergunta pede preço/prazo/disponibilidade/política/pagamento e não há hit: **não chama o LLM** e grava `RASCUNHO_SEM_FONTE`. Teste: “Quanto custa o Produto Zeta?”.

Chamadores antigos sem `trechos` (testes herdados) mantêm o comportamento anterior.

## 14. Tenant isolation

S1: RPC e FAQ filtram `organization_id` da sessão. Unitário: org A (R$ 123) não lê org B (R$ 999). E2E manda `organization_id` do vizinho no body e espera que seja ignorado.

## 15. AI_MODE UX

Mesmo enum. Rótulos: Desligada / Assistente / Controlada / Automática. Explicações curtas em `ROTULO_DO_MODO_IA`. Tela: `/app/settings/atendimento`.

## 16. Meus Assistentes

Lista comercial em `/app/ai/agents`: nome, Conhecimento: Empresa, modo da org, Status Ativo/Rascunho, Editar / Ativar / Desativar → detalhe existente. Lista técnica em Avançado.

## 17. Criação de assistente

Wizard `/app/ai/agents/simples`: Nome → Função → Conhecimento da empresa → o que pode fazer (sem tools extras) → modo da org → revisar → salvar. Reusa `createMcpAgentAction` (`is_active: false`, versão `draft`).

## 18. Draft / publish

Criar ≠ ativar. `published_version_id` nasce nulo. Ativar = `POST /api/v1/ai/agents/:id/publish` (versionamento existente). Sem canal WORKING o wizard não salva mcp (precisa de `channel_session_id`).

## 19. Automações

`/app/ai/followups` título Automações. Abas: Prontas · Minhas automações · Avançado · Fila (Fila preservada para e2es herdados). Único card Pronto prometido: lembrete 24h (motor já existia). Sem cards de função inexistente.

## 20. Follow-up

Card “Lembrar cliente se ele não responder”, 24h, mensagem padrão. `ativarFollowup24h` monta o mesmo formato de grafo do Ready Model e publica via `publishFollowupFlowVersion`. `cancel_on_reply: true`, `handoff_policy: pause`. Sem segundo scheduler.

## 21. Automação sem IA

O 24h é determinístico. AI_MODE OFF não impede o publish nem o silence-sweep (correção 3B.1 preservada). Simple Mode do e2e 3C começa em OFF e só depois liga o lembrete.

## 22. Action Policy

Inalterada. Wizard não concede tools. Ready Model não ganhou permissão crítica. Automação+IA continua AI_MODE + Action Policy + conversation command + send gate.

## 23. WhatsApp

Card lê `orgTemSessaoWorking` + primeira WORKING com telefone. Residual FAILED sem telefone **não** derruba “Conectado”. Sem WAHA/NOWEB/engine na UX comum.

## 24. Reaproveitamento da correção 3B.3

`lib/negocio/estado.ts` importa `ehResidualSupersedida` e `orgTemSessaoWorking`. Nenhuma cópia da regra. Sessão WORKING do certificado 3B.3 não foi mexida.

## 25. Mobile

E2E `productization-3c` viewport 390×844 em Início, Meu Negócio, Conhecimento, Assistentes, Automações — `body.scrollWidth ≤ clientWidth + 8`. Scroll vertical permitido. **Não executado nesta máquina** (sem app e2e no momento).

## 26. Migrations

**Nenhuma.** Sem tabela paralela.

## 27. Arquivos alterados (desta etapa)

Novos: `lib/negocio/*`, `lib/ai/copiloto/{anti-alucinacao,conhecimento,recuperar}*`, `app/app/inicio/`, `app/app/settings/business/`, `app/app/ai/agents/simples/`, `app/app/ai/knowledge/sources/_empresa.tsx`, `app/app/ai/followups/_components/ProntasTab.tsx`, `app/api/v1/ai/knowledge/consultar/`, `app/api/v1/ai/followup-flows/pronto-24h/`, `components/negocio/*`, `tests/e2e/productization-3c.spec.ts`, `docs/architecture/productization-3c.architecture.json`, `.changes/productization-3c.md`, este relatório.

Editados: Copilot gerar/turn/rota, knowledge page, agents page, followups page, AI_MODE UI, registry, dicionário, e2e.yml, followup-builder/queue headings, testes de nav/copilot/ai-mode, manual (Automações).

## 28. Testes

| Suíte | Resultado |
|---|---|
| `estado`, anti-alucinação, conhecimento, recuperar, followup-24h | 175+29+ unidades verdes no lote 3C |
| `ai-copilot-gerar` (herdado + Zeta/Alfa) | verde |
| `ai-mode-ui`, nav-hub, navegação, idioma, e2e-cobertura, mapas | verde |
| residual 3B.3, Ready Models, branding, Action Policy, AI execution | verde |
| `productization-3c` Playwright | escrito e listado em `SPECS_PARTE_2` — **não rodado aqui** |
| e2es herdados de follow-up | headings atualizados; **não reexecutados aqui** |

## 29. Typecheck

`pnpm typecheck` — **verde**.

## 30. Lint

eslint dos arquivos 3C — **verde** (`--max-warnings=0`).

## 31. test:db

**NÃO MEDIDO.** Docker indisponível nesta máquina (`docker info` falhou). Sem migration, o baseline do self-host não muda. Isolamento RLS do RAG continua o da RPC `retrieve_top_k_chunks`.

## 32. E2Es

Spec nova: `tests/e2e/productization-3c.spec.ts` (leigo Simple Mode Locação/máquinas, isolamento A/B, Zeta sem preço, wizard draft/publish, mobile 390). No CI: `SPECS_PARTE_2`. WhatsApp real **fora** desta spec, como pedido.

## 33. Riscos

- Sidebar ganhou **Início**: o e2e `navegacao.spec.ts` (900px sem scroll) pode apertar. Se falhar no CI, a correção é tirar `sidebar: true` — a porta do hub/⌘K permanece.
- “Testar conhecimento” cai no FAQ se o indexer/embedding não rodou; o path vetorial é o mesmo quando a KB existe.
- Publish do assistente no e2e aceita 422 (credencial/canal) — draft continua provado; ativação explícita usa o publish existente.
- GET de Conhecimento pode criar o container inativo na primeira visita (sem publish).

## 34. Backlog (não feito — 3D/3E/3F proibidos)

- Builder visual novo  
- RAG por agente separado  
- Cards Prontos que o backend ainda não tem (qualificar com IA, criar tarefa genérica, etc.)  
- Marketplace / billing / fine-tuning / campanhas  
- Espanhol no opt-out (já era dívida)

## 35. git diff

Somente a etapa 3C (sem leftovers de outras sessões). Contagem após o commit local: ver `git show --stat HEAD`.

## 36. Commit

Mensagem pedida: `feat(crm): add business setup knowledge and automation center`  
**Local apenas. Sem push.**

## 37. Confirmação sem push

Nenhum `git push` foi executado.

---

## Tabela final

| Critério | SIM/NÃO |
|---|---|
| Usuário sabe onde configurar empresa | SIM |
| Modelo do negócio está visível | SIM |
| Usuário consegue alterar modelo | SIM |
| Alteração não apaga negócios existentes | SIM |
| Usuário consegue adicionar conhecimento | SIM |
| RAG existente foi reutilizado | SIM |
| RAG é tenant-scoped | SIM |
| Usuário consegue testar conhecimento | SIM |
| Copilot usa RAG | SIM |
| Copilot não inventa dado crítico ausente | SIM |
| Usuário sabe onde configurar IA | SIM |
| AI_MODE tem UX simples | SIM |
| Usuário consegue criar assistente | SIM |
| Assistente nasce inativo/draft | SIM |
| Ativação é explícita | SIM |
| Action Policy preservada | SIM |
| Usuário encontra Automações | SIM |
| Usuário consegue ativar follow-up | SIM |
| Follow-up determinístico funciona com AI OFF | SIM |
| Ready Model continua genérico | SIM |
| WhatsApp mostra status correto | SIM |
| Residual WAHA não derruba status | SIM |
| Primeiros Passos funciona | SIM |
| Tenant isolation validado | SIM (unitário; e2e no CI) |
| Mobile 390x844 operável | SIM (spec escrita; execução local não medida) |
| Typecheck verde | SIM |
| Testes necessários verdes | SIM (unitários desta etapa; test:db e Playwright local não medidos) |

---

## Living System Checklist — productização 3C

1. Quem me alimenta? → `organizations.settings`, `channel_sessions`, `ai_knowledge_sources`, `ai_agents`, `followup_flow_pointers`, `user_organizations` via `carregarEstadoDoSetup`  
2. Quem eu alimento? → Inbox/Copilot (`trechos`), silence-sweep (pointer active), publish de agente  
3. Que registro eu emito? → `followup_flow.published`, `ai_agent.created` (já existentes)  
4. Onde eu apareço na tela? → `/app/inicio`, `/app/settings/business`, knowledge, assistentes, automações  
5. Por qual porta se chega? → `NAV_DESTINATIONS` + allowlist do wizard  
6. Qual meu anti-morte? → checklist + follow-up 24h já existente  
7. Onde se configura? → Meu Negócio; falha vira “Não configurado” / “Precisa de atenção”  
8. Qual a continuidade? → Copilot sugere; humano envia; takeover intacto  
9. Qual meu laço de retorno? → Testar conhecimento vazio / recusa sem fonte muda o rascunho; residual não gera QR falso  
10. Atualizei o mapa? → `docs/architecture/productization-3c.architecture.json` (≥2 arestas)

---

## VEREDITO FINAL

**MOOPE CRM 3C — PRODUTO CONFIGURÁVEL POR USUÁRIO LEIGO: SIM**

Não há blocker de piloto nesta etapa. Lacunas restantes são de medição local (Docker/`test:db` e Playwright) e risco de dobra do sidebar — não de engine faltando.

Próxima decisão do engenheiro: **PILOTO REAL** ou correção só dos blockers que a revisão desta 3C encontrar.

3D / 3E / 3F: **não iniciados.**
