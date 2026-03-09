import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  FileText, Upload, Download, Eye, Search, Clock,
  CheckCircle2, XCircle, AlertCircle, Loader2, FolderOpen, Archive,
  ShieldCheck, ChevronRight, FileImage, File, Minus,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type DocStatus = "pendente" | "em_analise" | "aprovado" | "rejeitado";
type DocTipo = "commercial_invoice" | "packing_list" | "bill_of_lading";

interface Documento {
  id: number;
  orderId: number;
  tipo: DocTipo;
  status: DocStatus;
  motivoRejeicao?: string | null;
  nomeOriginal: string;
  nomeArquivo: string;
  mimeType: string;
  tamanho: number;
  versao: number;
  isArquivado: boolean;
  uploadedBy: string;
  uploadedByType: string;
  createdAt: string;
}

interface AuditEntry {
  id: number;
  documentoId: number;
  acao: string;
  userName: string;
  userType: string;
  detalhes?: string | null;
  createdAt: string;
}

interface Order {
  id: number;
  invoice: string;
  client?: { name: string };
  product?: { type: string };
  embarqueDate?: string | null;
  parametrizacao?: string;
}

type DocSummary = Record<number, Record<string, string>>;

const TIPO_LABELS: Record<DocTipo, string> = {
  commercial_invoice: "Commercial Invoice",
  packing_list: "Packing List",
  bill_of_lading: "Bill of Lading",
};

const TIPO_SHORT: Record<DocTipo, string> = {
  commercial_invoice: "CI",
  packing_list: "PL",
  bill_of_lading: "B/L",
};

const TIPO_ICONS: Record<DocTipo, React.ReactNode> = {
  commercial_invoice: <FileText className="h-4 w-4" />,
  packing_list: <File className="h-4 w-4" />,
  bill_of_lading: <FileImage className="h-4 w-4" />,
};

const STATUS_CONFIG: Record<DocStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pendente: { label: "Pendente", color: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300", icon: <Clock className="h-3 w-3" /> },
  em_analise: { label: "Em Análise", color: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300", icon: <Loader2 className="h-3 w-3" /> },
  aprovado: { label: "Aprovado", color: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300", icon: <CheckCircle2 className="h-3 w-3" /> },
  rejeitado: { label: "Rejeitado", color: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300", icon: <XCircle className="h-3 w-3" /> },
};

const TIPOS: DocTipo[] = ["commercial_invoice", "packing_list", "bill_of_lading"];

function StatusBadge({ status }: { status: DocStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

function DocStatusCell({ status }: { status: string | undefined }) {
  if (!status) {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground/40">
        <Minus className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (status === "aprovado") return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  if (status === "rejeitado") return <XCircle className="h-4 w-4 text-red-500" />;
  if (status === "em_analise") return <Loader2 className="h-4 w-4 text-blue-500" />;
  return <Clock className="h-4 w-4 text-yellow-500" />;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DropZone({ tipo, onUpload, isUploading }: { tipo: DocTipo; onUpload: (file: File) => void; isUploading: boolean }) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) onUpload(file);
  }, [onUpload]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onUpload(file);
    e.target.value = "";
  };

  return (
    <div
      onClick={() => !isUploading && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`relative border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all ${
        dragOver ? "border-primary bg-primary/5 scale-[1.01]" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"
      } ${isUploading ? "pointer-events-none opacity-60" : ""}`}
    >
      <input ref={inputRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.tiff,.tif" onChange={handleChange} />
      {isUploading ? (
        <div className="flex flex-col items-center gap-1.5 py-1">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground">Enviando...</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1.5 py-1">
          <Upload className="h-6 w-6 text-muted-foreground/60" />
          <p className="text-xs font-medium">Arraste ou clique para enviar</p>
          <p className="text-[11px] text-muted-foreground">PDF, JPG, PNG, TIFF · máx. 20 MB</p>
        </div>
      )}
    </div>
  );
}

function DocCard({
  tipo, docs, archivedDocs, orderId, onUpload, onStatusChange, uploadingTipo,
}: {
  tipo: DocTipo;
  docs: Documento[];
  archivedDocs: Documento[];
  orderId: number;
  onUpload: (tipo: DocTipo, file: File) => void;
  onStatusChange: (doc: Documento, status: DocStatus, motivo?: string) => void;
  uploadingTipo: DocTipo | null;
}) {
  const [showAudit, setShowAudit] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  const active = docs.find(d => d.tipo === tipo && !d.isArquivado);
  const archived = archivedDocs.filter(d => d.tipo === tipo && d.isArquivado);
  const isUploading = uploadingTipo === tipo;

  const { data: auditLog } = useQuery<AuditEntry[]>({
    queryKey: [`/api/documentos/${active?.id}/auditoria`],
    enabled: showAudit && !!active,
  });

  const fileUrl = active ? `/api/documentos/${active.id}/arquivo?acao=visualizou&userName=Gestor&userType=manager` : "";
  const downloadUrl = active ? `/api/documentos/${active.id}/arquivo?acao=baixou&userName=Gestor&userType=manager` : "";

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-muted/30 border-b">
        <span className="text-primary">{TIPO_ICONS[tipo]}</span>
        <span className="font-semibold text-sm">{TIPO_LABELS[tipo]}</span>
        {active && <StatusBadge status={active.status} />}
        {!active && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
            <AlertCircle className="h-3.5 w-3.5 text-yellow-500" />
            Não anexado
          </span>
        )}
        {active && active.versao > 1 && (
          <span className="ml-auto text-xs text-muted-foreground">v{active.versao}</span>
        )}
      </div>

      <div className="p-4 space-y-3">
        {active ? (
          <>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/20 border">
              <FileText className="h-8 w-8 text-primary/60 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{active.nomeOriginal}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {formatBytes(active.tamanho)} · {format(new Date(active.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })} · por {active.uploadedBy}
                </p>
                {active.status === "rejeitado" && active.motivoRejeicao && (
                  <p className="text-[11px] text-red-600 mt-1 bg-red-50 dark:bg-red-950/30 rounded px-2 py-1">
                    Motivo: {active.motivoRejeicao}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {active.mimeType === "application/pdf" && (
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setShowPreview(true)} data-testid={`button-preview-${tipo}`}>
                  <Eye className="h-3 w-3" /> Visualizar
                </Button>
              )}
              <a href={downloadUrl} download={active.nomeOriginal} target="_blank" rel="noreferrer">
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                  <Download className="h-3 w-3" /> Baixar
                </Button>
              </a>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setShowAudit(!showAudit)}>
                <ShieldCheck className="h-3 w-3" /> Auditoria
              </Button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(["pendente", "em_analise", "aprovado", "rejeitado"] as DocStatus[]).map(s => {
                if (s === active.status) return null;
                if (s === "rejeitado") return (
                  <Button key={s} size="sm" variant="ghost" className="h-6 text-[11px] text-red-600 hover:bg-red-50 gap-1 px-2"
                    onClick={() => setShowRejectModal(true)}>
                    <XCircle className="h-3 w-3" /> Rejeitar
                  </Button>
                );
                return (
                  <Button key={s} size="sm" variant="ghost" className="h-6 text-[11px] gap-1 px-2"
                    onClick={() => onStatusChange(active, s)}>
                    {STATUS_CONFIG[s].icon} {STATUS_CONFIG[s].label}
                  </Button>
                );
              })}
            </div>

            {showAudit && auditLog && (
              <div className="border rounded-lg overflow-hidden mt-1">
                <div className="px-3 py-2 bg-muted/40 border-b flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold">Log de Auditoria</span>
                </div>
                <div className="divide-y max-h-40 overflow-y-auto">
                  {auditLog.length === 0 ? (
                    <p className="text-xs text-muted-foreground px-3 py-2">Nenhum registro</p>
                  ) : auditLog.map(entry => (
                    <div key={entry.id} className="px-3 py-2 flex items-start gap-2">
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        {format(new Date(entry.createdAt), "dd/MM HH:mm", { locale: ptBR })}
                      </span>
                      <span className="text-[11px]">
                        <span className="font-medium">{entry.userName}</span> {entry.acao}
                        {entry.detalhes && <span className="text-muted-foreground"> · {entry.detalhes}</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {archived.length > 0 && (
              <button className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowArchived(!showArchived)}>
                <Archive className="h-3 w-3" />
                {archived.length} versão(ões) anterior(es)
                <ChevronRight className={`h-3 w-3 transition-transform ${showArchived ? "rotate-90" : ""}`} />
              </button>
            )}

            {showArchived && archived.map(d => (
              <div key={d.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/10 border border-dashed opacity-70">
                <Archive className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium truncate">{d.nomeOriginal} <span className="text-muted-foreground">v{d.versao}</span></p>
                  <p className="text-[10px] text-muted-foreground">{format(new Date(d.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                </div>
              </div>
            ))}

            <Separator />
            <p className="text-[11px] text-muted-foreground">Substituir documento:</p>
          </>
        ) : null}

        <DropZone tipo={tipo} onUpload={(file) => onUpload(tipo, file)} isUploading={isUploading} />
      </div>

      {showRejectModal && active && (
        <Dialog open onOpenChange={() => setShowRejectModal(false)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Rejeitar Documento</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{active.nomeOriginal}</p>
              <Textarea
                placeholder="Motivo da rejeição..."
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                rows={3}
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setShowRejectModal(false)}>Cancelar</Button>
                <Button variant="destructive" size="sm" onClick={() => {
                  onStatusChange(active, "rejeitado", rejectReason);
                  setShowRejectModal(false);
                  setRejectReason("");
                }}>
                  Confirmar Rejeição
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {showPreview && active && (
        <Dialog open onOpenChange={() => setShowPreview(false)}>
          <DialogContent className="max-w-4xl h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-4 w-4" /> {active.nomeOriginal}
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 min-h-0 rounded-lg overflow-hidden border">
              <iframe src={fileUrl} className="w-full h-full" title={active.nomeOriginal} />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function OrderDocsDialog({
  order,
  open,
  onOpenChange,
}: {
  order: Order;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [uploadingTipo, setUploadingTipo] = useState<DocTipo | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: docs = [], isLoading: docsLoading } = useQuery<Documento[]>({
    queryKey: ["/api/documentos", order.id],
    queryFn: () => apiRequest("GET", `/api/documentos?orderId=${order.id}&includeArchived=true`).then(r => r.json()),
    enabled: open,
  });

  const activeDocs = docs.filter(d => !d.isArquivado);
  const archivedDocs = docs.filter(d => d.isArquivado);

  const statusMutation = useMutation({
    mutationFn: ({ id, status, motivoRejeicao }: { id: number; status: string; motivoRejeicao?: string }) =>
      apiRequest("PATCH", `/api/documentos/${id}/status`, { status, motivoRejeicao, userName: "Gestor", userType: "manager" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documentos", order.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/documentos/summary"] });
      toast({ title: "Status atualizado" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const handleUpload = async (tipo: DocTipo, file: File) => {
    setUploadingTipo(tipo);
    try {
      const formData = new FormData();
      formData.append("arquivo", file);
      formData.append("orderId", String(order.id));
      formData.append("tipo", tipo);
      formData.append("uploadedBy", "Gestor");
      formData.append("uploadedByType", "manager");
      const res = await fetch("/api/documentos/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Erro ao enviar");
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/documentos", order.id] });
      await queryClient.invalidateQueries({ queryKey: ["/api/documentos/summary"] });
      toast({ title: "Documento enviado", description: `${TIPO_LABELS[tipo]} — ${file.name}` });
    } catch (e: any) {
      toast({ title: "Erro no upload", description: e.message, variant: "destructive" });
    } finally {
      setUploadingTipo(null);
    }
  };

  const paramColor = order.parametrizacao === "verde"
    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
    : order.parametrizacao === "amarelo"
    ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";

  const attachedCount = activeDocs.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <FolderOpen className="h-5 w-5 text-primary" />
            {order.invoice}
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${paramColor}`}>
              {order.parametrizacao}
            </span>
            <span className="ml-auto text-sm font-normal text-muted-foreground">
              {attachedCount}/3 documentos anexados
            </span>
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {order.client?.name}
            {order.product?.type && ` · ${order.product.type}`}
            {order.embarqueDate && ` · Embarque: ${format(new Date(order.embarqueDate), "dd/MM/yyyy", { locale: ptBR })}`}
          </p>
        </DialogHeader>

        {docsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
            {TIPOS.map(tipo => (
              <DocCard
                key={tipo}
                tipo={tipo}
                docs={activeDocs}
                archivedDocs={archivedDocs}
                orderId={order.id}
                onUpload={handleUpload}
                onStatusChange={(doc, status, motivo) => statusMutation.mutate({ id: doc.id, status, motivoRejeicao: motivo })}
                uploadingTipo={uploadingTipo}
              />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function Documentos() {
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "completo" | "parcial" | "vazio">("all");

  const { data: orders = [], isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  const { data: summary = {} } = useQuery<DocSummary>({
    queryKey: ["/api/documentos/summary"],
    queryFn: () => fetch("/api/documentos/summary").then(r => r.json()),
  });

  const filtered = orders.filter(o => {
    const matchSearch = !search
      || o.invoice?.toLowerCase().includes(search.toLowerCase())
      || o.client?.name?.toLowerCase().includes(search.toLowerCase());

    const orderDocs = summary[o.id] ?? {};
    const count = Object.keys(orderDocs).length;
    const matchStatus =
      filterStatus === "all" ? true :
      filterStatus === "completo" ? count === 3 :
      filterStatus === "parcial" ? count > 0 && count < 3 :
      count === 0;

    return matchSearch && matchStatus;
  });

  const totalCompletos = orders.filter(o => Object.keys(summary[o.id] ?? {}).length === 3).length;
  const totalParciais = orders.filter(o => { const c = Object.keys(summary[o.id] ?? {}).length; return c > 0 && c < 3; }).length;
  const totalVazios = orders.filter(o => Object.keys(summary[o.id] ?? {}).length === 0).length;

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-documentos-title">
          <FolderOpen className="h-6 w-6 text-primary" />
          Documentação Cambial
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Repositório de documentos de exportação — Commercial Invoice, Packing List e Bill of Lading
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 max-w-lg">
        <button
          onClick={() => setFilterStatus(filterStatus === "completo" ? "all" : "completo")}
          className={`rounded-lg border p-3 text-left transition-colors ${filterStatus === "completo" ? "border-green-500 bg-green-50 dark:bg-green-950/30" : "hover:bg-muted/40"}`}
          data-testid="filter-completo"
        >
          <p className="text-2xl font-bold text-green-600">{totalCompletos}</p>
          <p className="text-xs text-muted-foreground">Completos</p>
        </button>
        <button
          onClick={() => setFilterStatus(filterStatus === "parcial" ? "all" : "parcial")}
          className={`rounded-lg border p-3 text-left transition-colors ${filterStatus === "parcial" ? "border-yellow-500 bg-yellow-50 dark:bg-yellow-950/30" : "hover:bg-muted/40"}`}
          data-testid="filter-parcial"
        >
          <p className="text-2xl font-bold text-yellow-600">{totalParciais}</p>
          <p className="text-xs text-muted-foreground">Parciais</p>
        </button>
        <button
          onClick={() => setFilterStatus(filterStatus === "vazio" ? "all" : "vazio")}
          className={`rounded-lg border p-3 text-left transition-colors ${filterStatus === "vazio" ? "border-red-400 bg-red-50 dark:bg-red-950/30" : "hover:bg-muted/40"}`}
          data-testid="filter-vazio"
        >
          <p className="text-2xl font-bold text-muted-foreground">{totalVazios}</p>
          <p className="text-xs text-muted-foreground">Sem docs</p>
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por processo ou cliente..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
          data-testid="input-search-documentos"
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Processo</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead>Embarque</TableHead>
              <TableHead className="text-center">CI</TableHead>
              <TableHead className="text-center">PL</TableHead>
              <TableHead className="text-center">B/L</TableHead>
              <TableHead className="text-center">Docs</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ordersLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 9 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                  <FolderOpen className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  Nenhum processo encontrado
                </TableCell>
              </TableRow>
            ) : filtered.map(order => {
              const orderDocs = summary[order.id] ?? {};
              const count = Object.keys(orderDocs).length;
              const isComplete = count === 3;
              const paramDot = order.parametrizacao === "verde"
                ? "bg-green-500"
                : order.parametrizacao === "amarelo"
                ? "bg-yellow-500"
                : "bg-red-500";

              return (
                <TableRow key={order.id} data-testid={`row-order-${order.id}`} className="hover:bg-muted/30">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${paramDot}`} />
                      <span className="font-mono text-sm font-semibold">{order.invoice}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{order.client?.name ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{order.product?.type ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {order.embarqueDate
                      ? format(new Date(order.embarqueDate), "dd/MM/yyyy", { locale: ptBR })
                      : "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center">
                      <DocStatusCell status={orderDocs["commercial_invoice"]} />
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center">
                      <DocStatusCell status={orderDocs["packing_list"]} />
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center">
                      <DocStatusCell status={orderDocs["bill_of_lading"]} />
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant={isComplete ? "default" : count > 0 ? "secondary" : "outline"}
                      className={`text-xs ${isComplete ? "bg-green-500 hover:bg-green-500" : ""}`}
                      data-testid={`badge-docs-${order.id}`}
                    >
                      {count}/3
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 h-7 text-xs"
                      onClick={() => setSelectedOrder(order)}
                      data-testid={`button-view-docs-${order.id}`}
                    >
                      <Eye className="h-3 w-3" />
                      Ver documentos
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {selectedOrder && (
        <OrderDocsDialog
          order={selectedOrder}
          open={!!selectedOrder}
          onOpenChange={(v) => { if (!v) setSelectedOrder(null); }}
        />
      )}
    </div>
  );
}
