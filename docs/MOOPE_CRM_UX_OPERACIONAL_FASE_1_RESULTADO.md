# MOOPE CRM — UX OPERACIONAL FASE 1

**Cockpit comercial na Inbox**

Data: 2026-09-10  
Tipo: implementação. **SEM PUSH. SEM DEPLOY. 3B.3 / sessão WORKING / `:3666`: não tocados.**

---

## 1. commit-base

`fecd8ea5127006ee9347f35f71bd3b5ec4e0e51e` — posterior à 3C (`ccff29ed`) e ao GO do Kanban comercial.

## 2. git status inicial

Branch `main`, 14 commits à frente de `origin/main`. Working tree sujo de **outras sessões** (manuais, evidence, piloto). Esse lixo **não** entrou neste commit.

## 3. arquitetura encontrada

Confirmada no código antes de alterar:

```
conversations.contact_id NOT NULL
contacts 1:N crm_leads          (sem unique de OPEN)
crm_leads NÃO tem conversation_id
conversations NÃO tem lead_id
garantirLeadDaConversa: 1 OPEN por contato no funil is_default
POST /leads: cria sempre (podia duplicar com o ingest)
POST /leads/{id}/move: só dentro do mesmo pipeline
PATCH /demandas/{id}: texto + proximo_passo_em (ISO)
demandas nascem no TRIGGER de inbound; conversa histórica sem inbound novo pode não ter demanda
três donos: conversation.assigned_to_user_id ≠ lead.owner_* ≠ demanda.dono_*
resolveActiveLeadForContact: a IA PODE escolher; a ficha NÃO pode herdar isso
```

Funis da org de teste MOOPE Frotas (`a67821af-…`, isolado `54322`):

| Funil | is_default |
|---|---|
| Locatários | **sim** |
| Cobrança | não |
| COMERCIAL MOOPE | **não** |

Por isso “Adicionar ao funil” **mostra seletor** quando há mais de um funil utilizável.

## 4. APIs reutilizadas

- `GET /api/v1/contacts/{id}/crm-summary` — enriquecido
- `POST /api/v1/leads` — flag `reuse_open_if_exists`
- `POST /api/v1/leads/{id}/move`
- `PATCH /api/v1/demandas/{id}`
- `POST /api/v1/demandas` — só quando não há demanda aberta (mesma tabela)
- `POST /api/v1/conversations/{id}/claim` — inalterado no comando; espelho opcional no lead
- `/app/leads/{id}` — porta canônica do quadro

Não criamos engine, tabela de tarefa, cliente, lifecycle nem temperatura.

## 5. alterações no crm-summary

Cada lead passa a trazer pipeline `{id,name,is_default}`, stage `{id,name}`, owner `{user_id,agent_id,display_name}`, `source`, `last_activity_at`, `updated_at`.

O envelope ganhou:

- `negocio`: `{ resolucao: nenhum|unico|varios, lead_id, leads_abertos }`
- `pipelines_utilizaveis` + etapas abertas
- `proximo_passo_comercial` a partir da demanda aberta mais antiga

Contato invisível (outro tenant / RLS) → **404**. Isolamento medido no E2E G.

## 6. resolução do lead aberto

`resolverNegocioAberto` (puro): zero OPEN → nenhum; um → esse; **dois ou mais → varios, `lead_id` null**.

Não usa `resolveActiveLeadForContact` (esse é da IA e pode desempatar por atividade).

## 7. comportamento com múltiplos leads

A ficha lista os OPEN com título, etapa, status e link `/app/leads/{id}`. Não mostra select de etapa até o humano escolher. E2E E verde.

## 8. seletor de pipeline

- 0 ou 1 funil utilizável: sem seletor inútil.
- 2+: select no “Adicionar ao funil”.
- Lead já existente: pipeline é **texto**. Trocar de funil **fora do P0** — `/move` recusa cross-pipeline (`pipeline_immutable_use_clone`). Semântica não inventada.

## 9. seletor de etapa

Select nativo das etapas **do mesmo pipeline**. `POST /move` com `expected_updated_at` e `position_in_stage=1000000`. Timeline `stage_changed` pelo emissor existente. E2E A: muda, refresh, banco bate, “Abrir no quadro” abre o mesmo id.

## 10. criação de lead histórico

“Adicionar ao funil” → `POST /leads` com `contact_id` + `reuse_open_if_exists: true`. Mensagens **não** são copiadas. E2E B: 1 lead OPEN, contagem de `messages` inalterada.

## 11. proteção contra duplicidade/race

Mesma leitura (`listarLeadsAbertosDoContato`) no ingest e no POST com flag.

Depois do INSERT: `reconciliarNascimentoAberto` — se perdeu a corrida, **apaga só o card recém-criado** (via admin no POST, para não depender de DELETE RLS).

`POST /leads` **sem** o flag continua permitindo N OPEN legítimos (“Criar outra oportunidade”).

**Não** há unique `(contact_id, open)`.

Testes: unitário do reconciliar; invariante concorrente ingest×ingest (`test:db`); E2E F dois POST reuse em paralelo → 1 OPEN.

## 12. próximo passo + data/hora

Um controle na ficha: texto + data + hora, **sempre visível** depois de gravar.

- Com demanda: `PATCH /demandas/{id}` (`proximo_passo` + `proximo_passo_em`)
- Sem demanda: `POST /api/v1/demandas` → `definirProximoPassoComercial` (`origem=manual`)

Não é snooze. Não é follow-up de IA. Não cria `calendar_appointments`. E2E C verde.

## 13. regra de responsável

Aparente na ficha = owner do **lead** (nome, ou “Assistente”, ou “Sem responsável”).

Assumir a conversa **não** é transferir o negócio. Espelho só quando há **exatamente um** OPEN e os dois owners do lead estão vazios.

## 14. owner humano

A. vazio + Assumir → `owner_user_id` = quem assumiu.  
B. já tem humano + outro assume → **não** sobrescreve.

Unitário A/B + E2E D.

## 15. owner agente

C. `owner_agent_id` preenchido + Assumir → **não** apaga o agente. Unitário C + E2E D2.

## 16. conversation command × lead owner

`fn_conversation_assign`, `bot_silenced_until`, pause/devolver IA, Action Policy, AI_MODE: **intocados**. O espelho roda *depois* do claim, em try/catch — falha no lead não desfaz o Assumir.

Regressão: `inbox-quem-manda` e `inbox-assistente-ia` verdes.

## 17. reorganização visual da ficha

Acima da dobra: Contato → Negócio (funil/etapa/responsável/próximo passo/abrir no quadro).

Abaixo: Assistente IA (visível, para não esconder copiloto), tags da conversa em `<details>`, demandas abertas (testids antigos), pedidos **só se houver**, atividade.

Botão “Lead” + lista morta “Leads recentes” saíram da dobra. “Criar outra oportunidade” ficou em Mais opções (`NewLeadDialog`, sem `reuse_open`).

## 18. mobile

390×844: Sheet “Ficha”. Selects nativos, `min-w-0`, `overflow-x-hidden`. E2E mobile: etapa, próximo passo e “Abrir no quadro” visíveis; sem overflow horizontal no dialog.

## 19. tenant isolation

crm-summary filtra `organization_id` do contato da sessão. Contato de org B → 404. E2E G.

## 20. testes unitários

- `lib/inbox/crm-summary-tipos.test.ts`
- `lib/leads/espelhar-assumir-no-lead.test.ts` (A/B/C + vários)
- `lib/leads/reconciliar-nascimento-aberto.test.ts`
- `tests/unit/inbox-cockpit-comercial.test.tsx`
- `tests/unit/inbox-demandas-abertas.test.tsx` (atualizado: negócio antes das demandas)
- `tests/unit/conversation-assignment.test.ts` (claim intacto)
- `tests/unit/e2e-cobertura-completa.test.ts`
- `tests/unit/mapas-de-arquitetura.test.ts`

41 + 94 nos lotes medidos, verdes.

## 21. test:db

`pnpm test:db`: **130 arquivos, 1008 passed** (1 expected fail, 1 skipped). Inclui o caso novo de nascimento concorrente.

## 22. E2Es

`tests/e2e/inbox-cockpit-comercial.spec.ts` na `SPECS_PARTE_2`.

| Cenário | Resultado |
|---|---|
| A etapa + refresh + quadro | verde |
| B histórico → 1 lead, msgs intactas | verde |
| C próximo passo | verde |
| D owner vazio / não sobrescreve | verde |
| D2 owner_agent | verde |
| E dois OPEN | verde |
| F race reuse | verde |
| G tenant | verde |
| mobile 390×844 | verde (2ª corrida; 1ª falhou por dois nós hidden+sheet) |

Rodado em `E2E_PORT=3004` após `pnpm e2e:build` contra `127.0.0.1:54321`. **Não** usou `:3666`.

## 23. regressões

13/13 verdes: `conversa-vira-lead`, `inbox-assistente-ia`, `inbox-quem-manda`, `inbox-scope`, `kanban-comercial-go`.

WhatsApp real: **não executado**.

## 24. arquivos alterados

Código novo: `BlocoNegocio.tsx`, `crm-summary-tipos.ts`, `leads-abertos-do-contato.ts`, `reconciliar-nascimento-aberto.ts`, `espelhar-assumir-no-lead.ts`, `definir-proximo-passo.ts`, `POST /api/v1/demandas`.

Código existente: crm-summary, createLead, claim, nascimento-do-lead, CRMSidePanel, schema de create, e2e.yml, mapa `indice-de-atrito`.

## 25. migrations

**Nenhuma.**

## 26. commit final

Ver SHA após o commit local (mensagem `feat(crm): add commercial cockpit to inbox`).

## 27. confirmação SEM PUSH

Este relatório não autoriza `git push`. A branch já estava ahead; o commit novo também fica só local.

## 28. riscos / backlog

- Ingest ainda nasce no funil **`is_default`** (Locatários na Frotas). A ficha deixa escolher COMERCIAL MOOPE no histórico; mensagem nova continua no default. Fase 2: default comercial ou seletor no ingest.
- Trocar funil de lead existente: clone, não move. Fora do P0.
- Pedidos recentes some da dobra se a lista vem vazia — backend intacto.
- Dois `CRMSidePanel` no DOM (sidebar `xl` + Sheet): esperado; testes mobile usam o dialog.
- Assistente IA ficou abaixo do Negócio, mas **visível** (não accordion fechado) para não quebrar copiloto.

P1 ainda no estudo: lifecycle, temperatura manual, Agenda, Kanban magro.

---

## Tabela final

| Critério | SIM/NÃO |
|---|---|
| Lead aberto aparece na Inbox | SIM |
| Pipeline aparece | SIM |
| Etapa aparece | SIM |
| Etapa é alterável | SIM |
| Refresh preserva etapa | SIM |
| Lead abre no quadro | SIM |
| Conversa histórica pode virar lead | SIM |
| Mensagens históricas permanecem | SIM |
| Não cria lead duplicado acidental | SIM |
| N leads legítimos continuam possíveis | SIM |
| Próximo passo tem texto | SIM |
| Próximo passo tem data/hora | SIM |
| Próximo passo persiste | SIM |
| Responsável aparente existe | SIM |
| Assumir pode preencher owner vazio | SIM |
| Owner existente não é sobrescrito | SIM |
| owner_agent não é apagado | SIM |
| Tenant isolation preservado | SIM |
| Human takeover preservado | SIM |
| AI_MODE preservado | SIM |
| Mobile 390x844 | SIM |
| Typecheck verde | SIM |
| test:db verde | SIM |
| E2E cockpit verde | SIM |
| Regressões relevantes verdes | SIM |

---

## Veredito

MOOPE CRM — COCKPIT COMERCIAL NA INBOX: **SIM**

UX COMERCIAL P0 LIBERADA PARA PILOTO: **SIM**

Piloto no isolado / código. Produção **não** recebeu este commit (push proibido).
