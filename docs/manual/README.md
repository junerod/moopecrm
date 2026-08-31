# Manual do operador — MOOPE CRM

**A cara para quem usa o sistema é a tela** `/app/manual` — manual de
usuário, “Como usar”. Porta: Configurações › Como usar, busca ⌘K, ou o
botão do Inbox vazio. O texto que a tela mostra vive em `lib/manual/conteudo.ts`.

Este diretório é o rascunho para quem clona o repo. Se os dois divergirem, **a
tela vence**.

| Se você quer… | Vá para |
|---|---|
| Usar o produto | no app: `/app/manual` |
| Ler o mesmo roteiro em Markdown | [`passo-a-passo.md`](passo-a-passo.md) |
| Achar uma tela pelo nome | [Mapa do sistema](#mapa-do-sistema) abaixo |
| Instalar ou atualizar a VPS | [`docs/SETUP.md`](../SETUP.md), [`docs/runbooks/deploy.md`](../runbooks/deploy.md) |
| Entender o que o código promete | [`CLAUDE.md`](../../CLAUDE.md) e [`docs/index.md`](../index.md) |

**Público.** Dono da organização, gerente e atendente. Super-admin da plataforma tem um bloco à parte no passo a passo.

**Marca na tela.** O produto se apresenta como **MOOPE CRM**. Os nomes abaixo são os da interface (`lib/navigation/registry.ts`), não os nomes internos do banco.

---

## O que já existia neste repositório (e o que não)

Não havia um manual de uso. O que o disco já tinha, e para quem:

| O que é | Para quem | Por que não substitui isto |
|---|---|---|
| `README.md`, `VISION.md`, `ARCHITECTURE.md` | quem clona o código | falam do produto, não ensinam a operar a tela |
| `docs/prd/`, `docs/specs/` | quem modela e implementa | contrato técnico; vocabulário de engenharia |
| `docs/SETUP.md`, `docs/deploy-*`, `docs/runbooks/` | quem instala a VPS | sobe o servidor; não ensina Inbox, agente ou funil |
| `docs/testing/user-journey-map.md` | quem testa | lista casos de QA, não um roteiro de trabalho |
| `docs/design-system/screen-flow/02-journeys.md` | design | jornadas de 2026-04; várias telas e papéis já mudaram (BPO, Nuvemshop obrigatória, MFA forçado) |
| `docs/doctrine/sistema-vivo/` | quem escreve código | lei de arquitetura, não manual do operador |

Este diretório existe para não misturar os dois públicos.

Afirmações de tela abaixo estão **CONFIRMADAS** contra o registro de navegação e os rótulos das páginas citadas. Onde o motor tem limite honesto, o limite está escrito — não é omissão.

---

## Como o sistema se organiza

Há **duas portas**:

1. **`/app`** — a organização (locadora, escritório, mesa de vendas). É o dia a dia.
2. **`/admin`** — a plataforma. Só quem é super-admin. Cria tenants, não atende cliente.

Dentro de `/app`, o menu tem seis grupos, nesta ordem de uso:

| Grupo | O que é | Uso |
|---|---|---|
| **Atendimento** | Inbox, Radar, Agenda, Respostas rápidas | o dia |
| **CRM** | Funis, Contatos, Etapas do funil | o quadro de clientes |
| **Agente de IA** | Agentes, Follow-ups, Roteadores, e o resto no hub | montar e acompanhar o funcionário automático |
| **Canais** | Conexões (WhatsApp), Integração MOOPE, Webhooks | por onde a mensagem entra e sai |
| **Análise** | Desempenho, Evolução da IA, Audit Log | olhar o que aconteceu |
| **Organização** | Configurações (rodapé do menu) | conta, empresa, equipe, perfil do negócio |

Telas que não cabem no menu lateral estão no hub do grupo (**Ver tudo em IA**, **Configurações**) e na busca **⌘K** (ou Ctrl+K).

---

## Papéis dentro da organização

Quatro papéis, do menor para o maior: **visualizador** < **atendente** < **gerente** < **administrador**.

O menu esconde o que o papel não alcança. Em linhas gerais:

| Quem | Consegue |
|---|---|
| Visualizador | ver Inbox, Funis, Contatos, Desempenho |
| Atendente | o de cima + atender, assumir conversa, ver Casos da IA |
| Gerente | o de cima + Follow-ups, Roteadores, Credenciais, Conhecimento, Etapas do funil, Distribuição |
| Administrador | o de cima + **criar agente**, Conexões WhatsApp, Perfil do negócio, Equipe, LGPD, API Tokens |

Quem é super-admin da plataforma vê as duas portas (`/admin` e `/app`).

---

## Mapa do sistema

### Atendimento

| Tela | Caminho | O que faz |
|---|---|---|
| Inbox | Atendimento › Inbox | conversas de WhatsApp; humano e IA lado a lado |
| Radar | Atendimento › Radar | conversas abertas que esfriaram |
| Agenda | Atendimento › Agenda | o que está marcado, com quem, quem atende |
| Respostas rápidas | Atendimento › Respostas rápidas | textos prontos no composer (`/` no Inbox) |

### CRM

| Tela | Caminho | O que faz |
|---|---|---|
| Funis | CRM › Funis | lista dos funis; clique abre o **quadro** (colunas de clientes) |
| Contatos | CRM › Contatos | pessoas do outro lado; histórico do aparelho e importação pontual |
| Etapas do funil | CRM › Etapas do funil | nomes das colunas, vocabulário, motivos de perda |

Não use “Kanban” nem “pipeline” com o operador: a URL ainda é `/app/kanban`, o nome na tela é **Funis**.

### Agente de IA

O sidebar mostra Agentes, Follow-ups e Roteadores. O resto vive em **Ver tudo em IA**.

**Montar**

| Tela | O que faz |
|---|---|
| Agentes | quem atende: instruções, modelo, número, publicação |
| Follow-ups | fluxos automáticos (silêncio, etapa, pedido de ajuda) |
| Roteadores | qual agente pega qual conversa, e quando o humano assume |
| Credenciais | chave do provedor (Anthropic, OpenAI, OpenRouter, …) |
| Provedores | qual inteligência atende cada parte do sistema |

**Ensinar**

| Tela | O que faz |
|---|---|
| Conhecimento | PDFs e textos que o agente consulta (RAG) |
| Memória | o que ele já aprendeu da operação |
| Skills | ações que ele pode executar sozinho |

**Acompanhar**

| Tela | O que faz |
|---|---|
| Casos | atendimentos que o agente conduziu |
| Alertas | o que a IA encontrou e precisa de decisão |
| Propostas | melhorias que ela sugere para si mesma |
| Execuções | o que a IA fez, e o que falhou |
| Uso e orçamento | gasto do mês e teto |

### Canais

| Tela | O que faz |
|---|---|
| Conexões | WhatsApp por QR ou canal oficial da Meta |
| Integração MOOPE | chave e eventos para a frota ou o Facejus abrirem o CRM |
| Webhooks | avisar outro sistema quando algo acontece aqui |

### Análise

| Tela | O que faz |
|---|---|
| Desempenho | funil e performance por atendente (30 dias) |
| Evolução da IA | onde o agente erra e o que falta ensinar |
| Audit Log | quem fez o quê, quando — não se apaga |

### Organização (Configurações)

| Seção | Telas |
|---|---|
| Sua conta | Perfil, Segurança, Notificações |
| Sua empresa | Equipe, Distribuição de atendimento, Organização, Perfil do negócio, Tipos de agendamento, Marca, Billing |
| Dados e acesso | LGPD, API Tokens |

**Perfil do negócio** troca o quadro padrão sem apagar funil que já tem card. Pacotes prontos: clínica, imobiliária, serviços, advocacia (Novos clientes + Processos), curso, locadora (Locatários + Cobrança), venda do sistema (SaaS), loja, outro.

### Plataforma (`/admin`)

Fora do menu do tenant. Porta em `/admin`. Cria organizações (tenants), vê saúde da instalação. Não é o Inbox do cliente.

---

## O caminho mínimo até o sistema “vivo”

Nada atende sozinho só porque a conta existe. A cadeia é esta:

```
login → wizard (se a org é nova)
  → WhatsApp conectado (Conexões, estado WORKING)
  → chave de IA válida (instalação ou Credenciais)
  → agente CRIADO e PUBLICADO, no número certo
  → funil com etapas que o agente entende
  → (opcional) fluxo de Follow-up publicado e ligado ao agente
  → mensagem NOVA no WhatsApp (webhook ao vivo)
```

Três limites que o operador precisa saber de antemão:

1. **Rascunho não atende.** Agente ou fluxo só valem depois de **Publicar**.
2. **Histórico do aparelho não aciona a IA.** Contatos e fios recentes entram no CRM; o agente não “responde o passado”. A automação vive da mensagem que chega agora.
3. **Follow-up não é instantâneo.** O disparo depende de crons de cerca de um minuto. A tela promete “poucos minutos”, não “na hora”.

O detalhe de cada passo está em [`passo-a-passo.md`](passo-a-passo.md).
