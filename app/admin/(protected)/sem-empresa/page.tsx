import { SaidaDaPlataforma } from "@/components/admin/SaidaDaPlataforma";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sem empresa neste login" };

export default function SemEmpresaPage() {
  return (
    <div className="mx-auto max-w-lg space-y-4" data-testid="admin-sem-empresa">
      <h1 className="text-2xl font-semibold tracking-tight">Este login não tem empresa</h1>
      <p className="text-sm text-muted-foreground">
        O modo plataforma não é o CRM do dia a dia. Sem uma organização neste
        usuário, não há Inbox pessoal para abrir — e voltar ao dashboard
        deixaria você preso. Saia da conta ou continue na plataforma.
      </p>
      <SaidaDaPlataforma />
    </div>
  );
}
