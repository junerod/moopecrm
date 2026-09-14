import { readFile } from "node:fs/promises";
import path from "node:path";

import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { fail, ok } from "@/lib/api/wrappers";
import type { RelatorioSelfTest } from "@/lib/self-test/tipos";

export const dynamic = "force-dynamic";

/** Só lê o último relatório. Um clique aqui NÃO dispara canal externo. */
export async function GET() {
  try {
    await requirePlatformAdmin();
  } catch {
    return fail("forbidden", "Não autorizado.", 403);
  }

  try {
    const bruto = await readFile(path.join(process.cwd(), "docs", "self-test", "latest.json"), "utf8");
    const data = JSON.parse(bruto) as RelatorioSelfTest;
    return ok({
      ...data,
      disparo_externo: false,
      aviso: "Este endpoint só lê o relatório. Não dispara WhatsApp nem e-mail.",
    });
  } catch {
    return ok({
      gerado_em: null,
      total: null,
      disparo_externo: false,
      aviso: "Nenhum autoteste nesta instalação. Rode `pnpm product:self-test`.",
    });
  }
}
