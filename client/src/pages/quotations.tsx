import { useState, useEffect, useRef, Fragment } from "react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Plus, Search, Pencil, Trash2, FileCheck, Send, Mail, MessageCircle,
  ArrowRight, ChevronDown, ChevronRight, Clock, Eye, TrendingUp, FileDown,
  LayoutGrid, List, StickyNote, User, X, ChevronUp, Calculator, Flame,
} from "lucide-react";
import { QuotationCalculator } from "@/components/quotation-calculator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { insertQuotationSchema, type QuotationWithDetails, type InsertQuotation, type Client, type Product, type Supplier, type QuotationSendLogEntry, type QuotationNote } from "@shared/schema";
import { z } from "zod";
import { useLocation } from "wouter";
import logoPath from "@assets/Captura_de_tela_2026-02-27_111909_1772203458683.png";

const statusLabels: Record<string, string> = {
  rascunho: "Rascunho",
  enviada: "Enviada",
  aceita: "Aceita",
  recusada: "Recusada",
  convertida: "Convertida",
};

const statusColors: Record<string, string> = {
  rascunho: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  enviada: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  aceita: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  recusada: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  convertida: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
};

function formatCurrency(value: number | string) {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD" }).format(num);
}

function formatDate(date: string | Date | null) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("pt-BR");
}

const formSchema = insertQuotationSchema.extend({
  clientId: z.coerce.number().min(1, "Selecione um cliente"),
  productId: z.coerce.number().min(1, "Selecione um produto"),
  supplierId: z.coerce.number().optional().nullable(),
  unitPrice: z.string().min(1, "Informe o preço"),
  quantity: z.coerce.number().min(1, "Informe a quantidade"),
  margem: z.string().optional().nullable(),
});


function CostRevenuePanel({
  clientId,
  productId,
  unitPrice,
  quantity,
  margem,
  clientsList,
  productsList,
  calcBreakdown,
  unit,
}: {
  clientId: number;
  productId: number;
  unitPrice: string | number;
  quantity: number;
  margem?: string | null;
  clientsList?: Client[];
  productsList?: Product[];
  calcBreakdown?: CalcBreakdown | null;
  unit?: string;
}) {
  const price = typeof unitPrice === "string" ? parseFloat(unitPrice) : unitPrice;
  if (!clientId || !productId || !price || !quantity || isNaN(price) || price <= 0 || quantity <= 0) return null;

  const client = clientsList?.find((c) => c.id === clientId);
  const product = productsList?.find((p) => p.id === productId);
  if (!client || !product) return null;

  const totalUsd = price * quantity;
  const fmtU = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD" }).format(v);

  if (calcBreakdown) {
    const { custoMaterialUSD, freteInternoUSD, freteInternacionalUSD, despesasAduaneirasUSD, seguroUSD, totalCustosUSD, incoterm, margemPct } = calcBreakdown;
    const lucroUSD = totalCustosUSD * (margemPct / 100);
    const custosExportacao = freteInternoUSD + despesasAduaneirasUSD + (incoterm === "CIF" ? freteInternacionalUSD + seguroUSD : 0);
    const pct = (val: number) => totalUsd > 0 ? ((val / totalUsd) * 100).toFixed(1) : "0.0";

    return (
      <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4 space-y-3" data-testid="panel-cost-revenue">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
            <TrendingUp className="h-4 w-4" />
            <span>Resumo Financeiro</span>
          </div>
          <Badge variant="outline" className="text-xs font-semibold">{incoterm}</Badge>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-md bg-background p-3 border" data-testid="card-total-usd">
            <p className="text-xs text-muted-foreground mb-0.5">Total Venda ({incoterm})</p>
            <p className="text-lg font-bold">{fmtU(totalUsd)}</p>
            <p className="text-xs text-muted-foreground">{fmtU(price)}/{unit ?? "un"} × {quantity} {unit ?? "un"}</p>
          </div>
          <div className="rounded-md bg-background p-3 border" data-testid="card-total-custos">
            <p className="text-xs text-muted-foreground mb-0.5">Total Custos</p>
            <p className="text-lg font-bold text-orange-600 dark:text-orange-400">{fmtU(totalCustosUSD)}</p>
            <p className="text-xs text-muted-foreground">{pct(totalCustosUSD)}% da receita</p>
          </div>
        </div>

        <div className="rounded-md bg-background border overflow-hidden" data-testid="card-custos-detalhado">
          <div className="px-3 py-2 bg-muted/50 border-b">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Detalhamento de Custos</p>
          </div>
          <div className="divide-y">
            <div className="flex items-center justify-between px-3 py-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-sm">Custo do Material</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-semibold">{fmtU(custoMaterialUSD)}</span>
                <span className="text-xs text-muted-foreground ml-2">{pct(custoMaterialUSD)}%</span>
              </div>
            </div>
            {freteInternoUSD > 0 && (
              <div className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-sm">Frete Interno</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold">{fmtU(freteInternoUSD)}</span>
                  <span className="text-xs text-muted-foreground ml-2">{pct(freteInternoUSD)}%</span>
                </div>
              </div>
            )}
            {despesasAduaneirasUSD > 0 && (
              <div className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-purple-500" />
                  <span className="text-sm">Despesas Aduaneiras</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold">{fmtU(despesasAduaneirasUSD)}</span>
                  <span className="text-xs text-muted-foreground ml-2">{pct(despesasAduaneirasUSD)}%</span>
                </div>
              </div>
            )}
            {incoterm === "CIF" && freteInternacionalUSD > 0 && (
              <div className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-cyan-500" />
                  <span className="text-sm">Frete Internacional</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold">{fmtU(freteInternacionalUSD)}</span>
                  <span className="text-xs text-muted-foreground ml-2">{pct(freteInternacionalUSD)}%</span>
                </div>
              </div>
            )}
            {incoterm === "CIF" && seguroUSD > 0 && (
              <div className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-slate-400" />
                  <span className="text-sm">Seguro (0,2%)</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold">{fmtU(seguroUSD)}</span>
                  <span className="text-xs text-muted-foreground ml-2">{pct(seguroUSD)}%</span>
                </div>
              </div>
            )}
            {custosExportacao > 0 && (
              <div className="flex items-center justify-between px-3 py-2 bg-orange-50/50 dark:bg-orange-950/20">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-orange-500" />
                  <span className="text-sm font-medium text-orange-700 dark:text-orange-300">Custos de Exportação</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-orange-700 dark:text-orange-300">{fmtU(custosExportacao)}</span>
                  <span className="text-xs text-orange-500 ml-2">{pct(custosExportacao)}%</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={`rounded-md p-3 border ${lucroUSD >= 0 ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800" : "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800"}`} data-testid="card-revenue">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <TrendingUp className={`h-3.5 w-3.5 ${lucroUSD >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500"}`} />
              <p className={`text-xs font-semibold uppercase tracking-wide ${lucroUSD >= 0 ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"}`}>
                Lucro da Operação
              </p>
            </div>
            <Badge variant="secondary" className={`text-sm font-bold px-2.5 py-1 ${lucroUSD >= 0 ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"}`}>
              {margemPct.toFixed(1)}% margem
            </Badge>
          </div>
          <p className={`text-2xl font-bold ${lucroUSD >= 0 ? "text-green-900 dark:text-green-100" : "text-red-900 dark:text-red-100"}`}>
            {fmtU(lucroUSD)}
          </p>
          <p className={`text-xs mt-1 ${lucroUSD >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
            {fmtU(totalUsd)} receita − {fmtU(totalCustosUSD)} custos totais
          </p>
        </div>
      </div>
    );
  }

  const standardPrice = parseFloat(product.standardPrice);
  const hasValidCost = !isNaN(standardPrice) && standardPrice >= 0;
  const costUsd = hasValidCost ? standardPrice * quantity : 0;
  const margemNum = margem ? parseFloat(margem) : null;
  const lucroUsd = margemNum !== null && !isNaN(margemNum) && margemNum > 0
    ? totalUsd * (margemNum / 100)
    : hasValidCost ? totalUsd - costUsd : totalUsd;
  const displayMargem = margemNum !== null && !isNaN(margemNum) && margemNum > 0
    ? margemNum
    : totalUsd > 0 ? ((totalUsd - costUsd) / totalUsd) * 100 : 0;

  return (
    <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4 space-y-3" data-testid="panel-cost-revenue">
      <div className="flex items-center gap-2 text-sm font-semibold text-primary">
        <TrendingUp className="h-4 w-4" />
        <span>Resumo Financeiro</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-md bg-background p-3 border" data-testid="card-total-usd">
          <p className="text-xs text-muted-foreground mb-1">Total Venda (USD)</p>
          <p className="text-lg font-bold">{formatCurrency(totalUsd)}</p>
        </div>
        <div className="rounded-md bg-background p-3 border" data-testid="card-cost-usd">
          <p className="text-xs text-muted-foreground mb-1">Custo Produto (USD)</p>
          <p className="text-xs text-muted-foreground">{formatCurrency(standardPrice)}/{unit ?? "un"} × {quantity} {unit ?? "un"}</p>
          <p className="text-lg font-bold">{formatCurrency(costUsd)}</p>
        </div>
      </div>

      <div className={`rounded-md p-3 border ${lucroUsd >= 0 ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800" : "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800"}`} data-testid="card-revenue">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <TrendingUp className={`h-3.5 w-3.5 ${lucroUsd >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`} />
            <p className={`text-xs font-semibold uppercase tracking-wide ${lucroUsd >= 0 ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"}`}>
              Lucro da Operação
            </p>
          </div>
          <Badge variant="secondary" className={`text-sm font-bold px-2.5 py-1 ${lucroUsd >= 0 ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"}`}>
            {displayMargem.toFixed(1)}% margem
          </Badge>
        </div>
        <p className={`text-2xl font-bold ${lucroUsd >= 0 ? "text-green-900 dark:text-green-100" : "text-red-900 dark:text-red-100"}`}>
          {formatCurrency(lucroUsd)}
        </p>
        <p className={`text-xs mt-1 ${lucroUsd >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
          {margemNum !== null && !isNaN(margemNum) && margemNum > 0
            ? `${formatCurrency(totalUsd)} × ${displayMargem.toFixed(1)}%`
            : hasValidCost ? `(${formatCurrency(price)} − ${formatCurrency(standardPrice)}) × ${quantity} ${unit ?? "un"}` : ""}
        </p>
      </div>
    </div>
  );
}

interface CalcFields {
  moedaLocal: string;
  custoUnitario: string;
  pesoUnitario: string;
  freteInterno: string;
  freteInternacional: string;
  taxaCambio: string;
  despesasAduaneiras: string;
  margemLucro: string;
  incoterm: "FOB" | "CIF";
}

interface CalcBreakdown {
  custoMaterialUSD: number;
  freteInternoUSD: number;
  freteInternacionalUSD: number;
  despesasAduaneirasUSD: number;
  seguroUSD: number;
  totalCustosUSD: number;
  incoterm: "FOB" | "CIF";
  unitPrice: number;
  precoFOB: number;
  precoCIF: number;
  container: string;
  lucroUSD: number;
  margemPct: number;
}

function calcExportPrice(c: CalcFields, qty: number): CalcBreakdown | null {
  const custo = parseFloat(c.custoUnitario.replace(",", "."));
  const tc = parseFloat(c.taxaCambio.replace(",", "."));
  const fi = parseFloat(c.freteInterno.replace(",", ".")) || 0;
  const fintl = parseFloat(c.freteInternacional.replace(",", ".")) || 0;
  const desp = parseFloat(c.despesasAduaneiras.replace(",", ".")) || 0;
  const peso = parseFloat(c.pesoUnitario.replace(",", ".")) || 0;
  const margemLucro = parseFloat(c.margemLucro.replace(",", ".")) || 0;

  if (!custo || custo <= 0 || !tc || tc <= 0 || qty <= 0) return null;

  const custoFabUSD = (custo * qty) / tc;
  const fiUSD = fi / tc;
  const despUSD = custoFabUSD * (desp / 100);
  const custoFOB = custoFabUSD + fiUSD + despUSD;
  const seguro = custoFOB * 0.002;
  const custoCIF = custoFOB + fintl + seguro;
  const custoBase = c.incoterm === "CIF" ? custoCIF : custoFOB;

  const total = custoBase * (1 + margemLucro / 100);
  const unitP = qty > 0 ? total / qty : 0;
  const lucro = custoBase * (margemLucro / 100);
  const margem = margemLucro;

  const pesoTotal = qty * peso;
  let container = "LCL";
  if (pesoTotal >= 26500) container = "FCL 40'";
  else if (pesoTotal >= 5000) container = "FCL 20'";

  const precoFOBBase = custoFOB / qty;
  const precoCIFBase = custoCIF / qty;

  return {
    custoMaterialUSD: custoFabUSD,
    freteInternoUSD: fiUSD,
    freteInternacionalUSD: fintl,
    despesasAduaneirasUSD: despUSD,
    seguroUSD: seguro,
    totalCustosUSD: custoBase,
    incoterm: c.incoterm,
    unitPrice: unitP,
    precoFOB: precoFOBBase,
    precoCIF: precoCIFBase,
    container,
    lucroUSD: lucro,
    margemPct: margem,
  };
}

function QuotationForm({ editQuotation, onSuccess }: { editQuotation: QuotationWithDetails | null; onSuccess: () => void }) {
  const { toast } = useToast();
  const { currentUser } = useCurrentUser();
  const { data: clientsList } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: productsList } = useQuery<Product[]>({ queryKey: ["/api/products"] });
  const { data: suppliersList } = useQuery<Supplier[]>({ queryKey: ["/api/suppliers"] });
  const [showCalc, setShowCalc] = useState(!editQuotation);
  const [ptaxLoading, setPtaxLoading] = useState(false);
  const [ptaxDate, setPtaxDate] = useState<string | null>(null);
  const [calc, setCalc] = useState<CalcFields>({
    moedaLocal: "BRL", custoUnitario: "", pesoUnitario: "", freteInterno: "",
    freteInternacional: "", taxaCambio: "", despesasAduaneiras: "2", margemLucro: "20", incoterm: "FOB",
  });

  useEffect(() => {
    if (editQuotation) return;
    async function fetchPtax() {
      setPtaxLoading(true);
      try {
        for (let daysBack = 0; daysBack <= 5; daysBack++) {
          const d = new Date();
          d.setDate(d.getDate() - daysBack);
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const dd = String(d.getDate()).padStart(2, "0");
          const yyyy = d.getFullYear();
          const dateStr = `${mm}-${dd}-${yyyy}`;
          const res = await fetch(
            `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao='${dateStr}'&$format=json&$select=cotacaoVenda`
          );
          if (!res.ok) continue;
          const json = await res.json();
          const items = json?.value;
          if (items && items.length > 0) {
            const rate = items[items.length - 1].cotacaoVenda;
            setCalc((prev) => ({ ...prev, taxaCambio: String(rate.toFixed(4)) }));
            setPtaxDate(`${dd}/${mm}/${yyyy}`);
            break;
          }
        }
      } catch {
      } finally {
        setPtaxLoading(false);
      }
    }
    fetchPtax();
  }, []);

  const form = useForm<InsertQuotation>({
    resolver: zodResolver(formSchema),
    defaultValues: editQuotation
      ? {
          clientId: editQuotation.clientId,
          productId: editQuotation.productId,
          supplierId: editQuotation.supplierId || undefined,
          unitPrice: editQuotation.unitPrice,
          quantity: editQuotation.quantity,
          margem: (editQuotation as any).margem || "",
          paymentTerms: editQuotation.paymentTerms || "",
          validityDate: editQuotation.validityDate || "",
          notes: editQuotation.notes || "",
          status: editQuotation.status,
        }
      : {
          clientId: 0, productId: 0, supplierId: undefined,
          unitPrice: "", quantity: 0, margem: "", paymentTerms: "",
          validityDate: "", notes: "", status: "rascunho",
        },
  });

  const watchedQuantity = form.watch("quantity");
  const watchedProductId = form.watch("productId");
  const selectedProduct = productsList?.find((p) => p.id === watchedProductId);
  const unit = selectedProduct?.unidade || "un";

  const prevProductIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (!editQuotation && selectedProduct && selectedProduct.id !== prevProductIdRef.current) {
      prevProductIdRef.current = selectedProduct.id;
      const next: CalcFields = {
        ...calc,
        custoUnitario: selectedProduct.standardPrice ?? "",
        pesoUnitario: (selectedProduct as any).pesoUnitario ?? "",
      };
      setCalc(next);
      const qty = Number(form.getValues("quantity")) || 0;
      const res = calcExportPrice(next, qty);
      if (res) {
        form.setValue("unitPrice", res.unitPrice.toFixed(2));
        form.setValue("margem" as any, res.margemPct.toFixed(2));
      }
    }
  }, [watchedProductId]);

  function setC(field: keyof CalcFields, value: string) {
    const next = { ...calc, [field]: value };
    setCalc(next);
    const qty = Number(watchedQuantity) || 0;
    const res = calcExportPrice(next, qty);
    if (res) {
      form.setValue("unitPrice", res.unitPrice.toFixed(2));
      form.setValue("margem" as any, res.margemPct.toFixed(2));
    }
  }

  function getStandardPrice(): number | null {
    const product = productsList?.find((p) => p.id === watchedProductId);
    if (!product) return null;
    const sp = parseFloat(product.standardPrice);
    return isNaN(sp) ? null : sp;
  }

  function onManualMargemChange(margemStr: string) {
    form.setValue("margem" as any, margemStr);
    const margemNum = parseFloat(margemStr);
    const sp = getStandardPrice();
    if (!isNaN(margemNum) && margemNum > 0 && margemNum < 100 && sp !== null && sp > 0) {
      const calculatedPrice = sp / (1 - margemNum / 100);
      form.setValue("unitPrice", calculatedPrice.toFixed(2));
    }
  }

  function onUnitPriceChange(priceStr: string) {
    form.setValue("unitPrice", priceStr);
    const priceNum = parseFloat(priceStr);
    const sp = getStandardPrice();
    if (!isNaN(priceNum) && priceNum > 0 && sp !== null && sp > 0 && sp < priceNum) {
      const derivedMargem = ((priceNum - sp) / priceNum) * 100;
      form.setValue("margem" as any, derivedMargem.toFixed(2));
    }
  }

  const calcResult = calcExportPrice(calc, Number(watchedQuantity) || 0);

  const mutation = useMutation({
    mutationFn: (data: InsertQuotation) =>
      editQuotation
        ? apiRequest("PATCH", `/api/quotations/${editQuotation.id}`, data)
        : apiRequest("POST", "/api/quotations", { ...data, criadoPor: currentUser?.name ?? null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotations"] });
      toast({ title: editQuotation ? "Cotacao atualizada" : "Cotacao criada" });
      onSuccess();
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const fmtU = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD" }).format(v);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">

        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="clientId" render={({ field }) => (
            <FormItem>
              <FormLabel>Cliente</FormLabel>
              <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value ? String(field.value) : ""}>
                <FormControl>
                  <SelectTrigger data-testid="select-quotation-client">
                    <SelectValue placeholder="Selecione um cliente" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {clientsList?.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name} ({c.country})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="productId" render={({ field }) => (
            <FormItem>
              <FormLabel>Produto</FormLabel>
              <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value ? String(field.value) : ""}>
                <FormControl>
                  <SelectTrigger data-testid="select-quotation-product">
                    <SelectValue placeholder="Selecione um produto" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {productsList?.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.type} - {p.grammage}g/m2</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="supplierId" render={({ field }) => (
            <FormItem>
              <FormLabel>Fornecedor (opcional)</FormLabel>
              <Select onValueChange={(v) => field.onChange(v === "none" ? null : Number(v))} value={field.value ? String(field.value) : "none"}>
                <FormControl>
                  <SelectTrigger data-testid="select-quotation-supplier">
                    <SelectValue placeholder="Selecione um fornecedor" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {suppliersList?.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="quantity" render={({ field }) => (
            <FormItem>
              <FormLabel>Quantidade ({unit})</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  {...field}
                  onChange={(e) => {
                    field.onChange(Number(e.target.value));
                    const qty = Number(e.target.value) || 0;
                    const res = calcExportPrice(calc, qty);
                    if (res) {
                      form.setValue("unitPrice", res.unitPrice.toFixed(2));
                      form.setValue("margem" as any, res.margemPct.toFixed(2));
                    }
                  }}
                  data-testid="input-quotation-quantity"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 overflow-hidden">
          <button
            type="button"
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100/50 dark:hover:bg-blue-900/30 transition-colors"
            onClick={() => setShowCalc(!showCalc)}
            data-testid="button-toggle-calculator"
          >
            <div className="flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Calculadora de Preço de Exportação
            </div>
            {showCalc ? <ChevronUp className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>

          {showCalc && (
            <div className="px-4 pb-4 pt-1 space-y-3 border-t border-blue-200 dark:border-blue-800">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground font-medium">Moeda local</label>
                  <Select value={calc.moedaLocal} onValueChange={(v) => setC("moedaLocal", v)}>
                    <SelectTrigger className="h-8 text-xs" data-testid="calc-select-moeda-form">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BRL">BRL (Real)</SelectItem>
                      <SelectItem value="ARS">ARS (Peso AR)</SelectItem>
                      <SelectItem value="CLP">CLP (Peso CL)</SelectItem>
                      <SelectItem value="EUR">EUR (Euro)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium">
                    Câmbio ({calc.moedaLocal}/USD)
                  </label>
                  <div className="relative">
                    <Input className="h-8 text-xs pr-14" type="text" inputMode="decimal" placeholder="5,80" value={calc.taxaCambio} onChange={(e) => setC("taxaCambio", e.target.value)} data-testid="calc-input-cambio-form" />
                    {ptaxLoading && (
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground animate-pulse">PTAX…</span>
                    )}
                    {!ptaxLoading && ptaxDate && (
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">PTAX {ptaxDate}</span>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium">Incoterm</label>
                  <div className="flex gap-1 mt-1">
                    {(["FOB", "CIF"] as const).map((t) => (
                      <button key={t} type="button" onClick={() => setC("incoterm", t)}
                        className={`flex-1 py-1 rounded text-xs font-semibold border transition-all ${calc.incoterm === t ? (t === "FOB" ? "bg-blue-600 text-white border-blue-600" : "bg-emerald-600 text-white border-emerald-600") : "border-border text-muted-foreground hover:border-blue-400"}`}
                        data-testid={`calc-button-incoterm-${t.toLowerCase()}-form`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground font-medium">Custo por {unit} ({calc.moedaLocal})</label>
                  <Input className="h-8 text-xs" type="text" inputMode="decimal" placeholder="0,00" value={calc.custoUnitario} onChange={(e) => setC("custoUnitario", e.target.value)} data-testid="calc-input-custo-form" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium">Peso por {unit} (kg)</label>
                  <Input className="h-8 text-xs" type="text" inputMode="decimal" placeholder="ex: 25" value={calc.pesoUnitario} onChange={(e) => setC("pesoUnitario", e.target.value)} data-testid="calc-input-peso-form" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground font-medium">Frete interno ({calc.moedaLocal})</label>
                  <Input className="h-8 text-xs" type="text" inputMode="decimal" placeholder="0,00" value={calc.freteInterno} onChange={(e) => setC("freteInterno", e.target.value)} data-testid="calc-input-fi-form" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium">Frete internacional (USD)</label>
                  <Input className="h-8 text-xs" type="text" inputMode="decimal" placeholder="0,00" value={calc.freteInternacional} onChange={(e) => setC("freteInternacional", e.target.value)} data-testid="calc-input-fintl-form" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground font-medium">Desp. aduaneiras (%)</label>
                  <Input className="h-8 text-xs" type="text" inputMode="decimal" placeholder="2" value={calc.despesasAduaneiras} onChange={(e) => setC("despesasAduaneiras", e.target.value)} data-testid="calc-input-desp-form" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Margem de Lucro (%)</label>
                  <Input className="h-8 text-xs border-emerald-300 dark:border-emerald-700 focus:ring-emerald-400" type="text" inputMode="decimal" placeholder="20" value={calc.margemLucro} onChange={(e) => setC("margemLucro", e.target.value)} data-testid="calc-input-margem-form" />
                </div>
              </div>

              {calcResult && (
                <div className="rounded-lg bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-700 p-3 mt-2">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-semibold mb-2">Resultado do Cálculo</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className={`rounded-lg p-2 text-center ${calc.incoterm === "FOB" ? "bg-blue-100 dark:bg-blue-900/40 ring-1 ring-blue-400" : "bg-slate-50 dark:bg-slate-700"}`}>
                      <p className="text-[10px] text-muted-foreground">Preço FOB/{unit}</p>
                      <p className="font-bold text-sm text-blue-700 dark:text-blue-300">{fmtU(calcResult.precoFOB)}</p>
                    </div>
                    <div className={`rounded-lg p-2 text-center ${calc.incoterm === "CIF" ? "bg-emerald-100 dark:bg-emerald-900/40 ring-1 ring-emerald-400" : "bg-slate-50 dark:bg-slate-700"}`}>
                      <p className="text-[10px] text-muted-foreground">Preço CIF/{unit}</p>
                      <p className="font-bold text-sm text-emerald-700 dark:text-emerald-300">{fmtU(calcResult.precoCIF)}</p>
                    </div>
                    <div className="rounded-lg p-2 text-center bg-slate-50 dark:bg-slate-700">
                      <p className="text-[10px] text-muted-foreground">Container</p>
                      <p className="font-bold text-xs">{calcResult.container}</p>
                    </div>
                  </div>
                  <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-2 text-center font-medium">
                    ↳ Preço {calc.incoterm} aplicado automaticamente: {fmtU(calcResult.unitPrice)}/{unit} · Margem: {calcResult.margemPct.toFixed(1)}%
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="unitPrice" render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-1.5">
                Preço de Venda (USD/{unit})
                {showCalc && calcResult && (
                  <span className="text-[10px] font-normal text-blue-500 bg-blue-50 dark:bg-blue-950 px-1.5 py-0.5 rounded">calculado</span>
                )}
              </FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  value={field.value}
                  onChange={(e) => onUnitPriceChange(e.target.value)}
                  readOnly={showCalc && !!calcResult}
                  className={showCalc && calcResult ? "bg-muted cursor-default" : ""}
                  data-testid="input-quotation-price"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name={"margem" as any} render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                Margem sobre Venda (%)
              </FormLabel>
              <FormControl>
                <div className="relative">
                  <Input type="number" step="0.1" min="0" max="99" placeholder="Ex: 15.0"
                    value={field.value || ""} onChange={(e) => onManualMargemChange(e.target.value)}
                    data-testid="input-quotation-margem" className="pr-8" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">%</span>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <CostRevenuePanel
          clientId={form.watch("clientId")}
          productId={form.watch("productId")}
          unitPrice={form.watch("unitPrice")}
          quantity={form.watch("quantity")}
          margem={form.watch("margem" as any)}
          clientsList={clientsList}
          productsList={productsList}
          calcBreakdown={calcResult}
          unit={unit}
        />

        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="paymentTerms" render={({ field }) => (
            <FormItem>
              <FormLabel>Condicoes de Pagamento</FormLabel>
              <FormControl><Input {...field} value={field.value || ""} placeholder="Ex: 30/60/90 dias" data-testid="input-quotation-terms" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="validityDate" render={({ field }) => (
            <FormItem>
              <FormLabel>Validade</FormLabel>
              <FormControl><Input type="date" {...field} value={field.value || ""} data-testid="input-quotation-validity" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <FormField control={form.control} name="notes" render={({ field }) => (
          <FormItem>
            <FormLabel>Observacoes</FormLabel>
            <FormControl><Textarea {...field} value={field.value || ""} rows={2} data-testid="input-quotation-notes" /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        {editQuotation && (
          <FormField control={form.control} name="status" render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || "rascunho"}>
                <FormControl>
                  <SelectTrigger data-testid="select-quotation-status"><SelectValue /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="rascunho">Rascunho</SelectItem>
                  <SelectItem value="enviada">Enviada</SelectItem>
                  <SelectItem value="aceita">Aceita</SelectItem>
                  <SelectItem value="recusada">Recusada</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
        )}

        <Button type="submit" className="w-full" disabled={mutation.isPending} data-testid="button-submit-quotation">
          {mutation.isPending ? "Salvando..." : editQuotation ? "Atualizar" : "Criar Cotacao"}
        </Button>
      </form>
    </Form>
  );
}

function SendDialog({ quotation, onSent }: { quotation: QuotationWithDetails; onSent: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [userName, setUserName] = useState("Sistema");

  const sendMutation = useMutation({
    mutationFn: (method: "email" | "whatsapp") =>
      apiRequest("POST", `/api/quotations/${quotation.id}/send-log`, {
        method,
        userName,
        recipientInfo: quotation.client.name,
        updateStatus: quotation.status === "rascunho",
      }),
    onSuccess: (_data, method) => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotations", quotation.id, "send-log"] });

      const clientEmail = quotation.client.name;
      const message = buildMessage(quotation);

      if (method === "email") {
        const subject = encodeURIComponent(`Cotacao - ${quotation.product.type} ${quotation.product.grammage}g/m2`);
        const body = encodeURIComponent(message);
        window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
      } else {
        const text = encodeURIComponent(message);
        window.open(`https://wa.me/?text=${text}`, "_blank");
      }

      toast({ title: `Enviado via ${method === "email" ? "Email" : "WhatsApp"}` });
      setOpen(false);
      onSent();
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" title="Enviar cotacao" data-testid={`button-send-quotation-${quotation.id}`}>
          <Send className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Enviar Cotacao</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md border p-3 space-y-1 text-sm">
            <p><strong>Cliente:</strong> {quotation.client.name} ({quotation.client.country})</p>
            <p><strong>Produto:</strong> {quotation.product.type} - {quotation.product.grammage}g/m2</p>
            <p><strong>Preco:</strong> {formatCurrency(quotation.unitPrice)} x {quotation.quantity} ton</p>
            <p><strong>Total:</strong> {formatCurrency(quotation.total)}</p>
            {quotation.paymentTerms && <p><strong>Pagamento:</strong> {quotation.paymentTerms}</p>}
            {quotation.validityDate && <p><strong>Validade:</strong> {formatDate(quotation.validityDate)}</p>}
          </div>

          <div>
            <label className="text-sm font-medium">Enviado por</label>
            <Input
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Nome do usuario"
              data-testid="input-send-username"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={() => sendMutation.mutate("email")}
              disabled={sendMutation.isPending}
              variant="outline"
              className="flex items-center gap-2"
              data-testid="button-send-email"
            >
              <Mail className="h-4 w-4" />
              Enviar por Email
            </Button>
            <Button
              onClick={() => sendMutation.mutate("whatsapp")}
              disabled={sendMutation.isPending}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
              data-testid="button-send-whatsapp"
            >
              <MessageCircle className="h-4 w-4" />
              Enviar por WhatsApp
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

async function loadImageAsDataUrl(src: string): Promise<string> {
  const res = await fetch(src);
  const blob = await res.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

async function downloadQuotationPDF(q: QuotationWithDetails) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const logoDataUrl = await loadImageAsDataUrl(logoPath);

  const now = new Date();
  const dateStr = now.toLocaleDateString("pt-BR");
  const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const totalNum = parseFloat(q.total);
  const unitNum = parseFloat(q.unitPrice);
  const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD" }).format(v);
  const statusMap: Record<string, string> = {
    rascunho: "Rascunho", enviada: "Enviada", aceita: "Aceita",
    recusada: "Recusada", convertida: "Convertida",
  };

  const W = 210;
  const BLUE_DARK  = [8,  63,  98]  as [number,number,number];
  const BLUE_MID   = [10, 90, 140]  as [number,number,number];
  const BLUE_LIGHT = [34,118,187]   as [number,number,number];
  const GOLD       = [250,189,  0]  as [number,number,number];
  const WHITE      = [255,255,255]  as [number,number,number];
  const GRAY_BG    = [248,250,252]  as [number,number,number];
  const GRAY_BORDER= [221,229,238]  as [number,number,number];
  const TEXT_DARK  = [26, 26, 46]   as [number,number,number];
  const TEXT_MID   = [107,122,141]  as [number,number,number];
  const BLUE_TINT  = [235,244,255]  as [number,number,number];

  // ── HEADER ──────────────────────────────────────────────
  doc.setFillColor(...BLUE_DARK);
  doc.rect(0, 0, W, 38, "F");
  doc.setFillColor(...BLUE_MID);
  doc.rect(80, 0, 130, 38, "F");

  // Logo image
  doc.addImage(logoDataUrl, "PNG", 10, 5, 24, 24);

  // Brand name
  doc.setTextColor(...WHITE);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("HYPERTRADE", 38, 16);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(200, 220, 240);
  doc.text("ERP Logistico de Exportacao  |  Papel Kraft", 38, 22);

  // Doc title (right side)
  doc.setTextColor(...GOLD);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("COTACAO COMERCIAL", W - 12, 14, { align: "right" });
  doc.setTextColor(...WHITE);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`No. ${String(q.id).padStart(5, "0")}`, W - 12, 21, { align: "right" });
  doc.setTextColor(200, 220, 240);
  doc.setFontSize(7);
  doc.text(`Emitido em ${dateStr} as ${timeStr}`, W - 12, 27, { align: "right" });

  // ── STATUS BANNER ────────────────────────────────────────
  doc.setFillColor(...BLUE_TINT);
  doc.rect(0, 38, W, 12, "F");
  doc.setFillColor(...BLUE_LIGHT);
  doc.rect(0, 38, 2, 12, "F");

  doc.setFillColor(...BLUE_DARK);
  doc.roundedRect(8, 40.5, 28, 7, 2, 2, "F");
  doc.setTextColor(...GOLD);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text((statusMap[q.status] || q.status).toUpperCase(), 22, 45.2, { align: "center" });

  doc.setTextColor(60, 80, 110);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  const validityText = q.validityDate
    ? `Valido ate: ${new Date(q.validityDate + "T00:00:00").toLocaleDateString("pt-BR")}`
    : "Sem data de validade definida";
  doc.text(validityText, 42, 45.2);

  // ── BODY ─────────────────────────────────────────────────
  let y = 58;

  const sectionTitle = (title: string) => {
    doc.setTextColor(...BLUE_DARK);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(title.toUpperCase(), 12, y);
    doc.setDrawColor(...BLUE_DARK);
    doc.setLineWidth(0.5);
    doc.line(12, y + 1.5, W - 12, y + 1.5);
    y += 7;
  };

  const infoCard = (x: number, w: number, label: string, value: string, highlight = false) => {
    doc.setFillColor(...(highlight ? BLUE_TINT : GRAY_BG));
    doc.setDrawColor(...(highlight ? BLUE_LIGHT : GRAY_BORDER));
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, w, 16, 2, 2, "FD");
    doc.setTextColor(...TEXT_MID);
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    doc.text(label.toUpperCase(), x + 4, y + 6);
    doc.setTextColor(...(highlight ? BLUE_DARK : TEXT_DARK));
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(value, x + 4, y + 13);
  };

  // Client section
  sectionTitle("Dados do Cliente");
  const halfW = (W - 28) / 2;
  infoCard(12, halfW, "Cliente", q.client.name, true);
  infoCard(14 + halfW, halfW, "Pais / Destino", q.client.country);
  y += 22;

  // Product section
  sectionTitle("Produto e Fornecimento");
  if (q.supplier) {
    const thirdW = (W - 30) / 3;
    infoCard(12, thirdW, "Produto", q.product.type, true);
    infoCard(14 + thirdW, thirdW, "Gramatura", `${q.product.grammage} g/m2`);
    infoCard(16 + 2 * thirdW, thirdW, "Fornecedor", q.supplier.name);
  } else {
    infoCard(12, halfW, "Produto", q.product.type, true);
    infoCard(14 + halfW, halfW, "Gramatura", `${q.product.grammage} g/m2`);
  }
  y += 22;

  // Pricing section
  sectionTitle("Valores e Condicoes");
  const thirdW = (W - 30) / 3;
  infoCard(12, thirdW, "Preco Unitario", `${fmt(unitNum)}/${q.product.unidade || "un"}`);
  infoCard(14 + thirdW, thirdW, "Quantidade", `${q.quantity} ${q.product.unidade || "un"}`);
  infoCard(16 + 2 * thirdW, thirdW, "Cond. Pagamento", q.paymentTerms || "—");
  y += 22;

  // Total box
  doc.setFillColor(...BLUE_DARK);
  doc.roundedRect(12, y, W - 24, 22, 3, 3, "F");
  doc.setFillColor(...BLUE_MID);
  doc.roundedRect(90, y, W - 24 - 78, 22, 3, 3, "F");
  doc.setTextColor(200, 220, 240);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("VALOR TOTAL DA COTACAO", 20, y + 8);
  doc.setTextColor(180, 205, 230);
  doc.setFontSize(6.5);
  doc.text(`${q.quantity} ${q.product.unidade || "un"} x ${fmt(unitNum)}`, 20, y + 14);
  doc.setTextColor(...GOLD);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(fmt(totalNum), W - 16, y + 14, { align: "right" });
  y += 28;

  // Notes
  if (q.notes) {
    doc.setFillColor(255, 251, 234);
    doc.setDrawColor(240, 208, 96);
    doc.setLineWidth(0.3);
    doc.roundedRect(12, y, W - 24, 20, 2, 2, "FD");
    doc.setTextColor(133, 106, 0);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text("OBSERVACOES", 16, y + 6);
    doc.setTextColor(90, 69, 0);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const lines = doc.splitTextToSize(q.notes, W - 32);
    doc.text(lines.slice(0, 2), 16, y + 13);
    y += 26;
  }

  // ── FOOTER ───────────────────────────────────────────────
  const footerY = 272;
  doc.setFillColor(...BLUE_DARK);
  doc.rect(0, footerY, W, 25, "F");
  doc.setFillColor(...BLUE_MID);
  doc.rect(70, footerY, 70, 25, "F");

  // Left
  doc.setTextColor(...WHITE);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.text("Hypertrade Exportacao", 12, footerY + 8);
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(200, 220, 240);
  doc.text("ERP Logistico  |  Gestao de Papel Kraft", 12, footerY + 14);
  doc.text("Documento gerado automaticamente pelo sistema", 12, footerY + 19);

  // Center logo
  doc.setTextColor(...GOLD);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("HYPERTRADE", W / 2, footerY + 10, { align: "center" });
  doc.setTextColor(200, 220, 240);
  doc.setFontSize(5.5);
  doc.setFont("helvetica", "normal");
  doc.text("ERP LOGISTICO DE EXPORTACAO", W / 2, footerY + 16, { align: "center" });

  // Right
  doc.setTextColor(200, 220, 240);
  doc.setFontSize(7);
  doc.text(`Cotacao No. ${String(q.id).padStart(5, "0")}`, W - 12, footerY + 10, { align: "right" });
  doc.setTextColor(...GOLD);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(dateStr, W - 12, footerY + 17, { align: "right" });

  doc.save(`cotacao-${String(q.id).padStart(5, "0")}-hypertrade.pdf`);
}

function buildMessage(q: QuotationWithDetails): string {
  const lines = [
    `COTACAO COMERCIAL - Hypertrade`,
    ``,
    `Cliente: ${q.client.name}`,
    `Produto: ${q.product.type} - ${q.product.grammage}g/m2`,
    `Preco Unitario: ${formatCurrency(q.unitPrice)}`,
    `Quantidade: ${q.quantity} ${q.product.unidade || "un"}`,
    `Total: ${formatCurrency(q.total)}`,
  ];
  if (q.paymentTerms) lines.push(`Condicoes de Pagamento: ${q.paymentTerms}`);
  if (q.validityDate) lines.push(`Validade: ${formatDate(q.validityDate)}`);
  if (q.supplier) lines.push(`Fornecedor: ${q.supplier.name}`);
  if (q.notes) lines.push(``, `Obs: ${q.notes}`);
  return lines.join("\n");
}

function SendLogPanel({ quotationId }: { quotationId: number }) {
  const { data: sendLog, isLoading } = useQuery<QuotationSendLogEntry[]>({
    queryKey: ["/api/quotations", quotationId, "send-log"],
  });

  if (isLoading) return <Skeleton className="h-16 w-full" />;
  if (!sendLog || sendLog.length === 0) {
    return <p className="text-sm text-muted-foreground italic">Nenhum envio registrado</p>;
  }

  return (
    <div className="space-y-2">
      {sendLog.map((entry) => (
        <div key={entry.id} className="flex items-center gap-3 text-sm border rounded-md p-2">
          {entry.method === "email" ? (
            <Mail className="h-4 w-4 text-blue-500 flex-shrink-0" />
          ) : (
            <MessageCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <span className="font-medium">{entry.method === "email" ? "Email" : "WhatsApp"}</span>
            {entry.recipientInfo && <span className="text-muted-foreground"> - {entry.recipientInfo}</span>}
          </div>
          <div className="text-muted-foreground text-xs flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {entry.sentAt ? new Date(entry.sentAt).toLocaleString("pt-BR") : "-"}
          </div>
          <span className="text-xs text-muted-foreground">{entry.userName}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Quotation temperature ─────────────────────────────────────────────────────

function getQuotationTemperature(validityDate: string | null | undefined, createdAt: string | null | undefined) {
  if (!validityDate) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(validityDate);
  expiry.setHours(0, 0, 0, 0);

  const daysRemaining = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  const origin = createdAt ? new Date(createdAt) : null;
  if (origin) origin.setHours(0, 0, 0, 0);

  const totalDays = origin ? Math.ceil((expiry.getTime() - origin.getTime()) / (1000 * 60 * 60 * 24)) : 30;
  const consumed = origin ? Math.ceil((today.getTime() - origin.getTime()) / (1000 * 60 * 60 * 24)) : Math.max(0, totalDays - daysRemaining);
  const pct = Math.min(100, Math.max(0, totalDays > 0 ? (consumed / totalDays) * 100 : 100));

  const isExpired = daysRemaining < 0;

  let label: string;
  let barColor: string;
  let textColor: string;

  if (isExpired) {
    label = "Expirada";
    barColor = "bg-red-500";
    textColor = "text-red-500";
  } else if (pct >= 80) {
    label = "Crítico";
    barColor = "bg-red-500";
    textColor = "text-red-500";
  } else if (pct >= 60) {
    label = "Urgente";
    barColor = "bg-orange-500";
    textColor = "text-orange-500";
  } else if (pct >= 30) {
    label = "Atenção";
    barColor = "bg-yellow-500";
    textColor = "text-yellow-500";
  } else {
    label = "Em aberto";
    barColor = "bg-green-500";
    textColor = "text-green-500";
  }

  return { pct, label, barColor, textColor, daysRemaining, showFlame: pct >= 80 && !isExpired, isExpired };
}

// ─── Kanban: card detail sheet ────────────────────────────────────────────────

function KanbanCardDetail({
  quotation,
  open,
  onClose,
  onEdit,
  onSell,
  onDelete,
}: {
  quotation: QuotationWithDetails | null;
  open: boolean;
  onClose: () => void;
  onEdit: (q: QuotationWithDetails) => void;
  onSell: (q: QuotationWithDetails) => void;
  onDelete: (id: number) => void;
}) {
  const { toast } = useToast();
  const [noteText, setNoteText] = useState("");
  const [showClient, setShowClient] = useState(false);

  const { data: notes, isLoading: notesLoading } = useQuery<QuotationNote[]>({
    queryKey: ["/api/quotations", quotation?.id, "notes"],
    enabled: !!quotation?.id,
  });

  const addNoteMut = useMutation({
    mutationFn: () => apiRequest("POST", `/api/quotations/${quotation!.id}/notes`, { content: noteText, author: "Valdinei" }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotations", quotation!.id, "notes"] });
      setNoteText("");
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteNoteMut = useMutation({
    mutationFn: (noteId: number) => apiRequest("DELETE", `/api/quotation-notes/${noteId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/quotations", quotation?.id, "notes"] }),
  });

  const toggleHotMut = useMutation({
    mutationFn: (isHot: boolean) =>
      apiRequest("PATCH", `/api/quotations/${quotation!.id}`, { isHot }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotations"] });
      toast({
        title: quotation?.isHot ? "Flag removida" : "Cotação marcada como quente!",
        description: quotation?.isHot
          ? "Sinalização de fechamento iminente removida."
          : "Chama de fechamento iminente ativada no card.",
      });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  if (!quotation) return null;
  const c = quotation.client;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto" data-testid="sheet-kanban-detail">
        <SheetHeader className="pb-3">
          <SheetTitle className="flex items-center justify-between gap-2 text-base">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className={statusColors[quotation.status]}>{statusLabels[quotation.status]}</Badge>
              <span className="text-muted-foreground font-normal text-sm">Cotação #{quotation.id}</span>
            </div>
            <button
              onClick={() => toggleHotMut.mutate(!quotation.isHot)}
              disabled={toggleHotMut.isPending}
              title={quotation.isHot ? "Remover flag de fechamento iminente" : "Marcar como prestes a fechar"}
              data-testid="button-toggle-hot"
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all border ${
                quotation.isHot
                  ? "bg-orange-100 dark:bg-orange-950/40 border-orange-300 dark:border-orange-700 text-orange-600 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-900/60"
                  : "bg-muted border-border text-muted-foreground hover:bg-orange-50 dark:hover:bg-orange-950/20 hover:border-orange-300 hover:text-orange-500"
              }`}
            >
              <Flame className={`h-3.5 w-3.5 ${quotation.isHot ? "fill-orange-500 text-orange-500" : ""}`} />
              {quotation.isHot ? "Quente" : "Marcar quente"}
            </button>
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4">
          {/* Product / Financeiro */}
          <div className="rounded-lg border p-3 space-y-1.5 text-sm">
            <p className="font-semibold text-base">{quotation.product.type} — {quotation.product.grammage}</p>
            <div className="grid grid-cols-2 gap-1 text-muted-foreground">
              <span>Preço unit.:</span><span className="text-foreground font-medium">{formatCurrency(quotation.unitPrice)}</span>
              <span>Quantidade:</span><span className="text-foreground font-medium">{quotation.quantity} {quotation.product.unidade || "un"}</span>
              <span>Total:</span><span className="text-foreground font-bold text-primary">{formatCurrency(quotation.total)}</span>
              {quotation.paymentTerms && <><span>Pagamento:</span><span className="text-foreground">{quotation.paymentTerms}</span></>}
              {quotation.validityDate && <><span>Validade:</span><span className="text-foreground">{formatDate(quotation.validityDate)}</span></>}
              {quotation.supplier && <><span>Fornecedor:</span><span className="text-foreground">{quotation.supplier.name}</span></>}
            </div>
            {quotation.notes && (
              <p className="text-muted-foreground italic text-xs border-t pt-1.5 mt-1.5">{quotation.notes}</p>
            )}
          </div>

          {/* Cliente */}
          <div className="rounded-lg border overflow-hidden">
            <button
              className="w-full flex items-center justify-between p-3 text-sm font-medium hover:bg-muted/40 transition-colors"
              onClick={() => setShowClient(!showClient)}
              data-testid="button-toggle-client-info"
            >
              <span className="flex items-center gap-2">
                <User className="h-4 w-4 text-blue-500" />
                {c.name}
                <span className="text-muted-foreground font-normal">({c.country})</span>
              </span>
              {showClient ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
            {showClient && (
              <div className="border-t p-3 bg-muted/20 grid grid-cols-2 gap-1 text-sm">
                {c.email && <><span className="text-muted-foreground">Email:</span><span>{c.email}</span></>}
                {c.phone && <><span className="text-muted-foreground">Telefone:</span><span>{c.phone}</span></>}
                {c.responsavel && <><span className="text-muted-foreground">Responsável:</span><span>{c.responsavel}</span></>}
                {c.registroNacional && <><span className="text-muted-foreground">Registro:</span><span>{c.registroNacional}</span></>}
                {c.creditLimit && <><span className="text-muted-foreground">Limite crédito:</span><span>{formatCurrency(c.creditLimit)}</span></>}
                {c.paymentTerms && <><span className="text-muted-foreground">Cond. pagamento:</span><span>{c.paymentTerms}</span></>}
                {c.address && <><span className="text-muted-foreground">Endereço:</span><span>{c.address}{c.city ? `, ${c.city}` : ""}</span></>}
              </div>
            )}
          </div>

          {/* Ações */}
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => { onEdit(quotation); onClose(); }} data-testid="button-kanban-edit" disabled={quotation.status === "convertida"}>
              <Pencil className="h-3.5 w-3.5 mr-1" />Editar
            </Button>
            {(quotation.status === "rascunho" || quotation.status === "enviada" || quotation.status === "aceita") && (
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => { if (confirm("Confirma a realização da venda?")) { onSell(quotation); onClose(); } }} data-testid="button-kanban-sell">
                <ArrowRight className="h-3.5 w-3.5 mr-1" />Realizar Venda
              </Button>
            )}
            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => { if (confirm("Excluir esta cotação?")) { onDelete(quotation.id); onClose(); } }} disabled={quotation.status === "convertida"} data-testid="button-kanban-delete">
              <Trash2 className="h-3.5 w-3.5 mr-1" />Excluir
            </Button>
          </div>

          {/* Anotações */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <StickyNote className="h-4 w-4 text-amber-500" />
              Anotações ({notes?.length ?? 0})
            </h3>

            <div className="flex gap-2">
              <Textarea
                placeholder="Adicionar anotação..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                rows={2}
                className="text-sm resize-none"
                data-testid="input-kanban-note"
              />
              <Button
                size="sm"
                onClick={() => noteText.trim() && addNoteMut.mutate()}
                disabled={addNoteMut.isPending || !noteText.trim()}
                className="shrink-0"
                data-testid="button-kanban-add-note"
              >
                {addNoteMut.isPending ? <Clock className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
            </div>

            {notesLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : notes && notes.length > 0 ? (
              <div className="space-y-2">
                {notes.map((note) => (
                  <div key={note.id} className="rounded-md border bg-amber-50 dark:bg-amber-950/20 p-3 text-sm relative group" data-testid={`note-item-${note.id}`}>
                    <p className="pr-6 leading-relaxed">{note.content}</p>
                    <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
                      <User className="h-3 w-3" />
                      <span>{note.author}</span>
                      <span>·</span>
                      <span>{note.createdAt ? new Date(note.createdAt).toLocaleString("pt-BR") : "-"}</span>
                    </div>
                    <button
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                      onClick={() => deleteNoteMut.mutate(note.id)}
                      data-testid={`button-delete-note-${note.id}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">Nenhuma anotação ainda.</p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Kanban: board view ────────────────────────────────────────────────────────

const KANBAN_COLUMNS: { key: string; label: string; color: string; headerBg: string }[] = [
  { key: "rascunho",   label: "Rascunho",   color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",     headerBg: "border-gray-300 dark:border-gray-600" },
  { key: "enviada",    label: "Enviada",    color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",     headerBg: "border-blue-400 dark:border-blue-600" },
  { key: "aceita",     label: "Aceita",     color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300", headerBg: "border-green-400 dark:border-green-600" },
  { key: "recusada",   label: "Recusada",   color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",         headerBg: "border-red-400 dark:border-red-600" },
  { key: "convertida", label: "Convertida", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300", headerBg: "border-purple-400 dark:border-purple-600" },
];

function KanbanView({
  quotations: list,
  onEdit,
  onSell,
  onDelete,
}: {
  quotations: QuotationWithDetails[];
  onEdit: (q: QuotationWithDetails) => void;
  onSell: (q: QuotationWithDetails) => void;
  onDelete: (id: number) => void;
}) {
  const [selected, setSelected] = useState<QuotationWithDetails | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const { toast } = useToast();

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest("PATCH", `/api/quotations/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotations"] });
    },
    onError: () => {
      toast({ title: "Erro ao mover cotação", variant: "destructive" });
    },
  });

  return (
    <>
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-3 min-w-max">
          {KANBAN_COLUMNS.map((col) => {
            const cards = list.filter((q) => q.status === col.key);
            const colTotal = cards.reduce((s, q) => s + parseFloat(q.total), 0);
            const isOver = dragOverCol === col.key;
            return (
              <div
                key={col.key}
                className="flex flex-col w-72 shrink-0"
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverCol(col.key); }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverCol(null); }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverCol(null);
                  if (draggingId !== null) {
                    const card = list.find((q) => q.id === draggingId);
                    if (card && card.status !== col.key) {
                      statusMutation.mutate({ id: draggingId, status: col.key });
                    }
                  }
                  setDraggingId(null);
                }}
              >
                {/* Column header */}
                <div className={`rounded-t-lg border-t-4 ${col.headerBg} p-3 flex items-center justify-between mb-2 transition-colors ${isOver ? "bg-muted/70 dark:bg-muted/40" : "bg-muted/40 dark:bg-muted/20"}`}>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${col.color}`}>{col.label}</span>
                    <span className="text-xs text-muted-foreground bg-background border rounded-full w-5 h-5 flex items-center justify-center font-medium">{cards.length}</span>
                  </div>
                  {cards.length > 0 && (
                    <span className="text-xs text-muted-foreground font-medium">{formatCurrency(colTotal)}</span>
                  )}
                </div>

                {/* Cards drop zone */}
                <div className={`space-y-2 flex-1 rounded-b-lg min-h-[80px] p-1 transition-colors ${isOver ? "bg-primary/5 ring-1 ring-inset ring-primary/20" : ""}`}>
                  {cards.length === 0 ? (
                    <div className={`rounded-lg border-2 border-dashed p-4 text-center text-xs transition-colors ${isOver ? "border-primary/50 text-primary bg-primary/5" : "border-muted text-muted-foreground"}`}>
                      {isOver ? "Soltar aqui" : "Sem cotações"}
                    </div>
                  ) : (
                    <>
                      {cards.map((q) => {
                        const temp = getQuotationTemperature(q.validityDate, q.createdAt ? String(q.createdAt) : null);
                        return (
                            <div
                              key={q.id}
                              draggable
                              onDragStart={(e) => {
                                setDraggingId(q.id);
                                e.dataTransfer.effectAllowed = "move";
                                e.dataTransfer.setData("text/plain", String(q.id));
                              }}
                              onDragEnd={() => { setDraggingId(null); setDragOverCol(null); }}
                              onClick={() => setSelected(q)}
                              className={`rounded-lg border bg-card hover:shadow-md transition-all select-none overflow-hidden ${draggingId === q.id ? "opacity-40 cursor-grabbing shadow-lg" : "cursor-grab"} ${q.isHot ? "border-orange-400 dark:border-orange-600 shadow-orange-100 dark:shadow-orange-950/30 shadow-sm" : "hover:border-primary/30"}`}
                              data-testid={`kanban-card-${q.id}`}
                            >
                              <div className="p-3 space-y-2">
                                {/* Client */}
                                <div className="flex items-center gap-1.5">
                                  <User className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                  <span className="font-semibold text-sm truncate">{q.client.name}</span>
                                  <span className="text-xs text-muted-foreground shrink-0">({q.client.country})</span>
                                </div>
                                {/* Product */}
                                <p className="text-xs text-muted-foreground truncate">{q.product.type} — {q.product.grammage}</p>
                                {/* Total */}
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-bold text-primary">{formatCurrency(q.total)}</span>
                                  <span className="text-xs text-muted-foreground">{q.quantity} {q.product.unidade || "un"}</span>
                                </div>
                                {/* Footer: validity + temperature label */}
                                {(q.validityDate || q.isHot) && (
                                  <div className="flex items-center justify-between border-t pt-1.5">
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                      {q.validityDate && <><Clock className="h-3 w-3 shrink-0" /><span>Val: {formatDate(q.validityDate)}</span></>}
                                    </div>
                                    <div className="flex items-center gap-1">
                                      {/* Manual hot flag */}
                                      {q.isHot && (
                                        <span className="flex items-center gap-0.5 text-xs font-semibold text-orange-500">
                                          <Flame className="h-3.5 w-3.5 fill-orange-500" />
                                          Quente
                                        </span>
                                      )}
                                      {/* Auto temperature */}
                                      {temp && !q.isHot && (
                                        <span className={`flex items-center gap-0.5 text-xs font-medium ${temp.textColor}`}>
                                          {temp.showFlame && <Flame className="h-3.5 w-3.5 fill-current" />}
                                          {temp.isExpired ? "Expirada" : temp.daysRemaining === 0 ? "Hoje" : `${temp.daysRemaining}d`}
                                        </span>
                                      )}
                                      {/* Both: show hot + days */}
                                      {temp && q.isHot && (
                                        <span className={`flex items-center gap-0.5 text-xs font-medium ${temp.textColor}`}>
                                          {temp.isExpired ? "Expirada" : temp.daysRemaining === 0 ? "Hoje" : `${temp.daysRemaining}d`}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                              {/* Temperature bar */}
                              {temp && (
                                <div className="h-1 w-full bg-muted">
                                  <div
                                    className={`h-full transition-all ${temp.barColor}`}
                                    style={{ width: `${temp.pct}%` }}
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      {isOver && (
                        <div className="rounded-lg border-2 border-dashed border-primary/50 bg-primary/5 p-3 text-center text-xs text-primary">
                          Soltar aqui
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <KanbanCardDetail
        quotation={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
        onEdit={onEdit}
        onSell={onSell}
        onDelete={onDelete}
      />
    </>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function Quotations() {
  const { toast } = useToast();
  const { currentUser } = useCurrentUser();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editQuotation, setEditQuotation] = useState<QuotationWithDetails | null>(null);
  const [sellConfirmQuotation, setSellConfirmQuotation] = useState<QuotationWithDetails | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "kanban" | "calculadora">("table");

  const { data: quotationsList, isLoading } = useQuery<QuotationWithDetails[]>({ queryKey: ["/api/quotations"] });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/quotations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotations"] });
      toast({ title: "Cotacao excluida" });
    },
  });

  const sellMutation = useMutation({
    mutationFn: async (q: QuotationWithDetails) => {
      const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;
      await apiRequest("POST", "/api/orders", {
        quotationId: q.id,
        clientId: q.clientId,
        productId: q.productId,
        supplierId: q.supplierId || null,
        invoice: invoiceNumber,
        factory: "-",
        modal: "maritimo",
        parametrizacao: "verde",
        unitPrice: q.unitPrice,
        quantity: q.quantity,
        paymentTerms: q.paymentTerms || null,
        statusPagamento: "pendente",
        criadoPor: currentUser?.name ?? null,
      });
      await apiRequest("PATCH", `/api/quotations/${q.id}`, { status: "convertida" });
      return q;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({ title: "Venda realizada com sucesso! Ordem de exportacao criada." });
    },
    onError: (e: Error) => toast({ title: "Erro ao realizar venda", description: e.message, variant: "destructive" }),
  });

  const filtered = quotationsList?.filter((q) => {
    if (statusFilter !== "all" && q.status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        q.client.name.toLowerCase().includes(s) ||
        q.product.type.toLowerCase().includes(s) ||
        (q.supplier?.name || "").toLowerCase().includes(s)
      );
    }
    return true;
  }) || [];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-quotations-title">Cotacoes</h1>
          <p className="text-muted-foreground text-sm">Gerenciar cotacoes comerciais de exportacao</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border overflow-hidden">
            <button
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors ${viewMode === "table" ? "bg-primary text-primary-foreground" : "hover:bg-muted/50"}`}
              onClick={() => setViewMode("table")}
              data-testid="button-view-table"
            >
              <List className="h-4 w-4" />
              Lista
            </button>
            <button
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors ${viewMode === "kanban" ? "bg-primary text-primary-foreground" : "hover:bg-muted/50"}`}
              onClick={() => setViewMode("kanban")}
              data-testid="button-view-kanban"
            >
              <LayoutGrid className="h-4 w-4" />
              Kanban
            </button>
            <button
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors border-l ${viewMode === "calculadora" ? "bg-primary text-primary-foreground" : "hover:bg-muted/50"}`}
              onClick={() => setViewMode("calculadora")}
              data-testid="button-view-calculadora"
            >
              <Calculator className="h-4 w-4" />
              Calculadora
            </button>
          </div>
          <Dialog open={formOpen} onOpenChange={(v) => { setFormOpen(v); if (!v) setEditQuotation(null); }}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-quotation" onClick={() => { setEditQuotation(null); setFormOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Cotacao
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editQuotation ? "Editar Cotacao" : "Nova Cotacao"}</DialogTitle></DialogHeader>
            <QuotationForm key={formOpen ? `open-${editQuotation?.id ?? "new"}` : "closed"} editQuotation={editQuotation} onSuccess={() => { setFormOpen(false); setEditQuotation(null); }} />
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {viewMode === "calculadora" && (
        <QuotationCalculator />
      )}

      {viewMode !== "calculadora" && (
      <>
      <div className="flex gap-3 flex-wrap">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente, produto ou fornecedor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-quotations"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-filter-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Status</SelectItem>
            <SelectItem value="rascunho">Rascunho</SelectItem>
            <SelectItem value="enviada">Enviada</SelectItem>
            <SelectItem value="aceita">Aceita</SelectItem>
            <SelectItem value="recusada">Recusada</SelectItem>
            <SelectItem value="convertida">Convertida</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : viewMode === "kanban" ? (
        <KanbanView
          quotations={filtered}
          onEdit={(q) => { setEditQuotation(q); setFormOpen(true); }}
          onSell={(q) => sellMutation.mutate(q)}
          onDelete={(id) => deleteMutation.mutate(id)}
        />
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileCheck className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1">Nenhuma cotacao encontrada</h3>
            <p className="text-sm text-muted-foreground">Crie sua primeira cotacao comercial para comecar.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead className="text-right">Preco Unit.</TableHead>
                <TableHead className="text-right">Qtd</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Validade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((q) => (
                <Fragment key={q.id}>
                  <TableRow data-testid={`row-quotation-${q.id}`} className="cursor-pointer" onClick={() => setExpandedId(expandedId === q.id ? null : q.id)}>
                    <TableCell>
                      {expandedId === q.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </TableCell>
                    <TableCell className="font-medium">
                      <div>{q.client.name}</div>
                      {q.criadoPor && <div className="text-[11px] text-muted-foreground font-normal">por {q.criadoPor}</div>}
                    </TableCell>
                    <TableCell>{q.product.type} - {q.product.grammage}g/m2</TableCell>
                    <TableCell>{q.supplier?.name || "-"}</TableCell>
                    <TableCell className="text-right">{formatCurrency(q.unitPrice)}</TableCell>
                    <TableCell className="text-right">{q.quantity}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(q.total)}</TableCell>
                    <TableCell>{formatDate(q.validityDate)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={statusColors[q.status]} data-testid={`badge-status-${q.id}`}>
                        {statusLabels[q.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Baixar PDF da cotação"
                          onClick={() => downloadQuotationPDF(q)}
                          data-testid={`button-pdf-quotation-${q.id}`}
                        >
                          <FileDown className="h-4 w-4 text-blue-600" />
                        </Button>
                        <SendDialog quotation={q} onSent={() => {}} />
                        {(q.status === "rascunho" || q.status === "enviada" || q.status === "aceita") && (
                          <Button
                            size="sm"
                            variant="default"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1"
                            onClick={() => setSellConfirmQuotation(q)}
                            disabled={sellMutation.isPending}
                            data-testid={`button-sell-quotation-${q.id}`}
                          >
                            <ArrowRight className="h-3 w-3" />
                            Realizar Venda
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => { setEditQuotation(q); setFormOpen(true); }}
                          data-testid={`button-edit-quotation-${q.id}`}
                          disabled={q.status === "convertida"}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            if (confirm("Tem certeza que deseja excluir esta cotacao?")) deleteMutation.mutate(q.id);
                          }}
                          data-testid={`button-delete-quotation-${q.id}`}
                          disabled={q.status === "convertida"}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {expandedId === q.id && (
                    <TableRow>
                      <TableCell colSpan={10} className="bg-muted/30 p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <h4 className="font-semibold text-sm flex items-center gap-2">
                              <Eye className="h-4 w-4" />
                              Detalhes
                            </h4>
                            <div className="text-sm space-y-1">
                              <p><strong>Cliente:</strong> {q.client.name} ({q.client.country})</p>
                              <p><strong>Produto:</strong> {q.product.type} - {q.product.grammage}g/m2</p>
                              {q.supplier && <p><strong>Fornecedor:</strong> {q.supplier.name}</p>}
                              <p><strong>Condicoes:</strong> {q.paymentTerms || "-"}</p>
                              <p><strong>Validade:</strong> {formatDate(q.validityDate)}</p>
                              {q.notes && <p><strong>Obs:</strong> {q.notes}</p>}
                              <p><strong>Criado em:</strong> {q.createdAt ? new Date(q.createdAt).toLocaleString("pt-BR") : "-"}</p>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <h4 className="font-semibold text-sm flex items-center gap-2">
                              <Send className="h-4 w-4" />
                              Historico de Envios
                            </h4>
                            <SendLogPanel quotationId={q.id} />
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      </>
      )}

      <Dialog open={!!sellConfirmQuotation} onOpenChange={(open) => { if (!open) setSellConfirmQuotation(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                <ArrowRight className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              Realizar Venda
            </DialogTitle>
            <DialogDescription className="pt-1">
              Uma ordem de exportação será criada automaticamente a partir desta cotação.
            </DialogDescription>
          </DialogHeader>

          {sellConfirmQuotation && (
            <div className="rounded-lg border bg-muted/40 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cliente</span>
                <span className="font-medium">{sellConfirmQuotation.client?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Produto</span>
                <span className="font-medium">{sellConfirmQuotation.product?.type} — {sellConfirmQuotation.product?.grammage}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Quantidade</span>
                <span className="font-medium">{sellConfirmQuotation.quantity} un.</span>
              </div>
              <div className="flex justify-between border-t pt-2 mt-1">
                <span className="text-muted-foreground font-medium">Total</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(sellConfirmQuotation.total))}
                </span>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setSellConfirmQuotation(null)}>
              Cancelar
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={sellMutation.isPending}
              onClick={() => {
                if (sellConfirmQuotation) {
                  sellMutation.mutate(sellConfirmQuotation);
                  setSellConfirmQuotation(null);
                }
              }}
            >
              {sellMutation.isPending ? "Processando..." : "Confirmar Venda"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
