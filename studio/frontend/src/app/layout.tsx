import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { TopBar } from "@/components/chrome/TopBar";
import { CommandLauncher } from "@/components/chrome/CommandLauncher";
import { GuidedTour } from "@/components/chrome/GuidedTour";
import "./globals.css";

const sans = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Jailbreak Pipeline Studio",
  description:
    "Interactive 3D visualisation of the LLM prompt → refusal-gate → verdict pipeline, with a dataset exporter new models can learn from.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable} h-full antialiased dark`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-background text-foreground flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <TopBar />
          <main className="flex-1 flex flex-col">{children}</main>
          <CommandLauncher />
          <GuidedTour />
          <Toaster richColors position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
