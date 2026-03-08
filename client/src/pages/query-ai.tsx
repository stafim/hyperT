import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  Legend, ResponsiveContainer,
} from "recharts";
import {
  Search, Download, Loader2, BarChart2, TableIcon, Sparkles,
  Code2, RotateCcw, TrendingUp, PieChartIcon, Mic, MicOff, MicIcon, Info, SlidersHorizontal,
} from "lucide-react";
import { loadAICalibration } from "@/pages/calibragem-ia";
import { Link } from "wouter";

const COLORS = ["#1E4D7B", "#2276BB", "#3B82F6", "#0EA5E9", "#64748B", "#7FAFD4", "#1D4ED8", "#94A3B8"];

type ChartKind = "bar" | "line" | "pie" | "kpi" | "table";

interface ChartSuggestion {
  type: ChartKind;
  label: string;
  reason: string;
}

interface QueryResult {
  sql: string;
  rows: Record<string, any>[];
  columns: string[];
  chartSuggestions: ChartSuggestion[];
  chartTitle: string;
  xAxisKey: string;
  yAxisKey: string;
  valueLabel: string;
}

type VoiceState = "idle" | "listening" | "processing" | "unsupported";

const SpeechRecognitionAPI =
  typeof window !== "undefined"
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null;

function useVoiceRecognition(onTranscript: (text: string, final: boolean) => void) {
  const [voiceState, setVoiceState] = useState<VoiceState>(
    SpeechRecognitionAPI ? "idle" : "unsupported"
  );
  const recognitionRef = useRef<any>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = useCallback(() => {
    if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null; }
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setVoiceState("idle");
  }, []);

  const start = useCallback(() => {
    if (!SpeechRecognitionAPI) return;
    if (recognitionRef.current) { stop(); return; }
    const recognition = new SpeechRecognitionAPI();
    recognition.lang = "pt-BR";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setVoiceState("listening");
    recognition.onresult = (event: any) => {
      let interim = "", final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += t;
        else interim += t;
      }
      if (final) { onTranscript(final.trim(), true); setVoiceState("processing"); recognitionRef.current = null; }
      else if (interim) onTranscript(interim, false);
    };
    recognition.onerror = () => { setVoiceState("idle"); recognitionRef.current = null; };
    recognition.onend = () => { recognitionRef.current = null; };
    recognitionRef.current = recognition;
    recognition.start();
    timeoutRef.current = setTimeout(() => {
      if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null; setVoiceState("idle"); }
    }, 15000);
  }, [stop, onTranscript]);

  useEffect(() => () => stop(), [stop]);
  return { voiceState, setVoiceState, start, stop };
}

function formatValue(val: any): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "number") return val.toLocaleString("pt-BR");
  const n = Number(val);
  if (!isNaN(n) && val !== "" && val !== true && val !== false) return n.toLocaleString("pt-BR");
  return String(val);
}

function downloadCSV(columns: string[], rows: Record<string, any>[], title: string) {
  const header = columns.join(";");
  const body = rows.map((r) => columns.map((c) => `"${String(r[c] ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + header + "\n" + body], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.toLowerCase().replace(/\s+/g, "_")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function chartKindIcon(type: ChartKind, cls = "h-4 w-4") {
  if (type === "line") return <TrendingUp className={cls} />;
  if (type === "pie") return <PieChartIcon className={cls} />;
  if (type === "kpi") return <Sparkles className={cls} />;
  if (type === "table") return <TableIcon className={cls} />;
  return <BarChart2 className={cls} />;
}

function KPICard({ value, label, title }: { value: any; label: string; title: string }) {
  const display =
    typeof value === "number" || (!isNaN(Number(value)) && value !== "")
      ? Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 2 })
      : String(value ?? "—");
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">{title}</p>
      <p className="text-6xl font-bold text-primary">{display}</p>
      {label && <p className="text-base text-muted-foreground">{label}</p>}
    </div>
  );
}

function DynamicChart({
  rows, chartType, xAxisKey, yAxisKey, valueLabel, chartTitle,
}: {
  rows: Record<string, any>[];
  chartType: ChartKind;
  xAxisKey: string;
  yAxisKey: string;
  valueLabel: string;
  chartTitle: string;
}) {
  const numericRows = rows.map((r) => ({ ...r, [yAxisKey]: Number(r[yAxisKey]) || 0 }));

  if (chartType === "kpi") {
    const row = rows[0] ?? {};
    const val = row[yAxisKey] ?? row[Object.keys(row)[0]];
    return <KPICard value={val} label={valueLabel} title={chartTitle} />;
  }
  if (chartType === "pie") {
    return (
      <ResponsiveContainer width="100%" height={380}>
        <PieChart>
          <Pie data={numericRows} dataKey={yAxisKey} nameKey={xAxisKey} cx="50%" cy="50%" outerRadius={140}
            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`} labelLine>
            {numericRows.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <RechartsTooltip formatter={(v: any) => [Number(v).toLocaleString("pt-BR"), valueLabel || yAxisKey]} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    );
  }
  if (chartType === "line") {
    return (
      <ResponsiveContainer width="100%" height={380}>
        <LineChart data={numericRows} margin={{ top: 10, right: 30, left: 10, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey={xAxisKey} tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => Number(v).toLocaleString("pt-BR")} />
          <RechartsTooltip formatter={(v: any) => [Number(v).toLocaleString("pt-BR"), valueLabel || yAxisKey]} />
          <Legend />
          <Line type="monotone" dataKey={yAxisKey} stroke="#2276BB" strokeWidth={2.5} dot={{ r: 4, fill: "#1E4D7B" }} activeDot={{ r: 6, fill: "#2276BB" }} name={valueLabel || yAxisKey} />
        </LineChart>
      </ResponsiveContainer>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={380}>
      <BarChart data={numericRows} margin={{ top: 10, right: 30, left: 10, bottom: 60 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey={xAxisKey} tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => Number(v).toLocaleString("pt-BR")} />
        <RechartsTooltip formatter={(v: any) => [Number(v).toLocaleString("pt-BR"), valueLabel || yAxisKey]} />
        <Legend />
        <Bar dataKey={yAxisKey} name={valueLabel || yAxisKey} radius={[4, 4, 0, 0]}>
          {numericRows.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function VoiceMicButton({ voiceState, onStart, onStop }: { voiceState: VoiceState; onStart: () => void; onStop: () => void }) {
  if (voiceState === "unsupported") {
    return (
      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/40 cursor-not-allowed" disabled title="Reconhecimento de voz não suportado neste navegador">
        <MicOff className="h-4 w-4" />
      </Button>
    );
  }
  const isListening = voiceState === "listening";
  return (
    <Button variant="ghost" size="icon"
      className={`h-8 w-8 transition-colors ${isListening ? "text-red-500 hover:text-red-600 hover:bg-red-50" : "text-muted-foreground hover:text-foreground"}`}
      onClick={isListening ? onStop : onStart}
      disabled={voiceState === "processing"}
      title={isListening ? "Parar gravação" : "Falar sua pergunta (pt-BR)"}
    >
      {isListening ? (
        <span className="relative flex h-4 w-4 items-center justify-center">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-60" />
          <Mic className="relative h-4 w-4 text-red-500" />
        </span>
      ) : (
        <MicIcon className="h-4 w-4" />
      )}
    </Button>
  );
}

function ResultPanel({ result, index, total }: { result: QueryResult; index: number; total: number }) {
  const firstType = result.chartSuggestions?.[0]?.type ?? "bar";
  const [selectedChart, setSelectedChart] = useState<ChartKind>(firstType === "table" ? "bar" : firstType);
  const [showTable, setShowTable] = useState(false);
  const [showSql, setShowSql] = useState(false);

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b">
        <div className="flex items-center gap-2 min-w-0">
          {chartKindIcon(selectedChart, "h-4 w-4 shrink-0 text-primary")}
          <h2 className="font-semibold text-base truncate">{result.chartTitle}</h2>
          <span className="text-xs text-muted-foreground shrink-0">{result.rows.length} registro{result.rows.length !== 1 ? "s" : ""}</span>
          {total > 1 && (
            <span className="ml-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold px-2 py-px leading-none shrink-0">
              {index + 1}/{total}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => setShowSql((v) => !v)}>
            <Code2 className="h-3.5 w-3.5" />{showSql ? "Ocultar SQL" : "Ver SQL"}
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs"
            onClick={() => downloadCSV(result.columns, result.rows, result.chartTitle)}>
            <Download className="h-3.5 w-3.5" />Baixar CSV
          </Button>
        </div>
      </div>

      {showSql && (
        <div className="px-5 py-3 border-b bg-muted/30">
          <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap break-all">{result.sql}</pre>
        </div>
      )}

      {result.rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
          <Search className="h-10 w-10 opacity-20" />
          <p className="text-sm">Nenhum registro encontrado para essa consulta.</p>
        </div>
      ) : (
        <>
          <div className="px-5 pt-4 pb-3 border-b flex items-center gap-3 flex-wrap">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Visualização:</span>
            <div className="flex items-center gap-1.5">
              {result.chartSuggestions.map((suggestion, idx) => (
                <Tooltip key={suggestion.type}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => { setSelectedChart(suggestion.type); setShowTable(false); }}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border transition-all ${
                        !showTable && selectedChart === suggestion.type
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-background text-muted-foreground border-border hover:bg-accent hover:text-accent-foreground"
                      }`}
                    >
                      {chartKindIcon(suggestion.type, "h-3.5 w-3.5")}
                      {suggestion.label}
                      {idx === 0 && (
                        <span className="ml-0.5 rounded-full bg-amber-400/20 text-amber-600 text-[9px] font-bold px-1 py-px leading-none">IA</span>
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[200px] text-xs">
                    <div className="flex items-start gap-1.5">
                      <Info className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
                      <span>{suggestion.reason}</span>
                    </div>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
            <div className="ml-auto">
              <button
                onClick={() => setShowTable((v) => !v)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border transition-all ${
                  showTable
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-background text-muted-foreground border-border hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                <TableIcon className="h-3.5 w-3.5" />
                Tabela
              </button>
            </div>
          </div>

          {showTable ? (
            <div className="overflow-auto max-h-[420px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    {result.columns.map((col) => (
                      <TableHead key={col} className="whitespace-nowrap text-xs font-semibold uppercase tracking-wider">{col}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.rows.map((row, i) => (
                    <TableRow key={i}>
                      {result.columns.map((col) => (
                        <TableCell key={col} className="text-sm whitespace-nowrap">{formatValue(row[col])}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="px-5 pb-5 pt-4">
              <DynamicChart
                rows={result.rows}
                chartType={selectedChart}
                xAxisKey={result.xAxisKey}
                yAxisKey={result.yAxisKey}
                valueLabel={result.valueLabel}
                chartTitle={result.chartTitle}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function QueryAI() {
  const [question, setQuestion] = useState("");
  const [results, setResults] = useState<QueryResult[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const pendingAutoSubmit = useRef(false);

  useEffect(() => { textareaRef.current?.focus(); }, []);

  const aiCalibration = loadAICalibration();

  const mutation = useMutation({
    mutationFn: async (q: string) => {
      const res = await apiRequest("POST", "/api/query-ai", {
        question: q,
        businessContext: aiCalibration.businessContext || undefined,
        temperature: aiCalibration.temperature,
      });
      return res.json() as Promise<{ results: QueryResult[]; error?: string }>;
    },
    onSuccess: (data) => {
      if ((data as any).error) return;
      setResults(data.results ?? []);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    },
  });

  const handleSubmit = useCallback((q?: string) => {
    const text = q ?? question;
    if (!text.trim() || mutation.isPending) return;
    mutation.mutate(text.trim());
  }, [question, mutation]);

  const handleTranscript = useCallback((text: string, isFinal: boolean) => {
    setQuestion(text);
    if (isFinal) pendingAutoSubmit.current = true;
  }, []);

  const { voiceState, setVoiceState, start: startVoice, stop: stopVoice } = useVoiceRecognition(handleTranscript);

  useEffect(() => {
    if (pendingAutoSubmit.current && voiceState === "processing" && question.trim()) {
      pendingAutoSubmit.current = false;
      const captured = question.trim();
      setVoiceState("idle");
      setTimeout(() => handleSubmit(captured), 300);
    }
  }, [voiceState, question, handleSubmit, setVoiceState]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleSubmit(); }
  };

  const errorMsg = (mutation.data as any)?.error ?? (mutation.error as any)?.message;
  const listeningBanner = voiceState === "listening";
  const hasResults = results.length > 0;

  return (
    <TooltipProvider>
      <div className="flex flex-col min-h-screen bg-background">
        <div className="border-b bg-card px-6 py-5">
          <div className="max-w-5xl mx-auto flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Consulta Inteligente</h1>
              <p className="text-sm text-muted-foreground">Faça perguntas em português — por texto ou por voz — e escolha como visualizar os dados</p>
            </div>
          </div>
        </div>

        <div className="flex-1 px-6 py-8">
          <div className="max-w-5xl mx-auto space-y-6">

            <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
              {listeningBanner && (
                <div className="flex items-center gap-2 bg-red-50 border-b border-red-100 px-4 py-2 text-sm text-red-600">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                  </span>
                  Ouvindo... Fale sua pergunta em português. Clique no microfone para parar.
                </div>
              )}
              <div className="flex items-center gap-3 px-4 pt-4 pb-2">
                <Search className="h-5 w-5 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium text-muted-foreground">Pergunta</span>
                <Badge variant="outline" className="ml-auto text-xs">Ctrl + Enter para enviar</Badge>
              </div>
              <Textarea
                ref={textareaRef}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={listeningBanner ? "Aguardando transcrição de voz..." : "Ex: Como estão os pagamentos e o faturamento por cliente este ano?"}
                className="border-0 shadow-none resize-none text-base focus-visible:ring-0 px-4 pb-3 min-h-[80px]"
                rows={3}
                readOnly={listeningBanner}
              />
              <div className="flex items-center gap-2 px-4 pb-4">
                <Button onClick={() => handleSubmit()} disabled={!question.trim() || mutation.isPending} className="gap-2">
                  {mutation.isPending
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Analisando...</>
                    : <><Sparkles className="h-4 w-4" /> Consultar</>}
                </Button>
                <VoiceMicButton voiceState={voiceState} onStart={startVoice} onStop={stopVoice} />
                {(hasResults || question) && (
                  <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground ml-auto"
                    onClick={() => { setQuestion(""); setResults([]); mutation.reset(); stopVoice(); }}>
                    <RotateCcw className="h-3.5 w-3.5" /> Limpar
                  </Button>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Exemplos de perguntas</p>
                <Link href="/calibragem-ia" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
                  <SlidersHorizontal className="h-3 w-3" />
                  Calibrar IA
                </Link>
              </div>
              <div className="flex flex-wrap gap-2">
                {aiCalibration.exampleQuestions.map((q) => (
                  <button key={q} onClick={() => setQuestion(q)}
                    className="rounded-full border px-3 py-1 text-xs hover:bg-accent hover:text-accent-foreground transition-colors text-muted-foreground">
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {errorMsg && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {errorMsg}
              </div>
            )}

            {hasResults && !errorMsg && (
              <div ref={resultsRef} className="space-y-5">
                {results.length > 1 && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span>A IA gerou <strong className="text-foreground">{results.length} análises</strong> para responder sua pergunta</span>
                  </div>
                )}
                {results.map((r, i) => (
                  <ResultPanel key={i} result={r} index={i} total={results.length} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
