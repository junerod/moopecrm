import { logger } from "@/lib/logger";
import type { createAdminClient } from "@/lib/supabase/admin";
import { getWahaClient } from "@/lib/waha/client";
import { destinoDeEnvioWaha } from "@/lib/waha/resolve-contact-whatsapp-id";

type Admin = ReturnType<typeof createAdminClient>;

function chatIdBruto(phone: string): string | null {
  const d = phone.replace(/\D/g, "");
  if (d.length < 10) return null;
  const full = d.startsWith("55") ? d : `55${d}`;
  return `${full}@c.us`;
}

/**
 * Aviso no WhatsApp da linha comercial do CRM.
 * Não exige que a pessoa tenha falado com o Meu Assessor.
 */
export async function avisarPeloWhatsappDoCrm(
  admin: Admin,
  phones: string[],
  text: string,
): Promise<void> {
  const client = getWahaClient();
  if (!client || !phones.length) return;

  const { data: sessions } = await admin
    .from("channel_sessions")
    .select("phone_number, status, provider, waha_session_name")
    .eq("provider", "waha")
    .eq("status", "WORKING");
  const sessao = (sessions ?? []).find((s) =>
    String(s.phone_number || "")
      .replace(/\D/g, "")
      .endsWith("2089343"),
  );
  const nome = sessao?.waha_session_name;
  if (!nome) return;

  for (const phone of phones) {
    const bruto = chatIdBruto(phone);
    if (!bruto) continue;
    try {
      const chatId = await destinoDeEnvioWaha(client, nome, bruto);
      await client.sendMessage(nome, chatId, text);
    } catch (err) {
      logger.warn("assessor: aviso pelo WhatsApp do CRM falhou", {
        detail: err instanceof Error ? err.message.slice(0, 160) : "desconhecido",
      });
    }
  }
}
