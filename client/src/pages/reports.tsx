import { Fragment, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Search, ChevronDown, ChevronRight, Ship, Truck, Clock, FileText, ArrowRight, AlertTriangle, CalendarClock, CheckCircle, DollarSign, ShoppingCart } from "lucide-react";
import type { ExportOrderWithDetails, OrderAuditLogEntry } from "@shared/schema";

function formatCurrency(value: number | string) {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(num);
}

function formatDate(date: string | null | undefined) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("pt-BR");
}

function formatDateTime(date: string | Date | null | undefined) {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const paramColors: Record<string, string> = {
  verde: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  amarelo: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  vermelho: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

const statusColors: Record<string, string> = {
  pendente: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  pago: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  atrasado: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

const statusLabels: Record<string, string> = { pendente: "Pendente", pago: "Pago", atrasado: "Atrasado" };
const paramLabels: Record<string, string> = { verde: "Verde", amarelo: "Amarelo", vermelho: "Vermelho" };
const modalLabels: Record<string, string> = { rodoviario: "Rodoviário", maritimo: "Marítimo" };

function OrderAuditHistory({ orderId }: { orderId: number }) {
  const { data: auditLog, isLoading } = useQuery<OrderAuditLogEntry[]>({
    queryKey: ["/api/orders", orderId, "audit-log"],
    queryFn: async () => {
      const res = await fetch(`/api/orders/${orderId}/audit-log`);
      if (!res.ok) throw new Error("Failed to fetch audit log");
      return res.json();
    },
  });

  if (isLoading) return <Skeleton className="h-16 w-full" />;
  if (!auditLog || auditLog.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4 text-center">
        Nenhum registro de alteração encontrado
      </div>
    );
  }

  const actionColors: Record<string, string> = {
    "criação": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
    "alteração": "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
    "exclusão": "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  };

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        Histórico de Alterações
      </h4>
      <div className="relative pl-4 border-l-2 border-muted space-y-4">
        {auditLog.map((entry) => {
          const changes = entry.changes as { field: string; label: string; from: unknown; to: unknown }[] | null;
          return (
            <div key={entry.id} className="relative" data-testid={`audit-entry-${entry.id}`}>
              <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-primary border-2 border-background" />
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={actionColors[entry.action] || "bg-muted text-muted-foreground"} variant="secondary">
                    {entry.action.charAt(0).toUpperCase() + entry.action.slice(1)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    por <span className="font-medium text-foreground">{entry.userName}</span>
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDateTime(entry.createdAt)}
                  </span>
                </div>
                {changes && changes.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {changes.map((change, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs bg-muted/50 rounded px-2 py-1">
                        <span className="font-medium min-w-[120px]">{change.label}:</span>
                        <span className="text-muted-foreground line-through">{String(change.from || "-")}</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="font-medium">{String(change.to || "-")}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OrderExpandedRow({ order }: { order: ExportOrderWithDetails }) {
  return (
    <div className="space-y-6 p-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Dados Gerais</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Invoice:</span><span className="font-medium">{order.invoice}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Fábrica:</span><span>{order.factory}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">NFE:</span><span>{order.nfe || "-"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Booking/CRT:</span><span>{order.bookingCrt || "-"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">DUE:</span><span>{order.dueNumber || "-"}</span></div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Parametrização:</span>
              <Badge className={paramColors[order.parametrizacao]} variant="secondary">
                {paramLabels[order.parametrizacao]}
              </Badge>
            </div>
            <div className="flex justify-between"><span className="text-muted-foreground">Fornecedor:</span><span>{order.supplier?.name || "-"}</span></div>
          </div>
        </div>
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Logística</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Modal:</span>
              <span className="flex items-center gap-1">
                {order.modal === "maritimo" ? <Ship className="h-3 w-3" /> : <Truck className="h-3 w-3" />}
                {modalLabels[order.modal]}
              </span>
            </div>
            {order.vessel && <div className="flex justify-between"><span className="text-muted-foreground">Vessel:</span><span>{order.vessel}</span></div>}
            <div className="flex justify-between"><span className="text-muted-foreground">Embarque:</span><span>{formatDate(order.embarqueDate)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Desembarque:</span><span>{formatDate(order.desembarqueDate)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Transit Time:</span><span>{order.transitTime ? `${order.transitTime} dias` : "-"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Deadline DRA:</span><span>{formatDate(order.deadlineDra)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Deadline Carga:</span><span>{formatDate(order.deadlineCarga)}</span></div>
          </div>
        </div>
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Financeiro</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Valor Unitário:</span><span className="font-mono">{formatCurrency(order.unitPrice)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Quantidade:</span><span>{order.quantity} ton</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Total:</span><span className="font-mono font-bold">{formatCurrency(order.total)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Termos Pgto:</span><span>{order.paymentTerms || "-"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Vencimento:</span><span>{formatDate(order.dueDate)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Pgto Real:</span><span>{formatDate(order.paymentDate)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">ACC:</span><span className="font-mono">{order.acc ? formatCurrency(order.acc) : "-"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Câmbio:</span><span className="font-mono">{order.exchangeClose || "-"}</span></div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status:</span>
              <Badge className={statusColors[order.statusPagamento]} variant="secondary">
                {statusLabels[order.statusPagamento]}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t pt-4">
        <OrderAuditHistory orderId={order.id} />
      </div>
    </div>
  );
}

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

function DueDateReport({ orders, isLoading }: { orders: ExportOrderWithDetails[] | undefined; isLoading: boolean }) {
  const [search, setSearch] = useState("");
  const [filterUrgency, setFilterUrgency] = useState("all");

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

  const filtered = dueDateOrders.filter((o) => {
    if (filterUrgency === "vencido" && o.urgency.priority !== 0) return false;
    if (filterUrgency === "urgente" && o.urgency.priority > 1) return false;
    if (filterUrgency === "proximo" && o.urgency.priority > 2) return false;
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

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por invoice, cliente, produto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-due-dates"
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
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Pendente</p>
            <p className="text-2xl font-bold" data-testid="text-due-pending-count">{dueDateOrders.length}</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-red-600 dark:text-red-400 uppercase tracking-wide flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Vencidos
            </p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400" data-testid="text-due-overdue-count">{overdueCount}</p>
          </CardContent>
        </Card>
        <Card className="border-orange-200 dark:border-orange-800">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-orange-600 dark:text-orange-400 uppercase tracking-wide">Urgentes (48h)</p>
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400" data-testid="text-due-urgent-count">{urgentCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Valor Total Pendente</p>
            <p className="text-2xl font-bold font-mono" data-testid="text-due-total">{formatCurrency(allPendingTotal)}</p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="pt-4 space-y-3">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
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
                    <TableRow key={order.id} data-testid={`row-due-date-${order.id}`}>
                      <TableCell>
                        <Badge variant="secondary" className={`${order.urgency.color} gap-1`} data-testid={`badge-urgency-${order.id}`}>
                          <UrgencyIcon className="h-3 w-3" />
                          {order.urgency.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium font-mono">{order.invoice}</TableCell>
                      <TableCell>{order.client?.name}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center justify-center rounded bg-primary/10 text-primary text-xs font-medium px-1.5 py-0.5">
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

function ExportsReport({ orders, isLoading }: { orders: ExportOrderWithDetails[] | undefined; isLoading: boolean }) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCountry, setFilterCountry] = useState("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const countries = Array.from(new Set(orders?.map((o) => o.client?.country).filter(Boolean) || [])).sort();

  const filtered = orders?.filter((o) => {
    if (filterStatus !== "all" && o.statusPagamento !== filterStatus) return false;
    if (filterCountry !== "all" && o.client?.country !== filterCountry) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        o.invoice.toLowerCase().includes(q) ||
        o.client?.name?.toLowerCase().includes(q) ||
        o.product?.type?.toLowerCase().includes(q) ||
        o.factory.toLowerCase().includes(q) ||
        (o.supplier?.name?.toLowerCase().includes(q))
      );
    }
    return true;
  }) || [];

  const totalRevenue = filtered.reduce((sum, o) => sum + parseFloat(o.total), 0);
  const totalVolume = filtered.reduce((sum, o) => sum + o.quantity, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por invoice, cliente, produto, fabrica..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-reports"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px]" data-testid="select-filter-status">
            <SelectValue placeholder="Status Pagamento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Status</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="pago">Pago</SelectItem>
            <SelectItem value="atrasado">Atrasado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterCountry} onValueChange={setFilterCountry}>
          <SelectTrigger className="w-[180px]" data-testid="select-filter-country">
            <SelectValue placeholder="Pais" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Paises</SelectItem>
            {countries.map((c) => (
              <SelectItem key={c} value={c!}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Exportacoes</p>
            <p className="text-2xl font-bold" data-testid="text-report-count">{filtered.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Receita Total</p>
            <p className="text-2xl font-bold font-mono" data-testid="text-report-revenue">{formatCurrency(totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Volume Total</p>
            <p className="text-2xl font-bold" data-testid="text-report-volume">{totalVolume.toLocaleString("pt-BR")} ton</p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="pt-4 space-y-3">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1">Nenhuma exportacao encontrada</h3>
            <p className="text-sm text-muted-foreground">Ajuste os filtros ou crie novas ordens de exportacao.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Pais</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Modal</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((order) => {
                  const isExpanded = expandedId === order.id;
                  return (
                    <Fragment key={order.id}>
                      <TableRow
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setExpandedId(isExpanded ? null : order.id)}
                        data-testid={`row-report-order-${order.id}`}
                      >
                        <TableCell>
                          {isExpanded
                            ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                        </TableCell>
                        <TableCell className="font-medium font-mono">{order.invoice}</TableCell>
                        <TableCell>{order.client?.name}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center justify-center rounded bg-primary/10 text-primary text-xs font-medium px-1.5 py-0.5">
                            {order.client?.country}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{order.product?.type} - {order.product?.grammage}</TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1 text-sm">
                            {order.modal === "maritimo" ? <Ship className="h-3 w-3" /> : <Truck className="h-3 w-3" />}
                            {modalLabels[order.modal]}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">{formatCurrency(order.total)}</TableCell>
                        <TableCell>
                          <Badge className={statusColors[order.statusPagamento]} variant="secondary">
                            {statusLabels[order.statusPagamento]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">{formatDateTime(order.createdAt)}</TableCell>
                      </TableRow>
                      {isExpanded && (
                        <tr>
                          <td colSpan={9} className="bg-muted/30 border-b p-0">
                            <OrderExpandedRow order={order} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
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

function SalesReport({ orders, isLoading }: { orders: ExportOrderWithDetails[] | undefined; isLoading: boolean }) {
  const [search, setSearch] = useState("");
  const [filterCountry, setFilterCountry] = useState("all");
  const [filterMonth, setFilterMonth] = useState("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const salesOrders = useMemo(() => {
    if (!orders) return [];
    return orders.filter((o) => o.statusPagamento === "pago");
  }, [orders]);

  const countries = Array.from(new Set(salesOrders.map((o) => o.client?.country).filter(Boolean))).sort();

  const months = useMemo(() => {
    const set = new Set<string>();
    salesOrders.forEach((o) => {
      if (o.paymentDate) {
        const d = new Date(o.paymentDate);
        const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        set.add(label);
      }
    });
    return Array.from(set).sort().reverse();
  }, [salesOrders]);

  const filtered = salesOrders.filter((o) => {
    if (filterCountry !== "all" && o.client?.country !== filterCountry) return false;
    if (filterMonth !== "all" && o.paymentDate) {
      const d = new Date(o.paymentDate);
      const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (label !== filterMonth) return false;
    }
    if (filterMonth !== "all" && !o.paymentDate) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        o.invoice.toLowerCase().includes(q) ||
        o.client?.name?.toLowerCase().includes(q) ||
        o.product?.type?.toLowerCase().includes(q) ||
        o.factory.toLowerCase().includes(q) ||
        (o.supplier?.name?.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const totalVendas = filtered.reduce((s, o) => s + parseFloat(o.total), 0);
  const totalVolume = filtered.reduce((s, o) => s + o.quantity, 0);
  const ticketMedio = filtered.length > 0 ? totalVendas / filtered.length : 0;

  const formatMonth = (m: string) => {
    const [year, month] = m.split("-");
    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return `${monthNames[parseInt(month) - 1]}/${year}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por invoice, cliente, produto, fornecedor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-sales"
          />
        </div>
        <Select value={filterCountry} onValueChange={setFilterCountry}>
          <SelectTrigger className="w-[180px]" data-testid="select-filter-sales-country">
            <SelectValue placeholder="Pais" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Paises</SelectItem>
            {countries.map((c) => (
              <SelectItem key={c} value={c!}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterMonth} onValueChange={setFilterMonth}>
          <SelectTrigger className="w-[180px]" data-testid="select-filter-sales-month">
            <SelectValue placeholder="Mes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Meses</SelectItem>
            {months.map((m) => (
              <SelectItem key={m} value={m}>{formatMonth(m)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total de Vendas</p>
            <p className="text-2xl font-bold" data-testid="text-sales-count">{filtered.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Receita Total</p>
            <p className="text-2xl font-bold font-mono text-green-600" data-testid="text-sales-revenue">{formatCurrency(totalVendas)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Volume Total</p>
            <p className="text-2xl font-bold" data-testid="text-sales-volume">{totalVolume.toLocaleString("pt-BR")} ton</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Ticket Medio</p>
            <p className="text-2xl font-bold font-mono" data-testid="text-sales-ticket">{formatCurrency(ticketMedio)}</p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="pt-4 space-y-3">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <ShoppingCart className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1">Nenhuma venda encontrada</h3>
            <p className="text-sm text-muted-foreground">Ajuste os filtros ou realize novas vendas.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Pais</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead className="text-right">Qtd (ton)</TableHead>
                  <TableHead className="text-right">Valor Unit.</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Data Pgto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((order) => {
                  const isExpanded = expandedId === order.id;
                  return (
                    <Fragment key={order.id}>
                      <TableRow
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setExpandedId(isExpanded ? null : order.id)}
                        data-testid={`row-sale-${order.id}`}
                      >
                        <TableCell>
                          {isExpanded
                            ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                        </TableCell>
                        <TableCell className="font-medium font-mono">{order.invoice}</TableCell>
                        <TableCell>{order.client?.name}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center justify-center rounded bg-primary/10 text-primary text-xs font-medium px-1.5 py-0.5">
                            {order.client?.country}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{order.product?.type} - {order.product?.grammage}</TableCell>
                        <TableCell className="text-muted-foreground">{order.supplier?.name || "-"}</TableCell>
                        <TableCell className="text-right tabular-nums">{order.quantity.toLocaleString("pt-BR")}</TableCell>
                        <TableCell className="text-right font-mono tabular-nums">{formatCurrency(order.unitPrice)}</TableCell>
                        <TableCell className="text-right font-mono tabular-nums font-bold">{formatCurrency(order.total)}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{formatDate(order.paymentDate)}</TableCell>
                      </TableRow>
                      {isExpanded && (
                        <tr>
                          <td colSpan={10} className="bg-muted/30 border-b p-0">
                            <OrderExpandedRow order={order} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
              <tfoot>
                <tr className="border-t-2 font-semibold bg-muted/20">
                  <td colSpan={6} className="px-4 py-3 text-sm">Total</td>
                  <td className="px-4 py-3 text-right tabular-nums text-sm">{totalVolume.toLocaleString("pt-BR")}</td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-sm">{formatCurrency(totalVendas)}</td>
                  <td className="px-4 py-3"></td>
                </tr>
              </tfoot>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function Reports() {
  const { data: orders, isLoading } = useQuery<ExportOrderWithDetails[]>({ queryKey: ["/api/orders"] });

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-reports-title">Relatorios</h1>
        <p className="text-muted-foreground text-sm">Relatorios de exportacao, vendas e vencimentos</p>
      </div>

      <Tabs defaultValue="exportacoes">
        <TabsList data-testid="tabs-reports">
          <TabsTrigger value="exportacoes" data-testid="tab-exports">Exportacoes</TabsTrigger>
          <TabsTrigger value="vendas" data-testid="tab-sales">Vendas</TabsTrigger>
          <TabsTrigger value="vencimentos" data-testid="tab-due-dates">Vencimentos</TabsTrigger>
        </TabsList>
        <TabsContent value="exportacoes" className="mt-4">
          <ExportsReport orders={orders} isLoading={isLoading} />
        </TabsContent>
        <TabsContent value="vendas" className="mt-4">
          <SalesReport orders={orders} isLoading={isLoading} />
        </TabsContent>
        <TabsContent value="vencimentos" className="mt-4">
          <DueDateReport orders={orders} isLoading={isLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
