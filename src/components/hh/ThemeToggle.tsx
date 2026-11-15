import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

const THEME_KEY = "scouthaus-theme";

export function ThemeToggle() {
  const [light, setLight] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(THEME_KEY);
    const nextLight = saved === "light";
    setLight(nextLight);
    document.documentElement.classList.toggle("light", nextLight);
    document.documentElement.classList.toggle("dark", !nextLight);
    document.documentElement.style.colorScheme = nextLight ? "light" : "dark";
  }, []);

  const toggle = () => {
    const nextLight = !light;
    setLight(nextLight);
    window.localStorage.setItem(THEME_KEY, nextLight ? "light" : "dark");
    document.documentElement.classList.toggle("light", nextLight);
    document.documentElement.classList.toggle("dark", !nextLight);
    document.documentElement.style.colorScheme = nextLight ? "light" : "dark";
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={light ? "Switch to dark mode" : "Switch to light mode"}
      title={light ? "Switch to dark mode" : "Switch to light mode"}
      className="ml-auto inline-flex size-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {light ? <Moon className="size-4" aria-hidden="true" /> : <Sun className="size-4" aria-hidden="true" />}
    </button>
  );
}
