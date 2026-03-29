"use client";

import { useEffect, useState, use } from "react";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Play, SkipForward, Trophy, BarChart2, Loader2, Clock, Crown, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";

export default function AdminRoom({ params }: { params: Promise<{ id: string }> }) {
  const { id: quizId } = use(params);
  const { preferences } = useUser();
  const [quiz, setQuiz] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [scores, setScores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchQuizData();
    const quizChannel = subscribeToQuiz();
    const participantsChannel = subscribeToParticipants();

    return () => {
      supabase.removeChannel(quizChannel);
      supabase.removeChannel(participantsChannel);
    };
  }, [quizId]);

  // Cronômetro do Admin
  useEffect(() => {
    if (!quiz || quiz.status !== "playing" || quiz.timer_per_question === null || !quiz.question_started_at) {
      setTimeLeft(null);
      return;
    }

    const interval = setInterval(() => {
      const startedAt = new Date(quiz.question_started_at).getTime();
      const now = new Date().getTime();
      const elapsed = Math.floor((now - startedAt) / 1000);
      const remaining = Math.max(0, quiz.timer_per_question - elapsed);
      setTimeLeft(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [quiz?.current_question_index, quiz?.question_started_at, quiz?.status]);

  const fetchQuizData = async () => {
    setLoading(true);
    const { data: quizData } = await supabase.from("quizzes").select("*").eq("id", quizId).single();
    setQuiz(quizData);

    const { data: questionsData } = await supabase
      .from("questions")
      .select("*")
      .eq("quiz_id", quizId)
      .order("order_index", { ascending: true });
    setQuestions(questionsData || []);

    const { data: scoresData } = await supabase
      .from("scores")
      .select("*, users(nickname)")
      .eq("quiz_id", quizId)
      .order("total_points", { ascending: false });
    
    setScores(scoresData || []);
    setParticipants(scoresData?.map(s => ({ id: s.user_id, nickname: s.users?.nickname || "Anônimo" })) || []);
    setLoading(false);
  };

  const subscribeToQuiz = () => {
    return supabase
      .channel(`admin-quiz-${quizId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "quizzes", filter: `id=eq.${quizId}` }, (payload) => {
        setQuiz((prev: any) => ({ ...prev, ...payload.new }));
      })
      .subscribe();
  };

  const subscribeToParticipants = () => {
    return supabase
      .channel(`admin-participants-${quizId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "scores", filter: `quiz_id=eq.${quizId}` }, async (payload) => {
        const { data: userData } = await supabase.from("users").select("nickname").eq("id", payload.new.user_id).single();
        setParticipants((prev) => [...prev, { id: payload.new.user_id, nickname: userData?.nickname || "Novo Jogador" }]);
      })
      .subscribe();
  };

  const startQuiz = async () => {
    setActionLoading(true);
    await supabase.from("quizzes").update({ 
      status: "playing", 
      current_question_index: 0,
      question_started_at: new Date().toISOString()
    }).eq("id", quizId);
    setActionLoading(false);
  };

  const nextQuestion = async () => {
    if (quiz.current_question_index + 1 >= questions.length) {
      await supabase.from("quizzes").update({ status: "finished" }).eq("id", quizId);
      const { data: finalScores } = await supabase.from("scores").select("*, users(nickname)").eq("quiz_id", quizId).order("total_points", { ascending: false });
      setScores(finalScores || []);
    } else {
      await supabase.from("quizzes").update({ 
        current_question_index: quiz.current_question_index + 1,
        question_started_at: new Date().toISOString()
      }).eq("id", quizId);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
      <Loader2 className="w-12 h-12 text-[var(--primary)] animate-spin" />
    </div>
  );

  const currentQuestionIdx = quiz?.current_question_index || 0;
  const currentQuestion = questions[currentQuestionIdx];

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] p-4 md:p-12 transition-colors duration-300">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-[var(--surface)] p-8 rounded-[3rem] border border-[var(--border)] shadow-2xl relative overflow-hidden">
           <div className="absolute top-0 right-0 p-12 bg-[var(--primary)]/5 blur-3xl rounded-full -mr-16 -mt-16" />
           <div className="flex items-center gap-6 relative z-10">
              <button 
                onClick={() => router.push('/admin')}
                aria-label="Voltar ao Painel"
                className="p-3 bg-[var(--background)] rounded-2xl border border-[var(--border)] hover:bg-[var(--surface-hover)] transition-all"
              >
                 <ArrowLeft size={20} />
              </button>
              <div>
                <h1 className="text-4xl font-black italic uppercase tracking-tighter leading-none">{quiz?.title}</h1>
                <div className="flex items-center gap-3 mt-2">
                   <span className="text-xs font-bold text-slate-500 uppercase tracking-widest bg-[var(--background)] px-3 py-1 rounded-full border border-[var(--border)]">Entrar com PIN: <span className="text-[var(--primary)]">{quiz?.pin}</span></span>
                   <span className="text-xs font-bold text-slate-500 uppercase tracking-widest bg-[var(--background)] px-3 py-1 rounded-full border border-[var(--border)] flex items-center gap-2">
                      <Users size={14} className="text-[var(--primary)]" /> {participants.length} Jogadores
                   </span>
                </div>
              </div>
           </div>

           <div className="flex gap-3 relative z-10">
              {quiz?.status === "waiting" && (
                <button
                  onClick={startQuiz}
                  disabled={actionLoading || participants.length === 0}
                  className="bg-[var(--primary)] hover:opacity-90 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-indigo-500/20 flex items-center gap-2 disabled:opacity-50"
                >
                  <Play size={18} fill="currentColor" /> COMEÇAR AGORA
                </button>
              )}
              {quiz?.status === "playing" && (
                <button
                  onClick={nextQuestion}
                  className="bg-emerald-500 hover:bg-emerald-400 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-emerald-500/20 flex items-center gap-2"
                >
                  <SkipForward size={18} fill="currentColor" /> {currentQuestionIdx + 1 === questions.length ? "FINALIZAR QUIZ" : "PRÓXIMA PERGUNTA"}
                </button>
              )}
           </div>
        </div>

        <main className="flex flex-col gap-8">
            {quiz?.status === "waiting" && (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center py-20 bg-[var(--surface)]/30 rounded-[3rem] border-2 border-dashed border-[var(--border)]"
              >
                <div className="w-24 h-24 bg-[var(--primary)]/20 rounded-full flex items-center justify-center mb-6">
                  <Users className="w-12 h-12 text-[var(--primary)] animate-pulse" />
                </div>
                <h2 className="text-4xl font-black mb-4 uppercase tracking-tighter italic">Aguardando Galera...</h2>
                <div className="flex flex-wrap justify-center gap-3 mt-12 w-full max-w-2xl">
                  {participants.map((p) => (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      key={p.id}
                      className="bg-[var(--surface)] px-5 py-2.5 rounded-2xl border border-[var(--border)] font-black text-xs uppercase tracking-widest text-[var(--foreground)] opacity-80"
                    >
                      {p.nickname}
                    </motion.span>
                  ))}
                  {participants.length === 0 && <span className="text-slate-600 font-bold uppercase tracking-widest text-xs animate-pulse">Nenhum jogador na sala ainda...</span>}
                </div>
              </motion.div>
            )}

            {quiz?.status === "playing" && currentQuestion && (
              <motion.div
                key={currentQuestionIdx}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                className="space-y-8"
              >
                <div className="bg-[var(--surface)] p-12 rounded-[3.5rem] border border-[var(--border)] shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-24 bg-[var(--primary)]/5 blur-3xl rounded-full -mr-20 -mt-20" />
                  <div className="flex justify-between items-center mb-6 relative z-10">
                    <span className="text-[var(--primary)] font-black uppercase tracking-[0.3em] text-xs py-1.5 px-4 bg-[var(--primary)]/10 rounded-full border border-[var(--primary)]/20">Pergunta {currentQuestionIdx + 1} de {questions.length}</span>
                    {timeLeft !== null && (
                       <div className={`flex items-center gap-2 px-6 py-2 rounded-full border font-black text-sm shadow-lg ${timeLeft <= 5 ? 'bg-red-500 border-red-400 text-white animate-pulse' : 'bg-[var(--background)] border-[var(--border)] text-[var(--foreground)]'}`}>
                         <Clock size={18} /> {timeLeft}s restantes
                       </div>
                    )}
                  </div>
                  <h2 className="text-5xl font-black leading-tight italic uppercase tracking-tight relative z-10">{currentQuestion.question_text}</h2>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                   {Object.entries(currentQuestion.options).map(([key, value]) => (
                     <div key={key} className={`p-8 rounded-[2.5rem] border-2 transition-all flex items-center gap-6 ${
                       key === 'A' ? 'bg-red-500/10 border-red-500/30' : 
                       key === 'B' ? 'bg-blue-500/10 border-blue-500/30' :
                       key === 'C' ? 'bg-amber-500/10 border-amber-500/30' : 'bg-emerald-500/10 border-emerald-500/30'
                     }`}>
                        <div className={`w-14 h-14 flex items-center justify-center rounded-2xl font-black text-2xl text-white shadow-lg ${
                           key === 'A' ? 'bg-red-500' : 
                           key === 'B' ? 'bg-blue-500' :
                           key === 'C' ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}>{key}</div>
                        <span className="text-xl font-black uppercase italic tracking-tighter opacity-90">{value as string}</span>
                     </div>
                   ))}
                </div>
              </motion.div>
            )}

            {quiz?.status === "finished" && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-8"
              >
                  <div className="text-center bg-[var(--surface)] py-12 rounded-[3.5rem] border border-[var(--border)] shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-amber-500/10 blur-[100px] rounded-full" />
                    <Trophy className="w-20 h-20 text-amber-500 mx-auto mb-6 relative z-10" />
                    <h2 className="text-6xl font-black italic uppercase tracking-tighter relative z-10">Ranking Final</h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {scores.map((s, idx) => (
                      <motion.div
                        key={s.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className={`bg-[var(--surface)] p-8 rounded-[2.5rem] border border-[var(--border)] shadow-xl flex flex-col items-center text-center relative overflow-hidden ${idx === 0 ? 'ring-4 ring-amber-500/30' : ''}`}
                      >
                         {idx === 0 && <Crown className="text-amber-500 absolute top-4 right-4" size={32} />}
                         <div className={`w-20 h-20 rounded-full flex items-center justify-center text-4xl mb-4 border-4 ${
                           idx === 0 ? 'bg-amber-500/20 border-amber-500' : 
                           idx === 1 ? 'bg-slate-300/20 border-slate-300' : 'bg-orange-400/20 border-orange-400'
                         }`}>
                           {idx + 1}º
                         </div>
                         <h3 className="text-2xl font-black uppercase italic tracking-tighter mb-2">{s.users?.nickname}</h3>
                         <span className="text-[var(--primary)] font-black text-xl uppercase italic tracking-tighter">
                            {s.total_points} {preferences.currency}
                         </span>
                      </motion.div>
                    ))}
                  </div>
              </motion.div>
            )}
        </main>
      </div>
    </div>
  );
}
