# MOOPE CRM — UX OPERACIONAL P0.1

**Nascimento do lead no funil correto**

Data: 2026-09-11  
Tipo: correção pequena de fechamento do P0. **SEM PUSH. SEM DEPLOY. SEM Fase 2. 3B.3 / sessão WORKING / `:3666`: não tocados.**

---

## 1. commit-base

`731059a703a40c3d1795445882756a7f39d1a00f` — `feat(crm): add commercial cockpit to inbox` (Fase 1 aprovada).

HEAD no início desta sessão: o mesmo SHA.

## 2. regra antiga

`garantirLeadDaConversa` → `funilDeEntrada()` lia **somente** `crm_pipelines.is_default` + primeira etapa aberta (`position`, não won/lost/arquivada).

Medido na Frotas isolada (`a67821af-…`): Locatários = `is_default`, COMERCIAL MOOPE = não. WhatsApp novo nascia em Locatários.

A spec 17 recusou coluna `is_entry_pipeline` porque tratava `is_default` como entrada. A operação real divergiu: o padrão técnico e o funil de entrada comercial **não são a mesma coisa**.

## 3. callers de `garantirLeadDaConversa`

Único caller de produção:

- `lib/channels/pos-entrada.ts` → `abrirDemanda()` (nome legado; cria lead, não linha de `demandas`)

Ingest WAHA e Zernio passam por `aplicarEfeitosPosEntrada`. Não há segundo nascimento.

Testes: `tests/invariants/nascimento-do-lead.test.ts`, `tests/unit/pos-entrada-efeitos-do-canal.test.ts`.

Criação manual **não** usa esta função: Inbox «Adicionar ao funil», Kanban e `POST /api/v1/leads` / MCP vão em `createLeadHandler`. A escolha manual da Inbox continua soberana.

## 4. configuração existente encontrada

**Existe HOJE alguma configuração persistida que represente "pipeline onde novos leads comerciais devem nascer"? NÃO.**

O que existe e **não** serve:

| Peça | O que é |
|---|---|
| `crm_pipelines.is_default` | Um funil padrão por org. Kanban «Tornar padrão». Ready Model promove o quadro do modelo. Na Frotas é Locatários. |
| `organizations.settings.perfil_do_negocio` | id/versão/subtype do Ready Model. Sem pipeline id. |
| `crm_pipelines.settings` | fields, lost_reasons, tags, copilot. Sem inbound. |
| Meu Negócio / Perfil | Escolhe o modelo e o quadro padrão. Trocar não apaga cards. |

Nenhum `inbound_pipeline_id` / `entry_pipeline` no schema de settings.

Por isso: **não reutilizar**. Knob novo no JSONB já existente. **Sem** `if name === "COMERCIAL MOOPE"`, **sem** vertical, **sem** id de org.

## 5. solução escolhida

`organizations.settings.crm.inbound_pipeline_id` (uuid ou null).

Namespace `crm` — vazio no repo até agora. Sem migration, sem tabela, sem coluna.

Resolução (`lib/leads/funil-de-nascimento.ts` → `funilDeEntrada`):

1. inbound explícito, **desta** org, não arquivado, com etapa aberta
2. fallback `is_default`
3. nenhum válido → `sem_funil_de_entrada` / `sem_etapa` (o recusa antigo). Não escolhe funil arbitrário.

Org sem a chave = comportamento antigo.

## 6. por que não houve hardcode

O runtime só lê uuid + `organization_id` + `is_archived` + primeira etapa aberta **daquele** pipeline. Nenhum nome de funil, segmento ou tenant entra no código de ingest.

## 7. fallback para `is_default`

Ausente, null, uuid inválido, pipeline de outra org, arquivado ou sem etapa aberta → cai no padrão técnico. Tenant antigo não precisa fazer nada.

## 8. UX da configuração

Superfície: **Funis** (`/app/kanban`). Já era onde se marca o padrão. Não misturamos os dois conceitos.

- Um funil só: nenhum controle extra.
- Dois ou mais + manager: «Novos leads entram em» + select pelos **nomes** (sem UUID) + texto: *Quando uma nova conversa gerar uma oportunidade automaticamente, ela será criada neste funil.*
- Badge «Novos contatos» no funil efetivo; «Padrão» continua no `is_default`.
- Viewer vê a lista, não o select.
- Persistência: `PATCH /api/v1/settings/crm-inbound` (manager+, merge jsonb, audit `crm.inbound_pipeline_changed`).

Meu Negócio / Ready Model **não** ganharam tela nova.

## 9. Ready Models

Instalador genérico (`aplicarReadyModel`):

- Reaplicar o mesmo id+version+subtype = noop. **Não toca** inbound.
- Aplicação que grava perfil: se `inbound_pipeline_id` **está ausente**, semeia o `quadro.id` do modelo (o pipeline que o instalador acabou de garantir). Definição genérica: «o quadro deste modelo».
- Se a chave já existe (escolha manual **ou** semente anterior): **não sobrescreve**.
- Trocar de modelo **não move** leads existentes (já era verdade).
- Sem branch `if locacao / advocacia / comercial` no runtime.

Frotas já tem perfil aplicado: reaplicar o mesmo modelo é noop. O operador escolhe COMERCIAL MOOPE em Funis uma vez.

## 10. ingest

`garantirLeadDaConversa` agora resolve o destino pelo resolvedor novo.

Preservado:

- um OPEN por contato (`listarLeadsAbertosDoContato`)
- `reconciliarNascimentoAberto` na corrida ingest × manual
- N leads depois de fechar
- filtro `organization_id` em toda query
- sem cópia de `messages`
- sem alteração de conversation command / WAHA / sessão WORKING

## 11. stage inicial

A etapa é a de menor `position` **do pipeline escolhido** (`is_won=false`, `is_lost=false`, não arquivada). Stage de outro funil é recusado pela query (`pipeline_id` + `organization_id`).

## 12. race / idempotência

Mesma guarda da Fase 1. O caminho inbound faz mais queries antes do INSERT, então a janela de corrida cresceu. `reconciliarNascimentoAberto` apaga o card acidental. O adaptador `pg-como-supabase` passou a implementar `delete` com filtro (antes o teste de corrida só passava quando um SELECT vencia).

Dois `garantirLeadDaConversa` em paralelo no org com inbound → 1 OPEN (invariante E).

## 13. tenant isolation

Pipeline de org B no settings de org A falha `pipelineUtilizavelParaNascimento` (`eq organization_id`). Fallback no default de A. Invariante D: zero leads de A no pipeline de B.

A API recusa gravar id que não seja da org ativa (404).

## 14. cockpit

A ficha lê o lead OPEN (pipeline/etapa/link `/app/leads/{id}`). Não «pula» de funil. «Adicionar ao funil» manual continua soberano quando não há OPEN.

E2E cockpit A–G verdes no org sem a chave nova (compat = `is_default`). Invariante B prova nascimento no inbound + etapa daquele funil.

## 15. testes

| Caso | Onde | Resultado |
|---|---|---|
| A sem config → `is_default` | invariante ORG_VIVA + unit `escolherPipelineDeNascimento` | verde |
| B inbound ≠ default + etapa correta | invariante ORG_INBOUND | verde |
| C inbound arquivado → default | invariante ORG_INBOUND_MORTO | verde |
| D isolamento | invariante ORG_ISOLADA_A/B | verde |
| E corrida | invariante ORG_INBOUND + ORG_VIVA | verde |
| F segundo negócio após fechar | invariante existente | verde |
| G Ready Model não sobrescreve | `ready-models-aplicar` + `semearInboundSeAusente` | verde |
| H cockpit | e2e `inbox-cockpit-comercial` + invariante B | verde |
| UX Funis | `funis-novos-leads.test.tsx` | verde |

## 16. test:db

`pnpm test:db` — **130 arquivos, 1014 passed**, 1 expected fail, 1 skipped. Verde.

## 17. E2E

`E2E_PORT=3004` após `pnpm e2e:build`. `.env.e2e` → `127.0.0.1:54321`. **Não** usou `:3666`. WhatsApp real: **não**.

**34/34 verdes:**

- `conversa-vira-lead` (3)
- `inbox-cockpit-comercial` (9)
- `inbox-quem-manda` (2)
- `inbox-scope` (3)
- `kanban-comercial-go` (1)
- `pipelines-gestao` (3) — superfície nova
- `wizard-do-funcionario` (Ready Models, 13)

## 18. arquivos

Código novo: `lib/leads/funil-de-nascimento.ts`, `GET/PATCH /api/v1/settings/crm-inbound`.

Código existente: `nascimento-do-lead.ts` (resolvedor), `settings.ts` (Zod), `aplicar.ts` (semente se ausente), Funis (`kanban` page + client), `usePipelines`, `lib/audit/actions.ts`.

Testes: unitários do resolvedor / Funis / Ready Model; invariantes de nascimento; `delete` no `pg-como-supabase`.

Mapa: `docs/architecture/gestao-funis.architecture.json`. Spec 17 atualizada (inbound + fallback, sem coluna nova).

## 19. migrations

**Nenhuma.** JSONB `organizations.settings` já existe.

## 20. commit

Local, mensagem pedida: `fix(crm): route new leads to configured pipeline`

## 21. SEM PUSH

Este relatório não autoriza `git push`. A branch já estava ahead; o commit novo também fica só local.

## 22. riscos restantes

- Frotas (e qualquer org já instalada) **continua em Locatários** até alguém escolher o funil em Funis. A correção é a configuração, não um backfill por nome.
- A tela do assistente (`FunisDoAgente`) ainda diz «é para cá que vão as conversas novas» no `is_default`. **Não alteramos IA.** Se inbound ≠ default, aquele aviso mente. Dívida declarada.
- Login mencionado de passagem pelo usuário: **não medido**.
- WhatsApp real / 3B.3: não executados, de propósito.

Living System Checklist (knob):

1. Alimenta: settings da org + `crm_pipelines` da org ativa  
2. Alimenta: `garantirLeadDaConversa` / ingest  
3. Registro: `crm.inbound_pipeline_changed`  
4. Tela: Funis, badge «Novos contatos», cockpit do lead nascido  
5. Porta: `/app/kanban` (já no menu)  
6. Anti-morte: recusa visível (`sem_funil_de_entrada` / `sem_etapa`); inválido cai no default  
7. Configuração: Funis, só se há 2+ funis  
8. Continuidade: humano escolhe o funil; ingest obedece  
9. Laço: inbound inválido não grava card no funil alheio — fallback  
10. Mapa: `gestao-funis` ganhou inbound_api / inbound_settings / nascimento  

---

## Tabela final

| Critério | SIM/NÃO |
|---|---|
| Pipeline de entrada é configurável | SIM |
| Sem hardcode COMERCIAL MOOPE | SIM |
| Tenant antigo mantém compatibilidade | SIM |
| is_default continua fallback | SIM |
| Frotas pode usar COMERCIAL MOOPE | SIM |
| Novo inbound nasce no pipeline configurado | SIM |
| Stage inicial pertence ao pipeline correto | SIM |
| Cockpit mostra o lead correto | SIM |
| Histórico manual continua funcionando | SIM |
| Race não duplica lead | SIM |
| N leads legítimos continuam possíveis | SIM |
| Tenant isolation preservado | SIM |
| Ready Model não sobrescreve escolha manual | SIM |
| Human takeover preservado | SIM |
| AI_MODE preservado | SIM |
| Typecheck verde | SIM |
| test:db verde | SIM |
| E2Es relevantes verdes | SIM |

---

## Veredito

MOOPE CRM — NASCIMENTO COMERCIAL NO FUNIL CORRETO: **SIM**

UX COMERCIAL P0 COMPLETO PARA PILOTO: **SIM**

No piloto da Frotas: em Funis, «Novos leads entram em» → COMERCIAL MOOPE. Sem esse clique, o fallback continua Locatários (compatibilidade).

Fase 2 / lifecycle / temperatura / Agenda / 3D / push: **não iniciados**.
