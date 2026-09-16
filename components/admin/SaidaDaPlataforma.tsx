import { signOut } from "@/app/actions/auth/signOut";
import { voltarAoAppPessoal } from "@/app/actions/admin/voltarAoAppPessoal";

type Variante = "banner" | "sidebar" | "pagina";

const CLASSE: Record<Variante, string> = {
  banner: "rounded-md px-2 py-1 text-xs font-medium underline-offset-2 hover:underline",
  sidebar:
    "flex w-full items-center rounded-lg px-2 py-1.5 text-left text-xs text-white/70 hover:bg-white/10 hover:text-white",
  pagina:
    "rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted",
};

/**
 * Portas que o modo plataforma não pode omitir: CRM pessoal e logout.
 * Link para `/app` devolvia o dono ao dashboard — laço.
 */
export function SaidaDaPlataforma({ variante = "pagina" }: { variante?: Variante }) {
  const classe = CLASSE[variante];
  return (
    <div
      className={
        variante === "pagina" ? "flex flex-wrap gap-2" : "flex flex-wrap items-center gap-2"
      }
    >
      <form action={voltarAoAppPessoal}>
        <button type="submit" data-testid="admin-usar-crm" className={classe}>
          Usar o CRM
        </button>
      </form>
      <form action={signOut}>
        <button type="submit" data-testid="admin-sair" className={classe}>
          Sair da conta
        </button>
      </form>
    </div>
  );
}
