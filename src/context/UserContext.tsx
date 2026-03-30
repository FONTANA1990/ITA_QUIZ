"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type CurrencyMode = "Pontos" | "Dracmas" | "Talentos" | "Denários" | "Shekels" | "Moedas de Ouro";

interface UserPreferences {
  theme: "light" | "dark";
  avatar: string;
  currency: CurrencyMode;
}

interface UserProfile {
  id: string;
  nickname: string;
  email: string;
  role: "player" | "admin";
  total_points?: number;
}

interface UserContextType {
  preferences: UserPreferences;
  setTheme: (theme: "light" | "dark") => void;
  setAvatar: (avatar: string) => void;
  setCurrency: (currency: CurrencyMode) => void;
  user: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState<UserPreferences>({
    theme: "dark",
    avatar: "🎮",
    currency: "Dracmas",
  });

  const fetchProfile = async (sessionUser: any) => {
    if (!sessionUser) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", sessionUser.id)
        .maybeSingle();

      if (error || !data) {
        // Fallback: se o trigger demorar, cria um objeto básico
        setUser({
          id: sessionUser.id,
          email: sessionUser.email,
          nickname: sessionUser.email.split("@")[0],
          role: "player",
          total_points: 0
        });
      } else {
        setUser(data);
      }
    } catch (err) {
      console.error("Erro ao carregar perfil:", err);
    } finally {
      setLoading(false);
    }
  };

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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        fetchProfile(session?.user ?? null);
      } else if (event === "SIGNED_OUT") {
        setUser(null);
        setLoading(false);
      }
    });

    setMounted(true);
    return () => subscription.unsubscribe();
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

  const setCurrency = (currency: CurrencyMode) => {
    const newPrefs = { ...preferences, currency };
    setPreferences(newPrefs);
    localStorage.setItem("ita_quiz_prefs", JSON.stringify(newPrefs));
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const refreshProfile = async () => {
    const { data: { user: sUser } } = await supabase.auth.getUser();
    if (sUser) await fetchProfile(sUser);
  };

  if (!mounted) return null;

  return (
    <UserContext.Provider value={{ 
      preferences, setTheme, setAvatar, setCurrency, 
      user, loading, logout, refreshProfile 
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
