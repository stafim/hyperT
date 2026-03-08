import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, RefreshCw, Copy, CheckCheck, AlertCircle, TrendingUp, DollarSign, Users, ShieldAlert, BarChart3, Lightbulb, FileDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function renderMarkdown(text: string): string {
  return text
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold mt-6 mb-2 text-foreground flex items-center gap-2">$1</h2>')
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mt-4 mb-1 text-foreground">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>')
    .replace(/🔴/g, '<span class="text-red-500">🔴</span>')
    .replace(/🟡/g, '<span class="text-yellow-500">🟡</span>')
    .replace(/🟢/g, '<span class="text-green-500">🟢</span>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-sm leading-relaxed">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 list-decimal text-sm leading-relaxed"><span class="font-medium">$1.</span> $2</li>')
    .replace(/\n{2,}/g, '</p><p class="text-sm leading-relaxed mt-2">')
    .replace(/^(?!<[hlp]|<li)(.+)$/gm, '<p class="text-sm leading-relaxed">$1</p>');
}

const sectionIcons: Record<string, React.ReactNode> = {
  "1": <DollarSign className="h-4 w-4 text-green-500" />,
  "2": <TrendingUp className="h-4 w-4 text-blue-500" />,
  "3": <BarChart3 className="h-4 w-4 text-purple-500" />,
  "4": <ShieldAlert className="h-4 w-4 text-orange-500" />,
  "5": <Users className="h-4 w-4 text-cyan-500" />,
  "6": <BarChart3 className="h-4 w-4 text-indigo-500" />,
  "7": <AlertCircle className="h-4 w-4 text-red-500" />,
  "8": <Lightbulb className="h-4 w-4 text-yellow-500" />,
};

export default function AnaliseIA() {
  const { toast } = useToast();
  const [analysis, setAnalysis] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const generateAnalysis = useCallback(async () => {
    if (isLoading) {
      abortRef.current?.abort();
      setIsLoading(false);
      return;
    }

    setAnalysis("");
    setIsLoading(true);
    setGeneratedAt(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/ai/analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error("Erro ao conectar com a IA");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("Sem resposta");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.done) {
              setGeneratedAt(new Date());
            } else if (event.error) {
              throw new Error(event.error);
            } else if (event.content) {
              setAnalysis(prev => prev + event.content);
            }
          } catch (e) {
            if (!(e instanceof SyntaxError)) throw e;
          }
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        toast({ title: "Erro na análise", description: err.message, variant: "destructive" });
      }
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, toast]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(analysis);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const exportToPDF = () => {
    const dateStr = generatedAt
      ? generatedAt.toLocaleDateString("pt-BR") + " às " + generatedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      : new Date().toLocaleDateString("pt-BR");

    const htmlContent = renderMarkdown(analysis);

    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) {
      toast({ title: "Bloqueio de pop-up", description: "Permita pop-ups para exportar o PDF.", variant: "destructive" });
      return;
    }

    win.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Análise IA — Hypertrade</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 13px;
      line-height: 1.6;
      color: #1a1a1a;
      background: #fff;
      padding: 32px 40px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #083F62;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .header-title { font-size: 22px; font-weight: 700; color: #083F62; }
    .header-sub { font-size: 11px; color: #666; margin-top: 4px; }
    .header-badge {
      background: #f0f7ff;
      border: 1px solid #2276BB;
      color: #2276BB;
      border-radius: 6px;
      padding: 4px 12px;
      font-size: 11px;
      white-space: nowrap;
    }
    h2 {
      font-size: 14px;
      font-weight: 700;
      color: #083F62;
      background: #f0f7ff;
      border-left: 4px solid #2276BB;
      padding: 8px 12px;
      margin: 20px 0 10px;
      border-radius: 0 4px 4px 0;
      page-break-after: avoid;
    }
    h3 {
      font-size: 13px;
      font-weight: 600;
      color: #1a1a1a;
      margin: 12px 0 6px;
    }
    p { margin: 6px 0; font-size: 12.5px; }
    li { margin: 3px 0 3px 20px; font-size: 12.5px; }
    strong { font-weight: 600; }
    ul, ol { padding-left: 4px; }
    .footer {
      margin-top: 40px;
      padding-top: 12px;
      border-top: 1px solid #e0e0e0;
      font-size: 10px;
      color: #999;
      display: flex;
      justify-content: space-between;
    }
    @media print {
      body { padding: 20px 28px; }
      h2 { page-break-after: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="header-title">✦ Análise Inteligente com IA</div>
      <div class="header-sub">Hypertrade — ERP de Exportação de Papel Kraft</div>
    </div>
    <div class="header-badge">Gerado em ${dateStr}</div>
  </div>
  ${htmlContent}
  <div class="footer">
    <span>Hypertrade — ERP Logístico de Exportação</span>
    <span>Documento gerado automaticamente por IA em ${dateStr}</span>
  </div>
  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 300);
    };
  <\/script>
</body>
</html>`);
    win.document.close();
  };

  const sections = analysis.split(/(?=## \d+\.)/).filter(Boolean);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-yellow-500" />
            Análise Inteligente com IA
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            A IA analisa todos os seus dados operacionais e financeiros para gerar projeções e recomendações estratégicas.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {analysis && !isLoading && (
            <>
              <Button variant="outline" onClick={copyToClipboard} size="sm">
                {copied ? <CheckCheck className="h-4 w-4 mr-2 text-green-500" /> : <Copy className="h-4 w-4 mr-2" />}
                {copied ? "Copiado!" : "Copiar"}
              </Button>
              <Button variant="outline" onClick={exportToPDF} size="sm">
                <FileDown className="h-4 w-4 mr-2" />
                Exportar PDF
              </Button>
            </>
          )}
          <Button
            onClick={generateAnalysis}
            disabled={false}
            className={isLoading ? "bg-red-600 hover:bg-red-700" : ""}
          >
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Analisando... (clique para parar)
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                {analysis ? "Regenerar Análise" : "Gerar Análise com IA"}
              </>
            )}
          </Button>
        </div>
      </div>

      {!analysis && !isLoading && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="rounded-full bg-yellow-100 dark:bg-yellow-900/30 p-6">
              <Sparkles className="h-12 w-12 text-yellow-500" />
            </div>
            <div className="text-center max-w-md">
              <h3 className="text-lg font-semibold mb-2">Análise Financeira com Inteligência Artificial</h3>
              <p className="text-muted-foreground text-sm mb-1">A IA vai analisar todos os dados do seu sistema e gerar:</p>
              <ul className="text-sm text-muted-foreground space-y-1 text-left mt-3">
                <li className="flex items-center gap-2"><DollarSign className="h-3.5 w-3.5 text-green-500 shrink-0" /> Situação financeira atual com diagnóstico</li>
                <li className="flex items-center gap-2"><TrendingUp className="h-3.5 w-3.5 text-blue-500 shrink-0" /> Projeção de caixa para os próximos 3 meses</li>
                <li className="flex items-center gap-2"><BarChart3 className="h-3.5 w-3.5 text-purple-500 shrink-0" /> Tendência de faturamento e sazonalidade</li>
                <li className="flex items-center gap-2"><ShieldAlert className="h-3.5 w-3.5 text-orange-500 shrink-0" /> Análise de exposição cambial por país</li>
                <li className="flex items-center gap-2"><Users className="h-3.5 w-3.5 text-cyan-500 shrink-0" /> Performance e risco de concentração de clientes</li>
                <li className="flex items-center gap-2"><AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" /> Alertas e riscos identificados</li>
                <li className="flex items-center gap-2"><Lightbulb className="h-3.5 w-3.5 text-yellow-500 shrink-0" /> Recomendações estratégicas priorizadas</li>
              </ul>
            </div>
            <Button onClick={generateAnalysis} size="lg" className="mt-2">
              <Sparkles className="h-5 w-5 mr-2" />
              Iniciar Análise
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading && analysis === "" && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground text-sm">Carregando dados do sistema e consultando a IA...</p>
            <p className="text-xs text-muted-foreground">Isso pode levar alguns segundos</p>
          </CardContent>
        </Card>
      )}

      {(analysis || isLoading) && analysis && (
        <>
          {generatedAt && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                <Sparkles className="h-3 w-3 mr-1 text-yellow-500" />
                Gerado em {generatedAt.toLocaleDateString("pt-BR")} às {generatedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </Badge>
              {isLoading && <Badge variant="outline" className="text-xs animate-pulse">Gerando...</Badge>}
            </div>
          )}

          {sections.length > 1 ? (
            <div className="grid grid-cols-1 gap-4">
              {sections.map((section, idx) => {
                const numMatch = section.match(/## (\d+)\./);
                const num = numMatch?.[1] ?? String(idx + 1);
                const titleMatch = section.match(/## \d+\. (.+)/);
                const title = titleMatch?.[1]?.trim() ?? `Seção ${idx + 1}`;
                const body = section.replace(/^## .+$/m, "").trim();

                return (
                  <Card key={idx}>
                    <CardHeader className="pb-2 pt-4">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        {sectionIcons[num] ?? <Sparkles className="h-4 w-4 text-yellow-500" />}
                        {title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div
                        className="prose prose-sm dark:prose-invert max-w-none text-foreground"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }}
                      />
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-4">
                <div
                  className="prose prose-sm dark:prose-invert max-w-none text-foreground"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(analysis) }}
                />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
