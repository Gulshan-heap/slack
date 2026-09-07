"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { Hint } from "@/components/hint";

export const ThemeToggle = () => {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="size-9" />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <Hint label={isDark ? "Switch to light mode" : "Switch to dark mode"}>
      <Button
        variant="transparent"
        size="iconSm"
        onClick={() => setTheme(isDark ? "light" : "dark")}
      >
        {isDark ? (
          <Sun className="size-5 text-white" />
        ) : (
          <Moon className="size-5 text-white" />
        )}
      </Button>
    </Hint>
  );
};
