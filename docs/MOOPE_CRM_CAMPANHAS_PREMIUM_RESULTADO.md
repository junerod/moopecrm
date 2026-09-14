# MOOPE CRM — Campanhas Premium — Resultado

Data: 2026-09-14. Código em `app/app/campanhas`, `lib/campanhas`, `app/api/v1/campanhas`, `lib/channels/campaign-send.ts`.

## Living System Checklist — Campanhas premium

1. Quem me alimenta? → operador em `/app/campanhas/nova`; Pack via `message_templates`; segmento em `contacts`/`crm_leads`.
2. Quem eu alimento? → `campaign_recipients` + worker `campaign-dispatch`; Inbox (`conversations`/`messages`) só em envio REAL.
3. Que registro eu emito? → `audit()` `campaign.created|updated|started|cancelled|dispatch_tick`.
4. Onde eu apareço na tela? → lista, wizard `/nova`, detalhe `/:id` com fila e status em português.
5. Por qual porta se chega? → Operação → Campanhas (`lib/navigation/registry.ts`); `/nova` na allowlist justificada.
6. Qual meu anti-morte? → cron `campaign-dispatch` (5 min) + `processarTickDasCampanhas` após o start.
7. Onde se configura? → wizard (público, canal, agendamento). Falta de canal oficial/e-mail aparece como “Não conectado / Não configurado”.
8. Qual a continuidade? → resposta inbound reusa conversa existente; destinatário vira `replied`. IA só reescreve draft.
9. Qual meu laço de retorno? → falha grava `failed` + motivo; mock não finge delivered/read; diagnóstico `campaign_dispatch_real`.
10. Atualizei o mapa? → `docs/architecture/campanhas-premium.architecture.json` (10 arestas).

## 1. Arquitetura anterior

Wizard de 4 passos na lista. `POST /start` materializava até 5.000 recipients um a um. Worker chamava `enviarCampanhaMock` e marcava `sent`+`delivered`. Sem conversation/message.

## 2. UX anterior

Tag/Papel/Origem em texto. Sem modelo, canal, mídia, agendamento. Status do destinatário em inglês. Passos Revisar/Enviar duplicados.

## 3. Nova UX

Landing com cards (Rascunhos / Agendadas / Enviando / Finalizadas) + lista. Criação em `/app/campanhas/nova` com 6 passos e indicador.

## 4. Objetivo

Cards: promoção, reativação, follow-up, aviso, pesquisa, personalizada. Grava em `settings.objective`. Sem lógica por nicho.

## 5. Segmentação

Filtros: tags, papel, origem, responsável, funil, etapa, temperatura, IDs manuais. Estimativa com exclusões (bloqueados, opt-out, sem WhatsApp, sem e-mail). “Ver contatos” paginado. Base inteira exige confirmação.

## 6. Templates

GET `/api/v1/campanhas/modelos` lê `message_templates`. Pack Locadora aparece pelos 7 títulos já semeados. Sem tabela nova.

## 7–9. Mídia / vídeo / PDF

Upload em `/api/v1/campanhas/midia` → path em `whatsapp-media`. Tipos: jpeg/png/webp, mp4, pdf. Tetos 5/16/10 MB. Sem base64 no banco.

## 10–12. Canais / WhatsApp / e-mail

Seleção WhatsApp / e-mail / ambos. QR bloqueado no start se WhatsApp + sessão com `banRisk`. Oficial exige template só quando a via do diagnóstico é `real`. E-mail reusa `sendEmail` / mailserver + envelope da marca.

## 13. Preview

Abas WhatsApp (bolha) e E-mail (envelope). Texto fictício Maria, aviso explícito.

## 14. Agendamento

`scheduled_at` no wizard. Exibição em `America/Sao_Paulo`. Worker promove agendadas.

## 15. Materialização

`POST /start` valida, marca `settings.preparing`, responde. Worker insere em lote (`insert` array + fallback 23505). Unique `(campaign_id, contact_id, channel)`.

## 16–17. Worker / dispatcher

Mesmo cron. `dispatchRecipient()` → WhatsApp (`lib/channels/campaign-send.ts`) ou e-mail. Mock só se `CAMPAIGN_DISPATCH_ADAPTER=mock` ou modo `auto` sem adapter. Mock **não** cria conversation/message e **não** preenche `delivered_at`.

## 18. Conversation / message

Só no envio REAL de WhatsApp. Reusa conversa do contato; senão `ensureConversation`. `sent_via=system`, `metadata.campaign_id`.

## 19–21. Métricas / progresso / destinatários

Fila, enviadas, entregues, lidas, respondidas, falhas, ignoradas, opt-outs. Polling 3–4s. Status em português. Entregue/lido “Não disponível neste canal” quando o mock/provider não informa.

## 22–23. Cancelamento / consentimento

Cancelar impede novos envios; pendentes → `cancelled`. Guardas: bloqueado, `declined_at`, sem canal, anonimizado/mesclado na carga.

## 24. IA composer

Botões melhoram só o draft (`/ia-rascunho`). Action Policy: `campaign_dispatch` continua recusado. `enviou: false`.

## 25. Pack Locadora

Modelos prontos sugerem título+corpo. Nenhuma campanha criada automaticamente. Sem Bridge.

## 26–27. Mobile / temas

Wizard uma coluna. Preview abaixo no mobile. Tokens do DS (`--color-*`). Dark/light herdados.

## 28–30. Testes / test:db / E2E

Unitários em `lib/campanhas/*` (38). Spec `campaigns-premium.spec.ts` no `SPECS_PARTE_2`. Bloco 3 atualizado para o wizard novo. `test:db` e Playwright desta sessão: ver veredito.

## 31. Migration

`20260914120000_0209_campanhas_premium.sql` + apêndice no `baseline.sql` + linha no MANIFEST. `settings jsonb`; `channel`+`destination`; unique composto; LGPD zera `destination`.

## 32. Riscos

- Envio WhatsApp REAL depende de template oficial + credencial do canal. Sem isso a via é mock ou falha explícita.
- `sendTemplateForSession` ainda usa env de instalação (parcial).
- Unique novo: clone precisa do apêndice 0209.

## 33. Blockers

Nenhum de UX. Envio WhatsApp/e-mail **real** não validado contra provider externo nesta máquina.

## 34–35. Commit / push

Commit local se gates locais verdes. **PUSH: NÃO.**

## Veredito

MOOPE CRM — CAMPANHAS PREMIUM IMPLEMENTADA: SIM

CRIAR CAMPANHA INTUITIVO: SIM
OBJETIVOS: SIM
SEGMENTAÇÃO AVANÇADA: SIM
PREVIEW DE DESTINATÁRIOS: SIM

MODELOS DO PACK LOCADORA: SIM

TEXTO: SIM
IMAGEM: SIM
VÍDEO: SIM
PDF/DOCUMENTO: SIM

WHATSAPP: PARCIAL
EMAIL: PARCIAL
WHATSAPP + EMAIL: SIM

PREVIEW WHATSAPP: SIM
PREVIEW EMAIL: SIM

AGENDAR: SIM
ENVIAR AGORA: SIM

MATERIALIZAÇÃO ASSÍNCRONA: SIM
5.000 CONTATOS NO POST: NÃO
FILA/PROGRESSO: SIM

ENTREGUES: PARCIAL
LIDAS: PARCIAL
RESPONDIDAS: SIM
FALHAS: SIM
OPT-OUT: SIM

STATUS EM PORTUGUÊS: SIM
CANCELAMENTO SEGURO: SIM
TENANT ISOLATION: SIM

IA MELHORA DRAFT SEM ENVIAR: SIM

PACK LOCADORA INTEGRADO: SIM

MOBILE: 8/10
LIGHT: 8/10
DARK: 8/10

WHATSAPP CAMPAIGN REAL:
NÃO VALIDADO

EMAIL CAMPAIGN REAL:
NÃO VALIDADO

TYPECHECK: PASSOU (Node 22)
TEST:DB: PASSOU (130 arquivos, 1016 passed, 1 expected fail, 1 skipped; 392.67s)
E2E: SPEC ESCRITO (`campaigns-premium.spec.ts` no SPECS_PARTE_2). NÃO EXECUTADO nesta sessão — Playwright sobe `next start` próprio e recusa reusar servidor; a porta 3000 já está ocupada pelo `npm run dev`.
REGRESSÕES: unitários de campanha 38/38; cobertura e2e + navegação + mapas verdes

MIGRATION:
20260914120000_0209_campanhas_premium.sql + apêndice baseline + MANIFEST

BLOCKERS:
Envio WhatsApp/e-mail real não exercitado contra provider externo. QR continua bloqueado.

PRONTO PARA USO INTERNO: SIM
PRONTO PARA PILOTO CONTROLADO: NÃO (falta teste manual + canal oficial/e-mail reais)

COMMIT LOCAL: sim (`feat(crm): upgrade campaigns experience`)
PUSH: NÃO

PRÓXIMO PASSO:
TESTE MANUAL DE CAMPANHAS
