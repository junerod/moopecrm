# Pack Locadora v1 — matriz de provas

| CAPACIDADE | IMPLEMENTADA? | PROVA REAL? | TESTE | EVIDÊNCIA | RISCO RESIDUAL |
|---|---|---|---|---|---|
| Conceito Pack versionado | SIM | REAL | `business-pack-locadora.test.ts` | `settings.business_pack` `{id,version,artifacts}` | Atualização futura de template não reescreve artifacts existentes |
| Instalação 1 clique | SIM | REAL | E2E `pack-locadora` + action `instalarPack` | Tela revisar → Preparar | Depende do wizard completar |
| Idempotência | SIM | REAL | unit + E2E reaplicar | select-before-insert por nome/id | Mock de unit não exercita Postgres unique |
| Não sobrescreve customização | SIM | REAL | unit + E2E rename agente | `fundirArtifacts` preserva ids | Prompt editado no default só se ainda for texto de loja |
| Funil COMERCIAL — LOCADORA | SIM | REAL | unit + E2E | 8 etapas (teto `MAX_ETAPAS=8`; Reativar é campanha/tag) | 9ª coluna não entra no quadro |
| Inbound | SIM | REAL | unit inbound + E2E settings.crm | `semearInboundSeAusente` | — |
| 6 especialidades | SIM | REAL | unit + E2E nomes | `ai_agents` rag_bot, `is_default=false` | Router por canal só após WhatsApp (schema exige `channel_session_id`) |
| Uma conversa | SIM | PARCIAL | intents + test-drive | Classificador determina especialidade; um default do wizard | Router vivo no WhatsApp ainda precisa de canal |
| Knowledge por coleção | SIM | REAL | unit + E2E slugs | 4 coleções vazias + `config.knowledge_collection_ids` | RAG só depois do cliente enviar manuais |
| Vision/multimodal | SIM | PRESERVADO | sem regressão no pack | Pack não toca indexer/Vision | — |
| Automações prontas | SIM | PARCIAL | unit `is_active=false` | Regras com trigger existente; gestão-only só na UI | 2h/24h não são silence-sweep nativo (tag + regra) |
| Respostas rápidas | SIM | REAL | E2E titles | `message_templates` compartilhados | `{{org_name}}` é placeholder editável |
| Campanhas prontas | SIM | PARCIAL | E2E template de campanha | Modelos de texto, **não** disparo | Segmentos Gestão (contrato/boleto) não materializados |
| Testar assistentes | SIM | REAL | unit + E2E | Sem WhatsApp, sem tool externa | LLM não roda no ensaio |
| Standalone sem Gestão | SIM | REAL | unit + E2E boleto/SUV | Recusa operacional | — |
| Integração Gestão | PARCIAL | CÓDIGO REAL / E2E NÃO | matriz em INTEGRACAO_MOOPE | Tools MCP read-only | Parceiro pode 404 |
| Cliente por telefone | PARCIAL | CÓDIGO | `moope_lookup_locatario` | — | E2E Gestão não validada |
| Veículos/disponibilidade | PARCIAL | CÓDIGO | `moope_listar_oferta` | Oferta ≠ calendário | — |
| Financeiro/boleto/PIX | PARCIAL / NÃO (PIX) | CÓDIGO | retrato `boleto_url` | PIX inexistente | — |
| Contratos/locações | PARCIAL | CÓDIGO | retrato | Sem histórico | — |
| Manutenção | NÃO DISPONÍVEL | — | catálogo amigável ○ | — | — |
| Multas/sinistros | NÃO DISPONÍVEL | — | catálogo amigável ○ | — | — |
| AI_MODE/policy | SIM | REAL | unit ai_mode + E2E | Default pack = copilot; nunca autonomous | setup-ai ainda pode mudar depois |
| Human takeover | SIM | PRESERVADO | sem mudança em comando da conversa | — | — |
| Tenant isolation | SIM | REAL | E2E org B | settings/agentes por `organization_id` | — |
| RBAC | SIM | REAL | rotas requireRole | Instala: admin; vê: manager+ | Sem role nova |
| Auditoria | SIM | REAL | `AUDIT_ACTIONS` | `pack.installed` / `pack.updated` | Sem PII financeiro |
| Mobile/light/dark | SIM | E2E | viewport 390×844 + emulateMedia | Sem screenshot de design novo | Nota visual no RESULTADO |
| Migration | NÃO | — | — | JSONB `organizations.settings` | — |
