# MOOPE CRM SELF TEST

Gerado em: 2026-09-14T22:13:27.287Z
Duração: 0s
Organizações: (nenhuma ao vivo)
Disparo externo: NÃO
SELF_TEST_EXTERNAL_CHANNELS: false
Vision: SKIPPED
Gestão: CONTRACT E2E VALIDADO

Onboarding.......... PASS
Pack................ PASS
Assistentes......... PASS
Knowledge........... SKIPPED
Vision.............. SKIPPED
CRM................. PASS
Agenda.............. PASS
Campanhas........... PASS
Automações.......... PASS
Tenant isolation.... PASS
WhatsApp externo.... SKIPPED
Gestão Bridge....... PASS

TOTAL: PARTIAL

## Evidências
- (sem evidências extras)

## Detalhe por módulo
- **Onboarding** (PASS): Catálogo tem Locadora e Advocacia.
- **Pack** (PASS): Dois packs no mesmo motor, tenants separados no padrão.
- **Assistentes** (PASS): 6 especialidades; andamento processual escala para humano.
- **Knowledge** (SKIPPED): Token sintético preparado: SELFTEST-KNOWLEDGE-6A1B9440. Upload real exige tenant vivo.
- **Vision** (SKIPPED): Sem credencial multimodal nesta passagem de contrato.
- **CRM** (PASS): Funis dos packs têm 8 etapas com ganho e perda.
- **Agenda** (PASS): Packs usam a Agenda existente — sem segundo sistema de tarefas.
- **Campanhas** (PASS): Self-test padrão em MOCK. SELF_TEST_EXTERNAL_CHANNELS default false.
- **Automações** (PASS): Automações dos packs nascem desligadas no instalador.
- **Tenant isolation** (PASS): Padrão: um pack por tenant; nunca e2e-test-org.
- **WhatsApp externo** (SKIPPED): Disparo externo bloqueado no self-test padrão.
- **Gestão Bridge** (PASS): CONTRACT E2E VALIDADO no mock oficial. GESTÃO PRODUÇÃO REAL: não.
