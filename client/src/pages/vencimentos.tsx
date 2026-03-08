import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, CalendarClock, CheckCircle, Search, DollarSign, Clock, TrendingDown } from "lucide-react";
import type { ExportOrderWithDetails } from "@shared/schema";

function formatCurrency(value: number | string) {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD" }).format(num);
}

function formatDate(date: string | Date | null | undefined) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("pt-BR");
}

const statusLabels: Record<string, string> = {
  pendente: "Pendente",
  pago: "Pago",
  atrasado: "Atrasado",
};

const statusColors: Record<string, string> = {
  pendente: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  pago: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  atrasado: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

function getDueDateUrgency(dueDate: string | null | undefined, statusPagamento: string) {
  if (statusPagamento === "pago") return { label: "Pago", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300", icon: CheckCircle, priority: 4 };
  if (!dueDate) return { label: "Sem vencimento", color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300", icon: CalendarClock, priority: 3 };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { label: `Vencido ha ${Math.abs(diffDays)} dia(s)`, color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300", icon: AlertTriangle, priority: 0 };
  if (diffDays <= 2) return { label: `Vence em ${diffDays} dia(s)`, color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300", icon: AlertTriangle, priority: 1 };
  if (diffDays <= 7) return { label: `Vence em ${diffDays} dias`, color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300", icon: CalendarClock, priority: 2 };
  return { label: `Vence em ${diffDays} dias`, color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300", icon: CalendarClock, priority: 3 };
}

export default function Vencimentos() {
  const { data: orders, isLoading } = useQuery<ExportOrderWithDetails[]>({ queryKey: ["/api/orders"] });
  const [search, setSearch] = useState("");
  const [filterUrgency, setFilterUrgency] = useState("all");
  const [filterCountry, setFilterCountry] = useState("all");

  const dueDateOrders = useMemo(() => {
    if (!orders) return [];
    return orders
      .filter((o) => o.statusPagamento !== "pago")
      .map((o) => ({
        ...o,
        urgency: getDueDateUrgency(o.dueDate, o.statusPagamento),
      }))
      .sort((a, b) => a.urgency.priority - b.urgency.priority ||
        (a.dueDate && b.dueDate ? new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime() : a.dueDate ? -1 : 1));
  }, [orders]);

  const countries = useMemo(() => {
    const set = new Set<string>();
    dueDateOrders.forEach((o) => { if (o.client?.country) set.add(o.client.country); });
    return Array.from(set).sort();
  }, [dueDateOrders]);

  const filtered = dueDateOrders.filter((o) => {
    if (filterUrgency === "vencido" && o.urgency.priority !== 0) return false;
    if (filterUrgency === "urgente" && o.urgency.priority > 1) return false;
    if (filterUrgency === "proximo" && o.urgency.priority > 2) return false;
    if (filterCountry !== "all" && o.client?.country !== filterCountry) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        o.invoice.toLowerCase().includes(q) ||
        o.client?.name?.toLowerCase().includes(q) ||
        o.product?.type?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const overdueCount = dueDateOrders.filter((o) => o.urgency.priority === 0).length;
  const urgentCount = dueDateOrders.filter((o) => o.urgency.priority <= 1).length;
  const overdueTotal = dueDateOrders.filter((o) => o.urgency.priority === 0).reduce((s, o) => s + parseFloat(o.total), 0);
  const allPendingTotal = dueDateOrders.reduce((s, o) => s + parseFloat(o.total), 0);
  const next7DaysCount = dueDateOrders.filter((o) => o.urgency.priority <= 2).length;

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-vencimentos-title">Vencimentos</h1>
        <p className="text-muted-foreground text-sm">Controle de vencimentos de faturas pendentes</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Pendente</p>
            </div>
            <p className="text-2xl font-bold" data-testid="text-venc-pending-count">{dueDateOrders.length}</p>
            <p className="text-xs text-muted-foreground mt-1">faturas em aberto</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
              <p className="text-xs text-red-600 dark:text-red-400 uppercase tracking-wide">Vencidos</p>
            </div>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400" data-testid="text-venc-overdue-count">{overdueCount}</p>
            <p className="text-xs text-red-500 dark:text-red-400 mt-1">{formatCurrency(overdueTotal)}</p>
          </CardContent>
        </Card>
        <Card className="border-orange-200 dark:border-orange-800">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              <p className="text-xs text-orange-600 dark:text-orange-400 uppercase tracking-wide">Urgentes (48h)</p>
            </div>
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400" data-testid="text-venc-urgent-count">{urgentCount}</p>
            <p className="text-xs text-muted-foreground mt-1">vencem em ate 2 dias</p>
          </CardContent>
        </Card>
        <Card className="border-yellow-200 dark:border-yellow-800">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <CalendarClock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              <p className="text-xs text-yellow-600 dark:text-yellow-400 uppercase tracking-wide">Proximos 7 dias</p>
            </div>
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400" data-testid="text-venc-7days-count">{next7DaysCount}</p>
            <p className="text-xs text-muted-foreground mt-1">vencem em ate 7 dias</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Valor Total</p>
            </div>
            <p className="text-xl font-bold font-mono" data-testid="text-venc-total-value">{formatCurrency(allPendingTotal)}</p>
            <p className="text-xs text-muted-foreground mt-1">pendente de pagamento</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-end gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por invoice, cliente, produto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-vencimentos"
          />
        </div>
        <Select value={filterUrgency} onValueChange={setFilterUrgency}>
          <SelectTrigger className="w-[200px]" data-testid="select-filter-urgency">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Vencimentos</SelectItem>
            <SelectItem value="vencido">Vencidos</SelectItem>
            <SelectItem value="urgente">Urgentes (ate 48h)</SelectItem>
            <SelectItem value="proximo">Proximos (ate 7 dias)</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterCountry} onValueChange={setFilterCountry}>
          <SelectTrigger className="w-[180px]" data-testid="select-filter-country">
            <SelectValue placeholder="Todos os Paises" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Paises</SelectItem>
            {countries.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
            <h3 className="text-lg font-medium mb-1">Nenhum vencimento pendente</h3>
            <p className="text-sm text-muted-foreground">Todos os pagamentos estao em dia.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Urgencia</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Pais</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((order) => {
                  const UrgencyIcon = order.urgency.icon;
                  return (
                    <TableRow key={order.id} data-testid={`row-vencimento-${order.id}`}>
                      <TableCell>
                        <Badge variant="secondary" className={`${order.urgency.color} gap-1`} data-testid={`badge-urgency-${order.id}`}>
                          <UrgencyIcon className="h-3 w-3" />
                          {order.urgency.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium font-mono">{order.invoice}</TableCell>
                      <TableCell>{order.client?.name}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center justify-center rounded bg-muted text-muted-foreground text-xs font-medium px-1.5 py-0.5">
                          {order.client?.country}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{order.product?.type}</TableCell>
                      <TableCell className="font-medium">{formatDate(order.dueDate)}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{formatCurrency(order.total)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{order.paymentTerms || "-"}</TableCell>
                      <TableCell>
                        <Badge className={statusColors[order.statusPagamento]} variant="secondary">
                          {statusLabels[order.statusPagamento]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
