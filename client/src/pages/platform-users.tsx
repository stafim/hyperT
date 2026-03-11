import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Pencil, Trash2, UserCog, Mail, Phone, Building2, Shield, Eye, Percent, UserCheck } from "lucide-react";
import { insertPlatformUserSchema, type PlatformUser, type InsertPlatformUser } from "@shared/schema";

const roleLabels: Record<string, { label: string; color: string }> = {
  admin:        { label: "Admin",        color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
  operador:     { label: "Operador",     color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  visualizador: { label: "Visualizador", color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300" },
  vendedor:     { label: "Vendedor",     color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
};

const roleIcons: Record<string, React.ReactNode> = {
  admin:        <Shield className="h-3 w-3" />,
  operador:     <UserCog className="h-3 w-3" />,
  visualizador: <Eye className="h-3 w-3" />,
  vendedor:     <UserCheck className="h-3 w-3" />,
};

function UserForm({ editUser, onSuccess }: { editUser: PlatformUser | null; onSuccess: () => void }) {
  const { toast } = useToast();
  const form = useForm<InsertPlatformUser>({
    resolver: zodResolver(insertPlatformUserSchema),
    defaultValues: editUser
      ? {
          name:        editUser.name,
          email:       editUser.email,
          role:        editUser.role,
          status:      editUser.status,
          phone:       editUser.phone ?? "",
          department:  editUser.department ?? "",
          comissaoPct: editUser.comissaoPct ?? "0",
        }
      : { name: "", email: "", role: "operador", status: "ativo", phone: "", department: "", comissaoPct: "0" },
  });

  const watchedRole = form.watch("role");

  const mutation = useMutation({
    mutationFn: (data: InsertPlatformUser) =>
      editUser
        ? apiRequest("PATCH", `/api/platform-users/${editUser.id}`, data)
        : apiRequest("POST", "/api/platform-users", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform-users"] });
      toast({ title: editUser ? "Usuário atualizado" : "Usuário criado" });
      onSuccess();
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem>
              <FormLabel>Nome completo</FormLabel>
              <FormControl><Input placeholder="Ex: João Silva" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="email" render={({ field }) => (
            <FormItem>
              <FormLabel>E-mail</FormLabel>
              <FormControl><Input type="email" placeholder="joao@empresa.com" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="phone" render={({ field }) => (
            <FormItem>
              <FormLabel>Telefone <span className="text-muted-foreground text-xs">(opcional)</span></FormLabel>
              <FormControl><Input placeholder="(41) 99999-0000" {...field} value={field.value ?? ""} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="department" render={({ field }) => (
            <FormItem>
              <FormLabel>Departamento <span className="text-muted-foreground text-xs">(opcional)</span></FormLabel>
              <FormControl><Input placeholder="Ex: Operação, Financeiro" {...field} value={field.value ?? ""} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="role" render={({ field }) => (
            <FormItem>
              <FormLabel>Perfil de Acesso</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar perfil" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="admin">Admin — acesso total</SelectItem>
                  <SelectItem value="operador">Operador — criar e editar</SelectItem>
                  <SelectItem value="visualizador">Visualizador — somente leitura</SelectItem>
                  <SelectItem value="vendedor">Vendedor — acesso comercial</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="status" render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar status" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        {watchedRole === "vendedor" && (
          <div className="border-t pt-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1">
              <Percent className="h-3 w-3" /> Comissão sobre Vendas
            </p>
            <FormField control={form.control} name="comissaoPct" render={({ field }) => (
              <FormItem>
                <FormLabel>Percentual de Comissão (%)</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      placeholder="0.00"
                      {...field}
                      value={field.value ?? "0"}
                      className="pr-8"
                      data-testid="input-comissao-pct"
                    />
                    <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  </div>
                </FormControl>
                <p className="text-xs text-muted-foreground">Percentual aplicado sobre o valor FOB/EXW das ordens criadas por este vendedor.</p>
                <FormMessage />
              </FormItem>
            )} />
          </div>
        )}

        <div className="rounded-lg bg-muted/50 border p-3 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">Permissões por perfil:</p>
          <p><span className="font-medium text-red-600 dark:text-red-400">Admin</span> — acesso total: cadastros, ordens, relatórios e configurações</p>
          <p><span className="font-medium text-blue-600 dark:text-blue-400">Operador</span> — pode criar e editar cotações, ordens e cadastros</p>
          <p><span className="font-medium">Visualizador</span> — somente leitura: não pode criar ou alterar dados</p>
        </div>

        <Button type="submit" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending ? "Salvando..." : editUser ? "Atualizar Usuário" : "Criar Usuário"}
        </Button>
      </form>
    </Form>
  );
}

export default function PlatformUsers() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("todos");
  const [formOpen, setFormOpen] = useState(false);
  const [editUser, setEditUser] = useState<PlatformUser | null>(null);

  const { data: users, isLoading } = useQuery<PlatformUser[]>({ queryKey: ["/api/platform-users"] });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/platform-users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform-users"] });
      toast({ title: "Usuário excluído" });
    },
    onError: () => toast({ title: "Erro ao excluir", variant: "destructive" }),
  });

  const filtered = (users ?? []).filter((u) => {
    const matchSearch = !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.department ?? "").toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "todos" || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const counts = {
    total:        users?.length ?? 0,
    ativos:       users?.filter((u) => u.status === "ativo").length ?? 0,
    admin:        users?.filter((u) => u.role === "admin").length ?? 0,
    operador:     users?.filter((u) => u.role === "operador").length ?? 0,
    visualizador: users?.filter((u) => u.role === "visualizador").length ?? 0,
    vendedor:     users?.filter((u) => u.role === "vendedor").length ?? 0,
  };

  function openNew() { setEditUser(null); setFormOpen(true); }
  function openEdit(u: PlatformUser) { setEditUser(u); setFormOpen(true); }
  function closeForm() { setFormOpen(false); setEditUser(null); }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Usuários da Plataforma</h1>
          <p className="text-muted-foreground text-sm">Gerenciar acessos e perfis dos usuários do sistema</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Usuário
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="cursor-pointer hover:bg-muted/40 transition-colors" onClick={() => setRoleFilter("todos")}>
          <CardContent className="pt-3 pb-3">
            <p className="text-xs text-muted-foreground">Total de Usuários</p>
            <p className="text-2xl font-bold mt-0.5">{counts.total}</p>
            <p className="text-xs text-muted-foreground">{counts.ativos} ativos</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/40 transition-colors" onClick={() => setRoleFilter("admin")}>
          <CardContent className="pt-3 pb-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Shield className="h-3 w-3 text-red-500" />Admin</p>
            <p className="text-2xl font-bold mt-0.5 text-red-600 dark:text-red-400">{counts.admin}</p>
            <p className="text-xs text-muted-foreground">acesso total</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/40 transition-colors" onClick={() => setRoleFilter("operador")}>
          <CardContent className="pt-3 pb-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><UserCog className="h-3 w-3 text-blue-500" />Operadores</p>
            <p className="text-2xl font-bold mt-0.5 text-blue-600 dark:text-blue-400">{counts.operador}</p>
            <p className="text-xs text-muted-foreground">criar e editar</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/40 transition-colors" onClick={() => setRoleFilter("visualizador")}>
          <CardContent className="pt-3 pb-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Eye className="h-3 w-3" />Visualizadores</p>
            <p className="text-2xl font-bold mt-0.5">{counts.visualizador}</p>
            <p className="text-xs text-muted-foreground">somente leitura</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/40 transition-colors" onClick={() => setRoleFilter("vendedor")}>
          <CardContent className="pt-3 pb-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><UserCheck className="h-3 w-3 text-green-500" />Vendedores</p>
            <p className="text-2xl font-bold mt-0.5 text-green-600 dark:text-green-400">{counts.vendedor}</p>
            <p className="text-xs text-muted-foreground">acesso comercial</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, e-mail ou departamento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Filtrar perfil" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os perfis</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="operador">Operador</SelectItem>
            <SelectItem value="visualizador">Visualizador</SelectItem>
            <SelectItem value="vendedor">Vendedor</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <UserCog className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1">
              {users?.length === 0 ? "Nenhum usuário cadastrado" : "Nenhum resultado encontrado"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {users?.length === 0 ? "Adicione o primeiro usuário da plataforma." : "Tente ajustar os filtros de busca."}
            </p>
            {users?.length === 0 && (
              <Button onClick={openNew}>
                <Plus className="h-4 w-4 mr-2" />
                Criar primeiro usuário
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Departamento</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead className="text-right">Comissão</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Cadastro</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((user) => {
                const role = roleLabels[user.role] ?? { label: user.role, color: "" };
                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{user.name}</p>
                        {user.phone && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Phone className="h-3 w-3" />{user.phone}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="truncate max-w-[200px]">{user.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.department ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Building2 className="h-3 w-3 text-muted-foreground" />
                          {user.department}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${role.color}`}>
                        {roleIcons[user.role]}
                        {role.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {parseFloat(user.comissaoPct ?? "0") > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                          <Percent className="h-3 w-3" />
                          {parseFloat(user.comissaoPct ?? "0").toFixed(2)}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.status === "ativo" ? "default" : "secondary"} className="text-xs">
                        {user.status === "ativo" ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString("pt-BR") : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(user)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => { if (confirm(`Excluir o usuário "${user.name}"?`)) deleteMutation.mutate(user.id); }}
                          disabled={deleteMutation.isPending}
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
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={(v) => { if (!v) closeForm(); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editUser ? "Editar Usuário" : "Novo Usuário"}</DialogTitle>
          </DialogHeader>
          <UserForm editUser={editUser} onSuccess={closeForm} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
