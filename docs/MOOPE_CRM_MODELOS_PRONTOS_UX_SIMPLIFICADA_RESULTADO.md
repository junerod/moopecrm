# Modelos prontos — UX simplificada

## Por que a página antiga confundia

A mesma rota misturava loja, configuração e operação: modelo ativo, catálogo, checklist, seis assistentes, funil desenhado, automações em pills, respostas, campanhas, pastas de Knowledge, capabilities e test-drive. Quem abria não sabia se estava escolhendo, configurando ou testando IA.

## Componentes removidos da loja

De `/app/modelos-prontos` saíram: lista de assistentes, Kanban completo, pills de automação, pastas de material, “o que eles já sabem consultar”, test-drive, checklist completo e o mural “outros modelos” no fim de uma tela de configuração.

## Nova arquitetura

| Conceito | Rota | Função |
|---|---|---|
| Loja | `/app/modelos-prontos` | Escolher o tipo da empresa |
| Detalhe | `/app/modelos-prontos/[packId]` | Ver o resumo antes de instalar |
| Meu modelo | `/app/meu-modelo` | Terminar a configuração do pack ativo |
| Operação | Assistentes, Funil, Knowledge, Automações, Campanhas | Trabalho do dia a dia |

Meu Negócio (`/app/settings/business`) continua sendo ficha da empresa. Não ganhou item extra no sidebar: a porta de Meu modelo é o banner da loja, o ⌘K e o hub de Organização — um item a mais estoura a dobra do menu.

## Loja

Header: “Escolha o tipo de operação da sua empresa.”  
Se há pack ativo: banner compacto (nome, 2 de 4, Continuar configuração, Ver assistentes).  
Abaixo: seis cards (ícone, nome, frase curta, ATIVO / Ativar / Ver modelo). Sem detalhe inline.

## Detalhe

Contagens (assistentes, funil, pastas, automações, respostas, campanhas).  
CTA: Ativar modelo.  
Accordion “Ver tudo que será instalado” (equipe, funil, automações desligadas).

## Modelo ativo

`/app/meu-modelo`: título + ATIVO, checklist existente, seis cards operacionais (quantidade + CTA). Link discreto “Trocar modelo”. Rodapé “Mais opções”: reaplicar e desativar.

## Checklist

`ChecklistPosAtivacao` sem lógica nova. Mora no hub. A loja só mostra o progresso no banner.

## Operação

Os cards do hub apontam para as telas que já existem. Não listam o conteúdo.

## Test-drive

Saiu da loja. Vive em Assistentes (`TestDriveDoPack`), com os mesmos testids dos e2e antigos.

## Mobile

Catálogo em uma coluna. Banner e checklist empilhados. Cards do hub em uma coluna.

## Testes

- Unit: navegação (Meu modelo no hub), cobertura e2e, invariante do quadro no detalhe, packs SaaS/clínicas sem texto de locadora.
- E2E: specs antigas apontam test-drive para Assistentes e reaplicar/desativar para Meu modelo.
- Nova: `tests/e2e/modelos-prontos-ux.spec.ts` (sem pack / pack ativo / mobile).

## Arquivos

`app/app/modelos-prontos/` (loja + `[packId]`), `app/app/meu-modelo/`, `components/negocio/{acoes-do-pack,TestDriveDoPack,ModeloDoNegocio,ChecklistPosAtivacao}.tsx`, `lib/business-packs/visual.ts`, `lib/navigation/registry.ts`, specs e `.github/workflows/e2e.yml`.

## Migration

Nenhuma. Só apresentação. As APIs `POST/PATCH /api/v1/business-packs` e o instalador não mudaram.

## Blockers

E2E da spec nova e das specs de pack não rodaram nesta máquina (harness Playwright + banco de jornada). Typecheck e unit relevantes passaram.

## Commit / push

Commit local no ritual de publicação. Push entra só no passo da VPS.

---

## Veredito

MOOPE CRM — MODELOS PRONTOS UX SIMPLIFICADA: **SIM**

| Critério | |
|---|---|
| LOJA MOSTRA SOMENTE CATÁLOGO | SIM |
| PACK ATIVO TEM HUB PRÓPRIO | SIM (`/app/meu-modelo`) |
| CHECKLIST CLARO | SIM |
| ASSISTENTES NÃO SÃO LISTADOS INTEIROS NA LOJA | SIM |
| FUNIL NÃO É DESENHADO INTEIRO NA LOJA | SIM |
| AUTOMAÇÕES NÃO POLUEM A LOJA | SIM |
| KNOWLEDGE NÃO POLUI A LOJA | SIM |
| TEST-DRIVE FORA DA LOJA | SIM (Assistentes) |
| TROCAR MODELO CLARO | SIM |
| DESATIVAR É AÇÃO SECUNDÁRIA | SIM (rodapé Mais opções) |
| DESKTOP LIGHT | não medido na tela (sem sessão no browser desta sessão) |
| DESKTOP DARK | não medido |
| MOBILE | coberto no e2e (não executado aqui) |
| TYPECHECK | verde |
| TEST:DB | não rodado — sem mudança de schema |
| E2E | spec escrita, não executada aqui |
| MIGRATION | nenhuma |
| BLOCKERS | e2e local sem harness |
| PRONTO PARA TESTE MANUAL | SIM |
| COMMIT LOCAL | no passo seguinte |
| PUSH | no passo da VPS |
