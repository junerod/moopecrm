import { redirect } from "next/navigation";

/** A loja saiu da cara do operador. Link antigo cai na integração que existe. */
export default function NuvemshopIntegrationPage() {
  redirect("/app/integrations/moope");
}
