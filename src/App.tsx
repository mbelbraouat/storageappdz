import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import NewArchive from "./pages/NewArchive";
import ArchivesList from "./pages/ArchivesList";
import ArchiveDetail from "./pages/ArchiveDetail";
import BoxesPage from "./pages/BoxesPage";
import ScanQR from "./pages/ScanQR";
import AdminDashboard from "./pages/admin/AdminDashboard";
import UsersManagement from "./pages/admin/UsersManagement";
import DoctorsManagement from "./pages/admin/DoctorsManagement";
import OperationsManagement from "./pages/admin/OperationsManagement";
import FileTypesManagement from "./pages/admin/FileTypesManagement";
import SystemSettings from "./pages/admin/SystemSettings";
import NotificationsSettings from "./pages/admin/NotificationsSettings";
import RolesManagement from "./pages/admin/RolesManagement";
import ScannerSettings from "./pages/admin/ScannerSettings";
import SterilizationTechniques from "./pages/admin/SterilizationTechniques";
import SterilizationPage from "./pages/sterilization/SterilizationPage";
import SterilizationDashboard from "./pages/sterilization/SterilizationDashboard";
import InstrumentsList from "./pages/sterilization/InstrumentsList";
import SterilizationCycles from "./pages/sterilization/SterilizationCycles";
import ExpiringBoxes from "./pages/sterilization/ExpiringBoxes";
import BoxHistory from "./pages/sterilization/BoxHistory";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/archives/new" element={<NewArchive />} />
            <Route path="/archives" element={<ArchivesList />} />
            <Route path="/archives/:id" element={<ArchiveDetail />} />
            <Route path="/boxes" element={<BoxesPage />} />
            <Route path="/scan" element={<ScanQR />} />
            <Route path="/sterilization" element={<SterilizationPage />} />
            <Route path="/sterilization/dashboard" element={<SterilizationDashboard />} />
            <Route path="/sterilization/instruments" element={<InstrumentsList />} />
            <Route path="/sterilization/cycles" element={<SterilizationCycles />} />
            <Route path="/sterilization/expiring" element={<ExpiringBoxes />} />
            <Route path="/sterilization/history/:boxId" element={<BoxHistory />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/users" element={<UsersManagement />} />
            <Route path="/admin/roles" element={<RolesManagement />} />
            <Route path="/admin/doctors" element={<DoctorsManagement />} />
            <Route path="/admin/operations" element={<OperationsManagement />} />
            <Route path="/admin/file-types" element={<FileTypesManagement />} />
            <Route path="/admin/sterilization-techniques" element={<SterilizationTechniques />} />
            <Route path="/admin/settings" element={<SystemSettings />} />
            <Route path="/admin/scanner" element={<ScannerSettings />} />
            <Route path="/admin/notifications" element={<NotificationsSettings />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
