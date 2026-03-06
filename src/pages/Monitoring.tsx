import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Loader2, CheckCircle2, AlertTriangle, XCircle, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";
import { KPICard } from "@/components/KPICard";
import { cn } from "@/lib/utils";

const IMPORT_FRESH_HOURS = 16;

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "только что";
  if (mins < 60) return `${mins} мин назад`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}ч назад`;
  const days = Math.floor(hours / 24);
  return `${days}д назад`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

type Status = "ok" | "warning" | "problem";

function getStatus(row: any): Status {
  const hasYesterday = row.yesterdayCalls > 0;
  const importFresh = row.lastImportAt &&
    (Date.now() - new Date(row.lastImportAt).getTime()) < IMPORT_FRESH_HOURS * 60 * 60 * 1000;
  if (hasYesterday && importFresh) return "ok";
  if (hasYesterday || importFresh) return "warning";
  return "problem";
}

const STATUS_CONFIG = {
  ok: { icon: CheckCircle2, label: "Ок", color: "text-emerald-600", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  warning: { icon: AlertTriangle, label: "Частично", color: "text-amber-600", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  problem: { icon: XCircle, label: "Проблема", color: "text-red-600", bg: "bg-red-500/10", border: "border-red-500/20" },
};

export default function Monitoring() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  if (!isAdmin) return <Navigate to="/projects" replace />;

  const { data, isLoading } = useQuery({
    queryKey: ["monitoring"],
    queryFn: () => api.getMonitoring(),
    refetchInterval: 60000,
  });

  const projects: any[] = data?.projects ?? [];
  const sorted = [...projects]
    .map((p) => ({ ...p, status: getStatus(p) }))
    .sort((a, b) => {
      const order: Record<Status, number> = { problem: 0, warning: 1, ok: 2 };
      return order[a.status] - order[b.status];
    });

  const totalCount = sorted.length;
  const okCount = sorted.filter((p) => p.status === "ok").length;
  const warningCount = sorted.filter((p) => p.status === "warning").length;
  const problemCount = sorted.filter((p) => p.status === "problem").length;

  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-[1400px] mx-auto">
      <h1 className="text-2xl font-bold tracking-tight">Мониторинг</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <KPICard title="Всего проектов" value={totalCount} icon={CheckCircle2} delay={0} />
        <KPICard title="Обновлены" value={okCount} icon={CheckCircle2} delay={0.05} valueClassName="text-emerald-600" />
        <KPICard title="Частично" value={warningCount} icon={AlertTriangle} delay={0.1} valueClassName="text-amber-600" />
        <KPICard title="Не обновлены" value={problemCount} icon={XCircle} delay={0.15} valueClassName="text-red-600" />
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {["Проект", "Статус", "Звонки вчера", "Дозвон вчера", "Лиды вчера", "Последний звонок", "Последний импорт", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => {
                const cfg = STATUS_CONFIG[row.status as Status];
                const Icon = cfg.icon;
                return (
                  <motion.tr
                    key={row.projectId}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className={cn(
                      "border-b border-border/50 hover:bg-muted/30 transition-colors",
                      row.status === "problem" && "bg-red-500/5"
                    )}
                  >
                    <td className="px-4 py-3 font-medium">{row.projectName}</td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border", cfg.bg, cfg.color, cfg.border)}>
                        <Icon className="h-3 w-3" />
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">{row.yesterdayCalls > 0 ? row.yesterdayCalls.toLocaleString() : <span className="text-red-500 font-medium">0</span>}</td>
                    <td className="px-4 py-3">{row.yesterdayAnswered > 0 ? row.yesterdayAnswered.toLocaleString() : "0"}</td>
                    <td className="px-4 py-3 font-semibold">{row.yesterdayLeads > 0 ? row.yesterdayLeads : "0"}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap" title={formatDate(row.lastCallAt)}>{timeAgo(row.lastCallAt)}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap" title={formatDate(row.lastImportAt)}>{timeAgo(row.lastImportAt)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/projects/${row.projectId}/dashboard`)}
                        className="text-primary hover:underline inline-flex items-center gap-1 text-xs"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Обновляется каждую минуту. Зелёный = есть звонки за вчера и импорт за последние {IMPORT_FRESH_HOURS}ч. Красный = нет ни того, ни другого.
      </p>
    </div>
  );
}
