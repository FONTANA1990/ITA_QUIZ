"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Bell, X, Building2, ChevronRight } from "lucide-react";
import { useUser } from "@/context/UserContext";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";

export default function InviteNotification() {
  const { pendingInvites } = useUser();
  const pathname = usePathname();
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(false);
  const [hasDismissed, setHasDismissed] = useState(false);

  // Não mostrar na página de jogo ou no próprio perfil (aba de convites)
  const isPlayPage = pathname.includes("/play/");
  const isProfileInvites = pathname === "/profile" && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('tab') === 'invites';

  useEffect(() => {
    if (pendingInvites.length > 0 && !isPlayPage && !isProfileInvites && !hasDismissed) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [pendingInvites, isPlayPage, isProfileInvites, hasDismissed]);

  if (!isVisible || pendingInvites.length === 0) return null;

  const latestInvite = pendingInvites[0];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -100, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -100, scale: 0.9 }}
        className="fixed top-6 left-4 right-4 z-[100] max-w-md mx-auto"
      >
        <div className="relative group">
          {/* Glow Effect */}
          <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500 to-orange-600 rounded-3xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
          
          <div className="relative bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-3xl p-4 shadow-2xl overflow-hidden">
            <div className="flex items-start gap-4">
              {/* Icon Container */}
              <div className="relative flex-shrink-0">
                <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-500 border border-amber-500/20">
                  <Building2 size={24} />
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full border-2 border-slate-900 flex items-center justify-center">
                  <span className="text-[8px] font-bold text-slate-900">{pendingInvites.length}</span>
                </div>
              </div>

              {/* Content */}
              <div 
                className="flex-1 cursor-pointer pr-6" 
                onClick={() => router.push("/profile?tab=invites")}
              >
                <h4 className="text-xs font-black text-amber-500 uppercase tracking-widest mb-1 italic">
                  Convite Recebido!
                </h4>
                <p className="text-sm font-bold text-slate-100 italic tracking-tight line-clamp-1">
                  Você foi convidado para a base <span className="text-amber-400 font-extrabold uppercase">{latestInvite.organizations?.name || "Organização"}</span>
                </p>
                <div className="mt-2 flex items-center gap-1 text-[10px] font-black text-slate-500 uppercase tracking-wider group-hover:text-amber-500 transition-colors">
                  Ver detalhes e aceitar <ChevronRight size={10} className="mt-0.5" />
                </div>
              </div>

              {/* Close Button */}
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setHasDismissed(true);
                  setIsVisible(false);
                }}
                aria-label="Remover notificação"
                className="absolute top-2 right-2 p-2 text-slate-500 hover:text-white hover:bg-white/5 rounded-xl transition-all"
              >
                <X size={16} />
              </button>
            </div>

            {/* Progress bar background indicator (optional) */}
            <div className="absolute bottom-0 left-0 h-0.5 bg-amber-500/30 w-full overflow-hidden">
               <motion.div 
                 initial={{ x: "-100%" }}
                 animate={{ x: "0%" }}
                 transition={{ duration: 5, repeat: Infinity }}
                 className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-50"
               />
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
