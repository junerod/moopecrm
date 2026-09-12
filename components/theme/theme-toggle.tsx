"use client";

import { useTheme, type Theme } from "@/lib/theme";
import { useHotkeys } from "react-hotkeys-hook";
import { Sun, Moon, MonitorPlay } from "@/lib/ui/icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const OPCOES: { valor: Theme; rotulo: string }[] = [
  { valor: "light", rotulo: "Claro" },
  { valor: "system", rotulo: "Sistema" },
  { valor: "dark", rotulo: "Escuro" },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const cycle = () => {
    setTheme(theme === "light" ? "dark" : theme === "dark" ? "system" : "light");
  };

  useHotkeys("mod+shift+l", cycle, { preventDefault: true }, [theme]);

  const Icon = theme === "dark" ? Moon : theme === "system" ? MonitorPlay : Sun;
  const rotulo = OPCOES.find((o) => o.valor === theme)?.rotulo ?? "Tema";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          data-testid="theme-control"
          aria-label={`Aparência: ${rotulo}. Cmd+Shift+L para alternar.`}
        >
          <Icon size={16} aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[10rem]">
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={(v) => setTheme(v as Theme)}
        >
          {OPCOES.map((o) => (
            <DropdownMenuRadioItem
              key={o.valor}
              value={o.valor}
              data-testid={`theme-option-${o.valor}`}
            >
              {o.rotulo}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
