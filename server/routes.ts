import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { isTelegramConfigured, sendTelegramMessage, buildDailyReport, buildVencimentosAlert, buildLpcoAlert, notifyNewClient, notifyNewSupplier, notifyNewProduct, notifyNewQuotation, notifyNewOrder } from "./telegram";
import { insertClientSchema, insertClientDocumentSchema, insertProductSchema, insertSupplierSchema, insertQuotationSchema, insertPlatformUserSchema, insertShipmentTrackingSchema } from "@shared/schema";
import OpenAI from "openai";
import { registerPortalRoutes } from "./portal-routes";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";

const UPLOADS_DIR = path.join(process.cwd(), "server", "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const ALLOWED_MIMETYPES = ["application/pdf", "image/jpeg", "image/png", "image/tiff", "image/jpg"];
const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".tiff", ".tif"];

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${uuidv4()}${ext}`);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_MIMETYPES.includes(file.mimetype) && ALLOWED_EXTENSIONS.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Tipo de arquivo não permitido. Apenas PDF e imagens (JPG, PNG, TIFF)."));
    }
  },
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Suppliers
  app.get("/api/suppliers", async (_req, res) => {
    const suppliersList = await storage.getSuppliers();
    res.json(suppliersList);
  });

  app.get("/api/suppliers/:id", async (req, res) => {
    const supplier = await storage.getSupplier(Number(req.params.id));
    if (!supplier) return res.status(404).json({ message: "Supplier not found" });
    res.json(supplier);
  });

  app.post("/api/suppliers", async (req, res) => {
    const result = insertSupplierSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ message: result.error.message });
    const supplier = await storage.createSupplier(result.data);
    notifyNewSupplier(supplier).catch(() => {});
    res.status(201).json(supplier);
  });

  app.patch("/api/suppliers/:id", async (req, res) => {
    const result = insertSupplierSchema.partial().safeParse(req.body);
    if (!result.success) return res.status(400).json({ message: result.error.message });
    const supplier = await storage.updateSupplier(Number(req.params.id), result.data);
    if (!supplier) return res.status(404).json({ message: "Supplier not found" });
    res.json(supplier);
  });

  app.delete("/api/suppliers/:id", async (req, res) => {
    await storage.deleteSupplier(Number(req.params.id));
    res.status(204).end();
  });

  // Clients
  app.get("/api/clients", async (_req, res) => {
    const clients = await storage.getClients();
    res.json(clients);
  });

  app.get("/api/clients/:id", async (req, res) => {
    const client = await storage.getClient(Number(req.params.id));
    if (!client) return res.status(404).json({ message: "Client not found" });
    res.json(client);
  });

  app.post("/api/clients", async (req, res) => {
    const result = insertClientSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ message: result.error.message });
    const client = await storage.createClient(result.data);
    notifyNewClient(client).catch(() => {});
    res.status(201).json(client);
  });

  app.patch("/api/clients/:id", async (req, res) => {
    const result = insertClientSchema.partial().safeParse(req.body);
    if (!result.success) return res.status(400).json({ message: result.error.message });
    const client = await storage.updateClient(Number(req.params.id), result.data);
    if (!client) return res.status(404).json({ message: "Client not found" });
    res.json(client);
  });

  app.delete("/api/clients/:id", async (req, res) => {
    await storage.deleteClient(Number(req.params.id));
    res.status(204).end();
  });

  app.get("/api/clients/:id/orders", async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "ID inválido" });
    const orders = await storage.getOrdersByClient(id);
    res.json(orders);
  });

  app.get("/api/clients/:id/documents", async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "ID inválido" });
    const docs = await storage.getClientDocuments(id);
    res.json(docs);
  });

  app.post("/api/clients/:id/documents", async (req, res) => {
    const clientId = Number(req.params.id);
    if (isNaN(clientId)) return res.status(400).json({ message: "ID inválido" });
    const result = insertClientDocumentSchema.safeParse({ ...req.body, clientId });
    if (!result.success) return res.status(400).json({ message: result.error.message });
    const doc = await storage.createClientDocument(result.data);
    res.status(201).json(doc);
  });

  app.delete("/api/clients/:id/documents/:docId", async (req, res) => {
    await storage.deleteClientDocument(Number(req.params.docId));
    res.status(204).end();
  });

  // Products
  app.get("/api/products", async (_req, res) => {
    const products = await storage.getProducts();
    res.json(products);
  });

  app.get("/api/products/:id", async (req, res) => {
    const product = await storage.getProduct(Number(req.params.id));
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  });

  app.post("/api/products", async (req, res) => {
    const result = insertProductSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ message: result.error.message });
    const product = await storage.createProduct(result.data);
    notifyNewProduct(product).catch(() => {});
    res.status(201).json(product);
  });

  app.patch("/api/products/:id", async (req, res) => {
    const result = insertProductSchema.partial().safeParse(req.body);
    if (!result.success) return res.status(400).json({ message: result.error.message });
    const product = await storage.updateProduct(Number(req.params.id), result.data);
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  });

  app.delete("/api/products/:id", async (req, res) => {
    await storage.deleteProduct(Number(req.params.id));
    res.status(204).end();
  });

  // Quotations
  app.get("/api/quotations", async (_req, res) => {
    const list = await storage.getQuotations();
    res.json(list);
  });

  app.get("/api/quotations/:id", async (req, res) => {
    const quotation = await storage.getQuotation(Number(req.params.id));
    if (!quotation) return res.status(404).json({ message: "Quotation not found" });
    res.json(quotation);
  });

  app.post("/api/quotations", async (req, res) => {
    const result = insertQuotationSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ message: result.error.message });
    const quotation = await storage.createQuotation(result.data);
    (async () => {
      try {
        const full = await storage.getQuotation(quotation.id);
        if (full) await notifyNewQuotation({ ...quotation, clientName: full.client?.name, productName: full.product?.type });
      } catch {}
    })();
    res.status(201).json(quotation);
  });

  app.patch("/api/quotations/:id", async (req, res) => {
    const result = insertQuotationSchema.partial().safeParse(req.body);
    if (!result.success) return res.status(400).json({ message: result.error.message });
    const quotation = await storage.updateQuotation(Number(req.params.id), result.data);
    if (!quotation) return res.status(404).json({ message: "Quotation not found" });
    res.json(quotation);
  });

  app.delete("/api/quotations/:id", async (req, res) => {
    await storage.deleteQuotation(Number(req.params.id));
    res.status(204).end();
  });

  app.get("/api/quotations/:id/send-log", async (req, res) => {
    const log = await storage.getQuotationSendLog(Number(req.params.id));
    res.json(log);
  });

  app.post("/api/quotations/:id/send-log", async (req, res) => {
    const { method, userName, recipientInfo } = req.body;
    if (!method || !["email", "whatsapp"].includes(method)) {
      return res.status(400).json({ message: "Invalid method" });
    }
    const entry = await storage.createQuotationSendLog({
      quotationId: Number(req.params.id),
      method,
      userName: userName || "Sistema",
      recipientInfo,
    });

    if (req.body.updateStatus) {
      await storage.updateQuotation(Number(req.params.id), { status: "enviada" });
    }

    res.status(201).json(entry);
  });

  // Export Orders
  app.get("/api/orders", async (req, res) => {
    const { page, limit, search, country, status, month } = req.query as Record<string, string>;
    if (page || limit || search || country || status || month) {
      const result = await storage.getOrdersPaginated({
        page: Math.max(1, parseInt(page || "1")),
        limit: Math.min(100, Math.max(1, parseInt(limit || "50"))),
        search: search || undefined,
        country: country || undefined,
        status: status || undefined,
        month: month || undefined,
      });
      const totalPages = Math.ceil(result.total / Math.min(100, Math.max(1, parseInt(limit || "50"))));
      return res.json({ data: result.data, total: result.total, page: parseInt(page || "1"), totalPages });
    }
    const orders = await storage.getOrders();
    res.json(orders);
  });

  app.get("/api/orders/:id", async (req, res) => {
    const order = await storage.getOrder(Number(req.params.id));
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json(order);
  });

  app.post("/api/orders", async (req, res) => {
    try {
      const { clientId, productId } = req.body;
      if (!clientId || !productId || !req.body.invoice || !req.body.factory || !req.body.modal || !req.body.unitPrice || !req.body.quantity) {
        return res.status(400).json({ message: "Missing required fields: clientId, productId, invoice, factory, modal, unitPrice, quantity" });
      }
      const client = await storage.getClient(Number(clientId));
      if (!client) return res.status(400).json({ message: "Client not found" });
      const product = await storage.getProduct(Number(productId));
      if (!product) return res.status(400).json({ message: "Product not found" });
      const order = await storage.createOrder(req.body);
      const userName = req.body.userName || "Sistema";
      await storage.createAuditLogEntry({
        orderId: order.id,
        action: "criação",
        userName,
        snapshot: order,
      });
      notifyNewOrder({ ...order, clientName: client.name, productName: product.type }).catch(() => {});
      res.status(201).json(order);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.patch("/api/orders/:id", async (req, res) => {
    try {
      const orderId = Number(req.params.id);
      const existingOrder = await storage.getOrder(orderId);
      if (!existingOrder) return res.status(404).json({ message: "Order not found" });

      if (req.body.clientId) {
        const client = await storage.getClient(Number(req.body.clientId));
        if (!client) return res.status(400).json({ message: "Client not found" });
      }
      if (req.body.productId) {
        const product = await storage.getProduct(Number(req.body.productId));
        if (!product) return res.status(400).json({ message: "Product not found" });
      }

      const fieldLabels: Record<string, string> = {
        clientId: "Cliente", productId: "Produto", supplierId: "Fornecedor",
        invoice: "Invoice", factory: "Fábrica", nfe: "NFE",
        bookingCrt: "Booking/CRT", dueNumber: "Número DUE",
        parametrizacao: "Parametrização", modal: "Modal", vessel: "Vessel",
        embarqueDate: "Data Embarque", desembarqueDate: "Data Desembarque",
        deadlineDra: "Deadline DRA", deadlineCarga: "Deadline Carga",
        unitPrice: "Valor Unitário", quantity: "Quantidade",
        paymentTerms: "Termos de Pagamento", dueDate: "Vencimento",
        paymentDate: "Data Pagamento", acc: "ACC",
        exchangeClose: "Fechamento Câmbio", statusPagamento: "Status Pagamento",
      };

      const changes: { field: string; label: string; from: unknown; to: unknown }[] = [];
      const { userName, ...updateData } = req.body;
      for (const [key, newVal] of Object.entries(updateData)) {
        const oldVal = (existingOrder as Record<string, unknown>)[key];
        if (String(newVal ?? "") !== String(oldVal ?? "")) {
          changes.push({
            field: key,
            label: fieldLabels[key] || key,
            from: oldVal ?? null,
            to: newVal ?? null,
          });
        }
      }

      const order = await storage.updateOrder(orderId, updateData);
      if (!order) return res.status(404).json({ message: "Order not found" });

      if (changes.length > 0) {
        await storage.createAuditLogEntry({
          orderId,
          action: "alteração",
          userName: userName || "Sistema",
          changes,
          snapshot: order,
        });
      }

      res.json(order);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.delete("/api/orders/:id", async (req, res) => {
    const orderId = Number(req.params.id);
    const existingOrder = await storage.getOrder(orderId);
    if (existingOrder) {
      await storage.createAuditLogEntry({
        orderId,
        action: "exclusão",
        userName: "Sistema",
        snapshot: existingOrder,
      });
    }
    await storage.deleteOrder(orderId);
    res.status(204).end();
  });

  // Order Audit Log
  app.get("/api/orders/:id/audit-log", async (req, res) => {
    const log = await storage.getOrderAuditLog(Number(req.params.id));
    res.json(log);
  });

  // Platform Users
  app.get("/api/platform-users", async (_req, res) => {
    const users = await storage.getPlatformUsers();
    res.json(users);
  });

  app.get("/api/platform-users/:id", async (req, res) => {
    const user = await storage.getPlatformUser(Number(req.params.id));
    if (!user) return res.status(404).json({ message: "Usuário não encontrado" });
    res.json(user);
  });

  app.post("/api/platform-users", async (req, res) => {
    const result = insertPlatformUserSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ message: result.error.message });
    const user = await storage.createPlatformUser(result.data);
    res.status(201).json(user);
  });

  app.patch("/api/platform-users/:id", async (req, res) => {
    const result = insertPlatformUserSchema.partial().safeParse(req.body);
    if (!result.success) return res.status(400).json({ message: result.error.message });
    const user = await storage.updatePlatformUser(Number(req.params.id), result.data);
    if (!user) return res.status(404).json({ message: "Usuário não encontrado" });
    res.json(user);
  });

  app.delete("/api/platform-users/:id", async (req, res) => {
    await storage.deletePlatformUser(Number(req.params.id));
    res.status(204).end();
  });

  // AI Analysis (streaming SSE)
  app.post("/api/ai/analysis", async (req, res) => {
    try {
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const stats = await storage.getDashboardStats();
      const orders = await storage.getOrders();
      const clients = await storage.getClients();
      const quotations = await storage.getQuotations();

      const currentYear = new Date().getFullYear();
      const paidOrders = orders.filter(o => o.statusPagamento === "pago");
      const pendingOrders = orders.filter(o => o.statusPagamento === "pendente");
      const overdueOrders = orders.filter(o => o.statusPagamento === "atrasado");

      const avgPaymentDays = paidOrders.length > 0
        ? paidOrders.reduce((sum, o) => {
            if (!o.dueDate || !o.paymentDate) return sum;
            const days = Math.abs(new Date(o.paymentDate).getTime() - new Date(o.dueDate).getTime()) / 86400000;
            return sum + days;
          }, 0) / paidOrders.filter(o => o.dueDate && o.paymentDate).length
        : 0;

      const countryExposure = orders.reduce((acc: Record<string, number>, o: any) => {
        const country = o.client?.country;
        if (country && country !== "Bolívia") {
          acc[country] = (acc[country] || 0) + parseFloat(o.total);
        }
        return acc;
      }, {});

      const clientConcentration = stats.revenueByClient.map(c => ({
        cliente: c.client,
        receita: c.total,
        percentual: ((c.total / stats.totalRevenue) * 100).toFixed(1) + "%",
      }));

      const dataContext = {
        periodo: `Análise gerada em ${new Date().toLocaleDateString("pt-BR")} para o ano ${currentYear}`,
        resumo_financeiro: {
          receita_total: stats.totalRevenue,
          volume_total_toneladas: stats.totalVolume,
          ticket_medio: Math.round(stats.ticketMedio),
          total_pago: stats.totalPago,
          total_pendente: stats.totalPendente,
          total_atrasado: stats.totalAtrasado,
          ordens_totais: orders.length,
          taxa_inadimplencia_pct: ((stats.totalAtrasado / stats.totalRevenue) * 100).toFixed(1),
          media_dias_pagamento: Math.round(avgPaymentDays),
        },
        receita_por_mes: stats.monthlyRevenueFull,
        receita_por_pais: stats.revenueByCountry,
        mix_produtos: stats.productMix,
        distribuicao_modal: stats.modalDistribution,
        concentracao_clientes: clientConcentration,
        exposicao_cambial_por_pais: countryExposure,
        fluxo_caixa_previsto: stats.cashFlow,
        cotacoes: {
          total: quotations.length,
          por_status: quotations.reduce((acc: Record<string, number>, q) => {
            acc[q.status] = (acc[q.status] || 0) + 1;
            return acc;
          }, {}),
        },
        clientes_ativos: clients.length,
        ordens_em_aberto: pendingOrders.length,
        ordens_em_atraso: overdueOrders.length,
      };

      const prompt = `Você é um analista financeiro especializado em operações de exportação de papel kraft para mercados sul-americanos (Argentina, Paraguai, Uruguai, Bolívia). Analise os dados abaixo do sistema ERP Hypertrade e forneça uma análise completa em português do Brasil.

DADOS DO SISTEMA:
${JSON.stringify(dataContext, null, 2)}

Forneça uma análise estruturada com as seguintes seções (use markdown com ## para títulos):

## 1. Situação Financeira Atual
Análise do faturamento, ticket médio, inadimplência e saúde financeira geral.

## 2. Projeção de Caixa (Próximos 3 Meses)
Com base no histórico de pagamentos e pedidos pendentes, estime o fluxo de caixa esperado. Inclua valores numéricos estimados.

## 3. Tendência de Faturamento
Identifique sazonalidade, aceleração ou desaceleração no faturamento mês a mês. Projete os próximos 3 meses.

## 4. Análise de Exposição Cambial
Avalie o risco cambial por país (ARS, UYU, PYG) e recomende estratégias de hedge ou proteção.

## 5. Análise de Clientes
Concentração de receita por cliente, risco de dependência, clientes com melhor e pior performance de pagamento.

## 6. Mix de Produtos e Modal
Análise da rentabilidade por produto e eficiência por modal (marítimo vs. rodoviário).

## 7. Alertas e Riscos
Liste os principais riscos identificados com nível de severidade (🔴 Alto, 🟡 Médio, 🟢 Baixo).

## 8. Recomendações Estratégicas
Top 5 ações recomendadas com base na análise, em ordem de prioridade.

Seja preciso com números, use os dados fornecidos e seja direto nas recomendações.`;

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const stream = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        stream: true,
        max_tokens: 4000,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error: any) {
      console.error("AI analysis error:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ message: "Erro ao gerar análise com IA" });
      }
    }
  });

  // Dashboard Stats
  app.get("/api/dashboard/stats", async (req, res) => {
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
    const filters: { startDate?: string; endDate?: string } = {};
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    const stats = await storage.getDashboardStats(Object.keys(filters).length > 0 ? filters : undefined);
    res.json(stats);
  });

  // Currency Quotes
  const CURRENCY_META: Record<string, { name: string; country: string; countryCode: string }> = {
    BRL: { name: "Real Brasileiro", country: "Brasil", countryCode: "BR" },
    ARS: { name: "Peso Argentino", country: "Argentina", countryCode: "AR" },
    CLP: { name: "Peso Chileno", country: "Chile", countryCode: "CL" },
    UYU: { name: "Peso Uruguaio", country: "Uruguai", countryCode: "UY" },
    PYG: { name: "Guaraní Paraguaio", country: "Paraguai", countryCode: "PY" },
    MXN: { name: "Peso Mexicano", country: "México", countryCode: "MX" },
  };

  let quotesCache: { data: any; timestamp: number } | null = null;
  let previousQuotesSnapshot: Record<string, number> | null = null;
  const CACHE_TTL = 5 * 60 * 1000;

  app.get("/api/quotes", async (_req, res) => {
    try {
      if (quotesCache && Date.now() - quotesCache.timestamp < CACHE_TTL) {
        return res.json(quotesCache.data);
      }

      const targetCodes = Object.keys(CURRENCY_META);

      const latestRes = await fetch("https://open.er-api.com/v6/latest/USD");
      if (!latestRes.ok) {
        throw new Error(`ExchangeRate API error: ${latestRes.status}`);
      }

      const latest = await latestRes.json() as {
        time_last_update_utc: string;
        time_next_update_utc: string;
        rates: Record<string, number>;
      };

      const yesterdayDate = getYesterdayDate();
      const ecbSupportedCodes = ["BRL", "MXN"];
      const ecbCurrencies = ecbSupportedCodes.join(",");

      let historicalRates: Record<string, number> = {};
      try {
        const frankRes = await fetch(`https://api.frankfurter.app/${yesterdayDate}?from=USD&to=${ecbCurrencies}`);
        if (frankRes.ok) {
          const frankData = await frankRes.json() as { rates: Record<string, number> };
          historicalRates = frankData.rates;
        }
      } catch {}

      if (previousQuotesSnapshot) {
        for (const code of targetCodes) {
          if (!historicalRates[code] && previousQuotesSnapshot[code]) {
            historicalRates[code] = previousQuotesSnapshot[code];
          }
        }
      }

      const currenciesData = targetCodes.map((code) => {
        const meta = CURRENCY_META[code];
        const rate = latest.rates[code] || 0;
        const prevRate = historicalRates[code] || null;
        const change24h = prevRate && rate
          ? ((rate - prevRate) / prevRate) * 100
          : null;

        return {
          code,
          name: meta.name,
          country: meta.country,
          countryCode: meta.countryCode,
          rate,
          previousRate: prevRate,
          inverse: rate ? 1 / rate : 0,
          change24h,
        };
      });

      const currentSnapshot: Record<string, number> = {};
      for (const code of targetCodes) {
        if (latest.rates[code]) {
          currentSnapshot[code] = latest.rates[code];
        }
      }
      previousQuotesSnapshot = currentSnapshot;

      const dateStr = latest.time_last_update_utc
        ? new Date(latest.time_last_update_utc).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0];

      const result = {
        base: "USD",
        date: dateStr,
        yesterdayDate,
        currencies: currenciesData,
        source: "ExchangeRate-API (open.er-api.com)",
        lastUpdate: new Date().toISOString(),
      };

      quotesCache = { data: result, timestamp: Date.now() };
      res.json(result);
    } catch (error: any) {
      console.error("Error fetching quotes:", error.message);
      if (quotesCache) {
        return res.json({ ...quotesCache.data, stale: true });
      }
      res.status(500).json({ message: "Failed to fetch currency quotes" });
    }
  });

  // Historical exchange rate for a given date (USD → BRL)
  app.get("/api/historical-rate", async (req, res) => {
    const { date, currency = "BRL" } = req.query as Record<string, string>;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ message: "Parâmetro 'date' obrigatório no formato YYYY-MM-DD" });
    }
    try {
      let response = await fetch(`https://api.frankfurter.app/${date}?from=USD&to=${currency}`);
      let isFallback = false;
      if (!response.ok) {
        response = await fetch(`https://api.frankfurter.app/latest?from=USD&to=${currency}`);
        isFallback = true;
      }
      if (!response.ok) throw new Error("Frankfurter API error");
      const data: any = await response.json();
      return res.json({
        requestedDate: date,
        resolvedDate: data.date,
        rate: data.rates?.[currency] ?? null,
        currency,
        isFallback,
      });
    } catch (err: any) {
      console.error("Error fetching historical rate:", err.message);
      res.status(500).json({ message: "Falha ao buscar câmbio histórico" });
    }
  });

  // Shipment Tracking
  app.get("/api/tracking/:orderId", async (req, res) => {
    const orderId = Number(req.params.orderId);
    if (isNaN(orderId)) return res.status(400).json({ message: "ID inválido" });
    const tracking = await storage.getShipmentTracking(orderId);
    if (!tracking) return res.status(404).json({ message: "Sem rastreamento disponível para esta ordem" });
    res.json(tracking);
  });

  app.put("/api/tracking/:orderId", async (req, res) => {
    const orderId = Number(req.params.orderId);
    if (isNaN(orderId)) return res.status(400).json({ message: "ID inválido" });
    const result = insertShipmentTrackingSchema.safeParse({ ...req.body, orderId });
    if (!result.success) return res.status(400).json({ message: result.error.message });
    const tracking = await storage.upsertShipmentTracking(result.data);
    res.json(tracking);
  });

  // ─── LPCO ────────────────────────────────────────────────────────────────────

  app.get("/api/lpco", async (_req, res) => {
    try {
      const items = await storage.getLpcos();
      res.json(items);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/lpco/:id", async (req, res) => {
    try {
      const item = await storage.getLpco(Number(req.params.id));
      if (!item) return res.status(404).json({ message: "LPCO não encontrado" });
      res.json(item);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/lpco", upload.single("arquivo"), async (req, res) => {
    try {
      const body = req.body;
      const data: any = {
        tipo: body.tipo,
        orgao: body.orgao,
        numero: body.numero,
        descricao: body.descricao,
        status: body.status || "pendente",
        dataEmissao: body.dataEmissao || null,
        dataValidade: body.dataValidade || null,
        orderId: body.orderId ? Number(body.orderId) : null,
        clientId: body.clientId ? Number(body.clientId) : null,
        observacoes: body.observacoes || null,
        responsavel: body.responsavel || null,
      };
      if (req.file) {
        data.nomeArquivo = req.file.filename;
        data.nomeOriginal = req.file.originalname;
        data.mimeType = req.file.mimetype;
      }
      const item = await storage.createLpco(data);
      res.status(201).json(item);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.patch("/api/lpco/:id", upload.single("arquivo"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const body = req.body;
      const data: any = { ...body };
      if (body.orderId !== undefined) data.orderId = body.orderId ? Number(body.orderId) : null;
      if (body.clientId !== undefined) data.clientId = body.clientId ? Number(body.clientId) : null;
      if (req.file) {
        data.nomeArquivo = req.file.filename;
        data.nomeOriginal = req.file.originalname;
        data.mimeType = req.file.mimetype;
      }
      const item = await storage.updateLpco(id, data);
      if (!item) return res.status(404).json({ message: "LPCO não encontrado" });
      res.json(item);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.delete("/api/lpco/:id", async (req, res) => {
    try {
      await storage.deleteLpco(Number(req.params.id));
      res.status(204).send();
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/lpco/:id/arquivo", async (req, res) => {
    try {
      const item = await storage.getLpco(Number(req.params.id));
      if (!item || !item.nomeArquivo) return res.status(404).json({ message: "Arquivo não encontrado" });
      const filePath = path.join(UPLOADS_DIR, item.nomeArquivo);
      if (!fs.existsSync(filePath)) return res.status(404).json({ message: "Arquivo não encontrado no servidor" });
      res.setHeader("Content-Type", item.mimeType || "application/octet-stream");
      res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(item.nomeOriginal || item.nomeArquivo)}"`);
      fs.createReadStream(filePath).pipe(res);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ─── Documentação Cambial ───────────────────────────────────────────────────

  app.get("/api/documentos/summary", async (_req, res) => {
    try {
      const rows = await storage.getDocumentosSummary();
      const map: Record<number, Record<string, string>> = {};
      for (const r of rows) {
        if (!map[r.orderId]) map[r.orderId] = {};
        map[r.orderId][r.tipo] = r.status;
      }
      res.json(map);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/documentos", async (req, res) => {
    try {
      const orderId = Number(req.query.orderId);
      const includeArchived = req.query.includeArchived === "true";
      if (!orderId) return res.status(400).json({ message: "orderId obrigatório" });
      const docs = await storage.getDocumentosByOrder(orderId, includeArchived);
      res.json(docs);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/documentos/upload", upload.single("arquivo"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "Arquivo não enviado" });
      const { orderId, tipo, uploadedBy = "Gestor", uploadedByType = "manager" } = req.body;
      if (!orderId || !tipo) return res.status(400).json({ message: "orderId e tipo são obrigatórios" });

      const tiposValidos = ["commercial_invoice", "packing_list", "bill_of_lading"];
      if (!tiposValidos.includes(tipo)) return res.status(400).json({ message: "Tipo inválido" });

      const existentes = await storage.getDocumentosByOrder(Number(orderId));
      const mesmotipo = existentes.filter(d => d.tipo === tipo && !d.isArquivado);

      let novaVersao = 1;
      for (const ant of mesmotipo) {
        novaVersao = Math.max(novaVersao, ant.versao + 1);
        await storage.arquivarDocumento(ant.id);
      }

      const doc = await storage.createDocumento({
        orderId: Number(orderId),
        tipo,
        nomeOriginal: req.file.originalname,
        nomeArquivo: req.file.filename,
        mimeType: req.file.mimetype,
        tamanho: req.file.size,
        versao: novaVersao,
        uploadedBy,
        uploadedByType,
      });

      await storage.createDocumentoAuditEntry({
        documentoId: doc.id,
        acao: "enviado",
        userName: uploadedBy,
        userType: uploadedByType,
        detalhes: `${req.file.originalname} (v${novaVersao})`,
      });

      res.status(201).json(doc);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.patch("/api/documentos/:id/status", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { status, motivoRejeicao, userName = "Gestor", userType = "manager" } = req.body;
      const statusValidos = ["pendente", "em_analise", "aprovado", "rejeitado"];
      if (!statusValidos.includes(status)) return res.status(400).json({ message: "Status inválido" });

      const doc = await storage.updateDocumentoStatus(id, status, motivoRejeicao);
      if (!doc) return res.status(404).json({ message: "Documento não encontrado" });

      await storage.createDocumentoAuditEntry({
        documentoId: id,
        acao: "status_alterado",
        userName,
        userType,
        detalhes: `Status alterado para: ${status}${motivoRejeicao ? ` — ${motivoRejeicao}` : ""}`,
      });

      res.json(doc);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.get("/api/documentos/:id/arquivo", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { acao = "baixou", userName = "Gestor", userType = "manager" } = req.query as Record<string, string>;
      const doc = await storage.getDocumento(id);
      if (!doc) return res.status(404).json({ message: "Documento não encontrado" });

      const filePath = path.join(UPLOADS_DIR, doc.nomeArquivo);
      if (!fs.existsSync(filePath)) return res.status(404).json({ message: "Arquivo não encontrado no servidor" });

      await storage.createDocumentoAuditEntry({
        documentoId: id,
        acao,
        userName,
        userType,
        detalhes: doc.nomeOriginal,
      });

      res.setHeader("Content-Type", doc.mimeType);
      res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(doc.nomeOriginal)}"`);
      fs.createReadStream(filePath).pipe(res);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/documentos/:id/auditoria", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const log = await storage.getDocumentoAuditLog(id);
      res.json(log);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/query-ai", async (req, res) => {
    try {
      const { question, businessContext, temperature } = req.body;
      if (!question || typeof question !== "string") {
        return res.status(400).json({ error: "Pergunta é obrigatória." });
      }
      const customTemperature = typeof temperature === "number" && temperature >= 0 && temperature <= 1 ? temperature : 0.1;
      const customContext = typeof businessContext === "string" && businessContext.trim() ? `\n\nCONTEXTO ADICIONAL DO NEGÓCIO:\n${businessContext.trim()}` : "";

      const schemaContext = `
Banco de dados PostgreSQL do sistema Hypertrade (ERP logístico de exportação de papel kraft).

TABELAS:

suppliers (fornecedores)
  id SERIAL PK
  name TEXT
  cnpj TEXT
  contact TEXT
  phone TEXT
  email TEXT
  city TEXT
  state TEXT

clients (clientes)
  id SERIAL PK
  name TEXT
  country TEXT
  credit_limit NUMERIC(12,2)
  payment_terms TEXT

products (produtos)
  id SERIAL PK
  type TEXT  (ex: "Standard Brown Kraft", "Extensible Kraft", "White Top Kraft", "Sack Kraft")
  grammage TEXT  (ex: "80g/m²")
  standard_price NUMERIC(10,2)
  supplier_id INT FK suppliers.id

quotations (cotações)
  id SERIAL PK
  client_id INT FK clients.id
  product_id INT FK products.id
  supplier_id INT FK suppliers.id
  unit_price NUMERIC(10,2)
  quantity INT
  total NUMERIC(14,2)
  margem NUMERIC(5,2)
  payment_terms TEXT
  validity_date DATE
  notes TEXT
  status TEXT  (rascunho | enviada | aceita | recusada | convertida)
  created_at TIMESTAMP
  updated_at TIMESTAMP

export_orders (ordens de exportação)
  id SERIAL PK
  quotation_id INT FK quotations.id
  client_id INT FK clients.id
  product_id INT FK products.id
  supplier_id INT FK suppliers.id
  invoice TEXT
  factory TEXT
  nfe TEXT
  booking_crt TEXT
  due_number TEXT
  parametrizacao TEXT  (verde | amarelo | vermelho)
  modal TEXT  (rodoviario | maritimo)
  vessel TEXT
  embarque_date DATE
  desembarque_date DATE
  transit_time INT
  deadline_dra DATE
  deadline_carga DATE
  unit_price NUMERIC(10,2)
  quantity INT
  total NUMERIC(14,2)
  payment_terms TEXT
  due_date DATE
  payment_date DATE
  acc NUMERIC(12,2)
  exchange_close NUMERIC(10,4)
  status_pagamento TEXT  (pendente | pago | atrasado)
  vessel_status TEXT  (etd | zarpou | em_navegacao | fundeado)
  notificacoes_ativas BOOLEAN
  created_at TIMESTAMP

documentos (documentos cambiais)
  id SERIAL PK
  order_id INT FK export_orders.id
  tipo TEXT  (commercial_invoice | packing_list | bill_of_lading)
  status TEXT  (pendente | em_analise | aprovado | rejeitado)
  nome_original TEXT
  versao INT
  is_arquivado BOOLEAN
  created_at TIMESTAMP

lpco (licenças, permissões, certificados e outros)
  id SERIAL PK
  tipo TEXT  (licenca | permissao | certificado | outro)
  orgao TEXT  (MAPA | ANVISA | INMETRO | RECEITA_FEDERAL | IBAMA | SECEX | MDIC | outro)
  numero TEXT
  descricao TEXT
  status TEXT  (ativo | pendente | vencido | suspenso)
  data_emissao DATE
  data_validade DATE
  order_id INT FK export_orders.id
  client_id INT FK clients.id
  responsavel TEXT
  created_at TIMESTAMP
`;

      const systemPrompt = `Você é um especialista em SQL para PostgreSQL. O usuário fará perguntas em linguagem natural sobre dados de exportação. Você deve retornar APENAS um JSON válido (sem markdown, sem blocos de código) com o seguinte formato:

{
  "results": [
    {
      "sql": "SELECT ...",
      "chartSuggestions": [
        { "type": "bar", "label": "Barras", "reason": "Motivo breve por que este tipo é adequado" },
        { "type": "line", "label": "Linha", "reason": "Motivo breve" },
        { "type": "pie", "label": "Pizza", "reason": "Motivo breve" }
      ],
      "chartTitle": "Título descritivo do gráfico",
      "xAxisKey": "nome_da_coluna_para_eixo_x_ou_categoria",
      "yAxisKey": "nome_da_coluna_para_valor_numerico",
      "valueLabel": "Rótulo para o valor (ex: USD, Ton, Qtd)"
    }
  ]
}

Regras:
1. O campo "results" é um array. Retorne QUANTOS datasets forem necessários para responder completamente à pergunta do usuário. Se a pergunta pede apenas uma informação, retorne 1 item. Se pede múltiplas dimensões ou análises complementares, retorne 2 ou 3 itens com queries distintas.
2. Cada "sql" deve conter APENAS uma query SELECT (leitura). NUNCA gere INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE ou qualquer outra operação de escrita.
3. Use aliases em português para os campos quando possível (ex: SUM(total) AS total_usd).
4. Use JOINs quando necessário. Sempre qualifique colunas com o nome da tabela.
5. O campo "chartSuggestions" deve conter EXATAMENTE 3 objetos ordenados do mais adequado para o menos adequado. Os tipos possíveis são: "bar", "line", "pie", "kpi", "table". Escolha tipos distintos entre si. Se o resultado for um valor único, coloque "kpi" como primeiro. Se for série temporal, "line" primeiro. Se for comparação entre categorias, "bar" primeiro.
6. xAxisKey e yAxisKey devem ser os aliases exatos que aparecem no resultado SQL.
7. Limite resultados com LIMIT 50 quando não houver um limite natural.
8. Cada gráfico deve ter um "chartTitle" descritivo e único para identificar claramente o que representa.

Schema disponível:
${schemaContext}${customContext}`;

      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question },
        ],
        response_format: { type: "json_object" },
        temperature: customTemperature,
      });

      const raw = completion.choices[0].message.content ?? "{}";
      let parsed: any;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return res.status(500).json({ error: "IA retornou resposta inválida. Tente reformular a pergunta." });
      }

      const forbiddenKeywords = /\b(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|GRANT|REVOKE|EXECUTE|EXEC|COPY|VACUUM|ANALYZE|REINDEX)\b/;
      const fallbackSuggestions = [
        { type: "bar", label: "Barras", reason: "Comparação entre categorias" },
        { type: "line", label: "Linha", reason: "Tendência ao longo do tempo" },
        { type: "pie", label: "Pizza", reason: "Distribuição proporcional" },
      ];

      const rawResults: any[] = Array.isArray(parsed.results) && parsed.results.length > 0
        ? parsed.results.slice(0, 4)
        : parsed.sql
          ? [{ sql: parsed.sql, chartSuggestions: parsed.chartSuggestions, chartTitle: parsed.chartTitle, xAxisKey: parsed.xAxisKey, yAxisKey: parsed.yAxisKey, valueLabel: parsed.valueLabel }]
          : [];

      if (rawResults.length === 0) {
        return res.status(500).json({ error: "IA não retornou nenhum dataset. Tente reformular a pergunta." });
      }

      const { pool } = await import("./storage");
      const finalResults: any[] = [];

      for (const item of rawResults) {
        const generatedSql: string = (item.sql ?? "").trim();
        const normalizedSql = generatedSql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "").trim().toUpperCase();
        if (!normalizedSql.startsWith("SELECT")) {
          return res.status(400).json({ error: `Dataset "${item.chartTitle ?? "sem título"}": query inválida (não é SELECT). Reformule a pergunta.` });
        }
        if (forbiddenKeywords.test(normalizedSql)) {
          return res.status(400).json({ error: `Dataset "${item.chartTitle ?? "sem título"}": query contém operações não permitidas.` });
        }

        const client = await pool.connect();
        let rows: any[] = [];
        let columns: string[] = [];
        try {
          await client.query("BEGIN");
          await client.query("SET TRANSACTION READ ONLY");
          const result = await client.query(generatedSql);
          rows = result.rows;
          columns = result.fields.map((f: any) => f.name);
          await client.query("COMMIT");
        } catch (dbErr: any) {
          await client.query("ROLLBACK");
          return res.status(400).json({ error: `Erro ao executar query "${item.chartTitle ?? "sem título"}": ${dbErr.message}` });
        } finally {
          client.release();
        }

        const chartSuggestions = Array.isArray(item.chartSuggestions) && item.chartSuggestions.length >= 1
          ? item.chartSuggestions.slice(0, 3)
          : fallbackSuggestions;

        finalResults.push({
          sql: generatedSql,
          rows,
          columns,
          chartSuggestions,
          chartTitle: item.chartTitle ?? "Resultado",
          xAxisKey: item.xAxisKey ?? columns[0],
          yAxisKey: item.yAxisKey ?? columns[1],
          valueLabel: item.valueLabel ?? "",
        });
      }

      return res.json({ results: finalResults });
    } catch (e: any) {
      console.error("query-ai error:", e);
      res.status(500).json({ error: e.message ?? "Erro interno" });
    }
  });

  registerPortalRoutes(app);

  // ─── Telegram Notifications ──────────────────────────────────────────────────

  app.get("/api/telegram/status", (_req, res) => {
    res.json({ configured: isTelegramConfigured() });
  });

  app.get("/api/telegram/config", async (_req, res) => {
    try {
      const cfg = await storage.getTelegramConfig();
      res.json(cfg);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.put("/api/telegram/config", async (req, res) => {
    try {
      const { enabled, onNewQuotation, onNewOrder, onNewClient, onNewSupplier, onNewProduct } = req.body;
      const cfg = await storage.saveTelegramConfig({ enabled, onNewQuotation, onNewOrder, onNewClient, onNewSupplier, onNewProduct });
      res.json(cfg);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/telegram/test", async (_req, res) => {
    const msg = `✅ <b>Hypertrade ERP</b>\n\nConexão com o Telegram funcionando!\n📅 ${new Date().toLocaleString("pt-BR")}`;
    const result = await sendTelegramMessage(msg);
    if (result.ok) res.json({ ok: true, message: "Mensagem de teste enviada com sucesso." });
    else res.status(500).json({ ok: false, error: result.error });
  });

  app.post("/api/telegram/report", async (_req, res) => {
    try {
      const text = await buildDailyReport();
      const result = await sendTelegramMessage(text);
      if (result.ok) res.json({ ok: true, message: "Relatório enviado com sucesso." });
      else res.status(500).json({ ok: false, error: result.error });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post("/api/telegram/vencimentos", async (_req, res) => {
    try {
      const text = await buildVencimentosAlert();
      const result = await sendTelegramMessage(text);
      if (result.ok) res.json({ ok: true, message: "Alerta de vencimentos enviado com sucesso." });
      else res.status(500).json({ ok: false, error: result.error });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post("/api/telegram/lpco", async (_req, res) => {
    try {
      const text = await buildLpcoAlert();
      const result = await sendTelegramMessage(text);
      if (result.ok) res.json({ ok: true, message: "Alerta de LPCO enviado com sucesso." });
      else res.status(500).json({ ok: false, error: result.error });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post("/api/telegram/custom", async (req, res) => {
    try {
      const { message } = req.body;
      if (!message) return res.status(400).json({ ok: false, error: "Mensagem obrigatória." });
      const result = await sendTelegramMessage(message);
      if (result.ok) res.json({ ok: true, message: "Mensagem enviada com sucesso." });
      else res.status(500).json({ ok: false, error: result.error });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  return httpServer;
}

function getYesterdayDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  if (d.getDay() === 0) d.setDate(d.getDate() - 2);
  if (d.getDay() === 6) d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}
