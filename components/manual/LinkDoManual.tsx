"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

import { hrefComAjuda } from "@/lib/manual/porta";

export function LinkDoManual({
  capitulo,
  children,
  className,
  testid,
}: {
  capitulo: string;
  children: ReactNode;
  className?: string;
  testid?: string;
}) {
  const pathname = usePathname();
  const search = useSearchParams();
  return (
    <Link
      href={hrefComAjuda(pathname, search.toString(), capitulo)}
      scroll={false}
      className={className}
      data-testid={testid}
    >
      {children}
    </Link>
  );
}
