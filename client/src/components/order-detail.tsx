import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Ship, Truck, Calendar, DollarSign, MapPin, Package, FileText, TrendingUp, Info } from "lucide-react";
import type { ExportOrderWithDetails } from "@shared/schema";

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

function DetailRow({ label, value, icon: Icon }: { label: string; value: string | null | undefined; icon?: React.ElementType }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        <span>{label}</span>
      </div>
      <span className="text-sm font-medium">{value || "-"}</span>
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
    <div className="space-y-1 border-b pb-4">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
        <TrendingUp className="h-3.5 w-3.5" />
        Dólar no Dia de Venda
      </h3>

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
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <DollarSign className="h-3.5 w-3.5" />
              <span>USD / BRL</span>
            </div>
            <div className="text-right">
              <span className="text-sm font-medium font-mono">R$ {data.rate.toFixed(4)}</span>
              {data.isFallback && (
                <p className="text-xs text-muted-foreground">
                  (cotação atual — data da ordem é futura)
                </p>
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

export default function OrderDetail({ order }: { order: ExportOrderWithDetails }) {
  const transitDays = order.transitTime ? `${order.transitTime} dias` : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        {order.parametrizacao === "verde" && (
          <Badge className="bg-emerald-600 dark:bg-emerald-500 text-white">Verde</Badge>
        )}
        {order.parametrizacao === "amarelo" && (
          <Badge className="bg-amber-500 dark:bg-amber-400 text-white">Amarelo</Badge>
        )}
        {order.parametrizacao === "vermelho" && (
          <Badge variant="destructive">Vermelho</Badge>
        )}
        {order.statusPagamento === "pago" && (
          <Badge className="bg-emerald-600 dark:bg-emerald-500 text-white">Pago</Badge>
        )}
        {order.statusPagamento === "pendente" && (
          <Badge variant="secondary">Pendente</Badge>
        )}
        {order.statusPagamento === "atrasado" && (
          <Badge variant="destructive">Atrasado</Badge>
        )}
        <Badge variant="outline" className="ml-auto">
          {order.modal === "maritimo" ? <Ship className="h-3 w-3 mr-1" /> : <Truck className="h-3 w-3 mr-1" />}
          {order.modal === "maritimo" ? "Marítimo" : "Rodoviário"}
        </Badge>
      </div>

      <div className="space-y-1 border-b pb-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Dados Gerais</h3>
        <DetailRow label="Invoice" value={order.invoice} icon={FileText} />
        <DetailRow label="Cliente" value={order.client?.name} icon={MapPin} />
        <DetailRow label="País" value={order.client?.country} />
        <DetailRow label="Produto" value={order.product?.type} icon={Package} />
        <DetailRow label="Gramatura" value={order.product?.grammage} />
        <DetailRow label="Fábrica" value={order.factory} />
        <DetailRow label="NFE" value={order.nfe} />
        <DetailRow label="Booking/CRT" value={order.bookingCrt} />
        <DetailRow label="Número DUE" value={order.dueNumber} />
      </div>

      <div className="space-y-1 border-b pb-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Logística</h3>
        {order.modal === "maritimo" && <DetailRow label="Vessel" value={order.vessel} icon={Ship} />}
        <DetailRow
          label="Data Embarque"
          value={formatDate(order.embarqueDate)}
          icon={Calendar}
        />
        <DetailRow
          label="Data Desembarque"
          value={formatDate(order.desembarqueDate)}
        />
        <DetailRow label="Transit Time" value={transitDays} />
        <DetailRow
          label="Deadline DRA"
          value={formatDate(order.deadlineDra)}
        />
        <DetailRow
          label="Deadline Carga"
          value={formatDate(order.deadlineCarga)}
        />
      </div>

      <div className="space-y-1 border-b pb-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Financeiro</h3>
        <DetailRow label="Valor Unitário" value={formatUSD(order.unitPrice)} icon={DollarSign} />
        <DetailRow label="Quantidade" value={`${order.quantity} ton`} />
        <DetailRow label="Total" value={formatUSD(order.total)} />
        <DetailRow label="Termos de Pagamento" value={order.paymentTerms} />
        <DetailRow
          label="Vencimento"
          value={formatDate(order.dueDate)}
        />
        <DetailRow
          label="Data Pagamento Real"
          value={formatDate(order.paymentDate)}
        />
        <DetailRow label="ACC" value={order.acc ? formatUSD(order.acc) : null} />
        <DetailRow label="Fechamento de Câmbio" value={order.exchangeClose || null} />
      </div>

      <SaleRateSection order={order} />
    </div>
  );
}
