import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import { Loader2, CheckCircle2, Circle, ExternalLink, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { isStatusSuccessful } from "@/lib/utils";

const CHECKBOXES = [
  { key: "materials_requested", label: "Материалы" },
  { key: "materials_sent", label: "Отправлены" },
  { key: "skillbase_ready", label: "Скиллбейз" },
  { key: "test_launched", label: "Тест" },
  { key: "launched_to_production", label: "В работе" },
] as const;

export default function AdminProjectStatuses() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  const { data: projectsData, isLoading: loadingProjects } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const response = await api.getProjects();
      return response.projects || [];
    },
  });
  const projects = projectsData || [];

  const { data: statuses, isLoading: loadingStatuses } = useQuery({
    queryKey: ["all-project-statuses"],
    queryFn: async () => {
      // Fetch status for each project
      const allStatuses: Record<string, any>[] = [];
      for (const project of projects) {
        try {
          const status = await api.getProjectStatus(project.id);
          if (status) allStatuses.push(status);
        } catch (e) {
          // Project may not have status yet
        }
      }
      return allStatuses;
    },
    enabled: !!projects && projects.length > 0,
  });

  const { data: allCalls } = useQuery({
    queryKey: ["admin-all-calls"],
    queryFn: async () => {
      const all: any[] = [];
      for (const project of projects) {
        let page = 1;
        const pageSize = 1000;
        while (true) {
          const response = await api.getCalls(project.id, { page, pageSize });
          if (!response.calls || response.calls.length === 0) break;
          all.push(...response.calls);
          if (response.calls.length < pageSize || all.length >= response.total) break;
          page++;
        }
      }
      return all;
    },
    enabled: !!projects && projects.length > 0,
  });

  const { data: allNumbers } = useQuery({
    queryKey: ["admin-all-numbers"],
    queryFn: async () => {
      const all: any[] = [];
      for (const project of projects) {
        let page = 1;
        const pageSize = 1000;
        while (true) {
          const response = await api.getSupplierNumbers(project.id, { page, pageSize });
          if (!response.numbers || response.numbers.length === 0) break;
          all.push(...response.numbers);
          if (response.numbers.length < pageSize || all.length >= response.total) break;
          page++;
        }
      }
      return all;
    },
    enabled: !!projects && projects.length > 0,
  });

  const { data: allSuppliers } = useQuery({
    queryKey: ["admin-all-suppliers"],
    queryFn: async () => {
      const all: any[] = [];
      for (const project of projects) {
        const response = await api.getSuppliers(project.id);
        all.push(...(response.suppliers || []));
      }
      return all;
    },
    enabled: !!projects && projects.length > 0,
  });

  const { data: allPricing } = useQuery({
    queryKey: ["admin-all-pricing"],
    queryFn: async () => {
      const all: any[] = [];
      for (const project of projects) {
        try {
          const pricing = await api.getProjectPricing(project.id);
          if (pricing) all.push(pricing);
        } catch (e) {
          // Project may not have pricing yet
        }
      }
      return all;
    },
    enabled: !!projects && projects.length > 0,
  });

  if (!isAdmin) {
    return (
      <div className="glass-card rounded-xl p-12 text-center">
        <p className="text-muted-foreground">Доступ только для администраторов</p>
      </div>
    );
  }

  if (loadingProjects || loadingStatuses) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const getMetrics = (projectId: string) => {
    const calls = allCalls?.filter((c) => c.project_id === projectId) || [];
    const numbers = allNumbers?.filter((n) => n.project_id === projectId) || [];
    const uniqueContacts = numbers.filter((n) => !n.is_duplicate_in_project).length;
    const totalCalls = calls.length;
    const leads = calls.filter((c) => c.is_lead).length;
    const answered = calls.filter((c) => isStatusSuccessful(c.status)).length;
    const answerRate = totalCalls > 0 ? ((answered / totalCalls) * 100).toFixed(1) : "0";
    const minutes = calls.reduce((s, c) => s + (c.billed_minutes || Math.ceil((c.duration_seconds || 0) / 60)), 0);

    // Конверсия в звонок (успешный): дозвонились / контакты
    const convCall = uniqueContacts > 0 ? ((answered / uniqueContacts) * 100).toFixed(1) : "0";
    // Конверсия в лид: лиды / дозвонились
    const convLead = answered > 0 ? ((leads / answered) * 100).toFixed(1) : "0";

    // Стоимость базы: сумма по поставщикам (кол-во номеров × цена контакта)
    const suppliers = allSuppliers?.filter((s) => s.project_id === projectId) || [];
    let costBase = 0;
    for (const sup of suppliers) {
      const numCount = numbers.filter((n) => n.supplier_id === sup.id).length;
      costBase += numCount * (sup.price_per_contact || 0);
    }

    // Стоимость минут
    const pricing = allPricing?.find((p) => p.project_id === projectId);
    const pricePerMinute = pricing?.price_per_minute || 0;
    const costMinutes = minutes * pricePerMinute;

    const totalCost = costBase + costMinutes;
    const costPerLead = leads > 0 ? Math.round(totalCost / leads) : 0;

    return { uniqueContacts, totalCalls, leads, answered, answerRate, minutes, convCall, convLead, costBase, costMinutes, totalCost, costPerLead };
  };

  return (
    <div>
      <div className="mb-8 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin")} className="h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Статистика проектов</h1>
          <p className="text-muted-foreground mt-1">Статусы и метрики всех проектов</p>
        </div>
      </div>

      <div className="space-y-4">
        {projects?.map((project, idx) => {
          const st = statuses?.find((s) => s.project_id === project.id) || ({} as Record<string, any>);
          const metrics = getMetrics(project.id);
          const completedSteps = CHECKBOXES.filter((cb) => !!st[cb.key]).length;

          return (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="glass-card rounded-xl overflow-hidden"
            >
              {/* Header */}
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold">{project.name}</h3>
                  <Badge variant={st.is_active !== false ? "default" : "secondary"} className="text-[10px]">
                    {st.is_active !== false ? "Активен" : "Выключен"}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px]">
                    {completedSteps}/{CHECKBOXES.length}
                  </Badge>
                  {st.company_name && (
                    <span className="text-xs text-muted-foreground">• {st.company_name}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {st.analysis_link && (
                    <a href={st.analysis_link} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                  <Button variant="outline" size="sm" onClick={() => navigate(`/projects/${project.id}/status`)}>
                    Открыть
                  </Button>
                </div>
              </div>

              {/* Progress */}
              <div className="px-5 py-3">
                <div className="flex flex-wrap gap-1.5">
                  {CHECKBOXES.map((cb) => {
                    const isActive = !!st[cb.key];
                    const isLaunched = cb.key === "launched_to_production" && isActive;
                    return (
                      <div
                        key={cb.key}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium ${
                          isLaunched
                            ? "animate-pulse"
                            : isActive
                              ? "bg-primary/10 text-primary"
                              : "bg-muted text-muted-foreground"
                        }`}
                        style={isLaunched ? { backgroundColor: "rgba(34,197,94,0.15)", color: "rgb(34,197,94)" } : undefined}
                      >
                        {isActive ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
                        {cb.label}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Metrics — below, larger */}
              <div className="px-5 py-4 border-t border-border/50 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-10 gap-4">
                <div>
                  <p className="text-lg font-bold">{metrics.uniqueContacts.toLocaleString()}</p>
                  <p className="text-[11px] text-muted-foreground">Контакты</p>
                </div>
                <div>
                  <p className="text-lg font-bold">{metrics.totalCalls.toLocaleString()}</p>
                  <p className="text-[11px] text-muted-foreground">Звонки</p>
                </div>
                <div>
                  <p className="text-lg font-bold">{metrics.answered.toLocaleString()}</p>
                  <p className="text-[11px] text-muted-foreground">Дозвон</p>
                </div>
                <div>
                  <p className="text-lg font-bold">{metrics.answerRate}%</p>
                  <p className="text-[11px] text-muted-foreground">% дозвона</p>
                </div>
                <div>
                  <p className="text-lg font-bold">{metrics.convCall}%</p>
                  <p className="text-[11px] text-muted-foreground">Конв. в звонок</p>
                </div>
                <div>
                  <p className="text-lg font-bold">{metrics.leads}</p>
                  <p className="text-[11px] text-muted-foreground">Лиды</p>
                </div>
                <div>
                  <p className="text-lg font-bold">{metrics.convLead}%</p>
                  <p className="text-[11px] text-muted-foreground">Конв. в лид</p>
                </div>
                <div>
                  <p className="text-lg font-bold">{metrics.totalCost > 0 ? `${metrics.totalCost.toLocaleString()} ₽` : "—"}</p>
                  <p className="text-[11px] text-muted-foreground">Потрачено</p>
                </div>
                <div>
                  <p className="text-lg font-bold">{metrics.costPerLead > 0 ? `${metrics.costPerLead.toLocaleString()} ₽` : "—"}</p>
                  <p className="text-[11px] text-muted-foreground">₽ / лид</p>
                </div>
                <div>
                  <p className="text-lg font-bold">{metrics.minutes.toLocaleString()}</p>
                  <p className="text-[11px] text-muted-foreground">Минуты</p>
                </div>
              </div>

              {/* Comment */}
              {st.comment && (
                <div className="px-5 py-2 border-t border-border/50 bg-muted/30">
                  <p className="text-xs text-muted-foreground"><span className="font-medium">Комментарий:</span> {st.comment}</p>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
