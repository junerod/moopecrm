# Pack Locadora — correção de UX / descoberta

## Por que o Pack existia e ninguém achava

O instalador, a API `POST /api/v1/business-packs` e o passo de onboarding já
funcionavam. O E2E original criava **empresa nova**, escolhia Locadora no
wizard e instalava. Quem abria uma **organização já existente** caía em:

- Assistentes IA com lista técnica e “Assistente da empresa”
- Knowledge com coleções genéricas (Suporte, Comercial, Jurídico, Geral)
- Meu Negócio só com ficha da empresa
- “Modelos prontos” no grupo de IA, sem sidebar, só pelo hub ⌘K

Não havia CTA “Ativar Pack Locadora” no tenant atual. O produto estava no
banco e escondido na navegação.

## Onde se ativa agora

1. **Meu Negócio** (`/app/settings/business`) — bloco “Modelo do seu negócio”
   - sem pack: card Locadora + **Ativar Pack Locadora** + **Ver o que será instalado**
   - com pack: **Locadora de veículos / Pack ativo**, versão, status, assistentes
2. **Modelos prontos** (`/app/modelos-prontos`) — mora em Configurações › Sua empresa,
   ao lado de Meu Negócio. Sem pack: **Ativar modelo**. Com pack: **ATIVO** +
   Ver configuração. Reaplicar continua “Reaplicar sem duplicar”.
3. **Assistentes** — atalho “Modelos prontos” no topo da landing.

Não é preciso recriar empresa nem refazer onboarding.

## Tenant existente

A API de instalação já aceitava org onboarded (exige `admin`). A falha era de
porta. O fluxo agora é:

Meu Negócio → Modelos prontos → Ativar modelo.

O instalador é o mesmo (`aplicarBusinessPack`). Idempotente. Não apaga
customização.

## O que aconteceu com “Assistente da empresa”

**Decisão B — preservar.**

O instalador cria as 6 especialidades com `is_default=false` e só tenta
adaptar o default se o prompt ainda for o de loja. Em tenant existente o
default já tem nome/voz próprios: **não é deletado, não é renomeado, não vira
segundo default**. Aparece na landing como “Já existia na empresa”.

“Atendimento da Locadora” é o **principal do Pack** (recepção e triagem).
Não há dois defaults competindo: o default operacional pré-Pack permanece
um; as especialidades trabalham ao lado.

## Por que a screenshot mostrava coleções genéricas

`COLECOES_PADRAO` em `lib/ai/knowledge/colecoes.ts` semeia Suporte, Comercial,
Jurídico e Conhecimento geral na **primeira visita** a Knowledge, quando a
lista está vazia. Aquele tenant **não tinha Pack instalado**. Não era bug de
renomeação.

Com Pack ativo, as quatro coleções da Locadora entram **sem apagar as
antigas**. As duas famílias aparecem juntas.

## Onde está “+ Criar assistente”

Topo da landing `/app/ai/agents`, ao lado de “Modelos prontos”. Abre o
wizard leigo (`/app/ai/agents/simples`): nome → o que faz → coleções →
autonomia → revisão. Autonomia mapeia para o vocabulário do `AI_MODE`
existente; não cria motor novo.

## Modelos prontos

Loja de configuração, não tela técnica. Mostra o que instala (6 assistentes,
1 funil, 4 coleções, automações, respostas, campanhas). Status ATIVO vs
Ativar modelo. Test-drive sem WhatsApp permanece.

## Editor simplificado

Pack cria `rag_bot`. O editor deixou de abrir em Geral / Modelo / RAG /
Guardrails. Tabs:

| Antes | Agora |
|---|---|
| Geral | Visão geral |
| Modelo (prompt) | Instruções |
| RAG | Conhecimento (link para coleções) |
| — | Dados e ferramentas (nomes amigáveis, sem MCP) |
| — | Autonomia (modo da empresa em português) |
| Guardrails + knobs | **Avançado → Regras técnicas** |

## Onde foram parar Guardrails / RAG / Modelo técnicos

Aba **Avançado**:

- Modelo de IA, criatividade, tamanho da resposta
- Busca no conhecimento (trechos, semelhança) — sem a palavra RAG na cara
- Regras técnicas, labels em português:
  - Bloquear padrões na resposta
  - Exigir fonte de conhecimento
  - Bloquear padrões na mensagem recebida
  - Horário de funcionamento
  - Regra por marcador do contato

A estrutura interna (`regex_output_block`, etc.) não mudou.

## Knowledge — qual assistente

`/app/ai/knowledge/sources?agent=<id>` mostra banner **Conhecimento do
assistente** com o nome. Sem `agent`: **Conhecimento da empresa** — não finge
configurar um assistente específico.

## Living System Checklist

1. Quem me alimenta? Meu Negócio, hub Configurações, landing Assistentes, onboarding.
2. Quem eu alimento? `aplicarBusinessPack` → agentes, coleções, funil, templates.
3. Registro? `pack.installed` / `pack.updated` já existentes no audit.
4. Tela? Meu Negócio, Modelos prontos, Assistentes, editor, Knowledge.
5. Porta? `lib/navigation/registry.ts` — Modelos prontos em Organização / Sua empresa.
6. Anti-morte? Reaplicar sem duplicar; default antigo preservado.
7. Configuração? Ativar / ATIVO / Reparar (reaplicar) visíveis.
8. Continuidade? Test-drive sem WhatsApp; humano assume via AI_MODE.
9. Laço? Falha de instalação vira toast; Gestão ausente aparece como “Não conectado”.
10. Mapa? `docs/architecture/business-packs.architecture.json` ganhou Meu Negócio e Assistentes.

## O que esta entrega NÃO fez

Bridge Gestão ↔ CRM. Pack V2. WhatsApp real. Redesign geral. Segundo instalador.

## Gates medidos nesta sessão

- `pnpm typecheck` — verde
- `pnpm test:db` — 130 arquivos, 1016 passou
- unitários de navegação, cobertura e2e, mapas, pack e apresentação — verde
- `pack-locadora-existing-tenant.spec.ts` — verde
- `pack-locadora.spec.ts` — verde (3 testes)
- `productization-3c` wizard de criar assistente — verde

## Veredito

MOOPE CRM — PACK LOCADORA ENCONTRÁVEL E UTILIZÁVEL: **SIM**

TENANT EXISTENTE CONSEGUE ATIVAR: **SIM**
MEU NEGÓCIO MOSTRA PACK: **SIM**
MODELOS PRONTOS VISÍVEL: **SIM**
STATUS PACK ATIVO: **SIM**

6 ASSISTENTES VISÍVEIS: **SIM**
CRIAR ASSISTENTE VISÍVEL: **SIM**
TESTAR ASSISTENTE VISÍVEL: **SIM**

ASSISTENTE PRINCIPAL CLARO: **SIM**
ESPECIALIDADES CLARAS: **SIM**

KNOWLEDGE MOSTRA QUAL ASSISTENTE: **SIM**
COLEÇÕES DO PACK VISÍVEIS: **SIM**

RAG NÃO APARECE COMO CONCEITO PRINCIPAL: **SIM**
GUARDRAILS TÉCNICOS FORA DA UX PRINCIPAL: **SIM**
MCP NÃO APARECE COMO CONCEITO PARA CLIENTE: **SIM**

CUSTOMIZAÇÃO ANTIGA PRESERVADA: **SIM**
REAPLICAR NÃO DUPLICA: **SIM**

MOBILE: **8/10** (390×844, overflow ≤ 8px na landing; tabs do editor quebram linha)
LIGHT: **8/10**
DARK: **8/10**

TYPECHECK: verde
TEST:DB: verde
E2E EXISTING TENANT: verde
E2E PACK ORIGINAL: verde
REGRESSÕES: wizard 3C verde; unitários de navegação/isolamento verdes

BLOCKERS: nenhum

PRONTO PARA EU TESTAR MANUALMENTE COMO LOCADORA: **SIM**

COMMIT LOCAL: sim (este PR de correção)
PUSH: **NÃO**

PRÓXIMO PASSO: TESTE MANUAL DO PACK LOCADORA
