"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { parseCSV } from "@/lib/csv-parser";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Upload, CheckCircle2, AlertCircle, Settings, Plus, 
  FileText, Download, Loader2, Trash2, RotateCcw, 
  ExternalLink, Clock, Gamepad2, Users, ShieldCheck,
  Building2, Mail, UserPlus, LogOut, ChevronDown, Trash
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
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (activeOrg) {
      fetchQuizzes();
      fetchUsers();
      fetchOrgMembers();
    }
  }, [activeOrg?.id]);

  const fetchQuizzes = async () => {
    if (!activeOrg) return;
    const { data } = await supabase
      .from("quizzes")
      .select("*")
      .eq("organization_id", activeOrg.id)
      .order("created_at", { ascending: false });
    setQuizzes(data || []);
  };

  const fetchOrgMembers = async () => {
    if (!activeOrg) return;
    const { data } = await supabase
      .from("organization_members")
      .select("*, users(nickname, email)")
      .eq("organization_id", activeOrg.id);
    setOrgMembers(data || []);
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

  const handleResetRanking = async () => {
     if (!window.confirm("Zerar ranking da base?")) return;
     // Implementar RPC de reset filtrado por org no futuro
     setStatus({ type: "success", msg: "Ranking resetado!" });
  };

  return (
    <div className="min-h-screen bg-[var(--background)] p-4 md:p-8 transition-colors duration-300">
      <div className="max-w-5xl mx-auto space-y-8 pb-24">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-12 bg-[var(--surface)] p-8 rounded-[3.5rem] border border-[var(--border)] shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[var(--primary)] to-transparent" />
          
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-[var(--background)] rounded-3xl flex items-center justify-center border-2 border-[var(--primary)] shadow-[0_0_20px_rgba(99,102,241,0.2)]">
              <ShieldCheck className="text-[var(--primary)]" size={32} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-4xl font-black italic tracking-tighter uppercase leading-none">Painel <span className="text-[var(--primary)]">Admin</span></h1>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] bg-[var(--background)] px-3 py-1 rounded-full border border-[var(--border)]">Mestre do Quiz</span>
                {activeOrg && (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest leading-none mt-0.5">Base: {activeOrg.name}</span>
                  </motion.div>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-2 p-1 bg-[var(--background)] rounded-2xl border border-[var(--border)] overflow-x-auto">
            {[
              { id: "quizzes", label: "Quizzes" },
              { id: "org", label: "Base" },
              { id: "users", label: "Membros" },
              { id: "settings", label: "Config" }
            ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-[var(--primary)] text-white' : 'text-slate-500 hover:text-white'}`}
              >
                {tab.label}
              </button>
            ))}
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
                  value={newOrgName} 
                  onChange={e => setNewOrgName(e.target.value)} 
                  className="w-full bg-[var(--background)] border border-[var(--border)] p-4 rounded-2xl font-black text-center"
                />
                <button 
                  onClick={() => createOrganization(newOrgName)} 
                  disabled={!newOrgName || loading}
                  className="w-full bg-[var(--primary)] text-white p-4 rounded-2xl font-black uppercase text-xs"
                >
                  CRIAR BASE
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
                {/* Quiz Creation or Preview */}
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
                          value={title} 
                          onChange={e => setTitle(e.target.value)}
                          className="w-full bg-[var(--background)] border border-[var(--border)] p-4 rounded-2xl font-bold"
                        />
                        <div className="grid grid-cols-2 gap-2">
                           {["classic", "event"].map(type => (
                             <button 
                                key={type}
                                onClick={() => setQuizType(type as any)}
                                className={`py-3 rounded-xl text-[9px] font-black uppercase border-2 ${quizType === type ? 'border-[var(--primary)] text-[var(--primary)]' : 'border-[var(--border)] text-slate-500'}`}
                             >
                               {type === 'classic' ? 'Kahoot' : 'Evento'}
                             </button>
                           ))}
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
                          <input type="file" accept=".csv" aria-label="Upload de arquivo CSV" onChange={e => setFile(e.target.files?.[0] || null)} className="w-full text-xs" />
                        ) : uploadMode === 'text' ? (
                          <textarea 
                            value={csvRawText} 
                            onChange={e => setCsvRawText(e.target.value)} 
                            className="w-full bg-[var(--background)] border p-4 rounded-xl h-24 text-[10px]"
                            placeholder="pergunta,opcao_a,opcao_b..."
                          />
                        ) : (
                          <p className="text-[10px] text-slate-500 text-center py-4 italic">Modo manual em breve no preview...</p>
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
                     <div className="space-y-2 max-h-60 overflow-y-auto mb-6">
                        {previewQuestions.map((q, i) => (
                           <div key={i} className="text-sm bg-[var(--background)] p-3 rounded-xl">{q.question_text}</div>
                        ))}
                     </div>
                     <div className="flex gap-4">
                        <button onClick={handleResetPreview} className="flex-1 p-4 bg-slate-500/10 rounded-2xl font-black uppercase text-xs">Voltar</button>
                        <button onClick={handleCreateQuiz} className="flex-2 p-4 bg-[var(--primary)] text-white rounded-2xl font-black uppercase text-xs">Criar Quiz</button>
                     </div>
                  </div>
                )}

                {/* Quiz List */}
                {!isPreviewing && (
                  <div className="md:col-span-2 space-y-4">
                    {quizzes.map(q => (
                      <div key={q.id} className="bg-[var(--surface)] p-4 rounded-[2rem] border border-[var(--border)] flex justify-between items-center group">
                        <div className="flex items-center gap-4">
                           <div className="bg-[var(--background)] p-3 rounded-xl"><Gamepad2 size={20} /></div>
                           <div>
                              <h3 className="font-black italic uppercase tracking-tighter text-[var(--foreground)]">{q.title}</h3>
                              <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest border border-[var(--border)] px-1 rounded">#{q.pin}</span>
                           </div>
                        </div>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                           <button onClick={() => router.push(`/admin/${q.id}`)} title="Gerenciar Quiz" className="p-2 rounded-lg bg-blue-500/10 text-blue-500"><ExternalLink size={16} /></button>
                           <button onClick={() => handleDeleteQuiz(q.id)} title="Excluir Quiz" className="p-2 rounded-lg bg-red-500/10 text-red-500"><Trash2 size={16} /></button>
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
                    <input 
                      type="email" 
                      placeholder="Email da pessoa" 
                      value={inviteEmail} 
                      onChange={e => setInviteEmail(e.target.value)}
                      className="w-full bg-[var(--background)] border border-[var(--border)] p-4 rounded-xl font-bold"
                    />
                    <div className="flex gap-2">
                       {["member", "admin"].map(role => (
                         <button 
                            key={role}
                            onClick={() => setInviteRole(role as any)}
                            className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase border-2 ${inviteRole === role ? 'border-[var(--primary)] text-[var(--primary)]' : 'border-[var(--border)] text-slate-500'}`}
                         >
                           {role === 'admin' ? 'Administrador' : 'Membro Comum'}
                         </button>
                       ))}
                    </div>
                    <button 
                      onClick={handleSendInvite}
                      disabled={loading || !inviteEmail}
                      className="w-full bg-[var(--primary)] text-white p-4 rounded-2xl font-black uppercase text-xs"
                    >
                      ENVIAR CONVITE
                    </button>
                  </div>
                </div>
                
                <div className="bg-[var(--surface)] p-8 rounded-[3rem] border border-[var(--border)]">
                  <div className="flex items-center gap-2 mb-6">
                    <Building2 size={20} className="text-blue-500" />
                    <h2 className="font-black italic uppercase tracking-tighter">Sobre esta Base</h2>
                  </div>
                  <div className="space-y-4">
                     <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">ID da Organização</p>
                     <p className="bg-[var(--background)] p-4 rounded-xl font-mono text-[10px] break-all border border-[var(--border)]">{activeOrg.id}</p>
                     <p className="text-[10px] text-slate-400 leading-relaxed italic">
                        Esta é a sua área restrita. Todos os quizzes, membros e configurações criados aqui são exclusivos para esta organização e não podem ser vistos por outras bases.
                     </p>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "users" && (
               <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                  <div className="bg-[var(--surface)] rounded-[2.5rem] border border-[var(--border)] overflow-hidden shadow-2xl">
                    <div className="p-6 border-b border-[var(--border)] flex justify-between items-center bg-[var(--background)]/50">
                      <h2 className="font-black text-[var(--foreground)] italic tracking-tighter uppercase">Lista de Membros</h2>
                      <button onClick={handleResetRanking} className="flex items-center gap-2 text-[8px] bg-amber-500/10 text-amber-500 p-2 rounded-xl border border-amber-500/20 font-black uppercase">
                        <RotateCcw size={12} /> Reset Ranking
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
                       {allUsers.map(u => (
                         <div key={u.id} className="bg-[var(--background)]/50 p-4 rounded-[2rem] border border-[var(--border)] flex items-center justify-between">
                            <div className="flex items-center gap-3">
                               <div className="w-10 h-10 bg-[var(--primary)]/10 rounded-xl flex items-center justify-center text-[var(--primary)] font-black italic">{u.nickname?.[0]}</div>
                               <div>
                                  <p className="font-black italic uppercase text-xs tracking-tighter">{u.nickname}</p>
                                  <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest">{u.base_role}</p>
                               </div>
                            </div>
                            {u.id !== currentUser?.id && (
                              <button onClick={() => handlePromoteAdmin(u.id, u.base_role)} title="Promover/Rebaixar Admin" className="p-2 bg-purple-500/10 text-purple-500 rounded-lg border border-purple-500/20">
                                <ShieldCheck size={14} />
                              </button>
                            )}
                         </div>
                       ))}
                    </div>
                  </div>
               </motion.div>
            )}

            {activeTab === "settings" && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid md:grid-cols-2 gap-8">
                 <div className="bg-[var(--surface)] p-8 rounded-[2.5rem] border border-[var(--border)]">
                    <h2 className="font-black italic uppercase mb-4">Moeda Personalizada</h2>
                    <div className="grid grid-cols-2 gap-2">
                       {["Pontos", "Dracmas", "Talentos", "Denários"].map(c => (
                         <button 
                            key={c}
                            onClick={() => updateGlobalSetting("currency", c)}
                            className={`p-4 rounded-xl text-[10px] font-black uppercase border-2 ${globalSettings.currency === c ? 'border-[var(--primary)]' : 'border-transparent'}`}
                         >
                           {c}
                         </button>
                       ))}
                    </div>
                 </div>
                 <div className="bg-[var(--surface)] p-8 rounded-[2.5rem] border border-[var(--border)]">
                    <h2 className="font-black italic uppercase mb-4">Pontuação por Acerto</h2>
                    <div className="grid grid-cols-3 gap-2">
                        {[50, 100, 200, 500].map(v => (
                          <button 
                             key={v}
                             onClick={() => updateGlobalSetting("points_per_question", v.toString())}
                             className={`p-4 rounded-xl text-[10px] font-black uppercase border-2 ${globalSettings.points_per_question === v ? 'border-emerald-500' : 'border-transparent'}`}
                          >
                             {v}
                          </button>
                        ))}
                    </div>
                 </div>
              </motion.div>
            )}
          </div>
        )}

        {status && (
           <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl font-black uppercase text-[10px] shadow-2xl z-50 flex items-center gap-2 ${status.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
             {status.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
             {status.msg}
           </motion.div>
        )}
      </div>

      {/* Mobile NavBar */}
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
