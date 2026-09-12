# MOOPE CRM — Design System

Referência visual oficial para **todas** as telas futuras. A Home canônica
(`01-home-light-1440.png`) é a prova viva. Esta rodada cria a fundação; a
propagação acontece em lotes (A operação, B IA, C gestão, D settings/admin).

A imagem de referência (mockup light navy + cards brancos) é a fonte estética.
O produto atual, antes desta fundação, era só referência funcional.

---

## Princípios

1. **Identidade MOOPE, não template.** Navy na casca, azul no acento operacional,
   fundo neutro. Cor com significado — nunca carnaval.
2. **Light é o tema principal.** Dark é tradução dos mesmos tokens, não inversão
   de branco/preto e não o greige antigo.
3. **Tokens, não hex no componente.** Superfície, texto, borda, sombra e tom
   semântico saem de `app/globals.css`.
4. **A marca da instalação continua pintando o accent** (rampa Sage +
   `cssDaMarca`). A casca usa `--nav-*` / `--moope-*` para a identidade do
   produto. Residual: white-label ainda não emite `--nav-bg`.
5. **Ícone colorido + fundo soft.** O texto permanece navy/slate.
6. **Não redesenhar 63 telas de uma vez.** Shell + Home agora; o resto por lote.

---

## Palette

| Token | Light | Papel |
|---|---|---|
| `--moope-navy` / `--nav-bg` | `#0B1F3A` | Sidebar, identidade |
| `--moope-primary` | `#1677FF` | CTA, ativo, links da Home |
| `--moope-cyan` | `#12B8E8` | Indicador do item ativo |
| `--color-bg` | `#F5F8FC` | Página |
| `--color-surface` | `#FFFFFF` | Card |
| `--color-surface-elevated` | `#EEF3F9` | Chip, hover |
| `--color-text` | `#0B1F3A` | Primário |
| `--color-text-muted` | `#5B6B7C` | Secundário |
| `--color-border` | `#E2E8F0` | Borda suave |

Accent Sage (`--color-accent-*`) permanece a rampa de marca. Não misturar com
`--moope-primary` nos componentes novos.

---

## Semantic colors

| Tom | Uso | Soft |
|---|---|---|
| success / green | conversão, disponível, ok | `--color-success-bg` |
| warning / amber | ganhos, agenda, quentes | `--color-warning-bg` |
| danger / red | atraso, maior espera crítica | `--color-error-bg` |
| info / blue | fila, links | `--color-info-bg` / `--moope-primary-bg` |
| ai / violet | 1ª resposta, IA | `--color-ai-bg` |
| teal | contatos, conexões | `--color-teal-bg` |
| indigo | inbox, radar | `--color-indigo-bg` |
| cyan | Início, automações | mix de `--moope-cyan` |

Mapa da sidebar: `lib/design-system/tones.ts` → `TOM_DA_NAV`.

---

## Light / Dark / System

Infraestrutura reutilizada: `lib/theme.tsx` + `data-theme` no `<html>`.
**Um** ThemeProvider. Persistência em `localStorage` (`deskcomm-theme`).

O script anti-flash em `app/layout.tsx` **lê** a preferência; não grava `dark`
à força. Sem valor: `light`. `system` resolve via `prefers-color-scheme`.

Dark (tradução, não inversão):

| Token | Dark |
|---|---|
| `--color-bg` | `#0B1220` |
| `--color-surface` | `#121A2B` |
| `--color-surface-elevated` | `#1A2438` |
| `--color-text` | `#E8EEF6` |
| `--color-border` | `#243044` |

Sidebar permanece navy nos dois temas.

Controle: `components/theme/theme-toggle.tsx` — Claro / Escuro / Sistema.
Desktop na topbar; mobile no mesmo ícone. Atalho `Cmd+Shift+L` cicla.

---

## Typography

Fonte atual: Atkinson (já no layout). Sem fonte externa nova.

| Papel | Tamanho / peso |
|---|---|
| Saudação da Home | 28px / 700 |
| Título de card | 15px / 600 |
| Métrica | 28–36px / 700 |
| Corpo | 13–14px |
| Meta | 11–12px |
| Sidebar | 13px |

---

## Spacing, radius, shadows

Escala 4 already in `:root` (`--space-*`).

- Card radius: 12px (`--radius-lg`)
- Controle / pill: `--radius-full` ou 8px
- Shadow: `--shadow-sm` (navy 4–6% no light). Sem sombra pesada.

---

## Icons

Biblioteca: Phosphor via `@/lib/ui/icons`. **Não** Font Awesome. **Não** Lucide
como padrão (o dropdown shadcn ainda usa Lucide internamente — dívida antiga).

Padrão: `<AppIcon icon={…} tone="blue|cyan|green|amber|red|violet|teal|indigo" size="sm|md|lg" surface="default|nav" />`

- **default** (cards, KPIs, alertas): quadrado 28–36px, rounded, fundo soft, ícone duotone.
- **nav** (sidebar navy): ícone 18px tingido com `--nav-icon-*`. Sem quadrado claro — o soft de card some no `#0B1F3A`.

---

## Components (fundação)

| Componente | Onde | Uso futuro |
|---|---|---|
| `AppCard` | `components/ds/AppCard.tsx` | Toda superfície de conteúdo |
| `AppIcon` | `components/ds/AppIcon.tsx` | Sidebar, KPIs, alertas, empty |
| `MetricCard` | `components/ds/MetricCard.tsx` | KPIs |
| `SectionHeader` | `components/ds/SectionHeader.tsx` | Título + CTA |
| `AlertRow` | `components/ds/AlertRow.tsx` | Prioridades, avisos |
| `StatusBadge` | `components/ds/StatusBadge.tsx` | Estados |
| `ThemeToggle` | já existia; agora menu de 3 opções | Topbar |
| `AppShell` / `Sidebar` / `TopBar` | `components/shell` + `app/app/_components` | Todas as telas autenticadas |

Não criar abstrações sem consumidor.

---

## Buttons

Variantes atuais de `components/ui/button.tsx` (primary/default = accent da
marca; outline; ghost; destructive). Lógica intacta.

Direção futura: primary dos fluxos MOOPE pode usar `--moope-primary` **no
rollout**, não nesta rodada global — para não pintar 63 telas de uma vez.

---

## Forms / tables / Kanban / Inbox

**Não migrados agora.** Direção:

- **Input:** borda `--color-border`, radius 8, focus `--moope-primary`.
- **Tabela:** header leve, hover de linha, borda horizontal, badge de status.
- **Kanban:** fundo `#F5F8FC`, colunas suaves, card branco, accent da etapa,
  badge de temperatura, avatar, próxima ação, valor.
- **Inbox (Lote A, aplicado):**
  - Abas Fila / Minhas / Todas / Fechadas / IA em chips coloridos (âmbar, azul,
    teal, índigo, violeta) — não um grid embolado.
  - Lista com zebra (`--inbox-row-alt`) e chips de papel/tag com tom semântico.
  - Thread com `--inbox-thread-bg` (azul bem claro). Balão do cliente branco;
    do atendente `--inbox-bubble-out` (azul MOOPE); da IA `--inbox-bubble-ai`.
  - Tags do contato reutilizam o que a org já gravou (`GET /api/v1/contact-tags`).
    Tags da conversa juntam canônico + em uso (`GET /api/v1/conversation-tags`).
    Cor da tag = hash estável do nome (`tomDaTag`), sem coluna de cor.
  - Nome do WhatsApp “não salvo” vira callout para gravar no cadastro. Não
    escreve na agenda do celular (WAHA só puxa).

Detalhe no relatório de resultado, lote A.

---

## Sidebar

- Fundo `--nav-bg` navy
- Grupos com label 10px uppercase
- Ativo: fill `--nav-active` + barra `--nav-indicator` + texto branco
- Ícones em `AppIcon` (tom por destino)
- Badge de inbox: **somente dado real** — hoje não há contador na nav
- Dot de Conexões: `ConnectionHealthDot` existente
- Rodapé: Meu Negócio, Configurações, Ajuda, org se o nome ≠ marca do header

---

## Topbar

Busca global (mecanismo atual, placeholder
“Buscar contatos, conversas, leads...”) · theme · sino · avatar + nome + empresa.

---

## Page headers / KPIs / minigraphs

Header da Home: ícone empresa, saudação, pulso, contexto, setup compacto,
período Hoje/7d/30d.

KPI: ícone soft + label + número + delta real. **Sem sparkline inventada.**

Pipeline: `--funnel-1`…`--funnel-5` (pastel no light; mix com `--color-surface` no dark). Nunca `color-mix(..., white)` no tema escuro.

---

## Mobile

Sidebar vira drawer (`MobileSidebar`). Topbar compacta. Cards empilham.
Pipeline vira pilha (clip-path desliga <768px). Sem scroll horizontal da página.

---

## Accessibility

- Contraste de texto normal vs `--color-bg` / `--color-surface` acima de AA
  nas superfícies novas.
- Focus visível (`:focus-visible` + rider `forced-colors`).
- Theme control com `aria-label`.
- Cor nunca é a única informação (número + texto + ícone).

---

## Arquivos

- Tokens: `app/globals.css` (`:root`, `[data-theme="light"]`, `[data-theme="dark"]`)
- Tons: `lib/design-system/tones.ts`
- Régua de marca (gerada): `lib/branding/regua-do-produto.ts`
- Theme: `lib/theme.tsx`, `app/layout.tsx` (`THEME_INIT_SCRIPT`)
