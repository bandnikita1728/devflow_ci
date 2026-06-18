import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { AlertCircle } from 'lucide-react';

export function SettingsPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    if (!window.confirm('Are you absolutely sure you want to permanently delete your account and all data? This action cannot be undone.')) {
      return;
    }
    
    setIsDeleting(true);
    try {
      await axios.delete(`${API_BASE_URL}/api/auth/account`, { withCredentials: true });
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

        <section className="border border-[#30363d] rounded-md overflow-hidden bg-[#161b22]">
          <div className="bg-[#2d1b00] border-b border-[#30363d] px-4 py-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#e3b341]" />
            <h2 className="text-sm font-semibold text-[#e3b341]">Danger Zone</h2>
          </div>
          <div className="p-4 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
            <div className="text-sm">
              <p className="font-semibold text-[#e6edf3]">Delete account</p>
              <p className="text-[#8b949e]">Permanently delete your account, repositories, and all review data.</p>
            </div>
            <button
              onClick={handleDeleteAccount}
              disabled={isDeleting}
              className="px-4 py-2 bg-[#da3633] text-white border-none hover:bg-[#b62324] rounded-[6px] text-sm font-semibold transition-colors whitespace-nowrap"
            >
              {isDeleting ? 'Deleting...' : 'Delete your account'}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
