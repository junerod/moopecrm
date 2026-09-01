# Prompt — levar AGORA para o moope-finance

Cole o bloco abaixo **inteiro** numa sessão nova no repositório
`/Users/junerod/meus-moopes/moope-finance`.

Não edite o CRM nesta sessão. Não misture retrato de fatura, agente,
manutenção nem vistoria — isso é a **próxima** sessão, com outro prompt.

---

```text
# Integração locadora → MOOPE CRM (leva 1, só acréscimo)

Trabalho só neste repositório (moope-finance). Produção da locadora
está no ar. Esta leva NÃO pode alterar comportamento que o operador
já usa.

## O que é esta leva (e o que não é)

O CRM já está em produção (WhatsApp, inbox, funis Locatários e Cobrança,
POST /api/v1/integrations/moope/events). Ele ESPERA eventos. Ele NÃO
precisa que vocês mudem fatura, Asaas, Twilio, OS, vistoria ou portal.

Esta sessão faz só três coisas, em arquivos NOVOS + pontos de gancho
mínimos:

1. Configuração: URL do CRM + chave mop_… (a chave o admin gera NO CRM,
   tela Canais → Integração MOOPE; vocês só COLOAM).
2. Menu/botão "Abrir CRM" → POST launch no CRM → redirect (90s). Sem iframe.
3. Depois de gravar locatário / mudar contrato / mudar faixa de
   inadimplência: POST evento no CRM. Se o CRM estiver fora, logar e
   seguir — a tela da locadora não pode falhar.

NÃO é: agente que responde fatura. NÃO é: GET retrato. NÃO é: lookup
por telefone. NÃO é: segundo WhatsApp. NÃO é: copiar tela.

## Lei de não estragar produção

- NÃO edite handlers que já existem: backendLocacao, backendFinanceiro,
  backendLocatarioFaturasPublic, backendOrdemServico, backendChecklist,
  twilio*, Asaas, wizard financeiro, portal do locatário, Traccar.
- NÃO mude contrato de rota, SQL de tabela, JWT, CORS, env obrigatória
  sem default.
- NÃO mexa em Twilio (faturas, portal, odômetro). Disparo ≠ inbox.
  Ligar WAHA/CRM no mesmo número que o Twilio usa QUEBRA a sessão.
- NÃO crie canal WhatsApp aqui.
- Código NOVO: pasta tipo backend/lib/crmMoope*.js + backend/modules/backendCrmMoope.js
  (nome à escolha, desde que seja módulo novo).
- Gancho: DEPOIS do insert/update JÁ ter commitado com sucesso, chame
  o emissor em fire-and-forget (try/catch; timeout curto; nunca throw
  para o request do operador). Se o CRM 4xx/5xx, a locadora já salvou.
- Se não houver URL/chave configurada, o emissor no-op. Instalação
  sem CRM continua idêntica.
- Migration, se precisar: SÓ tabela nova de config (url, key cifrada,
  webhook path). Sem ALTER em locatarios, contratos, lancamentos,
  asaas_*, checklist_*, manutencao_*.
- Não rode script destrutivo, não dê truncate, não reprocessar Asaas.

## Configuração (tela nova ou bloco em Configurações)

Campos:
- URL pública do CRM (ex.: https://crm.facejus.com.br)
- Chave de entrada (mop_…) — o operador cola; vocês guardam cifrado
- URL do webhook DESTE sistema que o CRM vai chamar (opcional nesta leva;
  se não tiver, deixe vazio — o CRM simplesmente não avisa “há fio”)

Sem esses três, o resto da locadora não muda.

## Menu e botão (UI só)

Drawer (`systemNavGroups.js`), ao lado de Locação — NÃO em /logistica/crm.
Rótulo: Abrir CRM. Só aparece se a URL+chave estiverem gravadas.

No detalhe do locatário: botão Abrir no CRM (mesmo critério).

Clique (backend NOVO):

POST {CRM}/api/v1/integrations/moope/launch
Authorization: Bearer {CHAVE}
Content-Type: application/json
{ "email": "<e-mail do usuário logado AQUI>", "path": "/app/contacts/{id}" }

path = /app/inbox se ainda não souber o contato.

200 → redirecione o BROWSER para data.url (vale 90s). Sem iframe.
403 → "Use o mesmo e-mail nos dois sistemas e peça para o admin do CRM
te convidar." Não crie usuário no CRM.

Se o CRM não responder: toast e fique na locadora. Não quebre a página.

## Eventos que VOCÊ emite (só depois do save local ok)

POST {CRM}/api/v1/integrations/moope/events
Authorization: Bearer {CHAVE}
Content-Type: application/json

external_id ESTÁVEL (id numérico do locatário/contrato que já existe).
Reenvio é seguro — o CRM deduplica. Não invente UUID novo a cada save.

### Locatário criado ou editado (depois do INSERT/UPDATE de locatarios)

{
  "type": "person.upserted",
  "external_id": "<locatarios.id>",
  "payload": {
    "name": "<nome_razao_social>",
    "phone": "<telefone_principal em E.164 se der, senão o que já está>",
    "email": "<email>"
  }
}

Mande o telefone que JÁ está no cadastro. Não peça telefone novo.
Não altere o form de locatário.

### Contrato mudou de status (depois do save que JÁ existe)

{
  "type": "contract.changed",
  "external_id": "<contratos_locacao.id>",
  "payload": {
    "person_external_id": "<locatario_id>",
    "title": "<placa ou nome do veículo, o que vocês já mostram>",
    "stage": "<um dos nomes abaixo>",
    "value_cents": <valor_periodo em centavos, se já tiver>
  }
}

stage (nome da coluna no CRM, copiar igual):
Novo contato | Já respondi | Entendendo a necessidade | Proposta / visita |
Negociando contrato | Contrato ativo | Não fechou

Mapeie o enum de vocês SEM mudar o enum:
ATIVO → Contrato ativo
CANCELADO / ENCERRADO → Não fechou (ou o que fizer sentido; não crie status novo no banco)
PENDENTE → Negociando contrato
Não adivinhe os outros — se não souber, mande Contrato ativo só quando ATIVO.

### Faixa de inadimplência mudou

NÃO recrie inadimplencia-resumo. Leia o resumo que JÁ existe.
Só emita se a faixa mudou (em_dia / atraso / …).

{
  "type": "debt.changed",
  "external_id": "<id estável: locatario_id + mês ou o id do resumo>",
  "payload": {
    "person_external_id": "<locatario_id>",
    "faixa": "atraso",
    "amount_cents": 89000,
    "days_late": 12
  }
}

faixa: em_dia | atraso | negociando | promessa | recuperou | perdeu

Não dispare Twilio. Não marque pago. Não toque Asaas.

## Eventos que VOCÊ recebe (pode ficar para o fim desta leva)

Se der tempo, módulo NOVO:

POST /api/crm/events
Header X-Moope-Signature: sha256=<hex>
Verificar HMAC do body com o segredo de saída (o CRM mostra na mesma tela
da chave). timingSafeEqual. Sem assinatura válida → 401. Não processar
duas vezes (entity_id + type).

| type | o que fazer |
|------|-------------|
| conversation.opened | flag/coluna NOVA ou metadado no locatário: “há fio no CRM”. SEM UPDATE em telefone/contrato. |
| lead.stage_changed | ignore nesta leva (no-op 200). Vocês continuam donos do contrato. |
| contact.updated | ignore nesta leva (no-op 200). Mexer em telefone agora arrisca cadastro. |

Se esta rota NÃO existir ainda, deixe o webhook vazio no CRM. O CRM
só tenta de novo; a locadora não quebra.

## O que é proibido nesta sessão

- Iframe, chave na query string.
- Editar rotas /api/locatarios, /api/lancamentos, /api/contratos (exceto
  chamar o emissor DEPOIS do sucesso, sem mudar a resposta).
- Qualquer POST Asaas, wizard, marcar-pago, enviar-link-faturas-whatsapp.
- GET retrato, busca por telefone, API M2M nova além do que o CRM já
  chama (launch + events).
- Agente, skill, OS, vistoria, preventiva.
- /logistica/crm — outro produto; não misturar.

## Aceite (só isto)

1. Locadora SEM chave configurada: zero diferença (menu some, saves
   iguais, Twilio/Asaas iguais).
2. Com chave: Abrir CRM (mesmo e-mail, membro no CRM) abre o CRM logado.
   CRM fora do ar: toast, locadora intacta.
3. Criar/editar locatário (fluxo que JÁ existe) → contato aparece no CRM.
   Se o POST ao CRM falhar, o locatário AINDA gravou aqui.
4. Contrato ATIVO (fluxo que JÁ existe) → card no funil Locatários.
5. Mudança de faixa no resumo que JÁ existe → card no funil Cobrança.
6. Nenhuma rota antiga mudou status code, payload ou SQL.

## Depois (OUTRA sessão, outro prompt — não faça agora)

Retrato só-leitura (faturas, OS, vistoria) + lookup por telefone +
auth de serviço. Isso que o agente usa para “manda o boleto”. Sem a
leva 1 estável, essa API não tem id para casar.
```
