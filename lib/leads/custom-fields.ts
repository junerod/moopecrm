/**
 * Valida custom_fields contra o schema declarativo do funil.
 * Keys desconhecidas são ignoradas — o tenant não inventa coluna.
 */
import { customFieldSchema } from "@/lib/schemas/settings";

export type CampoCustomizado = ReturnType<typeof customFieldSchema.parse>;

export function camposDoPipeline(settings: unknown): CampoCustomizado[] {
  if (!settings || typeof settings !== "object") return [];
  const fields = (settings as { fields?: unknown }).fields;
  if (!Array.isArray(fields)) return [];
  const ok: CampoCustomizado[] = [];
  for (const raw of fields) {
    const parsed = customFieldSchema.safeParse(raw);
    if (parsed.success) ok.push(parsed.data);
  }
  return ok;
}

export type ResultadoDosCustomFields =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; message: string };

export function filtrarCustomFieldsDoPipeline(
  settings: unknown,
  incoming: Record<string, unknown> | null | undefined,
): ResultadoDosCustomFields {
  const schema = camposDoPipeline(settings);
  const porKey = new Map(schema.map((f) => [f.key, f]));
  const saida: Record<string, unknown> = {};
  if (!incoming || typeof incoming !== "object") return { ok: true, value: saida };

  for (const [key, valor] of Object.entries(incoming)) {
    const campo = porKey.get(key);
    if (!campo) continue;
    const conferido = conferirValor(campo, valor);
    if (!conferido.ok) return conferido;
    if (conferido.value !== undefined) saida[key] = conferido.value;
  }
  return { ok: true, value: saida };
}

function conferirValor(
  campo: CampoCustomizado,
  valor: unknown,
): { ok: true; value: unknown } | { ok: false; message: string } {
  if (valor === null || valor === undefined || valor === "") {
    return { ok: true, value: undefined };
  }
  switch (campo.type) {
    case "number":
      if (typeof valor !== "number" || Number.isNaN(valor)) {
        return { ok: false, message: `Campo «${campo.label}» precisa ser número.` };
      }
      return { ok: true, value: valor };
    case "boolean":
      if (typeof valor !== "boolean") {
        return { ok: false, message: `Campo «${campo.label}» precisa ser sim ou não.` };
      }
      return { ok: true, value: valor };
    case "multiselect":
      if (!Array.isArray(valor) || valor.some((v) => typeof v !== "string")) {
        return { ok: false, message: `Campo «${campo.label}» precisa ser uma lista.` };
      }
      return { ok: true, value: valor };
    case "select": {
      if (typeof valor !== "string") {
        return { ok: false, message: `Campo «${campo.label}» é inválido.` };
      }
      const opcoes = new Set((campo.options ?? []).map((o) => o.value));
      if (opcoes.size > 0 && !opcoes.has(valor)) {
        return { ok: false, message: `Campo «${campo.label}» tem uma opção desconhecida.` };
      }
      return { ok: true, value: valor };
    }
    default:
      if (typeof valor !== "string") {
        return { ok: false, message: `Campo «${campo.label}» precisa ser texto.` };
      }
      return { ok: true, value: valor };
  }
}
