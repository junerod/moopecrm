# Prompt — colar no Cursor do moope-finance

Cole o bloco abaixo **inteiro** numa sessão nova no repositório da locadora
(`moope-finance` / frota). Não edite o CRM nesta sessão.

O CRM já aceita `template` no `/send`. Esta leva é só a fronteira da locadora:
ela já tem os SIDs e já monta as variáveis. O CRM dispara; não cadastra modelo.

---

```text
# Locadora: aviso pelo CRM com o modelo que JÁ é nosso

Trabalho SÓ neste repositório (locadora). Produção está no ar.
Não mexa em Asaas, portal, OS, vistoria, Traccar.
Não crie template na Twilio nesta sessão. Os SIDs do .env já existem.

## Por que esta leva

O CRM (POST /api/v1/integrations/moope/send) agora tem DOIS jeitos de mandar:

1. Chip por QR — texto livre (`body`). Só se JÁ existe conversa com mensagem.
   Sem fio: 409 conversation_required. Primeiro toque no celular. Sem fallback
   Twilio.

2. Número por API de mensagens (o que a locadora já usa hoje na Twilio) —
   modelo aprovado. A locadora manda o SID que já está no .env e as variáveis
   na ordem {{1}}, {{2}}…. Sem conversa prévia. Sem body.

A locadora NÃO chama a Twilio quando o destino é o WhatsApp do CRM.
Quem fala com o provedor é o CRM. A locadora só gera o link e as variáveis.

## Contrato (não invente outro)

POST {CRM}/api/v1/integrations/moope/send
Authorization: Bearer mop_…
Idempotency-Key no body: idempotency_key

Texto (só QR, com fio):

{ "external_id", "phone": "+55…", "body", "idempotency_key" }

Modelo (API de mensagens / fora da janela de 24h):

{
  "external_id": "9",
  "phone": "+5561999999999",
  "template": {
    "name": "HXd98a1057377e2b1723f537b444443986",
    "language": "pt_BR",
    "values": { "1": "04/09/2026 as 15:00", "2": "Trocar oleo do Onix" }
  },
  "idempotency_key": "aviso:9:hoje"
}

`template.name` = o SID HX… do .env DESTA locadora (TWILIO_TEMPLATE_SID_*).
`template.values` = as mesmas chaves que o código já preenche hoje ("1", "2"…).
Não mande {{1}} na chave. Não mude a ordem. Sem quebra de linha dentro da variável.

body OU template. Os dois juntos: o CRM usa o template e ignora o texto livre
no caminho de modelo — não confie nisso; mande um ou outro.

## Qual SID em cada disparo (já é o .env de vocês)

| Disparo | Env | SID conhecido (conta atual) |
|---------|-----|-----------------------------|
| Central de Avisos / lembrete | TWILIO_TEMPLATE_SID | HXd98a1057377e2b1723f537b444443986 |
| Resumo da locação | TWILIO_TEMPLATE_SID_LOCACAO | HX5ac429c833623665b941fa75801f1794 |
| Convite de assinatura | TWILIO_TEMPLATE_SID_ASSINATURA_CONVITE | HXab1921a171cfcaa3c948a8f28bfa346c |
| OTP / reset senha | TWILIO_TEMPLATE_SID_AUTHENTICATION | HXbffd225933e1094d6e53560b640b8d84 |
| Checklist / vistoria | TWILIO_TEMPLATE_SID_CHECKLIST | HX27dfc85c1f7467e51430927e20cdc265 |
| Odômetro | TWILIO_CONTENT_SID_ODOMETER | HXcfcbf1bd698eb81b63330e81532a197e |
| Acesso portal | TWILIO_TEMPLATE_SID_PLATAFORMA_* | HXcbdcce4fc6dcf91bab0bee821dba3b13 |
| Parcela / Pix | TWILIO_TEMPLATE_SID_ASSINATURA_MOOPE | HXee31efc1ec279b1c5f42706edb524f37 |
| Faturas em aberto | TWILIO_TEMPLATE_SID_FATURAS_LOCATARIO | SID sumiu — não dispare até ter HX novo |
| Jornada início/fim | TWILIO_WHATSAPP_CONTENT_JORNADA_* | sem SID — não invente body no CRM |

Mapeamento de variáveis: o mesmo do código atual (twilioLembrete, resumolocacao,
etc.). Não reescreva o texto. O CRM não conhece o catálogo — só o SID e o mapa.

## O que fazer no handler que hoje chama a Twilio

1. Se o aviso/disparo vai pelo WhatsApp do CRM (chave mop_ + URL do CRM):

   - Monte `template.name` com o SID do .env daquele tipo de aviso.
   - Monte `template.values` com o que você já interpolava.
   - POST no /send. Não chame Messages.json / Content API.

2. Trate a resposta:

   - 200: marque enviado. Reenvio da mesma idempotency_key: { duplicado: true }.
   - 409 conversation_required: chip QR sem fio. Mostre error.message.
     NÃO marque enviado. NÃO reenfileire. NÃO reconecte. NÃO caia na Twilio.
   - 409 state_conflict: STOP. Já trata. Não misture com o de cima.
   - 422: telefone inválido, OU você mandou `body` num canal que só aceita
     modelo fora da janela. Falta o SID / as variáveis. Mostre error.message.
     Não marque enviado.
   - 429: espere Retry-After. Não reconecte o WhatsApp.
   - 503: canal do CRM fora. Não tente a Twilio “para não perder o aviso”
     no mesmo número do QR — isso derruba a sessão.

3. Lote: um POST por destinatário. Quem der 409/422 sai da fila e não conta
   como enviado.

4. GET {CRM}/api/v1/integrations/moope/channel antes do lote — igual à leva
   anterior (can_send_now, retry_after, pairing_wait_seconds).

## O que NÃO fazer

- Não crie template no CRM nem peça para o CRM cadastrar modelo.
- Não copie SID desta conta para outra (Zernio, outra Twilio, sandbox).
  Recria o CORPO; o SID novo vai no .env da locadora.
- Não ligue API de mensagens e QR no mesmo chip.
- Não rodeie a chave mop_.
- Não altere SQL de locatarios/contratos/lancamentos.

## Aceite

- Lembrete da Central: POST /send com template.name = TWILIO_TEMPLATE_SID
  e values "1" (data/hora) + "2" (texto). 200 → Enviado. Sem chamada Twilio.
- Locatário sem conversa no chip QR + só `body`: tela mostra o 409; não Enviado.
- Canal API + só `body` sem template: 422 visível; não Enviado.
- Fatura/parcela/resumo: mesmo SID e mesmas variáveis de hoje, pelo /send.
```
