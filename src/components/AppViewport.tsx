"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function AppViewport({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const fullWidth = pathname === "/" || pathname === "/design/logo-editor";
  return <div className={fullWidth ? "landing-viewport" : "app-viewport"}>{children}</div>;
}
