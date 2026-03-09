import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { SiTelegram } from "react-icons/si";
import { FileCheck, FileText, Users, Factory, Package, Send, Loader2, AlertCircle, CheckCircle2, ShieldCheck } from "lucide-react";
import type { TelegramConfig } from "@shared/schema";

const EVENTS = [
  {
    key: "onNewQuotation" as const,
    label: "Nova Cotação",
    description: "Notificar quando uma nova cotação for criada",
    icon: FileCheck,
    color: "text-blue-500",
  },
  {
    key: "onNewOrder" as const,
    label: "Nova Ordem de Exportação",
    description: "Notificar quando uma nova ordem de exportação for criada",
    icon: FileText,
    color: "text-purple-500",
  },
  {
    key: "onNewClient" as const,
    label: "Novo Cliente",
    description: "Notificar quando um novo cliente for cadastrado",
    icon: Users,
    color: "text-green-500",
  },
  {
    key: "onNewSupplier" as const,
    label: "Novo Fornecedor",
    description: "Notificar quando um novo fornecedor for cadastrado",
    icon: Factory,
    color: "text-orange-500",
  },
  {
    key: "onNewProduct" as const,
    label: "Novo Produto",
    description: "Notificar quando um novo produto for cadastrado",
    icon: Package,
    color: "text-red-500",
  },
];

export default function TelegramConfigPage() {
  const { toast } = useToast();

  const { data: statusData } = useQuery<{ configured: boolean }>({
    queryKey: ["/api/telegram/status"],
    queryFn: () => fetch("/api/telegram/status").then(r => r.json()),
  });

  const { data: config, isLoading } = useQuery<TelegramConfig>({
    queryKey: ["/api/telegram/config"],
    queryFn: () => fetch("/api/telegram/config").then(r => r.json()),
  });

  const saveMut = useMutation({
    mutationFn: (data: Partial<TelegramConfig>) =>
      apiRequest("PUT", "/api/telegram/config", data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/telegram/config"] });
      toast({ title: "Configuração salva", description: "As preferências de notificação foram atualizadas." });
    },
    onError: (e: any) => {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    },
  });

  const testMut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/telegram/test").then(r => r.json()),
    onSuccess: (data: any) => toast({ title: "✅ Enviado!", description: data.message }),
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  function toggle(field: keyof Omit<TelegramConfig, "id" | "updatedAt">, value: boolean) {
    if (!config) return;
    saveMut.mutate({ ...config, [field]: value });
  }

  const configured = statusData?.configured ?? false;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <SiTelegram className="h-8 w-8 text-[#2AABEE]" />
        <div>
          <h1 className="text-2xl font-bold">Notificações Telegram</h1>
          <p className="text-sm text-muted-foreground">Configure quais eventos disparam mensagens no grupo Telegram</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Status da Integração</CardTitle>
              <CardDescription>Credenciais do bot Telegram</CardDescription>
            </div>
            {configured ? (
              <Badge variant="outline" className="gap-1.5 border-green-500 text-green-600">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Configurado
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1.5 border-red-400 text-red-500">
                <AlertCircle className="h-3.5 w-3.5" />
                Não configurado
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={!configured || testMut.isPending}
            onClick={() => testMut.mutate()}
            data-testid="button-telegram-test-config"
          >
            {testMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar mensagem de teste
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Ativar Notificações</CardTitle>
              <CardDescription>Liga ou desliga todas as notificações automáticas</CardDescription>
            </div>
            <Switch
              checked={config?.enabled ?? false}
              onCheckedChange={(v) => toggle("enabled", v)}
              disabled={saveMut.isPending || !configured}
              data-testid="switch-telegram-enabled"
            />
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Eventos para Notificar</CardTitle>
          <CardDescription>
            Selecione quais cadastros disparam uma mensagem no Telegram.
            {!config?.enabled && (
              <span className="ml-1 text-amber-500 font-medium">As notificações estão desativadas.</span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {EVENTS.map((event, idx) => {
            const Icon = event.icon;
            const isOn = config ? config[event.key] : false;
            return (
              <div key={event.key}>
                {idx > 0 && <Separator className="my-1" />}
                <div className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-3">
                    <Icon className={`h-5 w-5 shrink-0 ${event.color}`} />
                    <div>
                      <Label htmlFor={`switch-${event.key}`} className="text-sm font-medium cursor-pointer">
                        {event.label}
                      </Label>
                      <p className="text-xs text-muted-foreground">{event.description}</p>
                    </div>
                  </div>
                  <Switch
                    id={`switch-${event.key}`}
                    checked={isOn}
                    onCheckedChange={(v) => toggle(event.key, v)}
                    disabled={saveMut.isPending || !configured || !config?.enabled}
                    data-testid={`switch-${event.key}`}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
        <ShieldCheck className="h-3.5 w-3.5" />
        As mensagens são enviadas ao chat configurado nas variáveis de ambiente do servidor.
      </p>
    </div>
  );
}
