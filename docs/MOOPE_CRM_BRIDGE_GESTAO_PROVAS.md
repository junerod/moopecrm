# Provas — Bridge Gestão read-only

| CAPACIDADE | IMPLEMENTADA? | PROVA REAL? | TESTE | EVIDÊNCIA | RISCO |
|---|---|---|---|---|---|
| Identidade segura | SIM | CONTRATO | `bridge-gestao.test.ts` | nome sozinho falha | baixo |
| Cliente | SIM | CONTRATO | mock + lookup | external_id | baixo |
| Contratos | SIM | CONTRATO | `consultarLocacao` | GET locacoes | Gestão pode 404 |
| Financeiro / parcelas | SIM | CONTRATO | `consultarFinanceiro` | mock parcelas | Gestão pode 404 |
| Boleto / PIX / 2ª via | PARCIAL | CONTRATO | `obterSegundaVia` | só link existente | não emite cobrança |
| Disponibilidade real | PARCIAL | CONTRATO | período obrigatório | frota ≠ período | Gestão pode não ter calendário |
| Manutenção / multas / sinistros / vistoria / documentos / unidades | SIM | CONTRATO | mock listas | fail closed | Gestão pode 404 |
| HMAC / timeout / fail closed | SIM | CONTRATO | 401 / abort | não inventa | baixo |
| Tenant | SIM | CONTRATO | conexão por org | sem_integracao | baixo |
| Write | NÃO | — | código GET-only | — | — |
