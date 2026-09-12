"use client";
import Link from "next/link";
import { useTransition } from "react";
import { useUser, useAuth, useActiveOrg } from "@/hooks/auth/AuthProvider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PORTA_DA_PLATAFORMA } from "@/lib/navigation/porta-da-plataforma";
import { ShieldCheck, SignOut } from "@/lib/ui/icons";

function initials(name: string | null, email: string): string {
  if (name && name.trim()) {
    return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

export function UserMenu() {
  const user = useUser();
  const activeOrg = useActiveOrg();
  const { signOut } = useAuth();
  const [isPending, startTransition] = useTransition();
  const nome = user.full_name ?? user.email;
  const empresa = activeOrg?.name;

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-auto gap-2 rounded-full px-1.5 py-1 md:px-2"
            aria-label="Menu do usuário"
          >
            <Avatar className="h-8 w-8">
              {user.avatar_url && <AvatarImage src={user.avatar_url} alt="" />}
              <AvatarFallback>{initials(user.full_name, user.email)}</AvatarFallback>
            </Avatar>
            <span className="hidden min-w-0 flex-col items-start text-left md:flex">
              <span className="max-w-[10rem] truncate text-[13px] font-medium leading-tight text-[var(--color-text)]">
                {nome}
              </span>
              {empresa ? (
                <span className="max-w-[10rem] truncate text-[11px] font-normal leading-tight text-[var(--color-text-muted)]">
                  {empresa}
                </span>
              ) : null}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[220px]">
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span className="text-sm font-medium">{user.full_name ?? user.email}</span>
              <span className="truncate text-xs text-muted-foreground">{user.email}</span>
              {user.is_platform_admin ? (
                <span className="mt-1 text-xs font-normal text-muted-foreground">
                  Dono do servidor
                </span>
              ) : null}
            </div>
          </DropdownMenuLabel>
          {user.is_platform_admin ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={PORTA_DA_PLATAFORMA.href}>
                  <ShieldCheck size={16} className="mr-2" aria-hidden />
                  {PORTA_DA_PLATAFORMA.label}
                </Link>
              </DropdownMenuItem>
            </>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={isPending} onClick={() => startTransition(async () => { await signOut(); })}>
            <SignOut size={16} className="mr-2" aria-hidden />
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
