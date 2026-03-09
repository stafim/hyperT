import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Plus, Search, Trash2, Users, Globe, Eye, Mail, Phone, User, FileText,
  MapPin, Hash, Building, ClipboardList, AlertCircle
} from "lucide-react";
import { z } from "zod";
import { type Client, type ClientDocument } from "@shared/schema";

const clientFormSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  country: z.string().min(1, "País é obrigatório"),
  creditLimit: z.string().default("0"),
  paymentTerms: z.string().default(""),
  email: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  responsavel: z.string().optional().default(""),
  registroNacional: z.string().optional().default(""),
  address: z.string().optional().default(""),
  city: z.string().optional().default(""),
  state: z.string().optional().default(""),
  zipCode: z.string().optional().default(""),
  notes: z.string().optional().default(""),
});
type ClientFormValues = z.infer<typeof clientFormSchema>;

const docFormSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  tipo: z.string().default("outro"),
  numero: z.string().optional().default(""),
  emissao: z.string().optional().default(""),
  validade: z.string().optional().default(""),
  observacoes: z.string().optional().default(""),
});
type DocFormValues = z.infer<typeof docFormSchema>;

type ExportOrderLite = {
  id: number;
  orderNumber: string;
  saleDate: string | null;
  dueDate: string | null;
  status: string;
  paymentStatus: string;
  totalQty: string | number;
  unitPrice: string | number;
  total: string | number | null;
  product?: { type: string } | null;
};

function formatCurrency(value: number | string | null | undefined) {
  if (value === null || value === undefined) return "—";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(num);
}

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("pt-BR");
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    draft: "secondary",
    confirmed: "default",
    shipped: "default",
    delivered: "default",
    cancelled: "destructive",
  };
  const labels: Record<string, string> = {
    draft: "Rascunho", confirmed: "Confirmado", shipped: "Embarcado",
    delivered: "Entregue", cancelled: "Cancelado",
  };
  return <Badge variant={(map[status] ?? "secondary") as "secondary" | "default" | "destructive"}>{labels[status] ?? status}</Badge>;
}

function paymentBadge(status: string) {
  if (status === "paid") return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Pago</Badge>;
  if (status === "overdue") return <Badge variant="destructive">Em atraso</Badge>;
  return <Badge variant="secondary">Pendente</Badge>;
}

const DOC_TIPOS = ["contrato", "licença", "certificado", "procuração", "registro", "outro"];
const DOC_TIPO_LABELS: Record<string, string> = {
  contrato: "Contrato", licença: "Licença", certificado: "Certificado",
  procuração: "Procuração", registro: "Registro", outro: "Outro",
};

function ClientProfileForm({ client, onSuccess }: { client: Client; onSuccess: (updated: Client) => void }) {
  const { toast } = useToast();
  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      name: client.name ?? "",
      country: client.country ?? "",
      creditLimit: client.creditLimit ?? "0",
      paymentTerms: client.paymentTerms ?? "",
      email: client.email ?? "",
      phone: client.phone ?? "",
      responsavel: client.responsavel ?? "",
      registroNacional: client.registroNacional ?? "",
      address: client.address ?? "",
      city: client.city ?? "",
      state: client.state ?? "",
      zipCode: client.zipCode ?? "",
      notes: client.notes ?? "",
    },
  });

  const mutation = useMutation({
    mutationFn: (data: ClientFormValues) => apiRequest("PATCH", `/api/clients/${client.id}`, data),
    onSuccess: async (res) => {
      const updated = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "Cliente atualizado com sucesso" });
      onSuccess(updated);
    },
    onError: (e: Error) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
            <Building className="h-3.5 w-3.5" />Dados da Empresa
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Nome / Razão Social</FormLabel>
                <FormControl><Input {...field} data-testid="input-client-name" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="country" render={({ field }) => (
              <FormItem>
                <FormLabel>País</FormLabel>
                <FormControl><Input {...field} data-testid="input-client-country" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="registroNacional" render={({ field }) => (
              <FormItem>
                <FormLabel>Registro Nacional (CUIT/RUC/RUT)</FormLabel>
                <FormControl><Input {...field} value={field.value ?? ""} placeholder="Ex: 20-12345678-9" data-testid="input-client-registro" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="creditLimit" render={({ field }) => (
              <FormItem>
                <FormLabel>Limite de Crédito (USD)</FormLabel>
                <FormControl><Input type="number" step="0.01" {...field} data-testid="input-client-credit" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="paymentTerms" render={({ field }) => (
              <FormItem>
                <FormLabel>Termos de Pagamento</FormLabel>
                <FormControl><Input {...field} placeholder="Ex: 30/60/90 dias" data-testid="input-client-terms" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
            <User className="h-3.5 w-3.5" />Contato
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField control={form.control} name="responsavel" render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Responsável / Contato Principal</FormLabel>
                <FormControl><Input {...field} value={field.value ?? ""} placeholder="Nome do responsável" data-testid="input-client-responsavel" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel>E-mail</FormLabel>
                <FormControl><Input type="email" {...field} value={field.value ?? ""} data-testid="input-client-email" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="phone" render={({ field }) => (
              <FormItem>
                <FormLabel>Telefone / WhatsApp</FormLabel>
                <FormControl><Input {...field} value={field.value ?? ""} placeholder="+55 11 9 9999-9999" data-testid="input-client-phone" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5" />Endereço
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField control={form.control} name="address" render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Endereço</FormLabel>
                <FormControl><Input {...field} value={field.value ?? ""} placeholder="Rua, número, complemento" data-testid="input-client-address" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="city" render={({ field }) => (
              <FormItem>
                <FormLabel>Cidade</FormLabel>
                <FormControl><Input {...field} value={field.value ?? ""} data-testid="input-client-city" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="state" render={({ field }) => (
              <FormItem>
                <FormLabel>Estado / Província</FormLabel>
                <FormControl><Input {...field} value={field.value ?? ""} data-testid="input-client-state" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="zipCode" render={({ field }) => (
              <FormItem>
                <FormLabel>CEP / Código Postal</FormLabel>
                <FormControl><Input {...field} value={field.value ?? ""} data-testid="input-client-zipcode" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
            <ClipboardList className="h-3.5 w-3.5" />Observações
          </h3>
          <FormField control={form.control} name="notes" render={({ field }) => (
            <FormItem>
              <FormControl>
                <Textarea {...field} value={field.value ?? ""} rows={3} placeholder="Notas internas sobre o cliente..." data-testid="input-client-notes" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <Button type="submit" className="w-full" disabled={mutation.isPending} data-testid="button-save-client-profile">
          {mutation.isPending ? "Salvando..." : "Salvar Alterações"}
        </Button>
      </form>
    </Form>
  );
}

function ClientDocumentsTab({ clientId }: { clientId: number }) {
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const form = useForm<DocFormValues>({
    resolver: zodResolver(docFormSchema),
    defaultValues: { nome: "", tipo: "outro", numero: "", emissao: "", validade: "", observacoes: "" },
  });

  const { data: docs, isLoading } = useQuery<ClientDocument[]>({
    queryKey: ["/api/clients", clientId, "documents"],
    queryFn: async () => {
      const res = await fetch(`/api/clients/${clientId}/documents`);
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: DocFormValues) =>
      apiRequest("POST", `/api/clients/${clientId}/documents`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "documents"] });
      toast({ title: "Documento adicionado" });
      form.reset();
      setAddOpen(false);
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (docId: number) => apiRequest("DELETE", `/api/clients/${clientId}/documents/${docId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "documents"] });
      toast({ title: "Documento removido" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">Documentos e registros do cliente</p>
        <Button size="sm" onClick={() => setAddOpen(true)} data-testid="button-add-document">
          <Plus className="h-4 w-4 mr-1" />Adicionar
        </Button>
      </div>

      {addOpen && (
        <Card className="border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Novo Documento</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField control={form.control} name="nome" render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Nome do Documento</FormLabel>
                    <FormControl><Input {...field} placeholder="Ex: Contrato Comercial 2025" data-testid="input-doc-nome" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="tipo" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-doc-tipo">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {DOC_TIPOS.map((t) => (
                          <SelectItem key={t} value={t}>{DOC_TIPO_LABELS[t]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="numero" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número / Referência</FormLabel>
                    <FormControl><Input {...field} value={field.value ?? ""} placeholder="Ex: CTR-001/2025" data-testid="input-doc-numero" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="emissao" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Emissão</FormLabel>
                    <FormControl><Input type="date" {...field} value={field.value ?? ""} data-testid="input-doc-emissao" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="validade" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Validade</FormLabel>
                    <FormControl><Input type="date" {...field} value={field.value ?? ""} data-testid="input-doc-validade" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="observacoes" render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Observações</FormLabel>
                    <FormControl><Textarea {...field} value={field.value ?? ""} rows={2} data-testid="input-doc-observacoes" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="sm:col-span-2 flex gap-2 justify-end">
                  <Button type="button" variant="outline" size="sm" onClick={() => { setAddOpen(false); form.reset(); }}>Cancelar</Button>
                  <Button type="submit" size="sm" disabled={createMutation.isPending} data-testid="button-save-document">
                    {createMutation.isPending ? "Salvando..." : "Salvar"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-2">{[1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
      ) : !docs || docs.length === 0 ? (
        <div className="flex flex-col items-center py-10 text-center">
          <FileText className="h-10 w-10 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum documento cadastrado</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Número</TableHead>
                <TableHead>Emissão</TableHead>
                <TableHead>Validade</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docs.map((doc) => {
                const isExpired = doc.validade ? new Date(doc.validade + "T00:00:00") < new Date() : false;
                return (
                  <TableRow key={doc.id} data-testid={`row-doc-${doc.id}`}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-1">
                        {doc.nome}
                        {isExpired && <AlertCircle className="h-3.5 w-3.5 text-red-500" aria-label="Vencido" />}
                      </div>
                      {doc.observacoes && <p className="text-xs text-muted-foreground truncate max-w-40">{doc.observacoes}</p>}
                    </TableCell>
                    <TableCell><Badge variant="outline">{DOC_TIPO_LABELS[doc.tipo] ?? doc.tipo}</Badge></TableCell>
                    <TableCell className="text-sm">{doc.numero || "—"}</TableCell>
                    <TableCell className="text-sm">{formatDate(doc.emissao)}</TableCell>
                    <TableCell className={`text-sm ${isExpired ? "text-red-500 font-medium" : ""}`}>{formatDate(doc.validade)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => { if (confirm("Remover documento?")) deleteMutation.mutate(doc.id); }}
                        data-testid={`button-delete-doc-${doc.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function ClientOrdersTab({ clientId }: { clientId: number }) {
  const { data: orders, isLoading } = useQuery<ExportOrderLite[]>({
    queryKey: ["/api/clients", clientId, "orders"],
    queryFn: async () => {
      const res = await fetch(`/api/clients/${clientId}/orders`);
      return res.json();
    },
  });

  const totalUsd = orders?.reduce((acc, o) => acc + (parseFloat(String(o.total ?? 0)) || 0), 0) ?? 0;
  const paidCount = orders?.filter((o) => o.paymentStatus === "paid").length ?? 0;
  const pendingCount = orders?.filter((o) => o.paymentStatus === "pending" || o.paymentStatus === "overdue").length ?? 0;

  return (
    <div className="space-y-4">
      {!isLoading && orders && orders.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">Total de Ordens</p>
              <p className="text-xl font-bold" data-testid="text-client-orders-count">{orders.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">Receita Total</p>
              <p className="text-xl font-bold" data-testid="text-client-orders-total">{formatCurrency(totalUsd)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">Pagas / Pendentes</p>
              <p className="text-xl font-bold" data-testid="text-client-orders-status">{paidCount} / {pendingCount}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
      ) : !orders || orders.length === 0 ? (
        <div className="flex flex-col items-center py-10 text-center">
          <ClipboardList className="h-10 w-10 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Nenhuma ordem de exportação registrada para este cliente</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº Pedido</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Data Venda</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Total (USD)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Pagamento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id} data-testid={`row-order-${order.id}`}>
                  <TableCell className="font-mono text-sm">{order.orderNumber}</TableCell>
                  <TableCell className="text-sm">{order.product?.type ?? "—"}</TableCell>
                  <TableCell className="text-sm">{formatDate(order.saleDate)}</TableCell>
                  <TableCell className="text-sm">{formatDate(order.dueDate)}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(order.total)}</TableCell>
                  <TableCell>{statusBadge(order.status)}</TableCell>
                  <TableCell>{paymentBadge(order.paymentStatus)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function ClientProfileDialog({ client, onClientUpdated }: { client: Client; onClientUpdated: (c: Client) => void }) {
  const [open, setOpen] = useState(false);
  const [localClient, setLocalClient] = useState(client);

  const handleUpdated = (updated: Client) => {
    setLocalClient(updated);
    onClientUpdated(updated);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" data-testid={`button-view-client-${client.id}`} onClick={() => setOpen(true)}>
          <Eye className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            {localClient.name}
            <Badge variant="outline" className="ml-1 font-normal text-xs">{localClient.country}</Badge>
          </DialogTitle>
          {localClient.responsavel && (
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <User className="h-3.5 w-3.5" />{localClient.responsavel}
              {localClient.email && <span className="ml-2 flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{localClient.email}</span>}
              {localClient.phone && <span className="ml-2 flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{localClient.phone}</span>}
            </p>
          )}
        </DialogHeader>

        <Tabs defaultValue="perfil">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="perfil" data-testid="tab-perfil">Perfil</TabsTrigger>
            <TabsTrigger value="documentos" data-testid="tab-documentos">Documentos</TabsTrigger>
            <TabsTrigger value="historico" data-testid="tab-historico">Histórico</TabsTrigger>
          </TabsList>
          <TabsContent value="perfil" className="pt-4">
            <ClientProfileForm client={localClient} onSuccess={handleUpdated} />
          </TabsContent>
          <TabsContent value="documentos" className="pt-4">
            <ClientDocumentsTab clientId={localClient.id} />
          </TabsContent>
          <TabsContent value="historico" className="pt-4">
            <ClientOrdersTab clientId={localClient.id} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function NewClientForm({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      name: "", country: "", creditLimit: "0", paymentTerms: "",
      email: "", phone: "", responsavel: "", registroNacional: "",
      address: "", city: "", state: "", zipCode: "", notes: "",
    },
  });

  const mutation = useMutation({
    mutationFn: (data: ClientFormValues) => apiRequest("POST", "/api/clients", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "Cliente criado com sucesso" });
      onSuccess();
    },
    onError: (e: Error) => toast({ title: "Erro ao criar", description: e.message, variant: "destructive" }),
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <FormLabel>Nome / Razão Social *</FormLabel>
              <FormControl><Input {...field} data-testid="input-new-client-name" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="country" render={({ field }) => (
            <FormItem>
              <FormLabel>País *</FormLabel>
              <FormControl><Input {...field} data-testid="input-new-client-country" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="registroNacional" render={({ field }) => (
            <FormItem>
              <FormLabel>Registro Nacional</FormLabel>
              <FormControl><Input {...field} value={field.value ?? ""} placeholder="CUIT / RUC / RUT" data-testid="input-new-client-registro" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="creditLimit" render={({ field }) => (
            <FormItem>
              <FormLabel>Limite de Crédito (USD)</FormLabel>
              <FormControl><Input type="number" step="0.01" {...field} data-testid="input-new-client-credit" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="paymentTerms" render={({ field }) => (
            <FormItem>
              <FormLabel>Termos de Pagamento</FormLabel>
              <FormControl><Input {...field} placeholder="Ex: 30/60/90 dias" data-testid="input-new-client-terms" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="responsavel" render={({ field }) => (
            <FormItem>
              <FormLabel>Responsável</FormLabel>
              <FormControl><Input {...field} value={field.value ?? ""} data-testid="input-new-client-responsavel" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="email" render={({ field }) => (
            <FormItem>
              <FormLabel>E-mail</FormLabel>
              <FormControl><Input type="email" {...field} value={field.value ?? ""} data-testid="input-new-client-email" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="phone" render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <FormLabel>Telefone</FormLabel>
              <FormControl><Input {...field} value={field.value ?? ""} data-testid="input-new-client-phone" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
        <Button type="submit" className="w-full" disabled={mutation.isPending} data-testid="button-submit-new-client">
          {mutation.isPending ? "Criando..." : "Criar Cliente"}
        </Button>
      </form>
    </Form>
  );
}

export default function Clients() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [clientUpdates, setClientUpdates] = useState<Record<number, Client>>({});

  const { data: clients, isLoading } = useQuery<Client[]>({ queryKey: ["/api/clients"] });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/clients/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "Cliente excluído" });
    },
  });

  const displayClients = clients?.map((c) => clientUpdates[c.id] ?? c) ?? [];
  const filtered = displayClients.filter((c) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.country.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-clients-title">Clientes</h1>
          <p className="text-muted-foreground text-sm">Gerenciar clientes de exportação</p>
        </div>
        <Dialog open={newOpen} onOpenChange={setNewOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-client">
              <Plus className="h-4 w-4 mr-2" />
              Novo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Novo Cliente</DialogTitle></DialogHeader>
            <NewClientForm onSuccess={() => setNewOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou país..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          data-testid="input-search-clients"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1">Nenhum cliente encontrado</h3>
            <p className="text-sm text-muted-foreground">Adicione seu primeiro cliente para começar.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>País</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead className="text-right">Limite (USD)</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((client) => (
                <TableRow key={client.id} data-testid={`row-client-${client.id}`}>
                  <TableCell>
                    <div className="font-medium">{client.name}</div>
                    {client.registroNacional && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Hash className="h-3 w-3" />{client.registroNacional}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Globe className="h-3 w-3 text-muted-foreground" />
                      <span>{client.country}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{client.responsavel || "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      {client.email && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Mail className="h-3 w-3" />{client.email}
                        </span>
                      )}
                      {client.phone && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" />{client.phone}
                        </span>
                      )}
                      {!client.email && !client.phone && <span className="text-muted-foreground">—</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(client.creditLimit)}</TableCell>
                  <TableCell>{client.paymentTerms || "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <ClientProfileDialog
                        client={client}
                        onClientUpdated={(updated) => setClientUpdates((prev) => ({ ...prev, [updated.id]: updated }))}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => { if (confirm("Excluir este cliente?")) deleteMutation.mutate(client.id); }}
                        data-testid={`button-delete-client-${client.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
