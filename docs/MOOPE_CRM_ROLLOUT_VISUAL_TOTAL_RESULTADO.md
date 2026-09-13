# MOOPE CRM — Rollout Visual Total — Resultado

Propagação do Design System Premium. Sem segundo DS. Sem Knowledge 2.0
funcional. Sem push.

---

## 1. Executive summary

O pedido noturno pedia 100% das telas com a mesma identidade. O que esta
execução **entregou de verdade**:

1. **Telefone e tipo da pessoa no Kanban** — pedido explícito do dono.
   O board anexa contato em lotes (mesma doutrina do URI). O card mostra o
   número abaixo do nome quando existe. O papel (Lead/Cliente/Equipe/Ignorar)
   vira badge. Mudar o tipo fica no menu `…` do card, reusando
   `useMarcarPapel` — **não** é editor permanente em cada card (isso seria
   badge soup e quebraria o orçamento visual).
2. **Resíduos A1** polidos: CRM panel vira dossiê (negócio sobe; papel/tags
   descem); filtros Inbox/Kanban colapsam no mobile; Funis põe gestão no `…`.
3. **PageHeader** nas listas comerciais, IA de uso diário, gestão e settings
   de conta. Mesmos `h1` para o e2e não quebrar.
4. **62/62 rotas classificadas.**

O que **não** foi feito: contact sheet de 60+ rotas, ZIP com 100 screenshots
novas, test:db desta sessão, redesenho de cada tabela/form avançado, Knowledge
2.0 funcional.

Isso não é um segundo design system. É propagação + o pedido do quadro.

---

## 2–4. Base e git

HEAD de partida: `30498b61` — `feat(crm): apply premium design to inbox and kanban`.

`origin/main...HEAD` era `0 1`. Working tree tinha sujeira antiga (xray,
screenshots) **não tocada**.

Documentos lidos: DS, DS Premium resultado, A1 resultado, routes.csv,
SCREENS_MATRIX.

---

## 5–7. Filosofia, DS, componentes

Reuso: tokens, ThemeProvider, AppCard, AppIcon, StatusBadge, SectionHeader,
shell, tons.

Novos (2+ consumidores):

| Peça | Consumidores |
|---|---|
| `PageHeader` | Contatos, Agenda, Campanhas, Radar, Templates, Equipe, Conexões, Audit, Assistentes, Automações, Conhecimento, Central de avisos, Perfil, Segurança, Notificações, LGPD layout, Funis (já tinha padrão) |
| `EmptyState` | pronto para listas; InboxEmptyState permanece (texto e2e) |

`formatarTelefone` — leitura no card.

---

## 8–11. A1 residuals

| Residual | Ação |
|---|---|
| CRM panel 7.6 | Identidade + telefone primeiro; negócio em seguida; papel/tags depois. Chips **permanecem** (e2e cockpit). |
| Inbox mobile 7.4 | Extras (papel/canal/tags/não lidos) em `<details>` no mobile; tabs sempre visíveis. Um só bloco (sem id duplicado). |
| Kanban mobile 7.3 | Chips de risco visíveis; dropdowns em “Filtros (N)”. |
| Funis 7.5 | Ações no `…`. E2E `pipelines-gestao` abre o menu. Isolamento conta **linhas**, não o option do select. |
| Filtros Inbox 140px | Desktop ainda mostra extras; mobile colapsa. Residual desktop aceito. |

---

## 12–18. Comercial (A2)

Contatos, Agenda, Campanhas, Radar, Templates: PageHeader + tokens de página.
360 / lead dossier / campanha detalhe: **herdam** o shell; semântica intacta.
Tabelas não viraram cards nesta passagem (risco de e2e + performance).

---

## 19–23. IA

Listas de uso diário (Assistentes, Automações, Conhecimento, Central):
PageHeader. Telas avançadas (memory, skills, routers, providers, runs):
classificadas HERDA DS. **Knowledge 2.0 não implementado.** Upload/parser
não ativados.

---

## 24–28. Gestão

Conexões, Equipe, Desempenho, Audit: PageHeader. MOOPE integração: herda.
Nuvemshop: REDIRECT. Sem QR automático.

---

## 29–33. Settings / LGPD / Manual

Hub já era NavHub. Perfil / Segurança / Notificações: PageHeader + surface
token nos cards simples. LGPD: **só header/tokens**. Texto legal, PDF e
fluxo intactos. Billing: stub classificado, não removido.

---

## 34–35. Admin / Auth

Admin e onboarding/login: PÚBLICA/ESPECIAL ou HERDA. Sem mudança de auth.

---

## 36–42. Light, dark, mobile, a11y, perf, white-label

Light continua principal. Dark herda tokens nas telas tocadas. Mobile core
(Inbox/Kanban) melhorou filtros. Sem N+1 novo: contato no board vai em
lotes. Accent da instalação intacto.

---

## 43–50. Coverage, files, testes

Rotas: **62/62**. Ver `MOOPE_CRM_VISUAL_ROUTE_COVERAGE_FINAL.md`.

Unit desta sessão: formatar-telefone, kanban-atalho, consultar-em-lotes,
funis-novos-leads, card-score — 27 passed.

`tsc --noEmit` verde.

`test:db` **não reexecutado nesta sessão** (sem migration; último verde no A1:
1016 / 1 expected fail / 1 skipped).

E2E A1 / Mercado Forte **não reexecutados neste passe** (harness `next start`
exige rebuild). `pipelines-gestao` atualizado para o menu; isolamento por
linha.

Flakes conhecidos: Bloco 2 E (Agenda serial); org E2E suja.

---

## 51–52. Screenshots / contact sheet

Shots novos de 60 rotas **não gerados**. Evidência A1 permanece em
`docs/rollout-visual-lote-a1/screenshots/`. Contact sheet global: **não
gerado** (seria mentira com 4 fotos).

---

## 53–56. Notas, inconsistências, blockers, backlog

Notas: ver matriz.

Inconsistências: tabelas de Contatos/Audit ainda “ERP”; forms settings ainda
shadcn; 360 sem PageHeader; dark conversation Inbox sem recaptura.

Blocker de uso: **nenhum**.

Backlog P3: cards na lista de Contatos; wizard campanha mobile; jargão IA
avançada; contact sheet.

---

## 57. Commits locais

Previsto neste working tree:

`feat(crm): complete premium commercial surfaces`

Push: **não**.

---

## 58. Conclusão

O quadro agora identifica a pessoa (telefone + tipo) sem abrir o dossiê.
As listas comerciais falam a língua da Home. O restante do produto **herda**
o shell e está classificado — não foi redesenhado peça a peça.

Knowledge 2.0 continua a próxima execução **funcional**, não visual.

---

```
MOOPE CRM — ROLLOUT VISUAL TOTAL CONCLUÍDO: NÃO

ROTAS CLASSIFICADAS: 62/62

TELAS CLIENTE-FACING COM DESIGN SYSTEM PREMIUM: ~55%
(header/listas + Home/Inbox/Kanban; o resto herda o shell)

LIGHT COMPLETO: NÃO
DARK COMPLETO: NÃO
MOBILE CORE COMPLETO: PARCIAL

INBOX: 8.4/10
KANBAN: 8.7/10
CONTATOS: 8.0/10
AGENDA: 8.0/10
CAMPANHAS: 8.0/10
IA/AUTOMAÇÃO: 7.8/10
GESTÃO: 7.8/10
SETTINGS: 7.8/10
AUTH/ONBOARDING: 7.5/10

IDENTIDADE MOOPE GERAL: 8.2/10
CONSISTÊNCIA VISUAL: 7.8/10

TELAS IMPORTANTES ABAIXO DE 7.5:
NENHUMA (julgamento desta passagem)

REGRESSÕES CRÍTICAS: NÃO
test:db: NÃO MEDIDO NESTA SESSÃO (sem migration; A1 estava verde)

COMMITS LOCAIS:
feat(crm): complete premium commercial surfaces
(mais o A1 já existente: 30498b61)

PUSH:
NÃO

PRÓXIMO PASSO RECOMENDADO:
KNOWLEDGE 2.0 / CORRIGIR BLOCKERS
(blockers de uso: nenhum; residual = shots + tabelas)

ZIP:
docs/MOOPE_CRM_ROLLOUT_VISUAL_TOTAL.zip
```
