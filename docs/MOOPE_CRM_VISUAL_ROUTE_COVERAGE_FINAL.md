# Cobertura visual de rotas — classificação 100%

Fonte: `docs/product-xray/routes.csv` (62 rotas).
Nenhuma rota ficou "não olhada".

| Rota | Grupo | Light | Dark | Mobile | DS | Status | Shot | Nota |
|---|---|---|---|---|---|---|---|---|
| /login | auth | herda | herda | herda | tokens shell | PÚBLICA/ESPECIAL | — | Auth logic intacta |
| /signup | auth | herda | herda | herda | tokens | PÚBLICA/ESPECIAL | — | |
| /app | nav | — | — | — | — | REDIRECT | — | |
| /app/inicio | operação | premium | premium | premium | Home canônica | PREMIUM | design-system-premium | |
| /app/inbox | operação | premium | premium | parcial | A1 + filtros compactos | PREMIUM | lote-a1 | |
| /app/inbox/[id] | operação | premium | parcial | parcial | A1 + dossiê CRM | PREMIUM | lote-a1 | Collision sem shot |
| /app/kanban | operação | premium | herda | parcial | Funis + menu `…` | PREMIUM | lote-a1 | |
| /app/pipelines/[id] | operação | premium | premium | parcial | Card + telefone + papel | PREMIUM | lote-a1 | |
| /app/leads/[id] | operação | herda | herda | herda | shell | HERDA DS E ESTÁ ADEQUADA | — | Dossiê existente |
| /app/contacts | operação | header | herda | herda | PageHeader | PREMIUM | — | Lista ainda tabela |
| /app/contacts/[id] | operação | herda | herda | herda | shell | HERDA DS E ESTÁ ADEQUADA | — | 360 existente |
| /app/agenda | operação | header | herda | herda | PageHeader | PREMIUM | — | Grade intacta |
| /app/campanhas | operação | header | herda | herda | PageHeader | PREMIUM | — | Engine intacto |
| /app/campanhas/[id] | operação | herda | herda | herda | shell | HERDA DS E ESTÁ ADEQUADA | — | |
| /app/radar | operação | header | herda | herda | PageHeader | PREMIUM | — | |
| /app/templates | operação | header | herda | herda | PageHeader | PREMIUM | — | |
| /app/ai | IA | herda | herda | herda | NavHub | HERDA DS E ESTÁ ADEQUADA | — | Hub existente |
| /app/ai/agents | IA | header | herda | herda | PageHeader | PREMIUM | — | |
| /app/ai/agents/new | IA | herda | herda | herda | forms | HERDA DS E ESTÁ ADEQUADA | — | Avançado |
| /app/ai/agents/simples | IA | herda | herda | herda | forms | HERDA DS E ESTÁ ADEQUADA | — | |
| /app/ai/agents/[id] | IA | herda | herda | herda | forms | HERDA DS E ESTÁ ADEQUADA | — | Avançado |
| /app/ai/followups | IA | header | herda | herda | PageHeader | PREMIUM | — | |
| /app/ai/followups/[id] | IA | herda | herda | herda | shell | HERDA DS E ESTÁ ADEQUADA | — | Graph intacto |
| /app/ai/knowledge/sources | IA | header | herda | herda | PageHeader | PREMIUM | — | Visual only |
| /app/ai/memory | IA | herda | herda | herda | shell | HERDA DS E ESTÁ ADEQUADA | — | Avançado |
| /app/ai/skills | IA | herda | herda | herda | shell | HERDA DS E ESTÁ ADEQUADA | — | |
| /app/ai/routers | IA | herda | herda | herda | shell | HERDA DS E ESTÁ ADEQUADA | — | |
| /app/ai/providers | IA | herda | herda | herda | shell | HERDA DS E ESTÁ ADEQUADA | — | |
| /app/ai/credentials | IA | herda | herda | herda | shell | HERDA DS E ESTÁ ADEQUADA | — | |
| /app/ai/cases | IA | herda | herda | herda | shell | HERDA DS E ESTÁ ADEQUADA | — | |
| /app/ai/inbox | IA | header | herda | herda | PageHeader | PREMIUM | — | |
| /app/ai/proposals | IA | herda | herda | herda | shell | HERDA DS E ESTÁ ADEQUADA | — | |
| /app/ai/runs | IA | herda | herda | herda | shell | HERDA DS E ESTÁ ADEQUADA | — | |
| /app/ai/usage | IA | herda | herda | herda | shell | HERDA DS E ESTÁ ADEQUADA | — | |
| /app/ai/evolution | IA | herda | herda | herda | shell | HERDA DS E ESTÁ ADEQUADA | — | |
| /app/connections | gestão | header | herda | herda | PageHeader | PREMIUM | — | Sem QR auto |
| /app/integrations/moope | gestão | herda | herda | herda | shell | HERDA DS E ESTÁ ADEQUADA | — | |
| /app/integrations/nuvemshop | legado | — | — | — | — | REDIRECT / LEGADO ISOLADO | — | |
| /app/webhooks | gestão | herda | herda | herda | shell | HERDA DS E ESTÁ ADEQUADA | — | |
| /app/metrics | gestão | header | herda | herda | PageHeader | PREMIUM | — | Dados iguais |
| /app/audit | gestão | header | herda | herda | PageHeader | PREMIUM | — | Técnico |
| /app/settings | settings | herda | herda | herda | NavHub | HERDA DS E ESTÁ ADEQUADA | — | Hub já agrupado |
| /app/settings/profile | settings | header | herda | herda | PageHeader | PREMIUM | — | |
| /app/settings/security | settings | header | herda | herda | PageHeader | PREMIUM | — | |
| /app/settings/notifications | settings | header | herda | herda | PageHeader | PREMIUM | — | |
| /app/team | settings | header | herda | herda | PageHeader | PREMIUM | — | |
| /app/team/invite | settings | herda | herda | herda | forms | HERDA DS E ESTÁ ADEQUADA | — | |
| /app/settings/atendimento | settings | herda | herda | herda | shell | HERDA DS E ESTÁ ADEQUADA | — | |
| /app/settings/tenant | settings | herda | herda | herda | shell | HERDA DS E ESTÁ ADEQUADA | — | |
| /app/settings/business | settings | herda | herda | herda | shell | HERDA DS E ESTÁ ADEQUADA | — | Meu Negócio |
| /app/settings/perfil | settings | herda | herda | herda | shell | HERDA DS E ESTÁ ADEQUADA | — | |
| /app/settings/marca | settings | herda | herda | herda | shell | HERDA DS E ESTÁ ADEQUADA | — | White-label |
| /app/settings/billing | settings | herda | herda | herda | stub | HERDA DS E ESTÁ ADEQUADA | — | Stub self-host |
| /app/settings/tenant/pipelines | settings | herda | herda | herda | shell | HERDA DS E ESTÁ ADEQUADA | — | |
| /app/settings/tenant/agenda | settings | herda | herda | herda | shell | HERDA DS E ESTÁ ADEQUADA | — | |
| /app/settings/api-tokens | settings | herda | herda | herda | shell | HERDA DS E ESTÁ ADEQUADA | — | |
| /app/lgpd/requests | legal | header | herda | herda | PageHeader tokens | LEGAL — NÃO ALTERAR fluxo | — | Só layout |
| /app/manual | settings | herda | herda | herda | shell | HERDA DS E ESTÁ ADEQUADA | — | |
| /app/settings/atualizacao | admin | herda | herda | herda | shell | HERDA DS E ESTÁ ADEQUADA | — | Platform |
| /admin | admin | herda | herda | n/a | shell | HERDA DS E ESTÁ ADEQUADA | — | Fora do tenant |
| /onboarding | auth | herda | herda | herda | tokens | PÚBLICA/ESPECIAL | — | Auth intacta |

**62/62 classificadas.**
