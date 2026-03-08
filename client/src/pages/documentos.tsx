import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
  FileText, Upload, Download, Eye, ChevronRight, Search, Clock,
  CheckCircle2, XCircle, AlertCircle, Loader2, FolderOpen, Archive,
  ShieldCheck, RotateCcw, FileImage, File,
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
  vesselStatus?: string | null;
  parametrizacao?: string;
}

const TIPO_LABELS: Record<DocTipo, string> = {
  commercial_invoice: "Commercial Invoice",
  packing_list: "Packing List",
  bill_of_lading: "Bill of Lading (B/L)",
};

const TIPO_ICONS: Record<DocTipo, React.ReactNode> = {
  commercial_invoice: <FileText className="h-4 w-4" />,
  packing_list: <File className="h-4 w-4" />,
  bill_of_lading: <FileImage className="h-4 w-4" />,
};

const STATUS_CONFIG: Record<DocStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pendente: { label: "Pendente", color: "bg-yellow-100 text-yellow-800 border-yellow-200", icon: <Clock className="h-3 w-3" /> },
  em_analise: { label: "Em Análise", color: "bg-blue-100 text-blue-800 border-blue-200", icon: <Loader2 className="h-3 w-3" /> },
  aprovado: { label: "Aprovado", color: "bg-green-100 text-green-800 border-green-200", icon: <CheckCircle2 className="h-3 w-3" /> },
  rejeitado: { label: "Rejeitado", color: "bg-red-100 text-red-800 border-red-200", icon: <XCircle className="h-3 w-3" /> },
};

function StatusBadge({ status }: { status: DocStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
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
                  <p className="text-[11px] text-red-600 mt-1 bg-red-50 rounded px-2 py-1">
                    Motivo: {active.motivoRejeicao}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {active.mimeType === "application/pdf" && (
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setShowPreview(true)}>
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
        ) : (
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <AlertCircle className="h-4 w-4 text-yellow-500" />
            <span className="text-xs">Nenhum documento enviado</span>
          </div>
        )}

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
              <iframe
                src={fileUrl}
                className="w-full h-full"
                title={active.nomeOriginal}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export default function Documentos() {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [search, setSearch] = useState("");
  const [uploadingTipo, setUploadingTipo] = useState<DocTipo | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: orders = [], isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  const { data: docs = [], isLoading: docsLoading } = useQuery<Documento[]>({
    queryKey: ["/api/documentos", selectedOrder?.id],
    queryFn: () => apiRequest("GET", `/api/documentos?orderId=${selectedOrder!.id}&includeArchived=true`).then(r => r.json()),
    enabled: !!selectedOrder,
  });

  const activeDocs = docs.filter(d => !d.isArquivado);
  const archivedDocs = docs.filter(d => d.isArquivado);

  const statusMutation = useMutation({
    mutationFn: ({ id, status, motivoRejeicao }: { id: number; status: string; motivoRejeicao?: string }) =>
      apiRequest("PATCH", `/api/documentos/${id}/status`, { status, motivoRejeicao, userName: "Gestor", userType: "manager" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documentos", selectedOrder?.id] });
      toast({ title: "Status atualizado" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const handleUpload = async (tipo: DocTipo, file: File) => {
    if (!selectedOrder) return;
    setUploadingTipo(tipo);
    try {
      const formData = new FormData();
      formData.append("arquivo", file);
      formData.append("orderId", String(selectedOrder.id));
      formData.append("tipo", tipo);
      formData.append("uploadedBy", "Gestor");
      formData.append("uploadedByType", "manager");

      const res = await fetch("/api/documentos/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Erro ao enviar");
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/documentos", selectedOrder.id] });
      toast({ title: "Documento enviado com sucesso", description: `${TIPO_LABELS[tipo]} — ${file.name}` });
    } catch (e: any) {
      toast({ title: "Erro no upload", description: e.message, variant: "destructive" });
    } finally {
      setUploadingTipo(null);
    }
  };

  const handleStatusChange = (doc: Documento, status: DocStatus, motivo?: string) => {
    statusMutation.mutate({ id: doc.id, status, motivoRejeicao: motivo });
  };

  const filtered = orders.filter(o =>
    o.invoice?.toLowerCase().includes(search.toLowerCase()) ||
    o.client?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const getOrderDocStatus = (orderId: number) => {
    const orderDocs = docs;
    const tiposComDoc = new Set(activeDocs.filter(d => d.orderId === orderId).map(d => d.tipo));
    return tiposComDoc.size;
  };

  const TIPOS: DocTipo[] = ["commercial_invoice", "packing_list", "bill_of_lading"];

  return (
    <div className="flex h-full">
      <div className="w-80 shrink-0 border-r flex flex-col">
        <div className="p-4 border-b">
          <h1 className="text-lg font-bold flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-primary" />
            Repositório Cambial
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Documentação de exportação</p>
        </div>
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar processo..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {ordersLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum processo encontrado</p>
          ) : filtered.map(order => {
            const isSelected = selectedOrder?.id === order.id;
            const paramColor = order.parametrizacao === "verde" ? "bg-green-500" : order.parametrizacao === "amarelo" ? "bg-yellow-500" : "bg-red-500";
            return (
              <button
                key={order.id}
                onClick={() => setSelectedOrder(order)}
                className={`w-full text-left px-4 py-3 border-b hover:bg-muted/40 transition-colors flex items-start gap-3 ${isSelected ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}
              >
                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${paramColor}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{order.invoice}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{order.client?.name}</p>
                  {order.embarqueDate && (
                    <p className="text-[10px] text-muted-foreground">
                      {format(new Date(order.embarqueDate), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  )}
                </div>
                <ChevronRight className={`h-4 w-4 text-muted-foreground shrink-0 mt-0.5 ${isSelected ? "text-primary" : ""}`} />
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {!selectedOrder ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <FolderOpen className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <h2 className="text-lg font-semibold text-muted-foreground">Selecione um processo</h2>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Escolha um processo na lista à esquerda para gerenciar os documentos cambiais.
            </p>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold">{selectedOrder.invoice}</h2>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    selectedOrder.parametrizacao === "verde" ? "bg-green-100 text-green-700" :
                    selectedOrder.parametrizacao === "amarelo" ? "bg-yellow-100 text-yellow-700" :
                    "bg-red-100 text-red-700"
                  }`}>
                    {selectedOrder.parametrizacao?.charAt(0).toUpperCase() + selectedOrder.parametrizacao?.slice(1)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {selectedOrder.client?.name} · {selectedOrder.product?.type}
                  {selectedOrder.embarqueDate && ` · Embarque: ${format(new Date(selectedOrder.embarqueDate), "dd/MM/yyyy", { locale: ptBR })}`}
                </p>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <div className="flex gap-0.5">
                    {TIPOS.map(tipo => {
                      const has = activeDocs.some(d => d.tipo === tipo);
                      const doc = activeDocs.find(d => d.tipo === tipo);
                      const color = !has ? "bg-gray-200" : doc?.status === "aprovado" ? "bg-green-500" : doc?.status === "rejeitado" ? "bg-red-500" : doc?.status === "em_analise" ? "bg-blue-500" : "bg-yellow-500";
                      return <div key={tipo} className={`w-3 h-3 rounded-sm ${color}`} title={TIPO_LABELS[tipo]} />;
                    })}
                  </div>
                  {activeDocs.length}/3 documentos
                </span>
              </div>
            </div>

            {docsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {TIPOS.map(tipo => (
                  <DocCard
                    key={tipo}
                    tipo={tipo}
                    docs={activeDocs}
                    archivedDocs={archivedDocs}
                    orderId={selectedOrder.id}
                    onUpload={handleUpload}
                    onStatusChange={handleStatusChange}
                    uploadingTipo={uploadingTipo}
                  />
                ))}
              </div>
            )}

            {activeDocs.length > 0 && (
              <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 bg-muted/30 border-b">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm">Resumo dos Documentos</span>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs">Tipo</TableHead>
                      <TableHead className="text-xs">Arquivo</TableHead>
                      <TableHead className="text-xs">Versão</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Enviado por</TableHead>
                      <TableHead className="text-xs">Data</TableHead>
                      <TableHead className="text-xs">Tamanho</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeDocs.map(doc => (
                      <TableRow key={doc.id} className="text-xs">
                        <TableCell className="font-medium">{TIPO_LABELS[doc.tipo]}</TableCell>
                        <TableCell className="max-w-[160px] truncate">{doc.nomeOriginal}</TableCell>
                        <TableCell>v{doc.versao}</TableCell>
                        <TableCell><StatusBadge status={doc.status} /></TableCell>
                        <TableCell>{doc.uploadedBy}</TableCell>
                        <TableCell>{format(new Date(doc.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}</TableCell>
                        <TableCell>{formatBytes(doc.tamanho)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
