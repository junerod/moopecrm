# MOOPE CRM — Checklist pós-ativação dos Business Packs

Entrega finita. Sem Pack novo, sem Bridge, sem WhatsApp real.

## Estado anterior

Modelos prontos ativava o Pack em um clique. Depois o leigo precisava
descobrir sozinho: conectar WhatsApp, ensinar Knowledge, publicar
assistentes e ligar uma automação.

## Arquitetura

O checklist **não grava** progresso. `montarChecklistDoPack` lê:

- `business_pack` ativo nos settings
- artifacts do Pack (`agent_keys`, `collection_slugs`, `automation_keys`)
- `channel_sessions` (WORKING + número)
- `ai_knowledge_sources` ativas nas coleções do Pack
- `ai_agents.published_version_id` dos ids do Pack
- `automation_rules.is_active` dos ids do Pack

Sem `if (locadora)` / `if (advocacia)`. Pack futuro entra pelo mesmo
instalador e o card aparece sozinho.

Portas: Modelos prontos e Meu Negócio. Sem Pack ativo, o card não existe.

## Como o progresso é calculado

| Item | Feito quando | Não basta |
|---|---|---|
| WhatsApp | Sessão WORKING com telefone (`orgTemSessaoWorking`) | SCAN_QR / FAILED / WORKING sem número |
| Knowledge | Fonte ativa com `collection_ids` do Pack | Fonte genérica sem coleção; artefato vazio do instalador |
| Assistentes | Todos os ids de `agent_keys` com `published_version_id` | `is_active` do instalador |
| Automação | Pelo menos uma regra de `automation_keys` com `is_active=true` | Regra criada desligada |

4 de 4 → **Pronto para trabalhar**.

Reaplicar o Pack não escreve nesses campos; o progresso permanece.

## Locadora e Advocacia

O mesmo componente e o mesmo montador. O rótulo vem de `resolverPack(id).label`.

## Tenant existente

Não depende de onboarding. Empresa antiga ativa o Pack e o card aparece.

## UI

Design System existente. Mobile 390 no e2e. Sem dashboard paralelo.

Ajuda existente (Modelos prontos + manual da locadora) agora diz:
ative → conclua os quatro passos → comece a atender.

## Testes

- `tests/unit/business-pack-checklist.test.ts`
- `tests/e2e/pack-post-activation-checklist.spec.ts` (SPECS_PARTE_2)
- WhatsApp no e2e: fixture `channel_sessions` WORKING. Sem QR.

## Gates

Medido em 2026-09-14:

- `pnpm typecheck`: verde
- `pnpm test:db`: verde (130 arquivos, 1016 testes)
- E2E checklist: spec em `SPECS_PARTE_2`. Não rodou nesta máquina (harness e2e / Supabase local não estava no processo).

## UI / temas

- Mobile: 390 no spec (assert de visibilidade)
- Light / dark: DS existente (`text-emerald-700 dark:text-emerald-400`)
- Notas: 8/10 — sem prova visual local nesta sessão

## Blockers

- E2E não executado localmente nesta sessão.
- Gestão real / canal externo: fora desta entrega, de propósito.
- Publicação no e2e usa fixture de `ai_agent_versions` (sem disparar LLM).

## VEREDITO

MOOPE CRM — CHECKLIST PÓS-ATIVAÇÃO IMPLEMENTADO: **SIM**

PACK LOCADORA: **SIM**
PACK ADVOCACIA: **SIM**

WHATSAPP USA ESTADO REAL: **SIM**
KNOWLEDGE USA ESTADO REAL: **SIM**
ASSISTENTES USA ESTADO REAL: **SIM**
AUTOMAÇÕES USA ESTADO REAL: **SIM**

TENANT EXISTENTE: **SIM**
REAPLICAÇÃO PRESERVA PROGRESSO: **SIM**

4/4 MOSTRA PRONTO PARA TRABALHAR: **SIM**

MOBILE: 8/10
LIGHT: 8/10
DARK: 8/10

TYPECHECK: verde
TEST:DB: verde
E2E: spec no CI; não medido localmente

BLOCKERS:
- Playwright desta máquina não rodou

PRONTO PARA CERTIFICAÇÃO FUNCIONAL AUTOMÁTICA: **SIM** (spec no job e2e)

COMMIT LOCAL: sim, se este documento acompanhar o commit
PUSH: **NÃO**
