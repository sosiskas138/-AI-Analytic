import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { FolderKanban, Users, Plus, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Projects() {
  const { user, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleteProject, setDeleteProject] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: projectsData, isLoading, refetch } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const response = await api.getProjects();
      return response.projects || [];
    },
  });

  const projects = projectsData || [];

  // Get responsible person per project
  const { data: projectStatuses } = useQuery({
    queryKey: ["project-responsible", projects?.map(p => p.id)],
    queryFn: async () => {
      if (!projects || projects.length === 0) return {};
      const map: Record<string, string> = {};
      // TODO: Add API endpoint for project status
      // For now, return empty map
      return map;
    },
    enabled: !!projects && projects.length > 0,
  });

  // Get call stats per project (optimized - single request)
  const { data: projectStats } = useQuery({
    queryKey: ["project-stats"],
    queryFn: async () => {
      if (!projects || projects.length === 0) return {};
      try {
        const response = await api.getProjectStats();
        return response.stats || {};
      } catch (error) {
        console.error('Failed to fetch project stats:', error);
        return {};
      }
    },
    enabled: !!projects && projects.length > 0,
    staleTime: 30000, // Cache for 30 seconds
  });

  const handleCreate = async () => {
    if (!name.trim()) return;
    const trimmedName = name.trim();
    const exists = projects.some((p) => p.name.toLowerCase() === trimmedName.toLowerCase());
    if (exists) {
      toast.error("Проект с таким названием уже существует");
      return;
    }
    setCreating(true);
    try {
      const project = await api.createProject({
        name: trimmedName,
        description: description.trim(),
      });
      toast.success("Проект создан");
      setOpen(false);
      setName("");
      setDescription("");
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Ошибка создания проекта");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteProject) return;
    setDeleting(true);
    try {
      await api.deleteProject(deleteProject.id);
      toast.success("Проект удалён");
      setDeleteProject(null);
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Ошибка удаления проекта");
    } finally {
      setDeleting(false);
    }
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Проекты</h1>
          <p className="text-muted-foreground mt-1 text-sm">Управление кампаниями обзвона</p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Новый проект
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Новый проект</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Название</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Москва Q1" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Описание</label>
                  <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Обзвон базы Москва" />
                </div>
                <Button onClick={handleCreate} disabled={creating} className="w-full">
                  {creating ? "Создание..." : "Создать"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {(!projects || projects.length === 0) ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <FolderKanban className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-semibold mb-1">Нет проектов</h3>
          <p className="text-sm text-muted-foreground">Создайте первый проект для начала работы</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {projects.map((project, i) => {
            const stats = projectStats?.[project.id];
            const responsible = projectStatuses?.[project.id];
            return (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
              >
                <div className="glass-card rounded-xl p-5 hover:shadow-md hover:border-primary/30 transition-all duration-300 group relative">
                  {isAdmin && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDeleteProject({ id: project.id, name: project.name });
                      }}
                      className="sm:hidden absolute top-3 right-3 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all z-10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                  <Link to={`/projects/${project.id}/dashboard`} className="flex items-center gap-6">
                    <div className="p-2.5 rounded-xl bg-primary/10 shrink-0">
                      <FolderKanban className="h-5 w-5 text-primary" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold truncate">{project.name}</h3>
                      <p className="text-sm text-muted-foreground truncate">{project.description || "—"}</p>
                    </div>

                    {responsible && (
                      <div className="hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground shrink-0">
                        <Users className="h-3.5 w-3.5" />
                        <span className="truncate max-w-[140px]">{responsible}</span>
                      </div>
                    )}

                    {isAdmin && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDeleteProject({ id: project.id, name: project.name });
                        }}
                        className="hidden sm:flex p-1.5 rounded-lg shrink-0 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}

                    <div className="hidden sm:flex items-center gap-6 shrink-0 pl-4 border-l border-border">
                      <div className="text-center">
                        <p className="text-sm font-semibold">{(stats?.uniqueCalls ?? 0).toLocaleString()}</p>
                        <p className="text-[10px] text-muted-foreground">Уник. звонки</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold">{stats?.convCall ?? "0"}%</p>
                        <p className="text-[10px] text-muted-foreground">% в звонок</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold">{stats?.convLead ?? "0"}%</p>
                        <p className="text-[10px] text-muted-foreground">% в лид</p>
                      </div>
                    </div>
                  </Link>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!deleteProject} onOpenChange={(open) => !open && setDeleteProject(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить проект «{deleteProject?.name}»?</AlertDialogTitle>
            <AlertDialogDescription>
              Все данные проекта будут безвозвратно удалены: звонки, импорты, поставщики, номера, статус и настройки. Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Удаление..." : "Да, удалить всё"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
