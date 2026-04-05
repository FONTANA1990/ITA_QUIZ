"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import { History, CheckCircle2, XCircle, TrendingUp, Calendar, Loader2 } from "lucide-react";
import { useUser } from "@/context/UserContext";

export default function GameHistory() {
  const { preferences, globalSettings, user } = useUser();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, wins: 0, rate: 0 });

  useEffect(() => {
    if (user) {
      fetchHistory();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchHistory = async () => {
    try {
      const { data, error } = await supabase
        .from("scores")
        .select(`
          total_points,
          created_at,
          quizzes ( title )
        `)
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const formatted = (data || []).map((s: any, idx: number) => ({
        id: idx,
        title: s.quizzes?.title || "Quiz Finalizado",
        date: new Date(s.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
        points: `+${s.total_points.toLocaleString()}`,
        isWinner: s.total_points > 0 // Critério simples para demonstração
      }));

      setHistory(formatted);
      
      const total = formatted.length;
      const wins = formatted.filter(h => h.isWinner).length;
      const rate = total > 0 ? Math.round((wins / total) * 100) : 0;
      setStats({ total, wins, rate });

    } catch (err) {
      console.error("Erro ao carregar histórico:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[var(--background)] p-4 transition-colors duration-300 pb-24">
      <div className="mt-8 mb-8 text-center md:text-left">
        <h1 className="text-4xl font-black bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] bg-clip-text text-transparent italic tracking-tighter uppercase leading-none">MEU HISTÓRICO</h1>
        <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-2 italic">Resumo das suas últimas conquistas</p>
      </div>

      <div className="bg-[var(--surface)] p-6 rounded-[2.5rem] border border-[var(--border)] flex justify-between items-center mb-8 shadow-2xl transition-all">
        <div className="flex flex-col items-center flex-1 border-r border-[var(--border)]">
          <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Partidas</span>
          <span className="text-2xl font-black text-[var(--foreground)] italic">{stats.total}</span>
        </div>
        <div className="flex flex-col items-center flex-1 border-r border-[var(--border)] px-2">
          <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Ganhos</span>
          <span className="text-2xl font-black text-[var(--correct)] italic">{stats.wins}</span>
        </div>
        <div className="flex flex-col items-center flex-1">
          <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">WinRate</span>
          <span className="text-2xl font-black text-[var(--accent)] italic flex items-center gap-1">
            <TrendingUp size={20} /> {stats.rate}%
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="flex justify-center p-20">
            <Loader2 className="animate-spin text-[var(--primary)]" size={40} />
          </div>
        ) : !user ? (
          <div className="text-center p-10 opacity-50">
             <p className="text-xs font-black uppercase tracking-widest">Logue para ver seu histórico</p>
          </div>
        ) : history.length === 0 ? (
          <div className="text-center p-10 opacity-50">
             <p className="text-xs font-black uppercase tracking-widest">Nenhuma partida registrada</p>
          </div>
        ) : (
          history.map((item, idx) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="flex items-center justify-between p-5 bg-[var(--surface)] border border-[var(--border)] rounded-[2.5rem] shadow-xl transition-all hover:bg-[var(--surface-hover)]"
            >
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-2xl bg-[var(--background)] ${item.isWinner ? "text-[var(--correct)]" : "text-slate-500"}`}>
                  {item.isWinner ? <CheckCircle2 size={24} strokeWidth={3} /> : <XCircle size={24} strokeWidth={3} />}
                </div>
                <div>
                  <h4 className="font-black text-[var(--foreground)] italic tracking-tighter text-sm uppercase leading-none">{item.title}</h4>
                  <span className="text-[9px] text-slate-600 flex items-center gap-1 font-bold uppercase tracking-widest mt-2">
                    <Calendar size={10} /> {item.date}
                  </span>
                </div>
              </div>
              
              <div className="text-right">
                <span className={`block font-black text-xs uppercase italic tracking-tighter ${item.isWinner ? "text-[var(--correct)]" : "text-[var(--foreground)] opacity-70"}`}>
                  Finalizado
                </span>
                <span className="text-[11px] text-[var(--primary)] font-black tracking-widest leading-none mt-2 inline-block bg-[var(--primary)]/10 px-3 py-1.5 rounded-full border border-[var(--primary)]/10">
                  {item.points} {globalSettings.currency}
                </span>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
