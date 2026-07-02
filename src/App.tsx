import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useParams } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Landing from "./pages/Landing.tsx";
import UnitPanel from "./pages/UnitPanel.tsx";
import NotFound from "./pages/NotFound.tsx";
import { getUnitBySlug } from "@/config/units";
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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/:slug" element={<UnitRoute />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
