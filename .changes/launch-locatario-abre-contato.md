---
impacto: capacidade_nova
secao: adicionado
titulo: Abrir no CRM pelo id do locatário cai no contato certo
---

O menu da locadora manda `/app/contacts/{id do locatário}`. O CRM
procura o contato pelo id que a locadora já gravou; se ainda não
chegou, abre o Inbox em vez de uma página vazia.
