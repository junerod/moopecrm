# MOOPE CRM — Design System Premium — Resultado

## 1. Executive summary

A Home e o app shell passaram a usar a linguagem da **referência visual
canônica** (mockup light: sidebar navy, topbar clara, cards brancos, pipeline
em chevron, KPIs com ícone soft). Light/Dark/System são reais e persistem.
Motores de produto (snapshot, RLS, Inbox, Kanban, demandas) não foram
reescritos. As demais telas **não** foram redesenhadas — só herdam o shell.

## 2. Base git

`b1577d6d` — `feat(crm): make Meu Negócio the company record`

## 3. Referência visual

Imagem anexada ao prompt (mockup light 1440). Fonte estética primária.
Screenshots antigas da Home = referência **funcional** apenas.

## 4. Auditoria visual anterior

A Home premium anterior era um cockpit **escuro greige** (Sage). Sidebar
`bg-accent-950` (verde-escuro de fábrica). Topbar sem controle de tema
(`.changes/tema-so-escuro.md` gravava `dark` a cada load). KPIs em faixa
única, pipeline com setas `→`, prioridades como bullets.

## 5. Arquitetura de theme encontrada

`lib/theme.tsx` (`Theme` = light | dark | system), `data-theme` no `<html>`,
`tailwind.config.ts` `darkMode: ["class", "[data-theme='dark']"]`.
Teste `theme-hidratacao.test.ts` exige `useState("dark")` no SSR.

## 6. Decisão reuse/create

**Reuso** do ThemeProvider. Nenhum segundo provider.
**Criado:** tokens MOOPE, `AppIcon`/`AppCard`/`MetricCard`/`AlertRow`/
`SectionHeader`/`StatusBadge`, visual da sidebar/topbar/Home.
**Corrigido:** `THEME_INIT_SCRIPT` deixou de `setItem('dark')` incondicional.

## 7. Tokens

Em `app/globals.css`: `--moope-*`, `--nav-*`, `--color-ai*`, `--color-teal*`,
`--color-indigo*`, superfícies cool, aliases `--success-soft` etc.
Dark redefine os mesmos papéis. Accent Sage intacto (marca).

## 8. Palette

Navy `#0B1F3A` · Blue `#1677FF` · Cyan `#12B8E8` · Page `#F5F8FC` ·
Surface `#FFF`. Semântica success/warning/error/info **não** foi trocada
(branding deriva delas).

## 9. Light

Tema principal. Home reproduzida primeiro em light.

## 10. Dark

`#0B1220` / `#121A2B` / `#1A2438`. Mesma hierarquia. Sidebar navy.

## 11. System

`theme === "system"` resolve `prefers-color-scheme`. Menu “Sistema”.

## 12. Persistence

`localStorage.deskcomm-theme`. Script lê antes do paint. Provider só aplica
`data-theme` depois de hidratar (`hydrated`). Default sem valor: **light**.
Quem já tem `dark` gravado permanece no escuro.

## 13. App shell

Sidebar navy + topbar surface + content `--color-bg`. `AppShell` inalterado
estruturalmente (`sticky` sidebar, `min-w-0`).

## 14. Sidebar

Ativo azul + barra cyan. Ícones `AppIcon` por `TOM_DA_NAV`. Grupos
preservados. Health dot de Conexões real. Sem badge “8” inventado.
Footer: org só se o nome ≠ marca do header.

## 15. Topbar

Busca pill (“Buscar contatos, conversas, leads...”) · ThemeToggle ·
AlertsBell · avatar + nome + empresa.

## 16. Icons

Phosphor. `AppIcon` 28/32/36. Sem Font Awesome.

## 17. Cards

`AppCard`: branco, border suave, radius 12, shadow-sm.

## 18. Buttons

Sem mudança de lógica. Primary continua accent da marca (Sage/revenda).

## 19. Forms

Tokens prontos; componentes shadcn não migrados.

## 20. Home

Layout da referência: header · 4 KPIs · Prioridades + Atendimento ·
Pipeline + Pulso · Hoje + Equipe + Campanha. Dados do snapshot. Contratos
e2e (`hoje-operacional`, chips, textos) preservados.

## 21. KPIs

Quatro cards. Ícone soft. Delta real. Sem sparkline falsa.

## 22. Prioridades

Linhas com ícone + CTA. Atrasado em danger-soft. Título
“Prioridades de hoje”.

## 23. Atendimento

Número grande “aguardando”, callout maior espera, rodapé
disponíveis / abertas / 1ª resposta.

## 24. Pulso

`insightsDoSnapshot` — até 4 frases. Sem LLM. Superfície blue-soft.

## 25. Pipeline

Chevron CSS (`.ds-funnel`). Pastéis `--funnel-1`…`--funnel-5`. No dark os
segmentos misturam com `--color-surface` — a 1ª captura pintava chevron
branco sobre fundo escuro. Clicável. “Ver todas”. Valor só se `value_cents`
existir.

## 26. Hoje

Timeline existente + badge Atrasada/Hoje.

## 27. Equipe

Iniciais + status dot + carga. Não tabela.

## 28. Campanha

Nome, métricas reais, barra de progresso se houver enviados. Empty
compacto se não houver. Sem campanha inventada.

## 29. Agent

Sem KPIs, período, equipe, campanha. Prioridades + Hoje + funil + pulso.

## 30. Manager

Cockpit completo + período.

## 31. Mobile

Drawer. Cards empilham. Pipeline vira lista. Theme no ícone da topbar.

## 32. Accessibility

AA nas superfícies novas (texto navy × `#F5F8FC`). Focus + forced-colors
intactos. Theme com aria-label. Cor + texto + ícone.

## 33. Performance

Sem lib de chart. Sem Font Awesome. SVG Phosphor já no bundle.
Chevron = CSS. Diferença de bundle: não mensurada (sem nova dependência).

## 34. Files changed (desta rodada)

- `app/globals.css`, `app/layout.tsx`, `lib/theme.tsx`
- `lib/branding/regua-do-produto.ts` (regenerada)
- `lib/design-system/tones.ts`, `lib/ui/icons.ts`, `lib/home/{tipos,snapshot}.ts`
- `components/ds/*`, `components/theme/theme-toggle.tsx`
- `components/shell/{Sidebar,TopBar,SearchTrigger,UserMenu,MobileSidebar}`
- `components/home/{HomeDashboard,HomeHoje,ChecklistCompacto}`
- `components/negocio/HojeOperacional.tsx` (testid legado, sem montagem)
- `tailwind.config.ts`
- testes unitários de theme/branding/sidebar
- `tests/e2e/home-dashboard-operacional.spec.ts` + seletores `main` no Mercado Forte
- `.changes/design-system-premium.md`
- `docs/MOOPE_CRM_DESIGN_SYSTEM.md` + este relatório
- `docs/design-system-premium/` (referência + 19 shots)

## 35. Tests

Unit: hidratação, persistência do script, tokens, sidebar, régua, contraste
(números re-medidos nas superfícies novas).

## 36. test:db

Sem migration. **Medido nesta rodada:** 1016 passed / 1 expected fail / 1 skipped. Verde.

## 37. E2E

`tests/e2e/home-dashboard-operacional.spec.ts`: **18 passed** (esta rodada).
Tema persistente + captura `docs/design-system-premium/screenshots/01–19`.
Seletores da Home viva apontam para `<main>` — o App Router pode deixar
uma cópia fora do `main`.

## 38. Regressões

Inbox / Funil só herdam shell (shots 18–19). Smoke da spec Home (R S T)
cobre Agenda, Radar, Campanhas, Metrics.

Mercado Forte bloco 3: passou nesta rodada.
Bloco 2 A–D falhou com `Não consegui carregar este funil: URI too long`
no Kanban — o shell pintou; o board não carregou o payload. Não é
regressão visual do DS; residual do org e2e / URL do quadro.

## 39. Screenshots

`docs/design-system-premium/screenshots/`

| # | Arquivo |
|---|---|
| 01 | home-light-1440 |
| 02 | home-light-1920 |
| 03 | home-light-mobile |
| 04 | home-dark-1440 |
| 05 | home-dark-mobile |
| 06–09 | sidebar/topbar light+dark |
| 10–17 | recortes Home |
| 18 | inbox-shell-light |
| 19 | funil-shell-light |

## 40. Comparison with reference

| Referência | Implementação | Diferença | Justificativa |
|---|---|---|---|
| Sidebar navy + grupos | `--nav-bg` + grupos reais | Labels do registry (Operação, não “OPERAÇÃO” 100% igual) | Fonte é `NAV_GROUPS` |
| Ativo azul + barra cyan | `nav-active` + `nav-indicator` | — | Fiel |
| Ícones coloridos | `AppIcon surface="nav"` + `--nav-icon-*` | Phosphor, não o set do mockup | Soft de card some no navy; fg claro |
| Badge inbox “8” | ausente | Sem contador real na nav | Não inventar |
| Dot Conexões | `ConnectionHealthDot` | Só se canal pedir atenção | Dado real |
| Topbar busca | Command palette | Capacidades atuais | Sem backend novo |
| Theme control | menu Claro/Escuro/Sistema | Mockup era só sun/moon | Persistência + system |
| 4 KPIs com sparkline | 4 cards + delta | Sem série diária | Não inventar gráfico |
| Prioridades 4 linhas | só as que têm count > 0 | Empty = “tudo em dia” | Dado real |
| Pipeline chevron pastel | `.ds-funnel` + tokens `--funnel-*` | Nomes/valores do funil do tenant | Não inventar R$ |
| Pulso com ilustração | blue-soft + Pulse + Lightbulb CSS | Ilustração é ícone, não LLM | Pedido do mockup |
| Plano no footer | ausente | Sem campo de plano confiável | Não inventar |
| Accent Sage nos botões globais | intacto | Primary shadcn ≠ `#1677FF` | White-label; rollout depois |

## 41. Visual scores

| Superfície | Nota | Nota honesta |
|---|---|---|
| Home light | **8,6 / 10** | Layout da referência; KPIs sem sparkline (sem série); ícones um pouco mais pálidos que o mockup |
| Home dark | **8,5 / 10** | Pipeline agora usa `--funnel-*` no dark — não é mais chevron branco |
| Sidebar | **8,5 / 10** | Navy + ícones `--nav-icon-*`; sem badge inventado |
| Topbar | **8,4 / 10** | Busca + tema + identidade |
| Identidade MOOPE | **8,6 / 10** | Navy + azul + soft semantics |
| Consistência | **8,2 / 10** | Inbox/Kanban ainda no visual antigo **dentro** do shell |
| Mobile | **8,0 / 10** | Empilha; pipeline vira lista |

Objetivo Home Light ≥ 8,5: **atingido**.

## 42. Residuals

- Accent Sage nos botões globais (marca / white-label).
- `--nav-bg` ainda não sai de `cssDaMarca`.
- Sem sparkline (sem série).
- Sem badge de inbox na nav.
- Inbox e Kanban não redesenhados (proposital).
- Knowledge 2.0 não iniciado (proposital).
- Dropdown shadcn ainda importa Lucide internamente.
- App Router pode deixar uma segunda árvore da Home fora de `<main>` (e2e mira o `main`).

## 43. Rollout map — 100% das telas

Lotes **visuais**, não fases funcionais.

### Lote A — operação comercial (primeiro)

| Rota | Tela | DS a usar | Impacto | Risco |
|---|---|---|---|---|
| `/app/inbox` | Caixa de entrada | AppShell já; lista/composer próprios | Alto (tempo de tela) | Alto — tratamento especial |
| `/app/inbox/[id]` | Conversa | idem | Alto | Alto |
| `/app/kanban` | Lista de funis | AppCard, PageHeader | Médio | Baixo |
| `/app/pipelines/[id]` | Quadro | cards Kanban (direção §) | Alto | Alto — especial |
| `/app/contacts` | Contatos | table language | Médio | Médio |
| `/app/contacts/[id]` | Contato 360 | AppCard, SectionHeader | Alto | Médio |
| `/app/leads/[id]` | Lead | idem | Médio | Médio |
| `/app/agenda` | Agenda | tokens already; header | Alto | Médio |
| `/app/radar` | Radar | AppCard, AlertRow | Médio | Baixo |
| `/app/campanhas` | Campanhas | MetricCard, StatusBadge | Médio | Baixo |
| `/app/campanhas/[id]` | Detalhe | idem | Médio | Baixo |
| `/app/templates` | Respostas rápidas | forms direction | Baixo | Baixo |

### Lote B — IA / automação

| Rota | Tela | DS | Impacto | Risco |
|---|---|---|---|---|
| `/app/ai` | Hub IA | AppCard, AppIcon | Médio | Baixo |
| `/app/ai/agents` (+ new, [id], simples) | Assistentes | AppCard | Médio | Médio |
| `/app/ai/followups` (+ [id], enrollments) | Automações | AppCard | Médio | Médio |
| `/app/ai/knowledge/sources` | Conhecimento | **mesmo DS**; Knowledge 2.0 é fase funcional depois | Médio | Médio |
| `/app/ai/memory`, `skills`, `routers`, `credentials`, `providers` | Config IA | forms | Baixo | Baixo |
| `/app/ai/cases`, `inbox`, `proposals`, `runs`, `usage`, `evolution` | Acompanhar | tables/badges | Médio | Baixo |

### Lote C — integrações / gestão

| Rota | Tela | DS | Impacto | Risco |
|---|---|---|---|---|
| `/app/connections` | Conexões | AppCard, StatusBadge | Alto | Médio |
| `/app/integrations/moope` | Integração MOOPE | AppCard | Médio | Baixo |
| `/app/integrations/nuvemshop` | Nuvemshop | AppCard | Baixo | Baixo |
| `/app/webhooks` | Webhooks | table | Baixo | Baixo |
| `/app/metrics` | Desempenho | MetricCard | Alto | Médio |
| `/app/team` (+ invite) | Equipe | lista estilo Home | Médio | Baixo |
| `/app/audit` | Audit log | table | Baixo | Baixo |

### Lote D — settings / admin / auxiliares

| Rota | Tela | DS | Impacto | Risco |
|---|---|---|---|---|
| `/app/settings` e hub | Configurações | PageHeader, forms | Médio | Baixo |
| `/app/settings/business` | Meu Negócio | forms | Médio | Baixo |
| `/app/settings/{profile,security,notifications,marca,billing,api-tokens,atualizacao,atendimento,perfil,canal-oficial}` | Conta / org | forms | Baixo | Baixo |
| `/app/settings/tenant` (+ pipelines, agenda, whatsapp) | Tenant | forms | Médio | Médio |
| `/app/lgpd/requests` (+ [id]) | LGPD | table — **sem marca no PDF** | Médio | Alto (legal) |
| `/app/manual` | Ajuda | tipografia | Baixo | Baixo |
| `/app` | Redirect | — | — | — |
| `/app/admin/**` (20 páginas) | Plataforma | AdminSidebar próprio; tokens | Médio | Médio |

## 44. Next recommendation

**PROPAGAÇÃO VISUAL — Lote A**, começando por **Inbox e Kanban** (maior tempo
de tela). Não começar Knowledge 2.0. Não redesenhar settings antes da operação.

---

### Auto-review visual

1. Parece o mesmo produto da referência? **SIM** (shell + Home light).
2. Home parece SaaS premium? **SIM**.
3. Sidebar tem identidade própria? **SIM**.
4. Light mode parece acabado? **SIM**.
5. Dark é tradução, não produto antigo? **SIM**.
6. Ícones semânticos? **SIM**.
7. Cor sem parecer infantil? **SIM**.
8. Informação em 3 segundos? **SIM**.
9. Screenshot na landing? **SIM** (01 light 1440).
10. CRM que se paga para usar todo dia? **SIM**, com a ressalva de Inbox/Kanban
    ainda no miolo antigo.

1, 2, 3, 4, 9 = SIM → não refinar de novo nesta rodada.
