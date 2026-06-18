import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/auth/me`, { withCredentials: true });
        setUser(response.data);
      } catch (err) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, []);

  const logout = async () => {
    try {
      await axios.post(`${API_BASE_URL}/api/auth/logout`, {}, { withCredentials: true });
      setUser(null);
    } catch (err) {
      console.error('Logout failed', err);
    }
  };

  const acceptPrivacy = async () => {
    try {
      await axios.post(`${API_BASE_URL}/api/auth/consent`, {}, { withCredentials: true });
      setUser(prev => prev ? { ...prev, privacyAccepted: true } : null);
    } catch (err) {
      console.error('Failed to accept privacy', err);
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
