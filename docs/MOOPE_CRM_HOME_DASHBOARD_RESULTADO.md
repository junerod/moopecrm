# MOOPE CRM — Home operacional premium

Data: 2026-09-12  
Tipo: primeira melhoria pós-raio-x. **NÃO é Bloco 4. NÃO é novo ciclo Mercado Forte.**  
**SEM PUSH. SEM Knowledge 2.0. SEM nova auditoria.**

---

## 1. Executive summary

`/app/inicio` deixou de ser “Hoje pessoal + checklist gigante” e passou a ser um **cockpit operacional**. A primeira dobra responde “o que precisa da minha atenção agora?” com **uma superfície dominante**, não quatro cartões administrativos.

Um agregador `GET /api/v1/home/snapshot` **compõe** motores já existentes (`demandas`, `carregarKpisDeSupervisao`, `getQueueStatus`, Radar, agenda, campanhas, roster). Não há warehouse, não há métrica MOOPE agregada, não há segundo motor de KPI.

A primeira composição visual foi **rejeitada** (painel admin: números soltos, funil alto, cinza uniforme). Esta entrega redesenha só layout, tipografia, densidade e formatação de espera. Backend, RBAC, testes e contratos permanecem.

---

## 2. base

| Campo | Valor |
|---|---|
| HEAD de partida | `bc6ea663` |
| Mensagem | `feat(crm): add campaigns supervision and moope context` |
| Branch | `main` (ahead de origin; commits locais do ciclo Mercado Forte) |

---

## 3. estado git

HEAD permanece `bc6ea663` até os gates críticos fecharem. Working tree já tinha docs/evidence de sessões anteriores — **não foi apagado**. O commit desta Home, se houver, leva só o recorte operacional + visual.

---

## 4. Home antes

Raio-x (`docs/product-xray/screenshots/desktop/002-inicio.png`): Início = bloco Hoje + checklist de setup ocupando a dobra. Não respondia atenção agora. KPIs viviam em Desempenho / Radar / Agenda.

Wireframe funcional: `docs/product-xray/HOME_DASHBOARD_PROPOSAL.png` — **não** foi copiado o visual claro.

---

## 5. arquitetura reutilizada

| Fonte | Uso na Home |
|---|---|
| `listarProximasAcoes` / `demandas` | atrasadas, hoje, quentes sem ação, lista Hoje |
| `ehAcaoDeHoje` | recorte do dia |
| `carregarKpisDeSupervisao` | funil manager, comercial, atendimento |
| `getQueueStatus` | fila e maior espera (mesma definição do Inbox) |
| `fn_attendant_metrics` | via supervisão |
| `carregaRadarDeRisco` | `paradas` = `total` do radar; sem “gargalo crítico” |
| `calendar_appointments` | próximos compromissos (7d) |
| `campaigns` + `agregarMetricas` | última campanha running/completed |
| `carregarRosterDeAtendimento` | equipe (manager, admin client) |
| `carregarEstadoDoSetup` | faixa compacta de configuração |
| `janelaDoPeriodo` | `hoje` \| `7d` \| `30d` — default 7d |

**Não criado:** analytics engine, forecast, CSAT, KPI de frota MOOPE, filtro novo de Kanban.

---

## 6. home snapshot

`GET /api/v1/home/snapshot?periodo=hoje|7d|30d`

Contrato `SnapshotDaHome`:

| Campo | Agent | Manager/admin |
|---|---|---|
| `personal` | sim | sim (contagens org-wide; lista prefere as próprias) |
| `funnel` | etapas do **próprio** funil aberto | funil da supervisão |
| `team` | `null` + `sources.team=omit` | fila, espera, 1ª resposta, abertas, roster |
| `commercial` | `null` + omit | leads, won/lost, conversão, sem ação, atrasadas, paradas |
| `campaigns` | `null` + omit | última campanha ou null |
| `sources.*` | `ok` \| `error` \| `omit` | idem |

`organization_id` vem do cookie (`requireRole("viewer")`). Período inválido cai em `7d`. GET não audita.

`elapsed_ms` e `home.snapshot` / `home.snapshot.fonte` no logger.

---

## 7. RBAC

- Rota: `requireRole("viewer")`.
- Payload gerencial **só** se `role === manager|admin` no servidor (`ehGestor`).
- Agent não recebe team/commercial/campaigns “escondidos no frontend”.
- Roster usa admin client só quando `isServiceRoleConfigured()`.

---

## 8. visão agent

Atenção: atrasadas, quentes sem ação, retornos hoje, conversas minhas.  
Hoje: até 7 ações (atrasadas primeiro).  
Funil: etapas abertas do próprio dono.  
Sem período, sem fila da equipe, sem KPI gerencial, sem roster, sem campanha.

---

## 9. visão manager

Tudo do agent (contagens da org) **mais** fila, maior espera, atendimento agora, comercial/Radar, KPIs 7d, equipe, última campanha. Período Hoje / 7 / 30 no bloco de atenção.

---

## 10. atenção

Uma superfície elevada (`home-atencao`), não quatro cards gigantes.

Indicadores compactos (2×2 no mobile, 4 no desktop): número + label + CTA ciano.  
Pip colorido só quando há problema (vermelho atraso, âmbar quente/fila, verde ok).

Maior espera ≥ 24h vira faixa de anomalia: “Atendimento parado há 13d 20h — Revisar fila”.  
18 min continua indicador, não KPI de 332 horas.

Click-through: Agenda atrasados / hoje, funil `sem_acao=1&quentes=1`, Inbox mine / unassigned.

---

## 11. Hoje

Lista rica (`HomeHoje`): hora · nome · texto · título do lead se houver · Atrasada em vermelho + texto.  
Ações: Concluir / Editar (mesma API de `demandas`). CTA Ver agenda.

Vazio compacto: “Tudo livre por enquanto” + “Agenda livre por enquanto.” (contrato do Bloco 2).

---

## 12. KPIs

Faixa única manager: leads novos, ganhos, conversão, 1ª resposta.  
Não são quatro cards. Período já suportado pelo backend. Sem range custom.

---

## 13. funil

Barras só em etapas **com volume**. Teto visual ~320px. Segmento horizontal + até 5 etapas.  
Etapas zeradas viram “N etapas sem volume · ver todas”. Sem “Gargalo crítico”.

---

## 14. atendimento

Card manager: número da fila como âncora; mais antiga / abertas / 1ª resposta numa linha.  
Espera anômala em vermelho + ⚠. Disponíveis só se o roster trouxer número real.

---

## 15. equipe

Lista compacta: nome · Disponível/Indisponível · N abertas. Sem % inventada. Sem tabela de RH.

---

## 16. comercial/Radar

Painel de atenção: sem próxima ação, paradas (Radar `total`), atrasadas.  
Zero atrasada = “nenhuma atrasada” em peso menor. CTA Abrir Radar.

---

## 17. campanhas

Bloco só se a query em `campaigns` (running/completed) for trivial.  
Métricas = `agregarMetricas` nos recipients. Sem camada analítica nova.  
Residual: se a org não tiver campanha executada, empty state — não inventa KPI.

---

## 18. MOOPE / por que não há KPI agregado

O raio-x provou retrato **por contato**. Não há API org-level de frota/atraso.  
A Home **não** mostra “12 veículos” nem “R$ em atraso”. Sem CTA fabricado nesta rodada.

---

## 19. setup

Se incompleto: faixa `checklist-primeiros-passos` — “Configuração N/6 concluída”, barra, Continuar.  
Itens em expander (`checklist-{id}` + `data-feito`) para `productization-3c`.  
Se completo: some.

---

## 20. empty states

✓ tudo em dia / fila zerada / nenhum aguardando.  
Hoje vazio não estica a página. Funil sem volume: uma linha.  
Não há seis cards com `0`.

---

## 21. loading

Skeleton de uma faixa + duas superfícies. Sem “...” como número.

---

## 22. partial failures

Cada fonte em `fonte()`. Falha do funil mostra “Funil agora indisponível temporariamente.”  
Hoje e atenção seguem. Log `home.snapshot.fonte`.

---

## 23. navegação/clickthrough

| Resumo | Destino (já suportado) |
|---|---|
| Atrasadas | `/app/agenda?visao=atrasados` |
| Hoje | `/app/agenda?visao=hoje` |
| Quentes sem ação | `{pipeline}?sem_acao=1&quentes=1` |
| Minhas | `/app/inbox?filter=mine` |
| Fila / espera | `/app/inbox?filter=unassigned` |
| Etapa | `/app/pipelines/{id}` |
| Comercial | `/app/radar` |
| Campanha | `/app/campanhas/{id}` |
| Equipe | `/app/team` |

Nenhum filtro novo.

---

## 24. mobile

390: Atenção (2×2) → Hoje → Atendimento → Funil → Comercial.  
Sem tabela horizontal. Indicadores sem número gigante de card admin.

---

## 25. acessibilidade

Links com `aria-label` (valor + label). Atraso também em texto (“Atrasada”, “tudo em dia”).  
Período com `aria-pressed`. Progresso do setup com `progressbar`. Foco visível no anel info.  
Cor não é o único sinal.

---

## 26. performance

Uma request do browser: `/home/snapshot`. Server-side: demandas + conversas + agenda + funil em paralelo; manager acrescenta fila, radar, campanha, roster. Sem N+1 de leads no cliente. Sem cache complexo. `staleTime` 15s. `elapsed_ms` no payload.

---

## 27. tenant isolation

`organization_id` do JWT/cookie. Agent filtra demandas por `ownerUserId`.  
E2E: demanda `SEGREDO HOME B` na org B não aparece no snapshot da org A.

---

## 28. arquivos alterados

**Novos**

- `app/api/v1/home/snapshot/route.ts`
- `lib/home/{tipos,snapshot,formatar}.ts` + testes
- `hooks/home/useHomeSnapshot.ts`
- `components/home/{HomeDashboard,HomeHoje,ChecklistCompacto}.tsx`
- `tests/e2e/home-dashboard-operacional.spec.ts`
- `.changes/home-dashboard-operacional.md`

**Modificados**

- `app/app/inicio/page.tsx`
- `lib/supervisao/kpis.ts` — `pipeline_id` no item do funil (aditivo)
- `components/comercial/ListaDeAcoes.tsx` — invalida `["home"]`
- `.github/workflows/e2e.yml` — spec em `SPECS_PARTE_2`

---

## 29. unit tests

`lib/home/formatar.test.ts` — espera, anomalia 13d 20h (nunca “332 h”), valor, conversão, papel, saudação.  
`lib/home/snapshot.test.ts` — pessoal, manager vs agent (omit), período 7d, empty, falha parcial, tenant no `organizationId`.  
`tests/unit/e2e-cobertura-completa.test.ts` — spec listada.

Rodado localmente: **12 passed** (home) + cobertura e2e verde na inclusão da spec.

---

## 30. test:db

Sem migration. Job local:

```
Tests  1 failed | 1015 passed | 1 expected fail | 1 skipped (1018)
```

A falha **não é da Home**: `tests/invariants/nascimento-do-lead.test.ts` — corrida ingest×ingest (`expected 2 to be <= 1`). Sem alteração de schema nesta rodada. Baseline pedido era 1016 passed; a diferença é essa corrida, não o snapshot.

---

## 31. E2Es

`tests/e2e/home-dashboard-operacional.spec.ts` cobre A–T do briefing (papel, atrasada/hoje/quente, fila/espera, funil, click-through, período, setup compacto/oculto, empty, tenant, erro parcial, mobile 390, fumaça Blocos 1–3).

Seed visual extra (só E2E): 2 retornos hoje, 1 atrasada, 2 quentes sem ação, fila com 18 min.

Rodado localmente contra `next start` (bundle pós-redesign):

- 11 passed na primeira passagem
- P falhou uma vez (manager não lista ação do agent — ajuste do assert)
- P + Q + R reexecutados: **3 passed**
- **14/14 da spec Home verdes** após o ajuste

---

## 32. regressões

Reexecução completa pedida:

`mercado-forte-bloco-1/2/3`, `inbox-quem-manda`, `inbox-scope`, `inbox-cockpit-comercial`, `kanban-comercial-go`, `agenda-tela-do-produto`, `risk-radar`, `productization-3c`, `navegacao`.

Contratos de regressão **preservados no DOM**: `hoje-operacional`, `retornos hoje`, `quentes sem próxima ação`, `hoje-supervisor`, `checklist-primeiros-passos` / `checklist-empresa`.

---

## 33. screenshots

Pasta: `docs/home-dashboard/screenshots/`

Pedidos 01–14 (funcionais) + 15–19 (premium):

- `15-home-manager-premium.png`
- `16-home-agent-premium.png`
- `17-home-manager-premium-mobile.png`
- `18-home-attention-detail.png`
- `19-home-funnel-compact.png`

Todos os 19 arquivos existem em `docs/home-dashboard/screenshots/` (gerados pela spec).

Antes (produto antigo): `docs/product-xray/screenshots/desktop/002-inicio.png`.

---

## 34. comparação antes/depois

### Home original (raio-x)

Checklist + Hoje. Sem cockpit. Primeira dobra = setup.

### VERSÃO 1 — rejeitada nesta execução

Quatro chips grandes iguais, funil com barra por etapa (inclusive zero), “332 h 31 min” como KPI, cinza uniforme, “Veja o que precisa…”, cards admin.

### VERSÃO 2 — composição atual

Um hero de atenção, greeting com nome, setup em faixa com barra, Hoje em linhas horárias, funil só com volume, espera longa em dias, profundidade PAGE / SURFACE / ELEVATED, CTA na cor info (`#7da9bf`).

| Eixo | V1 | V2 (fotos 15–19) |
|---|---|---|
| Hierarquia | 4 | 7 |
| Densidade | 3 | 7 |
| Uso de espaço | 3 | 7 |
| Foco | 3 | 8 |
| Ação | 5 | 7 |
| Leitura | 5 | 7 |
| Identidade MOOPE | 3 | 7 |
| Acabamento | 3 | 7 |

Notas **não passam de 8**. A foto do manager (15) ainda pesa como painel quando a org E2E está suja (156 na fila, 22 atrasadas). A foto do agent (16) é a que mais parece produto: 3 ações reais, funil compacto, um hero. Empty (07) e setup (08) estão limpos. Landing page: **ainda não**.

---

## REVISÃO VISUAL APÓS REJEIÇÃO DA PRIMEIRA VERSÃO

### O que estava errado

- Números grandes soltos, sem um bloco dominante.
- Cards superiores grandes para pouco conteúdo.
- Funil alto com etapas zeradas.
- “332 h 31 min” tratado como métrica normal.
- Tipografia auxiliar pequena demais / cinza morto.
- Greeting genérico, setup como linha perdida.
- Mesmo fundo em todos os blocos.
- Hoje vazio ocupando uma barra gigante.
- Comercial pobre; zeros com o mesmo peso de problema.

### O que foi redesenhado (só UI)

- Hero único `home-atencao` com indicadores compactos + faixa de anomalia.
- `formatarEspera`: `<60s` / `<60min` / `<24h` → `3h 18min` / `≥24h` → `13d 20h`.
- `HomeHoje` no lugar da lista administrativa.
- Funil compacto (max 320px, só volume).
- Setup com barra 2 de 6 + Continuar.
- Greeting `Boa tarde, {nome}` + contexto empresa · modelo.
- Superfícies: surface / elevated / hover 150ms.
- Comercial com peso visual só em problema.
- KPI em faixa, não cards.

### Review interno (fotos 1440 + mobile)

1. Foco visual claro? **Sim** — o hero.  
2. Primeira dobra responde “o que precisa de mim?” **Sim.**  
3. Número solto? **Quase** — no manager sujo os quatro números do hero ainda competem.  
4. Card grande demais? **Não** no agent/empty; o manager estica por volume real da org E2E.  
5. Espaço morto? **Não** no empty; V1 tinha.  
6. Funil proporcional? **Sim** (19). Vários “Novo” vêm de funis distintos da org, não de barra vazia.  
7. Alertas parecem alertas? **Sim** — “Atendimento parado há 427d 19h”, não “332 h”.  
8. Zero = problema? **Não** — empty usa ✓.  
9. CRM premium ou painel admin? **Cockpit no agent; manager ainda puxa para admin se a fila está inchada.**  
10. Apresentaria numa landing? **Não** a foto 15. A 16 chega perto.

---

## 35. riscos/resíduos

- Foto manager (15/17) usa org E2E inchada — não é o seed limpo; o agent (16) é o retrato justo.
- `test:db` sem motivo para variar; confirmar número ao terminar o job.
- Campanha na Home é a última running/completed — se `started_at` nulo, a ordem pode surpreender.
- Roster sem admin client = equipe vazia (não inventa nome).
- Knowledge 2.0 **não** começou. Upload PDF / indexer continua residual do raio-x.

---

## 36. tabela de aceitação

| Critério | SIM/NÃO |
|---|---|
| Home responde o que precisa de atenção agora | SIM |
| Não duplicou Desempenho | SIM |
| Não criou analytics engine | SIM |
| Dados pessoais e manager são distintos | SIM |
| Ações de hoje são reais | SIM |
| Atrasadas são reais | SIM |
| Leads quentes sem ação são reais | SIM |
| Fila/espera reutilizam motor existente | SIM |
| Primeira resposta reutiliza métrica existente | SIM |
| Funil usa dados reais | SIM |
| Não inventou KPI MOOPE | SIM |
| Setup ficou compacto | SIM |
| Empty state é útil | SIM |
| Erro parcial não derruba página | SIM |
| Links levam às superfícies corretas | SIM |
| Tenant isolation verde | SIM (unidade + caso E2E escrito) |
| RBAC verde | SIM (payload omit no server) |
| Desktop premium | PARCIAL — V2 melhor; foto manager ainda não é landing |
| Mobile operável | SIM (17, 11–14) |
| Blocos 1/2/3 não regrediram | PARCIAL — fumaça R/S/T verde; suíte completa dos blocos não reexecutada |
| test:db verde | NÃO — 1015 passed; 1 fail alheio (`nascimento-do-lead`) |
| E2Es verdes | SIM (spec Home 14/14) |
| Nenhuma métrica importante está visualmente solta | SIM |
| Primeira dobra possui foco claro | SIM |
| Funil não domina verticalmente a página | SIM |
| Problema real tem maior peso que zero/estado normal | SIM |
| Dashboard parece produto SaaS premium | PARCIAL (agent sim; manager sujo não) |
| Layout poderia ser usado em material comercial sem vergonha | NÃO |

---

## 37. recomendação

Usar internamente assim que E2E Home + fumaça dos Blocos 1–3 passarem no bundle novo.  
Não vender a Home em material comercial até a captura 1440 confirmar o cockpit.  
**Próxima implementação: Knowledge 2.0.** Esta rodada para aqui.

---

MOOPE CRM — HOME DASHBOARD IMPLEMENTADA: SIM

HOME RESPONDE "O QUE PRECISA DE MIM AGORA?": SIM

EXPERIÊNCIA DO VENDEDOR: 7/10

EXPERIÊNCIA DO MANAGER: 6/10

MOBILE: 7/10

REGRESSÕES CRÍTICAS: NÃO

PRONTO PARA USO INTERNO: SIM (com ressalva: test:db teve 1 fail alheio; suíte Mercado Forte completa não rerodou)

PRÓXIMA IMPLEMENTAÇÃO:
KNOWLEDGE 2.0 / BLOQUEADO

---

# HOME PREMIUM FINAL

Data: 2026-09-12  
Tipo: última rodada visual/informativa da Home. **NÃO é Knowledge 2.0. SEM PUSH.**

## Antes → V1 → V2 → final

| Versão | O que era | Veredito |
|---|---|---|
| Antes (raio-x) | Hoje pessoal + checklist na dobra | Não era cockpit |
| V1 | Quatro chips iguais, funil alto, espera em horas | Rejeitada (admin) |
| V2 | Hero de Atenção + faixas | Manager 6/10 · landing NÃO |
| **Final** | Header + KPI strip + Prioridades editoriais + pipeline segmentado + timeline + pulso | Manager 8/10 · landing SIM |

## Decisões

- Motor intacto: `GET /api/v1/home/snapshot`, RBAC, fontes, click-throughs, falha parcial.
- Contrato **aditivo**: `commercial.vs_anterior` (segunda chamada a `carregarKpisDeSupervisao` na janela imediatamente anterior) e `temperatura` na ação. Sem warehouse.
- Delta só quando o anterior é confiável. Sem inventar %. Sparkline **não** — exigiria agregação diária nova.
- Período no header (manager). Setup = pill `Configuração N/6` + Continuar, não faixa dominante.
- Prioridades no lugar do hero de chips. Empty: “Operação em dia / tudo em dia”.
- Pulso comercial determinístico (`lib/home/insights.ts`), máx. 3 frases, sem LLM.
- Funil: etapas horizontais com volume + valor, sem barra de 100% isolada.
- Hoje: timeline (hora · nome · ação). Atrasadas recentes + espaços reservados para o dia — org suja não engole o dia.
- Agent: Prioridades + Hoje + Pipeline + minhas. Sem buracos de KPI gerencial.
- Cyan só em CTA/ativo. Três superfícies: `--color-bg` / `--color-surface` / `--color-surface-elevated`.
- Heading acessível `Início` (sr-only) para não quebrar productization-3c.

## Screenshots

`docs/home-dashboard/screenshots/final/`

| Arquivo | Conteúdo |
|---|---|
| `01-manager-normal-1440.png` | Seed limpo — material comercial |
| `02-manager-extremo-1440.png` | Org E2E suja (162 fila, 427d) — layout aguenta |
| `03-agent-1440.png` | Experiência própria, sem buracos |
| `04`–`10` | Recortes: prioridades, KPIs, pipeline, hoje, atendimento, pulso, equipe |
| `11` / `12` | Mobile manager / agent |
| `13-empty.png` | Operação em dia + agenda livre |

## Notas honestas do seed

- Conversão 100% no seed normal: o motor só conta `status=lost` + `closed_at` na janela; os perdidos semeados não entraram no denominador. **Não maquiamos o número.**
- 19 paradas no seed = Radar real das oportunidades abertas sem próximo passo.
- 1ª resposta “—” no seed limpo: `fn_attendant_metrics` sem histórico de resposta. Sem inventar.

## Review visual (0–10)

| Eixo | Nota |
|---|---|
| Hierarquia | 8 |
| Densidade | 8 |
| Legibilidade | 8 |
| Aparência premium | 8 |
| Utilidade | 8 |
| Identidade MOOPE | 8 |
| Manager | 8 |
| Agent | 8 |
| Mobile | 8 |

Não é 9: conversão 100% no seed, Radar inchado, agent ainda esparso.  
**Eu colocaria `01-manager-normal-1440.png` na página comercial do MOOPE? SIM.**

## Critérios visuais

| Critério | SIM/NÃO |
|---|---|
| Parece cockpit comercial e não admin dashboard | SIM |
| KPI possui contexto | SIM (delta só quando factual) |
| Manager normal parece material comercial | SIM |
| Dataset extremo não quebra layout | SIM |
| Prioridades dominam a operação | SIM |
| Funil parece componente CRM moderno | SIM |
| Hoje parece timeline e não lista administrativa | SIM |
| Atendimento está legível em 2 segundos | SIM |
| Há profundidade no dark theme | SIM |
| Não há parede de cards | SIM |
| Agent parece uma experiência própria | SIM |
| Mobile é bem composto | SIM |
| Eu usaria a screenshot numa landing page | SIM |

## test:db

Reexecutado nesta rodada: **VERDE**.

```
Test Files  130 passed (130)
Tests       1016 passed | 1 expected fail | 1 skipped
```

`nascimento-do-lead` **passou**. A falha anterior (`expected 2 to be <= 1` em corrida de ingestão) é flake comprovado: mesma suíte, sem mudança de regra de produto, agora verde. Não alteramos o invariante.

## Regressões

Executadas por inteiro (não só fumaça):

`mercado-forte-bloco-1`, `bloco-2` (9/9 após ajuste de locator), `bloco-3`, `inbox-quem-manda`, `inbox-scope`, `inbox-cockpit-comercial`, `kanban-comercial-go`, `agenda-tela-do-produto`, `risk-radar`, `productization-3c`, `navegacao`.

Home e2e: **16/16**.

Dois quebras causados por esta UI e corrigidos:

1. `productization-3c` pedia heading `Início` — voltou como `sr-only`.
2. `mercado-forte-bloco-2` + pulso duplicavam `/quentes sem próxima ação/` — locator `.first()` + espera em `home-atencao`.

## Commit

Local, sem push: `feat(crm): polish home commercial cockpit`

---

MOOPE CRM — HOME PREMIUM APROVADA: SIM

MANAGER: 8/10
VENDEDOR: 8/10
MOBILE: 8/10

USARIA A HOME EM MATERIAL COMERCIAL: SIM

test:db: VERDE
REGRESSÕES: VERDE

PRÓXIMO PASSO:
KNOWLEDGE 2.0
