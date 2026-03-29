"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { parseCSV } from "@/lib/csv-parser";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Upload, CheckCircle2, AlertCircle, Settings, Plus, 
  FileText, Download, Loader2, Trash2, RotateCcw, 
  ExternalLink, Clock, Gamepad2 
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";

export default function AdminDashboard() {
  const { preferences } = useUser();
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState<number | null>(null);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchQuizzes();
  }, []);

  const fetchQuizzes = async () => {
    const { data } = await supabase
      .from("quizzes")
      .select("*")
      .order("created_at", { ascending: false });
    setQuizzes(data || []);
  };

  const downloadTemplate = () => {
    const headers = "pergunta,opcao_a,opcao_b,opcao_c,opcao_d,resposta_correta\n";
    const example = "Qual a capital da França?,Paris,Londres,Berlim,Madrid,A";
    const csvContent = "\uFEFF" + headers + example;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "modelo_quiz_ita.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFile(e.target.files[0]);
  };

  const handleCreateQuiz = async () => {
    if (!title || !file) {
      setStatus({ type: "error", msg: "Preencha o título e selecione o CSV!" });
      return;
    }

    setLoading(true);
    setStatus(null);

    try {
      const questionsData = await parseCSV(file);
      
      const { data: quiz, error: quizError } = await supabase
        .from("quizzes")
        .insert([{ 
          title, 
          status: "waiting", 
          is_active: false,
          timer_per_question: timer
        }])
        .select()
        .single();

      if (quizError) throw quizError;

      const pin = quiz.id.slice(0, 6).toUpperCase();
      await supabase.from("quizzes").update({ pin }).eq("id", quiz.id);

      const formattedQuestions = questionsData.map((q, idx) => ({
        ...q,
        quiz_id: quiz.id,
        order_index: idx
      }));

      const { error: questionsError } = await supabase.from("questions").insert(formattedQuestions);
      if (questionsError) throw questionsError;

      setStatus({ type: "success", msg: "Quiz criado com sucesso! Redirecionando..." });
      fetchQuizzes();
      setTimeout(() => router.push(`/admin/${quiz.id}`), 1000);
    } catch (err: any) {
      setStatus({ type: "error", msg: err.message || "Erro ao processar o arquivo CSV." });
    } finally {
      setLoading(false);
    }
  };

  const handleResetQuiz = async (id: string) => {
    if (!window.confirm("Isso apagará todas as respostas e scores deste quiz. Deseja continuar?")) return;
    
    setLoading(true);
    try {
      await supabase.from("scores").delete().eq("quiz_id", id);
      const { data: questions } = await supabase.from("questions").select("id").eq("quiz_id", id);
      if (questions && questions.length > 0) {
        const qIds = questions.map(q => q.id);
        await supabase.from("answers").delete().in("question_id", qIds);
      }
      await supabase.from("quizzes").update({ 
        status: "waiting", 
        current_question_index: 0, 
        question_started_at: null 
      }).eq("id", id);
      
      fetchQuizzes();
      setStatus({ type: "success", msg: "Partida reiniciada com sucesso!" });
    } catch (err: any) {
      setStatus({ type: "error", msg: "Erro ao reiniciar quiz." });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteQuiz = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja excluir permanentemente este quiz?")) return;
    
    setLoading(true);
    setStatus(null);
    try {
      const { error } = await supabase.from("quizzes").delete().eq("id", id);
      
      if (error) {
        console.error("Erro ao deletar quiz:", error);
        setStatus({ type: "error", msg: `Erro ao excluir: ${error.message}` });
        return;
      }

      fetchQuizzes();
      setStatus({ type: "success", msg: "Quiz excluído com sucesso!" });
    } catch (err: any) {
      console.error("Catch erro deletar quiz:", err);
      setStatus({ type: "error", msg: "Erro inesperado ao excluir quiz." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)] p-4 md:p-8 transition-colors duration-300">
      <div className="max-w-5xl mx-auto space-y-8 pb-24">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black text-[var(--foreground)] italic tracking-tighter uppercase leading-none mb-2">Painel de Controle</h1>
            <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em]">Gerencie seus Quizzes ITA</p>
          </div>
          <button 
            onClick={downloadTemplate}
            className="flex items-center gap-2 bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)] px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-[var(--surface-hover)] transition-all shadow-lg"
          >
            <Download size={16} /> Baixar Modelo CSV
          </button>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Criar Novo Quiz (Sidebar) */}
          <div className="md:col-span-1 space-y-6">
            <div className="bg-[var(--surface)] p-6 rounded-[2.5rem] border border-[var(--border)] shadow-2xl sticky top-8">
              <div className="flex items-center gap-3 mb-6">
                 <div className="bg-[var(--primary)]/10 p-2 rounded-xl text-[var(--primary)]">
                    <Plus size={20} />
                 </div>
                 <h2 className="text-lg font-black text-[var(--foreground)] italic uppercase tracking-tighter">Novo Quiz</h2>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest ml-1">Título do Quiz</label>
                  <input
                    type="text"
                    placeholder="Ex: Vida de Paulo"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-[var(--background)] border border-[var(--border)] p-4 rounded-2xl font-bold text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest ml-1">Tempo por Pergunta</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: "15s", value: 15 },
                      { label: "30s", value: 30 },
                      { label: "60s", value: 60 },
                      { label: "Livre", value: null },
                    ].map((t) => (
                      <button
                        key={t.label}
                        onClick={() => setTimer(t.value)}
                        className={`py-2 rounded-xl font-black text-[10px] uppercase border transition-all ${
                          timer === t.value 
                            ? "bg-[var(--primary)] border-[var(--primary)] text-white" 
                            : "bg-[var(--background)] border-[var(--border)] text-slate-500 hover:border-[var(--primary)]"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="csv-upload" className="text-[10px] text-slate-500 font-bold uppercase tracking-widest ml-1">Arquivo CSV (ASCII)</label>
                  <div className="relative group">
                    <input
                      id="csv-upload"
                      type="file"
                      accept=".csv"
                      onChange={handleFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className={`p-4 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all ${
                      file ? "bg-[var(--primary)]/5 border-[var(--primary)]/30" : "bg-[var(--background)] border-[var(--border)] group-hover:border-[var(--primary)]/30 text-slate-500"
                    }`}>
                      {file ? <CheckCircle2 className="text-[var(--primary)]" /> : <Upload size={20} />}
                      <span className="text-[10px] font-bold uppercase tracking-widest max-w-[150px] text-center truncate">
                        {file ? file.name : "Clique ou arraste"}
                      </span>
                    </div>
                  </div>
                </div>

                {status && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className={`p-3 rounded-xl flex gap-2 items-center text-xs font-bold border ${
                      status.type === "success" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500" : "bg-red-500/10 border-red-500/30 text-red-500"
                    }`}
                  >
                    {status.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                    {status.msg}
                  </motion.div>
                )}

                <button
                  onClick={handleCreateQuiz}
                  disabled={loading || !title || !file}
                  className="w-full bg-[var(--primary)] hover:opacity-90 text-white p-4 rounded-2xl font-black uppercase text-xs tracking-[0.2em] transform hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 shadow-xl shadow-indigo-500/20 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="animate-spin" /> : "CRIAR PARTIDA 🚀"}
                </button>
              </div>
            </div>
          </div>

          {/* Listagem de Quizzes */}
          <div className="md:col-span-2">
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                 <h2 className="text-xl font-black text-[var(--foreground)] italic uppercase tracking-tighter">Seus Quizzes</h2>
                 <span className="bg-[var(--surface)] text-[var(--foreground)] px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-[var(--border)]">
                    Total: {quizzes.length}
                 </span>
              </div>

              <div className="grid gap-4">
                {quizzes.length === 0 && (
                  <div className="bg-[var(--surface)] p-12 rounded-[2.5rem] border border-dashed border-[var(--border)] flex flex-col items-center justify-center text-center opacity-50">
                    <FileText size={48} className="text-slate-600 mb-4" />
                    <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Nenhum quiz encontrado...</p>
                  </div>
                )}
                {quizzes.map((q) => (
                  <motion.div
                    key={q.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-[var(--surface)] p-6 rounded-[2.5rem] border border-[var(--border)] shadow-xl flex flex-col md:flex-row md:items-center justify-between transition-all hover:border-[var(--primary)]/30 group"
                  >
                    <div className="flex items-center gap-4 mb-4 md:mb-0">
                      <div className={`p-3 rounded-2xl bg-[var(--background)] transition-colors group-hover:bg-[var(--primary)]/10 text-slate-500 group-hover:text-[var(--primary)]`}>
                         <Gamepad2 size={24} />
                      </div>
                      <div>
                        <h3 className="font-black text-lg text-[var(--foreground)] uppercase italic tracking-tighter leading-none mb-1.5">{q.title}</h3>
                        <div className="flex flex-wrap gap-2 items-center">
                          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest bg-[var(--background)] px-2 py-0.5 rounded border border-[var(--border)]">#{q.pin}</span>
                          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded flex items-center gap-1 ${
                            q.status === 'playing' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-[var(--background)] text-slate-400 border border-[var(--border)]'
                          } border`}>
                            <div className={`w-1 h-1 rounded-full ${q.status === 'playing' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                            {q.status === 'waiting' ? 'Aguardando' : q.status === 'playing' ? 'Em Jogo' : 'Finalizado'}
                          </span>
                          {q.timer_per_question && (
                             <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 flex items-center gap-1">
                               <Clock size={10} /> {q.timer_per_question}s
                             </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 md:opacity-0 group-hover:opacity-100 transition-all">
                      <button
                        onClick={() => router.push(`/admin/${q.id}`)}
                        className="p-2.5 rounded-xl bg-blue-600/10 text-blue-500 border border-blue-600/20 hover:bg-blue-600 hover:text-white transition-all shadow-md"
                        title="Abrir Dashboard"
                      >
                        <ExternalLink size={18} />
                      </button>
                      <button
                        onClick={() => handleResetQuiz(q.id)}
                        className="p-2.5 rounded-xl bg-amber-600/10 text-amber-500 border border-amber-600/20 hover:bg-amber-600 hover:text-white transition-all shadow-md"
                        title="Reiniciar Partida"
                      >
                        <RotateCcw size={18} />
                      </button>
                      <button
                        onClick={() => handleDeleteQuiz(q.id)}
                        className="p-2.5 rounded-xl bg-red-600/10 text-red-500 border border-red-600/20 hover:bg-red-600 hover:text-white transition-all shadow-md"
                        title="Excluir Quiz"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
