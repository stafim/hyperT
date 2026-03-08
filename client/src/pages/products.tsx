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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Pencil, Trash2, Package } from "lucide-react";
import { insertProductSchema, type Product, type InsertProduct, type Supplier } from "@shared/schema";

function formatCurrency(value: number | string) {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD" }).format(num);
}

function ProductForm({ editProduct, suppliers, onSuccess }: { editProduct: Product | null; suppliers: Supplier[]; onSuccess: () => void }) {
  const { toast } = useToast();
  const form = useForm<InsertProduct>({
    resolver: zodResolver(insertProductSchema),
    defaultValues: editProduct
      ? { type: editProduct.type, grammage: editProduct.grammage, standardPrice: editProduct.standardPrice, supplierId: editProduct.supplierId ?? undefined }
      : { type: "", grammage: "", standardPrice: "0", supplierId: undefined },
  });

  const mutation = useMutation({
    mutationFn: (data: InsertProduct) =>
      editProduct
        ? apiRequest("PATCH", `/api/products/${editProduct.id}`, data)
        : apiRequest("POST", "/api/products", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: editProduct ? "Produto atualizado" : "Produto criado" });
      onSuccess();
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
        <FormField control={form.control} name="type" render={({ field }) => (
          <FormItem>
            <FormLabel>Tipo de Produto</FormLabel>
            <FormControl><Input {...field} placeholder="Ex: Standard Brown Kraft" data-testid="input-product-type" /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="grammage" render={({ field }) => (
          <FormItem>
            <FormLabel>Gramatura</FormLabel>
            <FormControl><Input {...field} placeholder="Ex: 80g/m²" data-testid="input-product-grammage" /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="standardPrice" render={({ field }) => (
          <FormItem>
            <FormLabel>Preço Padrão (USD)</FormLabel>
            <FormControl><Input type="number" step="0.01" {...field} data-testid="input-product-price" /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="supplierId" render={({ field }) => (
          <FormItem>
            <FormLabel>Fornecedor</FormLabel>
            <Select onValueChange={(v) => field.onChange(v === "none" ? null : Number(v))} value={field.value ? String(field.value) : "none"}>
              <FormControl>
                <SelectTrigger data-testid="select-product-supplier"><SelectValue placeholder="Selecionar fornecedor" /></SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
        <Button type="submit" className="w-full" disabled={mutation.isPending} data-testid="button-submit-product">
          {mutation.isPending ? "Salvando..." : editProduct ? "Atualizar" : "Criar Produto"}
        </Button>
      </form>
    </Form>
  );
}

export default function Products() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);

  const { data: products, isLoading } = useQuery<Product[]>({ queryKey: ["/api/products"] });
  const { data: suppliersList } = useQuery<Supplier[]>({ queryKey: ["/api/suppliers"] });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/products/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Produto excluído" });
    },
  });

  const filtered = products?.filter((p) =>
    !search || p.type.toLowerCase().includes(search.toLowerCase()) || p.grammage.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-products-title">Produtos</h1>
          <p className="text-muted-foreground text-sm">Gerenciar tipos de papel kraft</p>
        </div>
        <Dialog open={formOpen} onOpenChange={(v) => { setFormOpen(v); if (!v) setEditProduct(null); }}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-product" onClick={() => { setEditProduct(null); setFormOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Produto
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editProduct ? "Editar Produto" : "Novo Produto"}</DialogTitle></DialogHeader>
            <ProductForm editProduct={editProduct} suppliers={suppliersList || []} onSuccess={() => { setFormOpen(false); setEditProduct(null); }} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por tipo ou gramatura..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          data-testid="input-search-products"
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
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1">Nenhum produto encontrado</h3>
            <p className="text-sm text-muted-foreground">Adicione seu primeiro produto para começar.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo de Produto</TableHead>
                  <TableHead>Gramatura</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead className="text-right">Preço Padrão</TableHead>
                  <TableHead className="text-right w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((product) => {
                  const supplier = suppliersList?.find((s) => s.id === product.supplierId);
                  return (
                  <TableRow key={product.id} data-testid={`row-product-${product.id}`}>
                    <TableCell className="font-medium">{product.type}</TableCell>
                    <TableCell className="text-muted-foreground">{product.grammage}</TableCell>
                    <TableCell className="text-muted-foreground">{supplier?.name || "-"}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{formatCurrency(product.standardPrice)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => { setEditProduct(product); setFormOpen(true); }}
                          data-testid={`button-edit-product-${product.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            if (confirm("Tem certeza?")) deleteMutation.mutate(product.id);
                          }}
                          data-testid={`button-delete-product-${product.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
