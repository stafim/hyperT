# Hypertrade - ERP Logístico de Exportação

## Overview
Sistema de Gestão de Exportação (ERP Logístico) para controle de exportação de papel kraft. Substitui planilhas manuais com integridade de dados e dashboards interativos.

## Tech Stack
- **Frontend**: React + TypeScript, Vite, TailwindCSS, Shadcn UI, Recharts
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Routing**: Wouter
- **State**: TanStack React Query
- **External APIs**: ExchangeRate-API (open.er-api.com) for currency quotes, Frankfurter (ECB) for historical rates (used in /api/historical-rate)

## Project Structure
```
client/src/
  pages/
    dashboard.tsx    - KPI dashboard with 8 charts
    calibragem-ia.tsx - AI calibration settings (business context, temperature, example questions) stored in localStorage
    orders.tsx       - Export orders management (CRUD, paginated 50/page, server-side filtering)
    clients.tsx      - Client management (CRUD, table with detailed profile dialog: tabs for Perfil/Documentos/Histórico)
    suppliers.tsx    - Supplier management (CRUD, table format)
    products.tsx     - Product management (CRUD, with supplier link)
    quotations.tsx   - Business quotations (CRUD, send via Email/WhatsApp, convert to order) + Calculadora tab with real-time FOB/CIF price calculator, FCL/LCL detection, PDF export
    vencimentos.tsx  - Dedicated due dates report (pending invoices, urgency tracking)
    exposicao-cambial.tsx - Currency exposure analysis dashboard (FX risk on open orders)
    quotes.tsx       - MERCOSUL+Mexico currency quotes (real-time) - sidebar: "Câmbio"
    reports.tsx      - Export reports with order details and audit history
    rastreabilidade.tsx - Logistics Traceability Dashboard (maritime orders, stepper timeline, vessel tracking, docs one-click, ETA countdown)
    documentos.tsx   - Documentação Cambial: full-width order list with CI/PL/B/L status indicators per row, KPI cards, filters, click-to-view dialog with DocCards + upload zones
    telegram-config.tsx - Telegram notification configurator (under Cadastros): master enable toggle + per-event toggles (nova cotação, nova ordem, novo cliente, novo fornecedor, novo produto)
  components/
    app-sidebar.tsx  - Navigation sidebar (Hypertrade branding)
    order-form.tsx   - Export order creation/edit form (with supplier selector, quotation prefill)
    order-detail.tsx - Order detail view
    theme-provider.tsx - Dark/light mode
    theme-toggle.tsx - Theme toggle button
server/
  routes.ts          - API endpoints (incl. /api/quotes, /api/quotations, /api/orders/:id/audit-log)
  storage.ts         - Database storage layer
  seed.ts            - Seed data
shared/
  schema.ts          - Drizzle schemas (suppliers, clients, products, quotations, quotationSendLog, exportOrders, orderAuditLog)
```

## Database Schema
- **platform_users**: name, email, role (admin/operador/visualizador), status (ativo/inativo), phone, department
- **suppliers**: name, cnpj, contact, phone, email, city, state
- **clients**: name, country, creditLimit, paymentTerms, email, phone, responsavel, registroNacional (CUIT/RUC/RUT), address, city, state, zipCode, notes
- **client_documents**: clientId (FK), nome, tipo (contrato/licença/certificado/procuração/registro/outro), numero, emissao (date), validade (date), observacoes, createdAt
- **products**: type, grammage, unidade (caixa|resma), standardPrice, supplierId (FK to suppliers)
- **quotations**: clientId, productId, supplierId, unitPrice, quantity, total, paymentTerms, validityDate, notes, status (rascunho/enviada/aceita/recusada/convertida)
- **quotation_send_log**: quotationId, method (email/whatsapp), userName, recipientInfo, sentAt
- **export_orders**: quotationId (FK), invoice, factory, nfe, bookingCrt, dueNumber, parametrizacao, modal, vessel, dates, financial fields, supplierId (FK to suppliers)
- **order_audit_log**: orderId, action (criação/alteração/exclusão), userName, changes (JSONB diff), snapshot (JSONB), createdAt

## Key Features
- Dashboard with 8 charts: Revenue by Country, Product Mix, Cash Flow, Payment Status, Transport Modal, Parametrização, Volume by Country, Monthly Orders
- Supplier management (CRUD) with CNPJ, contact, phone, email, city/state
- Suppliers linked to products and export orders via supplierId
- **Business Quotations (Cotações)**:
  - Full CRUD with status workflow (Rascunho → Enviada → Aceita/Recusada → Convertida)
  - **Financial Summary Panel** (CostRevenuePanel): auto-calculates when client, product, price, and quantity are filled:
    - Total USD, Product Cost (USD based on standardPrice), Client Cost in local currency (via real-time exchange rate from /api/quotes), Hypertrade Revenue/margin with percentage badge
    - Country→Currency mapping: Brasil→BRL, Argentina→ARS, Chile→CLP, Uruguai→UYU, Paraguai→PYG, México→MXN
    - Color-coded: green for positive margin, red for negative; blue card for client local currency cost
  - Send via Email (mailto: link) or WhatsApp (wa.me link) with pre-formatted message
  - Send log tracks all dispatch history per quotation
  - Convert accepted quotation to export order (pre-fills client, product, supplier)
  - Expandable rows showing details and send history
- Export order management with smart form (vessel hidden for rodoviário modal)
- Orders can be created from quotations (quotationId FK link)
- Transit time auto-calculated from dates
- Color-coded parametrização (Verde/Amarelo/Vermelho)
- Payment status tracking (Pendente/Pago/Atrasado)
- 48h due date alerts
- Advanced filters by country, status, month
- Currency exchange page "Câmbio" (BRL, ARS, CLP, UYU, PYG, MXN vs USD) with 5min server-side cache
- **Currency Exposure Dashboard** (/exposicao-cambial): USD-only receivables tracking by payment deadline
  - 4 KPI cards: Total Exposure (USD), Em Atraso (USD), Vence em 7 dias (USD), Países Expostos
  - Pie chart: exposure distribution by country (USD)
  - Bar chart: receivables by due month (USD)
  - Summary table per country: order count, total USD, % of total
  - Orders table sorted by due date with urgency badges (overdue, due in 7d, etc.)
  - Order detail dialog showing USD totals, due date, payment terms, and schedule timeline
  - No exchange rate dependency — all values in USD per business rule
- **Dedicated Vencimentos page** (/vencimentos): full due dates report for pending invoices
  - 5 KPI cards: Total Pendente, Vencidos (red), Urgentes 48h (orange), Próximos 7 dias (yellow), Valor Total Pendente
  - Color-coded urgency badges: Vencido (red), Urgente (orange), Próximo (yellow), Futuro (blue)
  - Filters by urgency level and country
  - Table with all pending invoices sorted by urgency priority
- Reports section with two tabs:
  - **Exportações**: expandable order details, full audit history timeline with field-level diffs
  - **Vencimentos**: compact version of due dates (also available in dedicated /vencimentos page)
- Audit log tracks creation, updates (with before/after values), and deletions for all export orders
- Dark/light theme support

## Running
`npm run dev` starts both frontend and backend on port 5000
