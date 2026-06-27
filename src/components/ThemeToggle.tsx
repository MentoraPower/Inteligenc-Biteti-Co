import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark');
    }
    return false;
  });

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
      setIsDark(true);
    }
  }, []);

  const toggleTheme = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    
    if (newIsDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        "relative flex items-center w-14 h-7 rounded-full p-1 transition-all duration-300",
        isDark 
          ? "bg-zinc-800" 
          : "bg-zinc-200"
      )}
      aria-label={isDark ? "Ativar modo claro" : "Ativar modo escuro"}
    >
      {/* Icons container */}
      <div className="absolute inset-0 flex items-center justify-between px-1.5">
        <Sun className={cn(
          "h-3.5 w-3.5 transition-opacity duration-300",
          isDark ? "opacity-40 text-zinc-500" : "opacity-0"
        )} />
        <Moon className={cn(
          "h-3.5 w-3.5 transition-opacity duration-300",
          isDark ? "opacity-0" : "opacity-40 text-zinc-400"
        )} />
      </div>
      
      {/* Sliding circle */}
      <div
        className={cn(
          "w-5 h-5 rounded-full shadow-md flex items-center justify-center transition-all duration-300",
          isDark 
            ? "translate-x-7 bg-zinc-900" 
            : "translate-x-0 bg-white"
        )}
      >
        {isDark ? (
          <Moon className="h-3 w-3 text-zinc-300" />
        ) : (
          <Sun className="h-3 w-3 text-amber-500" />
        )}
      </div>
    </button>
  );
}
