# Provas — Pack Advocacia v1

| CAPACIDADE | IMPLEMENTADA? | PROVA REAL? | TESTE | EVIDÊNCIA | RISCO |
|---|---|---|---|---|---|
| Ativação 1 clique | SIM | UI | `pack-advocacia-existing-tenant.spec.ts` | Meu Negócio | baixo |
| Tenant existente | SIM | UI | mesmo spec | sem onboarding | baixo |
| Idempotência | SIM | UNIT | `business-pack-advocacia.test.ts` | fundir artifacts | baixo |
| 6 assistentes + funil | SIM | UNIT+E2E | definition + spec | 8 etapas | baixo |
| Knowledge vazio | SIM | UNIT | coleções | sem legislação genérica | baixo |
| Respostas / campanhas / automações | SIM | UNIT | seeds | automações off | baixo |
| Não inventa andamento/prazo/honorário | SIM | UNIT | test-drive | escala humano | baixo |
| AI_MODE / takeover | SIM | UNIT | copilot default | sem autonomous | baixo |
| Mobile / light / dark | PARCIAL | E2E | viewport 390 | DS existente | visual |
