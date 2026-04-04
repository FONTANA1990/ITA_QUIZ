"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Gamepad2, Loader2, Play, LayoutDashboard } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useUser } from "@/context/UserContext";

export default function Home() {
  const { user: contextUser, activeOrg, loading: userLoading } = useUser();
  const [nickname, setNickname] = useState("");
  const [quizId, setQuizId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeEvents, setActiveEvents] = useState<any[]>([]);
  const router = useRouter();
  
  useEffect(() => {
    if (!userLoading) {
      fetchActiveEvents();
    }
  }, [activeOrg?.id, userLoading]);

  const fetchActiveEvents = async () => {
    let query = supabase
      .from("quizzes")
      .select("id, title, pin, created_at, organization_id")
      .eq("quiz_type", "event")
      .eq("is_active", true)
      .neq("status", "finished");

    // Se estiver logado e tiver uma base ativa, filtra por ela.
    // Se não estiver logado, não mostra eventos privados (que possuem organization_id)
    if (activeOrg) {
      query = query.eq("organization_id", activeOrg.id);
    } else {
      // Se não houver base ativa, mostra apenas eventos "globais" (sem org)
      // ou podemos optar por não mostrar nada para incentivar o login/seleção de base
      query = query.is("organization_id", null);
    }

    const { data } = await query.order("created_at", { ascending: false });
    setActiveEvents(data || []);
  };

  // Se o usuário já estiver logado, preenche o nickname
  useEffect(() => {
    if (contextUser?.nickname) setNickname(contextUser.nickname);
  }, [contextUser?.nickname]);

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
        .select("id, status, pin, quiz_type")
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

      // 3. Vincular usuário ao quiz (Garantir entrada na tabela de scores)
      const { data: existingScore } = await supabase
        .from("scores")
        .select("id")
        .eq("user_id", userId)
        .eq("quiz_id", quiz.id)
        .single();

      if (!existingScore) {
        const { error: scoreError } = await supabase
          .from("scores")
          .insert({ 
            user_id: userId, 
            quiz_id: quiz.id,
            total_points: 0
          });

        if (scoreError) {
          throw new Error("Erro ao vincular você a esta partida.");
        }
      }

      // 4. Se for evento, verificar se já terminou de responder tudo
      if (quiz.quiz_type === 'event') {
        const { data: qData } = await supabase.from("questions").select("id").eq("quiz_id", quiz.id);
        const qIds = (qData || []).map(q => q.id);
        
        if (qIds.length > 0) {
          const { count } = await supabase
            .from("answers")
            .select("*", { count: 'exact', head: true })
            .eq("user_id", userId)
            .in("question_id", qIds);

          if (count !== null && count >= qIds.length) {
            throw new Error("Você já participou deste evento!");
          }
        }
      }

      // 5. Salvar na sessão local e navegar
      localStorage.setItem("ita_quiz_user", JSON.stringify({ id: userId, nickname: finalNickname }));
      router.push(`/play/${quiz.id}`);
    } catch (err: any) {
      setError(err.message || "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  };

  const joinEvent = async (quiz: any) => {
    if (!contextUser) {
      setError("Faça login para entrar no evento.");
      return;
    }
    setQuizId(quiz.pin);
    // Pequeno delay para o feedback visual de preenchimento do PIN
    setTimeout(() => {
      // @ts-ignore
      handleJoin({ preventDefault: () => {} });
    }, 100);
  };

  return (
    <div className="flex items-center justify-center min-h-screen relative p-4 bg-[var(--background)] transition-colors duration-300">
      
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

        {/* Eventos Ativos Section */}
        {activeEvents.length > 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-12 space-y-4"
          >
            <div className="flex items-center gap-2 mb-4 px-2">
              <div className="h-[2px] flex-1 bg-gradient-to-r from-transparent to-[var(--border)]" />
              <div className="flex flex-col items-center">
                <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] whitespace-nowrap">Eventos Ativos</h2>
                {activeOrg && (
                  <span className="text-[8px] font-bold text-[var(--primary)] uppercase tracking-wider mt-1 opacity-80">
                    🏢 Base: {activeOrg.name}
                  </span>
                )}
              </div>
              <div className="h-[2px] flex-1 bg-gradient-to-l from-transparent to-[var(--border)]" />
            </div>

            <div className="grid gap-3 overflow-hidden">
              {activeEvents.map((event) => (
                <motion.button
                  key={event.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => joinEvent(event)}
                  className="w-full bg-[var(--surface)] border border-[var(--border)] p-5 rounded-3xl flex flex-col items-start gap-2 group transition-all hover:border-[var(--primary)]/50 hover:shadow-xl hover:shadow-[var(--primary)]/5"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-[8px] font-black text-[var(--primary)] uppercase tracking-widest bg-[var(--primary)]/10 px-2 py-0.5 rounded-full border border-[var(--primary)]/20">EVENTO ABERTO</span>
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter opacity-60">PIN: {event.pin}</span>
                  </div>
                  <h3 className="font-black text-lg text-[var(--foreground)] uppercase italic tracking-tighter leading-none group-hover:text-[var(--primary)] transition-colors text-left">{event.title}</h3>
                  <div className="w-full flex items-center justify-between mt-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Toque para participar</span>
                    <div className="w-6 h-6 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)] group-hover:bg-[var(--primary)] group-hover:text-white transition-all">
                      <Play size={12} className="fill-current" />
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
