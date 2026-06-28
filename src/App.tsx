import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { RealtimeProvider } from "@/components/realtime/RealtimeProvider";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import TermsOfUse from "./pages/TermsOfUse";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import NotFound from "./pages/NotFound";
import CRM from "./pages/CRM";
import LeadDetail from "./pages/LeadDetail";
import Auth from "./pages/Auth";
import AdminShell from "./pages/AdminShell";
import Settings from "./pages/Settings";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <RealtimeProvider>
      <WorkspaceProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<AdminShell />}>
                <Route index element={<Navigate to="/crm" replace />} />
                <Route path="crm" element={<CRM />} />
                <Route path="crm/:id" element={<LeadDetail />} />
                <Route path="settings" element={<Settings />} />
              </Route>
              <Route path="/termos" element={<TermsOfUse />} />
              <Route path="/privacidade" element={<PrivacyPolicy />} />
              <Route path="/auth" element={<Auth />} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </WorkspaceProvider>
    </RealtimeProvider>
  </QueryClientProvider>
);

export default App;
