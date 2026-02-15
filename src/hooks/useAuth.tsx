import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api } from "@/lib/api";

interface User {
  id: string;
  email: string;
  full_name?: string;
  role?: string;
}

interface AuthContextType {
  session: { user: User } | null;
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  isAdmin: false,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<{ user: User } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const done = () => {
      if (!cancelled) setLoading(false);
    };
    const checkAuth = async () => {
      try {
        const user = await api.getMe();
        if (!cancelled) {
          setSession({ user });
          setIsAdmin(user.role === 'admin');
        }
      } catch (error) {
        if (!cancelled) {
          setSession(null);
          setIsAdmin(false);
          localStorage.removeItem('auth_token');
        }
      } finally {
        done();
      }
    };

    // Макс. 1 с ожидания — затем показать логин (если бэкенд не отвечает)
    const t1 = setTimeout(done, 1000);
    // Страховка: гарантированно снять loading через 5 с
    const t2 = setTimeout(done, 5000);
    checkAuth().finally(() => {
      clearTimeout(t1);
      clearTimeout(t2);
    });

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'auth_token') checkAuth();
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      cancelled = true;
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const signOut = async () => {
    try {
      await api.logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
    setSession(null);
    setIsAdmin(false);
    localStorage.removeItem('auth_token');
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, isAdmin, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
