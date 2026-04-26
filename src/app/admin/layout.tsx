"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";
import { Loader2, ShieldAlert } from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, organizations, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push("/profile");
      return;
    }

    // Permissão: Admin Global OR Dono do Email Master OR Admin de qualquer Base (Organização)
    const isGlobalAdmin = user.role === "admin" || user.email === "mediattamoveis@gmail.com";
    const isOrgAdmin = organizations.some(org => org.role === "admin");

    if (!isGlobalAdmin && !isOrgAdmin) {
      router.push("/profile");
    }
  }, [user, organizations, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-4">
        <ShieldAlert size={48} className="text-[#A855F7] opacity-80 animate-pulse" />
        <div className="flex items-center gap-3">
          <Loader2 size={18} className="animate-spin text-[#A855F7]" />
          <span className="font-black uppercase tracking-widest text-[#A855F7] text-sm">Verificando Credenciais...</span>
        </div>
      </div>
    );
  }

  // Verificação de segurança extra para o render
  const isGlobalAdmin = user?.role === "admin" || user?.email === "mediattamoveis@gmail.com";
  const isOrgAdmin = organizations.some(org => org.role === "admin");

  if (!user || (!isGlobalAdmin && !isOrgAdmin)) {
    return null; 
  }

  return <>{children}</>;
}
