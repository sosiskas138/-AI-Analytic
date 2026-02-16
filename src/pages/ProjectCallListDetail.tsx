import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, CalendarDays, Phone, PhoneCall, Target, TrendingUp, DollarSign, ArrowLeft, CalendarIcon } from "lucide-react";
import { KPICard } from "@/components/KPICard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, startOfDay, endOfDay } from "date-fns";
import { ru } from "date-fns/locale";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { isStatusSuccessful } from "@/lib/utils";

export default function ProjectCallListDetail() {
  const { projectId, callListName } = useParams();
  const navigate = useNavigate();
  const decodedName = decodeURIComponent(callListName || "");
  const isNoList = decodedName === "__none__";
  const displayName = isNoList ? "Без колл-листа" : decodedName;

  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});

  const { data: calls, isLoading } = useQuery({
    queryKey: ["calls-for-call-list-detail", projectId, decodedName],
    queryFn: async () => {
      const all: any[] = [];
      let page = 1;
      const pageSize = 1000;
      while (true) {
        const response = await api.getCalls(projectId!, { page, pageSize });
        if (!response.calls || response.calls.length === 0) break;
        // Filter by call_list on client side
        const filtered = isNoList
          ? response.calls.filter((c: any) => !c.call_list || c.call_list === '')
          : response.calls.filter((c: any) => c.call_list === decodedName);
        all.push(...filtered);
        if (response.calls.length < pageSize || all.length >= response.total) break;
        page++;
      }
      return all;
    },
    enabled: !!projectId,
  });

  const { data: pricing } = useQuery({
    queryKey: ["pricing", projectId],
    queryFn: async () => {
      return await api.getProjectPricing(projectId!);
    },
    enabled: !!projectId,
  });

  const dailyReport = useMemo(() => {
    const allCalls = calls || [];
    const ppc = (pricing as any)?.price_per_contact ?? 0;

    const byDate = new Map<string, {
      calledPhones: Set<string>;
      answeredPhones: Set<string>;
      leadPhones: Set<string>;
      totalCalls: number;
      answeredCalls: number;
      totalDuration: number;
    }>();

    for (const c of allCalls) {
      const date = c.call_at?.slice(0, 10) || "unknown";
      if (dateRange.from && date < format(dateRange.from, "yyyy-MM-dd")) continue;
      if (dateRange.to && date > format(dateRange.to, "yyyy-MM-dd")) continue;

      if (!byDate.has(date)) {
        byDate.set(date, {
          calledPhones: new Set(),
          answeredPhones: new Set(),
          leadPhones: new Set(),
          totalCalls: 0,
          answeredCalls: 0,
          totalDuration: 0,
        });
      }
      const entry = byDate.get(date)!;
      entry.totalCalls++;
      entry.calledPhones.add(c.phone_normalized);

      if (isStatusSuccessful(c.status)) {
        entry.answeredCalls++;
        entry.answeredPhones.add(c.phone_normalized);
      }
      if (c.is_lead) {
        entry.leadPhones.add(c.phone_normalized);
      }
      entry.totalDuration += c.duration_seconds || 0;
    }

    return [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => {
        const received = d.calledPhones.size;
        const answered = d.answeredPhones.size;
        const leads = d.leadPhones.size;
        const answerRate = received > 0 ? +((answered / received) * 100).toFixed(1) : 0;
        const conversionRate = answered > 0 ? +((leads / answered) * 100).toFixed(1) : 0;
        const avgDuration = d.answeredCalls > 0 ? Math.round(d.totalDuration / d.answeredCalls) : 0;
        const spent = received * ppc;
        const costPerLead = leads > 0 ? Math.round(spent / leads) : 0;

        return { date, received, answered, leads, answer_rate: answerRate, conversion_rate: conversionRate, total_calls: d.totalCalls, avg_duration: avgDuration, spent, cost_per_lead: costPerLead };
      });
  }, [calls, dateRange, pricing]);

  const totals = useMemo(() => {
    if (dailyReport.length === 0) return null;
    let received = 0, answered = 0, leads = 0, totalCalls = 0, totalSpent = 0;
    for (const r of dailyReport) {
      received += r.received;
      answered += r.answered;
      leads += r.leads;
      totalCalls += r.total_calls;
      totalSpent += r.spent;
    }
    return {
      received, answered, leads, total_calls: totalCalls, spent: totalSpent,
      answer_rate: received > 0 ? +((answered / received) * 100).toFixed(1) : 0,
      conversion_rate: answered > 0 ? +((leads / answered) * 100).toFixed(1) : 0,
      cost_per_lead: leads > 0 ? Math.round(totalSpent / leads) : 0,
    };
  }, [dailyReport]);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}м ${sec}с` : `${sec}с`;
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
      <div className="flex items-center gap-3 mb-8">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/projects/${projectId}/reports/call-lists`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{displayName}</h1>
          <p className="text-muted-foreground mt-1">Детализация по дням</p>
        </div>
      </div>

      {/* Date filter */}
      <div className="flex items-center gap-2 mb-6">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2 min-w-[220px] justify-start text-left font-normal">
              <CalendarIcon className="h-4 w-4" />
              {dateRange.from ? (
                dateRange.to ? (
                  <>
                    {format(dateRange.from, "dd.MM.yy", { locale: ru })} – {format(dateRange.to, "dd.MM.yy", { locale: ru })}
                  </>
                ) : (
                  format(dateRange.from, "dd.MM.yy", { locale: ru })
                )
              ) : (
                <span className="text-muted-foreground">Период</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
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
        {(dateRange.from || dateRange.to) && (
          <Button variant="ghost" size="sm" onClick={() => setDateRange({})}>
            Сбросить
          </Button>
        )}
      </div>

      {/* Summary cards */}
      {totals && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <KPICard title="Получено номеров" value={totals.received.toLocaleString()} icon={Phone} delay={0} info="Уникальные номера, по которым были звонки в этом колл-листе" />
          <KPICard title="Дозвон" value={`${totals.answered.toLocaleString()} (${totals.answer_rate}%)`} icon={PhoneCall} delay={0.05} info="Номера со статусом «Успешный»" />
          <KPICard title="Лиды" value={totals.leads.toLocaleString()} icon={Target} delay={0.1} info="Уникальные номера, отмеченные как лид" />
          <KPICard title="Конверсия в лид" value={`${totals.conversion_rate}%`} icon={TrendingUp} delay={0.15} info="Лиды / Дозвонились × 100%" />
          <KPICard title="Потрачено" value={totals.spent > 0 ? `${totals.spent.toLocaleString()} ₽` : "—"} icon={DollarSign} delay={0.2} info="Получено номеров × Стоимость контакта (ГЦК)" />
          <KPICard title="₽ / лид" value={totals.cost_per_lead > 0 ? `${totals.cost_per_lead.toLocaleString()} ₽` : "—"} icon={DollarSign} delay={0.25} info="Потрачено / Лиды" />
        </div>
      )}

      {dailyReport.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <p className="text-muted-foreground">Нет данных за выбранный период.</p>
        </div>
      ) : (
        <>
          {/* Chart */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-5 mb-6">
            <h3 className="font-semibold mb-4">Воронка по дням</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailyReport}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                <Legend />
                <Bar dataKey="received" name="Получено" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="answered" name="Дозвон" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="leads" name="Лиды" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Table */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {["Дата", "Получено", "Дозвон", "% дозвона", "Лиды", "% конверсии", "Потрачено", "₽/лид", "Ср. длит."].map((h) => (
                      <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dailyReport.map((r, i) => (
                    <motion.tr key={r.date} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} className="border-b border-border/50 hover:bg-muted/30 dark:hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium">{r.date}</td>
                      <td className="px-4 py-3">{r.received.toLocaleString()}</td>
                      <td className="px-4 py-3">{r.answered.toLocaleString()}</td>
                      <td className="px-4 py-3"><RateBadge value={r.answer_rate} /></td>
                      <td className="px-4 py-3 font-semibold">{r.leads}</td>
                      <td className="px-4 py-3"><RateBadge value={r.conversion_rate} thresholds={[5, 15]} /></td>
                      <td className="px-4 py-3">{r.spent > 0 ? `${r.spent.toLocaleString()} ₽` : "—"}</td>
                      <td className="px-4 py-3 font-semibold">{r.cost_per_lead > 0 ? `${r.cost_per_lead.toLocaleString()} ₽` : "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDuration(r.avg_duration)}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}

function RateBadge({ value, thresholds = [20, 50] }: { value: number; thresholds?: [number, number] }) {
  const color =
    value >= thresholds[1]
      ? "bg-success/10 text-success border-success/20"
      : value >= thresholds[0]
      ? "bg-warning/10 text-warning border-warning/20"
      : "bg-destructive/10 text-destructive border-destructive/20";
  return (
    <Badge variant="outline" className={`${color} text-[10px]`}>
      {value}%
    </Badge>
  );
}
