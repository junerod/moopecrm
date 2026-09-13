---
impacto: capacidade_nova
secao: alterado
titulo: O .env do Finance (R2 e mailserver) passa a valer no CRM
---

Quem já tinha `STORAGE_DRIVER=r2`, `R2_BUCKET` e `MAILSERVER_FROM` no estilo
do Finance não precisava renomear nada: o CRM agora lê esses nomes e usa o
R2 do Knowledge e o mailserver. Os nomes canônicos
(`KNOWLEDGE_STORAGE_PROVIDER`, `R2_BUCKET_KNOWLEDGE`, `MAILSERVER_FROM_EMAIL`)
continuam válidos.
