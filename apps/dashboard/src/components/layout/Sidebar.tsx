import { NavLink } from "react-router-dom";
import { LayoutDashboard, GitPullRequest, Settings, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/reviews", icon: GitPullRequest, label: "Reviews" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export function Sidebar() {
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
      <div className="p-4 border-t border-gh-border">
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
    </aside>
  );
}
