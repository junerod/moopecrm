/**
 * GET /api/v1/integrations/moope/entrar?t=
 *
 * Troca o token de 90s por sessão. Não cria usuário.
 * Sucesso devolve HTML neste domínio (não 302) — ver continuar-launch.ts.
 */
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { env } from "@/lib/env";
import { emailEMembro } from "@/lib/moope/auth";
import { htmlParaContinuarLaunch } from "@/lib/moope/continuar-launch";
import { verificarLaunch } from "@/lib/moope/launch";
import { createAdminClient } from "@/lib/supabase/admin";
import { cookieSecure } from "@/lib/supabase/cookie-secure";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function ir(path: string): NextResponse {
  return NextResponse.redirect(new URL(path, env.NEXT_PUBLIC_APP_URL));
}

export async function GET(req: NextRequest): Promise<Response> {
  const token = req.nextUrl.searchParams.get("t");
  const payload = verificarLaunch(token, env.INTERNAL_SECRET);
  if (!payload) return ir("/login?error=link_invalido");

  const admin = createAdminClient();
  const membro = await emailEMembro(admin, payload.orgId, payload.email);
  if (!membro) return ir("/login?error=link_invalido");

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: membro.email,
  });
  const hashed = data?.properties?.hashed_token;
  if (error || !hashed) return ir("/login?error=link_invalido");

  const supabase = await createClient();
  const { error: otpErr } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: hashed,
  });
  if (otpErr) return ir("/login?error=link_invalido");

  const jar = await cookies();
  jar.set("active_org", payload.orgId, {
    httpOnly: true,
    sameSite: "strict",
    secure: cookieSecure(),
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return new NextResponse(htmlParaContinuarLaunch(payload.path), {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
