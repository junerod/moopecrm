# Prompt — integrar a locadora (moope-finance) ao MOOPE CRM

Cole isto numa sessão no repositório `/Users/junerod/meus-moopes/moope-finance`. Não edite o CRM daqui.

## O que você vai fazer

O CRM é o atendimento WhatsApp. A locadora continua dona de locatário, contrato e boleto. Os dois se falam pelo protocolo em `docs/integrations/moope/protocolo.md` do CRM.

## Onde pôr o menu

No drawer (`systemNavGroups.js`), ao lado de Locação — **não** em `/logistica/crm`. Rótulo: **Abrir CRM**.

No detalhe do locatário: botão **Abrir no CRM**.

Em Configurações: URL do CRM + chave de entrada (`mop_…`) + (opcional) URL que o CRM já conhece como webhook.

## O que o backend faz no clique

```
POST {CRM}/api/v1/integrations/moope/launch
Authorization: Bearer {CHAVE}
{ "email": "<e-mail do usuário logado na locadora>", "path": "/app/contacts/{id}" }
```

Se 403: o e-mail não é membro do CRM. Mostre: "Use o mesmo e-mail nos dois sistemas e peça para o admin do CRM te convidar."

Redirecione o browser para o `url` da resposta (vale 90s). **Não** use iframe.

`path` pode ser `/app/inbox` se ainda não souber o contato.

## Eventos que VOCÊ emite

Quando um locatário é criado ou editado:

```
POST {CRM}/api/v1/integrations/moope/events
Authorization: Bearer {CHAVE}
{
  "type": "person.upserted",
  "external_id": "<id do locatário>",
  "payload": { "name": "…", "phone": "+55…", "email": "…" }
}
```

Quando um contrato muda de estado:

```
{
  "type": "contract.changed",
  "external_id": "<id do contrato>",
  "payload": {
    "person_external_id": "<id do locatário>",
    "title": "Onix 2022",
    "stage": "Negociando contrato",
    "value_cents": 250000
  }
}
```

`stage` deve ser um destes nomes do funil Locatários: `Novo contato`, `Já respondi`, `Entendendo a necessidade`, `Proposta / visita`, `Negociando contrato`, `Contrato ativo`, `Não fechou`.

Quando o resumo de inadimplência muda de faixa (`inadimplencia_resumo`):

```
{
  "type": "debt.changed",
  "external_id": "<id estável da dívida ou do locatário-mês>",
  "payload": {
    "person_external_id": "<id do locatário>",
    "faixa": "atraso",
    "amount_cents": 89000,
    "days_late": 12
  }
}
```

`faixa`: `em_dia` | `atraso` | `negociando` | `promessa` | `recuperou` | `perdeu`.

`external_id` é estável. Reenvio é seguro (o CRM deduplica).

## Eventos que VOCÊ recebe

Exponha `POST /api/crm/events` (ou o path que gravar no CRM). Verifique `X-Moope-Signature: sha256=<hex>` com o **segredo de saída** (timing-safe).

| type | o que fazer |
|------|-------------|
| `conversation.opened` | no locatário (`moope_external_id`), marcar que há fio no CRM |
| `lead.stage_changed` | opcional: espelhar etapa do contrato se você quiser |
| `contact.updated` | atualizar telefone/nome se o CRM descobriu no WhatsApp |

Se responder ≠ 2xx, o CRM tenta de novo. Não processe o mesmo evento duas vezes (use `entity_id` + `type`).

## O que NÃO fazer

- Iframe do CRM.
- Chave na query string.
- Segundo WhatsApp no mesmo número (a locadora não tem inbox; não invente um).
- Copiar a tela de contratos para dentro do CRM.

## Aceite

1. Clique em Abrir CRM (logado na locadora com e-mail que é membro do CRM) abre o CRM logado.
2. Locatário novo na locadora aparece em Contatos do CRM sem ninguém ter falado no WhatsApp.
3. Atraso no resumo mexe o card no funil Cobrança.
