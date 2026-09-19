"use client";
import { Suspense } from "react";
import { AlertsBell } from "./AlertsBell";
import { MobileSidebar } from "./MobileSidebar";
import { TenantSwitcher } from "./TenantSwitcher";
import { UserMenu } from "./UserMenu";
import { SearchTrigger } from "./SearchTrigger";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export function TopBar() {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-1.5 border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 px-2 backdrop-blur md:gap-4 md:px-6">
      <div className="flex min-w-0 items-center gap-1">
        <Suspense fallback={null}>
          <MobileSidebar />
        </Suspense>
        <TenantSwitcher />
      </div>
      <div className="flex shrink-0 items-center md:min-w-0 md:flex-1 md:justify-center">
        <SearchTrigger />
      </div>
      <div className="flex shrink-0 items-center gap-0.5 md:gap-2">
        <ThemeToggle />
        <AlertsBell />
        <UserMenu />
      </div>
    </header>
  );
}
