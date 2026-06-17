import { NavLink } from "react-router-dom";
import { LayoutDashboard, GitPullRequest } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/reviews", icon: GitPullRequest, label: "Reviews" },
];

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-50 flex w-56 flex-col border-r border-slate-200 bg-slate-50/80">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 border-b border-slate-200 px-5">
        <span className="text-[15px] font-semibold text-slate-900 tracking-tight">
          DevFlow
        </span>
        <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 tracking-wide uppercase">
          CI
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-0.5">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors",
                isActive
                  ? "bg-slate-100 text-slate-900"
                  : "text-slate-500 hover:bg-slate-100/60 hover:text-slate-700"
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
