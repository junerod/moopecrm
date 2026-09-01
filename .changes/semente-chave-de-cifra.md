---
impacto: nada_mudou
secao: corrigido
titulo: Criar conexão deixa de falhar sem a chave de cifra no banco
---

O `.env` com a chave de cifra não entrava sozinho no Postgres. Criar
conexão MOOPE (e o resto que guarda segredo) devolvia erro. Na primeira
gravação o CRM semeia a chave que já está no ambiente, se o banco ainda
não tiver uma.
