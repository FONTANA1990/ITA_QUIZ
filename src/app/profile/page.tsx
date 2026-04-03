"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  User, Settings, Shield, Bell, HelpCircle, LogOut, 
  ChevronRight, ArrowLeft, Moon, Sun, Check, Coins, 
  Lock, Key, Loader2, Building2
} from "lucide-react";
import { useUser } from "@/context/UserContext";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

const avatars = [
  "🎮", "🛡️", "🔥", "💎", "🌟", "🦁", "🕊️", "⚓", "👑", "📜",
  "🦦", "🐕", "🐼", "🦜", "⚽", "🐒", "🥥", "🐆", "🏖️", "🩴"
];

export default function Profile() {
  const { preferences, setTheme, setAvatar, user, logout, pendingInvites, acceptInvite, declineInvite } = useUser();
  const [activeTab, setActiveTab] = useState<"menu" | "settings" | "avatars" | "privacy" | "help" | "adminAuth" | "invites">("menu");
  const router = useRouter();
  
  // States do Login
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authSuccess, setAuthSuccess] = useState("");

  // Cálculo de Ranking Dinâmico
  const points = user?.total_points || 0;
  const level = Math.floor(points / 500) + 1;
  const getRank = () => {
    if (points >= 5000) return "Ouro";
    if (points >= 1000) return "Prata";
    return "Bronze";
  };

  const handleAuth = async (isSignUp: boolean) => {
    if (!email || !password) {
      setAuthError("Preencha email e senha");
      return;
    }
    setAuthLoading(true);
    setAuthError("");
    setAuthSuccess("");
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setAuthSuccess("Conta criada! Verifique seu email ou tente logar.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setAuthSuccess("Sucesso! Entrando...");
        setTimeout(() => setActiveTab("menu"), 1000);
      }
    } catch (err: any) {
      setAuthError(err.message || "Erro de autenticação");
    } finally {
      setAuthLoading(false);
    }
  };

  const renderHeader = (title: string) => (
    <div className="flex items-center gap-4 mb-8">
      <button 
        onClick={() => {
          setActiveTab("menu");
          setAuthError("");
          setAuthSuccess("");
          setPassword("");
        }}
        aria-label="Voltar ao menu"
        className="p-2 bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft size={20} />
      </button>
      <h1 className="text-2xl font-black text-[var(--foreground)] italic tracking-tighter uppercase leading-none">{title}</h1>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-[var(--background)] p-4 pb-24 transition-colors duration-300">
      <AnimatePresence mode="wait">
        {activeTab === "menu" && (
          <motion.div
            key="menu"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="flex flex-col flex-1"
          >
            <div className="flex flex-col items-center mt-12 mb-10">
              <div className="w-28 h-28 bg-gradient-to-tr from-[var(--primary)] to-[var(--secondary)] rounded-[2.5rem] p-1 shadow-3xl shadow-indigo-500/20 rotate-3 group relative">
                <div className="w-full h-full bg-[var(--surface)] rounded-[2.3rem] flex items-center justify-center border-4 border-[var(--background)] -rotate-3 transition-transform group-hover:rotate-0">
                  <span className="text-6xl">{preferences.avatar}</span>
                </div>
                <button 
                  onClick={() => setActiveTab("avatars")}
                  aria-label="Escolher avatar"
                  className="absolute bottom-0 right-0 bg-[var(--primary)] p-2 rounded-xl text-white shadow-lg"
                >
                  <Settings size={16} />
                </button>
              </div>
              <h2 className="mt-6 text-3xl font-black text-[var(--foreground)] italic tracking-tighter uppercase leading-none text-center">
                {user?.nickname || "JOGADOR ITA"}
              </h2>
              <span className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-3 bg-[var(--surface)] px-4 py-1.5 rounded-full border border-[var(--border)]">
                 Nível {level} • {getRank()}
              </span>
            </div>

            <div className="space-y-2">
              <MenuButton 
                label="Configurações da Conta" 
                icon={Settings} 
                color="text-[#6366F1]" 
                onClick={() => setActiveTab("settings")} 
              />
              <MenuButton 
                label="Privacidade e Segurança" 
                icon={Shield} 
                color="text-[#22D3EE]" 
                onClick={() => setActiveTab("help")} 
              />
              {pendingInvites.length > 0 && (
                <MenuButton 
                  label={`Convites Pendentes (${pendingInvites.length})`} 
                  icon={Bell} 
                  color="text-amber-500 animate-pulse" 
                  onClick={() => setActiveTab("invites")} 
                />
              )}
              {!user && (
                <MenuButton 
                  label="Entrar ou Cadastrar" 
                  icon={User} 
                  color="text-[#A855F7]" 
                  onClick={() => setActiveTab("adminAuth")} 
                />
              )}
              {(user?.role === 'admin' || user?.email === 'mediattamoveis@gmail.com') && (
                <MenuButton 
                  label="Painel Administrativo" 
                  icon={Shield} 
                  color="text-[#A855F7]" 
                  onClick={() => router.push("/admin")} 
                />
              )}
            </div>

            {user && (
              <div className="mt-auto items-center flex justify-center pb-8 pt-8">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={logout}
                  className="flex items-center gap-2 text-[#EF4444] font-black uppercase text-[10px] tracking-[0.2em] bg-[#EF4444]/10 px-8 py-4 rounded-full border border-[#EF4444]/20 hover:bg-[#EF4444]/20 transition-all italic"
                >
                  <LogOut size={16} strokeWidth={3} /> SAIR DO APP
                </motion.button>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === "settings" && (
          <motion.div
            key="settings"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            {renderHeader("Configurações")}
            
            <div className="space-y-6">
              <section className="bg-[var(--surface)] p-6 rounded-[2rem] border border-[var(--border)] shadow-xl">
                <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-4 block italic">Tema Visual</label>
                <div className="flex gap-4">
                  <ThemeToggle 
                    active={preferences.theme === "light"} 
                    icon={Sun} 
                    label="Claro" 
                    onClick={() => setTheme("light")} 
                  />
                  <ThemeToggle 
                    active={preferences.theme === "dark"} 
                    icon={Moon} 
                    label="Escuro" 
                    onClick={() => setTheme("dark")} 
                  />
                </div>
              </section>

            </div>
          </motion.div>
        )}

        {activeTab === "avatars" && (
          <motion.div
            key="avatars"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {renderHeader("Escolha seu Avatar")}
            <div className="grid grid-cols-4 gap-4">
              {avatars.map((a) => (
                <button
                  key={a}
                  onClick={() => {
                    setAvatar(a);
                    setActiveTab("menu");
                  }}
                  className={`text-3xl p-4 rounded-2xl transition-all ${
                    preferences.avatar === a ? "bg-[var(--primary)] scale-110 shadow-lg" : "bg-[var(--surface)] hover:bg-[var(--background)]"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === "privacy" && (
          <motion.div
            key="privacy"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {renderHeader("Privacidade")}
            <div className="bg-[var(--surface)] p-6 rounded-3xl border border-[var(--border)] space-y-4">
               <p className="text-sm text-slate-400 font-medium">Seus dados de perfil e preferências são armazenados de forma segura.</p>
               <p className="text-sm text-slate-400 font-medium">Ao jogar, sua Pontuação é enviada ao servidor ITA QUIZ para o Ranking Global.</p>
               <div className="pt-4 border-t border-[var(--border)]">
                 <button className="text-[var(--primary)] font-black uppercase text-[10px] tracking-widest">Ver termos completos</button>
               </div>
            </div>
          </motion.div>
        )}

        {activeTab === "help" && (
          <motion.div
            key="help"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {renderHeader("Ajuda")}
            <div className="space-y-4">
               <div className="bg-[var(--surface)] p-6 rounded-3xl border border-[var(--border)]">
                  <h4 className="font-black text-[var(--foreground)] uppercase text-sm mb-2">Como jogar?</h4>
                  <p className="text-xs text-slate-500 leading-relaxed font-medium">Digite o código da sala fornecido pelo admin e escolha um apelido. Responda o mais rápido possível para ganhar bônus!</p>
               </div>
               <div className="bg-[var(--surface)] p-6 rounded-3xl border border-[var(--border)]">
                  <h4 className="font-black text-[var(--foreground)] uppercase text-sm mb-2">Problemas técnicos?</h4>
                  <p className="text-xs text-slate-500 leading-relaxed font-medium">Se o jogo travar, tente atualizar a página ou verificar sua conexão com a internet.</p>
               </div>
            </div>
          </motion.div>
        )}
        {activeTab === "adminAuth" && (
          <motion.div
            key="adminAuth"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {renderHeader("Entrar no App")}
            <div className="bg-[var(--surface)] p-6 rounded-3xl border border-[var(--border)] shadow-xl space-y-4">
               <div className="text-center mb-6">
                 <div className="w-16 h-16 bg-[#A855F7]/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-[#A855F7]/20">
                   <User size={32} className="text-[#A855F7]" />
                 </div>
                 <p className="text-sm font-medium text-slate-400">Identifique-se para salvar seu progresso e conquistas.</p>
               </div>

               {authError && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-black uppercase text-center">{authError}</div>}
               {authSuccess && <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-500 text-xs font-black uppercase text-center">{authSuccess}</div>}

               <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <label htmlFor="adminEmail" className="text-[10px] text-slate-500 font-black uppercase tracking-widest pl-2">Email</label>
                    <input 
                      id="adminEmail"
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      aria-label="Email Admin"
                      className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl py-3 px-4 text-sm font-medium text-[var(--foreground)] outline-none focus:border-[var(--primary)] transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="adminPass" className="text-[10px] text-slate-500 font-black uppercase tracking-widest pl-2">Senha</label>
                    <div className="relative">
                      <Key size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input 
                        id="adminPass"
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••"
                        aria-label="Senha Administrativa"
                        className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl py-3 pl-12 pr-4 text-sm font-medium text-[var(--foreground)] focus:border-[var(--primary)] outline-none transition-colors"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-4 border-t border-[var(--border)]">
                    <button 
                      onClick={() => handleAuth(true)}
                      disabled={authLoading}
                      className="w-full py-4 rounded-xl border-2 border-[var(--primary)] text-[var(--primary)] font-black text-xs uppercase tracking-widest hover:bg-[var(--primary)]/10 transition-colors flex justify-center"
                    >
                      Criar Conta
                    </button>
                    <button 
                      onClick={() => handleAuth(false)}
                      disabled={authLoading || !password || !email}
                      className="w-full py-4 rounded-xl bg-[var(--primary)] text-white font-black text-xs uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_20px_-4px_rgba(99,102,241,0.5)] flex justify-center"
                    >
                      {authLoading ? <Loader2 size={16} className="animate-spin" /> : "Entrar"}
                    </button>
                  </div>
               </div>
              </div>
            </motion.div>
          )}

          {activeTab === "invites" && (
            <motion.div
              key="invites"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col flex-1"
            >
              {renderHeader("Convites Recebidos")}
              <div className="space-y-4">
                {pendingInvites.length === 0 ? (
                  <div className="text-center py-12">
                     <Bell className="mx-auto text-slate-700 mb-4 opacity-20" size={48} />
                     <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Nenhum convite pendente</p>
                  </div>
                ) : (
                  pendingInvites.map((inv) => (
                    <div key={inv.id} className="bg-[var(--surface)] p-6 rounded-[2.5rem] border border-[var(--border)] shadow-xl space-y-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-500">
                          <Building2 size={24} />
                        </div>
                        <div>
                          <h3 className="font-black text-[var(--foreground)] italic uppercase tracking-tighter text-lg leading-none">
                            {inv.organizations?.name || "Organização"}
                          </h3>
                          <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">
                            Convidado como <span className="text-amber-500">{inv.role === 'admin' ? 'Administrador' : 'Membro'}</span>
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-2">
                         <button 
                           onClick={() => declineInvite(inv.id)}
                           className="py-4 rounded-2xl bg-red-500/10 text-red-500 font-black uppercase text-[10px] tracking-widest border border-red-500/20 hover:bg-red-500 hover:text-white transition-all"
                         >
                           Recusar
                         </button>
                         <button 
                           onClick={async () => {
                             await acceptInvite(inv.id);
                             setActiveTab("menu");
                           }}
                           className="py-4 rounded-2xl bg-emerald-500 text-white font-black uppercase text-[10px] tracking-widest shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                         >
                           Aceitar
                         </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
    </div>
  );
}

function MenuButton({ label, icon: Icon, color, onClick }: any) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="w-full flex items-center justify-between p-5 bg-[var(--surface)] border border-[var(--border)] rounded-[2rem] shadow-xl group transition-all hover:border-[var(--primary)]/30"
    >
      <div className="flex items-center gap-4">
        <div className={`p-2.5 rounded-2xl bg-[var(--background)] ${color} shadow-lg`}>
          <Icon size={22} strokeWidth={3} />
        </div>
        <span className="font-black text-[var(--foreground)] text-sm uppercase italic tracking-tighter">{label}</span>
      </div>
      <ChevronRight size={18} className="text-slate-600 group-hover:text-[var(--primary)] transition-colors" />
    </motion.button>
  );
}

function ThemeToggle({ active, icon: Icon, label, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
        active 
          ? "bg-[var(--primary)]/10 border-[var(--primary)] text-[var(--primary)]" 
          : "bg-[var(--background)] border-[var(--border)] text-slate-500"
      }`}
    >
      <Icon size={24} strokeWidth={active ? 3 : 2} />
      <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
      {active && <Check size={12} strokeWidth={4} className="mt-1" />}
    </button>
  );
}
