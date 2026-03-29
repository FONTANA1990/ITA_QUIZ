"use client";

import { createContext, useContext, useEffect, useState } from "react";

type CurrencyMode = "Pontos" | "Dracmas" | "Talentos" | "Denários" | "Shekels" | "Moedas de Ouro";

interface UserPreferences {
  theme: "light" | "dark";
  avatar: string; // Emoji ou URL
  currency: CurrencyMode;
}

interface UserContextType {
  preferences: UserPreferences;
  setTheme: (theme: "light" | "dark") => void;
  setAvatar: (avatar: string) => void;
  setCurrency: (currency: CurrencyMode) => void;
  user: any;
  updateNickname: (nickname: string) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

const avatars = ["🎮", "🛡️", "🔥", "💎", "🌟", "🦁", "🕊️", "⚓", "👑", "📜"];

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [preferences, setPreferences] = useState<UserPreferences>({
    theme: "dark",
    avatar: "🎮",
    currency: "Dracmas",
  });

  useEffect(() => {
    const savedUser = localStorage.getItem("ita_quiz_user");
    const savedPrefs = localStorage.getItem("ita_quiz_prefs");

    if (savedUser) setUser(JSON.parse(savedUser));
    if (savedPrefs) {
      const parsedPrefs = JSON.parse(savedPrefs);
      setPreferences(parsedPrefs);
      document.documentElement.setAttribute("data-theme", parsedPrefs.theme);
    } else {
      document.documentElement.setAttribute("data-theme", "dark");
    }
    
    setMounted(true);
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

  const updateNickname = (nickname: string) => {
    const newUser = { ...user, nickname };
    setUser(newUser);
    localStorage.setItem("ita_quiz_user", JSON.stringify(newUser));
  };

  if (!mounted) return null;

  return (
    <UserContext.Provider value={{ preferences, setTheme, setAvatar, setCurrency, user, updateNickname }}>
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
