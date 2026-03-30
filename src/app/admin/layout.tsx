"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Loader2, ShieldAlert } from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        
        if (!isMounted) return;

        if (!authUser) {
          router.push("/profile");
          return;
        }

        // Permissão Hardcoded para Super-Admin
        if (authUser.email === "mediattamoveis@gmail.com") {
          setLoading(false);
          return;
        }

        // Consultar banco para verificar se é Admin promovido
        const { data: profile } = await supabase
          .from("users")
          .select("role")
          .eq("id", authUser.id)
          .maybeSingle();

        if (isMounted) {
          if (profile?.role === "admin") {
            setLoading(false);
          } else {
            router.push("/profile");
          }
        }
      } catch (err) {
        console.error("Auth check failed", err);
        if (isMounted) router.push("/profile");
      }
    };

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, [router]);

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

  return <>{children}</>;
}
