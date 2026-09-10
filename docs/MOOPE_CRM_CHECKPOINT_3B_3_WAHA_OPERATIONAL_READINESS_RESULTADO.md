# MOOPE CRM — CHECKPOINT 3B.3
# PRONTIDÃO OPERACIONAL WAHA — RESULTADO

**Medição:** 2026-09-10 ~00:35 UTC  
**Sem 3C. Sem RAG. Sem agentes. Sem QR. Sem reconnect da WORKING. Sem push.**

---

## 1. Estado inicial

Ambiente isolado (o mesmo do smoke S1-CERT-WA):

| Item | Valor |
|---|---|
| CRM cert (`next start`) | `http://localhost:3666` — build antigo, **não** reconstruído |
| Validação da correção | `next dev` em `http://localhost:3667` contra `55321` |
| DB | isolado `55322` (`deskcomm-vps-fresh`) |
| Org | Loja QA VPS / `62d52837-e77d-40f0-b06d-29d76a08c5cf` |
| Channel vivo | `17b381d2` / `org_62d52837_055ec6` |
| Residual | `988c4125` / `org_62d52837` |

Antes da correção a faixa do topo lia a residual FAILED/SCAN_QR sem telefone e escrevia que o WhatsApp da organização estava desconectado, com CTA “Escanear o QR”, mesmo com a sessão viva WORKING.

---

## 2. Confirmação funcional E2E

Já comprovada tecnicamente no isolado (sem repetir o smoke):

| Perna | Message | Prova |
|---|---|---|
| Inbound 1 | `f1a23450` | `Teste MOOPE MOOPE-WA-3B3-215952` |
| Outbound humano | `a9593549` | `Resposta Inbox MOOPE-INBOX-S1-193014` · `sent_via=user` · POST 201 |
| Inbound 2 | `ead997af` | webhook `3dcba575` `message.any` `fromMe=false` |

Mesmo contact `1212b06b`, mesma conversation `65dc093e`. Takeover `user` + `infinity`. IA/automação 0. Duplicação 1:1.

---

## 3. Evidência visual do telefone

O recorte de 2026-09-09 ~22:43 UTC registrava **TELEFONE EXTERNO RECEBEU: NÃO MEDIDO**. Esse texto permanece nos relatórios anteriores.

Nova evidência do operador (visual no aparelho, **não** inferência de `sent`/`read`):

- telefone mostrou o inbound 1 `Teste MOOPE MOOPE-WA-3B3-215952`
- telefone **recebeu** `Resposta Inbox MOOPE-INBOX-S1-193014`
- telefone enviou o inbound 2 `Depois humano MOOPE-INBOX-S1-193014`

**TELEFONE EXTERNO RECEBEU: SIM**

**S1-CERT-WA NÍVEL 4: SIM**

**WHATSAPP REAL FUNCIONA END-TO-END: SIM**

---

## 4. Sessões existentes (depois da correção; sem tocar nelas)

Medido em 2026-09-10 ~00:30 UTC, **sem** POST start, **sem** QR:

| Origem | Nome | Status | Telefone |
|---|---|---|---|
| DB | `org_62d52837_055ec6` | **WORKING** | `…9343` |
| DB | `org_62d52837` | **FAILED** | (vazio) |
| WAHA | `org_62d52837_055ec6` | **WORKING** | presente |
| WAHA | `org_62d52837` | **FAILED** | — |

A residual **não** foi apagada. A WORKING **não** foi reconectada.

---

## 5. Causa do banner incorreto

`listarConexoesCaidas` consultava só status em `STATUS_QUE_AVISAM` (FAILED / SCAN_QR_CODE / STOPPED). A WORKING irmã sumia do resultado. A faixa recebia só a residual sem nome e escrevia:

> WhatsApp **sem nome** está desconectado — nenhuma mensagem entra nem sai.

CTA: **Escanear o QR** quando o status da residual era `SCAN_QR_CODE`.

No cliente, `deriveOverallHealth` fazia “vermelho vence”: um FAILED no array pintava a org inteira como `down`, sem perguntar se havia WORKING e sem distinguir residual de número real.

A residual nasce do onboarding (`org_<8 chars>` em `app/api/v1/onboarding/whatsapp/session/route.ts`). Canal novo em Conexões usa `org_<8>_<6 hex>`. Depois de um pareamento que vingou no segundo nome, a linha do onboarding fica FAILED/SCAN_QR sem telefone — lixo de pareamento, não um segundo número.

---

## 6. Regra anterior de seleção/status

1. Banner: toda sessão não arquivada em FAILED / SCAN_QR_CODE / STOPPED entra na faixa.  
2. Saúde da sidebar: FAILED/STOPPED ⇒ `down`; senão STARTING/SCAN_QR ⇒ `connecting`; senão `connected`.  
3. Ordem do array / `created_at` não eram critério explícito — mas a residual “ganhava” por estar na lista de caídas.  
4. Envio: continua pelo `channel_session_id` da conversa (não tocado).  
5. Onboarding já redireciona quem tem `onboarded_at` (`app/onboarding/layout.tsx`).

---

## 7. Regra nova

Determinística, em `lib/channels/sessoes-residuais.ts`:

**Residual supersedida** = status que avisa (FAILED / SCAN_QR_CODE / STOPPED) **e** `phone_number` vazio **e** existe **outra** sessão WORKING na mesma lista.

- Residual **não** entra na faixa.  
- Residual **não** decide `deriveOverallHealth`.  
- Residual **não** oferece Reconectar / QR na tela de Conexões.  
- Número **com telefone** caído ao lado de uma WORKING **continua** caído (multi-número).  
- FAILED ou SCAN_QR **sozinhos** (sem WORKING) **continuam** desconectado / QR (falha real).  
- Ordem do array não decide.

Preferência conceitual observada, sem enumerar cegamente estados do WAHA:

WORKING com telefone (canal em uso)  
> STARTING da sessão em uso (boot; não avisa)  
> SCAN_QR / FAILED **sem** irmã WORKING (pareamento real)  
> residual sem telefone (ignorada no status principal)

Envio, takeover, webhook e adapter **não** mudaram.

---

## 8. Tratamento de residual FAILED

WORKING + FAILED sem telefone ⇒ status principal **conectado**. Faixa ausente. Card avançado (admin) pode continuar visível com o aviso “Sessão antiga sem número… não escaneie QR aqui”. Sem delete automático.

---

## 9. Tratamento de residual SCAN_QR_CODE

WORKING + SCAN_QR sem telefone ⇒ mesma regra. Não força onboarding QR. Depois de `WHATSAPP_RESTART_ALL_SESSIONS` a residual pode voltar a SCAN_QR; a UI agora trata isso como residual, não como queda da org.

---

## 10. Proteção contra QR indevido

- Faixa: “Escanear o QR” só se a lista **já filtrada** contém SCAN_QR — ou seja, não há WORKING irmã, ou o SCAN_QR é de um número com telefone.  
- Conexões: botão Reconectar (que abre o diálogo de QR) some na residual.  
- Onboarding `/onboarding/connect-whatsapp` já redireciona org onboardada.  
- Residual **não** foi apagada nesta etapa.

---

## 11. Multi-number

A regra **não** é “uma org, uma sessão”. Dois WORKING com telefone ⇒ conectado. WORKING + FAILED **com** telefone ⇒ a faixa anuncia o caído (“por esta conexão”), saúde `down`. Canal oficial sem `waha_session_name` não é residual.

---

## 12. Cooldown / copy

`lib/channels/pareamento-cooldown.ts` **não** mudou: a espera de 6h vale no canal que realmente caiu. Não se aplica à residual escondida da faixa.

Copy da faixa: deixou de afirmar que **nenhuma** mensagem entra na org. Agora: “por esta conexão” / “por elas”.

`fraseEsperaPareamento` intacta.

---

## 13. WHATSAPP_RESTART_ALL_SESSIONS

Auditado em `docker-compose.yml` e `docker-compose.prod.yml`. Default **True** (o do WAHA é False).

| Pergunta | Resposta |
|---|---|
| Residual FAILED → SCAN_QR após restart do Docker é esperado? | **Sim.** O WAHA tenta retomar **todas** as sessões do volume. A residual sem credencial válida cai em SCAN_QR_CODE. |
| Desejável em desenvolvimento? | **Sim** para a sessão viva: sem isso ela volta STOPPED e o número some até um clique em Reconectar. |
| Desejável em produção? | **Sim**, pelo mesmo motivo — já documentado no compose. |
| Deve permanecer True? | **Sim.** Não mudamos. |
| False seria melhor? | **Não** sem outra estratégia de resume: a WORKING também ficaria STOPPED. |
| Configuração melhor? | Nenhuma evidência de knob “só retomar WORKING”. A correção certa é a UI não tratar a residual como a conexão da org. |

Gate existente: `tests/unit/waha-engine-config.test.ts` (os dois composes).

---

## 14. Imagem / edição WAHA

Auditado; **não** inventamos versão.

| Superfície | O que o repo realmente faz |
|---|---|
| `docker-compose.prod.yml` | `${WAHA_IMAGE:-devlikeapro/waha:latest-2026.7.2}` — **Core** pinado |
| `hostgator-setup-kit/install.sh` | mesmo default |
| `docker-compose.yml` (dev) | `${WAHA_IMAGE:-devlikeapro/waha:noweb}` — tag móvel **só local** |
| Ambiente medido | `deskcomm-waha` = `devlikeapro/waha:noweb` · engine NOWEB · tier CORE · 2026.8.1 |
| CLAUDE.md / PRD | afirmam Plus obrigatório (multi-tenant / retry / S3) |
| Comentário do compose de produção | Core grátis por padrão; Plus **opt-in** via `WAHA_IMAGE` |

O smoke nível 4 passou em **CORE**. Dependência real de Plus (multi-número no mesmo host, retry, S3) continua sendo a do compose, não uma invenção desta sessão. **Não** trocamos a doutrina do CLAUDE.md aqui.

---

## 15. Pinning

| | |
|---|---|
| A. Edição necessária para o E2E certificado | Core + NOWEB basta |
| B. Plus é obrigatório para este recorte? | **Não medido como necessário.** Opt-in. |
| C. Estratégia | Produção já pina via `WAHA_IMAGE` com default versionado `latest-2026.7.2`. Local aceita override; default permanece `:noweb` para não recriar o contêiner vivo. |
| D. Atualizar no futuro | Trocar o default do compose + `install.sh` no mesmo PR; bump é release. Nunca `:latest` nem `:noweb` em produção. |

Gate novo: `tests/unit/packaging-artefato-do-cliente.test.ts` — default de produção não pode ser `:noweb` nem `:latest`, e precisa interpolar `WAHA_IMAGE`.

**Não fabricamos versão nova.** O número do default já estava no repo.

---

## 16. Arquivos alterados

| Arquivo | Papel |
|---|---|
| `lib/channels/sessoes-residuais.ts` | regra residual |
| `lib/channels/sessoes-residuais.test.ts` | cenários A–E |
| `lib/channels/health.ts` | faixa usa a regra |
| `hooks/channels/useChannelSessions.ts` | saúde agregada |
| `components/app/ConexaoCaidaBanner.tsx` | copy “por esta conexão” |
| `components/connections/ConnectionsClient.tsx` | sem Reconectar na residual |
| `tests/unit/conexao-caida-banner.test.tsx` | copy/CTA |
| `tests/unit/conexoes-excluir-canal.test.tsx` | residual + bolinha |
| `tests/unit/channel-health-aviso.test.ts` | faixa chama o filtro |
| `tests/unit/packaging-artefato-do-cliente.test.ts` | pin de produção |
| `docker-compose.yml` | default local explícito via `WAHA_IMAGE`; comentário |
| `.changes/whatsapp-residual-nao-derruba-status.md` | fragmento |
| relatórios `docs/MOOPE_CRM_*` | adendos + este arquivo |

**Não** alterados: `POST /api/v1/messages`, `_handler`, takeover, `decidirEnvioConversacional`, adapter, webhook, Action Policy.

---

## 17. Migrations

Nenhuma. Residual não foi apagada no banco.

---

## 18. Testes

| Gate | Resultado |
|---|---|
| `lib/channels/sessoes-residuais.test.ts` (A–E) | **verde** |
| `tests/unit/conexao-caida-banner.test.tsx` | **verde** |
| `tests/unit/conexoes-excluir-canal.test.tsx` | **verde** |
| `tests/unit/channel-health-aviso.test.ts` | **verde** |
| `tests/unit/packaging-artefato-do-cliente.test.ts` | **verde** |
| `tests/unit/waha-engine-config.test.ts` | **verde** |
| `lib/channels/pareamento-cooldown.test.ts` | **verde** (não alterado) |
| E2E Playwright permanente novo | **não criado** — o cenário é o banco de certificação, não o seed E2E |
| E2E assistido inbox (3667) | **passou** — ver §22 |
| `vps-fresh-onboarding` | **não rodado** — não mexemos no wizard |

---

## 19. Typecheck

`pnpm typecheck` — **verde**.

---

## 20. Lint

`eslint` nos arquivos alterados — **verde**.

---

## 21. E2E

Spec permanente de conexão/Inbox **não** foi acrescentada. Validação de tela: Playwright assistido no isolado (§22). Onboarding WhatsApp existente não foi reexecutado (código do wizard intacto).

---

## 22. Validação no ambiente atual

Sem enviar mensagem. Sem QR. Sem reconnect.

| Checagem | Resultado |
|---|---|
| `org_62d52837_055ec6` WORKING depois | **SIM** |
| Residual `org_62d52837` intocada (FAILED) | **SIM** |
| Inbox 3667 (`e2e-agent`) sem faixa “nenhuma mensagem entra nem sai” | **SIM** |
| Inbox sem CTA “Escanear o QR” | **SIM** |
| Inbox acessível, conversas do número `…9343` visíveis | **SIM** |
| Conexões como agent | 403 (role `admin`); residual lá coberta por teste de componente |
| Build `next start` 3666 | **ainda antigo** — a correção não está nessa imagem até rebuild |

Evidência visual: `.superpowers/evidence/waha-readiness/inbox.png`.

---

## 23. Riscos residuais

- A linha `org_62d52837` continua no WAHA e no banco. Restart do Docker ainda a põe em SCAN_QR; a UI agora ignora isso no status principal.  
- `next start` :3666 não foi reconstruído nesta sessão.  
- Dev local ainda defaulta `:noweb` (tag móvel). Produção já pina.  
- CLAUDE.md continua dizendo Plus obrigatório; o artefato de produção entrega Core. Tensão antiga, não reaberta.  
- Instalação legada com `WAHA_IMAGE=devlikeapro/waha` (sem tag) ainda segue `:latest` no `update.sh` — débito já documentado em `docs/runbooks/remediar-worker-congelado.md`. Não mexemos no `.env` de ninguém.

Nenhum desses é blocker crítico do recorte residual/QR.

---

## 24. git diff resumido

- Nova regra pura de residual + testes A–E.  
- Faixa e bolinha passam a filtrar residual.  
- Copy da faixa deixa de afirmar queda total da org.  
- Reconectar some na residual quando há WORKING.  
- Compose local: imagem via `WAHA_IMAGE` com default `:noweb`.  
- Gate de pin de produção.  
- Fragmento `.changes/` + relatórios.

Sem migration. Sem handler de mensagem.

---

## 25. Commit

Um commit local: `fix(crm): harden whatsapp session readiness`

---

## 26. Push

**Não houve push.**

---

## Tabela final

| Critério | SIM/NÃO |
|---|---|
| S1-CERT-WA nível 4 funcional | **SIM** |
| WhatsApp real E2E | **SIM** |
| Telefone externo recebeu outbound | **SIM** |
| Inbound 2 real | **SIM** |
| Takeover preservado | **SIM** |
| IA/automação não respondeu | **SIM** |
| Sem duplicação | **SIM** |
| Sessão viva WORKING | **SIM** |
| Residual não domina status principal | **SIM** |
| FAILED residual não gera falso desconectado | **SIM** |
| SCAN_QR residual não força QR | **SIM** |
| QR protegido quando conexão válida existe | **SIM** |
| Multi-number preservado | **SIM** |
| Cooldown/copy coerente | **SIM** |
| Restart-all auditado | **SIM** |
| Estratégia WAHA produção definida | **SIM** |
| WAHA produção usa pin explícito ou blocker documentado | **SIM** (pin já no compose: `latest-2026.7.2`) |
| Typecheck verde | **SIM** |
| Testes direcionados verdes | **SIM** |
| Prontidão operacional WAHA para piloto | **SIM** |
| 3B.3 pode ser encerrado | **SIM** |

---

## Vereditos

**S1-CERT-WA NÍVEL 4: SIM**

**WHATSAPP REAL FUNCIONA END-TO-END: SIM**

**PRONTIDÃO OPERACIONAL WAHA PARA PILOTO: SIM**

**MOOPE CRM 3B.3 PODE SER ENCERRADO: SIM**

---

## STOP

Sem 3C. Sem 3D. Sem RAG. Sem agentes. Sem automações. Sem push.
