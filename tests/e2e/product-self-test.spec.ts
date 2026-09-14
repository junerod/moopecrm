/**
 * Product Self-Test — UI mínima do robô cliente.
 * FORA_DO_CI: orquestra certificação local; o comando é `pnpm product:self-test`.
 * Nunca dispara WhatsApp/e-mail externo.
 */
import { randomUUID } from "node:crypto";

import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const svc = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const SENHA = "SelfTestUi!2026#Qa";

test.describe.configure({ timeout: 120_000 });

test("self-test UI não oferece disparo externo", async ({ page }) => {
  expect(process.env.SELF_TEST_EXTERNAL_CHANNELS ?? "false").not.toBe("true");
  const email = `selftest-ui-${randomUUID().slice(0, 8)}@qa.local`;
  const { data: criado } = await svc.auth.admin.createUser({
    email,
    password: SENHA,
    email_confirm: true,
  });
  if (!criado?.user) throw new Error("sem usuário");
  const { data: org } = await svc
    .from("organizations")
    .insert({
      slug: `selftest-ui-${randomUUID().slice(0, 8)}`,
      display_name: "Self Test UI",
      legal_name: "Self Test UI",
      status: "active",
      created_by: criado.user.id,
      onboarded_at: new Date().toISOString(),
      settings: { llm: { provider: "anthropic" }, ai_mode: "off" },
    })
    .select("id")
    .single();
  if (!org) throw new Error("sem org");
  await svc.from("user_organizations").insert({
    organization_id: org.id,
    user_id: criado.user.id,
    role: "admin",
    accepted_at: new Date().toISOString(),
  });

  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(SENHA);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL(/\/app\//, { timeout: 30_000 });
  await page.goto("/app/settings/business");
  await expect(page.getByTestId("ativar-pack-locadora")).toBeVisible();
  await expect(page.getByTestId("ativar-pack-escritorio_advocacia")).toBeVisible();
  await expect(page.getByRole("button", { name: /enviar campanha|disparar whatsapp/i })).toHaveCount(0);

  await svc.from("user_organizations").delete().eq("organization_id", org.id);
  await svc.from("organizations").delete().eq("id", org.id);
  await svc.auth.admin.deleteUser(criado.user.id);
});
