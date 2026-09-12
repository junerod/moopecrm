"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { aplicarPerfilAction } from "@/app/actions/settings/aplicarPerfil";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { catalogoParaWizard, resolverDefinition, ROTULOS_SUBTYPE_LOCACAO } from "@/lib/ready-models/catalogo";
import { LOCACAO_SUBTYPES, type LocacaoSubtype, type ReadyModelId } from "@/lib/ready-models/tipos";

export function PerfilDoNegocioForm({
  atual,
  subtypeAtual,
  funisExistentes = [],
}: {
  atual: string | null;
  subtypeAtual?: string | null;
  funisExistentes?: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [escolhido, setEscolhido] = useState<ReadyModelId | null>(
    catalogoParaWizard().some((c) => c.id === atual) ? (atual as ReadyModelId) : null,
  );
  const [subtype, setSubtype] = useState<LocacaoSubtype | null>(
    subtypeAtual && (LOCACAO_SUBTYPES as readonly string[]).includes(subtypeAtual)
      ? (subtypeAtual as LocacaoSubtype)
      : null,
  );
  const [confirmar, setConfirmar] = useState(false);
  const [isPending, startTransition] = useTransition();

  const def = escolhido ? resolverDefinition(escolhido, subtype) : null;
  const nomeDoQuadroNovo = def?.pipeline.nome ?? null;
  const funilNovoJaExiste = Boolean(
    nomeDoQuadroNovo && funisExistentes.some((f) => f.name === nomeDoQuadroNovo),
  );
  const trocando = Boolean(escolhido && atual && escolhido !== atual);

  function aplicar() {
    if (!escolhido) return;
    if (trocando && !confirmar) {
      setConfirmar(true);
      return;
    }
    startTransition(async () => {
      const r = await aplicarPerfilAction({
        perfil: escolhido,
        subtype: escolhido === "locacao" ? (subtype ?? undefined) : undefined,
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      const rotulo = catalogoParaWizard().find((c) => c.id === escolhido)?.label ?? escolhido;
      toast.success(
        r.criouQuadroNovo
          ? `Perfil agora é ${rotulo}. O funil novo foi criado; os antigos continuam na lista.`
          : funilNovoJaExiste
            ? `Perfil agora é ${rotulo}. Funil ${nomeDoQuadroNovo} já existia.`
            : `Perfil ligado. O quadro padrão já é este.`,
      );
      setConfirmar(false);
      router.refresh();
      router.push("/app/kanban");
    });
  }

  return (
    <div className="max-w-2xl space-y-4">
      <p className="text-sm text-muted-foreground">
        Trocar não apaga funil com card. O perfil novo vira o quadro padrão;
        o anterior continua na lista de funis.
      </p>
      <div className="grid gap-3">
        {catalogoParaWizard().map((p) => {
          const marcado = escolhido === p.id;
          return (
            <Card
              key={p.id}
              className={marcado ? "border-primary p-4" : "cursor-pointer p-4 hover:border-foreground/20"}
            >
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="radio"
                  name="perfil"
                  value={p.id}
                  checked={marcado}
                  onChange={() => {
                    setEscolhido(p.id);
                    setConfirmar(false);
                  }}
                  className="mt-1"
                />
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="font-medium">{p.label}</span>
                    {atual === p.id ? (
                      <span className="text-xs font-normal text-muted-foreground">em uso</span>
                    ) : null}
                  </span>
                  <span className="mt-1 block text-sm text-muted-foreground">{p.description}</span>
                </span>
              </label>
            </Card>
          );
        })}
      </div>
      {escolhido === "locacao" ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">O que vocês alugam principalmente?</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {LOCACAO_SUBTYPES.map((s) => (
              <label key={s} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="subtype"
                  checked={subtype === s}
                  onChange={() => setSubtype(s)}
                />
                {ROTULOS_SUBTYPE_LOCACAO[s]}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      {confirmar && trocando && def ? (
        <Card className="space-y-2 border-primary/40 p-4" data-testid="confirmar-troca-de-perfil">
          <p className="text-sm font-medium">Seu perfil agora é {def.label}.</p>
          {funisExistentes.length > 0 ? (
            <p className="text-sm text-muted-foreground">
              {funisExistentes.map((f) => `«${f.name}»`).join(", ")}{" "}
              {funisExistentes.length === 1 ? "será mantido" : "serão mantidos"}.
            </p>
          ) : null}
          <p className="text-sm">
            {funilNovoJaExiste
              ? `Funil ${nomeDoQuadroNovo} já existe.`
              : `Vamos criar o funil ${nomeDoQuadroNovo}.`}
          </p>
          <p className="text-xs text-muted-foreground">
            Depois, em Funis, você escolhe onde os novos contatos entram. Nada
            é movido nem apagado.
          </p>
        </Card>
      ) : null}
      <Button onClick={aplicar} disabled={!escolhido || isPending} data-testid="aplicar-perfil">
        {isPending
          ? "Aplicando…"
          : confirmar
            ? funilNovoJaExiste
              ? "Confirmar troca"
              : `Criar funil ${nomeDoQuadroNovo}`
            : "Aplicar perfil"}
      </Button>
    </div>
  );
}
