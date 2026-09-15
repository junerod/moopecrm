"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";

import { PainelDoManual } from "@/components/manual/PainelDoManual";
import {
  PARAM_AJUDA,
  ehCapituloDoManual,
  hrefSemAjuda,
  lembrarTela,
} from "@/lib/manual/porta";

export function PortaDoManual({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();
  const bruto = search.get(PARAM_AJUDA);
  const capitulo = ehCapituloDoManual(bruto) ? bruto : null;
  const aberto = Boolean(capitulo) && pathname !== "/app/manual";

  useEffect(() => {
    lembrarTela(pathname, search.toString());
  }, [pathname, search]);

  const fechar = useCallback(() => {
    router.replace(hrefSemAjuda(pathname, search.toString()), { scroll: false });
  }, [pathname, router, search]);

  if (!aberto || !capitulo) return null;

  return (
    <PainelDoManual
      capitulo={capitulo}
      pathname={pathname}
      collapsed={collapsed}
      onVoltar={fechar}
    />
  );
}
