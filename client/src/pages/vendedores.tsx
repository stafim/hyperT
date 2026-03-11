import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Eye, EyeOff, UserCheck, Lock } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

interface Vendedor {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
  phone: string | null;
  department: string | null;
  comissaoPct: string;
  cpf: string | null;
  rg: string | null;
  dataNascimento: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  passwordHash: string | null;
}

const vendedorSchema = z
  .object({
    name: z.string().min(2, "Nome obrigatório"),
    email: z.string().email("Email inválido"),
    status: z.enum(["ativo", "inativo"]),
    phone: z.string().optional().or(z.literal("")),
    department: z.string().optional().or(z.literal("")),
    comissaoPct: z.string().optional().or(z.literal("")),
    cpf: z.string().optional().or(z.literal("")),
    rg: z.string().optional().or(z.literal("")),
    dataNascimento: z.string().optional().or(z.literal("")),
    endereco: z.string().optional().or(z.literal("")),
    cidade: z.string().optional().or(z.literal("")),
    estado: z.string().optional().or(z.literal("")),
    cep: z.string().optional().or(z.literal("")),
    password: z.string().optional().or(z.literal("")),
    confirmPassword: z.string().optional().or(z.literal("")),
  })
  .refine(
    (data) => {
      if (data.password && data.password.length > 0) {
        return data.password === data.confirmPassword;
      }
      return true;
    },
    { message: "As senhas não coincidem", path: ["confirmPassword"] }
  );

type VendedorForm = z.infer<typeof vendedorSchema>;

const brazilStates = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
];

function maskCpf(v: string) {
  return v
    .replace(/\D/g, "")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2")
    .slice(0, 14);
}

function maskCep(v: string) {
  return v
    .replace(/\D/g, "")
    .replace(/(\d{5})(\d)/, "$1-$2")
    .slice(0, 9);
}

function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10)
    return d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").trim();
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").trim();
}

export default function VendedoresPage() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Vendedor | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [search, setSearch] = useState("");

  const { data: vendedores = [], isLoading } = useQuery<Vendedor[]>({
    queryKey: ["/api/vendedores"],
  });

  const form = useForm<VendedorForm>({
    resolver: zodResolver(vendedorSchema),
    defaultValues: {
      name: "",
      email: "",
      status: "ativo",
      phone: "",
      department: "",
      comissaoPct: "0",
      cpf: "",
      rg: "",
      dataNascimento: "",
      endereco: "",
      cidade: "",
      estado: "",
      cep: "",
      password: "",
      confirmPassword: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: VendedorForm) =>
      apiRequest("POST", "/api/vendedores", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendedores"] });
      queryClient.invalidateQueries({ queryKey: ["/api/platform-users"] });
      toast({ title: "Vendedor criado com sucesso!" });
      setOpen(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Erro ao criar vendedor", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: VendedorForm }) =>
      apiRequest("PATCH", `/api/vendedores/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendedores"] });
      queryClient.invalidateQueries({ queryKey: ["/api/platform-users"] });
      toast({ title: "Vendedor atualizado com sucesso!" });
      setOpen(false);
      setEditing(null);
      form.reset();
    },
    onError: () => {
      toast({ title: "Erro ao atualizar vendedor", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/vendedores/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendedores"] });
      queryClient.invalidateQueries({ queryKey: ["/api/platform-users"] });
      toast({ title: "Vendedor excluído." });
      setDeletingId(null);
    },
    onError: () => {
      toast({ title: "Erro ao excluir vendedor", variant: "destructive" });
    },
  });

  function openCreate() {
    setEditing(null);
    form.reset({
      name: "",
      email: "",
      status: "ativo",
      phone: "",
      department: "",
      comissaoPct: "0",
      cpf: "",
      rg: "",
      dataNascimento: "",
      endereco: "",
      cidade: "",
      estado: "",
      cep: "",
      password: "",
      confirmPassword: "",
    });
    setOpen(true);
  }

  function openEdit(v: Vendedor) {
    setEditing(v);
    form.reset({
      name: v.name,
      email: v.email,
      status: (v.status as "ativo" | "inativo") ?? "ativo",
      phone: v.phone ?? "",
      department: v.department ?? "",
      comissaoPct: v.comissaoPct ?? "0",
      cpf: v.cpf ?? "",
      rg: v.rg ?? "",
      dataNascimento: v.dataNascimento ?? "",
      endereco: v.endereco ?? "",
      cidade: v.cidade ?? "",
      estado: v.estado ?? "",
      cep: v.cep ?? "",
      password: "",
      confirmPassword: "",
    });
    setOpen(true);
  }

  function onSubmit(data: VendedorForm) {
    if (editing) {
      updateMutation.mutate({ id: editing.id, data });
    } else {
      if (!data.password) {
        form.setError("password", { message: "Senha obrigatória para novo vendedor" });
        return;
      }
      createMutation.mutate(data);
    }
  }

  const filtered = vendedores.filter(
    (v) =>
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.email.toLowerCase().includes(search.toLowerCase()) ||
      (v.cpf ?? "").includes(search)
  );

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Vendedores</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Cadastro de vendedores com acesso ao sistema
          </p>
        </div>
        <Button data-testid="button-new-vendedor" onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Vendedor
        </Button>
      </div>

      <div className="flex gap-3">
        <Input
          data-testid="input-search-vendedores"
          placeholder="Buscar por nome, e-mail ou CPF..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail / Login</TableHead>
              <TableHead>CPF</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Cidade/UF</TableHead>
              <TableHead>Comissão</TableHead>
              <TableHead>Senha</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  {search ? "Nenhum vendedor encontrado." : "Nenhum vendedor cadastrado ainda."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((v) => (
                <TableRow key={v.id} data-testid={`row-vendedor-${v.id}`}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-primary" />
                      {v.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{v.email}</TableCell>
                  <TableCell>{v.cpf || <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                  <TableCell>{v.phone || <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                  <TableCell>
                    {v.cidade
                      ? `${v.cidade}${v.estado ? `/${v.estado}` : ""}`
                      : <span className="text-muted-foreground text-xs">—</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {Number(v.comissaoPct).toFixed(1)}%
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {v.passwordHash ? (
                      <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                        <Lock className="w-3 h-3" /> Configurada
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Não definida</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={v.status === "ativo" ? "default" : "secondary"}
                      data-testid={`status-vendedor-${v.id}`}
                    >
                      {v.status === "ativo" ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        data-testid={`button-edit-vendedor-${v.id}`}
                        onClick={() => openEdit(v)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        data-testid={`button-delete-vendedor-${v.id}`}
                        onClick={() => setDeletingId(v.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar Vendedor" : "Novo Vendedor"}
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

              {/* Section: Dados Pessoais */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Dados Pessoais
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Nome completo *</FormLabel>
                        <FormControl>
                          <Input data-testid="input-vendedor-name" placeholder="Nome completo" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="cpf"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CPF</FormLabel>
                        <FormControl>
                          <Input
                            data-testid="input-vendedor-cpf"
                            placeholder="000.000.000-00"
                            {...field}
                            onChange={(e) => field.onChange(maskCpf(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="rg"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>RG</FormLabel>
                        <FormControl>
                          <Input data-testid="input-vendedor-rg" placeholder="Número do RG" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dataNascimento"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data de Nascimento</FormLabel>
                        <FormControl>
                          <Input data-testid="input-vendedor-nascimento" type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefone</FormLabel>
                        <FormControl>
                          <Input
                            data-testid="input-vendedor-phone"
                            placeholder="(00) 00000-0000"
                            {...field}
                            onChange={(e) => field.onChange(maskPhone(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Section: Endereço */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Endereço
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="endereco"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Endereço</FormLabel>
                        <FormControl>
                          <Input data-testid="input-vendedor-endereco" placeholder="Rua, número, complemento" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="cidade"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cidade</FormLabel>
                        <FormControl>
                          <Input data-testid="input-vendedor-cidade" placeholder="Cidade" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="estado"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estado (UF)</FormLabel>
                        <Select value={field.value ?? ""} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger data-testid="select-vendedor-estado">
                              <SelectValue placeholder="UF" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {brazilStates.map((s) => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="cep"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CEP</FormLabel>
                        <FormControl>
                          <Input
                            data-testid="input-vendedor-cep"
                            placeholder="00000-000"
                            {...field}
                            onChange={(e) => field.onChange(maskCep(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Section: Dados Profissionais */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Dados Profissionais
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="department"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cargo / Departamento</FormLabel>
                        <FormControl>
                          <Input data-testid="input-vendedor-department" placeholder="Ex: Vendas, Exportação" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="comissaoPct"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>% Comissão</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              data-testid="input-vendedor-comissao"
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              placeholder="0.00"
                              {...field}
                              className="pr-8"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger data-testid="select-vendedor-status">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="ativo">Ativo</SelectItem>
                            <SelectItem value="inativo">Inativo</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Section: Acesso ao Sistema */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Acesso ao Sistema
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>E-mail (Login) *</FormLabel>
                        <FormControl>
                          <Input
                            data-testid="input-vendedor-email"
                            type="email"
                            placeholder="vendedor@empresa.com"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {editing ? "Nova Senha" : "Senha *"}
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              data-testid="input-vendedor-password"
                              type={showPassword ? "text" : "password"}
                              placeholder={editing ? "Deixe em branco para manter" : "Mínimo 6 caracteres"}
                              {...field}
                              className="pr-10"
                            />
                            <button
                              type="button"
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                              onClick={() => setShowPassword((p) => !p)}
                              tabIndex={-1}
                            >
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirmar Senha</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              data-testid="input-vendedor-confirm-password"
                              type={showConfirm ? "text" : "password"}
                              placeholder="Repita a senha"
                              {...field}
                              className="pr-10"
                            />
                            <button
                              type="button"
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                              onClick={() => setShowConfirm((p) => !p)}
                              tabIndex={-1}
                            >
                              {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                {editing && editing.passwordHash && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Este vendedor já possui senha configurada. Preencha os campos acima apenas se quiser redefini-la.
                  </p>
                )}
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setOpen(false); setEditing(null); }}
                >
                  Cancelar
                </Button>
                <Button
                  data-testid="button-submit-vendedor"
                  type="submit"
                  disabled={isPending}
                >
                  {isPending ? "Salvando..." : editing ? "Salvar Alterações" : "Criar Vendedor"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deletingId !== null} onOpenChange={(o) => { if (!o) setDeletingId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir vendedor?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O vendedor será removido do sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-delete-vendedor"
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deletingId !== null && deleteMutation.mutate(deletingId)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
