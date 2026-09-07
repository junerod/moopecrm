import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { FollowupForm } from "./_form";

export const dynamic = "force-dynamic";

export default async function FollowupPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/login");

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight text-white">
          Lembrar quem parou de responder?
        </h2>
        <p className="text-sm leading-relaxed text-zinc-400">
          Se a pessoa ficar um dia sem responder, o sistema pode mandar um lembrete
          simples. Não envia sequência agressiva e respeita quem pediu para parar.
        </p>
      </header>
      <FollowupForm />
    </div>
  );
}
