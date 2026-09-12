"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

import { updateFichaDaEmpresa } from "@/app/actions/settings/updateFichaDaEmpresa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { iniciaisDoNome } from "@/lib/negocio/ficha";
import { fichaDaEmpresaSchema, type EmpresaContato } from "@/lib/schemas/settings";

export function FichaDaEmpresaForm({
  displayName,
  legalName,
  cnpj,
  contato,
  modeloRotulo,
  subtipo,
  podeEditar,
}: {
  displayName: string;
  legalName: string;
  cnpj: string | null;
  contato: EmpresaContato;
  modeloRotulo: string;
  subtipo: string | null;
  podeEditar: boolean;
}) {
  const router = useRouter();
  const [nome, setNome] = useState(displayName);
  const [razao, setRazao] = useState(legalName);
  const [doc, setDoc] = useState(cnpj ?? "");
  const [telefone, setTelefone] = useState(contato.telefone ?? "");
  const [site, setSite] = useState(contato.site ?? "");
  const [endereco, setEndereco] = useState(contato.endereco ?? "");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!podeEditar) return;
    const parsed = fichaDaEmpresaSchema.safeParse({
      display_name: nome.trim(),
      legal_name: razao.trim(),
      cnpj: doc,
      empresa: { telefone, site, endereco },
    });
    if (!parsed.success) {
      const primeiro = parsed.error.issues[0]?.message ?? "Dados inválidos.";
      toast.error(primeiro);
      return;
    }
    startTransition(async () => {
      const r = await updateFichaDaEmpresa(parsed.data);
      if (r.ok) {
        toast.success("Dados da empresa salvos.");
        router.refresh();
      } else if (r.error === "forbidden_role") {
        toast.error("Só quem administra a empresa pode alterar estes dados.");
      } else {
        toast.error("Não foi possível salvar.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <header className="flex items-start gap-4">
        <div
          aria-hidden
          className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-base font-semibold tracking-tight text-primary"
        >
          {iniciaisDoNome(nome || displayName)}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Meu Negócio</h1>
          <p className="text-sm text-muted-foreground">
            Como o cliente e a equipe chamam esta empresa.
          </p>
          <p className="text-xs text-muted-foreground">
            <span data-testid="negocio-tipo">{modeloRotulo}</span>
            {subtipo ? (
              <>
                {" · "}
                <span data-testid="negocio-subtipo">{subtipo}</span>
              </>
            ) : (
              <span data-testid="negocio-subtipo" className="sr-only">
                —
              </span>
            )}
          </p>
        </div>
      </header>

      {!podeEditar ? (
        <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Peça a um admin para alterar o nome e o contato da empresa.
        </p>
      ) : null}

      <section className="space-y-4" data-testid="perfil-do-negocio-resumo">
        <h2 className="text-sm font-semibold">Identidade</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="display_name">Nome do negócio</Label>
            <Input
              id="display_name"
              data-testid="negocio-empresa"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              disabled={!podeEditar}
              required
              maxLength={120}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="legal_name">Razão social</Label>
            <Input
              id="legal_name"
              value={razao}
              onChange={(e) => setRazao(e.target.value)}
              disabled={!podeEditar}
              required
              maxLength={200}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cnpj">CNPJ</Label>
            <Input
              id="cnpj"
              value={doc}
              onChange={(e) => setDoc(e.target.value)}
              disabled={!podeEditar}
              maxLength={20}
              placeholder="00.000.000/0000-00"
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold">Contato</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="telefone">Telefone comercial</Label>
            <Input
              id="telefone"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              disabled={!podeEditar}
              maxLength={40}
              placeholder="(61) 0000-0000"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="site">Site</Label>
            <Input
              id="site"
              type="url"
              value={site}
              onChange={(e) => setSite(e.target.value)}
              disabled={!podeEditar}
              placeholder="https://"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="endereco">Endereço</Label>
            <Textarea
              id="endereco"
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              disabled={!podeEditar}
              maxLength={400}
              rows={3}
              placeholder="Rua, número, bairro, cidade"
            />
          </div>
        </div>
      </section>

      {podeEditar ? (
        <div className="flex sm:justify-end">
          <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
            {isPending ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      ) : null}

      <section className="flex items-center justify-between gap-3 border-t border-border pt-6">
        <div>
          <h2 className="text-sm font-semibold">Tipo de atendimento</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {modeloRotulo}
            {subtipo ? ` · ${subtipo}` : ""}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/app/settings/perfil">Alterar modelo</Link>
        </Button>
      </section>

      <section className="flex items-center justify-between gap-3 border-t border-border pt-6">
        <div>
          <h2 className="text-sm font-semibold">Sua conta</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Senha e nome de quem entra — não são dados da empresa.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/app/settings/profile">Trocar senha</Link>
        </Button>
      </section>
    </form>
  );
}
