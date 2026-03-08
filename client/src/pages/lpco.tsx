import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import {
  Plus, Search, Filter, Eye, Pencil, Trash2, Upload, Download, FileText,
  CheckCircle2, Clock, XCircle, AlertTriangle, ShieldCheck, Calendar,
  Building2, Tag, RefreshCw, ChevronDown, X,
} from "lucide-react";
import { format, differenceInDays, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";

type LpcoTipo = "licenca" | "permissao" | "certificado" | "outro";
type LpcoOrgao = "MAPA" | "ANVISA" | "INMETRO" | "RECEITA_FEDERAL" | "IBAMA" | "SECEX" | "MDIC" | "outro";
type LpcoStatus = "ativo" | "pendente" | "vencido" | "suspenso";

interface LpcoItem {
  id: number;
  tipo: LpcoTipo;
  orgao: LpcoOrgao;
  numero: string;
  descricao: string;
  status: LpcoStatus;
  dataEmissao?: string | null;
  dataValidade?: string | null;
  orderId?: number | null;
  clientId?: number | null;
  observacoes?: string | null;
  responsavel?: string | null;
  nomeArquivo?: string | null;
  nomeOriginal?: string | null;
  mimeType?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Order {
  id: number;
  invoice: string;
  client?: { name: string };
}

const TIPO_LABELS: Record<LpcoTipo, string> = {
  licenca: "Licença",
  permissao: "Permissão",
  certificado: "Certificado",
  outro: "Outro",
};

const TIPO_COLORS: Record<LpcoTipo, string> = {
  licenca: "bg-purple-100 text-purple-800 border-purple-200",
  permissao: "bg-blue-100 text-blue-800 border-blue-200",
  certificado: "bg-teal-100 text-teal-800 border-teal-200",
  outro: "bg-gray-100 text-gray-700 border-gray-200",
};

const ORGAO_LABELS: Record<LpcoOrgao, string> = {
  MAPA: "MAPA",
  ANVISA: "ANVISA",
  INMETRO: "INMETRO",
  RECEITA_FEDERAL: "Receita Federal",
  IBAMA: "IBAMA",
  SECEX: "SECEX",
  MDIC: "MDIC",
  outro: "Outro",
};

const ORGAO_COLORS: Record<LpcoOrgao, string> = {
  MAPA: "bg-green-600",
  ANVISA: "bg-red-600",
  INMETRO: "bg-blue-600",
  RECEITA_FEDERAL: "bg-amber-600",
  IBAMA: "bg-emerald-600",
  SECEX: "bg-indigo-600",
  MDIC: "bg-violet-600",
  outro: "bg-gray-500",
};

const STATUS_CONFIG: Record<LpcoStatus, { label: string; color: string; icon: React.ReactNode }> = {
  ativo: { label: "Ativo", color: "bg-green-100 text-green-800 border-green-200", icon: <CheckCircle2 className="h-3 w-3" /> },
  pendente: { label: "Pendente", color: "bg-yellow-100 text-yellow-800 border-yellow-200", icon: <Clock className="h-3 w-3" /> },
  vencido: { label: "Vencido", color: "bg-red-100 text-red-800 border-red-200", icon: <XCircle className="h-3 w-3" /> },
  suspenso: { label: "Suspenso", color: "bg-orange-100 text-orange-800 border-orange-200", icon: <AlertTriangle className="h-3 w-3" /> },
};

function getExpiryInfo(dataValidade?: string | null): { days: number | null; color: string; label: string } {
  if (!dataValidade) return { days: null, color: "text-muted-foreground", label: "—" };
  const date = parseISO(dataValidade);
  if (!isValid(date)) return { days: null, color: "text-muted-foreground", label: "—" };
  const days = differenceInDays(date, new Date());
  if (days < 0) return { days, color: "text-red-600 font-semibold", label: `Vencido há ${Math.abs(days)}d` };
  if (days <= 30) return { days, color: "text-orange-600 font-semibold", label: `Vence em ${days}d` };
  if (days <= 90) return { days, color: "text-yellow-600", label: `${days}d restantes` };
  return { days, color: "text-green-700", label: format(date, "dd/MM/yyyy", { locale: ptBR }) };
}

const EMPTY_FORM = {
  tipo: "" as LpcoTipo | "",
  orgao: "" as LpcoOrgao | "",
  numero: "",
  descricao: "",
  status: "pendente" as LpcoStatus,
  dataEmissao: "",
  dataValidade: "",
  orderId: "",
  observacoes: "",
  responsavel: "",
};

function LpcoForm({
  initial,
  orders,
  onSubmit,
  onClose,
  isLoading,
}: {
  initial?: Partial<typeof EMPTY_FORM & { id: number }>;
  orders: Order[];
  onSubmit: (data: FormData) => void;
  onClose: () => void;
  isLoading: boolean;
}) {
  const [form, setForm] = useState({ ...EMPTY_FORM, ...initial });
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.tipo || !form.orgao || !form.numero || !form.descricao) return;
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") fd.append(k, String(v)); });
    if (file) fd.append("arquivo", file);
    onSubmit(fd);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Tipo *</Label>
          <Select value={form.tipo} onValueChange={v => set("tipo", v)}>
            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
            <SelectContent>
              {(Object.keys(TIPO_LABELS) as LpcoTipo[]).map(t => (
                <SelectItem key={t} value={t}>{TIPO_LABELS[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Órgão Anuente *</Label>
          <Select value={form.orgao} onValueChange={v => set("orgao", v)}>
            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
            <SelectContent>
              {(Object.keys(ORGAO_LABELS) as LpcoOrgao[]).map(o => (
                <SelectItem key={o} value={o}>{ORGAO_LABELS[o]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Número / Referência *</Label>
          <Input className="h-8 text-sm" value={form.numero} onChange={e => set("numero", e.target.value)} placeholder="Ex: MAPA-2026-00123" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Status</Label>
          <Select value={form.status} onValueChange={v => set("status", v)}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(STATUS_CONFIG) as LpcoStatus[]).map(s => (
                <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Descrição *</Label>
        <Input className="h-8 text-sm" value={form.descricao} onChange={e => set("descricao", e.target.value)} placeholder="Ex: Certificado Fitossanitário — Papel Kraft 80g/m²" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Data de Emissão</Label>
          <Input type="date" className="h-8 text-sm" value={form.dataEmissao} onChange={e => set("dataEmissao", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Data de Validade</Label>
          <Input type="date" className="h-8 text-sm" value={form.dataValidade} onChange={e => set("dataValidade", e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Processo vinculado</Label>
          <Select value={form.orderId || "none"} onValueChange={v => set("orderId", v === "none" ? "" : v)}>
            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Nenhum" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum</SelectItem>
              {orders.map(o => (
                <SelectItem key={o.id} value={String(o.id)}>{o.invoice} — {o.client?.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Responsável</Label>
          <Input className="h-8 text-sm" value={form.responsavel} onChange={e => set("responsavel", e.target.value)} placeholder="Nome do responsável" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Observações</Label>
        <Textarea className="text-sm resize-none" rows={2} value={form.observacoes} onChange={e => set("observacoes", e.target.value)} placeholder="Condições especiais, restrições, notas..." />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Arquivo (PDF ou imagem)</Label>
        <div
          onClick={() => fileRef.current?.click()}
          className="border border-dashed rounded-lg px-4 py-3 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition-colors"
        >
          <input ref={fileRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.tiff" onChange={e => setFile(e.target.files?.[0] || null)} />
          {file ? (
            <div className="flex items-center justify-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-primary" />
              <span className="truncate max-w-[200px]">{file.name}</span>
              <button type="button" onClick={e => { e.stopPropagation(); setFile(null); }}>
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Upload className="h-4 w-4" />
              Clique para anexar o documento
            </div>
          )}
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
        <Button type="submit" size="sm" disabled={isLoading || !form.tipo || !form.orgao || !form.numero || !form.descricao}>
          {isLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
          {initial?.id ? "Salvar Alterações" : "Cadastrar LPCO"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export default function Lpco() {
  const [search, setSearch] = useState("");
  const [filterOrgao, setFilterOrgao] = useState<string>("todos");
  const [filterTipo, setFilterTipo] = useState<string>("todos");
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<LpcoItem | null>(null);
  const [detailItem, setDetailItem] = useState<LpcoItem | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery<LpcoItem[]>({
    queryKey: ["/api/lpco"],
  });

  const { data: orders = [] } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  const createMutation = useMutation({
    mutationFn: (fd: FormData) => fetch("/api/lpco", { method: "POST", body: fd }).then(async r => {
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lpco"] });
      setShowModal(false);
      toast({ title: "LPCO cadastrado com sucesso" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, fd }: { id: number; fd: FormData }) =>
      fetch(`/api/lpco/${id}`, { method: "PATCH", body: fd }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).message);
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lpco"] });
      setEditItem(null);
      toast({ title: "LPCO atualizado" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/lpco/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lpco"] });
      setDeleteId(null);
      toast({ title: "LPCO removido" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const filtered = items.filter(item => {
    const matchSearch =
      item.numero.toLowerCase().includes(search.toLowerCase()) ||
      item.descricao.toLowerCase().includes(search.toLowerCase()) ||
      (item.responsavel?.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchOrgao = filterOrgao === "todos" || item.orgao === filterOrgao;
    const matchTipo = filterTipo === "todos" || item.tipo === filterTipo;
    const matchStatus = filterStatus === "todos" || item.status === filterStatus;
    return matchSearch && matchOrgao && matchTipo && matchStatus;
  });

  const stats = {
    total: items.length,
    ativos: items.filter(i => i.status === "ativo").length,
    vencendo: items.filter(i => {
      if (!i.dataValidade) return false;
      const d = differenceInDays(parseISO(i.dataValidade), new Date());
      return d >= 0 && d <= 30;
    }).length,
    vencidos: items.filter(i => {
      if (!i.dataValidade) return false;
      return differenceInDays(parseISO(i.dataValidade), new Date()) < 0;
    }).length,
    pendentes: items.filter(i => i.status === "pendente").length,
  };

  const getOrderLabel = (orderId?: number | null) => {
    if (!orderId) return "—";
    const order = orders.find(o => o.id === orderId);
    return order ? order.invoice : `#${orderId}`;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2.5">
            <ShieldCheck className="h-6 w-6 text-primary" />
            Gestão de LPCO
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Licenças, Permissões, Certificados e Outros — Controle de Anuências
          </p>
        </div>
        <Button onClick={() => setShowModal(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo LPCO
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: "Total", value: stats.total, color: "bg-muted/50", textColor: "text-foreground" },
          { label: "Ativos", value: stats.ativos, color: "bg-green-50 border border-green-200", textColor: "text-green-700" },
          { label: "Vencendo (30d)", value: stats.vencendo, color: "bg-orange-50 border border-orange-200", textColor: "text-orange-700" },
          { label: "Vencidos", value: stats.vencidos, color: "bg-red-50 border border-red-200", textColor: "text-red-700" },
          { label: "Pendentes", value: stats.pendentes, color: "bg-yellow-50 border border-yellow-200", textColor: "text-yellow-700" },
        ].map(card => (
          <div key={card.label} className={`rounded-xl p-4 ${card.color}`}>
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className={`text-3xl font-bold mt-0.5 ${card.textColor}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Buscar por número, descrição..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
        </div>

        <Select value={filterOrgao} onValueChange={setFilterOrgao}>
          <SelectTrigger className="h-8 text-sm w-[150px]"><Building2 className="h-3.5 w-3.5 mr-1 text-muted-foreground" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Órgãos</SelectItem>
            {(Object.keys(ORGAO_LABELS) as LpcoOrgao[]).map(o => (
              <SelectItem key={o} value={o}>{ORGAO_LABELS[o]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterTipo} onValueChange={setFilterTipo}>
          <SelectTrigger className="h-8 text-sm w-[140px]"><Tag className="h-3.5 w-3.5 mr-1 text-muted-foreground" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Tipos</SelectItem>
            {(Object.keys(TIPO_LABELS) as LpcoTipo[]).map(t => (
              <SelectItem key={t} value={t}>{TIPO_LABELS[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 text-sm w-[130px]"><Filter className="h-3.5 w-3.5 mr-1 text-muted-foreground" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos Status</SelectItem>
            {(Object.keys(STATUS_CONFIG) as LpcoStatus[]).map(s => (
              <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(filterOrgao !== "todos" || filterTipo !== "todos" || filterStatus !== "todos" || search) && (
          <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={() => { setSearch(""); setFilterOrgao("todos"); setFilterTipo("todos"); setFilterStatus("todos"); }}>
            <X className="h-3.5 w-3.5" /> Limpar filtros
          </Button>
        )}

        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} registro(s)</span>
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent bg-muted/30">
              <TableHead className="text-xs font-semibold">Tipo</TableHead>
              <TableHead className="text-xs font-semibold">Órgão</TableHead>
              <TableHead className="text-xs font-semibold">Número</TableHead>
              <TableHead className="text-xs font-semibold">Descrição</TableHead>
              <TableHead className="text-xs font-semibold">Processo</TableHead>
              <TableHead className="text-xs font-semibold">Status</TableHead>
              <TableHead className="text-xs font-semibold">Validade</TableHead>
              <TableHead className="text-xs font-semibold">Responsável</TableHead>
              <TableHead className="text-xs font-semibold text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-10 text-muted-foreground text-sm">
                  <RefreshCw className="h-4 w-4 animate-spin inline mr-2" />Carregando...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12">
                  <ShieldCheck className="h-10 w-10 text-muted-foreground/20 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {items.length === 0 ? 'Nenhum LPCO cadastrado. Clique em "Novo LPCO" para começar.' : "Nenhum registro encontrado com os filtros aplicados."}
                  </p>
                </TableCell>
              </TableRow>
            ) : filtered.map(item => {
              const expiry = getExpiryInfo(item.dataValidade);
              const isExpiringSoon = expiry.days !== null && expiry.days >= 0 && expiry.days <= 30;
              const isExpired = expiry.days !== null && expiry.days < 0;
              return (
                <TableRow key={item.id} className={`cursor-pointer hover:bg-muted/30 transition-colors text-sm ${isExpired ? "bg-red-50/40 hover:bg-red-50/60" : isExpiringSoon ? "bg-orange-50/40 hover:bg-orange-50/60" : ""}`}
                  onClick={() => setDetailItem(item)}>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${TIPO_COLORS[item.tipo]}`}>
                      {TIPO_LABELS[item.tipo]}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold text-white ${ORGAO_COLORS[item.orgao]}`}>
                      {ORGAO_LABELS[item.orgao]}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{item.numero}</TableCell>
                  <TableCell className="max-w-[180px] truncate text-xs">{item.descricao}</TableCell>
                  <TableCell className="text-xs">{getOrderLabel(item.orderId)}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_CONFIG[item.status].color}`}>
                      {STATUS_CONFIG[item.status].icon}
                      {STATUS_CONFIG[item.status].label}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs ${expiry.color}`}>
                      {isExpiringSoon && <AlertTriangle className="h-3 w-3 inline mr-1" />}
                      {expiry.label}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{item.responsavel || "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                      {item.nomeArquivo && (
                        <a href={`/api/lpco/${item.id}/arquivo`} target="_blank" rel="noreferrer">
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Visualizar arquivo">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </a>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditItem(item)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => setDeleteId(item.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {showModal && (
        <Dialog open onOpenChange={() => setShowModal(false)}>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" /> Novo LPCO
              </DialogTitle>
            </DialogHeader>
            <LpcoForm
              orders={orders}
              onSubmit={(fd) => createMutation.mutate(fd)}
              onClose={() => setShowModal(false)}
              isLoading={createMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      )}

      {editItem && (
        <Dialog open onOpenChange={() => setEditItem(null)}>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="h-4 w-4" /> Editar LPCO — {editItem.numero}
              </DialogTitle>
            </DialogHeader>
            <LpcoForm
              initial={{
                id: editItem.id,
                tipo: editItem.tipo,
                orgao: editItem.orgao,
                numero: editItem.numero,
                descricao: editItem.descricao,
                status: editItem.status,
                dataEmissao: editItem.dataEmissao || "",
                dataValidade: editItem.dataValidade || "",
                orderId: editItem.orderId ? String(editItem.orderId) : "",
                observacoes: editItem.observacoes || "",
                responsavel: editItem.responsavel || "",
              }}
              orders={orders}
              onSubmit={(fd) => updateMutation.mutate({ id: editItem.id, fd })}
              onClose={() => setEditItem(null)}
              isLoading={updateMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      )}

      {detailItem && (
        <Dialog open onOpenChange={() => setDetailItem(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold text-white ${ORGAO_COLORS[detailItem.orgao]}`}>
                  {ORGAO_LABELS[detailItem.orgao]}
                </span>
                {detailItem.numero}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${TIPO_COLORS[detailItem.tipo]}`}>
                  {TIPO_LABELS[detailItem.tipo]}
                </span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_CONFIG[detailItem.status].color}`}>
                  {STATUS_CONFIG[detailItem.status].icon}
                  {STATUS_CONFIG[detailItem.status].label}
                </span>
              </div>

              <p className="text-sm font-medium">{detailItem.descricao}</p>

              <div className="grid grid-cols-2 gap-3 text-xs">
                {[
                  { label: "Processo vinculado", value: getOrderLabel(detailItem.orderId) },
                  { label: "Responsável", value: detailItem.responsavel || "—" },
                  { label: "Data de Emissão", value: detailItem.dataEmissao ? format(parseISO(detailItem.dataEmissao), "dd/MM/yyyy", { locale: ptBR }) : "—" },
                  { label: "Data de Validade", value: detailItem.dataValidade ? (() => { const e = getExpiryInfo(detailItem.dataValidade); return <span className={e.color}>{format(parseISO(detailItem.dataValidade!), "dd/MM/yyyy", { locale: ptBR })} ({e.label})</span>; })() : "—" },
                  { label: "Cadastrado em", value: format(new Date(detailItem.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR }) },
                  { label: "Atualizado em", value: format(new Date(detailItem.updatedAt), "dd/MM/yyyy HH:mm", { locale: ptBR }) },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-muted/30 rounded-lg p-2.5">
                    <p className="text-muted-foreground text-[10px] uppercase tracking-wide">{label}</p>
                    <p className="font-medium mt-0.5">{value}</p>
                  </div>
                ))}
              </div>

              {detailItem.observacoes && (
                <div className="bg-muted/20 rounded-lg p-3 text-sm">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Observações</p>
                  <p className="text-sm">{detailItem.observacoes}</p>
                </div>
              )}

              {detailItem.nomeArquivo && (
                <div className="flex items-center gap-2 p-3 border rounded-lg">
                  <FileText className="h-5 w-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{detailItem.nomeOriginal}</p>
                  </div>
                  <a href={`/api/lpco/${detailItem.id}/arquivo`} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                      <Eye className="h-3 w-3" /> Abrir
                    </Button>
                  </a>
                </div>
              )}

              <div className="flex gap-2 justify-end pt-1">
                <Button variant="outline" size="sm" onClick={() => { setDetailItem(null); setEditItem(detailItem); }}>
                  <Pencil className="h-3.5 w-3.5 mr-1.5" /> Editar
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDetailItem(null)}>Fechar</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover LPCO</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O registro será permanentemente removido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteId && deleteMutation.mutate(deleteId)}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
