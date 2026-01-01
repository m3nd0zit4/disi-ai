import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "./theme-provider";
import { AIContextProvider } from "@/context/AIContext";
import ConvexClientProvider from './ConvexClientProvider'
import ClerkThemeProvider from "./_components/ClerkThemeProvider";
import { GlobalDialog } from "./_components/ui/GlobalDialog";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Disi AI - Multi-Model Chat",
  description: "Chat con múltiples modelos de IA al mismo tiempo",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider attribute="class">
          <ClerkThemeProvider>
            <ConvexClientProvider>
              <AIContextProvider>
                {children}
                <GlobalDialog />
              </AIContextProvider>
            </ConvexClientProvider>
          </ClerkThemeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}