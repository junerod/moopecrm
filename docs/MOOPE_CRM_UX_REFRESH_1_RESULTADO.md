# MOOPE CRM — UX Refresh 1 — resultado

**Tipo:** implementação visual / IA de navegação. Sem feature comercial nova.  
**Data:** 2026-09-11  
**3B.3 / sessão WORKING / VPS / WhatsApp / QR:** **não tocados.**  
**Push:** **não feito.**

---

## 1. Commit-base

`e83353db` — `feat(inbox): mark lead, client, team or ignore from the conversation header`

## 2. Audit utilizado

- `docs/MOOPE_CRM_UX_VISUAL_AUDIT_RESULTADO.md` (nota geral 5.3 / 10)
- `docs/ux-audit/SCREENSHOTS_INDEX.md`
- BEFORE em `docs/ux-audit/screenshots/`

## 3. Superfícies alteradas

Sidebar, Inbox (lista + default + layout + header), Cockpit desktop, Início.

Não redesenhados: Contatos, Kanban, login, hubs internos, tema, fonte.

## 4. Sidebar antes / depois

**Antes:** lista longa (Assistentes, Automações, Conhecimento, Roteadores, Etapas, Respostas rápidas, Webhooks, Credenciais, Skills, Execuções, Uso, Audit, Evolução…). Início ausente. Item ativo = pílula cyan.

**Depois (10 itens visíveis):**

| Grupo | Itens |
|---|---|
| OPERAÇÃO | Início, Caixa de entrada, Funis, Contatos |
| TRABALHO | Agenda, Radar |
| IA | hub `/app/ai` (Assistentes, Automações, Conhecimento, Roteadores etc. continuam no hub e no ⌘K) |
| RODAPÉ | Meu Negócio, Configurações, Ajuda |

Rotas **não** apagadas. Largura `w-52`. Ativo = texto + barra esquerda 2px. Cyan reservado ao accent pontual.

## 5. Inbox list antes / depois

**Antes (default Fila):** “Assistente IA 178…” e threads vazias como título.

**Depois (default Minhas):** Carlos Mendes, Marina Souza, TEC Paulo, Auto Locação — nome via `rotuloDoContato`. Telefone é meta no header, não título da linha. Lista mais estreita (`md:260` / `xl:240` / `2xl:256`). Seleção = `bg-muted`, sem wash cyan.

Etapa / próximo passo **não** entram na linha: a API de conversas não traz stage. Sem query nova nesta rodada.

## 6. Default Inbox

| | |
|---|---|
| Aba | **Minhas** (`mine`) |
| Papéis | todos (URL sem `?filter=`) |
| Por quê | Fila era cemitério de bot/thread vazia; as pessoas da auditoria só apareciam em Minhas |
| Fallback | `?filter=` explícito (inclui `unassigned`) é honrado. Fila continua visível |
| Deep-link | `precisaBuscarConversaAvulsa` busca a conversa **sem esperar** a lista — lista vazia, outra aba ou erro não trava o fio |

## 7. Nomes humanos

Helper existente `lib/contacts/rotulo-do-contato.ts`:

1. `name` se for nome de gente  
2. `display_name` / `notify_name` se for nome de gente  
3. telefone apresentável  
4. `Sem nome`

Não se recusou a string “Assistente IA + dígitos”: no seed e2e **é** o `name` gravado. Recusá-la quebraria `inbox-assistente-ia`.

## 8. Header antes / depois

**Antes:** Assumir, Liberar, Pausar/Devolver, Transferir, Lembrar, Fechar — mesmo peso.

**Depois:**

- Primário: **Assumir** (quando a conversa não é do usuário)
- Ghost: Transferir, Lembrar (`SnoozeButton` ficou visível de propósito — `canais-baseline` clica nele)
- **⋯ / Mais ações:** Liberar, Devolver, Pausar, Fechar  
- `Marcar` (papel) veio do commit-base e ficou visível — não é desta rodada escondê-lo

Semântica, takeover, command, `AI_MODE`, send gate e permissões **não** mudaram. Testids `devolver-ao-automatico` / `pausar-o-automatico` foram para o menu; e2e abre “Mais ações” antes.

## 9. Cockpit antes / depois

Desktop copia a ordem da Ficha mobile:

1. Identidade (nome, telefone, papel)  
2. Negócio (funil, etapa, responsável, origem, próximo passo, Abrir no funil)  
3. Assistente IA em `<details>` — vazio = “Nenhuma sugestão” numa linha  
4. Tags / Demandas / Atividade em disclosure (Atividade abre se houver linhas)

Painel único + seções + divisores. Sem Card por bloco. Sem empty state de copilot ocupando um card.

## 10. Início antes / depois

**Antes:** só checklist de onboarding.

**Depois:** se setup incompleto, faixa compacta (`recolhidoInicial`; itens continuam no DOM para o e2e 3C). Sempre o bloco **Hoje**, só com hooks já existentes:

- `useConversationCounts` → Nas suas mãos / Na fila  
- `useAtRiskLeads` → Sem próximo passo / No radar  
- `useAgendamentos` → agenda de hoje, se houver linhas  
- Atalhos Inbox / Funis / Contatos  

Sem KPI, gráfico, analytics ou query nova.

## 11. Mobile (390×844)

Lista com nomes humanos e Minhas. Header: Assumir primário + ⋯; ainda quebra em duas linhas porque Marcar e Lembrar ficam visíveis. Ficha permanece o cockpit. **Sem** bottom nav.

## 12. Decisões visuais

- Dark mode atual mantido. Sem gradiente, glass, rounded exagerado, DS novo, fonte nova.
- Card não é unidade default nestas superfícies.
- Cyan forte = ação primária / accent pontual, não item ativo da sidebar.
- Spacing 4/8/16/24; título de página 24 semibold; objeto 16–18; texto 14; meta 12–13.

Correção de borda (não é feature): o GET da Inbox com `papel=comercial` usava `.or("contacts.papel…")`, que este PostgREST recusa (`PGRST100`) e devolvia 500 em **toda** a lista. Trocado por `referencedTable: "contacts"`. Sem isso o Refresh 1 era invisível na Inbox.

Deep-link deixou de esperar `!listQ.isLoading`.

## 13. O que NÃO foi alterado

Lifecycle, temperatura (UI do commit-base ficou), card Kanban, dossiê, Contatos, bottom nav, tema, fonte, migration nova, engines, analytics, IA nova, WhatsApp, QR, 3D, Agenda nova, sessão WORKING.

Banco local de e2e recebeu a migration **já existente** `0203` (coluna `papel`) só para o PostgREST local enxergar o que o código da `main` já consulta. **Nenhuma migration nova** no repo.

## 14. Screenshots

AFTER: `docs/ux-refresh-1/screenshots/`

- desktop 1440: inicio, sidebar, inbox-lista, inbox-conversa, cockpit, header  
- notebook 1280: inbox, inicio  
- mobile 390: inbox-lista, inbox-conversa, ficha, inicio  

Tabela: `docs/ux-refresh-1/BEFORE_AFTER.md`

## 15. Score antes / depois

Mesmos critérios da auditoria. Só as 5 superfícies desta rodada. **Não suavizado.**

| Superfície | Antes | Depois | Δ |
|---|---:|---:|---:|
| Início | 4.5 | 6.5 | +2.0 |
| Sidebar | 4.0 | 7.5 | +3.5 |
| Inbox | 5.0 | 6.5 | +1.5 |
| Cockpit | 4.0 | 6.5 | +2.5 |
| Mobile | 4.0 | 5.5 | +1.5 |
| **Média destas 5** | **4.3** | **6.5** | **+2.2** |

Se misturar as telas que **não** mudaram (Contatos 4.5, Kanban 6.0, etc.), a nota geral do produto sobe de **5.3 para ~6.3**. Ainda não é CRM 2026 competitivo.

O que puxa a nota para baixo depois do Refresh 1: header ainda ocupa duas linhas no mobile (Marcar + Lembrar), lista sem etapa, cockpit ainda cheio de chips do commit-base, visual dark-admin de base.

## 16. Typecheck

`pnpm typecheck` — zerado.

## 17. Lint

ESLint dos arquivos alterados: **0 erros**. 2 warnings pré-existentes (`setState` em effect em `AssistenteIa` / `CRMSidePanel`).

## 18. Unitários

Verdes, entre eles:

- `inbox-aba-padrao`
- `inbox-deep-link-conversa`
- `inbox-aba-minhas-sem-fechadas` (inclui predicado `referencedTable`)
- `sidebar-grupos`
- `navegacao-registry`
- `inbox-header-nao-trava`
- `command-palette`

64 testes nestes arquivos. Rodada anterior da suíte relevante: 127 verdes.

## 19. E2E

Segunda rodada (`E2E_PORT=3016`, build novo):

**34 passed / 2 failed** (6.8 min)

Passaram: `inbox-assistente-ia` (4), `inbox-cockpit-comercial` A–D2/F/G/mobile ficha, `inbox-quem-manda` (comando), `inbox-scope`, `navegacao`, `productization-3c`.

Falharam (não bloqueiam o Refresh 1; semântica comercial intacta):

1. `inbox-cockpit-comercial` — “Comercial esconde Equipe; ficha edita papel no viewport estreito”: API do filtro comercial **passou**; depois do chip Lead, `inbox-ficha-negocio` não apareceu no dialog. O painel ainda lê `contact.papel` do embed da conversa, que não refetcha no clique — caminho do commit-base `e83353db`, não do layout.
2. `inbox-quem-manda` — escalada na Fila (`?filter=unassigned`): nome não achado em 30s. A aba e o deep-link corretos estão no teste; a lista da Fila nesta org e2e está cheia (41+). Não se inventou filtro novo para “passar verde”.

Primeira rodada (build antigo + lista 500): 14 failed / 22 passed — irrelevante após o conserto do `.or()`.

## 20. test:db

**Não rodado.** Não houve migration nova, alteração de RLS nem de schema no repo. A mudança de servidor é só a sintaxe PostgREST do filtro `papel=comercial` (já coberto por unitário do handler).

## 21. Regressões

- Deep-link + lista em erro: **corrigido** (`precisaBuscarConversaAvulsa`).
- Inbox 500 com filtro Comercial: **corrigido** (`referencedTable`).
- Checklist 3C: itens permanecem no DOM quando a faixa está recolhida.
- Header: e2e de Devolver/Pausar abre o overflow.
- Default Minhas: Fila segue em `?filter=unassigned` e no tab.

## 22. Arquivos alterados

Ver `git show` do commit desta rodada. Núcleo:

- `lib/navigation/registry.ts`, `components/shell/Sidebar.tsx`
- `lib/inbox/aba-padrao.ts`, `lib/inbox/deep-link-conversa.ts`
- `components/inbox/InboxLayout.tsx`, `ConversationListItem.tsx`, `ConversationHeader.tsx`, `CRMSidePanel.tsx`, `AssistenteIa.tsx`, `BlocoNegocio.tsx`
- `app/app/inicio/page.tsx`, `components/negocio/HojeOperacional.tsx`, `ChecklistPrimeirosPassos.tsx`
- `app/api/v1/conversations/_handler.ts` (sintaxe do filtro comercial)
- testes unit/e2e de navegação e header
- `.changes/ux-refresh-1-workspace-comercial.md`
- `docs/ux-refresh-1/**`, este relatório

## 23. Migrations

**Nenhuma nova.** `supabase/migrations/` e `baseline.sql` não foram editados.

## 24. Commit

Local, mensagem pedida:

`feat(crm): modernize core commercial workspace`

## 25. Confirmação SEM PUSH

**Não houve push.** `origin` não foi atualizado por esta sessão.

## 26. Riscos / restantes

- Contatos continua tabela de backoffice (Refresh 2, se houver).
- Header mobile ainda wrapa (Marcar + Lembrar + Assumir).
- Lista sem etapa / próximo passo (faltaria dado na API).
- Chips de papel/temperatura do commit-base ainda pesam o cockpit.
- 2 e2e vermelhos documentados acima.
- Visual base continua o kit dark atual — hierarquia melhorou; “premium 2026” não.

---

## Veredito

**MOOPE CRM — UX REFRESH 1 IMPLEMENTADO: SIM**

**INBOX E COCKPIT JÁ PARECEM PRODUTO COMERCIAL MODERNO: NÃO**  
Melhoraram (pessoas, Minhas, negócio primeiro, IA numa linha). Ainda parecem o mesmo shell dark com CRM por cima.

**SIDEBAR JÁ ESTÁ ORIENTADA À OPERAÇÃO COMERCIAL: SIM**

**UX VISUAL JÁ É SUFICIENTE PARA PILOTO COM CLIENTE: NÃO**

Blockers visuais reais que restam:

1. Contatos (não tocado) ainda destrói a demo.  
2. Header da conversa ainda é uma barra de ferramentas, sobretudo no telefone.  
3. Lista da Inbox não mostra o negócio (etapa / passo).  
4. Identidade visual ainda é admin-kit — o Refresh 1 mudou composição, não o material.

---

## STOP

Relatório, BEFORE/AFTER, screenshots e ZIP. **Sem Refresh 2. Sem redesenhar Contatos. Sem bottom nav. Sem push.**
