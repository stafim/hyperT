import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Eye, Pencil, Trash2, Ship, Truck, Filter, MapPin, Navigation, Bell, BellOff, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import type { ExportOrderWithDetails, Client, Product, Supplier, ShipmentTracking } from "@shared/schema";

const PAGE_SIZE = 10;

interface PaginatedOrders {
  data: ExportOrderWithDetails[];
  total: number;
  page: number;
  totalPages: number;
}
import OrderForm from "@/components/order-form";
import OrderDetail from "@/components/order-detail";
import { useLocation } from "wouter";

function formatCurrency(value: number | string) {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(num);
}

function getParametrizacaoBadge(param: string) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
    verde: { label: "Verde", variant: "default" },
    amarelo: { label: "Amarelo", variant: "secondary" },
    vermelho: { label: "Vermelho", variant: "destructive" },
  };
  const config = map[param] || map.verde;
  if (param === "verde") {
    return <Badge className="bg-emerald-600 dark:bg-emerald-500 text-white text-xs">{config.label}</Badge>;
  }
  if (param === "amarelo") {
    return <Badge className="bg-amber-500 dark:bg-amber-400 text-white text-xs">{config.label}</Badge>;
  }
  return <Badge variant="destructive" className="text-xs">{config.label}</Badge>;
}

function getStatusBadge(status: string) {
  if (status === "pago") return <Badge className="bg-emerald-600 dark:bg-emerald-500 text-white text-xs">Pago</Badge>;
  if (status === "atrasado") return <Badge variant="destructive" className="text-xs">Atrasado</Badge>;
  return <Badge variant="secondary" className="text-xs">Pendente</Badge>;
}

function getVesselStatusBadge(status: string | null | undefined) {
  if (!status) return <span className="text-muted-foreground text-xs">—</span>;
  const map: Record<string, { label: string; className: string }> = {
    etd:          { label: "ETD", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
    zarpou:       { label: "Zarpou", className: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300" },
    em_navegacao: { label: "Em Navegação", className: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300" },
    fundeado:     { label: "Fundeado", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" },
  };
  const cfg = map[status];
  if (!cfg) return <span className="text-muted-foreground text-xs">—</span>;
  return <Badge variant="outline" className={`text-xs font-medium ${cfg.className}`}>{cfg.label}</Badge>;
}

export default function Orders() {
  const { toast } = useToast();
  const [location, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterCountry, setFilterCountry] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterMonth, setFilterMonth] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editOrder, setEditOrder] = useState<ExportOrderWithDetails | null>(null);
  const [detailOrder, setDetailOrder] = useState<ExportOrderWithDetails | null>(null);
  const [trackingOrder, setTrackingOrder] = useState<ExportOrderWithDetails | null>(null);
  const [trackingData, setTrackingData] = useState<ShipmentTracking | null>(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSearchChange(val: string) {
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setDebouncedSearch(val); setPage(1); }, 350);
  }

  function setFilter<T>(setter: (v: T) => void) {
    return (val: T) => { setter(val); setPage(1); };
  }

  const quotationPrefill = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const fromQuotation = params.get("fromQuotation");
    if (!fromQuotation) return null;
    return {
      quotationId: Number(fromQuotation),
      clientId: Number(params.get("clientId") || 0),
      productId: Number(params.get("productId") || 0),
      supplierId: params.get("supplierId") ? Number(params.get("supplierId")) : undefined,
    };
  }, []);

  useEffect(() => {
    if (quotationPrefill) {
      setFormOpen(true);
      window.history.replaceState({}, "", "/orders");
    }
  }, [quotationPrefill]);

  const ordersQuery = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (filterCountry !== "all") params.set("country", filterCountry);
    if (filterStatus !== "all") params.set("status", filterStatus);
    if (filterMonth !== "all") params.set("month", filterMonth);
    return `/api/orders?${params.toString()}`;
  }, [page, debouncedSearch, filterCountry, filterStatus, filterMonth]);

  const { data: pagedResult, isLoading } = useQuery<PaginatedOrders>({ queryKey: [ordersQuery] });
  const orders = pagedResult?.data ?? [];
  const totalOrders = pagedResult?.total ?? 0;
  const totalPages = pagedResult?.totalPages ?? 1;
  const { data: clients } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: products } = useQuery<Product[]>({ queryKey: ["/api/products"] });
  const { data: suppliersList } = useQuery<Supplier[]>({ queryKey: ["/api/suppliers"] });

  function invalidateOrders() {
    queryClient.invalidateQueries({ queryKey: [ordersQuery] });
    queryClient.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("/api/orders?") });
  }

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/orders/${id}`),
    onSuccess: () => {
      invalidateOrders();
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Ordem excluída com sucesso" });
    },
  });

  const vesselStatusMutation = useMutation({
    mutationFn: ({ id, vesselStatus, invoice, notificacoesAtivas }: { id: number; vesselStatus: string | null; invoice: string; notificacoesAtivas: boolean }) =>
      apiRequest("PATCH", `/api/orders/${id}`, { vesselStatus }),
    onSuccess: (_data, { vesselStatus, invoice, notificacoesAtivas }) => {
      invalidateOrders();
      if (notificacoesAtivas && vesselStatus) {
        const labels: Record<string, string> = {
          etd: "ETD — aguardando embarque",
          zarpou: "Navio Zarpou",
          em_navegacao: "Em Navegação",
          fundeado: "Fundeado — Chegou",
        };
        toast({
          title: `🔔 Movimento detectado — ${invoice}`,
          description: `Status atualizado para: ${labels[vesselStatus] ?? vesselStatus}`,
        });
      }
    },
    onError: () => toast({ title: "Erro ao atualizar status", variant: "destructive" }),
  });

  const notificacaoMutation = useMutation({
    mutationFn: ({ id, notificacoesAtivas }: { id: number; notificacoesAtivas: boolean }) =>
      apiRequest("PATCH", `/api/orders/${id}`, { notificacoesAtivas }),
    onSuccess: (_data, { notificacoesAtivas }) => {
      invalidateOrders();
      toast({
        title: notificacoesAtivas ? "🔔 Notificações ativadas" : "🔕 Notificações desativadas",
        description: notificacoesAtivas
          ? "Você receberá alertas a cada movimentação desta ordem."
          : "Alertas de movimentação desativados para esta ordem.",
      });
    },
    onError: () => toast({ title: "Erro ao salvar preferência", variant: "destructive" }),
  });

  const openTracking = async (order: ExportOrderWithDetails) => {
    setTrackingOrder(order);
    setTrackingData(null);
    setTrackingLoading(true);
    try {
      const res = await fetch(`/api/tracking/${order.id}`);
      if (res.ok) {
        const data = await res.json();
        setTrackingData(data);
      }
    } catch {
    } finally {
      setTrackingLoading(false);
    }
  };

  const countries = [...new Set((clients ?? []).map((c) => c.country).filter(Boolean))];
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const firstItem = totalOrders === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastItem = Math.min(page * PAGE_SIZE, totalOrders);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-orders-title">Ordens de Exportação</h1>
          <p className="text-muted-foreground text-sm">Gerenciar todas as ordens de exportação</p>
        </div>
        <Dialog open={formOpen} onOpenChange={(v) => { setFormOpen(v); if (!v) setEditOrder(null); }}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-order" onClick={() => { setEditOrder(null); setFormOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Ordem
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editOrder ? "Editar Ordem" : "Nova Ordem de Exportação"}</DialogTitle>
            </DialogHeader>
            <OrderForm
              clients={clients || []}
              products={products || []}
              suppliers={suppliersList || []}
              editOrder={editOrder}
              quotationPrefill={!editOrder ? quotationPrefill : null}
              onSuccess={() => {
                setFormOpen(false);
                setEditOrder(null);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por invoice ou cliente..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9"
                data-testid="input-search-orders"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              data-testid="button-toggle-filters"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filtros
            </Button>
          </div>

          {showFilters && (
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <Select value={filterCountry} onValueChange={setFilter(setFilterCountry)}>
                <SelectTrigger className="w-[160px]" data-testid="select-filter-country">
                  <SelectValue placeholder="País" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Países</SelectItem>
                  {countries.map((c) => (
                    <SelectItem key={c} value={c!}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilter(setFilterStatus)}>
                <SelectTrigger className="w-[160px]" data-testid="select-filter-status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Status</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="atrasado">Atrasado</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterMonth} onValueChange={setFilter(setFilterMonth)}>
                <SelectTrigger className="w-[160px]" data-testid="select-filter-month">
                  <SelectValue placeholder="Mês Embarque" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Meses</SelectItem>
                  {months.map((m, i) => (
                    <SelectItem key={i} value={String(i)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <Card>
          <CardContent className="pt-4 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : orders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Ship className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1">Nenhuma ordem encontrada</h3>
            <p className="text-sm text-muted-foreground">Crie sua primeira ordem de exportação para começar.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/20">
              <span className="text-xs text-muted-foreground">
                Exibindo <span className="font-medium text-foreground">{firstItem}–{lastItem}</span> de <span className="font-medium text-foreground">{totalOrders}</span> ordens
              </span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPage(1)} disabled={page === 1} title="Primeira página">
                  <ChevronsLeft className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} title="Página anterior">
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                  .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                    if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...");
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) =>
                    p === "..." ? (
                      <span key={`ellipsis-${i}`} className="text-xs text-muted-foreground px-1">…</span>
                    ) : (
                      <Button
                        key={p}
                        variant={page === p ? "default" : "ghost"}
                        size="icon"
                        className="h-7 w-7 text-xs"
                        onClick={() => setPage(p as number)}
                      >
                        {p}
                      </Button>
                    )
                  )}
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} title="Próxima página">
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPage(totalPages)} disabled={page === totalPages} title="Última página">
                  <ChevronsRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left p-3 font-medium text-muted-foreground">Invoice</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Cliente</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">País</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Produto</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Modal</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Param.</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Movimentação</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Total</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Pagamento</th>
                    <th className="text-center p-3 font-medium text-muted-foreground">
                      <div className="flex items-center justify-center gap-1">
                        <Bell className="h-3.5 w-3.5" />
                        <span>Alertas</span>
                      </div>
                    </th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
                    const isUrgent = !order.paymentDate && order.dueDate && (() => {
                      const diff = new Date(order.dueDate).getTime() - Date.now();
                      return diff > 0 && diff < 48 * 60 * 60 * 1000;
                    })();
                    return (
                      <tr
                        key={order.id}
                        className={`border-b hover-elevate ${isUrgent ? "bg-destructive/5" : ""}`}
                        data-testid={`row-order-${order.id}`}
                      >
                        <td className="p-3 font-medium">{order.invoice}</td>
                        <td className="p-3">
                          <div>{order.client?.name || "-"}</div>
                          {order.criadoPor && <div className="text-[11px] text-muted-foreground">por {order.criadoPor}</div>}
                          {(order as any).vendedor && <div className="text-[11px] text-primary font-medium">{(order as any).vendedor}</div>}
                        </td>
                        <td className="p-3">{order.client?.country || "-"}</td>
                        <td className="p-3 max-w-[120px] truncate">{order.product?.type || "-"}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            {order.modal === "maritimo" ? <Ship className="h-3 w-3" /> : <Truck className="h-3 w-3" />}
                            <span className="text-xs">{order.modal === "maritimo" ? "Marítimo" : "Rodoviário"}</span>
                          </div>
                        </td>
                        <td className="p-3">{getParametrizacaoBadge(order.parametrizacao)}</td>
                        <td className="p-3">
                          <Select
                            value={(order as any).vesselStatus ?? "none"}
                            onValueChange={(val) =>
                              vesselStatusMutation.mutate({
                                id: order.id,
                                vesselStatus: val === "none" ? null : val,
                                invoice: order.invoice,
                                notificacoesAtivas: !!(order as any).notificacoesAtivas,
                              })
                            }
                          >
                            <SelectTrigger className="h-7 w-[140px] text-xs border-dashed px-2">
                              <SelectValue>
                                {getVesselStatusBadge((order as any).vesselStatus)}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none"><span className="text-muted-foreground text-xs">— Sem status —</span></SelectItem>
                              <SelectItem value="etd"><Badge variant="outline" className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">ETD</Badge></SelectItem>
                              <SelectItem value="zarpou"><Badge variant="outline" className="text-xs bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300">Zarpou</Badge></SelectItem>
                              <SelectItem value="em_navegacao"><Badge variant="outline" className="text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">Em Navegação</Badge></SelectItem>
                              <SelectItem value="fundeado"><Badge variant="outline" className="text-xs bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">Fundeado</Badge></SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-3 text-right font-medium">{formatCurrency(order.total)}</td>
                        <td className="p-3">{getStatusBadge(order.statusPagamento)}</td>
                        <td className="p-3">
                          <div className="flex items-center justify-center">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1.5">
                                  {(order as any).notificacoesAtivas
                                    ? <Bell className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                                    : <BellOff className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                  }
                                  <Switch
                                    checked={!!(order as any).notificacoesAtivas}
                                    onCheckedChange={(checked) =>
                                      notificacaoMutation.mutate({ id: order.id, notificacoesAtivas: checked })
                                    }
                                    aria-label="Ativar notificações de movimentação"
                                  />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="left" className="max-w-[200px] text-center text-xs">
                                {(order as any).notificacoesAtivas
                                  ? "Notificações ativas — você será alertado a cada movimentação desta ordem"
                                  : "Clique para ativar alertas de movimentação desta ordem"
                                }
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setDetailOrder(order)}
                              data-testid={`button-view-order-${order.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => openTracking(order)}
                              title="Ver localização do embarque"
                              data-testid={`button-tracking-order-${order.id}`}
                            >
                              <MapPin className="h-4 w-4 text-blue-500" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => { setEditOrder(order); setFormOpen(true); }}
                              data-testid={`button-edit-order-${order.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                if (confirm("Tem certeza que deseja excluir esta ordem?")) {
                                  deleteMutation.mutate(order.id);
                                }
                              }}
                              data-testid={`button-delete-order-${order.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!detailOrder} onOpenChange={(v) => { if (!v) setDetailOrder(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da Ordem — {detailOrder?.invoice}</DialogTitle>
          </DialogHeader>
          {detailOrder && <OrderDetail order={detailOrder} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!trackingOrder} onOpenChange={(v) => { if (!v) { setTrackingOrder(null); setTrackingData(null); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-500" />
              Localização do Embarque — {trackingOrder?.invoice}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {trackingOrder && (
              <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  {trackingOrder.modal === "maritimo" ? <Ship className="h-4 w-4" /> : <Truck className="h-4 w-4" />}
                  {trackingOrder.modal === "maritimo" ? "Marítimo" : "Rodoviário"}
                </span>
                {trackingOrder.vessel && (
                  <span className="font-medium text-foreground">{trackingOrder.vessel}</span>
                )}
                <span>{trackingOrder.client?.name}</span>
              </div>
            )}

            {trackingLoading && (
              <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
                <Navigation className="h-5 w-5 animate-spin" />
                <span className="text-sm">Consultando rastreamento...</span>
              </div>
            )}

            {!trackingLoading && trackingData && (
              <>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-muted rounded p-2">
                    <p className="text-xs text-muted-foreground">Latitude</p>
                    <p className="font-mono font-medium">{trackingData.lat}</p>
                  </div>
                  <div className="bg-muted rounded p-2">
                    <p className="text-xs text-muted-foreground">Longitude</p>
                    <p className="font-mono font-medium">{trackingData.lng}</p>
                  </div>
                  {trackingData.vehicleName && (
                    <div className="bg-muted rounded p-2">
                      <p className="text-xs text-muted-foreground">Veículo</p>
                      <p className="font-medium">{trackingData.vehicleName}</p>
                    </div>
                  )}
                  {trackingData.speed && (
                    <div className="bg-muted rounded p-2">
                      <p className="text-xs text-muted-foreground">Velocidade</p>
                      <p className="font-medium">{trackingData.speed} nós</p>
                    </div>
                  )}
                  {trackingData.status && (
                    <div className="bg-muted rounded p-2 col-span-2">
                      <p className="text-xs text-muted-foreground">Status</p>
                      <p className="font-medium">{trackingData.status}</p>
                    </div>
                  )}
                </div>
                <div className="rounded-lg overflow-hidden border">
                  <iframe
                    title="Mapa de localização"
                    width="100%"
                    height="340"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${Number(trackingData.lng) - 3},${Number(trackingData.lat) - 3},${Number(trackingData.lng) + 3},${Number(trackingData.lat) + 3}&layer=mapnik&marker=${trackingData.lat},${trackingData.lng}`}
                    style={{ border: 0 }}
                  />
                </div>
                {trackingData.source && (
                  <p className="text-xs text-muted-foreground text-right">Fonte: {trackingData.source} · Atualizado: {trackingData.updatedAt ? new Date(trackingData.updatedAt).toLocaleString("pt-BR") : "—"}</p>
                )}
              </>
            )}

            {!trackingLoading && !trackingData && (
              <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
                <div className="rounded-full bg-blue-50 dark:bg-blue-900/20 p-5">
                  <MapPin className="h-10 w-10 text-blue-400" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Rastreamento não disponível</p>
                  <p className="text-muted-foreground text-xs mt-1 max-w-xs">
                    Nenhuma posição registrada para esta ordem.<br />
                    A integração com a API de rastreamento ainda não foi configurada.
                  </p>
                </div>
                <Badge variant="outline" className="text-xs mt-1">
                  Integração pendente
                </Badge>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
