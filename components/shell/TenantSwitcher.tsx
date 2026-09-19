"use client";
import { useTransition } from "react";
import { CaretDown, Storefront } from "@/lib/ui/icons";
import { useUser, useActiveOrg } from "@/hooks/auth/AuthProvider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { setActiveOrg } from "@/app/actions/shell/setActiveOrg";

export function TenantSwitcher() {
  const user = useUser();
  const active = useActiveOrg();
  const [isPending, startTransition] = useTransition();

  if (user.organizations.length <= 1) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" disabled={isPending} className="h-9 gap-1 px-1.5 md:gap-2 md:px-3">
          <Storefront size={16} weight="duotone" aria-hidden />
          <span className="max-w-[4.5rem] truncate text-[13px] sm:max-w-[8rem] md:max-w-[160px] md:text-sm">
            {active?.name ?? "Selecionar org"}
          </span>
          <CaretDown size={12} aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[220px]">
        {user.organizations.map((org) => (
          <DropdownMenuItem
            key={org.organization_id}
            onClick={() => startTransition(async () => { await setActiveOrg(org.organization_id); })}
            className="flex items-center justify-between"
          >
            <span className="truncate">{org.organization_name}</span>
            {active?.orgId === org.organization_id && <span className="text-xs text-muted-foreground">✓</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
