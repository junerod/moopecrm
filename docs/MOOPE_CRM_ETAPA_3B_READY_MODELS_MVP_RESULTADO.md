# MOOPE CRM — Etapa 3B: Ready Models MVP + Simple Mode + instalador genérico

**Data:** 2026-09-07  
**Tipo:** implementação. Sem push. Sem Etapa 3C. Sem RAG no Copilot. Sem vertical novo.  
**Commit-base da fundação (não reabrir):** `851fa447d10837695abd0865f23bf928a1fa4517`  
**Auditoria aprovada:** `docs/MOOPE_CRM_ETAPA_3A_READY_MODELS_AUDITORIA.md`

---

## 1. Resumo executivo

O onboarding deixou de ser três portas + agente no centro. O dono escolhe um **Ready Model** (dado versionado). Um **instalador genérico** copia pipeline, fields, tags, lost reasons, overlay do Copilot e — se pediu — no máximo uma automação e um follow-up de 24h. Depois disso o runtime é o CRM de sempre.

Não nasceu engine nova. Não nasceu RAG novo. Não nasceu CRM/deals. Não há `if (locacao)` em inbound, send, command, automação, follow-up, ChannelAdapter ou Copilot.

Locação **não** significa veículo: o subtype só muda label/opção/texto. A key `item_tipo` é estável. MOOPE Gestão **não** é instalada com o modelo.

---

## 2. Commit-base inicial

`851fa447d10837695abd0865f23bf928a1fa4517` — `feat: fundação de copiloto e automação controlada com comando humano`

Working tree desta etapa partiu desse SHA. Sem reset, sem force, sem push.

---

## 3. Arquitetura implementada

```
WIZARD /settings/perfil
        ↓ escolhe id + subtype
CATÁLOGO (TypeScript)
        ↓ ReadyModelDefinition (DADO)
aplicarReadyModel (UM instalador)
        ↓ cópia idempotente
TENANT: crm_pipelines + settings + automation_rules? + followup_*?
        ↓
CORE NORMAL (não lê Ready Model id)
```

Mapa vivo: `docs/architecture/ready-models.architecture.json` (≥2 arestas; gate estrutural já cobre `*.json`).

---

## 4. ReadyModelDefinition

`lib/ready-models/tipos.ts`:

- `id`, `version`, `label`, `description`, `subtype?`
- `pipeline` (`PropostaDeFunil` existente)
- `fields`, `canonicalTags`, `lostReasons`, `vocabulary?`
- `automation?` (0–1, nome `rm:<id>:…`)
- `followup?` (0–1, silêncio 24h)
- `aiDefaults`, `copilotOverlay`

Definition é dado. O instalador não importa `modelos/locacao` nem `modelos/advocacia`.

---

## 5. Catálogo criado

`lib/ready-models/catalogo.ts` + `lib/ready-models/modelos/*`.

| id | version | aliases antigos |
|---|---|---|
| locacao | 1.0 | locadora, imobiliaria |
| advocacia | 1.0 | advocacia |
| comercial | 1.0 | loja, saas, curso |
| servicos | 1.0 | clinica |
| personalizado | 1.0 | generico |

`resolverDefinition(idOuAlias, subtype)` é o único lugar com `if (id === …)` — resolve DADO, não runtime.

PACOTES (`lib/onboarding/pacotes-de-funil.ts`) continuam no disco para callers antigos; o wizard e `/settings/perfil` leem o catálogo novo.

---

## 6. Instalador genérico

`aplicarReadyModel(admin, organizationId, definition, options)` em `lib/ready-models/aplicar.ts`.

Ordem: no-op se mesmo id+version+subtype → senão `garantirQuadroComoPadrao` → settings do quadro → 0–1 automação → 0–1 follow-up opt-in → `perfil_do_negocio`.

**Não** publica agente. **Não** instala TOOLS_LOCADORA. **Não** ramifica por segmento.

`aplicarPerfilDoNegocio` (`lib/onboarding/aplicar-perfil.ts`) é facade: resolve definition e delega.

`garantirQuadroComoPadrao` saiu para `lib/onboarding/garantir-quadro.ts` (mesmo RPC `fn_aplicar_quadro_do_onboarding`).

---

## 7. Idempotência

Mesmo `id` + `version` + `subtype` + `noopSeJaAplicado` (default true) → **no-op**. Não reinsere pipeline, stage, regra, pointer, template, agente.

Se o no-op encontra follow-up pedido e pointer ausente, cria só o pointer (wizard: funil primeiro, lembrete depois).

Nomes estáveis: `rm:<id>:tag-novo`, `rm:<id>:silencio-24h`, `rm:<id>:followup-24h`. Select-before-insert + `23505` no pointer.

Prova: `tests/unit/ready-models-aplicar.test.ts` casos C e follow-up 2ª vez.

---

## 8. Locação

`locacao@1.0` — `lib/ready-models/modelos/locacao.ts`.

Pipeline: Novo contato → Qualificação → Cotação / Proposta → Negociação → Fechamento (+ etapa `lost` “Não fechou”, o `is_lost` que o core já usa).

Fields: `item_tipo`, `quantidade`, `periodo`, `cidade_local`, `necessidade`, `orcamento`, `origem`. Sem coluna SQL.

Lost reasons em `pipeline.settings.lost_reasons`: preço, sem disponibilidade, concorrente, sem retorno, desistiu, outro.

Automação: `lead.created` → tag `novo`.

Follow-up (opt-in): 1440 min, uma mensagem.

`aiDefaults.ai_mode = off`. Overlay: extrair só o dito; não inventar disponibilidade/preço/prazo.

**Não instala** TOOLS_LOCADORA, Gestão, cobrança, contrato, rastreamento, veículo, checklist, multa.

---

## 9. Subtype veículos

`item_tipo` label **Veículo**. Mesmo pipeline, mesmas keys. Prosa: “Locação de veículos.”

Provisionamento MOOPE (`lib/moope/provisionar.ts`) usa `locacao` + `veiculos` como default de contexto Gestão, **sem** extras de Gestão no instalador.

---

## 10. Subtype máquinas e equipamentos

Label **Equipamento**. Descrição: “Locação de máquinas e equipamentos, sem operador.” Caso real do cliente (equipamentos/ferramentas sem operador). Prova: teste B do instalador.

---

## 11. Subtype ferramentas

Label **Ferramenta**. Mesmas keys. Teste de custom fields usa este subtype para provar label ≠ schema.

---

## 12. Subtype imóveis

Label **Imóvel**. Mesmo core. Alias antigo `imobiliaria` resolve para `locacao` (subtype continua explícito no wizard).

---

## 13. Subtype outros

Default quando subtype falta. Label **Item**. `mesmoPerfilAplicado` trata locação sem subtype como `outros`.

---

## 14. Advocacia

`advocacia@1.0`. Pipeline: Novo contato → Triagem → Documentação → Análise → Reunião → Contratação (+ “Não contratou” lost).

Fields: `area_juridica`, `tipo_demanda`, `cidade`, `urgencia`, `documentacao`.

Tags: urgente, triagem, documentos.

Lost: não aderente, sem retorno, não contratou, documentação, outro.

`ai_mode` default **off**. Overlay: triagem administrativa/comercial; **não** aconselha nem promete resultado. Sem atendimento autônomo por default. Teste D: artifacts sem `rm:locacao` / TOOLS_LOCADORA / Cobrança.

---

## 15. Comercial

`comercial@1.0`. Consolida loja/saas/curso no resolvedor. Pipeline: Novo lead → Qualificação → Proposta → Negociação → Fechamento.

Fields: `produto_servico`, `orcamento`, `origem`, `tamanho_empresa`.

Lost: preço, concorrente, sem retorno, desistiu, outro.

---

## 16. Serviços

`servicos@1.0`. Reusa a ideia do pacote `servicos`. Pipeline: Novo contato → Entendimento → Orçamento → Agendamento / Execução → Fechamento.

Fields: `tipo_servico`, `cidade`, `urgencia`.

Lost: preço, desistiu, sem retorno, outro. Alias `clinica` → `servicos`.

---

## 17. Personalizado

`personalizado@1.0`. Sem fields obrigatórios. Sem automação (0). Follow-up existe no dado, só instala se o wizard ligar.

No Simple Mode o passo Organização é **editável**: nome do quadro + nomes das etapas (`pipelineOverride`). Sem JSON, sem schema na tela.

---

## 18. Wizard antes / depois

**Antes (visível):** welcome (3 portas) → WhatsApp → setup-ai (cria/publica agente) → funil (IA ou pacote) → testar → time.

**Depois (visível):** welcome (5 modelos + subtype de locação) → WhatsApp → quem atende → organização → lembretes → IA (AI_MODE) → time.

Ocultos: `connect-nuvemshop`, `testar`. Mesmo `app/onboarding/`. Sem segundo wizard.

Manual do operador (`lib/manual/conteudo.ts`) e o parágrafo de contexto de `docs/testing/user-journey-map.md` foram alinhados.

---

## 19. Routing

Passo “Quem atende”:

- Manual → `organizations.settings.routing.mode = manual`
- Automaticamente entre os atendentes → `round_robin`

Schema existente (`routingConfigSchema`), knobs default. Convite continua em `invite-team`. Sem team/pool novo.

---

## 20. Follow-up

Pergunta: lembrar quem parou de responder? Sim/Não.

- Não / pular: **não** cria pointer.
- Sim: um fluxo silêncio 24h, `cancel_on_reply: true`, uma mensagem. Engine existente (`followup_flow_pointers` + publish).

Continua sujeito a opt-out, blocked, comando humano, send gate, canal arquivado, cancelamento por resposta — o instalador não abre furo.

**Dívida conhecida (não desta etapa):** o enroll de silêncio ainda exige agente publicado (`lib/followup/agent-followup-gate.ts`). O wizard **não** publica agente. Lembrete instalado pode ficar sem enroll até existir agente. Documentado; sem bypass.

**Won/lost:** `lead.won` / `lead.lost` (já emitidos em `lib/leads/encerramento.ts`) agora cancelam enrollments vivos (`converted`/`lead_won`, `exhausted`/`lead_lost`). Genérico. Sem `if locacao`.

---

## 21. AI_MODE

Quatro opções em língua comum, gravadas em `organizations.settings.ai_mode`:

| Tela | Valor |
|---|---|
| Sem IA | `off` |
| Assistente IA | `copilot` |
| IA controlada | `controlled` |
| Atendimento automático | `autonomous` |

`escolherModoDaIa` usa `z.enum(AI_MODES)` **sem** `.catch("autonomous")`. Default da tela: `off`. Pular (`skipAi`) não publica agente.

AUTONOMOUS só grava o modo. Agente continua em IA › Agentes.

---

## 22. Segurança de agents

O Simple Mode **não** chama `createDefaultAgent`. `createDefaultAgent` permanece no disco (testes J1.15–J1.19, caminho legado).

Prova: `tests/unit/onboarding-setup-ai-aviso.test.tsx` — o form de AI_MODE não cria agente. Spec E2E atualizada afirma zero `ai_agents` ao escolher COPILOT (não executada nesta sessão).

---

## 23. Action Policy

`lib/ai/acoes/autorizar.ts` **não** foi alterado.

CONTROLLED permanece: `move_lead_stage` REQUIRE_CONFIRMATION; `send_message` / `call_external_api` / `operational_moope_action` DENY.

Ready Model não grava allowlist. Prova: `tests/unit/ready-models-ai-mode.test.ts`.

---

## 24. Copilot overlay

Mesmo `copilot_turn`. Overlay lido de `crm_pipelines.settings` do funil padrão (`lib/ai/copiloto/overlay.ts`): instrução curta + keys/labels.

`extractedFields` filtrado às keys conhecidas. Sem id de Ready Model no runtime. Sem RAG. Sem CopilotLocacao.

Encaixe: `gerarSugestaoDoCopiloto`, `copilot-turn.ts`, rota `conversations/[id]/copilot`.

---

## 25. Custom fields

`lib/leads/custom-fields.ts` + `custom_fields` no `updateLeadSchema`.

PATCH do lead: lê `crm_pipelines.settings` do `pipeline_id` do lead **com** `organization_id`; valida; persiste. Key desconhecida some; tipo inválido → 422.

UI: `CustomFieldsEditor` no `LeadFieldsForm` (dossiê). Sem editor novo.

---

## 26. Loss reasons

Fonte dos Ready Models: `pipeline.settings.lost_reasons`.

`organizations.settings.lost_reasons_extra` **não** é usado (dívida do trigger permanece; fora de escopo).

---

## 27. Automações

No máximo uma regra por modelo, nome `rm:<id>:tag-novo`, `lead.created` → `add_tag`. Personalizado: zero. Não substitui ingest.

---

## 28. Compatibilidade com perfis antigos

| Peça | Estado |
|---|---|
| `aplicarPerfilDoNegocio` | facade → instalador |
| `perfil-locadora.ts` / `perfil-advocacia.ts` | no disco; scripts `scripts/provisionar-*.ts` ainda chamam o legado |
| PACOTES | no disco; wizard/perfil não listam os 9 |
| `/app/settings/perfil` | 5 Ready Models + subtype |
| Aliases | locadora→locacao, loja/saas→comercial, generico→personalizado |

Não apagamos o legado. Não há dois instaladores ativos no caminho do produto: o caminho vivo é `aplicarReadyModel`.

---

## 29. MOOPE provision

`lib/moope/provisionar.ts` **não** chama mais `aplicarPerfilLocadora`.

Chama `aplicarReadyModel` com `locacao` + `veiculos`, `followup: false`. Sem extras de Gestão.

`garantirAgenteAtendimentoLocadora` permanece — é do conector Gestão, não do Ready Model. Sem integração CRM↔Gestão nova.

---

## 30. Migrations

**NÃO.**

O MVP cabe em TypeScript + JSONB (`organizations.settings.perfil_do_negocio`, `crm_pipelines.settings`) + tabelas existentes. Nenhuma invariant exigiu coluna/tabela nova. Sem `ready_models`. Sem ALTER.

---

## 31. Arquivos alterados

Novos (núcleo):

- `lib/ready-models/` (`tipos`, `catalogo`, `perfil`, `aplicar`, `modelos/*`)
- `lib/onboarding/garantir-quadro.ts`
- `lib/ai/copiloto/overlay.ts`
- `lib/leads/custom-fields.ts`
- `app/actions/onboarding/escolherRoteamento.ts`
- `app/actions/onboarding/escolherFollowup.ts`
- `app/actions/onboarding/escolherModoDaIa.ts`
- `app/onboarding/quem-atende/`
- `app/onboarding/follow-up/`
- `docs/architecture/ready-models.architecture.json`
- `.changes/ready-models-simple-onboarding.md`

Testes novos: `tests/unit/ready-models-*.test.ts`, `copilot-overlay.test.ts`, `followup-lead-fechado.test.ts`, `leads-custom-fields.test.ts`.

Principais edições: wizard (`welcome`, `funil`, `setup-ai`, `passos`, schemas), facade de perfil, MOOPE provision, Copilot turn/rota, PATCH de lead, `LeadFieldsForm`, reatividade de follow-up, E2E do wizard, manual, mapa de jornadas.

---

## 32. Testes criados

| Arquivo | O que prova |
|---|---|
| `ready-models-catalogo.test.ts` | 5 modelos; key `item_tipo`; subtype muda label; aliases; advocacia sem Gestão |
| `ready-models-aplicar.test.ts` | A–J + follow-up OFF/ON/2ª vez |
| `ready-models-arquitetura.test.ts` | caminhos críticos sem branch de modelo |
| `ready-models-ai-mode.test.ts` | OFF / COPILOT / CONTROLLED / AUTONOMOUS |
| `leads-custom-fields.test.ts` | fields do pipeline; subtype; ignore/422; PATCH + filtro de org |
| `copilot-overlay.test.ts` | overlay e filtro de keys |
| `followup-lead-fechado.test.ts` | won/lost cancela sem if de segmento |

Atualizados: `passos.test.ts`, `ramo-do-negocio.test.ts`, `aplicar-perfil.test.ts`, `VoltarDoPasso.test.tsx`, `onboarding-setup-ai-aviso.test.tsx`, invariantes de follow-up (mocks `loadLeadContactId`), `wizard-do-funcionario.spec.ts`, `vps-fresh-onboarding.spec.ts`.

---

## 33. Typecheck

`pnpm typecheck` — **verde** (após a implementação).

---

## 34. Lint

`eslint` nos arquivos da 3B — **verde** (`--max-warnings 0`).

---

## 35. test:unit

Corrida completa desta sessão:

```
Test Files  8 failed | 586 passed (594)
Tests       19 failed | 6541 passed | 1 expected fail (6561)
Errors      3 errors
Duration    261.50s
```

Suíte 3B direcionada (11 arquivos / 57 testes): **verde**.

Nenhum arquivo vermelho é da 3B. Ver §38.

---

## 36. test:db

Aplicável: reatividade `lead.won` / `lead.lost` (TypeScript, sem schema). Sem migration.

`pnpm test:db` nesta sessão (baseline install + update no `pgvector/pgvector:pg17` + invariantes):

```
Test Files  130 passed (130)
Tests       1005 passed | 1 expected fail | 1 skipped (1007)
Duration    413.91s
==> test:db verde
```

Os dois invariantes de follow-up atualizados (`followup-reactivity`, `followup-agendamento-do-banco`) passaram no banco real.

---

## 37. E2E

`tests/e2e/wizard-do-funcionario.spec.ts` e `vps-fresh-onboarding.spec.ts` foram **atualizados** para a ordem nova (Serviços, quem-atende, follow-up, COPILOT sem agente).

**Não executados** nesta sessão: sem app+Supabase local no harness. A spec do funcionário está no CI (`SPECS_PARTE_*`); `vps-fresh-onboarding` continua FORA_DO_CI.

---

## 38. Falhas herdadas

Arquivos vermelhos do `test:unit` — **nenhum tocado pela 3B**:

| Arquivo | Falhas | Nota |
|---|---|---|
| `baseline-constraint-reconstruida.test.ts` | 1 | varredura de constraint |
| `ingest-dedup-deixa-rastro.test.ts` | 1 | âncora no fonte do ingest |
| `audit-resource-id-e-uuid.test.ts` | 1 | chave natural em coluna uuid |
| `pacote-reserva-vaga-da-critica.test.ts` | 1 | teto de pacote |
| `branding-saida.test.ts` | 2 | marca/hex — lista de dívida da 3B |
| `canal-arquivado-caminho-de-volta.test.ts` | 5 | onboarding/canal |
| `messages-handler-desfechos.test.ts` | 3 | handler de mensagens |
| `lib/ai/dispatcher/rate-limit.test.ts` | 5 | Redis MISCONF / flaky — lista de dívida |

3 unhandled rejections: `tests/unit/waha-carimbo-falho.test.ts` → mock incompleto em `lib/moope/emitir.ts` (`.eq().eq`). **Não** introduzido aqui.

Não alterei expectativa correta para ficar verde.

---

## 39. Riscos

1. Follow-up de silêncio pode não enrollar sem agente publicado (gate existente).
2. Wizard E2E não rodou aqui — regressão de cópia/rota só aparece no CI ou numa VPS.
3. AUTONOMOUS no wizard só liga o modo; sem agente o automático não atende. A cópia da tela diz isso.
4. Troca de modelo com funil cheio cria quadro novo e deixa o antigo — cards não migram (proposital).
5. Overlay do Copilot não usa RAG (P2 da 3A, de propósito).
6. Scripts `provisionar-locadora.ts` / `provisionar-escritorio-advocacia.ts` ainda chamam o perfil legado.

---

## 40. Dívidas (não desta etapa)

- `lost_reasons_extra` vs trigger.
- Copilot → RAG (P2).
- Enroll de follow-up preso a agente publicado.
- Branding / Twilio baseline / rate-limit flaky / JID / lead_state / dashboard / sequential routing / create_task / campanhas.
- Unificar ou aposentar `perfil-locadora.ts` / PACOTES / `createDefaultAgent` no wizard (3C ou depois).

---

## 41. Diffstat

Ver `git diff --stat 851fa447` no commit desta etapa. Ordem de grandeza: catálogo + instalador + wizard (3 passos novos) + overlay + custom fields + reatividade won/lost + testes + este relatório + fragmento `.changes`.

Fora do commit: `.cursor/`, golden candidates, `.env*`, `docs/MOOPE_CRM_CHECKPOINT_2_7_RESULTADO.md` (sujeira prévia), `docs/MOOPE_CRM_ETAPA_3A_READY_MODELS_AUDITORIA.md` (entrega da 3A ainda untracked).

---

## 42. Commit / hash

Mensagem: `feat(crm): add generic ready models and simple onboarding`

O hash é o `HEAD` após o commit único desta etapa (`git log -1 --format='%H %s'`). **Não houve push.**

---

## 43. Working tree

Após o commit da 3B, o que sobrar deve ser só sujeira prévia / local (`.cursor/`, golden, docs da 3A/2.7 se não entraram). Conferir com `git status`.

---

## 44. Confirmação de push

**Não houve push.** Nenhum `git push` nesta etapa.

---

## Respostas explícitas

| Pergunta | Resposta |
|---|---|
| READY MODEL LOCAÇÃO FUNCIONA SEM SER ESPECÍFICO DE VEÍCULO | **SIM** |
| READY MODEL ADVOCACIA USA O MESMO CORE | **SIM** |
| READY MODEL COMERCIAL USA O MESMO CORE | **SIM** |
| READY MODEL SERVIÇOS USA O MESMO CORE | **SIM** |
| PERSONALIZADO USA O MESMO CORE | **SIM** |
| INSTALAÇÃO É IDEMPOTENTE | **SIM** |
| TENANT PODE EDITAR A CONFIGURAÇÃO DEPOIS | **SIM** |
| READY MODEL ALTERA RUNTIME DE ENVIO POR SEGMENTO | **NÃO** |
| AGENTE AUTÔNOMO É PUBLICADO SEM ESCOLHA EXPLÍCITA | **NÃO** |
| FUNDAÇÃO DAS ETAPAS 1/2/2.5 CONTINUA PRESERVADA | **SIM** |

---

## Conclusão

**MOOPE CRM READY MODELS MVP PRONTO PARA PILOTO: SIM**

Com ressalvas de engenharia, não de arquitetura: E2E do wizard não foi exercitado nesta sessão; follow-up opt-in pode não enrollar até existir agente; `test:unit` da árvore inteira ainda carrega as 8 falhas herdadas da fundação.

**STOP.** Não iniciar 3C. Não ligar RAG no Copilot. Não criar vertical. Não fazer push. Esperar revisão de engenharia.
