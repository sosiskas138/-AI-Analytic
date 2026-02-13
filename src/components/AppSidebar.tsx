import { NavLink as RouterNavLink, useLocation, useNavigate, useParams } from "react-router-dom";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/hooks/useAuth";
import { useProjectAccess } from "@/hooks/useProjectAccess";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  LayoutDashboard,
  FolderKanban,
  Phone,
  FileUp,
  BarChart3,
  FileSpreadsheet,
  Settings,
  LogOut,
  Moon,
  Sun,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  TrendingUp,
  ClipboardCheck,
  Users,
  Package,
  DollarSign,
  UserCheck,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { TabKey } from "@/hooks/useProjectAccess";

interface SidebarProps {
  projectId?: string;
  onNavigate?: () => void;
}

const TAB_TO_NAV: Record<TabKey, { pathSuffix: string; icon: any; label: string }> = {
  dashboard: { pathSuffix: "/dashboard", icon: LayoutDashboard, label: "Дашборд" },
  calls: { pathSuffix: "/calls", icon: Phone, label: "Звонки" },
  imports: { pathSuffix: "/imports", icon: FileUp, label: "Импорт" },
  "call-lists": { pathSuffix: "/reports/call-lists", icon: BarChart3, label: "Колл-листы" },
  suppliers: { pathSuffix: "/reports/suppliers", icon: TrendingUp, label: "Базы" },
  export: { pathSuffix: "/reports/export", icon: FileSpreadsheet, label: "ГЦК" },
  status: { pathSuffix: "/status", icon: ClipboardCheck, label: "Статус" },
};

export function AppSidebar({ projectId, onNavigate }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { theme, toggle } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, isAdmin } = useAuth();
  const { allowedTabs } = useProjectAccess(projectId);

  const { data: currentProject } = useQuery({
    queryKey: ["project-detail", projectId],
    queryFn: async () => {
      return await api.getProject(projectId!);
    },
    enabled: !!projectId,
  });
  const mainNav = [
    { to: "/projects", icon: FolderKanban, label: "Проекты" },
    ...(isAdmin ? [{ to: "/reanimation", icon: RefreshCw, label: "Реанимация" }] : []),
    ...(isAdmin ? [{ to: "/admin", icon: Settings, label: "Админка" }] : []),
  ];

  const adminNav = isAdmin && location.pathname === "/admin"
    ? [
        { to: "/admin?tab=users", icon: Users, label: "Пользователи" },
        { to: "/admin?tab=responsible", icon: UserCheck, label: "Ответственные" },
        { to: "/admin?tab=suppliers", icon: Package, label: "Поставщики" },
        { to: "/admin?tab=pricing", icon: DollarSign, label: "Цены" },
        { to: "/admin?tab=stats", icon: BarChart3, label: "Статистика" },
      ]
    : [];

  const projectNav = projectId
    ? allowedTabs
        .filter((tab) => TAB_TO_NAV[tab])
        .filter((tab) => tab !== "export" || currentProject?.has_gck)
        .map((tab) => ({
          to: `/projects/${projectId}${TAB_TO_NAV[tab].pathSuffix}`,
          icon: TAB_TO_NAV[tab].icon,
          label: TAB_TO_NAV[tab].label,
        }))
    : [];

  const navLink = (item: { to: string; icon: any; label: string }) => {
    const Icon = item.icon;
    const isActive = item.to.includes("?")
      ? location.pathname + location.search === item.to
      : location.pathname === item.to || location.pathname.startsWith(item.to + "/");
    return (
      <RouterNavLink
        key={item.to}
        to={item.to}
        onClick={onNavigate}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
          isActive
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground hover:bg-muted"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {!collapsed && <span>{item.label}</span>}
      </RouterNavLink>
    );
  };

  return (
    <aside
      className={cn(
        "h-screen sticky top-0 flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {mainNav.map(navLink)}

        {adminNav.length > 0 && (
          <>
            <div className="pt-4 pb-1">
              {!collapsed && (
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold px-3">
                  Админка
                </span>
              )}
            </div>
            {adminNav.map(navLink)}
          </>
        )}

        {projectNav.length > 0 && (
          <>
            <div className="pt-4 pb-1">
              {!collapsed && (
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold px-3">
                  Проект
                </span>
              )}
            </div>
            {projectNav.map(navLink)}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border space-y-1">
        <button
          onClick={toggle}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted w-full transition-colors"
        >
          {theme === "dark" ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
          {!collapsed && <span>{theme === "dark" ? "Светлая" : "Тёмная"}</span>}
        </button>
        <button
          onClick={async () => {
            await signOut();
            navigate("/login");
          }}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted w-full transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Выйти</span>}
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted w-full transition-colors"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          {!collapsed && <span>Свернуть</span>}
        </button>
      </div>
    </aside>
  );
}
