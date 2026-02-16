import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import {
  Phone, PhoneCall, Users, DollarSign, Target, Loader2, Contact, CalendarIcon, TrendingUp, Signal,
} from "lucide-react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart,
} from "recharts";
import { format, subDays, startOfDay, endOfDay, startOfMonth, subMonths } from "date-fns";
import { ru } from "date-fns/locale";
import { KPICard } from "@/components/KPICard";
import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn, isStatusSuccessful } from "@/lib/utils";
import { motion } from "framer-motion";

type DateRange = { from: Date | undefined; to: Date | undefined };

const PRESETS = [
  { label: "Сегодня", range: () => ({ from: startOfDay(new Date()), to: endOfDay(new Date()) }) },
  { label: "Вчера", range: () => ({ from: startOfDay(subDays(new Date(), 1)), to: endOfDay(subDays(new Date(), 1)) }) },
  { label: "7 дней", range: () => ({ from: startOfDay(subDays(new Date(), 6)), to: endOfDay(new Date()) }) },
  { label: "14 дней", range: () => ({ from: startOfDay(subDays(new Date(), 13)), to: endOfDay(new Date()) }) },
  { label: "30 дней", range: () => ({ from: startOfDay(subDays(new Date(), 29)), to: endOfDay(new Date()) }) },
  { label: "Этот месяц", range: () => ({ from: startOfMonth(new Date()), to: endOfDay(new Date()) }) },
  { label: "Прошлый месяц", range: () => {
    const s = startOfMonth(subMonths(new Date(), 1));
    const e = endOfDay(subDays(startOfMonth(new Date()), 1));
    return { from: s, to: e };
  }},
  { label: "Всё время", range: () => ({ from: undefined, to: undefined }) },
] as const;

export default function ProjectDashboard() {
  const { projectId } = useParams();
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [activePreset, setActivePreset] = useState("Всё время");

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      return await api.getProject(projectId!);
    },
    enabled: !!projectId,
  });

  const { data: calls, isLoading } = useQuery({
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
    staleTime: 30000, // Cache for 30 seconds
  });

  // Fetch suppliers once and reuse
  const { data: suppliers } = useQuery({
    queryKey: ["suppliers", projectId],
    queryFn: async () => {
      const response = await api.getSuppliers(projectId!);
      return response.suppliers || [];
    },
    enabled: !!projectId,
    staleTime: 30000, // Cache for 30 seconds
  });

  const { data: supplierNumbers } = useQuery({
    queryKey: ["supplier-numbers", projectId],
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
      // Join with suppliers from cache
      const suppliersMap = new Map((suppliers || []).map((s: any) => [s.id, s]));
      return all.map((n: any) => ({
        ...n,
        suppliers: n.supplier_id ? suppliersMap.get(n.supplier_id) : null,
      }));
    },
    enabled: !!projectId && !!suppliers,
    staleTime: 30000, // Cache for 30 seconds
  });

  const { data: pricing } = useQuery({
    queryKey: ["pricing", projectId],
    queryFn: async () => {
      return await api.getProjectPricing(projectId!);
    },
    enabled: !!projectId,
  });

  // Filter by date range
  const fromTs = dateRange.from?.getTime();
  const toTs = dateRange.to?.getTime();
  const fromDateStr = dateRange.from ? format(dateRange.from, "yyyy-MM-dd") : undefined;
  const toDateStr = dateRange.to ? format(dateRange.to, "yyyy-MM-dd") : undefined;

  // Агрегаты с бэкенда (единственный источник правды — COUNT в БД)
  const { data: apiStats } = useQuery({
    queryKey: ["project-dashboard-stats", projectId, fromDateStr, toDateStr],
    queryFn: async () => api.getProjectDashboardStats(projectId!, { fromDate: fromDateStr, toDate: toDateStr }),
    enabled: !!projectId,
    staleTime: 30000,
  });

  const allCalls = useMemo(() => {
    const raw = calls || [];
    if (!fromTs && !toTs) return raw;
    return raw.filter((c: any) => {
      const t = new Date(c.call_at).getTime();
      if (fromTs && t < fromTs) return false;
      if (toTs && t > toTs) return false;
      return true;
    });
  }, [calls, fromTs, toTs]);

  const allNumbers = useMemo(() => {
    const raw = supplierNumbers || [];
    if (!fromTs && !toTs) return raw;
    return raw.filter((n: any) => {
      const t = new Date(n.received_at || n.created_at).getTime();
      if (fromTs && t < fromTs) return false;
      if (toTs && t > toTs) return false;
      return true;
    });
  }, [supplierNumbers, fromTs, toTs]);

  const hasGck = !!(project as any)?.has_gck;

  // ---- Общие метрики ----
  // Контактов в базе = уникальные номера в supplier_numbers (по CALCULATION_AUDIT)
  // Контактов обработано = уникальные номера, по которым звонили (calledPhones)
  // % дозвона = Дозвонились / Контактов обработано
  const metrics = useMemo(() => {
    const totalContacts = new Set(allNumbers.map((n: any) => n.phone_normalized)).size;
    const totalCalls = allCalls.length;
    const calledPhones = new Set<string>();
    const answeredPhones = new Set<string>();
    const leadPhones = new Set<string>();
    for (const c of allCalls) {
      const phone = c.phone_normalized;
      if (!phone) continue;
      calledPhones.add(phone);
      if (isStatusSuccessful(c.status)) answeredPhones.add(phone);
      if (c.is_lead) leadPhones.add(phone);
    }
    const uniqueCalls = calledPhones.size; // контактов обработано
    const answered = answeredPhones.size;  // дозвонились
    const leads = leadPhones.size;
    const answerRate = uniqueCalls > 0 ? (answered / uniqueCalls) * 100 : 0;
    const totalMinutes = allCalls.reduce((sum: number, c: any) => sum + (c.billed_minutes || Math.ceil((c.duration_seconds || 0) / 60)), 0);
    return { totalContacts, totalCalls, uniqueCalls, answered, answerRate, leads, totalMinutes };
  }, [allCalls, allNumbers]);

  // ---- Финансы ----
  const finance = useMemo(() => {
    // Считаем стоимость по поставщикам (включая ГЦК): число контактов × price_per_contact
    const supplierCounts = new Map<string, number>();
    for (const n of allNumbers) {
      const sid = n.supplier_id;
      if (!sid) continue;
      supplierCounts.set(sid, (supplierCounts.get(sid) || 0) + 1);
    }
    let contactsCost = 0;
    for (const s of suppliers || []) {
      const count = supplierCounts.get(s.id) || 0;
      const ppc = Number((s as any).price_per_contact) || 0;
      contactsCost += count * ppc;
    }
    // Fallback: если у поставщиков нет цены, используем проектную price_per_number
    if (contactsCost === 0 && allNumbers.length > 0) {
      const pricePerNumber = Number((pricing as any)?.price_per_number) || 0;
      contactsCost = allNumbers.length * pricePerNumber;
    }
    const pricePerMinute = Number(pricing?.price_per_minute) || 0;
    const minutesCost = metrics.totalMinutes * pricePerMinute;
    const totalCost = contactsCost + minutesCost;
    const costPerLead = metrics.leads > 0 ? totalCost / metrics.leads : 0;
    return { contactsCost, pricePerMinute, minutesCost, totalCost, costPerLead };
  }, [allNumbers, suppliers, pricing, metrics]);

  // ---- Базы (per supplier) ----
  // Используем сырые номера (без фильтра по дате) для привязки звонков к поставщикам — как на странице «Базы»
  const rawNumbers = supplierNumbers || [];
  const supplierStats = useMemo(() => {
    if (!suppliers || !rawNumbers.length || !allCalls) return [];

    const phoneToSupplier = new Map<string, string>();
    const supplierPhones = new Map<string, Set<string>>();
    for (const sn of rawNumbers) {
      phoneToSupplier.set(sn.phone_normalized, sn.supplier_id);
      if (!supplierPhones.has(sn.supplier_id)) supplierPhones.set(sn.supplier_id, new Set());
      supplierPhones.get(sn.supplier_id)!.add(sn.phone_normalized);
    }

    const bySupplier = new Map<string, {
      calledPhones: Set<string>;
      answeredPhones: Set<string>;
      totalCalls: number;
      leadPhones: Set<string>;
    }>();
    for (const s of suppliers) {
      bySupplier.set(s.id, { calledPhones: new Set(), answeredPhones: new Set(), totalCalls: 0, leadPhones: new Set() });
    }

    for (const c of allCalls) {
      const sid = phoneToSupplier.get(c.phone_normalized);
      if (!sid) continue;
      const entry = bySupplier.get(sid);
      if (!entry) continue;
      entry.calledPhones.add(c.phone_normalized);
      entry.totalCalls++;
      if (isStatusSuccessful(c.status)) entry.answeredPhones.add(c.phone_normalized);
      if (c.is_lead) entry.leadPhones.add(c.phone_normalized);
    }

    return suppliers.map((s) => {
      const received = supplierPhones.get(s.id)?.size || 0;
      const d = bySupplier.get(s.id)!;
      const called = d.calledPhones.size;
      const answeredUnique = d.answeredPhones.size;
      const lds = d.leadPhones.size;
      return {
        name: s.name || s.tag || "—",
        isGck: !!(s as any).is_gck,
        received,
        called,
        answered: answeredUnique,
        callRate: received > 0 ? +((called / received) * 100).toFixed(1) : 0,
        answerRate: called > 0 ? +((answeredUnique / called) * 100).toFixed(1) : 0,
        convRate: answeredUnique > 0 ? +((lds / answeredUnique) * 100).toFixed(1) : 0,
        leads: lds,
      };
    }).sort((a, b) => b.received - a.received);
  }, [suppliers, rawNumbers, allCalls]);

  // ---- ГЦК aggregate ----
  const gckStats = useMemo(() => {
    if (!hasGck) return null;
    
    // Filter only GCK suppliers and their numbers/calls
    const gckSupplierIds = new Set(
      (suppliers || []).filter((s: any) => s.is_gck === true).map((s: any) => s.id)
    );
    
    if (gckSupplierIds.size === 0) return null;
    
    // Filter numbers by GCK suppliers
    const gckNumbers = allNumbers.filter((n: any) => gckSupplierIds.has(n.supplier_id));
    const gckCalls = allCalls.filter((c: any) => {
      // Check if call phone belongs to GCK supplier
      const number = gckNumbers.find((n: any) => n.phone_normalized === c.phone_normalized);
      return !!number;
    });
    
    if (!gckNumbers.length && !gckCalls.length) return null;
    
    const receivedPhones = new Set(gckNumbers.map((n: any) => n.phone_normalized));
    const calledPhones = new Set(gckCalls.map((c: any) => c.phone_normalized));
    const answeredPhones = new Set<string>();
    const leadPhones = new Set<string>();
    for (const c of gckCalls) {
      if (isStatusSuccessful(c.status)) answeredPhones.add(c.phone_normalized);
      if (c.is_lead) leadPhones.add(c.phone_normalized);
    }
    const received = receivedPhones.size;
    const called = calledPhones.size;
    const ansUnique = answeredPhones.size;
    const lds = leadPhones.size;
    return {
      received,
      called,
      callRate: received > 0 ? +((called / received) * 100).toFixed(1) : 0,
      answerRate: called > 0 ? +((ansUnique / called) * 100).toFixed(1) : 0,
      convRate: ansUnique > 0 ? +((lds / ansUnique) * 100).toFixed(1) : 0,
      leads: lds,
    };
  }, [hasGck, suppliers, allNumbers, allCalls]);

  // ---- Daily trend data ----
  const dailyData = useMemo(() => {
    if (!allCalls.length) return [];
    const byDay = new Map<string, { calledPhones: Set<string>; answeredPhones: Set<string>; leadPhones: Set<string> }>();
    for (const c of allCalls) {
      const day = c.call_at?.slice(0, 10);
      if (!day) continue;
      if (!byDay.has(day)) byDay.set(day, { calledPhones: new Set(), answeredPhones: new Set(), leadPhones: new Set() });
      const e = byDay.get(day)!;
      e.calledPhones.add(c.phone_normalized);
      if (isStatusSuccessful(c.status)) e.answeredPhones.add(c.phone_normalized);
      if (c.is_lead) e.leadPhones.add(c.phone_normalized);
    }
    return [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, d]) => ({
        date: format(new Date(day), "dd.MM", { locale: ru }),
        calls: d.calledPhones.size,
        leads: d.leadPhones.size,
        answerRate: d.calledPhones.size > 0 ? +((d.answeredPhones.size / d.calledPhones.size) * 100).toFixed(1) : 0,
      }));
  }, [allCalls]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{project?.name || "Дашборд"}</h1>
          <p className="text-muted-foreground mt-1">{project?.description}</p>
        </div>

        {/* Date filter */}
        <div className="flex flex-wrap items-center gap-1.5">
          {PRESETS.map((p) => (
            <Button
              key={p.label}
              variant={activePreset === p.label ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs px-2.5"
              onClick={() => {
                const r = p.range();
                setDateRange(r);
                setActivePreset(p.label);
              }}
            >
              {p.label}
            </Button>
          ))}

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("h-7 text-xs px-2.5 gap-1", (dateRange.from || dateRange.to) && "border-primary text-primary")}>
                <CalendarIcon className="h-3 w-3" />
                {dateRange.from && dateRange.to
                  ? `${format(dateRange.from, "dd.MM.yy", { locale: ru })} – ${format(dateRange.to, "dd.MM.yy", { locale: ru })}`
                  : dateRange.from
                    ? `${format(dateRange.from, "dd.MM.yy", { locale: ru })} – ...`
                    : "Период"}
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
                  setActivePreset("");
                }}
                numberOfMonths={2}
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* ===== ОБЩЕЕ ===== */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Общее</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
          {(() => {
            const processed = apiStats?.uniqueCalls ?? metrics.uniqueCalls;
            const answeredVal = apiStats?.answered ?? metrics.answered;
            const answerRateDerived = processed > 0 ? +((answeredVal / processed) * 100).toFixed(1) : 0;
            return (
              <>
                <KPICard title="Контактов обработано" value={processed.toLocaleString()} icon={Phone} delay={0} info="Количество уникальных номеров в звонках" />
                <KPICard title="Дозвонились" value={answeredVal.toLocaleString()} icon={PhoneCall} delay={0.05} info="Уникальные номера со статусом «Успешный»" />
                <KPICard title="Лиды" value={(apiStats?.leads ?? metrics.leads).toLocaleString()} icon={Users} delay={0.1} info="Количество звонков, отмеченных как лид" valueClassName="text-success" />
                <KPICard title="% дозвона" value={`${answerRateDerived}%`} icon={Signal} delay={0.15} info="Дозвонились / Контактов обработано × 100%" />
              </>
            );
          })()}
        </div>

        {/* Daily trend chart */}
        {dailyData.length > 1 && (
          <div className="glass-card rounded-xl p-4 mt-4 mb-6">
            <p className="text-xs font-medium text-muted-foreground mb-3">Динамика по дням</p>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={11} unit="%" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(value: number, name: string) => {
                    if (name === "% дозвона") return [`${value}%`, name];
                    return [value.toLocaleString(), name];
                  }}
                />
                <Bar yAxisId="left" dataKey="calls" name="Контактов" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="left" dataKey="leads" name="Лиды" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="answerRate" name="% дозвона" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={{ r: 2 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </motion.div>

      {/* ===== ФИНАНСЫ ===== */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="rounded-xl border border-primary/20 bg-primary/[0.03] p-4 mb-6"
      >
        <p className="text-[11px] font-semibold text-primary/70 uppercase tracking-wider mb-3">Финансы</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <KPICard title="Стоимость контактов" value={finance.contactsCost > 0 ? finance.contactsCost.toLocaleString() : "—"} icon={DollarSign} delay={0.15} info="Сумма стоимости контакта по каждому поставщику" />
          <KPICard title="Стоимость минут" value={finance.minutesCost > 0 ? finance.minutesCost.toLocaleString() : "—"} icon={DollarSign} delay={0.2} info="Минуты × Цена за минуту" />
          <KPICard title="Общая стоимость" value={finance.totalCost > 0 ? finance.totalCost.toLocaleString() : "—"} icon={DollarSign} delay={0.25} info="Стоимость контактов + Стоимость минут" />
          <KPICard title="CPL" value={finance.costPerLead > 0 ? finance.costPerLead.toFixed(0) : "—"} icon={Target} delay={0.3} info="Cost Per Lead = Общая стоимость / Лиды" />
        </div>
      </motion.div>

      {/* ===== БАЗЫ ===== */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="mb-6"
      >
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Базы</p>
        {supplierStats.length === 0 ? (
          <div className="glass-card rounded-xl p-8 text-center">
            <p className="text-sm text-muted-foreground">Нет данных. Импортируйте номера.</p>
          </div>
        ) : (
          <div className="glass-card rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap min-w-[140px]">База</th>
                    {["Контакты", "Прозвонили", "Дозвонились", "% прозвонили", "% дозвонились", "% в лид", "Лиды"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {supplierStats.map((r, i) => (
                    <motion.tr
                      key={r.name}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 + i * 0.03 }}
                      className="border-b border-border/50 hover:bg-muted/30 dark:hover:bg-muted/20 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium min-w-[140px]">
                        <span className="inline-flex items-center gap-2 whitespace-nowrap">
                          {(r as any).isGck && (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-chart-2/40 text-chart-2 bg-chart-2/10 shrink-0">
                              ГЦК
                            </Badge>
                          )}
                          <span>{r.name}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3">{r.received.toLocaleString()}</td>
                      <td className="px-4 py-3">{r.called.toLocaleString()}</td>
                      <td className="px-4 py-3">{r.answered.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <RateBadge value={r.callRate} thresholds={[30, 70]} />
                      </td>
                      <td className="px-4 py-3">
                        <RateBadge value={r.answerRate} />
                      </td>
                      <td className="px-4 py-3">
                        <RateBadge value={r.convRate} thresholds={[5, 15]} />
                      </td>
                      <td className="px-4 py-3 font-semibold">{r.leads}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bases comparison chart */}
            {supplierStats.length > 1 && (
              <div className="p-4 border-t border-border">
                <p className="text-xs font-medium text-muted-foreground mb-3">Конверсия по базам</p>
                <ResponsiveContainer width="100%" height={Math.max(180, supplierStats.length * 40)}>
                  <BarChart data={supplierStats} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" unit="%" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      width={180}
                      tickMargin={8}
                      tick={(props: any) => {
                        const { x, y, payload } = props;
                        const value = payload?.value ?? payload;
                        const item = supplierStats.find((s) => s.name === value);
                        const displayName = typeof value === "string" && value.length > 20 ? value.slice(0, 17) + "…" : value;
                        return (
                          <g transform={`translate(${x},${y})`}>
                            <text x={0} y={4} textAnchor="end" fill="hsl(var(--muted-foreground))" fontSize={11}>
                              {item?.isGck ? (
                                <>
                                  <tspan fill="hsl(var(--chart-2))" fontWeight={600}>ГЦК </tspan>
                                  <tspan>{displayName}</tspan>
                                </>
                              ) : (
                                displayName
                              )}
                            </text>
                          </g>
                        );
                      }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                      formatter={(value: number, name: string) => [`${value}%`, name]}
                    />
                    <Bar dataKey="answerRate" name="% дозвонились" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="convRate" name="% в лид" fill="hsl(var(--chart-4))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* ===== ГЦК ===== */}
      {hasGck && gckStats && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.45 }}
          className="rounded-xl border border-chart-2/20 bg-chart-2/[0.03] p-4"
        >
          <p className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: "hsl(var(--chart-2))" }}>ГЦК</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            <KPICard title="Получено номеров" value={gckStats.received.toLocaleString()} icon={Contact} delay={0.45} info="Уникальные номера от поставщиков" />
            <KPICard title="Прозвонено" value={gckStats.called.toLocaleString()} icon={PhoneCall} delay={0.5} info="Уникальные номера, по которым был звонок" />
            <KPICard title="% прозвона" value={`${gckStats.callRate}%`} icon={TrendingUp} delay={0.55} info="Прозвонено / Получено × 100%" />
            <KPICard title="% конв. в звонок" value={`${gckStats.answerRate}%`} icon={Signal} delay={0.6} info="Дозвонились / Прозвонено × 100%" />
            <KPICard title="% конв. в лид" value={`${gckStats.convRate}%`} icon={Target} delay={0.65} info="Лиды / Дозвонились × 100%" />
            <KPICard title="Лиды" value={gckStats.leads.toLocaleString()} icon={Users} delay={0.7} info="Уникальные номера, отмеченные как лид" />
          </div>
        </motion.div>
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
