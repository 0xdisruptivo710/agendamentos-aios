import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Landing from "./pages/Landing.tsx";
import UnitPanel from "./pages/UnitPanel.tsx";
import NotFound from "./pages/NotFound.tsx";
import { getUnitBySlug, getUnitByHost } from "@/config/units";
import { UnitProvider } from "@/context/UnitContext";

const queryClient = new QueryClient();

function UnitRoute() {
  const { slug } = useParams();
  const unit = getUnitBySlug(slug);
  if (!unit) return <NotFound />;
  return (
    <UnitProvider unit={unit}>
      <UnitPanel />
    </UnitProvider>
  );
}

// Rota "/": num subdomínio de cliente (macae.dominio, agendamento-macae.vercel.app)
// abre direto o painel da unidade. No host raiz redireciona para /admin, que é o
// único ponto de acesso à lista de todas as unidades (não exposta aos clientes).
function RootRoute() {
  const unit = getUnitByHost(typeof window !== "undefined" ? window.location.hostname : undefined);
  if (unit) {
    return (
      <UnitProvider unit={unit}>
        <UnitPanel />
      </UnitProvider>
    );
  }
  return <Navigate to="/admin" replace />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RootRoute />} />
          <Route path="/admin" element={<Landing />} />
          <Route path="/:slug" element={<UnitRoute />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
