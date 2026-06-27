import { NavLink } from "react-router-dom";
import { LayoutDashboard, GitPullRequest, Settings, Shield, Book } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "../../contexts/AuthContext";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/repos", icon: Book, label: "Repositories" },
  { to: "/reviews", icon: GitPullRequest, label: "Reviews" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  const initials = user?.username ? user.username.slice(0, 2).toUpperCase() : "NB";
  const displayUsername = user?.username || "bandnikita1728";

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <aside className="fixed inset-y-14 left-0 z-40 flex w-64 flex-col border-r border-gh-border bg-gh-sidebar">
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-[14px] font-medium transition-colors border-l-[3px]",
                isActive
                  ? "bg-gh-card text-gh-text-primary border-gh-link shadow-sm"
                  : "text-gh-text-primary border-transparent hover:bg-gh-border/30 hover:border-gh-border/50"
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className={cn("h-4 w-4", isActive ? "text-gh-text-primary" : "text-gh-text-secondary")} />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-[#21262d] flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#1f6feb] to-[#a371f7] flex items-center justify-center text-white font-bold text-xs shrink-0 select-none">
            {initials}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[13px] font-semibold text-white truncate">{displayUsername}</span>
            <span className="text-[11px] text-[#8b949e] truncate">{user?.username ? `${user.username.toLowerCase()}@github` : "bandnikita1728@github"}</span>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="text-left text-[12px] text-[#f85149] hover:underline"
        >
          Sign out
        </button>
        <div className="border-t border-[#21262d] pt-3">
          <NavLink
            to="/privacy"
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2 text-sm text-gh-text-secondary hover:text-gh-text-primary transition-colors",
                isActive && "text-gh-text-primary font-medium"
              )
            }
          >
            <Shield className="w-4 h-4" />
            Privacy Policy
          </NavLink>
        </div>
      </div>
    </aside>
  );
}
