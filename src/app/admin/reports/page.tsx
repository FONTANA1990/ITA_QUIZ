"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { 
  FileText, 
  Download, 
  Calendar, 
  BarChart2, 
  ArrowLeft, 
  Search, 
  ChevronRight, 
  Trophy, 
  Users,
  Loader2,
  Trash2
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";

export default function ReportsPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const { globalSettings } = useUser();
  const router = useRouter();

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("quiz_reports")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setReports(data || []);
    } catch (err) {
      console.error("Erro ao carregar relatórios:", err);
    } finally {
      setLoading(false);
    }
  };

  const deleteReport = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Deseja excluir este relatório?")) return;
    
    try {
      const { error } = await supabase.from("quiz_reports").delete().eq("id", id);
      if (error) throw error;
      setReports(reports.filter(r => r.id !== id));
      if (selectedReport?.id === id) setSelectedReport(null);
    } catch (err) {
      console.error("Erro ao excluir:", err);
    }
  };

  const downloadCSV = (report: any) => {
    const data = report.report_data;
    if (!data || !Array.isArray(data)) return;

    const headers = ["Nome do Usuário", "Total de Perguntas", "Acertos", "Pontuação Final"];
    const rows = data.map((r: any) => [
      r.nickname,
      r.total_questions,
      r.correct_answers,
      r.final_score
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `relatorio_${report.quiz_title.replace(/\s+/g, '_')}_${new Date(report.created_at).toLocaleDateString()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredReports = reports.filter(r => 
    r.quiz_title?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] p-4 md:p-12 transition-colors duration-300 pb-24">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
           <div>
              <button 
                onClick={() => router.push('/admin')}
                className="flex items-center gap-2 text-slate-500 hover:text-[var(--primary)] font-black uppercase text-[10px] tracking-widest mb-4 transition-colors"
                aria-label="Voltar para Administração"
              >
                <ArrowLeft size={16} /> Voltar ao Painel
              </button>
              <h1 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter leading-none bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] bg-clip-text text-transparent">RELATÓRIOS</h1>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-2 italic opacity-70">Histórico de Quizzes Finalizados</p>
           </div>

           <div className="relative group">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-[var(--primary)] transition-colors">
                <Search size={18} />
              </div>
              <input 
                type="text" 
                placeholder="PROCURAR RELATÓRIO..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-[var(--surface)] border border-[var(--border)] pl-12 pr-6 py-4 rounded-2xl w-full md:w-80 font-black uppercase text-xs tracking-widest focus:ring-4 focus:ring-[var(--primary)]/10 focus:border-[var(--primary)] transition-all outline-none"
              />
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
           
           {/* List of Reports */}
           <div className="lg:col-span-4 space-y-4">
              {loading ? (
                <div className="flex justify-center p-12">
                   <Loader2 className="animate-spin text-[var(--primary)]" size={40} />
                </div>
              ) : filteredReports.length === 0 ? (
                <div className="bg-[var(--surface)] p-12 rounded-[2.5rem] border border-dashed border-[var(--border)] text-center opacity-50">
                   <p className="text-xs font-black uppercase tracking-widest">Nenhum relatório encontrado</p>
                </div>
              ) : (
                filteredReports.map((report) => (
                  <motion.div
                    key={report.id}
                    layoutId={report.id}
                    onClick={() => setSelectedReport(report)}
                    className={`p-6 rounded-[2rem] border transition-all cursor-pointer group relative overflow-hidden ${
                      selectedReport?.id === report.id 
                      ? 'bg-[var(--primary)] border-[var(--primary)] shadow-xl shadow-indigo-500/20' 
                      : 'bg-[var(--surface)] border-[var(--border)] hover:border-[var(--primary)]/50 shadow-lg'
                    }`}
                  >
                     <div className="flex items-start justify-between relative z-10">
                        <div className="flex-1 min-w-0">
                           <div className="flex items-center gap-2 mb-2">
                              <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${
                                selectedReport?.id === report.id ? 'bg-white/20 text-white' : 'bg-[var(--primary)]/10 text-[var(--primary)]'
                              }`}>
                                {report.quiz_type}
                              </span>
                              <span className={`text-[8px] font-black uppercase tracking-widest flex items-center gap-1 ${
                                selectedReport?.id === report.id ? 'text-white/60' : 'text-slate-500'
                              }`}>
                                <Calendar size={10} /> {new Date(report.created_at).toLocaleDateString()}
                              </span>
                           </div>
                           <h3 className={`font-black italic uppercase tracking-tighter text-lg leading-none break-words ${
                             selectedReport?.id === report.id ? 'text-white' : 'text-[var(--foreground)]'
                           }`}>
                             {report.quiz_title}
                           </h3>
                        </div>
                        <button 
                          onClick={(e) => deleteReport(report.id, e)}
                          className={`p-2 rounded-xl transition-all ${
                            selectedReport?.id === report.id ? 'hover:bg-red-500/20 text-white/60 hover:text-white' : 'hover:bg-red-500/10 text-slate-400 hover:text-red-500'
                          }`}
                          aria-label="Excluir Relatório"
                        >
                           <Trash2 size={16} />
                        </button>
                     </div>
                  </motion.div>
                ))
              )}
           </div>

           {/* Report Details */}
           <div className="lg:col-span-8">
              <AnimatePresence mode="wait">
                {selectedReport ? (
                  <motion.div
                    key={selectedReport.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-[var(--surface)] rounded-[3.5rem] border border-[var(--border)] shadow-2xl p-8 md:p-12 h-full flex flex-col relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 p-24 bg-[var(--primary)]/5 blur-3xl rounded-full -mr-20 -mt-20" />
                    
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 relative z-10">
                       <div className="flex items-center gap-4">
                          <div className="p-4 bg-[var(--primary)]/10 rounded-3xl text-[var(--primary)] shadow-lg">
                             <BarChart2 size={32} />
                          </div>
                          <div>
                             <h2 className="text-3xl md:text-4xl font-black italic uppercase tracking-tighter leading-none">{selectedReport.quiz_title}</h2>
                             <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1 opacity-70">Relatório Consolidado</p>
                          </div>
                       </div>
                       <button 
                         onClick={() => downloadCSV(selectedReport)}
                         className="flex items-center justify-center gap-2 bg-[var(--primary)] text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:opacity-90 transition-all shadow-xl shadow-indigo-500/20"
                       >
                         <Download size={18} /> Baixar CSV
                       </button>
                    </div>

                    <div className="flex-1 overflow-x-auto relative z-10">
                       <table className="w-full text-left border-collapse">
                          <thead>
                             <tr className="border-b border-[var(--border)]/50">
                                <th className="pb-6 text-[10px] font-black uppercase tracking-widest text-slate-500 px-4">Participante</th>
                                <th className="pb-6 text-[10px] font-black uppercase tracking-widest text-slate-500 px-4">Total</th>
                                <th className="pb-6 text-[10px] font-black uppercase tracking-widest text-slate-500 px-4">Acertos</th>
                                <th className="pb-6 text-[10px] font-black uppercase tracking-widest text-slate-500 px-4 text-right">Pontos</th>
                             </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--border)]/30">
                             {selectedReport.report_data.map((row: any, idx: number) => (
                               <motion.tr 
                                 key={idx}
                                 initial={{ opacity: 0, y: 10 }}
                                 animate={{ opacity: 1, y: 0 }}
                                 transition={{ delay: idx * 0.05 }}
                                 className="hover:bg-[var(--primary)]/5 transition-colors group"
                               >
                                  <td className="py-6 px-4 font-black italic uppercase tracking-tighter text-[var(--foreground)]">{row.nickname}</td>
                                  <td className="py-6 px-4 text-slate-400 font-bold">{row.total_questions}</td>
                                  <td className="py-6 px-4 font-black text-[var(--correct)]">
                                     {row.correct_answers} <span className="text-[10px] opacity-40">/ {row.total_questions}</span>
                                  </td>
                                  <td className="py-6 px-4 text-right">
                                     <span className="bg-[var(--primary)] text-white px-4 py-1.5 rounded-full font-black text-xs tracking-tighter italic shadow-lg shadow-indigo-500/10">
                                        {row.final_score} {globalSettings.currency}
                                     </span>
                                  </td>
                               </motion.tr>
                             ))}
                          </tbody>
                       </table>
                    </div>
                  </motion.div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full bg-[var(--surface)]/30 rounded-[3.5rem] border-2 border-dashed border-[var(--border)] p-12 text-center opacity-40">
                     <FileText size={64} className="mb-6 text-slate-400" strokeWidth={1} />
                     <p className="font-black uppercase tracking-[0.2em] text-xs italic">Selecione um relatório para visualizar o detalhamento</p>
                  </div>
                )}
              </AnimatePresence>
           </div>
        </div>
      </div>
    </div>
  );
}
