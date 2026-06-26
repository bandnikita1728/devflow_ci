import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { AxiosError } from 'axios';
import { Book, CheckCircle, Trash2, Plus } from 'lucide-react';

interface Repo {
  id: string;
  fullName: string;
  isActive: boolean;
  createdAt: string;
}

export function ReposPage() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newRepoName, setNewRepoName] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    fetchRepos();
  }, []);

  const fetchRepos = async () => {
    try {
      const res = await api.get(`/repos`, { withCredentials: true });
      setRepos(res.data);
    } catch (err) {
      console.error('Failed to fetch repos', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRepoName) return;
    setIsConnecting(true);
    try {
      await api.post(`/repos`, { repoFullName: newRepoName }, { withCredentials: true });
      setNewRepoName('');
      setIsModalOpen(false);
      fetchRepos();
    } catch (err) {
      const axiosErr = err as AxiosError<{ error?: string }>;
      alert(axiosErr.response?.data?.error || 'Failed to connect repository. Ensure the bot has access.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to disconnect ${name}? This will remove the GitHub webhook.`)) {
      return;
    }
    try {
      await api.delete(`/repos/${id}`, { withCredentials: true });
      fetchRepos();
    } catch (_err) {
      alert('Failed to disconnect repository.');
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gh-text-primary">Repositories</h1>
          <p className="text-sm text-gh-text-secondary mt-1">Manage connected repositories for DevFlow CI</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-[#1F883D] text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-[#1a7431] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Connect Repository
        </button>
      </div>

      {isLoading ? (
        <div className="text-gh-text-secondary text-sm">Loading repositories...</div>
      ) : repos.length === 0 ? (
        <div className="border border-gh-border rounded-md p-12 text-center bg-gh-card">
          <Book className="w-12 h-12 text-gh-text-secondary mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gh-text-primary mb-2">No repositories connected yet</h3>
          <p className="text-sm text-gh-text-secondary mb-6">Connect a repo to start getting AI code reviews automatically.</p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-gh-card text-gh-text-primary border border-gh-border px-4 py-2 rounded-md text-sm font-semibold hover:bg-[#f6f8fa] transition-colors"
          >
            Connect a repository
          </button>
        </div>
      ) : (
        <div className="border border-[#30363d] rounded-md bg-[#161b22] flex flex-col">
          {repos.map((repo) => (
            <div key={repo.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border border-transparent border-b-[#30363d] last:border-b-transparent hover:border-[#58a6ff] transition-colors rounded-md m-[-1px]">
              <div className="flex items-start gap-3">
                <Book className="w-5 h-5 text-gh-text-secondary mt-0.5" />
                <div>
                  <h3 className="text-base font-semibold text-[#0969da] hover:underline cursor-pointer">
                    {repo.fullName}
                  </h3>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1 text-xs text-gh-text-secondary">
                      Connected {new Date(repo.createdAt).toLocaleDateString()}
                    </span>
                    {repo.isActive && (
                      <span className="flex items-center gap-1 text-xs text-[#1a7f37] border border-[#1a7f37]/30 bg-[#1a7f37]/10 px-2 py-0.5 rounded-full">
                        <CheckCircle className="w-3 h-3" /> Active
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleDisconnect(repo.id, repo.fullName)}
                className="mt-4 sm:mt-0 flex items-center gap-2 text-sm text-[#cf222e] hover:bg-[#cf222e]/10 px-3 py-1.5 rounded-md transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Disconnect
              </button>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(0,0,0,0.7)] p-4">
          <div className="bg-[#161b22] w-full max-w-md rounded-md shadow-xl border border-[#30363d] overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-[#30363d]">
              <h3 className="font-semibold text-[#e6edf3]">Connect Repository</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-[#8b949e] hover:text-[#e6edf3] text-xl leading-none">×</button>
            </div>
            <form onSubmit={handleConnect} className="p-4">
              <label className="block text-[14px] font-medium text-[#e6edf3] mb-2">
                Repository Full Name
              </label>
              <input
                type="text"
                placeholder="e.g. owner/repo"
                value={newRepoName}
                onChange={(e) => setNewRepoName(e.target.value)}
                className="w-full bg-[#0d1117] border border-[#30363d] text-[#e6edf3] rounded-[6px] px-[12px] py-[8px] text-sm focus:outline-none focus:border-[#58a6ff] focus:ring-1 focus:ring-[#58a6ff] mb-4"
                autoFocus
              />
              <p className="text-[12px] text-[#8b949e] mb-6">
                DevFlow CI must have access to this repository.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-[#e6edf3] bg-transparent border border-[#30363d] rounded-md hover:bg-[#30363d]/50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newRepoName || isConnecting}
                  className="px-4 py-2 text-sm font-medium text-white bg-[#238636] border-none rounded-md hover:bg-[#2ea043] disabled:opacity-50 transition-colors"
                >
                  {isConnecting ? 'Connecting...' : 'Connect'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
