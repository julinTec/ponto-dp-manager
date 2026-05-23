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
import GeminiTest from "./pages/GeminiTest";
import AiTest from "./pages/AiTest";
import Empresa from "./pages/gestor/Empresa";
import RelatoriosPonto from "./pages/gestor/RelatoriosPonto";
import BaterPonto from "./pages/funcionario/BaterPonto";
import MeuHistorico from "./pages/funcionario/MeuHistorico";
import MinhasJustificativas from "./pages/funcionario/MinhasJustificativas";
import MinhasSolicitacoes from "./pages/funcionario/MinhasSolicitacoes";
import MeusDocumentos from "./pages/funcionario/MeusDocumentos";
import FichaFuncionario from "./pages/FichaFuncionario";
import FechamentoMensal from "./pages/FechamentoMensal";
import Aprovacoes from "./pages/Aprovacoes";

const queryClient = new QueryClient();

const GESTOR = ["super_admin", "admin", "dp", "gestor", "revisor"] as const;
const DP = ["super_admin", "admin", "dp"] as const;
const FUNC = ["funcionario"] as const;

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />

          {/* Funcionário */}
          <Route path="/ponto" element={<ProtectedRoute allow={[...FUNC]}><BaterPonto /></ProtectedRoute>} />
          <Route path="/meu-historico" element={<ProtectedRoute allow={[...FUNC]}><MeuHistorico /></ProtectedRoute>} />
          <Route path="/minhas-justificativas" element={<ProtectedRoute allow={[...FUNC]}><MinhasJustificativas /></ProtectedRoute>} />
          <Route path="/minhas-solicitacoes" element={<ProtectedRoute allow={[...FUNC]}><MinhasSolicitacoes /></ProtectedRoute>} />
          <Route path="/meus-documentos" element={<ProtectedRoute allow={[...FUNC]}><MeusDocumentos /></ProtectedRoute>} />

          {/* Gestor */}
          <Route path="/" element={<ProtectedRoute allow={[...GESTOR]}><Dashboard /></ProtectedRoute>} />
          <Route path="/lotes" element={<ProtectedRoute allow={[...GESTOR]}><Lotes /></ProtectedRoute>} />
          <Route path="/lotes/novo" element={<ProtectedRoute allow={[...GESTOR]}><NovoLote /></ProtectedRoute>} />
          <Route path="/lotes/:id/revisao" element={<ProtectedRoute allow={[...GESTOR]}><Revisao /></ProtectedRoute>} />
          <Route path="/funcionarios" element={<ProtectedRoute allow={[...GESTOR]}><Funcionarios /></ProtectedRoute>} />
          <Route path="/funcionarios/:id" element={<ProtectedRoute allow={[...GESTOR]}><FichaFuncionario /></ProtectedRoute>} />
          <Route path="/fechamento" element={<ProtectedRoute allow={[...DP]}><FechamentoMensal /></ProtectedRoute>} />
          <Route path="/aprovacoes" element={<ProtectedRoute allow={[...GESTOR]}><Aprovacoes /></ProtectedRoute>} />
          <Route path="/relatorios" element={<ProtectedRoute allow={[...GESTOR]}><Relatorios /></ProtectedRoute>} />
          <Route path="/admissoes" element={<ProtectedRoute allow={[...GESTOR]}><Admissoes /></ProtectedRoute>} />
          <Route path="/admissoes/:id" element={<ProtectedRoute allow={[...GESTOR]}><AdmissaoDetalhe /></ProtectedRoute>} />
          <Route path="/documentos" element={<ProtectedRoute allow={[...GESTOR]}><Documentos /></ProtectedRoute>} />
          <Route path="/usuarios" element={<ProtectedRoute allow={["super_admin","admin","dp"]}><Usuarios /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute allow={["super_admin"]}><SuperAdmin /></ProtectedRoute>} />
          <Route path="/gestor/empresa" element={<ProtectedRoute allow={[...DP]}><Empresa /></ProtectedRoute>} />
          <Route path="/gestor/relatorios-ponto" element={<ProtectedRoute allow={[...GESTOR]}><RelatoriosPonto /></ProtectedRoute>} />

          <Route path="/gemini" element={<GeminiTest />} />
          <Route path="/ai-test" element={<AiTest />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
