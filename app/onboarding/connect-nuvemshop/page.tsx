import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** O wizard não oferece esta tela. URL antiga volta para o passo que existe. */
export default function ConnectNuvemshopPage() {
  redirect("/onboarding");
}
