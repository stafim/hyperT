import type { Express, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { db } from "./storage";
import { clientPortalUsers, clients, exportOrders, products, suppliers } from "@shared/schema";
import { eq, and } from "drizzle-orm";

declare module "express-session" {
  interface SessionData {
    portalUserId?: number;
    portalClientId?: number;
  }
}

function requirePortalAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.portalUserId) {
    return res.status(401).json({ message: "Não autenticado" });
  }
  next();
}

export function registerPortalRoutes(app: Express) {
  app.post("/api/portal/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Email e senha são obrigatórios" });
      }

      const [portalUser] = await db
        .select()
        .from(clientPortalUsers)
        .where(eq(clientPortalUsers.email, email.toLowerCase().trim()))
        .limit(1);

      if (!portalUser) {
        return res.status(401).json({ message: "Email ou senha incorretos" });
      }

      if (portalUser.status !== "ativo") {
        return res.status(403).json({ message: "Acesso desativado" });
      }

      const valid = await bcrypt.compare(password, portalUser.passwordHash);
      if (!valid) {
        return res.status(401).json({ message: "Email ou senha incorretos" });
      }

      req.session.portalUserId = portalUser.id;
      req.session.portalClientId = portalUser.clientId;

      const [client] = await db
        .select()
        .from(clients)
        .where(eq(clients.id, portalUser.clientId))
        .limit(1);

      res.json({ ok: true, client: { id: client.id, name: client.name, country: client.country } });
    } catch (err) {
      console.error("Portal login error:", err);
      res.status(500).json({ message: "Erro interno ao fazer login" });
    }
  });

  app.post("/api/portal/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ ok: true });
    });
  });

  app.get("/api/portal/me", requirePortalAuth, async (req, res) => {
    try {
      const [client] = await db
        .select()
        .from(clients)
        .where(eq(clients.id, req.session.portalClientId!))
        .limit(1);

      if (!client) return res.status(404).json({ message: "Cliente não encontrado" });
      res.json({ id: client.id, name: client.name, country: client.country });
    } catch (err) {
      res.status(500).json({ message: "Erro interno" });
    }
  });

  app.get("/api/portal/orders", requirePortalAuth, async (req, res) => {
    try {
      const rows = await db
        .select({
          id: exportOrders.id,
          invoice: exportOrders.invoice,
          factory: exportOrders.factory,
          vessel: exportOrders.vessel,
          modal: exportOrders.modal,
          vesselStatus: exportOrders.vesselStatus,
          embarqueDate: exportOrders.embarqueDate,
          desembarqueDate: exportOrders.desembarqueDate,
          transitTime: exportOrders.transitTime,
          deadlineCarga: exportOrders.deadlineCarga,
          deadlineDra: exportOrders.deadlineDra,
          dueNumber: exportOrders.dueNumber,
          bookingCrt: exportOrders.bookingCrt,
          nfe: exportOrders.nfe,
          quantity: exportOrders.quantity,
          total: exportOrders.total,
          unitPrice: exportOrders.unitPrice,
          paymentTerms: exportOrders.paymentTerms,
          clientName: clients.name,
          clientCountry: clients.country,
          productType: products.type,
          productGrammage: products.grammage,
          supplierName: suppliers.name,
        })
        .from(exportOrders)
        .leftJoin(clients, eq(exportOrders.clientId, clients.id))
        .leftJoin(products, eq(exportOrders.productId, products.id))
        .leftJoin(suppliers, eq(exportOrders.supplierId, suppliers.id))
        .where(and(
          eq(exportOrders.clientId, req.session.portalClientId!),
          eq(exportOrders.modal, "maritimo"),
        ));

      const orders = rows.map((r) => ({
        id: r.id,
        invoice: r.invoice,
        factory: r.factory,
        vessel: r.vessel,
        modal: r.modal,
        vesselStatus: r.vesselStatus,
        embarqueDate: r.embarqueDate,
        desembarqueDate: r.desembarqueDate,
        transitTime: r.transitTime,
        deadlineCarga: r.deadlineCarga,
        deadlineDra: r.deadlineDra,
        dueNumber: r.dueNumber,
        bookingCrt: r.bookingCrt,
        nfe: r.nfe,
        quantity: r.quantity,
        total: r.total,
        unitPrice: r.unitPrice,
        paymentTerms: r.paymentTerms,
        client: { name: r.clientName ?? "", country: r.clientCountry ?? "" },
        product: { type: r.productType ?? "", grammage: r.productGrammage ?? "" },
        supplier: r.supplierName ? { name: r.supplierName } : null,
      }));

      res.json(orders);
    } catch (err) {
      console.error("Portal orders error:", err);
      res.status(500).json({ message: "Erro interno" });
    }
  });
}
