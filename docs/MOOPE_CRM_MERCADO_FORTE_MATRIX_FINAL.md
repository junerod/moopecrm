# MOOPE CRM — Matrix Mercado Forte FINAL

Recalculada **depois** dos Blocos 1, 2 e 3.  
Fonte original: [`MOOPE_CRM_MERCADO_FORTE_MATRIX.md`](./MOOPE_CRM_MERCADO_FORTE_MATRIX.md) (SHA `a0548126`, só diagnóstico).  
Evidência: relatórios dos três blocos + E2Es + `test:db`.

**Não inventei linha.** Só movi área cuja evidência é concreta. P3 da auditoria **não** sobe a média para parecer 100%.

**Como ler DEPOIS:** o número é a média da área na matrix original, ajustada só pelos itens que os blocos provaram. Itens E de P3 (VoIP, SSO, CSAT, app nativo, teams, typing, ads) continuam E e puxam a média para baixo — de propósito.

| Área | ANTES | DEPOIS | O que mudou (evidência) | O que NÃO mudou |
|---|---:|---:|---|---|
| Multiatendimento | 71 | 82 | Bloco 1: dono, colisão humano×humano, fila/espera, heartbeat 2 min, transfer+aviso, RR descoberta | teams, skills, typing, presença live |
| Produtividade | 57 | 68 | Bloco 1: respostas rápidas na Inbox; Bloco 2: próxima ação canônica | A/B, filtros salvos, bulk inbox |
| CRM/Funil | 66 | 78 | Bloco 1: temperatura no card; Bloco 2: uma obrigação em Inbox/Kanban/Agenda/Hoje | forecast avançado |
| Contatos | 53 | 68 | Bloco 2: 360 comercial; Bloco 3: retrato Gestão no 360 | campanhas recebidas estilo ads |
| Automação | 72 | 72 | Não tocada de propósito | grafo CRM, action MOOPE write |
| Campanhas | 8 | 48 | Bloco 3: entidade + segmento + preview + worker mock + opt-out + métricas + UI | email, landing, social, A/B, ads |
| WhatsApp | 78 | 78 | Certificação real **não** é deste ciclo | QR/reconexão de propósito intocados |
| IA | 81 | 83 | Bloco 3: `campaign_dispatch` DENY em COPILOT/AUTONOMOUS; Gestão fail-closed | disparo massivo autônomo |
| Supervisão | 42 | 64 | Bloco 3: `/app/metrics` expõe fila, FR, won/lost, atendentes, funil, campanhas | warehouse, CSAT, NPS, forecast |
| Integração MOOPE | 38 | 54 | Bloco 3: retrato no cockpit/360, deep-link, cache, MCP read; write=0 | disponibilidade calendário, parcelas, vistoria, MCP write |
| UX/exposição | 58 | 70 | Portas: Campanhas no sidebar; Desempenho com período; mobile consulta | Refresh 3/4/5, app nativo |
| **Geral (média simples das 11)** | **57** | **70** | Funções essenciais cobertas | P3 continua backlog |

## Campanhas — linhas da matrix original que ANDARAM

| Capacidade | ANTES | DEPOIS | Evidência |
|---|---|---|---|
| Campanha comercial (entidade) | E / 0 | B / 75 | `campaigns` + `campaign_recipients` (0205) |
| Lista / segmento / filtros | E / 0 | B / 75 | tags, papel, origem, owner, pipeline, stage, temperatura, opt-in, manual |
| Preview / agendamento / lote | E / 0 | B / 70 | preview bloqueia variável desconhecida; lote 20; `scheduled_at` |
| Disparo comercial CRM | E / 0 | B / 60 | worker mock `campaign_commercial`; sem WAHA real |
| Opt-out / consentimento | B-C / 40–70 | B / 80 | `checarGuardasDeContato` + recheck no tick |
| Status destinatário | C / 45 | B / 70 | pending/skipped/sent/delivered/replied/failed/cancelled |
| Respondido / campanha→lead | E / 0–30 | C / 55 | atribui `replied` + `source_metadata.campaign_id`; **não** cria lead no envio |
| Métricas / atribuição | E / 0 | B / 65 | enviadas/entregues/lidas/respondidas/falhas/opt-outs/leads associados |
| Disparo operacional MOOPE | B / 70 | B / 70 | **não** reutilizado |

Linhas que **continuam E** (P3 / fora de escopo): email marketing, landing, social, newsletter, A/B, Meta Ads, Google Ads.

## Integração MOOPE — auditoria do GET real

| Item | Situação | No cockpit? |
|---|---|---|
| cliente | EXISTE | sim (`RetratoLocatario.nome`) |
| veículo | PARCIAL | sim (modelo + placa) |
| contrato / locação | PARCIAL | sim (status, título) |
| boleto/PIX | PARCIAL | link se `portal_url` / `boleto_url` |
| disponibilidade | NAO_EXISTE | **não** — residual |
| parcelas | NAO_EXISTE | não |
| checklist / vistoria / manutenção / multa / sinistro / rastreamento | NAO_EXISTE | não |
| MCP write | NAO_EXISTE | doutrina: leitura |

## Como usar daqui para frente

A matrix **não autoriza Bloco 4**.  
Régua seguinte: uso interno + certificação WhatsApp + piloto + o que usuário real mostrar.
