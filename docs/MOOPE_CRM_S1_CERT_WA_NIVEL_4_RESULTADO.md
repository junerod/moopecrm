# MOOPE CRM — S1-CERT-WA
# RESULTADO DO NÍVEL 4

**Medição:** 2026-09-09 ~13:22 UTC (10:22 BRT)  
**CRM:** `http://localhost:3666` → API `55321` / DB `55322`  
**Org:** Loja QA VPS / `62d52837-e77d-40f0-b06d-29d76a08c5cf`  
**Token:** `MOOPE-WA-3B3-215952`  
**Sem 3C. Sem QR. Sem reconnect. Sem push.**

---

## A. Certificação funcional E2E do WhatsApp

**S1-CERT-WA NÍVEL 4: NÃO**

**WHATSAPP REAL FUNCIONA END-TO-END: NÃO**

Camada que falhou: **Inbox → persistência do outbound** (e, em cascata, inbound 2 / takeover).

As frases `Resposta MOOPE MOOPE-WA-3B3-215952` e `Depois humano MOOPE-WA-3B3-215952` **não existem** no isolado nem no operador (`54322`).

O inbound 1 real **continua comprovado**. Isso não fecha o nível 4.

---

## B. Prontidão operacional do canal WAHA (separado do E2E)

Não misturar com o smoke:

- sessão residual `org_62d52837` **não** é mais só FAILED: após o Docker voltar hoje (`WHATSAPP_RESTART_ALL_SESSIONS`) ela foi a STARTING → **SCAN_QR_CODE** (13:19–13:21Z);
- copy de cooldown enganosa na linha residual;
- UI ainda permite caminho de “novo QR” ao lado de uma WORKING da mesma org;
- produção deve usar WAHA Plus **pinado**, não `devlikeapro/waha:noweb` CORE.

Nenhuma dessas pendências foi corrigida nesta medição.

---

## Tabela final

| Prova | SIM/NÃO |
|---|---|
| Inbound real 1 | **SIM** |
| Webhook real | **SIM** |
| Persistência | **SIM** (inbound 1) |
| Inbox | **SIM** (preview da conversa do inbound 1) |
| Outbound humano | **NÃO** |
| sent_via=user | **NÃO** (0 no isolado, em qualquer época) |
| Provider aceitou | **NÃO** (sem envio Inbox) |
| Telefone recebeu | **NÃO MEDIDO** |
| Inbound real 2 | **NÃO** |
| Mesma conversa | **NÃO** (inbound 2 ausente) |
| Takeover | **NÃO** |
| IA não respondeu | **SIM** (`sent_via=ai` = 0 após T0) |
| Sem duplicação | **PARCIAL** (inbound 1 = 1:1; outbound/inbound 2 não ocorreram) |
| Sessão final WORKING | **SIM** (`org_62d52837_055ec6`) |
| S1-CERT-WA nível 4 fechado | **NÃO** |

**TELEFONE EXTERNO RECEBEU:** NÃO MEDIDO  
(o operador não confirmou explicitamente; não se infere status de provider — e não há outbound.)

---

## Inbound 1 (já comprovado; recontado)

| Campo | Valor |
|---|---|
| Body | `Teste MOOPE MOOPE-WA-3B3-215952` |
| created_at | `2026-09-09 01:03:07.395Z` |
| message | `f1a23450` |
| webhook | `59ce5bf7` `message.any` `01:03:07.370Z` |
| direction / sent_via / status | inbound / `external_device` / delivered |
| external_id | `false_…@lid_…` (LID real; não é o `curl` QA) |
| org | `62d52837` |
| channel | `17b381d2` |
| contact | `1212b06b` (`Suporte MOOPE`) |
| conversation | `65dc093e` `open` |
| cópias | 1 |
| origem | sessão WAHA WORKING após T0; HTTP 200 no hook |

1 evento real → 1 mensagem lógica.

---

## Outbound humano

**Não persistiu.**

| Checagem | Resultado |
|---|---|
| Body `Resposta MOOPE MOOPE-WA-3B3-215952` | 0 no isolado, 0 no operador, 0 no `raw_body` de webhook |
| direction outbound + `sent_via=user` | 0 |
| actor `sent_by_user_id` | — |
| mesma conv `65dc093e` | a conversa tem **só** o inbound 1 |
| send gate / provider | não exercitado |

`sent_via=user` no isolado **inteiro:** 0.

Não há pipeline de envio para medir. Não é classificado como bug de WAHA send: a ação do Inbox **não chegou ao banco**.

---

## Inbound 2

**Não persistiu.**

| Checagem | Resultado |
|---|---|
| Body `Depois humano MOOPE-WA-3B3-215952` | 0 messages, 0 webhooks |
| evento WAHA / webhook / persistência | não ocorreu |
| mesma contact / conversation | não medido (perna ausente) |

Webhooks `message.any` depois de 01:03Z com o token: **só** o inbound 1. Os `message.any` das 13:19Z são sync de **outros** textos (histórico ao religar o Docker). Nenhum é a frase do smoke.

---

## Human takeover

Conversa `65dc093e`:

| Campo | Valor |
|---|---|
| assignee_kind | NULL |
| assigned_to_user_id | NULL |
| bot_silenced_until | NULL |
| last_handoff_at / reason | NULL |
| last_message_preview | inbound 1 |

Takeover **não ocorreu** (não houve outbound Inbox).

Após T0 nesta org: `sent_via=ai` = 0, `sent_via=automation` = 0. Isso **não** substitui takeover.

---

## 1:1

| Perna | Externa | Lógica | 1:1 |
|---|---|---|---|
| Inbound 1 | 1 `message.any` | 1 message | **SIM** |
| Outbound Inbox | 0 | 0 | não medido |
| Inbound 2 | 0 | 0 | não medido |

Contact do inbound 1: 1 contact, 1 conversation, 1 message. Sem duplicata **dessa** perna.

---

## Sessão

| Nome | Status agora | Nota |
|---|---|---|
| `org_62d52837_055ec6` | **WORKING** | cauda `9343`. Auto-recovery hoje 13:19:43 STARTING → 13:19:46 WORKING (Docker Desktop voltou). Nenhuma frase do smoke se perdeu nesse blip. |
| `org_62d52837` | **SCAN_QR_CODE** | residual. Antes FAILED (19:47Z). O restart-all do WAHA a recolocou em QR. **Não escanear.** |

O STARTING/WORKING das 13:19Z **não** é falha do smoke do inbound 1.

---

## Onde parou

```
Inbound 1  WhatsApp → WAHA → webhook → persistência → Inbox   OK
Outbound   Inbox → send handler → persistência                 PAROU (nada no banco)
Inbound 2  telefone → WAHA → webhook                           não apareceu
Takeover   assignee_kind / bot_silenced_until                  não exercitado
```

Se o operador digitou no Inbox de **outro** host/banco, esse host não gravou as frases em `55322` nem em `54322`.

---

## Veredito

**S1-CERT-WA NÍVEL 4: NÃO**

**WHATSAPP REAL FUNCIONA END-TO-END: NÃO**

**MOOPE CRM CERTIFICADO PARA PILOTO COM CLIENTE REAL: NÃO**  
(prontidão operacional também pendente; ver seção B.)

S1 restante: outbound Inbox `Resposta MOOPE MOOPE-WA-3B3-215952` (`sent_via=user`) na conversa `65dc093e`; inbound 2 `Depois humano MOOPE-WA-3B3-215952`; takeover; confirmação explícita do telefone.

S1-CERT-VPS permanece fechado.

---

## STOP

Sem 3C. Sem feature. Sem QR. Sem reconnect. Sem push.

---

## Adendo 2026-09-09 ~22:43 UTC — inbound 2 real

O outbound `a9593549` já estava comprovado. Nesta janela:

| Peça | Resultado |
|---|---|
| Inbound 2 body | `Depois humano MOOPE-INBOX-S1-193014` |
| message | `ead997af` @ `22:42:20.826Z` |
| webhook | `3dcba575` `message.any` @ `22:42:20.808Z` sessão `org_62d52837_055ec6` `fromMe=false` LID `…2673` (mesmo do inbound 1) |
| contact / conv | `1212b06b` / `65dc093e` — 1 contact, 1 conv, 3 messages no fio |
| Takeover após inbound 2 | `claimed` / `assignee_kind=user` / assignee `09e8eb25` / `bot_silenced_until=infinity` |
| IA / automação após inbound 2 | 0 (espera 12s + consulta) |
| 1:1 | cada uma das 3 frases = 1 row |
| Sessão viva | `org_62d52837_055ec6` WORKING |
| Residual | `org_62d52837` FAILED (não escanear) |
| TELEFONE EXTERNO RECEBEU | **NÃO MEDIDO** — sem confirmação explícita do operador |

**S1-CERT-WA NÍVEL 4: NÃO** (falta só a confirmação do telefone)

Detalhe do fecho: `docs/MOOPE_CRM_S1_CERT_WA_FECHAMENTO_FINAL.md`.

---

## Adendo 2026-09-10 ~00:35 UTC — telefone confirmado

O recorte de ~22:43 UTC permanece com **TELEFONE EXTERNO RECEBEU: NÃO MEDIDO**.

O operador confirmou visualmente no WhatsApp externo o recebimento de `Resposta Inbox MOOPE-INBOX-S1-193014`, com o inbound 1 e o inbound 2 no mesmo fio do aparelho.

**TELEFONE EXTERNO RECEBEU: SIM** (confirmação visual, não `sent`/`read`)

**S1-CERT-WA NÍVEL 4: SIM**

**WHATSAPP REAL FUNCIONA END-TO-END: SIM**

Sem novo smoke. Sem QR. Sem reconnect.
