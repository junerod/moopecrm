import { CampanhaDetalheClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function CampanhaDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <CampanhaDetalheClient id={id} />
    </div>
  );
}
