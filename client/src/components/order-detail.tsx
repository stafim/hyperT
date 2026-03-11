import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Ship, Truck, Calendar, DollarSign, MapPin, Package, FileText,
  TrendingUp, Info, User, Percent, Clock, ExternalLink, Link2Off,
} from "lucide-react";
import type { ExportOrderWithDetails, QuotationWithDetails } from "@shared/schema";

function formatUSD(value: number | string) {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD" }).format(num);
}

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(d: string | null | undefined) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("pt-BR");
}

function SectionTitle({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2 pt-1">
      <Icon className="h-3.5 w-3.5" />
      {children}
    </h3>
  );
}

function DetailRow({ label, value, icon: Icon, highlight }: { label: string; value: string | null | undefined; icon?: React.ElementType; highlight?: "green" | "amber" }) {
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
        <span>{label}</span>
      </div>
      <span className={`text-sm font-medium text-right ${highlight === "green" ? "text-emerald-600 dark:text-emerald-400 font-bold" : highlight === "amber" ? "text-amber-600 dark:text-amber-400" : ""}`}>
        {value || "-"}
      </span>
    </div>
  );
}

type HistoricalRateResult = {
  requestedDate: string;
  resolvedDate: string;
  rate: number | null;
  currency: string;
  isFallback: boolean;
};

function SaleRateSection({ order }: { order: ExportOrderWithDetails }) {
  const saleDate = order.createdAt
    ? new Date(order.createdAt).toISOString().split("T")[0]
    : null;

  const { data, isLoading, isError } = useQuery<HistoricalRateResult>({
    queryKey: [`/api/historical-rate?date=${saleDate}&currency=BRL`],
    enabled: !!saleDate,
  });

  const totalUsd = parseFloat(order.total ?? "0");

  return (
    <div className="space-y-1">
      <SectionTitle icon={TrendingUp}>Dólar no Dia de Venda</SectionTitle>
      <DetailRow
        label="Data de Venda"
        value={saleDate ? new Date(saleDate + "T00:00:00").toLocaleDateString("pt-BR") : "-"}
        icon={Calendar}
      />

      {isLoading && (
        <div className="flex items-center justify-between py-2">
          <span className="text-sm text-muted-foreground">Carregando câmbio...</span>
          <Skeleton className="h-4 w-24" />
        </div>
      )}
      {isError && (
        <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
          <Info className="h-3.5 w-3.5" />
          <span>Câmbio histórico indisponível</span>
        </div>
      )}
      {data && data.rate !== null && (
        <>
          <div className="flex items-center justify-between py-2 border-b">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <DollarSign className="h-3.5 w-3.5" />
              <span>USD / BRL</span>
            </div>
            <div className="text-right">
              <span className="text-sm font-medium font-mono">R$ {data.rate.toFixed(4)}</span>
              {data.isFallback && (
                <p className="text-xs text-muted-foreground">(cotação atual — data futura)</p>
              )}
              {!data.isFallback && data.resolvedDate !== data.requestedDate && (
                <p className="text-xs text-muted-foreground">
                  ref. {new Date(data.resolvedDate + "T00:00:00").toLocaleDateString("pt-BR")}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <DollarSign className="h-3.5 w-3.5" />
              <span>Equiv. em BRL</span>
            </div>
            <div className="text-right">
              <span className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">
                {formatBRL(totalUsd * data.rate)}
              </span>
              <p className="text-xs text-muted-foreground">
                {formatUSD(totalUsd)} × {data.rate.toFixed(4)}
              </p>
            </div>
          </div>
        </>
      )}
      {data && data.rate === null && (
        <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
          <Info className="h-3.5 w-3.5" />
          <span>Taxa não disponível para esta data</span>
        </div>
      )}
    </div>
  );
}

const QUOTATION_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  rascunho:   { label: "Rascunho",   className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border" },
  enviada:    { label: "Enviada",    className: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  aceita:     { label: "Aceita",     className: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  recusada:   { label: "Recusada",   className: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
  convertida: { label: "Convertida", className: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300" },
};

function QuotationSection({ quotationId }: { quotationId: number | null | undefined }) {
  const { data: quotation, isLoading, isError } = useQuery<QuotationWithDetails>({
    queryKey: ["/api/quotations", quotationId],
    queryFn: async () => {
      const res = await fetch(`/api/quotations/${quotationId}`);
      if (!res.ok) throw new Error("Cotação não encontrada");
      return res.json();
    },
    enabled: !!quotationId,
  });

  if (!quotationId) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
        <Link2Off className="h-8 w-8 opacity-40" />
        <p className="text-sm">Esta ordem não foi gerada a partir de uma cotação.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3 py-4">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
      </div>
    );
  }

  if (isError || !quotation) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
        <Info className="h-8 w-8 opacity-40" />
        <p className="text-sm">Não foi possível carregar os dados da cotação.</p>
      </div>
    );
  }

  const statusInfo = QUOTATION_STATUS_LABELS[quotation.status] ?? { label: quotation.status, className: "" };
  const margem = quotation.margem ? parseFloat(quotation.margem) : null;
  const totalNum = parseFloat(quotation.total);
  const lucro = margem !== null ? totalNum * (margem / 100) : null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusInfo.className}`}>
          {statusInfo.label}
        </span>
        <span className="text-xs text-muted-foreground font-mono ml-auto">ID #{quotation.id}</span>
      </div>

      {/* Identificação */}
      <div className="space-y-0.5">
        <SectionTitle icon={FileText}>Identificação</SectionTitle>
        <DetailRow label="Cliente" value={quotation.client?.name} icon={User} />
        <DetailRow label="País" value={quotation.client?.country} icon={MapPin} />
        <DetailRow label="Produto" value={quotation.product?.type} icon={Package} />
        <DetailRow label="Gramatura" value={quotation.product?.grammage} />
        {quotation.supplier && (
          <DetailRow label="Fornecedor" value={quotation.supplier.name} />
        )}
      </div>

      {/* Financeiro da cotação */}
      <div className="space-y-0.5">
        <SectionTitle icon={DollarSign}>Financeiro da Cotação</SectionTitle>
        <DetailRow label="Preço Unitário" value={formatUSD(quotation.unitPrice)} icon={DollarSign} />
        <DetailRow label="Quantidade" value={`${quotation.quantity} ${quotation.product?.unidade || "un"}`} />
        <DetailRow label="Total" value={formatUSD(quotation.total)} highlight="green" />
        {margem !== null && (
          <DetailRow label="Margem de Lucro" value={`${margem.toFixed(1)}%`} icon={Percent} highlight="amber" />
        )}
        {lucro !== null && (
          <DetailRow label="Lucro Estimado" value={formatUSD(lucro)} icon={TrendingUp} highlight="green" />
        )}
        <DetailRow label="Cond. Pagamento" value={quotation.paymentTerms || null} />
      </div>

      {/* Datas */}
      <div className="space-y-0.5">
        <SectionTitle icon={Calendar}>Datas</SectionTitle>
        <DetailRow
          label="Validade da Cotação"
          value={formatDate(quotation.validityDate)}
          icon={Clock}
        />
        <DetailRow
          label="Data de Criação"
          value={formatDate(quotation.createdAt)}
          icon={Calendar}
        />
        {quotation.updatedAt && (
          <DetailRow
            label="Última Atualização"
            value={formatDate(quotation.updatedAt)}
          />
        )}
      </div>

      {/* Observações */}
      {quotation.notes && (
        <div className="space-y-1.5">
          <SectionTitle icon={Info}>Observações</SectionTitle>
          <p className="text-sm text-muted-foreground bg-muted/40 rounded-lg p-3 leading-relaxed">
            {quotation.notes}
          </p>
        </div>
      )}
    </div>
  );
}

export default function OrderDetail({ order }: { order: ExportOrderWithDetails }) {
  const transitDays = order.transitTime ? `${order.transitTime} dias` : null;

  return (
    <Tabs defaultValue="exportacao" className="w-full">
      <TabsList className="w-full mb-4">
        <TabsTrigger value="exportacao" className="flex-1 gap-1.5">
          <Ship className="h-3.5 w-3.5" />
          Exportação
        </TabsTrigger>
        <TabsTrigger value="cotacao" className="flex-1 gap-1.5">
          <ExternalLink className="h-3.5 w-3.5" />
          Cotação de Origem
          {order.quotationId && (
            <span className="ml-1 text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full font-medium">
              #{order.quotationId}
            </span>
          )}
        </TabsTrigger>
      </TabsList>

      {/* ── Tab: Exportação ── */}
      <TabsContent value="exportacao" className="space-y-5 mt-0">
        {/* Status badges */}
        <div className="flex items-center gap-2 flex-wrap">
          {order.parametrizacao === "verde" && <Badge className="bg-emerald-600 dark:bg-emerald-500 text-white">Verde</Badge>}
          {order.parametrizacao === "amarelo" && <Badge className="bg-amber-500 dark:bg-amber-400 text-white">Amarelo</Badge>}
          {order.parametrizacao === "vermelho" && <Badge variant="destructive">Vermelho</Badge>}
          {order.statusPagamento === "pago" && <Badge className="bg-emerald-600 dark:bg-emerald-500 text-white">Pago</Badge>}
          {order.statusPagamento === "pendente" && <Badge variant="secondary">Pendente</Badge>}
          {order.statusPagamento === "atrasado" && <Badge variant="destructive">Atrasado</Badge>}
          <Badge variant="outline" className="ml-auto">
            {order.modal === "maritimo" ? <Ship className="h-3 w-3 mr-1" /> : <Truck className="h-3 w-3 mr-1" />}
            {order.modal === "maritimo" ? "Marítimo" : "Rodoviário"}
          </Badge>
        </div>

        {/* Dados Gerais */}
        <div className="space-y-0.5">
          <SectionTitle icon={FileText}>Dados Gerais</SectionTitle>
          <DetailRow label="Invoice" value={order.invoice} icon={FileText} />
          <DetailRow label="Cliente" value={order.client?.name} icon={User} />
          <DetailRow label="País" value={order.client?.country} icon={MapPin} />
          {order.criadoPor && <DetailRow label="Criado por" value={order.criadoPor} icon={User} />}
          <DetailRow label="Vendedor" value={(order as any).vendedor || "Não atribuído"} icon={User} />
          <DetailRow label="Produto" value={order.product?.type} icon={Package} />
          <DetailRow label="Gramatura" value={order.product?.grammage} />
          <DetailRow label="Fábrica" value={order.factory} />
          <DetailRow label="NFE" value={order.nfe} />
          <DetailRow label="Booking/CRT" value={order.bookingCrt} />
          <DetailRow label="Número DUE" value={order.dueNumber} />
        </div>

        {/* Logística */}
        <div className="space-y-0.5">
          <SectionTitle icon={Ship}>Logística</SectionTitle>
          {order.modal === "maritimo" && <DetailRow label="Vessel" value={order.vessel} icon={Ship} />}
          <DetailRow label="Data Embarque" value={formatDate(order.embarqueDate)} icon={Calendar} />
          <DetailRow label="Data Desembarque" value={formatDate(order.desembarqueDate)} />
          <DetailRow label="Transit Time" value={transitDays} />
          <DetailRow label="Deadline DRA" value={formatDate(order.deadlineDra)} />
          <DetailRow label="Deadline Carga" value={formatDate(order.deadlineCarga)} />
        </div>

        {/* Financeiro */}
        <div className="space-y-0.5">
          <SectionTitle icon={DollarSign}>Financeiro</SectionTitle>
          <DetailRow label="Valor Unitário" value={formatUSD(order.unitPrice)} icon={DollarSign} />
          <DetailRow label="Quantidade" value={`${order.quantity} ton`} />
          <DetailRow label="Total" value={formatUSD(order.total)} highlight="green" />
          <DetailRow label="Termos de Pagamento" value={order.paymentTerms} />
          <DetailRow label="Vencimento" value={formatDate(order.dueDate)} />
          <DetailRow label="Data Pagamento Real" value={formatDate(order.paymentDate)} />
          <DetailRow label="ACC" value={order.acc ? formatUSD(order.acc) : null} />
          <DetailRow label="Fechamento de Câmbio" value={order.exchangeClose || null} />
        </div>

        <SaleRateSection order={order} />
      </TabsContent>

      {/* ── Tab: Cotação de Origem ── */}
      <TabsContent value="cotacao" className="mt-0">
        <QuotationSection quotationId={order.quotationId} />
      </TabsContent>
    </Tabs>
  );
}
