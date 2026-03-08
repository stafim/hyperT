import { db } from "./storage";
import { clients, products, exportOrders } from "@shared/schema";
import { sql } from "drizzle-orm";

export async function seedDatabase() {
  const existingClients = await db.select().from(clients);
  if (existingClients.length > 0) return;

  console.log("Seeding database...");

  const [c1, c2, c3, c4, c5] = await db.insert(clients).values([
    { name: "Papelera del Sur S.A.", country: "Argentina", creditLimit: "500000", paymentTerms: "60 dias" },
    { name: "Industrias Guarani", country: "Paraguai", creditLimit: "350000", paymentTerms: "30/60 dias" },
    { name: "Embalajes Bolivia Ltda", country: "Bolívia", creditLimit: "200000", paymentTerms: "45 dias" },
    { name: "Corrugados del Plata", country: "Argentina", creditLimit: "750000", paymentTerms: "90 dias" },
    { name: "PackPro Uruguay", country: "Uruguai", creditLimit: "400000", paymentTerms: "30 dias" },
  ]).returning();

  const [p1, p2, p3, p4] = await db.insert(products).values([
    { type: "Standard Brown Kraft", grammage: "80g/m²", standardPrice: "620.00" },
    { type: "Extensible Kraft", grammage: "90g/m²", standardPrice: "720.00" },
    { type: "White Top Kraft", grammage: "120g/m²", standardPrice: "850.00" },
    { type: "Sack Kraft", grammage: "70g/m²", standardPrice: "580.00" },
  ]).returning();

  const now = new Date();
  const addDays = (d: Date, days: number) => {
    const r = new Date(d);
    r.setDate(r.getDate() + days);
    return r.toISOString().split("T")[0];
  };

  await db.insert(exportOrders).values([
    {
      clientId: c1.id, productId: p1.id,
      invoice: "INV-2026-001", factory: "Fábrica Suzano",
      nfe: "NFE-44001", bookingCrt: "BK-9981", dueNumber: "DUE-00124",
      parametrizacao: "verde", modal: "maritimo", vessel: "MSC Aurora",
      embarqueDate: addDays(now, -25), desembarqueDate: addDays(now, -5),
      transitTime: 20,
      deadlineDra: addDays(now, -30), deadlineCarga: addDays(now, -27),
      unitPrice: "620.00", quantity: 150,
      total: (620 * 150).toFixed(2),
      paymentTerms: "60 dias", dueDate: addDays(now, 35),
      statusPagamento: "pendente",
    },
    {
      clientId: c2.id, productId: p2.id,
      invoice: "INV-2026-002", factory: "Fábrica Klabin",
      nfe: "NFE-44002", bookingCrt: "CRT-3321",
      parametrizacao: "verde", modal: "rodoviario",
      embarqueDate: addDays(now, -10), desembarqueDate: addDays(now, -8),
      transitTime: 2,
      deadlineDra: addDays(now, -15), deadlineCarga: addDays(now, -12),
      unitPrice: "720.00", quantity: 80,
      total: (720 * 80).toFixed(2),
      paymentTerms: "30 dias", dueDate: addDays(now, 1),
      statusPagamento: "pendente",
    },
    {
      clientId: c3.id, productId: p3.id,
      invoice: "INV-2026-003", factory: "Fábrica WestRock",
      nfe: "NFE-44003", bookingCrt: "BK-7742", dueNumber: "DUE-00126",
      parametrizacao: "amarelo", modal: "maritimo", vessel: "Maersk Titan",
      embarqueDate: addDays(now, -40), desembarqueDate: addDays(now, -18),
      transitTime: 22,
      deadlineDra: addDays(now, -45), deadlineCarga: addDays(now, -42),
      unitPrice: "850.00", quantity: 60,
      total: (850 * 60).toFixed(2),
      paymentTerms: "45 dias", dueDate: addDays(now, -5),
      statusPagamento: "atrasado",
    },
    {
      clientId: c4.id, productId: p1.id,
      invoice: "INV-2026-004", factory: "Fábrica Suzano",
      nfe: "NFE-44004", bookingCrt: "BK-1189",
      parametrizacao: "verde", modal: "maritimo", vessel: "CMA CGM Libra",
      embarqueDate: addDays(now, -50), desembarqueDate: addDays(now, -30),
      transitTime: 20,
      unitPrice: "620.00", quantity: 200,
      total: (620 * 200).toFixed(2),
      paymentTerms: "90 dias", dueDate: addDays(now, -10),
      paymentDate: addDays(now, -12),
      statusPagamento: "pago",
    },
    {
      clientId: c5.id, productId: p4.id,
      invoice: "INV-2026-005", factory: "Fábrica Klabin",
      bookingCrt: "CRT-8812",
      parametrizacao: "vermelho", modal: "rodoviario",
      embarqueDate: addDays(now, 5),
      deadlineDra: addDays(now, 2), deadlineCarga: addDays(now, 3),
      unitPrice: "580.00", quantity: 100,
      total: (580 * 100).toFixed(2),
      paymentTerms: "30 dias", dueDate: addDays(now, 35),
      statusPagamento: "pendente",
    },
    {
      clientId: c1.id, productId: p2.id,
      invoice: "INV-2026-006", factory: "Fábrica WestRock",
      nfe: "NFE-44006", bookingCrt: "BK-2234", dueNumber: "DUE-00128",
      parametrizacao: "verde", modal: "maritimo", vessel: "Hamburg Express",
      embarqueDate: addDays(now, -15), desembarqueDate: addDays(now, 5),
      transitTime: 20,
      unitPrice: "720.00", quantity: 120,
      total: (720 * 120).toFixed(2),
      paymentTerms: "60 dias", dueDate: addDays(now, 45),
      statusPagamento: "pendente",
      acc: "30000.00", exchangeClose: "5.2150",
    },
  ]);

  console.log("Database seeded successfully!");
}
