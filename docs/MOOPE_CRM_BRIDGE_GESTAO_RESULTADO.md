# MOOPE CRM — Bridge Gestão read-only

Não foi criada uma segunda integração. O cliente GET em `lib/moope/cliente-locadora.ts`
ganhou as leituras pedidas. HMAC, timeout 4s e falha fechada permanecem.

## Contrato

Documentado em `docs/integrations/moope/protocolo.md`.
Mock oficial: `lib/moope/mock-gestao.ts`.

## Identidade

`resolverCriterioDeIdentidade`: vínculo persistido → telefone → identificador → CPF/CNPJ.
Nome sozinho falha fechado. 409 = ambíguo.

## Tools (rótulos na UI, sem “MCP”)

Dados do locatário, Dados da locação, Financeiro, Segunda via oficial,
Disponibilidade, Manutenção, Multas, Sinistros, Vistorias, Documentos, Unidades.

Write na Gestão: **não**.

## E2E

- CONTRACT E2E VALIDADO: sim (mock + `tests/unit/bridge-gestao.test.ts`)
- GESTÃO PRODUÇÃO REAL VALIDADA: não

## VEREDITO BRIDGE

MOOPE CRM — BRIDGE GESTÃO READ-ONLY IMPLEMENTADO: SIM

IDENTIDADE: SIM
CLIENTE: SIM
CONTRATOS: SIM
FINANCEIRO: SIM
BOLETO: PARCIAL
PIX: PARCIAL
DISPONIBILIDADE REAL: PARCIAL
MANUTENÇÃO: SIM
MULTAS: SIM
SINISTROS: SIM
VISTORIAS: SIM
DOCUMENTOS: SIM
UNIDADES: SIM

HMAC: SIM
TIMEOUT: SIM
FAIL CLOSED: SIM
TENANT ISOLATION: SIM

E2E CONTRATO COM MOCK GESTÃO:
SIM

GESTÃO REAL VALIDADA:
NÃO

WRITE NA GESTÃO:
NÃO
