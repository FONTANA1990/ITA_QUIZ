"use client";

import { useEffect, useState, use } from "react";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Trophy, CheckCircle2, XCircle, Clock, Gamepad2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";

export default function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: quizId } = use(params);
  const { preferences, user: contextUser } = useUser();
  const [quiz, setQuiz] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [answered, setAnswered] = useState(false);
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isTimeUp, setIsTimeUp] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!contextUser) {
      router.push("/");
      return;
    }
    
    fetchInitialData();
    const channel = supabase
      .channel(`player-quiz-${quizId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "quizzes", filter: `id=eq.${quizId}` }, (payload) => {
        const newQuiz = payload.new;
        setQuiz((prev: any) => {
          if (newQuiz.current_question_index !== prev?.current_question_index) {
            setAnswered(false);
            setLastAnswerCorrect(null);
          }
          return { ...prev, ...newQuiz };
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [quizId, contextUser]);

  // Cronômetro progressivo/regressivo
  useEffect(() => {
    if (!quiz || quiz.status !== "playing" || quiz.timer_per_question === null || !quiz.question_started_at) {
      setTimeLeft(null);
      setIsTimeUp(false);
      return;
    }

    const interval = setInterval(() => {
      const startedAt = new Date(quiz.question_started_at).getTime();
      const now = new Date().getTime();
      const elapsed = Math.floor((now - startedAt) / 1000);
      const remaining = Math.max(0, quiz.timer_per_question - elapsed);
      
      setTimeLeft(remaining);
      if (remaining <= 0) {
        setIsTimeUp(true);
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [quiz?.current_question_index, quiz?.question_started_at, quiz?.status]);

  const fetchInitialData = async () => {
    const { data: quizData } = await supabase.from("quizzes").select("*").eq("id", quizId).single();
    setQuiz(quizData);

    const { data: questionsData } = await supabase
      .from("questions")
      .select("*")
      .eq("quiz_id", quizId)
      .order("order_index", { ascending: true });
    setQuestions(questionsData || []);
    
    setLoading(false);
  };

  const submitAnswer = async (option: string) => {
    if (!contextUser || !quiz || answered || quiz.status !== "playing" || isTimeUp) return;
    
    setAnswered(true);
    const currentQuestion = questions[quiz.current_question_index];
    const isCorrect = option === currentQuestion.correct_option;
    setLastAnswerCorrect(isCorrect);

    await supabase.from("answers").insert([
      {
        user_id: contextUser.id,
        question_id: currentQuestion.id,
        selected_option: option,
        is_correct: isCorrect
      }
    ]);
  };

  if (loading) return (
    <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
      <Loader2 className="w-12 h-12 text-[var(--primary)] animate-spin" />
    </div>
  );

  const currentQuestion = questions[quiz?.current_question_index];

  return (
    <div className={`min-h-screen bg-[var(--background)] text-[var(--foreground)] flex flex-col p-4 overflow-hidden relative transition-colors duration-500`}>
      
      {/* App-like Header */}
      <div className="flex justify-between items-center bg-[var(--surface)]/80 p-3 rounded-2xl border border-[var(--border)] backdrop-blur-lg mb-4 relative z-10 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-tr from-[var(--primary)] to-[var(--secondary)] rounded-xl flex items-center justify-center text-2xl shadow-[0_0_10px_rgba(var(--primary),0.3)]">
             {preferences.avatar}
          </div>
          <div className="flex flex-col">
            <span className="font-black text-[var(--foreground)] italic tracking-tighter text-sm leading-none">{contextUser?.nickname}</span>
            <span className="text-[8px] uppercase tracking-[0.2em] font-bold text-slate-500 mt-1">
              Nível {Math.floor((contextUser?.total_points || 0) / 500) + 1} • {
                (contextUser?.total_points || 0) >= 5000 ? "Ouro" : 
                (contextUser?.total_points || 0) >= 1000 ? "Prata" : "Bronze"
              }
            </span>
          </div>
        </div>
        <div className="bg-[var(--background)]/80 px-4 py-1.5 rounded-full border border-[var(--border)] font-black text-[10px] tracking-widest text-slate-500">
           #{quizId.slice(0, 6)}
        </div>
      </div>

      <div className="flex-1 flex flex-col relative z-10">
        <AnimatePresence mode="wait">
          {quiz?.status === "waiting" && (
            <motion.div 
              key="waiting"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="flex-1 flex flex-col items-center justify-center text-center p-8"
            >
              <div className="w-32 h-32 bg-[var(--primary)]/10 rounded-[3rem] flex items-center justify-center mb-8 relative">
                 <div className="absolute inset-0 bg-[var(--primary)]/20 blur-2xl animate-pulse rounded-full" />
                 <Gamepad2 className="w-16 h-16 text-[var(--primary)] relative z-10" />
              </div>
              <h2 className="text-4xl font-black italic uppercase tracking-tighter text-glow-blue">Aguardando Host...</h2>
              <p className="mt-4 text-slate-500 font-bold uppercase text-xs tracking-widest animate-pulse">A partida começará em breve!</p>
            </motion.div>
          )}

          {quiz?.status === "playing" && currentQuestion && (
            <motion.div 
              key={quiz.current_question_index}
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              className="flex-1 flex flex-col"
            >
              {!answered ? (
                <>
                  <div className="text-center mb-6">
                    <div className="flex justify-center gap-4 mb-4">
                      <span className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-3 bg-[var(--surface)] px-4 py-1.5 rounded-full border border-[var(--border)]">
                        Nível {Math.floor((contextUser?.total_points || 0) / 500) + 1} • {
                          (contextUser?.total_points || 0) >= 5000 ? "Ouro" : 
                          (contextUser?.total_points || 0) >= 1000 ? "Prata" : "Bronze"
                        }
                      </span>
                      <span className="text-[var(--primary)] text-xs font-black uppercase tracking-[0.3em] bg-[var(--primary)]/10 px-4 py-1 rounded-full border border-[var(--primary)]/20">
                        Questão {quiz.current_question_index + 1}
                      </span>
                      {timeLeft !== null && (
                        <span className={`text-xs font-black uppercase tracking-[0.3em] px-4 py-1 rounded-full border flex items-center gap-2 ${timeLeft <= 5 ? 'bg-red-500/20 border-red-500/50 text-red-500 animate-pulse' : 'bg-amber-500/10 border-amber-500/20 text-amber-500 font-black'}`}>
                          <Clock size={12} /> {timeLeft}s
                        </span>
                      )}
                    </div>
                    <h2 className="text-2xl font-black mt-2 text-[var(--foreground)] leading-tight uppercase italic tracking-tighter">
                      {isTimeUp ? "TEMPO ESGOTADO!" : "Escolha Agora!"}
                    </h2>
                  </div>

                  <div className={`grid gap-3 flex-1 ${Object.keys(currentQuestion.options).length > 4 ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2'}`}>
                    {Object.entries(currentQuestion.options).map(([key, value]) => (
                      <motion.button
                        key={key}
                        whileTap={{ scale: 0.95 }}
                        disabled={isTimeUp}
                        onClick={() => submitAnswer(key)}
                        className={`p-4 md:p-6 rounded-3xl border-2 flex flex-col items-center justify-center gap-2 md:gap-3 transition-all shadow-xl group disabled:opacity-50 min-h-[120px] h-full ${
                          key === "A" ? "bg-[#EF4444] border-red-400/50" :
                          key === "B" ? "bg-[#3B82F6] border-blue-400/50" :
                          key === "C" ? "bg-[#F59E0B] border-amber-400/50" :
                          key === "D" ? "bg-[#10B981] border-emerald-400/50" :
                          "bg-[#A855F7] border-purple-400/50" // Cor para E
                        } text-white`}
                      >
                         <div className="bg-white/20 w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-2xl font-black text-xl md:text-2xl group-hover:bg-white/30 transition-colors shrink-0">
                           {key}
                         </div>
                         <span className="font-extrabold uppercase italic tracking-tighter text-[10px] md:text-sm text-center leading-tight px-1 word-break break-words max-w-full">
                           {value as string}
                         </span>
                      </motion.button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className={`w-28 h-28 rounded-[2.5rem] flex items-center justify-center mb-8 shadow-2xl ${lastAnswerCorrect ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-red-500 shadow-red-500/20'}`}
                  >
                    {lastAnswerCorrect ? <CheckCircle2 size={56} className="text-white" /> : <XCircle size={56} className="text-white" />}
                  </motion.div>
                  <h2 className={`text-4xl font-black italic uppercase tracking-tighter ${lastAnswerCorrect ? 'text-emerald-500' : 'text-red-500'}`}>
                    {lastAnswerCorrect ? "CERTA RESPOSTA!" : "ERROU!"}
                  </h2>
                  <p className="mt-4 text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em]">{lastAnswerCorrect ? "Você ganhou +100 " + (preferences.currency === 'Pontos' ? 'Pontos' : preferences.currency + " Bíblicas") : "Não desanime, a próxima vem aí!"}</p>
                </div>
              )}
            </motion.div>
          )}

          {quiz?.status === "finished" && (
            <motion.div 
              key="finished"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-[var(--surface)]/50 rounded-[3rem] border border-[var(--border)] backdrop-blur-md"
            >
              <div className="w-24 h-24 bg-amber-500/10 rounded-full flex items-center justify-center mb-6">
                 <Trophy className="w-12 h-12 text-amber-500" />
              </div>
              <h2 className="text-4xl font-black italic uppercase tracking-tighter text-glow-blue">Partida Finalizada!</h2>
              <p className="mt-4 text-slate-400 font-medium">Veja o resultado final no telão do administrador!</p>
              <button 
                onClick={() => router.push("/")}
                className="mt-12 bg-[var(--primary)] px-8 py-4 rounded-full font-black text-[10px] uppercase tracking-[0.2em] text-white"
              >
                Voltar ao Início
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
