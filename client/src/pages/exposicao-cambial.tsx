import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle, TrendingUp, DollarSign, Globe, ShieldAlert,
  ArrowUpRight, ArrowDownRight, BarChart3, Minus, Eye,
  Ship, Truck, FileText, Calculator, RefreshCw
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from "recharts";
import type { ExportOrderWithDetails } from "@shared/schema";

const CHART_COLORS = ["#083F62", "#2276BB", "#FABD00", "#0EA5E9", "#6366F1", "#EC4899"];

const countryToCurrency: Record<string, string> = {
  Brasil: "BRL",
  Argentina: "ARS",
  Chile: "CLP",
  Uruguai: "UYU",
  Paraguai: "PYG",
  "México": "MXN",
  Mexico: "MXN",
};

const currencyNames: Record<string, string> = {
  BRL: "Real Brasileiro",
  ARS: "Peso Argentino",
  CLP: "Peso Chileno",
  UYU: "Peso Uruguaio",
  PYG: "Guarani Paraguaio",
  MXN: "Peso Mexicano",
};

type QuotesData = {
  base: string;
  date: string;
  lastUpdate?: string;
  source?: string;
  currencies: Array<{
    code: string;
    name: string;
    country: string;
    rate: number;
    previousRate: number | null;
    change24h: number | null;
  }>;
};

function formatCurrency(value: number, currency = "USD") {
  if (currency === "USD") {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD" }).format(value);
  }
  const symbols: Record<string, string> = { BRL: "R$", ARS: "ARS$", CLP: "CLP$", UYU: "UYU$", PYG: "PYG", MXN: "MX$" };
  const sym = symbols[currency] || currency;
  if (currency === "PYG" || currency === "CLP") {
    return `${sym} ${Math.round(value).toLocaleString("pt-BR")}`;
  }
  return `${sym} ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPercent(value: number) {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatDate(d: string | null | undefined) {
  if (!d) return "-";
  return new Date(d + "T00:00:00").toLocaleDateString("pt-BR");
}

type CurrencyExposure = {
  currency: string;
  currencyName: string;
  country: string;
  totalUsd: number;
  orderCount: number;
  currentRate: number;
  previousRate: number | null;
  change24h: number | null;
  valueLocal: number;
  impact5Up: number;
  impact5Down: number;
  impact10Up: number;
  impact10Down: number;
  orders: ExportOrderWithDetails[];
};

type OrderExposure = {
  order: ExportOrderWithDetails;
  currency: string;
  currencyName: string;
  currentRate: number;
  change24h: number | null;
  valueUsd: number;
  valueLocal: number;
  impact5Down: number;
  impact10Down: number;
  impact5Up: number;
  impact10Up: number;
};

function OrderDetailDialog({ exposure, open, onClose }: { exposure: OrderExposure | null; open: boolean; onClose: () => void }) {
  const [customRateInput, setCustomRateInput] = useState("");
  const [customPctInput, setCustomPctInput] = useState("");
  const [customMode, setCustomMode] = useState<"rate" | "pct">("rate");

  if (!exposure) return null;
  const { order, currency, currencyName, currentRate, change24h, valueUsd, valueLocal, impact5Down, impact10Down, impact5Up, impact10Up } = exposure;

  const customRate = (() => {
    if (customMode === "rate") {
      const v = parseFloat(customRateInput.replace(",", "."));
      return isNaN(v) || v <= 0 ? null : v;
    } else {
      const v = parseFloat(customPctInput.replace(",", "."));
      if (isNaN(v)) return null;
      return currentRate * (1 + v / 100);
    }
  })();

  const customValueLocal = customRate !== null ? valueUsd * customRate : null;
  const customDelta = customRate !== null ? valueUsd * (customRate - currentRate) : null;
  const customPctChange = customRate !== null ? ((customRate - currentRate) / currentRate) * 100 : null;

  const scenarios = [
    { label: "Apreciação +10%", rate: currentRate * 1.10, delta: impact10Up,  color: "text-green-600 dark:text-green-400",  bg: "bg-green-50 dark:bg-green-950/30" },
    { label: "Apreciação +5%",  rate: currentRate * 1.05, delta: impact5Up,   color: "text-green-600 dark:text-green-400",  bg: "bg-green-50 dark:bg-green-950/30" },
    { label: "Câmbio Atual",    rate: currentRate,         delta: 0,            color: "text-foreground",                     bg: "bg-muted/50" },
    { label: "Depreciação -5%", rate: currentRate * 0.95, delta: impact5Down,  color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-950/30" },
    { label: "Depreciação -10%",rate: currentRate * 0.90, delta: impact10Down, color: "text-red-600 dark:text-red-400",       bg: "bg-red-50 dark:bg-red-950/30" },
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            Exposição Cambial — {order.invoice}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
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
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Fábrica</p>
              <p className="text-sm">{order.factory}</p>
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
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Vencimento</p>
              <p className="text-sm">{formatDate(order.dueDate)}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Qtd / Preço Unit.</p>
              <p className="text-sm">{order.quantity} un × {formatCurrency(parseFloat(order.unitPrice ?? "0"))}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Status</p>
              <Badge variant={order.statusPagamento === "atrasado" ? "destructive" : "secondary"} className="text-xs capitalize">
                {order.statusPagamento}
              </Badge>
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
                  <p className="text-xl font-bold font-mono mt-1">{formatCurrency(valueUsd)}</p>
                </CardContent>
              </Card>
              <Card className="border-muted">
                <CardContent className="pt-3 pb-3">
                  <p className="text-xs text-muted-foreground">Moeda Local ({currency})</p>
                  <p className="text-xl font-bold font-mono mt-1">{formatCurrency(valueLocal, currency)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{currencyName}</p>
                </CardContent>
              </Card>
            </div>
            <div className="mt-2 flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Câmbio atual USD/{currency}:</span>
              <span className="font-mono font-medium">{currentRate.toFixed(4)}</span>
              {change24h !== null && (
                <span className={`flex items-center gap-0.5 text-xs ${change24h >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {change24h >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {formatPercent(change24h)} (24h)
                </span>
              )}
            </div>
          </div>

          <Separator />

          <div>
            <p className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Calculator className="h-4 w-4 text-muted-foreground" />
              Projeção Personalizada
            </p>

            <div className="flex gap-2 mb-3">
              <button
                onClick={() => { setCustomMode("rate"); setCustomPctInput(""); }}
                className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${customMode === "rate" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
              >
                Taxa de câmbio
              </button>
              <button
                onClick={() => { setCustomMode("pct"); setCustomRateInput(""); }}
                className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${customMode === "pct" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
              >
                Variação %
              </button>
            </div>

            {customMode === "rate" ? (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Digite a taxa USD/{currency} projetada</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">1 USD =</span>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder={currentRate.toFixed(4)}
                    value={customRateInput}
                    onChange={(e) => setCustomRateInput(e.target.value)}
                    className="pl-16 pr-14 font-mono text-sm h-9"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-muted-foreground">{currency}</span>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Digite a variação % em relação ao câmbio atual</Label>
                <div className="relative">
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="ex: -5 ou +10"
                    value={customPctInput}
                    onChange={(e) => setCustomPctInput(e.target.value)}
                    className="pr-8 font-mono text-sm h-9"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-muted-foreground">%</span>
                </div>
              </div>
            )}

            {customRate !== null && customValueLocal !== null && customDelta !== null && (
              <div className={`mt-3 rounded-lg border-2 p-4 ${customDelta > 0 ? "border-orange-300 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-700" : customDelta < 0 ? "border-green-300 bg-green-50 dark:bg-green-950/30 dark:border-green-700" : "border-muted bg-muted/30"}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div>
                      <p className="text-xs text-muted-foreground">Taxa projetada</p>
                      <p className="font-mono font-semibold text-sm">1 USD = {customRate.toFixed(4)} {currency}
                        {customPctChange !== null && (
                          <span className={`ml-2 text-xs ${customPctChange > 0 ? "text-orange-600" : "text-green-600"}`}>
                            ({formatPercent(customPctChange)})
                          </span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Valor projetado em {currency}</p>
                      <p className="font-mono font-bold text-lg">{formatCurrency(customValueLocal, currency)}</p>
                    </div>
                  </div>
                  <div className="text-right space-y-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Impacto (USD)</p>
                      <p className={`font-mono font-bold text-base ${customDelta > 0 ? "text-orange-600 dark:text-orange-400" : customDelta < 0 ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
                        {customDelta > 0 ? "+" : ""}{formatCurrency(customDelta)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Valor projetado (USD equiv.)</p>
                      <p className="font-mono font-semibold text-sm">{formatCurrency(customValueLocal / customRate)}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-current border-opacity-20">
                  <div className="flex items-center gap-2">
                    {customDelta > 0 ? (
                      <AlertTriangle className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400 shrink-0" />
                    ) : customDelta < 0 ? (
                      <ArrowDownRight className="h-3.5 w-3.5 text-green-600 dark:text-green-400 shrink-0" />
                    ) : null}
                    <p className={`text-xs ${customDelta > 0 ? "text-orange-700 dark:text-orange-300" : customDelta < 0 ? "text-green-700 dark:text-green-300" : "text-muted-foreground"}`}>
                      {customDelta > 0
                        ? `Com esta taxa, o custo na moeda local aumenta ${formatCurrency(customDelta)} acima do valor atual.`
                        : customDelta < 0
                        ? `Com esta taxa, o custo na moeda local reduz ${formatCurrency(Math.abs(customDelta))} abaixo do valor atual.`
                        : "Sem variação em relação ao câmbio atual."}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {(customRateInput || customPctInput) && customRate === null && (
              <p className="text-xs text-destructive mt-2">Valor inválido. Digite um número positivo.</p>
            )}

            <div className="mt-2 flex justify-end">
              <button
                onClick={() => { setCustomRateInput(""); setCustomPctInput(""); }}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              >
                <RefreshCw className="h-3 w-3" />
                Limpar
              </button>
            </div>
          </div>

          <Separator />

          <div>
            <p className="text-sm font-semibold mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              Cenários Padrão
            </p>
            <div className="space-y-2">
              {scenarios.map((s) => (
                <div
                  key={s.label}
                  className={`rounded-lg p-3 ${s.bg} flex items-center justify-between cursor-pointer hover:opacity-80 transition-opacity`}
                  onClick={() => {
                    setCustomMode("rate");
                    setCustomPctInput("");
                    setCustomRateInput(s.rate.toFixed(4));
                  }}
                >
                  <div>
                    <p className="text-sm font-medium">{s.label}</p>
                    <p className="text-xs text-muted-foreground font-mono">1 USD = {s.rate.toFixed(4)} {currency}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono font-semibold">{formatCurrency(valueUsd * s.rate, currency)}</p>
                    {s.delta !== 0 && (
                      <p className={`text-xs font-mono ${s.color}`}>
                        {s.delta > 0 ? "+" : ""}{formatCurrency(Math.abs(s.delta))} USD
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Clique em um cenário para usá-lo na projeção personalizada.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ExposicaoCambial() {
  const { data: orders, isLoading: ordersLoading } = useQuery<ExportOrderWithDetails[]>({ queryKey: ["/api/orders"] });
  const { data: quotesData, isLoading: quotesLoading } = useQuery<QuotesData>({ queryKey: ["/api/quotes"] });
  const [selectedExposure, setSelectedExposure] = useState<OrderExposure | null>(null);

  const isLoading = ordersLoading || quotesLoading;

  const { exposureData, orderExposures } = useMemo(() => {
    if (!orders || !quotesData) return { exposureData: [], orderExposures: [] };

    const openOrders = orders.filter((o) => o.statusPagamento !== "pago");
    const byCurrency = new Map<string, { orders: ExportOrderWithDetails[]; totalUsd: number }>();
    const perOrder: OrderExposure[] = [];

    for (const order of openOrders) {
      const country = order.client?.country;
      if (!country) continue;
      const currency = countryToCurrency[country];
      if (!currency) continue;

      const rateData = quotesData.currencies.find((c) => c.code === currency);
      if (!rateData) continue;

      const valueUsd = parseFloat(order.total);
      const rate = rateData.rate;
      const valueLocal = valueUsd * rate;

      perOrder.push({
        order,
        currency,
        currencyName: currencyNames[currency] || currency,
        currentRate: rate,
        change24h: rateData.change24h,
        valueUsd,
        valueLocal,
        impact5Down:  valueUsd * rate * -0.05,
        impact10Down: valueUsd * rate * -0.10,
        impact5Up:    valueUsd * rate * 0.05,
        impact10Up:   valueUsd * rate * 0.10,
      });

      const existing = byCurrency.get(currency) || { orders: [], totalUsd: 0 };
      existing.orders.push(order);
      existing.totalUsd += valueUsd;
      byCurrency.set(currency, existing);
    }

    const result: CurrencyExposure[] = [];
    for (const [currency, data] of byCurrency) {
      const rateData = quotesData.currencies.find((c) => c.code === currency);
      if (!rateData) continue;
      const rate = rateData.rate;
      const valueLocal = data.totalUsd * rate;
      result.push({
        currency,
        currencyName: currencyNames[currency] || currency,
        country: rateData.country,
        totalUsd: data.totalUsd,
        orderCount: data.orders.length,
        currentRate: rate,
        previousRate: rateData.previousRate,
        change24h: rateData.change24h,
        valueLocal,
        impact5Up:    data.totalUsd * rate * 0.05,
        impact5Down:  data.totalUsd * rate * -0.05,
        impact10Up:   data.totalUsd * rate * 0.10,
        impact10Down: data.totalUsd * rate * -0.10,
        orders: data.orders,
      });
    }

    return {
      exposureData: result.sort((a, b) => b.totalUsd - a.totalUsd),
      orderExposures: perOrder.sort((a, b) => b.valueUsd - a.valueUsd),
    };
  }, [orders, quotesData]);

  const totalExposureUsd = exposureData.reduce((s, e) => s + e.totalUsd, 0);
  const totalImpact5    = exposureData.reduce((s, e) => s + e.impact5Up, 0);
  const totalImpact10   = exposureData.reduce((s, e) => s + e.impact10Up, 0);
  const totalOpenOrders = exposureData.reduce((s, e) => s + e.orderCount, 0);

  const pieData = exposureData.map((e) => ({ name: e.currency, value: e.totalUsd }));
  const impactChartData = exposureData.map((e) => ({
    name: e.currency,
    "Depr. 10%": Math.abs(e.impact10Down),
    "Depr. 5%":  Math.abs(e.impact5Down),
    "Apre. 5%":  e.impact5Up,
    "Apre. 10%": e.impact10Up,
  }));

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
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-exposure-title">Exposição Cambial</h1>
        <p className="text-muted-foreground text-sm">Análise de risco cambial sobre ordens de exportação em aberto</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Exposição Total (USD)</p>
            </div>
            <p className="text-2xl font-bold font-mono" data-testid="text-total-exposure">{formatCurrency(totalExposureUsd)}</p>
            <p className="text-xs text-muted-foreground mt-1">{totalOpenOrders} ordens em aberto</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Moedas Expostas</p>
            </div>
            <p className="text-2xl font-bold" data-testid="text-currency-count">{exposureData.length}</p>
            <p className="text-xs text-muted-foreground mt-1">{exposureData.map((e) => e.currency).join(", ") || "-"}</p>
          </CardContent>
        </Card>
        <Card className="border-orange-200 dark:border-orange-800">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-2">
              <ArrowUpRight className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              <p className="text-xs text-orange-600 dark:text-orange-400 uppercase tracking-wide">Risco +5% Câmbio</p>
            </div>
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 font-mono" data-testid="text-risk-5pct">
              {formatCurrency(totalImpact5)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">impacto se moedas depreciarem 5%</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-2">
              <ShieldAlert className="h-4 w-4 text-red-600 dark:text-red-400" />
              <p className="text-xs text-red-600 dark:text-red-400 uppercase tracking-wide">Risco +10% Câmbio</p>
            </div>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400 font-mono" data-testid="text-risk-10pct">
              {formatCurrency(totalImpact10)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">impacto se moedas depreciarem 10%</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              Distribuição por Moeda
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
                Nenhuma exposição cambial ativa
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              Simulação de Impacto Cambial
            </CardTitle>
          </CardHeader>
          <CardContent>
            {impactChartData.length === 0 ? (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
                Nenhuma exposição para simular
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={impactChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(value: number, name: string) => [formatCurrency(value), name]}
                    contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                  <Bar dataKey="Depr. 10%" fill="#EF4444" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Depr. 5%"  fill="#F97316" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Apre. 5%"  fill="#22C55E" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Apre. 10%" fill="#16A34A" radius={[2, 2, 0, 0]} />
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
            Resumo por Moeda
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {exposureData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <DollarSign className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-1">Nenhuma exposição cambial</h3>
              <p className="text-sm text-muted-foreground">Não há ordens em aberto com exposição a moedas estrangeiras.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Moeda</TableHead>
                  <TableHead>País</TableHead>
                  <TableHead className="text-right">Ordens</TableHead>
                  <TableHead className="text-right">Total (USD)</TableHead>
                  <TableHead className="text-right">Câmbio Atual</TableHead>
                  <TableHead className="text-right">Var. 24h</TableHead>
                  <TableHead className="text-right">Valor Local</TableHead>
                  <TableHead className="text-right">Impacto -5%</TableHead>
                  <TableHead className="text-right">Impacto -10%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exposureData.map((exp) => (
                  <TableRow key={exp.currency} data-testid={`row-exposure-${exp.currency}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="font-mono" data-testid={`badge-currency-${exp.currency}`}>
                          {exp.currency}
                        </Badge>
                        <span className="text-xs text-muted-foreground hidden sm:inline">{exp.currencyName}</span>
                      </div>
                    </TableCell>
                    <TableCell><span className="text-sm">{exp.country}</span></TableCell>
                    <TableCell className="text-right font-mono" data-testid={`text-orders-${exp.currency}`}>{exp.orderCount}</TableCell>
                    <TableCell className="text-right font-mono font-medium" data-testid={`text-usd-${exp.currency}`}>{formatCurrency(exp.totalUsd)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{exp.currentRate.toFixed(4)}</TableCell>
                    <TableCell className="text-right">
                      {exp.change24h !== null ? (
                        <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${exp.change24h >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                          {exp.change24h >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                          {formatPercent(exp.change24h)}
                        </span>
                      ) : (
                        <Minus className="h-3 w-3 text-muted-foreground inline" />
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm" data-testid={`text-local-${exp.currency}`}>{formatCurrency(exp.valueLocal, exp.currency)}</TableCell>
                    <TableCell className="text-right">
                      <span className="text-orange-600 dark:text-orange-400 text-sm font-mono">{formatCurrency(Math.abs(exp.impact5Down))}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-red-600 dark:text-red-400 text-sm font-mono">{formatCurrency(Math.abs(exp.impact10Down))}</span>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell colSpan={3} className="text-right text-sm uppercase tracking-wide">Total</TableCell>
                  <TableCell className="text-right font-mono" data-testid="text-total-row-usd">{formatCurrency(totalExposureUsd)}</TableCell>
                  <TableCell colSpan={3}></TableCell>
                  <TableCell className="text-right text-orange-600 dark:text-orange-400 font-mono">
                    {formatCurrency(Math.abs(exposureData.reduce((s, e) => s + e.impact5Down, 0)))}
                  </TableCell>
                  <TableCell className="text-right text-red-600 dark:text-red-400 font-mono">
                    {formatCurrency(Math.abs(exposureData.reduce((s, e) => s + e.impact10Down, 0)))}
                  </TableCell>
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
            Exposição por Exportação
            <Badge variant="secondary" className="ml-auto text-xs">{orderExposures.length} ordens em aberto</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {orderExposures.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <DollarSign className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-1">Nenhuma exposição cambial</h3>
              <p className="text-sm text-muted-foreground">Não há ordens em aberto.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>País / Moeda</TableHead>
                  <TableHead className="text-right">Valor (USD)</TableHead>
                  <TableHead className="text-right">Câmbio</TableHead>
                  <TableHead className="text-right">Valor Local</TableHead>
                  <TableHead className="text-right">Risco -5%</TableHead>
                  <TableHead className="text-right">Risco -10%</TableHead>
                  <TableHead className="text-center">Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orderExposures.map((exp) => (
                  <TableRow key={exp.order.id}>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {exp.order.modal === "maritimo" ? <Ship className="h-3 w-3 text-muted-foreground" /> : <Truck className="h-3 w-3 text-muted-foreground" />}
                        <span className="font-mono text-sm font-medium">{exp.order.invoice}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">{exp.order.client?.name ?? "-"}</p>
                      <p className="text-xs text-muted-foreground">{exp.order.factory}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{exp.order.client?.country}</span>
                        <Badge variant="outline" className="font-mono text-xs">{exp.currency}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">{formatCurrency(exp.valueUsd)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end">
                        <span className="font-mono text-sm">{exp.currentRate.toFixed(4)}</span>
                        {exp.change24h !== null && (
                          <span className={`flex items-center gap-0.5 text-xs ${exp.change24h >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {exp.change24h >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                            {formatPercent(exp.change24h)}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatCurrency(exp.valueLocal, exp.currency)}</TableCell>
                    <TableCell className="text-right">
                      <span className="text-orange-600 dark:text-orange-400 text-sm font-mono">{formatCurrency(Math.abs(exp.impact5Down))}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-red-600 dark:text-red-400 text-sm font-mono">{formatCurrency(Math.abs(exp.impact10Down))}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs gap-1"
                        onClick={() => setSelectedExposure(exp)}
                      >
                        <Eye className="h-3 w-3" />
                        Detalhes
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {quotesData && (
        <p className="text-xs text-muted-foreground text-right" data-testid="text-quotes-source">
          Cotações atualizadas em {new Date(quotesData.lastUpdate || "").toLocaleString("pt-BR")} | Fonte: {quotesData.source || "ExchangeRate-API"}
        </p>
      )}

      <OrderDetailDialog
        exposure={selectedExposure}
        open={selectedExposure !== null}
        onClose={() => setSelectedExposure(null)}
      />
    </div>
  );
}
