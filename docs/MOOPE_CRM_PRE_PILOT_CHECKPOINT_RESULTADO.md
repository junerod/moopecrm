# MOOPE CRM — Checkpoint pré-piloto — resultado

Data: 2026-09-11  
Branch: `main` (local)  
Sem push desta rodada (o hotfix da Inbox Comercial `57a96d86` já estava em `origin/main`).

Não é Refresh 3. Inbox, Contatos, header e cockpit do Refresh 2 não foram refeitos.

---

## 1. Commit-base

`c3d8ab90` — merge de `origin/main` (hotfix PGRST100) sobre Refresh 2.

Working tree desta rodada altera navegação, Funis, Perfil do negócio, cooldown visível e o script de reset.

## 2. Git status inicial

`main` ahead 3 de `origin/main`. Working tree sujo com docs/evidence de outras sessões (não desta rodada).

## 3. Estado local inicial

| Item | Valor |
|---|---|
| Branch | `main` |
| HEAD | `c3d8ab90` |
| Porta | `3666` (`npm run dev`) |
| Supabase | `http://127.0.0.1:54321` (`deskcomm-crm`) |
| DB | `127.0.0.1:54322` |
| WAHA | `http://localhost:3030` (`deskcomm-waha`) |
| Segundo Postgres | `55321` (`deskcomm-vps-fresh`) — **não** é o `.env.local` |

## 4. Estado VPS inicial

| Item | Valor |
|---|---|
| SHA | `57a96d86` (hotfix Comercial) |
| App | `https://crm.facejus.com.br` |
| Orgs | MOOPE Tecnologia (`8f4b9d4d-…`, slug `teste-local`), JK Auto, Moope Frotas |
| Canal MOOPE | `WORKING` `org_8f4b9d4d_4aea1f` · 556194114879 · `last_status_change_at` 2026-09-11T21:49:05Z |

Nada foi apagado na VPS.

## 5. Tenant Rodrigues Advogados

Existe **só no Postgres local 54321**:

- `id` = `8f4b9d4d-e9a2-49ff-8e48-b5001b3fae88`
- `legal_name` / `display_name` = Rodrigues Advogados
- `slug` = `teste-local`
- `onboarded_at` = 2026-09-11T22:44:51Z (hoje, welcome desta sessão)
- `perfil_do_negocio` = `comercial` 1.0
- Funis: **Vendas** (default + inbound), **Novos clientes**, **Processos**
- 658 contacts · 65 conversas · 902 messages · 10 leads

O **mesmo UUID** na VPS chama-se **MOOPE Tecnologia**.

## 6. Causa do tenant persistente

**F — combinação.**

- **A. banco:** a org já existia no dump/clone local com o UUID da VPS.
- **C. membership:** o login `admin@moope.com.br` entra nesta org (cookie de org ativa).
- Welcome de hoje gravou `display_name: "Rodrigues Advogados"` em `onboarding_state` e no nome legal.
- Não é cache de browser sozinho. Não é seed E2E (`e2e-test-org` é outra linha).

Por isso “onboarding limpo” nunca começou limpo: o usuário caiu numa org já povoada.

## 7. Reset dry-run

`scripts/reset-test-tenant.ts --org 8f4b9d4d-…` **recusa** sem `--allow-cloned-prod-uuid`.

Com a flag, dry-run (sem `--execute`):

```
messages 902 · conversations 65 · contacts 658 · crm_leads 10
crm_pipelines 3 · channel_sessions 2 (PRESERVAR)
```

## 8. Reset executado local

**Não.** Apagar 658 contatos / 902 mensagens desta org local seria destruir o clone do tenant de produção. O script existe; a execução exige `--execute` + `--allow-cloned-prod-uuid` e só fala com `127.0.0.1`.

Onboarding realmente limpo = **criar org nova** (signup), não wipe deste UUID.

## 9. Reset VPS

**Não executado.** VPS é produção/homologação viva (`WORKING`). Só plano: nunca rodar o script contra host que não seja localhost.

## 10. WhatsApp cooldown

Mensagem canônica em `lib/channels/pareamento-cooldown.ts` → `fraseEsperaPareamento()`.

Regra: status `FAILED` ou `SCAN_QR_CODE` + `last_status_change_at` + **6 horas**.

`STOPPED` e `WORKING` **não** entram.

## 11. Origem da mensagem

Não é WAHA. É guarda do CRM no `POST /api/v1/channel-sessions/:id/reconnect` (409 `channel_pairing_wait`) e no parceiro MOOPE. Nesta rodada a frase também aparece no card de Conexões e o CTA de QR/Reconectar fica desabilitado durante a espera.

## 12. Causa da queda

**NÃO COMPROVADA** como queda do número vivo da VPS.

Evidência do que existe:

- VPS `org_8f4b9d4d_4aea1f` está **WORKING**.
- Local tem residual **FAILED** `org_8f4b9d4d` (sem telefone) com `last_status_change_at` 2026-09-11T22:45:37Z — logo depois do onboarding que marcou WhatsApp como `skipped`.
- Isto casa com a sessão residual documentada em `docs/MOOPE_CRM_S1_WAHA_SESSION_DROP_DIAGNOSTICO.md`: linha morta de onboarding ao lado de uma sessão viva.

Não inventar logout remoto, healthcheck matando container, nem disputa de volume.

## 13. Persistência da sessão

WAHA local: volume do container `deskcomm-waha`.  
VPS: WAHA próprio em `localhost:3030` **daquela máquina**.  
`WHATSAPP_RESTART_ALL_SESSIONS` existe no compose; o watchdog só retoma `STOPPED`, nunca `FAILED`.

## 14. Local × VPS

| | Local | VPS |
|---|---|---|
| WAHA | `localhost:3030` (Mac) | `localhost:3030` (VPS) |
| Session viva | residual FAILED `org_8f4b9d4d` | WORKING `org_8f4b9d4d_4aea1f` |
| Org UUID | o mesmo | o mesmo |

**Não compartilham o processo WAHA.** Disputa só existiria se `.env.local` apontasse o WAHA da VPS. Hoje não aponta.

## 15. Ready Model atual

Instalador: `aplicarReadyModel` (`lib/ready-models/aplicar.ts`).

Advocacia cria **Novos clientes**, não Processos. Processos veio do script legado / dados já existentes.

Comercial cria **Vendas**.

## 16. Comportamento ao trocar modelo

**INTENCIONAL**, agora com confirmação na UI.

Trocar Advocacia → Comercial:

- não apaga funil com card (`funil_com_negocios` → quadro novo)
- não move lead
- não sobrescreve `inbound_pipeline_id` se já existe (`semearInboundSeAusente`)

O que parecia “não fez nada”: o perfil gravava `comercial`, o funil **Processos** continuava na lista, e o inbound antigo permanecia. Sem confirmação, a pessoa não via o funil novo nascer.

## 17. Criação do novo funil

UI em `/app/settings/perfil`: se o funil do modelo ainda não existe, o segundo clique é **Criar funil Vendas**. Se já existe: “Funil Vendas já existe.”

## 18. Preservação de funis antigos

Mantida. Texto explícito na confirmação.

## 19. Múltiplos funis

Suportados. Org Rodrigues local já tem 3. Não é erro.

## 20. Seletor de funil

No quadro (`/app/pipelines/:id`), se houver mais de um funil: `<select>` **Funil** troca só a URL / visualização. Não move card.

## 21. inbound_pipeline

`organizations.settings.crm.inbound_pipeline_id`.  
Lista Funis: “Novos leads entram em” + badges **Novos contatos** / **Padrão** (com title).  
Um funil só: o bloco some.

## 22. Sidebar final

```
OPERAÇÃO: Início, Caixa de entrada, Funis, Contatos, Agenda, Radar
AUTOMAÇÃO & IA: Assistentes IA, Automações, Conhecimento (+ hub IA)
INTEGRAÇÕES: Conexões, Integração MOOPE   ← minRole admin
RODAPÉ: Meu Negócio, Configurações, Ajuda
```

Webhooks, Credenciais, Skills, Execuções, Audit, Evolução, Uso ficam nos hubs.

## 23–27. Automações / Assistentes / Conhecimento / Conexões / MOOPE

Um clique no sidebar (Conexões e MOOPE: admin). Rotas e permissões iguais às de antes.

## 28. Home

AFTER em `docs/pre-pilot-checkpoint/screenshots/02-home-clean.png`.  
Hoje em blocos clicáveis, setup compacto, atalhos Inbox/Funis/Contatos. **Sem mudança de layout** — já estava no critério do Refresh 2.

## 29. Onboarding limpo

**Não.** A org ativa continua Rodrigues / clone da VPS. Criar empresa nova é o caminho seguro.

## 30. Testes unitários

81 testes verdes no lote desta rodada (registry, sidebar, idioma, seletor, troca de modelo, funis novos leads, cooldown, conexões).

`pnpm typecheck` verde. ESLint dos arquivos alterados: 0 errors.

## 31. test:db

**NÃO MEDIDO** nesta rodada. Sem migration / sem mudança de RLS.

## 32. E2Es

Atualizado `tests/e2e/navegacao.spec.ts`. **Não rodado** o Playwright completo aqui (dev na 3666; suíte pede `.env.e2e` / outra porta).

## 33. Regressão Refresh 2

Código de lista/header/cockpit/contatos **não** foi editado. Sem reexecução E2E nesta rodada.

## 34. Screenshots

Em `docs/pre-pilot-checkpoint/screenshots/`:

- 02-home-clean.png
- 03-sidebar-final.png
- 06-multiple-pipelines.png
- 10-automacoes-sidebar.png
- 11-assistentes-sidebar.png
- 12-conhecimento-sidebar.png
- 16-mobile-menu.png

Faltam (bloqueados ou não gerados de propósito): onboarding limpo, QR, cooldown com sessão real (não gerar QR), Conexões/MOOPE no user manager (403 de papel).

## 35. Arquivos

- `lib/navigation/registry.ts`
- `lib/i18n/dicionario.ts`
- `app/app/pipelines/[id]/{page,_client}.tsx`
- `app/app/kanban/_client.tsx`
- `app/app/settings/perfil/{page,_client}.tsx`
- `components/connections/ConnectionsClient.tsx`
- `lib/channels/pareamento-cooldown.test.ts`
- `scripts/reset-test-tenant.ts`
- testes de nav / seletor / ready model
- `.changes/pre-pilot-descoberta-e-funis.md`

## 36. Migrations

Nenhuma.

## 37. Commit

**Não feito.** Falta onboarding limpo comprovado + E2E/test:db desta suíte.

## 38. Sem push

Confirmado. Esta rodada não empurra.

## 39. Riscos reais restantes

1. UUID `8f4b9d4d-…` compartilhado local/VPS — wipe local é irreversível para o clone e perigoso se alguém apontar o script para o host errado.
2. Residual FAILED local ainda em cooldown até ~2026-09-12T04:45:00Z.
3. Conexões/MOOPE continuam `admin` — manager não os vê (a página redireciona 403).
4. E2E de navegação e `test:db` desta rodada ainda precisam rodar antes de declarar piloto.

---

## Tabela final

| Critério | SIM/NÃO |
|---|---|
| Causa do tenant antigo identificada | SIM |
| Tenant local limpo com segurança | NÃO |
| VPS analisado sem delete indevido | SIM |
| Onboarding começa limpo | NÃO |
| Causa da queda WhatsApp comprovada | NÃO |
| Cooldown explicado | SIM |
| Sessão WAHA persistente validada | SIM |
| Local e VPS não disputam sessão | SIM |
| Ready Model explicado | SIM |
| Troca de modelo é intuitiva | SIM |
| Funil antigo é preservado | SIM |
| Novo funil pode ser criado claramente | SIM |
| Múltiplos funis funcionam | SIM |
| Seletor de funil funciona | SIM |
| Inbound pipeline é claro | SIM |
| Funis acessível em 1 clique | SIM |
| Automações acessível em 1 clique | SIM |
| Assistentes acessível em 1 clique | SIM |
| Conhecimento acessível em 1 clique | SIM |
| Conexões acessível em 1 clique | SIM (admin) |
| Integração MOOPE acessível em 1 clique | SIM (admin) |
| Home pós-Refresh 2 validada | SIM |
| Refresh 2 não regrediu | NÃO MEDIDO (código não tocado) |
| test:db verde | NÃO MEDIDO |
| E2Es afetados verdes | NÃO MEDIDO |

---

## Veredito

MOOPE CRM — AMBIENTE LIMPO PARA ONBOARDING: **NÃO**

MOOPE CRM — READY MODEL E MÚLTIPLOS FUNIS ESTÃO INTUITIVOS: **SIM**

MOOPE CRM — NAVEGAÇÃO EXPÕE OS RECURSOS IMPORTANTES: **SIM**

MOOPE CRM — WHATSAPP ESTÁ SEGURO PARA NOVA TENTATIVA: **NÃO**

MOOPE CRM — PRONTO PARA PILOTO REAL PRÉ-PRODUÇÃO: **NÃO**

### Blockers comprovados

1. Onboarding limpo não existe enquanto o login cair no UUID da VPS (`Rodrigues Advogados` / `MOOPE Tecnologia`). Criar **org nova**; não apagar `8f4b9d4d-…` no local.
2. Residual FAILED local ainda em cooldown de 6h — não escanear QR nessa linha.
3. VPS está WORKING: não reconectar, não gerar QR.
4. E2E/`test:db` desta rodada ainda não rodaram.

---

## STOP

Sem Refresh 3. Sem QR. Sem reconectar. Sem push.
