"use client";

import { usePathname } from "next/navigation";

export default function PageLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  
  // A tela de jogo (/play/) não tem BottomNav, então não precisa de padding extra.
  // Já as outras telas precisam de um padding na base para não serem cobertas pelo menu fixed.
  const isPlayPage = pathname.includes("/play/");
  
  return (
    <main 
      className={`flex-1 w-full transition-all duration-300 ${
        isPlayPage ? "" : "pb-24 md:pb-32"
      }`}
    >
      {children}
    </main>
  );
}
