#!/usr/bin/env tsx
/**
 * pnpm product:self-test
 *
 * Robô cliente: certifica packs, bridge (mock) e isolamento.
 * Default: MOCK / sem canal externo.
 * SELF_TEST_EXTERNAL_CHANNELS=true é recusado aqui de propósito.
 */
import { spawnSync } from "node:child_process";

import { executarProductSelfTest } from "@/lib/self-test/rodar";

async function main() {
  if (process.env.SELF_TEST_EXTERNAL_CHANNELS === "true") {
    console.error("SELF_TEST_EXTERNAL_CHANNELS=true não entra no self-test padrão.");
    process.exit(2);
  }
  process.env.CAMPAIGN_DISPATCH_ADAPTER = process.env.CAMPAIGN_DISPATCH_ADAPTER || "mock";

  const unit = spawnSync(
    "pnpm",
    [
      "exec",
      "vitest",
      "run",
      "tests/unit/business-pack-locadora.test.ts",
      "tests/unit/business-pack-advocacia.test.ts",
      "tests/unit/bridge-gestao.test.ts",
      "tests/unit/product-self-test.test.ts",
    ],
    { stdio: "inherit" },
  );
  if (unit.status !== 0) {
    process.exit(unit.status ?? 1);
  }

  let admin: Parameters<typeof executarProductSelfTest>[0] extends { admin?: infer A } ? A : undefined;
  try {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const { createClient } = await import("@supabase/supabase-js");
      admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false } },
      ) as never;
    }
  } catch {
    admin = undefined;
  }

  const relatorio = await executarProductSelfTest({
    aoVivo: Boolean(admin),
    admin: admin as never,
  });

  console.log(`\nSELF TEST FINAL: ${relatorio.total}`);
  console.log("Relatório: docs/self-test/latest.md");
  if (relatorio.total === "FAIL") process.exit(1);
}

void main();
