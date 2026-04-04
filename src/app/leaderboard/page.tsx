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
    <div className="flex flex-col min-h-screen bg-[var(--background)] p-4 md:p-8 pb-32">
      <div className="max-w-3xl mx-auto w-full space-y-12">
        
        {/* Header Section */}
        <div className="flex flex-col items-center justify-center py-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-full mb-4 shadow-lg shadow-emerald-500/5">
             <span className="relative flex h-1.5 w-1.5">
               <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
               <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
             </span>
             <span className="text-[9px] font-black uppercase tracking-widest leading-none">Ranking da Base: {activeOrg?.name}</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] bg-clip-text text-transparent italic tracking-tighter uppercase leading-none text-center">
            Top Competidores
          </h1>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mt-3 text-center opacity-60">Disputa local exclusiva</p>
        </div>

        {/* Content Section */}
        <div className="space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-20 gap-4">
              <Loader2 className="animate-spin text-[var(--primary)]" size={40} />
              <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Sincronizando placar...</p>
            </div>
          ) : !activeOrg ? (
             <div className="text-center p-12 bg-[var(--surface)] border border-[var(--border)] rounded-[2.5rem] opacity-50">
                <p className="text-[10px] font-black uppercase tracking-widest">Selecione uma base no perfil...</p>
             </div>
          ) : rankings.length === 0 ? (
            <div className="text-center p-12 bg-[var(--surface)] border border-[var(--border)] rounded-[2.5rem] opacity-50">
               <p className="text-[10px] font-black uppercase tracking-widest">A disputa ainda não começou...</p>
            </div>
          ) : (
            rankings.map((user, idx) => {
              const isTop3 = idx < 3;
              const isGold = idx === 0;
              
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`group relative p-4 rounded-[2rem] border transition-all flex items-center justify-between gap-4 ${
                    isGold 
                      ? "bg-gradient-to-r from-amber-500/10 to-purple-500/10 border-amber-500/20 shadow-xl shadow-amber-500/[0.03]" 
                      : "bg-[var(--surface)] border-[var(--border)]"
                  }`}
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    {/* Position Icon */}
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black shadow-lg shrink-0 transition-transform group-hover:scale-105 ${
                      isGold ? "bg-gradient-to-br from-amber-400 to-orange-600 text-white" : 
                      idx === 1 ? "bg-slate-300 text-slate-700" : 
                      idx === 2 ? "bg-orange-600/80 text-white" : "bg-[var(--background)] text-slate-500 border border-[var(--border)]"
                    }`}>
                      {isTop3 ? <Medal size={22} strokeWidth={3} /> : <span className="text-xs">{idx + 1}</span>}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="font-black text-[var(--foreground)] italic tracking-tighter text-lg uppercase leading-none truncate group-hover:text-[var(--primary)] transition-colors">
                        {user.nickname}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className="text-[8px] text-slate-500 font-black uppercase tracking-widest leading-none">Cidadão da Base</span>
                        {isGold && <span className="text-[8px] bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded font-black">LÍDER</span>}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right shrink-0">
                    <div className="flex flex-col items-end">
                      <span className={`text-2xl md:text-3xl font-black italic tracking-tighter leading-none ${isGold ? "text-amber-500" : "text-[var(--primary)]"}`}>
                        {(user.points || 0).toLocaleString()}
                      </span>
                      <span className="text-[9px] text-[var(--secondary)] font-black uppercase tracking-widest mt-1 flex items-center gap-1 opacity-70">
                        {globalSettings.currency || 'PONTOS'} <ArrowUpRight size={10} strokeWidth={4} />
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
        
        {/* Footer CTA */}
        {rankings.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-8">
            <div className="bg-[var(--surface)] border border-[var(--border)] p-8 rounded-[3.5rem] relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[var(--primary)] to-transparent opacity-50" />
              <div className="flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
                <div className="w-16 h-16 bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] rounded-3xl flex items-center justify-center text-white shadow-xl rotate-12 group-hover:rotate-0 transition-transform">
                  <Trophy size={32} />
                </div>
                <div className="flex-1">
                  <h4 className="text-2xl font-black italic uppercase tracking-tighter leading-none mb-2">Domine o Topo</h4>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 opacity-70 leading-relaxed max-w-sm">Suba no placar da sua base para desbloquear conquistas e provar sua maestria.</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
