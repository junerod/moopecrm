import { createAdminClient } from "@/lib/supabase/admin";
import { garantirAgenteAtendimentoLocadora } from "@/lib/moope/agente-atendimento-locadora";

const ORG = process.env.MOOPE_ORG_ID || "9a9ef4ee-1eb2-42ab-a969-9787a63c9d68";

async function main() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("user_organizations")
    .select("user_id")
    .eq("organization_id", ORG)
    .is("revoked_at", null)
    .limit(1)
    .maybeSingle();
  const userId = (data as { user_id?: string } | null)?.user_id;
  if (!userId) {
    console.error("NO-GO sem usuario");
    process.exit(1);
  }
  const r = await garantirAgenteAtendimentoLocadora(admin, ORG, userId);
  console.log("GO agente", JSON.stringify(r));
}

void main();
