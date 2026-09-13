/**
 * Nome de arquivo só para exibir. O path no Storage NUNCA usa isto —
 * lá o caminho é `{orgId}/{uuid}.{ext}`.
 */
export function sanitizarNomeDoArquivo(raw: string | null | undefined): string {
  const base = String(raw ?? "")
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    ?.trim() ?? "";
  const limpo = base
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[^\w.\- ()áéíóúàãõâêôçÁÉÍÓÚÀÃÕÂÊÔÇ]/g, "_")
    .slice(0, 180)
    .trim();
  return limpo.length > 0 ? limpo : "arquivo";
}
