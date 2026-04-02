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
  const { user: currentUser } = useUser();
  const [activeTab, setActiveTab] = useState<"quizzes" | "users">("quizzes");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState<number | null>(null);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
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
      // Com a ativação do ON DELETE CASCADE no banco, 
      // deletar o usuário já limpa automaticamente 'scores' e 'answers'.
      const { error } = await supabase.from("users").delete().eq("id", userId);
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
      
      // O banco de dados agora gerencia a cascata automaticamente
      const { error } = await supabase.from("users").delete().in("id", anonIds);
      if (error) throw error;

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
          </div>
        </div>

        {activeTab === "quizzes" ? (
          <div className="grid md:grid-cols-3 gap-8">
            {/* Seção de Quizzes (Original) */}
            <div className="md:col-span-1 space-y-6">
              {/* Criar Novo Quiz */}
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
                      type="text"
                      placeholder="Ex: Histórias Bíblicas"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full bg-[var(--background)] border border-[var(--border)] p-4 rounded-2xl font-bold text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] transition-all"
                    />
                  </div>

                  {/* ... resto do form de quiz ... */}
                  <div className="space-y-1.5 pt-2">
                    <button onClick={downloadTemplate} className="text-[9px] text-[var(--primary)] font-black uppercase tracking-widest flex items-center gap-1">
                      <Download size={12} /> Baixar Modelo CSV
                    </button>
                  </div>

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

                  <button
                    onClick={handleCreateQuiz}
                    disabled={loading || !title || !file}
                    className="w-full bg-[var(--primary)] text-white p-4 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl disabled:opacity-50 transition-all active:scale-95"
                  >
                    {loading ? <Loader2 className="animate-spin" /> : "CRIAR PARTIDA 🚀"}
                  </button>
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
                      aria-label={`Gerenciar partida ${q.title}`}
                    >
                      <ExternalLink size={18} />
                    </button>
                    <button 
                      onClick={() => handleDeleteQuiz(q.id)} 
                      className="p-2.5 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all"
                      title="Excluir Quiz"
                      aria-label={`Excluir quiz ${q.title}`}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Aba de Gestão de Usuários */
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="bg-[var(--surface)] rounded-[2.5rem] border border-[var(--border)] overflow-hidden shadow-2xl">
              <div className="p-6 border-b border-[var(--border)] flex justify-between items-center bg-[var(--background)]/50">
                <h2 className="font-black text-[var(--foreground)] italic tracking-tighter uppercase">Membros de Comunidade</h2>
                <div className="flex items-center gap-4">
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
                             title={u.role === 'admin' ? "Remover Admin" : "Tornar Admin"}
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
        )}
      </div>
    </div>
  );
}
