import { Badge } from "@/components/ui/badge";
import { Ship, Truck, Calendar, DollarSign, MapPin, Package, FileText } from "lucide-react";
import type { ExportOrderWithDetails } from "@shared/schema";

function formatCurrency(value: number | string) {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD" }).format(num);
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
          value={order.embarqueDate ? new Date(order.embarqueDate).toLocaleDateString("pt-BR") : null}
          icon={Calendar}
        />
        <DetailRow
          label="Data Desembarque"
          value={order.desembarqueDate ? new Date(order.desembarqueDate).toLocaleDateString("pt-BR") : null}
        />
        <DetailRow label="Transit Time" value={transitDays} />
        <DetailRow
          label="Deadline DRA"
          value={order.deadlineDra ? new Date(order.deadlineDra).toLocaleDateString("pt-BR") : null}
        />
        <DetailRow
          label="Deadline Carga"
          value={order.deadlineCarga ? new Date(order.deadlineCarga).toLocaleDateString("pt-BR") : null}
        />
      </div>

      <div className="space-y-1">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Financeiro</h3>
        <DetailRow label="Valor Unitário" value={formatCurrency(order.unitPrice)} icon={DollarSign} />
        <DetailRow label="Quantidade" value={`${order.quantity} ton`} />
        <DetailRow label="Total" value={formatCurrency(order.total)} />
        <DetailRow label="Termos de Pagamento" value={order.paymentTerms} />
        <DetailRow
          label="Vencimento"
          value={order.dueDate ? new Date(order.dueDate).toLocaleDateString("pt-BR") : null}
        />
        <DetailRow
          label="Data Pagamento Real"
          value={order.paymentDate ? new Date(order.paymentDate).toLocaleDateString("pt-BR") : null}
        />
        <DetailRow label="ACC" value={order.acc ? formatCurrency(order.acc) : null} />
        <DetailRow label="Fechamento de Câmbio" value={order.exchangeClose || null} />
      </div>
    </div>
  );
}
