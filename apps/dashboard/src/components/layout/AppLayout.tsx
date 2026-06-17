import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut } from "lucide-react";

export function AppLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gh-bg">
      {/* GitHub Dark Header */}
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between bg-gh-header px-4 shadow-sm">
        <div className="flex items-center gap-3">
          <svg className="h-8 w-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="M6 5 L4 1 L8 3" />
            <path d="M16 5 L18 1 L14 3" />
            <circle cx="8" cy="10" r="1" fill="currentColor" stroke="none" />
            <circle cx="14" cy="10" r="1" fill="currentColor" stroke="none" />
            <circle cx="18" cy="18" r="4" />
            <path d="M20.8 20.8 L23 23" />
          </svg>
          <span className="text-sm font-semibold text-white tracking-wide">
            DevFlow CI
          </span>
        </div>

        {user && (
          <div className="flex items-center gap-3">
            <button
              onClick={logout}
              className="text-xs font-semibold text-white/70 hover:text-white transition-colors flex items-center gap-1.5"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
            <div className="h-8 w-8 rounded-full border border-white/20 overflow-hidden bg-gh-card/10">
              <img
                src={user.avatarUrl || `https://ui-avatars.com/api/?name=${user.username}`}
                alt={user.username}
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        )}
      </header>

      <div className="flex">
        <Sidebar />
        <main className="flex-1 ml-64 p-8">
          <div className="mx-auto max-w-5xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
