import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, CalendarIcon, Phone, Target, PhoneCall, TrendingUp, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KPICard } from "@/components/KPICard";
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

export default function ProjectSuppliers() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});

  const { data: calls, isLoading } = useQuery({
    queryKey: ["calls-for-suppliers", projectId],
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

  const { data: pricing } = useQuery({
    queryKey: ["pricing", projectId],
    queryFn: async () => {
      return await api.getProjectPricing(projectId!);
    },
    enabled: !!projectId,
  });

  const report = useMemo(() => {
    const allCalls = calls || [];
    const ppc = (pricing as any)?.price_per_contact ?? 0;

    // Group calls by call_list
    const byList = new Map<string, {
      calledPhones: Set<string>;
      answeredPhones: Set<string>;
      leadPhones: Set<string>;
      totalCalls: number;
      answeredCalls: number;
      totalDuration: number;
    }>();

    for (const c of allCalls) {
      const date = c.call_at?.slice(0, 10);
      if (dateRange.from && date && date < format(dateRange.from, "yyyy-MM-dd")) continue;
      if (dateRange.to && date && date > format(dateRange.to, "yyyy-MM-dd")) continue;

      const listName = c.call_list?.trim() || "Без колл-листа";

      if (!byList.has(listName)) {
        byList.set(listName, {
          calledPhones: new Set(),
          answeredPhones: new Set(),
          leadPhones: new Set(),
          totalCalls: 0,
          answeredCalls: 0,
          totalDuration: 0,
        });
      }
      const entry = byList.get(listName)!;

      entry.totalCalls++;
      entry.calledPhones.add(c.phone_normalized);

      const isAnswered = isStatusSuccessful(c.status);
      if (isAnswered) {
        entry.answeredCalls++;
        entry.answeredPhones.add(c.phone_normalized);
      }

      if (c.is_lead) {
        entry.leadPhones.add(c.phone_normalized);
      }

      entry.totalDuration += c.duration_seconds || 0;
    }

    return [...byList.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([listName, d]) => {
        const received = d.calledPhones.size;
        const answered = d.answeredPhones.size;
        const leads = d.leadPhones.size;

        const answerRate = received > 0 ? +((answered / received) * 100).toFixed(1) : 0;
        const conversionRate = answered > 0 ? +((leads / answered) * 100).toFixed(1) : 0;
        const avgDuration = d.answeredCalls > 0 ? Math.round(d.totalDuration / d.answeredCalls) : 0;

        const spent = received * ppc;
        const costPerLead = leads > 0 ? Math.round(spent / leads) : 0;

        return {
          callList: listName,
          received,
          answered,
          leads,
          answer_rate: answerRate,
          conversion_rate: conversionRate,
          total_calls: d.totalCalls,
          avg_duration: avgDuration,
          spent,
          cost_per_lead: costPerLead,
        };
      });
  }, [calls, dateRange, pricing]);

  // Totals
  const totals = useMemo(() => {
    if (report.length === 0) return null;

    let received = 0, answered = 0, leads = 0, totalCalls = 0, totalSpent = 0;
    for (const r of report) {
      received += r.received;
      answered += r.answered;
      leads += r.leads;
      totalCalls += r.total_calls;
      totalSpent += r.spent;
    }

    return {
      received,
      answered,
      leads,
      answer_rate: received > 0 ? +((answered / received) * 100).toFixed(1) : 0,
      conversion_rate: answered > 0 ? +((leads / answered) * 100).toFixed(1) : 0,
      total_calls: totalCalls,
      spent: totalSpent,
      cost_per_lead: leads > 0 ? Math.round(totalSpent / leads) : 0,
    };
  }, [report]);

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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Колл-листы</h1>
          <p className="text-muted-foreground mt-1">Сравнение эффективности колл-листов</p>
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
          <KPICard title="Получено номеров" value={totals.received.toLocaleString()} icon={Phone} delay={0} info="Количество уникальных номеров, по которым были звонки" />
          <KPICard title="Дозвон" value={`${totals.answered.toLocaleString()} (${totals.answer_rate}%)`} icon={PhoneCall} delay={0.05} info="Номера со статусом «Успешный»" />
          <KPICard title="Лиды" value={totals.leads.toLocaleString()} icon={Target} delay={0.1} info="Уникальные номера, отмеченные как лид" />
          <KPICard title="Конверсия в лид" value={`${totals.conversion_rate}%`} icon={TrendingUp} delay={0.15} info="Лиды / Дозвонились × 100%" />
          <KPICard title="Потрачено" value={totals.spent > 0 ? `${totals.spent.toLocaleString()} ₽` : "—"} icon={DollarSign} delay={0.2} info="Получено номеров × Стоимость контакта (ГЦК)" />
          <KPICard title="₽ / лид" value={totals.cost_per_lead > 0 ? `${totals.cost_per_lead.toLocaleString()} ₽` : "—"} icon={DollarSign} delay={0.25} info="Потрачено / Лиды" />
        </div>
      )}

      {report.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <p className="text-muted-foreground">Нет данных. Импортируйте звонки.</p>
        </div>
      ) : (
        <>
          {/* Chart */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-5 mb-6">
            <h3 className="font-semibold mb-4">Воронка по колл-листам</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={report}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="callList" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                <Legend />
                <Bar dataKey="received" name="Получено" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="answered" name="Дозвон" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="leads" name="Лиды" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Comparison chart: answer rate & conversion */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card rounded-xl p-5 mb-6">
            <h3 className="font-semibold mb-4">Сравнение: % дозвона и % конверсии</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={report}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="callList" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} unit="%" />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} formatter={(value: number) => `${value}%`} />
                <Legend />
                <Bar dataKey="answer_rate" name="% дозвона" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="conversion_rate" name="% конверсии" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Table */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {["Колл-лист", "Получено", "Дозвон", "% дозвона", "Лиды", "% конверсии", "Потрачено", "₽/лид", "Ср. длит."].map((h) => (
                      <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.map((r, i) => {
                    const encodedName = r.callList === "Без колл-листа" ? "__none__" : encodeURIComponent(r.callList);
                    return (
                    <motion.tr
                      key={r.callList}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className="border-b border-border/50 hover:bg-muted/30 dark:hover:bg-muted/20 transition-colors cursor-pointer"
                      onClick={() => navigate(`/projects/${projectId}/reports/call-lists/${encodedName}`)}
                    >
                      <td className="px-4 py-3 font-medium text-primary underline-offset-4 hover:underline">{r.callList}</td>
                      <td className="px-4 py-3">{r.received.toLocaleString()}</td>
                      <td className="px-4 py-3">{r.answered.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <RateBadge value={r.answer_rate} />
                      </td>
                      <td className="px-4 py-3 font-semibold">{r.leads}</td>
                      <td className="px-4 py-3">
                        <RateBadge value={r.conversion_rate} thresholds={[5, 15]} />
                      </td>
                      <td className="px-4 py-3">{r.spent > 0 ? `${r.spent.toLocaleString()} ₽` : "—"}</td>
                      <td className="px-4 py-3 font-semibold">{r.cost_per_lead > 0 ? `${r.cost_per_lead.toLocaleString()} ₽` : "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDuration(r.avg_duration)}</td>
                    </motion.tr>
                    );
                  })}
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
