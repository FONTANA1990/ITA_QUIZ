"use client";

import { motion } from "framer-motion";
import { Trophy, Medal, ArrowUpRight } from "lucide-react";
import { useUser } from "@/context/UserContext";

const mockRankings = [
  { rank: 1, name: "Lucas Dev", points: 24500, winRate: "92%" },
  { rank: 2, name: "Gabi Codes", points: 22100, winRate: "88%" },
  { rank: 3, name: "Thiago ITA", points: 19800, winRate: "85%" },
  { rank: 4, name: "Ana Maria", points: 15400, winRate: "78%" },
  { rank: 5, name: "Bruno X", points: 12100, winRate: "70%" },
];

export default function Leaderboard() {
  const { preferences } = useUser();

  return (
    <div className="flex flex-col min-h-screen p-4 bg-[var(--background)] transition-colors duration-300 pb-24">
      <div className="mt-8 mb-8 text-center">
        <h1 className="text-4xl font-black bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] bg-clip-text text-transparent italic tracking-tighter uppercase leading-none">
          RANKING GLOBAL
        </h1>
        <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-2">Os melhores competidores</p>
      </div>

      <div className="space-y-3">
        {mockRankings.map((user, idx) => (
          <motion.div
            key={user.rank}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.05 }}
            className={`flex items-center justify-between p-5 rounded-[2rem] border shadow-2xl transition-all ${
              idx === 0 
                ? "bg-[var(--primary)]/10 border-[var(--primary)]/40 shadow-indigo-500/10" 
                : "bg-[var(--surface)] border-[var(--border)]"
            }`}
          >
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black shadow-xl ${
                idx === 0 ? "bg-amber-500 text-white rotate-3" : 
                idx === 1 ? "bg-slate-300 text-slate-900 -rotate-3" : 
                idx === 2 ? "bg-orange-600 text-white rotate-2" : "bg-[var(--background)] text-slate-500"
              }`}>
                {idx < 3 ? <Medal size={24} strokeWidth={3} /> : <span className="text-xs font-black">{user.rank}</span>}
              </div>
              <div>
                <h3 className="font-black text-[var(--foreground)] italic tracking-tighter text-lg uppercase leading-none">{user.name}</h3>
                <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest mt-1 block tracking-[0.2em]">{user.winRate} Vitórias</span>
              </div>
            </div>
            
            <div className="text-right">
              <span className={`block text-xl font-black italic tracking-tighter ${idx === 0 ? "text-amber-500" : "text-[var(--primary)]"}`}>
                {user.points.toLocaleString()}
              </span>
              <span className="text-[9px] text-[var(--secondary)] font-black uppercase tracking-widest flex items-center gap-0.5 justify-end">
                {preferences.currency} <ArrowUpRight size={10} strokeWidth={4} />
              </span>
            </div>
          </motion.div>
        ))}
      </div>
      
      <div className="mt-8">
        <div className="bg-gradient-to-tr from-[var(--primary)] to-[var(--secondary)] p-6 rounded-[2.5rem] text-white shadow-2xl shadow-indigo-500/20 relative overflow-hidden">
          <div className="absolute -top-4 -right-4 bg-white/10 w-24 h-24 rounded-full blur-2xl" />
          <Trophy className="w-10 h-10 opacity-40 mb-4" />
          <h4 className="text-2xl font-black italic uppercase tracking-tighter leading-none">DOMINE O TOPO</h4>
          <p className="text-[10px] font-bold opacity-70 uppercase tracking-widest mt-2 max-w-[200px]">Suba no ranking nacional e ganhe prêmios exclusivos.</p>
        </div>
      </div>
    </div>
  );
}
