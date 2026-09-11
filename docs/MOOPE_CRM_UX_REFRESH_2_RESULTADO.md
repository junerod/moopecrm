# MOOPE CRM — UX Refresh 2 — resultado

Data: 2026-09-11  
Branch: `main` (local, sem push)

## 1. Commit-base

`f2a9e072` — `feat(crm): modernize core commercial workspace` (Refresh 1)

## 2. Os 2 E2Es vermelhos e a resolução

### A. `inbox-cockpit-comercial` — “Comercial esconde Equipe; ficha edita papel”

**Causa:** o painel lia `contact.papel` do embed da conversa (`["conversation", id]`). `useUpdateContact` invalidava só `["conversations"]` (plural). A conversa de equipe está fora da lista comercial, então o embed não refetchava e a ficha continuava em `conversa-da-equipe`.

**Correção (só sync):**
- `aplicarPapelNoEmbed` + `invalidateQueries(["conversation"])` em `useUpdateContact`
- override local de papel no `CRMSidePanel` depois do chip

Semântica de Comercial/Equipe **não** mudou.

### B. `inbox-quem-manda` — Fila / nome não encontrado

**Classificação:** teste + ordenação da Fila + paginação. **Não** era semântica errada.

Fila ordena `last_inbound_at ASC` (quem espera há mais tempo). O seed gravava `now()`, a linha ia para o fim da página 1+ e `getByText(nome)` falhava.

**Correção:**
- seed com `last_inbound_at` = agora − 2h (espera de verdade, aparece primeiro)
- locator `button[data-conversation-id="…"]`

Filtro e sort da Fila **não** foram alterados.

## 3. Inbox list

Deixou de ser só preview de mensagem. Densidade menor: avatar 32px, nome 16 semibold, preview 14, meta 12.

## 4. Stage / próximo passo na lista

Extensão leve do embed existente (uma query, sem N+1):

```
crm_leads(..., crm_stages(id,name)), demandas(proximo_passo, proximo_passo_em, estado)
```

Linha 3 só quando há dado. Estados vistos no AFTER: `Carrinho abandonado · sem próximo passo`, `Aguardando pagamento · sem próximo passo`. Atraso usa cor destructive no texto, não no card.

Helper: `lib/inbox/meta-da-linha.ts`.

## 5. Header desktop

Primário: **Assumir** (quando cabe).  
Secundário visível: **Transferir**.  
Restante no ⋯: Marcar, Lembrar, Liberar, Devolver, Pausar, Fechar, Ver contato.

## 6. Header mobile

Não há mais duas linhas de botões. Primeira dobra:

`[Conversas] [Ficha]`  
`[Nome] [Assumir] [⋯]`  
`[responsável]`  
depois a conversa.

Alvos de toque `min-h-11` em Assumir e ⋯.

## 7. Cockpit

Topo: nome 18 semibold + telefone.  
Negócio: funil + etapa como `<select>` sem caixa (texto).  
Responsável · origem numa linha.  
Temperatura: dot + rótulo; chips só no clique.  
Próximo passo: display / “+ Definir”.  
Abrir no funil.  
IA numa linha quando vazia.

## 8. Display / edit mode

Próximo passo começa fechado. Inputs (mesmos testids) só no modo edição.  
Teste C atualizado: clica Definir, grava, recarrega, clica Editar — prova que o valor persistiu.

## 9. Responsável

`E2E Manager · WhatsApp` — texto, sem label admin “RESPONSÁVEL”. Testid `inbox-negocio-responsavel` mantido.

## 10. Temperatura

Dot semântico (quente/morno/frio) + rótulo. Chips no clique / `sr-only` para o testid. Sem pintar o painel.

## 11. Próximo passo

Vazio: `+ Definir próximo passo`.  
Preenchido: texto + data · hora + Editar.  
Sem inputs vazios permanentes.

## 12. Assistente IA

Continua secundário. Vazio: `Assistente IA  Nenhuma sugestão` numa linha.

## 13. Contatos desktop

Tabela saiu. Lista de pessoas: avatar, nome, email/telefone, papel quando houver, último contato, **Abrir conversa**, ⋯ (ficha / importar).  
Header: só **Novo contato** + ⋯ (CSV / aparelho).

## 14. Contatos mobile

Lista vertical. Sem overflow horizontal de tabela. CTA 44px.

## 15. Ficha do contato

Topo: nome, papel, telefone/email, **Abrir conversa**.  
Abas: Negócios / Timeline / Dados. Grade rótulo/valor foi para Dados.

## 16. Início

Mesma lógica. Quatro blocos com número grande, rotas já existentes. Sem gráfico.

## 17. Material visual

Dark mode mantido. Lista `bg-muted/20`, fio `bg-background`, cockpit `bg-muted/15`. Bordas mais fracas. Ghost de verdade no overflow. Um CTA forte por área (Assumir, Abrir conversa, Novo contato). Sem gradiente.

## 18. Typography

Nome 16–18 semibold. Preview 14. Meta 12–13. Section 12, sem uppercase em massa.

## 19. Cores semânticas

`lib/crm/temperatura-visual.ts`: quente laranja, morno âmbar, frio sky, atrasado destructive. Só dot/chip.

Kanban: não redesenhado. `ScoreSlot` já tinha bandas próprias.

## 20. Mobile 390×844

Inbox lista, conversa, ficha, Contatos, ficha de contato, Início capturados. Sem tabela horizontal. Header de conversa sem duas fileiras de botões. Overflow da ficha medido no E2E do cockpit.

## 21. Screenshots

`docs/ux-refresh-2/screenshots/` — os 15 obrigatórios. Índice em `docs/ux-refresh-2/BEFORE_AFTER.md`.

## 22. Scores

Mesmos critérios da auditoria. **Não suavizado.**

| Superfície | Audit | Refresh 1 | Refresh 2 | Δ total |
|---|---:|---:|---:|---:|
| Início | 4.5 | 6.5 | 7.2 | +2.7 |
| Inbox | 5.0 | 6.5 | 7.6 | +2.6 |
| Cockpit | 4.0 | 6.5 | 7.5 | +3.5 |
| Contatos | 4.5 | 4.5 | 7.0 | +2.5 |
| Mobile | 4.0 | 5.5 | 7.2 | +3.2 |
| **Média destas 5** | **4.4** | **5.9** | **7.3** | **+2.9** |

Produto misturando o resto (Kanban 6.0, hubs internos): **~7.2** (era 5.3 → 6.3).

O que ainda puxa para baixo: chips de papel no topo do cockpit; lista de Contatos no tenant e2e cheia de seed de teste (é dado, não layout); filtros da Inbox ainda parecem admin.

## 23. Typecheck

`pnpm typecheck` — zerado.

## 24. Lint

ESLint nos arquivos alterados — 0 errors. Warning pré-existente em `CRMSidePanel` (`setState` no effect de carga).

## 25. Unitários

Verde: `inbox-meta-da-linha`, `inbox-papel-embed`, `inbox-header-nao-trava`, `inbox-cockpit-comercial`, `inbox-aba-padrao`, `inbox-deep-link-conversa`, `sidebar-grupos`, `navegacao-registry`, `command-palette` — 64 testes.

## 26. E2Es

`E2E_PORT=3018`, build de produção com `.env.e2e`.

| Spec | Resultado |
|---|---|
| inbox-cockpit-comercial (incl. E papel + mobile) | verde (C relocado após strict-mode de texto duplicado) |
| inbox-quem-manda | verde |
| inbox-assistente-ia | verde |
| inbox-scope | verde |
| navegacao (incl. mobile 390) | verde |
| productization-3c (incl. mobile) | verde |
| contato-aparece-na-lista | verde |
| contato-salva-email | verde |

Primeira passada da suíte: **37/38**. Único vermelho: teste C, `getByText("Ligar amanhã")` bateu no passo **e** na demanda. Locator restrito a `inbox-proximo-passo`. Reexecução: **1/1 verde**.

Os dois que estavam vermelhos no Refresh 1 passaram nesta rodada.

## 27. test:db

**Não rodado.** Justificativa: sem schema, sem RLS, sem migration. O handler só alongou o `select` do embed (`crm_stages`, `demandas`) — colunas que a sessão já lê. Contrato de apresentação, não de persistência.

## 28. Arquivos

Novos: `lib/inbox/meta-da-linha.ts`, `lib/crm/temperatura-visual.ts`, testes unitários, `docs/ux-refresh-2/**`, `.changes/ux-refresh-2-polimento-comercial.md`.

Alterados: handler de conversas, hooks de contato/papel, Inbox (lista, header, cockpit, layout), Contatos (lista + ficha), Início (`HojeOperacional`), E2Es citados.

## 29. Migrations

Nenhuma.

## 30. Commit

Local, se a árvore desta rodada estiver verde: `feat(crm): refine premium commercial ux`

## 31. SEM PUSH

Confirmado. Este relatório não autoriza `git push`.

## 32. Riscos restantes

- Embed novo: se algum PostgREST recusar `demandas` aninhado, a lista volta a 500. Medido verde no e2e local (deskcomm-crm / 54321).
- Chips de papel no cockpit ainda parecem formulário — o E2E clica neles; não foram escondidos.
- Contatos no tenant e2e mostra seed de teste no topo (ordenação por última atividade). Cliente real com Marina/Carlos não vê isso.
- Filtros da Inbox (Comercial, números, abas) não foram redesenhados.
- Sem bottom nav. Sem dossiê 360.

---

## Veredito

MOOPE CRM — UX REFRESH 2 IMPLEMENTADO: **SIM**

INBOX JÁ PARECE CRM COMERCIAL MODERNO: **SIM**

COCKPIT JÁ PARECE PRODUTO PREMIUM: **NÃO**

CONTATOS JÁ PARECE CRM MODERNO: **SIM**

MOBILE JÁ É OPERÁVEL SEM SENSAÇÃO DE DESKTOP ESPREMIDO: **SIM**

UX VISUAL JÁ É SUFICIENTE PARA PILOTO COM CLIENTE: **SIM**

Blocker visual restante (não impede piloto, impede “premium”): o topo do cockpit ainda é seletor de papel (Equipe / Lead / Cliente / Ignorar) + “Trocar nome”. O negócio em si (etapa, responsável, passo) já está em display mode.
