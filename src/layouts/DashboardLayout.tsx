import { Outlet, useParams, useLocation, useNavigate } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState } from "react";
import { Menu, ArrowLeft } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

export default function DashboardLayout() {
  const { projectId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);
  const fromStatistics = location.state?.from === "/statistics";

  return (
    <div className="flex min-h-screen w-full">
      {/* Desktop sidebar */}
      {!isMobile && <AppSidebar projectId={projectId} />}

      <div className="flex-1 flex flex-col overflow-x-hidden">
        {/* Mobile header */}
        {isMobile && (
          <header className="sticky top-0 z-40 flex items-center gap-3 h-14 px-4 border-b border-border bg-background/95 backdrop-blur-sm">
            <button
              onClick={() => setMobileOpen(true)}
              className="p-2 -ml-2 rounded-lg hover:bg-muted transition-colors"
            >
              <Menu className="h-5 w-5" />
            </button>
          </header>
        )}

        <main className="flex-1">
          <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
            {projectId && fromStatistics && (
              <div className="mb-4">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 -ml-2 text-muted-foreground hover:text-foreground"
                  onClick={() => navigate("/statistics")}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Назад к статистике
                </Button>
              </div>
            )}
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile sidebar sheet */}
      {isMobile && (
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="p-0 w-[280px]">
            <SheetTitle className="sr-only">Навигация</SheetTitle>
            <AppSidebar projectId={projectId} onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
