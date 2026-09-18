/**
 * Cabeçalho da tela Bots — fala a língua de quem atende no WhatsApp.
 * Menu e Recados ficam separados porque misturar os dois vira "fluxo" que
 * ninguém acha.
 */
import { AppIcon } from "@/components/ds/AppIcon";
import { ChatCircle, Clock, Robot } from "@/lib/ui/icons";

export function BotsHero() {
  return (
    <header
      className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]"
      data-testid="bots-hero"
    >
      <div className="relative px-5 py-6 sm:px-7 sm:py-7">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            background:
              "radial-gradient(ellipse 70% 80% at 0% 0%, color-mix(in oklab, var(--color-accent) 18%, transparent), transparent 55%), radial-gradient(ellipse 50% 60% at 100% 20%, color-mix(in oklab, #22c55e 12%, transparent), transparent 50%)",
          }}
        />
        <div className="relative flex flex-col gap-5">
          <div className="flex items-start gap-3">
            <AppIcon icon={Robot} tone="cyan" size="lg" />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-accent)]">
                WhatsApp
              </p>
              <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text)] sm:text-[1.7rem]">
                Bots / Fluxo WhatsApp
              </h1>
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-[var(--color-text-muted)]">
                Aqui você monta o que a pessoa vê no WhatsApp: o menu 1, 2, 3 e
                os recados automáticos. Se ela responder ou pedir para parar, o
                sistema para sozinho.
              </p>
            </div>
          </div>

          <ul className="grid gap-3 sm:grid-cols-3">
            <li className="flex gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/80 p-3.5 backdrop-blur-sm">
              <AppIcon icon={Robot} tone="cyan" size="md" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--color-text)]">Primeiro atendimento</p>
                <p className="mt-0.5 text-xs leading-relaxed text-[var(--color-text-muted)]">
                  O menu da primeira mensagem. Os atalhos abaixo criam esse bot já desenhado.
                </p>
              </div>
            </li>
            <li className="flex gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/80 p-3.5 backdrop-blur-sm">
              <AppIcon icon={Clock} tone="amber" size="md" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--color-text)]">Recados</p>
                <p className="mt-0.5 text-xs leading-relaxed text-[var(--color-text-muted)]">
                  Mensagem sozinha se o cliente sumir ou mudar de etapa no funil.
                </p>
              </div>
            </li>
            <li className="flex gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/80 p-3.5 backdrop-blur-sm">
              <AppIcon icon={ChatCircle} tone="violet" size="md" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--color-text)]">Assistente</p>
                <p className="mt-0.5 text-xs leading-relaxed text-[var(--color-text-muted)]">
                  O jeito de falar — isso se configura em Assistentes IA.
                </p>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </header>
  );
}
