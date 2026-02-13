import { useParams } from "react-router-dom";
import { useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  FileUp, Upload, CheckCircle2, Loader2, AlertCircle, X, ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api } from "@/lib/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Papa from "papaparse";
import * as XLSX from "xlsx";

type ImportType = "suppliers" | "calls" | "gck";

interface PreviewState {
  open: boolean;
  type: ImportType;
  filename: string;
  headers: string[];
  rows: Record<string, string>[];
}

const SUPPLIER_REQUIRED = ["phone"];
const CALLS_REQUIRED = ["external_call_id", "phone", "call_at"];

const SUPPLIER_ALIASES: Record<string, string> = {
  Name: "name", name: "name", Имя: "name", "Название": "name",
  Tag: "tag", tag: "tag", Тег: "tag",
  Phone: "phone", phone: "phone", "Телефон": "phone", "Номер": "phone",
  received_at: "received_at", "Дата": "received_at", "Дата получения": "received_at", "Дата поступления": "received_at", date: "received_at", "Date": "received_at",
};

const CALLS_ALIASES: Record<string, string> = {
  external_call_id: "external_call_id", ExternalCallId: "external_call_id", id: "external_call_id", ID: "external_call_id",
  phone: "phone", Phone: "phone", "Телефон": "phone",
  call_at: "call_at", CallAt: "call_at", "Дата": "call_at", date: "call_at", "Дата и время": "call_at",
  duration_seconds: "duration_seconds", Duration: "duration_seconds", "Длительность": "duration_seconds", "Длительность (мин:сек)": "duration_seconds",
  status: "status", Status: "status", "Статус": "status",
  end_reason: "end_reason", EndReason: "end_reason", "Причина завершения": "end_reason",
  skill_base: "skill_base", SkillBase: "skill_base",
  call_list: "call_list", CallList: "call_list", "Колл-лист": "call_list",
  call_attempt_number: "call_attempt_number", "Попытка": "call_attempt_number",
  is_lead: "is_lead", IsLead: "is_lead", "Лид": "is_lead", "Лид?": "is_lead",
};

function normalizeHeaders(headers: string[], type: ImportType): Record<string, string> {
  const aliases = type === "suppliers" ? SUPPLIER_ALIASES : CALLS_ALIASES;
  const map: Record<string, string> = {};
  for (const h of headers) {
    const trimmed = h.trim();
    if (aliases[trimmed]) map[trimmed] = aliases[trimmed];
  }
  return map;
}

export default function ProjectImports() {
  const { projectId } = useParams();
  const queryClient = useQueryClient();
  const suppliersInputRef = useRef<HTMLInputElement>(null);
  const callsInputRef = useRef<HTMLInputElement>(null);
  const gckInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<PreviewState>({
    open: false, type: "suppliers", filename: "", headers: [], rows: [],
  });
  const [importing, setImporting] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");

  const { data: suppliers } = useQuery({
    queryKey: ["suppliers", projectId],
    queryFn: async () => {
      const response = await api.getSuppliers(projectId!);
      return response.suppliers || [];
    },
    enabled: !!projectId,
  });

  // Fetch GCK suppliers separately for GCK import type
  const { data: gckSuppliers } = useQuery({
    queryKey: ["suppliers-gck", projectId],
    queryFn: async () => {
      const response = await api.getSuppliers(projectId!, { isGck: true });
      return response.suppliers || [];
    },
    enabled: !!projectId,
  });

  const { data: imports, isLoading } = useQuery({
    queryKey: ["imports", projectId],
    queryFn: async () => {
      const response = await api.getImports(projectId!);
      return response.imports || [];
    },
    enabled: !!projectId,
  });

  const parseCSVText = (text: string, type: ImportType, filename: string) => {
    const effectiveType = type === "gck" ? "suppliers" : type;
    const result = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
    });

    if (!result.data || result.data.length === 0) {
      toast.error("Файл пустой или не удалось распарсить");
      return;
    }

    const rows = result.data as Record<string, string>[];
    const headers = result.meta.fields || [];
    const headerMap = normalizeHeaders(headers, effectiveType as "suppliers" | "calls");
    const required = effectiveType === "suppliers" ? SUPPLIER_REQUIRED : CALLS_REQUIRED;
    const mappedFields = Object.values(headerMap);
    const missing = required.filter((r) => !mappedFields.includes(r));

    if (missing.length > 0) {
      toast.error(`Не найдены обязательные колонки: ${missing.join(", ")}. Имеющиеся: ${headers.join(", ")}`);
      return;
    }

    const normalizedRows = rows.map((row) => {
      const nr: Record<string, string> = {};
      for (const [origKey, value] of Object.entries(row)) {
        const mapped = headerMap[origKey.trim()];
        if (mapped) nr[mapped] = (value || "").trim();
      }
      return nr;
    }).filter((row) => {
      return required.every((r) => row[r] && row[r].length > 0);
    });

    setPreview({
      open: true,
      type,
      filename,
      headers: [...new Set(Object.values(headerMap))],
      rows: normalizedRows,
    });
    // Reset supplier selection when type changes
    setSelectedSupplierId("");
  };

  const handleFileSelect = (type: ImportType) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isXlsx = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");
    const effectiveType = type === "gck" ? "suppliers" : type;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const buffer = ev.target?.result as ArrayBuffer;

      if (isXlsx) {
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });
        const headers = rows.length > 0 ? Object.keys(rows[0]) : [];

        const headerMap = normalizeHeaders(headers, effectiveType as "suppliers" | "calls");
        const required = effectiveType === "suppliers" ? SUPPLIER_REQUIRED : CALLS_REQUIRED;
        const mappedFields = Object.values(headerMap);
        const missing = required.filter((r) => !mappedFields.includes(r));

        if (missing.length > 0) {
          toast.error(`Не найдены обязательные колонки: ${missing.join(", ")}. Имеющиеся: ${headers.join(", ")}`);
          e.target.value = "";
          return;
        }

        const normalizedRows = rows.map((row) => {
          const nr: Record<string, string> = {};
          for (const [origKey, value] of Object.entries(row)) {
            const mapped = headerMap[origKey.trim()];
            if (mapped) nr[mapped] = String(value || "").trim();
          }
          return nr;
        }).filter((row) => required.every((r) => row[r] && row[r].length > 0));

        setPreview({
          open: true, type, filename: file.name,
          headers: [...new Set(Object.values(headerMap))],
          rows: normalizedRows,
        });
        // Reset supplier selection when type changes
        setSelectedSupplierId("");
      } else {
        const bytes = new Uint8Array(buffer);
        let text = new TextDecoder("utf-8").decode(bytes);
        if (text.includes("\uFFFD")) {
          text = new TextDecoder("windows-1251").decode(bytes);
        }
        if (text.charCodeAt(0) === 0xFEFF) {
          text = text.slice(1);
        }
        parseCSVText(text, type, file.name);
      }
    };
    reader.readAsArrayBuffer(file);

    e.target.value = "";
  };

  const handleImport = async () => {
    if (!projectId) return;
    setImporting(true);

    try {
      const isGck = preview.type === "gck";
      const effectiveType = isGck ? "suppliers" : preview.type;
      
      // Validate GCK import: ensure selected supplier is GCK
      if (isGck && selectedSupplierId) {
        const selectedSupplier = gckSuppliers?.find((s) => s.id === selectedSupplierId);
        if (!selectedSupplier || !(selectedSupplier as any).is_gck) {
          toast.error("Для импорта ГЦК необходимо выбрать базу ГЦК");
          setImporting(false);
          return;
        }
      }
      
      const result = await api.importCsv({
        project_id: projectId,
        type: effectiveType as "suppliers" | "calls",
        rows: preview.rows,
        filename: preview.filename,
        ...((preview.type === "suppliers" || isGck) && selectedSupplierId ? { supplier_id: selectedSupplierId } : {}),
        ...(isGck ? { is_gck: true } : {}),
      });

      toast.success(
        `Импорт завершён: ${result.inserted} добавлено, ${result.skipped} дубликатов, ${result.errors} ошибок`
      );

      setPreview((p) => ({ ...p, open: false }));
      setSelectedSupplierId("");
      
      queryClient.invalidateQueries({ queryKey: ["imports", projectId] });
      queryClient.invalidateQueries({ queryKey: ["suppliers", projectId] });
      queryClient.invalidateQueries({ queryKey: ["calls", projectId] });
    } catch (err: any) {
      toast.error(err.message || "Ошибка импорта");
    } finally {
      setImporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const zones = [
    {
      title: "Поставщики номеров",
      desc: "CSV: Name, Tag, Phone",
      type: "suppliers" as ImportType,
      ref: suppliersInputRef,
    },
    {
      title: "Звонки робота",
      desc: "CSV: external_call_id, phone, call_at, duration_seconds, status, ...",
      type: "calls" as ImportType,
      ref: callsInputRef,
    },
    {
      title: "Базы ГЦК",
      desc: "CSV: Phone (номера от ГЦК-поставщиков)",
      type: "gck" as ImportType,
      ref: gckInputRef,
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Импорт данных</h1>
          <p className="text-muted-foreground mt-1">Загрузка CSV / XLSX с номерами и звонками</p>
        </div>
      </div>

      {/* Upload zones */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        {zones.map((zone, i) => (
          <motion.div
            key={zone.type}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass-card rounded-xl p-8 text-center border-2 border-dashed border-border hover:border-primary/40 transition-colors cursor-pointer"
            onClick={() => zone.ref.current?.click()}
          >
            <input
              ref={zone.ref}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={handleFileSelect(zone.type)}
            />
            <div className="p-3 rounded-xl bg-primary/10 w-fit mx-auto mb-4">
              <Upload className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold mb-1">{zone.title}</h3>
            <p className="text-sm text-muted-foreground mb-4">{zone.desc}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => { e.stopPropagation(); zone.ref.current?.click(); }}
            >
              Выбрать файл
            </Button>
          </motion.div>
        ))}
      </div>

      {/* Preview Dialog */}
      <Dialog open={preview.open} onOpenChange={(open) => setPreview((p) => ({ ...p, open }))}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileUp className="h-5 w-5" />
              Предпросмотр: {preview.filename}
            </DialogTitle>
          </DialogHeader>

          <div className="flex items-center gap-3 text-sm">
            <Badge variant="secondary">{preview.type === "suppliers" ? "Номера" : preview.type === "gck" ? "ГЦК" : "Звонки"}</Badge>
            <span className="text-muted-foreground">{preview.rows.length} строк для импорта</span>
          </div>

          {preview.type === "suppliers" && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Поставщик</label>
              <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите поставщика" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers?.filter((s: any) => !s.is_gck).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Поставщики ГЦК недоступны — номера в них загружаются только через «Базы ГЦК»</p>
              {!selectedSupplierId && (
                <p className="text-xs text-destructive">Выберите поставщика для этой партии номеров</p>
              )}
              {(!suppliers || suppliers.filter((s: any) => !s.is_gck).length === 0) && (
                <p className="text-xs text-muted-foreground">Добавьте поставщика (не ГЦК) в разделе Администрирование</p>
              )}
            </div>
          )}

          {preview.type === "gck" && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">База ГЦК</label>
              {(!gckSuppliers || gckSuppliers.length === 0) ? (
                <div className="p-4 rounded-lg border border-destructive/20 bg-destructive/5">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-destructive mb-1">Нет баз ГЦК</p>
                      <p className="text-xs text-muted-foreground">
                        Обратитесь к администратору для создания базы ГЦК в разделе Администрирование
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите базу ГЦК" />
                    </SelectTrigger>
                    <SelectContent>
                      {gckSuppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          <div className="flex items-center gap-2">
                            <span>{s.name}</span>
                            <Badge variant="outline" className="text-[9px] bg-primary/10 text-primary border-primary/20">
                              ГЦК
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!selectedSupplierId && (
                    <p className="text-xs text-destructive">Выберите базу ГЦК для этой партии номеров</p>
                  )}
                </>
              )}
            </div>
          )}

          <ScrollArea className="flex-1 min-h-0 border rounded-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">#</th>
                    {preview.headers.map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 100).map((row, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                      {preview.headers.map((h) => (
                        <td key={h} className="px-3 py-1.5 whitespace-nowrap max-w-[200px] truncate">
                          {row[h] || "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.rows.length > 100 && (
              <p className="text-xs text-muted-foreground text-center py-2">
                Показано 100 из {preview.rows.length} строк
              </p>
            )}
          </ScrollArea>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPreview((p) => ({ ...p, open: false }))} disabled={importing}>
              Отмена
            </Button>
            <Button 
              onClick={handleImport} 
              disabled={
                importing || 
                (preview.type === "suppliers" && !selectedSupplierId) ||
                (preview.type === "gck" && (!selectedSupplierId || !gckSuppliers || gckSuppliers.length === 0))
              } 
              className="gap-2"
            >
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Импорт...
                </>
              ) : (
                <>
                  Импортировать {preview.rows.length} строк
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass-card rounded-xl overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold">История импортов</h3>
        </div>
        {(!imports || imports.length === 0) ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Импортов пока нет</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["Файл", "Тип", "Всего строк", "Добавлено", "Пропущено", "Ошибки", "Дата"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {imports.map((imp) => (
                  <tr key={imp.id} className="border-b border-border/50 hover:bg-muted/30 dark:hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium flex items-center gap-2">
                      <FileUp className="h-4 w-4 text-muted-foreground" />
                      {imp.filename || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="text-[10px]">
                        {imp.type === "suppliers" ? "Номера" : imp.type === "gck" ? "ГЦК" : "Звонки"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">{imp.total_rows.toLocaleString()}</td>
                    <td className="px-4 py-3 text-success font-medium">{imp.inserted_rows.toLocaleString()}</td>
                    <td className="px-4 py-3 text-warning">{imp.skipped_duplicates}</td>
                    <td className="px-4 py-3">
                      {imp.error_rows > 0 ? (
                        <span className="text-destructive font-medium">{imp.error_rows}</span>
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(imp.created_at).toLocaleDateString("ru-RU")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  );
}
