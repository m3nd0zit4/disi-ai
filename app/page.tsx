"use client"

import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";

export default function Home() {
  const { setTheme } = useTheme();

  return (
    <div>
      <h1>DISI AI</h1>
      <Button onClick={() => setTheme("dark")}>Dark</Button>
      <Button onClick={() => setTheme("light")}>Light</Button>
    </div>
  );
}

