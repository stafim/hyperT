import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Factory, Truck, Anchor, FileCheck, Ship, ExternalLink,
  Clock, ShieldCheck, Download, FileText, ScrollText, Award,
  Globe, Package, ChevronRight, AlertCircle, CheckCircle2, Loader2,
  LayoutGrid, List,
} from "lucide-react";

type OrderWithDetails = {
  id: number;
  invoice: string;
  factory: string | null;
  vessel: string | null;
  mmsi: string | null;
  imo: string | null;
  modal: string;
  vesselStatus: string | null;
  embarqueDate: string | null;
  desembarqueDate: string | null;
  transitTime: number | null;
  deadlineCarga: string | null;
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

const STEPS = [
  { id: 1, label: "Origem", sublabel: "Fábrica", icon: Factory },
  { id: 2, label: "Trânsito", sublabel: "Terrestre", icon: Truck },
  { id: 3, label: "Porto", sublabel: "Recebimento", icon: Anchor },
  { id: 4, label: "Despacho", sublabel: "Aduaneiro / DU-E", icon: FileCheck },
  { id: 5, label: "Embarcado", sublabel: "Em Alto-Mar", icon: Ship },
];

const STATUS_STEP: Record<string, number> = {
  etd: 3,
  zarpou: 4,
  em_navegacao: 5,
  fundeado: 6,
};

const STATUS_LABELS: Record<string, string> = {
  etd: "Aguardando Embarque",
  zarpou: "Navio Zarpou",
  em_navegacao: "Em Navegação",
  fundeado: "Fundeado — Chegou",
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

function getStepTimestamp(order: OrderWithDetails, stepId: number): string | null {
  if (stepId === 1 && order.factory) return `Fábrica: ${order.factory}`;
  if (stepId === 2 && order.deadlineCarga)
    return `Deadline Carga: ${new Date(order.deadlineCarga + "T00:00:00").toLocaleDateString("pt-BR")}`;
  if (stepId === 3 && order.embarqueDate)
    return `Embarque: ${new Date(order.embarqueDate + "T00:00:00").toLocaleDateString("pt-BR")}`;
  if (stepId === 4 && order.dueNumber) return `DU-E: ${order.dueNumber}`;
  if (stepId === 5 && order.desembarqueDate)
    return `ETA: ${new Date(order.desembarqueDate + "T00:00:00").toLocaleDateString("pt-BR")}`;
  return null;
}

function calcEtaDays(desembarqueDate: string | null): number | null {
  if (!desembarqueDate) return null;
  const eta = new Date(desembarqueDate + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.ceil((eta.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

function formatCurrency(v: string | number) {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD" }).format(n);
}

function StepperBar({ order, compact = false }: { order: OrderWithDetails; compact?: boolean }) {
  const active = getActiveStep(order.vesselStatus);
  const allDone = order.vesselStatus === "fundeado";

  return (
    <div className={`flex items-center w-full ${compact ? "gap-0" : "gap-0"}`}>
      {STEPS.map((step, idx) => {
        const completed = allDone || active > step.id;
        const current = !allDone && active === step.id;
        const Icon = step.icon;

        return (
          <div key={step.id} className="flex items-center flex-1 min-w-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                  <div
                    className={`
                      flex items-center justify-center rounded-full transition-all duration-300
                      ${compact ? "h-7 w-7" : "h-9 w-9"}
                      ${completed
                        ? "bg-emerald-500 text-white shadow-md shadow-emerald-200 dark:shadow-emerald-900"
                        : current
                          ? "bg-blue-600 text-white shadow-md shadow-blue-200 dark:shadow-blue-900 ring-2 ring-blue-300 ring-offset-1 dark:ring-offset-gray-900 animate-pulse"
                          : "bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500"
                      }
                    `}
                  >
                    {completed ? (
                      <CheckCircle2 className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
                    ) : (
                      <Icon className={compact ? "h-3 w-3" : "h-4 w-4"} />
                    )}
                  </div>
                  {!compact && (
                    <div className="text-center">
                      <p className={`text-[10px] font-semibold leading-none ${completed ? "text-emerald-600 dark:text-emerald-400" : current ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-500"}`}>
                        {step.label}
                      </p>
                      <p className="text-[9px] text-slate-400 leading-none mt-0.5">{step.sublabel}</p>
                    </div>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs max-w-[200px] text-center">
                <p className="font-semibold">{step.label} — {step.sublabel}</p>
                {getStepTimestamp(order, step.id) && (
                  <p className="text-muted-foreground mt-0.5">{getStepTimestamp(order, step.id)}</p>
                )}
                {!getStepTimestamp(order, step.id) && (
                  <p className="text-muted-foreground mt-0.5">{completed ? "Concluído" : current ? "Em andamento" : "Aguardando"}</p>
                )}
              </TooltipContent>
            </Tooltip>

            {idx < STEPS.length - 1 && (
              <div className={`flex-1 mx-1 ${compact ? "h-0.5" : "h-1"} rounded-full transition-all duration-500 ${completed ? "bg-emerald-400" : current ? "bg-gradient-to-r from-blue-500 to-slate-200 dark:to-slate-600" : "bg-slate-200 dark:bg-slate-700"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function DocRow({ icon: Icon, label, value, available }: {
  icon: React.ElementType;
  label: string;
  value: string | null;
  available: boolean;
}) {
  return (
    <div className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-200 ${available ? "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-blue-400 hover:shadow-sm cursor-pointer group" : "bg-slate-50 dark:bg-slate-900 border-dashed border-slate-200 dark:border-slate-700 opacity-60"}`}>
      <div className="flex items-center gap-3">
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${available ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" : "bg-slate-100 dark:bg-slate-800 text-slate-400"}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold">{label}</p>
          <p className="text-xs text-muted-foreground">{value || "—"}</p>
        </div>
      </div>
      {available ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Disponível</span>
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

function TrackingModal({ order, open, onClose }: { order: OrderWithDetails; open: boolean; onClose: () => void }) {
  const active = getActiveStep(order.vesselStatus);
  const allDone = order.vesselStatus === "fundeado";
  const etaDays = calcEtaDays(order.desembarqueDate);
  const marineUrl = order.vessel
    ? `https://www.marinetraffic.com/en/ais/index/ships/range/vessel_name:${encodeURIComponent(order.vessel)}`
    : null;

  const docCompliance = !!(order.bookingCrt && order.nfe);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
        <div className="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-6 rounded-t-lg">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle className="text-white text-xl font-bold">
                  Rastreabilidade — {order.invoice}
                </DialogTitle>
                <p className="text-blue-300 text-sm mt-1">{order.client.name} · {order.client.country}</p>
              </div>
              {order.vesselStatus && (
                <Badge className={`text-xs font-semibold px-3 py-1 ${order.vesselStatus === "em_navegacao" ? "bg-blue-500 text-white" : order.vesselStatus === "fundeado" ? "bg-emerald-500 text-white" : order.vesselStatus === "zarpou" ? "bg-amber-500 text-white" : "bg-slate-600 text-white"}`}>
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
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-2xl border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 p-4 space-y-1 shadow-sm">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                <Ship className="h-3.5 w-3.5" />
                Navio
              </div>
              {order.vessel ? (
                <>
                  <p className="font-bold text-base leading-tight">{order.vessel}</p>
                  {(order as any).mmsi && (
                    <a href={`/maps?mmsi=${(order as any).mmsi}`} className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-semibold">
                      <Ship className="h-3 w-3" />
                      Rastrear no Mapa
                    </a>
                  )}
                  {marineUrl && (
                    <a href={marineUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline">
                      <ExternalLink className="h-3 w-3" />
                      Ver no MarineTraffic
                    </a>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground text-sm">Não atribuído</p>
              )}
            </div>

            <div className={`rounded-2xl border p-4 space-y-1 shadow-sm ${etaDays !== null && etaDays <= 3 ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"}`}>
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                <Clock className="h-3.5 w-3.5" />
                Dias para ETA
              </div>
              {etaDays !== null ? (
                <>
                  <p className={`font-bold text-3xl leading-none ${etaDays < 0 ? "text-red-600" : etaDays <= 3 ? "text-amber-600" : "text-blue-600 dark:text-blue-400"}`}>
                    {etaDays < 0 ? `+${Math.abs(etaDays)}` : etaDays}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {etaDays < 0 ? "dias atrasado" : etaDays === 0 ? "chega hoje" : etaDays === 1 ? "dia restante" : "dias restantes"}
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground text-sm">ETA não definido</p>
              )}
            </div>

            <div className={`rounded-2xl border p-4 space-y-1 shadow-sm ${docCompliance ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"}`}>
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                <ShieldCheck className="h-3.5 w-3.5" />
                Conformidade
              </div>
              <div className="flex items-center gap-2">
                {docCompliance ? (
                  <CheckCircle2 className="h-7 w-7 text-emerald-500" />
                ) : (
                  <AlertCircle className="h-7 w-7 text-amber-500" />
                )}
                <div>
                  <p className={`font-bold text-sm ${docCompliance ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`}>
                    {docCompliance ? "Documentação OK" : "Pendências"}
                  </p>
                  <p className="text-xs text-muted-foreground">{docCompliance ? "Todos os documentos verificados" : "Alguns docs em aberto"}</p>
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
                <DocRow
                  icon={FileText}
                  label="Bill of Lading (BL)"
                  value={order.bookingCrt || null}
                  available={!!order.bookingCrt && (order.vesselStatus === "zarpou" || order.vesselStatus === "em_navegacao" || order.vesselStatus === "fundeado")}
                />
                <DocRow
                  icon={ScrollText}
                  label="Fatura Comercial"
                  value={order.invoice}
                  available={!!order.invoice}
                />
                <DocRow
                  icon={Award}
                  label="Certificado de Origem"
                  value={order.dueNumber || null}
                  available={order.vesselStatus === "em_navegacao" || order.vesselStatus === "fundeado"}
                />
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
                  { label: "Quantidade", value: `${order.quantity} toneladas` },
                  { label: "Valor Total", value: formatCurrency(order.total) },
                  { label: "Cond. Pagamento", value: order.paymentTerms || "—" },
                  { label: "NF-e", value: order.nfe || "—" },
                  { label: "DU-E", value: order.dueNumber || "—" },
                  { label: "Fornecedor", value: order.supplier?.name || "—" },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between text-sm py-1 border-b border-slate-100 dark:border-slate-800 last:border-0">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium text-right max-w-[55%] truncate">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {order.embarqueDate && (
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Linha do Tempo Detalhada</p>
              <div className="space-y-2">
                {[
                  { label: "Deadline DRA", date: (order as any).deadlineDra, done: true },
                  { label: "Deadline Carga", date: order.deadlineCarga, done: true },
                  { label: "Embarque", date: order.embarqueDate, done: true },
                  { label: "ETA (Previsão Chegada)", date: order.desembarqueDate, done: order.vesselStatus === "fundeado" },
                ].filter(e => e.date).map(({ label, date, done }) => (
                  <div key={label} className="flex items-center gap-3 text-sm">
                    <div className={`h-2 w-2 rounded-full flex-shrink-0 ${done ? "bg-emerald-500" : "bg-blue-400"}`} />
                    <span className="text-muted-foreground w-44 flex-shrink-0">{label}</span>
                    <span className="font-medium">{new Date(date! + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "short", year: "numeric", month: "short", day: "numeric" })}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TrackingListRow({ order, onClick }: { order: OrderWithDetails; onClick: () => void }) {
  const active = getActiveStep(order.vesselStatus);
  const allDone = order.vesselStatus === "fundeado";
  const etaDays = calcEtaDays(order.desembarqueDate);
  const stepsDone = allDone ? STEPS.length : Math.max(0, active - 1);
  const progressPct = Math.round((stepsDone / STEPS.length) * 100);

  const statusColor = {
    etd: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
    zarpou: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    em_navegacao: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    fundeado: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  }[order.vesselStatus ?? ""] ?? "bg-slate-100 text-slate-600";

  const indicatorColor = {
    etd: "bg-amber-400",
    zarpou: "bg-blue-500",
    em_navegacao: "bg-blue-600",
    fundeado: "bg-emerald-500",
  }[order.vesselStatus ?? ""] ?? "bg-slate-300";

  return (
    <tr
      onClick={onClick}
      className="hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
    >
      <td className={`pl-0 pr-4 py-3`}>
        <div className="flex items-center gap-3">
          <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${indicatorColor}`} />
          <div>
            <p className="font-semibold text-sm">{order.invoice}</p>
            <p className="text-xs text-muted-foreground">{order.product.type} · {order.product.grammage}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <p className="text-sm font-medium">{order.client.name}</p>
        <p className="text-xs text-muted-foreground">{order.client.country}</p>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5 text-sm">
          <Ship className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          <span className="truncate max-w-[140px]">{order.vessel || "—"}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        {order.vesselStatus ? (
          <Badge variant="secondary" className={`text-xs font-semibold whitespace-nowrap ${statusColor}`}>
            {STATUS_LABELS[order.vesselStatus]}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
        {order.embarqueDate
          ? new Date(order.embarqueDate + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
          : "—"}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        {etaDays !== null ? (
          <span className={`text-sm font-semibold ${etaDays < 0 ? "text-red-500" : etaDays <= 5 ? "text-amber-600" : "text-blue-600 dark:text-blue-400"}`}>
            {etaDays < 0 ? `Atrasado ${Math.abs(etaDays)}d` : etaDays === 0 ? "Hoje" : `${etaDays}d`}
          </span>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2 min-w-[80px]">
          <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full ${allDone ? "bg-emerald-500" : "bg-blue-500"}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground w-8 text-right">{progressPct}%</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </td>
    </tr>
  );
}

function TrackingCard({ order, onClick }: { order: OrderWithDetails; onClick: () => void }) {
  const active = getActiveStep(order.vesselStatus);
  const allDone = order.vesselStatus === "fundeado";
  const etaDays = calcEtaDays(order.desembarqueDate);
  const stepsTotal = STEPS.length;
  const stepsDone = allDone ? stepsTotal : Math.max(0, active - 1);
  const progressPct = Math.round((stepsDone / stepsTotal) * 100);

  const statusColor = {
    etd: "border-l-amber-400",
    zarpou: "border-l-blue-500",
    em_navegacao: "border-l-blue-600",
    fundeado: "border-l-emerald-500",
  }[order.vesselStatus ?? ""] ?? "border-l-slate-300";

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-2xl border-l-4 ${statusColor} border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 p-5 space-y-4 group`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-sm">{order.invoice}</p>
            {order.vesselStatus && (
              <Badge variant="secondary" className={`text-[10px] px-2 py-0 font-semibold ${order.vesselStatus === "em_navegacao" ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" : order.vesselStatus === "fundeado" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" : order.vesselStatus === "zarpou" ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" : "bg-slate-100 text-slate-600"}`}>
                {STATUS_LABELS[order.vesselStatus]}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{order.client.name} · {order.client.country}</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 group-hover:text-blue-500 transition-colors mt-0.5" />
      </div>

      <StepperBar order={order} compact />

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Ship className="h-3.5 w-3.5" />
          <span className="truncate max-w-[120px]">{order.vessel || "Sem navio"}</span>
        </div>
        <div className="flex items-center gap-3">
          {etaDays !== null && (
            <span className={`font-semibold ${etaDays < 0 ? "text-red-500" : etaDays <= 5 ? "text-amber-600" : "text-blue-600 dark:text-blue-400"}`}>
              ETA: {etaDays < 0 ? `Atrasado ${Math.abs(etaDays)}d` : etaDays === 0 ? "Hoje" : `${etaDays}d`}
            </span>
          )}
          <span className="text-slate-400">{progressPct}%</span>
        </div>
      </div>

      <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1">
        <div
          className={`h-1 rounded-full transition-all duration-700 ${allDone ? "bg-emerald-500" : "bg-blue-500"}`}
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </button>
  );
}

export default function Rastreabilidade() {
  const [selected, setSelected] = useState<OrderWithDetails | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");

  const { data: orders, isLoading } = useQuery<OrderWithDetails[]>({
    queryKey: ["/api/orders"],
  });

  const tracked = (orders || []).filter((o) => o.modal === "maritimo" && o.vessel);

  const filtered = tracked.filter((o) => {
    if (filterStatus === "all") return true;
    return o.vesselStatus === filterStatus;
  });

  const statusCounts = {
    all: tracked.length,
    etd: tracked.filter((o) => o.vesselStatus === "etd").length,
    zarpou: tracked.filter((o) => o.vesselStatus === "zarpou").length,
    em_navegacao: tracked.filter((o) => o.vesselStatus === "em_navegacao").length,
    fundeado: tracked.filter((o) => o.vesselStatus === "fundeado").length,
  };

  const avgEta = tracked
    .map((o) => calcEtaDays(o.desembarqueDate))
    .filter((d): d is number => d !== null && d >= 0);
  const avgEtaDays = avgEta.length > 0 ? Math.round(avgEta.reduce((a, b) => a + b, 0) / avgEta.length) : null;

  const inNavigation = tracked.filter((o) => o.vesselStatus === "em_navegacao" || o.vesselStatus === "zarpou").length;
  const arrived = tracked.filter((o) => o.vesselStatus === "fundeado").length;

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-blue-950/20">
      <div className="p-6 space-y-6">

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-200 dark:shadow-blue-900">
                <Globe className="h-4 w-4 text-white" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Rastreabilidade Logística</h1>
            </div>
            <p className="text-muted-foreground text-sm mt-1 ml-10">
              Visibilidade em tempo real das cargas em trânsito internacional
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-muted-foreground font-medium">{tracked.length} embarques rastreados</span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Em Navegação", value: inNavigation, icon: Ship, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800" },
            { label: "ETA Médio", value: avgEtaDays !== null ? `${avgEtaDays}d` : "—", icon: Clock, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800" },
            { label: "Chegaram", value: arrived, icon: Anchor, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800" },
            { label: "Total Marítimos", value: tracked.length, icon: Globe, color: "text-slate-600 dark:text-slate-400", bg: "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700" },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <Card key={label} className={`border ${bg} shadow-sm`}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className={`h-10 w-10 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold leading-none">{value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex gap-2 flex-wrap">
            {[
              { key: "all", label: "Todos", count: statusCounts.all },
              { key: "etd", label: "ETD / Porto", count: statusCounts.etd },
              { key: "zarpou", label: "Zarpou", count: statusCounts.zarpou },
              { key: "em_navegacao", label: "Em Navegação", count: statusCounts.em_navegacao },
              { key: "fundeado", label: "Fundeado", count: statusCounts.fundeado },
            ].map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setFilterStatus(key)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all border ${filterStatus === key ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200 dark:shadow-blue-900" : "bg-white dark:bg-slate-800 text-muted-foreground border-slate-200 dark:border-slate-700 hover:border-blue-400"}`}
              >
                {label}
                {count > 0 && (
                  <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${filterStatus === key ? "bg-white/20 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"}`}>
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1 shadow-sm">
            <button
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === "list" ? "bg-blue-600 text-white shadow-sm" : "text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-700"}`}
            >
              <List className="h-4 w-4" />
              Lista
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === "grid" ? "bg-blue-600 text-white shadow-sm" : "text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-700"}`}
            >
              <LayoutGrid className="h-4 w-4" />
              Cards
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Carregando embarques...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
            <Ship className="h-12 w-12 opacity-20" />
            <p className="text-lg font-medium">Nenhum embarque neste filtro</p>
            <p className="text-sm">Ordens marítimas com navio atribuído aparecem aqui</p>
          </div>
        ) : viewMode === "list" ? (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                  <th className="pl-4 pr-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Fatura / Produto</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cliente</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Navio</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Embarque</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">ETA</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Progresso</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {filtered.map((order) => (
                  <TrackingListRow key={order.id} order={order} onClick={() => setSelected(order)} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((order) => (
              <TrackingCard key={order.id} order={order} onClick={() => setSelected(order)} />
            ))}
          </div>
        )}
      </div>

      {selected && (
        <TrackingModal order={selected} open={!!selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
