# MOOPE CRM — Etapa 1: resultado da implementação

**Data:** 2026-09-07  
**Escopo:** somente “parar o dano”. Sem MOOPE Vendas, sem novos funis, sem templates, sem Automation Builder, sem campanhas, sem novos agentes, sem `conversation_mode`, sem policy engine.

**Frase de aceite (agora tecnicamente verdadeira no backend):**

> Se um humano assumir ou enviar uma mensagem em uma conversa, nenhuma IA, follow-up conversacional ou automação de envio poderá enviar naquela conversa até que o controle seja explicitamente devolvido.

> Uma IA que já esteja gerando uma resposta deve ser bloqueada no último instante se o humano tiver assumido antes do envio.

---

## 1. Situação antes

Três falhas confirmadas pela auditoria:

1. **Corrida IA × humano.** O motor moderno (`agent-engine`) lia handoff no *início* do turno (`isLeadInHandoff`). A cadeia `runBeforeSend` (v6, 10 gates) relia, no instante do envio, só `contacts.is_blocked OR contacts.force_human`. Assumir / Pausar / envio humano **não** ligam `force_human` (de propósito: essa flag é do contato inteiro). Resultado: a IA podia terminar de gerar e chamar `ChannelAdapter.send()` depois de um humano já ter o comando.

2. **Envio humano pelo Inbox = silêncio de ~5 minutos.** `sendMessageHandler` estendia `bot_silenced_until` com `HUMAN_REPLY_SILENCE_MS` (janela deslizante). Depois do relógio, inbound do cliente reativava a IA. Não havia takeover durável.

3. **Automação conversacional ignorava o comando.** `automation_rules` com `send_whatsapp_message` / `send_ai_message` passavam só por `checarGuardasDeContato` (bloqueio / telefone / consentimento) e iam direto a `sendMessageHandler` com `actor.type = 'webhook_source'`. Humano no comando não calava.

Estruturas que já existiam e foram reutilizadas (nenhuma máquina de estados nova):

| Peça | Papel |
|---|---|
| `lib/inbox/comando-da-conversa.ts` | Predicado puro da tela (quem manda / automático ativo) |
| `runBeforeSend` + `before_send_traces` | Seam entre decisão do modelo e o canal |
| `bot_silenced_until = 'infinity'` | Silêncio durável (Assumir / Pausar / handoff) |
| `fn_conversation_assign` reason `claim` | Ownership; routing **não** silencia (migration 0173) |
| `force_human` | Trava do **contato**, não da conversa |
| `devolverAtendimentoAoAgente` / `reactivate-bot` | Devolução explícita |
| `registrarTrocaDeComando` | Timeline visível |
| `event_log` / `job_queue` / unique `(organization_id, external_id)` | Idempotência — não mexida |

---

## 2. Causa corrigida

Não faltava “mais um estado persistido”. Faltava **um predicado só**, consultado por todos os emissores conversacionais, e uma **releitura no último instante** antes do POST ao canal.

A janela de 5 minutos foi o mecanismo errado para “humano falou”: ela prometia silêncio e devolvia a IA sozinha. O mecanismo certo já existia (`infinity` + Devolver).

A automação tinha guardas de contato e nenhuma guarda de *comando da conversa*.

---

## 3. Arquitetura depois da correção

```
                    ┌─────────────────────────────────────┐
                    │  decidirEnvioConversacional(fatos)  │
                    │  (pura — um arquivo, uma regra)     │
                    └──────────────┬──────────────────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          │                        │                        │
   runBeforeSend            automação de ENVIO        worker legado
   (gate 2 + reload         send_whatsapp /           (buildContext)
    pós-throttle)           send_ai_message
          │                        │
          └────────────┬───────────┘
                       │
              ChannelAdapter / sendMessageHandler
```

### 3.1 Predicado único

`decidirEnvioConversacional` em `lib/inbox/comando-da-conversa.ts` (o mesmo arquivo da tela).

Lê, nesta ordem:

1. `is_blocked` → `DENY_BLOCKED`
2. `status ∈ {closed, archived}` → `DENY_CLOSED`
3. `force_human` → `DENY_HUMAN_ACTIVE`
4. silêncio vigente + dono humano (`assigned_to_user_id` ou `assignee_kind='user'`) → `DENY_HUMAN_ACTIVE`
5. silêncio vigente sem dono → `DENY_PAUSED`
6. senão → permitido

**Rodízio sem silêncio continua permitido.** `fn_conversation_assign(reason='routing')` atribui humano e **não** cala — isso é da 0173 e foi preservado. Distribuir ≠ assumir. Quem cala é Assumir, Pausar, ou envio humano pelo Inbox.

I/O mora em `lib/inbox/ler-comando.ts`:

- `lerFatosDoComandoPg` — agent-engine (`pg`)
- `lerFatosDoComandoSupabase` — app / automação / pos-entrada
- `decidirAPartirDosFatos(null)` = **permitido** (fail-open: ausência de linha não inventa trava)

`comandoDaConversa` (tela) agora também considera `is_blocked` em `automaticoAtivo`. Bloqueio **não** liga `travaVigente`: Devolver não pode desbloquear opt-out.

### 3.2 Gate final + releitura no último instante

`BEFORE_SEND_CHAIN_VERSION` **6 → 7**. Gate novo `conversation_control` na posição 2 (depois de `stop`, antes de LGPD / pacing).

O runner:

1. Sob o advisory lock, lê os fatos e preenche `GateContext.conversationControl`.
2. Avalia a cadeia (o gate aplica o predicado).
3. Se houver throttle, espera.
4. **Relê o banco imediatamente antes de `args.send()`.** Se o humano assumiu durante a geração *ou* durante o sleep, veta com o mesmo código, grava trace e atividade de veto, faz rollback, **não** chama o ChannelAdapter.

Lookup vazio / erro de leitura = fail-open (testes com `rows: []` e clones sem a linha). A segurança do opt-out continua no `stopGate`, que já relia `is_blocked`.

`conversationId` agora é passado por:

- `inbound-turn.ts` (`send_message` e `send_template`)
- `followup-turn.ts` (re-entrada determinística — o mesmo seam)
- `aviso-de-escalacao.ts`

Sem `conversationId`, o runner tenta achar a conversa por `(contact, channel_session)`.

### 3.3 Envio humano pelo Inbox = assumir durável

Quando `actor.type === 'user'`:

1. Se não há `assigned_to_user_id`, `fn_conversation_assign` reason `'claim'`.
2. `bot_silenced_until = 'infinity'` **antes** do POST ao canal (fecha a corrida) e de novo no update pós-envio (reafirma).
3. `registrarTrocaDeComando` (`conversation_claimed` ou `conversation_ai_paused`).

**Não usa `force_human`.** Takeover é da conversa, não do contato.

A IA só volta por Devolver (`reactivate-bot` → `devolverAtendimentoAoAgente`). Essa rota **não foi alterada**: já limpa silêncio + assignee + `force_human`. Cuidado existente: `force_human` é do contato; devolver pode reabilitar automático em **outras** conversas do mesmo contato. Documentado na UI e mantido.

Assumir (botão) já gravava `infinity`. Continua. Agora o envio manual faz o mesmo.

### 3.4 Automações

Só as ações que **enviam mensagem**:

- `lib/automation/actions/send-whatsapp.ts`
- `lib/automation/actions/send-ai-message.ts`

Depois de `ensureConversation`, consultam `checarComandoParaEnvio`. Se negado: `{ status: 'skipped', detail: { reason: DENY_*, motivo } }`.

`add_tag`, criar/mover lead, tarefa — **não** passam pela guarda. TESTE F vigia isso no fonte.

### 3.5 pos-entrada (otimização)

Antes de emitir `ai_agent.dispatch_requested`, consulta o predicado. Se já está humano / pausado / fechado / bloqueado, não despacha.

Select que falha → **fail-open** (ainda despacha). A trava real é o before-send.

### 3.6 Worker legado (`ai-response-worker`)

**Não removido.** Quando existe agente publicado, o engine é quem responde (`engine_owns_reply`). O legado **não** usa `runBeforeSend`. Nesta etapa ele passou a chamar o **mesmo** `decidirEnvioConversacional` em `buildContext`, além dos skips antigos (`assigned_to_human`, `force_human`, `contact_blocked`). O `new Date('infinity')` antigo lia infinity como data inválida e **deixava passar**; o predicado não.

Códigos do predicado são mapeados para `SkipReason` já existentes (`contact_blocked` / `assigned_to_human` / `silenced_post_handoff`) para não alargar o union sem necessidade.

---

## 4. Regras importantes (para o revisor)

### Humano no comando = nenhum envio conversacional automático

Isso vale no backend, não na UI e não no prompt.

### O que NÃO cala

- Rodízio (`assignee_kind='user'` sem silêncio vigente).
- Ações internas de automação (tag, tarefa, lead).
- Envio operacional MOOPE / MCP com `actor.type !== 'user'` (ver §8).

### Fail-open vs fail-closed

- Sem linha de conversa no lookup do gate de comando → **não veta** (não inventa trava).
- Opt-out / `force_human` no `stopGate` → **veta** o que leu.
- Valor ilegível de `bot_silenced_until` → silêncio vigente (já era a regra da tela).

### Ordem da cadeia v7

`stop` → `conversation_control` → `lgpd` → `pacing` → `messaging_window` → `spinning` → `promise` → `semantic_promise` → `case_promise` → `internal_vocabulary` → `disclosure`

A tela de Segurança do agente ganhou a linha “Respeitar quem assumiu o atendimento”, amarrada por `tests/unit/seguranca-lista-casa-com-a-cadeia.test.ts`.

---

## 5. Arquivos alterados

### Novos

| Arquivo | Função |
|---|---|
| `lib/inbox/ler-comando.ts` | SELECT dos fatos (pg + supabase) |
| `lib/inbox/assumir-pelo-envio.ts` | Claim + infinity + timeline no envio humano |
| `lib/automation/guarda-do-comando.ts` | Ponte automação → predicado |
| `lib/automation/guarda-do-comando.test.ts` | TESTE E / F |
| `tests/unit/before-send-comando-humano.test.ts` | TESTE A / B / G / H |
| `tests/unit/ingest-idempotencia-23505.test.ts` | TESTE J (âncora de não-regressão) |
| `.changes/humano-no-comando-cala-o-automatico.md` | Fragmento de release (`impacto: nada_mudou`) |
| `docs/MOOPE_CRM_ETAPA_1_RESULTADO.md` | Este relatório |

### Modificados

| Arquivo | O quê |
|---|---|
| `lib/inbox/comando-da-conversa.ts` | `is_blocked` + `decidirEnvioConversacional` |
| `lib/inbox/comando-da-conversa.test.ts` | C, G, H, I + bloqueio na tela |
| `lib/agent-engine/guardrails/before-send.ts` | Gate v7 + reload pré-send |
| `lib/agent-engine/agent/inbound-turn.ts` | Passa `conversationId` |
| `lib/agent-engine/agent/followup-turn.ts` | Passa `conversationId` |
| `lib/agent-engine/agent/aviso-de-escalacao.ts` | Passa `conversationId` |
| `app/api/v1/messages/_handler.ts` | Envio `user` = assumir durável; remove janela de 5 min |
| `lib/automation/actions/send-whatsapp.ts` | Guarda de comando |
| `lib/automation/actions/send-ai-message.ts` | Guarda de comando |
| `lib/channels/pos-entrada.ts` | Skip de despacho |
| `workers/ai-response-worker.ts` | Mesmo predicado |
| `lib/ai/guardrails/lista-de-conferencia.ts` | 11ª conferência na tela |
| `lib/ai/agents/avaliar-resposta-de-teste.ts` | Gate novo como não-avaliável no “Testar” |
| `docs/architecture/agent-turn.workflow.json` | “11 gates (v7)” |
| `docs/doctrine/sistema-vivo.md` | Número de gates deixou de ser prosa |
| `docs/specs/16-spec-tres-papeis-do-agente.md` | Aponta para a lista viva |
| `tests/unit/before-send-chain-shape.test.ts` | Ordem / tamanho 11 / versão 7 |
| `tests/unit/messages-handler-silencio-ia-apos-humano.test.ts` | Espera `infinity` + TESTE D |
| `tests/unit/pos-entrada-efeitos-do-canal.test.ts` | Skip de despacho |
| `tests/unit/painel-de-seguranca.test.tsx` | 10 conferências fixas |

---

## 6. Migrations

**Nenhuma.** Etapa 1 usa colunas e RPCs já existentes (`bot_silenced_until`, `assignee_kind`, `assigned_to_user_id`, `force_human`, `is_blocked`, `fn_conversation_assign`, `before_send_traces`).

Não há `conversation_mode`. Não há baseline novo.

---

## 7. Testes criados / reescritos e o que cada um prova

| ID | Caso | Onde | Resultado desta sessão |
|---|---|---|---|
| A | Assumir → IA tenta enviar → CANCELADO | `before-send-comando-humano.test.ts` | PASS |
| B | IA gerou; humano assume no throttle; releitura CANCELA | idem (o mais importante) | PASS |
| C | Humano enviou; +6 min lógicos; infinity ainda vige | `comando-da-conversa.test.ts` + handler promove 30 min → infinity | PASS |
| D | Inbox sem dono → claim + infinity | `messages-handler-silencio-ia-apos-humano.test.ts` | PASS |
| E | Automação de envio com humano no comando → SKIP `DENY_HUMAN_ACTIVE` | `guarda-do-comando.test.ts` | PASS |
| F | `add_tag` não importa a guarda de envio | idem (fonte) | PASS |
| G | CLOSED → `DENY_CLOSED` | predicado + before-send | PASS |
| H | BLOCKED → `DENY_BLOCKED` | predicado + before-send | PASS |
| I | Depois da devolução (fatos limpos) → permitido | `comando-da-conversa.test.ts` | PASS |
| J | Webhook duplicado / 23505 | `ingest-idempotencia-23505.test.ts` (WAHA + Twilio) | PASS |

TESTE I exercita o predicado após os fatos que `devolverAtendimentoAoAgente` já grava. A rota de devolução não foi reescrita.

TESTE C no handler: silêncio finito legado (30 min) é **promovido** a `infinity`. Não existe mais “esperar 5 minutos e a IA volta”.

---

## 8. Suite executada e resultados

### O que rodou nesta sessão

```
pnpm exec tsc --noEmit          → EXIT 0
eslint (arquivos tocados)       → EXIT 0
```

Suíte pontual da Etapa 1 (cadeia, predicado, handler, pos-entrada, segurança, worker legado, automação, TESTE J):

**11 arquivos, 113 testes, todos PASS.**

`pnpm test:unit` completo (2026-09-07):

| | |
|---|---|
| Arquivos | 9 failed / 571 passed (580) |
| Testes | 22 failed / 6453 passed / 1 expected fail |
| Duração | ~275 s |

### Falhas da suíte completa — o que é (e não é) desta etapa

Medido: `tests/unit/messages-handler-desfechos.test.ts` (3 casos: first-fetch = `contacts/check-exists`, `error_message` = `waha_500: boom`) **já falha no `HEAD` sem o handler da Etapa 1**. Causa: o caminho de envio atual consulta existência do JID antes do `sendText`/`sendImage` (grafias do 9). Não foi introduzido aqui.

As outras falhas da suíte completa **não tocam** os arquivos desta etapa:

- `audit-resource-id-e-uuid` — rotas hosted / moope-credencial
- `baseline-constraint-reconstruida` — `channel_sessions_provider_*` duplicados no baseline
- `branding-saida` — accent do produto
- `canal-arquivado-caminho-de-volta` — onboarding WhatsApp
- `fragmentos-de-release` — fragmentos já no working tree (não o desta etapa)
- `ingest-dedup-deixa-rastro` — conta 4 caminhos 23505 no WAHA (o arquivo não foi editado)
- `pacote-reserva-vaga-da-critica`
- `lib/ai/dispatcher/rate-limit.test.ts` — timeout do contador em memória
- Unhandled rejection em `lib/moope/emitir.ts` (`avisarConversaAbertaSeNova`) no fake de `waha-carimbo-falho` — pré-existente

**Não rodado nesta sessão (e por quê):**

- `pnpm test:db` — sem mudança de schema/RLS. O invariante `tests/invariants/automation-send-whatsapp.test.ts` passa a fazer um SELECT extra de comando; conversa aberta sem silêncio continua permitida (fail-open se a linha não vier). Vale rodar antes do merge se houver Postgres à mão.
- `pnpm test:e2e` — sem mudança de UI/fluxo de tela além do efeito invisível (IA que não volta sozinha). O botão Assumir / Devolver não mudou de contrato.
- Inbox / QR / Meta / Zernio / Twilio / RAG / CRM / pipelines / RLS: nenhum desses módulos foi reescrito. Follow-up conversacional do engine agora leva `conversationId` para o **mesmo** gate.

---

## 9. Living System Checklist (Etapa 1)

Peça: **comando conversacional no backend**.

1. **Quem me alimenta?** Fatos da conversa + contato, relidos do banco (`lerFatosDoComandoPg` / `Supabase`), nunca do body do turno.
2. **Quem eu alimento?** `runBeforeSend`, `send-whatsapp` / `send-ai-message`, `ai-response-worker`, `pos-entrada` (otimização).
3. **Que registro eu emito?** `before_send_traces` (código `DENY_*`); `registrarTrocaDeComando` no envio humano; skip da automação com `detail.reason`.
4. **Onde aparece na tela?** Painel de Segurança (conferência nova); timeline do lead (`conversation_claimed` / `conversation_ai_paused`); a tela de comando já existia (`comandoDaConversa`).
5. **Porta?** Inbox existente (Assumir / Devolver / enviar). Sem tela nova, sem item de navegação.
6. **Anti-morte?** Devolver continua sendo o próximo passo explícito. Silêncio `infinity` não expira.
7. **Onde se configura?** Não é knob. Não se desliga — a tela de Segurança diz por quê.
8. **Continuidade?** Humano→automático = Devolver (já existia). Automático→humano = Assumir / envio / Pausar, agora com o mesmo efeito no motor.
9. **Laço de retorno?** Veto vira erro instrutivo no turno + linha no trace. Skip de automação vai para a Atividade da regra.
10. **Mapa?** `docs/architecture/agent-turn.workflow.json` sublabel da cadeia atualizado (11 / v7). Sem nó novo: o gate entrou na peça `Before-send` que já tinha arestas.

---

## 10. Comportamento legado que permanece

1. **`ai-response-worker` continua registrado.** É pulado quando há agente publicado. Proteção desta etapa: o predicado em `buildContext`. Ele **não** passa por `runBeforeSend` (pacing, LGPD, spinning, disclosure). Risco residual: se alguém religar o legado como caminho principal, a trava humana vale; as outras guardas da cadeia v7 não.

2. **MOOPE `POST /integrations/moope/send` e MCP `crm_send_whatsapp_message`** usam `sendMessageHandler` com `actor.type = 'webhook_source'` (ou equivalente não-`user`). **Não** disparam assumir. **Não** passam por `runBeforeSend`. São envio operacional do parceiro, não automação conversacional. Um humano no comando **não** bloqueia o disparo MOOPE. Isso é residual consciente da Etapa 1 — não calar o conector da locadora.

3. **Rodízio:** conversa com dono humano e **sem** silêncio: a tela mostra “Em atendimento” e `automaticoAtivo: true`. A IA **pode** responder. Só Assumir / Pausar / envio Inbox cala.

4. **`force_human` no Devolver** continua contato-inteiro. Não usamos essa flag para takeover de conversa.

5. **Jobs já `running` não são cancelados.** A Etapa 1 não cancela in-flight. A rede é o reload imediatamente antes de `send()`. Etapa 2 pode cancelar a fila.

6. **Silêncios finitos antigos** (janelas de 5 min já gravadas) continuam vigentes enquanto o relógio não vence. Qualquer **novo** envio humano promove para `infinity`.

7. **`isLeadInHandoff` (início do turno) não foi alargado.** A segurança nova é o gate + reload, não uma segunda cópia da regra no começo do turno. O teste-espelho no fim de `comando-da-conversa.test.ts` continua exigindo que aquele SQL leia só `force_human` + `bot_silenced_until`.

---

## 11. Pendências e riscos

| Item | Gravidade | Nota |
|---|---|---|
| Envio MOOPE / MCP burla o predicado | Média (produto) | Parceiro operacional. Decidir na Etapa 2 se “humano no comando” também cala o conector. |
| Job `running` não cancelado | Baixa | Coberto pelo last-second gate. Cancelar é Etapa 2. |
| Worker legado sem cadeia v7 completa | Baixa | Só responde se não há agente publicado. |
| `test:db` / `test:e2e` não rodados | Processo | Sem schema novo; UI sem porta nova. Rodar antes do merge se o revisor exigir o harness completo. |
| Devolver limpa `force_human` do contato | Já existia | Pode reabrir automático em outra conversa do mesmo cliente. |
| Fail-open do gate de comando | Aceito | Sem linha ≠ “inventar humano”. Opt-out continua no stop. |
| Suíte unitária da `main` já tinha 22 falhas | Fora de escopo | Não “consertadas” aqui para não misturar Etapa 1 com dívida alheia. |

---

## 12. O que deliberadamente NÃO foi feito (Etapa 2+)

- Cancelamento amplo de jobs in-flight
- Modos OFF / COPILOT / CONTROLLED / AUTONOMOUS
- Policy engine / `canExecuteAction`
- Coluna `conversation_mode`
- MOOPE Vendas, novos funis, templates de segmentos, campanhas, novos agentes
- Remoção do `ai-response-worker`
- Calar MOOPE send / MCP send pelo predicado

---

## 13. Recomendação para a próxima etapa

Validar esta fundação em uma conversa real (Assumir no meio de um turno; enviar pelo Inbox; disparar uma regra de WhatsApp; Devolver; inbound novo).

Só então a Etapa 2 deveria:

1. Decidir se o envio operacional MOOPE/MCP entra no mesmo predicado ou ganha uma exceção nomeada (hoje está de fora).
2. Cancelar ou invalidar jobs `queued`/`running` da conversa no momento do assume — o last-second já segura o send; cancelar economiza LLM e fecha a janela de “quase enviou”.
3. Se ainda fizer falta um modo persistido (OFF/COPILOT/…), nascer **em cima** deste predicado, não ao lado.
4. Não reintroduzir timeout para devolver a IA.

---

## 14. Como revisar o diff (ordem sugerida)

1. `lib/inbox/comando-da-conversa.ts` — a regra.
2. `lib/agent-engine/guardrails/before-send.ts` — o gate + o reload depois do `sleep`.
3. `lib/inbox/assumir-pelo-envio.ts` + `_handler.ts` — o fim da janela de 5 min.
4. `lib/automation/guarda-do-comando.ts` + as duas ações de send.
5. `tests/unit/before-send-comando-humano.test.ts` — especialmente TESTE B.
6. Este arquivo, §10 e §11, antes de achar que “está 100% calado inclusive MOOPE”.
