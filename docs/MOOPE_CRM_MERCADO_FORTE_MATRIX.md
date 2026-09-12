# MOOPE CRM — Matrix Mercado Forte

Checklist de **todas** as capacidades da auditoria.  
Fonte: [`MOOPE_CRM_AUDITORIA_MERCADO_FORTE.md`](./MOOPE_CRM_AUDITORIA_MERCADO_FORTE.md)  
SHA: `a0548126` · 2026-09-12 · somente diagnóstico.

**Status:** A mercado forte · B existe, evoluir · C motor/UX fraca · D parcial · E não existe · F N/A  
**Prioridade:** P0 Bloco 1 · P1 Bloco 2 · P2 Bloco 3 · P3 pode esperar · — não mexer

| Área | Capacidade | Status A-F | Cobertura % | Backend | UX | Evidência | Gap | Prioridade |
|---|---|---|---:|---|---|---|---|---|
| Multiatendimento | Inbox compartilhada | B | 88 | sim | sim | `InboxLayout.tsx`, RLS `fn_can_view_conversation`, `useConversationsRealtime.ts` | Visão colegas; push | P0 |
| Multiatendimento | Múltiplos atendentes | B | 90 | sim | sim | `/app/team`, `user_organizations`, availability | Sem entidade equipe | P3 |
| Multiatendimento | Assumir conversa | B | 92 | sim | sim | `claim/route.ts`, `fn_conversation_assign`, `useClaimConversation.ts` | Takeover visual = Transferir | — |
| Multiatendimento | Liberar conversa | B | 90 | sim | sim | `release/route.ts` | — | — |
| Multiatendimento | Transferir conversa | B | 88 | sim | sim | `transfer/route.ts`, `ReassignDialog.tsx` | Sem aceite | P0 |
| Multiatendimento | Transferir para usuário | B | 90 | sim | sim | `to_user_id`, `useAssignableMembers.ts` | — | — |
| Multiatendimento | Transferir para equipe | E | 0 | não | não | Sem tabela teams | Schema de equipe | P3 |
| Multiatendimento | Filas | B | 85 | sim | sim | `lib/routing/queue.ts`, aba Fila, cron routing-worker | Filas nomeadas | P3 |
| Multiatendimento | Equipes/departamentos | D | 25 | parcial | parcial | `/app/team` = roster; `papel=equipe` é contato | Entidade departamento | P3 |
| Multiatendimento | Responsáveis | B | 85 | sim | sim | `assigned_to_user_id`, `owner_user_id`, espelho no lead | Multi-pipeline | — |
| Multiatendimento | Status de atendente | B | 80 | sim | sim | `attendant_availability`, `AttendantsClient.tsx` | — | P0 |
| Multiatendimento | Online/offline | C | 65 | sim | fraca | Heartbeat só no PATCH; cron 15 min | Ping periódico no client | P0 |
| Multiatendimento | Presença em conversa | D | 30 | não | parcial | Assignee estático | Viewers live | P3 |
| Multiatendimento | “João está atendendo” | B | 75 | sim | sim | `comandoDaConversa`, `OwnerBadge` | Copy; lista condicional | P0 |
| Multiatendimento | “João está digitando” | E | 0 | ingest descarta | não | `lib/waha/ingest.ts` L489 | Consumir presence | P3 |
| Multiatendimento | Collision detection | B | 82 | sim | parcial | `fn_conversation_assign`, `decidirEnvioConversacional`, before-send | Humano×humano | P0 |
| Multiatendimento | Impedir resposta simultânea | B | 78 | sim IA×humano | parcial | `DENY_HUMAN_ACTIVE` | Lock composer | P0 |
| Multiatendimento | Lock/claim | B | 90 | sim | sim | optimistic lock `p_expected_assignee` | — | — |
| Multiatendimento | Takeover humano | B | 80 | sim | parcial | Transfer `enforce_expected=false` | UX Assumir oculta | P0 |
| Multiatendimento | Devolução para IA | B | 88 | sim | sim | `reactivate-bot`, `devolverAtendimentoAoAgente` | — | — |
| Multiatendimento | Distribuição automática | B | 80 | sim | sim | routing-worker; default **manual** | Ligar/explicar RR | P0 |
| Multiatendimento | Round-robin | B | 85 | sim | config | `lib/routing/decide.ts` `selectRoundRobin` | — | — |
| Multiatendimento | Distribuição por carga | D | 45 | filtro sim | modo não | `currentLoad` vs capacity; modo `load` inalcançável | Modo + algoritmo | P3 |
| Multiatendimento | Distribuição por equipe | E | 0 | não | não | `loadEligibleAttendants` = org inteira | Depende de equipes | P3 |
| Multiatendimento | Distribuição por horário | B | 75 | sim | sim | `schedule` jsonb, `isWithinSchedule` | — | — |
| Multiatendimento | Distribuição por skill | E | 0 | não | não | Zero em `lib/routing/` | Skills | P3 |
| Multiatendimento | Reatribuição | B | 88 | sim | sim | Transfer + MCP `crm_assign_conversation` | — | — |
| Multiatendimento | Conversa sem responsável | A | 95 | sim | sim | `assigned_to_user_id IS NULL` + Fila | — | — |
| Multiatendimento | Fila geral | B | 90 | sim | sim | aba + counts; `avg_wait` só MCP | Expor espera | P0 |
| Multiatendimento | Minhas conversas | B | 92 | sim | sim | aba Minhas + RLS `own` | — | — |
| Multiatendimento | Conversas da equipe | D | 50 | RLS `all` | aba Todas manager | Agent não vê colegas | Filtro colegas | P0 |
| Colaboração | Nota interna | A | 95 | sim | sim | `conversation_notes` 0063, Composer modo note | Anexo/menção | — |
| Colaboração | Comentário privado | A | 90 | sim | sim | = notes | Comentário no card | — |
| Colaboração | @menção | E | 0 | não | não | Categoria stub em `settings.ts` | Parser + notificação | P3 |
| Colaboração | Notificação de menção | D | 5 | não | stub | `updateNotificationPrefs.ts` STUB | Migration prefs | P3 |
| Colaboração | Conversa interna × contato | D | 25 | tag `papel=equipe` | não | Não é chat interno | Fora de escopo | P3 |
| Colaboração | Conversa interna × lead | D | 40 | cases/demandas | parcial | Sem thread Slack-like | Fora de escopo | P3 |
| Colaboração | Anexos internos | E | 0 | não | off no note | Composer desliga anexo | Schema | P3 |
| Colaboração | Histórico de transferências | C | 65 | sim | não | `conversation_assignment_events` | UI na conversa | P0 |
| Colaboração | Histórico de responsáveis | C | 45 | parcial | não | `lead_edited` / owner | Painel de donos | P1 |
| Colaboração | Motivo da transferência | B | 80 | sim | sim | `reason` no dialog + audit | Categorias; some sem lead | P0 |
| Colaboração | Auditoria de ações | B | 75 | sim | manager | `api_audit_log`, `/app/audit` | Unificar no inbox | P1 |
| Colaboração | Seguidores/observadores | E | 0 | não | não | — | Tabela | P3 |
| Colaboração | Supervisor acompanhando | C | 35 | RLS | aba Todas | Sem watch/alerta | Alerta P1 | P1 |
| Colaboração | Whisper / internal reply | A | 90 | sim | sim | Modo nota | Thread aninhado | — |
| Produtividade | Respostas rápidas | B | 85 | sim | escondida | `/app/templates`, sem sidebar | Porta no uso diário | P0 |
| Produtividade | Snippets | B | 85 | sim | escondida | = templates | — | P0 |
| Produtividade | Atalhos `/` | A | 90 | sim | sim | `TemplateMenu.tsx`, `resolveSlash()` | Comandos `/assign` | — |
| Produtividade | Templates internos | B | 85 | sim | escondida | Distintos de HSM | Porta | P0 |
| Produtividade | Templates WhatsApp HSM | B | 70 | sim | conexões | `meta_templates`, `lib/channels/meta/` | Picker no composer | P0 |
| Produtividade | Favoritos | E | 0 | não | não | — | — | P3 |
| Produtividade | Respostas recentes | E | 0 | não | não | Só contexto IA | — | P3 |
| Produtividade | IA sugerindo resposta | B | 80 | sim | discreta | `draft-reply` + Copilot | Unificar UX | P0 |
| Produtividade | Copilot | B | 75 | sim | sim gated | `AssistenteIa.tsx`, `lib/ai/copiloto/` | Auto só copilot mode | P1 |
| Produtividade | Resumo da conversa | B | 60 | sim | no Copilot | campo `summary` | Botão independente | P1 |
| Produtividade | Próxima ação sugerida | B | 70 | sim | kanban/IA | `NextActionSlot`, proposals | Pouco no inbox | P1 |
| Produtividade | Criar tarefa da conversa | D | 10 | policy only | não | `create_task` em `autorizar.ts` | Entidade ou = demanda | P2 |
| Produtividade | Lembrete | C | 50 | snooze | parcial | agenda reminder default false | Cron | P3 |
| Produtividade | Snooze | A | 85 | sim | sim | 0062, `snooze-watcher` | Datetime custom | — |
| Produtividade | Agendamento | B | 70 | sim | `/app/agenda` | `lib/agenda/` | Nascer do composer | P1 |
| Produtividade | Follow-up | A | 85 | sim | hub IA | `lib/followup/` | Descoberta | — |
| Produtividade | Ações em massa | C | 55 | leads | kanban | `POST /leads/bulk` | Bulk inbox | P1 |
| Produtividade | Fechar várias | E | 0 | não | não | Close unitário | Bulk | P1 |
| Produtividade | Atribuir várias | C | 50 | leads | kanban | Bulk assign lead | Bulk conversas | P1 |
| Produtividade | Tags em massa | C | 50 | leads | kanban | Bulk tag | Tags conversa | P1 |
| Produtividade | Pesquisa de conversas | C | 55 | preview ILIKE | sim | `InboxFilters.tsx` | Corpo/contato | P1 |
| Produtividade | Filtros salvos | E | 0 | não | URL only | — | Views | P3 |
| Produtividade | Filtros avançados | B | 70 | query string | abas+chips | canal/tag/papel/unread | AND complexo | P3 |
| Produtividade | Ordenação | B | 75 | sim | fixa | inbound vs last_message | Escolha manual | P3 |
| Produtividade | Keyboard shortcuts | B | 65 | — | j/k/r/a/e/? | `InboxKeyboardShortcuts.tsx` | `i`, Cmd+Enter | P0 |
| Produtividade | Command palette | B | 60 | — | ⌘K telas | `CommandPalette.tsx` | Buscar entidades | P3 |
| CRM/Funil | Múltiplos pipelines | B | 88 | sim | sim | `/api/v1/pipelines`, seletor | — | — |
| CRM/Funil | Stages | B | 90 | sim | sim | `crm_stages`, settings | — | — |
| CRM/Funil | Drag-and-drop | A | 92 | sim | sim | `KanbanBoard.tsx`, fractional index | — | — |
| CRM/Funil | Ganho | B | 85 | sim | sim | `.../win`, trigger close | — | — |
| CRM/Funil | Perdido | B | 85 | sim | sim | `.../lose`, `LoseLeadDialog` | — | — |
| CRM/Funil | Motivo da perda | B | 80 | sim | sim | `lost_reason` + settings | — | — |
| CRM/Funil | Reativação | B | 78 | sim | sim | `crm_lead_reactivations` | — | — |
| CRM/Funil | Múltiplas oportunidades/contato | B | 72 | sim | inbox | Sem UNIQUE 1-open | Ambiguidade roteamento | P1 |
| CRM/Funil | Histórico da oportunidade | B | 88 | sim | sim | `LeadTimeline`, timeline API | — | — |
| CRM/Funil | Responsável | B | 82 | sim | sim | owner humano + agente | — | — |
| CRM/Funil | Origem | B | 78 | sim | filtro | `source`, `origem-comercial.ts` | — | — |
| CRM/Funil | Valor | B | 85 | sim | sim | `value_cents` | — | — |
| CRM/Funil | Probabilidade | B | 75 | IA | card | `crm_lead_scores` | Campo manual | P3 |
| CRM/Funil | Temperatura | C | 55 | sim | só inbox | `crm_leads.temperatura` | Slot no Kanban | P0 |
| CRM/Funil | Score | B | 80 | sim | card | `ScoreSlot`, invariantes | — | — |
| CRM/Funil | Próximo passo | B | 70 | dois modelos | misto | `lead_state` vs `demandas` | Unificar vocabulário | P1 |
| CRM/Funil | Vencimento do próximo passo | D | 40 | demandas | radar | `proximo_passo_em` | Due na ação IA | P1 |
| CRM/Funil | Oportunidades paradas | B | 82 | sim | `/app/radar` | `risk-radar.ts` | — | — |
| CRM/Funil | Aging | B | 76 | timestamps | card | `card-state.ts` | Relatório | P1 |
| CRM/Funil | Filtros | B | 74 | — | `FilterBar.tsx` | owner/status/tag/origem | Valor min/max UI | P3 |
| CRM/Funil | Busca | B | 68 | trgm contato | board | título/descrição | Full-text lead | P1 |
| CRM/Funil | Automações por stage | B | 72 | sim | webhooks | `lead.stage_changed` | Playbook por coluna | P2 |
| CRM/Funil | Mudança automática de stage | B | 78 | sim | indireta | agente + `create-or-move-lead` | — | — |
| CRM/Funil | Ações ao entrar no stage | D | 35 | evento global | não | `requires_human` | Editor on-enter | P3 |
| CRM/Funil | Ações ao sair | E | 15 | possível no payload | não | só `to_stage_id` nas conditions | on_exit | P3 |
| CRM/Funil | Lead → Cliente | C | 52 | `papel` | manual Inbox | `MarcarPessoa.tsx` | Won não promove — não implementar lifecycle | P3 |
| CRM/Funil | Lifecycle | C | 58 | status + papel | vocabulário | Sem state machine | Não implementar agora | P3 |
| CRM/Funil | Campos personalizados | B | 80 | lead | formulário | `pipeline.settings.fields` | Não no contato | P1 |
| CRM/Funil | Tags | B | 86 | sim | sim | `tags[]` GIN | — | — |
| CRM/Funil | Produtos/serviços | D | 25 | links order | inbox | Nuvemshop | Catálogo no deal | P3 |
| CRM/Funil | Proposta comercial | E | 20 | proposals=IA | fila IA | `/leads/proposals` | PDF/CPQ | P3 |
| CRM/Funil | Orçamento | D | 28 | data + agenda | campo | `expected_close_date` | — | P3 |
| CRM/Funil | Forecast | E | 12 | dados brutos | não | value + close + score | Tela | P3 |
| Contatos 360 | Dados básicos | B | 85 | sim | sim | `contacts`, ficha | — | — |
| Contatos 360 | Múltiplos telefones | E | 8 | 1 coluna | 1 campo | `phone_number` + `wa_lid` | Schema | P3 |
| Contatos 360 | Múltiplos emails | E | 8 | 1 coluna | 1 campo | `email` | Schema | P3 |
| Contatos 360 | WhatsApp | A | 90 | sim | inbox | E.164, open-with-contact | — | — |
| Contatos 360 | Tags | B | 84 | sim | sim | `contacts.tags` | — | — |
| Contatos 360 | Campos customizados contato | E | 15 | não | não | CF só no lead | Schema | P3 |
| Contatos 360 | Histórico de mensagens | C | 58 | sim | link Inbox | `messages` | Na ficha | P1 |
| Contatos 360 | Histórico de leads | C | 48 | sim | ficha vazia | captures + leads | Aba negócios | P1 |
| Contatos 360 | Negócios | C | 50 | sim | Inbox sim / ficha não | `crm-summary` | Unificar ficha | P1 |
| Contatos 360 | Atividades | B | 80 | sim | timeline | `TimelineView.tsx` | — | — |
| Contatos 360 | Tarefas/demandas | C | 62 | sim | Inbox/Radar | `lib/demandas/` | Na ficha | P1 |
| Contatos 360 | Documentos | E | 10 | não | não | — | Gaveta | P3 |
| Contatos 360 | Arquivos | E | 10 | media WA | não | bucket `whatsapp-media` | Gaveta | P3 |
| Contatos 360 | Notas | D | 42 | notes conversa | inbox | sem nota do contato | — | P3 |
| Contatos 360 | Origem | B | 76 | sim | lista/ficha | `source` | — | — |
| Contatos 360 | Campanhas recebidas | D | 38 | UTM | webhooks | `atribuicao-de-anuncio.ts` | Na ficha | P1 |
| Contatos 360 | Automações executadas | D | 35 | runs | webhooks | `automation_rule_runs` | Na ficha | P1 |
| Contatos 360 | Consentimento/opt-in | D | 45 | jsonb | sem edição | `contacts.consent` | UI | P2 |
| Contatos 360 | Opt-out | B | 82 | sim | badge | `lib/opt-out/deteccao.ts` | — | — |
| Contatos 360 | LGPD | B | 78 | sim | admin+dialog | redact/export | — | — |
| Contatos 360 | Timeline unificada | B | 82 | sim | sim | timeline-query | — | — |
| Contatos 360 | Relacionamento MOOPE Gestão | B | 70 | sim | parcial | `source=moope`, launch | Retrato no centro | P2 |
| Automações | Graph engine (follow-up) | A | 90 | sim | builder | `lib/followup/*`, React Flow | — | — |
| Automações | Flat automation | B | 75 | sim | `/app/webhooks` | 5 triggers × 6 actions | Versionar regra | P2 |
| Automações | Ready Automations | B | 70 | sim | estreita | `lib/ready-models/` | Mais prontas na UI | P2 |
| Automações | Versionamento | A/F | 45 | grafo sim / flat não | publish/rollback | `fn_publish_followup_flow_version` | Flat | P3 |
| Automações | Logs / retry / idempotência | A | 85–90 | sim | dossier | `automation_rule_runs`, enrollment events | — | — |
| Automações | Cancelamento / takeover | A | 80 | sim | sim | pause/snooze/skip; handoff_policy | — | — |
| Automações | AI_MODE nas automações | A | 85 | sim | settings | bloqueia send_ai e fluxos IA | — | — |
| Automações | Trigger mensagem recebida | A | 90 | sim | sim | flat + reactivity | — | — |
| Automações | Trigger conversa criada | E | 5 | outbound MOOPE only | não | `conversation.opened` | Trigger flat | P2 |
| Automações | Trigger lead criado | B | 70 | sim | sim | `lead.created` | — | — |
| Automações | Trigger stage mudou | A | 90 | sim | sim | flat + `gatilho-etapa.ts` | — | — |
| Automações | Trigger tag | B | 65 | sim | sim | lead/contact tag | Enroll por tag | P3 |
| Automações | Trigger responsável mudou | E | 0 | não | não | — | Evento | P3 |
| Automações | Trigger tempo sem resposta | B | 75 | silence sweep | hub | `silence-sweep.ts` | — | — |
| Automações | Trigger horário/cron | C | 45 | wait/postpone | não genérico | — | Cron trigger | P3 |
| Automações | Trigger webhook | C | 45 | captura → lead | indireto | `webhooks/in/[token]` | — | P3 |
| Automações | Trigger evento MOOPE | D | 25 | inbound sync | não regra | `eventos-inbound.ts` | Emitir para engine | P2 |
| Automações | Trigger pagamento | D | 20 | `debt.changed` move card | não regra | funil Dívidas | Evento automação | P2 |
| Automações | Trigger contrato | D | 20 | `contract.changed` | funil | Locatários | Evento automação | P2 |
| Automações | Condition campo/tag/stage | B/C | 40–70 | flat path / grafo 4 campos | editor | `conditions.ts`, graph-schema | Score/sentimento/owner | P3 |
| Automações | Condition pipeline/horário/origem | E/D | 0–25 | não nativo | não | — | — | P3 |
| Automações | Condition intenção/sentimento/score | E/C | 0–50 | classify indireto | não | sentiment é worker | — | P3 |
| Automações | Action mensagem/template/IA/wait | A/B | 75–85 | sim | sim | send-whatsapp, graph actions | — | — |
| Automações | Action atribuição/tag/stage | C | 45–50 | só flat | webhooks | grafo não move CRM | Ações no grafo | P2 |
| Automações | Action demanda/MCP/MOOPE | E | 0 | não | não | — | — | P2 |
| Automações | Action webhook outbound | C | 50 | flat | sim | `call-webhook.ts` | No grafo | P3 |
| Campanhas | Campanha comercial (entidade) | E | 0 | não | não | Sem `lib/campaigns` | Motor novo | P2 |
| Campanhas | Lista / segmento / filtros | E | 0 | não | não | — | — | P2 |
| Campanhas | Template / variáveis | B | 65–70 | HSM + operacional 1:1 | conexões | `meta_templates`, `ModeloDoDisparo` | Picker campanha | P2 |
| Campanhas | Preview / agendamento / lote | E | 0 | não | não | — | — | P2 |
| Campanhas | Rate limit | B | 75 | sim | — | pacing 5s proativo | — | — |
| Campanhas | Opt-out / consentimento | B/C | 70/40 | STOP + `is_blocked` | consent sem UI | `deteccao.ts` | UI consent | P2 |
| Campanhas | Status / entregue / lido / erro / retry | C | 45–75 | `messages.status` | sem dashboard | schema messaging | Métricas de lote | P2 |
| Campanhas | Respondido / campanha→lead/venda | E | 0–30 | inferível | não | — | Atribuição inversa | P2 |
| Campanhas | Métricas / atribuição comercial | E | 0 | UTM é inbound ads | — | `atribuicao-de-anuncio.ts` | Não misturar | P2 |
| Campanhas | Templates Meta/Zernio/Twilio | B | 65 | Meta/Zernio | Twilio fraco | adapters | — | P2 |
| Campanhas | Disparo operacional MOOPE | B | 70 | sim | API Gestão | `lib/moope/enviar.ts` **não é campanha** | Não esticar | — |
| Campanhas | Disparo comercial CRM | E | 0 | não | não | — | Módulo novo | P2 |
| WhatsApp | Múltiplos números | A | 92 | sim | conexões | `channel_sessions` | — | — |
| WhatsApp | Múltiplos providers | A | 95 | sim | sim | waha/meta/zernio/twilio | — | — |
| WhatsApp | QR | A | 90 | sim | sim | `.../qr` | — | — |
| WhatsApp | Meta oficial | B | 82 | sim | sim | `lib/channels/meta/` | — | — |
| WhatsApp | Zernio | B | 85 | sim | sim | `lib/channels/zernio/` | — | — |
| WhatsApp | Twilio | C | 65 | sim | fraca | sem templates UI | — | P3 |
| WhatsApp | WAHA | A | 93 | sim | sim | `lib/waha/` | — | — |
| WhatsApp | Status / health / reconexão / cooldown | A/B | 78–90 | sim | conexões+Central | `health.ts`, `reconectar.ts`, cooldown 6h | — | — |
| WhatsApp | Templates canal | B | 83 | sim | conexões | template-sync | Composer | P0 |
| WhatsApp | Mídia áudio/doc/imagem/vídeo | B | 78–88 | sim | inbox | Storage + AudioRecorder | — | — |
| WhatsApp | Localização | C | 55 | tipo | incerta | CHECK + ingest | Render | P3 |
| WhatsApp | Contatos vcard | B | 80 | sim | parcial | `contact-card.ts` | — | P3 |
| WhatsApp | Reactions | D | 35 | ingest | não | CHECK `reaction` | UI | P3 |
| WhatsApp | Reply / quoted | B | 80–82 | sim | sim | `reply_to_message_id` 0168 | — | — |
| WhatsApp | Delivery / read | B | 83–85 | sim | ticks | ack + webhooks | — | — |
| WhatsApp | Typing / presence | E | 5 | descartado | não | ingest L489 | — | P3 |
| WhatsApp | Webhook / dedupe / idempotência | A | 90–92 | sim | — | HMAC + unique external_id | — | — |
| WhatsApp | Retry | B | 75 | stuck-messages | — | não toca `queued` | — | — |
| WhatsApp | Histórico | C | 60 | WAHA only | API | `lib/waha/historico.ts` | Oficiais | P3 |
| WhatsApp | Número por equipe/atendente | E | 0 | não | não | — | Depende equipes | P3 |
| WhatsApp | Número por pipeline | D | 25 | agente aponta sessão | não inbound | `channel_session_id` na versão | Regras | P3 |
| WhatsApp | Roteamento por número | C | 50 | conversa nasce na sessão | sem regras | — | Fila por número | P3 |
| IA | Copilot | B | 85 arq / 80 UX | sim | inbox | `gerar.ts`, `AssistenteIa.tsx` | — | P1 |
| IA | Resposta sugerida | B | 82/78 | sim | Usar resposta | draft-reply + copilot | Unificar | P0 |
| IA | Resumo | B | 80/70 | sim | painel | `summary` | Botão | P1 |
| IA | Classificação / intenção | B/C | 83/55 | sim | label | classifiers | Visível no funil | P1 |
| IA | Sentimento | C/E | 55/10 | workers | não | `ai-sentiment-worker` | Indicador | P3 |
| IA | Qualificação | B/C | 78/50 | `lead_state` | dossiê | — | Wizard | P3 |
| IA | Lead score | B | 80/72 | sim | card | `score-writer.ts` | — | — |
| IA | Próxima ação | B/C | 75/60 | sim | misto | Copilot + followup | Inbox | P1 |
| IA | Atualização de CRM | A/B | 88/75 | sim | indireta | MCP + move-lead-stage | — | — |
| IA | Criação de tarefa | D/E | 30/5 | policy | não | sem executor | Estrutural | P2 |
| IA | Mudança de stage | A/B | 90/70 | sim | funil | — | Confirmação controlled | P1 |
| IA | Agente autônomo | A/B | 92/78 | sim | badges | `inbound-turn.ts` | — | — |
| IA | Handoff / takeover | A/B | 90/82 | sim | inbox | orchestrator + comando | — | — |
| IA | AI_MODE | A/B | 90/85 | sim | settings | `modos.ts` | — | — |
| IA | Action Policy | B/C | 82/55 | sim | incipiente | `autorizar.ts` | UX controlled | P1 |
| IA | Kill switch | A/B | 88/75 | camadas | toggles | `AI_EXECUTION` | — | — |
| IA | Spend cap | B | 75/78 | sim | BudgetCard | caveat pricing | — | — |
| IA | Memória | B | 80/75 | sim | `/app/ai/memory` | — | — | — |
| IA | RAG | A/C | 90/45 | sim | invisível | pgvector, rag-indexer | Fontes inline | P1 |
| IA | Knowledge base | B | 85/82 | sim | sim | `/app/ai/knowledge/sources` | — | — |
| IA | MCP | A/D | 88/30 | sim | s2s | `app/api/mcp/route.ts` | UI conectar | P3 |
| IA | Tools / skills | A/B | 90/78 | sim | editor | `lib/mcp/tools`, `/app/ai/skills` | — | — |
| IA | Agent roles | B/C | 80/58 | conversador/operador | toggle | `operator-turn.ts` | Explicação Simple | P3 |
| IA | Audit / execução | A/B | 88/72 | sim | runs | `ai_agent_runs`, `/app/ai/runs` | — | — |
| IA | Avaliação / feedback | C/D | 58/35 | evolution | sem thumbs | golden-candidates | Rating inbox | P3 |
| IA | Guardrails / anti-alucinação | A/B | 88/80 | before-send | editor | `anti-alucinacao.ts` | Fontes | P1 |
| IA | Critical facts | C | 60/45 | layers | sem tela | guardrail-layers | — | P3 |
| IA | Prompt / versionamento | B/A | 82/90 | versões imutáveis | editor+diff | `ai_agent_versions` | — | — |
| Gestão | Dashboard de atendimento | C | 35 | pedaços | sem unificar | `/app/inicio`, `/app/metrics` | Painel mínimo | P1 |
| Gestão | Conversas recebidas/abertas/fila | C/B | 45–75 | counts | inbox | `conversations/counts` | KPI temporal | P1 |
| Gestão | Tempo na fila | C | 40 | `getQueueStatus` | não | `lib/routing/queue.ts` | Expor | P0 |
| Gestão | Primeira resposta | B | 65 | `fn_attendant_metrics` | Desempenho | migration 0037 | — | P1 |
| Gestão | TMR / resolução / tempo resolução | C/D | 15–35 | timestamps | não | Atrito p90 | Agregar | P1 |
| Gestão | SLA / SLA estourado | E | 5 | LGPD only | LGPD | `lib/lgpd/sla.ts` | Motor novo | P3 |
| Gestão | Volume / produtividade / transferência | B/C | 45–70 | eventos | tabela | metrics + assignment_events | Relatório | P1 |
| Gestão | Abandono | B | 55 | Atrito | painel | `AtritoPanel.tsx` | — | P1 |
| Gestão | Horário de pico | E | 0 | não | não | — | — | P3 |
| Gestão | Desempenho por equipe | C | 40 | por pessoa | — | org flat | Equipes | P3 |
| Gestão | Leads / propostas / won / lost / conversão | C/B | 40–65 | sim | Desempenho+Kanban | propostas=IA | Win rate clássico | P1 |
| Gestão | Receita / ticket / aging relatório / forecast | D/E | 0–35 | value_cents | não | — | Telas | P3 |
| Gestão | Funil / origem | B | 60–70 | sim | snapshot | — | — | P1 |
| Gestão | Campanhas (analytics) | C | 45 | UTM | capturas | ads attribution | ≠ disparo | P2 |
| Gestão | IA (desempenho) | B | 65 | sim | evolution/usage | operator-metrics | — | — |
| Gestão | CSAT / NPS | E | 5 | não | não | só PRD | — | P3 |
| Notificações | In-app / Central | B | 55 | `agent_inbox_items` | sino IA | `AlertsBell.tsx` | Kinds humanos | P1 |
| Notificações | Realtime | B | 75 | postgres_changes | inbox/kanban | hooks inbox | — | — |
| Notificações | Browser / push | C/D | 50/10 | — | stub | switches disabled | Prefs | P3 |
| Notificações | Email | C | 40 | Resend | sem prefs | LGPD/convite/budget | — | P3 |
| Notificações | WhatsApp interno staff | E | 0 | não | não | — | — | P3 |
| Notificações | Menção / lead atribuído | D | 15 | schema | stub | `NOTIFICATION_CATEGORIES` | — | P3 |
| Notificações | Transferência | C | 45 | event + handoff item | não ao humano | orchestrator | Kind in-app | P0 |
| Notificações | Próximo passo / vencido | B | 60–65 | demandas + cron | radar/Central | snooze/reactivation expired | — | P1 |
| Notificações | SLA atendimento | E | 5 | — | LGPD | — | — | P3 |
| Notificações | Nova conversa / resposta cliente | C/B | 50–70 | realtime | lista | sem alerta | Toast/kind | P1 |
| Notificações | Supervisor | C | 45 | visibility | sem alerta | — | — | P1 |
| Notificações | Notification center / prefs | C | 50 | não migrado | stub | `feature_not_yet_available` | Migration | P1 |
| Integração MOOPE | Localizar cliente | EXISTE | 90 | GET+MCP | indireto | `lookupLocatario` | No cockpit | P2 |
| Integração MOOPE | Localizar veículo | PARCIAL | 45 | oferta | — | placa→locatário | Entidade veículo | P3 |
| Integração MOOPE | Disponibilidade | PARCIAL | 45 | `listarOferta` | — | catálogo | Calendário | P3 |
| Integração MOOPE | Locação / contrato | PARCIAL | 45 | retrato + inbound | funil | `contract.changed` | Detalhe | P2 |
| Integração MOOPE | Parcela | NÃO EXISTE | 0 | não | não | — | API Gestão | P3 |
| Integração MOOPE | Boleto/PIX | PARCIAL | 45 | URL no retrato | send 1:1 | CRM não gera | — | P2 |
| Integração MOOPE | Checklist / vistoria | NÃO EXISTE | 0 | não | não | — | — | P3 |
| Integração MOOPE | Manutenção | PARCIAL | 30 | prompt | — | sem API | — | P3 |
| Integração MOOPE | Multa / sinistro / rastreamento | NÃO EXISTE | 0 | não | não | — | — | P3 |
| Integração MOOPE | Documentos | PARCIAL | 40 | `documentos[]` | — | sem download | — | P3 |
| Integração MOOPE | Criar cliente / lead | PARCIAL | 45 | inbound | — | CRM→Gestão proibido | Doutrina read-only | P3 |
| Integração MOOPE | Pré-reserva / locação / proposta | NÃO EXISTE | 0 | não | não | cliente GET-only | — | P3 |
| Integração MOOPE | Enviar cobrança | PARCIAL | 50 | `/send` | API | Gestão gera link | — | P2 |
| Integração MOOPE | Enviar contrato | NÃO EXISTE | 0 | — | — | — | — | P3 |
| Integração MOOPE | Abrir tela correta | PARCIAL | 50 | launch CRM | paths | `MOOPE_PATHS_PERMITIDOS` | Deep link Gestão | P2 |
| Integração MOOPE | Receber eventos | EXISTE | 90 | sim | cards | `POST .../events` | — | — |
| Integração MOOPE | Disparar automação CRM | PARCIAL | 40 | sync | não regra | inbound ≠ engine | Emitir evento | P2 |
| Integração MOOPE | MCP consultar Gestão | EXISTE | 90 | 6 tools read | agente | `lib/mcp/tools/locadora.ts` | Cockpit humano | P2 |
| Integração MOOPE | MCP executar na Gestão | NÃO EXISTE | 0 | write=0 | — | doutrina | Contrato outro repo | P3 |
| Mobile | Inbox / conversa | B | 75–80 | — | 390px | `colunasDoCelular()` | URL conversa | P1 |
| Mobile | Cockpit | C | 60 | — | Sheet | `xl:block` | Two-pane | P1 |
| Mobile | Contatos | B | 78 | — | cards | `min-h-11` | — | — |
| Mobile | Funil | C | 55 | — | scroll H | colunas `w-80` | Modo 1 coluna | P1 |
| Mobile | Automações | C | 58 | — | sheet denso | `RuleEditor` | — | P3 |
| Mobile | Notificações | E | 5 | stub | stub | — | — | P1 |
| Mobile | Multiatendimento / transfer / notas | B | 72–85 | — | ⋯ menu | header | — | P0 |
| Mobile | Campanhas | E | 0 | — | — | — | — | P2 |
| Mobile | Dashboards | C | 52 | — | cards | tabelas estouram | — | P1 |
| Mobile | Shell | A | 90 | — | drawer | `MobileSidebar.tsx` | Bottom nav | — |
| Admin | RBAC / roles | B | 75–80 | sim | settings | `require-role.ts` | ACL fina | P3 |
| Admin | Equipes | C | 50 | roster | `/app/team` | sem subgrupo | Schema | P3 |
| Admin | Permissions granulares | C | 45 | role + token scope | não | — | — | P3 |
| Admin | Tenant isolation | A | 90 | RLS | — | `rls-isolation.test.ts` | — | — |
| Admin | Audit | B | 75 | append-only | manager | `/app/audit` | — | — |
| Admin | MFA | B | 70 | TOTP | segurança | `politica-mfa.ts` | — | — |
| Admin | SSO | E | 0 | não | não | — | Esperar | P3 |
| Admin | Logs tenant | C | 40 | Sentry | não | — | — | P3 |
| Admin | API keys | B | 75 | hash | settings | plaintext 1× | — | — |
| Admin | Webhooks | B | 70 | in+out | `/app/webhooks` | — | — | — |
| Admin | Rate limits | C | 45 | auth+alguns | — | crons/MCP sem | — | P3 |
| Admin | Usage / spend caps | B | 65–70 | IA | usage/budget | — | — | — |
| Admin | Security / retention | B | 60–65 | cron | settings | `lib/retencao/politica.ts` | — | — |
| Admin | Export / import | B/C | 65/50 | LGPD + CSV | — | sem export CRM | — | P3 |
| Admin | LGPD | A | 85 | sim | sim | requests + workers | — | — |
| Admin | Backup/restore | C | 45 | kit VPS | fora do app | `backup.sh` | In-app | P3 |

## Totais por área (média dos itens da auditoria)

| Área | Itens | Média % | Nível |
|---|---:|---:|---|
| Multiatendimento | 31 | 71 | 3 |
| Colaboração | 14 | 46 | 4 |
| Produtividade | 26 | 57 | 3 |
| CRM/Funil | 33 | 66 | 3 |
| Contatos 360 | 22 | 53 | 3 |
| Automações | (motores+matriz) | 72 | 3 |
| Campanhas | 25 | 8 | 5 |
| WhatsApp | 35 | 78 essencial / 70 c/ extras | 2–3 |
| IA | 35 | 81 (86 arq / 74 UX) | 2 |
| Gestão | 31 | 42 | 4 |
| Notificações | 16 | 43 | 4 |
| Integração MOOPE | 26 | 38 | 4 |
| Mobile | 12 | 58 | 3 |
| Admin | 20 | 58 | 3 |

## Como usar esta checklist

1. **P0** = Bloco 1 (expor/fechar multiatendimento). Quase tudo é UI sobre motor existente.
2. **P1** = Bloco 2 (supervisão, 360, aviso in-app).
3. **P2** = Bloco 3 (campanha mínima + MOOPE no atendimento).
4. **P3 / —** = não precisa agora, ou já está Mercado Forte.
5. Recusar item sem path na coluna Evidência. Se o path sumiu, o status mudou — remedir, não herdar o %.
