import type { createClient } from "@/lib/supabase/server";
import { safeNext } from "./safe-next";

const ENTRADA_DO_APP = new Set(["/app", "/app/", "/app/inbox", "/app/inicio"]);

/**
 * Para onde o login manda a pessoa.
 *
 * Admin da instalação sem empresa própria vai para `/admin`. Se o `next` for
 * a entrada do app (inbox/início), também — senão ele abre o CRM vazio e
 * acha que a instalação quebrou. Deep link para uma tela de plataforma
 * (`/app/settings/atualizacao`) continua valendo.
 */
export function destinoAposLogin(opts: {
  next?: string | null;
  isPlatformAdmin: boolean;
  temOrganizacao: boolean;
}): string {
  const padrao =
    opts.isPlatformAdmin && !opts.temOrganizacao
      ? "/admin/dashboard"
      : "/app/inbox";
  const pedido = safeNext(opts.next, padrao);
  if (
    opts.isPlatformAdmin &&
    !opts.temOrganizacao &&
    (ENTRADA_DO_APP.has(pedido) || pedido.startsWith("/app/inbox?"))
  ) {
    return "/admin/dashboard";
  }
  return pedido;
}

/** Lê papel + membership e devolve o destino. Query falhou → inbox (fail open). */
export async function destinoAposSessao(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  next?: string | null,
): Promise<string> {
  let isPlatformAdmin = false;
  let temOrganizacao = true;
  try {
    const { data: pa, error: paErr } = await supabase
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", userId)
      .is("revoked_at", null)
      .maybeSingle();
    const { data: memb, error: membErr } = await supabase
      .from("user_organizations")
      .select("organization_id")
      .eq("user_id", userId)
      .is("revoked_at", null)
      .limit(1);
    if (!paErr && !membErr) {
      isPlatformAdmin = !!pa;
      temOrganizacao = (memb?.length ?? 0) > 0;
    }
  } catch {
    // Fail open: destino padrão do app. Uma query caída não pode
    // prender o login nem inventar que a pessoa é admin sem empresa.
  }
  return destinoAposLogin({ next, isPlatformAdmin, temOrganizacao });
}
