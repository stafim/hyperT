import { useState, Fragment } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Plus, Search, Pencil, Trash2, FileCheck, Send, Mail, MessageCircle,
  ArrowRight, ChevronDown, ChevronRight, Clock, Eye, TrendingUp, DollarSign, FileDown,
} from "lucide-react";
import { insertQuotationSchema, type QuotationWithDetails, type InsertQuotation, type Client, type Product, type Supplier, type QuotationSendLogEntry } from "@shared/schema";
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

const countryToCurrency: Record<string, string> = {
  Brasil: "BRL",
  Argentina: "ARS",
  Chile: "CLP",
  Uruguai: "UYU",
  Paraguai: "PYG",
  "México": "MXN",
  Mexico: "MXN",
};

const currencySymbols: Record<string, string> = {
  BRL: "R$",
  ARS: "ARS$",
  CLP: "CLP$",
  UYU: "UYU$",
  PYG: "PYG",
  MXN: "MX$",
  USD: "US$",
};

type QuotesData = {
  base: string;
  date: string;
  currencies: Array<{
    code: string;
    name: string;
    country: string;
    rate: number;
  }>;
};

function formatLocalCurrency(value: number, currencyCode: string) {
  const symbol = currencySymbols[currencyCode] || currencyCode;
  if (currencyCode === "PYG") {
    return `${symbol} ${Math.round(value).toLocaleString("pt-BR")}`;
  }
  return `${symbol} ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function CostRevenuePanel({
  clientId,
  productId,
  unitPrice,
  quantity,
  margem,
  clientsList,
  productsList,
  quotesData,
}: {
  clientId: number;
  productId: number;
  unitPrice: string | number;
  quantity: number;
  margem?: string | null;
  clientsList?: Client[];
  productsList?: Product[];
  quotesData?: QuotesData;
}) {
  const price = typeof unitPrice === "string" ? parseFloat(unitPrice) : unitPrice;
  if (!clientId || !productId || !price || !quantity || isNaN(price) || price <= 0 || quantity <= 0) return null;

  const client = clientsList?.find((c) => c.id === clientId);
  const product = productsList?.find((p) => p.id === productId);
  if (!client || !product) return null;

  const totalUsd = price * quantity;
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

  const currencyCode = countryToCurrency[client.country] || null;
  const currencyData = currencyCode ? quotesData?.currencies?.find((c) => c.code === currencyCode) : null;
  const exchangeRate = currencyData ? currencyData.rate : null;
  const clientCostLocal = exchangeRate !== null && exchangeRate > 0 ? totalUsd * exchangeRate : null;

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
          <p className="text-xs text-muted-foreground">
            {formatCurrency(standardPrice)}/ton × {quantity} ton
          </p>
          <p className="text-lg font-bold">{formatCurrency(costUsd)}</p>
        </div>
      </div>

      {currencyCode !== null && clientCostLocal !== null && exchangeRate !== null ? (
        <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 p-3 border border-blue-200 dark:border-blue-800" data-testid="card-client-cost">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            <p className="text-xs font-medium text-blue-700 dark:text-blue-300">
              Custo Cliente ({client.country} - {currencyCode})
            </p>
          </div>
          <p className="text-lg font-bold text-blue-900 dark:text-blue-100">
            {formatLocalCurrency(clientCostLocal, currencyCode)}
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
            Câmbio do dia: 1 USD = {exchangeRate.toFixed(4)} {currencyCode}
          </p>
        </div>
      ) : currencyCode !== null ? (
        <div className="rounded-md bg-muted/50 p-3 border text-sm text-muted-foreground" data-testid="card-client-cost-unavailable">
          <DollarSign className="h-3.5 w-3.5 inline mr-1" />
          Câmbio {currencyCode} indisponível no momento
        </div>
      ) : null}

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
            : hasValidCost ? `(${formatCurrency(price)} − ${formatCurrency(standardPrice)}) × ${quantity} ton` : ""}
        </p>
      </div>
    </div>
  );
}

function QuotationForm({ editQuotation, onSuccess }: { editQuotation: QuotationWithDetails | null; onSuccess: () => void }) {
  const { toast } = useToast();
  const { data: clientsList } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: productsList } = useQuery<Product[]>({ queryKey: ["/api/products"] });
  const { data: suppliersList } = useQuery<Supplier[]>({ queryKey: ["/api/suppliers"] });
  const { data: quotesData } = useQuery<QuotesData>({ queryKey: ["/api/quotes"] });

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
          clientId: 0,
          productId: 0,
          supplierId: undefined,
          unitPrice: "",
          quantity: 0,
          margem: "",
          paymentTerms: "",
          validityDate: "",
          notes: "",
          status: "rascunho",
        },
  });

  const watchedProductId = form.watch("productId");

  function getStandardPrice(): number | null {
    const product = productsList?.find((p) => p.id === watchedProductId);
    if (!product) return null;
    const sp = parseFloat(product.standardPrice);
    return isNaN(sp) ? null : sp;
  }

  function onMargemChange(margemStr: string) {
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

  const mutation = useMutation({
    mutationFn: (data: InsertQuotation) =>
      editQuotation
        ? apiRequest("PATCH", `/api/quotations/${editQuotation.id}`, data)
        : apiRequest("POST", "/api/quotations", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotations"] });
      toast({ title: editQuotation ? "Cotacao atualizada" : "Cotacao criada" });
      onSuccess();
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
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

        <div className="grid grid-cols-3 gap-4">
          <FormField control={form.control} name="unitPrice" render={({ field }) => (
            <FormItem>
              <FormLabel>Preço Unitário (USD)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  value={field.value}
                  onChange={(e) => onUnitPriceChange(e.target.value)}
                  data-testid="input-quotation-price"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="quantity" render={({ field }) => (
            <FormItem>
              <FormLabel>Quantidade (ton)</FormLabel>
              <FormControl><Input type="number" {...field} onChange={(e) => field.onChange(Number(e.target.value))} data-testid="input-quotation-quantity" /></FormControl>
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
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="99"
                    placeholder="Ex: 15.0"
                    value={field.value || ""}
                    onChange={(e) => onMargemChange(e.target.value)}
                    data-testid="input-quotation-margem"
                    className="pr-8"
                  />
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
          quotesData={quotesData}
        />

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

        <FormField control={form.control} name="notes" render={({ field }) => (
          <FormItem>
            <FormLabel>Observacoes</FormLabel>
            <FormControl><Textarea {...field} value={field.value || ""} rows={3} data-testid="input-quotation-notes" /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        {editQuotation && (
          <FormField control={form.control} name="status" render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || "rascunho"}>
                <FormControl>
                  <SelectTrigger data-testid="select-quotation-status">
                    <SelectValue />
                  </SelectTrigger>
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
  infoCard(12, thirdW, "Preco Unitario", `${fmt(unitNum)}/ton`);
  infoCard(14 + thirdW, thirdW, "Quantidade", `${q.quantity} toneladas`);
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
  doc.text(`${q.quantity} ton x ${fmt(unitNum)}`, 20, y + 14);
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
    `Quantidade: ${q.quantity} ton`,
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

export default function Quotations() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editQuotation, setEditQuotation] = useState<QuotationWithDetails | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

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
        <Dialog open={formOpen} onOpenChange={(v) => { setFormOpen(v); if (!v) setEditQuotation(null); }}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-quotation" onClick={() => { setEditQuotation(null); setFormOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Cotacao
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editQuotation ? "Editar Cotacao" : "Nova Cotacao"}</DialogTitle></DialogHeader>
            <QuotationForm editQuotation={editQuotation} onSuccess={() => { setFormOpen(false); setEditQuotation(null); }} />
          </DialogContent>
        </Dialog>
      </div>

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
                <TableHead className="text-right">Qtd (ton)</TableHead>
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
                    <TableCell className="font-medium">{q.client.name}</TableCell>
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
                            onClick={() => {
                              if (confirm("Confirma a realizacao da venda? Uma ordem de exportacao sera criada automaticamente.")) {
                                sellMutation.mutate(q);
                              }
                            }}
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
    </div>
  );
}
