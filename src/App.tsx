import { useState, useCallback } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import SplashScreen from "./components/SplashScreen";
import AppLayout from "./components/AppLayout";
import TemplatesPage from "./pages/Templates";
import EditorPage from "./pages/Editor";
import ProductionPage from "./pages/Production";
import HistoryPage from "./pages/History";
import FontsPage from "./pages/Fonts";


import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  const [showSplash, setShowSplash] = useState(true);
  const handleSplashFinish = useCallback(() => setShowSplash(false), []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Sonner />
        {showSplash && <SplashScreen onFinish={handleSplashFinish} />}
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<TemplatesPage />} />
              <Route path="/editor/:templateId" element={<EditorPage />} />
              <Route path="/production" element={<ProductionPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/fonts" element={<FontsPage />} />


            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
