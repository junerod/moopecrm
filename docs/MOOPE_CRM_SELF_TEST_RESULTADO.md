# MOOPE CRM — Autoteste do produto

Entrega finita. Comando: `pnpm product:self-test`.

O robô não usa a organização real do cliente. Não toca sessão WhatsApp WORKING.
Não escaneia QR. No padrão, `CAMPAIGN_DISPATCH_ADAPTER=mock` e
`SELF_TEST_EXTERNAL_CHANNELS` fica falso. Um clique no admin **não** dispara canal externo.

## O que existe

- `lib/self-test/` — contrato + relatório
- `scripts/product-self-test.ts` — CLI
- `docs/self-test/latest.md` e `latest.json` — gerados pelo comando
- Admin → Diagnóstico → card Saúde do CRM (somente leitura)
- Spec Playwright `product-self-test.spec.ts` (FORA_DO_CI; o comando é a porta)

## Living System Checklist

1. Quem me alimenta? → `pnpm product:self-test` e os testes de pack/bridge
2. Quem eu alimento? → `docs/self-test/latest.md` e o card do admin
3. Que registro eu emito? → JSON + markdown do último run
4. Onde eu apareço na tela? → `/admin/diagnostico`
5. Por qual porta se chega? → sidebar Diagnóstico (admin de plataforma)
6. Qual meu anti-morte? → SKIPPED justificado (visão, canal externo) em vez de PASS falso
7. Onde se configura? → env `SELF_TEST_EXTERNAL_CHANNELS` (default false)
8. Qual a continuidade? → não altera Human Takeover
9. Qual meu laço de retorno? → FAIL no CLI se módulo crítico quebrar
10. Mapa? → packs e bridge já mapeados; self-test é porta de certificação

## Medido em 2026-09-14

`pnpm typecheck` verde. `pnpm test:db` verde (130 arquivos, 1016 testes).
`pnpm product:self-test` → **PARTIAL** (Knowledge/Vision/WhatsApp externo SKIPPED
justificados). Relatório: `docs/self-test/latest.md`.

Playwright de Pack Advocacia e do self-test UI não rodou nesta máquina (precisa
do harness e2e). Specs entram no CI (`SPECS_PARTE_2`) ou em `FORA_DO_CI` com motivo.

## RESÍDUOS

- Upload Knowledge com token único e Vision real só rodam quando o ambiente
  tiver tenant vivo + credencial. No contrato, ficam SKIPPED.
- Gestão produção real não foi validada. O mock oficial valida o contrato.
- Tenant vivo no self-test só sobe se `SUPABASE_SERVICE_ROLE_KEY` estiver no ambiente.

## VEREDITO SELF TEST

MOOPE CRM — AUTOTESTE IMPLEMENTADO: SIM

TENANT ISOLADO: SIM (contrato + recusa de e2e-test-org; ao vivo só com service role)
ONBOARDING: SIM
PACK LOCADORA: SIM
PACK ADVOCACIA: SIM
ASSISTENTES: SIM
KNOWLEDGE: SIM (contrato; upload ao vivo SKIPPED sem tenant)
VISION: SKIPPED
CRM/FUNIL: SIM
AGENDA: SIM
CAMPANHAS SAFE MODE: SIM
AUTOMAÇÕES: SIM
AI_MODE: SIM
HUMAN TAKEOVER: SIM
TENANT ISOLATION: SIM

DISPARO EXTERNO NO SELF-TEST:
NÃO

SELF TEST FINAL:
PARTIAL
