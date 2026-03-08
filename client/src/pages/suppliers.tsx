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
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Search, Pencil, Trash2, Factory } from "lucide-react";
import { insertSupplierSchema, type Supplier, type InsertSupplier } from "@shared/schema";

function SupplierForm({ editSupplier, onSuccess }: { editSupplier: Supplier | null; onSuccess: () => void }) {
  const { toast } = useToast();
  const form = useForm<InsertSupplier>({
    resolver: zodResolver(insertSupplierSchema),
    defaultValues: editSupplier
      ? {
          name: editSupplier.name,
          cnpj: editSupplier.cnpj || "",
          contact: editSupplier.contact || "",
          phone: editSupplier.phone || "",
          email: editSupplier.email || "",
          city: editSupplier.city || "",
          state: editSupplier.state || "",
        }
      : { name: "", cnpj: "", contact: "", phone: "", email: "", city: "", state: "" },
  });

  const mutation = useMutation({
    mutationFn: (data: InsertSupplier) =>
      editSupplier
        ? apiRequest("PATCH", `/api/suppliers/${editSupplier.id}`, data)
        : apiRequest("POST", "/api/suppliers", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      toast({ title: editSupplier ? "Fornecedor atualizado" : "Fornecedor criado" });
      onSuccess();
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
        <FormField control={form.control} name="name" render={({ field }) => (
          <FormItem>
            <FormLabel>Nome do Fornecedor</FormLabel>
            <FormControl><Input {...field} placeholder="Ex: Klabin S.A." data-testid="input-supplier-name" /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField control={form.control} name="cnpj" render={({ field }) => (
            <FormItem>
              <FormLabel>CNPJ</FormLabel>
              <FormControl><Input {...field} value={field.value || ""} placeholder="00.000.000/0000-00" data-testid="input-supplier-cnpj" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="contact" render={({ field }) => (
            <FormItem>
              <FormLabel>Contato</FormLabel>
              <FormControl><Input {...field} value={field.value || ""} placeholder="Nome do contato" data-testid="input-supplier-contact" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="phone" render={({ field }) => (
            <FormItem>
              <FormLabel>Telefone</FormLabel>
              <FormControl><Input {...field} value={field.value || ""} placeholder="(00) 00000-0000" data-testid="input-supplier-phone" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="email" render={({ field }) => (
            <FormItem>
              <FormLabel>E-mail</FormLabel>
              <FormControl><Input type="email" {...field} value={field.value || ""} placeholder="contato@empresa.com" data-testid="input-supplier-email" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="city" render={({ field }) => (
            <FormItem>
              <FormLabel>Cidade</FormLabel>
              <FormControl><Input {...field} value={field.value || ""} placeholder="Cidade" data-testid="input-supplier-city" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="state" render={({ field }) => (
            <FormItem>
              <FormLabel>Estado (UF)</FormLabel>
              <FormControl><Input {...field} value={field.value || ""} placeholder="SP" maxLength={2} data-testid="input-supplier-state" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
        <Button type="submit" className="w-full" disabled={mutation.isPending} data-testid="button-submit-supplier">
          {mutation.isPending ? "Salvando..." : editSupplier ? "Atualizar" : "Criar Fornecedor"}
        </Button>
      </form>
    </Form>
  );
}

export default function Suppliers() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);

  const { data: suppliersList, isLoading } = useQuery<Supplier[]>({ queryKey: ["/api/suppliers"] });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/suppliers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      toast({ title: "Fornecedor excluido" });
    },
  });

  const filtered = suppliersList?.filter((s) =>
    !search ||
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.cnpj && s.cnpj.includes(search)) ||
    (s.city && s.city.toLowerCase().includes(search.toLowerCase()))
  ) || [];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-suppliers-title">Fornecedores</h1>
          <p className="text-muted-foreground text-sm">Gerenciar fornecedores de papel kraft</p>
        </div>
        <Dialog open={formOpen} onOpenChange={(v) => { setFormOpen(v); if (!v) setEditSupplier(null); }}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-supplier" onClick={() => { setEditSupplier(null); setFormOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Fornecedor
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editSupplier ? "Editar Fornecedor" : "Novo Fornecedor"}</DialogTitle></DialogHeader>
            <SupplierForm editSupplier={editSupplier} onSuccess={() => { setFormOpen(false); setEditSupplier(null); }} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, CNPJ ou cidade..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          data-testid="input-search-suppliers"
        />
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="pt-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Factory className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1">Nenhum fornecedor encontrado</h3>
            <p className="text-sm text-muted-foreground">Adicione seu primeiro fornecedor para começar.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Cidade/UF</TableHead>
                  <TableHead className="text-right w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((supplier) => (
                  <TableRow key={supplier.id} data-testid={`row-supplier-${supplier.id}`}>
                    <TableCell className="font-medium">{supplier.name}</TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">{supplier.cnpj || "-"}</TableCell>
                    <TableCell className="text-muted-foreground">{supplier.contact || "-"}</TableCell>
                    <TableCell className="text-muted-foreground">{supplier.phone || "-"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {supplier.city && supplier.state
                        ? `${supplier.city}/${supplier.state}`
                        : supplier.city || supplier.state || "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => { setEditSupplier(supplier); setFormOpen(true); }}
                          data-testid={`button-edit-supplier-${supplier.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            if (confirm("Tem certeza?")) deleteMutation.mutate(supplier.id);
                          }}
                          data-testid={`button-delete-supplier-${supplier.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
