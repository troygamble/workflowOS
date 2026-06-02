"use client";

import { ClerkProvider } from "@clerk/nextjs";

export default function ClerkClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ClerkProvider>{children}</ClerkProvider>;
}
