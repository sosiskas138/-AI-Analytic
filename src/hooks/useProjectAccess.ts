import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

export const ALL_TABS = [
  { key: "dashboard", label: "Дашборд" },
  { key: "calls", label: "Звонки" },
  { key: "imports", label: "Импорт" },
  { key: "call-lists", label: "Колл-листы" },
  { key: "suppliers", label: "Базы" },
  { key: "export", label: "ГЦК" },
  { key: "status", label: "Статус" },
] as const;

export type TabKey = (typeof ALL_TABS)[number]["key"];

export function useProjectAccess(projectId?: string) {
  const { user, isAdmin, canManageBases } = useAuth();

  const { data: membersData } = useQuery({
    queryKey: ["project-membership", projectId, user?.id],
    queryFn: async () => {
      const response = await api.getProjectMembers(projectId!);
      return response.members.find((m: any) => m.user_id === user!.id);
    },
    enabled: !!projectId && !!user && !isAdmin,
  });

  if (isAdmin) {
    return {
      allowedTabs: ALL_TABS.map((t) => t.key) as TabKey[],
      hasTab: (_tab: TabKey) => true,
      canCreateSuppliers: true,
    };
  }

  const allowedTabs = (membersData?.allowed_tabs as TabKey[]) || [];
  const canCreateSuppliers = !!(membersData as any)?.can_create_suppliers || !!canManageBases;

  return {
    allowedTabs,
    hasTab: (tab: TabKey) => allowedTabs.includes(tab),
    canCreateSuppliers,
  };
}
