import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { RealtimeProvider } from "@/components/realtime/RealtimeProvider";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import { UndoProvider } from "@/contexts/UndoContext";
import TermsOfUse from "./pages/TermsOfUse";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import NotFound from "./pages/NotFound";
import CRM from "./pages/CRM";
import LeadDetail from "./pages/LeadDetail";
import Auth from "./pages/Auth";
import AdminShell from "./pages/AdminShell";
import Settings from "./pages/Settings";
import Mail from "./pages/Mail";
import MailTemplates from "./pages/MailTemplates";
import MailDisparo from "./pages/MailDisparo";
import EbookDownload from "./pages/EbookDownload";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <RealtimeProvider>
      <WorkspaceProvider>
        <UndoProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<AdminShell />}>
                <Route index element={<Navigate to="/crm" replace />} />
                <Route path="crm" element={<CRM />} />
                <Route path="crm/:id" element={<LeadDetail />} />
                <Route path="mail" element={<Mail />} />
                <Route path="mail/templates" element={<MailTemplates />} />
                <Route path="mail/disparo" element={<MailDisparo />} />
                <Route path="settings" element={<Settings />} />
              </Route>
              <Route path="/ebook/:id" element={<EbookDownload />} />
              <Route path="/termos" element={<TermsOfUse />} />
              <Route path="/privacidade" element={<PrivacyPolicy />} />
              <Route path="/auth" element={<Auth />} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
        </UndoProvider>
      </WorkspaceProvider>
    </RealtimeProvider>
  </QueryClientProvider>
);

export default App;
