/**
 * A marca no cabeçalho do wizard — o mesmo lugar da barra do menu.
 * Não fica no canto inferior: aquilo parecia selo de site, não produto.
 */
export function MarcaNoCabecalho({ logoUrl, nome }: { logoUrl: string | null; nome: string }) {
  if (!logoUrl) {
    return <p className="text-xs uppercase tracking-wider text-accent">{nome}</p>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logoUrl}
      alt={nome}
      className="h-9 w-auto max-w-[12rem] object-contain"
    />
  );
}
