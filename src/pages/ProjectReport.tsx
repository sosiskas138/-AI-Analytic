import { useMemo, useCallback, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, Download, FileSpreadsheet, CalendarIcon } from "lucide-react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { format, startOfDay, endOfDay } from "date-fns";
import { ru } from "date-fns/locale";
import * as XLSX from "xlsx";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { isStatusSuccessful } from "@/lib/utils";

interface ReportRow {
  phone: string;
  isLead: boolean;
}

export default function ProjectReport() {
  const { projectId } = useParams();
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});

  // Check if there are GCK suppliers (for empty state hint)
  const { data: gckSuppliers } = useQuery({
    queryKey: ["suppliers-gck-check", projectId],
    queryFn: async () => {
      const r = await api.getSuppliers(projectId!, { isGck: true });
      return r.suppliers || [];
    },
    enabled: !!projectId,
  });

  // Fetch calls (paginated) - only GCK calls
  const { data: calls, isLoading: callsLoading } = useQuery({
    queryKey: ["calls-report-gck", projectId],
    queryFn: async () => {
      const all: any[] = [];
      let page = 1;
      const pageSize = 1000;
      while (true) {
        const response = await api.getCalls(projectId!, { page, pageSize, isGck: true });
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

  // Fetch supplier numbers (for "received contacts per day") - only GCK suppliers
  const { data: supplierNumbers, isLoading: numbersLoading } = useQuery({
    queryKey: ["supplier-numbers-report-gck", projectId],
    queryFn: async () => {
      const all: any[] = [];
      let page = 1;
      const pageSize = 1000;
      while (true) {
        const response = await api.getSupplierNumbers(projectId!, { page, pageSize, isGck: true });
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

  const isLoading = callsLoading || numbersLoading;

  // Filter calls by date range
  const filteredCalls = useMemo(() => {
    if (!calls) return [];
    return calls.filter((c: any) => {
      if (!dateRange.from && !dateRange.to) return true;
      const date = c.call_at?.slice(0, 10);
      if (dateRange.from && date && date < format(dateRange.from, "yyyy-MM-dd")) return false;
      if (dateRange.to && date && date > format(dateRange.to, "yyyy-MM-dd")) return false;
      return true;
    });
  }, [calls, dateRange]);

  // GCK table rows
  const rows = useMemo(() => {
    if (!filteredCalls) return [];
    const phoneMap = new Map<string, ReportRow>();
    filteredCalls.forEach((c: any) => {
      const existing = phoneMap.get(c.phone_normalized);
      if (!existing) {
        phoneMap.set(c.phone_normalized, { phone: c.phone_raw || c.phone_normalized, isLead: c.is_lead });
      } else if (c.is_lead) {
        existing.isLead = true;
      }
    });
    return [...phoneMap.values()];
  }, [filteredCalls]);

  // Build set of all received phones for intersection
  const receivedPhonesSet = useMemo(() => {
    if (!supplierNumbers) return new Set<string>();
    return new Set(supplierNumbers.map((sn: any) => sn.phone_normalized));
  }, [supplierNumbers]);

  // Analytics: daily chart data
  const dailyData = useMemo(() => {
    if (!filteredCalls || !supplierNumbers) return [];

    // Group supplier numbers by day (with date filter)
    const contactsByDay = new Map<string, Set<string>>();
    for (const sn of supplierNumbers) {
      const day = (sn.received_at || sn.created_at)?.slice(0, 10);
      if (!day) continue;
      if (dateRange.from && day < format(dateRange.from, "yyyy-MM-dd")) continue;
      if (dateRange.to && day > format(dateRange.to, "yyyy-MM-dd")) continue;
      if (!contactsByDay.has(day)) contactsByDay.set(day, new Set());
      contactsByDay.get(day)!.add(sn.phone_normalized);
    }

    // Group calls by day — only count phones that exist in received set
    const callsByDay = new Map<string, { totalCalls: number; answeredCalls: number; calledPhones: Set<string>; leadPhones: Set<string> }>();
    for (const c of filteredCalls) {
      if (!receivedPhonesSet.has(c.phone_normalized)) continue;
      const day = c.call_at?.slice(0, 10);
      if (!day) continue;
      if (!callsByDay.has(day)) {
        callsByDay.set(day, { totalCalls: 0, answeredCalls: 0, calledPhones: new Set(), leadPhones: new Set() });
      }
      const entry = callsByDay.get(day)!;
      entry.totalCalls++;
      entry.calledPhones.add(c.phone_normalized);
      if (isStatusSuccessful(c.status)) entry.answeredCalls++;
      if (c.is_lead) entry.leadPhones.add(c.phone_normalized);
    }

    const allDays = new Set([...contactsByDay.keys(), ...callsByDay.keys()]);
    const sorted = [...allDays].sort();

    return sorted.map((day) => {
      const contacts = contactsByDay.get(day)?.size || 0;
      const cd = callsByDay.get(day);
      const totalCalls = cd?.totalCalls || 0;
      const answered = cd?.answeredCalls || 0;
      const leads = cd?.leadPhones.size || 0;

      const answerRate = totalCalls > 0 ? +((answered / totalCalls) * 100).toFixed(1) : 0;
      const convCall = contacts > 0 ? +(((cd?.calledPhones.size || 0) / contacts) * 100).toFixed(1) : 0;
      const convLead = answered > 0 ? +((leads / answered) * 100).toFixed(1) : 0;

      return {
        date: format(new Date(day), "dd.MM", { locale: ru }),
        contacts,
        calls: totalCalls,
        answered,
        answerRate,
        convCall,
        convLead,
      };
    });
  }, [filteredCalls, supplierNumbers, dateRange, receivedPhonesSet]);

  const exportXLSX = useCallback(() => {
    const wsData = rows.map((r) => ({
      "Номер": r.phone,
      "Лид": r.isLead ? "Да" : "Нет",
    }));
    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ГЦК");
    XLSX.writeFile(wb, `gck_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }, [rows]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">ГЦК</h1>
          <p className="text-muted-foreground mt-1">Номера, лиды и аналитика</p>
        </div>
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
          {(dateRange.from || dateRange.to) && (
            <Button variant="ghost" size="sm" onClick={() => setDateRange({})}>
              Сбросить
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="analytics" className="space-y-6">
        <TabsList>
          <TabsTrigger value="analytics">Аналитика ГЦК</TabsTrigger>
          <TabsTrigger value="table">Таблица номеров</TabsTrigger>
        </TabsList>

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          {dailyData.length === 0 ? (
            <div className="glass-card rounded-xl p-12 text-center">
              <FileSpreadsheet className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-semibold mb-1">Нет данных ГЦК</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                {(!gckSuppliers || gckSuppliers.length === 0)
                  ? "Создайте поставщика и отметьте его как ГЦК в Администрирование → Поставщики. Затем импортируйте номера через Импорт → Базы ГЦК."
                  : "Импортируйте номера через Импорт → Базы ГЦК (выберите базу ГЦК), затем импортируйте звонки."}
              </p>
            </div>
          ) : (
             <div className="space-y-6">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-5">
                <h3 className="font-semibold mb-4">Динамика по дням</h3>
                <ResponsiveContainer width="100%" height={420}>
                  <ComposedChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={12} unit="%" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                      formatter={(value: number, name: string) => {
                        if (name.includes("%")) return [`${value}%`, name];
                        return [value.toLocaleString(), name];
                      }}
                    />
                    <Legend />
                    <Bar yAxisId="left" dataKey="contacts" name="Получено контактов" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="left" dataKey="calls" name="Кол-во звонков" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="answerRate" name="% дозвона" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={{ r: 3 }} />
                    <Line yAxisId="right" type="monotone" dataKey="convLead" name="Конверсия в ЛИД %" stroke="hsl(var(--chart-5))" strokeWidth={2} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </motion.div>

              {/* KPI summary */}
              {(() => {
                const totContacts = dailyData.reduce((s, d) => s + d.contacts, 0);
                const totAnswered = filteredCalls
                  ? filteredCalls.filter((c: any) => isStatusSuccessful(c.status) && receivedPhonesSet.has(c.phone_normalized)).length
                  : 0;
                const totLeads = filteredCalls
                  ? new Set(filteredCalls.filter((c: any) => c.is_lead && receivedPhonesSet.has(c.phone_normalized)).map((c: any) => c.phone_normalized)).size
                  : 0;
                const pctAnswered = totContacts > 0 ? ((totAnswered / totContacts) * 100).toFixed(1) : "0";
                const pctLead = totAnswered > 0 ? ((totLeads / totAnswered) * 100).toFixed(1) : "0";
                return (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-3 gap-3 sm:gap-4">
                    <div className="glass-card rounded-xl p-5 text-center">
                      <p className="text-sm font-medium text-muted-foreground mb-2">Получено контактов</p>
                      <p className="text-2xl font-bold">{totContacts.toLocaleString()}</p>
                    </div>
                    <div className="glass-card rounded-xl p-5 text-center">
                      <p className="text-sm font-medium text-muted-foreground mb-2">Дозвонились</p>
                      <p className="text-2xl font-bold">{pctAnswered}%</p>
                      <p className="text-xs text-muted-foreground mt-1">{totAnswered.toLocaleString()} из {totContacts.toLocaleString()}</p>
                    </div>
                    <div className="glass-card rounded-xl p-5 text-center">
                      <p className="text-sm font-medium text-muted-foreground mb-2">Конверсия в лид</p>
                      <p className="text-2xl font-bold">{pctLead}%</p>
                      <p className="text-xs text-muted-foreground mt-1">{totLeads.toLocaleString()} из {totAnswered.toLocaleString()}</p>
                    </div>
                  </motion.div>
                );
              })()}
            </div>
          )}
        </TabsContent>

        {/* Table Tab */}
        <TabsContent value="table">
          <div className="flex justify-end mb-4">
            <Button onClick={exportXLSX} className="gap-2">
              <Download className="h-4 w-4" />
              XLSX
            </Button>
          </div>
          {rows.length === 0 ? (
            <div className="glass-card rounded-xl p-12 text-center">
              <FileSpreadsheet className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-semibold mb-1">Нет данных</h3>
              <p className="text-sm text-muted-foreground">
                {(!gckSuppliers || gckSuppliers.length === 0)
                  ? "Создайте поставщика ГЦК в Админке и импортируйте номера через «Базы ГЦК»"
                  : "Импортируйте звонки по номерам ГЦК"}
              </p>
            </div>
          ) : (
            <div className="glass-card rounded-xl overflow-hidden">
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0 z-10">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Номер</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Лид</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <motion.tr
                        key={r.phone}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: Math.min(i * 0.005, 0.3) }}
                        className="border-b border-border/50 hover:bg-muted/30 dark:hover:bg-muted/20 transition-colors"
                      >
                        <td className="px-4 py-2.5 font-mono text-xs">{r.phone}</td>
                        <td className="px-4 py-2.5">
                          {r.isLead ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary">Да</span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
