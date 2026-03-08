import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Save, RotateCcw, Plus, Trash2, BrainCircuit, Database, Thermometer, BookOpen, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export const AI_CALIB_STORAGE_KEY = "hypertrade_ai_calibration";

export interface AICalibrationSettings {
  businessContext: string;
  temperature: number;
  exampleQuestions: string[];
}

const DEFAULT_SETTINGS: AICalibrationSettings = {
  businessContext: "",
  temperature: 0.1,
  exampleQuestions: [
    "Qual o total de exportações por cliente?",
    "Mostre o faturamento mensal em USD dos últimos 6 meses",
    "Qual a distribuição de ordens por modal (marítimo vs rodoviário)?",
    "Quais ordens estão com pagamento atrasado?",
    "Qual o valor total faturado por produto?",
    "Quantas cotações foram aceitas, recusadas e convertidas?",
  ],
};

const TABLES_INFO = [
  { name: "clients", label: "Clientes", desc: "id, name, country, credit_limit, payment_terms" },
  { name: "suppliers", label: "Fornecedores", desc: "id, name, cnpj, contact, phone, email, city, state" },
  { name: "products", label: "Produtos", desc: "id, type, grammage, standard_price, supplier_id" },
  { name: "quotations", label: "Cotações", desc: "id, client_id, product_id, unit_price, quantity, total, margem, status, created_at" },
  { name: "export_orders", label: "Ordens de Exportação", desc: "id, client_id, product_id, invoice, modal, vessel, embarque_date, total, status_pagamento, vessel_status" },
  { name: "documentos", label: "Documentos Cambiais", desc: "id, order_id, tipo, status, created_at" },
  { name: "lpco", label: "LPCO", desc: "id, tipo, orgao, numero, status, data_validade, client_id" },
];

export function loadAICalibration(): AICalibrationSettings {
  try {
    const raw = localStorage.getItem(AI_CALIB_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return {
      businessContext: typeof parsed.businessContext === "string" ? parsed.businessContext : DEFAULT_SETTINGS.businessContext,
      temperature: typeof parsed.temperature === "number" ? parsed.temperature : DEFAULT_SETTINGS.temperature,
      exampleQuestions: Array.isArray(parsed.exampleQuestions) ? parsed.exampleQuestions : [...DEFAULT_SETTINGS.exampleQuestions],
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export default function CalibragemIA() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<AICalibrationSettings>(() => loadAICalibration());
  const [dirty, setDirty] = useState(false);
  const [newQuestion, setNewQuestion] = useState("");

  function update<K extends keyof AICalibrationSettings>(key: K, value: AICalibrationSettings[K]) {
    setSettings((s) => ({ ...s, [key]: value }));
    setDirty(true);
  }

  function addQuestion() {
    const q = newQuestion.trim();
    if (!q) return;
    update("exampleQuestions", [...settings.exampleQuestions, q]);
    setNewQuestion("");
  }

  function removeQuestion(idx: number) {
    update("exampleQuestions", settings.exampleQuestions.filter((_, i) => i !== idx));
  }

  function updateQuestion(idx: number, val: string) {
    const arr = [...settings.exampleQuestions];
    arr[idx] = val;
    update("exampleQuestions", arr);
  }

  function save() {
    localStorage.setItem(AI_CALIB_STORAGE_KEY, JSON.stringify(settings));
    setDirty(false);
    toast({ title: "Calibragem salva", description: "As configurações da IA foram atualizadas com sucesso." });
  }

  function reset() {
    const defaults = { ...DEFAULT_SETTINGS, exampleQuestions: [...DEFAULT_SETTINGS.exampleQuestions] };
    setSettings(defaults);
    setDirty(true);
    toast({ title: "Configurações restauradas", description: "Os valores padrão foram restaurados. Salve para aplicar." });
  }

  const tempLabel = settings.temperature <= 0.1 ? "Muito preciso" : settings.temperature <= 0.3 ? "Preciso" : settings.temperature <= 0.6 ? "Balanceado" : settings.temperature <= 0.8 ? "Criativo" : "Muito criativo";
  const tempColor = settings.temperature <= 0.2 ? "text-blue-500" : settings.temperature <= 0.5 ? "text-green-500" : settings.temperature <= 0.8 ? "text-amber-500" : "text-red-500";

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BrainCircuit className="h-6 w-6 text-primary" />
            Calibragem de IA
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure o comportamento da Consulta Inteligente para o contexto do seu negócio
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={reset} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Restaurar padrões
          </Button>
          <Button onClick={save} disabled={!dirty} className="gap-2">
            <Save className="h-4 w-4" />
            Salvar configurações
          </Button>
        </div>
      </div>

      {dirty && (
        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
          <Info className="h-4 w-4 shrink-0" />
          Há alterações não salvas. Clique em "Salvar configurações" para aplicar.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4 text-primary" />
            Contexto de Negócio
          </CardTitle>
          <CardDescription>
            Informações adicionais enviadas à IA em cada consulta. Use para descrever regras de negócio, convenções de dados ou instruções específicas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={settings.businessContext}
            onChange={(e) => update("businessContext", e.target.value)}
            placeholder={`Exemplos:\n• Todos os valores monetários são em USD\n• O ano fiscal começa em julho\n• Clientes da Argentina têm prazo de 90 dias\n• Ordens com modal "rodoviário" não possuem vessel`}
            rows={7}
            className="font-mono text-sm resize-none"
          />
          <p className="text-xs text-muted-foreground">
            {settings.businessContext.length} caracteres &mdash; Recomendado: até 800 caracteres para não impactar a precisão
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Thermometer className="h-4 w-4 text-primary" />
            Temperatura do Modelo
          </CardTitle>
          <CardDescription>
            Controla o grau de criatividade das respostas. Valores baixos geram SQL mais determinístico e preciso; valores altos permitem interpretações mais variadas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <span className="text-xs text-muted-foreground w-16">Preciso</span>
            <Slider
              min={0}
              max={1}
              step={0.05}
              value={[settings.temperature]}
              onValueChange={([v]) => update("temperature", v)}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground w-16 text-right">Criativo</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`font-mono ${tempColor}`}>
              {settings.temperature.toFixed(2)}
            </Badge>
            <span className={`text-sm font-medium ${tempColor}`}>{tempLabel}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Recomendado: <strong>0.10</strong> para consultas SQL (padrão do sistema)
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BrainCircuit className="h-4 w-4 text-primary" />
            Exemplos de Consulta
          </CardTitle>
          <CardDescription>
            Perguntas de exemplo exibidas na Consulta Inteligente. Personalize com consultas relevantes para o seu fluxo de trabalho.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            {settings.exampleQuestions.map((q, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-5 shrink-0">{idx + 1}.</span>
                <Input
                  value={q}
                  onChange={(e) => updateQuestion(idx, e.target.value)}
                  className="text-sm"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeQuestion(idx)}
                  title="Remover"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>

          {settings.exampleQuestions.length < 12 && (
            <div className="flex items-center gap-2 pt-1">
              <Input
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addQuestion()}
                placeholder="Nova consulta de exemplo..."
                className="text-sm"
              />
              <Button variant="outline" size="sm" onClick={addQuestion} disabled={!newQuestion.trim()} className="gap-1 shrink-0">
                <Plus className="h-3.5 w-3.5" />
                Adicionar
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {settings.exampleQuestions.length}/12 exemplos &mdash; Pressione Enter para adicionar rapidamente
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-4 w-4 text-primary" />
            Tabelas Disponíveis para Consulta
          </CardTitle>
          <CardDescription>
            Visão geral do schema de banco de dados exposto à IA. Apenas leitura (SELECT).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2">
            {TABLES_INFO.map((t) => (
              <div key={t.name} className="rounded-lg border bg-muted/20 px-3 py-2.5">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="secondary" className="font-mono text-xs">{t.name}</Badge>
                  <span className="text-sm font-medium">{t.label}</span>
                </div>
                <p className="text-xs text-muted-foreground font-mono leading-relaxed">{t.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
