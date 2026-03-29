"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutDashboard, Trophy, User, History } from "lucide-react";
import { motion } from "framer-motion";

const navItems = [
  { label: "Início", icon: Home, path: "/" },
  { label: "Admin", icon: LayoutDashboard, path: "/admin" },
  { label: "Ranking", icon: Trophy, path: "/leaderboard" },
  { label: "Histórico", icon: History, path: "/history" },
  { label: "Perfil", icon: User, path: "/profile" },
];

export default function BottomNav() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Esconder a barra durante o jogo real (Arena) ou antes de montar no cliente
  if (!mounted || pathname.includes("/play/")) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[var(--background)]/95 backdrop-blur-xl border-t border-[var(--border)] p-2 pb-[1.2rem] z-50 transition-colors duration-300">
      <div className="max-w-md mx-auto flex justify-around items-end">
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <Link key={item.path} href={item.path} className="relative group">
              <motion.div
                whileTap={{ scale: 0.9 }}
                className={`flex flex-col items-center gap-1 p-2 transition-all duration-300 ${
                  isActive ? "text-[var(--primary)] font-black" : "text-[var(--foreground)]/60 group-hover:text-[var(--foreground)]"
                }`}
              >
                <div className={`p-1 rounded-xl transition-all duration-300 ${isActive ? "bg-[var(--primary)]/10 shadow-[0_0_15px_rgba(var(--primary),0.2)]" : ""}`}>
                   <item.icon className={`w-6 h-6 ${isActive ? "fill-[var(--primary)]/20" : ""}`} />
                </div>
                <span className={`text-[9px] uppercase tracking-widest ${isActive ? "opacity-100" : "opacity-60"}`}>
                  {item.label}
                </span>
                
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute -top-1 w-8 h-1 bg-[var(--primary)] rounded-full shadow-[0_0_10px_rgba(var(--primary),0.5)]"
                  />
                )}
              </motion.div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
