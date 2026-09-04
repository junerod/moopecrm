# Prompt — colar no Cursor do moope-finance

Cole o bloco abaixo **inteiro** numa sessão nova no repositório da locadora
(`moope-finance` / frota). Não edite o CRM nesta sessão.

---

```text
# Locadora: aviso só para quem já tem conversa no WhatsApp do CRM

Trabalho SÓ neste repositório (locadora). Produção está no ar.
Não mexa em Twilio, Asaas, portal, OS, vistoria, Traccar.

## Por que esta leva

O CRM (POST /api/v1/integrations/moope/send) **parou de mandar para número frio**.
Mandar o primeiro recado pelo aparelho pareado derruba o WhatsApp da empresa
(castigo da Meta: 463, logout, “só reconecta em 6 horas”).

Agora o CRM só envia se JÁ EXISTE fio com mensagem naquele chip.
Cadastro do locatário, telefone na ficha, contato na agenda — nada disso conta.

Se não tem conversa, o CRM devolve:

```
409
{ "error": { "code": "conversation_required", "message": "Este número ainda não conversou no WhatsApp da empresa. Mande o primeiro recado pelo celular do chip. Depois o aviso sai daqui." } }
```

A locadora TEM de mostrar isso na tela. Não marcar Enviado. Não tentar de novo
sozinha. Não clicar “Parear de novo”.

## O que fazer (só isto)

1. No handler que chama POST {CRM}/api/v1/integrations/moope/send:

   - Se status 409 e `error.code === "conversation_required"`:
     - NÃO marque o aviso como enviado.
     - NÃO reenfileire.
     - Mostre `error.message` (ou o texto abaixo) no toast / faixa / linha do aviso.
     - Texto se o CRM vier sem message:
       "Este número ainda não conversou no WhatsApp da empresa. Abra o WhatsApp no celular do chip da empresa e mande o primeiro recado. Depois tente de novo aqui."
   - Se 409 `state_conflict`: já trata STOP — não misture com o de cima.
   - Se 429: espere Retry-After. NÃO reconecte o WhatsApp.
   - Se GET /channel vier com `pairing_wait_seconds` > 0: some o botão
     “Parear de novo”. Mostre “WhatsApp pediu espera. Não escaneie o QR agora.”

2. Na Central de Avisos / tela que dispara:

   - Aviso que tomou `conversation_required` fica visível como “precisa do primeiro recado no celular”, não como erro técnico.
   - Lote: um POST por destinatário. Quem der 409 conversation_required sai da fila do lote e NÃO conta como enviado.

3. NÃO invente fallback Twilio neste PR.
4. NÃO chame /channel/reconnect quando o send falhar.
5. NÃO altere SQL de locatarios/contratos/lancamentos.

## Aceite

- Disparar aviso para locatário que NUNCA falou com o chip: tela explica o primeiro recado no celular; status do aviso NÃO vira Enviado.
- Disparar para quem JÁ tem conversa no CRM: segue Enviado como hoje.
- Clique em “Parear de novo” some (ou não faz nada útil) enquanto o CRM disser pairing_wait_seconds.

## Contrato (não invente outro)

POST {CRM}/api/v1/integrations/moope/send
Authorization: Bearer mop_…
{ "external_id", "phone": "+55…", "body", "idempotency_key" }

GET {CRM}/api/v1/integrations/moope/channel — ler before lote:
connected, needs_qr, pairing_wait_seconds, can_send_now, retry_after.
```
