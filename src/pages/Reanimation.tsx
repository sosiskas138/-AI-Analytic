import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { format, startOfDay, endOfDay, subDays, startOfMonth, subMonths } from "date-fns";
import { ru } from "date-fns/locale";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
// Select removed - no longer needed
import { Download, RefreshCw, History, Undo2, CalendarIcon } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";

type ReanimationVariant = "busy" | "dropped-10" | "dropped-30";

const VARIANT_CONFIG: Record<ReanimationVariant, { label: string; description: string; badgeVariant: "destructive" | "secondary" | "outline" }> = {
  busy: { label: "Не ответили (Заняты)", description: "Абонент был занят — не поднял трубку", badgeVariant: "destructive" },
  "dropped-10": { label: "Сброс до 10 сек", description: "Не устроило приветствие — сбросили в первые 10 секунд", badgeVariant: "secondary" },
  "dropped-30": { label: "Сброс до 30 сек", description: "Изменить заход — сбросили в первые 30 секунд", badgeVariant: "outline" },
};

function classifyCall(c: any): ReanimationVariant | null {
  if (c.end_reason === "Занято") return "busy";
  if ((c.end_reason === "Сброс" || c.end_reason === "socket hang up") && c.duration_seconds < 10) return "dropped-10";
  if ((c.end_reason === "Сброс" || c.end_reason === "socket hang up") && c.duration_seconds >= 10 && c.duration_seconds < 30) return "dropped-30";
  return null;
}

type DateRange = { from: Date | undefined; to: Date | undefined };

const DATE_PRESETS = [
  { label: "Прошлая неделя", range: () => ({ from: startOfDay(subDays(new Date(), 6)), to: endOfDay(new Date()) }) },
  { label: "Прошлые две недели", range: () => ({ from: startOfDay(subDays(new Date(), 13)), to: endOfDay(new Date()) }) },
  { label: "Прошлый месяц", range: () => {
    const s = startOfMonth(subMonths(new Date(), 1));
    const e = endOfDay(subDays(startOfMonth(new Date()), 1));
    return { from: s, to: e };
  }},
  { label: "Всё время", range: () => ({ from: undefined, to: undefined }) },
] as const;

const ALLOWED_END_REASONS = ["Занято", "Сброс", "socket hang up"];

async function fetchAllCalls(projectId: string) {
  const PAGE = 1000;
  let all: any[] = [];
  let page = 1;
  while (true) {
    const response = await api.getCalls(projectId, { page, pageSize: PAGE });
    if (!response.calls || response.calls.length === 0) break;
    // Filter on client side: is_lead=false, duration<30, end_reason in ALLOWED_END_REASONS
    const filtered = response.calls.filter((c: any) => 
      !c.is_lead && 
      (c.duration_seconds || 0) < 30 && 
      ALLOWED_END_REASONS.includes(c.end_reason)
    );
    all = all.concat(filtered);
    if (response.calls.length < PAGE || all.length >= response.total) break;
    page++;
  }
  return all;
}

async function fetchExportedPhones(projectId: string): Promise<Set<string>> {
  const response = await api.getReanimationExports(projectId);
  if (!response.exports?.length) return new Set();

  const phones = new Set<string>();
  for (const exp of response.exports) {
    let page = 1;
    const PAGE = 1000;
    while (true) {
      const numbersResponse = await api.getReanimationExportNumbers(exp.id);
      if (!numbersResponse.numbers?.length) break;
      numbersResponse.numbers.forEach((d: any) => phones.add(d.phone_normalized));
      if (numbersResponse.numbers.length < PAGE || phones.size >= numbersResponse.total) break;
      page++;
    }
  }
  return phones;
}

export default function Reanimation() {
  const { isAdmin } = useAuth();

  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const response = await api.getProjects();
      return (response.projects || []).sort((a: any, b: any) => a.name.localeCompare(b.name));
    },
  });

  const { data: callsByProject, isLoading, refetch } = useQuery({
    queryKey: ["reanimation-calls"],
    queryFn: async () => {
      if (!projects?.length) return {};
      const result: Record<string, any[]> = {};
      for (const p of projects) {
        result[p.id] = await fetchAllCalls(p.id);
      }
      return result;
    },
    enabled: !!projects?.length,
  });

  const { data: exportedByProject } = useQuery({
    queryKey: ["reanimation-exported"],
    queryFn: async () => {
      if (!projects?.length) return {};
      const result: Record<string, Set<string>> = {};
      for (const p of projects) {
        result[p.id] = await fetchExportedPhones(p.id);
      }
      return result;
    },
    enabled: !!projects?.length,
  });

  const dedupedByVariant = useMemo(() => {
    if (!callsByProject) return {};
    const out: Record<string, Record<ReanimationVariant, any[]>> = {};
    for (const [pid, calls] of Object.entries(callsByProject)) {
      const exported = exportedByProject?.[pid] || new Set();
      const seen: Record<ReanimationVariant, Set<string>> = { busy: new Set(), "dropped-10": new Set(), "dropped-30": new Set() };
      const grouped: Record<ReanimationVariant, any[]> = { busy: [], "dropped-10": [], "dropped-30": [] };
      for (const c of calls as any[]) {
        const variant = classifyCall(c);
        if (!variant) continue;
        if (!seen[variant].has(c.phone_normalized) && !exported.has(c.phone_normalized)) {
          seen[variant].add(c.phone_normalized);
          grouped[variant].push(c);
        }
      }
      const total = grouped.busy.length + grouped["dropped-10"].length + grouped["dropped-30"].length;
      if (total > 0) out[pid] = grouped;
    }
    return out;
  }, [callsByProject, exportedByProject]);

  const projectsWithData = projects?.filter((p) => dedupedByVariant[p.id]) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Реанимация</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Номера для повторного обзвона
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <Badge variant="destructive">Вариант 1 — Не ответили (заняты)</Badge>
        <Badge variant="secondary">Вариант 2 — Сброс до 10 сек (не устроило приветствие)</Badge>
        <Badge variant="outline">Вариант 3 — Сброс до 30 сек (изменить заход)</Badge>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-center py-12">Загрузка...</div>
      ) : projectsWithData.length === 0 ? (
        <div className="text-muted-foreground text-center py-12">Нет новых номеров для реанимации</div>
      ) : (
        <Accordion type="multiple" className="space-y-2">
          {projectsWithData.map((project) => (
            <ProjectAccordion
              key={project.id}
              project={project}
              variants={dedupedByVariant[project.id]}
            />
          ))}
        </Accordion>
      )}

      <ExportHistory projects={projects || []} />
    </div>
  );
}

function ProjectAccordion({ project, variants }: { project: { id: string; name: string }; variants: Record<ReanimationVariant, any[]> }) {
  const total = variants.busy.length + variants["dropped-10"].length + variants["dropped-30"].length;

  return (
    <AccordionItem value={project.id} className="border rounded-lg px-4">
      <AccordionTrigger className="hover:no-underline">
        <div className="flex items-center gap-3 w-full flex-wrap">
          <span className="font-semibold">{project.name}</span>
          <Badge variant="outline">{total} номеров</Badge>
        </div>
      </AccordionTrigger>
      <AccordionContent className="space-y-4">
        {(Object.entries(VARIANT_CONFIG) as [ReanimationVariant, typeof VARIANT_CONFIG[ReanimationVariant]][]).map(([key, config]) => (
          <VariantSection
            key={key}
            variant={key}
            config={config}
            rows={variants[key]}
            project={project}
          />
        ))}
      </AccordionContent>
    </AccordionItem>
  );
}

function VariantSection({ variant, config, rows, project }: {
  variant: ReanimationVariant;
  config: typeof VARIANT_CONFIG[ReanimationVariant];
  rows: any[];
  project: { id: string; name: string };
}) {
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [activePreset, setActivePreset] = useState("Всё время");
  const [exporting, setExporting] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();

  const filtered = useMemo(() => {
    return rows.filter((c) => {
      if (dateRange.from && new Date(c.call_at) < dateRange.from) return false;
      if (dateRange.to && new Date(c.call_at) > dateRange.to) return false;
      return true;
    });
  }, [rows, dateRange]);

  const exportData = async () => {
    if (!filtered.length) return;
    setExporting(true);
    try {
      const filename = `reanimation_${project.name}_${variant}_${new Date().toISOString().slice(0, 10)}.xlsx`;

      const exportRecord = await api.createReanimationExport({
        project_id: project.id,
        phone_count: filtered.length,
        duration_filter: variant,
        filename,
        date_from: dateRange.from?.toISOString() || null,
        date_to: dateRange.to?.toISOString() || null,
        phone_numbers: filtered.map((r) => r.phone_normalized),
      });

      const data = filtered.map((r) => ({
        Телефон: r.phone_raw,
        "Длительность (сек)": r.duration_seconds,
        "Причина завершения": r.end_reason || "",
        "Колл-лист": r.call_list || "",
        "Дата звонка": r.call_at,
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Реанимация");
      XLSX.writeFile(wb, filename);

      queryClient.invalidateQueries({ queryKey: ["reanimation-exported"] });
      queryClient.invalidateQueries({ queryKey: ["reanimation-history"] });

      toast({ title: `Экспортировано ${filtered.length} номеров`, description: config.label });
    } catch (e: any) {
      toast({ title: "Ошибка экспорта", description: e.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  if (rows.length === 0) return null;

  return (
    <div className="border rounded-md p-3 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant={config.badgeVariant}>{config.label}</Badge>
            <Badge variant="secondary" className="text-sm">{filtered.length}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{config.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="text-xs" onClick={() => setExpanded(!expanded)}>
            {expanded ? "Скрыть" : "Показать"}
          </Button>
          <Button variant="outline" size="sm" onClick={exportData} disabled={exporting || !filtered.length}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            {exporting ? "..." : "XLSX"}
          </Button>
        </div>
      </div>

      {expanded && (
        <>
          <div className="flex flex-wrap items-center gap-1.5">
            {DATE_PRESETS.map((p) => (
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
              <PopoverContent className="w-auto p-0" align="start">
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
          <div className="rounded-md border max-h-[300px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Телефон</TableHead>
                  <TableHead>Длительность</TableHead>
                  <TableHead>Причина</TableHead>
                  <TableHead>Колл-лист</TableHead>
                  <TableHead>Дата</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row, i) => (
                  <TableRow key={row.phone_normalized}>
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-mono text-sm">{row.phone_raw}</TableCell>
                    <TableCell>{row.duration_seconds}с</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{row.end_reason || "—"}</TableCell>
                    <TableCell className="text-sm">{row.call_list || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(row.call_at).toLocaleDateString("ru-RU")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}

const VARIANT_LABELS: Record<string, string> = {
  busy: "Не ответили (Заняты)",
  "dropped-10": "Сброс до 10 сек",
  "dropped-30": "Сброс до 30 сек",
};

function ExportHistory({ projects }: { projects: { id: string; name: string }[] }) {
  const [showHistory, setShowHistory] = useState(false);
  const [undoing, setUndoing] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: exportsData } = useQuery({
    queryKey: ["reanimation-history"],
    queryFn: async () => {
      const response = await api.getAllReanimationExports();
      return response.exports || [];
    },
    enabled: showHistory,
  });

  const getProjectName = (pid: string) => projects.find((p) => p.id === pid)?.name || "—";
  const getFilterLabel = (f: string) => VARIANT_LABELS[f] || f;

  const undoExport = async (exportId: string) => {
    setUndoing(exportId);
    try {
      await api.deleteReanimationExport(exportId);

      queryClient.invalidateQueries({ queryKey: ["reanimation-exported"] });
      queryClient.invalidateQueries({ queryKey: ["reanimation-history"] });

      toast({ title: "Экспорт отменён", description: "Номера вернулись в список реанимации" });
    } catch (e: any) {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    } finally {
      setUndoing(null);
    }
  };

  return (
    <div className="space-y-3">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowHistory(!showHistory)}
        className="text-muted-foreground"
      >
        <History className="h-4 w-4 mr-1.5" />
        {showHistory ? "Скрыть историю экспортов" : "История экспортов"}
      </Button>

      {showHistory && exports && (
        <div className="rounded-md border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Дата экспорта</TableHead>
                <TableHead>Проект</TableHead>
                <TableHead>Период звонков</TableHead>
                <TableHead>Вариант</TableHead>
                <TableHead>Номеров</TableHead>
                <TableHead>Файл</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(!exportsData || exportsData.length === 0) ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Нет экспортов
                  </TableCell>
                </TableRow>
              ) : (
                (exportsData || []).map((exp) => (
                  <TableRow key={exp.id}>
                    <TableCell className="text-sm">
                      {new Date(exp.exported_at).toLocaleString("ru-RU")}
                    </TableCell>
                    <TableCell className="font-medium">{getProjectName(exp.project_id)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {exp.date_from && exp.date_to
                        ? `${new Date(exp.date_from).toLocaleDateString("ru-RU")} – ${new Date(exp.date_to).toLocaleDateString("ru-RU")}`
                        : exp.date_from
                          ? `с ${new Date(exp.date_from).toLocaleDateString("ru-RU")}`
                          : "Всё время"}
                    </TableCell>
                    <TableCell className="text-sm">{getFilterLabel(exp.duration_filter)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{exp.phone_count}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{exp.filename}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => undoExport(exp.id)}
                        disabled={undoing === exp.id}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Undo2 className="h-3.5 w-3.5 mr-1" />
                        {undoing === exp.id ? "..." : "Вернуть"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}