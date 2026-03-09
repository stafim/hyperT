import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, numeric, date, timestamp, pgEnum, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const userRoleEnum = pgEnum("user_role", ["admin", "operador", "visualizador"]);
export const userStatusEnum = pgEnum("user_status", ["ativo", "inativo"]);
export const productUnidadeEnum = pgEnum("product_unidade", ["caixa", "resma"]);

export const modalEnum = pgEnum("modal_type", ["rodoviario", "maritimo"]);
export const parametrizacaoEnum = pgEnum("parametrizacao_type", ["verde", "amarelo", "vermelho"]);
export const statusPagamentoEnum = pgEnum("status_pagamento", ["pendente", "pago", "atrasado"]);
export const quotationStatusEnum = pgEnum("quotation_status", ["rascunho", "enviada", "aceita", "recusada", "convertida"]);
export const sendMethodEnum = pgEnum("send_method", ["email", "whatsapp"]);

export const suppliers = pgTable("suppliers", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  cnpj: text("cnpj"),
  contact: text("contact"),
  phone: text("phone"),
  email: text("email"),
  city: text("city"),
  state: text("state"),
});

export const clients = pgTable("clients", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  country: text("country").notNull(),
  creditLimit: numeric("credit_limit", { precision: 12, scale: 2 }).notNull().default("0"),
  paymentTerms: text("payment_terms").notNull(),
  email: text("email"),
  phone: text("phone"),
  responsavel: text("responsavel"),
  registroNacional: text("registro_nacional"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  notes: text("notes"),
});

export const clientDocuments = pgTable("client_documents", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  clientId: integer("client_id").notNull(),
  nome: text("nome").notNull(),
  tipo: text("tipo").notNull().default("outro"),
  numero: text("numero"),
  emissao: date("emissao"),
  validade: date("validade"),
  observacoes: text("observacoes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const products = pgTable("products", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  type: text("type").notNull(),
  grammage: text("grammage").notNull(),
  unidade: productUnidadeEnum("unidade").notNull().default("caixa"),
  standardPrice: numeric("standard_price", { precision: 10, scale: 2 }).notNull(),
  supplierId: integer("supplier_id"),
});

export const quotations = pgTable("quotations", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  clientId: integer("client_id").notNull(),
  productId: integer("product_id").notNull(),
  supplierId: integer("supplier_id"),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  quantity: integer("quantity").notNull(),
  total: numeric("total", { precision: 14, scale: 2 }).notNull(),
  margem: numeric("margem", { precision: 5, scale: 2 }),
  paymentTerms: text("payment_terms"),
  validityDate: date("validity_date"),
  notes: text("notes"),
  status: quotationStatusEnum("status").notNull().default("rascunho"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const quotationSendLog = pgTable("quotation_send_log", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  quotationId: integer("quotation_id").notNull(),
  method: sendMethodEnum("method").notNull(),
  userName: text("user_name").notNull().default("Sistema"),
  recipientInfo: text("recipient_info"),
  sentAt: timestamp("sent_at").defaultNow(),
});

export const quotationNotes = pgTable("quotation_notes", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  quotationId: integer("quotation_id").notNull(),
  content: text("content").notNull(),
  author: text("author").notNull().default("Sistema"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const exportOrders = pgTable("export_orders", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  quotationId: integer("quotation_id"),
  clientId: integer("client_id").notNull(),
  productId: integer("product_id").notNull(),
  supplierId: integer("supplier_id"),
  invoice: text("invoice").notNull(),
  factory: text("factory").notNull(),
  nfe: text("nfe"),
  bookingCrt: text("booking_crt"),
  dueNumber: text("due_number"),
  parametrizacao: parametrizacaoEnum("parametrizacao").notNull().default("verde"),
  modal: modalEnum("modal").notNull(),
  vessel: text("vessel"),
  embarqueDate: date("embarque_date"),
  desembarqueDate: date("desembarque_date"),
  transitTime: integer("transit_time"),
  deadlineDra: date("deadline_dra"),
  deadlineCarga: date("deadline_carga"),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  quantity: integer("quantity").notNull(),
  total: numeric("total", { precision: 14, scale: 2 }).notNull(),
  paymentTerms: text("payment_terms"),
  dueDate: date("due_date"),
  paymentDate: date("payment_date"),
  acc: numeric("acc", { precision: 12, scale: 2 }),
  exchangeClose: numeric("exchange_close", { precision: 10, scale: 4 }),
  statusPagamento: statusPagamentoEnum("status_pagamento").notNull().default("pendente"),
  vesselStatus: text("vessel_status"),
  notificacoesAtivas: boolean("notificacoes_ativas").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const orderAuditLog = pgTable("order_audit_log", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  orderId: integer("order_id").notNull(),
  action: text("action").notNull(),
  userName: text("user_name").notNull().default("Sistema"),
  changes: jsonb("changes"),
  snapshot: jsonb("snapshot"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const platformUsers = pgTable("platform_users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: userRoleEnum("role").notNull().default("operador"),
  status: userStatusEnum("status").notNull().default("ativo"),
  phone: text("phone"),
  department: text("department"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const clientPortalUsers = pgTable("client_portal_users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  clientId: integer("client_id").notNull().references(() => clients.id),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  status: text("status").notNull().default("ativo"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const shipmentTracking = pgTable("shipment_tracking", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  orderId: integer("order_id").notNull().unique(),
  lat: numeric("lat", { precision: 10, scale: 6 }).notNull(),
  lng: numeric("lng", { precision: 10, scale: 6 }).notNull(),
  vehicleName: text("vehicle_name"),
  vehicleType: text("vehicle_type").notNull().default("vessel"),
  speed: numeric("speed", { precision: 8, scale: 2 }),
  heading: numeric("heading", { precision: 6, scale: 2 }),
  status: text("status"),
  source: text("source"),
  rawData: jsonb("raw_data"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertShipmentTrackingSchema = createInsertSchema(shipmentTracking).omit({ id: true, updatedAt: true });

export const documentStatusEnum = pgEnum("document_status", ["pendente", "em_analise", "aprovado", "rejeitado"]);
export const documentTypeEnum = pgEnum("document_type", ["commercial_invoice", "packing_list", "bill_of_lading"]);

export const documentos = pgTable("documentos", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  orderId: integer("order_id").notNull(),
  tipo: documentTypeEnum("tipo").notNull(),
  status: documentStatusEnum("status").notNull().default("pendente"),
  motivoRejeicao: text("motivo_rejeicao"),
  nomeOriginal: text("nome_original").notNull(),
  nomeArquivo: text("nome_arquivo").notNull(),
  mimeType: text("mime_type").notNull(),
  tamanho: integer("tamanho").notNull(),
  versao: integer("versao").notNull().default(1),
  isArquivado: boolean("is_arquivado").notNull().default(false),
  uploadedBy: text("uploaded_by").notNull().default("Gestor"),
  uploadedByType: text("uploaded_by_type").notNull().default("manager"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const documentoAuditLog = pgTable("documento_audit_log", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  documentoId: integer("documento_id").notNull(),
  acao: text("acao").notNull(),
  userName: text("user_name").notNull().default("Sistema"),
  userType: text("user_type").notNull().default("manager"),
  detalhes: text("detalhes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Documento = typeof documentos.$inferSelect;
export type InsertDocumento = typeof documentos.$inferInsert;
export type DocumentoAuditEntry = typeof documentoAuditLog.$inferSelect;

export const lpcoTipoEnum = pgEnum("lpco_tipo", ["licenca", "permissao", "certificado", "outro"]);
export const lpcoOrgaoEnum = pgEnum("lpco_orgao", ["MAPA", "ANVISA", "INMETRO", "RECEITA_FEDERAL", "IBAMA", "SECEX", "MDIC", "outro"]);
export const lpcoStatusEnum = pgEnum("lpco_status", ["ativo", "pendente", "vencido", "suspenso"]);

export const lpco = pgTable("lpco", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tipo: lpcoTipoEnum("tipo").notNull(),
  orgao: lpcoOrgaoEnum("orgao").notNull(),
  numero: text("numero").notNull(),
  descricao: text("descricao").notNull(),
  status: lpcoStatusEnum("status").notNull().default("pendente"),
  dataEmissao: date("data_emissao"),
  dataValidade: date("data_validade"),
  orderId: integer("order_id"),
  clientId: integer("client_id"),
  observacoes: text("observacoes"),
  responsavel: text("responsavel"),
  nomeArquivo: text("nome_arquivo"),
  nomeOriginal: text("nome_original"),
  mimeType: text("mime_type"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type Lpco = typeof lpco.$inferSelect;
export type InsertLpco = typeof lpco.$inferInsert;

export const insertClientDocumentSchema = createInsertSchema(clientDocuments).omit({ id: true, createdAt: true });
export type InsertClientDocument = z.infer<typeof insertClientDocumentSchema>;
export type ClientDocument = typeof clientDocuments.$inferSelect;

export const insertSupplierSchema = createInsertSchema(suppliers).omit({ id: true });
export const insertClientSchema = createInsertSchema(clients).omit({ id: true });
export const insertProductSchema = createInsertSchema(products).omit({ id: true });
export const insertQuotationSchema = createInsertSchema(quotations).omit({ id: true, createdAt: true, updatedAt: true, total: true });
export const insertExportOrderSchema = createInsertSchema(exportOrders).omit({ id: true, createdAt: true, transitTime: true, total: true });
export const insertPlatformUserSchema = createInsertSchema(platformUsers).omit({ id: true, createdAt: true });

export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type Supplier = typeof suppliers.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;
export type InsertQuotation = z.infer<typeof insertQuotationSchema>;
export type Quotation = typeof quotations.$inferSelect;
export type QuotationSendLogEntry = typeof quotationSendLog.$inferSelect;
export const insertQuotationNoteSchema = createInsertSchema(quotationNotes).omit({ id: true, createdAt: true });
export type InsertQuotationNote = z.infer<typeof insertQuotationNoteSchema>;
export type QuotationNote = typeof quotationNotes.$inferSelect;
export type InsertExportOrder = z.infer<typeof insertExportOrderSchema>;
export type ExportOrder = typeof exportOrders.$inferSelect;

export type OrderAuditLogEntry = typeof orderAuditLog.$inferSelect;

export type QuotationWithDetails = Quotation & {
  client: Client;
  product: Product;
  supplier?: Supplier | null;
};

export type ExportOrderWithDetails = ExportOrder & {
  client: Client;
  product: Product;
  supplier?: Supplier | null;
};

export type InsertPlatformUser = z.infer<typeof insertPlatformUserSchema>;
export type PlatformUser = typeof platformUsers.$inferSelect;

export type InsertShipmentTracking = z.infer<typeof insertShipmentTrackingSchema>;
export type ShipmentTracking = typeof shipmentTracking.$inferSelect;

// ─── Audio PRO Topics Config ───────────────────────────────────────────────────
export const audioProTopicsConfig = pgTable("audio_pro_topics_config", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tempo: boolean("tempo").notNull().default(true),
  dolar: boolean("dolar").notNull().default(true),
  emails: boolean("emails").notNull().default(true),
  operacaoOntem: boolean("operacao_ontem").notNull().default(true),
  cotacoes: boolean("cotacoes").notNull().default(true),
  vendasSemana: boolean("vendas_semana").notNull().default(true),
  vencimentosSemana: boolean("vencimentos_semana").notNull().default(true),
  kanbanNotas: boolean("kanban_notas").notNull().default(true),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type AudioProTopicsConfig = typeof audioProTopicsConfig.$inferSelect;

// ─── AI Query History ─────────────────────────────────────────────────────────
export const aiQueryHistory = pgTable("ai_query_history", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  question: text("question").notNull(),
  result: jsonb("result").notNull(),
  favoritado: boolean("favoritado").notNull().default(false),
  tituloFavorito: text("titulo_favorito"),
  createdAt: timestamp("created_at").defaultNow(),
});
export type AiQueryHistory = typeof aiQueryHistory.$inferSelect;

// ─── Audio PRO Custom Topics ───────────────────────────────────────────────────
export const audioProCustomTopics = pgTable("audio_pro_custom_topics", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  titulo: text("titulo").notNull(),
  instrucao: text("instrucao").notNull(),
  ativo: boolean("ativo").notNull().default(true),
  ordem: integer("ordem").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});
export type AudioProCustomTopic = typeof audioProCustomTopics.$inferSelect;
export const insertAudioProCustomTopicSchema = createInsertSchema(audioProCustomTopics).omit({ id: true, createdAt: true });
export type InsertAudioProCustomTopic = z.infer<typeof insertAudioProCustomTopicSchema>;

// ─── Telegram Notification Config ─────────────────────────────────────────────
export const telegramNotificationConfig = pgTable("telegram_notification_config", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  enabled: boolean("enabled").notNull().default(false),
  onNewQuotation: boolean("on_new_quotation").notNull().default(false),
  onNewOrder: boolean("on_new_order").notNull().default(false),
  onNewClient: boolean("on_new_client").notNull().default(false),
  onNewSupplier: boolean("on_new_supplier").notNull().default(false),
  onNewProduct: boolean("on_new_product").notNull().default(false),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type TelegramConfig = typeof telegramNotificationConfig.$inferSelect;
