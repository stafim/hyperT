import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Package, Truck, Globe, DollarSign, TrendingUp, Ship, FileDown,
  AlertTriangle, CheckCircle2, Info, Calculator, Container,
} from "lucide-react";

const CONTAINER_20FT_MAX_KG = 26000;
const CONTAINER_40FT_MAX_KG = 26500;
const LCL_THRESHOLD_KG = 5000;

function fmtUSD(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD" }).format(v);
}
function fmtLocal(v: number, moeda: string) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: moeda }).format(v);
}
function fmtKg(v: number) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(v) + " kg";
}

interface CalcInputs {
  nomePapel: string;
  tipoPapel: "caixa" | "resma";
  moedaLocal: string;
  custoUnitario: string;
  pesoUnitario: string;
  quantidade: string;
  freteInterno: string;
  freteInternacional: string;
  margemLucro: string;
  taxaCambio: string;
  despesasAduaneiras: string;
  incoterm: "FOB" | "CIF";
}

function calcContainerInfo(pesoTotal: number) {
  if (pesoTotal <= 0) return { tipo: "-", qtd: 0, modalText: "-" };
  if (pesoTotal < LCL_THRESHOLD_KG) {
    return { tipo: "LCL", qtd: 0, modalText: "Carga Fracionada (LCL)" };
  }
  const n20ft = Math.ceil(pesoTotal / CONTAINER_20FT_MAX_KG);
  const n40ft = Math.ceil(pesoTotal / CONTAINER_40FT_MAX_KG);
  if (pesoTotal <= CONTAINER_20FT_MAX_KG) {
    return { tipo: "FCL 20'", qtd: 1, modalText: "1 × Container 20ft (FCL)" };
  }
  if (pesoTotal <= CONTAINER_40FT_MAX_KG) {
    return { tipo: "FCL 40'", qtd: 1, modalText: "1 × Container 40ft (FCL)" };
  }
  return { tipo: "FCL Multi", qtd: n20ft, modalText: `${n20ft} × Container 20ft (FCL)` };
}

export function QuotationCalculator() {
  const [inputs, setInputs] = useState<CalcInputs>({
    nomePapel: "",
    tipoPapel: "caixa",
    moedaLocal: "BRL",
    custoUnitario: "",
    pesoUnitario: "",
    quantidade: "",
    freteInterno: "",
    freteInternacional: "",
    margemLucro: "",
    taxaCambio: "",
    despesasAduaneiras: "2",
    incoterm: "FOB",
  });

  function set(field: keyof CalcInputs, value: string) {
    setInputs((prev) => ({ ...prev, [field]: value }));
  }

  function numOrZero(s: string) {
    const n = parseFloat(s.replace(",", "."));
    return isNaN(n) || n < 0 ? 0 : n;
  }

  const calc = useMemo(() => {
    const custoUnit = numOrZero(inputs.custoUnitario);
    const pesoUnit = numOrZero(inputs.pesoUnitario);
    const qtd = numOrZero(inputs.quantidade);
    const freteInt = numOrZero(inputs.freteInterno);
    const freteIntl = numOrZero(inputs.freteInternacional);
    const margem = numOrZero(inputs.margemLucro);
    const tc = numOrZero(inputs.taxaCambio);
    const despAduan = numOrZero(inputs.despesasAduaneiras);

    if (qtd <= 0 || tc <= 0 || custoUnit <= 0) {
      return null;
    }

    const pesoTotal = qtd * pesoUnit;
    const custoFabricaLocal = qtd * custoUnit;
    const custoFabricaUSD = custoFabricaLocal / tc;
    const freteInternoUSD = freteInt / tc;
    const lucroUSD = custoFabricaUSD * (margem / 100);
    const despesasUSD = custoFabricaUSD * (despAduan / 100);

    const precoFOBTotal = custoFabricaUSD + lucroUSD + freteInternoUSD + despesasUSD;
    const seguro = precoFOBTotal * 0.002;
    const precoCIFTotal = precoFOBTotal + freteIntl + seguro;

    const precoFOBUnit = qtd > 0 ? precoFOBTotal / qtd : 0;
    const precoCIFUnit = qtd > 0 ? precoCIFTotal / qtd : 0;

    const container = calcContainerInfo(pesoTotal);

    const breakdown = [
      { label: "Custo de Fábrica", value: custoFabricaUSD, pct: custoFabricaUSD / precoFOBTotal },
      { label: "Margem de Lucro", value: lucroUSD, pct: lucroUSD / precoFOBTotal },
      { label: "Frete Interno", value: freteInternoUSD, pct: freteInternoUSD / precoFOBTotal },
      { label: "Despesas Aduaneiras", value: despesasUSD, pct: despesasUSD / precoFOBTotal },
    ];

    return {
      pesoTotal,
      custoFabricaLocal,
      custoFabricaUSD,
      freteInternoUSD,
      lucroUSD,
      despesasUSD,
      precoFOBTotal,
      precoFOBUnit,
      seguro,
      precoCIFTotal,
      precoCIFUnit,
      container,
      breakdown,
      margemReal: precoFOBTotal > 0 ? (lucroUSD / precoFOBTotal) * 100 : 0,
    };
  }, [inputs]);

  async function exportPDF() {
    if (!calc) return;
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    const blue = [30, 77, 123] as [number, number, number];
    const gray = [100, 100, 100] as [number, number, number];
    const darkGray = [50, 50, 50] as [number, number, number];

    doc.setFillColor(...blue);
    doc.rect(0, 0, 210, 30, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("COTAÇÃO DE EXPORTAÇÃO DE PAPEL", 14, 13);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Gerado em ${new Date().toLocaleDateString("pt-BR")} — Hypertrade ERP`, 14, 21);

    let y = 38;
    doc.setTextColor(...darkGray);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("IDENTIFICAÇÃO DO PRODUTO", 14, y);
    y += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...gray);

    const prodLines = [
      ["Produto:", inputs.nomePapel || "—"],
      ["Tipo:", inputs.tipoPapel === "caixa" ? "Caixa" : "Resma"],
      ["Quantidade:", `${inputs.quantidade} unidades`],
      ["Peso unitário:", `${inputs.pesoUnitario} kg/un`],
      ["Peso total:", fmtKg(calc.pesoTotal)],
      ["Modal de transporte:", calc.container.modalText],
      ["Incoterm:", inputs.incoterm],
    ];
    prodLines.forEach(([label, val]) => {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...darkGray);
      doc.text(label, 14, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...gray);
      doc.text(val, 70, y);
      y += 6;
    });

    y += 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...darkGray);
    doc.text("COMPOSIÇÃO DE CUSTOS (Base FOB)", 14, y);
    y += 7;

    const costRows = [
      ["Custo de Fábrica", fmtUSD(calc.custoFabricaUSD), `(${fmtLocal(calc.custoFabricaLocal, inputs.moedaLocal)} ÷ ${inputs.taxaCambio})`],
      ["Margem de Lucro", fmtUSD(calc.lucroUSD), `(${inputs.margemLucro}% sobre custo)`],
      ["Frete Interno", fmtUSD(calc.freteInternoUSD), `(${fmtLocal(numOrZero(inputs.freteInterno), inputs.moedaLocal)} ÷ ${inputs.taxaCambio})`],
      [`Despesas Aduaneiras`, fmtUSD(calc.despesasUSD), `(${inputs.despesasAduaneiras}% sobre custo fábrica)`],
    ];

    doc.setFontSize(10);
    costRows.forEach(([label, val, note]) => {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...darkGray);
      doc.text(label, 14, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...gray);
      doc.text(val, 110, y, { align: "right" });
      doc.setFontSize(8);
      doc.text(note, 115, y);
      doc.setFontSize(10);
      y += 6;
    });

    doc.setDrawColor(...blue);
    doc.setLineWidth(0.5);
    doc.line(14, y, 196, y);
    y += 5;

    doc.setFillColor(240, 246, 255);
    doc.rect(14, y - 3, 182, 16, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...blue);
    doc.text("PREÇO FOB TOTAL", 18, y + 4);
    doc.text(fmtUSD(calc.precoFOBTotal), 192, y + 4, { align: "right" });
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...gray);
    doc.text(`Preço unitário FOB: ${fmtUSD(calc.precoFOBUnit)}`, 18, y + 10);
    y += 20;

    if (inputs.incoterm === "CIF") {
      const cifRows = [
        ["Frete Internacional", fmtUSD(numOrZero(inputs.freteInternacional))],
        ["Seguro (0,2% FOB)", fmtUSD(calc.seguro)],
      ];
      cifRows.forEach(([label, val]) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(...darkGray);
        doc.text(label, 14, y);
        doc.setTextColor(...gray);
        doc.text(val, 110, y, { align: "right" });
        y += 6;
      });

      doc.setDrawColor(...blue);
      doc.line(14, y, 196, y);
      y += 5;

      doc.setFillColor(220, 252, 231);
      doc.rect(14, y - 3, 182, 16, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(21, 128, 61);
      doc.text("PREÇO CIF TOTAL", 18, y + 4);
      doc.text(fmtUSD(calc.precoCIFTotal), 192, y + 4, { align: "right" });
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...gray);
      doc.text(`Preço unitário CIF: ${fmtUSD(calc.precoCIFUnit)}`, 18, y + 10);
      y += 20;
    }

    y += 4;
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text("Este documento é um cálculo estimativo gerado pelo Hypertrade ERP. Os valores estão sujeitos a confirmação comercial.", 14, y);

    doc.save(`cotacao-${inputs.nomePapel || "papel"}-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  const ready = calc !== null;

  return (
    <div className="flex gap-6 min-h-0">
      <div className="w-[380px] shrink-0 space-y-4 overflow-y-auto pr-1 pb-4">
        <div className="rounded-xl border bg-card shadow-sm p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Package className="h-4 w-4 text-blue-600" />
            Dados do Produto
          </div>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Nome do papel</Label>
              <Input
                placeholder="Ex: Sack Kraft 80g/m²"
                value={inputs.nomePapel}
                onChange={(e) => set("nomePapel", e.target.value)}
                data-testid="calc-input-nome"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Tipo</Label>
                <Select value={inputs.tipoPapel} onValueChange={(v) => set("tipoPapel", v as any)}>
                  <SelectTrigger data-testid="calc-select-tipo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="caixa">Caixa</SelectItem>
                    <SelectItem value="resma">Resma</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Moeda local</Label>
                <Select value={inputs.moedaLocal} onValueChange={(v) => set("moedaLocal", v)}>
                  <SelectTrigger data-testid="calc-select-moeda">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BRL">BRL (Real)</SelectItem>
                    <SelectItem value="ARS">ARS (Peso AR)</SelectItem>
                    <SelectItem value="CLP">CLP (Peso CL)</SelectItem>
                    <SelectItem value="EUR">EUR (Euro)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Custo unitário ({inputs.moedaLocal})</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="0,00"
                  value={inputs.custoUnitario}
                  onChange={(e) => set("custoUnitario", e.target.value)}
                  data-testid="calc-input-custo-unitario"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Peso unitário (kg)</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={inputs.pesoUnitario}
                  onChange={(e) => set("pesoUnitario", e.target.value)}
                  data-testid="calc-input-peso"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card shadow-sm p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Truck className="h-4 w-4 text-amber-600" />
            Logística
          </div>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Quantidade total (unidades)</Label>
              <Input
                type="number"
                min={0}
                placeholder="0"
                value={inputs.quantidade}
                onChange={(e) => set("quantidade", e.target.value)}
                data-testid="calc-input-quantidade"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Frete interno — até porto/aeroporto ({inputs.moedaLocal})</Label>
              <Input
                type="number"
                min={0}
                placeholder="0,00"
                value={inputs.freteInterno}
                onChange={(e) => set("freteInterno", e.target.value)}
                data-testid="calc-input-frete-interno"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Frete internacional (USD)</Label>
              <Input
                type="number"
                min={0}
                placeholder="0,00"
                value={inputs.freteInternacional}
                onChange={(e) => set("freteInternacional", e.target.value)}
                data-testid="calc-input-frete-intl"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Incoterm</Label>
              <div className="flex gap-2 mt-1">
                {(["FOB", "CIF"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => set("incoterm", t)}
                    className={`flex-1 py-2 rounded-lg border text-sm font-semibold transition-all ${
                      inputs.incoterm === t
                        ? t === "FOB"
                          ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                          : "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                        : "bg-background text-muted-foreground border-border hover:border-blue-400"
                    }`}
                    data-testid={`calc-button-incoterm-${t.toLowerCase()}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                {inputs.incoterm === "FOB"
                  ? "FOB: vendedor entrega no porto de embarque. Frete internacional por conta do comprador."
                  : "CIF: vendedor paga frete internacional e seguro até o porto de destino."}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card shadow-sm p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <DollarSign className="h-4 w-4 text-green-600" />
            Financeiro
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Margem de lucro (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={99}
                  placeholder="0"
                  value={inputs.margemLucro}
                  onChange={(e) => set("margemLucro", e.target.value)}
                  data-testid="calc-input-margem"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Taxa de câmbio ({inputs.moedaLocal}/USD)</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="5,80"
                  value={inputs.taxaCambio}
                  onChange={(e) => set("taxaCambio", e.target.value)}
                  data-testid="calc-input-cambio"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Despesas aduaneiras (% sobre custo fábrica)</Label>
              <Input
                type="number"
                min={0}
                max={50}
                placeholder="2"
                value={inputs.despesasAduaneiras}
                onChange={(e) => set("despesasAduaneiras", e.target.value)}
                data-testid="calc-input-despesas"
              />
              <p className="text-[10px] text-muted-foreground mt-1">Inclui: despachante, documentação, carregamento. Padrão: 2%</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 min-w-0 space-y-4 overflow-y-auto pb-4">
        {!ready ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground py-20">
            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
              <Calculator className="h-8 w-8 opacity-40" />
            </div>
            <div className="text-center">
              <p className="font-medium">Preencha os dados à esquerda</p>
              <p className="text-sm mt-1">O painel de resultados atualiza em tempo real</p>
            </div>
            <div className="grid grid-cols-1 gap-2 text-xs text-left max-w-xs w-full mt-2">
              {[
                "Custo unitário em moeda local",
                "Quantidade total de unidades",
                "Taxa de câmbio atual",
              ].map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                  <span>{s}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="rounded-xl border bg-card shadow-sm p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-lg font-bold">{inputs.nomePapel || "Cotação de Papel"}</h2>
                  <p className="text-sm text-muted-foreground capitalize">{inputs.tipoPapel} · {inputs.quantidade} unidades · {fmtKg(calc.pesoTotal)} total</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    className={`text-xs font-bold px-3 py-1 ${
                      calc.container.tipo === "LCL"
                        ? "bg-amber-100 text-amber-800 border-amber-200"
                        : "bg-blue-100 text-blue-800 border-blue-200"
                    }`}
                    variant="outline"
                  >
                    <Container className="h-3 w-3 mr-1" />
                    {calc.container.modalText}
                  </Badge>
                  <Badge variant="outline" className={`text-xs font-bold px-3 py-1 ${inputs.incoterm === "FOB" ? "bg-blue-600 text-white border-blue-700" : "bg-emerald-600 text-white border-emerald-700"}`}>
                    {inputs.incoterm}
                  </Badge>
                </div>
              </div>

              {calc.container.tipo === "LCL" && (
                <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Volume abaixo de {fmtKg(LCL_THRESHOLD_KG)} — carga fracionada (LCL). O frete internacional por kg é tipicamente mais caro que FCL. Considere consolidar a carga.
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className={`rounded-xl border-2 shadow-sm p-5 ${inputs.incoterm === "FOB" ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20" : "border-border bg-card"}`}>
                <div className="flex items-center gap-2 mb-3">
                  <Ship className={`h-5 w-5 ${inputs.incoterm === "FOB" ? "text-blue-600" : "text-muted-foreground"}`} />
                  <span className={`font-bold text-sm ${inputs.incoterm === "FOB" ? "text-blue-700 dark:text-blue-300" : ""}`}>
                    Preço FOB {inputs.incoterm === "FOB" && <span className="ml-1 text-xs font-normal">(Incoterm selecionado)</span>}
                  </span>
                  {inputs.incoterm === "FOB" && <CheckCircle2 className="h-4 w-4 text-blue-500 ml-auto" />}
                </div>
                <p className="text-3xl font-bold">{fmtUSD(calc.precoFOBTotal)}</p>
                <p className="text-sm text-muted-foreground mt-1">Total da proposta</p>
                <Separator className="my-3" />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Preço por unidade</span>
                  <span className="font-bold text-lg">{fmtUSD(calc.precoFOBUnit)}</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-sm text-muted-foreground">Margem real</span>
                  <span className="font-semibold text-emerald-600">{calc.margemReal.toFixed(2)}%</span>
                </div>
              </div>

              <div className={`rounded-xl border-2 shadow-sm p-5 ${inputs.incoterm === "CIF" ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20" : "border-border bg-card"}`}>
                <div className="flex items-center gap-2 mb-3">
                  <Globe className={`h-5 w-5 ${inputs.incoterm === "CIF" ? "text-emerald-600" : "text-muted-foreground"}`} />
                  <span className={`font-bold text-sm ${inputs.incoterm === "CIF" ? "text-emerald-700 dark:text-emerald-300" : ""}`}>
                    Preço CIF {inputs.incoterm === "CIF" && <span className="ml-1 text-xs font-normal">(Incoterm selecionado)</span>}
                  </span>
                  {inputs.incoterm === "CIF" && <CheckCircle2 className="h-4 w-4 text-emerald-500 ml-auto" />}
                </div>
                <p className="text-3xl font-bold">{fmtUSD(calc.precoCIFTotal)}</p>
                <p className="text-sm text-muted-foreground mt-1">Total da proposta</p>
                <Separator className="my-3" />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Preço por unidade</span>
                  <span className="font-bold text-lg">{fmtUSD(calc.precoCIFUnit)}</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-sm text-muted-foreground">Seguro incluso</span>
                  <span className="font-semibold text-muted-foreground">{fmtUSD(calc.seguro)}</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border bg-card shadow-sm p-5 space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                Composição do Preço FOB
              </div>
              <div className="space-y-2.5">
                {calc.breakdown.map((item) => (
                  <div key={item.label}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-muted-foreground">{item.label}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">{(item.pct * 100).toFixed(1)}%</span>
                        <span className="font-semibold w-28 text-right">{fmtUSD(item.value)}</span>
                      </div>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-500 transition-all duration-500"
                        style={{ width: `${Math.max(item.pct * 100, 0.5)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <Separator />
              <div className="flex items-center justify-between text-sm font-bold">
                <span>Total FOB</span>
                <span>{fmtUSD(calc.precoFOBTotal)}</span>
              </div>
              {inputs.incoterm === "CIF" && (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">+ Frete Internacional</span>
                    <span>{fmtUSD(numOrZero(inputs.freteInternacional))}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">+ Seguro (0,2%)</span>
                    <span>{fmtUSD(calc.seguro)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm font-bold text-emerald-700 dark:text-emerald-300">
                    <span>Total CIF</span>
                    <span>{fmtUSD(calc.precoCIFTotal)}</span>
                  </div>
                </>
              )}
            </div>

            <div className="rounded-xl border bg-muted/30 p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Peso Total", value: fmtKg(calc.pesoTotal) },
                { label: "Custo Fábrica (USD)", value: fmtUSD(calc.custoFabricaUSD) },
                { label: "Custo Fábrica (Local)", value: fmtLocal(calc.custoFabricaLocal, inputs.moedaLocal) },
                { label: "Despesas Aduaneiras", value: fmtUSD(calc.despesasUSD) },
              ].map(({ label, value }) => (
                <div key={label} className="text-center">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</p>
                  <p className="font-semibold text-sm mt-0.5">{value}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-3 justify-end">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Info className="h-3.5 w-3.5" />
                Cálculo estimativo — valores sujeitos a confirmação comercial
              </div>
              <Button onClick={exportPDF} className="gap-2" data-testid="calc-button-export-pdf">
                <FileDown className="h-4 w-4" />
                Exportar PDF
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
