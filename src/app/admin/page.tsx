"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { parseCSV } from "@/lib/csv-parser";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Upload, CheckCircle2, AlertCircle, Settings, Plus, 
  FileText, Download, Loader2, Trash2, RotateCcw, 
  ExternalLink, Clock, Gamepad2, Users, ShieldCheck,
  Building2, Mail, UserPlus, LogOut, ChevronDown, Trash,
  CheckSquare
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";

export default function AdminDashboard() {
  const { 
    user: currentUser, 
    activeOrg, 
    organizations, 
    switchOrganization, 
    createOrganization, 
    sendInvite,
    globalSettings, 
    updateGlobalSetting 
  } = useUser();

  const [activeTab, setActiveTab] = useState<"quizzes" | "users" | "settings" | "org">("quizzes");
  const [newOrgName, setNewOrgName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [orgMembers, setOrgMembers] = useState<any[]>([]);
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
  const [pointsPerQuestion, setPointsPerQuestion] = useState<number>(1);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (activeOrg) {
      fetchQuizzes();
      fetchUsers();
    }
  }, [activeOrg?.id]);

  const fetchQuizzes = async () => {
    if (!activeOrg) return;
    const { data } = await supabase
      .from("quizzes")
      .select("*, scores(user_id)")
      .eq("organization_id", activeOrg.id)
      .order("created_at", { ascending: false });
    
    // Normalizar o count para não quebrar a tipagem, mesmo que scores venha nulo
    const processedData = data?.map(q => ({
      ...q,
      scores_count: q.scores ? (Array.isArray(q.scores) ? q.scores.length : 0) : 0
    }));

    setQuizzes(processedData || []);
  };

  const fetchUsers = async () => {
    if (!activeOrg) return;
    const { data } = await supabase
      .from("organization_members")
      .select("role, users(*)")
      .eq("organization_id", activeOrg.id)
      .order("joined_at", { ascending: false });
    
    if (data) {
      const users = data.map(m => ({ ...m.users, base_role: m.role }));
      setAllUsers(users);
    }
  };

  const handleUpdateQuizPoints = async (quizId: string, newPoints: number) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("quizzes")
        .update({ points_per_question: newPoints })
        .eq("id", quizId);

      if (error) throw error;
      
      setStatus({ type: "success", msg: "Pontuação do quiz atualizada!" });
      fetchQuizzes();
    } catch (err: any) {
      setStatus({ type: "error", msg: `Erro ao atualizar: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateQuizTimer = async (quizId: string, seconds: number | null) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("quizzes")
        .update({ timer_per_question: seconds })
        .eq("id", quizId);

      if (error) throw error;
      
      setStatus({ type: "success", msg: "Tempo do quiz atualizado!" });
      fetchQuizzes();
    } catch (err: any) {
      setStatus({ type: "error", msg: `Erro ao atualizar tempo: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  const handlePromoteAdmin = async (userId: string, currentRole: string) => {
    if (!activeOrg) return;
    const action = currentRole === 'admin' ? 'remover o cargo de admin de' : 'tornar admin';
    if (!window.confirm(`Deseja realmente ${action} este usuário nesta base?`)) return;

    setLoading(true);
    try {
      const newRole = currentRole === 'admin' ? 'member' : 'admin';
      const { error } = await supabase
        .from("organization_members")
        .update({ role: newRole })
        .eq("organization_id", activeOrg.id)
        .eq("user_id", userId);

      if (error) throw error;
      
      setStatus({ type: "success", msg: "Permissões atualizadas com sucesso!" });
      fetchUsers();
    } catch (err: any) {
      setStatus({ type: "error", msg: `Erro ao atualizar permissão: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!activeOrg || !window.confirm("Remover este membro da sua base? Ele perderá o acesso e sairá do ranking local.")) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from("organization_members")
        .delete()
        .eq("organization_id", activeOrg.id)
        .eq("user_id", userId);
      
      if (error) throw error;
      setStatus({ type: "success", msg: "Membro removido da base!" });
      fetchUsers();
    } catch (err: any) {
       setStatus({ type: "error", msg: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSendInvite = async () => {
    if (!inviteEmail) return;
    setLoading(true);
    try {
      await sendInvite(inviteEmail, inviteRole);
      setInviteEmail("");
      setStatus({ type: "success", msg: "Convite enviado com sucesso!" });
    } catch (err: any) {
      setStatus({ type: "error", msg: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateQuiz = async () => {
    if (!activeOrg || previewQuestions.length === 0) return;
    if (!title.trim()) {
      setStatus({ type: "error", msg: "Dê um título para o seu Quiz!" });
      return;
    }

    setLoading(true);
    try {
      const { data: quiz, error: quizError } = await supabase
        .from("quizzes")
        .insert([{ 
          title: title.trim(), 
          status: quizType === "event" ? "playing" : "waiting", 
          quiz_type: quizType,
          is_active: quizType === "event",
          timer_per_question: timer,
          points_per_question: pointsPerQuestion,
          organization_id: activeOrg.id
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

      await supabase.from("questions").insert(formattedQuestions);
      setStatus({ type: "success", msg: "Quiz criado com sucesso!" });
      fetchQuizzes();
      handleResetPreview();
    } catch (err: any) {
      setStatus({ type: "error", msg: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPreview = () => {
    setPreviewQuestions([]);
    setIsPreviewing(false);
    setTitle("");
    setFile(null);
    setCsvRawText("");
  };

  const handleDeleteQuiz = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja excluir este quiz?")) return;
    try {
      await supabase.from("quizzes").delete().eq("id", id);
      fetchQuizzes();
    } catch (err) {}
  };

  const handlePreview = async () => {
    const csvInput = uploadMode === "file" ? file : csvRawText;
    if (!title || !csvInput) return;
    setLoading(true);
    try {
      const questionsData = await parseCSV(csvInput as any);
      setPreviewQuestions(questionsData);
      setIsPreviewing(true);
    } catch (err: any) {
      setStatus({ type: "error", msg: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTemplate = () => {
    const csvContent = "pergunta,opcao_a,opcao_b,opcao_c,opcao_d,opcao_e,resposta_correta\nQuem descobriu o Brasil?,Pedro Alvares Cabral,Cristovão Colombo,Vasco da Gama,Americo Vespucio,Dom Pedro I,A";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "modelo_quiz_ita.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleResetRanking = async () => {
     if (!activeOrg || !window.confirm("Zerar ranking da base? Isso excluirá todas as pontuações registradas nesta organização!")) return;
     setLoading(true);
     try {
        const { data: quizzesData } = await supabase.from("quizzes").select("id").eq("organization_id", activeOrg.id);
        if (quizzesData && quizzesData.length > 0) {
           const quizIds = quizzesData.map(q => q.id);
           await supabase.from("scores").delete().in("quiz_id", quizIds);
           setStatus({ type: "success", msg: "Ranking resetado com sucesso!" });
        }
     } catch (err: any) {
        setStatus({ type: "error", msg: "Erro ao resetar ranking." });
     } finally {
        setLoading(false);
     }
  };

  const handleDownloadAnswersReport = async (quizId: string, quizTitle: string) => {
    setLoading(true);
    try {
      const { data: questionsData, error: qError } = await supabase
        .from("questions")
        .select("id, question_text, correct_option")
        .eq("quiz_id", quizId);
      
      if (qError) throw qError;
      if (!questionsData || questionsData.length === 0) {
        setStatus({ type: "error", msg: "Nenhuma pergunta encontrada." });
        return;
      }

      const questionIds = questionsData.map(q => q.id);

      const { data: answersData, error: aError } = await supabase
        .from("answers")
        .select("selected_option, is_correct, question_id, user_id, users(nickname)")
        .in("question_id", questionIds);

      if (aError) throw aError;
      if (!answersData || answersData.length === 0) {
        setStatus({ type: "error", msg: "Nenhuma resposta registrada ainda." });
        return;
      }

      // Pre-calculate user stats
      const userStats: Record<string, { total: number, correct: number, wrong: number }> = {};
      answersData.forEach((ans: any) => {
        const uId = ans.user_id;
        if (!userStats[uId]) {
           userStats[uId] = { total: 0, correct: 0, wrong: 0 };
        }
        userStats[uId].total += 1;
        if (ans.is_correct) {
           userStats[uId].correct += 1;
        } else {
           userStats[uId].wrong += 1;
        }
      });

      const headers = ["Nome do Usuário", "Pergunta", "O que o usuário marcou", "Resposta Correta", "Qtd. Acertos", "Qtd. Erros", "Total Respondido"];
      const rows = answersData.map((ans: any) => {
        const question = questionsData.find(q => q.id === ans.question_id);
        const userName = ans.users?.nickname || "Anônimo";
        const questionText = (question?.question_text || "").replace(/"/g, '""');
        const stats = userStats[ans.user_id] || { total: 0, correct: 0, wrong: 0 };
        
        return `"${userName}","${questionText}","${ans.selected_option}","${question?.correct_option}","${stats.correct}","${stats.wrong}","${stats.total}"`;
      });

      const csvContent = '\ufeff' + [headers.map(h => `"${h}"`).join(","), ...rows].join("\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `relatorio_respostas_${quizTitle.replace(/\s+/g, '_')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setStatus({ type: "success", msg: "Relatório gerado com sucesso!" });
    } catch (err: any) {
      setStatus({ type: "error", msg: `Erro ao gerar relatório: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  const handleFinishQuiz = async (id: string, title: string) => {
    if (!window.confirm(`Você tem certeza que deseja FINALIZAR o quiz "${title}"?\nEle sumirá da tela inicial e nenhum jogador poderá entrar.`)) return;
    try {
      const { error } = await supabase.from("quizzes").update({ status: 'finished' }).eq("id", id);
      if (error) throw error;
      fetchQuizzes();
      alert("Quiz finalizado com sucesso!");
    } catch (err: any) {
      alert("Erro ao finalizar: " + err.message);
    }
  };

  const handleResetQuiz = async (id: string, title: string) => {
    if (!window.confirm(`🔴 ATENÇÃO: Deseja REINICIAR "${title}"?\nIsso APAGARÁ as respostas antigas, zerar a pontuação de quem participou neste quiz e voltar ao modo de início. Irreversível!`)) return;
    try {
      // 1. Apaga do Admin Reports
      await supabase.from("quiz_reports").delete().eq("quiz_id", id);
      
      // 2. Chama RPC ou Força reinicialização via banco se tiver
      const { error } = await supabase.rpc("reset_quiz_data", { q_id: id });
      if (error) {
        // Se a RPC não existir ainda e der erro, avisa amigavelmente
        if (error.message.includes('function reset_quiz_data does not exist')) {
            alert("Aviso: Função de reset no Banco não foi instalada no painel SQL do Supabase. O quiz voltará ao modo espera, mas os pontos antigos dos jogadores precisarão ser apagados pela RPC.");
        } else {
            throw error;
        }
      }

      // Reinicia status da partida para a tela inicial 
      await supabase.from("quizzes").update({ status: 'waiting', current_question_index: 0 }).eq("id", id);

      fetchQuizzes();
      alert("Comando de Reiniciar executado!");
    } catch (err: any) {
      alert("Erro ao reiniciar: " + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)] p-4 md:p-8 transition-colors duration-300">
      <div className="max-w-5xl mx-auto space-y-8 pb-24">
        
        <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-12 py-4">
          <div className="flex flex-col items-center md:items-start gap-4 w-full md:w-auto text-center md:text-left">
            <div>
              <h1 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] bg-clip-text text-transparent italic tracking-tighter uppercase leading-none mb-3">Painel Admin</h1>
              <div className="flex flex-wrap gap-2 justify-center md:justify-start items-center">
                <span className="px-3 py-1 bg-[var(--surface)] border border-[var(--border)] rounded-full text-[8px] font-black uppercase text-slate-500 tracking-[0.2em] leading-none">Mestre do Quiz</span>
                {activeOrg && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-full shadow-lg shadow-emerald-500/5">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                    </span>
                    <span className="text-[8px] font-black uppercase tracking-widest leading-none">Base: {activeOrg.name}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-center md:justify-end gap-2 w-full md:w-auto p-1.5 bg-[var(--surface)] rounded-[2rem] border border-[var(--border)] shadow-xl">
            {[
              { id: "quizzes", label: "Quizzes" },
              { id: "org", label: "Base" },
              { id: "users", label: "Membros" },
              { id: "settings", label: "Config" }
            ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2.5 rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-[var(--primary)] text-white shadow-lg shadow-indigo-500/30' : 'text-slate-500 hover:text-white'}`}
              >
                {tab.label}
              </button>
            ))}
            <div className="w-[1px] bg-[var(--border)] mx-1 self-stretch hidden sm:block" />
            <button 
              onClick={() => router.push('/admin/reports')}
              className="px-4 py-2.5 rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white flex items-center gap-2"
            >
              <FileText size={14} /> Relatórios
            </button>
          </div>
        </div>

        {/* Not Active Org State */}
        {!activeOrg ? (
           <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-[var(--surface)] p-12 rounded-[3.5rem] border border-[var(--border)] text-center space-y-8">
              <Building2 size={48} className="mx-auto text-[var(--primary)]" />
              <div>
                <h2 className="text-3xl font-black italic uppercase tracking-tighter">Crie sua primeira Base</h2>
                <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest mt-2">Você precisa de uma base para criar quizzes e convidar membros.</p>
              </div>
              <div className="max-w-sm mx-auto space-y-4">
                <input 
                  type="text" 
                  placeholder="Nome da Base" 
                  title="Nome da nova Base"
                  aria-label="Nome da nova Base"
                  value={newOrgName} 
                  onChange={e => setNewOrgName(e.target.value)} 
                  className="w-full bg-[var(--background)] border border-[var(--border)] p-4 rounded-2xl font-black text-center"
                />
                <button 
                  onClick={() => createOrganization(newOrgName)} 
                  disabled={!newOrgName || loading}
                  className="w-full bg-[var(--primary)] text-white p-4 rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      CRIANDO...
                    </>
                  ) : (
                    "CRIAR BASE"
                  )}
                </button>
              </div>
           </motion.div>
        ) : (
          <div className="space-y-6">
            {/* Org Switcher Header */}
            <div className="flex items-center gap-3 bg-[var(--surface)] p-3 rounded-2xl border border-[var(--border)] w-fit">
               <Building2 size={18} className="text-[var(--primary)]" />
               <select 
                 value={activeOrg.id}
                 title="Selecionar Base"
                 aria-label="Selecionar Base"
                 onChange={(e) => {
                   if (e.target.value === "new") {
                     switchOrganization(""); // trigger create org state
                   } else {
                     switchOrganization(e.target.value);
                   }
                 }}
                 className="bg-transparent font-black text-[10px] uppercase tracking-widest text-[var(--foreground)] outline-none cursor-pointer"
               >
                 {organizations.map(org => (
                   <option key={org.id} value={org.id} className="text-black">{org.name}</option>
                 ))}
                 <option value="new" className="text-blue-500">+ Nova Base</option>
               </select>
            </div>

            {activeTab === "quizzes" && (
              <div className="grid md:grid-cols-3 gap-8">
                {!isPreviewing ? (
                  <div className="md:col-span-1 space-y-6">
                    <div className="bg-[var(--surface)] p-6 rounded-[2.5rem] border border-[var(--border)] shadow-2xl">
                      <div className="flex items-center gap-2 mb-6">
                        <Plus className="text-[var(--primary)]" size={20} />
                        <h2 className="font-black italic uppercase tracking-tighter">Novo Quiz</h2>
                      </div>
                      <div className="space-y-4">
                        <input 
                          type="text" 
                          placeholder="Título do Quiz" 
                          title="Título do Quiz"
                          aria-label="Título do Quiz"
                          value={title} 
                          onChange={e => setTitle(e.target.value)}
                          className="w-full bg-[var(--background)] border border-[var(--border)] p-4 rounded-2xl font-bold"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          {["classic", "event"].map(type => (
                            <button 
                                key={type}
                                onClick={() => setQuizType(type as any)}
                                className={`py-3 rounded-xl text-[9px] font-black uppercase border-2 transition-all ${quizType === type ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]' : 'border-[var(--border)] text-slate-500 hover:border-slate-700'}`}
                            >
                              {type === 'classic' ? 'Kahoot' : 'Evento'}
                            </button>
                          ))}
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest pl-1">Pontos por Pergunta</label>
                          <div className="flex flex-wrap gap-2">
                            {[1, 10, 50, 100, 500].map(pts => (
                              <button
                                key={pts}
                                onClick={() => setPointsPerQuestion(pts)}
                                className={`px-3 py-2 rounded-xl text-[10px] font-black border-2 transition-all ${pointsPerQuestion === pts ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]' : 'border-[var(--border)] text-slate-500 hover:border-slate-700'}`}
                              >
                                {pts}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest pl-1">Tempo por Pergunta</label>
                          <div className="flex flex-wrap gap-2">
                            {[0, 10, 20, 30, 60].map(sec => (
                              <button
                                key={sec}
                                onClick={() => setTimer(sec === 0 ? null : sec)}
                                className={`px-3 py-2 rounded-xl text-[10px] font-black border-2 transition-all ${((timer === null || timer === 0) && sec === 0) || timer === sec ? 'border-amber-500 bg-amber-500/10 text-amber-500' : 'border-[var(--border)] text-slate-500 hover:border-slate-700'}`}
                              >
                                {sec === 0 ? 'OFF' : `${sec}s`}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="p-1 bg-[var(--background)] rounded-xl border border-[var(--border)] flex">
                          {["file", "text", "manual"].map(m => (
                            <button 
                              key={m} 
                              onClick={() => setUploadMode(m as any)}
                              className={`flex-1 py-1.5 rounded-lg text-[8px] font-black uppercase ${uploadMode === m ? 'bg-[var(--surface)] text-[var(--primary)]' : 'text-slate-500'}`}
                            >
                              {m === 'file' ? 'Arquivo' : m === 'text' ? 'CSV' : 'Manual'}
                            </button>
                          ))}
                        </div>
                        {uploadMode === 'file' ? (
                          <div className="space-y-2">
                            <input type="file" accept=".csv" title="Upload de arquivo CSV" aria-label="Upload de arquivo CSV" onChange={e => setFile(e.target.files?.[0] || null)} className="w-full text-xs" />
                            <button onClick={handleDownloadTemplate} className="text-[9px] text-[var(--primary)] font-black uppercase tracking-widest hover:underline flex items-center gap-1">
                              <Download size={12} /> Baixar Modelo CSV
                            </button>
                          </div>
                        ) : uploadMode === 'text' ? (
                          <div className="space-y-2">
                            <textarea 
                              value={csvRawText} 
                              onChange={e => setCsvRawText(e.target.value)} 
                              className="w-full bg-[var(--background)] border p-4 rounded-xl h-24 text-[10px]"
                              placeholder="pergunta,opcao_a,opcao_b..."
                            />
                            <button onClick={handleDownloadTemplate} className="text-[9px] text-[var(--primary)] font-black uppercase tracking-widest hover:underline flex items-center gap-1">
                              <Download size={12} /> Ver Formato Exemplo
                            </button>
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-500 text-center py-4 italic">Modo manual... use o CSV por enquanto!</p>
                        )}
                        <button 
                          onClick={handlePreview}
                          disabled={loading || !title}
                          className="w-full bg-[var(--primary)] text-white p-4 rounded-2xl font-black uppercase text-xs"
                        >
                          Visualizar Perguntas
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="md:col-span-3 bg-[var(--surface)] p-8 rounded-[2.5rem] border border-[var(--border)]">
                     <h2 className="text-xl font-black italic uppercase mb-4">Preview ({previewQuestions.length} questões)</h2>
                      <div className="space-y-4 max-h-[50vh] overflow-y-auto mb-6 pr-2 custom-scrollbar">
                        {previewQuestions.map((q, i) => (
                          <div key={i} className="bg-[var(--background)] p-5 rounded-3xl border border-[var(--border)] space-y-3">
                            <div className="flex items-start gap-3">
                              <span className="w-6 h-6 flex items-center justify-center bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[10px] font-black text-slate-500">{i + 1}</span>
                              <p className="text-sm font-bold text-[var(--foreground)]">{q.question_text}</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-9">
                              {Object.entries(q.options).map(([key, value]) => {
                                if (!value) return null;
                                const isCorrect = q.correct_option === key;
                                return (
                                  <div 
                                    key={key} 
                                    className={`flex items-center gap-2 p-2 rounded-xl border text-[11px] transition-all ${isCorrect ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' : 'bg-[var(--surface)] border-[var(--border)] text-slate-500 opacity-60'}`}
                                  >
                                    <span className={`w-5 h-5 flex items-center justify-center rounded-lg text-[9px] font-black ${isCorrect ? 'bg-emerald-500 text-white' : 'bg-[var(--background)] border border-[var(--border)]'}`}>
                                      {key}
                                    </span>
                                    <span className="flex-1 truncate">{value as string}</span>
                                    {isCorrect && <CheckCircle2 size={12} strokeWidth={3} />}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                     <div className="flex gap-4">
                        <button onClick={handleResetPreview} className="flex-1 p-4 bg-slate-500/10 rounded-2xl font-black uppercase text-xs">Voltar</button>
                        <button onClick={handleCreateQuiz} className="flex-2 p-4 bg-[var(--primary)] text-white rounded-2xl font-black uppercase text-xs">Criar Quiz</button>
                     </div>
                  </div>
                )}

                {!isPreviewing && (
                  <div className="md:col-span-2 space-y-4">
                    {quizzes.length === 0 ? (
                      <div className="text-center p-12 bg-[var(--surface)] rounded-[2.5rem] border border-dashed border-[var(--border)] text-slate-500 uppercase font-black text-[10px]">Nenhum quiz criado nesta base.</div>
                    ) : quizzes.map(q => (
                      <div key={q.id} className="bg-[var(--surface)] p-4 rounded-[2rem] border border-[var(--border)] flex flex-col md:flex-row gap-4 md:items-center justify-between group">
                        <div className="flex items-center gap-4">
                           <div className="bg-[var(--background)] p-3 rounded-xl"><Gamepad2 size={20} /></div>
                           <div>
                              <h3 className="font-black italic uppercase tracking-tighter text-[var(--foreground)] leading-none">{q.title}</h3>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                 <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest border border-[var(--border)] px-1 rounded">#{q.pin}</span>
                                 <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full border ${q.quiz_type === 'event' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20'}`}>
                                   {q.quiz_type === 'event' ? 'Evento' : 'Kahoot'}
                                 </span>
                                 {q.status === 'finished' ? (
                                   <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border bg-slate-500/10 text-slate-500 border-slate-500/20">
                                     Finalizado
                                   </span>
                                 ) : q.scores_count && q.scores_count > 0 ? (
                                   <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                                     {q.scores_count} {q.scores_count === 1 ? 'Usuário' : 'Usuários'}
                                   </span>
                                 ) : (
                                   <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border bg-red-500/10 text-red-500 border-red-500/20">
                                     Zerado
                                   </span>
                                 )}
                              </div>
                           </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-1.5 bg-[var(--background)] p-1.5 rounded-2xl border border-[var(--border)]">
                             <span className="text-[7px] font-black uppercase text-slate-500 px-2 tracking-tighter">Pontos:</span>
                             {[1, 10, 50, 100, 500].map(pts => (
                               <button
                                 key={pts}
                                 onClick={() => handleUpdateQuizPoints(q.id, pts)}
                                 className={`px-2 py-1 rounded-lg text-[8px] font-black border transition-all ${q.points_per_question === pts ? 'bg-[var(--primary)] border-[var(--primary)] text-white' : 'bg-[var(--surface)] border-[var(--border)] text-slate-500'}`}
                               >
                                 {pts}
                               </button>
                             ))}
                          </div>
                          <div className="flex items-center gap-1.5 bg-[var(--background)] p-1.5 rounded-2xl border border-[var(--border)]">
                             <span className="text-[7px] font-black uppercase text-slate-500 px-2 tracking-tighter flex items-center gap-1"><Clock size={10} /> Tempo:</span>
                             {[0, 10, 20, 30, 60].map(sec => (
                               <button
                                 key={sec}
                                 onClick={() => handleUpdateQuizTimer(q.id, sec === 0 ? null : sec)}
                                 className={`px-2 py-1 rounded-lg text-[8px] font-black border transition-all ${((q.timer_per_question === null || q.timer_per_question === 0) && sec === 0) || q.timer_per_question === sec ? 'bg-amber-500 border-amber-500 text-white' : 'bg-[var(--surface)] border-[var(--border)] text-slate-500'}`}
                               >
                                 {sec === 0 ? 'OFF' : `${sec}s`}
                               </button>
                             ))}
                          </div>
                        </div>
                        <div className="flex gap-2">
                           <button onClick={() => handleDownloadAnswersReport(q.id, q.title)} title="Baixar Relatório de Respostas" aria-label="Baixar Relatório de Respostas" className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white transition-all"><Download size={16} /></button>
                           <button onClick={() => handleFinishQuiz(q.id, q.title)} title="Finalizar" aria-label="Finalizar" className="p-2.5 rounded-xl bg-slate-500/10 text-slate-500 border border-slate-500/20 hover:bg-slate-500 hover:text-white transition-all"><CheckSquare size={16} /></button>
                           <button onClick={() => handleResetQuiz(q.id, q.title)} title="Reiniciar" aria-label="Reiniciar" className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500 hover:text-white transition-all"><RotateCcw size={16} /></button>
                           <button onClick={() => router.push(`/admin/${q.id}`)} title="Gerenciar Quiz" aria-label="Gerenciar Quiz" className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20 hover:bg-blue-500 hover:text-white transition-all"><ExternalLink size={16} /></button>
                           <button onClick={() => handleDeleteQuiz(q.id)} title="Excluir Quiz" aria-label="Excluir Quiz" className="p-2.5 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all"><Trash2 size={16} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "org" && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid md:grid-cols-2 gap-8">
                <div className="bg-[var(--surface)] p-8 rounded-[3rem] border border-[var(--border)]">
                  <div className="flex items-center gap-2 mb-6">
                    <UserPlus size={20} className="text-[var(--primary)]" />
                    <h2 className="font-black italic uppercase tracking-tighter">Convidar Membro</h2>
                  </div>
                  <div className="space-y-4">
                    <input type="email" placeholder="Email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} className="w-full bg-[var(--background)] border p-4 rounded-xl font-bold" />
                    <div className="flex gap-2">
                       {["member", "admin"].map(role => (
                         <button key={role} onClick={() => setInviteRole(role as any)} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase border-2 ${inviteRole === role ? 'border-[var(--primary)] text-[var(--primary)]' : 'border-[var(--border)] text-slate-500'}`}>
                           {role === 'admin' ? 'Administrador' : 'Membro'}
                         </button>
                       ))}
                    </div>
                    <button onClick={handleSendInvite} disabled={loading || !inviteEmail} className="w-full bg-[var(--primary)] text-white p-4 rounded-2xl font-black uppercase text-xs">ENVIAR CONVITE</button>
                  </div>
                </div>
                <div className="bg-[var(--surface)] p-8 rounded-[3rem] border border-[var(--border)]">
                  <div className="flex items-center gap-2 mb-6"><Building2 size={20} className="text-blue-500" /><h2 className="font-black italic uppercase tracking-tighter">Sobre esta Base</h2></div>
                  <div className="space-y-4">
                     <p className="text-[8px] font-black uppercase text-slate-500 tracking-widest">ID: {activeOrg.id}</p>
                     <p className="text-[10px] text-slate-400 italic">Esta base isola todos os dados de quizzes e rankings.</p>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "users" && (
               <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-center bg-[var(--surface)] p-6 rounded-[2.5rem] border border-[var(--border)] gap-4 mb-2">
                    <div className="flex items-center gap-3">
                      <Users size={22} className="text-[var(--primary)]" />
                      <div>
                        <h2 className="font-black text-[var(--foreground)] italic tracking-tighter uppercase text-lg leading-none">Membros</h2>
                        <p className="text-[8px] font-black uppercase text-slate-500 tracking-widest mt-1">Gestão da Base</p>
                      </div>
                    </div>
                    <button onClick={handleResetRanking} title="Zerar Ranking da Base" aria-label="Zerar Ranking da Base" className="w-full sm:w-auto flex items-center justify-center gap-2 text-[9px] bg-amber-500/10 text-amber-500 px-5 py-3 rounded-2xl border border-amber-500/20 font-black uppercase hover:bg-amber-500 hover:text-white transition-all shadow-lg shadow-amber-500/5">
                      <RotateCcw size={14} /> Reset Ranking
                    </button>
                  </div>

                  <div className="space-y-3">
                     {allUsers.map(u => {
                       const isAdmin = u.base_role === 'admin';
                       return (
                         <div key={u.id} className={`p-4 rounded-3xl border transition-all flex flex-col sm:flex-row items-center justify-between gap-4 ${isAdmin ? 'bg-purple-500/[0.03] border-purple-500/20 shadow-xl shadow-purple-500/[0.02]' : 'bg-[var(--surface)] border-[var(--border)]'}`}>
                            <div className="flex items-center gap-4 w-full sm:w-auto">
                               <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black italic text-xl shrink-0 ${isAdmin ? 'bg-gradient-to-br from-purple-500 to-indigo-500 text-white shadow-lg shadow-purple-500/20' : 'bg-[var(--primary)]/10 text-[var(--primary)]'}`}>
                                 {u.nickname?.[0]}
                               </div>
                               <div className="min-w-0 flex-1">
                                  <p className="font-black italic uppercase text-sm tracking-tighter leading-none truncate">{u.nickname}</p>
                                  <div className="flex items-center gap-1.5 mt-1.5">
                                     <span className={`text-[7px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-full border ${isAdmin ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-slate-500/10 text-slate-500 border-slate-500/20'}`}>
                                       {isAdmin ? 'ADMIN' : 'MEMBRO'}
                                     </span>
                                     {isAdmin && <ShieldCheck size={10} className="text-amber-500" />}
                                  </div>
                               </div>
                            </div>

                            {u.id !== currentUser?.id && (
                              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                                <button 
                                  onClick={() => handlePromoteAdmin(u.id, u.base_role)} 
                                  title={isAdmin ? "Remover Admin" : "Tornar Admin"}
                                  aria-label={isAdmin ? "Remover Admin" : "Tornar Admin"}
                                  className={`flex-1 sm:flex-none px-4 py-2.5 rounded-2xl border font-black uppercase text-[8px] tracking-widest transition-all ${
                                    isAdmin 
                                      ? 'text-red-500 border-red-500/20 hover:bg-red-500 hover:text-white' 
                                      : 'text-purple-500 border-purple-500/20 hover:bg-purple-500 hover:text-white'
                                  }`}
                                >
                                  {isAdmin ? 'Rebaixar' : 'Promover'}
                                </button>
                                <button 
                                  onClick={() => handleRemoveMember(u.id)} 
                                  title="Remover Membro" 
                                  aria-label="Remover Membro" 
                                  className="p-3 bg-red-500/10 text-red-500 border border-red-500/20 rounded-2xl hover:bg-red-500 hover:text-white transition-all shadow-lg shadow-red-500/5 group"
                                >
                                  <Trash2 size={14} className="group-hover:scale-110 transition-transform" />
                                </button>
                              </div>
                            )}
                         </div>
                       );
                     })}
                  </div>
               </motion.div>
            )}

            {activeTab === "settings" && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid md:grid-cols-2 gap-8">
                 <div className="bg-[var(--surface)] p-8 rounded-[2.5rem] border border-[var(--border)] text-center">
                    <h2 className="font-black italic uppercase mb-4 text-sm">Moeda</h2>
                    <div className="grid grid-cols-2 gap-2">
                       {["Pontos", "Dracmas", "Talentos", "Denários"].map(c => (
                         <button key={c} onClick={() => updateGlobalSetting("currency", c)} className={`p-4 rounded-xl text-[10px] font-black uppercase border-2 ${globalSettings.currency === c ? 'border-[var(--primary)] bg-[var(--primary)]/5 text-[var(--primary)]' : 'border-transparent bg-[var(--background)] text-slate-500'}`}>{c}</button>
                       ))}
                    </div>
                 </div>
                 <div className="bg-[var(--surface)] p-8 rounded-[2.5rem] border border-[var(--border)] text-center">
                    <h2 className="font-black italic uppercase mb-4 text-sm">Default XP</h2>
                    <div className="grid grid-cols-3 gap-2">
                         {[1, 10, 50, 100, 200, 500].map(v => (
                           <button key={v} onClick={() => updateGlobalSetting("points_per_question", v.toString())} className={`p-4 rounded-xl text-[10px] font-black uppercase border-2 ${globalSettings.points_per_question === v ? 'border-emerald-500 bg-emerald-500/5 text-emerald-500' : 'border-transparent bg-[var(--background)] text-slate-500'}`}>{v}</button>
                         ))}
                     </div>
                 </div>
              </motion.div>
            )}
          </div>
        )}

        <AnimatePresence>
          {status && (
             <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl font-black uppercase text-[10px] shadow-2xl z-50 flex items-center gap-2 ${status.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
               {status.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
               {status.msg}
             </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 z-40 md:hidden bg-gradient-to-t from-[var(--background)] to-transparent">
        <div className="bg-[var(--surface)]/90 backdrop-blur-xl border border-[var(--border)] p-2 rounded-[2rem] flex justify-between items-center">
            <button onClick={() => router.push('/')} className="flex-1 flex flex-col items-center gap-1 text-slate-500"><ShieldCheck size={20} /><span className="text-[7px] font-black uppercase">Home</span></button>
            <button onClick={() => setActiveTab('quizzes')} className={`flex-1 flex flex-col items-center gap-1 ${activeTab === 'quizzes' ? 'text-[var(--primary)]' : 'text-slate-500'}`}><Settings size={20} /><span className="text-[7px] font-black uppercase">Admin</span></button>
            <button onClick={() => router.push('/leaderboard')} className="flex-1 flex flex-col items-center gap-1 text-slate-500"><Users size={20} /><span className="text-[7px] font-black uppercase">Ranking</span></button>
        </div>
      </div>
    </div>
  );
}
