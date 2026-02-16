import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, CalendarIcon, Phone, Target, PhoneCall, TrendingUp, Users, DollarSign, ShieldCheck } from "lucide-react";
import { KPICard } from "@/components/KPICard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
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

export default function ProjectSuppliersGCK() {
  const { projectId } = useParams();
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [selectedSupplier, setSelectedSupplier] = useState("all");

  // Fetch suppliers - все поставщики (Базы = все базы)
  const { data: suppliers } = useQuery({
    queryKey: ["suppliers-base", projectId],
    queryFn: async () => {
      const response = await api.getSuppliers(projectId!);
      return response.suppliers || [];
    },
    enabled: !!projectId,
    staleTime: 30000, // Cache for 30 seconds
  });

  // Fetch supplier numbers (paginated) - все номера
  const { data: supplierNumbers } = useQuery({
    queryKey: ["supplier-numbers-base", projectId],
    queryFn: async () => {
      const all: any[] = [];
      let page = 1;
      const pageSize = 1000;
      while (true) {
        const response = await api.getSupplierNumbers(projectId!, { page, pageSize });
        if (!response.numbers || response.numbers.length === 0) break;
        all.push(...response.numbers);
        if (response.numbers.length < pageSize || all.length >= response.total) break;
        page++;
      }
      return all;
    },
    enabled: !!projectId,
    staleTime: 30000, // Cache for 30 seconds
  });

  // Fetch calls (paginated) - все звонки
  const { data: calls, isLoading } = useQuery({
    queryKey: ["calls-for-base", projectId],
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
    staleTime: 30000, // Cache for 30 seconds
  });

  // No longer need project-level pricing - using per-supplier pricing

  const report = useMemo(() => {
    if (!suppliers || !supplierNumbers || !calls) return [];

    // Build supplier id -> { name, price_per_contact } map
    const supplierIdToInfo = new Map<string, { name: string; ppc: number }>();

    // Filter suppliers if one is selected
    const filteredSuppliers = selectedSupplier === "all"
      ? suppliers
      : suppliers.filter((s) => s.id === selectedSupplier);

    for (const s of filteredSuppliers) {
      supplierIdToInfo.set(s.id, { name: s.name || s.tag || "Без имени", ppc: (s as any).price_per_contact ?? 0 });
    }

    // Map phone_normalized -> supplier_id
    const phoneToSupplierId = new Map<string, string>();
    const supplierPhones = new Map<string, Set<string>>();

    for (const sn of supplierNumbers) {
      if (!supplierIdToInfo.has(sn.supplier_id)) continue;
      phoneToSupplierId.set(sn.phone_normalized, sn.supplier_id);
      if (!supplierPhones.has(sn.supplier_id)) supplierPhones.set(sn.supplier_id, new Set());
      supplierPhones.get(sn.supplier_id)!.add(sn.phone_normalized);
    }

    // Initialize stats for filtered suppliers
    const bySupplier = new Map<string, {
      calledPhones: Set<string>;
      leadPhones: Set<string>;
      totalCalls: number;
      answeredCalls: number;
      totalDuration: number;
    }>();

    for (const s of filteredSuppliers) {
      bySupplier.set(s.id, {
        calledPhones: new Set(),
        leadPhones: new Set(),
        totalCalls: 0,
        answeredCalls: 0,
        totalDuration: 0,
      });
    }

    // Aggregate calls
    for (const c of calls) {
    if (dateRange.from || dateRange.to) {
        const date = c.call_at?.slice(0, 10);
        if (dateRange.from && date && date < format(dateRange.from, "yyyy-MM-dd")) continue;
        if (dateRange.to && date && date > format(dateRange.to, "yyyy-MM-dd")) continue;
      }

      const supplierId = phoneToSupplierId.get(c.phone_normalized);
      if (!supplierId) continue;

      const entry = bySupplier.get(supplierId);
      if (!entry) continue;

      entry.totalCalls++;
      entry.calledPhones.add(c.phone_normalized);

      if (isStatusSuccessful(c.status)) {
        entry.answeredCalls++;
      }
      if (c.is_lead) {
        entry.leadPhones.add(c.phone_normalized);
      }
      entry.totalDuration += c.duration_seconds || 0;
    }

    return [...bySupplier.entries()]
      .map(([supplierId, d]) => {
        const received = supplierPhones.get(supplierId)?.size || 0;
        const called = d.calledPhones.size;
        const answered = d.answeredCalls;
        const leads = d.leadPhones.size;
        const info = supplierIdToInfo.get(supplierId);
        const ppc = info?.ppc ?? 0;

        const callRate = received > 0 ? +((called / received) * 100).toFixed(1) : 0;
        const answerRate = d.totalCalls > 0 ? +((answered / d.totalCalls) * 100).toFixed(1) : 0;
        const conversionRate = answered > 0 ? +((leads / answered) * 100).toFixed(1) : 0;
        const avgDuration = d.answeredCalls > 0 ? Math.round(d.totalDuration / d.answeredCalls) : 0;

        const spent = received * ppc;
        const costPerLead = leads > 0 ? Math.round(spent / leads) : 0;

        return {
          supplierName: info?.name || "—",
          isGck: (filteredSuppliers.find(s => s.id === supplierId) as any)?.is_gck ?? false,
          received,
          called,
          answered,
          leads,
          call_rate: callRate,
          answer_rate: answerRate,
          conversion_rate: conversionRate,
          avg_duration: avgDuration,
          spent,
          cost_per_lead: costPerLead,
        };
      })
      .sort((a, b) => b.received - a.received);
  }, [suppliers, supplierNumbers, calls, dateRange, selectedSupplier]);

  const totals = useMemo(() => {
    if (report.length === 0) return null;
    let received = 0, called = 0, answered = 0, leads = 0, totalSpent = 0;
    for (const r of report) {
      received += r.received;
      called += r.called;
      answered += r.answered;
      leads += r.leads;
      totalSpent += r.spent;
    }
    return {
      received, called, answered, leads,
      call_rate: received > 0 ? +((called / received) * 100).toFixed(1) : 0,
      answer_rate: called > 0 ? +((answered / called) * 100).toFixed(1) : 0,
      conversion_rate: answered > 0 ? +((leads / answered) * 100).toFixed(1) : 0,
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
          <h1 className="text-3xl font-bold tracking-tight">Базы</h1>
          <p className="text-muted-foreground mt-1">Анализ результативности баз номеров</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Все поставщики" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все поставщики</SelectItem>
            {suppliers?.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
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
      </div>
          {/* Summary cards */}
          {totals && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
              <KPICard title="Получено номеров" value={totals.received.toLocaleString()} icon={Users} delay={0} info="Общее количество номеров, загруженных от поставщиков" />
              <KPICard title="Прозвонено" value={`${totals.called.toLocaleString()} (${totals.call_rate}%)`} icon={Phone} delay={0.05} info="Уникальные номера, по которым был хотя бы один звонок" />
              <KPICard title="Дозвон" value={`${totals.answered.toLocaleString()} (${totals.answer_rate}%)`} icon={PhoneCall} delay={0.1} info="Номера со статусом «Успешный» / Прозвонено × 100%" />
              <KPICard title="Лиды" value={totals.leads.toLocaleString()} icon={Target} delay={0.15} info="Уникальные номера, отмеченные как лид" />
              <KPICard title="Конверсия в лид" value={`${totals.conversion_rate}%`} icon={TrendingUp} delay={0.2} info="Лиды / Дозвонились × 100%" />
              <KPICard title="Потрачено" value={totals.spent > 0 ? `${totals.spent.toLocaleString()} ₽` : "—"} icon={DollarSign} delay={0.25} info="Получено номеров × Стоимость контакта" />
              <KPICard title="₽ / лид" value={totals.cost_per_lead > 0 ? `${totals.cost_per_lead.toLocaleString()} ₽` : "—"} icon={DollarSign} delay={0.3} info="Потрачено / Лиды" />
            </div>
          )}

          {report.length === 0 ? (
            <div className="glass-card rounded-xl p-12 text-center">
              <p className="text-muted-foreground">Нет данных. Импортируйте номера поставщиков.</p>
            </div>
          ) : (
            <>
              {/* Chart */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-5 mb-6">
                <h3 className="font-semibold mb-4">Воронка по поставщикам</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={report}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="supplierName" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                    <Legend />
                    <Bar dataKey="received" name="Получено" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="called" name="Прозвонено" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
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
                        {["Поставщик", "Получено", "Прозвонено", "% прозвона", "Дозвон", "% дозвона", "Лиды", "% конверсии", "Потрачено", "₽/лид", "Ср. длит."].map((h) => (
                          <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {report.map((r, i) => (
                        <motion.tr
                          key={r.supplierName}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.03 }}
                          className="border-b border-border/50 hover:bg-muted/30 dark:hover:bg-muted/20 transition-colors"
                        >
                          <td className="px-4 py-3 font-medium flex items-center gap-2">
                            {r.supplierName}
                            {r.isGck && (
                              <Badge variant="outline" className="text-[9px] bg-primary/10 text-primary border-primary/20">ГЦК</Badge>
                            )}
                          </td>
                          <td className="px-4 py-3">{r.received.toLocaleString()}</td>
                          <td className="px-4 py-3">{r.called.toLocaleString()}</td>
                          <td className="px-4 py-3">
                            <RateBadge value={r.call_rate} thresholds={[30, 70]} />
                          </td>
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
