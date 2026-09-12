import { renderTemplate } from "@/lib/automation/template";
import { VARIAVEIS_CONHECIDAS } from "@/lib/campanhas/tipos";

const VAR_RE = /\{\{\s*([\w.]+)\s*\}\}/g;

export interface ResultadoDoPreview {
  ok: boolean;
  texto: string;
  variaveis: string[];
  faltando: string[];
  desconhecidas: string[];
}

export function extrairVariaveis(template: string): string[] {
  const achadas = new Set<string>();
  for (const m of template.matchAll(VAR_RE)) {
    if (m[1]) achadas.add(m[1]);
  }
  return [...achadas];
}

export function previewDaCampanha(input: {
  template: string;
  valores: Record<string, string | null | undefined>;
}): ResultadoDoPreview {
  const variaveis = extrairVariaveis(input.template);
  const conhecidas = new Set<string>(VARIAVEIS_CONHECIDAS);
  const desconhecidas = variaveis.filter((v) => !conhecidas.has(v) && !v.includes("."));
  const faltando = variaveis.filter((v) => {
    const valor = input.valores[v];
    return valor == null || String(valor).trim() === "";
  });
  const contexto = {
    contact: {
      name: input.valores.nome ?? "",
      phone_number: input.valores.telefone ?? "",
      email: input.valores.email ?? "",
    },
    nome: input.valores.nome ?? "",
    telefone: input.valores.telefone ?? "",
    email: input.valores.email ?? "",
  };
  const texto = renderTemplate(input.template, contexto);
  return {
    ok: desconhecidas.length === 0 && faltando.length === 0,
    texto,
    variaveis,
    faltando,
    desconhecidas,
  };
}
