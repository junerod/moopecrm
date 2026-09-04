# Templates Twilio WhatsApp — catálogo para replicar no Zernio

Fonte para o kit do canal parceiro. Conta Content API lida em **2026-09-04**.
Corpos abaixo são os **aprovados no Twilio**, não rascunho.

Quando formos criar os modelos no CRM / Zernio, abra **este arquivo**. Não
copie SID Twilio para o Zernio. Recrie o **mesmo corpo e as mesmas variáveis**
e grave o SID **novo** no `.env` da **locadora** (não no `.env` deste CRM).

Idioma de todos: `pt_BR`. Tipo: `twilio/text`, exceto autenticação.

Quando a locadora tem **WhatsApp da empresa (CRM)** ligado, vários destes
disparos saem em **texto livre** no chip pareado — não passam pelo template.
No Zernio (API oficial / 24h) o template é obrigatório fora da janela.

Categoria Meta sugerida no Zernio: **Utility**, salvo o item 4 (**Authentication**).

---

## Índice

| # | Nome Twilio | SID atual | Env (locadora) | Serve para |
|---|-------------|-----------|----------------|------------|
| 1 | `moopealertlembrete` | `HXd98a1057377e2b1723f537b444443986` | `TWILIO_TEMPLATE_SID` | Central de Avisos / lembrete |
| 2 | `moope_locacaoresumo` | `HX5ac429c833623665b941fa75801f1794` | `TWILIO_TEMPLATE_SID_LOCACAO` | Resumo da locação (contrato novo) |
| 3 | `copy_msg_assinatura` | `HXab1921a171cfcaa3c948a8f28bfa346c` | `TWILIO_TEMPLATE_SID_ASSINATURA_CONVITE` | Convite / link de assinatura |
| 4 | `msg_codigoassinatura` | `HXbffd225933e1094d6e53560b640b8d84` | `TWILIO_TEMPLATE_SID_AUTHENTICATION` | OTP (assinar, login, reset senha) |
| 5 | `moope_checklist_novo` | `HX27dfc85c1f7467e51430927e20cdc265` | `TWILIO_TEMPLATE_SID_CHECKLIST` / `_LINK` | Link de vistoria / checklist |
| 6 | `setodometermoope2` | `HXcfcbf1bd698eb81b63330e81532a197e` | `TWILIO_CONTENT_SID_ODOMETER` | Pedido de odômetro |
| 7 | `faturas_faturamento_moopev3` | `HXcbdcce4fc6dcf91bab0bee821dba3b13` | `TWILIO_TEMPLATE_SID_PLATAFORMA_*` | Acesso portal locatário / investidor |
| 8 | `moope_pagamento_parcela` | `HXee31efc1ec279b1c5f42706edb524f37` | `TWILIO_TEMPLATE_SID_ASSINATURA_MOOPE` | Boleto / Pix da parcela (carnê) |
| 9 | *(sumiu na conta)* | `HXc5bf30e24baa357a658fe77a571ea54a` | `TWILIO_TEMPLATE_SID_FATURAS_LOCATARIO` | Link de faturas em aberto — recriar |
| 10 | Jornada (sem SID no `.env`) | — | `TWILIO_WHATSAPP_CONTENT_JORNADA_*` | Início / fim de jornada — criar |

---

## 1. Aviso / lembrete — `moopealertlembrete`

**Para que serve:** Central de Avisos. Data/hora + texto livre do operador.

**Quem manda:** `backend/lib/twilioLembrete.js` (`{{1}}` data, `{{2}}` texto).

```
Data e Hora: {{1}}
Lembrete: {{2}}
```

| Var | Código preenche | Exemplo |
|-----|-----------------|---------|
| `{{1}}` | Data e hora do aviso | `04/09/2026 as 15:00` |
| `{{2}}` | Texto do lembrete | `Trocar oleo do Onix` |

Zernio: Utility. `{{2}}` pode ser longo (até ~1600). Sem quebra de linha **dentro** da variável (Twilio 21656).

---

## 2. Resumo da locação — `moope_locacaoresumo`

**Para que serve:** Depois de abrir o contrato, manda o resumo no WhatsApp do locatário.

**Quem manda:** `POST /api/notifications/resumolocacao` ← `frontend/pages/NovaLocacao.jsx`.

```
Olá {{1}}, tudo bem? 👋

Segue o resumo da sua locação:

📝 *Contrato:* {{2}}
🚗 *Veículo(s):* {{3}}
📅 *Período:* {{4}} a {{5}}
💳 *Valor do período:* {{6}} ({{7}})
💰 *Caução:* {{8}} - {{9}}
⚙️ *Taxa de ativação:* {{10}}

Observações: {{11}}

Agradecemos a preferência! Qualquer dúvida é só responder esta mensagem.
```

| Var | Conteúdo |
|-----|----------|
| `{{1}}` | Nome do locatário |
| `{{2}}` | Código do contrato |
| `{{3}}` | Veículo(s) / placa |
| `{{4}}` | Data início |
| `{{5}}` | Data fim |
| `{{6}}` | Valor do período |
| `{{7}}` | Periodicidade (`mensal`, `semanal`…) |
| `{{8}}` | Valor da caução |
| `{{9}}` | Forma da caução (`PIX`, `dinheiro`…) |
| `{{10}}` | Taxa de ativação |
| `{{11}}` | Observações |

Zernio: Utility. 11 variáveis — a Meta às vezes recusa corpo “comercial”. Se reprovar, use o texto seco do CRM (`crmWhatsappCopy` tipo `resumo_locacao`), sem emoji.

---

## 3. Convite de assinatura — `copy_msg_assinatura`

**Para que serve:** Pedir para a pessoa abrir o documento e assinar (ou ver o assinado).

**Quem manda:** `TWILIO_TEMPLATE_SID_ASSINATURA_CONVITE` — convite + link de verificação.

```
Olá {{1}}!
Notificação importante sobre seu documento "{{2}}".

Acesse para ver detalhes: {{3}}

MOOPE Tecnologia
```

| Var | Conteúdo |
|-----|----------|
| `{{1}}` | Nome |
| `{{2}}` | Nome / tipo do documento |
| `{{3}}` | URL segura |

---

## 4. Código OTP — `msg_codigoassinatura`

**Para que serve:** Código de verificação. Assinatura eletrônica, authcode, reset de senha (`TWILIO_TEMPLATE_SID_PASSWORD_RESET` cai neste SID se o reset estiver vazio).

**Tipo Twilio:** `whatsapp/authentication` — **não é texto livre**. No Zernio crie template **Authentication** da Meta (botão copiar código). O corpo aprovado no Twilio é só `{{1}}`.

```
{{1}}
```

| Var | Conteúdo |
|-----|----------|
| `{{1}}` | Código OTP (só dígitos) |

Não coloque nome, link nem frase extra neste template. A Meta recusa.

---

## 5. Checklist / vistoria — `moope_checklist_novo`

**Para que serve:** Mandar o link para executar vistoria/checklist no celular.

**Env:** `TWILIO_TEMPLATE_SID_CHECKLIST` e `TWILIO_TEMPLATE_SID_CHECKLIST_LINK` (mesmo SID). Hoje o SID existe na conta; o disparo no código da locadora está pouco referenciado — replique mesmo assim.

```
Você recebeu um link para executar {{1}}
{{2}}

Acesse o endereço, e finalize o checklist.

{{3}}

Responda cuidadosamente todo o checklist . Em caso de dúvida entre em contato.
```

| Var | Conteúdo | Exemplo Twilio |
|-----|----------|----------------|
| `{{1}}` | Tipo do checklist | `Vistoria` |
| `{{2}}` | URL | `https://…` |
| `{{3}}` | Nome da empresa | `Locadora ABC` |

---

## 6. Odômetro — `setodometermoope2`

**Para que serve:** Pedir km do veículo (odômetro diário).

**Quem manda:** `backend/modules/odometerTwilio.js` — `{{1}}` nome, `{{2}}` placa, `{{3}}` link, `{{4}}` empresa (opcional).

```
   Olá, {{1}}

   Precisamos atualizar o odômetro do veículo {{2}}.

   Clique no link: {{3}}

   Se já enviou recentemente, ignore.
   {{4}}

Em caso de dúvida, entre em contato com o suporte.
```

| Var | Código preenche |
|-----|-----------------|
| `{{1}}` | Nome |
| `{{2}}` | Placa (no Twilio o exemplo antigo dizia “ValorOdometro” — o **código manda placa**) |
| `{{3}}` | Link do formulário |
| `{{4}}` | Nome da empresa |

---

## 7. Acesso à plataforma — `faturas_faturamento_moopev3`

**Para que serve:** Avisar que o portal (locatário ou investidor) está liberado. Mesmo SID nos dois envs.

**Modo atual do `.env`:** `TWILIO_PLATAFORMA_TEMPLATE_MODE=gestao` e 4 variáveis (`backend/lib/twilioPlataformaAcessoService.js`).

```
Ola {{1}}
Informamos que o acesso à nossa nova plataforma de gestão de veículos já está disponível.

Através da plataforma, será possível acompanhar relatórios, informações operacionais, faturas,  e demais dados relacionados   de forma prática e transparente.

{{2}}

{{3}}
Equipe {{4}}

Em caso de dúvidas ou necessidade de suporte, nossa equipe está à disposição.
```

| Var | Código (modo `gestao` 4 vars) |
|-----|-------------------------------|
| `{{1}}` | Nome |
| `{{2}}` | URL do portal (`https://frotas.moope.com.br/moopelogin`) |
| `{{3}}` | `Usuario: {CPF} Senha: {senha}` |
| `{{4}}` | Nome da locadora |

A Meta costuma classificar CPF+senha+URL como Marketing. Se o Zernio recusar, use o modo **notify** (sem senha, sem URL):

```
Olá {{1}},

A {{2}} registrou seu cadastro como {{3}}.

Para orientação de acesso, WhatsApp {{4}}.
```

| Var | Notify |
|-----|--------|
| `{{1}}` | Nome |
| `{{2}}` | Empresa |
| `{{3}}` | Perfil (`Locatário` / `Investidor`) |
| `{{4}}` | WhatsApp da locadora |

---

## 8. Parcela / Pix — `moope_pagamento_parcela`

**Para que serve:** Carnê assinatura MOOPE — boleto Pix da parcela.

**Quem manda:** `backend/lib/assinaturaMoopeNotifyService.js`.

```
Ola {{1}}, a {{2}} enviou o boleto PIX de {{3}} com vencimento em {{4}}.
Identificador: {{5}}.

Pague aqui: {{6}}

{{7}}
Em caso de dúvidas ou necessidade de suporte, nossa equipe está à disposição.
```

| Var | Código |
|-----|--------|
| `{{1}}` | Nome do locatário |
| `{{2}}` | Nome da locadora |
| `{{3}}` | Valor |
| `{{4}}` | Vencimento |
| `{{5}}` | Identificador (`L{id}` etc.) |
| `{{6}}` | URL do boleto / Pix |
| `{{7}}` | Extra (`Se ja pagou, ignore este aviso.`) |

---

## 9. Faturas em aberto — SID sumiu (`HXc5bf30e24baa357a658fe77a571ea54a`)

**Para que serve:** Link público das faturas (Pix/boleto). Env `TWILIO_TEMPLATE_SID_FATURAS_LOCATARIO`. Fallback no código: template de locação (errado — 11 vars). **Recriar no Zernio.**

Corpo da spec (`docs/analise/locatarios/faturas-publicas-whatsapp.md` no repo da locadora):

```
Olá, {{1}}.

Identificamos faturas em aberto da sua locação na {{2}}.

Você pode consultar e pagar suas faturas pelo link seguro abaixo:

{{3}}

Dúvidas: {{4}}

Se já realizou o pagamento, desconsidere esta mensagem.
```

| Var | Código (`twilioFaturasLocatarioService.js`) |
|-----|---------------------------------------------|
| `{{1}}` | Nome |
| `{{2}}` | Empresa |
| `{{3}}` | Link das faturas |
| `{{4}}` | WhatsApp / contato da empresa |

---

## 10. Jornada do motorista — criar (SID vazio no `.env`)

Env comentado: `TWILIO_WHATSAPP_CONTENT_JORNADA_INICIO`, `_FIM`, `_GENERICO`.  
Sem SID o código manda **texto simples** (`twilioMotoristaNotify.js`) — no Zernio isso só vale dentro de 24h.

Replique como Utility, 2 variáveis (`{{1}}` nome, `{{2}}` link do app):

**Início**

```
Olá, {{1}}!
Lembrete: inicie sua jornada no app ao assumir o veículo.
{{2}}
```

**Fim**

```
Olá, {{1}}!
Lembrete: finalize sua jornada no app ao devolver o veículo.
{{2}}
```

**Genérico**

```
Olá, {{1}}!
Mensagem da gestão Moope. Em caso de dúvida, responda este WhatsApp ou fale com a empresa.
{{2}}
```

---

## Como cadastrar no Zernio

1. Um template por linha da tabela (não fundir).
2. Categoria: Utility (1–3, 5–10) e Authentication (4).
3. Variáveis na **mesma ordem** `{{1}}…{{n}}`.
4. Sem newline / tab **dentro** da variável.
5. Depois de aprovar, anote o nome/id Zernio ao lado do SID Twilio desta página.
6. Reset de senha pode reutilizar o template 4.

Criação: tela do CRM **Conexões → Provedor parceiro → Modelos do parceiro**, ou API do adapter (`zernioTemplateOps.create`). A locadora **não** vira cadastro de template.

## O que não é template Twilio

Textos do CRM da locadora (`backend/lib/crmWhatsappCopy.js`: boleto, menu, preventiva, ponto) são **corpo livre** no WhatsApp pareado. No Zernio cada um desses precisa de um template Utility novo — não estão nesta lista porque não existem na Content API da conta.
