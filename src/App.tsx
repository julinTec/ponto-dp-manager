import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Lotes from "./pages/Lotes";
import NovoLote from "./pages/NovoLote";
import Revisao from "./pages/Revisao";
import Funcionarios from "./pages/Funcionarios";
import Relatorios from "./pages/Relatorios";
import Usuarios from "./pages/Usuarios";
import Admissoes from "./pages/Admissoes";
import AdmissaoDetalhe from "./pages/AdmissaoDetalhe";
import Documentos from "./pages/Documentos";
import SuperAdmin from "./pages/SuperAdmin";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/lotes" element={<ProtectedRoute><Lotes /></ProtectedRoute>} />
          <Route path="/lotes/novo" element={<ProtectedRoute><NovoLote /></ProtectedRoute>} />
          <Route path="/lotes/:id/revisao" element={<ProtectedRoute><Revisao /></ProtectedRoute>} />
          <Route path="/funcionarios" element={<ProtectedRoute><Funcionarios /></ProtectedRoute>} />
          <Route path="/relatorios" element={<ProtectedRoute><Relatorios /></ProtectedRoute>} />
          <Route path="/admissoes" element={<ProtectedRoute><Admissoes /></ProtectedRoute>} />
          <Route path="/admissoes/:id" element={<ProtectedRoute><AdmissaoDetalhe /></ProtectedRoute>} />
          <Route path="/documentos" element={<ProtectedRoute><Documentos /></ProtectedRoute>} />
          <Route path="/usuarios" element={<ProtectedRoute><Usuarios /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><SuperAdmin /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
