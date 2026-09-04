"use client";

import { useEffect } from "react";

/**
 * O wizard tem um tema só — o escuro. Sem isto, quem estava no claro via
 * cartão claro sobre fundo escuro (ou o contrário), e o contraste que a
 * tela pede quebrava.
 *
 * O resto do produto também nasce escuro. Restaurar o atributo ao sair
 * evita um flash se alguma tela de prova (vitrine) tiver pedido o claro.
 */
export function ForcarTemaEscuro() {
  useEffect(() => {
    const html = document.documentElement;
    const antes = html.getAttribute("data-theme");
    html.setAttribute("data-theme", "dark");
    return () => {
      if (antes) html.setAttribute("data-theme", antes);
      else html.removeAttribute("data-theme");
    };
  }, []);
  return null;
}
