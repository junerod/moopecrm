"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SEM_NOME } from "@/lib/contacts/rotulo-do-contato";
import { useUpdateContact } from "@/hooks/contacts/useUpdateContact";
import { PencilSimple } from "@/lib/ui/icons";

/**
 * No Inbox a pessoa aparece como "Sem nome" quando o WhatsApp não mandou
 * nome nem telefone (@lid). Sem este gesto, o único caminho era ir em
 * Contatos — e o dialog de lá gravava `name`, que a lista do Inbox lê
 * depois de `display_name`.
 */
export function CadastrarNomeDoContato({
  contactId,
  rotuloAtual,
}: {
  contactId: string;
  rotuloAtual: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const update = useUpdateContact(contactId);
  const semNome = rotuloAtual === SEM_NOME;

  function abrir() {
    setNome(semNome ? "" : rotuloAtual);
    setAberto(true);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const v = nome.trim();
    if (v.length < 1) return;
    try {
      await update.mutateAsync({ display_name: v, name: v });
      toast.success("Nome salvo. A lista do Inbox atualiza em seguida.");
      setAberto(false);
    } catch {
      // o hook já mostrou o erro
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="h-7 px-2 text-xs"
        onClick={abrir}
      >
        <PencilSimple size={12} className="mr-1" weight="regular" aria-hidden />
        {semNome ? "Cadastrar nome" : "Trocar nome"}
      </Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{semNome ? "Cadastrar nome" : "Trocar nome"}</DialogTitle>
            <DialogDescription>
              É o nome que aparece na lista do Inbox e no quadro. O WhatsApp
              às vezes não manda o nome — aí você coloca.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={salvar} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="inbox-nome-contato">Nome</Label>
              <Input
                id="inbox-nome-contato"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                maxLength={200}
                autoFocus
                placeholder="Como você chama esta pessoa"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setAberto(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={update.isPending || nome.trim().length < 1}>
                {update.isPending ? "Salvando…" : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
