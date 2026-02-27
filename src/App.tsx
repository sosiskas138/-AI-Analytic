import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import DashboardLayout from "@/layouts/DashboardLayout";
import Login from "@/pages/Login";
import Projects from "@/pages/Projects";
import ProjectDashboard from "@/pages/ProjectDashboard";
import ProjectCalls from "@/pages/ProjectCalls";
import ProjectImports from "@/pages/ProjectImports";
import ProjectCallLists from "@/pages/ProjectCallLists";
import ProjectCallListDetail from "@/pages/ProjectCallListDetail";
import ProjectSuppliersGCK from "@/pages/ProjectSuppliersGCK";
import ProjectReport from "@/pages/ProjectReport";
import Admin from "@/pages/Admin";
import AdminProjectStatuses from "@/pages/AdminProjectStatuses";
import ProjectStatus from "@/pages/ProjectStatus";
import Reanimation from "@/pages/Reanimation";
import Statistics from "@/pages/Statistics";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Navigate to="/projects" replace />} />
            <Route
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/projects" element={<Projects />} />
              <Route path="/projects/:projectId/dashboard" element={<ProjectDashboard />} />
              <Route path="/projects/:projectId/calls" element={<ProjectCalls />} />
              <Route path="/projects/:projectId/imports" element={<ProjectImports />} />
              <Route path="/projects/:projectId/reports/call-lists" element={<ProjectCallLists />} />
              <Route path="/projects/:projectId/reports/call-lists/:callListName" element={<ProjectCallListDetail />} />
              <Route path="/projects/:projectId/reports/suppliers" element={<ProjectSuppliersGCK />} />
              <Route path="/projects/:projectId/reports/export" element={<ProjectReport />} />
              <Route path="/projects/:projectId/status" element={<ProjectStatus />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/admin/project-statuses" element={<AdminProjectStatuses />} />
              <Route path="/reanimation" element={<Reanimation />} />
              <Route path="/statistics" element={<Statistics />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
