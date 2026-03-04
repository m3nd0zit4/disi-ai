"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSettingsPanel } from "@/hooks/useSettingsPanel";
import { Settings } from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const openPanel = useSettingsPanel((s) => s.openPanel);

  useEffect(() => {
    openPanel();
    router.replace("/");
  }, [openPanel, router]);

  return (
    <div className="container max-w-md py-16 flex flex-col items-center justify-center min-h-[50vh] text-center">
      <Settings className="w-10 h-10 text-muted-foreground mb-4" />
      <p className="text-sm text-muted-foreground">
        Abre Configuración desde el icono del sidebar (engranaje) cuando quieras.
      </p>
      <p className="text-xs text-muted-foreground/70 mt-2">Redirigiendo…</p>
    </div>
  );
}
