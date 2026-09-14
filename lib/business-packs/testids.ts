/** Testids estáveis. Locadora guarda os nomes que o e2e antigo já usa. */

export function testidAtivarModelo(packId: string) {
  return packId === "locadora_veiculos" ? "usar-modelo-locadora" : `usar-modelo-${packId}`;
}

export function testidAtivarPackCard(packId: string) {
  return packId === "locadora_veiculos" ? "ativar-pack-locadora" : `ativar-pack-${packId}`;
}

export function testidPackAtivo(packId: string) {
  return packId === "locadora_veiculos" ? "pack-locadora-ativo" : `pack-${packId}-ativo`;
}

export function testidPackInativo(packId: string) {
  return packId === "locadora_veiculos" ? "pack-locadora-inativo" : `pack-${packId}-inativo`;
}

export function testidDesativarPack(packId: string) {
  return packId === "locadora_veiculos" ? "desativar-pack-locadora" : `desativar-pack-${packId}`;
}

export function testidReativarPack(packId: string) {
  return packId === "locadora_veiculos" ? "reativar-pack-locadora" : `reativar-pack-${packId}`;
}

export function testidCardOnboarding(packId: string) {
  if (packId === "locadora_veiculos") return "pack-locadora-card";
  if (packId === "escritorio_advocacia") return "pack-advocacia-card";
  return `pack-${packId}-card`;
}
