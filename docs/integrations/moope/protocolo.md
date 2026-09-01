# Protocolo MOOPE — CRM ↔ produto parceiro

Um módulo só. O parceiro declara `kind`: `locadora` | `juridico`. O CRM é o atendimento; o outro sistema continua dono do cadastro (contrato, processo, boleto). Os dois se falam por eventos, não por um copiar a tela do outro.

## Chave

Na tela **Canais → Integração MOOPE** o administrador gera:

| Peça | Uso |
|------|-----|
| URL pública deste CRM | `NEXT_PUBLIC_APP_URL` |
| **Chave de entrada** | `Authorization: Bearer mop_…` — mostrada uma vez, hash SHA256 no banco |
| **Segredo de saída** | HMAC SHA256 do body dos eventos que o CRM manda (`X-Moope-Signature: sha256=<hex>`) |
| URL do webhook do parceiro | POST que o CRM chama |
| `kind` | `locadora` ou `juridico` |

A chave **nunca** vai em query string.

## Menu "Abrir o CRM"

O outro sistema **não** embute iframe. Clique no menu → o backend dele pede um launch e redireciona.

```
POST /api/v1/integrations/moope/launch
Authorization: Bearer mop_…
Content-Type: application/json

{ "email": "mesmo@dos.dois.lados", "path": "/app/inbox" }
```

Resposta: `{ "data": { "url": "https://crm…/api/v1/integrations/moope/entrar?t=…", "expires_in": 90 } }`

O CRM só abre sessão se aquele e-mail **já for membro** da organização. Não cria usuário. Quem usa os dois produtos precisa do mesmo e-mail nos dois lados.

Deep links permitidos: `/app/contacts/:id`, `/app/inbox?id=`, `/app/pipeline?lead=`, `/app/kanban`.

## Eventos que o parceiro MANDA

```
POST /api/v1/integrations/moope/events
Authorization: Bearer mop_…
```

```json
{
  "type": "person.upserted",
  "external_id": "loc-123",
  "payload": {
    "name": "João da Silva",
    "phone": "+5511999998888",
    "email": "joao@exemplo.com"
  }
}
```

| type | vira no CRM |
|------|-------------|
| `person.upserted` | contato (`source=moope`, `source_metadata.moope_external_id`) |
| `contract.changed` | card no funil Locatários + `crm_lead_links` |
| `process.changed` | card no funil Processos + link |
| `debt.changed` | atividade na timeline + move no funil Cobrança se `faixa` cruzar |

`external_id` é único por organização. Reenvio de `contract`/`debt` devolve `{ duplicado: true }` e não cria card de novo.

Reenvio de `person.upserted` **atualiza o contato**: casa o telefone com/sem o nono dígito, cola o `moope_external_id` no fio que já tem `wa_lid`, e **não apaga** o nome do WhatsApp. O nome da locadora fica em `source_metadata.moope_name`. Não funde cadastro.

Não abre inbox e não acorda o agente. Pessoa nova aparece em Contatos; conversa só se alguém importar ou o WhatsApp chegar.

### `contract.changed` / `process.changed`

```json
{
  "type": "contract.changed",
  "external_id": "ctr-88",
  "payload": {
    "person_external_id": "loc-123",
    "title": "Onix 2022",
    "stage": "Negociando contrato",
    "value_cents": 250000
  }
}
```

`stage` é o **nome da coluna** no funil (ex.: `Contrato ativo`, `Em andamento`). Sem match, o card nasce na primeira coluna aberta.

### `debt.changed`

```json
{
  "type": "debt.changed",
  "external_id": "div-1",
  "payload": {
    "person_external_id": "loc-123",
    "faixa": "atraso",
    "amount_cents": 89000,
    "days_late": 12
  }
}
```

`faixa`: `em_dia` | `atraso` | `negociando` | `promessa` | `recuperou` | `perdeu`.

## Eventos que o CRM MANDA

POST no webhook do parceiro. Header `X-Moope-Signature: sha256=<hex>` do body UTF-8, com o segredo de saída.

```json
{
  "type": "conversation.opened",
  "occurred_at": "2026-08-30T14:00:00.000Z",
  "organization_id": "…",
  "moope_external_id": "loc-123",
  "entity_kind": "conversation",
  "entity_id": "…",
  "payload": { "contact_id": "…" }
}
```

| type | quando |
|------|--------|
| `conversation.opened` | primeira mensagem WhatsApp ou importar conversa |
| `lead.stage_changed` | card mudou de coluna |
| `contact.updated` | telefone/nome que o CRM descobriu (quando emitido) |

Se o webhook falhar, a linha fica no `event_log` e o drain tenta de novo.

## Disparo da locadora (um locatário)

O operador clica na locadora (boleto / acesso). A locadora gera o **link**.
O CRM entrega o **texto** no WhatsApp já pareado.

```
POST /api/v1/integrations/moope/send
Authorization: Bearer mop_…
```

```json
{
  "external_id": "9",
  "phone": "+5561999999999",
  "body": "texto curto com o link já gerado",
  "idempotency_key": "fatura:9:token-ou-dia"
}
```

| status | significado |
|--------|-------------|
| 200 | `{ message_id, conversation_id }` — aparece no Inbox. Reenvio da mesma chave: `{ duplicado: true }` |
| 404 | `person.upserted` ainda não chegou. Não cria contato. |
| 409 | contato bloqueou / STOP |
| 422 | canal exige modelo e a janela de 24h está fechada |
| 429 | pacing — `Retry-After` |
| 503 | nenhum canal WORKING, ou o envio falhou |

Um POST = um destinatário. Sem array. Não acorda o agente. Sem Twilio.

## Estado do número (a locadora lê antes do lote)

A locadora pergunta **antes** de despejar 200 boletos. O CRM responde se o
chip está aquecendo, quantos cabem hoje e se a janela está aberta. O `/send`
continua sendo o freio — isto só evita a locadora descobrir no 21º 429.

```
GET /api/v1/integrations/moope/channel
Authorization: Bearer mop_…
```

```json
{
  "data": {
    "ready": true,
    "phase": "ready",
    "status": "WORKING",
    "warmup": {
      "skipped": true,
      "age_days": 1400,
      "cap_today": null,
      "sent_today": 12,
      "remaining_today": 488
    },
    "daily_limit": 500,
    "window": {
      "start_hour": 7,
      "end_hour": 22,
      "timezone": "America/Sao_Paulo",
      "allow_sunday": true,
      "open": true
    },
    "proactive_gap_seconds": 5,
    "can_send_now": true,
    "retry_after": null
  }
}
```

| `phase` | significado |
|---------|-------------|
| `no_channel` | WhatsApp ainda não pareado. Não manda. |
| `warming` | Chip novo. `warmup.remaining_today` é o teto de hoje (20 no dia 1). O resto espera. |
| `ready` | Já aquecido ou formado. Vale `daily_limit` e o intervalo de 5s. |

`can_send_now: false` + `retry_after` = espera esses segundos (noite, teto ou ritmo).
401 sem chave. Sem cookie.

### Lote (100 boletos no dia 5)

O CRM é o **freio do número**. A locadora é a **fila**. Não invertam.

1. A locadora **não** dispara 100 POSTs juntos. Um worker, um `/send`, espera
   `Retry-After` (ou 5s). Sem isso o CRM devolve 429 e o WAHA nem é chamado.
2. O CRM aplica o pacing **proativo** (piso 5s + jitter, janela 7h–22h,
   warm-up, teto do número). Resposta no Inbox continua em 1,2s.
3. Texto **não pode ser idêntico**. Três aberturas no mínimo
   (“Sua fatura de setembro…”, “O boleto deste mês…”, “Segue o link para
   pagar…”). Mesmo link, frase diferente.
4. Número novo: no máximo o degrau do dia (20 no começo). 100 boletos num
   chip pareado ontem **não cabem** — espalhe em dias ou use Twilio.
5. STOP / bloqueado = 409. Tira da fila. Não insiste.

100 clientes × ~5s ≈ 9 minutos dentro da janela. É o desenho. Rajada de
2 minutos é o que a Meta lê como spam.

Se a ficha da locadora e o fio do WhatsApp forem o **mesmo celular com/sem o nono dígito**, o envio vai no contato que já tem `wa_lid` / `wa_identity`. Não funde cadastro. Sem isso o WAHA marca `sent` no número “certo no papel” e o chip real não recebe.

## Varrer gêmeos (nono dígito)

A locadora chama depois de um lote de cadastros, ou o operador dispara uma vez.

```
POST /api/v1/integrations/moope/reconcile
Authorization: Bearer mop_…
```

Resposta: `{ total, ajustados }`. Cola o id da locadora no contato com LID. Não funde. Não manda mensagem.

## Provisionar tenant (sem colar chave)

A locadora **não** cola `mop_`. O backend dela chama isto **uma vez** (admin da conta). O CRM cria organização isolada, dono (mesmo e-mail), funis Locatários/Cobrança, conexão e devolve a chave.

Não é a chave `mop_`. É o `MOOPE_PROVISION_SECRET` da **instalação** do CRM (env). Sem ele a rota responde 503. Mínimo 16 caracteres.

```
POST /api/v1/integrations/moope/provision
Authorization: Bearer <MOOPE_PROVISION_SECRET>
```

```json
{
  "partner_tenant_id": "9",
  "display_name": "Locadora Norte",
  "owner_email": "dona@locadora.com",
  "partner_webhook_url": "https://frota.exemplo/api/crm/events/9",
  "partner_api_url": "https://frota.exemplo"
}
```

| status | significado |
|--------|-------------|
| 201 | Tenant novo. `inbound_key` e `outbound_secret` vêm no JSON — gravar já. |
| 200 | Já existia. Sem plaintext, a menos que `rotate_keys: true`. |
| 401 | Segredo de provisionamento errado |
| 503 | Env vazio nesta instalação |

O que **não** nasce sozinho: o WhatsApp. O operador ainda lê o QR em Canais → Conexões. Sem o número, Inbox e funil já servem; disparo não sai.

Reenvio com o mesmo `partner_tenant_id` não cria segunda organização.

## O que a locadora chama (resumo)

| Quando | Endpoint | Efeito |
|--------|----------|--------|
| Admin liga a integração | `POST /provision` | Tenant + chave; locadora grava, não cola |
| Cadastrou / editou locatário | `POST /events` `person.upserted` | Contato no CRM (ou cola no fio WhatsApp) |
| Antes do lote | `GET /channel` | Aquecendo? Quantos cabem hoje? Pode mandar agora? |
| Quer mandar texto | `POST /send` | WhatsApp do número pareado, Inbox |
| Ajustar fichas já importadas | `POST /reconcile` | Só identidade; sem mensagem |

## O CRM lê a locadora (leva 2)

O CRM chama a locadora. Não é o JWT do operador. Não é `mop_` na query.
A credencial é o **segredo de saída** da conexão (o mesmo HMAC da leva 1).

```
GET {URL_DA_API}/api/crm/locatario?phone=+5511…
GET {URL_DA_API}/api/crm/locatario?cpf=11ou14digitos
GET {URL_DA_API}/api/crm/locatario/:id/retrato
X-Moope-Signature: sha256=<hmac de "GET\n" + path + query>
```

`URL_DA_API` é o campo **URL da API da locadora** na Integração MOOPE; se vazio, a origem do webhook.

| status | significado |
|--------|-------------|
| 200 lookup | `{ locatario_id, nome, contrato_status }` — campos que já existem |
| 404 | não é cliente. Não criar locatário. |
| 409 | dois cadastros. Não chutar. |
| 401 | sem credencial / HMAC inválido |
| 5xx | CRM devolve “locadora indisponível” e passa para humano |

Retrato: nome, telefone, e-mail, contrato ativo (placa/título), faixa + `amount_cents` + `days_late`, `portal_url` / `boleto_url` / `invoice_url` **se já existirem**. Sem POST Asaas. Sem marcar pago. Sem Twilio.

Estas rotas ainda nascem no repo da locadora. Sem elas o CRM falha fechado e o inbox humano segue igual.

## O que não fazer

- Iframe do CRM dentro do outro sistema (cookie, CSP, marca).
- API key na query string.
- Segundo canal WhatsApp no mesmo número (já quebra sessão).
- Criar usuário no CRM pelo launch (conta órfã em self-host é buraco).
- SSO SAML/OIDC nesta leva — o launch de 90s resolve o clique no menu.

## Aceite

1. Clique no menu do parceiro abre o CRM logado (mesmo e-mail, membro).
2. Locatário/cliente novo no parceiro aparece em Contatos.
3. Atraso/processo mexe no card do funil certo.
