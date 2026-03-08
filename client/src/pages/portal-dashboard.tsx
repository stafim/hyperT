import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import logoPath from "@assets/Captura_de_tela_2026-02-27_111909_1772203458683.png";
import {
  Ship, Clock, Anchor, Globe, Factory, Truck, FileCheck,
  CheckCircle2, ExternalLink, ShieldCheck, AlertCircle,
  Download, FileText, ScrollText, Award, Package, ChevronRight,
  Loader2, LogOut, LayoutGrid, List, Calendar, DollarSign,
  MapPin, FileBarChart2,
} from "lucide-react";

type PortalOrder = {
  id: number;
  invoice: string;
  factory: string | null;
  vessel: string | null;
  modal: string;
  vesselStatus: string | null;
  embarqueDate: string | null;
  desembarqueDate: string | null;
  transitTime: number | null;
  deadlineCarga: string | null;
  deadlineDra?: string | null;
  dueNumber: string | null;
  bookingCrt: string | null;
  nfe: string | null;
  quantity: number;
  total: string;
  unitPrice: string;
  paymentTerms: string | null;
  client: { name: string; country: string };
  product: { type: string; grammage: string };
  supplier: { name: string } | null;
};

type PortalClient = { id: number; name: string; country: string };

const STEPS = [
  { id: 1, label: "Origem", sublabel: "Fábrica", icon: Factory },
  { id: 2, label: "Trânsito", sublabel: "Terrestre", icon: Truck },
  { id: 3, label: "Porto", sublabel: "Recebimento", icon: Anchor },
  { id: 4, label: "Despacho", sublabel: "DU-E", icon: FileCheck },
  { id: 5, label: "Embarcado", sublabel: "Em Alto-Mar", icon: Ship },
];

const STATUS_STEP: Record<string, number> = {
  etd: 3, zarpou: 4, em_navegacao: 5, fundeado: 6,
};

const STATUS_LABELS: Record<string, string> = {
  etd: "Aguardando Embarque",
  zarpou: "Navio Zarpou",
  em_navegacao: "Em Navegação",
  fundeado: "Chegou ao Destino",
};

const STATUS_DATES: Record<string, string> = {
  etd: "ETD confirmado — aguardando saída do porto",
  zarpou: "Navio partiu — documentação em trânsito",
  em_navegacao: "Carga a bordo — navegando para o destino",
  fundeado: "Navio ancorado — aguardando atracação",
};

function getActiveStep(vs: string | null): number {
  if (!vs) return 1;
  return STATUS_STEP[vs] ?? 1;
}

function calcEtaDays(d: string | null): number | null {
  if (!d) return null;
  const eta = new Date(d + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((eta.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function fmtDate(d: string | null | undefined) {
  if (!d) return null;
  return new Date(d + "T00:00:00").toLocaleDateString("pt-BR", {
    weekday: "short", year: "numeric", month: "short", day: "numeric",
  });
}

function fmtDateShort(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("pt-BR");
}

function fmtCurrency(v: string | number) {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD" }).format(n);
}

function getStepTimestamp(order: PortalOrder, stepId: number): string | null {
  if (stepId === 1 && order.factory) return `Fábrica: ${order.factory}`;
  if (stepId === 2 && order.deadlineCarga) return `Deadline: ${fmtDateShort(order.deadlineCarga)}`;
  if (stepId === 3 && order.embarqueDate) return `Embarque: ${fmtDateShort(order.embarqueDate)}`;
  if (stepId === 4 && order.dueNumber) return `DU-E: ${order.dueNumber}`;
  if (stepId === 5 && order.desembarqueDate) return `ETA: ${fmtDateShort(order.desembarqueDate)}`;
  return null;
}

function getProgress(order: PortalOrder) {
  const active = getActiveStep(order.vesselStatus);
  const allDone = order.vesselStatus === "fundeado";
  const stepsDone = allDone ? 5 : Math.max(0, active - 1);
  return { active, allDone, pct: Math.round((stepsDone / 5) * 100) };
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-slate-400 text-xs">—</span>;
  const styles: Record<string, string> = {
    em_navegacao: "bg-blue-100 text-blue-700",
    fundeado: "bg-emerald-100 text-emerald-700",
    zarpou: "bg-amber-100 text-amber-700",
    etd: "bg-slate-100 text-slate-600",
  };
  return (
    <Badge variant="secondary" className={`text-[10px] px-2 py-0.5 font-semibold ${styles[status] ?? "bg-slate-100 text-slate-600"}`}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

function EtaChip({ days }: { days: number | null }) {
  if (days === null) return <span className="text-slate-400 text-xs">—</span>;
  if (days < 0) return <span className="text-xs font-semibold text-red-600">Atrasado {Math.abs(days)}d</span>;
  if (days === 0) return <span className="text-xs font-semibold text-amber-600">Chega hoje</span>;
  if (days <= 5) return <span className="text-xs font-semibold text-amber-600">{days}d</span>;
  return <span className="text-xs font-semibold text-blue-600">{days}d</span>;
}

function StepperBar({ order, compact = false }: { order: PortalOrder; compact?: boolean }) {
  const { active, allDone } = getProgress(order);

  return (
    <div className="flex items-center w-full">
      {STEPS.map((step, idx) => {
        const completed = allDone || active > step.id;
        const current = !allDone && active === step.id;
        const Icon = step.icon;
        return (
          <div key={step.id} className="flex items-center flex-1 min-w-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                  <div className={`flex items-center justify-center rounded-full transition-all duration-300 ${compact ? "h-7 w-7" : "h-9 w-9"} ${completed ? "bg-emerald-500 text-white shadow-md shadow-emerald-200" : current ? "bg-blue-600 text-white shadow-md shadow-blue-200 ring-2 ring-blue-300 ring-offset-1 animate-pulse" : "bg-slate-100 text-slate-400"}`}>
                    {completed ? <CheckCircle2 className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} /> : <Icon className={compact ? "h-3 w-3" : "h-4 w-4"} />}
                  </div>
                  {!compact && (
                    <div className="text-center">
                      <p className={`text-[10px] font-semibold leading-none ${completed ? "text-emerald-600" : current ? "text-blue-600" : "text-slate-400"}`}>{step.label}</p>
                      <p className="text-[9px] text-slate-400 leading-none mt-0.5">{step.sublabel}</p>
                    </div>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs max-w-[180px] text-center">
                <p className="font-semibold">{step.label} — {step.sublabel}</p>
                <p className="text-muted-foreground mt-0.5">{getStepTimestamp(order, step.id) || (completed ? "Concluído" : current ? "Em andamento" : "Aguardando")}</p>
              </TooltipContent>
            </Tooltip>
            {idx < STEPS.length - 1 && (
              <div className={`flex-1 mx-1 ${compact ? "h-0.5" : "h-1"} rounded-full transition-all duration-500 ${completed ? "bg-emerald-400" : current ? "bg-gradient-to-r from-blue-500 to-slate-200" : "bg-slate-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function DocRow({ icon: Icon, label, value, available }: { icon: React.ElementType; label: string; value: string | null; available: boolean }) {
  return (
    <div className={`flex items-center justify-between p-3 rounded-xl border transition-all ${available ? "bg-white border-slate-200 hover:border-blue-400 hover:shadow-sm cursor-pointer group" : "bg-slate-50 border-dashed border-slate-200 opacity-60"}`}>
      <div className="flex items-center gap-3">
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${available ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-400"}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold">{label}</p>
          <p className="text-xs text-muted-foreground">{value || "—"}</p>
        </div>
      </div>
      {available ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-emerald-600 font-medium">Disponível</span>
          <div className="h-7 w-7 rounded-lg bg-blue-600 flex items-center justify-center group-hover:bg-blue-700 transition-colors">
            <Download className="h-3.5 w-3.5 text-white" />
          </div>
        </div>
      ) : (
        <span className="text-xs text-slate-400">Em processamento</span>
      )}
    </div>
  );
}

function OrderModal({ order, open, onClose }: { order: PortalOrder; open: boolean; onClose: () => void }) {
  const etaDays = calcEtaDays(order.desembarqueDate);
  const docOk = !!(order.bookingCrt && order.nfe);
  const marineUrl = order.vessel
    ? `https://www.marinetraffic.com/en/ais/index/ships/range/vessel_name:${encodeURIComponent(order.vessel)}`
    : null;
  const { pct, allDone } = getProgress(order);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
        <div className="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-6 rounded-t-lg">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle className="text-white text-xl font-bold">
                  Embarque — {order.invoice}
                </DialogTitle>
                <p className="text-blue-300 text-sm mt-1">{order.client.name} · {order.client.country}</p>
              </div>
              {order.vesselStatus && (
                <Badge className={`text-xs font-semibold px-3 py-1 ${order.vesselStatus === "em_navegacao" ? "bg-blue-500" : order.vesselStatus === "fundeado" ? "bg-emerald-500" : order.vesselStatus === "zarpou" ? "bg-amber-500" : "bg-slate-600"} text-white`}>
                  {STATUS_LABELS[order.vesselStatus]}
                </Badge>
              )}
            </div>
          </DialogHeader>
          <div className="mt-6">
            <StepperBar order={order} />
          </div>
          {order.vesselStatus && (
            <p className="text-blue-300/70 text-xs text-center mt-3">{STATUS_DATES[order.vesselStatus]}</p>
          )}
          <div className="mt-4 flex items-center justify-between text-xs text-blue-300/60">
            <span>Progresso da operação</span>
            <span className="font-semibold text-white">{pct}%</span>
          </div>
          <div className="mt-1.5 w-full bg-white/10 rounded-full h-1.5">
            <div className={`h-1.5 rounded-full transition-all duration-700 ${allDone ? "bg-emerald-400" : "bg-blue-400"}`} style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-2xl border bg-white border-slate-200 p-4 shadow-sm space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                <Ship className="h-3.5 w-3.5" />Navio
              </div>
              {order.vessel ? (
                <>
                  <p className="font-bold text-base leading-tight">{order.vessel}</p>
                  {marineUrl && (
                    <a href={marineUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                      <ExternalLink className="h-3 w-3" />Ver no MarineTraffic
                    </a>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground text-sm">Não atribuído</p>
              )}
            </div>

            <div className={`rounded-2xl border p-4 shadow-sm space-y-1 ${etaDays !== null && etaDays <= 3 ? "bg-amber-50 border-amber-200" : "bg-white border-slate-200"}`}>
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                <Clock className="h-3.5 w-3.5" />Dias para ETA
              </div>
              {etaDays !== null ? (
                <>
                  <p className={`font-bold text-3xl leading-none ${etaDays < 0 ? "text-red-600" : etaDays <= 3 ? "text-amber-600" : "text-blue-600"}`}>
                    {etaDays < 0 ? `+${Math.abs(etaDays)}` : etaDays}
                  </p>
                  <p className="text-xs text-muted-foreground">{etaDays < 0 ? "dias atrasado" : etaDays === 0 ? "chega hoje" : "dias restantes"}</p>
                </>
              ) : (
                <p className="text-muted-foreground text-sm">ETA não definido</p>
              )}
            </div>

            <div className={`rounded-2xl border p-4 shadow-sm space-y-1 ${docOk ? "bg-emerald-50 border-emerald-200" : "bg-white border-slate-200"}`}>
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                <ShieldCheck className="h-3.5 w-3.5" />Conformidade
              </div>
              <div className="flex items-center gap-2">
                {docOk ? <CheckCircle2 className="h-7 w-7 text-emerald-500" /> : <AlertCircle className="h-7 w-7 text-amber-500" />}
                <div>
                  <p className={`font-bold text-sm ${docOk ? "text-emerald-700" : "text-amber-700"}`}>
                    {docOk ? "Documentação OK" : "Pendências"}
                  </p>
                  <p className="text-xs text-muted-foreground">{docOk ? "Todos os docs verificados" : "Alguns docs em aberto"}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-bold mb-3 flex items-center gap-2">
                <ScrollText className="h-4 w-4 text-blue-600" />
                Documentos — One Click
              </p>
              <div className="space-y-2">
                <DocRow icon={FileText} label="Bill of Lading (BL)" value={order.bookingCrt || null}
                  available={!!order.bookingCrt && (order.vesselStatus === "zarpou" || order.vesselStatus === "em_navegacao" || order.vesselStatus === "fundeado")} />
                <DocRow icon={ScrollText} label="Fatura Comercial" value={order.invoice} available={!!order.invoice} />
                <DocRow icon={Award} label="Certificado de Origem" value={order.dueNumber || null}
                  available={order.vesselStatus === "em_navegacao" || order.vesselStatus === "fundeado"} />
              </div>
            </div>

            <div>
              <p className="text-sm font-bold mb-3 flex items-center gap-2">
                <Package className="h-4 w-4 text-blue-600" />
                Detalhes da Carga
              </p>
              <div className="space-y-2">
                {[
                  { label: "Produto", value: `${order.product.type} — ${order.product.grammage} g/m²` },
                  { label: "Quantidade", value: `${order.quantity} ton.` },
                  { label: "Preço Unitário", value: `${fmtCurrency(order.unitPrice)} / ton.` },
                  { label: "Valor Total", value: fmtCurrency(order.total) },
                  { label: "Cond. Pagamento", value: order.paymentTerms || "—" },
                  { label: "NF-e", value: order.nfe || "—" },
                  { label: "DU-E", value: order.dueNumber || "—" },
                  { label: "Booking / CRT", value: order.bookingCrt || "—" },
                  { label: "Fornecedor", value: order.supplier?.name || "—" },
                  { label: "Fábrica Origem", value: order.factory || "—" },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between text-sm py-1 border-b border-slate-100 last:border-0">
                    <span className="text-muted-foreground flex-shrink-0">{label}</span>
                    <span className="font-medium text-right max-w-[55%] truncate">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5" />
              Linha do Tempo
            </p>
            <div className="space-y-2">
              {[
                { label: "Deadline DRA", date: order.deadlineDra, done: true },
                { label: "Deadline Carga", date: order.deadlineCarga, done: true },
                { label: "Data de Embarque", date: order.embarqueDate, done: true },
                { label: "ETA — Previsão de Chegada", date: order.desembarqueDate, done: order.vesselStatus === "fundeado" },
              ].filter(e => e.date).map(({ label, date, done }) => (
                <div key={label} className="flex items-center gap-3 text-sm">
                  <div className={`h-2 w-2 rounded-full flex-shrink-0 ${done ? "bg-emerald-500" : "bg-blue-400"}`} />
                  <span className="text-muted-foreground w-48 flex-shrink-0">{label}</span>
                  <span className="font-medium">{fmtDate(date)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GridView({ orders, onSelect }: { orders: PortalOrder[]; onSelect: (o: PortalOrder) => void }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {orders.map((order) => {
        const { allDone, pct } = getProgress(order);
        const etaDays = calcEtaDays(order.desembarqueDate);
        const borderColor = {
          etd: "border-l-amber-400", zarpou: "border-l-blue-500",
          em_navegacao: "border-l-blue-600", fundeado: "border-l-emerald-500",
        }[order.vesselStatus ?? ""] ?? "border-l-slate-300";

        return (
          <button
            key={order.id}
            onClick={() => onSelect(order)}
            className={`w-full text-left rounded-2xl border-l-4 ${borderColor} border border-slate-200 bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 p-5 space-y-4 group`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-sm">{order.invoice}</p>
                  <StatusBadge status={order.vesselStatus} />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{order.product.type} · {order.quantity} ton.</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-blue-500 transition-colors flex-shrink-0 mt-0.5" />
            </div>
            <StepperBar order={order} compact />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Ship className="h-3.5 w-3.5" />
                <span className="truncate max-w-[130px]">{order.vessel || "Sem navio"}</span>
              </div>
              <div className="flex items-center gap-3">
                <EtaChip days={etaDays} />
                <span className="text-slate-400">{pct}%</span>
              </div>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1">
              <div className={`h-1 rounded-full transition-all duration-700 ${allDone ? "bg-emerald-500" : "bg-blue-500"}`} style={{ width: `${pct}%` }} />
            </div>
          </button>
        );
      })}
    </div>
  );
}

function ListView({ orders, onSelect }: { orders: PortalOrder[]; onSelect: (o: PortalOrder) => void }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="grid grid-cols-[2fr_2fr_2fr_1.5fr_1.5fr_1fr_auto] gap-4 px-5 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        <span>Ordem / Produto</span>
        <span>Navio</span>
        <span>Status</span>
        <span>Embarque</span>
        <span>ETA</span>
        <span>Progresso</span>
        <span />
      </div>

      {orders.map((order, idx) => {
        const { allDone, pct } = getProgress(order);
        const etaDays = calcEtaDays(order.desembarqueDate);
        const statusDot = {
          etd: "bg-amber-400",
          zarpou: "bg-blue-500",
          em_navegacao: "bg-blue-600",
          fundeado: "bg-emerald-500",
        }[order.vesselStatus ?? ""] ?? "bg-slate-300";

        return (
          <button
            key={order.id}
            onClick={() => onSelect(order)}
            className={`w-full text-left grid grid-cols-[2fr_2fr_2fr_1.5fr_1.5fr_1fr_auto] gap-4 items-center px-5 py-4 hover:bg-blue-50/50 transition-colors group ${idx < orders.length - 1 ? "border-b border-slate-100" : ""}`}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full flex-shrink-0 ${statusDot}`} />
                <p className="font-bold text-sm truncate">{order.invoice}</p>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 truncate pl-4">{order.product.type} · {order.product.grammage} g/m²</p>
            </div>

            <div className="min-w-0">
              {order.vessel ? (
                <>
                  <p className="text-sm font-medium truncate">{order.vessel}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{order.quantity} ton. · {fmtCurrency(order.total)}</p>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">Não atribuído</span>
              )}
            </div>

            <div>
              <StatusBadge status={order.vesselStatus} />
            </div>

            <div>
              <p className="text-sm font-medium">{fmtDateShort(order.embarqueDate)}</p>
              {order.factory && <p className="text-xs text-muted-foreground mt-0.5 truncate">{order.factory}</p>}
            </div>

            <div>
              <p className="text-sm font-medium">{fmtDateShort(order.desembarqueDate)}</p>
              <div className="mt-0.5">
                <EtaChip days={etaDays} />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{pct}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5">
                <div className={`h-1.5 rounded-full transition-all duration-700 ${allDone ? "bg-emerald-500" : "bg-blue-500"}`} style={{ width: `${pct}%` }} />
              </div>
            </div>

            <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-blue-500 transition-colors flex-shrink-0" />
          </button>
        );
      })}
    </div>
  );
}

export default function PortalDashboard() {
  const [, setLocation] = useLocation();
  const [selected, setSelected] = useState<PortalOrder | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const qc = useQueryClient();

  const { data: client, isError: clientError } = useQuery<PortalClient>({
    queryKey: ["/api/portal/me"],
    retry: false,
  });

  const { data: orders, isLoading } = useQuery<PortalOrder[]>({
    queryKey: ["/api/portal/orders"],
    enabled: !!client,
  });

  const logoutMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/portal/logout", {}),
    onSuccess: () => {
      qc.clear();
      setLocation("/portal/login");
    },
  });

  if (clientError) {
    setLocation("/portal/login");
    return null;
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  const etaDaysArr = (orders || [])
    .map((o) => calcEtaDays(o.desembarqueDate))
    .filter((d): d is number => d !== null && d >= 0);
  const avgEta = etaDaysArr.length > 0 ? Math.round(etaDaysArr.reduce((a, b) => a + b, 0) / etaDaysArr.length) : null;
  const inNav = (orders || []).filter((o) => o.vesselStatus === "em_navegacao" || o.vesselStatus === "zarpou").length;
  const totalValue = (orders || []).reduce((s, o) => s + parseFloat(o.total), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoPath} alt="Hypertrade" className="h-8 w-auto object-contain" />
            <div>
              <p className="font-bold text-sm leading-none">Portal do Cliente</p>
              <p className="text-xs text-muted-foreground mt-0.5">{client.name} · {client.country}</p>
            </div>
          </div>
          <button
            onClick={() => logoutMutation.mutate()}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-red-600 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Seus Embarques</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Acompanhe o status de todas as suas cargas em trânsito
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Em Navegação", value: inNav, icon: Ship, color: "text-blue-600", bg: "bg-blue-50 border-blue-100" },
            { label: "ETA Médio", value: avgEta !== null ? `${avgEta}d` : "—", icon: Clock, color: "text-amber-600", bg: "bg-amber-50 border-amber-100" },
            { label: "Total de Embarques", value: (orders || []).length, icon: Globe, color: "text-slate-600", bg: "bg-slate-50 border-slate-200" },
            { label: "Valor Total em Trânsito", value: fmtCurrency(totalValue), icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100" },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className={`rounded-2xl border ${bg} p-4 flex items-center gap-3 shadow-sm`}>
              <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center shadow-sm flex-shrink-0">
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold leading-none truncate">{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Carregando embarques...</span>
          </div>
        ) : !orders || orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
            <Ship className="h-12 w-12 opacity-20" />
            <p className="text-lg font-medium">Nenhum embarque marítimo ativo</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{orders.length}</span> embarque{orders.length !== 1 ? "s" : ""} encontrado{orders.length !== 1 ? "s" : ""}
              </p>
              <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${viewMode === "grid" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  Cards
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${viewMode === "list" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >
                  <List className="h-3.5 w-3.5" />
                  Lista
                </button>
              </div>
            </div>

            {viewMode === "grid"
              ? <GridView orders={orders} onSelect={setSelected} />
              : <ListView orders={orders} onSelect={setSelected} />
            }
          </>
        )}
      </div>

      {selected && (
        <OrderModal order={selected} open={!!selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
