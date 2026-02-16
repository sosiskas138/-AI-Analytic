import { useState, useMemo, useEffect } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Search, Clock, CheckCircle2, XCircle, Loader2,
  Phone, PhoneCall, Signal, Users, Filter, X, CalendarIcon, Trash2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, isStatusSuccessful } from "@/lib/utils";
import { api } from "@/lib/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { KPICard } from "@/components/KPICard";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, startOfDay, endOfDay } from "date-fns";
import { ru } from "date-fns/locale";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function ProjectCalls() {
  const { projectId } = useParams();
  const [search, setSearch] = useState("");
  const [compact, setCompact] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [leadFilter, setLeadFilter] = useState<string>("all");
  const [callListFilter, setCallListFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [tablePage, setTablePage] = useState(1);
  const TABLE_PAGE_SIZE = 100;
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((c: any) => c.id)));
    }
  };

  const handleDelete = async () => {
    if (selected.size === 0) return;
    setDeleting(true);
    try {
      const ids = [...selected];
      // Delete in batches of 100
      for (let i = 0; i < ids.length; i += 100) {
        const batch = ids.slice(i, i + 100);
        await api.deleteCalls(batch);
      }
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["calls", projectId] });
    } catch (e: any) {
      console.error("Delete failed", e);
      alert(e.message || "Ошибка при удалении звонков");
    } finally {
      setDeleting(false);
    }
  };

  const { data: callsData, isLoading } = useQuery({
    queryKey: ["calls", projectId],
    queryFn: async () => {
      const all: any[] = [];
      let page = 1;
      const pageSize = 1000;
      while (true) {
        const response = await api.getCalls(projectId!, { page, pageSize });
        if (!response.calls || response.calls.length === 0) break;
        all.push(...response.calls);
        if (response.calls.length < pageSize || all.length >= response.total) break;
        page++;
      }
      return all;
    },
    enabled: !!projectId,
  });

  const allCalls = callsData || [];

  // Extract unique values for filter options
  const statuses = useMemo(() => {
    const set = new Set(allCalls.map((c) => c.status).filter(Boolean));
    return [...set].sort();
  }, [allCalls]);

  const callLists = useMemo(() => {
    const set = new Set(allCalls.map((c) => c.call_list).filter(Boolean));
    return [...set].sort();
  }, [allCalls]);

  // Apply filters
  const filtered = useMemo(() => {
    return allCalls.filter((c) => {
      if (search && !c.phone_raw.includes(search) && !c.phone_normalized.includes(search) && !c.external_call_id.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (leadFilter === "yes" && !c.is_lead) return false;
      if (leadFilter === "no" && c.is_lead) return false;
      if (callListFilter === "none" && (c.call_list != null && c.call_list !== "")) return false;
      if (callListFilter !== "all" && callListFilter !== "none" && c.call_list !== callListFilter) return false;
      if (dateRange.from) {
        if (new Date(c.call_at) < dateRange.from) return false;
      }
      if (dateRange.to) {
        if (new Date(c.call_at) > dateRange.to) return false;
      }
      return true;
    });
  }, [allCalls, search, statusFilter, leadFilter, callListFilter, dateRange]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / TABLE_PAGE_SIZE));
  useEffect(() => setTablePage(1), [search, statusFilter, leadFilter, callListFilter, dateRange.from, dateRange.to]);
  const paginatedCalls = useMemo(
    () => filtered.slice((tablePage - 1) * TABLE_PAGE_SIZE, tablePage * TABLE_PAGE_SIZE),
    [filtered, tablePage]
  );

  // Metrics for filtered data
  const metrics = useMemo(() => {
    const total = filtered.length;
    const calledPhones = new Set(filtered.map((c) => c.phone_normalized));
    const answeredPhones = new Set<string>();
    const leadPhones = new Set<string>();
    for (const c of filtered) {
      if (isStatusSuccessful(c.status)) answeredPhones.add(c.phone_normalized);
      if (c.is_lead) leadPhones.add(c.phone_normalized);
    }
    const answered = answeredPhones.size;
    const leads = leadPhones.size;
    const answerRate = calledPhones.size > 0 ? (answeredPhones.size / calledPhones.size) * 100 : 0;
    const avgDuration = total > 0 ? filtered.reduce((s, c) => s + c.duration_seconds, 0) / total : 0;
    return { total, uniquePhones: calledPhones.size, answered, answerRate, leads, avgDuration };
  }, [filtered]);

  const hasActiveFilters = statusFilter !== "all" || leadFilter !== "all" || callListFilter !== "all" || dateRange.from || dateRange.to;

  const clearFilters = () => {
    setStatusFilter("all");
    setLeadFilter("all");
    setCallListFilter("all");
    setDateRange({});
  };

  const statusColor = (s: string) => {
    const lower = s.toLowerCase();
    if (lower === "успешный" || lower === "ответ" || lower === "answered") return "bg-success/10 text-success border-success/20";
    if (lower.includes("недозвон") || lower.includes("нет") || lower === "no answer") return "bg-warning/10 text-warning border-warning/20";
    if (lower === "занято" || lower === "busy") return "bg-chart-3/10 text-chart-3 border-chart-3/20";
    return "bg-destructive/10 text-destructive border-destructive/20";
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}м ${sec}с` : `${sec}с`;
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" }) +
      " " + d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Звонки</h1>
          <p className="text-muted-foreground mt-1">{filtered.length} из {allCalls.length} записей</p>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card rounded-xl p-4 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Фильтры</span>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-3 w-3" /> Сбросить
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Поиск..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Статус" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все статусы</SelectItem>
              {statuses.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={leadFilter} onValueChange={setLeadFilter}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Лид" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все</SelectItem>
              <SelectItem value="yes">Лиды</SelectItem>
              <SelectItem value="no">Не лиды</SelectItem>
            </SelectContent>
          </Select>
          <Select value={callListFilter} onValueChange={setCallListFilter}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Колл-лист" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все колл-листы</SelectItem>
              <SelectItem value="none">Без колл-листа</SelectItem>
              {callLists.map((cl) => (
                <SelectItem key={cl} value={cl}>{cl}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 text-sm gap-1.5">
                <CalendarIcon className="h-3.5 w-3.5" />
                {dateRange.from ? (
                  dateRange.to ? (
                    <>{format(dateRange.from, "dd.MM.yy", { locale: ru })} – {format(dateRange.to, "dd.MM.yy", { locale: ru })}</>
                  ) : format(dateRange.from, "dd.MM.yy", { locale: ru })
                ) : "Период"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                selected={dateRange.from || dateRange.to ? { from: dateRange.from, to: dateRange.to } : undefined}
                onSelect={(range) => {
                  setDateRange({
                    from: range?.from ? startOfDay(range.from) : undefined,
                    to: range?.to ? endOfDay(range.to) : undefined,
                  });
                }}
                numberOfMonths={2}
                locale={ru}
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-5">
        <KPICard title="Все звонки" value={metrics.total.toLocaleString()} icon={PhoneCall} delay={0} info="Общее число звонков по выбранным фильтрам" />
        <KPICard title="Уникальные" value={metrics.uniquePhones.toLocaleString()} icon={Phone} delay={0.05} info="Количество уникальных номеров (без повторных попыток)" />
        <KPICard title="Дозвон" value={`${metrics.answerRate.toFixed(1)}%`} icon={Signal} delay={0.1} info="Номера со статусом «Успешный» / Прозвонено × 100%" />
        <KPICard title="Дозвонились" value={metrics.answered.toLocaleString()} icon={CheckCircle2} delay={0.15} info="Уникальные номера со статусом «Успешный»" />
        <KPICard title="Лиды" value={metrics.leads.toLocaleString()} icon={Users} delay={0.2} info="Уникальные номера, отмеченные как лид" />
        <KPICard title="Ср. длительность" value={formatDuration(Math.round(metrics.avgDuration))} icon={Clock} delay={0.25} info="Средняя длительность всех звонков по фильтру" />
      </div>

      {/* Table toolbar */}
      <div className="flex items-center justify-between mb-3">
        {isAdmin && selected.size > 0 ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="gap-2" disabled={deleting}>
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Удалить ({selected.size})
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Удалить звонки?</AlertDialogTitle>
                <AlertDialogDescription>
                  Будет удалено {selected.size} записей из базы данных. Это действие необратимо.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Отмена</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Удалить
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : <div />}
        <button onClick={() => setCompact(!compact)} className="px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-muted transition-colors text-muted-foreground">
          {compact ? "Подробный" : "Компактный"}
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <p className="text-muted-foreground">Нет звонков по выбранным фильтрам.</p>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                    {isAdmin && (
                    <th className="px-4 py-3 w-10">
                      <Checkbox
                        checked={paginatedCalls.length > 0 && paginatedCalls.every((c) => selected.has(c.id))}
                        onCheckedChange={() => {
                          if (paginatedCalls.every((c) => selected.has(c.id))) {
                            setSelected((prev) => {
                              const next = new Set(prev);
                              paginatedCalls.forEach((c) => next.delete(c.id));
                              return next;
                            });
                          } else {
                            setSelected((prev) => {
                              const next = new Set(prev);
                              paginatedCalls.forEach((c) => next.add(c.id));
                              return next;
                            });
                          }
                        }}
                      />
                    </th>
                  )}
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Телефон</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Дата</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Длительность</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Статус</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Лид</th>
                  {!compact && (
                    <>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Колл-лист</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Попытка</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">ID</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {paginatedCalls.map((call, i) => (
                  <motion.tr
                    key={call.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.005, 0.3) }}
                    className={cn("border-b border-border/50 hover:bg-muted/30 dark:hover:bg-muted/20 transition-colors", selected.has(call.id) && "bg-primary/5")}
                  >
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <Checkbox checked={selected.has(call.id)} onCheckedChange={() => toggleSelect(call.id)} />
                      </td>
                    )}
                    <td className="px-4 py-3 font-mono text-xs">{call.phone_raw}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(call.call_at)}</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        {formatDuration(call.duration_seconds)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={cn("text-[10px] font-medium", statusColor(call.status))}>
                        {call.status || "—"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {call.is_lead ? <CheckCircle2 className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-muted-foreground/30" />}
                    </td>
                    {!compact && (
                      <>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{call.call_list || "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">#{call.call_attempt_number}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{call.external_call_id}</td>
                      </>
                    )}
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 flex items-center justify-between border-t border-border text-sm">
            <span className="text-muted-foreground">
              {filtered.length > 0
                ? `Показано ${(tablePage - 1) * TABLE_PAGE_SIZE + 1}–${Math.min(tablePage * TABLE_PAGE_SIZE, filtered.length)} из ${filtered.length}`
                : "Нет записей"}
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={tablePage <= 1}
                  onClick={() => setTablePage((p) => Math.max(1, p - 1))}
                >
                  Назад
                </Button>
                <span className="px-2 text-muted-foreground">
                  {tablePage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={tablePage >= totalPages}
                  onClick={() => setTablePage((p) => Math.min(totalPages, p + 1))}
                >
                  Вперёд
                </Button>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
