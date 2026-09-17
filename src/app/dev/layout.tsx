import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { isDevelopmentRouteEnabled } from "./access";

export default function DevelopmentLayout({
  children,
}: {
  children: ReactNode;
}) {
  if (!isDevelopmentRouteEnabled()) notFound();
  return children;
}
