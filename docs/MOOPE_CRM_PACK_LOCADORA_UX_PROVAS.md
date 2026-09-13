# Pack Locadora UX — matriz de provas

| # | Afirmação | Como se prova | Onde |
|---|---|---|---|
| 1 | Tenant existente sem Pack | Org com `onboarded_at`, sem `business_pack`, com Assistente da empresa e coleções genéricas | `pack-locadora-existing-tenant.spec.ts` |
| 2 | Modelos prontos encontrável | Registry em Organização / Sua empresa; hub Configurações; Meu Negócio; landing Assistentes | `navegacao-registry.test.ts`, telas |
| 3 | Ativar Locadora sem onboarding | Meu Negócio → Ativar → POST `/api/v1/business-packs` | E2E existing + `business-packs/route.ts` |
| 4 | Status Pack ativo | Banner Meu Negócio + loja ATIVO | `modelo-do-negocio`, `pack-loja-ativo` |
| 5 | 6 assistentes visíveis | Cards recepcao/comercial/financeiro/disponibilidade/atendimento/relacionamento | landing `meus-assistentes` |
| 6 | + Criar assistente | CTA no topo → `/app/ai/agents/simples` | `criar-assistente` |
| 7 | Configurar | Editor com tabs amigáveis | `tab-visao-geral` … `tab-avancado` |
| 8 | Knowledge mostra qual assistente | `?agent=` → banner com nome | `conhecimento-do-assistente` |
| 9 | Coleções antigas preservadas | slugs `suporte`, `juridico` continuam | E2E existing |
| 10 | Coleções do Pack criadas | `suporte-da-locadora`, `comercial-da-locadora` | E2E existing + unitário do instalador |
| 11 | Guardrails fora da UX principal | Aba Guardrails some; labels EN somem da cara | E2E: `Guardrails` count 0 |
| 12 | Avançado disponível | `tab-avancado` + `regras-tecnicas` | Editor |
| 13 | Reaplicar não duplica | Contagem de agentes igual; Assistente da empresa permanece | E2E existing + `business-pack-locadora.test.ts` |
| 14 | Mobile 390×844 | overflow ≤ 8px na landing | E2E existing |
| 15 | Dark | cards visíveis com `colorScheme: dark` | E2E existing |
| 16 | Principal ≠ especialidades | `assistente-principal` só na recepção | `pack-locadora-ux.test.ts` |
| 17 | MCP não aparece | catálogo amigável; E2E sem `mcp_` | `DadosEFerramentasDoAssistente` |
| 18 | Isolamento | tenant B sem pack da A | `pack-locadora.spec.ts` (original) |

## Decisão do Assistente da empresa

Preservar (B). Evidência: `garantirAgentes` insere `is_default: false`;
`adaptarAgentePadraoDoPack` só troca voz se o prompt ainda é o de loja.
Tenant existente com “Assistente da empresa” não entra nesse if.

## Coleções da screenshot anterior

Eram `COLECOES_PADRAO` (Suporte, Comercial, Jurídico, Conhecimento geral),
semeadas na primeira GET de coleções. Significava **Pack não instalado** na
org que a pessoa estava olhando — não falha de rename.
