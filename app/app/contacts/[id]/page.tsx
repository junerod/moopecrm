import { redirect } from "next/navigation";

import { idPareceUuidDoContato } from "@/lib/moope/resolver-contato";
import { createClient } from "@/lib/supabase/server";

import { ContactDetailClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  if (idPareceUuidDoContato(id)) {
    const { data: contact } = await supabase.from("contacts").select("id").eq("id", id).maybeSingle();
    if (!contact) redirect("/app/inbox");
    return <ContactDetailClient contactId={id} />;
  }

  const { data: porMoope } = await supabase
    .from("contacts")
    .select("id")
    .eq("source_metadata->>moope_external_id", id)
    .limit(1)
    .maybeSingle();
  if (!porMoope) redirect("/app/inbox");
  redirect(`/app/contacts/${(porMoope as { id: string }).id}`);
}
