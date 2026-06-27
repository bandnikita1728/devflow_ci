import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { AlertCircle } from 'lucide-react';

export function SettingsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    if (!window.confirm('Are you absolutely sure you want to permanently delete your account and all data? This action cannot be undone.')) {
      return;
    }
    
    setIsDeleting(true);
    try {
      await api.delete(`/auth/account`, { withCredentials: true });
      await logout();
      navigate('/login');
    } catch (err) {
      console.error('Failed to delete account', err);
      alert('Failed to delete account. Please try again.');
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-semibold text-gh-text-primary mb-6">Settings</h1>
      
      {/* Account Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#21262d] pb-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#1f6feb] to-[#a371f7] flex items-center justify-center text-white font-bold text-lg select-none shrink-0">
            {user?.username ? user.username.slice(0, 2).toUpperCase() : "NB"}
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold text-white leading-tight">{user?.username || "bandnikita1728"}</span>
            <span className="text-sm text-[#8b949e]">{user?.email || "bandnikita1728@gmail.com"}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#001a33] text-[#79c0ff] border border-[#1f6feb] w-fit">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.11.82-.26.82-.577v-2.234c-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.43.372.82 1.102.82 2.222v3.293c0 .319.22.694.825.576C20.565 21.795 24 17.3 24 12c0-6.63-5.37-12-12-12z" />
          </svg>
          <span>Connected via GitHub OAuth</span>
        </div>
      </div>

      <div className="space-y-6">
        <section className="border border-[#30363d] rounded-md overflow-hidden bg-[#161b22]">
          <div className="bg-[#161b22] border-b border-[#30363d] px-4 py-3">
            <h2 className="text-sm font-semibold text-[#e6edf3]">Your Data</h2>
          </div>
          <div className="p-4 text-sm text-[#8b949e] space-y-3">
            <p>
              DevFlow CI stores your GitHub profile, OAuth token, and the results of any AI code reviews performed on your repositories.
            </p>
            <p>
              Your OAuth token is encrypted at rest using AES-256.
            </p>
          </div>
        </section>

        <section className="border border-[#30363d] rounded-md overflow-hidden bg-[#161b22]">
          <div className="bg-[#161b22] border-b border-[#30363d] px-4 py-3">
            <h2 className="text-sm font-semibold text-[#e6edf3]">AI Processing</h2>
          </div>
          <div className="p-4 text-sm text-[#8b949e]">
            <p>
              Pull Request diffs are sent to Google's Gemini AI to generate automated code reviews. We have explicitly opted out of data training, meaning your code is strictly confidential and not used to train Google's models.
            </p>
          </div>
        </section>

        <section className="border border-[#da3633] rounded-md overflow-hidden bg-[#1a0a0a]">
          <div className="bg-[#1a0a0a] border-b border-[#da3633] px-4 py-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#f85149]" />
            <h2 className="text-sm font-semibold text-[#f85149]">Danger Zone</h2>
          </div>
          <div className="p-4 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
            <div className="text-sm">
              <p className="font-semibold text-[#e6edf3]">Delete account</p>
              <p className="text-[#8b949e]">Permanently delete your account, repositories, and all review data.</p>
            </div>
            <button
              onClick={handleDeleteAccount}
              disabled={isDeleting}
              className="px-4 py-2 bg-transparent text-[#f85149] border border-[#da3633] hover:bg-[#da3633] hover:text-white rounded-[6px] text-sm font-semibold transition-colors whitespace-nowrap"
            >
              {isDeleting ? 'Deleting...' : 'Delete your account'}
            </button>
          </div>
        </section>

        {/* About Section */}
        <section className="pt-6 border-t border-[#21262d]">
          <h2 className="text-sm font-semibold text-white mb-2">About</h2>
          <div className="text-[13px] text-[#8b949e] space-y-1">
            <p>DevFlow CI v2.0</p>
            <p>
              Built by Nikita Band (
              <a
                href="https://github.com/bandnikita1728"
                target="_blank"
                rel="noreferrer"
                className="text-[#58a6ff] hover:underline"
              >
                bandnikita1728
              </a>
              )
            </p>
            <p className="pt-2">
              <a
                href="https://github.com/bandnikita1728/devflow_ci"
                target="_blank"
                rel="noreferrer"
                className="text-[#58a6ff] hover:underline font-semibold"
              >
                View on GitHub →
              </a>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
