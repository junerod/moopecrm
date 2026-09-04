import { cn } from "@/lib/utils";

/** O cartão do wizard — um jeito só, para as telas não divergirem. */
export function Cartao({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "space-y-5 rounded-2xl border border-white/10 bg-zinc-900/70 p-6 shadow-xl shadow-black/30",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CabecalhoDoPasso({
  titulo,
  subtitulo,
}: {
  titulo: string;
  subtitulo: string;
}) {
  return (
    <header className="space-y-2">
      <h2 className="text-2xl font-semibold tracking-tight text-white">{titulo}</h2>
      <p className="text-sm leading-relaxed text-zinc-400">{subtitulo}</p>
    </header>
  );
}
