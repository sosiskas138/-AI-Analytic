import { useState, useMemo } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  BarChart3,
  Clock,
  FolderKanban,
  DollarSign,
  Loader2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Target,
  AlertTriangle,
  CheckCircle2,
  CalendarIcon,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, subYears, startOfWeek, endOfWeek, startOfDay, endOfDay, subDays } from "date-fns";
import { ru } from "date-fns/locale";
import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { KPICard } from "@/components/KPICard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type PeriodPreset = "month" | "quarter" | "year" | "all" | "custom";

function getPeriodRange(preset: PeriodPreset, customRange?: { from?: Date; to?: Date }): { from: string; to: string } {
  const now = new Date();
  if (preset === "custom" && customRange?.from && customRange?.to) {
    return { from: format(customRange.from, "yyyy-MM-dd"), to: format(customRange.to, "yyyy-MM-dd") };
  }
  if (preset === "month") {
    const start = startOfMonth(subMonths(now, 1));
    const end = endOfMonth(subMonths(now, 1));
    return { from: format(start, "yyyy-MM-dd"), to: format(end, "yyyy-MM-dd") };
  }
  if (preset === "quarter") {
    const m = now.getMonth();
    const quarterStart = new Date(now.getFullYear(), m - (m % 3) - 3, 1);
    const quarterEnd = endOfMonth(subMonths(quarterStart, -2));
    return { from: format(quarterStart, "yyyy-MM-dd"), to: format(quarterEnd, "yyyy-MM-dd") };
  }
  if (preset === "year") {
    const start = startOfYear(subYears(now, 1));
    const end = endOfYear(subYears(now, 1));
    return { from: format(start, "yyyy-MM-dd"), to: format(end, "yyyy-MM-dd") };
  }
  return { from: "", to: "" };
}

const CPL_CATEGORY_COLOR: Record<string, string> = {
  A: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  B: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  C: "bg-red-500/15 text-red-700 dark:text-red-400",
};

export default function Statistics() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("all");
  const [customRange, setCustomRange] = useState<{ from?: Date; to?: Date }>(() => {
    const end = endOfDay(new Date());
    const start = startOfDay(subDays(end, 29));
    return { from: start, to: end };
  });

  if (!isAdmin) return <Navigate to="/projects" replace />;
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [activeOnly, setActiveOnly] = useState(false);
  const [totalCompanyGroupBy, setTotalCompanyGroupBy] = useState<"day" | "week" | "month">("month");
  const [sortBy, setSortBy] = useState<"minutes" | "cost" | "costPerMinute" | "cpl" | "shareCost">("cpl");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [abcFilter, setAbcFilter] = useState<"all" | "A" | "B" | "C">("all");

  const { from, to } = getPeriodRange(periodPreset, customRange);
  const params = useMemo(() => ({
    fromDate: from || undefined,
    toDate: to || undefined,
    projectId: projectFilter === "all" ? undefined : projectFilter,
    activeOnly,
    groupBy: totalCompanyGroupBy,
  }), [from, to, projectFilter, activeOnly, totalCompanyGroupBy]);

  const { data, isLoading } = useQuery({
    queryKey: ["statistics-company", params],
    queryFn: () => api.getCompanyStatistics(params),
    staleTime: 60000,
  });

  const { data: projectsData } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const r = await api.getProjects();
      return r.projects || [];
    },
  });
  const projects = projectsData || [];

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.getSettings(),
  });
  const cplA = settings?.cpl_target_a != null ? Number(settings.cpl_target_a) : 500;
  const cplB = settings?.cpl_target_b != null ? Number(settings.cpl_target_b) : 1000;
  const cplC = settings?.cpl_target_c != null ? Number(settings.cpl_target_c) : 2000;

  const summary = data?.summary ?? null;
  const byMonthRaw = data?.byMonth ?? [];
  // Таблица: сверху новый период, ниже — старые. Графики используют monthChartData (там порядок по возрастанию даты).
  const byMonth = useMemo(
    () => [...byMonthRaw].sort((a, b) => b.month.localeCompare(a.month)),
    [byMonthRaw]
  );
  const byProject = data?.byProject ?? [];
  const abc = data?.abc ?? { A: [], B: [], C: [], contributionA: { minutes: 0, cost: 0 }, contributionB: { minutes: 0, cost: 0 }, contributionC: { minutes: 0, cost: 0 } };
  const topEfficient = data?.topEfficient ?? [];
  const topInefficient = data?.topInefficient ?? [];

  const projectsWithLeads = useMemo(() => byProject.filter((p: any) => (p.leads ?? 0) > 0), [byProject]);
  // При выборе одного проекта показываем его в сравнении и блоках даже без лидов
  const projectsForComparison = useMemo(
    () => (projectFilter === "all" ? projectsWithLeads : byProject),
    [projectFilter, projectsWithLeads, byProject]
  );
  const projectsByAbc = useMemo(() => {
    if (abcFilter === "all") return projectsForComparison;
    return projectsForComparison.filter(
      (p: any) => String(p?.abcCategory ?? "").trim().toUpperCase() === abcFilter
    );
  }, [projectsForComparison, abcFilter]);

  const sortedProjects = useMemo(() => {
    const arr = [...projectsByAbc];
    arr.sort((a, b) => {
      let va = a[sortBy] ?? 0;
      let vb = b[sortBy] ?? 0;
      va = Number(va);
      vb = Number(vb);
      if (sortDir === "asc") return va > vb ? 1 : -1;
      return va < vb ? 1 : -1;
    });
    return arr;
  }, [projectsByAbc, sortBy, sortDir]);

  const toggleSort = (key: typeof sortBy) => {
    if (sortBy === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else setSortBy(key);
  };

  const periodLabel = (key: string) => {
    if (key.length === 7) return format(new Date(key + "-01"), "LLLL yyyy", { locale: ru });
    if (key.length === 10) {
      if (totalCompanyGroupBy === "week") {
        const start = new Date(key);
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        return `Неделя (${format(start, "dd.MM")}-${format(end, "dd.MM")})`;
      }
      return format(new Date(key), "dd.MM.yyyy", { locale: ru });
    }
    return key;
  };

  // Для графика: строго по времени (слева — старее, справа — новее)
  const monthChartData = useMemo(() => {
    const sorted = [...byMonthRaw].sort((a, b) => {
      const dateA = a.month.length === 7 ? `${a.month}-01` : a.month;
      const dateB = b.month.length === 7 ? `${b.month}-01` : b.month;
      return new Date(dateA).getTime() - new Date(dateB).getTime();
    });
    return sorted.map((m) => ({
      month: periodLabel(m.month),
      periodKey: m.month,
      minutes: m.minutes,
      cost: Math.round(m.cost),
      projects: m.projectCount,
    }));
  }, [byMonthRaw, totalCompanyGroupBy]);

  const periodChartLabel =
    totalCompanyGroupBy === "month" ? "месяцам" : totalCompanyGroupBy === "week" ? "неделям" : "дням";

  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8 p-4 md:p-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Статистика</h1>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={periodPreset} onValueChange={(v) => setPeriodPreset(v as PeriodPreset)}>
            <SelectTrigger className="w-[160px]">
              <CalendarIcon className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Период" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Прошлый месяц</SelectItem>
              <SelectItem value="quarter">Прошлый квартал</SelectItem>
              <SelectItem value="year">Прошлый год</SelectItem>
              <SelectItem value="all">Всё время</SelectItem>
              <SelectItem value="custom">Свой период</SelectItem>
            </SelectContent>
          </Select>
          {periodPreset === "custom" && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "min-w-[200px] justify-start text-left font-normal",
                    (customRange.from || customRange.to) && "border-primary text-primary"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {customRange.from && customRange.to
                    ? `${format(customRange.from, "dd.MM.yyyy", { locale: ru })} – ${format(customRange.to, "dd.MM.yyyy", { locale: ru })}`
                    : customRange.from
                      ? `${format(customRange.from, "dd.MM.yyyy", { locale: ru })} – ...`
                      : "Выберите период"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={customRange.from || customRange.to ? { from: customRange.from, to: customRange.to } : undefined}
                  onSelect={(range) => {
                    setCustomRange({
                      from: range?.from ? startOfDay(range.from) : undefined,
                      to: range?.to ? endOfDay(range.to) : undefined,
                    });
                  }}
                  numberOfMonths={2}
                  className="p-3"
                />
              </PopoverContent>
            </Popover>
          )}
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Проект" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все проекты</SelectItem>
              {projects.map((p: any) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={activeOnly} onCheckedChange={(c) => setActiveOnly(!!c)} />
            Только активные
          </label>
        </div>
      </div>

      {/* KPI Summary */}
      <section className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <KPICard title="Минуты" value={summary?.totalMinutes?.toLocaleString() ?? "—"} icon={Clock} delay={0.05} />
        <KPICard title="Проектов" value={summary?.projectCount ?? "—"} icon={FolderKanban} delay={0.1} />
        <KPICard title="Затраты на минуты, ₽" value={summary?.totalMinutesCost != null ? summary.totalMinutesCost.toLocaleString() : "—"} icon={DollarSign} delay={0.15} />
        <KPICard title="Затраты на контакты (базы), ₽" value={summary?.totalContactsCost != null ? summary.totalContactsCost.toLocaleString() : "—"} icon={DollarSign} delay={0.2} />
        <KPICard title="Общие затраты, ₽" value={summary?.totalCost != null ? summary.totalCost.toLocaleString() : "—"} icon={DollarSign} delay={0.25} />
        <KPICard title="₽/мин (средн.)" value={summary?.avgCostPerMinute != null ? summary.avgCostPerMinute.toFixed(1) : "—"} icon={Target} delay={0.3} />
      </section>

      {/* Total Company */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Total Company
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant={totalCompanyGroupBy === "day" ? "default" : "outline"}
                size="sm"
                onClick={() => setTotalCompanyGroupBy("day")}
              >
                По дням
              </Button>
              <Button
                variant={totalCompanyGroupBy === "week" ? "default" : "outline"}
                size="sm"
                onClick={() => setTotalCompanyGroupBy("week")}
              >
                По неделям
              </Button>
              <Button
                variant={totalCompanyGroupBy === "month" ? "default" : "outline"}
                size="sm"
                onClick={() => setTotalCompanyGroupBy("month")}
              >
                По месяцам
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {byMonth.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{totalCompanyGroupBy === "month" ? "Месяц" : totalCompanyGroupBy === "week" ? "Неделя" : "День"}</TableHead>
                      <TableHead className="text-right">Минуты</TableHead>
                      <TableHead className="text-right">Затраты на минуты, ₽</TableHead>
                      {totalCompanyGroupBy !== "day" && (
                        <>
                          <TableHead className="text-right">Затраты на контакты, ₽</TableHead>
                          <TableHead className="text-right">Затраты всего, ₽</TableHead>
                          <TableHead className="text-right">₽/мин</TableHead>
                        </>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byMonth.map((m) => (
                      <TableRow
                        key={m.month}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => {
                          const key = m.month;
                          let fromD: Date;
                          let toD: Date;
                          if (key.length === 10) {
                            fromD = new Date(key);
                            toD = new Date(key);
                          } else if (key.length === 7) {
                            const [y, mo] = key.split("-").map(Number);
                            fromD = new Date(y, mo - 1, 1);
                            toD = endOfMonth(fromD);
                          } else {
                            fromD = new Date(key);
                            toD = endOfWeek(fromD, { weekStartsOn: 1 });
                            fromD = startOfWeek(fromD, { weekStartsOn: 1 });
                          }
                          setPeriodPreset("custom");
                          setCustomRange({ from: fromD, to: toD });
                        }}
                      >
                        <TableCell className="font-medium">
                          {periodLabel(m.month)}
                        </TableCell>
                        <TableCell className="text-right">{m.minutes.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{(m.minutesCost ?? m.cost).toLocaleString()}</TableCell>
                        {totalCompanyGroupBy !== "day" && (
                          <>
                            <TableCell className="text-right">{(m.contactsCost ?? 0).toLocaleString()}</TableCell>
                            <TableCell className="text-right">{m.cost.toLocaleString()}</TableCell>
                            <TableCell className="text-right">{m.minutes > 0 ? (m.cost / m.minutes).toFixed(2) : "—"}</TableCell>
                          </>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Минуты по {periodChartLabel}</p>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={monthChartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} reversed={false} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="minutes" stroke="#3b82f6" name="Минуты" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Затраты по {periodChartLabel}</p>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={monthChartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} reversed={false} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: number) => [v.toLocaleString() + " ₽", "Затраты"]} />
                      <Line type="monotone" dataKey="cost" stroke="#22c55e" name="Затраты, ₽" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">Нет данных за выбранный период.</p>
          )}
        </CardContent>
      </Card>

      {projectFilter === "all" && (
        <>
      {/* Сравнение проектов */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Сравнение проектов</CardTitle>
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-muted-foreground self-center">ABC:</span>
              <Button variant={abcFilter === "all" ? "default" : "outline"} size="sm" onClick={() => setAbcFilter("all")}>
                ВСЕ
              </Button>
              <Button variant={abcFilter === "A" ? "default" : "outline"} size="sm" onClick={() => setAbcFilter("A")}>
                A
              </Button>
              <Button variant={abcFilter === "B" ? "default" : "outline"} size="sm" onClick={() => setAbcFilter("B")}>
                B
              </Button>
              <Button variant={abcFilter === "C" ? "default" : "outline"} size="sm" onClick={() => setAbcFilter("C")}>
                C
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {sortedProjects.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">Проект</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Лиды</TableHead>
                      <TableHead
                        className="text-right cursor-pointer whitespace-nowrap"
                        onClick={() => toggleSort("cpl")}
                      >
                        <span className="flex items-center justify-end gap-1">
                          CPL, ₽ {sortBy === "cpl" ? sortDir === "desc" ? <ArrowDown className="h-3 w-3 shrink-0" /> : <ArrowUp className="h-3 w-3 shrink-0" /> : <ArrowUpDown className="h-3 w-3 shrink-0 opacity-50" />}
                        </span>
                      </TableHead>
                      <TableHead
                        className="text-right cursor-pointer whitespace-nowrap"
                        onClick={() => toggleSort("minutes")}
                      >
                        <span className="flex items-center justify-end gap-1">
                          Минуты {sortBy === "minutes" ? sortDir === "desc" ? <ArrowDown className="h-3 w-3 shrink-0" /> : <ArrowUp className="h-3 w-3 shrink-0" /> : <ArrowUpDown className="h-3 w-3 shrink-0 opacity-50" />}
                        </span>
                      </TableHead>
                      <TableHead
                        className="text-right cursor-pointer whitespace-nowrap"
                        onClick={() => toggleSort("cost")}
                      >
                        <span className="flex items-center justify-end gap-1">
                          Затраты {sortBy === "cost" ? sortDir === "desc" ? <ArrowDown className="h-3 w-3 shrink-0" /> : <ArrowUp className="h-3 w-3 shrink-0" /> : <ArrowUpDown className="h-3 w-3 shrink-0 opacity-50" />}
                        </span>
                      </TableHead>
                      <TableHead
                        className="text-right cursor-pointer whitespace-nowrap"
                        onClick={() => toggleSort("costPerMinute")}
                      >
                        <span className="flex items-center justify-end gap-1">
                          ₽/мин {sortBy === "costPerMinute" ? sortDir === "desc" ? <ArrowDown className="h-3 w-3 shrink-0" /> : <ArrowUp className="h-3 w-3 shrink-0" /> : <ArrowUpDown className="h-3 w-3 shrink-0 opacity-50" />}
                        </span>
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">Доля затрат %</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Доля минут %</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Статус</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedProjects.map((p: any) => (
                      <TableRow
                        key={p.projectId}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/projects/${p.projectId}/dashboard`, { state: { from: "/statistics" } })}
                      >
                        <TableCell className="font-medium">{p.projectName}</TableCell>
                        <TableCell className="text-right">{p.leads?.toLocaleString() ?? "0"}</TableCell>
                        <TableCell className="text-right">{p.cpl != null ? p.cpl.toLocaleString() : "—"} ₽</TableCell>
                        <TableCell className="text-right">{p.minutes.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{p.cost.toLocaleString()} ₽</TableCell>
                        <TableCell className="text-right">{p.costPerMinute.toFixed(1)}</TableCell>
                        <TableCell className="text-right">{p.shareCost}%</TableCell>
                        <TableCell className="text-right">{p.shareMinutes}%</TableCell>
                        <TableCell className="text-right">
                          <span className={cn("inline-flex items-center rounded px-2 py-0.5 text-xs font-medium", CPL_CATEGORY_COLOR[p.abcCategory] ?? "")}>
                            {p.abcCategory ?? "—"}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">Нет данных по проектам (учитываются только проекты с лидами &gt; 0).</p>
          )}
        </CardContent>
      </Card>

      {/* ABC-анализ */}
      <Card>
        <CardHeader>
          <CardTitle>ABC-анализ по проектам (по CPL)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Пороги CPL: A ≤ {cplA.toLocaleString()} ₽, B: {cplA.toLocaleString()}–{cplC.toLocaleString()} ₽, C ≥ {cplC.toLocaleString()} ₽.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="rounded-lg border bg-card p-4">
              <h4 className="font-semibold text-primary mb-2">Категория A</h4>
              <p className="text-2xl font-bold">{abc.A?.length ?? 0} проектов</p>
              <p className="text-sm text-muted-foreground mt-1">
                Минуты: {(abc.contributionA?.minutes ?? 0).toLocaleString()}, затраты: {(abc.contributionA?.cost ?? 0).toLocaleString()} ₽
              </p>
              <ul className="mt-3 space-y-1 text-sm">
                {(abc.A ?? []).slice(0, 5).map((p: any) => (
                  <li
                    key={p.projectId}
                    className="cursor-pointer hover:underline"
                    onClick={() => navigate(`/projects/${p.projectId}/dashboard`, { state: { from: "/statistics" } })}
                  >
                    {p.projectName}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <h4 className="font-semibold mb-2">Категория B</h4>
              <p className="text-2xl font-bold">{abc.B?.length ?? 0} проектов</p>
              <p className="text-sm text-muted-foreground mt-1">
                Минуты: {(abc.contributionB?.minutes ?? 0).toLocaleString()}, затраты: {(abc.contributionB?.cost ?? 0).toLocaleString()} ₽
              </p>
              <ul className="mt-3 space-y-1 text-sm">
                {(abc.B ?? []).slice(0, 5).map((p: any) => (
                  <li
                    key={p.projectId}
                    className="cursor-pointer hover:underline"
                    onClick={() => navigate(`/projects/${p.projectId}/dashboard`, { state: { from: "/statistics" } })}
                  >
                    {p.projectName}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <h4 className="font-semibold mb-2">Категория C</h4>
              <p className="text-2xl font-bold">{abc.C?.length ?? 0} проектов</p>
              <p className="text-sm text-muted-foreground mt-1">
                Минуты: {(abc.contributionC?.minutes ?? 0).toLocaleString()}, затраты: {(abc.contributionC?.cost ?? 0).toLocaleString()} ₽
              </p>
              <ul className="mt-3 space-y-1 text-sm">
                {(abc.C ?? []).slice(0, 5).map((p: any) => (
                  <li
                    key={p.projectId}
                    className="cursor-pointer hover:underline"
                    onClick={() => navigate(`/projects/${p.projectId}/dashboard`, { state: { from: "/statistics" } })}
                  >
                    {p.projectName}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Успешные / неэффективные по затратам */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Успешные по CPL (топ-5)
            </CardTitle>
            <p className="text-sm text-muted-foreground">Лучший CPL (низкая стоимость лида)</p>
          </CardHeader>
          <CardContent>
            {topEfficient.length > 0 ? (
              <ul className="space-y-3">
                {topEfficient.map((p: any) => (
                  <li
                    key={p.projectId}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={() => navigate(`/projects/${p.projectId}/dashboard`, { state: { from: "/statistics" } })}
                  >
                    <span className="font-medium">{p.projectName}</span>
                    <span className="text-sm text-muted-foreground">
                      {p.cpl?.toLocaleString()} ₽/лид · {p.leads?.toLocaleString()} лидов
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">Нет данных.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Неэффективные по CPL
            </CardTitle>
            <p className="text-sm text-muted-foreground">Наивысший CPL (топ-5)</p>
          </CardHeader>
          <CardContent>
            {topInefficient.length > 0 ? (
              <ul className="space-y-3">
                {topInefficient.map((p: any) => (
                  <li
                    key={p.projectId}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={() => navigate(`/projects/${p.projectId}/dashboard`, { state: { from: "/statistics" } })}
                  >
                    <span className="font-medium">{p.projectName}</span>
                    <span className="text-sm text-destructive">
                      {p.cpl?.toLocaleString()} ₽/лид · {p.cost?.toLocaleString()} ₽
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">Нет проектов с лидами.</p>
            )}
          </CardContent>
        </Card>
      </div>
        </>
      )}
    </div>
  );
}
