"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type CurrencyMode = "Pontos" | "Dracmas" | "Talentos" | "Denários" | "Shekels" | "Moedas de Ouro";

interface UserPreferences {
  theme: "light" | "dark";
  avatar: string;
}

interface UserProfile {
  id: string;
  nickname: string;
  email: string;
  role: "player" | "admin";
  total_points?: number;
}

export interface Organization {
  id: string;
  name: string;
  owner_id: string;
  role?: "admin" | "member";
}

export interface Invite {
  id: string;
  organization_id: string;
  invited_email: string;
  status: 'pending' | 'accepted' | 'rejected';
  role: 'admin' | 'member';
  organizations?: { name: string };
}

interface UserContextType {
  preferences: UserPreferences;
  globalSettings: {
    currency: CurrencyMode;
    points_per_question: number;
  };
  setTheme: (theme: "light" | "dark") => void;
  setAvatar: (avatar: string) => void;
  updateGlobalSetting: (key: string, value: string) => Promise<void>;
  user: UserProfile | null;
  organizations: Organization[];
  activeOrg: Organization | null;
  pendingInvites: Invite[];
  loading: boolean;
  createOrganization: (name: string) => Promise<void>;
  switchOrganization: (orgId: string) => void;
  acceptInvite: (inviteId: string) => Promise<void>;
  declineInvite: (inviteId: string) => Promise<void>;
  sendInvite: (email: string, role: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [activeOrg, setActiveOrg] = useState<Organization | null>(null);
  const [pendingInvites, setPendingInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState<UserPreferences>({
    theme: "dark",
    avatar: "🎮",
  });
  const [globalSettings, setGlobalSettings] = useState({
    currency: "Dracmas" as CurrencyMode,
    points_per_question: 100,
  });

  const fetchProfile = async (sessionUser: any) => {
    if (!sessionUser) {
      setUser(null);
      setOrganizations([]);
      setActiveOrg(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", sessionUser.id)
        .maybeSingle();

      const profile = error || !data ? {
        id: sessionUser.id,
        email: sessionUser.email,
        nickname: sessionUser.email?.split("@")[0] || "Jogador",
        role: "player",
        total_points: 0
      } : data;

      setUser(profile);
      await fetchUserOrganizations(sessionUser.id);
      await fetchPendingInvites(sessionUser.email);
    } catch (err) {
      console.error("Erro ao carregar perfil:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserOrganizations = async (userId: string, preferredOrgId?: string) => {
    try {
      const { data: members, error } = await supabase
        .from("organization_members")
        .select("role, organizations(*)")
        .eq("user_id", userId);

      if (error) {
        console.error("Erro ao buscar organizações:", error);
        return;
      }

      if (members) {
        const orgs = members
          .filter((m: any) => m.organizations) // Garante que a org foi retornada (RLS permitiu)
          .map((m: any) => ({
            ...m.organizations,
            role: m.role
          })) as Organization[];
        
        setOrganizations(orgs);

        // Ordem de prioridade para definir a base ativa:
        // 1. preferredOrgId (casos de convite aceito agora ou criação)
        // 2. localStorage (última base usada)
        // 3. Primeira base da lista (se existir)
        const savedOrgId = preferredOrgId || localStorage.getItem("ita_quiz_active_org");
        const found = orgs.find(o => o.id === savedOrgId) || orgs[0];
        
        if (found) {
          setActiveOrg(found);
          localStorage.setItem("ita_quiz_active_org", found.id);
        } else {
          setActiveOrg(null);
        }
      }
    } catch (err) {
      console.error("Erro fatal ao carregar organizações:", err);
    }
  };

  const fetchPendingInvites = async (email: string) => {
    const { data } = await supabase
      .from("invites")
      .select("*, organizations(name)")
      .eq("invited_email", email)
      .eq("status", "pending");
    setPendingInvites(data || []);
  };

  const fetchSettings = async (orgId: string) => {
    const { data } = await supabase
      .from("settings")
      .select("*")
      .eq("organization_id", orgId);

    if (data && data.length > 0) {
      const settingsObj: any = {};
      data.forEach(s => {
        settingsObj[s.key] = s.value;
      });
      setGlobalSettings({
        currency: (settingsObj.currency as CurrencyMode) || "Dracmas",
        points_per_question: parseInt(settingsObj.points_per_question) || 100
      });
    } else {
      // Valores padrão se não houver configurações
      setGlobalSettings({
        currency: "Dracmas",
        points_per_question: 100
      });
    }
  };

  useEffect(() => {
    if (activeOrg) {
      fetchSettings(activeOrg.id);
    }
  }, [activeOrg?.id]);

  useEffect(() => {
    const savedPrefs = localStorage.getItem("ita_quiz_prefs");
    if (savedPrefs) {
      const parsedPrefs = JSON.parse(savedPrefs);
      setPreferences(parsedPrefs);
      document.documentElement.setAttribute("data-theme", parsedPrefs.theme);
    }

    // Inicializar sessão
    supabase.auth.getSession().then(({ data: { session } }) => {
      fetchProfile(session?.user ?? null);
    });

    // Escutar mudanças de Auth
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        fetchProfile(session?.user ?? null);
      } else if (event === "SIGNED_OUT") {
        setUser(null);
        setOrganizations([]);
        setActiveOrg(null);
        setLoading(false);
      }
    });

    const settingsSub = supabase
      .channel("org_settings")
      .on("postgres_changes", { event: "*", schema: "public", table: "settings" }, () => {
        if (activeOrg) fetchSettings(activeOrg.id);
      })
      .subscribe();

    setMounted(true);
    return () => {
      authSub.unsubscribe();
      supabase.removeChannel(settingsSub);
    };
  }, []);

  const setTheme = (theme: "light" | "dark") => {
    const newPrefs = { ...preferences, theme };
    setPreferences(newPrefs);
    localStorage.setItem("ita_quiz_prefs", JSON.stringify(newPrefs));
    document.documentElement.setAttribute("data-theme", theme);
  };

  const setAvatar = (avatar: string) => {
    const newPrefs = { ...preferences, avatar };
    setPreferences(newPrefs);
    localStorage.setItem("ita_quiz_prefs", JSON.stringify(newPrefs));
  };

  const createOrganization = async (name: string) => {
    if (!user) {
      console.error("Usuário não autenticado para criar organização");
      return;
    }
    
    try {
      const { data: orgId, error } = await supabase.rpc("create_organization", {
        p_name: name,
        p_owner_id: user.id
      });

      if (error) {
        console.error("Erro ao criar organização via RPC:", error);
        throw error;
      }

      console.log("Organização criada com ID:", orgId);
      
      // Força a atualização da lista e seleciona a nova org
      await fetchUserOrganizations(user.id);
      
      // Se a lista foi atualizada, o fetchUserOrganizations já deve ter setado uma activeOrg
      // mas vamos garantir que a nova org seja a ativa se possível
      if (orgId) {
        localStorage.setItem("ita_quiz_active_org", orgId);
      }
    } catch (err: any) {
      console.error("Falha ao criar organização:", err);
      throw err;
    }
  };

  const switchOrganization = (orgId: string) => {
    const found = organizations.find(o => o.id === orgId);
    if (found) {
      setActiveOrg(found);
      localStorage.setItem("ita_quiz_active_org", found.id);
    }
  };

  const acceptInvite = async (inviteId: string) => {
    if (!user) return;
    try {
      // 1. Busca o ID da organização antes de aceitar para poder trocar para ela depois
      const invite = pendingInvites.find(i => i.id === inviteId);
      const targetOrgId = invite?.organization_id;

      // 2. Chama o RPC que lida com a transação
      const { error } = await supabase.rpc('accept_invite', {
        p_invite_id: inviteId
      });

      if (error) throw error;

      // 3. Recarrega as organizações passando a nova base como preferencial
      await Promise.all([
        fetchUserOrganizations(user.id, targetOrgId),
        fetchPendingInvites(user.email)
      ]);
    } catch (error) {
      console.error("Erro ao aceitar convite:", error);
      throw error;
    }
  };

  const sendInvite = async (email: string, role: string) => {
    if (!activeOrg) return;
    const { error } = await supabase
      .from("invites")
      .insert({
        organization_id: activeOrg.id,
        invited_email: email,
        role: role
      });
    if (error) throw error;
  };

  const declineInvite = async (inviteId: string) => {
    const { error } = await supabase
      .from("invites")
      .update({ status: 'rejected' })
      .eq("id", inviteId);
    if (error) throw error;
    if (user?.email) await fetchPendingInvites(user.email);
  };

  const updateGlobalSetting = async (key: string, value: string) => {
    if (!activeOrg) return;
    const { error } = await supabase
      .from("settings")
      .upsert({ 
        organization_id: activeOrg.id,
        key, 
        value, 
        updated_at: new Date().toISOString() 
      }, { onConflict: 'organization_id,key' })
      .select();
    
    if (error) {
      console.error("Erro ao atualizar config da base:", error);
      throw error;
    }
    await fetchSettings(activeOrg.id);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setOrganizations([]);
    setActiveOrg(null);
  };

  const refreshProfile = async () => {
    const { data: { user: sUser } } = await supabase.auth.getUser();
    if (sUser) await fetchProfile(sUser);
  };

  if (!mounted) return null;

  return (
    <UserContext.Provider value={{ 
      preferences, 
      globalSettings,
      setTheme, setAvatar, updateGlobalSetting,
      user, organizations, activeOrg, pendingInvites,
      loading, createOrganization, switchOrganization,
      acceptInvite, declineInvite, sendInvite,
      logout, refreshProfile 
    }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}
