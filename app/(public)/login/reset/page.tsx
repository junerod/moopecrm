import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export const metadata = { title: "Nova senha" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ primeiro?: string }>;
}) {
  const { primeiro } = await searchParams;
  const inicial = primeiro === "1";
  return (
    <div className="space-y-6">
      <div className="space-y-1.5 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          {inicial ? "Troque a senha inicial" : "Definir nova senha"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {inicial
            ? "A senha 12345678 vale só para o primeiro acesso. Escolha outra com pelo menos 8 caracteres."
            : "Escolha uma nova senha para sua conta"}
        </p>
      </div>
      <ResetPasswordForm />
    </div>
  );
}
