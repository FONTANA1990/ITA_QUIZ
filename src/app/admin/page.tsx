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
      setStatus({ type: "error", msg: "Erro ao atualizar permissão." });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string, nickname: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir permanentemente o usuário "${nickname}"? Esta ação é irreversível e removerá todos os seus scores.`)) return;

    setLoading(true);
    try {
      // 1. Remover scores vinculados
      await supabase.from("scores").delete().eq("user_id", userId);
      // 2. Remover respostas vinculadas
      await supabase.from("answers").delete().eq("user_id", userId);
      // 3. Remover o usuário da tabela pública
      const { error } = await supabase.from("users").delete().eq("id", userId);

      if (error) throw error;

      setStatus({ type: "success", msg: "Usuário removido com sucesso!" });
      fetchUsers();
    } catch (err: any) {
      console.error("Erro ao deletar usuário:", err);
      setStatus({ type: "error", msg: "Erro ao remover usuário. Verifique permissões." });
    } finally {
      setLoading(false);
    }
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
                    <button onClick={() => router.push(`/admin/${q.id}`)} className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20 hover:bg-blue-500 hover:text-white transition-all"><ExternalLink size={18} /></button>
                    <button onClick={() => handleDeleteQuiz(q.id)} className="p-2.5 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all"><Trash2 size={18} /></button>
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
                <div className="flex items-center gap-2 text-[10px] text-slate-500 font-black uppercase tracking-widest">
                  <Users size={14} /> {allUsers.length} Logados
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-[var(--background)]/30">
                    <tr>
                      <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-500">Usuário</th>
                      <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-500">Email</th>
                      <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-500">Pontos</th>
                      <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-500">Cargo</th>
                      <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-500 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {allUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-[var(--primary)]/5 transition-colors group">
                        <td className="px-6 py-4">
                          <span className="font-black text-sm text-white italic uppercase tracking-tighter">{u.nickname}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs text-slate-400 font-medium">{u.email}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-xs font-black text-[var(--primary)] uppercase italic leading-none">{u.total_points}</span>
                            <span className="text-[8px] text-slate-600 font-bold uppercase tracking-widest mt-0.5">Pontos Totais</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                            u.role === 'admin' ? 'bg-[#A855F7]/20 text-[#A855F7] border border-[#A855F7]/30' : 'bg-slate-800 text-slate-500'
                          }`}>
                            {u.role === 'admin' ? 'Admin' : 'Jogador'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            {u.id !== currentUser?.id && (
                              <>
                                <button
                                  onClick={() => handlePromoteAdmin(u.id, u.role)}
                                  className={`p-2 rounded-xl border transition-all ${
                                    u.role === 'admin' 
                                      ? 'bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white' 
                                      : 'bg-[#A855F7]/10 border-[#A855F7]/20 text-[#A855F7] hover:bg-[#A855F7] hover:text-white'
                                  }`}
                                  title={u.role === 'admin' ? "Remover Admin" : "Tornar Admin"}
                                  aria-label={u.role === 'admin' ? "Remover cargo de administrador" : "Promover a administrador"}
                                >
                                  <ShieldCheck size={16} />
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(u.id, u.nickname)}
                                  className="p-2 rounded-xl border bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-lg"
                                  title="Excluir Usuário"
                                  aria-label={`Excluir usuário ${u.nickname}`}
                                >
                                  <Trash2 size={16} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
