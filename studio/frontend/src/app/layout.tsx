import type { Metadata } from "next";
import localFont from "next/font/local";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { TopBar } from "@/components/chrome/TopBar";
import { CommandLauncher } from "@/components/chrome/CommandLauncher";
import { GuidedTour } from "@/components/chrome/GuidedTour";
import "./globals.css";

const sans = localFont({
  src: [
    { path: "../../public/fonts/manrope-regular.ttf", weight: "400", style: "normal" },
    { path: "../../public/fonts/manrope-semibold.ttf", weight: "600", style: "normal" },
  ],
  variable: "--font-studio-sans",
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
      className={`${sans.variable} h-full antialiased dark`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-background text-foreground flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <TopBar />
          <main id="main-content" tabIndex={-1} className="studio-main flex-1 flex flex-col">{children}</main>
          <CommandLauncher />
          <GuidedTour />
          <Toaster richColors position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
