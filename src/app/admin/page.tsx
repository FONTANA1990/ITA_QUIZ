"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { parseCSV } from "@/lib/csv-parser";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Upload, CheckCircle2, AlertCircle, Settings, Plus, 
  FileText, Download, Loader2, Trash2, RotateCcw, 
  ExternalLink, Clock, Gamepad2, Users, ShieldCheck
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";

export default function AdminDashboard() {
  const { user: currentUser, globalSettings, updateGlobalSetting } = useUser();
  const [activeTab, setActiveTab] = useState<"quizzes" | "users" | "settings">("quizzes");
  const [quizType, setQuizType] = useState<"classic" | "event">("classic");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploadMode, setUploadMode] = useState<"file" | "text" | "manual">("file");
  const [csvRawText, setCsvRawText] = useState("");
  const [manualQuestion, setManualQuestion] = useState<{
    question_text: string,
    options: { A: string, B: string, C: string, D: string, E: string },
    correct_option: string
  }>({
    question_text: "",
    options: { A: "", B: "", C: "", D: "", E: "" },
    correct_option: ""
  });
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState<number | null>(null);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [previewQuestions, setPreviewQuestions] = useState<any[]>([]);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchQuizzes();
    fetchUsers();
  }, []);

  const fetchQuizzes = async () => {
    const { data } = await supabase
      .from("quizzes")
      .select("*")
      .order("created_at", { ascending: false });
    setQuizzes(data || []);
  };

  const fetchUsers = async () => {
    const { data } = await supabase
      .from("users")
      .select("*")
      .order("total_points", { ascending: false });
    setAllUsers(data || []);
  };

  const handlePromoteAdmin = async (userId: string, currentRole: string) => {
    const action = currentRole === 'admin' ? 'remover o cargo de admin de' : 'tornar admin';
    if (!window.confirm(`Deseja realmente ${action} este usuário?`)) return;

    setLoading(true);
    try {
      const newRole = currentRole === 'admin' ? 'player' : 'admin';
      const { error } = await supabase
        .from("users")
        .update({ role: newRole })
        .eq("id", userId);

      if (error) throw error;
      
      setStatus({ type: "success", msg: "Permissões atualizadas com sucesso!" });
      fetchUsers();
    } catch (err: any) {
      console.error("Erro ao atualizar cargo:", err);
      setStatus({ type: "error", msg: `Erro ao atualizar permissão: ${err.message || 'Verifique o RLS no Supabase'}` });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string, nickname: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir permanentemente o usuário "${nickname}"? Esta ação é irreversível e removerá todos os seus scores.`)) return;

    setLoading(true);
    try {
      const { error } = await supabase.rpc("delete_user_by_admin", {
        target_user_id: userId
      });
      if (error) throw error;

      setStatus({ type: "success", msg: "Usuário removido com sucesso!" });
      fetchUsers();
    } catch (err: any) {
      console.error("Erro ao deletar usuário:", err);
      setStatus({ type: "error", msg: `Erro ao remover: ${err.message || "Verifique permissões"}` });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAnonymous = async () => {
    const anonUsers = allUsers.filter(u => !u.email);
    if (anonUsers.length === 0) {
      alert("Nenhum usuário sem e-mail encontrado.");
      return;
    }

    if (!window.confirm(`Deseja realmente excluir TODOS os ${anonUsers.length} usuários que não possuem e-mail? Isso removerá seus históricos também.`)) return;

    setLoading(true);
    try {
      const anonIds = anonUsers.map(u => u.id);
      for (const id of anonIds) {
        await supabase.rpc("delete_user_by_admin", { target_user_id: id });
      }

      setStatus({ type: "success", msg: `${anonUsers.length} usuários removidos!` });
      fetchUsers();
    } catch (err: any) {
      console.error("Erro ao remover anônimos:", err);
      setStatus({ type: "error", msg: `Falha na limpeza: ${err.message || "Favor verificar RLS"}` });
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    const headers = "pergunta,opcao_a,opcao_b,opcao_c,opcao_d,opcao_e,resposta_correta\n";
    const example = "Qual a capital da França?,Paris,Londres,Berlim,Madrid,,A\nPergunta com 5 opções,Opção 1,Opção 2,Opção 3,Opção 4,Opção 5,E";
    const csvContent = "\uFEFF" + headers + example;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "modelo_quiz_ita_v2.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFile(e.target.files[0]);
  };

  const handlePreview = async () => {
    const csvInput = uploadMode === "file" ? file : csvRawText;
    
    if (!title || !csvInput) {
      setStatus({ type: "error", msg: uploadMode === "file" ? "Preencha o título e selecione o CSV!" : "Preencha o título e cole o texto do CSV!" });
      return;
    }

    setLoading(true);
    setStatus(null);

    try {
      const questionsData = await parseCSV(csvInput as any);
      if (questionsData.length === 0) throw new Error("A tabela parece estar vazia ou mal formatada.");
      
      setPreviewQuestions(questionsData);
      setIsPreviewing(true);
      setStatus({ type: "success", msg: `${questionsData.length} perguntas processadas com sucesso!` });
    } catch (err: any) {
      setStatus({ type: "error", msg: err.message || "Erro ao processar os dados." });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPreview = () => {
    setPreviewQuestions([]);
    setIsPreviewing(false);
    setStatus(null);
    setManualQuestion({
      question_text: "",
      options: { A: "", B: "", C: "", D: "", E: "" },
      correct_option: ""
    });
  };

  const handleManualAdd = () => {
    const { question_text, options, correct_option } = manualQuestion;
    
    // Agora requer apenas pergunta, pelo menos Opção A e B, e a resposta correta
    if (!question_text || !options.A || !options.B || !correct_option) {
      setStatus({ type: "error", msg: "Preencha a pergunta, as opções A e B, e selecione a resposta correta!" });
      return;
    }

    // Se uma opção estiver selecionada como correta mas o texto estiver vazio
    if (!options[correct_option as keyof typeof options]) {
      setStatus({ type: "error", msg: `A opção ${correct_option} foi marcada como correta, mas o texto dela está vazio!` });
      return;
    }

    setPreviewQuestions([...previewQuestions, { ...manualQuestion }]);
    setIsPreviewing(true);
    
    // Reset manual form but keep current options structure
    setManualQuestion({
      question_text: "",
      options: { A: "", B: "", C: "", D: "", E: "" },
      correct_option: ""
    });
    setStatus({ type: "success", msg: "Pergunta adicionada à lista!" });
  };

  const removeQuestionFromPreview = (idx: number) => {
    const updated = previewQuestions.filter((_, i) => i !== idx);
    setPreviewQuestions(updated);
    if (updated.length === 0) setIsPreviewing(false);
  };

  const handleCreateQuiz = async () => {
    if (previewQuestions.length === 0) return;
    
    if (!title.trim()) {
      setStatus({ type: "error", msg: "Dê um título para o seu Quiz antes de criar!" });
      const titleInput = document.getElementById('quiz-title-input');
      titleInput?.focus();
      return;
    }

    setLoading(true);
    setStatus(null);

    try {
      const { data: quiz, error: quizError } = await supabase
        .from("quizzes")
        .insert([{ 
          title: title.trim(), 
          status: quizType === "event" ? "playing" : "waiting", 
          quiz_type: quizType,
          is_active: quizType === "event",
          timer_per_question: timer
        }])
        .select()
        .single();

      if (quizError) throw quizError;

      const pin = quiz.id.slice(0, 6).toUpperCase();
      await supabase.from("quizzes").update({ pin }).eq("id", quiz.id);

      const formattedQuestions = previewQuestions.map((q, idx) => ({
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

  const handleDeleteQuiz = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja excluir permanentemente este quiz?")) return;
    
    setLoading(true);
    setStatus(null);
    try {
      const { error } = await supabase.from("quizzes").delete().eq("id", id);
      if (error) throw error;

      fetchQuizzes();
      setStatus({ type: "success", msg: "Quiz excluído com sucesso!" });
    } catch (err: any) {
      console.error("Erro ao deletar quiz:", err);
      setStatus({ type: "error", msg: "Erro ao excluir quiz." });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSetting = async (key: string, value: string) => {
    setStatus(null);
    try {
      await updateGlobalSetting(key, value);
      setStatus({ type: "success", msg: "Configuração atualizada com sucesso!" });
    } catch (err: any) {
      console.error("Erro ao salvar config:", err);
      setStatus({ type: "error", msg: `Falha ao salvar: ${err.message || 'Verifique sua conexão'}` });
    }
  };

  const handleResetRanking = async () => {
    if (!window.confirm("ATENÇÃO: Deseja realmente ZERAR todo o ranking global? Esta ação apagará todas as pontuações acumuladas e não pode ser desfeita!")) return;
    if (!window.confirm("TEM CERTEZA ABSOLUTA?")) return;

    setLoading(true);
    setStatus(null);
    try {
      const { error } = await supabase.rpc("reset_global_ranking");
      if (error) throw error;
      
      setStatus({ type: "success", msg: "Ranking resetado com sucesso!" });
      fetchUsers();
    } catch (err: any) {
      console.error("Erro ao resetar ranking:", err);
      setStatus({ type: "error", msg: `Erro ao resetar: ${err.message || "Verifique permissões"}` });
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
            <h1 className="text-4xl font-black text-[var(--foreground)] italic tracking-tighter uppercase leading-none mb-2">Administração</h1>
            <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em]">Controle Central ITA QUIZ</p>
          </div>
          <div className="flex gap-2 p-1 bg-[var(--surface)] rounded-2xl border border-[var(--border)]">
            <button 
              onClick={() => setActiveTab("quizzes")}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'quizzes' ? 'bg-[var(--primary)] text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
            >
              Quizzes
            </button>
            <button 
              onClick={() => setActiveTab("users")}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'users' ? 'bg-[var(--primary)] text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
            >
              Usuários
            </button>
            <button 
              onClick={() => setActiveTab("settings")}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'settings' ? 'bg-[var(--primary)] text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
            >
              Configurações
            </button>
          </div>
        </div>

        {activeTab === "quizzes" ? (
          <div className="grid md:grid-cols-3 gap-8">
            {!isPreviewing ? (
              <>
                <div className="md:col-span-1 space-y-6">
                  <div className="bg-[var(--surface)] p-6 rounded-[2.5rem] border border-[var(--border)] shadow-2xl">
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
                          id="quiz-title-input"
                          type="text"
                          placeholder="Ex: Histórias Bíblicas"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          className="w-full bg-[var(--background)] border border-[var(--border)] p-4 rounded-2xl font-bold text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] transition-all"
                        />
                      </div>

                      <div className="space-y-1.5 pt-2">
                        <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest ml-1">Modo de Jogo</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => setQuizType("classic")}
                            className={`py-3 rounded-xl text-[9px] font-black uppercase border-2 transition-all ${
                              quizType === 'classic' 
                                ? 'bg-[var(--primary)]/10 border-[var(--primary)] text-[var(--primary)]' 
                                : 'bg-[var(--background)] border-[var(--border)] text-slate-500 opacity-60'
                            }`}
                          >
                            Modo Kahoot
                          </button>
                          <button
                            onClick={() => setQuizType("event")}
                            className={`py-3 rounded-xl text-[9px] font-black uppercase border-2 transition-all ${
                              quizType === 'event' 
                                ? 'bg-[var(--primary)]/10 border-[var(--primary)] text-[var(--primary)]' 
                                : 'bg-[var(--background)] border-[var(--border)] text-slate-500 opacity-60'
                            }`}
                          >
                            Modo Evento
                          </button>
                        </div>
                        <p className="text-[8px] text-slate-500 italic mt-1 px-1">
                          {quizType === 'classic' 
                            ? "• O ADM controla o telão e as perguntas não aparecem no celular." 
                            : "• Os alunos respondem no seu próprio tempo e veem a pergunta no celular."}
                        </p>
                      </div>

                      <div className="space-y-1.5 pt-2">
                        <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest ml-1">Tempo por Pergunta</label>
                        <div className="grid grid-cols-3 gap-2">
                          {[15, 30, 60, 90, 120].map((t) => (
                            <button
                              key={t}
                              onClick={() => setTimer(t)}
                              className={`py-2 rounded-xl text-[9px] font-black uppercase border-2 transition-all ${
                                timer === t 
                                  ? 'bg-[var(--primary)] border-[var(--primary)] text-white' 
                                  : 'bg-[var(--background)] border-[var(--border)] text-slate-500'
                              }`}
                            >
                              {t}s
                            </button>
                          ))}
                          <button
                            onClick={() => setTimer(null)}
                            className={`py-2 rounded-xl text-[9px] font-black uppercase border-2 transition-all ${
                              timer === null 
                                ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                                : 'bg-[var(--background)] border-[var(--border)] text-slate-500'
                            }`}
                          >
                            Livre
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5 pt-2">
                        <button onClick={downloadTemplate} className="text-[9px] text-[var(--primary)] font-black uppercase tracking-widest flex items-center gap-1">
                          <Download size={12} /> Baixar Modelo CSV
                        </button>
                      </div>

                      <div className="pt-2">
                        <div className="flex p-1 bg-[var(--background)] rounded-xl border border-[var(--border)] mb-4">
                          <button 
                            onClick={() => { setUploadMode("file"); setIsPreviewing(false); }}
                            className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${uploadMode === 'file' ? 'bg-[var(--surface)] text-[var(--primary)] shadow-sm' : 'text-slate-500 hover:text-slate-400'}`}
                          >
                            Arquivo
                          </button>
                          <button 
                            onClick={() => { setUploadMode("text"); setIsPreviewing(false); }}
                            className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${uploadMode === 'text' ? 'bg-[var(--surface)] text-[var(--primary)] shadow-sm' : 'text-slate-500 hover:text-slate-400'}`}
                          >
                            Colar CSV
                          </button>
                          <button 
                            onClick={() => { setUploadMode("manual"); }}
                            className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${uploadMode === 'manual' ? 'bg-[var(--surface)] text-[var(--primary)] shadow-sm' : 'text-slate-500 hover:text-slate-400'}`}
                          >
                            Passo a Passo
                          </button>
                        </div>

                        {uploadMode === "file" ? (
                          <div className="space-y-1.5">
                            <label htmlFor="csv-upload" className="text-[10px] text-slate-500 font-bold uppercase tracking-widest ml-1">Arquivo CSV</label>
                            <div className="relative group">
                              <input id="csv-upload" type="file" accept=".csv" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                              <div className={`p-4 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all ${file ? "bg-[var(--primary)]/5 border-[var(--primary)]/30" : "bg-[var(--background)] border-[var(--border)] text-slate-500"}`}>
                                {file ? <CheckCircle2 className="text-[var(--primary)]" /> : <Upload size={20} />}
                                <span className="text-[10px] font-bold uppercase tracking-widest text-center truncate w-full px-2">{file ? file.name : "Selecionar Arquivo"}</span>
                              </div>
                            </div>
                          </div>
                        ) : uploadMode === "text" ? (
                          <div className="space-y-1.5">
                            <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest ml-1">Cole o CSV aqui</label>
                            <textarea
                              placeholder="pergunta,opcao_a,opcao_b...&#10;Pergunta 1,A,B,C,D,E,A"
                              value={csvRawText}
                              onChange={(e) => setCsvRawText(e.target.value)}
                              className="w-full bg-[var(--background)] border border-[var(--border)] p-4 rounded-2xl font-mono text-[10px] h-32 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] transition-all resize-none"
                            />
                          </div>
                        ) : (
                          <div className="space-y-4 pt-2">
                            <div className="space-y-1.5">
                              <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest ml-1">Sua Pergunta</label>
                              <textarea
                                placeholder="Digite a pergunta aqui..."
                                value={manualQuestion.question_text}
                                onChange={(e) => setManualQuestion({ ...manualQuestion, question_text: e.target.value })}
                                className="w-full bg-[var(--background)] border border-[var(--border)] p-4 rounded-2xl font-bold text-xs h-24 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] transition-all resize-none"
                              />
                            </div>
                            
                            <div className="space-y-2 pt-2">
                              <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest ml-1 flex items-center gap-2">
                                Opções de Resposta 
                                <span className="text-[8px] bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded-full border border-blue-500/20 italic">
                                  Dica: Clique na letra (A-E) para marcar a correta
                                </span>
                              </label>
                              <div className="grid grid-cols-1 gap-2">
                                {['A', 'B', 'C', 'D', 'E'].map(l => (
                                  <div key={l} className="flex gap-2 items-center">
                                    <button 
                                      onClick={() => setManualQuestion({ ...manualQuestion, correct_option: l })}
                                      className={`w-8 h-8 rounded-lg flex items-center justify-center font-black transition-all border-2 ${
                                        manualQuestion.correct_option === l 
                                          ? 'bg-emerald-500 text-white border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.3)]' 
                                          : 'bg-[var(--background)] text-slate-500 border-[var(--border)] opacity-40 hover:opacity-100'
                                      }`}
                                    >
                                      {l}
                                    </button>
                                    <input 
                                      type="text"
                                      placeholder={`Opção ${l}${l === 'E' ? ' (Opcional)' : ''}`}
                                      value={manualQuestion.options[l as 'A'|'B'|'C'|'D'|'E']}
                                      onChange={(e) => setManualQuestion({
                                        ...manualQuestion,
                                        options: { ...manualQuestion.options, [l]: e.target.value }
                                      })}
                                      className={`flex-1 bg-[var(--background)] border px-4 py-2 rounded-xl text-[10px] font-bold focus:outline-none focus:ring-1 focus:ring-[var(--primary)] transition-all ${
                                        manualQuestion.correct_option === l ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-[var(--border)]'
                                      }`}
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>

                            {status && status.msg.includes("opção") && (
                              <p className="text-[10px] font-bold text-red-500 animate-pulse text-center">{status.msg}</p>
                            )}

                            <button
                              onClick={handleManualAdd}
                              className="w-full bg-blue-500/10 text-blue-500 border border-blue-500/30 p-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-blue-500 hover:text-white transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                              <Plus size={14} /> ADICIONAR À LISTA
                            </button>
                          </div>
                        )}
                      </div>

                      {uploadMode !== 'manual' && (
                        <button
                          onClick={handlePreview}
                          disabled={loading || !title || (uploadMode === 'file' ? !file : !csvRawText)}
                          className="w-full bg-[var(--primary)] text-white p-4 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl disabled:opacity-50 transition-all active:scale-95 flex justify-center items-center gap-2"
                        >
                          {loading ? <Loader2 className="animate-spin" /> : (
                            <>
                              <FileText size={16} /> VISUALIZAR PERGUNTAS
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2 space-y-4">
                  {quizzes.map((q) => (
                    <div key={q.id} className="bg-[var(--surface)] p-6 rounded-[2.5rem] border border-[var(--border)] flex items-center justify-between group">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-[var(--background)] rounded-2xl text-slate-500 group-hover:text-[var(--primary)] transition-colors">
                          <Gamepad2 size={24} />
                        </div>
                        <div>
                          <h3 className="font-black text-lg text-[var(--foreground)] uppercase italic tracking-tighter leading-none mb-1">{q.title}</h3>
                          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest border border-[var(--border)] px-1.5 py-0.5 rounded">#{q.pin}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 md:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => router.push(`/admin/${q.id}`)} 
                          className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20 hover:bg-blue-500 hover:text-white transition-all"
                          title="Gerenciar Partida"
                        >
                          <ExternalLink size={18} />
                        </button>
                        <button 
                          onClick={() => handleDeleteQuiz(q.id)} 
                          className="p-2.5 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all"
                          title="Excluir Quiz"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <AnimatePresence>
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="md:col-span-3 space-y-6"
                >
                  <div className="bg-[var(--surface)] p-6 md:p-8 rounded-[2.5rem] border border-[var(--border)] shadow-2xl">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                      <div>
                        <h2 className="text-2xl font-black text-[var(--foreground)] italic uppercase tracking-tighter leading-none mb-2">Conferência de Dados</h2>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-relaxed">Confira se todas as perguntas foram lidas corretamente antes de finalizar</p>
                      </div>
                      <div className="flex items-center gap-2">
                         <div className="bg-[var(--primary)]/10 px-4 py-2 rounded-2xl border border-[var(--primary)]/20 text-[var(--primary)] font-black text-xs uppercase tracking-widest flex items-center gap-2">
                          <FileText size={14} /> {previewQuestions.length} QUESTÕES
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                      {previewQuestions.map((q, i) => (
                        <div key={i} className="bg-[var(--background)]/40 p-5 md:p-6 rounded-3xl border border-[var(--border)]/50 hover:border-[var(--primary)] transition-all group">
                          <div className="flex gap-4">
                            <span className="text-2xl font-black text-slate-500/20 tabular-nums italic">{(i + 1).toString().padStart(2, '0')}</span>
                            <div className="flex-1 space-y-4">
                              <p className="font-bold text-[var(--foreground)] text-sm md:text-base leading-relaxed break-words">
                                {q.question_text || "Texto da pergunta não encontrado"}
                              </p>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {['A', 'B', 'C', 'D', 'E'].map(opt => {
                                  const optionText = q.options?.[opt];
                                  const isCorrect = q.correct_option === opt;
                                  
                                  if (!optionText) return null;

                                  return (
                                    <div key={opt} className={`flex items-start gap-2 p-3 rounded-2xl border transition-all ${
                                      isCorrect 
                                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.1)]' 
                                        : 'bg-[var(--background)] border-[var(--border)]/30 text-slate-500'
                                    }`}>
                                      <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-black uppercase text-[10px] border shadow-sm ${
                                        isCorrect ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-[var(--surface)] text-slate-500 border-[var(--border)]'
                                      }`}>
                                        {opt}
                                      </span>
                                      <span className={`text-[11px] font-bold leading-tight pt-1 ${isCorrect ? 'text-emerald-500' : 'text-slate-500'}`}>
                                        {optionText}
                                      </span>
                                      {isCorrect && <CheckCircle2 size={14} className="ml-auto flex-shrink-0" />}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                            <button 
                              onClick={() => removeQuestionFromPreview(i)}
                              className="opacity-0 group-hover:opacity-100 p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-all h-fit self-center"
                              title="Remover esta pergunta"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-8 grid md:grid-cols-2 gap-4">
                      <button
                        onClick={handleResetPreview}
                        className="w-full bg-slate-500/5 text-slate-500 p-5 rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest border border-[var(--border)] transition-all hover:bg-slate-500/10 active:scale-95 flex justify-center items-center gap-2"
                      >
                        <RotateCcw size={16} /> LIMPAR E CORRIGIR
                      </button>
                      <button
                        onClick={handleCreateQuiz}
                        disabled={loading}
                        className="w-full bg-[var(--primary)] text-white p-5 rounded-[1.5rem] font-black uppercase text-xs tracking-[0.2em] shadow-[0_10px_30px_rgba(234,179,8,0.3)] hover:shadow-[0_15px_40px_rgba(234,179,8,0.4)] disabled:opacity-50 transition-all active:scale-95 flex justify-center items-center gap-3"
                      >
                        {loading ? <Loader2 className="animate-spin" /> : (
                          <>
                            CONFIRMAR E CRIAR AGORA 🚀
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        ) : activeTab === "users" ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="bg-[var(--surface)] rounded-[2.5rem] border border-[var(--border)] overflow-hidden shadow-2xl">
              <div className="p-6 border-b border-[var(--border)] flex justify-between items-center bg-[var(--background)]/50">
                <h2 className="font-black text-[var(--foreground)] italic tracking-tighter uppercase">Membros de Comunidade</h2>
                <div className="flex items-center gap-4">
                  <button 
                    onClick={handleResetRanking}
                    className="flex items-center gap-2 text-[9px] bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-white px-3 py-1.5 rounded-xl border border-amber-500/20 transition-all font-black uppercase tracking-widest"
                  >
                    <RotateCcw size={12} /> Zerar Ranking
                  </button>
                  <button 
                    onClick={handleDeleteAnonymous}
                    className="flex items-center gap-2 text-[9px] bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white px-3 py-1.5 rounded-xl border border-red-500/20 transition-all font-black uppercase tracking-widest"
                  >
                    <Trash2 size={12} /> Limpar Anônimos
                  </button>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 font-black uppercase tracking-widest">
                    <Users size={14} /> {allUsers.length} Logados
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 md:p-6 bg-[var(--background)]/20">
                {allUsers.map((u) => (
                  <motion.div 
                    key={u.id} 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-[var(--surface)] p-5 rounded-[2.5rem] border border-[var(--border)] shadow-xl flex flex-col gap-4 group hover:border-[var(--primary)]/30 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-tr from-[var(--primary)]/20 to-[var(--secondary)]/20 rounded-2xl flex items-center justify-center border border-[var(--border)]">
                          <Users size={24} className="text-[var(--primary)]" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-black text-lg text-[var(--foreground)] italic uppercase tracking-tighter leading-none">{u.nickname}</span>
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1.5 truncate max-w-[150px]">{u.email || "Sem Email"}</span>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                        u.role === 'admin' ? 'bg-[#A855F7]/20 text-[#A855F7] border border-[#A855F7]/30' : 'bg-[var(--background)] text-slate-500 border border-[var(--border)]'
                      }`}>
                        {u.role === 'admin' ? 'Admin' : 'Jogador'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--border)]/50">
                      <div className="flex flex-col bg-[var(--background)]/50 p-3 rounded-2xl border border-[var(--border)]">
                        <span className="text-[8px] text-slate-500 font-black uppercase tracking-[0.2em] mb-1">Pontuação</span>
                        <span className="text-lg font-black text-[var(--primary)] italic leading-none">{u.total_points || 0}</span>
                      </div>
                      <div className="flex flex-col bg-[var(--background)]/50 p-3 rounded-2xl border border-[var(--border)]">
                        <span className="text-[8px] text-slate-500 font-black uppercase tracking-[0.2em] mb-1">Status</span>
                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest leading-none">Ativo</span>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-2">
                       {u.id !== currentUser?.id && (
                         <>
                           <button
                             onClick={() => handlePromoteAdmin(u.id, u.role)}
                             title={u.role === 'admin' ? "Rebaixar para Jogador" : "Promover a Administrador"}
                             aria-label={u.role === 'admin' ? "Rebaixar para Jogador" : "Promover a Administrador"}
                             className={`flex-1 py-3 rounded-2xl font-black uppercase text-[9px] tracking-widest flex items-center justify-center gap-2 transition-all border ${
                               u.role === 'admin' 
                                 ? 'bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500' 
                                 : 'bg-[#A855F7]/10 border-[#A855F7]/20 text-[#A855F7] hover:bg-[#A855F7]'
                             } hover:text-white active:scale-95`}
                           >
                             <ShieldCheck size={14} /> {u.role === 'admin' ? "REBAIXAR" : "PROMOVER"}
                           </button>
                           <button
                             onClick={() => handleDeleteUser(u.id, u.nickname)}
                             title="Excluir Usuário"
                             aria-label="Excluir Usuário"
                             className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-all active:scale-95"
                           >
                             <Trash2 size={16} />
                           </button>
                         </>
                       )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6 pb-12">
              <div className="bg-[var(--surface)] p-8 rounded-[2.5rem] border border-[var(--border)] shadow-2xl">
                <div className="flex items-center gap-3 mb-6">
                   <div className="bg-amber-500/10 p-3 rounded-2xl text-amber-500">
                      <Gamepad2 size={24} />
                   </div>
                   <div>
                     <h2 className="text-xl font-black text-[var(--foreground)] italic uppercase tracking-tighter leading-none">Moeda do Quiz</h2>
                     <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Visível para todos os jogadores</p>
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {["Pontos", "Dracmas", "Talentos", "Denários", "Shekels", "Moedas de Ouro"].map((c) => (
                    <button
                      key={c}
                      onClick={() => handleUpdateSetting("currency", c)}
                      className={`px-4 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.1em] transition-all border ${
                        globalSettings.currency === c 
                          ? "bg-[var(--primary)] border-[var(--primary)] text-white shadow-xl scale-[1.02]" 
                          : "bg-[var(--background)] border-[var(--border)] text-slate-500 hover:border-[var(--primary)]/30"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-[var(--surface)] p-8 rounded-[2.5rem] border border-[var(--border)] shadow-2xl">
                <div className="flex items-center gap-3 mb-6">
                   <div className="bg-emerald-500/10 p-3 rounded-2xl text-emerald-500">
                      <ShieldCheck size={24} />
                   </div>
                   <div>
                     <h2 className="text-xl font-black text-[var(--foreground)] italic uppercase tracking-tighter leading-none">Regras de Pontos</h2>
                     <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Pontos ganhos por acerto</p>
                   </div>
                </div>

                <div className="space-y-6">
                  <div className="flex flex-wrap gap-2">
                    {[50, 100, 200, 500, 1000].map((v) => (
                      <button
                        key={v}
                        onClick={() => handleUpdateSetting("points_per_question", v.toString())}
                        className={`px-6 py-3 rounded-2xl font-black text-sm uppercase italic transition-all border ${
                          globalSettings.points_per_question === v
                            ? "bg-emerald-500 border-emerald-500 text-white shadow-xl scale-105"
                            : "bg-[var(--background)] border-[var(--border)] text-slate-500 hover:border-emerald-500/30"
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {status && activeTab !== 'quizzes' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`fixed bottom-24 left-1/2 -translate-x-1/2 flex items-center gap-2 px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-2xl z-50 border ${
              status.type === 'success' 
                ? 'bg-emerald-500 text-white border-emerald-400' 
                : 'bg-red-500 text-white border-red-400'
            }`}
          >
            {status.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            {status.msg}
          </motion.div>
        )}
      </div>

      {/* Mobile NavBar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-transparent z-40 md:hidden">
        <div className="bg-[var(--surface)]/80 backdrop-blur-xl border border-[var(--border)] p-2 rounded-[2rem] flex justify-between items-center shadow-2xl">
          {[
            { id: 'home', icon: ShieldCheck, label: 'Início', path: '/' },
            { id: 'admin', icon: Settings, label: 'Admin', path: '/admin' },
            { id: 'ranking', icon: Users, label: 'Ranking', path: '/leaderboard' },
            { id: 'history', icon: RotateCcw, label: 'Histórico', path: '#' },
            { id: 'profile', icon: Users, label: 'Perfil', path: '#' }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => item.path !== '#' && router.push(item.path)}
              className={`flex flex-col items-center justify-center w-14 h-14 rounded-2xl transition-all ${
                item.id === 'admin' ? 'text-[var(--primary)]' : 'text-slate-500'
              }`}
            >
              <item.icon size={20} />
              <span className="text-[8px] font-black uppercase mt-1">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
