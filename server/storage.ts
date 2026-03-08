import { eq, desc, sql, and, or, ilike } from "drizzle-orm";
import { count as drizzleCount } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import {
  suppliers, clients, products, quotations, quotationSendLog, exportOrders, orderAuditLog, platformUsers, shipmentTracking,
  documentos, documentoAuditLog, lpco,
  type Supplier, type InsertSupplier,
  type Client, type InsertClient,
  type Product, type InsertProduct,
  type Quotation, type InsertQuotation, type QuotationWithDetails,
  type QuotationSendLogEntry,
  type ExportOrder, type InsertExportOrder,
  type ExportOrderWithDetails,
  type OrderAuditLogEntry,
  type PlatformUser, type InsertPlatformUser,
  type ShipmentTracking, type InsertShipmentTracking,
  type Documento, type InsertDocumento, type DocumentoAuditEntry,
  type Lpco, type InsertLpco,
} from "@shared/schema";

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool);

export interface IStorage {
  getSuppliers(): Promise<Supplier[]>;
  getSupplier(id: number): Promise<Supplier | undefined>;
  createSupplier(data: InsertSupplier): Promise<Supplier>;
  updateSupplier(id: number, data: Partial<InsertSupplier>): Promise<Supplier | undefined>;
  deleteSupplier(id: number): Promise<void>;

  getClients(): Promise<Client[]>;
  getClient(id: number): Promise<Client | undefined>;
  createClient(data: InsertClient): Promise<Client>;
  updateClient(id: number, data: Partial<InsertClient>): Promise<Client | undefined>;
  deleteClient(id: number): Promise<void>;

  getProducts(): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  createProduct(data: InsertProduct): Promise<Product>;
  updateProduct(id: number, data: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: number): Promise<void>;

  getQuotations(): Promise<QuotationWithDetails[]>;
  getQuotation(id: number): Promise<QuotationWithDetails | undefined>;
  createQuotation(data: InsertQuotation): Promise<Quotation>;
  updateQuotation(id: number, data: Partial<InsertQuotation>): Promise<Quotation | undefined>;
  deleteQuotation(id: number): Promise<void>;
  getQuotationSendLog(quotationId: number): Promise<QuotationSendLogEntry[]>;
  createQuotationSendLog(data: { quotationId: number; method: "email" | "whatsapp"; userName: string; recipientInfo?: string }): Promise<QuotationSendLogEntry>;

  getOrders(): Promise<ExportOrderWithDetails[]>;
  getOrdersPaginated(params: { page: number; limit: number; search?: string; country?: string; status?: string; month?: string }): Promise<{ data: ExportOrderWithDetails[]; total: number }>;
  getOrder(id: number): Promise<ExportOrderWithDetails | undefined>;
  createOrder(data: InsertExportOrder): Promise<ExportOrder>;
  updateOrder(id: number, data: Partial<InsertExportOrder>): Promise<ExportOrder | undefined>;
  deleteOrder(id: number): Promise<void>;

  getOrderAuditLog(orderId: number): Promise<OrderAuditLogEntry[]>;
  createAuditLogEntry(data: { orderId: number; action: string; userName?: string; changes?: unknown; snapshot?: unknown }): Promise<OrderAuditLogEntry>;

  getPlatformUsers(): Promise<PlatformUser[]>;
  getPlatformUser(id: number): Promise<PlatformUser | undefined>;
  createPlatformUser(data: InsertPlatformUser): Promise<PlatformUser>;
  updatePlatformUser(id: number, data: Partial<InsertPlatformUser>): Promise<PlatformUser | undefined>;
  deletePlatformUser(id: number): Promise<void>;

  getShipmentTracking(orderId: number): Promise<ShipmentTracking | undefined>;
  upsertShipmentTracking(data: InsertShipmentTracking): Promise<ShipmentTracking>;

  getDocumentosByOrder(orderId: number, includeArchived?: boolean): Promise<Documento[]>;
  getDocumento(id: number): Promise<Documento | undefined>;
  createDocumento(data: InsertDocumento): Promise<Documento>;
  updateDocumentoStatus(id: number, status: string, motivoRejeicao?: string): Promise<Documento | undefined>;
  arquivarDocumento(id: number): Promise<void>;
  getDocumentoAuditLog(documentoId: number): Promise<DocumentoAuditEntry[]>;
  createDocumentoAuditEntry(data: { documentoId: number; acao: string; userName: string; userType: string; detalhes?: string }): Promise<DocumentoAuditEntry>;

  getLpcos(): Promise<Lpco[]>;
  getLpco(id: number): Promise<Lpco | undefined>;
  createLpco(data: InsertLpco): Promise<Lpco>;
  updateLpco(id: number, data: Partial<InsertLpco>): Promise<Lpco | undefined>;
  deleteLpco(id: number): Promise<void>;

  getDashboardStats(filters?: { startDate?: string; endDate?: string }): Promise<{
    totalRevenue: number;
    totalVolume: number;
    pendingInvoices: number;
    overdueCount: number;
    revenueByCountry: { country: string; total: number }[];
    productMix: { type: string; count: number }[];
    cashFlow: { month: string; amount: number }[];
    paymentStatusDistribution: { status: string; count: number }[];
    modalDistribution: { modal: string; count: number; total: number }[];
    parametrizacaoDistribution: { status: string; count: number }[];
    volumeByCountry: { country: string; volume: number }[];
    monthlyOrders: { month: string; count: number; total: number }[];
    monthlyRevenueFull: { month: string; total: number }[];
  }>;
}

export class DatabaseStorage implements IStorage {
  async getSuppliers(): Promise<Supplier[]> {
    return db.select().from(suppliers).orderBy(suppliers.name);
  }

  async getSupplier(id: number): Promise<Supplier | undefined> {
    const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, id));
    return supplier;
  }

  async createSupplier(data: InsertSupplier): Promise<Supplier> {
    const [supplier] = await db.insert(suppliers).values(data).returning();
    return supplier;
  }

  async updateSupplier(id: number, data: Partial<InsertSupplier>): Promise<Supplier | undefined> {
    const [supplier] = await db.update(suppliers).set(data).where(eq(suppliers.id, id)).returning();
    return supplier;
  }

  async deleteSupplier(id: number): Promise<void> {
    await db.delete(suppliers).where(eq(suppliers.id, id));
  }

  async getClients(): Promise<Client[]> {
    return db.select().from(clients).orderBy(clients.name);
  }

  async getClient(id: number): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client;
  }

  async createClient(data: InsertClient): Promise<Client> {
    const [client] = await db.insert(clients).values(data).returning();
    return client;
  }

  async updateClient(id: number, data: Partial<InsertClient>): Promise<Client | undefined> {
    const [client] = await db.update(clients).set(data).where(eq(clients.id, id)).returning();
    return client;
  }

  async deleteClient(id: number): Promise<void> {
    await db.delete(clients).where(eq(clients.id, id));
  }

  async getProducts(): Promise<Product[]> {
    return db.select().from(products).orderBy(products.type);
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }

  async createProduct(data: InsertProduct): Promise<Product> {
    const [product] = await db.insert(products).values(data).returning();
    return product;
  }

  async updateProduct(id: number, data: Partial<InsertProduct>): Promise<Product | undefined> {
    const [product] = await db.update(products).set(data).where(eq(products.id, id)).returning();
    return product;
  }

  async deleteProduct(id: number): Promise<void> {
    await db.delete(products).where(eq(products.id, id));
  }

  async getQuotations(): Promise<QuotationWithDetails[]> {
    const rows = await db
      .select()
      .from(quotations)
      .leftJoin(clients, eq(quotations.clientId, clients.id))
      .leftJoin(products, eq(quotations.productId, products.id))
      .leftJoin(suppliers, eq(quotations.supplierId, suppliers.id))
      .orderBy(desc(quotations.createdAt));

    return rows.map((row) => ({
      ...row.quotations,
      client: row.clients!,
      product: row.products!,
      supplier: row.suppliers || null,
    }));
  }

  async getQuotation(id: number): Promise<QuotationWithDetails | undefined> {
    const [row] = await db
      .select()
      .from(quotations)
      .leftJoin(clients, eq(quotations.clientId, clients.id))
      .leftJoin(products, eq(quotations.productId, products.id))
      .leftJoin(suppliers, eq(quotations.supplierId, suppliers.id))
      .where(eq(quotations.id, id));

    if (!row) return undefined;
    return {
      ...row.quotations,
      client: row.clients!,
      product: row.products!,
      supplier: row.suppliers || null,
    };
  }

  async createQuotation(data: InsertQuotation): Promise<Quotation> {
    const total = (parseFloat(data.unitPrice) * Number(data.quantity)).toFixed(2);
    const [quotation] = await db.insert(quotations).values({ ...data, total }).returning();
    return quotation;
  }

  async updateQuotation(id: number, data: Partial<InsertQuotation>): Promise<Quotation | undefined> {
    const existing = await db.select().from(quotations).where(eq(quotations.id, id));
    if (!existing[0]) return undefined;

    const updates: Record<string, unknown> = { ...data, updatedAt: new Date() };
    const price = data.unitPrice !== undefined ? parseFloat(data.unitPrice) : parseFloat(existing[0].unitPrice);
    const qty = data.quantity !== undefined ? Number(data.quantity) : existing[0].quantity;
    if (data.unitPrice !== undefined || data.quantity !== undefined) {
      updates.total = (price * qty).toFixed(2);
    }

    const [quotation] = await db.update(quotations).set(updates).where(eq(quotations.id, id)).returning();
    return quotation;
  }

  async deleteQuotation(id: number): Promise<void> {
    await db.delete(quotations).where(eq(quotations.id, id));
  }

  async getQuotationSendLog(quotationId: number): Promise<QuotationSendLogEntry[]> {
    return db.select().from(quotationSendLog)
      .where(eq(quotationSendLog.quotationId, quotationId))
      .orderBy(desc(quotationSendLog.sentAt));
  }

  async createQuotationSendLog(data: { quotationId: number; method: "email" | "whatsapp"; userName: string; recipientInfo?: string }): Promise<QuotationSendLogEntry> {
    const [entry] = await db.insert(quotationSendLog).values({
      quotationId: data.quotationId,
      method: data.method,
      userName: data.userName,
      recipientInfo: data.recipientInfo || null,
    }).returning();
    return entry;
  }

  async getOrders(): Promise<ExportOrderWithDetails[]> {
    const rows = await db
      .select()
      .from(exportOrders)
      .leftJoin(clients, eq(exportOrders.clientId, clients.id))
      .leftJoin(products, eq(exportOrders.productId, products.id))
      .leftJoin(suppliers, eq(exportOrders.supplierId, suppliers.id))
      .orderBy(desc(exportOrders.createdAt));

    return rows.map((row) => ({
      ...row.export_orders,
      client: row.clients!,
      product: row.products!,
      supplier: row.suppliers || null,
    }));
  }

  async getOrdersPaginated(params: { page: number; limit: number; search?: string; country?: string; status?: string; month?: string }): Promise<{ data: ExportOrderWithDetails[]; total: number }> {
    const { page, limit, search, country, status, month } = params;
    const offset = (page - 1) * limit;
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (search) {
      conditions.push(`(LOWER(eo.invoice) LIKE LOWER($${idx}) OR LOWER(c.name) LIKE LOWER($${idx}))`);
      values.push(`%${search}%`);
      idx++;
    }
    if (country) {
      conditions.push(`c.country = $${idx}`);
      values.push(country);
      idx++;
    }
    if (status) {
      conditions.push(`eo.status_pagamento = $${idx}`);
      values.push(status);
      idx++;
    }
    if (month) {
      conditions.push(`EXTRACT(MONTH FROM eo.embarque_date) = $${idx}`);
      values.push(parseInt(month) + 1);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const dataQuery = `
      SELECT
        eo.*,
        c.id as c_id, c.name as c_name, c.country as c_country, c.credit_limit as c_credit_limit, c.payment_terms as c_payment_terms,
        p.id as p_id, p.type as p_type, p.grammage as p_grammage, p.standard_price as p_standard_price, p.supplier_id as p_supplier_id,
        s.id as s_id, s.name as s_name, s.cnpj as s_cnpj, s.contact as s_contact, s.phone as s_phone, s.email as s_email, s.city as s_city, s.state as s_state,
        COUNT(*) OVER() AS total_count
      FROM export_orders eo
      LEFT JOIN clients c ON eo.client_id = c.id
      LEFT JOIN products p ON eo.product_id = p.id
      LEFT JOIN suppliers s ON eo.supplier_id = s.id
      ${whereClause}
      ORDER BY eo.created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `;
    values.push(limit, offset);

    const result = await pool.query(dataQuery, values);
    const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;

    const data: ExportOrderWithDetails[] = result.rows.map((row: any) => ({
      id: row.id, quotationId: row.quotation_id, clientId: row.client_id, productId: row.product_id, supplierId: row.supplier_id,
      invoice: row.invoice, factory: row.factory, nfe: row.nfe, bookingCrt: row.booking_crt, dueNumber: row.due_number,
      parametrizacao: row.parametrizacao, modal: row.modal, vessel: row.vessel,
      embarqueDate: row.embarque_date, desembarqueDate: row.desembarque_date, transitTime: row.transit_time,
      deadlineDra: row.deadline_dra, deadlineCarga: row.deadline_carga,
      unitPrice: row.unit_price, quantity: row.quantity, total: row.total,
      paymentTerms: row.payment_terms, dueDate: row.due_date, paymentDate: row.payment_date,
      acc: row.acc, exchangeClose: row.exchange_close, statusPagamento: row.status_pagamento,
      vesselStatus: row.vessel_status, notificacoesAtivas: row.notificacoes_ativas, createdAt: row.created_at,
      client: { id: row.c_id, name: row.c_name, country: row.c_country, creditLimit: row.c_credit_limit, paymentTerms: row.c_payment_terms },
      product: { id: row.p_id, type: row.p_type, grammage: row.p_grammage, standardPrice: row.p_standard_price, supplierId: row.p_supplier_id },
      supplier: row.s_id ? { id: row.s_id, name: row.s_name, cnpj: row.s_cnpj, contact: row.s_contact, phone: row.s_phone, email: row.s_email, city: row.s_city, state: row.s_state } : null,
    }));

    return { data, total };
  }

  async getOrder(id: number): Promise<ExportOrderWithDetails | undefined> {
    const [row] = await db
      .select()
      .from(exportOrders)
      .leftJoin(clients, eq(exportOrders.clientId, clients.id))
      .leftJoin(products, eq(exportOrders.productId, products.id))
      .leftJoin(suppliers, eq(exportOrders.supplierId, suppliers.id))
      .where(eq(exportOrders.id, id));

    if (!row) return undefined;
    return {
      ...row.export_orders,
      client: row.clients!,
      product: row.products!,
      supplier: row.suppliers || null,
    };
  }

  async createOrder(data: InsertExportOrder): Promise<ExportOrder> {
    const total = (parseFloat(data.unitPrice) * Number(data.quantity)).toFixed(2);
    let transitTime: number | null = null;
    if (data.embarqueDate && data.desembarqueDate) {
      const d1 = new Date(data.embarqueDate);
      const d2 = new Date(data.desembarqueDate);
      transitTime = Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
    }

    const [order] = await db.insert(exportOrders).values({
      ...data,
      total,
      transitTime,
    }).returning();
    return order;
  }

  async updateOrder(id: number, data: Partial<InsertExportOrder>): Promise<ExportOrder | undefined> {
    const existing = await db.select().from(exportOrders).where(eq(exportOrders.id, id));
    if (!existing[0]) return undefined;

    const updates: Record<string, unknown> = { ...data };

    const price = data.unitPrice !== undefined ? parseFloat(data.unitPrice) : parseFloat(existing[0].unitPrice);
    const qty = data.quantity !== undefined ? Number(data.quantity) : existing[0].quantity;
    if (data.unitPrice !== undefined || data.quantity !== undefined) {
      updates.total = (price * qty).toFixed(2);
    }

    const embarque = data.embarqueDate !== undefined ? data.embarqueDate : existing[0].embarqueDate;
    const desembarque = data.desembarqueDate !== undefined ? data.desembarqueDate : existing[0].desembarqueDate;
    if (embarque && desembarque) {
      const d1 = new Date(embarque);
      const d2 = new Date(desembarque);
      updates.transitTime = Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
    } else {
      updates.transitTime = null;
    }

    const [order] = await db.update(exportOrders).set(updates).where(eq(exportOrders.id, id)).returning();
    return order;
  }

  async deleteOrder(id: number): Promise<void> {
    await db.delete(exportOrders).where(eq(exportOrders.id, id));
  }

  async getOrderAuditLog(orderId: number): Promise<OrderAuditLogEntry[]> {
    return db.select().from(orderAuditLog)
      .where(eq(orderAuditLog.orderId, orderId))
      .orderBy(desc(orderAuditLog.createdAt));
  }

  async createAuditLogEntry(data: { orderId: number; action: string; userName?: string; changes?: unknown; snapshot?: unknown }): Promise<OrderAuditLogEntry> {
    const [entry] = await db.insert(orderAuditLog).values({
      orderId: data.orderId,
      action: data.action,
      userName: data.userName || "Sistema",
      changes: data.changes || null,
      snapshot: data.snapshot || null,
    }).returning();
    return entry;
  }

  async getPlatformUsers(): Promise<PlatformUser[]> {
    return db.select().from(platformUsers).orderBy(platformUsers.name);
  }

  async getPlatformUser(id: number): Promise<PlatformUser | undefined> {
    const [user] = await db.select().from(platformUsers).where(eq(platformUsers.id, id));
    return user;
  }

  async createPlatformUser(data: InsertPlatformUser): Promise<PlatformUser> {
    const [user] = await db.insert(platformUsers).values(data).returning();
    return user;
  }

  async updatePlatformUser(id: number, data: Partial<InsertPlatformUser>): Promise<PlatformUser | undefined> {
    const [user] = await db.update(platformUsers).set(data).where(eq(platformUsers.id, id)).returning();
    return user;
  }

  async deletePlatformUser(id: number): Promise<void> {
    await db.delete(platformUsers).where(eq(platformUsers.id, id));
  }

  async getDashboardStats(filters?: { startDate?: string; endDate?: string }) {
    let query = db.select().from(exportOrders)
      .leftJoin(clients, eq(exportOrders.clientId, clients.id))
      .leftJoin(products, eq(exportOrders.productId, products.id));

    const conditions = [];
    if (filters?.startDate) {
      conditions.push(sql`${exportOrders.createdAt} >= ${filters.startDate}`);
    }
    if (filters?.endDate) {
      conditions.push(sql`${exportOrders.createdAt} <= ${filters.endDate + " 23:59:59"}`);
    }

    const allOrders = conditions.length > 0
      ? await query.where(sql`${sql.join(conditions, sql` AND `)}`)
      : await query;

    let totalRevenue = 0;
    let totalVolume = 0;
    let pendingInvoices = 0;
    let overdueCount = 0;
    const countryMap = new Map<string, number>();
    const volumeByCountryMap = new Map<string, number>();
    const productMap = new Map<string, number>();
    const productRevenueMap = new Map<string, number>();
    const cashFlowMap = new Map<string, number>();
    const paymentStatusMap = new Map<string, number>();
    const modalMap = new Map<string, { count: number; total: number }>();
    const parametrizacaoMap = new Map<string, number>();
    const monthlyOrdersMap = new Map<string, { count: number; total: number }>();
    const clientRevenueMap = new Map<string, number>();
    const revenueByStatusMap = new Map<string, { pago: number; pendente: number; atrasado: number }>();

    const statusLabels: Record<string, string> = { pendente: "Pendente", pago: "Pago", atrasado: "Atrasado" };
    const modalLabels: Record<string, string> = { rodoviario: "Rodoviário", maritimo: "Marítimo" };
    const paramLabels: Record<string, string> = { verde: "Verde", amarelo: "Amarelo", vermelho: "Vermelho" };
    const vesselStatusLabels: Record<string, string> = { etd: "ETD", zarpou: "Zarpou", em_navegacao: "Em Navegação", fundeado: "Fundeado" };
    const vesselStatusMap = new Map<string, { count: number; total: number }>();
    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

    const currentYear = new Date().getFullYear();
    const monthlyRevenueFullMap = new Map<string, number>();
    for (let m = 0; m < 12; m++) {
      monthlyRevenueFullMap.set(`${monthNames[m]}/${currentYear}`, 0);
    }

    for (const row of allOrders) {
      const order = row.export_orders;
      const client = row.clients;
      const product = row.products;
      const orderTotal = parseFloat(order.total);

      totalRevenue += orderTotal;
      totalVolume += order.quantity;

      if (order.statusPagamento === "pendente") pendingInvoices++;
      if (order.statusPagamento === "atrasado") overdueCount++;

      if (client?.country) {
        countryMap.set(client.country, (countryMap.get(client.country) || 0) + orderTotal);
        volumeByCountryMap.set(client.country, (volumeByCountryMap.get(client.country) || 0) + order.quantity);
      }
      if (product?.type) {
        productMap.set(product.type, (productMap.get(product.type) || 0) + 1);
        productRevenueMap.set(product.type, (productRevenueMap.get(product.type) || 0) + orderTotal);
      }

      if (client?.name) {
        clientRevenueMap.set(client.name, (clientRevenueMap.get(client.name) || 0) + orderTotal);
      }

      if (order.createdAt) {
        const d = new Date(order.createdAt);
        const mLabel = `${monthNames[d.getMonth()]}/${d.getFullYear()}`;
        const entry = revenueByStatusMap.get(mLabel) || { pago: 0, pendente: 0, atrasado: 0 };
        if (order.statusPagamento === "pago") entry.pago += orderTotal;
        else if (order.statusPagamento === "atrasado") entry.atrasado += orderTotal;
        else entry.pendente += orderTotal;
        revenueByStatusMap.set(mLabel, entry);
      }
      if (order.dueDate) {
        const d = new Date(order.dueDate);
        const label = `${monthNames[d.getMonth()]}/${d.getFullYear()}`;
        cashFlowMap.set(label, (cashFlowMap.get(label) || 0) + orderTotal);
      }

      const statusLabel = statusLabels[order.statusPagamento] || order.statusPagamento;
      paymentStatusMap.set(statusLabel, (paymentStatusMap.get(statusLabel) || 0) + 1);

      const modalLabel = modalLabels[order.modal] || order.modal;
      const modalEntry = modalMap.get(modalLabel) || { count: 0, total: 0 };
      modalEntry.count += 1;
      modalEntry.total += orderTotal;
      modalMap.set(modalLabel, modalEntry);

      const paramLabel = paramLabels[order.parametrizacao] || order.parametrizacao;
      parametrizacaoMap.set(paramLabel, (parametrizacaoMap.get(paramLabel) || 0) + 1);

      const vsKey = order.vesselStatus ? (vesselStatusLabels[order.vesselStatus] || order.vesselStatus) : "Sem Status";
      const vsEntry = vesselStatusMap.get(vsKey) || { count: 0, total: 0 };
      vsEntry.count += 1;
      vsEntry.total += orderTotal;
      vesselStatusMap.set(vsKey, vsEntry);

      if (order.createdAt) {
        const d = new Date(order.createdAt);
        const label = `${monthNames[d.getMonth()]}/${d.getFullYear()}`;
        const entry = monthlyOrdersMap.get(label) || { count: 0, total: 0 };
        entry.count += 1;
        entry.total += orderTotal;
        monthlyOrdersMap.set(label, entry);

        if (d.getFullYear() === currentYear) {
          const prev = monthlyRevenueFullMap.get(label) ?? 0;
          monthlyRevenueFullMap.set(label, prev + orderTotal);
        }
      }
    }

    const revenueByCountry = Array.from(countryMap.entries())
      .map(([country, total]) => ({ country, total }))
      .sort((a, b) => b.total - a.total);

    const productMix = Array.from(productMap.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);

    const cashFlow = Array.from(cashFlowMap.entries())
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const paymentStatusDistribution = Array.from(paymentStatusMap.entries())
      .map(([status, count]) => ({ status, count }));

    const modalDistribution = Array.from(modalMap.entries())
      .map(([modal, data]) => ({ modal, count: data.count, total: data.total }));

    const parametrizacaoDistribution = Array.from(parametrizacaoMap.entries())
      .map(([status, count]) => ({ status, count }));

    const volumeByCountry = Array.from(volumeByCountryMap.entries())
      .map(([country, volume]) => ({ country, volume }))
      .sort((a, b) => b.volume - a.volume);

    const monthlyOrders = Array.from(monthlyOrdersMap.entries())
      .map(([month, data]) => ({ month, count: data.count, total: data.total }));

    const revenueByClient = Array.from(clientRevenueMap.entries())
      .map(([client, total]) => ({ client, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    const revenueByProduct = Array.from(productRevenueMap.entries())
      .map(([product, total]) => ({ product, total }))
      .sort((a, b) => b.total - a.total);

    const monthlyRevenueByStatus = Array.from(revenueByStatusMap.entries())
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const ticketMedio = allOrders.length > 0 ? totalRevenue / allOrders.length : 0;
    const totalPago = Array.from(revenueByStatusMap.values()).reduce((s, v) => s + v.pago, 0);
    const totalPendente = Array.from(revenueByStatusMap.values()).reduce((s, v) => s + v.pendente, 0);
    const totalAtrasado = Array.from(revenueByStatusMap.values()).reduce((s, v) => s + v.atrasado, 0);

    const monthlyRevenueFull = Array.from(monthlyRevenueFullMap.entries())
      .map(([month, total]) => ({ month, total }));

    const vesselStatusDistribution = Array.from(vesselStatusMap.entries())
      .map(([status, data]) => ({ status, count: data.count, total: data.total }))
      .sort((a, b) => {
        const order = ["ETD", "Zarpou", "Em Navegação", "Fundeado", "Sem Status"];
        return order.indexOf(a.status) - order.indexOf(b.status);
      });

    return {
      totalRevenue, totalVolume, pendingInvoices, overdueCount,
      revenueByCountry, productMix, cashFlow,
      paymentStatusDistribution, modalDistribution, parametrizacaoDistribution,
      volumeByCountry, monthlyOrders,
      revenueByClient, revenueByProduct, monthlyRevenueByStatus,
      ticketMedio, totalPago, totalPendente, totalAtrasado,
      monthlyRevenueFull, vesselStatusDistribution,
    };
  }

  async getShipmentTracking(orderId: number): Promise<ShipmentTracking | undefined> {
    const rows = await db.select().from(shipmentTracking).where(eq(shipmentTracking.orderId, orderId)).limit(1);
    return rows[0];
  }

  async upsertShipmentTracking(data: InsertShipmentTracking): Promise<ShipmentTracking> {
    const existing = await this.getShipmentTracking(data.orderId);
    if (existing) {
      const rows = await db
        .update(shipmentTracking)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(shipmentTracking.orderId, data.orderId))
        .returning();
      return rows[0];
    }
    const rows = await db.insert(shipmentTracking).values(data).returning();
    return rows[0];
  }

  async getDocumentosByOrder(orderId: number, includeArchived = false): Promise<Documento[]> {
    const conditions = includeArchived
      ? eq(documentos.orderId, orderId)
      : and(eq(documentos.orderId, orderId), eq(documentos.isArquivado, false));
    return db.select().from(documentos).where(conditions).orderBy(desc(documentos.createdAt));
  }

  async getDocumento(id: number): Promise<Documento | undefined> {
    const [doc] = await db.select().from(documentos).where(eq(documentos.id, id));
    return doc;
  }

  async createDocumento(data: InsertDocumento): Promise<Documento> {
    const [doc] = await db.insert(documentos).values(data).returning();
    return doc;
  }

  async updateDocumentoStatus(id: number, status: string, motivoRejeicao?: string): Promise<Documento | undefined> {
    const updates: Record<string, unknown> = { status };
    if (motivoRejeicao !== undefined) updates.motivoRejeicao = motivoRejeicao;
    const [doc] = await db.update(documentos).set(updates).where(eq(documentos.id, id)).returning();
    return doc;
  }

  async arquivarDocumento(id: number): Promise<void> {
    await db.update(documentos).set({ isArquivado: true }).where(eq(documentos.id, id));
  }

  async getDocumentoAuditLog(documentoId: number): Promise<DocumentoAuditEntry[]> {
    return db.select().from(documentoAuditLog).where(eq(documentoAuditLog.documentoId, documentoId)).orderBy(desc(documentoAuditLog.createdAt));
  }

  async createDocumentoAuditEntry(data: { documentoId: number; acao: string; userName: string; userType: string; detalhes?: string }): Promise<DocumentoAuditEntry> {
    const [entry] = await db.insert(documentoAuditLog).values(data).returning();
    return entry;
  }

  async getLpcos(): Promise<Lpco[]> {
    return db.select().from(lpco).orderBy(desc(lpco.createdAt));
  }

  async getLpco(id: number): Promise<Lpco | undefined> {
    const [row] = await db.select().from(lpco).where(eq(lpco.id, id));
    return row;
  }

  async createLpco(data: InsertLpco): Promise<Lpco> {
    const [row] = await db.insert(lpco).values(data).returning();
    return row;
  }

  async updateLpco(id: number, data: Partial<InsertLpco>): Promise<Lpco | undefined> {
    const [row] = await db.update(lpco).set({ ...data, updatedAt: new Date() }).where(eq(lpco.id, id)).returning();
    return row;
  }

  async deleteLpco(id: number): Promise<void> {
    await db.delete(lpco).where(eq(lpco.id, id));
  }
}

export const storage = new DatabaseStorage();
