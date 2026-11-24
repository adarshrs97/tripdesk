import { createClient } from '@supabase/supabase-js';

const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : ((process.env as any) || {});

const resolveSupabaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    // When running in the browser on production Nginx (port 8080) or via any public tunnel / custom domain,
    // use window.location.origin so requests route through the unified Nginx reverse proxy (/auth/v1, /rest/v1, /storage/v1)
    if (window.location.port === '8080' || (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')) {
      return window.location.origin;
    }
  }
  return env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
};

const supabaseUrl = resolveSupabaseUrl();
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzk1NDMzNzk5LCJleHAiOjIxMTA3OTM3OTl9.Qr9n-AehLROAMu3FiPkj_NFAb7VvGfZ4rtK5n5N7nwE';

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey &&
  supabaseUrl !== 'https://placeholder.supabase.co' &&
  supabaseUrl !== 'https://your-project.supabase.co' &&
  !supabaseUrl.includes('your-project')
);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
