import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { DollarSign, Package, FileText, TrendingUp, Globe, Truck, Ship, ShieldCheck, BarChart3, CalendarDays, Landmark, Settings2, Layers, Navigation, ShoppingCart, Target, Percent, Wallet, Send, CheckCircle2, AlertCircle, Loader2, CalendarClock, ZoomIn, X, ArrowLeft, Mic, Sparkles, Star, PieChart as PieChartIcon } from "lucide-react";
import { DynamicChart, chartKindIcon } from "@/components/dynamic-chart";
import { formatDistanceToNow } from "date-fns";
import { ptBR as ptBRLocale } from "date-fns/locale";
import { SiTelegram } from "react-icons/si";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area
} from "recharts";
import type { ExportOrderWithDetails, QuotationWithDetails } from "@shared/schema";

type PeriodPreset = "today" | "week" | "month" | "quarter" | "semester" | "year" | "all" | "custom";

function getDateRange(preset: PeriodPreset): { startDate: string; endDate: string } {
  const now = new Date();
  const end = now.toISOString().split("T")[0];
  let start: Date;

  switch (preset) {
    case "today":
      return { startDate: end, endDate: end };
    case "week": {
      start = new Date(now);
      const day = start.getDay();
      start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
      return { startDate: start.toISOString().split("T")[0], endDate: end };
    }
    case "month":
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { startDate: start.toISOString().split("T")[0], endDate: end };
    case "quarter": {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      start = new Date(now.getFullYear(), qMonth, 1);
      return { startDate: start.toISOString().split("T")[0], endDate: end };
    }
    case "semester": {
      const sMonth = now.getMonth() < 6 ? 0 : 6;
      start = new Date(now.getFullYear(), sMonth, 1);
      return { startDate: start.toISOString().split("T")[0], endDate: end };
    }
    case "year":
      start = new Date(now.getFullYear(), 0, 1);
      return { startDate: start.toISOString().split("T")[0], endDate: end };
    case "all":
      return { startDate: "", endDate: "" };
    default:
      return { startDate: "", endDate: "" };
  }
}

const PERIOD_LABELS: { value: PeriodPreset; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "week", label: "Esta Semana" },
  { value: "month", label: "Este Mês" },
  { value: "quarter", label: "Este Trimestre" },
  { value: "semester", label: "Este Semestre" },
  { value: "year", label: "Este Ano" },
  { value: "all", label: "Histórico Global" },
];

const COLORS = [
  "#1E4D7B",
  "#2276BB",
  "#3B82F6",
  "#0EA5E9",
  "#64748B",
  "#7FAFD4",
];

const PAYMENT_COLORS: Record<string, string> = {
  Pendente: "#94A3B8",
  Pago: "#1D4ED8",
  Atrasado: "#DC2626",
};

const PARAM_COLORS: Record<string, string> = {
  Verde: "#1D4ED8",
  Amarelo: "#64748B",
  Vermelho: "#DC2626",
};

const VESSEL_STATUS_COLORS: Record<string, string> = {
  "ETD":          "#2276BB",
  "Zarpou":       "#0EA5E9",
  "Em Navegação": "#3B82F6",
  "Fundeado":     "#64748B",
  "Sem Status":   "#CBD5E1",
};

function formatCurrency(value: number | string) {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(num);
}

function StatCard({
  title,
  value,
  icon: Icon,
  subtitle,
  variant = "default",
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  subtitle?: string;
  variant?: "default" | "warning";
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={`flex h-8 w-8 items-center justify-center rounded-md ${variant === "warning" ? "bg-destructive/10" : "bg-primary/10"}`}>
          <Icon className={`h-4 w-4 ${variant === "warning" ? "text-destructive" : "text-primary"}`} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

function TelegramPanel() {
  const [open, setOpen] = useState(false);
  const [customMsg, setCustomMsg] = useState("");
  const { toast } = useToast();

  const { data: status } = useQuery<{ configured: boolean }>({
    queryKey: ["/api/telegram/status"],
    queryFn: () => fetch("/api/telegram/status").then(r => r.json()),
  });

  const configured = status?.configured ?? false;

  function useSend(endpoint: string) {
    return useMutation({
      mutationFn: (body?: Record<string, string>) =>
        apiRequest("POST", endpoint, body).then(r => r.json()),
      onSuccess: (data: any) => {
        toast({ title: "✅ Enviado!", description: data.message });
      },
      onError: (e: any) => {
        toast({ title: "Erro ao enviar", description: e.message, variant: "destructive" });
      },
    });
  }

  const testMut = useSend("/api/telegram/test");
  const reportMut = useSend("/api/telegram/report");
  const vencMut = useSend("/api/telegram/vencimentos");
  const lpcoMut = useSend("/api/telegram/lpco");
  const audioMut = useSend("/api/telegram/audio-resumo");
  const audioProMut = useSend("/api/telegram/audio-pro");

  const [showProConfig, setShowProConfig] = useState(false);
  const { data: proConfig, isLoading: proConfigLoading } = useQuery<any>({
    queryKey: ["/api/telegram/audio-pro/config"],
  });
  const saveProConfigMut = useMutation({
    mutationFn: (data: Record<string, boolean>) =>
      apiRequest("POST", "/api/telegram/audio-pro/config", data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/telegram/audio-pro/config"] });
      toast({ title: "✅ Configuração salva!" });
    },
    onError: (e: any) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  const toggleTopic = (key: string, value: boolean) => {
    if (!proConfig) return;
    saveProConfigMut.mutate({ ...proConfig, [key]: value });
  };

  const { data: customTopics = [], isLoading: customTopicsLoading } = useQuery<any[]>({
    queryKey: ["/api/telegram/audio-pro/custom-topics"],
  });
  const [showNewTopicForm, setShowNewTopicForm] = useState(false);
  const [newTopicTitulo, setNewTopicTitulo] = useState("");
  const [newTopicInstrucao, setNewTopicInstrucao] = useState("");

  const createCustomTopicMut = useMutation({
    mutationFn: (data: { titulo: string; instrucao: string }) =>
      apiRequest("POST", "/api/telegram/audio-pro/custom-topics", data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/telegram/audio-pro/custom-topics"] });
      setShowNewTopicForm(false);
      setNewTopicTitulo("");
      setNewTopicInstrucao("");
      toast({ title: "✅ Tópico criado!" });
    },
    onError: (e: any) => toast({ title: "Erro ao criar tópico", description: e.message, variant: "destructive" }),
  });

  const toggleCustomTopicMut = useMutation({
    mutationFn: ({ id, ativo }: { id: number; ativo: boolean }) =>
      apiRequest("PATCH", `/api/telegram/audio-pro/custom-topics/${id}`, { ativo }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/telegram/audio-pro/custom-topics"] }),
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteCustomTopicMut = useMutation({
    mutationFn: (id: number) =>
      apiRequest("DELETE", `/api/telegram/audio-pro/custom-topics/${id}`).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/telegram/audio-pro/custom-topics"] });
      toast({ title: "Tópico removido." });
    },
    onError: (e: any) => toast({ title: "Erro ao remover", description: e.message, variant: "destructive" }),
  });

  const customMut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/telegram/custom", { message: customMsg }).then(r => r.json()),
    onSuccess: (data: any) => {
      toast({ title: "✅ Enviado!", description: data.message });
      setCustomMsg("");
    },
    onError: (e: any) => toast({ title: "Erro ao enviar", description: e.message, variant: "destructive" }),
  });

  const anyPending = testMut.isPending || reportMut.isPending || vencMut.isPending || lpcoMut.isPending || audioMut.isPending || audioProMut.isPending || customMut.isPending;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 text-xs border-[#2AABEE] text-[#2AABEE] hover:bg-[#2AABEE]/10"
        onClick={() => setOpen(true)}
        data-testid="button-telegram-panel"
      >
        <SiTelegram className="h-3.5 w-3.5" />
        Telegram
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-80 sm:w-96 overflow-y-auto">
          <SheetHeader className="pb-2">
            <SheetTitle className="flex items-center gap-2">
              <SiTelegram className="h-5 w-5 text-[#2AABEE]" />
              Notificações Telegram
            </SheetTitle>
          </SheetHeader>

          <div className="mt-2 mb-4 flex items-center gap-2 text-xs">
            {configured ? (
              <span className="flex items-center gap-1 text-green-600"><CheckCircle2 className="h-3.5 w-3.5" /> Configurado e ativo</span>
            ) : (
              <span className="flex items-center gap-1 text-red-500"><AlertCircle className="h-3.5 w-3.5" /> Credenciais não configuradas</span>
            )}
          </div>

          <div className="space-y-3">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Envio Rápido</p>

              <button
                className="w-full flex items-center gap-3 rounded-lg border p-3 text-left hover:bg-muted/40 transition-colors disabled:opacity-50"
                onClick={() => testMut.mutate()}
                disabled={anyPending || !configured}
                data-testid="button-telegram-test"
              >
                {testMut.isPending ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" /> : <Send className="h-4 w-4 text-[#2AABEE] shrink-0" />}
                <div>
                  <p className="text-sm font-medium">Mensagem de Teste</p>
                  <p className="text-xs text-muted-foreground">Confirmar que a conexão está funcionando</p>
                </div>
              </button>

              <button
                className="w-full flex items-center gap-3 rounded-lg border p-3 text-left hover:bg-muted/40 transition-colors disabled:opacity-50"
                onClick={() => reportMut.mutate()}
                disabled={anyPending || !configured}
                data-testid="button-telegram-report"
              >
                {reportMut.isPending ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" /> : <BarChart3 className="h-4 w-4 text-primary shrink-0" />}
                <div>
                  <p className="text-sm font-medium">Relatório Diário</p>
                  <p className="text-xs text-muted-foreground">Ordens, faturamento e cotações</p>
                </div>
              </button>

              <button
                className="w-full flex items-center gap-3 rounded-lg border p-3 text-left hover:bg-muted/40 transition-colors disabled:opacity-50"
                onClick={() => vencMut.mutate()}
                disabled={anyPending || !configured}
                data-testid="button-telegram-vencimentos"
              >
                {vencMut.isPending ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" /> : <CalendarClock className="h-4 w-4 text-yellow-500 shrink-0" />}
                <div>
                  <p className="text-sm font-medium">Alerta de Vencimentos</p>
                  <p className="text-xs text-muted-foreground">Faturas vencidas e próximas de vencer</p>
                </div>
              </button>

              <button
                className="w-full flex items-center gap-3 rounded-lg border p-3 text-left hover:bg-muted/40 transition-colors disabled:opacity-50"
                onClick={() => lpcoMut.mutate()}
                disabled={anyPending || !configured}
                data-testid="button-telegram-lpco"
              >
                {lpcoMut.isPending ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" /> : <ShieldCheck className="h-4 w-4 text-amber-500 shrink-0" />}
                <div>
                  <p className="text-sm font-medium">Alerta de LPCO</p>
                  <p className="text-xs text-muted-foreground">Licenças vencendo nos próximos 90 dias</p>
                </div>
              </button>

              <button
                className="w-full flex items-center gap-3 rounded-lg border border-[#2AABEE]/30 p-3 text-left hover:bg-[#2AABEE]/5 transition-colors disabled:opacity-50"
                onClick={() => audioMut.mutate()}
                disabled={anyPending || !configured}
                data-testid="button-telegram-audio"
              >
                {audioMut.isPending ? <Loader2 className="h-4 w-4 animate-spin text-[#2AABEE] shrink-0" /> : <Mic className="h-4 w-4 text-[#2AABEE] shrink-0" />}
                <div>
                  <p className="text-sm font-medium">Resumo em Áudio</p>
                  <p className="text-xs text-muted-foreground">Narração com cotações e vendas dos últimos 7 dias</p>
                </div>
              </button>

              <div className="flex gap-2 items-stretch">
                <button
                  className="flex-1 flex items-center gap-3 rounded-lg border border-amber-400/40 bg-gradient-to-r from-amber-50/60 to-yellow-50/60 dark:from-amber-950/20 dark:to-yellow-950/20 p-3 text-left hover:from-amber-100/60 hover:to-yellow-100/60 dark:hover:from-amber-950/30 dark:hover:to-yellow-950/30 transition-all disabled:opacity-50"
                  onClick={() => audioProMut.mutate()}
                  disabled={anyPending || !configured}
                  data-testid="button-telegram-audio-pro"
                >
                  {audioProMut.isPending
                    ? <Loader2 className="h-4 w-4 animate-spin text-amber-500 shrink-0" />
                    : <span className="relative shrink-0">
                        <Mic className="h-4 w-4 text-amber-500" />
                        <Sparkles className="h-2.5 w-2.5 text-amber-400 absolute -top-1 -right-1" />
                      </span>
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold flex items-center gap-1.5">
                      Resumo em Áudio PRO
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-400 text-amber-900">PRO</span>
                    </p>
                    <p className="text-xs text-muted-foreground">Tempo · Dólar · E-mails · Empresa</p>
                  </div>
                </button>
                <button
                  className="shrink-0 flex items-center justify-center w-10 rounded-lg border border-amber-400/40 bg-amber-50/60 dark:bg-amber-950/20 hover:bg-amber-100/60 dark:hover:bg-amber-950/30 transition-all"
                  onClick={() => setShowProConfig(true)}
                  title="Configurar tópicos do Áudio PRO"
                  data-testid="button-pro-config"
                >
                  <Settings2 className="h-4 w-4 text-amber-600" />
                </button>
              </div>

              <Sheet open={showProConfig} onOpenChange={setShowProConfig}>
                <SheetContent side="right" className="w-[340px] sm:w-[400px]">
                  <SheetHeader className="mb-4">
                    <SheetTitle className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-amber-500" />
                      Configurar Tópicos do Áudio PRO
                    </SheetTitle>
                    <p className="text-sm text-muted-foreground">Ative ou desative os blocos que serão narrados no briefing matinal.</p>
                  </SheetHeader>

                  {proConfigLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : proConfig ? (
                    <div className="space-y-1 overflow-y-auto max-h-[calc(100vh-180px)] pr-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-3 pb-1">Tópicos fixos</p>
                      {[
                        { key: "tempo", label: "Previsão do Tempo", desc: "Temperatura e chuva em SJP", icon: "🌤️" },
                        { key: "dolar", label: "Cotação do Dólar", desc: "PTAX do Banco Central", icon: "💵" },
                        { key: "emails", label: "Caixa de E-mails", desc: "Status da caixa de entrada", icon: "📬" },
                        { key: "operacaoOntem", label: "Operação de Ontem", desc: "Ordens e cotações do dia anterior", icon: "📋" },
                        { key: "cotacoes", label: "Pipeline de Cotações", desc: "Ativas, valor e taxa de conversão", icon: "📊" },
                        { key: "vendasSemana", label: "Vendas da Semana", desc: "Ordens registradas desde segunda", icon: "📈" },
                        { key: "vencimentosSemana", label: "Vencimentos da Semana", desc: "Faturas que vencem esta semana", icon: "📅" },
                        { key: "kanbanNotas", label: "Anotações do Kanban", desc: "Cotações com notas e registros", icon: "🗂️" },
                      ].map(({ key, label, desc, icon }) => (
                        <div key={key} className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-3">
                            <span className="text-lg">{icon}</span>
                            <div>
                              <p className="text-sm font-medium">{label}</p>
                              <p className="text-xs text-muted-foreground">{desc}</p>
                            </div>
                          </div>
                          <Switch
                            checked={!!proConfig[key]}
                            onCheckedChange={(val) => toggleTopic(key, val)}
                            disabled={saveProConfigMut.isPending}
                            data-testid={`switch-pro-${key}`}
                          />
                        </div>
                      ))}

                      <Separator className="my-3" />
                      <div className="flex items-center justify-between px-3 pb-1">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tópicos personalizados</p>
                        <button
                          className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-medium transition-colors"
                          onClick={() => { setShowNewTopicForm(v => !v); setNewTopicTitulo(""); setNewTopicInstrucao(""); }}
                          data-testid="button-new-custom-topic"
                        >
                          <span className="text-base leading-none">+</span> Novo tópico
                        </button>
                      </div>

                      {showNewTopicForm && (
                        <div className="mx-3 p-3 rounded-lg border border-amber-300/50 bg-amber-50/50 dark:bg-amber-950/20 space-y-2">
                          <div>
                            <Label className="text-xs font-medium">Título</Label>
                            <Input
                              className="mt-1 h-8 text-sm"
                              placeholder="Ex: Meta de faturamento"
                              value={newTopicTitulo}
                              onChange={e => setNewTopicTitulo(e.target.value)}
                              data-testid="input-custom-topic-titulo"
                            />
                          </div>
                          <div>
                            <Label className="text-xs font-medium">Instrução para a IA</Label>
                            <Textarea
                              className="mt-1 text-sm resize-none"
                              rows={3}
                              placeholder="Ex: Fale sobre o progresso da meta de faturamento do mês baseando-se nas ordens de exportação ativas."
                              value={newTopicInstrucao}
                              onChange={e => setNewTopicInstrucao(e.target.value)}
                              data-testid="input-custom-topic-instrucao"
                            />
                          </div>
                          <div className="flex gap-2 justify-end">
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowNewTopicForm(false)}>Cancelar</Button>
                            <Button
                              size="sm"
                              className="h-7 text-xs bg-amber-500 hover:bg-amber-600 text-white"
                              disabled={!newTopicTitulo.trim() || !newTopicInstrucao.trim() || createCustomTopicMut.isPending}
                              onClick={() => createCustomTopicMut.mutate({ titulo: newTopicTitulo, instrucao: newTopicInstrucao })}
                              data-testid="button-save-custom-topic"
                            >
                              {createCustomTopicMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Salvar"}
                            </Button>
                          </div>
                        </div>
                      )}

                      {customTopicsLoading ? (
                        <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                      ) : customTopics.length === 0 && !showNewTopicForm ? (
                        <p className="text-xs text-muted-foreground text-center py-4 px-3">Nenhum tópico personalizado ainda. Clique em "+ Novo tópico" para criar.</p>
                      ) : (
                        customTopics.map((topic: any) => (
                          <div key={topic.id} className="flex items-start justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors group" data-testid={`custom-topic-${topic.id}`}>
                            <div className="flex-1 min-w-0 mr-2">
                              <p className="text-sm font-medium truncate">{topic.titulo}</p>
                              <p className="text-xs text-muted-foreground line-clamp-2">{topic.instrucao}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Switch
                                checked={!!topic.ativo}
                                onCheckedChange={(val) => toggleCustomTopicMut.mutate({ id: topic.id, ativo: val })}
                                disabled={toggleCustomTopicMut.isPending}
                                data-testid={`switch-custom-${topic.id}`}
                              />
                              <button
                                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                                onClick={() => deleteCustomTopicMut.mutate(topic.id)}
                                disabled={deleteCustomTopicMut.isPending}
                                title="Remover tópico"
                                data-testid={`button-delete-custom-topic-${topic.id}`}
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  ) : null}
                </SheetContent>
              </Sheet>
            </div>

            <Separator />

            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Mensagem Personalizada</p>
              <Textarea
                placeholder="Digite sua mensagem aqui..."
                value={customMsg}
                onChange={e => setCustomMsg(e.target.value)}
                rows={4}
                className="text-sm resize-none"
                data-testid="textarea-telegram-custom"
              />
              <Button
                className="w-full gap-2 bg-[#2AABEE] hover:bg-[#1a8ec0] text-white"
                size="sm"
                disabled={!customMsg.trim() || anyPending || !configured}
                onClick={() => customMut.mutate()}
                data-testid="button-telegram-send-custom"
              >
                {customMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Enviar Mensagem
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

// ─── Drill-Down ───────────────────────────────────────────────────────────────

type DrillDownState = {
  type: "country" | "client" | "month" | "product" | "vesselStatus" | "paymentStatus" | "modal" | "parametrizacao";
  value: string;
} | null;

const MONTH_NAMES_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function getMonthLabel(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return `${MONTH_NAMES_PT[d.getMonth()]}/${d.getFullYear()}`;
}

function DrillDownDialog({
  state,
  onClose,
  orders,
}: {
  state: DrillDownState;
  onClose: () => void;
  orders: ExportOrderWithDetails[];
}) {
  const open = !!state;

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  const data = useMemo(() => {
    if (!state) return null;
    const { type, value } = state;

    let filtered: ExportOrderWithDetails[] = [];
    if (type === "country") filtered = orders.filter(o => o.client?.country === value);
    else if (type === "client") filtered = orders.filter(o => o.client?.name === value);
    else if (type === "month") filtered = orders.filter(o => getMonthLabel(o.createdAt?.toString()) === value);
    else if (type === "product") filtered = orders.filter(o => o.product?.type === value);
    else if (type === "vesselStatus") filtered = orders.filter(o => (o.vesselStatus ?? "Sem Status") === value);
    else if (type === "paymentStatus") filtered = orders.filter(o => o.statusPagamento?.toLowerCase() === value.toLowerCase());
    else if (type === "modal") filtered = orders.filter(o => o.modal?.toLowerCase() === value.toLowerCase());
    else if (type === "parametrizacao") filtered = orders.filter(o => o.parametrizacao?.toLowerCase() === value.toLowerCase());

    const total = filtered.reduce((s, o) => s + Number(o.total ?? 0), 0);
    const count = filtered.length;
    const avgTicket = count > 0 ? total / count : 0;
    const pago = filtered.filter(o => o.statusPagamento === "pago").reduce((s, o) => s + Number(o.total ?? 0), 0);
    const pendente = filtered.filter(o => o.statusPagamento === "pendente").reduce((s, o) => s + Number(o.total ?? 0), 0);
    const atrasado = filtered.filter(o => o.statusPagamento === "atrasado").reduce((s, o) => s + Number(o.total ?? 0), 0);

    // Monthly trend (for country / client / product drill-downs)
    const monthMap: Record<string, number> = {};
    filtered.forEach(o => {
      const key = getMonthLabel(o.createdAt?.toString());
      if (key) monthMap[key] = (monthMap[key] ?? 0) + Number(o.total ?? 0);
    });
    const byMonth = Object.entries(monthMap)
      .sort(([a], [b]) => {
        const [am, ay] = a.split("/");
        const [bm, by] = b.split("/");
        const ai = MONTH_NAMES_PT.indexOf(am) + parseInt(ay) * 12;
        const bi = MONTH_NAMES_PT.indexOf(bm) + parseInt(by) * 12;
        return ai - bi;
      })
      .map(([month, total]) => ({ month, total }));

    // By client (for country / product drill-downs)
    const clientMap: Record<string, number> = {};
    filtered.forEach(o => {
      const name = o.client?.name ?? "—";
      clientMap[name] = (clientMap[name] ?? 0) + Number(o.total ?? 0);
    });
    const byClient = Object.entries(clientMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([name, total]) => ({ name, total }));

    // By product (for client drill-down)
    const productMap: Record<string, number> = {};
    filtered.forEach(o => {
      const name = o.product?.type ?? "—";
      productMap[name] = (productMap[name] ?? 0) + Number(o.total ?? 0);
    });
    const byProduct = Object.entries(productMap)
      .sort(([, a], [, b]) => b - a)
      .map(([name, total]) => ({ name, total }));

    // By country (for month drill-down)
    const countryMap: Record<string, number> = {};
    filtered.forEach(o => {
      const name = o.client?.country ?? "—";
      countryMap[name] = (countryMap[name] ?? 0) + Number(o.total ?? 0);
    });
    const byCountry = Object.entries(countryMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([country, total]) => ({ country, total }));

    // By payment status (for month drill-down)
    const byStatus = [
      { status: "Pago", value: pago, color: "#1D4ED8" },
      { status: "Pendente", value: pendente, color: "#94A3B8" },
      { status: "Atrasado", value: atrasado, color: "#DC2626" },
    ].filter(s => s.value > 0);

    // Top orders
    const topOrders = [...filtered].sort((a, b) => Number(b.total ?? 0) - Number(a.total ?? 0)).slice(0, 6);

    const uniqueClients = new Set(filtered.map(o => o.client?.name)).size;

    return { filtered, total, count, avgTicket, pago, pendente, atrasado, byMonth, byClient, byProduct, byCountry, byStatus, topOrders, uniqueClients };
  }, [state, orders]);

  if (!state || !data) return null;

  const TOOLTIP_STYLE = { borderRadius: "6px", border: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))" };

  const typeLabels: Record<string, string> = {
    country: "País", client: "Cliente", month: "Mês", product: "Produto",
    vesselStatus: "Movimentação", paymentStatus: "Status de Pagamento",
    modal: "Modal", parametrizacao: "Parametrização",
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl w-full max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ZoomIn className="h-4 w-4 text-primary" />
            <DialogTitle className="text-base">
              {typeLabels[state.type]}: <span className="text-primary">{state.value}</span>
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-6 pt-1">
          {/* KPI row */}
          <div className={`grid gap-3 ${state.type === "month" ? "grid-cols-4" : "grid-cols-3"}`}>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-lg font-bold text-primary">{fmt(data.total)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Ordens</p>
              <p className="text-lg font-bold">{data.count}</p>
            </div>
            {state.type === "month" ? (
              <>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Pago</p>
                  <p className="text-lg font-bold text-blue-600">{fmt(data.pago)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Pendente/Atrasado</p>
                  <p className="text-lg font-bold text-amber-500">{fmt(data.pendente + data.atrasado)}</p>
                </div>
              </>
            ) : state.type === "product" ? (
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Clientes</p>
                <p className="text-lg font-bold">{data.uniqueClients}</p>
              </div>
            ) : (
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Ticket Médio</p>
                <p className="text-lg font-bold">{fmt(data.avgTicket)}</p>
              </div>
            )}
          </div>

          {/* Sub-charts */}
          {(state.type === "country" || state.type === "product") && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* By client */}
              {data.byClient.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Por Cliente</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data.byClient} layout="vertical" margin={{ top: 2, right: 16, left: 8, bottom: 2 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10 }} className="fill-muted-foreground" tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} className="fill-muted-foreground" width={80} />
                      <Tooltip formatter={(v: number) => [fmt(v), "Faturamento"]} contentStyle={TOOLTIP_STYLE} />
                      <Bar dataKey="total" fill="#2276BB" radius={[0, 4, 4, 0]}>
                        {data.byClient.map((_, i) => <Cell key={i} fill={["#2276BB","#1a5e94","#1E4D7B","#3b82f6","#60a5fa","#93c5fd","#2563eb","#1d4ed8"][i % 8]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              {/* Monthly trend */}
              {data.byMonth.length > 1 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Evolução Mensal</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={data.byMonth} margin={{ top: 4, right: 16, left: 8, bottom: 2 }}>
                      <defs>
                        <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2276BB" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#2276BB" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} tickFormatter={v => v.split("/")[0]} className="fill-muted-foreground" />
                      <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: number) => [fmt(v), "Faturamento"]} contentStyle={TOOLTIP_STYLE} />
                      <Area type="monotone" dataKey="total" stroke="#2276BB" strokeWidth={2} fill="url(#ddGrad)" dot={{ r: 3, fill: "#2276BB", strokeWidth: 0 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {state.type === "client" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Monthly trend */}
              {data.byMonth.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Evolução Mensal</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={data.byMonth} margin={{ top: 4, right: 16, left: 8, bottom: 2 }}>
                      <defs>
                        <linearGradient id="ddGradC" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2276BB" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#2276BB" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} tickFormatter={v => v.split("/")[0]} className="fill-muted-foreground" />
                      <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: number) => [fmt(v), "Faturamento"]} contentStyle={TOOLTIP_STYLE} />
                      <Area type="monotone" dataKey="total" stroke="#2276BB" strokeWidth={2} fill="url(#ddGradC)" dot={{ r: 3, fill: "#2276BB", strokeWidth: 0 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
              {/* By product */}
              {data.byProduct.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Por Produto</p>
                  <div className="flex items-center gap-2">
                    <ResponsiveContainer width="55%" height={200}>
                      <PieChart>
                        <Pie data={data.byProduct} dataKey="total" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3}>
                          {data.byProduct.map((_, i) => <Cell key={i} fill={["#2276BB","#1a5e94","#3b82f6","#60a5fa","#93c5fd"][i % 5]} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => [fmt(v), "Faturamento"]} contentStyle={TOOLTIP_STYLE} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-col gap-2 w-[45%]">
                      {data.byProduct.map((p, i) => (
                        <div key={p.name} className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: ["#2276BB","#1a5e94","#3b82f6","#60a5fa","#93c5fd"][i % 5] }} />
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">{p.name}</p>
                            <p className="text-xs text-muted-foreground">{fmt(p.total)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {state.type === "month" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* By payment status */}
              {data.byStatus.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Por Status de Pagamento</p>
                  <div className="flex items-center gap-2">
                    <ResponsiveContainer width="55%" height={200}>
                      <PieChart>
                        <Pie data={data.byStatus} dataKey="value" nameKey="status" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3}>
                          {data.byStatus.map((s) => <Cell key={s.status} fill={s.color} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => [fmt(v), "Valor"]} contentStyle={TOOLTIP_STYLE} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-col gap-2 w-[45%]">
                      {data.byStatus.map(s => (
                        <div key={s.status} className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                          <div>
                            <p className="text-xs font-medium">{s.status}</p>
                            <p className="text-xs text-muted-foreground">{fmt(s.value)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {/* By country */}
              {data.byCountry.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Por País</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data.byCountry} margin={{ top: 2, right: 16, left: 8, bottom: 2 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="country" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                      <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: number) => [fmt(v), "Faturamento"]} contentStyle={TOOLTIP_STYLE} />
                      <Bar dataKey="total" fill="#2276BB" radius={[4, 4, 0, 0]}>
                        {data.byCountry.map((_, i) => <Cell key={i} fill={["#2276BB","#1a5e94","#3b82f6","#60a5fa","#93c5fd","#1E4D7B","#2563eb","#1d4ed8"][i % 8]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* vesselStatus / paymentStatus / parametrizacao sub-charts */}
          {(state.type === "vesselStatus" || state.type === "paymentStatus" || state.type === "parametrizacao") && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {data.byClient.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Por Cliente</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data.byClient} layout="vertical" margin={{ top: 2, right: 16, left: 8, bottom: 2 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10 }} className="fill-muted-foreground" tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} className="fill-muted-foreground" width={90} />
                      <Tooltip formatter={(v: number) => [fmt(v), "Faturamento"]} contentStyle={TOOLTIP_STYLE} />
                      <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                        {data.byClient.map((_, i) => <Cell key={i} fill={["#2276BB","#1a5e94","#1E4D7B","#3b82f6","#60a5fa","#93c5fd","#2563eb","#1d4ed8"][i % 8]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              {data.byMonth.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Evolução Mensal</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={data.byMonth} margin={{ top: 4, right: 16, left: 8, bottom: 2 }}>
                      <defs>
                        <linearGradient id="ddGradV" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2276BB" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#2276BB" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} tickFormatter={v => v.split("/")[0]} className="fill-muted-foreground" />
                      <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: number) => [fmt(v), "Faturamento"]} contentStyle={TOOLTIP_STYLE} />
                      <Area type="monotone" dataKey="total" stroke="#2276BB" strokeWidth={2} fill="url(#ddGradV)" dot={{ r: 3, fill: "#2276BB", strokeWidth: 0 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* modal sub-charts */}
          {state.type === "modal" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {data.byCountry.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Por País</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data.byCountry} margin={{ top: 2, right: 16, left: 8, bottom: 2 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="country" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                      <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: number) => [fmt(v), "Faturamento"]} contentStyle={TOOLTIP_STYLE} />
                      <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                        {data.byCountry.map((_, i) => <Cell key={i} fill={["#2276BB","#1a5e94","#3b82f6","#60a5fa","#93c5fd","#1E4D7B","#2563eb","#1d4ed8"][i % 8]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              {data.byProduct.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Por Produto</p>
                  <div className="flex items-center gap-2">
                    <ResponsiveContainer width="55%" height={200}>
                      <PieChart>
                        <Pie data={data.byProduct} dataKey="total" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3}>
                          {data.byProduct.map((_, i) => <Cell key={i} fill={["#2276BB","#1a5e94","#3b82f6","#60a5fa","#93c5fd"][i % 5]} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => [fmt(v), "Faturamento"]} contentStyle={TOOLTIP_STYLE} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-col gap-2 w-[45%]">
                      {data.byProduct.map((p, i) => (
                        <div key={p.name} className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: ["#2276BB","#1a5e94","#3b82f6","#60a5fa","#93c5fd"][i % 5] }} />
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">{p.name}</p>
                            <p className="text-xs text-muted-foreground">{fmt(p.total)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Orders table */}
          {data.topOrders.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                {data.topOrders.length < data.count ? `Top ${data.topOrders.length} Ordens (de ${data.count})` : `Ordens (${data.count})`}
              </p>
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Invoice</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Cliente</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Produto</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Total</th>
                      <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topOrders.map((o, i) => (
                      <tr key={o.id} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                        <td className="px-3 py-2 text-xs font-mono">{o.invoice}</td>
                        <td className="px-3 py-2 text-xs">{o.client?.name ?? "—"}</td>
                        <td className="px-3 py-2 text-xs">{o.product?.type ?? "—"}</td>
                        <td className="px-3 py-2 text-xs text-right font-medium">{fmt(Number(o.total ?? 0))}</td>
                        <td className="px-3 py-2 text-xs text-center">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            o.statusPagamento === "pago" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" :
                            o.statusPagamento === "atrasado" ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" :
                            "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                          }`}>
                            {o.statusPagamento}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {data.count === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <ZoomIn className="h-8 w-8 opacity-30" />
              <p className="text-sm">Nenhuma ordem encontrada para este filtro</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

type SectionFilter = "all" | "financeiro" | "operacional" | "diversos" | "cotacoes-vendas" | "favorito";

const SECTION_LABELS: { value: SectionFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "financeiro", label: "Financeiro" },
  { value: "operacional", label: "Operacional" },
  { value: "diversos", label: "Diversos" },
  { value: "cotacoes-vendas", label: "Cotações/Vendas" },
  { value: "favorito", label: "⭐ Favoritos" },
];

export default function Dashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodPreset>("year");
  const [selectedSection, setSelectedSection] = useState<SectionFilter>("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [drillDown, setDrillDown] = useState<DrillDownState>(null);

  const { data: favoritos = [], isLoading: favoritosLoading } = useQuery<any[]>({
    queryKey: ["/api/query-ai/favorites"],
  });
  const removeFavoriteMut = useMutation({
    mutationFn: (id: number) =>
      apiRequest("PATCH", `/api/query-ai/history/${id}/favorite`, { favoritado: false }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/query-ai/favorites"] });
      queryClient.invalidateQueries({ queryKey: ["/api/query-ai/history"] });
    },
  });

  const dateRange = useMemo(() => {
    if (selectedPeriod === "custom") {
      return { startDate: customStart, endDate: customEnd };
    }
    return getDateRange(selectedPeriod);
  }, [selectedPeriod, customStart, customEnd]);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (dateRange.startDate) params.set("startDate", dateRange.startDate);
    if (dateRange.endDate) params.set("endDate", dateRange.endDate);
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }, [dateRange]);

  const { data: orders, isLoading } = useQuery<ExportOrderWithDetails[]>({
    queryKey: ["/api/orders"],
  });

  const { data: quotations = [], isLoading: quotationsLoading } = useQuery<QuotationWithDetails[]>({
    queryKey: ["/api/quotations"],
  });

  const { data: stats, isLoading: statsLoading } = useQuery<{
    totalRevenue: number;
    totalVolume: number;
    pendingInvoices: number;
    overdueCount: number;
    revenueByCountry: { country: string; total: number }[];
    productMix: { type: string; count: number }[];
    cashFlow: { month: string; amount: number }[];
    paymentStatusDistribution: { status: string; count: number }[];
    modalDistribution: { modal: string; count: number; total: number }[];
    parametrizacaoDistribution: { status: string; count: number }[];
    volumeByCountry: { country: string; volume: number }[];
    monthlyOrders: { month: string; count: number; total: number }[];
    revenueByClient: { client: string; total: number }[];
    revenueByProduct: { product: string; total: number }[];
    monthlyRevenueByStatus: { month: string; pago: number; pendente: number; atrasado: number }[];
    monthlyRevenueFull: { month: string; total: number }[];
    vesselStatusDistribution: { status: string; count: number; total: number }[];
    ticketMedio: number;
    totalPago: number;
    totalPendente: number;
    totalAtrasado: number;
  }>({
    queryKey: ["/api/dashboard/stats", queryParams],
    queryFn: () => fetch(`/api/dashboard/stats${queryParams}`).then((r) => r.json()),
  });

  const quotationsStats = useMemo(() => {
    if (!quotations.length) return null;

    const STATUSES = ["rascunho", "enviada", "aceita", "recusada", "convertida"] as const;
    const STATUS_LABELS_PT: Record<string, string> = {
      rascunho: "Rascunho", enviada: "Enviada", aceita: "Aceita", recusada: "Recusada", convertida: "Convertida",
    };

    const statusCounts = STATUSES.map(s => ({
      status: STATUS_LABELS_PT[s],
      count: quotations.filter(q => q.status === s).length,
      valor: quotations.filter(q => q.status === s).reduce((acc, q) => acc + Number(q.total ?? 0), 0),
    }));

    const pipeline = quotations.filter(q => q.status === "rascunho" || q.status === "enviada");
    const pipelineValue = pipeline.reduce((acc, q) => acc + Number(q.total ?? 0), 0);
    const pipelineCount = pipeline.length;

    const converted = quotations.filter(q => q.status === "convertida").length;
    const decided = quotations.filter(q => ["aceita", "recusada", "convertida"].includes(q.status)).length;
    const conversionRate = decided > 0 ? Math.round((converted / decided) * 100) : 0;

    const clientMap: Record<string, number> = {};
    quotations.forEach(q => {
      const name = q.client?.name ?? "Desconhecido";
      clientMap[name] = (clientMap[name] ?? 0) + Number(q.total ?? 0);
    });
    const topClients = Object.entries(clientMap)
      .map(([client, valor]) => ({ client, valor }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 7);

    const productMap: Record<string, { count: number; valor: number }> = {};
    quotations.forEach(q => {
      const name = q.product?.type ?? "Desconhecido";
      if (!productMap[name]) productMap[name] = { count: 0, valor: 0 };
      productMap[name].count++;
      productMap[name].valor += Number(q.total ?? 0);
    });
    const byProduct = Object.entries(productMap)
      .map(([product, d]) => ({ product, count: d.count, valor: d.valor }))
      .sort((a, b) => b.valor - a.valor);

    const monthMap: Record<string, { count: number; valor: number }> = {};
    quotations.forEach(q => {
      const d = new Date(q.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!monthMap[key]) monthMap[key] = { count: 0, valor: 0 };
      monthMap[key].count++;
      monthMap[key].valor += Number(q.total ?? 0);
    });
    const byMonth = Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, d]) => ({
        month: new Date(month + "-01").toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
        count: d.count,
        valor: d.valor,
      }));

    const recentActive = quotations
      .filter(q => q.status === "rascunho" || q.status === "enviada")
      .slice(0, 5);

    return { statusCounts, pipelineValue, pipelineCount, conversionRate, converted, total: quotations.length, topClients, byProduct, byMonth, recentActive };
  }, [quotations]);

  if (isLoading || statsLoading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Visão geral das operações de exportação</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader>
              <CardContent><Skeleton className="h-8 w-32" /></CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardHeader><Skeleton className="h-4 w-40" /></CardHeader>
              <CardContent><Skeleton className="h-[250px] w-full" /></CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-dashboard-title">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Visão geral das operações de exportação</p>
        </div>
      </div>

      <Card data-testid="card-filters">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              {PERIOD_LABELS.map((period) => (
                <Button
                  key={period.value}
                  variant={selectedPeriod === period.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedPeriod(period.value)}
                  data-testid={`button-filter-${period.value}`}
                  className="text-xs"
                >
                  {period.label}
                </Button>
              ))}
              <Button
                variant={selectedPeriod === "custom" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedPeriod("custom")}
                data-testid="button-filter-custom"
                className="text-xs"
              >
                Personalizado
              </Button>
            </div>
            {selectedPeriod === "custom" && (
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="start-date" className="text-xs text-muted-foreground">Data Início</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="h-8 w-40 text-xs"
                    data-testid="input-date-start"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="end-date" className="text-xs text-muted-foreground">Data Fim</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="h-8 w-40 text-xs"
                    data-testid="input-date-end"
                  />
                </div>
              </div>
            )}
            {dateRange.startDate && (
              <p className="text-xs text-muted-foreground" data-testid="text-date-range">
                Exibindo dados de {new Date(dateRange.startDate + "T00:00:00").toLocaleDateString("pt-BR")} até {new Date(dateRange.endDate + "T00:00:00").toLocaleDateString("pt-BR")}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t">
              <Layers className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              {SECTION_LABELS.map((section) => (
                <Button
                  key={section.value}
                  variant={selectedSection === section.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedSection(section.value)}
                  data-testid={`button-section-${section.value}`}
                  className="text-xs"
                >
                  {section.label}
                </Button>
              ))}
              <div className="ml-auto">
                <TelegramPanel />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {(selectedSection === "all" || selectedSection === "operacional") && <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Navigation className="h-4 w-4 text-muted-foreground" />
              Status de Movimentação
              <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground font-normal">
                <ZoomIn className="h-3 w-3" /> clique p/ detalhar
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.vesselStatusDistribution && stats.vesselStatusDistribution.filter(d => d.status !== "Sem Status").length > 0 ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="60%" height={250}>
                  <PieChart>
                    <Pie
                      data={stats.vesselStatusDistribution.filter(d => d.status !== "Sem Status")}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="count"
                      nameKey="status"
                      cursor="pointer"
                      onClick={(d: any) => setDrillDown({ type: "vesselStatus", value: d.status })}
                    >
                      {stats.vesselStatusDistribution.filter(d => d.status !== "Sem Status").map((entry) => (
                        <Cell key={entry.status} fill={VESSEL_STATUS_COLORS[entry.status] || "#94A3B8"} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => [value, "Ordens"]}
                      contentStyle={{ borderRadius: "6px", border: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-3 w-[40%]">
                  {stats.vesselStatusDistribution.map((item) => (
                    <div
                      key={item.status}
                      className="flex items-center gap-2 cursor-pointer hover:opacity-70 transition-opacity"
                      onClick={() => setDrillDown({ type: "vesselStatus", value: item.status })}
                    >
                      <div className="h-3 w-3 rounded-sm flex-shrink-0" style={{ backgroundColor: VESSEL_STATUS_COLORS[item.status] || "#94A3B8" }} />
                      <div className="min-w-0">
                        <p className="text-xs font-medium leading-none">{item.status}</p>
                        <p className="text-xs text-muted-foreground">{item.count} ordem{item.count !== 1 ? "s" : ""}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[250px] text-muted-foreground text-sm gap-2">
                <Navigation className="h-8 w-8 opacity-30" />
                <span>Nenhum status de movimentação definido</span>
                <span className="text-xs">Defina o status nas ordens de exportação</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Ship className="h-4 w-4 text-muted-foreground" />
              Faturamento por Movimentação
              <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground font-normal">
                <ZoomIn className="h-3 w-3" /> clique p/ detalhar
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.vesselStatusDistribution && stats.vesselStatusDistribution.filter(d => d.status !== "Sem Status").length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart
                  data={stats.vesselStatusDistribution.filter(d => d.status !== "Sem Status")}
                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                  layout="vertical"
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} className="fill-muted-foreground" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="status" tick={{ fontSize: 11 }} className="fill-muted-foreground" width={90} />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), "Valor Total"]}
                    contentStyle={{ borderRadius: "6px", border: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))" }}
                  />
                  <Bar
                    dataKey="total"
                    radius={[0, 4, 4, 0]}
                    cursor="pointer"
                    onClick={(d: any) => setDrillDown({ type: "vesselStatus", value: d.status })}
                  >
                    {stats.vesselStatusDistribution.filter(d => d.status !== "Sem Status").map((entry) => (
                      <Cell key={entry.status} fill={VESSEL_STATUS_COLORS[entry.status] || "#94A3B8"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-[250px] text-muted-foreground text-sm gap-2">
                <Ship className="h-8 w-8 opacity-30" />
                <span>Nenhum dado disponível</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>}

      {(selectedSection === "all" || selectedSection === "financeiro") && <>
      <div className="flex items-center gap-2 pt-2" data-testid="section-financeiro">
        <Landmark className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Financeiro</h2>
        <div className="flex-1 h-px bg-border" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Faturamento Total"
          value={formatCurrency(stats?.totalRevenue || 0)}
          icon={DollarSign}
          subtitle="Período selecionado"
        />
        <StatCard
          title="Ticket Médio"
          value={formatCurrency(stats?.ticketMedio || 0)}
          icon={DollarSign}
          subtitle="Valor médio por ordem"
        />
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Faturamento Recebido</CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-green-500/10">
              <DollarSign className="h-4 w-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-faturamento-pago">{formatCurrency(stats?.totalPago || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">Total pago no período</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Faturamento Pendente</CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-500/10">
              <DollarSign className="h-4 w-4 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600" data-testid="text-faturamento-pendente">{formatCurrency((stats?.totalPendente || 0) + (stats?.totalAtrasado || 0))}</div>
            <p className="text-xs text-muted-foreground mt-1">Pendente + atrasado</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="cursor-pointer hover:ring-1 hover:ring-primary/30 transition-all" onClick={() => {}}>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              Faturamento por País
              <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground font-normal">
                <ZoomIn className="h-3 w-3" /> clique p/ detalhar
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.revenueByCountry && stats.revenueByCountry.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={stats.revenueByCountry} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="country" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), "Faturamento"]}
                    contentStyle={{ borderRadius: "6px", border: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))" }}
                  />
                  <Bar
                    dataKey="total"
                    fill="#2276BB"
                    radius={[4, 4, 0, 0]}
                    cursor="pointer"
                    onClick={(data: any) => setDrillDown({ type: "country", value: data.country })}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">Sem dados disponíveis</div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-faturamento-status">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              Faturamento Mensal por Status
              <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground font-normal">
                <ZoomIn className="h-3 w-3" /> clique p/ detalhar
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.monthlyRevenueByStatus && stats.monthlyRevenueByStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={stats.monthlyRevenueByStatus}
                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                  onClick={(d: any) => { if (d?.activeLabel) setDrillDown({ type: "month", value: d.activeLabel }); }}
                  style={{ cursor: "pointer" }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(value: number, name: string) => [formatCurrency(value), name]}
                    contentStyle={{ borderRadius: "6px", border: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))" }}
                  />
                  <Legend />
                  <Bar dataKey="pago" stackId="a" fill="#1D4ED8" name="Pago" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="pendente" stackId="a" fill="#94A3B8" name="Pendente" />
                  <Bar dataKey="atrasado" stackId="a" fill="#DC2626" name="Atrasado" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">Sem dados disponíveis</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-faturamento-cliente">
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            Faturamento por Cliente (Top 10)
            <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground font-normal">
              <ZoomIn className="h-3 w-3" /> clique p/ detalhar
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.revenueByClient && stats.revenueByClient.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.revenueByClient} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" tick={{ fontSize: 12 }} className="fill-muted-foreground" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <YAxis dataKey="client" type="category" tick={{ fontSize: 11 }} className="fill-muted-foreground" width={120} />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), "Faturamento"]}
                  contentStyle={{ borderRadius: "6px", border: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))" }}
                />
                <Bar
                  dataKey="total"
                  fill="#2276BB"
                  radius={[0, 4, 4, 0]}
                  cursor="pointer"
                  onClick={(data: any) => setDrillDown({ type: "client", value: data.client })}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">Sem dados disponíveis</div>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-receita-por-mes">
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            Receita por Mês — {new Date().getFullYear()}
            <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground font-normal">
              <ZoomIn className="h-3 w-3" /> clique p/ detalhar
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.monthlyRevenueFull ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart
                data={stats.monthlyRevenueFull}
                margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
                onClick={(d: any) => { if (d?.activeLabel) setDrillDown({ type: "month", value: d.activeLabel }); }}
                style={{ cursor: "pointer" }}
              >
                <defs>
                  <linearGradient id="gradReceita" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2276BB" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#2276BB" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v: string) => v.split("/")[0]}
                  className="fill-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  className="fill-muted-foreground"
                  tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), "Receita"]}
                  contentStyle={{ borderRadius: "6px", border: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))" }}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#2276BB"
                  strokeWidth={2}
                  fill="url(#gradReceita)"
                  dot={{ r: 4, fill: "#2276BB", strokeWidth: 0 }}
                  activeDot={{ r: 6 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">Sem dados disponíveis</div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card data-testid="card-faturamento-produto">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              Faturamento por Produto
              <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground font-normal">
                <ZoomIn className="h-3 w-3" /> clique p/ detalhar
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.revenueByProduct && stats.revenueByProduct.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={stats.revenueByProduct} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="product" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), "Faturamento"]}
                    contentStyle={{ borderRadius: "6px", border: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))" }}
                  />
                  <Bar
                    dataKey="total"
                    radius={[4, 4, 0, 0]}
                    cursor="pointer"
                    onClick={(data: any) => setDrillDown({ type: "product", value: data.product })}
                  >
                    {stats.revenueByProduct.map((_, index) => (
                      <Cell key={`prod-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">Sem dados disponíveis</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Status de Pagamento
              <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground font-normal">
                <ZoomIn className="h-3 w-3" /> clique p/ detalhar
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.paymentStatusDistribution && stats.paymentStatusDistribution.length > 0 ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="60%" height={280}>
                  <PieChart>
                    <Pie
                      data={stats.paymentStatusDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={4}
                      dataKey="count"
                      nameKey="status"
                      cursor="pointer"
                      onClick={(d: any) => setDrillDown({ type: "paymentStatus", value: d.status })}
                    >
                      {stats.paymentStatusDistribution.map((entry) => (
                        <Cell key={entry.status} fill={PAYMENT_COLORS[entry.status] || COLORS[0]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: "6px", border: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))" }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-2 w-[40%]">
                  {stats.paymentStatusDistribution.map((item) => (
                    <div
                      key={item.status}
                      className="flex items-center gap-2 cursor-pointer hover:opacity-70 transition-opacity"
                      onClick={() => setDrillDown({ type: "paymentStatus", value: item.status })}
                    >
                      <div className="h-3 w-3 rounded-sm flex-shrink-0" style={{ backgroundColor: PAYMENT_COLORS[item.status] || COLORS[0] }} />
                      <span className="text-xs text-muted-foreground">{item.status} ({item.count})</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">Sem dados disponíveis</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            Projeção de Recebíveis (Cash Flow)
            <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground font-normal">
              <ZoomIn className="h-3 w-3" /> clique p/ detalhar
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.cashFlow && stats.cashFlow.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={stats.cashFlow}
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                onClick={(d: any) => { if (d?.activeLabel) setDrillDown({ type: "month", value: d.activeLabel }); }}
                style={{ cursor: "pointer" }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), "Recebíveis"]}
                  contentStyle={{ borderRadius: "6px", border: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))" }}
                />
                <Legend />
                <Line type="monotone" dataKey="amount" stroke="#2276BB" strokeWidth={2} dot={{ r: 4, fill: "#1E4D7B" }} name="Recebíveis" activeDot={{ r: 6, style: { cursor: "pointer" } }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">Sem dados disponíveis</div>
          )}
        </CardContent>
      </Card>

      </>}

      {(selectedSection === "all" || selectedSection === "operacional") && <>
      <div className="flex items-center gap-2 pt-4" data-testid="section-operacional">
        <Settings2 className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Operacional</h2>
        <div className="flex-1 h-px bg-border" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Volume Total"
          value={`${(stats?.totalVolume || 0).toLocaleString("pt-BR")} ton`}
          icon={Package}
          subtitle="Quantidade exportada"
        />
        <StatCard
          title="Invoices Pendentes"
          value={String(stats?.pendingInvoices || 0)}
          icon={FileText}
          subtitle="Aguardando pagamento"
        />
        <StatCard
          title="Ordens no Período"
          value={String(orders?.length || 0)}
          icon={BarChart3}
          subtitle="Total de ordens"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              Volume por País (ton)
              <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground font-normal">
                <ZoomIn className="h-3 w-3" /> clique p/ detalhar
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.volumeByCountry && stats.volumeByCountry.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={stats.volumeByCountry} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="country" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" tickFormatter={(v) => `${v.toLocaleString()}`} />
                  <Tooltip
                    formatter={(value: number) => [`${value.toLocaleString("pt-BR")} ton`, "Volume"]}
                    contentStyle={{ borderRadius: "6px", border: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))" }}
                  />
                  <Bar
                    dataKey="volume"
                    fill="#2276BB"
                    radius={[4, 4, 0, 0]}
                    cursor="pointer"
                    onClick={(d: any) => setDrillDown({ type: "country", value: d.country })}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">Sem dados disponíveis</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Pedidos por Mês
              <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground font-normal">
                <ZoomIn className="h-3 w-3" /> clique p/ detalhar
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.monthlyOrders && stats.monthlyOrders.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart
                  data={stats.monthlyOrders}
                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                  onClick={(d: any) => { if (d?.activeLabel) setDrillDown({ type: "month", value: d.activeLabel }); }}
                  style={{ cursor: "pointer" }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                  <YAxis yAxisId="left" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} className="fill-muted-foreground" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      name === "Qtd" ? value : formatCurrency(value),
                      name,
                    ]}
                    contentStyle={{ borderRadius: "6px", border: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))" }}
                  />
                  <Legend />
                  <Area yAxisId="left" type="monotone" dataKey="count" stroke="#2276BB" fill="#2276BB" fillOpacity={0.15} strokeWidth={2} name="Qtd" />
                  <Area yAxisId="right" type="monotone" dataKey="total" stroke="#64748B" fill="#64748B" fillOpacity={0.12} strokeWidth={2} name="Valor Total" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">Sem dados disponíveis</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Truck className="h-4 w-4 text-muted-foreground" />
              Modal de Transporte
              <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground font-normal">
                <ZoomIn className="h-3 w-3" /> clique p/ detalhar
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.modalDistribution && stats.modalDistribution.length > 0 ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="60%" height={250}>
                  <PieChart>
                    <Pie
                      data={stats.modalDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="count"
                      nameKey="modal"
                      cursor="pointer"
                      onClick={(d: any) => setDrillDown({ type: "modal", value: d.modal })}
                    >
                      {stats.modalDistribution.map((_, index) => (
                        <Cell key={`modal-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: "6px", border: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))" }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-2 w-[40%]">
                  {stats.modalDistribution.map((item, i) => (
                    <div
                      key={item.modal}
                      className="flex items-center gap-2 cursor-pointer hover:opacity-70 transition-opacity"
                      onClick={() => setDrillDown({ type: "modal", value: item.modal })}
                    >
                      <div className="h-3 w-3 rounded-sm flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-xs text-muted-foreground">{item.modal} ({item.count})</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">Sem dados disponíveis</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              Parametrização
              <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground font-normal">
                <ZoomIn className="h-3 w-3" /> clique p/ detalhar
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.parametrizacaoDistribution && stats.parametrizacaoDistribution.length > 0 ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="60%" height={250}>
                  <PieChart>
                    <Pie
                      data={stats.parametrizacaoDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="count"
                      nameKey="status"
                      cursor="pointer"
                      onClick={(d: any) => setDrillDown({ type: "parametrizacao", value: d.status })}
                    >
                      {stats.parametrizacaoDistribution.map((entry) => (
                        <Cell key={entry.status} fill={PARAM_COLORS[entry.status] || COLORS[0]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: "6px", border: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))" }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-2 w-[40%]">
                  {stats.parametrizacaoDistribution.map((item) => (
                    <div
                      key={item.status}
                      className="flex items-center gap-2 cursor-pointer hover:opacity-70 transition-opacity"
                      onClick={() => setDrillDown({ type: "parametrizacao", value: item.status })}
                    >
                      <div className="h-3 w-3 rounded-sm flex-shrink-0" style={{ backgroundColor: PARAM_COLORS[item.status] || COLORS[0] }} />
                      <span className="text-xs text-muted-foreground">{item.status} ({item.count})</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">Sem dados disponíveis</div>
            )}
          </CardContent>
        </Card>
      </div>

      </>}

      {(selectedSection === "all" || selectedSection === "diversos") && <>
      <div className="flex items-center gap-2 pt-4" data-testid="section-diversos">
        <Layers className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Diversos</h2>
        <div className="flex-1 h-px bg-border" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            Mix de Produtos
            <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground font-normal">
              <ZoomIn className="h-3 w-3" /> clique p/ detalhar
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.productMix && stats.productMix.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="60%" height={280}>
                <PieChart>
                  <Pie
                    data={stats.productMix}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={4}
                    dataKey="count"
                    nameKey="type"
                    cursor="pointer"
                    onClick={(d: any) => setDrillDown({ type: "product", value: d.type })}
                  >
                    {stats.productMix.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: "6px", border: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))" }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-2 w-[40%]">
                {stats.productMix.map((item, i) => (
                  <div
                    key={item.type}
                    className="flex items-center gap-2 cursor-pointer hover:opacity-70 transition-opacity"
                    onClick={() => setDrillDown({ type: "product", value: item.type })}
                  >
                    <div className="h-3 w-3 rounded-sm flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-xs text-muted-foreground truncate">{item.type}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">Sem dados disponíveis</div>
          )}
        </CardContent>
      </Card>
      </>}

      {(selectedSection === "all" || selectedSection === "cotacoes-vendas") && <>
      <div className="flex items-center gap-2 pt-4" data-testid="section-cotacoes-vendas">
        <ShoppingCart className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Cotações / Vendas</h2>
        <div className="flex-1 h-px bg-border" />
      </div>

      {quotationsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Card key={i}><CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader><CardContent><Skeleton className="h-8 w-32" /></CardContent></Card>)}
        </div>
      ) : quotationsStats ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card data-testid="card-total-cotacoes">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" /> Total de Cotações
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{quotationsStats.total}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{quotationsStats.converted} convertidas em ordens</p>
              </CardContent>
            </Card>
            <Card data-testid="card-pipeline-ativo">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Target className="h-3.5 w-3.5" /> Pipeline Ativo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{quotationsStats.pipelineCount}</p>
                <p className="text-xs text-muted-foreground mt-0.5">rascunhos e enviadas</p>
              </CardContent>
            </Card>
            <Card data-testid="card-taxa-conversao">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Percent className="h-3.5 w-3.5" /> Taxa de Conversão
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{quotationsStats.conversionRate}%</p>
                <p className="text-xs text-muted-foreground mt-0.5">cotações decididas</p>
              </CardContent>
            </Card>
            <Card data-testid="card-valor-pipeline">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Wallet className="h-3.5 w-3.5" /> Valor em Pipeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(quotationsStats.pipelineValue)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">em aberto</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <PieChartIcon className="h-4 w-4 text-muted-foreground" />
                  Cotações por Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                {quotationsStats.statusCounts.length > 0 ? (
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width="55%" height={240}>
                      <PieChart>
                        <Pie
                          data={quotationsStats.statusCounts}
                          cx="50%" cy="50%"
                          innerRadius={55}
                          outerRadius={90}
                          paddingAngle={4}
                          dataKey="count"
                          nameKey="status"
                        >
                          {quotationsStats.statusCounts.map((_, index) => {
                            const colors = ["#94A3B8", "#3B82F6", "#22C55E", "#EF4444", "#1E4D7B"];
                            return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                          })}
                        </Pie>
                        <Tooltip
                          formatter={(v: number) => [v, "Qtd"]}
                          contentStyle={{ borderRadius: "6px", border: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))" }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-col gap-2 flex-1">
                      {quotationsStats.statusCounts.map((item, i) => {
                        const colors = ["#94A3B8", "#3B82F6", "#22C55E", "#EF4444", "#1E4D7B"];
                        return (
                          <div key={item.status} className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded-sm flex-shrink-0" style={{ backgroundColor: colors[i % colors.length] }} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs truncate capitalize">{item.status}</p>
                              <p className="text-[11px] text-muted-foreground">{item.count} cotação{item.count !== 1 ? "ões" : ""}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[240px] text-muted-foreground text-sm">Sem dados disponíveis</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  Cotações por Mês
                </CardTitle>
              </CardHeader>
              <CardContent>
                {quotationsStats.byMonth.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={quotationsStats.byMonth}>
                      <defs>
                        <linearGradient id="colorCotacoes" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ borderRadius: "6px", border: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))" }}
                      />
                      <Area type="monotone" dataKey="count" stroke="#3B82F6" strokeWidth={2} fill="url(#colorCotacoes)" name="Cotações" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[240px] text-muted-foreground text-sm">Sem dados disponíveis</div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  Top Clientes por Valor Cotado
                </CardTitle>
              </CardHeader>
              <CardContent>
                {quotationsStats.topClients.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={quotationsStats.topClients} layout="vertical" barCategoryGap="20%">
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                      <YAxis dataKey="client" type="category" tick={{ fontSize: 10 }} width={110} />
                      <Tooltip
                        formatter={(v: number) => [new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v), "Valor"]}
                        contentStyle={{ borderRadius: "6px", border: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))" }}
                      />
                      <Bar dataKey="valor" fill="#1E4D7B" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[240px] text-muted-foreground text-sm">Sem dados disponíveis</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  Cotações por Produto
                </CardTitle>
              </CardHeader>
              <CardContent>
                {quotationsStats.byProduct.length > 0 ? (
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width="55%" height={240}>
                      <PieChart>
                        <Pie
                          data={quotationsStats.byProduct}
                          cx="50%" cy="50%"
                          innerRadius={55}
                          outerRadius={90}
                          paddingAngle={4}
                          dataKey="count"
                          nameKey="product"
                        >
                          {quotationsStats.byProduct.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v: number) => [v, "Qtd"]}
                          contentStyle={{ borderRadius: "6px", border: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))" }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-col gap-2 flex-1">
                      {quotationsStats.byProduct.map((item, i) => (
                        <div key={item.product} className="flex items-center gap-2">
                          <div className="h-3 w-3 rounded-sm flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs truncate">{item.product}</p>
                            <p className="text-[11px] text-muted-foreground">{item.count} cotações</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[240px] text-muted-foreground text-sm">Sem dados disponíveis</div>
                )}
              </CardContent>
            </Card>
          </div>

          {quotationsStats.recentActive.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  Pipeline — Cotações Abertas
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {quotationsStats.recentActive.map(q => {
                    const statusColor = q.status === "enviada"
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
                    const statusLabel = q.status === "enviada" ? "Enviada" : "Rascunho";
                    const isExpired = q.validityDate && new Date(q.validityDate) < new Date();
                    return (
                      <div key={q.id} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors" data-testid={`row-cotacao-${q.id}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">{q.client?.name ?? "—"}</p>
                            <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${statusColor}`}>{statusLabel}</span>
                            {isExpired && <span className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">Vencida</span>}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{q.product?.type ?? "—"} · {q.quantity} unid.</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold">
                            {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(q.total ?? 0))}
                          </p>
                          {q.validityDate && (
                            <p className={`text-[11px] ${isExpired ? "text-red-500" : "text-muted-foreground"}`}>
                              Val. {new Date(q.validityDate + "T00:00:00").toLocaleDateString("pt-BR")}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="flex items-center justify-center h-40 text-muted-foreground text-sm">
            Nenhuma cotação cadastrada
          </CardContent>
        </Card>
      )}
      </>}

      {selectedSection === "favorito" && (
        <div data-testid="section-favorito" className="space-y-6 pt-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Star className="h-5 w-5 fill-amber-400 text-amber-500" />
                Gráficos Favoritos
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Consultas favoritas da Consulta Inteligente. Favorite um gráfico lá para ele aparecer aqui.
              </p>
            </div>
            {favoritos.length > 0 && (
              <Badge variant="outline" className="text-xs">{favoritos.length} favorito{favoritos.length !== 1 ? "s" : ""}</Badge>
            )}
          </div>

          {favoritosLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {[1,2].map(i => <Skeleton key={i} className="h-80 w-full rounded-xl" />)}
            </div>
          ) : favoritos.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                <Star className="h-12 w-12 opacity-20" />
                <p className="text-base font-medium">Nenhum favorito ainda</p>
                <p className="text-sm text-center max-w-sm">
                  Acesse a <strong>Consulta Inteligente</strong>, faça uma pergunta e clique em <strong>"Favoritar"</strong> no resultado para ele aparecer aqui.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {favoritos.map((fav: any) => {
                const results: any[] = Array.isArray(fav.result) ? fav.result : [];
                return results.map((result: any, idx: number) => (
                  <Card key={`${fav.id}-${idx}`} className="overflow-hidden" data-testid={`fav-card-${fav.id}-${idx}`}>
                    <CardHeader className="pb-3 border-b">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            {chartKindIcon(result.chartSuggestions?.[0]?.type ?? "bar", "h-4 w-4 shrink-0 text-primary")}
                            <span className="truncate">{result.chartTitle}</span>
                          </CardTitle>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{fav.question}</p>
                          <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                            {formatDistanceToNow(new Date(fav.createdAt), { addSuffix: true, locale: ptBRLocale })}
                            {" · "}{result.rows?.length ?? 0} registro{(result.rows?.length ?? 0) !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <button
                          className="shrink-0 p-1.5 rounded-lg text-amber-500 hover:text-muted-foreground hover:bg-muted/50 transition-colors"
                          onClick={() => removeFavoriteMut.mutate(fav.id)}
                          title="Remover dos favoritos"
                          data-testid={`button-remove-fav-${fav.id}`}
                        >
                          <Star className="h-4 w-4 fill-amber-400" />
                        </button>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                      {result.rows?.length > 0 ? (
                        <DynamicChart
                          rows={result.rows}
                          chartType={result.chartSuggestions?.[0]?.type ?? "bar"}
                          xAxisKey={result.xAxisKey ?? ""}
                          yAxisKey={result.yAxisKey ?? ""}
                          valueLabel={result.valueLabel ?? ""}
                          chartTitle={result.chartTitle ?? ""}
                        />
                      ) : (
                        <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                          Sem dados disponíveis
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ));
              })}
            </div>
          )}
        </div>
      )}

      <DrillDownDialog
        state={drillDown}
        onClose={() => setDrillDown(null)}
        orders={orders ?? []}
      />
    </div>
  );
}
