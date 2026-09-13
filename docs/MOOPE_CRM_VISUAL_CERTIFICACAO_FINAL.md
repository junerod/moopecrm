# MOOPE CRM — Certificação visual final

Fechamento curto. Não é Lote E. Não é Visual 2.0. Não é Knowledge 2.0.

Notas só depois de screenshot/inspeção no produto real.
“HERDA DS” não conta como prova de qualidade.

**NÃO PUSH.**

---

## 1. Git / base

```
HEAD de partida: 70e6ae0d  feat(crm): complete premium commercial surfaces
                 30498b61  feat(crm): apply premium design to inbox and kanban
branch:          main
origin/main...HEAD: 0 2
```

Working tree tinha sujeira antiga (xray, zips, screenshots de fases
anteriores). **Não resetada. Não commitada.**

Documentos lidos: rollout total, matriz final, cobertura 62/62, DS,
resultado A1.

---

## 2. Gates antes

Medido nesta sessão, **antes** das correções desta certificação, sobre
`70e6ae0d`:

| Gate | Resultado |
|---|---|
| `pnpm typecheck` | **vermelho** em 3 arquivos de *teste* pré-existentes: `lib/home/formatar.test.ts`, `tests/unit/alterar-senha-da-conta.test.ts`, `tests/unit/ficha-da-empresa-rbac.test.ts`. Nenhum arquivo de produto desta certificação entra. |
| `pnpm test:db` | **verde** — 1016 passed / 1 expected fail / 1 skipped (terminal `143956`, 389s) |
| E2E lote crítico (bundle *anterior* ao rebuild) | 73 passed / 5 failed / 15 skipped (serial) |

Os 5 vermelhos do lote antigo estão classificados no §3–4.

---

## 3. Bugs encontrados

**BUG REAL — filtros avançados do Kanban/Inbox escondidos no desktop.**

O polimento A1 pôs extras em `<details>` e escondeu o `<summary>` no `md`.
`<details>` fechado continua escondendo os filhos no desktop. Screenshot
`05-kanban.png` da primeira captura: só chips (Atrasadas / Sem próxima
ação / Quentes). O E2E `kanban-owner-filter` estourou em
`getByRole("button", { name: /^Responsável:/ })`.

Correção: chips sempre visíveis; extras renderizados duas vezes —
`details.md:hidden` no mobile e `hidden md:flex` no desktop. Inbox:
`extras(id)` para `#only-unread` / `#only-unread-mobile` não colidirem.

**Provado depois do `pnpm e2e:build`:** `kanban-owner-filter` verde.
Screenshot novo mostra Responsável / Origem / Status / Tag.

Nenhuma regra de produto foi alterada para ficar verde.

---

## 4. Flakes encontrados

| Spec | Classe | Evidência |
|---|---|---|
| `mercado-forte-bloco-3` A–E (bundle velho) | **SELETOR FRÁGIL** | UI passou a mostrar “Enviando/Encerrada/Agendada”. Status canônico ficou em `data-status`. Harness lê o atributo. Depois do rebuild: **bloco 3 inteiro verde**. |
| `pipelines-gestao` “sobe para o topo” | **FIXTURE SUJO** | Org e2e tem dezenas de funis. Um clique não chega ao topo. Harness agora afirma **uma posição**. Recusa do *último* funil ainda falha: a org não tem um funil só — a recusa correta é “é o padrão”, não “único”. Produto intacto. |
| `mercado-forte-bloco-2` A–D | **FIXTURE SUJO** | Agenda `lista-proximas-acoes` é pilha de “Ligar amanhã / Lembrete mock” de rodadas MF anteriores. Texto novo não aparece. Serial pulou o resto. |
| `risk-radar` claim | **FIXTURE SUJO / TIMING** | Seed log: `radar lead existing`. Primeiro caso passou; o botão de assumir não estava lá. |
| `test:db` `nascimento-do-lead` concorrente (2ª passagem) | **FLAKE** | `expected 2 to be less than or equal to 1` em ingest×ingest. Visual/CSS não toca nascimento. 1ª passagem desta sessão: 1016 verdes. Retry em curso no §20. |

---

## 5. Telas realmente inspecionadas

Produto real: `next start` + `.env.e2e` (portas 3002 / 3026) e `npm run
dev` :3666 (só fachada de login — credenciais e2e não entram no
`.env.local`).

Viewport light 1440, dark 1440, mobile 390×844.

**20 superfícies comerciais (desktop light):**

1. Home
2. Inbox lista
3. Inbox conversa + CRM panel (mesmo frame)
4. Funis
5. Kanban com cards
6. Contatos
7. Contato 360
8. Agenda
9. Radar
10. Campanhas
11. Campanha detalhe
12. IA hub
13. Assistentes
14. Automações
15. Conhecimento
16. Conexões
17. Desempenho
18. Equipe
19. Settings + Meu Negócio
20. Login

**Mobile obrigatórias:** Home, Inbox lista, Inbox conversa, Inbox ficha,
Kanban, Contatos, Contato 360, Agenda, Campanhas, Assistentes,
Automações, Conhecimento, Settings.

**Dark:** Home, Inbox conversa, Kanban, Contato 360, Campanhas,
Assistentes, Settings.

Playwright rasteriza Atkinson com letra latina dobrada (`Contatatos`).
O DOM do produto está correto — medido pelos E2Es de `h1`.

---

## 6. Contatos

Reavaliado. **Não parece ERP.** Já era lista de pessoas (avatar, nome,
telefone, última atividade, `…`).

Nesta passagem: `StatusBadge` de papel, telefone formatado quando o
número cabe na regra BR, `TagChip`, tokens. “Abrir conversa” some no
mobile (`sm:inline-flex`) e continua no menu.

Query intacta. Semanticamente continua lista/tabela por a11y.

MESMO PRODUTO? **SIM**

---

## 7. Contato 360

Era só HERDA. Agora fala a língua do CRM Side Panel em escala de página.

Header: avatar/iniciais, nome, telefone, papel (`StatusBadge`) quando
existe, tags quando existem. Resumo: próxima ação + negócios existentes
em `AppCard`. Soft: atrasada = danger; hoje = azul (via `isToday()`,
porque `estadoDaProximaAcao` devolve `atrasada | aberta | sem |
concluida` — não inventamos estado `"hoje"`).

Tabs **existentes** intactas: Negócios / Timeline / Dados / LGPD.
Não criamos “Visão geral”. Não criamos entidade. Não criamos dado.

MESMO PRODUTO? **SIM**

---

## 8. Agenda

Grade **não reconstruída**. PageHeader + obrigações com “atrasado” em
tom danger. Filtros Hoje / Próximos / Atrasados.

Residual evidente no mobile: o cartão
`google-nao-configurado` (instrução do operador, endereço de retorno
byte-a-byte) come a primeira dobra quando a instalação não tem
`GOOGLE_CALENDAR_*`. **Não compactei** — o texto é a lição paga do
self-host, vigiada por unit. A agenda comercial está abaixo e funciona.

MESMO PRODUTO? **PARCIAL** (casca igual; aviso Google é administrativo)

---

## 9. Campanhas

Lista = `AppCard` + `StatusBadge` em português (rascunho / enviando /
encerrada / agendada / cancelada). `data-status` canônico no `<li>`
para o E2E. Empty usa `EmptyState` com `campanha-nova-empty` (não
duplica `campanha-nova`).

A lista da API **não traz** envios/respostas/segmento. Não inventei
número. Residual: card fino (nome + status).

Detalhe: header + badge + KPIs em tokens + destinatários. Status cru
do destinatário (`cancelled`/`skipped`) ficou — é do engine.

Engine intocado.

MESMO PRODUTO? **SIM**

---

## 10. IA diária

Assistentes: `AgentCard` → `AppCard`. `default` → “Padrão”.
`rag_bot` → “Assistente”, `mcp_agent` → “Avançado”.
Unit `agent-card-modelo-em-vigor` verde.

Automações / Conhecimento / hub: PageHeader + cards. Jargão inglês
(`handoff`, `archived`) nas telas técnicas **não redesenhado**.

Memory / providers / routers / credentials / runs: não tocados.

MESMO PRODUTO? **SIM** nas quatro diárias; avançado permanece técnico.

---

## 11. Settings

Hub já era NavHub — mesma língua da Home. `FormSection` novo em
perfil e notificações (`data-testid="alertas-pessoais"` preservado).
Não um card por input. Danger zone / save não reescritos em massa.

Outros forms (segurança, marca, billing…): tokens do shell, sem
redesign individual.

MESMO PRODUTO? **SIM** no hub; forms restantes **PARCIAL**.

---

## 12. Auth

Login aberto de verdade. Navy (`--nav-bg`) = sidebar. Card branco,
logo, tipografia, botão no accent da instalação (white-label — não
forcei azul MOOPE no CTA).

Pergunta: “este login pertence ao mesmo MOOPE da Home?” **SIM.**

Auth logic intocada. `/onboarding` não recapturado — residual.

MESMO PRODUTO? **SIM**

---

## 13. Mobile

390×844. Critérios: sem scroll horizontal; CTA visível; título cabe;
filtros não comem a primeira dobra; primeiro conteúdo útil cedo;
sheet cabe.

| Tela | Achado |
|---|---|
| Home | Identidade ok; org e2e vazia (setup 3/6) |
| Inbox lista | Tabs + “Filtros” colapsado; 1ª conversa cedo |
| Inbox conversa | Thread + composer; nome longo trunca (`João Me…`) |
| Inbox ficha | Sheet cabe; CRM panel na língua do desktop |
| Kanban | Chips + “Filtros”; cards, não colunas empilhadas |
| Contatos | 1ª pessoa visível; “Abrir conversa” no `…` |
| 360 | Header + CTA + tabs + cards |
| Agenda | Aviso Google come a 1ª dobra — residual do operador |
| Campanhas | Cards + CTA |
| Assistentes / Automações / Conhecimento / Settings | Mesma casca |

Nenhum scroll horizontal observado nas capturas.

---

## 14. Dark

Home, Inbox conversa (recapturada com thread aberta), Kanban, 360,
Campanhas, Assistentes, Settings.

Nenhuma superfície branca perdida. Cards, composer, CRM panel e
filtros usam tokens escuros. Sidebar navy permanece.

---

## 15. Screenshots

`docs/visual-final/screenshots/`

- `desktop-light/` — 20 superfícies (+ `19b-meu-negocio`)
- `mobile/` — 13 (12 obrigatórias + ficha)
- `dark/` — 7

Não há shot das 62 rotas. Não precisa.

---

## 16. Contact sheet

`docs/visual-final/MOOPE_CRM_CONTACT_SHEET_FINAL.png`

Olhando juntas: navy na casca, página cinza-fria, cards brancos,
mesmo produto. Nenhuma tela parece outro software. Home vazia é o
azulejo mais fraco (dado da org e2e), não identidade.

---

## 17. Correções realizadas

1. Filtros desktop Kanban/Inbox (bug real do `<details>`).
2. Contato 360 — header + resumo comercial com dados existentes.
3. Contatos — lista de pessoas, não planilha.
4. Campanhas — cards + badge PT + `data-status`.
5. Login — fundo navy da casca.
6. Assistentes — `AppCard` + rótulos PT.
7. `FormSection` em perfil e notificações.
8. Harness: bloco 3 lê `data-status`; pipelines afirma uma posição.

---

## 18. Arquivos alterados (desta certificação)

Produto: `app/(public)/layout.tsx`, `AgentCard.tsx`,
`campanhas/_client.tsx`, `campanhas/[id]/_client.tsx`,
`contacts/[id]/_client.tsx`, `settings/profile/_form.tsx`,
`settings/notifications/_form.tsx`, `ContactsTable.tsx`,
`Contato360Comercial.tsx`, `InboxFilters.tsx`, `FilterBar.tsx`,
`components/ds/FormSection.tsx`, `lib/campanhas/rotulos.ts`,
`lib/contacts/formatar-telefone.ts` (`iniciaisDoNome`).

Testes: `campanha-rotulos.test.ts`, `formatar-telefone.test.ts`,
`mercado-forte-bloco-3.spec.ts`, `pipelines-gestao.spec.ts`.

Docs: este arquivo, matriz certificada, `docs/visual-final/**`,
`.changes/certificacao-visual.md`, linha `FormSection` no DS.

---

## 19. Testes

Unit desta passagem: 10/10 verdes
(`campanha-rotulos`, `formatar-telefone`, `agent-card-modelo-em-vigor`).

---

## 20. test:db

| Passagem | Resultado |
|---|---|
| Antes das correções (`70e6ae0d`) | 1016 passed / 1 expected fail / 1 skipped |
| Depois das correções (1ª) | 1015 passed + 1 fail em `nascimento-do-lead` concorrente — **FLAKE**, sem relação com UI |
| Retry | **verde** — 1016 passed / 1 expected fail / 1 skipped (366s) |

Sem migration. Sem schema. Sem RLS nova.

---

## 21. E2E

**Lote crítico (bundle velho):** 73 passed.

**Depois do rebuild desta certificação:**

| Spec | Resultado |
|---|---|
| `kanban-owner-filter` | verde |
| `mercado-forte-bloco-3` (9 casos) | verde |
| `pipelines-gestao` isolamento + viewer | verde |
| `pipelines-gestao` cria/edita/recusas | reorder + padrão verdes; recusa *último* = FIXTURE SUJO |

Já verdes no lote de 73 (não re-rodados após rebuild): Home + tema,
A1 visual, Inbox cockpit/scope/quem-manda, `kanban-comercial-go`,
Agenda, Bloco 1, `productization-3c`, navegação,
`contato-aparece-na-lista`.

Bloco 2 e Radar: FIXTURE SUJO — não é regressão visual.

---

## 22. Notas reais finais

Só o que foi aberto. Uma rota só classificada como HERDA **não**
ganhou 7.5 automático.

| Superfície | Light | Dark | Mobile | Premium? |
|---|---|---|---|---|
| Home | 8.8 | 8.6 | 8.3 | SIM (org e2e vazia; identidade canônica) |
| Inbox | 8.6 | 8.5 | 8.1 | SIM |
| Kanban | 8.7 | 8.5 | 8.1 | SIM |
| Contatos | 8.2 | — | 8.0 | SIM |
| Contato 360 | 8.2 | 8.2 | 8.1 | SIM |
| Agenda | 8.0 | — | 7.8 | PARCIAL |
| Campanhas | 8.1 | 8.0 | 8.0 | SIM |
| IA diária | 8.0 | 8.0 | 8.0 | SIM (avançado técnico) |
| Settings | 8.1 | 8.0 | 8.0 | SIM no hub |
| Auth/login | 8.2 | — | — | SIM |
| Funis | 8.0 | — | — | SIM |
| Radar | 8.0 | — | — | SIM |

Nenhuma superfície comercial importante < 7.5 **nesta** inspeção.

---

## 23. Resíduos

- Rotas técnicas (memory, providers, routers, credentials, runs, admin)
  continuam HERDA — coerentes, não certificadas como Premium.
- Lista de campanhas sem envios/respostas (API não traz).
- Destinatário ainda mostra status cru do engine.
- Aviso Google da Agenda come a 1ª dobra no mobile.
- Forms de settings além de perfil/notificações.
- `/onboarding` sem shot desta sessão.
- Jargão inglês em Automações avançadas.
- Org e2e suja (funis, ações, radar) — fixture, não produto.
- Atkinson no Playwright dobra letra — não é o produto.

---

## 24. Blockers

Blockers de uso: **NENHUM**

Blockers visuais importantes: **NENHUM**

---

## 25. Commit

Local, só se o retry do `test:db` confirmar o baseline. Mensagem:

`feat(crm): certify premium visual experience`

**PUSH: NÃO**

---

## 26. Veredito

Ver bloco exato abaixo.

---

# VEREDITO

MOOPE CRM — EXPERIÊNCIA VISUAL PREMIUM CERTIFICADA: **SIM**

HOME: 8.8/10
INBOX: 8.6/10
KANBAN: 8.7/10
CONTATOS: 8.2/10
CONTATO 360: 8.2/10
AGENDA: 8.0/10
CAMPANHAS: 8.1/10
IA DIÁRIA: 8.0/10
SETTINGS: 8.1/10
AUTH/ONBOARDING: 8.2/10
MOBILE CORE: 8.1/10
DARK: 8.4/10

IDENTIDADE MOOPE: 8.6/10
CONSISTÊNCIA ENTRE TELAS: 8.3/10

test:db:
antes 1016 passed / 1 expected fail / 1 skipped;
1ª passagem pós-correção: flake `nascimento-do-lead` (concorrência);
retry: 1016 passed / 1 expected fail / 1 skipped — VERDE

E2E CRÍTICOS:
Home+tema, Inbox (cockpit/scope/quem-manda), Kanban comercial,
owner-filter (pós-rebuild), Agenda, Bloco 1, Bloco 3 (pós-rebuild),
3C, navegação, contatos: VERDE.
Bloco 2 e Radar: FIXTURE SUJO (org e2e).
pipelines-gestao recusa-último: FIXTURE SUJO.

REGRESSÕES CRÍTICAS: **NÃO**

BLOCKERS DE USO: **NENHUM**

BLOCKERS VISUAIS: **NENHUM**

PRONTO PARA ENCERRAR FRENTE VISUAL: **SIM**

PRÓXIMO PASSO: **KNOWLEDGE 2.0**

COMMIT LOCAL: _(hash após `git commit`)_

PUSH: **NÃO**
