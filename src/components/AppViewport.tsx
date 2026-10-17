"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function AppViewport({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return <div className={pathname === "/" ? "landing-viewport" : "app-viewport"}>{children}</div>;
}
