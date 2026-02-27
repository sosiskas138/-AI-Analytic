import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Users, DollarSign, Loader2, Package, Plus, Trash2, BarChart3, UserPlus, FolderKanban, Eye, EyeOff,
  CheckCircle2, Circle, ExternalLink, KeyRound, Pencil, Database, ChevronDown, ChevronRight,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { ALL_TABS, TabKey } from "@/hooks/useProjectAccess";
import { toast } from "sonner";
import { useState, useMemo, useEffect } from "react";
/** Фильтрует ввод, оставляя только цифры и одну десятичную точку */
function filterNumericInput(value: string): string {
  const cleaned = value.replace(/[^\d.]/g, "");
  const parts = cleaned.split(".");
  return parts.length > 2 ? parts.slice(0, 2).join(".") : cleaned;
}

const CHECKBOXES = [
  { key: "materials_requested", label: "Материалы" },
  { key: "materials_sent", label: "Отправлены" },
  { key: "skillbase_ready", label: "Скиллбейз" },
  { key: "test_launched", label: "Тест" },
  { key: "launched_to_production", label: "В работе" },
] as const;

function CplTargetsSection() {
  const queryClient = useQueryClient();
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.getSettings(),
  });
  const [cplA, setCplA] = useState("500");
  const [cplB, setCplB] = useState("1000");
  const [cplC, setCplC] = useState("2000");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (settings) {
      setCplA(settings.cpl_target_a ?? "500");
      setCplB(settings.cpl_target_b ?? "1000");
      setCplC(settings.cpl_target_c ?? "2000");
    }
  }, [settings]);
  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateSettings({
        cpl_target_a: parseFloat(cplA) || 0,
        cpl_target_b: parseFloat(cplB) || 0,
        cpl_target_c: parseFloat(cplC) || 0,
      });
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      queryClient.invalidateQueries({ queryKey: ["statistics-company"] });
      toast.success("Показатели CPL сохранены");
    } catch (e: any) {
      toast.error(e?.message || "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3 max-w-md">
      <p className="font-medium text-sm">Показатели CPL для статусов (A / B / C)</p>
      <p className="text-xs text-muted-foreground">В отчёте Статистика: CPL ≤ A → успешный, CPL ≥ C → проблемный, между A и C → средний.</p>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">CPL для A (успешный), ₽</label>
          <Input
            type="text"
            inputMode="decimal"
            value={cplA}
            onChange={(e) => setCplA(filterNumericInput(e.target.value))}
            className="h-9 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">CPL для B (средний), ₽</label>
          <Input
            type="text"
            inputMode="decimal"
            value={cplB}
            onChange={(e) => setCplB(filterNumericInput(e.target.value))}
            className="h-9 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">CPL для C (проблемный), ₽</label>
          <Input
            type="text"
            inputMode="decimal"
            value={cplC}
            onChange={(e) => setCplC(filterNumericInput(e.target.value))}
            className="h-9 text-sm"
          />
        </div>
      </div>
      <Button size="sm" onClick={handleSave} disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Сохранить"}
      </Button>
    </div>
  );
}

export default function Admin() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ---- Data queries ----
  const { data: projectsData } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const response = await api.getProjects();
      return response.projects || [];
    },
  });
  const projects = projectsData || [];

  const { data: allMembers, refetch: refetchMembers } = useQuery({
    queryKey: ["all-project-members"],
    queryFn: async () => {
      const all: any[] = [];
      for (const project of projects) {
        const response = await api.getProjectMembers(project.id);
        all.push(...(response.members || []));
      }
      return all;
    },
    enabled: !!projects && projects.length > 0,
  });

  const { data: pricingList } = useQuery({
    queryKey: ["all-pricing"],
    queryFn: async () => {
      const all: any[] = [];
      for (const project of projects) {
        try {
          const pricing = await api.getProjectPricing(project.id);
          if (pricing) all.push(pricing);
        } catch (e) {
          // Project may not have pricing yet
        }
      }
      return all;
    },
    enabled: !!projects && projects.length > 0,
  });

  const { data: allSuppliers } = useQuery({
    queryKey: ["all-suppliers"],
    queryFn: async () => {
      const all: any[] = [];
      for (const project of projects) {
        const response = await api.getSuppliers(project.id);
        all.push(...(response.suppliers || []));
      }
      return all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
    enabled: !!projects && projects.length > 0,
  });

  const { data: allCalls } = useQuery({
    queryKey: ["admin-all-calls", (projects || []).map((p) => p.id).sort().join(",")],
    queryFn: async () => {
      const all: any[] = [];
      for (const project of projects) {
        let page = 1;
        const pageSize = 1000;
        let fetched = 0;
        while (true) {
          const response = await api.getCalls(project.id, { page, pageSize });
          if (!response.calls || response.calls.length === 0) break;
          all.push(...response.calls);
          fetched += response.calls.length;
          if (response.calls.length < pageSize || fetched >= response.total) break;
          page++;
        }
      }
      return all;
    },
    enabled: !!projects && projects.length > 0,
  });

  const { data: allNumbers } = useQuery({
    queryKey: ["admin-all-numbers", (projects || []).map((p) => p.id).sort().join(",")],
    queryFn: async () => {
      const all: any[] = [];
      for (const project of projects) {
        let page = 1;
        const pageSize = 1000;
        let fetched = 0;
        while (true) {
          const response = await api.getSupplierNumbers(project.id, { page, pageSize });
          if (!response.numbers || response.numbers.length === 0) break;
          all.push(...response.numbers);
          fetched += response.numbers.length;
          if (response.numbers.length < pageSize || fetched >= response.total) break;
          page++;
        }
      }
      return all;
    },
    enabled: !!projects && projects.length > 0,
  });

  const { data: allStatuses } = useQuery({
    queryKey: ["all-project-statuses"],
    queryFn: async () => {
      const all: Record<string, any>[] = [];
      for (const project of projects) {
        try {
          const status = await api.getProjectStatus(project.id);
          if (status) all.push(status);
        } catch (e) {
          // Project may not have status yet
        }
      }
      return all;
    },
    enabled: !!projects && projects.length > 0,
  });

  // ---- Fetch users via API ----
  const { data: usersData } = useQuery({
    queryKey: ["auth-users"],
    queryFn: async () => {
      const response = await api.getUsers();
      return (response.users || []).map((u: any) => ({
        id: u.id,
        user_id: u.id,
        email: u.email || u.login || "",
        full_name: u.full_name || "",
        role: u.role || "member",
        can_manage_bases: !!u.can_manage_bases,
      }));
    },
  });
  const users = usersData || [];

  const getUserEmail = (userId: string) => {
    const u = users.find((a) => a.id === userId);
    if (!u) return "—";
    return u.email?.replace(/@app\.local$/, "") || "—";
  };

  // ---- User creation state ----
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newRole, setNewRole] = useState<"member" | "admin">("member");
  const [newCanManageBases, setNewCanManageBases] = useState(false);
  const [cleaningUp, setCleaningUp] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // ---- Edit user credentials state ----
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editLogin, setEditLogin] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [savingCredentials, setSavingCredentials] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);


  // ---- Supplier state ----
  const [selectedProjectForSupplier, setSelectedProjectForSupplier] = useState<string>("");
  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierIsGck, setNewSupplierIsGck] = useState(false);
  const [addingSupplier, setAddingSupplier] = useState(false);
  const [supplierPrices, setSupplierPrices] = useState<Record<string, string>>({});

  // ---- Pricing state ----
  const [pricingState, setPricingState] = useState<Record<string, { price_per_minute: string }>>({});

  // ---- Delete user state ----
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab") || "users";
  const activeTab = tabParam === "stats" ? "users" : tabParam;

  // ---- Helpers ----
  const getUserRole = (userId: string) => users.find((u) => u.id === userId)?.role || "member";
  const getUserCanManageBases = (userId: string) => users.find((u) => u.id === userId)?.can_manage_bases ?? false;
  const getProjectName = (projectId: string) => projects?.find((p) => p.id === projectId)?.name || "—";

  const getUserProjects = (userId: string) => {
    return allMembers?.filter((m) => m.user_id === userId) || [];
  };

  const getUnassignedProjects = (userId: string) => {
    const userProjects = getUserProjects(userId);
    return projects?.filter((p) => !userProjects.find((m) => m.project_id === p.id)) || [];
  };

  // ---- User creation ----
  const handleCreateUser = async () => {
    if (!newEmail.trim() || !newPassword.trim()) return;
    setCreatingUser(true);
    try {
      const email = newEmail.trim().includes("@") ? newEmail.trim() : `${newEmail.trim()}@app.local`;
      await api.createUser({
        login: email,
        password: newPassword.trim(),
        full_name: newFullName.trim(),
        role: newRole,
        can_manage_bases: newCanManageBases,
      });
      toast.success("Пользователь создан");
      setCreateUserOpen(false);
      setNewEmail("");
      setNewPassword("");
      setNewFullName("");
      setNewRole("member");
      setNewCanManageBases(false);
      queryClient.invalidateQueries({ queryKey: ["auth-users"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreatingUser(false);
    }
  };

  // ---- Delete user ----
  const handleDeleteUser = async (userId: string) => {
    setDeletingUserId(userId);
    try {
      await api.deleteUser(userId);
      toast.success("Пользователь удалён");
      queryClient.invalidateQueries({ queryKey: ["auth-users"] });
      queryClient.invalidateQueries({ queryKey: ["all-project-members"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeletingUserId(null);
    }
  };

  // ---- Update user credentials ----
  const handleSaveCredentials = async () => {
    if (!editUserId) return;
    if (!editLogin.trim() && !editPassword.trim()) return;
    if (editPassword.trim() && editPassword.trim().length < 6) {
      toast.error("Пароль должен быть не менее 6 символов");
      return;
    }
    setSavingCredentials(true);
    try {
      const updateData: { login?: string; password?: string } = {};
      if (editLogin.trim()) {
        updateData.login = editLogin.trim().includes("@") ? editLogin.trim() : `${editLogin.trim()}@app.local`;
      }
      if (editPassword.trim()) {
        updateData.password = editPassword.trim();
      }
      await api.updateUser(editUserId, updateData);
      toast.success("Данные обновлены");
      setEditUserId(null);
      setEditLogin("");
      setEditPassword("");
      queryClient.invalidateQueries({ queryKey: ["auth-users"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingCredentials(false);
    }
  };

  // ---- Access management ----
  const addProjectAccess = async (userId: string, projectId: string) => {
    try {
      await api.addProjectMember(projectId, {
        userId,
        allowedTabs: ALL_TABS.map((t) => t.key),
      });
      toast.success("Доступ добавлен");
      refetchMembers();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const removeProjectAccess = async (membershipId: string) => {
    try {
      // Find project_id from membership
      const membership = allMembers?.find((m) => m.id === membershipId);
      if (!membership) throw new Error("Membership not found");
      await api.removeProjectMember(membership.project_id, membershipId);
      toast.success("Доступ удалён");
      refetchMembers();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const toggleTab = async (membershipId: string, currentTabs: string[], tab: TabKey) => {
    const newTabs = currentTabs.includes(tab)
      ? currentTabs.filter((t) => t !== tab)
      : [...currentTabs, tab];
    try {
      const membership = allMembers?.find((m) => m.id === membershipId);
      if (!membership) throw new Error("Membership not found");
      await api.updateProjectMember(membership.project_id, membershipId, { allowedTabs: newTabs });
      refetchMembers();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const toggleCanManageBases = async (userId: string, current: boolean) => {
    try {
      await api.updateUser(userId, { can_manage_bases: !current });
      toast.success(!current ? "Право «Базы» выдано" : "Право «Базы» снято");
      queryClient.invalidateQueries({ queryKey: ["auth-users"] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // ---- Supplier functions ----
  const addSupplier = async () => {
    if (!selectedProjectForSupplier || !newSupplierName.trim()) return;
    setAddingSupplier(true);
    try {
      await api.createSupplier({
        project_id: selectedProjectForSupplier,
        name: newSupplierName.trim(),
        tag: newSupplierName.trim(),
        is_gck: newSupplierIsGck,
      });
      toast.success("Поставщик создан");
      setNewSupplierName("");
      setNewSupplierIsGck(false);
      queryClient.invalidateQueries({ queryKey: ["all-suppliers"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAddingSupplier(false);
    }
  };

  const deleteSupplier = async (id: string) => {
    try {
      await api.deleteSupplier(id);
      toast.success("Поставщик удалён");
      queryClient.invalidateQueries({ queryKey: ["all-suppliers"] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const saveSupplierPrice = async (supplierId: string) => {
    const val = supplierPrices[supplierId] ?? String((allSuppliers?.find((s) => s.id === supplierId) as any)?.price_per_contact ?? 0);
    try {
      await api.updateSupplier(supplierId, { price_per_contact: parseFloat(val) || 0 });
      toast.success("Цена сохранена");
      queryClient.invalidateQueries({ queryKey: ["all-suppliers"] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const toggleSupplierGck = async (supplierId: string, currentValue: boolean) => {
    try {
      await api.updateSupplier(supplierId, { is_gck: !currentValue });
      toast.success(!currentValue ? "ГЦК включён" : "ГЦК выключён");
      queryClient.invalidateQueries({ queryKey: ["all-suppliers"] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // ---- Pricing ----
  const getPricing = (projectId: string) => {
    if (pricingState[projectId]) return pricingState[projectId];
    const existing = pricingList?.find((p) => p.project_id === projectId);
    return { price_per_minute: String(existing?.price_per_minute ?? "0") };
  };

  const savePricing = async (projectId: string) => {
    const vals = getPricing(projectId);
    try {
      await api.updateProjectPricing(projectId, {
        price_per_minute: parseFloat(vals.price_per_minute) || 0,
      });
      toast.success("Цена сохранена");
      queryClient.invalidateQueries({ queryKey: ["all-pricing"] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (!isAdmin) {
    return (
      <div className="glass-card rounded-xl p-12 text-center">
        <p className="text-muted-foreground">Доступ только для администраторов</p>
      </div>
    );
  }

  const filteredSuppliers = selectedProjectForSupplier
    ? allSuppliers?.filter((s) => s.project_id === selectedProjectForSupplier) || []
    : [];


  const handleCleanupOrphaned = async () => {
    if (!confirm('Очистить базу данных от "осиротевших" записей? Это действие безопасно и не удалит корректные данные.')) {
      return;
    }
    setCleaningUp(true);
    try {
      const result = await api.cleanupOrphanedRecords();
      toast.success(`Очистка завершена. Обработано записей: ${result.total_cleaned}`);
      if (result.total_cleaned > 0) {
        console.log('Cleanup results:', result.results);
      }
      // Invalidate queries to refresh data
      queryClient.invalidateQueries();
    } catch (error: any) {
      toast.error(`Ошибка при очистке: ${error.message || 'Неизвестная ошибка'}`);
    } finally {
      setCleaningUp(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Администрирование</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCleanupOrphaned}
          disabled={cleaningUp}
          className="gap-2"
        >
          {cleaningUp ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Очистка...
            </>
          ) : (
            <>
              <Database className="h-4 w-4" />
              Очистить БД
            </>
          )}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setSearchParams({ tab: v })} className="space-y-6">
        <TabsList className="bg-muted/50 p-1 sr-only">
          <TabsTrigger value="users">Пользователи</TabsTrigger>
          <TabsTrigger value="responsible">Ответственные</TabsTrigger>
          <TabsTrigger value="suppliers">Поставщики</TabsTrigger>
          <TabsTrigger value="pricing">Денежные показатели</TabsTrigger>
        </TabsList>

        {/* ========== USERS TAB ========== */}
        <TabsContent value="users" className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Управление пользователями и доступом к проектам</p>
            <Dialog open={createUserOpen} onOpenChange={setCreateUserOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <UserPlus className="h-4 w-4" />
                  Новый пользователь
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Создать пользователя</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Имя</label>
                    <Input value={newFullName} onChange={(e) => setNewFullName(e.target.value)} placeholder="Иван Иванов" />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Логин</label>
                    <Input type="text" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="ivan" />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Пароль</label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Минимум 6 символов"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Роль</label>
                    <Select value={newRole} onValueChange={(v) => setNewRole(v as "member" | "admin")}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Пользователь</SelectItem>
                        <SelectItem value="admin">Администратор</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="new-can-manage-bases"
                      checked={newCanManageBases}
                      onCheckedChange={(c) => setNewCanManageBases(!!c)}
                    />
                    <label htmlFor="new-can-manage-bases" className="text-sm font-medium cursor-pointer">Базы (доступ к базам своих проектов, цены, ГЦК)</label>
                  </div>
                  <Button onClick={handleCreateUser} disabled={creatingUser || !newEmail.trim() || !newPassword.trim()} className="w-full">
                    {creatingUser ? "Создание..." : "Создать"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* All users with inline access */}
          <div className="space-y-4">
            {users.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">Нет пользователей</div>
            ) : (
              users.map((u) => {
                const role = getUserRole(u.user_id);
                const userProjects = getUserProjects(u.user_id);
                const unassigned = getUnassignedProjects(u.user_id);

                return (
                  <div key={u.id} className="rounded-xl border border-border bg-card overflow-hidden">
                    {/* User header */}
                    <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                          {(u.full_name || "?")[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{u.full_name || "Без имени"}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <KeyRound className="h-3 w-3" />
                            {getUserEmail(u.user_id)}
                          </p>
                        </div>
                        <Badge variant={role === "admin" ? "default" : "secondary"} className="text-[10px]">
                          {role === "admin" ? "Админ" : "Юзер"}
                        </Badge>
                        {role !== "admin" && (
                          <div className="flex items-center gap-1.5">
                            <Switch
                              checked={getUserCanManageBases(u.user_id)}
                              onCheckedChange={() => toggleCanManageBases(u.user_id, getUserCanManageBases(u.user_id))}
                              id={`bases-${u.user_id}`}
                            />
                            <label htmlFor={`bases-${u.user_id}`} className="text-[10px] text-muted-foreground cursor-pointer">Базы</label>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => {
                            setEditUserId(u.user_id);
                            setEditLogin(getUserEmail(u.user_id));
                            setEditPassword("");
                            setShowEditPassword(false);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5 mr-1" />
                          Изменить
                        </Button>
                        {role !== "admin" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                            disabled={deletingUserId === u.user_id}
                            onClick={() => handleDeleteUser(u.user_id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" />
                            {deletingUserId === u.user_id ? "..." : "Удалить"}
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Edit credentials inline */}
                    {editUserId === u.user_id && (
                      <div className="px-4 py-3 border-b border-border bg-muted/30">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                          <div>
                            <label className="text-xs font-medium mb-1 block">Логин</label>
                            <Input
                              value={editLogin}
                              onChange={(e) => setEditLogin(e.target.value)}
                              className="h-8 text-sm"
                              placeholder="Логин"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium mb-1 block">Новый пароль</label>
                            <div className="relative">
                              <Input
                                type={showEditPassword ? "text" : "password"}
                                value={editPassword}
                                onChange={(e) => setEditPassword(e.target.value)}
                                className="h-8 text-sm pr-8"
                                placeholder="Оставьте пустым"
                              />
                              <button
                                type="button"
                                onClick={() => setShowEditPassword(!showEditPassword)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                              >
                                {showEditPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                              </button>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" className="h-8" onClick={handleSaveCredentials} disabled={savingCredentials}>
                              {savingCredentials ? "..." : "Сохранить"}
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditUserId(null)}>
                              Отмена
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* User access content */}
                    <div className="p-4">
                      {role === "admin" ? (
                        <p className="text-xs text-muted-foreground">Полный доступ ко всем проектам</p>
                      ) : (
                        <Collapsible defaultOpen={false} className="group/collapse">
                          <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground text-left w-full">
                            <ChevronRight className="h-3.5 w-3.5 shrink-0 transition-transform group-data-[state=open]/collapse:rotate-90" />
                            <span>Доступ к проектам и вкладкам</span>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="pl-5 pt-3 space-y-3">
                              {userProjects.length > 0 && (
                                <div className="space-y-2">
                                  {userProjects.map((m) => (
                                    <div key={m.id} className="rounded-lg border border-border bg-muted/30 p-2.5">
                                      <div className="flex items-center justify-between gap-2 mb-2">
                                        <span className="text-xs font-medium">{getProjectName(m.project_id)}</span>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 text-[10px] text-destructive hover:text-destructive"
                                          onClick={() => removeProjectAccess(m.id)}
                                        >
                                          Убрать
                                        </Button>
                                      </div>
                                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                                        {ALL_TABS.map((tab) => (
                                          <label key={tab.key} className="flex items-center gap-1.5 text-[11px] cursor-pointer">
                                            <Checkbox
                                              checked={(m.allowed_tabs || []).includes(tab.key)}
                                              onCheckedChange={() => toggleTab(m.id, m.allowed_tabs || [], tab.key)}
                                            />
                                            <span>{tab.label}</span>
                                          </label>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {unassigned.length > 0 ? (
                                <Select
                                  value=""
                                  onValueChange={(projectId) => {
                                    if (projectId) addProjectAccess(u.user_id, projectId);
                                  }}
                                >
                                  <SelectTrigger className="h-8 text-xs w-full max-w-[220px]">
                                    <SelectValue placeholder="+ Добавить проект..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {unassigned.map((p) => (
                                      <SelectItem key={p.id} value={p.id}>
                                        {p.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <p className="text-[11px] text-muted-foreground">Все проекты назначены</p>
                              )}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </TabsContent>

        {/* ========== RESPONSIBLE TAB ========== */}
        <TabsContent value="responsible" className="space-y-6">
          <p className="text-sm text-muted-foreground">Назначение ответственных за проекты</p>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="space-y-2">
              {projects?.map((project) => {
                const status = allStatuses?.find((s: any) => s.project_id === project.id);
                const currentResponsible = status?.responsible || "";
                return (
                  <div key={project.id} className="flex items-center justify-between gap-3 py-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <FolderKanban className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="text-sm font-medium truncate">{project.name}</span>
                    </div>
                    <Select
                      value={currentResponsible || "__none__"}
                      onValueChange={async (val) => {
                        const responsible = val === "__none__" ? "" : val;
                        try {
                          await api.updateProjectStatus(project.id, { responsible });
                          queryClient.invalidateQueries({ queryKey: ["all-project-statuses"] });
                          toast.success("Ответственный обновлён");
                        } catch (err: any) {
                          toast.error(err.message);
                        }
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs w-48 shrink-0">
                        <SelectValue placeholder="Не назначен" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Не назначен</SelectItem>
                        {users?.map((p) => (
                          <SelectItem key={p.id} value={p.full_name || p.id}>
                            {p.full_name || p.email?.replace(/@app\.local$/, "") || p.id.slice(0, 8)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
              {(!projects || projects.length === 0) && (
                <p className="text-xs text-muted-foreground">Нет проектов</p>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ========== SUPPLIERS TAB ========== */}
        <TabsContent value="suppliers" className="space-y-6">
          <div className="flex items-center gap-3">
            <Select value={selectedProjectForSupplier} onValueChange={setSelectedProjectForSupplier}>
              <SelectTrigger className="w-64 h-9">
                <SelectValue placeholder="Выберите проект" />
              </SelectTrigger>
              <SelectContent>
                {projects?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedProjectForSupplier && (
              <div className="flex gap-2 flex-1 items-center">
                <Input
                  placeholder="Название нового поставщика"
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                  className="h-9 text-sm flex-1"
                  onKeyDown={(e) => e.key === "Enter" && addSupplier()}
                />
                <div className="flex items-center gap-2 px-3 py-1.5 border border-border rounded-md bg-background">
                  <Switch
                    id="supplier-gck"
                    checked={newSupplierIsGck}
                    onCheckedChange={setNewSupplierIsGck}
                  />
                  <label htmlFor="supplier-gck" className="text-sm font-medium cursor-pointer">
                    ГЦК
                  </label>
                </div>
                <Button size="sm" onClick={addSupplier} disabled={addingSupplier || !newSupplierName.trim()} className="gap-1">
                  <Plus className="h-3.5 w-3.5" />
                  Добавить
                </Button>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {filteredSuppliers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {selectedProjectForSupplier ? "Нет поставщиков" : "Выберите проект"}
              </p>
            ) : (
              <div className="divide-y divide-border/50">
                {filteredSuppliers.map((s) => (
                  <div key={s.id} className="px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors">
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <p className="font-medium text-sm">{s.name}</p>
                      {(s as any).is_gck && (
                        <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">ГЦК</Badge>
                      )}
                      {!selectedProjectForSupplier && <p className="text-[10px] text-muted-foreground">{getProjectName(s.project_id)}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 px-2 py-1 border border-border rounded-md bg-background">
                        <Switch
                          checked={(s as any).is_gck || false}
                          onCheckedChange={() => toggleSupplierGck(s.id, (s as any).is_gck || false)}
                          id={`supplier-gck-${s.id}`}
                        />
                        <label htmlFor={`supplier-gck-${s.id}`} className="text-[10px] text-muted-foreground cursor-pointer">
                          ГЦК
                        </label>
                      </div>
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="₽/контакт"
                        value={supplierPrices[s.id] ?? String((s as any).price_per_contact ?? 0)}
                        onChange={(e) => setSupplierPrices((prev) => ({ ...prev, [s.id]: filterNumericInput(e.target.value) }))}
                        onBlur={() => saveSupplierPrice(s.id)}
                        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                        className="h-8 w-28 text-xs"
                      />
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deleteSupplier(s.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ========== PRICING TAB (Денежные показатели) ========== */}
        <TabsContent value="pricing" className="space-y-6">
          <p className="text-sm text-muted-foreground">Показатели CPL для статусов на вкладке «Статистика» и цены за минуту по проектам</p>

          <CplTargetsSection />

          <p className="text-sm font-medium pt-2">Цена за минуту по проектам</p>
          {(!projects || projects.length === 0) ? (
            <p className="text-sm text-muted-foreground text-center py-8">Нет проектов</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((p) => {
                const vals = getPricing(p.id);
                return (
                  <div key={p.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
                    <p className="font-semibold text-sm">{p.name}</p>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Цена за минуту, ₽</label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={vals.price_per_minute}
                        onChange={(e) => setPricingState((s) => ({ ...s, [p.id]: { price_per_minute: filterNumericInput(e.target.value) } }))}
                        className="h-9 text-sm"
                      />
                    </div>
                    <Button size="sm" onClick={() => savePricing(p.id)} className="w-full">
                      Сохранить
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

      </Tabs>
    </div>
  );
}
