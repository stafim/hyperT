import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DollarSign, Users, TrendingUp, CheckCircle2, Clock, AlertCircle,
  Search, Filter, Download, Percent, ChevronsUpDown,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight
} from "lucide-react";
import type { PlatformUser, ExportOrderWithDetails } from "@shared/schema";
import OrderDetail from "@/components/order-detail";

interface CommissionRow {
  orderId: number;
  invoice: string;
  vendedor: string;
  cliente: string;
  pais: string;
  produto: string;
  totalUSD: number;
  commissionBaseUSD: number;
  comissaoPct: number;
  exchangeRate: number;
  commissionBRL: number;
  statusPagamento: string;
  statusComissao: "prevista" | "devida" | "paga";
  paidAt: string | null;
  notes: string | null;
  embarqueDate: string | null;
  createdAt: string | null;
}

const statusComissaoConfig = {
  prevista: { label: "Prevista", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300", icon: Clock },
  devida: { label: "Devida", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300", icon: AlertCircle },
  paga: { label: "Paga", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300", icon: CheckCircle2 },
};

const statusPagamentoConfig: Record<string, { label: string; color: string }> = {
  pendente: { label: "Pendente", color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  pago: { label: "Pago", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  atrasado: { label: "Atrasado", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
};

function fmtUSD(v: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);
}
function fmtBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}
function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

export default function Commissions() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filterVendedor, setFilterVendedor] = useState("all");
  const [filterStatus, setFilterStatus] = useState("devida");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

  const { data: selectedOrder, isLoading: isLoadingOrder } = useQuery<ExportOrderWithDetails>({
    queryKey: ["/api/orders", selectedOrderId],
    enabled: selectedOrderId !== null,
  });

  const { data: rows = [], isLoading } = useQuery<CommissionRow[]>({
    queryKey: ["/api/commissions"],
  });

  const { data: users = [] } = useQuery<PlatformUser[]>({
    queryKey: ["/api/platform-users"],
  });

  const updateMutation = useMutation({
    mutationFn: ({ orderId, status, notes }: { orderId: number; status: string; notes?: string }) =>
      apiRequest("PATCH", `/api/commissions/${orderId}`, { status, notes }),
    onMutate: ({ orderId, status }) => {
      queryClient.setQueryData(["/api/commissions"], (old: CommissionRow[] | undefined) =>
        old?.map((r) => r.orderId === orderId ? { ...r, statusComissao: status as CommissionRow["statusComissao"] } : r) ?? old
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/commissions"] });
      toast({ title: "Comissão atualizada" });
    },
    onError: (e: Error) => {
      queryClient.invalidateQueries({ queryKey: ["/api/commissions"] });
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    },
  });

  const vendedores = useMemo(() => {
    const names = new Set(rows.filter((r) => r.vendedor !== "—").map((r) => r.vendedor));
    return Array.from(names).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return rows.filter((r) => {
      if (r.vendedor === "—") return false;
      if (filterVendedor !== "all" && r.vendedor !== filterVendedor) return false;
      if (filterStatus !== "all" && r.statusComissao !== filterStatus) return false;
      if (s) {
        return (
          r.invoice.toLowerCase().includes(s) ||
          r.cliente.toLowerCase().includes(s) ||
          r.vendedor.toLowerCase().includes(s) ||
          r.produto.toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [rows, filterVendedor, filterStatus, search]);

  useEffect(() => { setPage(1); }, [search, filterVendedor, filterStatus]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totals = useMemo(() => {
    const all = rows.filter((r) => r.comissaoPct > 0);
    const prevista = all.filter((r) => r.statusComissao === "prevista").reduce((s, r) => s + r.commissionBRL, 0);
    const devida = all.filter((r) => r.statusComissao === "devida").reduce((s, r) => s + r.commissionBRL, 0);
    const paga = all.filter((r) => r.statusComissao === "paga").reduce((s, r) => s + r.commissionBRL, 0);
    const totalOrdens = rows.filter((r) => r.comissaoPct > 0).length;
    return { prevista, devida, paga, totalOrdens };
  }, [rows]);

  const ordensWithoutVendedor = rows.filter((r) => r.vendedor === "—").length;
  const ordensWithoutRate = rows.filter((r) => r.comissaoPct > 0 && r.exchangeRate === 0).length;

  function exportCSV() {
    const header = ["Ordem", "Invoice", "Vendedor", "Cliente", "País", "Produto", "Total USD", "Base Comissão USD", "% Comissão", "Taxa Câmbio", "Comissão BRL", "Status Pagamento", "Status Comissão", "Data Embarque"];
    const data = filtered.map((r) => [
      r.orderId, r.invoice, r.vendedor, r.cliente, r.pais, r.produto,
      r.totalUSD.toFixed(2), r.commissionBaseUSD.toFixed(2),
      r.comissaoPct.toFixed(2), r.exchangeRate.toFixed(4), r.commissionBRL.toFixed(2),
      r.statusPagamento, r.statusComissao, r.embarqueDate ?? "",
    ]);
    const csv = [header, ...data].map((row) => row.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `comissoes_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Relatório de Comissões</h1>
          <p className="text-muted-foreground text-sm">Cálculo de comissões por vendedor com base nas Ordens de Exportação</p>
        </div>
        <Button variant="outline" onClick={exportCSV} data-testid="button-export-commissions">
          <Download className="h-4 w-4 mr-2" />
          Exportar CSV
        </Button>
      </div>

      {(ordensWithoutVendedor > 0 || ordensWithoutRate > 0) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            {ordensWithoutVendedor > 0 && (
              <p>{ordensWithoutVendedor} ordem(ns) sem vendedor definido — comissão não calculada.</p>
            )}
            {ordensWithoutRate > 0 && (
              <p>{ordensWithoutRate} ordem(ns) sem taxa de câmbio — comissão BRL será zero. Defina o câmbio de fechamento na Ordem.</p>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Total Prevista</p>
              <Clock className="h-4 w-4 text-blue-500" />
            </div>
            <p className="text-xl font-bold mt-1 text-blue-600 dark:text-blue-400">{fmtBRL(totals.prevista)}</p>
            <p className="text-xs text-muted-foreground">aguardando embarque</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Total Devida</p>
              <AlertCircle className="h-4 w-4 text-amber-500" />
            </div>
            <p className="text-xl font-bold mt-1 text-amber-600 dark:text-amber-400">{fmtBRL(totals.devida)}</p>
            <p className="text-xs text-muted-foreground">pronta para pagamento</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Total Paga</p>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </div>
            <p className="text-xl font-bold mt-1 text-green-600 dark:text-green-400">{fmtBRL(totals.paga)}</p>
            <p className="text-xs text-muted-foreground">confirmadas e liquidadas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Ordens com Comissão</p>
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <p className="text-xl font-bold mt-1">{totals.totalOrdens}</p>
            <p className="text-xs text-muted-foreground">vendedores com % configurado</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por invoice, cliente ou vendedor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-commissions"
          />
        </div>
        <Select value={filterVendedor} onValueChange={setFilterVendedor}>
          <SelectTrigger className="w-full sm:w-48" data-testid="select-filter-vendedor">
            <Users className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Todos os vendedores" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os vendedores</SelectItem>
            {vendedores.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-44" data-testid="select-filter-status-commissions">
            <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Todos os status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="prevista">Prevista</SelectItem>
            <SelectItem value="devida">Devida</SelectItem>
            <SelectItem value="paga">Paga</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Percent className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1">Nenhuma comissão encontrada</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              {rows.every((r) => r.vendedor === "—")
                ? "Nenhuma ordem possui vendedor atribuído. Edite as Ordens de Exportação e selecione um vendedor para calcular comissões."
                : "Nenhuma comissão corresponde aos filtros selecionados."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Total Ordem (USD)</TableHead>
                <TableHead className="text-right">Base Comissão (USD)</TableHead>
                <TableHead className="text-right">% Comissão</TableHead>
                <TableHead className="text-right">Taxa (R$)</TableHead>
                <TableHead className="text-right">Comissão (BRL)</TableHead>
                <TableHead>Status Pgto</TableHead>
                <TableHead>Status Comissão</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((row) => {
                const statusCfg = statusComissaoConfig[row.statusComissao];
                const pgto = statusPagamentoConfig[row.statusPagamento] ?? { label: row.statusPagamento, color: "" };
                const StatusIcon = statusCfg.icon;
                const hasCommission = row.comissaoPct > 0;

                return (
                  <TableRow key={row.orderId} data-testid={`row-commission-${row.orderId}`} className={!hasCommission ? "opacity-50" : ""}>
                    <TableCell className="font-medium">
                      <button
                        className="text-left hover:text-primary hover:underline transition-colors"
                        onClick={() => setSelectedOrderId(row.orderId)}
                        data-testid={`button-invoice-detail-${row.orderId}`}
                      >
                        {row.invoice}
                      </button>
                      {row.embarqueDate && <div className="text-[11px] text-muted-foreground">{fmtDate(row.embarqueDate)}</div>}
                    </TableCell>
                    <TableCell>
                      {row.vendedor === "—" ? (
                        <span className="text-muted-foreground italic text-xs">Não definido</span>
                      ) : (
                        <span className="font-medium">{row.vendedor}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div>{row.cliente}</div>
                      <div className="text-[11px] text-muted-foreground">{row.pais}</div>
                    </TableCell>
                    <TableCell className="max-w-[120px] truncate text-sm">{row.produto}</TableCell>
                    <TableCell className="text-right font-medium">{fmtUSD(row.totalUSD)}</TableCell>
                    <TableCell className="text-right">{fmtUSD(row.commissionBaseUSD)}</TableCell>
                    <TableCell className="text-right">
                      {hasCommission ? (
                        <span className="font-semibold text-primary">{row.comissaoPct.toFixed(2)}%</span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {row.exchangeRate > 0 ? (
                        <Tooltip>
                          <TooltipTrigger>
                            <span className="cursor-help">R$ {row.exchangeRate.toFixed(4)}</span>
                          </TooltipTrigger>
                          <TooltipContent>Taxa de fechamento da Ordem</TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className="text-muted-foreground text-xs">Sem taxa</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-green-700 dark:text-green-400">
                      {hasCommission && row.exchangeRate > 0 ? fmtBRL(row.commissionBRL) : (
                        <span className="text-muted-foreground font-normal text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${pgto.color}`}>
                        {pgto.label}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${statusCfg.color}`}>
                        <StatusIcon className="h-3 w-3" />
                        {statusCfg.label}
                      </span>
                      {row.paidAt && (
                        <div className="text-[10px] text-muted-foreground mt-0.5">{fmtDate(row.paidAt)}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {hasCommission && row.statusComissao !== "paga" && (
                        <Button
                          size="sm"
                          variant={row.statusComissao === "devida" ? "default" : "outline"}
                          className="text-xs h-7"
                          disabled={updateMutation.isPending}
                          onClick={() => updateMutation.mutate({ orderId: row.orderId, status: "paga" })}
                          data-testid={`button-mark-paid-${row.orderId}`}
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Marcar Paga
                        </Button>
                      )}
                      {row.statusComissao === "paga" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs h-7 text-muted-foreground"
                          disabled={updateMutation.isPending}
                          onClick={() => updateMutation.mutate({ orderId: row.orderId, status: "devida" })}
                          data-testid={`button-revert-paid-${row.orderId}`}
                        >
                          Reverter
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Exibindo {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length} comissões
          </span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(1)} disabled={page === 1} data-testid="button-commission-first">
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} data-testid="button-commission-prev">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
              .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...");
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === "..." ? (
                  <span key={`ellipsis-${i}`} className="px-1 text-muted-foreground">…</span>
                ) : (
                  <Button key={p} variant={page === p ? "default" : "outline"} size="icon" className="h-8 w-8" onClick={() => setPage(p as number)} data-testid={`button-commission-page-${p}`}>
                    {p}
                  </Button>
                )
              )}
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} data-testid="button-commission-next">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(totalPages)} disabled={page === totalPages} data-testid="button-commission-last">
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-lg bg-muted/40 border px-4 py-3 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground text-sm">Como funciona o cálculo</p>
        <p><span className="font-medium">Base de Cálculo:</span> Valor total da ordem (FOB/EXW em USD) × % de comissão do vendedor</p>
        <p><span className="font-medium">Câmbio:</span> Taxa de fechamento registrada na Ordem de Exportação (campo "Câmbio de Fechamento")</p>
        <p><span className="font-medium">Prevista:</span> Ordem pendente sem embarque confirmado</p>
        <p><span className="font-medium">Devida:</span> Ordem embarcada (data de embarque atingida, vessel em movimento) ou pagamento recebido/atrasado</p>
        <p><span className="font-medium">Paga:</span> Comissão marcada como liquidada pelo gestor financeiro</p>
        <p><span className="font-medium">% de Comissão:</span> Configurado individualmente em Cadastros → Usuários</p>
      </div>

      <Dialog open={selectedOrderId !== null} onOpenChange={(open) => { if (!open) setSelectedOrderId(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da Ordem — {selectedOrder?.invoice ?? "..."}</DialogTitle>
          </DialogHeader>
          {isLoadingOrder ? (
            <div className="space-y-3 py-4">
              {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : selectedOrder ? (
            <OrderDetail order={selectedOrder} />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
