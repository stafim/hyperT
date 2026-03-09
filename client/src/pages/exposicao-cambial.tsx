import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle, TrendingUp, DollarSign, Globe,
  Eye, Ship, Truck, FileText, Clock, Calendar,
  CheckCircle2, XCircle
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from "recharts";
import type { ExportOrderWithDetails } from "@shared/schema";

const CHART_COLORS = ["#083F62", "#2276BB", "#FABD00", "#0EA5E9", "#6366F1", "#EC4899"];

function formatUSD(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD" }).format(value);
}

function formatDate(d: string | null | undefined) {
  if (!d) return "-";
  return new Date(d + "T00:00:00").toLocaleDateString("pt-BR");
}

function daysUntilDue(dueDate: string | null | undefined): number | null {
  if (!dueDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + "T00:00:00");
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function UrgencyBadge({ days }: { days: number | null }) {
  if (days === null) return <Badge variant="secondary" className="text-xs">Sem venc.</Badge>;
  if (days < 0) return <Badge className="text-xs bg-red-600 text-white">{Math.abs(days)}d em atraso</Badge>;
  if (days <= 7) return <Badge className="text-xs bg-orange-500 text-white">Vence em {days}d</Badge>;
  if (days <= 30) return <Badge className="text-xs bg-yellow-500 text-white">{days}d</Badge>;
  return <Badge variant="secondary" className="text-xs">{days}d</Badge>;
}

function OrderDetailDialog({
  order,
  open,
  onClose,
}: {
  order: ExportOrderWithDetails | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!order) return null;
  const total = parseFloat(order.total ?? "0");
  const days = daysUntilDue(order.dueDate);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            Detalhes — {order.invoice}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Cliente</p>
              <p className="text-sm font-medium">{order.client?.name ?? "-"}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">País</p>
              <p className="text-sm font-medium">{order.client?.country ?? "-"}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Produto</p>
              <p className="text-sm font-medium">{order.product?.type ?? "-"}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Modal</p>
              <div className="flex items-center gap-1">
                {order.modal === "maritimo" ? <Ship className="h-3 w-3" /> : <Truck className="h-3 w-3" />}
                <p className="text-sm capitalize">{order.modal}</p>
              </div>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Embarque</p>
              <p className="text-sm">{formatDate(order.embarqueDate)}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Prazo Pag.</p>
              <p className="text-sm">{order.paymentTerms ?? "-"}</p>
            </div>
          </div>

          <Separator />

          <div>
            <p className="text-sm font-semibold mb-3 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              Exposição em USD
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Card className="border-muted">
                <CardContent className="pt-3 pb-3">
                  <p className="text-xs text-muted-foreground">Total da Ordem (USD)</p>
                  <p className="text-2xl font-bold font-mono mt-1">{formatUSD(total)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {order.quantity} ton × {formatUSD(parseFloat(order.unitPrice ?? "0"))}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-muted">
                <CardContent className="pt-3 pb-3">
                  <p className="text-xs text-muted-foreground">Vencimento</p>
                  <p className="text-lg font-bold mt-1">{formatDate(order.dueDate)}</p>
                  <div className="mt-1">
                    <UrgencyBadge days={days} />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <Separator />

          <div>
            <p className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              Cronograma
            </p>
            <div className="space-y-2 text-sm">
              {[
                { label: "Embarque", date: order.embarqueDate },
                { label: "Desembarque", date: order.desembarqueDate },
                { label: "Vencimento", date: order.dueDate },
                { label: "Pagamento", date: order.paymentDate },
              ].map(({ label, date }) => (
                <div key={label} className="flex justify-between items-center">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-mono">{formatDate(date)}</span>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status Pagamento</span>
            <Badge
              className={`capitalize text-xs ${
                order.statusPagamento === "pago"
                  ? "bg-green-600 text-white"
                  : order.statusPagamento === "atrasado"
                  ? "bg-red-600 text-white"
                  : "bg-yellow-500 text-white"
              }`}
            >
              {order.statusPagamento}
            </Badge>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ExposicaoCambial() {
  const { data: orders, isLoading } = useQuery<ExportOrderWithDetails[]>({ queryKey: ["/api/orders"] });
  const [selectedOrder, setSelectedOrder] = useState<ExportOrderWithDetails | null>(null);

  const {
    openOrders,
    totalExposureUsd,
    overdueUsd,
    dueSoon7Usd,
    byCountry,
    byMonth,
    sortedOrders,
  } = useMemo(() => {
    if (!orders) return {
      openOrders: [],
      totalExposureUsd: 0,
      overdueUsd: 0,
      dueSoon7Usd: 0,
      byCountry: [],
      byMonth: [],
      sortedOrders: [],
    };

    const open = orders.filter((o) => o.statusPagamento !== "pago");

    const totalExposureUsd = open.reduce((s, o) => s + parseFloat(o.total ?? "0"), 0);

    const overdueUsd = open
      .filter((o) => o.statusPagamento === "atrasado" || (o.dueDate && daysUntilDue(o.dueDate)! < 0))
      .reduce((s, o) => s + parseFloat(o.total ?? "0"), 0);

    const dueSoon7Usd = open
      .filter((o) => {
        const d = daysUntilDue(o.dueDate);
        return d !== null && d >= 0 && d <= 7;
      })
      .reduce((s, o) => s + parseFloat(o.total ?? "0"), 0);

    const countryMap = new Map<string, { count: number; totalUsd: number }>();
    for (const o of open) {
      const country = o.client?.country ?? "Desconhecido";
      const existing = countryMap.get(country) ?? { count: 0, totalUsd: 0 };
      existing.count++;
      existing.totalUsd += parseFloat(o.total ?? "0");
      countryMap.set(country, existing);
    }
    const byCountry = Array.from(countryMap.entries())
      .map(([country, data]) => ({ country, ...data }))
      .sort((a, b) => b.totalUsd - a.totalUsd);

    const monthMap = new Map<string, number>();
    for (const o of open) {
      if (!o.dueDate) continue;
      const date = new Date(o.dueDate + "T00:00:00");
      const label = date.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
      monthMap.set(label, (monthMap.get(label) ?? 0) + parseFloat(o.total ?? "0"));
    }
    const byMonth = Array.from(monthMap.entries())
      .map(([month, totalUsd]) => ({ month, totalUsd }))
      .sort((a, b) => {
        const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
        const [ma, ya] = a.month.split(" de ");
        const [mb, yb] = b.month.split(" de ");
        if (ya !== yb) return parseInt(ya) - parseInt(yb);
        return months.indexOf(ma?.toLowerCase().slice(0, 3)) - months.indexOf(mb?.toLowerCase().slice(0, 3));
      });

    const sortedOrders = [...open].sort((a, b) => {
      const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return da - db;
    });

    return { openOrders: open, totalExposureUsd, overdueUsd, dueSoon7Usd, byCountry, byMonth, sortedOrders };
  }, [orders]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-80" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-[300px] w-full" />
          <Skeleton className="h-[300px] w-full" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-exposure-title">Exposição Cambial</h1>
        <p className="text-muted-foreground text-sm">
          Recebíveis em aberto em USD — ordens com pagamento pendente por prazo da cotação
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Exposição Total (USD)</p>
            </div>
            <p className="text-2xl font-bold font-mono" data-testid="text-total-exposure">{formatUSD(totalExposureUsd)}</p>
            <p className="text-xs text-muted-foreground mt-1">{openOrders.length} ordens em aberto</p>
          </CardContent>
        </Card>

        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
              <p className="text-xs text-red-600 dark:text-red-400 uppercase tracking-wide">Em Atraso (USD)</p>
            </div>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400 font-mono" data-testid="text-overdue-usd">
              {formatUSD(overdueUsd)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {openOrders.filter((o) => o.statusPagamento === "atrasado" || (o.dueDate && daysUntilDue(o.dueDate)! < 0)).length} ordens vencidas
            </p>
          </CardContent>
        </Card>

        <Card className="border-orange-200 dark:border-orange-800">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              <p className="text-xs text-orange-600 dark:text-orange-400 uppercase tracking-wide">Vence em 7 dias</p>
            </div>
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 font-mono" data-testid="text-due-soon">
              {formatUSD(dueSoon7Usd)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {openOrders.filter((o) => { const d = daysUntilDue(o.dueDate); return d !== null && d >= 0 && d <= 7; }).length} ordens urgentes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Países Expostos</p>
            </div>
            <p className="text-2xl font-bold" data-testid="text-country-count">{byCountry.length}</p>
            <p className="text-xs text-muted-foreground mt-1 truncate">
              {byCountry.map((c) => c.country).join(", ") || "-"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              Exposição por País (USD)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {byCountry.length === 0 ? (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
                Nenhuma exposição ativa
              </div>
            ) : (
              <div style={{ width: "100%", height: 250 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={byCountry.map((c) => ({ name: c.country, value: c.totalUsd }))}
                      cx="50%"
                      cy="50%"
                      outerRadius={75}
                      dataKey="value"
                      isAnimationActive={false}
                    >
                      {byCountry.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => [formatUSD(value), "Exposição USD"]}
                      contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              Recebíveis por Vencimento (USD)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {byMonth.length === 0 ? (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
                Nenhum vencimento registrado
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={byMonth}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(value: number) => [formatUSD(value), "Valor USD"]}
                    contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                  <Bar dataKey="totalUsd" name="Recebível USD" fill="#083F62" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            Resumo por País
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {byCountry.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
              <h3 className="text-lg font-medium mb-1">Sem exposição</h3>
              <p className="text-sm text-muted-foreground">Nenhuma ordem em aberto no momento.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>País</TableHead>
                  <TableHead className="text-right">Ordens</TableHead>
                  <TableHead className="text-right">Total (USD)</TableHead>
                  <TableHead className="text-right">% do Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byCountry.map((c) => (
                  <TableRow key={c.country} data-testid={`row-country-${c.country}`}>
                    <TableCell className="font-medium">{c.country}</TableCell>
                    <TableCell className="text-right font-mono">{c.count}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">{formatUSD(c.totalUsd)}</TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {totalExposureUsd > 0 ? `${((c.totalUsd / totalExposureUsd) * 100).toFixed(1)}%` : "-"}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell className="uppercase text-xs tracking-wide">Total</TableCell>
                  <TableCell className="text-right font-mono">{openOrders.length}</TableCell>
                  <TableCell className="text-right font-mono" data-testid="text-total-row-usd">{formatUSD(totalExposureUsd)}</TableCell>
                  <TableCell className="text-right font-mono">100%</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            Ordens em Aberto — por Vencimento
            <Badge variant="secondary" className="ml-auto text-xs">{sortedOrders.length} ordens</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {sortedOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
              <h3 className="text-lg font-medium mb-1">Sem ordens em aberto</h3>
              <p className="text-sm text-muted-foreground">Todas as ordens estão pagas.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Cliente / País</TableHead>
                  <TableHead>Prazo Pagamento</TableHead>
                  <TableHead className="text-right">Valor (USD)</TableHead>
                  <TableHead className="text-right">Vencimento</TableHead>
                  <TableHead className="text-center">Situação</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Ver</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedOrders.map((order) => {
                  const days = daysUntilDue(order.dueDate);
                  const total = parseFloat(order.total ?? "0");
                  return (
                    <TableRow key={order.id} data-testid={`row-order-${order.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {order.modal === "maritimo"
                            ? <Ship className="h-3 w-3 text-muted-foreground" />
                            : <Truck className="h-3 w-3 text-muted-foreground" />}
                          <span className="font-mono text-sm font-medium">{order.invoice}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-medium">{order.client?.name ?? "-"}</p>
                        <p className="text-xs text-muted-foreground">{order.client?.country ?? "-"}</p>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{order.paymentTerms ?? "-"}</span>
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {formatUSD(total)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatDate(order.dueDate)}
                      </TableCell>
                      <TableCell className="text-center">
                        <UrgencyBadge days={days} />
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          className={`capitalize text-xs ${
                            order.statusPagamento === "atrasado"
                              ? "bg-red-600 text-white"
                              : order.statusPagamento === "pendente"
                              ? "bg-yellow-500 text-white"
                              : "bg-green-600 text-white"
                          }`}
                        >
                          {order.statusPagamento}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1"
                          onClick={() => setSelectedOrder(order)}
                          data-testid={`button-detail-${order.id}`}
                        >
                          <Eye className="h-3 w-3" />
                          Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <OrderDetailDialog
        order={selectedOrder}
        open={selectedOrder !== null}
        onClose={() => setSelectedOrder(null)}
      />
    </div>
  );
}
