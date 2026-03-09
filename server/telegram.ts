import { storage } from "./storage";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Client, Supplier, Product, Quotation, ExportOrder } from "@shared/schema";
import { textToSpeech } from "./replit_integrations/audio/client";

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

// ─── Resumo em Áudio ───────────────────────────────────────────────────────────

export async function buildAudioSummaryText(): Promise<string> {
  const orders = await storage.getOrders();
  const quotations = await storage.getQuotations();
  const now = new Date();

  const fmtSpeech = (n: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  const totalRevenue = orders.reduce((s, o) => s + Number(o.total ?? 0), 0);
  const totalPago = orders.filter(o => o.statusPagamento === "pago").reduce((s, o) => s + Number(o.total ?? 0), 0);
  const totalPendente = orders.filter(o => o.statusPagamento === "pendente").reduce((s, o) => s + Number(o.total ?? 0), 0);
  const totalAtrasado = orders.filter(o => o.statusPagamento === "atrasado").reduce((s, o) => s + Number(o.total ?? 0), 0);
  const overdueCount = orders.filter(o => o.statusPagamento === "atrasado").length;

  const pipelineQuotes = quotations.filter(q => q.status === "rascunho" || q.status === "enviada");
  const pipelineValue = pipelineQuotes.reduce((s, q) => s + Number(q.total ?? 0), 0);
  const convertedCount = quotations.filter(q => q.status === "convertida").length;
  const decidedCount = quotations.filter(q => ["aceita", "recusada", "convertida"].includes(q.status)).length;
  const convRate = decidedCount > 0 ? Math.round((convertedCount / decidedCount) * 100) : 0;

  // Day-by-day breakdown — last 7 days
  const DAYS_PT = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
  const dailyLines: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const dayName = i === 0 ? "hoje" : i === 1 ? "ontem" : DAYS_PT[d.getDay()];

    const dayOrders = orders.filter(o => {
      const created = o.createdAt ? new Date(o.createdAt).toISOString().split("T")[0] : "";
      return created === dateStr;
    });
    const dayQuotes = quotations.filter(q => {
      const created = q.createdAt ? new Date(q.createdAt).toISOString().split("T")[0] : "";
      return created === dateStr;
    });

    if (dayOrders.length > 0 || dayQuotes.length > 0) {
      const dayTotal = dayOrders.reduce((s, o) => s + Number(o.total ?? 0), 0);
      let line = `${dayName.charAt(0).toUpperCase() + dayName.slice(1)}, dia ${d.getDate()} de ${format(d, "MMMM", { locale: ptBR })}:`;
      if (dayOrders.length > 0) line += ` ${dayOrders.length} ordem${dayOrders.length > 1 ? "s" : ""} no valor de ${fmtSpeech(dayTotal)}.`;
      if (dayQuotes.length > 0) line += ` ${dayQuotes.length} cotação${dayQuotes.length > 1 ? "ões" : ""} registrada${dayQuotes.length > 1 ? "s" : ""}.`;
      dailyLines.push(line);
    }
  }

  const parts: string[] = [];

  // Saudação
  parts.push(`Bom dia, Valdinei! Aqui está o seu resumo de operações da Hypertrade, gerado em ${format(now, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}.`);

  // 1. Cotações
  parts.push("");
  parts.push(`Começando pelas cotações: há atualmente ${pipelineQuotes.length} cotação${pipelineQuotes.length !== 1 ? "ões" : ""} ativa${pipelineQuotes.length !== 1 ? "s" : ""} no pipeline, com valor total de ${fmtSpeech(pipelineValue)}. A taxa de conversão está em ${convRate} por cento.`);

  // 2. Vendas (movimentação dia a dia)
  parts.push("");
  if (dailyLines.length > 0) {
    parts.push("Em relação às vendas, veja a movimentação dos últimos sete dias:");
    dailyLines.forEach(l => parts.push(l));
  } else {
    parts.push("Não houve ordens de venda registradas nos últimos sete dias.");
  }

  // 3. Faturamento geral
  parts.push("");
  parts.push(`Por fim, o faturamento acumulado total é de ${fmtSpeech(totalRevenue)}: sendo ${fmtSpeech(totalPago)} já recebido e ${fmtSpeech(totalPendente)} pendente de pagamento${overdueCount > 0 ? `. Atenção: há ${fmtSpeech(totalAtrasado)} em atraso, referente a ${overdueCount} fatura${overdueCount > 1 ? "s" : ""} vencida${overdueCount > 1 ? "s" : ""}` : ""}.`);

  parts.push("");
  parts.push("Este foi o seu resumo de hoje, Valdinei. Boas negociações!");

  return parts.join(" ");
}

// ─── Áudio PRO — Dados externos ───────────────────────────────────────────────

function wmoDescription(code: number): string {
  if (code === 0) return "céu limpo";
  if (code <= 3) return "parcialmente nublado";
  if (code <= 48) return "nevoeiro";
  if (code <= 55) return "garoa leve";
  if (code <= 65) return "chuva";
  if (code <= 67) return "chuva com granizo";
  if (code <= 77) return "neve";
  if (code <= 82) return "chuvas fortes";
  if (code <= 84) return "aguaceiros com neve";
  if (code <= 99) return "tempestade com raios";
  return "condições variadas";
}

async function fetchWeather(): Promise<string> {
  try {
    const url = "https://api.open-meteo.com/v1/forecast?latitude=-25.5254&longitude=-49.1963" +
      "&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m" +
      "&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max" +
      "&timezone=America%2FSao_Paulo&forecast_days=1";
    const res = await fetch(url);
    const data = await res.json() as any;
    const c = data.current;
    const d = data.daily;
    const desc = wmoDescription(Number(c.weather_code));
    const tempAtual = Math.round(c.temperature_2m);
    const sensacao = Math.round(c.apparent_temperature);
    const vento = Math.round(c.wind_speed_10m);
    const maxTemp = Math.round(d.temperature_2m_max[0]);
    const minTemp = Math.round(d.temperature_2m_min[0]);
    const chuva = d.precipitation_probability_max[0];
    return `A previsão do tempo para São José dos Pinhais agora é de ${desc}, com temperatura de ${tempAtual} graus Celsius e sensação térmica de ${sensacao} graus. Os ventos estão a ${vento} quilômetros por hora. A máxima prevista para hoje é de ${maxTemp} graus e a mínima de ${minTemp} graus. A probabilidade de chuva é de ${chuva} por cento.`;
  } catch {
    return "Não foi possível obter a previsão do tempo no momento.";
  }
}

function formatBcbDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${mm}-${dd}-${yyyy}`;
}

async function fetchBcbPtax(dateStr: string): Promise<number | null> {
  const url = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao='${dateStr}'&$top=1&$orderby=dataHoraCotacao%20desc&$format=json&$select=cotacaoCompra,cotacaoVenda`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;
  const json = await res.json() as any;
  const items: any[] = json?.value ?? [];
  if (!items.length) return null;
  return parseFloat(items[0].cotacaoVenda);
}

async function fetchDollarRate(): Promise<string> {
  try {
    const now = new Date();
    const todayDate = formatBcbDate(now);

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (yesterday.getDay() === 0) yesterday.setDate(yesterday.getDate() - 1);
    if (yesterday.getDay() === 6) yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayDate = formatBcbDate(yesterday);

    const [rateToday, rateYesterday] = await Promise.all([
      fetchBcbPtax(todayDate),
      fetchBcbPtax(yesterdayDate),
    ]);

    if (rateToday === null && rateYesterday === null) {
      return "Não foi possível obter a cotação do dólar no momento.";
    }

    const mainRate = rateToday ?? rateYesterday!;
    const rateStr = mainRate.toFixed(2).replace(".", ",");
    const label = rateToday !== null ? "hoje" : "no último dia útil";

    let text = `A cotação do dólar americano ${label} está em ${rateStr} reais, conforme o PTAX do Banco Central do Brasil.`;

    if (rateToday !== null && rateYesterday !== null) {
      const diff = rateToday - rateYesterday;
      const pct = Math.abs((diff / rateYesterday) * 100).toFixed(2).replace(".", ",");
      const direction = diff >= 0 ? "alta" : "queda";
      const yStr = rateYesterday.toFixed(2).replace(".", ",");
      text += ` Em relação ao dia anterior, que fechou em ${yStr} reais, houve uma ${direction} de ${pct} por cento.`;
    }

    return text;
  } catch {
    return "Não foi possível obter a cotação do dólar no momento.";
  }
}

async function buildProOperationsText(cfg: { operacaoOntem: boolean; cotacoes: boolean; vendasSemana: boolean; vencimentosSemana: boolean }): Promise<string> {
  const orders = await storage.getOrders();
  const quotations = await storage.getQuotations();
  const now = new Date();

  const fmtSpeech = (n: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  // ── 1. ONTEM ──────────────────────────────────────────────────────────────
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];
  const yesterdayLabel = format(yesterday, "EEEE, dd 'de' MMMM", { locale: ptBR });

  const yesterdayOrders = orders.filter(o =>
    o.createdAt && new Date(o.createdAt).toISOString().split("T")[0] === yesterdayStr
  );
  const yesterdayQuotes = quotations.filter(q =>
    q.createdAt && new Date(q.createdAt).toISOString().split("T")[0] === yesterdayStr
  );

  // ── 2. COTAÇÕES (pipeline atual) ──────────────────────────────────────────
  const pipelineQuotes = quotations.filter(q => q.status === "rascunho" || q.status === "enviada");
  const pipelineValue = pipelineQuotes.reduce((s, q) => s + Number(q.total ?? 0), 0);
  const convertedCount = quotations.filter(q => q.status === "convertida").length;
  const decidedCount = quotations.filter(q => ["aceita", "recusada", "convertida"].includes(q.status)).length;
  const convRate = decidedCount > 0 ? Math.round((convertedCount / decidedCount) * 100) : 0;
  const acceptedThisWeek = quotations.filter(q => {
    if (q.status !== "aceita" && q.status !== "convertida") return false;
    if (!q.updatedAt) return false;
    const d = new Date(q.updatedAt);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    return d >= startOfWeek;
  });

  // ── 3. VENDAS DA SEMANA ───────────────────────────────────────────────────
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const weekOrders = orders.filter(o =>
    o.createdAt && new Date(o.createdAt) >= startOfWeek
  );
  const weekRevenue = weekOrders.reduce((s, o) => s + Number(o.total ?? 0), 0);

  // ── 4. VENCIMENTOS DESTA SEMANA ──────────────────────────────────────────
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  const dueThisWeek = orders.filter(o => {
    if (!o.dueDate || o.statusPagamento === "pago") return false;
    const d = new Date(o.dueDate);
    return d >= startOfWeek && d <= endOfWeek;
  });
  const dueTotal = dueThisWeek.reduce((s, o) => s + Number(o.total ?? 0), 0);
  const overdue = orders.filter(o => {
    if (!o.dueDate || o.statusPagamento === "pago") return false;
    return new Date(o.dueDate) < now;
  });
  const overdueTotal = overdue.reduce((s, o) => s + Number(o.total ?? 0), 0);

  const parts: string[] = [];

  // BLOCO 1 — ONTEM
  if (cfg.operacaoOntem) {
    parts.push(`Primeiro, o resumo da operação de ontem, ${yesterdayLabel}.`);
    if (yesterdayOrders.length > 0) {
      const dayTotal = yesterdayOrders.reduce((s, o) => s + Number(o.total ?? 0), 0);
      parts.push(`Foram registradas ${yesterdayOrders.length} ordem${yesterdayOrders.length > 1 ? "s" : ""} de exportação, totalizando ${fmtSpeech(dayTotal)}.`);
      const clientsYest = [...new Set(yesterdayOrders.map(o => o.client?.name).filter(Boolean))];
      if (clientsYest.length) parts.push(`Clientes: ${clientsYest.join(", ")}.`);
    } else {
      parts.push("Não foram registradas ordens de exportação ontem.");
    }
    if (yesterdayQuotes.length > 0) {
      parts.push(`Foram criadas ${yesterdayQuotes.length} cotação${yesterdayQuotes.length > 1 ? "ões" : ""} novas ontem.`);
    } else {
      parts.push("Nenhuma cotação nova foi criada ontem.");
    }
  }

  // BLOCO 2 — COTAÇÕES
  if (cfg.cotacoes) {
    parts.push(`Agora, as cotações. O pipeline atual tem ${pipelineQuotes.length} cotação${pipelineQuotes.length !== 1 ? "ões" : ""} ativa${pipelineQuotes.length !== 1 ? "s" : ""}, totalizando ${fmtSpeech(pipelineValue)}, com taxa de conversão de ${convRate} por cento.`);
    if (acceptedThisWeek.length > 0) {
      parts.push(`Esta semana, ${acceptedThisWeek.length} cotação${acceptedThisWeek.length > 1 ? "ões foram aceitas ou convertidas" : " foi aceita ou convertida"}.`);
    }
  }

  // BLOCO 3 — VENDAS DA SEMANA
  if (cfg.vendasSemana) {
    if (weekOrders.length > 0) {
      parts.push(`Em relação às vendas desta semana: ${weekOrders.length} ordem${weekOrders.length > 1 ? "s" : ""} registrada${weekOrders.length > 1 ? "s" : ""}, somando ${fmtSpeech(weekRevenue)}.`);
    } else {
      parts.push("Não há vendas registradas esta semana ainda.");
    }
  }

  // BLOCO 4 — VENCIMENTOS DA SEMANA
  if (cfg.vencimentosSemana) {
    parts.push("Agora, a projeção de vencimentos para esta semana.");
    if (dueThisWeek.length > 0) {
      parts.push(`Há ${dueThisWeek.length} fatura${dueThisWeek.length > 1 ? "s" : ""} vencendo esta semana, totalizando ${fmtSpeech(dueTotal)}.`);
      dueThisWeek.forEach(o => {
        const dueLbl = format(new Date(o.dueDate!), "EEEE, dd 'de' MMMM", { locale: ptBR });
        const clientName = o.client?.name ?? "cliente";
        parts.push(`${clientName}, fatura ${o.invoice ?? `número ${o.id}`}, vence em ${dueLbl}, valor ${fmtSpeech(Number(o.total ?? 0))}.`);
      });
    } else {
      parts.push("Não há faturas com vencimento esta semana.");
    }
    if (overdue.length > 0) {
      parts.push(`Atenção: há ${overdue.length} fatura${overdue.length > 1 ? "s" : ""} em atraso, totalizando ${fmtSpeech(overdueTotal)}. Verifique esses casos com urgência.`);
    }
  }

  return parts.join(" ");
}

const statusLabels: Record<string, string> = {
  rascunho: "em rascunho",
  enviada: "enviada",
  aceita: "aceita",
  recusada: "recusada",
  convertida: "convertida em pedido",
};

async function buildQuotationNotesText(): Promise<string> {
  try {
    const quotations = await storage.getQuotations();
    const results: string[] = [];

    for (const q of quotations) {
      const notes = await storage.getQuotationNotes(q.id);
      if (!notes.length) continue;

      const clientName = q.client?.name ?? "cliente desconhecido";
      const statusLabel = statusLabels[q.status] ?? q.status;
      const totalLabel = q.totalValue
        ? `no valor de ${parseFloat(String(q.totalValue)).toLocaleString("pt-BR", { style: "currency", currency: "USD" })}`
        : "";

      results.push(
        `Cotação número ${q.id}, cliente ${clientName}, ${totalLabel}, status ${statusLabel}. Esta cotação possui ${notes.length} ${notes.length === 1 ? "anotação" : "anotações"}.`
      );

      notes.forEach((note, i) => {
        const when = format(new Date(note.createdAt!), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR });
        results.push(
          `Anotação ${i + 1}, feita por ${note.author} em ${when}: "${note.content}".`
        );
      });
    }

    if (!results.length) {
      return "Não há cotações com anotações no Kanban no momento.";
    }

    return `As seguintes cotações possuem anotações registradas no Kanban. ${results.join(" ")}`;
  } catch {
    return "Não foi possível carregar as anotações do Kanban no momento.";
  }
}

export async function buildAudioProSummaryText(): Promise<string> {
  const now = new Date();
  const todayStr = format(now, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  const cfg = await storage.getAudioProTopicsConfig();

  const [weatherText, dollarText, quotationNotesText, operationsText] = await Promise.all([
    cfg.tempo ? fetchWeather() : Promise.resolve(null),
    cfg.dolar ? fetchDollarRate() : Promise.resolve(null),
    cfg.kanbanNotas ? buildQuotationNotesText() : Promise.resolve(null),
    (cfg.operacaoOntem || cfg.cotacoes || cfg.vendasSemana || cfg.vencimentosSemana)
      ? buildProOperationsText(cfg)
      : Promise.resolve(null),
  ]);

  const parts: string[] = [];

  parts.push(`Bom dia, Valdinei! Hoje é ${todayStr}. Este é o seu briefing matinal da Hypertrade. Vamos começar.`);

  if (weatherText) {
    parts.push("");
    parts.push("Previsão do tempo para hoje em São José dos Pinhais. " + weatherText);
  }

  if (dollarText) {
    parts.push("");
    parts.push("Cotação do dólar. " + dollarText);
  }

  if (cfg.emails) {
    parts.push("");
    parts.push("Caixa de e-mails: sem mensagens novas. Parabéns, caixa zerada!");
  }

  if (operationsText) {
    parts.push("");
    parts.push(operationsText);
  }

  if (quotationNotesText) {
    parts.push("");
    parts.push("Por fim, as anotações do Kanban de cotações. " + quotationNotesText);
  }

  parts.push("");
  parts.push("Briefing concluído. Tenha um ótimo dia, Valdinei. Boas negociações!");

  return parts.join(" ");
}

export async function sendTelegramAudioPro(): Promise<{ ok: boolean; error?: string }> {
  if (!BOT_TOKEN || !CHAT_ID) {
    return { ok: false, error: "Credenciais do Telegram não configuradas." };
  }
  try {
    const summaryText = await buildAudioProSummaryText();
    const audioBuffer = await textToSpeech(summaryText, "nova", "mp3");

    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendAudio`;
    const form = new FormData();
    form.append("chat_id", CHAT_ID);
    form.append("audio", new Blob([audioBuffer], { type: "audio/mpeg" }), "briefing-pro-hypertrade.mp3");
    form.append("caption", `⭐ Resumo em Áudio PRO — Hypertrade ERP\n📅 ${today()}`);
    form.append("title", `Briefing PRO Hypertrade ${today()}`);
    form.append("performer", "Hypertrade ERP");
    const res = await fetch(url, { method: "POST", body: form });
    const data = await res.json() as any;
    if (!data.ok) return { ok: false, error: data.description ?? "Erro desconhecido" };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message ?? "Erro interno ao gerar áudio PRO" };
  }
}

export async function sendTelegramAudio(): Promise<{ ok: boolean; error?: string }> {
  if (!BOT_TOKEN || !CHAT_ID) {
    return { ok: false, error: "Credenciais do Telegram não configuradas." };
  }

  const summaryText = await buildAudioSummaryText();
  const audioBuffer = await textToSpeech(summaryText, "nova", "mp3");

  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendAudio`;
  try {
    const form = new FormData();
    form.append("chat_id", CHAT_ID);
    form.append("audio", new Blob([audioBuffer], { type: "audio/mpeg" }), "resumo-hypertrade.mp3");
    form.append("caption", `🎙️ Resumo em Áudio — Hypertrade ERP\n📅 ${today()}`);
    form.append("title", `Resumo Hypertrade ${today()}`);
    form.append("performer", "Hypertrade ERP");

    const res = await fetch(url, { method: "POST", body: form });
    const data = await res.json() as any;
    if (!data.ok) return { ok: false, error: data.description ?? "Erro desconhecido" };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}
