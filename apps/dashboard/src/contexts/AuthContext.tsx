import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api, setAuthToken } from '../lib/api';
import { Link } from 'react-router-dom';

interface User {
  id: string;
  githubId: string;
  username: string;
  email: string | null;
  avatarUrl: string | null;
  privacyAccepted: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  acceptPrivacy: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Extract token from URL params
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    
    if (urlToken) {
      // Fresh login — save token for this session
      sessionStorage.setItem('auth_token', urlToken);
      setToken(urlToken);
      setAuthToken(urlToken);
      // Clear URL params
      window.history.replaceState({}, document.title, window.location.pathname);
    } else {
      // Restore token from session if page was refreshed
      const savedToken = sessionStorage.getItem('auth_token');
      if (savedToken) {
        setToken(savedToken);
        setAuthToken(savedToken);
      }
    }

    async function checkAuth() {
      try {
        const response = await api.get(`/auth/me`);
        setUser(response.data);
      } catch {
        setUser(null);
        sessionStorage.removeItem('auth_token'); // clear stale token
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, []);

  const logout = async () => {
    try {
      await api.post(`/auth/logout`);
      setUser(null);
      setToken(null);
      setAuthToken(null);
      sessionStorage.removeItem('auth_token'); // clear from session storage on logout
    } catch {
      console.error('Logout failed');
    }
  };

  const acceptPrivacy = async () => {
    try {
      await api.post(`/auth/consent`);
      setUser(prev => prev ? { ...prev, privacyAccepted: true } : null);
    } catch {
      console.error('Failed to accept privacy');
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout, acceptPrivacy }}>
      {user && !user.privacyAccepted && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#0969da] text-white p-4 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm max-w-4xl">
            <strong>Privacy Notice:</strong> DevFlow CI sends PR diffs to Google's Gemini AI for code analysis. By using this service you consent to this processing.
          </p>
          <div className="flex items-center gap-3 shrink-0">
            <Link to="/privacy" className="text-white hover:underline text-sm font-medium">
              View Privacy Policy
            </Link>
            <button 
              onClick={acceptPrivacy}
              className="bg-white text-[#0969da] hover:bg-gray-100 px-4 py-1.5 rounded-md text-sm font-semibold transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
