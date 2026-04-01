"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Gamepad2, Loader2, Play, LayoutDashboard } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useUser } from "@/context/UserContext";

export default function Home() {
  const { user: contextUser } = useUser();
  const [nickname, setNickname] = useState("");
  const [quizId, setQuizId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  // Se o usuário já estiver logado, preenche o nickname
  useState(() => {
    if (contextUser?.nickname) setNickname(contextUser.nickname);
  });

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim() || !quizId.trim()) {
      setError("Preencha todos os campos");
      return;
    }

    setError("");
    setLoading(true);

    try {
      // 1. Verificando se e a sala existe pelo PIN
      const { data: quiz, error: quizError } = await supabase
        .from("quizzes")
        .select("id, status, pin")
        .eq("pin", quizId.trim().toUpperCase())
        .single();

      if (quizError || !quiz) {
        throw new Error("Código de partida inválido ou sala não existe.");
      }

      if (quiz.status === "finished") {
        throw new Error("Esta partida já encerrou.");
      }

      // 2. Identificar Usuário (Auth > LocalStorage > Novo)
      let userId: string;
      let finalNickname = nickname.trim();

      if (!contextUser) {
        throw new Error("Apenas membros logados com e-mail podem entrar no quiz. Vá em 'Acesso de Administrador' ou 'Perfil' para entrar.");
      }
      
      userId = contextUser.id;
      finalNickname = contextUser.nickname;

      // 3. Vincular usuário ao quiz (Upsert Score)
      const { error: scoreError } = await supabase
        .from("scores")
        .upsert({ 
          user_id: userId, 
          quiz_id: quiz.id,
        }, { onConflict: 'user_id, quiz_id' });

      if (scoreError) {
        throw new Error("Erro ao vincular você a esta partida.");
      }

      // 4. Salvar na sessão local e navegar
      localStorage.setItem("ita_quiz_user", JSON.stringify({ id: userId, nickname: finalNickname }));
      router.push(`/play/${quiz.id}`);
    } catch (err: any) {
      setError(err.message || "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex 1 items-center justify-center min-h-screen relative p-4 bg-[var(--background)] transition-colors duration-300">
      
      {/* Background Decorativo */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-[var(--primary)]/10 via-[var(--background)] to-[var(--background)] z-0" />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm p-4 relative z-10"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-[var(--primary)] rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30 mb-4 transition-all">
            <Gamepad2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-tr from-[var(--foreground)] to-[var(--foreground)]/60 bg-clip-text text-transparent">
            ITA QUIZ
          </h1>
        </div>

        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <input
              type="text"
              placeholder="Código do Quiz (ID)"
              value={quizId}
              onChange={(e) => setQuizId(e.target.value)}
              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-4 text-center font-bold text-lg text-[var(--foreground)] placeholder:text-slate-500 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all shadow-sm"
            />
          </div>
          
          {!contextUser && (
            <div className="mb-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 text-center text-xs font-bold uppercase tracking-widest leading-relaxed">
              ⚠️ Login Obrigatório<br/>
              <span className="opacity-70 text-[10px]">Apenas membros registrados podem participar.</span>
            </div>
          )}

          <div>
            <input
              type="text"
              placeholder="Seu Nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={20}
              readOnly={!!contextUser}
              className={`w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-4 text-center font-bold text-lg text-[var(--foreground)] placeholder:text-slate-500 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all shadow-sm ${contextUser ? 'opacity-80' : ''}`}
            />
          </div>

          {error && (
            <motion.p 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="text-red-500 text-sm text-center font-medium bg-red-500/10 py-2 rounded-lg border border-red-500/20"
            >
              {error}
            </motion.p>
          )}

          <button
            type="submit"
            disabled={loading || !nickname || !quizId}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] hover:opacity-90 text-white px-4 py-4 rounded-xl font-bold text-lg transform hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none disabled:transform-none shadow-lg shadow-indigo-500/25"
          >
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
              <>
                <Play className="w-5 h-5 fill-current" />
                ENTRAR NO JOGO
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            type="button"
            onClick={() => router.push('/admin')}
            className="text-xs text-slate-500 hover:text-[var(--primary)] transition-colors uppercase font-bold tracking-widest opacity-60 hover:opacity-100"
          >
            Acesso de Administrador
          </button>
        </div>
      </motion.div>
    </div>
  );
}
