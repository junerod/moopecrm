# MOOPE CRM — KANBAN COMERCIAL / GO OPERACIONAL

Data: 2026-09-10  
Baseline: `docs/MOOPE_CRM_3C_PILOT_ACCEPTANCE_RESULTADO.md`, `docs/MOOPE_CRM_PILOTO_REAL_SIMULADO_RESULTADO.md`  
3D: **não criada**. Push: **não feito**. Deploy: **não feito**.  
3B.3: **não reaberta**. Sessão WhatsApp WORKING: **não tocada**. App `*:3666`: **não tocado**.

Isto não é auditoria de papel. O funil **COMERCIAL MOOPE** foi criado e operado no tenant Moope Frotas (`junerod@hotmail.com.br`), com persistência conferida no Postgres isolado.

Evidência bruta: `.superpowers/evidence/kanban-comercial-go/` (`resultado.json` + PNGs).

---

## 1. Ambiente

| Peça | Valor | Uso |
|---|---|---|
| HEAD de partida | `ccff29ed` | 3C já aceita |
| Stack isolado | `deskcomm-crm` API `54321` / DB `54322` | **usado** |
| App da jornada Frotas | `http://localhost:3003` (`next start`) | UI comercial |
| App Playwright | `E2E_PORT=3004` (`next start` após `next build`) | regressão |
| Stack cert 3B.3 | `deskcomm-vps-fresh` `55321`/`55322` | **não usado** |
| App cert | `*:3666` | **não tocado** |
| WAHA / QR / WORKING | — | **não tocados** |
| Produção / push | — | **não feitos** |

`test:db` **não rodou**. Não houve migration nem mudança de schema. Não é verde inventado.

---

## 2. O que já existia (e o que faltava)

Já existia: lista de funis em `/app/kanban`, quadro em `/app/pipelines/[id]`, etapas em Configurações, drag-and-drop (`position_in_stage` + `POST /move`), ganho/perda, dono, timeline (`crm_lead_activities`), contato separado do lead.

Lacunas comprovadas nesta rodada:

| Lacuna | Classe | O que foi feito |
|---|---|---|
| Contato gravado e lista vazia (Maria Silva no piloto) | S2 | GET deixa de devolver lista vazia sem org; create carimba `last_activity_at`; invalidate da lista é awaited |
| Telefone só aceito/explicado como E.164 | UX | Entrada `(48) 99999-9999` normaliza no schema |
| Busca de contato com máscara BR não achava o E.164 | S2 | `trechosDeTelefoneParaBusca` no GET |
| Origem do lead invisível no Kanban | S2 | Vocabulário comercial + campo no criar/editar/dossiê + filtro |
| Lead novo criava pessoa duplicada | S2 pequeno | Reusa contato pelo telefone E.164 |
| Sem “Reabrir / reativar” na UI | S2 | Menu do card; etapa **Reativar** se existir |
| Perda sem motivos do comercial | UX | Preço, concorrente, orçamento, não respondeu, momento, não qualificado, outro |
| “Mover para…” incluía Fechado/Perdido | UX | Só etapas abertas; ganho/perda têm ação própria |
| “pipeline” no diálogo de lead | UX | “neste funil” |
| Settings dizia que funil nasce no banco | UX | Aponta para Funis / Kanban |

Assumir / Devolver para IA / follow-up / automações: **não removidos, não alterados**. Próxima rodada.

---

## 3. Funil COMERCIAL MOOPE (Frotas)

Criado pela UI (`/app/kanban`). Etapas montadas em Configurações + o mesmo PATCH de reordenar dos botões Subir/Descer.

Ordem persistida no banco (`pipeline_id = 09e2f1d9-d5a7-41eb-9adb-f60ab408aca9`):

1. Novo Lead  
2. Primeiro Contato  
3. Qualificado  
4. Demonstração  
5. Proposta Enviada  
6. Negociação  
7. Fechado (`is_won`)  
8. Perdido (`is_lost`)  
9. Reativar  

17 leads fictícios no quadro após o dia de trabalho. Refresh e reabertura do browser: **mesmo estado**.

Amostra do Postgres (`supabase_db_deskcomm-crm`):

| Etapa | Qtde |
|---|---|
| Novo Lead | 2 |
| Primeiro Contato | 3 |
| Qualificado | 2 |
| Demonstração | 4 |
| Proposta Enviada | 1 |
| Fechado | 2 |
| Reativar | 3 |

Helena (perdida por `price`) e Elisa (`no_response`) estão **abertas em Reativar** com o motivo de perda **preservado**. Diego e Juliana estão `won` em Fechado.

---

## 4. Lead ≠ contato

Um contato `João Silva GO` (`+5548999912026`, `last_activity_at` preenchido). Duas oportunidades “retomada 2026” no funil — efeito das reexecuções do script, não de dois cadastros de pessoa.

A UI de Novo Lead reusa o contato pelo telefone. Sem refatoração de modelo: `crm_leads.contact_id` já era a ponte.

---

## 5. Timeline

Helena tem 13 linhas em `crm_lead_activities` (`stage_changed` + `demand_closed`), `actor_kind = user`, `from_stage_id` / `to_stage_id`, horário. O dossiê mostra origem, etapa, criação, última atividade e o formulário do negócio. A prosa da timeline é “Mudou de estágio” (não o nome da coluna no payload). Isso já era o vocabulário do produto.

---

## 6. Tabela de aceite

| RECURSO | PASS | FAIL | NÃO MEDIDO | EVIDÊNCIA |
|---|---|---|---|---|
| Múltiplos funis | X | | | `/app/kanban` lista; Frotas tem COMERCIAL MOOPE + funis do perfil; e2e `pipelines-gestao` isola org |
| Criar/editar funil | X | | | UI Novo funil + rename; e2e `pipelines-gestao` + `kanban-comercial-go` |
| Criar/editar/reordenar etapas | X | | | Settings etapas; 9 colunas no banco na ordem pedida |
| Drag & drop (Playwright arrasto) | | X | | `dragTo` não persistiu nesta máquina. Menu “Mover para…” e `POST /move` **sim**. Alternativa no mobile existe |
| Persistência após refresh | X | | | `persistiuAposRefresh: true`; 17 leads iguais no Postgres depois de reload |
| Contatos (criar → lista) | X | | | Causa: org vazia + `last_activity_at` null. e2e `contato-aparece-na-lista` verde |
| Contatos busca por nome | X | | | e2e busca pelo nome |
| Contatos busca por telefone BR | X | | | Bug medido (lista vazia com `99991-2026`); corrigido; unit + e2e com máscara |
| Busca de lead (nome/empresa) | X | | | “Oficina Sul” acha Carla; Fernanda some |
| Filtro origem WhatsApp | | | X | Script aplicou filtro **com** busca “Oficina Sul” ainda ativa — medição inválida. Controle existe |
| Filtro responsável | X | | | e2e `kanban-owner-filter` verde. Nesta jornada Frotas o script não atribuiu dono |
| Responsável (atribuir/trocar) | X | | | Menu no card; e2e de filtro. Frotas ficou “Sem responsável” neste run |
| Origem | X | | | Instagram/WhatsApp/Site/Indicação/Prospecção/Outro no criar, dossiê e banco |
| Ganho | X | | | Juliana e Diego `won` em Fechado |
| Perdido | X | | | Diálogo de motivos visível no e2e; submit Frotas via API (overlay do dossiê intercepta o Confirmar) |
| Motivo de perda | X | | | `price`, `no_response` persistidos após reativar |
| Reativação | X | | | Menu “Reabrir / reativar”; Helena/Elisa/Igor em Reativar, `status=open` |
| Dossiê | X | | | Nome, origem, etapa, datas, responsável, formulário, link do contato. `06-dossie.png` |
| Timeline | X | | | 38 `stage_changed` + 21 `demand_closed` no funil; UI carrega no dossiê |
| Desktop fluxo comercial | X | | | Dia de trabalho: 5 leads, qualificar, demo, proposta, perder, reativar, fechar, nova oportunidade no João |
| Mobile 390×844 | X | | | Quadro usável, dossiê abre, menu de ações visível (`opacity-100`), `scrollWidth=390` |
| Mover no mobile | X | | | “Mover para…” no menu. Arrasto não é o caminho tocável |
| Regressão 3C | X | | | `productization-3c` 6/6. Publish do assistente continua **422** (sem canal) — NÃO MEDIDO como WhatsApp, não escondido |
| Regressão funis/contatos/dono | X | | | `pipelines-gestao`, `contato-salva-email`, `kanban-owner-filter` verdes após limpar funis de teste órfãos |
| WhatsApp / Assumir / Devolver IA | | | X | Fora desta rodada. Controles não removidos |

---

## 7. Classificação

**S1** — nenhum neste escopo (tenant Frotas isolado; 3B.3 intocada).

**S2 corrigidos:** lista de contatos vazia; busca de telefone com máscara; origem inutilizável; reabrir só no banco.

**S3 / UX corrigidos:** E.164 no formulário; “pipeline”; mover para coluna terminal; copy das etapas vazias.

**Não bloqueante (backlog):**

- Playwright não consegue arrastar o card do `@hello-pangea/dnd` de forma estável; o comercial move pelo menu.
- Diálogo de perda e dossiê (Sheet `z-50`) competem: Confirmar às vezes precisa de force-click. Motivos aparecem.
- Busca do **Kanban** não procura telefone do contato (só título/descrição/origem). Agenda de Contatos sim.
- Timeline grava id da etapa, não o rótulo; a UI traduz para “Mudou de estágio”.
- Sem módulo de analytics de origem.
- Dois leads “João Silva GO — retomada 2026” no funil de teste (reexecução), um contato só.

---

## 8. Gates

| Gate | Resultado |
|---|---|
| `pnpm typecheck` | verde |
| eslint dos arquivos tocados | 0 erros; 4 warnings pré-existentes de `watch()` / `useMemo` |
| unitários afetados | 33 passed (`contacts` schema, origem, garantir-contato, busca-telefone, lista ordenação) |
| Playwright comercial + 3C + herdados | 12 passed na primeira leva; `pipelines-gestao` reorder falhou por **10 funis Comercial GO órfãos** (cleanup do spec não arquivava). Cleanup + spec corrigidos → **4/4** na reexecução |
| `test:db` | não aplicável (sem schema) |

SHAs desta rodada (locais, sem push):

- `abe42511` `fix(contacts): show new contacts and accept Brazilian phone`
- `bdae5b0e` `feat(crm): add commercial origin and reuse contact on new lead`
- `a70413bc` `feat(kanban): reopen lost deals and move from the phone menu`
- `4eeaabbb` `test(crm): lock the commercial kanban path and record the GO`

---

## 9. Commits locais (sem push)

Os quatro acima. Leftovers de outras sessões (manual, IA 360, `.cursor/`, piloto 3C) **não** entraram.

---

MOOPE CRM — KANBAN COMERCIAL OPERACIONAL: SIM

COMERCIAL MOOPE PODE COMEÇAR A USAR AMANHÃ: SIM

BLOCKERS RESTANTES:
NENHUM

BACKLOG NÃO BLOQUEANTE:
- Arrasto Playwright instável; usar menu “Mover para…” (já no card, inclusive no celular)
- Overlay do dossiê × Confirmar perda
- Busca do quadro não inclui telefone do contato
- Timeline mostra “Mudou de estágio” sem o nome da coluna no texto
- Sem analytics de origem
- Orquestração HUMANO × IA × automações (Assumir / Devolver / follow-up) — próxima rodada
- WhatsApp real / assistente publicado — fora deste escopo; 3C publish continua 422 sem canal
