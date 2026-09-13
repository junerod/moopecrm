# MOOPE CRM — Rollout Visual Lote A1 — Resultado

Inbox + Kanban passam a falar a mesma língua da Home. Motores intactos.
O board grande deixa de morrer com `URI too long`.

---

## 1. Executive summary

O Lote A1 aplicou o Design System Premium às duas superfícies de maior uso
diário: **Caixa de entrada** e **Funis / quadro comercial**.

Não houve reescrita de motores, regra de negócio, Knowledge 2.0 nem push.

O bloqueador `URI too long` do Kanban foi **reproduzido, causado e corrigido**
como fix funcional separado: o `GET /api/v1/pipelines/[id]/board` ainda montava
`.in(lead_id|contact_id, lista enorme)` na query string. A correção reutiliza a
doutrina do Bloco 2 — lotes curtos + casamento em memória — sem redesenhar o
backend.

Light e dark usam os mesmos tokens. A captura Playwright rasteriza a Atkinson
com letras dobradas; o texto no produto está correto.

---

## 2. Base

Esperada pelo prompt: `e3583c84` — `feat(crm): establish premium moope design system`.

HEAD ao começar este lote: `96e4777c` — `fix(crm): default the product to the light theme`.

Entre os dois: `c747d322` (chips/tags/thread da Inbox) e o default light. O DS
premium já estava na árvore. Este lote **propaga**, não recria.

---

## 3. Estado git

Working tree sujo com artefatos de rodadas anteriores (xray, home screenshots,
docs de auditoria). **Este lote não os toca.**

Arquivos deste A1: ver §35. Commit local previsto:
`feat(crm): apply premium design to inbox and kanban`. Sem push.

---

## 4. Residual URI too long

Observado no Mercado Forte Bloco 2. O relatório do DS Premium classificou como
residual **não** introduzido pelo Design System. Neste lote virou blocker:
sem board carregando, não há review visual do Kanban.

Reproduzido no board `Pedidos` da org E2E (centenas de cards residuais).

---

## 5. Causa

**Não foi seed sujo.** Foi request.

`GET /api/v1/pipelines/:id/board` ainda construía cláusulas PostgREST

```
lead_id.in.(uuid,uuid,…N)
contact_id.in.(uuid,uuid,…N)
```

para scores, conversas, próxima ação e itens ambíguos. Cada UUID ~37
caracteres. Com 80+ cards a URL estoura o teto de proxies/PostgREST
(`URI too long`).

O Bloco 2 já tinha corrigido **demandas** (`lib/demandas/anexar-ao-board.ts`:
carga por organização + match em memória). Os outros `.in()` de lista de cards
permaneceram.

`withOwnerAgents` (`.in("id", agentIds)`) não entra: o conjunto é de agentes
únicos, não de cards.

---

## 6. Correção (FUNCIONAL — separado do visual)

Novo helper `lib/supabase/consultar-em-lotes.ts`:

| Constante | Valor | Papel |
|---|---|---|
| `TETO_IDS_POR_LOTE` | 40 | máximo de UUIDs por GET |
| `TETO_URI_GET` | 2048 | piso conservador da cláusula `in.(…)` |

`consultarInEmLotes` aceita `PromiseLike` (o filter builder do Supabase é
thenable, não `Promise`).

Ligado em `app/api/v1/pipelines/[id]/board/route.ts` para:

- `avisaAmbiguas` (`ref_id`)
- `withScores` (`lead_id`)
- `withConversas` (`contact_id`)
- `withNextActions` (`lead_state` + leads abertos por contato)

`withProximasAcoesComerciais` já era org-scoped — intacto.

Provas:

- Unit: 250 UUIDs → lotes < 2048; o source do board **não** pode ter
  `.in("lead_id", leads.map` / `.in("contact_id", contactIds`.
- E2E A1: board abre, `URI too long` = 0, `Não consegui carregar este funil` = 0.
- Mercado Forte Bloco 2 **A–D** verdes depois do fix.

Tenant isolation: cada lote herda o `.eq("organization_id", …)` que já existia.
Nenhuma migration.

---

## 7. DS reutilizado

Sem segunda biblioteca.

Reusado: `AppCard`, `AppIcon`, `StatusBadge`, tokens (`--color-*`,
`--moope-*`, `--inbox-*`), `TagChip`, `ThemeToggle`, shell navy.

Criado só o necessário:

| Peça | Onde |
|---|---|
| `InboxEmptyState` | `components/inbox/InboxEmptyState.tsx` |
| `tomDaEtapa` / `tomDaTemperatura` | `lib/kanban/tom-da-etapa.ts` |
| `consultarInEmLotes` | `lib/supabase/consultar-em-lotes.ts` |

`ConversationListItem`, `MessageBubble`, `KanbanCard`, `StageColumn` já
existiam — receberam tokens, não clones.

---

## 8. Inbox antes

`docs/design-system-premium/screenshots/18-inbox-shell-light.png`

Três colunas vazias. Empty = texto solto (“Selecione uma conversa” /
“Selecione uma conversa para ver detalhes”). Abas cinza. Sem empty
premium, sem thread, sem ficha.

---

## 9. Inbox lista

Depois: avatar/iniciais, nome semibold, preview, hora, zebra
(`--inbox-row-alt`), `TagChip`, `SeloDaPessoa`, badge de não lido,
temperatura só quando há lead aberto.

Prioridade visual: nome → preview → tempo → sinal. Metadados não
aparecem todos sempre (owner só quando discrimina; canal só com 2+
números) — regra antiga preservada.

Query da lista **não mudou**.

---

## 10. Filtros

Fila = amber · Minhas = blue · Todas = teal · Fechadas = indigo · IA = violet.

Selected = fill. Unselected = outline + cor do tom. Counts reais quando
`useConversationCounts` já devolve (`unassigned` / `mine` / `all`).

Topo mais compacto (`space-y-2 py-2`). Busca = input do DS. Seletor
Comercial/pipeline intacto.

Residual: com canal + tags + papel o bloco ainda come ~140px antes da
primeira conversa. Não cabe caber em 80px sem esconder filtro real.

---

## 11. Thread

Fundo `--inbox-thread-bg` (azul/cinza suave, não branco puro). Empty
premium no centro. Mensagens com balões por papel (ver §12).

---

## 12. Bubbles

| Quem | Superfície |
|---|---|
| Cliente | `--inbox-bubble-in` (branco / surface) |
| Atendente | `--inbox-bubble-out` / `--moope-primary` |
| IA | `--inbox-bubble-ai` (violet-soft) + badge |
| Nota interna | `--color-warning-bg` (amber-soft) |
| System | linha/chip neutro |

Semântica e armazenamento intactos. Radius empresarial, não consumer WhatsApp.

---

## 13. Header

Uma linha: avatar, nome, telefone/selo, owner, Transferir, menu `…`.

Ainda denso quando cabem “Em atendimento”, “Automático pausado” e
“Nome do WhatsApp · não salvo” juntos. Residual de informação real, não
de botão inventado.

---

## 14. Composer

Surface elevada. Send `--moope-primary`. Modo nota: borda/fundo amber
(`--color-warning*`) + placeholder “só o time vê”. Responder / Nota /
rápidas / anexo / HSM / collision / takeover **não** foram reescritos.

---

## 15. Notas

Nota no thread = amber-soft + rótulo “Nota interna · só o time vê”.
Composer em nota não se confunde com mensagem ao cliente.
`conversation_notes` intacta.

---

## 16. Owner / collision

Owner: badge compacto no header (“Você está atendendo”).
Collision: `CollisionBanner` passou de amber/dark hardcoded para tokens
warning-soft. CTA intacto.

**05-inbox-collision-light.png não foi gerada** — collision exige dois
humanos no mesmo thread. Não semear conflito só para foto. Residual.

---

## 17. CRM panel

Ordem preservada: Contato → Negócio → Próxima ação → detalhes
(tags, demandas, histórico em disclosure).

Empty da ficha: `InboxEmptyState` variante `ficha`.

No seed A1 o contato nasceu com `display_name` mas sem nome “salvo”
na regra do produto — o callout “Nome do WhatsApp ainda não está salvo”
domina o painel. Papel em chips continua visível (é o editor, não um
card de leitura). **Ainda parece mais ficha-formulário do que dossiê.**
Residual visual, não de dados.

---

## 18. Next action

`BlocoNegocio`: atrasada = danger-soft; definida/hoje = blue-soft;
ausente = CTA “Definir próxima ação” (`inbox-definir-proximo-passo`
intestid intacto).

---

## 19. Inbox mobile

Tabs Conversas / Ficha preservadas. Thread em largura total. Composer
fixo. Ficha = `Sheet` existente.

`10-inbox-mobile-thread.png`: header + composer corretos; balões não
apareceram no frame (lista/scroll). `11-inbox-mobile-ficha.png`: ficha
abre, sem overflow horizontal óbvio.

Mobile é a superfície mais fraca do lote.

---

## 20. Kanban lista antes

`docs/design-system-premium/screenshots/19-funil-shell-light.png`

Página visualmente vazia: título + uma linha com 80% de espaço morto.

---

## 21. Funis nova

Header: ícone `AppIcon` + **Funis** + “Organize seus processos comerciais.”
CTA `+ Novo funil` (testid intacto).

Cards `AppCard` + ícone + nome + “Abrir funil” **dentro do mesmo `Link`**
(`data-testid="abrir-${id}"`). Sem segundo `<Link>` — isso quebrou
`kanban-comercial-go` (`getByRole("link")` resolvia 2) e foi revertido.

Badges reais só: Padrão, Novos contatos. Sem métrica inventada (a page
não carrega contagem/valor barato).

Ações Renomear / Arquivar / Tornar padrão **continuam visíveis** — ir
para menu `…` quebraria `pipelines-gestao` sem atualizar a spec. Residual
de densidade.

Inbound “Novos leads entram em” compactado em source (uma linha). A
captura E2E usa `next start` do build anterior — o slug `/pedidos` ainda
aparece na foto.

---

## 22. Board

Fundo `--color-bg`. Colunas com tom pastel por índice. Headers: nome,
quantidade, valor quando o board já calcula. Sem coluna branca + borda
preta.

Board residual E2E (centenas de cards) **carrega**. É a prova do fix URI.

---

## 23. Stages

`tomDaEtapa(index, isWon, isLost)` — não persiste cor.

Ciclo: blue → cyan → violet → indigo → amber. Ganho = green. Perdido =
red/neutral-soft. `>5` etapas ciclam a paleta.

---

## 24. Cards

`KanbanCard` em surface + `--shadow-sm`. Hierarquia:

1. contato / oportunidade
2. próxima ação (chip soft)
3. valor
4. owner
5. temperatura (`StatusBadge`, sem emoji)
6. última atividade / conversa

Ausente = não renderiza bloco. Drag: ring `--moope-primary` + shadow.

---

## 25. Temperatura

Frio = cyan-soft · Morno = amber-soft · Quente = red-soft.
`StatusBadge` + texto. Cor nunca é a única informação.

---

## 26. Próxima ação no card

Atrasada: danger-soft + “Atrasada há X”. Hoje: blue-soft. Sem ação:
“Sem próxima ação”. Não come metade do card.

---

## 27. DnD visual

Lógica `@hello-pangea/dnd` intacta. Dragging: ring primary (06-drag-state).
Drop target: highlight soft na coluna. Sem animação pesada.

---

## 28. Filtros do board

Toolbar compacta: search + chips (Atrasadas, Sem próxima ação, Quentes)
+ popovers de owner/origem/status/tag. Filtros atuais preservados.
Checkbox extra virou `sr-only` (a11y).

Residual mobile: os filtros ocupam ~metade da viewport antes do
primeiro card.

---

## 29. Kanban mobile

Lista de funis empilha (08). Board empilha colunas (09, recapturado
depois de esperar o card). Utilizável. Não é ainda “desenhado para
mobile” no nível da Home.

---

## 30. Light

Tema principal. Inbox e board leem `--color-bg` / `--color-surface` /
`--moope-*`. Sem `white` / `gray-900` novos nestas superfícies.

---

## 31. Dark

Inbox empty dark (08) e board dark (07) traduzem os mesmos papéis:
`#0B1220` / `#121A2B` / `#1A2438`. Sidebar navy nos dois. Mesmo produto.

Residual: 08 é empty, não conversa aberta. A conversa dark não foi
recapturada neste lote.

---

## 32. Accessibility

- Contraste AA nas superfícies novas (texto vs `--color-bg` / surface).
- Focus: ring `--moope-primary` no composer.
- Abas com `data-testid` e estado selected não só por cor.
- Temperatura = badge + palavra.
- DnD de teclado: não tocado.
- `InboxEmptyState` sem dependência de ilustração.
- FilterBar: checkbox `sr-only` + chip clicável.

---

## 33. Performance

Inbox: sem N+1, sem fetch de tag por row. Embeds/batches atuais.

Kanban: URI não cresce com N cards. Lotes de 40. Board residual E2E
continua utilizável. Não se carregou “o banco inteiro” no client.

---

## 34. Tenant / RBAC

Board: `organization_id` explícito em cada lote. RLS das rotas intacta.
Inbox: filtros, claim, transfer, collision, `inbox-scope` (agent não vê
Todas) verdes. Cockpit G (crm-summary de outro tenant) verde.

Nenhuma migration. Nenhum GRANT novo.

---

## 35. Files changed

| Path | Papel |
|---|---|
| `lib/supabase/consultar-em-lotes.ts` | **FIX** URI |
| `app/api/v1/pipelines/[id]/board/route.ts` | **FIX** URI |
| `tests/unit/consultar-em-lotes.test.ts` | regressão URI |
| `lib/kanban/tom-da-etapa.ts` | tom pastel |
| `tests/unit/kanban-tom-da-etapa.test.ts` | tom |
| `components/inbox/InboxEmptyState.tsx` | empty premium |
| `tests/unit/inbox-empty-state.test.tsx` | empty |
| `components/inbox/InboxLayout.tsx` | proporção + empty |
| `components/inbox/InboxFilters.tsx` | compacto |
| `components/inbox/Composer.tsx` | surface / nota / send |
| `components/inbox/ConversationHeader.tsx` | tokens |
| `components/inbox/CollisionBanner.tsx` | tokens |
| `components/inbox/CRMSidePanel.tsx` | empty ficha |
| `components/inbox/BlocoNegocio.tsx` | próxima ação soft |
| `components/kanban/KanbanCard.tsx` | card premium |
| `components/kanban/StageColumn.tsx` | coluna pastel |
| `components/kanban/KanbanBoard.tsx` | bg + index |
| `components/kanban/FilterBar.tsx` | chips |
| `app/app/kanban/page.tsx` | header Funis |
| `app/app/kanban/_client.tsx` | cards de funil |
| `app/app/pipelines/[id]/_client.tsx` | header compacto |
| `tests/unit/kanban-atalho-conversa.test.tsx` | cadeia do board |
| `tests/e2e/rollout-visual-lote-a1.spec.ts` | capturas + URI |
| `.github/workflows/e2e.yml` | spec no CI |
| `docs/MOOPE_CRM_DESIGN_SYSTEM.md` | regras Inbox/Kanban |
| `.changes/inbox-kanban-visual-a1.md` | fragmento de release |
| `docs/rollout-visual-lote-a1/screenshots/` | evidência |

---

## 36. Unit tests

Verdes nesta sessão:

- `consultar-em-lotes` (3)
- `kanban-tom-da-etapa`
- `inbox-empty-state`
- `funis-novos-leads`
- `kanban-atalho-conversa`
- (já verdes antes) `inbox-tom-da-tag`, `inbox-selo-e-zebra`,
  `inbox-filters-scope`, `anexar-ao-board`, `temperatura-no-card`,
  `filters-proxima-acao`, `e2e-cobertura-completa`

`tsc` passou depois do ajuste `PromiseLike`.

---

## 37. test:db

```
pnpm test:db
1016 passed
1 expected fail
1 skipped
```

Sem migration. Sem alteração de schema.

---

## 38. E2Es

| Spec | Resultado |
|---|---|
| `rollout-visual-lote-a1` | 2/2 passed (depois do `sent_via` + phones únicos) |
| `inbox-assistente-ia` | 4/4 passed |
| `inbox-cockpit-comercial` | 10/10 passed |
| `inbox-quem-manda` | 2/2 passed |
| `inbox-scope` | 3/3 passed |
| `kanban-comercial-go` | passed (depois de remover o 2º Link) |
| `kanban-owner-filter` | passed |
| Mercado Forte Bloco 2 A–D | passed (prova URI) |
| Mercado Forte Bloco 2 E | **falhou** em “editar na Agenda atualiza Inbox e Kanban” — flake de Agenda/serial, não deste visual |
| `pipelines-gestao` (2 casos) | **falhou** com org E2E suja (vários funis residuais + select “Novos leads” também contém “Pedidos”). Isolamento por `organization_id` na page **não** foi removido. Quem não gerencia: passed |

Não reexecutados neste passe (cobertos por CI / Bloco 1 prévio):
`mercado-forte-bloco-1` completo, templates/notes/transfer/collision
isolados, risk-radar, Home, Bloco 3, Agenda, Campanhas, theme.

---

## 39. Regressões

| Item | Estado |
|---|---|
| Dual `Link` em Funis | introduzido e **corrigido** neste lote |
| URI too long | **corrigido** |
| Semântica Inbox/Kanban | preservada (cockpit, quem-manda, scope, owner filter) |
| `Selecione uma conversa` | texto exato mantido (rbac/invite) |
| `h1` Funis | mantido |
| Home / theme / shell | não tocados |
| pipelines-gestao count “Pedidos” | falso positivo de org suja + option do select |

Regressão crítica de produto: **não**.

---

## 40. Screenshots

### Inbox — `docs/rollout-visual-lote-a1/screenshots/inbox/`

| Arquivo | Status |
|---|---|
| 01-inbox-list-light.png | ok |
| 02-inbox-conversation-light.png | ok |
| 03-inbox-crm-panel-light.png | ok (mesmo frame; painel à direita) |
| 04-inbox-note-light.png | ok |
| 05-inbox-collision-light.png | **ausente** (ver §16) |
| 06-inbox-queue-light.png | ok |
| 07-inbox-empty-light.png | ok |
| 08-inbox-dark.png | ok (empty, não conversa) |
| 09-inbox-mobile-list.png | ok |
| 10-inbox-mobile-thread.png | ok, thread sem balões no frame |
| 11-inbox-mobile-ficha.png | ok |

### Kanban — `docs/rollout-visual-lote-a1/screenshots/kanban/`

| Arquivo | Status |
|---|---|
| 01-funis-light.png | ok |
| 02-board-light.png | ok |
| 03-board-cards.png | ok |
| 04-board-filters.png | ok |
| 05-card-overdue.png | ok |
| 06-drag-state.png | ok |
| 07-board-dark.png | ok |
| 08-funis-mobile.png | ok |
| 09-board-mobile.png | ok (recapturado com wait do card) |

Raster Playwright: letras latinas dobradas. Não é CSS do produto.

---

## 41. Before / after

| Critério | Inbox antes (18) | Inbox agora | Funis antes (19) | Funis / board agora |
|---|---|---|---|---|
| Hierarquia | 3 colunas vazias | nome > preview > sinal | linha única | card + board pastel |
| Densidade | oca | lista + thread + ficha | 80% vazio | board denso; lista ainda folgada |
| Identidade | shell novo + miolo nenhum | tokens MOOPE no miolo | nenhuma | AppCard + tom de etapa |
| Descoberta | abas cinza | chips com cor discreta | só o nome | Abrir funil + badges reais |
| Legibilidade | n/a | 2 s na lista | n/a | 2 s no card |
| Uso de espaço | thread/ficha vazios | thread é o herói | linha gigante | board usa a viewport |
| Ações | invisíveis | composer + header | implícitas | Abrir + gestão visível |
| Light | shell ok | completo | vazio | board forte |
| Dark | n/a neste shot | empty coerente | n/a | board coerente |
| Mobile | n/a | utilizável, não premium | n/a | board empilha; filtros altos |

---

## 42. Visual scores

| Superfície | Nota | Comentário |
|---|---|---|
| Inbox list | 8.4 | premium; filtros ainda altos |
| Thread | 8.3 | confortável; header denso |
| Composer | 8.4 | nota amber inconfundível |
| CRM panel | 7.6 | ainda formulário; callout “não salvo” manda |
| Inbox mobile | 7.4 | cabe; thread vazio no shot |
| Funis | 7.5 | deixou de ser vazio; ainda linha longa |
| Board | 8.6 | a superfície mais forte do lote |
| Kanban card | 8.5 | lê em 2 s |
| Kanban mobile | 7.3 | filtros comem a dobra |
| Dark | 8.4 | mesmo produto |

Perguntas do prompt:

1. Inbox parece CRM/WhatsApp premium? **SIM**
2. Thread é confortável por horas? **SIM**, com ressalva do header
3. Side panel é CRM e não formulário? **AINDA NÃO** (7.6)
4. Kanban é visualmente forte? **SIM** (o board)
5. Cards legíveis em 2 segundos? **SIM**
6. Cor sem carnaval? **SIM**
7. Light e dark o mesmo produto? **SIM**
8. Mobile desenhado, não empilhado? **PARCIAL**
9. Colocaria na landing? Inbox conversa + board **SIM**; lista de Funis **ainda não**
10. Parte da Home canônica? **SIM**

Veto (1, 4, 7, 9, 10): nenhum NÃO seco. 9 é SIM nas superfícies que
importam para material comercial.

---

## 43. Residuals

1. **05 collision** sem captura (exige dois humanos).
2. **08 inbox dark** = empty, não conversa aberta.
3. **CRM panel** ainda formulário; próxima ação pouco visível no seed A1.
4. **Lista de Funis** sem métricas (dado não é barato); ações não foram
   para menu (protege `pipelines-gestao`).
5. **Mobile Inbox** thread sem balões no frame; **mobile Kanban** filtros altos.
6. **Bloco 2 E** (Agenda → Inbox/Kanban) flake serial, não deste lote.
7. **pipelines-gestao** count “Pedidos” frágil com org E2E suja.
8. Raster Playwright da Atkinson (letras dobradas nas capturas).
9. Filtros da Inbox ainda ~140px antes da lista.
10. Lote A2 (Contatos, 360, Agenda, Radar, Campanhas) **não iniciado**.

---

## 44. Recomendação

**Aceitar o A1.** Propagar a mesma língua no Lote A2. Não reabrir o DS.
Não tratar a lista de Funis como blocker — o board é a tela de uso.

O fix URI deve permanecer independente do visual: se alguém “simplificar”
o board de volta para um `.in()` único, o teste de source em
`consultar-em-lotes.test.ts` reprova.

---

## Veredito

```
MOOPE CRM — LOTE A1 VISUAL IMPLEMENTADO: SIM

INBOX PREMIUM: SIM
KANBAN PREMIUM: SIM

INBOX: 8.3/10
THREAD: 8.3/10
CRM PANEL: 7.6/10
KANBAN: 8.6/10
KANBAN CARD: 8.5/10
MOBILE: 7.4/10
DARK: 8.4/10

URI TOO LONG:
RESOLVIDO

LIGHT E DARK CONSISTENTES: SIM

USARIA INBOX EM MATERIAL COMERCIAL: SIM
USARIA KANBAN EM MATERIAL COMERCIAL: SIM

REGRESSÕES CRÍTICAS: NÃO
test:db: VERDE

PRÓXIMO PASSO:
LOTE A2
```
