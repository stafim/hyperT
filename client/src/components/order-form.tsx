import { useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import type { Client, Product, Supplier, ExportOrderWithDetails } from "@shared/schema";

interface QuotationPrefill {
  quotationId: number;
  clientId: number;
  productId: number;
  supplierId?: number;
}

interface OrderFormData {
  quotationId?: number | null;
  clientId: number;
  productId: number;
  supplierId: number | null;
  invoice: string;
  factory: string;
  nfe: string;
  bookingCrt: string;
  dueNumber: string;
  parametrizacao: "verde" | "amarelo" | "vermelho";
  modal: "rodoviario" | "maritimo";
  vessel: string;
  embarqueDate: string;
  desembarqueDate: string;
  deadlineDra: string;
  deadlineCarga: string;
  unitPrice: string;
  quantity: number;
  paymentTerms: string;
  dueDate: string;
  paymentDate: string;
  acc: string;
  exchangeClose: string;
  statusPagamento: "pendente" | "pago" | "atrasado";
  vesselStatus: "zarpou" | "etd" | "em_navegacao" | "fundeado" | "none";
}

export default function OrderForm({
  clients,
  products,
  suppliers,
  editOrder,
  quotationPrefill,
  onSuccess,
}: {
  clients: Client[];
  products: Product[];
  suppliers: Supplier[];
  editOrder: ExportOrderWithDetails | null;
  quotationPrefill?: QuotationPrefill | null;
  onSuccess: () => void;
}) {
  const { toast } = useToast();

  const form = useForm<OrderFormData>({
    defaultValues: editOrder
      ? {
          quotationId: editOrder.quotationId ?? null,
          clientId: editOrder.clientId,
          productId: editOrder.productId,
          supplierId: editOrder.supplierId ?? null,
          invoice: editOrder.invoice,
          factory: editOrder.factory,
          nfe: editOrder.nfe || "",
          bookingCrt: editOrder.bookingCrt || "",
          dueNumber: editOrder.dueNumber || "",
          parametrizacao: editOrder.parametrizacao,
          modal: editOrder.modal,
          vessel: editOrder.vessel || "",
          embarqueDate: editOrder.embarqueDate || "",
          desembarqueDate: editOrder.desembarqueDate || "",
          deadlineDra: editOrder.deadlineDra || "",
          deadlineCarga: editOrder.deadlineCarga || "",
          unitPrice: editOrder.unitPrice,
          quantity: editOrder.quantity,
          paymentTerms: editOrder.paymentTerms || "",
          dueDate: editOrder.dueDate || "",
          paymentDate: editOrder.paymentDate || "",
          acc: editOrder.acc || "",
          exchangeClose: editOrder.exchangeClose || "",
          statusPagamento: editOrder.statusPagamento,
          vesselStatus: (editOrder.vesselStatus as any) || "none",
        }
      : {
          quotationId: quotationPrefill?.quotationId || null,
          clientId: quotationPrefill?.clientId || 0,
          productId: quotationPrefill?.productId || 0,
          supplierId: quotationPrefill?.supplierId || null,
          invoice: "",
          factory: "",
          nfe: "",
          bookingCrt: "",
          dueNumber: "",
          parametrizacao: "verde",
          modal: "maritimo",
          vessel: "",
          embarqueDate: "",
          desembarqueDate: "",
          deadlineDra: "",
          deadlineCarga: "",
          unitPrice: "0",
          quantity: 0,
          paymentTerms: "",
          dueDate: "",
          paymentDate: "",
          acc: "",
          exchangeClose: "",
          statusPagamento: "pendente",
          vesselStatus: "none",
        },
  });

  const modal = form.watch("modal");
  const embarqueDate = form.watch("embarqueDate");
  const desembarqueDate = form.watch("desembarqueDate");

  useEffect(() => {
    if (embarqueDate && desembarqueDate) {
      const d1 = new Date(embarqueDate);
      const d2 = new Date(desembarqueDate);
      const diff = Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
      if (diff >= 0) {
        // Transit time will be calculated server-side
      }
    }
  }, [embarqueDate, desembarqueDate]);

  const mutation = useMutation({
    mutationFn: (data: OrderFormData) => {
      const payload: Record<string, unknown> = {
        quotationId: data.quotationId || null,
        clientId: Number(data.clientId),
        productId: Number(data.productId),
        supplierId: data.supplierId ? Number(data.supplierId) : null,
        invoice: data.invoice,
        factory: data.factory,
        nfe: data.nfe || null,
        bookingCrt: data.bookingCrt || null,
        dueNumber: data.dueNumber || null,
        parametrizacao: data.parametrizacao,
        modal: data.modal,
        vessel: data.modal === "maritimo" ? data.vessel || null : null,
        embarqueDate: data.embarqueDate || null,
        desembarqueDate: data.desembarqueDate || null,
        deadlineDra: data.deadlineDra || null,
        deadlineCarga: data.deadlineCarga || null,
        unitPrice: String(data.unitPrice),
        quantity: Number(data.quantity),
        paymentTerms: data.paymentTerms || null,
        dueDate: data.dueDate || null,
        paymentDate: data.paymentDate || null,
        acc: data.acc ? String(data.acc) : null,
        exchangeClose: data.exchangeClose ? String(data.exchangeClose) : null,
        statusPagamento: data.statusPagamento,
        vesselStatus: (!data.vesselStatus || data.vesselStatus === "none") ? null : data.vesselStatus,
      };

      return editOrder
        ? apiRequest("PATCH", `/api/orders/${editOrder.id}`, payload)
        : apiRequest("POST", "/api/orders", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: editOrder ? "Ordem atualizada" : "Ordem criada com sucesso" });
      onSuccess();
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-6">
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Dados Gerais</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={form.control} name="clientId" render={({ field }) => (
              <FormItem>
                <FormLabel>Cliente</FormLabel>
                <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value ? String(field.value) : ""}>
                  <FormControl>
                    <SelectTrigger data-testid="select-order-client"><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name} ({c.country})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="productId" render={({ field }) => (
              <FormItem>
                <FormLabel>Produto</FormLabel>
                <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value ? String(field.value) : ""}>
                  <FormControl>
                    <SelectTrigger data-testid="select-order-product"><SelectValue placeholder="Selecionar produto" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.type} - {p.grammage}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="supplierId" render={({ field }) => (
              <FormItem>
                <FormLabel>Fornecedor</FormLabel>
                <Select onValueChange={(v) => field.onChange(v === "none" ? null : Number(v))} value={field.value ? String(field.value) : "none"}>
                  <FormControl>
                    <SelectTrigger data-testid="select-order-supplier"><SelectValue placeholder="Selecionar fornecedor" /></SelectTrigger>
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
            <FormField control={form.control} name="invoice" render={({ field }) => (
              <FormItem>
                <FormLabel>Invoice</FormLabel>
                <FormControl><Input {...field} data-testid="input-order-invoice" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="factory" render={({ field }) => (
              <FormItem>
                <FormLabel>Fábrica</FormLabel>
                <FormControl><Input {...field} data-testid="input-order-factory" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="nfe" render={({ field }) => (
              <FormItem>
                <FormLabel>NFE</FormLabel>
                <FormControl><Input {...field} data-testid="input-order-nfe" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="bookingCrt" render={({ field }) => (
              <FormItem>
                <FormLabel>Booking/CRT</FormLabel>
                <FormControl><Input {...field} data-testid="input-order-booking" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="dueNumber" render={({ field }) => (
              <FormItem>
                <FormLabel>Número DUE</FormLabel>
                <FormControl><Input {...field} data-testid="input-order-due-number" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="parametrizacao" render={({ field }) => (
              <FormItem>
                <FormLabel>Parametrização</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-order-param"><SelectValue /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="verde">Verde</SelectItem>
                    <SelectItem value="amarelo">Amarelo</SelectItem>
                    <SelectItem value="vermelho">Vermelho</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Logística</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={form.control} name="modal" render={({ field }) => (
              <FormItem>
                <FormLabel>Modal</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-order-modal"><SelectValue /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="maritimo">Marítimo</SelectItem>
                    <SelectItem value="rodoviario">Rodoviário</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            {modal === "maritimo" && (
              <FormField control={form.control} name="vessel" render={({ field }) => (
                <FormItem>
                  <FormLabel>Vessel</FormLabel>
                  <FormControl><Input {...field} data-testid="input-order-vessel" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            )}
            <FormField control={form.control} name="vesselStatus" render={({ field }) => (
              <FormItem>
                <FormLabel>Status Movimentação</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-order-vessel-status"><SelectValue placeholder="Selecionar status" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">— Sem status —</SelectItem>
                    <SelectItem value="etd">ETD (Aguardando Embarque)</SelectItem>
                    <SelectItem value="zarpou">Zarpou</SelectItem>
                    <SelectItem value="em_navegacao">Em Navegação</SelectItem>
                    <SelectItem value="fundeado">Fundeado</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="embarqueDate" render={({ field }) => (
              <FormItem>
                <FormLabel>Data Embarque</FormLabel>
                <FormControl><Input type="date" {...field} data-testid="input-order-embarque" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="desembarqueDate" render={({ field }) => (
              <FormItem>
                <FormLabel>Data Desembarque</FormLabel>
                <FormControl><Input type="date" {...field} data-testid="input-order-desembarque" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="deadlineDra" render={({ field }) => (
              <FormItem>
                <FormLabel>Deadline DRA</FormLabel>
                <FormControl><Input type="date" {...field} data-testid="input-order-deadline-dra" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="deadlineCarga" render={({ field }) => (
              <FormItem>
                <FormLabel>Deadline Carga</FormLabel>
                <FormControl><Input type="date" {...field} data-testid="input-order-deadline-carga" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Financeiro</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={form.control} name="unitPrice" render={({ field }) => (
              <FormItem>
                <FormLabel>Valor Unitário (USD)</FormLabel>
                <FormControl><Input type="number" step="0.01" {...field} data-testid="input-order-unit-price" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="quantity" render={({ field }) => (
              <FormItem>
                <FormLabel>Quantidade (ton)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    {...field}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                    data-testid="input-order-quantity"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="paymentTerms" render={({ field }) => (
              <FormItem>
                <FormLabel>Termos de Pagamento</FormLabel>
                <FormControl><Input {...field} data-testid="input-order-payment-terms" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="dueDate" render={({ field }) => (
              <FormItem>
                <FormLabel>Vencimento</FormLabel>
                <FormControl><Input type="date" {...field} data-testid="input-order-due-date" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="paymentDate" render={({ field }) => (
              <FormItem>
                <FormLabel>Data de Pagamento Real</FormLabel>
                <FormControl><Input type="date" {...field} data-testid="input-order-payment-date" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="statusPagamento" render={({ field }) => (
              <FormItem>
                <FormLabel>Status Pagamento</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-order-status"><SelectValue /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                    <SelectItem value="atrasado">Atrasado</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="acc" render={({ field }) => (
              <FormItem>
                <FormLabel>ACC (Adiant. Câmbio)</FormLabel>
                <FormControl><Input type="number" step="0.01" {...field} data-testid="input-order-acc" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="exchangeClose" render={({ field }) => (
              <FormItem>
                <FormLabel>Fechamento de Câmbio</FormLabel>
                <FormControl><Input type="number" step="0.0001" {...field} data-testid="input-order-exchange" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={mutation.isPending} data-testid="button-submit-order">
          {mutation.isPending ? "Salvando..." : editOrder ? "Atualizar Ordem" : "Criar Ordem de Exportação"}
        </Button>
      </form>
    </Form>
  );
}
