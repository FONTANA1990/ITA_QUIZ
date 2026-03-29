"use client";

import { motion } from "framer-motion";
import { History, CheckCircle2, XCircle, TrendingUp, Calendar } from "lucide-react";
import { useUser } from "@/context/UserContext";

const mockHistory = [
  { id: 1, title: "Quiz Bíblico #1", date: "Ontem, 20:30", result: "Vitória", points: "+1.200", isWinner: true },
  { id: 2, title: "História Geral", date: "25 Mar, 15:45", result: "3º Lugar", points: "+800", isWinner: false },
  { id: 3, title: "Geral Knowledge", date: "20 Mar, 10:20", result: "Derrota", points: "+100", isWinner: false },
  { id: 4, title: "Fatos Rápidos", date: "15 Mar, 22:00", result: "Vitória", points: "+1.500", isWinner: true },
];

export default function GameHistory() {
  const { preferences } = useUser();

  return (
    <div className="flex flex-col min-h-screen bg-[var(--background)] p-4 transition-colors duration-300 pb-24">
      <div className="mt-8 mb-8 text-center md:text-left">
        <h1 className="text-4xl font-black bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] bg-clip-text text-transparent italic tracking-tighter uppercase leading-none">MEU HISTÓRICO</h1>
        <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-2 italic">Resumo das suas últimas conquistas</p>
      </div>

      <div className="bg-[var(--surface)] p-6 rounded-[2.5rem] border border-[var(--border)] flex justify-between items-center mb-8 shadow-2xl transition-all">
        <div className="flex flex-col items-center flex-1 border-r border-[var(--border)]">
          <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Partidas</span>
          <span className="text-2xl font-black text-[var(--foreground)] italic">42</span>
        </div>
        <div className="flex flex-col items-center flex-1 border-r border-[var(--border)] px-2">
          <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Vitórias</span>
          <span className="text-2xl font-black text-[var(--correct)] italic">18</span>
        </div>
        <div className="flex flex-col items-center flex-1">
          <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">WinRate</span>
          <span className="text-2xl font-black text-[var(--accent)] italic flex items-center gap-1">
            <TrendingUp size={20} /> 43%
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {mockHistory.map((item, idx) => (
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
              <span className={`block font-black text-xs uppercase italic tracking-tighter ${item.isWinner ? "text-[var(--correct)]" : "text-[var(--incorrect)] opacity-70"}`}>
                {item.result}
              </span>
              <span className="text-[11px] text-[var(--primary)] font-black tracking-widest leading-none mt-2 inline-block bg-[var(--primary)]/10 px-3 py-1.5 rounded-full border border-[var(--primary)]/10">
                {item.points} {preferences.currency}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
