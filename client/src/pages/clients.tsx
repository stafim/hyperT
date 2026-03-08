import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Pencil, Trash2, Users, Globe } from "lucide-react";
import { insertClientSchema, type Client, type InsertClient } from "@shared/schema";

function formatCurrency(value: number | string) {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD" }).format(num);
}

function ClientForm({ editClient, onSuccess }: { editClient: Client | null; onSuccess: () => void }) {
  const { toast } = useToast();
  const form = useForm<InsertClient>({
    resolver: zodResolver(insertClientSchema),
    defaultValues: editClient
      ? { name: editClient.name, country: editClient.country, creditLimit: editClient.creditLimit, paymentTerms: editClient.paymentTerms }
      : { name: "", country: "", creditLimit: "0", paymentTerms: "" },
  });

  const mutation = useMutation({
    mutationFn: (data: InsertClient) =>
      editClient
        ? apiRequest("PATCH", `/api/clients/${editClient.id}`, data)
        : apiRequest("POST", "/api/clients", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: editClient ? "Cliente atualizado" : "Cliente criado" });
      onSuccess();
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
        <FormField control={form.control} name="name" render={({ field }) => (
          <FormItem>
            <FormLabel>Nome</FormLabel>
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
        <Button type="submit" className="w-full" disabled={mutation.isPending} data-testid="button-submit-client">
          {mutation.isPending ? "Salvando..." : editClient ? "Atualizar" : "Criar Cliente"}
        </Button>
      </form>
    </Form>
  );
}

export default function Clients() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);

  const { data: clients, isLoading } = useQuery<Client[]>({ queryKey: ["/api/clients"] });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/clients/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "Cliente excluído" });
    },
  });

  const filtered = clients?.filter((c) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.country.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-clients-title">Clientes</h1>
          <p className="text-muted-foreground text-sm">Gerenciar clientes de exportação</p>
        </div>
        <Dialog open={formOpen} onOpenChange={(v) => { setFormOpen(v); if (!v) setEditClient(null); }}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-client" onClick={() => { setEditClient(null); setFormOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editClient ? "Editar Cliente" : "Novo Cliente"}</DialogTitle></DialogHeader>
            <ClientForm editClient={editClient} onSuccess={() => { setFormOpen(false); setEditClient(null); }} />
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
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
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
                <TableHead className="text-right">Limite de Crédito</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((client) => (
                <TableRow key={client.id} data-testid={`row-client-${client.id}`}>
                  <TableCell className="font-medium">{client.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Globe className="h-3 w-3 text-muted-foreground" />
                      <span>{client.country}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(client.creditLimit)}</TableCell>
                  <TableCell>{client.paymentTerms}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => { setEditClient(client); setFormOpen(true); }}
                        data-testid={`button-edit-client-${client.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (confirm("Tem certeza?")) deleteMutation.mutate(client.id);
                        }}
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
