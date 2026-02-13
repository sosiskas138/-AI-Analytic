import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Loader2, ClipboardCheck, ExternalLink } from "lucide-react";

const CHECKBOXES = [
  { key: "materials_requested", label: "Материалы запрошены" },
  { key: "materials_sent", label: "Материалы отправлены" },
  { key: "skillbase_ready", label: "Скиллбейз готов" },
  { key: "test_launched", label: "Тест запущен" },
  { key: "launched_to_production", label: "Запущен в работу" },
] as const;

type StatusRow = Record<string, any>;

export default function ProjectStatus() {
  const { projectId } = useParams();
  const queryClient = useQueryClient();

  const { data: status, isLoading } = useQuery({
    queryKey: ["project-status", projectId],
    queryFn: async () => {
      return await api.getProjectStatus(projectId!);
    },
    enabled: !!projectId,
  });

  const upsert = useMutation({
    mutationFn: async (patch: Record<string, any>) => {
      await api.updateProjectStatus(projectId!, patch);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-status", projectId] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleField = (field: string, value: any) => {
    upsert.mutate({ [field]: value });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const s = status || ({} as StatusRow);

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Статус проекта</h1>
          <p className="text-muted-foreground mt-1">Отслеживание прогресса по проекту</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-sm font-medium ${s.is_active !== false ? "text-primary" : "text-muted-foreground"}`}>
            {s.is_active !== false ? "Активен" : "Выключен"}
          </span>
          <Switch
            checked={s.is_active !== false}
            onCheckedChange={(v) => handleField("is_active", v)}
          />
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-xl overflow-hidden"
      >
        {/* Text fields */}
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-border">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Ссылка на анализ</label>
            <div className="flex gap-2">
              <Input
                defaultValue={s.analysis_link || ""}
                placeholder="https://..."
                className="h-9 text-sm"
                onBlur={(e) => handleField("analysis_link", e.target.value)}
              />
              {s.analysis_link && (
                <a href={s.analysis_link} target="_blank" rel="noopener noreferrer" className="shrink-0 flex items-center justify-center h-9 w-9 rounded-lg border border-border hover:bg-muted transition-colors">
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </a>
              )}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Название компании</label>
            <Input
              defaultValue={s.company_name || ""}
              placeholder="ООО «Компания»"
              className="h-9 text-sm"
              onBlur={(e) => handleField("company_name", e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Чем занимается компания</label>
            <Input
              defaultValue={s.company_activity || ""}
              placeholder="Описание деятельности"
              className="h-9 text-sm"
              onBlur={(e) => handleField("company_activity", e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Ответственный</label>
            <Input
              defaultValue={s.responsible || ""}
              placeholder="Имя ответственного"
              className="h-9 text-sm"
              onBlur={(e) => handleField("responsible", e.target.value)}
            />
          </div>
        </div>

        {/* Checkboxes */}
        <div className="p-5 border-b border-border">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Прогресс</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {CHECKBOXES.map((cb) => {
              const checked = !!s[cb.key];
              const isLaunched = cb.key === "launched_to_production";
              const greenStyle = isLaunched && checked;
              return (
                <label
                  key={cb.key}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-colors cursor-pointer ${
                    greenStyle
                      ? "border-emerald-500/40 bg-emerald-500/10"
                      : checked
                        ? "border-primary/30 bg-primary/5"
                        : "border-border hover:bg-muted/30 dark:hover:bg-muted/20"
                  }`}
                >
                  {greenStyle && <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />}
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) => handleField(cb.key, !!v)}
                  />
                  <span className={`text-sm font-medium ${greenStyle ? "text-emerald-600 dark:text-emerald-400" : ""}`}>{cb.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Comment */}
        <div className="p-5">
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Комментарий / Следующий шаг</label>
          <Textarea
            defaultValue={s.comment || ""}
            placeholder="Комментарий..."
            className="min-h-[80px] text-sm"
            onBlur={(e) => handleField("comment", e.target.value)}
          />
        </div>
      </motion.div>
    </div>
  );
}
