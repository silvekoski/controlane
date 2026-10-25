"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// While the agent works, refresh the server view so new steps appear.
export function AutoRefresh({ active, ms = 1200 }: { active: boolean; ms?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const i = setInterval(() => router.refresh(), ms);
    return () => clearInterval(i);
  }, [active, ms, router]);
  return null;
}
