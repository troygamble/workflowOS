import type { Metadata } from "next";
import ClerkClientProvider from "@/components/shell/ClerkClientProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "WorkflowOS — PSF Workflow Studio",
  description:
    "Design, simulate, and ship PSF-aligned AI workflows. Free, open source (MIT). AI features use your own OpenAI API key.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ClerkClientProvider>{children}</ClerkClientProvider>
      </body>
    </html>
  );
}
