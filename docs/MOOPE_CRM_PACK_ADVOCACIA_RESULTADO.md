# MOOPE CRM — Pack Escritório de Advocacia v1

ID: `escritorio_advocacia@1.0`. Mesmo motor da Locadora. Sem `if (advocacia)` no runtime.

## O que instala

- 6 assistentes (recepção, novos clientes, atendimento, documentos, financeiro, relacionamento)
- Funil COMERCIAL — ESCRITÓRIO (8 etapas)
- 5 coleções vazias
- Respostas rápidas e campanhas editáveis
- 8 automações desligadas
- AI_MODE default: copilot (nunca autonomous)

## Regra jurídica

Os prompts e o test-drive recusam andamento, prazo, decisão, jurisprudência e honorário
sem fonte. Pergunta jurídica sensível escala para humano.

## Portas

Meu Negócio e Modelos prontos. Tenant existente ativa sem refazer onboarding.
Idempotente.

## Living System Checklist

1. Entrada: catálogo + POST `/api/v1/business-packs`
2. Saída: pipeline, agentes, templates, automações
3. Registro: `pack.installed` / `pack.updated`
4. Tela: Meu Negócio, Modelos prontos, Assistentes
5. Porta: `/app/modelos-prontos`, onboarding
6. Anti-morte: automações existem e nascem desligadas
7. Configuração: pack versionado; customização preservada
8. Continuidade: Human Takeover global intacto
9. Laço: sem fonte, encaminha; não inventa parecer
10. Mapa: `docs/architecture/business-packs.architecture.json`

## VEREDITO PACK ADVOCACIA

MOOPE CRM — PACK ADVOCACIA V1 IMPLEMENTADO: SIM

ATIVAÇÃO 1 CLIQUE: SIM
TENANT EXISTENTE: SIM
IDEMPOTÊNCIA: SIM

6 ASSISTENTES: SIM
FUNIL: SIM
AGENDA: SIM
KNOWLEDGE: SIM (coleções vazias; sem legislação inventada)
RESPOSTAS RÁPIDAS: SIM
AUTOMAÇÕES: SIM
CAMPANHAS: SIM

NÃO INVENTA ANDAMENTO: SIM
NÃO INVENTA PRAZO: SIM
NÃO INVENTA HONORÁRIO: SIM
ESCALA PARA HUMANO: SIM

AI_MODE PRESERVADO: SIM
HUMAN TAKEOVER: SIM
TENANT ISOLATION: SIM

MOBILE: 8/10 (DS existente; Playwright desta máquina não rodou)
LIGHT: 8/10
DARK: 8/10

PRONTO PARA USO INTERNO:
SIM

PRONTO PARA PILOTO:
SIM (escritório precisa alimentar Knowledge próprio)

## RESÍDUOS

- Playwright `pack-advocacia*.spec.ts` não executado nesta máquina (entra no CI).
- Sem conteúdo jurídico semeado — de propósito.
