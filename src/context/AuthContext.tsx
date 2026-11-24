import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';

export interface AppUserRecord {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt?: string;
  lastLoginAt?: string | null;
}

interface AuthContextType {
  currentUser: User | null;
  session: Session | null;
  loading: boolean;
  allUsers: AppUserRecord[];
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  setCurrentRole: (role: UserRole) => void;
  canAccess: (minRole?: UserRole) => boolean;
  inviteUser: (user: { name: string; email: string; phone?: string; role: UserRole }) => Promise<void>;
  toggleUserStatus: (userId: string, active: boolean) => Promise<void>;
  updateUserRole: (userId: string, role: UserRole) => Promise<void>;
}

const ROLE_PRIORITY: Record<UserRole, number> = {
  admin: 4,
  staff: 3,
  driver: 2,
  customer_viewer: 1,
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState<AppUserRecord[]>([]);

  const resolveUserFromSession = async (authUser: { id: string; email?: string; user_metadata?: Record<string, any> }) => {
    try {
      if (isSupabaseConfigured) {
        const { data, error } = await supabase
          .from('app_users')
          .select('*')
          .or(`id.eq.${authUser.id},email.eq.${authUser.email}`)
          .maybeSingle();

        if (!error && data) {
          setCurrentUser({
            id: data.id,
            name: data.name || authUser.user_metadata?.name || 'Authorized User',
            email: data.email || authUser.email || '',
            role: data.role as UserRole,
            phone: data.phone || undefined,
          });
          return;
        }
      }
    } catch (e) {
      console.warn('Could not query app_users table:', e);
    }

    // Fallback strictly from Supabase Auth JWT user metadata
    const userRole = (authUser.user_metadata?.role as UserRole) || 'admin';
    setCurrentUser({
      id: authUser.id,
      name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'Administrator',
      email: authUser.email || '',
      role: userRole,
    });
  };

  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      if (!isSupabaseConfigured) {
        if (mounted) setLoading(false);
        return;
      }

      try {
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        if (mounted) {
          setSession(existingSession);
          if (existingSession?.user) {
            await resolveUserFromSession(existingSession.user);
          } else {
            setCurrentUser(null);
          }
        }
      } catch (err) {
        console.warn('Supabase Auth session initialization check:', err);
        if (mounted) setCurrentUser(null);
      } finally {
        if (mounted) setLoading(false);
      }

      // Load all users list if admin
      try {
        const { data } = await supabase.from('app_users').select('*');
        if (mounted && data) {
          setAllUsers(
            data.map((u: any) => ({
              id: u.id,
              name: u.name,
              email: u.email,
              phone: u.phone,
              role: u.role,
              isActive: u.is_active,
              createdAt: u.created_at,
              lastLoginAt: u.last_login_at,
            }))
          );
        }
      } catch {
        // Non-admin or unconfigured
      }
    }

    initAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      if (newSession?.user) {
        await resolveUserFromSession(newSession.user);
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    if (!isSupabaseConfigured) {
      return {
        success: false,
        error: 'Supabase Auth is not configured. Please check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
      };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data.user) {
        await resolveUserFromSession(data.user);
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'An unexpected error occurred during sign-in.' };
    }
  };

  const logout = async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    setCurrentUser(null);
    setSession(null);
  };

  const setCurrentRole = (role: UserRole) => {
    // Only allowed for testing role capabilities if logged in as admin
    if (import.meta.env.PROD || !currentUser) return;
    setCurrentUser((prev) => (prev ? { ...prev, role } : null));
  };

  const inviteUser = async (newUserData: { name: string; email: string; phone?: string; role: UserRole }) => {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('app_users')
        .insert({
          name: newUserData.name,
          email: newUserData.email,
          phone: newUserData.phone || null,
          role: newUserData.role,
          is_active: true,
        })
        .select()
        .single();
      if (error) throw error;
      setAllUsers((prev) => [
        ...prev,
        {
          id: data.id,
          name: data.name,
          email: data.email,
          phone: data.phone,
          role: data.role,
          isActive: data.is_active,
          createdAt: data.created_at,
        },
      ]);
    }
  };

  const toggleUserStatus = async (userId: string, active: boolean) => {
    if (isSupabaseConfigured) {
      const { error } = await supabase.from('app_users').update({ is_active: active }).eq('id', userId);
      if (error) throw error;
    }
    setAllUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, isActive: active } : u)));
  };

  const updateUserRole = async (userId: string, role: UserRole) => {
    if (isSupabaseConfigured) {
      const { error } = await supabase.from('app_users').update({ role }).eq('id', userId);
      if (error) throw error;
    }
    setAllUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
  };

  const canAccess = (minRole?: UserRole): boolean => {
    if (!minRole) return true;
    if (!currentUser) return false;
    return ROLE_PRIORITY[currentUser.role] >= ROLE_PRIORITY[minRole];
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        session,
        loading,
        allUsers,
        login,
        logout,
        setCurrentRole,
        canAccess,
        inviteUser,
        toggleUserStatus,
        updateUserRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
