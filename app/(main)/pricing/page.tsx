"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePlansPanel } from "@/hooks/usePlansPanel";

/**
 * /pricing redirects to home and opens the Plans panel (so deep links still work).
 */
export default function PricingPage() {
  const router = useRouter();
  const openPanel = usePlansPanel((s) => s.openPanel);

  useEffect(() => {
    openPanel();
    router.replace("/");
  }, [openPanel, router]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <p className="text-sm text-muted-foreground">Opening plans…</p>
    </div>
  );
}
