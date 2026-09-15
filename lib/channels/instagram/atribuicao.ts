/**
 * Origem da DM — anúncio ou conteúdo que abriu o fio.
 *
 * Mora aqui porque o payload nomeia o transporte. A gravação é a mesma
 * `estamparAtribuicaoDoContato` do primeiro toque.
 */
import type { AtribuicaoDeAnuncio } from "@/lib/leads/atribuicao-de-anuncio";
import { obj, str } from "@/lib/leads/atribuicao-de-anuncio";

export function extrairAtribuicaoDirect(referral: unknown): AtribuicaoDeAnuncio | null {
  const r = obj(referral);
  if (!r) return null;
  const fonte = (str(r.source) ?? "").toUpperCase();
  if (fonte && fonte !== "ADS") return null;

  const ads = obj(r.ads_context_data) ?? obj(r.adsContextData) ?? {};
  const sourceId = str(ads.post_id) ?? str(ads.product_id) ?? str(r.ref);
  const titulo = str(ads.ad_title) ?? str(ads.adTitle);
  const sourceUrl = str(ads.photo_url) ?? str(ads.video_url);
  if (!sourceId && !titulo && !sourceUrl) return null;

  return {
    plataforma: "meta_ads",
    sourceId,
    titulo,
    corpo: null,
    sourceUrl,
    bruto: r,
  };
}
