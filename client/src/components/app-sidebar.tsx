import { LayoutDashboard, Users, Package, FileText, CircleDollarSign, Factory, ClipboardList, FileCheck, CalendarClock, TrendingUp, UserCog, Globe, FolderLock, ShieldCheck, AlertTriangle, BrainCircuit, SlidersHorizontal, BellRing, UserCircle2, ChevronDown, Percent, Map } from "lucide-react";
import logoPath from "@assets/Captura_de_tela_2026-02-27_111909_1772203458683.png";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrentUser } from "@/hooks/use-current-user";
import type { PlatformUser } from "@shared/schema";

const mainItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Consulta Inteligente", url: "/query-ai", icon: BrainCircuit },
  { title: "Exposicao Cambial", url: "/exposicao-cambial", icon: TrendingUp },
  { title: "Relatórios", url: "/reports", icon: ClipboardList },
];

const financeiroItems = [
  { title: "Vencimentos", url: "/vencimentos", icon: CalendarClock },
  { title: "Comissões", url: "/commissions", icon: Percent },
];

const operacaoStaticItems = [
  { title: "Cotações", url: "/quotations", icon: FileCheck },
  { title: "Ordens de Exportação", url: "/orders", icon: FileText },
  { title: "Rastreabilidade", url: "/rastreabilidade", icon: Globe },
  { title: "Documentação Cambial", url: "/documentos", icon: FolderLock },
  { title: "Câmbio", url: "/quotes", icon: CircleDollarSign },
  { title: "Maps", url: "/maps", icon: Map },
];

const cadastroItems = [
  { title: "Clientes", url: "/clients", icon: Users },
  { title: "Fornecedores", url: "/suppliers", icon: Factory },
  { title: "Produtos", url: "/products", icon: Package },
  { title: "Usuários", url: "/platform-users", icon: UserCog },
  { title: "Calibragem de IA", url: "/calibragem-ia", icon: SlidersHorizontal },
  { title: "Notificações Telegram", url: "/telegram-config", icon: BellRing },
];

function MenuGroup({ items, location }: { items: { title: string; url: string; icon: React.ElementType }[]; location: string }) {
  return (
    <SidebarMenu>
      {items.map((item) => {
        const isActive = location === item.url || (item.url !== "/" && location.startsWith(item.url));
        return (
          <SidebarMenuItem key={item.title}>
            <SidebarMenuButton asChild isActive={isActive} className={isActive ? "font-semibold" : ""}>
              <Link href={item.url} data-testid={`link-nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
                <item.icon className="h-4 w-4" />
                <span>{item.title}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

function LpcoMenuItem({ location }: { location: string }) {
  const { data: lpcoItems = [] } = useQuery<any[]>({
    queryKey: ["/api/lpco"],
    refetchInterval: 5 * 60 * 1000,
  });

  const today = new Date();
  const in90Days = new Date(today);
  in90Days.setDate(today.getDate() + 90);

  const alertCount = lpcoItems.filter((item) => {
    if (!item.dataValidade || item.status === "suspenso") return false;
    const expiry = new Date(item.dataValidade);
    return expiry <= in90Days;
  }).length;

  const isActive = location === "/lpco";

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive} className={isActive ? "font-semibold" : ""}>
        <Link href="/lpco" data-testid="link-nav-gestão-lpco">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          <span className="flex-1">Gestão LPCO</span>
          {alertCount > 0 && (
            <span
              className="ml-auto flex items-center gap-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white leading-none"
              title={`${alertCount} LPCO(s) vencendo em até 90 dias`}
            >
              <AlertTriangle className="h-2.5 w-2.5" />
              {alertCount}
            </span>
          )}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function UserSelector({ collapsed }: { collapsed: boolean }) {
  const { currentUser, users, selectUser } = useCurrentUser();

  if (collapsed) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="flex items-center justify-center w-full p-1 rounded-md hover:bg-sidebar-accent transition-colors"
            data-testid="button-user-selector"
            title={currentUser ? currentUser.name : "Selecionar usuário"}
          >
            <UserCircle2 className={`h-5 w-5 ${currentUser ? "text-primary" : "text-muted-foreground"}`} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="end" className="w-52">
          <DropdownMenuLabel className="text-xs">Usuário ativo</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {users.filter((u: PlatformUser) => u.status === "ativo").map((u: PlatformUser) => (
            <DropdownMenuItem
              key={u.id}
              onClick={() => selectUser(u.id)}
              className={currentUser?.id === u.id ? "font-semibold bg-primary/10" : ""}
              data-testid={`option-user-${u.id}`}
            >
              {u.name}
            </DropdownMenuItem>
          ))}
          {currentUser && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => selectUser(null)} className="text-muted-foreground text-xs">
                Sair
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-2 w-full px-2 py-2 rounded-md hover:bg-sidebar-accent transition-colors text-left"
          data-testid="button-user-selector"
        >
          <UserCircle2 className={`h-4 w-4 shrink-0 ${currentUser ? "text-primary" : "text-muted-foreground"}`} />
          <div className="flex-1 min-w-0">
            {currentUser ? (
              <>
                <p className="text-xs font-medium truncate leading-tight">{currentUser.name}</p>
                <p className="text-[10px] text-muted-foreground truncate leading-tight capitalize">{currentUser.role}</p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Selecionar usuário</p>
            )}
          </div>
          <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-52">
        <DropdownMenuLabel className="text-xs">Usuário ativo</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {users.filter((u: PlatformUser) => u.status === "ativo").map((u: PlatformUser) => (
          <DropdownMenuItem
            key={u.id}
            onClick={() => selectUser(u.id)}
            className={currentUser?.id === u.id ? "font-semibold bg-primary/10" : ""}
            data-testid={`option-user-${u.id}`}
          >
            <div>
              <p className="text-sm">{u.name}</p>
              <p className="text-xs text-muted-foreground capitalize">{u.role}</p>
            </div>
          </DropdownMenuItem>
        ))}
        {currentUser && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => selectUser(null)} className="text-muted-foreground text-xs">
              Sair / Trocar usuário
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppSidebar() {
  const [location] = useLocation();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className={collapsed ? "p-2" : "p-4"}>
        <div className="flex flex-col items-center">
          <img src={logoPath} alt="Hypertrade" className={`${collapsed ? "h-6" : "h-16"} w-auto object-contain transition-all`} data-testid="img-logo" />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <MenuGroup items={mainItems} location={location} />
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Operação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {operacaoStaticItems.slice(0, 4).map((item) => {
                const isActive = location === item.url || (item.url !== "/" && location.startsWith(item.url));
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive} className={isActive ? "font-semibold" : ""}>
                      <Link href={item.url} data-testid={`link-nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              <LpcoMenuItem location={location} />
              {operacaoStaticItems.slice(4).map((item) => {
                const isActive = location === item.url || (item.url !== "/" && location.startsWith(item.url));
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive} className={isActive ? "font-semibold" : ""}>
                      <Link href={item.url} data-testid={`link-nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Financeiro</SidebarGroupLabel>
          <SidebarGroupContent>
            <MenuGroup items={financeiroItems} location={location} />
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Cadastros</SidebarGroupLabel>
          <SidebarGroupContent>
            <MenuGroup items={cadastroItems} location={location} />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className={collapsed ? "p-1 space-y-1" : "p-3 space-y-2"}>
        <UserSelector collapsed={collapsed} />
        {!collapsed && <p className="text-[10px] text-sidebar-foreground/40 text-center">Hypertrade - ERP de Exportação</p>}
      </SidebarFooter>
    </Sidebar>
  );
}
