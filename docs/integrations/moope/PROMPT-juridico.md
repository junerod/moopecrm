# Prompt — integrar o Facejus ao MOOPE CRM

Cole isto numa sessão no repositório `/Users/junerod/facejus2026`. Não edite o CRM daqui.

## O que você vai fazer

O CRM passa a ser o inbox WhatsApp de verdade. A Captação IA **nativa do Facejus não é apagada nesta leva** — fica até o escritório desligar. O CRM e o Facejus se falam pelo protocolo em `docs/integrations/moope/protocolo.md` do CRM.

**Não nasçam dois WhatsApp no mesmo número.** Se o escritório ligar o CRM no aparelho que a Captação já usa, um dos dois quebra a sessão. O prompt deixa isso explícito na tela de Integrações: "Desligue a Captação neste número antes de conectar o CRM, ou use outro número."

## Onde pôr o menu

Seção **Integrações** (não duplicar "Atendimentos"). Item: **MOOPE CRM**.

No detalhe do cliente e no detalhe do processo: **Abrir no CRM**.

Em Integrações: URL do CRM + chave (`mop_…`).

## O que o backend faz no clique

```
POST {CRM}/api/v1/integrations/moope/launch
Authorization: Bearer {CHAVE}
{ "email": "<e-mail do usuário logado no Facejus>", "path": "/app/pipeline?lead=" }
```

Se 403: "Use o mesmo e-mail nos dois sistemas e peça para o admin do CRM te convidar."

Redirecione para o `url` (90s). **Não** use iframe.

Para o cliente: `path` = `/app/contacts/{id}` se já souber; senão `/app/inbox`.

## Eventos que VOCÊ emite

De `clientes`:

```
POST {CRM}/api/v1/integrations/moope/events
Authorization: Bearer {CHAVE}
{
  "type": "person.upserted",
  "external_id": "<id do cliente>",
  "payload": { "name": "…", "phone": "+55…", "email": "…" }
}
```

De `processos`:

```
{
  "type": "process.changed",
  "external_id": "<id do processo>",
  "payload": {
    "person_external_id": "<id do cliente>",
    "title": "0001234-56.2024.8.26.0100",
    "stage": "Em andamento"
  }
}
```

`stage` deve ser um destes nomes do funil Processos: `Novo processo`, `Documentos`, `Em andamento`, `Audiência marcada`, `Aguardando decisão`, `Encerrado`, `Arquivado`.

`external_id` é estável. Reenvio é seguro.

Não emita `contract.changed` nem `debt.changed` — esses são da locadora.

## Eventos que VOCÊ recebe

Exponha o webhook que gravar no CRM. Verifique `X-Moope-Signature: sha256=<hex>` com o segredo de saída (timing-safe).

| type | o que fazer |
|------|-------------|
| `conversation.opened` | no cliente (`moope_external_id`), mostrar que há fio no CRM |
| `lead.stage_changed` | se o card de Processos mudou, você pode só registrar — o Facejus continua dono do processo |
| `contact.updated` | telefone/nome que o CRM descobriu no WhatsApp |

## O que NÃO fazer

- Iframe do CRM.
- Chave na query string.
- Segundo canal WhatsApp no mesmo aparelho.
- Apagar a Captação IA nesta leva (o escritório desliga quando quiser).
- Duplicar a tela "Atendimentos" com outro inbox.

## Aceite

1. Clique em Abrir no CRM (mesmo e-mail, membro) abre o CRM logado.
2. Cliente novo no Facejus aparece em Contatos do CRM.
3. Processo novo/alterado mexe o card no funil Processos.
