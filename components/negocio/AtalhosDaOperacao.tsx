import Link from "next/link";

const ATALHOS = [
  { href: "/app/inbox", label: "Inbox" },
  { href: "/app/kanban", label: "Leads" },
  { href: "/app/ai/followups", label: "Automações" },
  { href: "/app/ai/knowledge/sources", label: "Conhecimento" },
  { href: "/app/settings/atendimento", label: "IA e Assistentes" },
  { href: "/app/connections", label: "WhatsApp" },
];

export function AtalhosDaOperacao() {
  return (
    <nav aria-label="Operação diária" className="flex flex-wrap gap-2">
      {ATALHOS.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          className="rounded-full border border-border px-3 py-1.5 text-sm hover:bg-muted"
        >
          {a.label}
        </Link>
      ))}
    </nav>
  );
}
