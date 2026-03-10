import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
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
  Search, Download, Loader2, BarChart2, TableIcon, Sparkles,
  Code2, RotateCcw, Mic, MicOff, MicIcon, Info, SlidersHorizontal,
  Star, Trash2, History, Clock,
} from "lucide-react";
import { DynamicChart, chartKindIcon, type ChartKind, type QueryResult, type ChartSuggestion } from "@/components/dynamic-chart";
import { loadAICalibration } from "@/pages/calibragem-ia";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

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

    recognition.onstart = () => setVoiceState("listening");
    recognition.onerror = () => { stop(); };
    recognition.onend = () => { setVoiceState("processing"); recognitionRef.current = null; };
    recognition.onresult = (event: any) => {
      let final = ""; let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += t;
        else interim += t;
      }
      onTranscript(final || interim, !!final);
      if (final) { stop(); return; }
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(stop, 3000);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [stop, onTranscript]);

  return { voiceState, setVoiceState, start, stop };
}

function downloadCSV(columns: string[], rows: Record<string, any>[], title: string) {
  const header = columns.join(",");
  const body = rows.map((r) => columns.map((c) => JSON.stringify(r[c] ?? "")).join(",")).join("\n");
  const blob = new Blob([header + "\n" + body], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url;
  a.download = `${title.replace(/\s+/g, "_")}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function formatValue(v: any): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.substring(0, 10);
  return String(v);
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

function ResultPanel({
  result, index, total, historyId, favoritado, onFavorite,
}: {
  result: QueryResult; index: number; total: number;
  historyId?: number; favoritado?: boolean; onFavorite?: (favoritado: boolean) => void;
}) {
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
          {historyId !== undefined && onFavorite && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onFavorite(!favoritado)}
                  className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium border transition-all ${
                    favoritado
                      ? "bg-amber-50 border-amber-300 text-amber-600 dark:bg-amber-950/30 dark:border-amber-600/40"
                      : "bg-background border-border text-muted-foreground hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200 dark:hover:bg-amber-950/20"
                  }`}
                  data-testid={`button-favorite-result-${index}`}
                >
                  <Star className={`h-3.5 w-3.5 ${favoritado ? "fill-amber-400 text-amber-500" : ""}`} />
                  {favoritado ? "Favoritado" : "Favoritar"}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {favoritado ? "Remover dos favoritos" : "Salvar no Dashboard → Favoritos"}
              </TooltipContent>
            </Tooltip>
          )}
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
  const { toast } = useToast();
  const [question, setQuestion] = useState("");
  const [results, setResults] = useState<QueryResult[]>([]);
  const [currentHistoryId, setCurrentHistoryId] = useState<number | undefined>();
  const [currentFavoritado, setCurrentFavoritado] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const pendingAutoSubmit = useRef(false);

  useEffect(() => { textareaRef.current?.focus(); }, []);

  const aiCalibration = loadAICalibration();

  const { data: history = [] } = useQuery<any[]>({
    queryKey: ["/api/query-ai/history"],
  });

  const saveHistoryMut = useMutation({
    mutationFn: (data: { question: string; result: any }) =>
      apiRequest("POST", "/api/query-ai/history", data).then(r => r.json()),
    onSuccess: (row: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/query-ai/history"] });
      setCurrentHistoryId(row.id);
      setCurrentFavoritado(false);
    },
  });

  const toggleFavoriteMut = useMutation({
    mutationFn: ({ id, favoritado }: { id: number; favoritado: boolean }) =>
      apiRequest("PATCH", `/api/query-ai/history/${id}/favorite`, { favoritado }).then(r => r.json()),
    onSuccess: (row: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/query-ai/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/query-ai/favorites"] });
      setCurrentFavoritado(row.favoritado);
      toast({
        title: row.favoritado ? "⭐ Adicionado aos favoritos!" : "Removido dos favoritos",
        description: row.favoritado ? "Este gráfico aparecerá na aba Favoritos do Dashboard." : undefined,
      });
    },
  });

  const deleteHistoryMut = useMutation({
    mutationFn: (id: number) =>
      apiRequest("DELETE", `/api/query-ai/history/${id}`).then(r => r.json()),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["/api/query-ai/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/query-ai/favorites"] });
      if (currentHistoryId === id) {
        setResults([]);
        setCurrentHistoryId(undefined);
        setCurrentFavoritado(false);
      }
    },
  });

  const mutation = useMutation({
    mutationFn: async (q: string) => {
      const res = await apiRequest("POST", "/api/query-ai", {
        question: q,
        businessContext: aiCalibration.businessContext || undefined,
        temperature: aiCalibration.temperature,
      });
      return res.json() as Promise<{ results: QueryResult[]; error?: string }>;
    },
    onSuccess: (data, q) => {
      if ((data as any).error) return;
      const r = data.results ?? [];
      setResults(r);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
      if (r.length > 0) {
        saveHistoryMut.mutate({ question: q, result: r });
      }
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

  const restoreHistoryItem = (item: any) => {
    const r = Array.isArray(item.result) ? item.result : [];
    setResults(r);
    setQuestion(item.question);
    setCurrentHistoryId(item.id);
    setCurrentFavoritado(item.favoritado ?? false);
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  };

  const errorMsg = (mutation.data as any)?.error ?? (mutation.error as any)?.message;
  const hasResults = results.length > 0;
  const hasHistory = history.length > 0;

  const sortedHistory = [...history].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <TooltipProvider>
      <div className="flex flex-col min-h-full bg-background">

        <div className="flex-1 flex w-full px-6 py-6 gap-6">

          {hasHistory && (
            <aside className="w-72 shrink-0 flex flex-col">
              <div className="rounded-xl border bg-card shadow-sm overflow-hidden flex flex-col flex-1">
                <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30 shrink-0">
                  <History className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">Histórico</span>
                  <span className="ml-auto text-xs text-muted-foreground">{history.length}</span>
                </div>
                <div className="overflow-y-auto flex-1">
                  {sortedHistory.map((item: any) => {
                    const isActive = currentHistoryId === item.id;
                    return (
                      <div
                        key={item.id}
                        className={`group relative cursor-pointer border-b last:border-b-0 px-4 py-3 transition-colors ${
                          isActive ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-muted/40"
                        }`}
                        onClick={() => restoreHistoryItem(item)}
                        data-testid={`history-item-${item.id}`}
                      >
                        <p className="text-sm line-clamp-2 leading-snug pr-10">
                          {item.question}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <Clock className="h-3 w-3 text-muted-foreground/60" />
                          <span className="text-[11px] text-muted-foreground">
                            {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: ptBR })}
                          </span>
                          {item.favoritado && (
                            <Star className="h-3 w-3 fill-amber-400 text-amber-500 ml-auto" />
                          )}
                        </div>
                        <div className="absolute right-2 top-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            className={`p-1 rounded-md transition-colors ${
                              item.favoritado ? "text-amber-500 hover:text-amber-600" : "text-muted-foreground hover:text-amber-500"
                            }`}
                            onClick={(e) => { e.stopPropagation(); toggleFavoriteMut.mutate({ id: item.id, favoritado: !item.favoritado }); }}
                            title={item.favoritado ? "Remover dos favoritos" : "Favoritar"}
                            data-testid={`button-history-favorite-${item.id}`}
                          >
                            <Star className={`h-3.5 w-3.5 ${item.favoritado ? "fill-amber-400" : ""}`} />
                          </button>
                          <button
                            className="p-1 rounded-md text-muted-foreground hover:text-destructive transition-colors"
                            onClick={(e) => { e.stopPropagation(); deleteHistoryMut.mutate(item.id); }}
                            title="Remover do histórico"
                            data-testid={`button-history-delete-${item.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </aside>
          )}

          <div className="flex-1 min-w-0 space-y-5">

            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Sparkles className="h-4 w-4" />
                </div>
                <h1 className="text-xl font-bold">Consulta Inteligente</h1>
              </div>
              <p className="text-sm text-muted-foreground ml-10">Faça perguntas em português — por texto ou por voz — e escolha como visualizar os dados</p>
            </div>

            <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
              {voiceState === "listening" && (
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
                placeholder={voiceState === "listening" ? "Aguardando transcrição de voz..." : "Ex: Como estão os pagamentos e o faturamento por cliente este ano?"}
                className="border-0 shadow-none resize-none text-base focus-visible:ring-0 px-4 pb-3 min-h-[120px]"
                rows={5}
                readOnly={voiceState === "listening"}
                data-testid="input-query"
              />
              <div className="flex items-center gap-2 px-4 pb-4">
                <Button onClick={() => handleSubmit()} disabled={!question.trim() || mutation.isPending} className="gap-2" data-testid="button-submit-query">
                  {mutation.isPending
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Analisando...</>
                    : <><Sparkles className="h-4 w-4" /> Consultar</>}
                </Button>
                <VoiceMicButton voiceState={voiceState} onStart={startVoice} onStop={stopVoice} />
                {(hasResults || question) && (
                  <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground ml-auto"
                    onClick={() => { setQuestion(""); setResults([]); mutation.reset(); stopVoice(); setCurrentHistoryId(undefined); setCurrentFavoritado(false); }}>
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
                  <ResultPanel
                    key={i}
                    result={r}
                    index={i}
                    total={results.length}
                    historyId={currentHistoryId}
                    favoritado={currentFavoritado}
                    onFavorite={(fav) => {
                      if (currentHistoryId !== undefined) {
                        toggleFavoriteMut.mutate({ id: currentHistoryId, favoritado: fav });
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
