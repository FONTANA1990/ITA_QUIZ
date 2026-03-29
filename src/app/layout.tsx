import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import PageLayoutWrapper from "@/components/PageLayoutWrapper";
import { UserProvider } from "@/context/UserContext";

const outfit = Outfit({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ITA QUIZ",
  description: "Experiência de quiz interativa e moderna estilo Kahoot.",
  manifest: "/manifest.json", // Previsão futura pra PWA
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${outfit.className} bg-slate-950 text-slate-50 antialiased overflow-x-hidden min-h-screen flex flex-col`}>
        <UserProvider>
          <PageLayoutWrapper>
            {children}
          </PageLayoutWrapper>
          <BottomNav />
        </UserProvider>
      </body>
    </html>
  );
}
