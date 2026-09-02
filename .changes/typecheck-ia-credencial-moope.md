---
impacto: nada_mudou
secao: corrigido
titulo: Build de produção volta a passar
---

A rota que recebe a chave de IA da locadora usava um código de auditoria
que o typecheck recusava. Sem isto o `pnpm build` da VPS morria e o
processo seguia com a pasta standalone apagada.
