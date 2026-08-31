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

`external_id` é único por organização. Reenvio devolve `{ duplicado: true }` e não cria card de novo.

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
