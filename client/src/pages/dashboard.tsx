import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DollarSign, Package, FileText, TrendingUp, Globe, Truck, Ship, ShieldCheck, BarChart3, CalendarDays, Landmark, Settings2, Layers, Navigation } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area
} from "recharts";
import type { ExportOrderWithDetails } from "@shared/schema";

type PeriodPreset = "today" | "week" | "month" | "quarter" | "semester" | "year" | "all" | "custom";

function getDateRange(preset: PeriodPreset): { startDate: string; endDate: string } {
  const now = new Date();
  const end = now.toISOString().split("T")[0];
  let start: Date;

  switch (preset) {
    case "today":
      return { startDate: end, endDate: end };
    case "week": {
      start = new Date(now);
      const day = start.getDay();
      start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
      return { startDate: start.toISOString().split("T")[0], endDate: end };
    }
    case "month":
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { startDate: start.toISOString().split("T")[0], endDate: end };
    case "quarter": {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      start = new Date(now.getFullYear(), qMonth, 1);
      return { startDate: start.toISOString().split("T")[0], endDate: end };
    }
    case "semester": {
      const sMonth = now.getMonth() < 6 ? 0 : 6;
      start = new Date(now.getFullYear(), sMonth, 1);
      return { startDate: start.toISOString().split("T")[0], endDate: end };
    }
    case "year":
      start = new Date(now.getFullYear(), 0, 1);
      return { startDate: start.toISOString().split("T")[0], endDate: end };
    case "all":
      return { startDate: "", endDate: "" };
    default:
      return { startDate: "", endDate: "" };
  }
}

const PERIOD_LABELS: { value: PeriodPreset; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "week", label: "Esta Semana" },
  { value: "month", label: "Este Mês" },
  { value: "quarter", label: "Este Trimestre" },
  { value: "semester", label: "Este Semestre" },
  { value: "year", label: "Este Ano" },
  { value: "all", label: "Histórico Global" },
];

const COLORS = [
  "#1E4D7B",
  "#2276BB",
  "#3B82F6",
  "#0EA5E9",
  "#64748B",
  "#7FAFD4",
];

const PAYMENT_COLORS: Record<string, string> = {
  Pendente: "#94A3B8",
  Pago: "#1D4ED8",
  Atrasado: "#DC2626",
};

const PARAM_COLORS: Record<string, string> = {
  Verde: "#1D4ED8",
  Amarelo: "#64748B",
  Vermelho: "#DC2626",
};

const VESSEL_STATUS_COLORS: Record<string, string> = {
  "ETD":          "#2276BB",
  "Zarpou":       "#0EA5E9",
  "Em Navegação": "#3B82F6",
  "Fundeado":     "#64748B",
  "Sem Status":   "#CBD5E1",
};

function formatCurrency(value: number | string) {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(num);
}

function StatCard({
  title,
  value,
  icon: Icon,
  subtitle,
  variant = "default",
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  subtitle?: string;
  variant?: "default" | "warning";
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={`flex h-8 w-8 items-center justify-center rounded-md ${variant === "warning" ? "bg-destructive/10" : "bg-primary/10"}`}>
          <Icon className={`h-4 w-4 ${variant === "warning" ? "text-destructive" : "text-primary"}`} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

type SectionFilter = "all" | "financeiro" | "operacional" | "diversos";

const SECTION_LABELS: { value: SectionFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "financeiro", label: "Financeiro" },
  { value: "operacional", label: "Operacional" },
  { value: "diversos", label: "Diversos" },
];

export default function Dashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodPreset>("year");
  const [selectedSection, setSelectedSection] = useState<SectionFilter>("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const dateRange = useMemo(() => {
    if (selectedPeriod === "custom") {
      return { startDate: customStart, endDate: customEnd };
    }
    return getDateRange(selectedPeriod);
  }, [selectedPeriod, customStart, customEnd]);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (dateRange.startDate) params.set("startDate", dateRange.startDate);
    if (dateRange.endDate) params.set("endDate", dateRange.endDate);
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }, [dateRange]);

  const { data: orders, isLoading } = useQuery<ExportOrderWithDetails[]>({
    queryKey: ["/api/orders"],
  });

  const { data: stats, isLoading: statsLoading } = useQuery<{
    totalRevenue: number;
    totalVolume: number;
    pendingInvoices: number;
    overdueCount: number;
    revenueByCountry: { country: string; total: number }[];
    productMix: { type: string; count: number }[];
    cashFlow: { month: string; amount: number }[];
    paymentStatusDistribution: { status: string; count: number }[];
    modalDistribution: { modal: string; count: number; total: number }[];
    parametrizacaoDistribution: { status: string; count: number }[];
    volumeByCountry: { country: string; volume: number }[];
    monthlyOrders: { month: string; count: number; total: number }[];
    revenueByClient: { client: string; total: number }[];
    revenueByProduct: { product: string; total: number }[];
    monthlyRevenueByStatus: { month: string; pago: number; pendente: number; atrasado: number }[];
    monthlyRevenueFull: { month: string; total: number }[];
    vesselStatusDistribution: { status: string; count: number; total: number }[];
    ticketMedio: number;
    totalPago: number;
    totalPendente: number;
    totalAtrasado: number;
  }>({
    queryKey: ["/api/dashboard/stats", queryParams],
    queryFn: () => fetch(`/api/dashboard/stats${queryParams}`).then((r) => r.json()),
  });

  if (isLoading || statsLoading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Visão geral das operações de exportação</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader>
              <CardContent><Skeleton className="h-8 w-32" /></CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardHeader><Skeleton className="h-4 w-40" /></CardHeader>
              <CardContent><Skeleton className="h-[250px] w-full" /></CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-dashboard-title">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Visão geral das operações de exportação</p>
        </div>
      </div>

      <Card data-testid="card-filters">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              {PERIOD_LABELS.map((period) => (
                <Button
                  key={period.value}
                  variant={selectedPeriod === period.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedPeriod(period.value)}
                  data-testid={`button-filter-${period.value}`}
                  className="text-xs"
                >
                  {period.label}
                </Button>
              ))}
              <Button
                variant={selectedPeriod === "custom" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedPeriod("custom")}
                data-testid="button-filter-custom"
                className="text-xs"
              >
                Personalizado
              </Button>
            </div>
            {selectedPeriod === "custom" && (
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="start-date" className="text-xs text-muted-foreground">Data Início</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="h-8 w-40 text-xs"
                    data-testid="input-date-start"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="end-date" className="text-xs text-muted-foreground">Data Fim</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="h-8 w-40 text-xs"
                    data-testid="input-date-end"
                  />
                </div>
              </div>
            )}
            {dateRange.startDate && (
              <p className="text-xs text-muted-foreground" data-testid="text-date-range">
                Exibindo dados de {new Date(dateRange.startDate + "T00:00:00").toLocaleDateString("pt-BR")} até {new Date(dateRange.endDate + "T00:00:00").toLocaleDateString("pt-BR")}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t">
              <Layers className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              {SECTION_LABELS.map((section) => (
                <Button
                  key={section.value}
                  variant={selectedSection === section.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedSection(section.value)}
                  data-testid={`button-section-${section.value}`}
                  className="text-xs"
                >
                  {section.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {(selectedSection === "all" || selectedSection === "operacional") && <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Navigation className="h-4 w-4 text-muted-foreground" />
              Status de Movimentação
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.vesselStatusDistribution && stats.vesselStatusDistribution.filter(d => d.status !== "Sem Status").length > 0 ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="60%" height={250}>
                  <PieChart>
                    <Pie
                      data={stats.vesselStatusDistribution.filter(d => d.status !== "Sem Status")}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="count"
                      nameKey="status"
                    >
                      {stats.vesselStatusDistribution.filter(d => d.status !== "Sem Status").map((entry) => (
                        <Cell key={entry.status} fill={VESSEL_STATUS_COLORS[entry.status] || "#94A3B8"} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => [value, "Ordens"]}
                      contentStyle={{ borderRadius: "6px", border: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-3 w-[40%]">
                  {stats.vesselStatusDistribution.map((item) => (
                    <div key={item.status} className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-sm flex-shrink-0" style={{ backgroundColor: VESSEL_STATUS_COLORS[item.status] || "#94A3B8" }} />
                      <div className="min-w-0">
                        <p className="text-xs font-medium leading-none">{item.status}</p>
                        <p className="text-xs text-muted-foreground">{item.count} ordem{item.count !== 1 ? "s" : ""}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[250px] text-muted-foreground text-sm gap-2">
                <Navigation className="h-8 w-8 opacity-30" />
                <span>Nenhum status de movimentação definido</span>
                <span className="text-xs">Defina o status nas ordens de exportação</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Ship className="h-4 w-4 text-muted-foreground" />
              Faturamento por Movimentação
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.vesselStatusDistribution && stats.vesselStatusDistribution.filter(d => d.status !== "Sem Status").length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart
                  data={stats.vesselStatusDistribution.filter(d => d.status !== "Sem Status")}
                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                  layout="vertical"
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} className="fill-muted-foreground" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="status" tick={{ fontSize: 11 }} className="fill-muted-foreground" width={90} />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), "Valor Total"]}
                    contentStyle={{ borderRadius: "6px", border: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))" }}
                  />
                  <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                    {stats.vesselStatusDistribution.filter(d => d.status !== "Sem Status").map((entry) => (
                      <Cell key={entry.status} fill={VESSEL_STATUS_COLORS[entry.status] || "#94A3B8"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-[250px] text-muted-foreground text-sm gap-2">
                <Ship className="h-8 w-8 opacity-30" />
                <span>Nenhum dado disponível</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>}

      {(selectedSection === "all" || selectedSection === "financeiro") && <>
      <div className="flex items-center gap-2 pt-2" data-testid="section-financeiro">
        <Landmark className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Financeiro</h2>
        <div className="flex-1 h-px bg-border" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Faturamento Total"
          value={formatCurrency(stats?.totalRevenue || 0)}
          icon={DollarSign}
          subtitle="Período selecionado"
        />
        <StatCard
          title="Ticket Médio"
          value={formatCurrency(stats?.ticketMedio || 0)}
          icon={DollarSign}
          subtitle="Valor médio por ordem"
        />
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Faturamento Recebido</CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-green-500/10">
              <DollarSign className="h-4 w-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-faturamento-pago">{formatCurrency(stats?.totalPago || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">Total pago no período</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Faturamento Pendente</CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-500/10">
              <DollarSign className="h-4 w-4 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600" data-testid="text-faturamento-pendente">{formatCurrency((stats?.totalPendente || 0) + (stats?.totalAtrasado || 0))}</div>
            <p className="text-xs text-muted-foreground mt-1">Pendente + atrasado</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              Faturamento por País
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.revenueByCountry && stats.revenueByCountry.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={stats.revenueByCountry} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="country" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), "Faturamento"]}
                    contentStyle={{ borderRadius: "6px", border: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))" }}
                  />
                  <Bar dataKey="total" fill="#2276BB" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">Sem dados disponíveis</div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-faturamento-status">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              Faturamento Mensal por Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.monthlyRevenueByStatus && stats.monthlyRevenueByStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={stats.monthlyRevenueByStatus} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(value: number, name: string) => [formatCurrency(value), name]}
                    contentStyle={{ borderRadius: "6px", border: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))" }}
                  />
                  <Legend />
                  <Bar dataKey="pago" stackId="a" fill="#1D4ED8" name="Pago" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="pendente" stackId="a" fill="#94A3B8" name="Pendente" />
                  <Bar dataKey="atrasado" stackId="a" fill="#DC2626" name="Atrasado" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">Sem dados disponíveis</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-faturamento-cliente">
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            Faturamento por Cliente (Top 10)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.revenueByClient && stats.revenueByClient.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.revenueByClient} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" tick={{ fontSize: 12 }} className="fill-muted-foreground" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <YAxis dataKey="client" type="category" tick={{ fontSize: 11 }} className="fill-muted-foreground" width={120} />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), "Faturamento"]}
                  contentStyle={{ borderRadius: "6px", border: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))" }}
                />
                <Bar dataKey="total" fill="#2276BB" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">Sem dados disponíveis</div>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-receita-por-mes">
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            Receita por Mês — {new Date().getFullYear()}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.monthlyRevenueFull ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={stats.monthlyRevenueFull} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="gradReceita" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2276BB" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#2276BB" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v: string) => v.split("/")[0]}
                  className="fill-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  className="fill-muted-foreground"
                  tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), "Receita"]}
                  contentStyle={{ borderRadius: "6px", border: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))" }}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#2276BB"
                  strokeWidth={2}
                  fill="url(#gradReceita)"
                  dot={{ r: 4, fill: "#2276BB", strokeWidth: 0 }}
                  activeDot={{ r: 6 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">Sem dados disponíveis</div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card data-testid="card-faturamento-produto">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              Faturamento por Produto
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.revenueByProduct && stats.revenueByProduct.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={stats.revenueByProduct} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="product" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), "Faturamento"]}
                    contentStyle={{ borderRadius: "6px", border: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))" }}
                  />
                  <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                    {stats.revenueByProduct.map((_, index) => (
                      <Cell key={`prod-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">Sem dados disponíveis</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Status de Pagamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.paymentStatusDistribution && stats.paymentStatusDistribution.length > 0 ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="60%" height={280}>
                  <PieChart>
                    <Pie
                      data={stats.paymentStatusDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={4}
                      dataKey="count"
                      nameKey="status"
                    >
                      {stats.paymentStatusDistribution.map((entry) => (
                        <Cell key={entry.status} fill={PAYMENT_COLORS[entry.status] || COLORS[0]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: "6px", border: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))" }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-2 w-[40%]">
                  {stats.paymentStatusDistribution.map((item) => (
                    <div key={item.status} className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-sm flex-shrink-0" style={{ backgroundColor: PAYMENT_COLORS[item.status] || COLORS[0] }} />
                      <span className="text-xs text-muted-foreground">{item.status} ({item.count})</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">Sem dados disponíveis</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            Projeção de Recebíveis (Cash Flow)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.cashFlow && stats.cashFlow.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={stats.cashFlow} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), "Recebíveis"]}
                  contentStyle={{ borderRadius: "6px", border: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))" }}
                />
                <Legend />
                <Line type="monotone" dataKey="amount" stroke="#2276BB" strokeWidth={2} dot={{ r: 4, fill: "#1E4D7B" }} name="Recebíveis" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">Sem dados disponíveis</div>
          )}
        </CardContent>
      </Card>

      </>}

      {(selectedSection === "all" || selectedSection === "operacional") && <>
      <div className="flex items-center gap-2 pt-4" data-testid="section-operacional">
        <Settings2 className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Operacional</h2>
        <div className="flex-1 h-px bg-border" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Volume Total"
          value={`${(stats?.totalVolume || 0).toLocaleString("pt-BR")} ton`}
          icon={Package}
          subtitle="Quantidade exportada"
        />
        <StatCard
          title="Invoices Pendentes"
          value={String(stats?.pendingInvoices || 0)}
          icon={FileText}
          subtitle="Aguardando pagamento"
        />
        <StatCard
          title="Ordens no Período"
          value={String(orders?.length || 0)}
          icon={BarChart3}
          subtitle="Total de ordens"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              Volume por País (ton)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.volumeByCountry && stats.volumeByCountry.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={stats.volumeByCountry} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="country" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" tickFormatter={(v) => `${v.toLocaleString()}`} />
                  <Tooltip
                    formatter={(value: number) => [`${value.toLocaleString("pt-BR")} ton`, "Volume"]}
                    contentStyle={{ borderRadius: "6px", border: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))" }}
                  />
                  <Bar dataKey="volume" fill="#2276BB" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">Sem dados disponíveis</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Pedidos por Mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.monthlyOrders && stats.monthlyOrders.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={stats.monthlyOrders} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                  <YAxis yAxisId="left" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} className="fill-muted-foreground" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      name === "Qtd" ? value : formatCurrency(value),
                      name,
                    ]}
                    contentStyle={{ borderRadius: "6px", border: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))" }}
                  />
                  <Legend />
                  <Area yAxisId="left" type="monotone" dataKey="count" stroke="#2276BB" fill="#2276BB" fillOpacity={0.15} strokeWidth={2} name="Qtd" />
                  <Area yAxisId="right" type="monotone" dataKey="total" stroke="#64748B" fill="#64748B" fillOpacity={0.12} strokeWidth={2} name="Valor Total" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">Sem dados disponíveis</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Truck className="h-4 w-4 text-muted-foreground" />
              Modal de Transporte
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.modalDistribution && stats.modalDistribution.length > 0 ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="60%" height={250}>
                  <PieChart>
                    <Pie
                      data={stats.modalDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="count"
                      nameKey="modal"
                    >
                      {stats.modalDistribution.map((_, index) => (
                        <Cell key={`modal-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: "6px", border: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))" }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-2 w-[40%]">
                  {stats.modalDistribution.map((item, i) => (
                    <div key={item.modal} className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-sm flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-xs text-muted-foreground">{item.modal} ({item.count})</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">Sem dados disponíveis</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              Parametrização
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.parametrizacaoDistribution && stats.parametrizacaoDistribution.length > 0 ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="60%" height={250}>
                  <PieChart>
                    <Pie
                      data={stats.parametrizacaoDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="count"
                      nameKey="status"
                    >
                      {stats.parametrizacaoDistribution.map((entry) => (
                        <Cell key={entry.status} fill={PARAM_COLORS[entry.status] || COLORS[0]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: "6px", border: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))" }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-2 w-[40%]">
                  {stats.parametrizacaoDistribution.map((item) => (
                    <div key={item.status} className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-sm flex-shrink-0" style={{ backgroundColor: PARAM_COLORS[item.status] || COLORS[0] }} />
                      <span className="text-xs text-muted-foreground">{item.status} ({item.count})</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">Sem dados disponíveis</div>
            )}
          </CardContent>
        </Card>
      </div>

      </>}

      {(selectedSection === "all" || selectedSection === "diversos") && <>
      <div className="flex items-center gap-2 pt-4" data-testid="section-diversos">
        <Layers className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Diversos</h2>
        <div className="flex-1 h-px bg-border" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            Mix de Produtos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.productMix && stats.productMix.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="60%" height={280}>
                <PieChart>
                  <Pie
                    data={stats.productMix}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={4}
                    dataKey="count"
                    nameKey="type"
                  >
                    {stats.productMix.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: "6px", border: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))" }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-2 w-[40%]">
                {stats.productMix.map((item, i) => (
                  <div key={item.type} className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-sm flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-xs text-muted-foreground truncate">{item.type}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">Sem dados disponíveis</div>
          )}
        </CardContent>
      </Card>
      </>}
    </div>
  );
}
