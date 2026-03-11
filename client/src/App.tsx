import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Orders from "@/pages/orders";
import Clients from "@/pages/clients";
import Products from "@/pages/products";
import Suppliers from "@/pages/suppliers";
import Quotes from "@/pages/quotes";
import Reports from "@/pages/reports";
import Quotations from "@/pages/quotations";
import Vencimentos from "@/pages/vencimentos";
import ExposicaoCambial from "@/pages/exposicao-cambial";
import PlatformUsers from "@/pages/platform-users";
import Rastreabilidade from "@/pages/rastreabilidade";
import Documentos from "@/pages/documentos";
import LpcoPage from "@/pages/lpco";
import QueryAI from "@/pages/query-ai";
import CalibragemIA from "@/pages/calibragem-ia";
import TelegramConfig from "@/pages/telegram-config";
import Commissions from "@/pages/commissions";
import PortalLogin from "@/pages/portal-login";
import PortalDashboard from "@/pages/portal-dashboard";

function PortalRouter() {
  return (
    <Switch>
      <Route path="/portal/login" component={PortalLogin} />
      <Route path="/portal" component={PortalDashboard} />
    </Switch>
  );
}

function MainRouter() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/orders" component={Orders} />
      <Route path="/clients" component={Clients} />
      <Route path="/products" component={Products} />
      <Route path="/suppliers" component={Suppliers} />
      <Route path="/quotations" component={Quotations} />
      <Route path="/vencimentos" component={Vencimentos} />
      <Route path="/exposicao-cambial" component={ExposicaoCambial} />
      <Route path="/quotes" component={Quotes} />
      <Route path="/reports" component={Reports} />
      <Route path="/platform-users" component={PlatformUsers} />
      <Route path="/rastreabilidade" component={Rastreabilidade} />
      <Route path="/documentos" component={Documentos} />
      <Route path="/lpco" component={LpcoPage} />
      <Route path="/query-ai" component={QueryAI} />
      <Route path="/calibragem-ia" component={CalibragemIA} />
      <Route path="/telegram-config" component={TelegramConfig} />
      <Route path="/commissions" component={Commissions} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppInner() {
  const [location] = useLocation();
  const isPortal = location.startsWith("/portal");

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  if (isPortal) {
    return <PortalRouter />;
  }

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center justify-between gap-2 p-2 border-b sticky top-0 z-50 bg-background">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto">
            <MainRouter />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AppInner />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
