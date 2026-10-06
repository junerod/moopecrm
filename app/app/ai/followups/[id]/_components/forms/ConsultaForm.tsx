"use client";

import {
  consultaConfigSchema,
  FONTES_DE_CONSULTA,
  ROTULO_DA_FONTE,
  type FonteDeConsulta,
} from "@/lib/followup/graph-schema";

import type { ConfigOf } from "./shared";

export function ConsultaForm({
  config,
  onChange,
}: {
  config: ConfigOf<"consulta">;
  onChange: (c: ConfigOf<"consulta">) => void;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">O que consultar na gestão</legend>
      <p className="text-xs text-text-muted">
        A resposta usa só o que a Moope devolver. Sem conexão, sem cadastro ou sem
        o dado, o fluxo segue por «Não encontrou» — ligue esse ramo a uma pessoa
        ou ao assistente. A conexão fica em Integrações.
      </p>
      {FONTES_DE_CONSULTA.map((fonte) => (
        <label key={fonte} className="flex cursor-pointer items-start gap-2 text-sm">
          <input
            type="radio"
            name="consulta-fonte"
            className="mt-1"
            checked={config.fonte === fonte}
            data-testid={`consulta-fonte-${fonte}`}
            onChange={() => {
              const parsed = consultaConfigSchema.safeParse({ fonte });
              if (parsed.success) onChange(parsed.data);
            }}
          />
          <span>
            <span className="font-medium">{ROTULO_DA_FONTE[fonte]}</span>
            <span className="mt-0.5 block text-xs text-text-muted">{explica(fonte)}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

function explica(fonte: FonteDeConsulta): string {
  switch (fonte) {
    case "cliente":
      return "Confere se o telefone desta conversa já é cliente. Nome e status do contrato, se vierem.";
    case "oferta":
      return "Lista veículos e o preço que a página de ofertas tiver. Sem valor, não inventa.";
    case "financeiro":
      return "Parcelas e atraso. O link de boleto entra se a gestão já tiver gerado.";
    case "situacao":
      return "Veículo, placa, contrato e o boleto do cadastro deste telefone.";
    case "boleto":
      return "Só a segunda via: boleto ou PIX com link https. Sem link, segue por Não encontrou.";
    case "investidor":
      return "Confere se este telefone é investidor. Nome, último período e portal, se vierem.";
  }
}
