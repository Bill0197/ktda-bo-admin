import { Monitor, Moon, Sun } from "lucide-react";
import clsx from "clsx";
import { useTheme, type ThemeChoice } from "../lib/theme";

const CHOICES: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light theme", icon: Sun },
  { value: "dark", label: "Dark theme", icon: Moon },
  { value: "system", label: "Follow the system theme", icon: Monitor },
];

/** Three-way theme switch for the top bar: light, dark, follow the system. */
export function ThemeSwitch() {
  const [choice, setChoice] = useTheme();
  return (
    <div role="group" aria-label="Theme" className="flex items-center gap-0.5 rounded-lg border border-border bg-surface-sunken p-0.5">
      {CHOICES.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          aria-label={label}
          aria-pressed={choice === value}
          title={label}
          onClick={() => setChoice(value)}
          className={clsx(
            "h-7 w-7 grid place-items-center rounded-md cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50",
            choice === value ? "bg-surface text-primary-600 shadow-sm" : "text-text-faint hover:text-text",
          )}
        >
          <Icon size={15} />
        </button>
      ))}
    </div>
  );
}
