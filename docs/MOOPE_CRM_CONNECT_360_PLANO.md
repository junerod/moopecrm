# MOOPE Connect 360 — plano de ação

**Estado:** F0–F4 fechadas no código e no ar.  
**Produção:** `https://crm.facejus.com.br/` · SHA `58a7bcf1` · 2026-09-15  
**Régua:** um cliente, uma conversa, uma origem, um próximo passo. Número só com dado real.

Este arquivo é o plano **depois** de executado. O canvas no Cursor espelha o mesmo estado. Ilustrações de mix Instagram (Reel/Story) continuam destino — não medição.

## O que isto não é

Não é redesign de menu, Pack V2, RAG novo, MCP novo, nem dashboard com número inventado. Agência com vários clientes num login só não existe: cada empresa é um tenant. O MKT trabalha dentro da empresa, ou opera a instalação dela.

## Quem usa

| Papel | Pergunta | Telas |
|---|---|---|
| Atendente | Quem espera? Qual o próximo passo desta conversa? | Inbox, Contato, Agenda |
| Comercial | Onde está o negócio e o que falta para fechar? | Funil, Inbox, Contato 360 |
| Dono / gestor | De onde vêm as vendas? Onde se perde? A equipe e a IA dão conta? | Início, Desempenho, Radar, Atrito |
| MKT digital | A campanha trouxe conversa, lead e venda — ou só gasto? | Campanhas, Inbox, origem, resultados |

## O que o MKT consegue hoje

**Já consegue**

- Segmentar, escrever e disparar WhatsApp.
- Ver enviado → resposta → lead → **ganho / perda / R$** e **conversão por envio**.
- Comparar duas campanhas no mesmo recorte.
- Atender a resposta na Inbox normal (não numa caixa paralela).
- Ver origem no Contato / Inbox quando o first-touch gravou.
- Ver, no Início e no Desempenho, de onde vêm as vendas e **por que se perde** (motivo que o humano digitou).
- Ver “conteúdo que vendeu” **só** se o first-touch gravou `ad_title` / `ad_source_id`.

**Ainda não consegue — declarado, sem mentira**

- Publicar ou medir Reel / Post / Story.
- Dizer “este conteúdo vendeu R$ X” sem `ad_title` no first-touch.
- Receber Direct de um `@` comum enquanto o app da Meta está em **desenvolvimento** (só testador).
- Comentário e menção do Instagram (de fora de propósito).

## Cadeia — o que cada elo faz agora

| Elo | Estado em `58a7bcf1` | Fase |
|---|---|---|
| Mensagem existe | Campanha WhatsApp sim. Post Instagram não. | F1 |
| Pessoa responde | WhatsApp na Inbox. Direct entra se a Graph entregar (testador / app publicado). Cron a cada 5 min. | F2 |
| Contato nasce com origem | First-touch: campanha, anúncio Meta, UTM, Instagram (`source=instagram`). Sem título de Reel se a Meta não mandou. | F1, F3 |
| Lead + próximo passo | Existe. Inbox opera. | F0 / F1 |
| Ganho ou perda com motivo | Funil + campanha + Home + Desempenho leem `lost_reason`. | F1, F4 |
| Valor (R$) | Lead tem `value_cents`. Campanha, Home e Desempenho somam ganhos. | F1, F3, F4 |
| Inteligência | Home e Desempenho cruzam origem × desfecho × conversão. Humano × IA no Atrito (não duplicado). | F4 |

## As cinco fases

| Fase | Entrega | Status |
|---|---|---|
| **F0** Achar e continuar | ⌘K, Home, avisos em Assistente / Conhecimento / Automação. Sem esconder Campanhas. | Feita |
| **F1** Origem e campanha WA | Ganho, perda, receita, comparar duas campanhas. | Feita (`2171dab3`) |
| **F2** Inbox Instagram | Selo, janela sem modelo falso, cron `direct-sync`, passo do testador na conexão. | Feita no código (`52d66b1c`). DM ao vivo = Meta. |
| **F3** Conteúdo → receita | Card “Conteúdo que vendeu” some se não há título. Sem Insights inventado. | Feita |
| **F4** Inteligência | Home + campanha + Desempenho: origem, motivo de perda, conversão por envio. | Feita (`4ef061a0`, `58a7bcf1`) |

### Pronto quando — e o veredito

**F0.** Um MKT acha Campanhas e Desempenho sem treino. **Feito.**

**F1.** Abre a campanha e responde: conversas, negócios, ganhos, R$, perdas neste motivo. O dono vê a mesma conta no Início e no Desempenho. **Feito.**

**F2.** DM e WhatsApp no mesmo Inbox. Comentários de fora. **Código feito.** Inbox só enche se a Meta entregar a conversa (testador enquanto o app não está publicado).

**F3.** Qual conteúdo trouxe lead e venda — **só com `ad_title`**. Sem título, o card não aparece. **Feito, honesto.**

**F4.** Cruzar origem × desfecho × conversão sem warehouse novo. **Feito.** Humano × IA permanece no Atrito.

## Onde está no produto

| Peça | Onde |
|---|---|
| Início (gestor) | origem, perdas, conteúdo (se houver), última campanha com conversão |
| Desempenho | origem, conteúdo, “Por que se perde”, Atrito |
| Campanha | ganhos, perdas, receita, conversão por envio, motivos daquela campanha |
| Comparar | enviadas, respostas, negócios, ganhos, conversão, perdas, receita |
| Inbox | selo Instagram, origem no negócio, janela “aguarde o cliente” |
| Canais › Instagram | @, Continuar com Instagram, Buscar, passo do testador |
| Cron | `GET/POST /api/v1/cron/direct-sync` a cada 5 min (scheduler + crontab da VPS) |

## Aberto — não é falha do CRM

1. **App Meta em desenvolvimento.** Só testador manda Direct que chega. Convite → aceite → mandar de novo → Buscar.
2. **Sem Insights / post orgânico.** Não há módulo de alcance, Reel ou story no código. Não inventar.
3. **Comentário e menção.** Fora até o Direct de cliente comum estar estável.

## Regras que continuam

- Não pintar gráfico de conteúdo sem `ad_title`.
- Provider de canal só em `lib/channels/` (`pnpm lint:channels`).
- Sem warehouse, sem schema de Social Analytics antes do canal entregar o id do conteúdo.
- Packs, RAG e MCP novos não reabrem este plano — voltam ao planejamento de operação.

## Próximo ciclo

Voltar ao planejamento (packs, modelos prontos, operação). Connect 360, no que era possível sem a Meta publicar o app, está entregue.
