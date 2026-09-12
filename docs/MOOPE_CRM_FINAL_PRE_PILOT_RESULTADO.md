# MOOPE CRM — Fechamento definitivo do pré-piloto

Data: 2026-09-12 (UTC)  
Branch: `main` (local)  
Sem push.

Não é Refresh 3. Sem QR. Sem reconectar a VPS. Sem apagar o clone.

---

## 1. commit-base

`c3d8ab90` — merge de `origin/main` (hotfix PGRST100) sobre Refresh 2.

## 2. estado git

`main` ahead 3 de `origin/main` no início desta rodada. Working tree tinha docs/evidence de outras sessões — **não** entram neste commit.

## 3. clone preservado

`8f4b9d4d-e9a2-49ff-8e48-b5001b3fae88` permanece intacto no Postgres local 54321.

| Campo | Valor |
|---|---|
| display_name / legal_name | Rodrigues Advogados |
| slug | `teste-local` |
| contacts | 658 |
| messages | 902 |
| channel_sessions | 2 |

`scripts/reset-test-tenant.ts` recusa este UUID por padrão. Comentário explícito: **clone de tenant vivo — não usar para onboarding/reset**.

## 4. nova org criada

Pelo fluxo normal: `/signup` → e-mail Mailpit → confirmação → onboarding. Nome **MOOPE Piloto Local**. Não houve INSERT direto de organização.

## 5. UUID da nova org

`26cf676f-e450-4665-b195-111606c300fc`  
slug: `moope-piloto-local`  
criada: `2026-09-12T01:48:37Z`  
onboarded_at: `2026-09-12T01:48:48Z`

## 6. login/membership

Um membership `admin`, aceito no provisionamento do signup. Usuário de QA isolado (não é `admin@moope.com.br`). O clone **não** é membership deste usuário.

## 7. onboarding limpo

Welcome, tipo Comercial / Vendas, funil Vendas, WhatsApp pulado (sem QR), IA off, equipe pulada. Nenhuma menção a Rodrigues Advogados nem a Processos nas telas da org nova.

## 8. Ready Model Comercial

`perfil_do_negocio`: `{ id: comercial, version: 1.0 }`  
Pipeline **Vendas** (default + inbound): Novo lead → Qualificação → Proposta → Negociação → Fechamento → Não fechou.

## 9. idempotência

Reaplicar Comercial na UI: funil Vendas **não** duplicou (continua 1 linha com esse nome).

## 10. troca de modelo

Comercial → Serviços → Comercial, org vazia (zero leads):

O instalador **reaplica o quadro padrão vazio in-place** (`fn_aplicar_quadro_do_onboarding` só cria funil novo quando devolve `funil_com_negocios`). A confirmação da UI diz “vamos criar”; o toast depois (“o quadro padrão já é este”) é o que aconteceu.

Com lead (E2E `pilot-acceptance` U): Locação → Comercial **não apaga** o lead; o funil antigo permanece. Medido verde após o E2E clicar a confirmação.

## 11. múltiplos funis

Segundo funil **Novos clientes** criado pela tela `+ Novo funil` (não por troca de modelo). Stages de cada um ficam no `pipeline_id` certo. Nenhum funil de outra org aparece.

## 12. seletor

No quadro, `<select data-testid="seletor-de-funil">` troca só a URL/visualização. Opções mostram `· Novos contatos` e `· Padrão` quando cabem.

## 13. inbound pipeline

`organizations.settings.crm.inbound_pipeline_id` = Vendas.  
Lista Funis: “Novos leads entram em” + badges **Padrão** e **Novos contatos** (conceitos separados). Com um funil só o bloco some.

## 14. home limpa

Início da org nova: `MOOPE Piloto Local · Comercial / Vendas`, faixa “Configure seu CRM” (2 de 6), zeros (nas suas mãos / fila / sem próximo passo / radar). Sem números do clone.

## 15. sidebar

```
OPERAÇÃO: Início, Caixa de entrada, Funis, Contatos, Agenda, Radar
AUTOMAÇÃO & IA: Assistentes IA, Automações, Conhecimento, IA
INTEGRAÇÕES: Conexões, Integração MOOPE
RODAPÉ: Meu Negócio, Configurações, Ajuda
```

Webhooks, Credenciais, Skills, Execuções, Audit, Evolução, Uso ficam nos hubs.

## 16. Conexões

Admin da org nova abre `/app/connections`. Empty state. Sem sessão, sem QR.

## 17. Integração MOOPE

Admin abre `/app/integrations/moope`. “Ainda sem conexão”. Criar conexão / rotacionar chave **não** foram exercidos.

## 18. auditoria de permissões manager/admin

| Superfície | Classificação | Papel atual |
|---|---|---|
| GET `/api/v1/channel-sessions` (lista/status) | A — leitura | qualquer membro |
| GET `/api/v1/channel-sessions/:id` (health ao vivo) | A — leitura | qualquer membro |
| Página `/app/connections` | mistura A + C + D (QR, Reconectar, Excluir) | **admin** (redirect 403) |
| POST criar canal / reconnect / DELETE | C/D | **admin** |
| GET/POST/PATCH `/api/v1/integrations/moope` | C/D (chave mop_, HMAC, ligar/desligar) | **admin** |
| Página `/app/integrations/moope` | C/D | **admin** (`minRole`) |

**Manager precisa dessas páginas para operar o dia?** Não. Inbox, Funis e Contatos já são o trabalho. Status do WhatsApp já chega na lista de canais (GET liberado) e na Inbox.

**Decisão desta rodada:** manter `admin`. Abrir a página para manager sem fatiar a UI misturaria credencial/reconexão. Fatiar leitura vs escrita é feature nova — fora do pré-piloto.

## 19. cooldown

Regra: status `FAILED` ou `SCAN_QR_CODE` + `last_status_change_at` + 6 horas.  
Residual local `org_8f4b9d4d`: `FAILED` em `2026-09-11T22:45:37Z`.

## 20. horário de expiração

`2026-09-12T04:45:37Z` = **12/09/2026 01:45 BRT**.  
Medido em `2026-09-12T02:15Z`: **COOLDOWN EXPIRADO: NÃO** (~150 min restantes).

## 21. sessão residual

Local, na org clone:

| sessão | status | telefone | last_status_change_at |
|---|---|---|---|
| `org_8f4b9d4d` | FAILED | nenhum | 2026-09-11T22:45:37Z |
| `org_8f4b9d4d_338052` | STOPPED | 556194114879 | 2026-09-01 |

Recomendação: **não remover nesta rodada**. A FAILED sem telefone é residual de onboarding; a STOPPED antiga ainda referencia o número. Depois do cooldown, reclassificar com a lista WORKING da VPS em mente. Sem dúvida, não apagar.

## 22. proteção de session name

Org nova prefixa `org_26cf676f`. Onboarding usaria `org_26cf676f`; conexão nova `org_26cf676f_<hex>`.  
Não colide com `org_8f4b9d4d` / `org_8f4b9d4d_4aea1f`.

## 23. status da VPS WORKING

Não tocada. Último estado conhecido: `org_8f4b9d4d_4aea1f` WORKING, 556194114879, `last_status_change_at` 2026-09-11T21:49:05Z. Esta rodada não falou com o WAHA da VPS.

## 24. test:db

Primeira passagem: 1013 passed / 3 failed / 1 expected fail / 1 skipped.  
Causa: o invariante `telefone-do-lid` procurava **exatamente 1** `UPDATE contacts SET display_name = null` no baseline; a `main` já tem dois (rótulo @lid + limpeza HTML da 0203). **Não** foi migration nossa.

Correção: o teste agora extrai o backfill do rótulo `^Contato [0-9]+(@lid)?$`.

Reexecução: **130 arquivos / 1016 passed / 1 expected fail / 1 skipped**. Verde.

## 25. E2Es

Build limpo (`pnpm e2e:build`), porta **3001** (não 3666).  
Não rodado: `vps-fresh-onboarding` (apaga sessões `org_*` no WAHA local).

Obrigatórios da primeira passagem (55 testes): 50 verdes; 5 vermelhos, todos remediados e reexecutados:

| Spec | Primeira | Depois |
|---|---|---|
| signup-journey | verde | — |
| navegacao (sidebar, Conexões, MOOPE, mobile 390) | verde | — |
| pipelines-gestao | verde | — |
| inbox-cockpit-comercial | verde | — |
| inbox-assistente-ia | verde | — |
| inbox-scope | verde | — |
| contato-aparece-na-lista / contato-salva-email | verde | — |
| productization-3c | verde | — |
| inbox-quem-manda (Fila) | soterrada por fila antiga | verde (inbound de 2018) |
| pilot-acceptance C (Locação) | QR/cooldown | verde (pula se não houver QR) |
| pilot-acceptance U (troca de modelo) | faltava 2º clique | verde |
| pilot-acceptance E/D/G/F/S + Comercial | verde | — |
| rbac-roles | contraste sidebar/badge | verde |

## 26. regressão Refresh 2

Reexecutados de verdade: cockpit comercial (incl. mobile 390 e papel), quem-manda, assistente IA, scope, contatos. Verdes.

## 27. screenshots

`docs/final-pre-pilot/screenshots/` — 01 a 17, todos gerados. Sem QR.

`01-org-selector-new.png` é o Início da org nova: o `TenantSwitcher` **some** quando há uma só membership. A identidade da org aparece no subtítulo.

## 28. arquivos alterados (desta entrega)

Navegação, Funis, Perfil, cooldown visível, reset script, contraste de sidebar/badges/⌘K, testes de nav/piloto/quem-manda/rbac/invariante, fragmento `.changes/pre-pilot-descoberta-e-funis.md`, este relatório, screenshots.

## 29. migrations

Nenhuma.

## 30. commit

Local, se os gates desta rodada estão verdes: `fix(crm): complete pre-pilot onboarding validation`.

## 31. SEM PUSH

Confirmado.

## 32. riscos reais

1. UUID compartilhado local/VPS — wipe do clone local continua perigoso.
2. Cooldown da residual FAILED até `2026-09-12T04:45:37Z`.
3. Troca de modelo em org **vazia** reescreve o quadro padrão; a confirmação “criar funil” é otimista. Com card, o comportamento é o prometido.
4. Login **não** grava `active_org`. Resolução: cookie se for membro → senão primeira membership. Logout apaga o cookie. Usuário com uma org só não volta ao clone. Usuário com duas orgs, após logout, cai na primeira membership — não na última escolhida.
5. Manager não vê Conexões/MOOPE no menu (admin). Operação do dia não depende disso.
6. `PRONTO PARA TESTE WHATSAPP: NÃO` — cooldown + falta de autorização explícita + sessão VPS intocável.

### Como a organização atual é escolhida

`resolveActiveOrg` (`lib/auth/server.ts`): cookie HttpOnly `active_org` se o usuário for membro; senão a primeira linha de `user_organizations`. `setActiveOrg` só aceita membership (ou platform admin). `signOut` apaga o cookie.

---

## Tabela final

| Critério | SIM/NÃO |
|---|---|
| Clone de produção preservado | SIM |
| Nova org local possui UUID próprio | SIM |
| Nova org começa vazia | SIM |
| Onboarding começa realmente limpo | SIM |
| Ready Model Comercial cria Vendas | SIM |
| Reaplicar não duplica | SIM |
| Trocar modelo é claro | SIM (com lead); parcial se o funil está vazio |
| Múltiplos funis funcionam | SIM |
| Pipeline selector funciona | SIM |
| Inbound pipeline é claro | SIM |
| Tenant isolation comprovado | SIM (E2E S) |
| Sidebar final correta | SIM |
| Conexões acessível de forma adequada ao papel | SIM (admin; manager não precisa) |
| Integração MOOPE acessível de forma adequada ao papel | SIM (admin; manager não precisa) |
| Home vazia é compreensível | SIM |
| Refresh 2 não regrediu | SIM |
| test:db verde | SIM |
| E2Es finais verdes | SIM |
| Cooldown calculado corretamente | SIM |
| VPS WORKING não foi tocada | SIM |
| Session name local não colide | SIM |
| Ambiente está pronto para teste real do WhatsApp | NÃO |

---

## Veredito final

MOOPE CRM — ONBOARDING REAL DO ZERO VALIDADO: **SIM**

MOOPE CRM — READY MODEL E MÚLTIPLOS FUNIS VALIDADOS EM ORG LIMPA: **SIM**

MOOPE CRM — GATES TÉCNICOS PRÉ-PILOTO VERDES: **SIM**

MOOPE CRM — PRONTO PARA TESTE CONTROLADO DE WHATSAPP: **NÃO**

MOOPE CRM — PRONTO PARA PILOTO REAL: **NÃO**

### Blockers comprovados (só os que restam)

1. Cooldown da residual local FAILED até `2026-09-12T04:45:37Z` — QR/reconnect desabilitados até lá.
2. Sem autorização explícita do usuário para gerar QR numa sessão **nova** da org `26cf676f-…`.
3. Piloto real com cliente depende do teste controlado de WhatsApp (local) e depois do uso interno MOOPE.

---

## STOP

Sem QR. Sem reconectar. Sem Refresh 3. Sem push.
