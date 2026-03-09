import { storage } from "./storage";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Client, Supplier, Product, Quotation, ExportOrder } from "@shared/schema";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

export function isTelegramConfigured(): boolean {
  return !!(BOT_TOKEN && CHAT_ID);
}

export async function sendTelegramMessage(text: string): Promise<{ ok: boolean; error?: string }> {
  if (!BOT_TOKEN || !CHAT_ID) {
    return { ok: false, error: "Credenciais do Telegram não configuradas." };
  }

  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: "HTML" }),
    });
    const data = await res.json() as any;
    if (!data.ok) return { ok: false, error: data.description ?? "Erro desconhecido" };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function today(): string {
  return format(new Date(), "dd/MM/yyyy", { locale: ptBR });
}

export async function buildDailyReport(): Promise<string> {
  const orders = await storage.getOrders();
  const quotations = await storage.getQuotations();

  const totalRevenue = orders.reduce((s, o) => s + Number(o.total ?? 0), 0);
  const totalPago = orders.filter(o => o.statusPagamento === "pago").reduce((s, o) => s + Number(o.total ?? 0), 0);
  const totalPendente = orders.filter(o => o.statusPagamento === "pendente").reduce((s, o) => s + Number(o.total ?? 0), 0);
  const totalAtrasado = orders.filter(o => o.statusPagamento === "atrasado").reduce((s, o) => s + Number(o.total ?? 0), 0);
  const pendingCount = orders.filter(o => o.statusPagamento === "pendente").length;
  const overdueCount = orders.filter(o => o.statusPagamento === "atrasado").length;

  const pipelineQuotes = quotations.filter(q => q.status === "rascunho" || q.status === "enviada");
  const pipelineValue = pipelineQuotes.reduce((s, q) => s + Number(q.total ?? 0), 0);
  const convertedCount = quotations.filter(q => q.status === "convertida").length;
  const decidedCount = quotations.filter(q => ["aceita", "recusada", "convertida"].includes(q.status)).length;
  const convRate = decidedCount > 0 ? Math.round((convertedCount / decidedCount) * 100) : 0;

  const vencendoHoje = orders.filter(o => {
    if (!o.dueDate || o.statusPagamento === "pago") return false;
    const due = new Date(o.dueDate + "T00:00:00");
    const now = new Date();
    return due <= now && o.statusPagamento !== "pago";
  });

  let lines: string[] = [];
  lines.push(`🚢 <b>HYPERTRADE — Relatório Diário</b>`);
  lines.push(`📅 ${today()}`);
  lines.push(``);

  lines.push(`<b>📊 Ordens de Exportação</b>`);
  lines.push(`• Total de ordens: <b>${orders.length}</b>`);
  lines.push(`• Faturamento total: <b>${fmt(totalRevenue)}</b>`);
  lines.push(`• ✅ Pago: ${fmt(totalPago)}`);
  lines.push(`• ⏳ Pendente: ${fmt(totalPendente)} (${pendingCount} faturas)`);
  if (overdueCount > 0) lines.push(`• 🔴 Atrasado: ${fmt(totalAtrasado)} (${overdueCount} faturas)`);
  lines.push(``);

  lines.push(`<b>📋 Cotações / Pipeline</b>`);
  lines.push(`• Total de cotações: <b>${quotations.length}</b>`);
  lines.push(`• Pipeline ativo: ${pipelineQuotes.length} cotações (${fmt(pipelineValue)})`);
  lines.push(`• Taxa de conversão: ${convRate}%`);
  lines.push(``);

  if (vencendoHoje.length > 0) {
    lines.push(`<b>⚠️ Faturas Vencidas/Vencendo</b>`);
    vencendoHoje.slice(0, 5).forEach(o => {
      lines.push(`• ${o.invoice} — ${(o as any).client?.name ?? "—"} — ${fmt(Number(o.total ?? 0))}`);
    });
    if (vencendoHoje.length > 5) lines.push(`• ... e mais ${vencendoHoje.length - 5}`);
    lines.push(``);
  }

  lines.push(`<i>Gerado automaticamente pelo Hypertrade ERP</i>`);
  return lines.join("\n");
}

export async function buildVencimentosAlert(): Promise<string> {
  const orders = await storage.getOrders();
  const now = new Date();
  const in7Days = new Date(now);
  in7Days.setDate(now.getDate() + 7);

  const overdue = orders.filter(o => {
    if (!o.dueDate || o.statusPagamento === "pago") return false;
    return new Date(o.dueDate + "T00:00:00") < now;
  });

  const upcoming = orders.filter(o => {
    if (!o.dueDate || o.statusPagamento === "pago") return false;
    const due = new Date(o.dueDate + "T00:00:00");
    return due >= now && due <= in7Days;
  });

  let lines: string[] = [];
  lines.push(`⚠️ <b>HYPERTRADE — Alerta de Vencimentos</b>`);
  lines.push(`📅 ${today()}`);
  lines.push(``);

  if (overdue.length > 0) {
    lines.push(`🔴 <b>Faturas Vencidas (${overdue.length})</b>`);
    overdue.forEach(o => {
      const daysLate = Math.floor((now.getTime() - new Date(o.dueDate! + "T00:00:00").getTime()) / 86400000);
      lines.push(`• ${o.invoice} — ${(o as any).client?.name ?? "—"} — ${fmt(Number(o.total ?? 0))} (${daysLate}d atraso)`);
    });
    lines.push(``);
  }

  if (upcoming.length > 0) {
    lines.push(`🟡 <b>Vencendo nos próximos 7 dias (${upcoming.length})</b>`);
    upcoming.forEach(o => {
      const dueDate = format(new Date(o.dueDate! + "T00:00:00"), "dd/MM", { locale: ptBR });
      lines.push(`• ${o.invoice} — ${(o as any).client?.name ?? "—"} — ${fmt(Number(o.total ?? 0))} (vence ${dueDate})`);
    });
    lines.push(``);
  }

  if (overdue.length === 0 && upcoming.length === 0) {
    lines.push(`✅ Nenhuma fatura vencida ou vencendo nos próximos 7 dias.`);
  }

  lines.push(`<i>Gerado automaticamente pelo Hypertrade ERP</i>`);
  return lines.join("\n");
}

export async function buildLpcoAlert(): Promise<string> {
  const items = await storage.getLpcoItems();
  const now = new Date();
  const in90Days = new Date(now);
  in90Days.setDate(now.getDate() + 90);

  const expiring = items.filter(item => {
    if (!item.dataValidade || item.status === "suspenso") return false;
    const exp = new Date(item.dataValidade + "T00:00:00");
    return exp <= in90Days;
  }).sort((a, b) => new Date(a.dataValidade!).getTime() - new Date(b.dataValidade!).getTime());

  let lines: string[] = [];
  lines.push(`🛡️ <b>HYPERTRADE — Alertas LPCO</b>`);
  lines.push(`📅 ${today()}`);
  lines.push(``);

  if (expiring.length === 0) {
    lines.push(`✅ Nenhum LPCO vencendo nos próximos 90 dias.`);
  } else {
    lines.push(`⚠️ <b>${expiring.length} LPCO(s) vencendo em até 90 dias:</b>`);
    expiring.forEach(item => {
      const exp = new Date(item.dataValidade! + "T00:00:00");
      const daysLeft = Math.floor((exp.getTime() - now.getTime()) / 86400000);
      const icon = daysLeft < 0 ? "🔴" : daysLeft <= 30 ? "🟠" : "🟡";
      const label = daysLeft < 0 ? `${Math.abs(daysLeft)}d vencido` : `${daysLeft}d restantes`;
      lines.push(`${icon} ${item.numero} — ${item.orgaoEmissor} (${label})`);
    });
  }

  lines.push(``);
  lines.push(`<i>Gerado automaticamente pelo Hypertrade ERP</i>`);
  return lines.join("\n");
}

// ─── Event-Driven Notifications ───────────────────────────────────────────────

async function shouldNotify(field: "onNewQuotation" | "onNewOrder" | "onNewClient" | "onNewSupplier" | "onNewProduct"): Promise<boolean> {
  try {
    const cfg = await storage.getTelegramConfig();
    return cfg.enabled && cfg[field];
  } catch {
    return false;
  }
}

export async function notifyNewClient(client: Client): Promise<void> {
  if (!await shouldNotify("onNewClient")) return;
  const text = [
    `👤 <b>Novo Cliente Cadastrado</b>`,
    `📅 ${today()}`,
    ``,
    `• <b>Nome:</b> ${client.name}`,
    `• <b>País:</b> ${client.country}`,
    client.email ? `• <b>Email:</b> ${client.email}` : null,
    client.phone ? `• <b>Telefone:</b> ${client.phone}` : null,
    ``,
    `<i>Hypertrade ERP</i>`,
  ].filter(Boolean).join("\n");
  await sendTelegramMessage(text);
}

export async function notifyNewSupplier(supplier: Supplier): Promise<void> {
  if (!await shouldNotify("onNewSupplier")) return;
  const text = [
    `🏭 <b>Novo Fornecedor Cadastrado</b>`,
    `📅 ${today()}`,
    ``,
    `• <b>Nome:</b> ${supplier.name}`,
    supplier.city ? `• <b>Cidade:</b> ${supplier.city}${supplier.state ? `/${supplier.state}` : ""}` : null,
    supplier.email ? `• <b>Email:</b> ${supplier.email}` : null,
    supplier.phone ? `• <b>Telefone:</b> ${supplier.phone}` : null,
    ``,
    `<i>Hypertrade ERP</i>`,
  ].filter(Boolean).join("\n");
  await sendTelegramMessage(text);
}

export async function notifyNewProduct(product: Product): Promise<void> {
  if (!await shouldNotify("onNewProduct")) return;
  const text = [
    `📦 <b>Novo Produto Cadastrado</b>`,
    `📅 ${today()}`,
    ``,
    `• <b>Tipo:</b> ${product.type}`,
    `• <b>Gramatura:</b> ${product.grammage}`,
    `• <b>Unidade:</b> ${product.unidade}`,
    ``,
    `<i>Hypertrade ERP</i>`,
  ].filter(Boolean).join("\n");
  await sendTelegramMessage(text);
}

export async function notifyNewQuotation(quotation: Quotation & { clientName?: string; productName?: string }): Promise<void> {
  if (!await shouldNotify("onNewQuotation")) return;
  const text = [
    `📋 <b>Nova Cotação Criada</b>`,
    `📅 ${today()}`,
    ``,
    quotation.clientName ? `• <b>Cliente:</b> ${quotation.clientName}` : null,
    quotation.productName ? `• <b>Produto:</b> ${quotation.productName}` : null,
    `• <b>Quantidade:</b> ${Number(quotation.quantity).toLocaleString("pt-BR")} un`,
    `• <b>Total:</b> ${fmt(Number(quotation.total ?? 0))}`,
    `• <b>Validade:</b> ${quotation.validityDate ? new Date(quotation.validityDate + "T00:00:00").toLocaleDateString("pt-BR") : "—"}`,
    ``,
    `<i>Hypertrade ERP</i>`,
  ].filter(Boolean).join("\n");
  await sendTelegramMessage(text);
}

export async function notifyNewOrder(order: ExportOrder & { clientName?: string; productName?: string }): Promise<void> {
  if (!await shouldNotify("onNewOrder")) return;
  const text = [
    `🚢 <b>Nova Ordem de Exportação</b>`,
    `📅 ${today()}`,
    ``,
    `• <b>Invoice:</b> ${order.invoice}`,
    order.clientName ? `• <b>Cliente:</b> ${order.clientName}` : null,
    order.productName ? `• <b>Produto:</b> ${order.productName}` : null,
    `• <b>Quantidade:</b> ${Number(order.quantity).toLocaleString("pt-BR")} un`,
    `• <b>Total:</b> ${fmt(Number(order.total ?? 0))}`,
    `• <b>Modal:</b> ${order.modal}`,
    ``,
    `<i>Hypertrade ERP</i>`,
  ].filter(Boolean).join("\n");
  await sendTelegramMessage(text);
}
