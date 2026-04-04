"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import { Trophy, Medal, ArrowUpRight, Loader2, Info } from "lucide-react";
import { useUser } from "@/context/UserContext";

export default function Leaderboard() {
  const { globalSettings, activeOrg } = useUser();
  const [rankings, setRankings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (activeOrg) {
      fetchRankings();
    }
  }, [activeOrg]);

  const fetchRankings = async () => {
    if (!activeOrg) return;
    setLoading(true);
    try {
      // Busca as pontuações de todos os quizzes que pertencem a esta organização
      const { data, error } = await supabase
        .from("scores")
        .select(`
          total_points,
          user_id,
          users ( nickname ),
          quizzes!inner ( organization_id )
        `)
        .eq("quizzes.organization_id", activeOrg.id);

      if (error) throw error;

      // Agrupa os pontos por usuário
      const userMap: Record<string, { nickname: string, points: number }> = {};
      
      (data || []).forEach((row: any) => {
        const uid = row.user_id;
        const nickname = row.users?.nickname || "JOGADOR";
        if (!userMap[uid]) {
          userMap[uid] = { nickname, points: 0 };
        }
        userMap[uid].points += row.total_points || 0;
      });

      // Transforma em array e ordena
      const sorted = Object.values(userMap)
        .sort((a, b) => b.points - a.points)
        .slice(0, 50);

      setRankings(sorted);
    } catch (err) {
      console.error("Erro ao carregar ranking:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen p-4 bg-[var(--background)] transition-colors duration-300 pb-24">
      <div className="mt-8 mb-8 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-full mb-3 shadow-lg shadow-emerald-500/5">
           <Info size={12} />
           <span className="text-[9px] font-black uppercase tracking-widest leading-none">Ranking da Base: {activeOrg?.name || 'Carregando...'}</span>
        </div>
        <h1 className="text-4xl font-black bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] bg-clip-text text-transparent italic tracking-tighter uppercase leading-none">
          TOP COMPETIDORES
        </h1>
        <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-2">Disputa local exclusiva</p>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="flex justify-center p-20">
            <Loader2 className="animate-spin text-[var(--primary)]" size={40} />
          </div>
        ) : !activeOrg ? (
           <div className="text-center p-10 opacity-50">
              <p className="text-xs font-black uppercase tracking-widest">Selecione uma base no perfil...</p>
           </div>
        ) : rankings.length === 0 ? (
          <div className="text-center p-10 opacity-50">
             <p className="text-xs font-black uppercase tracking-widest">Nenhuma pontuação nesta base ainda...</p>
          </div>
        ) : (
          rankings.map((user, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.05 }}
              className={`flex items-center justify-between p-5 rounded-[2rem] border shadow-2xl transition-all ${
                idx === 0 
                  ? "bg-[var(--primary)]/10 border-[var(--primary)]/40 shadow-indigo-500/10" 
                  : "bg-[var(--surface)] border-[var(--border)]"
              }`}
            >
              <div className="flex items-center gap-4 min-w-0 flex-1">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black shadow-xl shrink-0 ${
                  idx === 0 ? "bg-amber-500 text-white rotate-3" : 
                  idx === 1 ? "bg-slate-300 text-slate-900 -rotate-3" : 
                  idx === 2 ? "bg-orange-600 text-white rotate-2" : "bg-[var(--background)] text-slate-500"
                }`}>
                  {idx < 3 ? <Medal size={24} strokeWidth={3} /> : <span className="text-xs font-black">{idx + 1}</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-black text-[var(--foreground)] italic tracking-tighter text-lg uppercase leading-none truncate">{user.nickname || "JOGADOR"}</h3>
                  <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest mt-1 block tracking-[0.2em] truncate">Membro da Base</span>
                </div>
              </div>
              
              <div className="text-right shrink-0">
                <span className={`block text-xl font-black italic tracking-tighter ${idx === 0 ? "text-amber-500" : "text-[var(--primary)]"}`}>
                  {(user.points || 0).toLocaleString()}
                </span>
                <span className="text-[9px] text-[var(--secondary)] font-black uppercase tracking-widest flex items-center gap-0.5 justify-end">
                  {globalSettings.currency} <ArrowUpRight size={10} strokeWidth={4} />
                </span>
              </div>
            </motion.div>
          ))
        )}
      </div>
      
      <div className="mt-8">
        <div className="bg-gradient-to-tr from-[var(--primary)] to-[var(--secondary)] p-6 rounded-[2.5rem] text-white shadow-2xl shadow-indigo-500/20 relative overflow-hidden">
          <div className="absolute -top-4 -right-4 bg-white/10 w-24 h-24 rounded-full blur-2xl" />
          <Trophy className="w-10 h-10 opacity-40 mb-4" />
          <h4 className="text-2xl font-black italic uppercase tracking-tighter leading-none">DOMINE O TOPO</h4>
          <p className="text-[10px] font-bold opacity-70 uppercase tracking-widest mt-2 max-w-[200px]">Suba no ranking da sua base e ganhe prêmios exclusivos.</p>
        </div>
      </div>
    </div>
  );
}
