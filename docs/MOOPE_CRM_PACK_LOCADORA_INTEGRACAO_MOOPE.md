# Pack Locadora — integração MOOPE Gestão

Auditoria no código deste repositório. **SIM só quando há API/tool real.**
Intenção, prompt ou documento de parceiro não conta.

Cliente outbound: `lib/moope/cliente-locadora.ts`  
Tools MCP: `lib/mcp/tools/catalogo/locadora.ts` + `lib/mcp/tools/locadora.ts`  
Conexão: `moope_connections` via `POST /api/v1/integrations/moope`

O CRM **chama** a Gestão em GET com HMAC. Se a locadora ainda não expõe a rota, o cliente **falha fechado**. Não há write MCP de boleto, contrato ou frota.

| CAPACIDADE | EXISTE HOJE? | PATH / ENDPOINT / TOOL | READ/WRITE | SEGURANÇA | PODE SER USADA PELO AGENTE? | FALTA O QUÊ? |
|---|---|---|---|---|---|---|
| Cliente por telefone | SIM (parcial) | GET `/api/crm/locatario?phone` · `moope_lookup_locatario` | READ | HMAC `X-Moope-Signature`, timeout 4s, org da conexão | SIM, se conexão `active` + URL | Parceiro precisa expor a rota; match por nome **não** existe |
| Cliente por CPF/CNPJ | SIM (parcial) | GET `/api/crm/locatario?cpf` | READ | idem; dígitos normalizados | SIM, só quando o fluxo pedir identificador | Confirmação extra de identidade no runtime (documentada, não forçada em todo turno) |
| Cliente por placa | SIM (parcial) | GET `/api/crm/locatario?placa` | READ | idem | SIM | — |
| Cadastro / retrato | SIM (parcial) | GET `/api/crm/locatario/{id}/retrato` · `moope_get_retrato` | READ | idem; cache no contato | SIM | Contrato/veículo/boleto só se o retrato trouxer |
| Locação / contrato ativo | PARCIAL | campo `contrato_status` / `contrato_titulo` no retrato | READ | idem | SIM, se vier no retrato | Não há lista de contratos nem histórico dedicado |
| Histórico de locações | NÃO | — | — | — | NÃO | Endpoint + tool |
| Veículos / oferta | SIM (parcial) | GET `/api/crm/oferta` · `moope_listar_oferta` | READ | idem | SIM | É a **página de ofertas**, não calendário de frota |
| Categorias | NÃO | — | — | — | NÃO | Endpoint |
| Disponibilidade real (período/unidade) | NÃO | oferta traz `status` (ex. ALUGADO) | READ | idem | PARCIAL — não afirmar estoque sem esse GET | API de disponibilidade por período |
| Tarifa / preço | PARCIAL | `valor_diario/semanal/mensal` na oferta, se o parceiro mandar | READ | idem | SIM, só o que vier | Sem valor no payload = não inventar |
| Parcela / vencimento | PARCIAL | retrato: `amount_cents`, `days_late`, `faixa` | READ | idem | SIM, só o retrato | Sem endpoint de parcelas |
| Boleto | PARCIAL | retrato: `boleto_url` / `invoice_url` | READ | URL oficial, sem emitir | SIM, se o retrato trouxer link | Emitir boleto: **não existe** |
| PIX | NÃO | — | — | — | NÃO | Endpoint |
| Pagamento | PARCIAL | `days_late` / `faixa` no retrato | READ | idem | SIM | Baixa/registro de pagamento: não existe |
| Manutenção | PARCIAL | retrato pode trazer `preventiva` em `pode` (voz do agente locadora legado) | READ | idem | PARCIAL | Tool dedicada não existe |
| Multa | NÃO | — | — | — | NÃO | Endpoint + tool |
| Sinistro | NÃO | — | — | — | NÃO | Endpoint + tool |
| Checklist | NÃO | — | — | — | NÃO | Endpoint + tool |
| Documento | PARCIAL | retrato: `documentos[]` (nomes/flags) | READ | idem | PARCIAL | Arquivo/assinatura não são tools |
| Assinatura | NÃO | — | — | — | NÃO | Endpoint |
| Unidade / filial | NÃO | — | — | — | NÃO | Endpoint |

## Identidade (decisão)

Ordem em `lib/business-packs/identidade.ts`:

1. vínculo persistido (twin / `external_id`);
2. telefone normalizado;
3. identificador explícito informado na conversa;
4. CPF/CNPJ só quando necessário.

Nome sozinho **não** casa. Dado de outro cliente não entra. Sem tool: *“Não consegui consultar essa informação agora.”*

## E2E com Gestão

**INTEGRAÇÃO GESTÃO E2E: NÃO VALIDADA**

Não há mock oficial isolado neste repo que fale as rotas `/api/crm/*` com fixture segura. O Pack standalone **não depende** disso.
