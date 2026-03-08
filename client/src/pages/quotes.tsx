import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { RefreshCw, TrendingUp, TrendingDown, Minus, DollarSign, Clock, AlertTriangle, ArrowRight, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface CurrencyQuote {
  code: string;
  name: string;
  country: string;
  countryCode: string;
  rate: number;
  previousRate: number | null;
  inverse: number;
  change24h: number | null;
}

interface QuotesResponse {
  base: string;
  date: string;
  yesterdayDate: string;
  currencies: CurrencyQuote[];
  source: string;
  lastUpdate: string;
  stale?: boolean;
}

function formatRate(value: number, decimals = 4) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function ChangeIndicator({ change }: { change: number | null }) {
  if (change === null) {
    return (
      <div className="flex items-center gap-1 text-muted-foreground">
        <Minus className="h-3 w-3" />
        <span className="text-xs">N/A</span>
      </div>
    );
  }

  if (change === 0) {
    return (
      <div className="flex items-center gap-1 text-muted-foreground">
        <Minus className="h-3 w-3" />
        <span className="text-xs">0,00%</span>
      </div>
    );
  }

  if (change > 0) {
    return (
      <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
        <TrendingUp className="h-3 w-3" />
        <span className="text-xs">+{change.toFixed(2)}%</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
      <TrendingDown className="h-3 w-3" />
      <span className="text-xs">{change.toFixed(2)}%</span>
    </div>
  );
}

export default function Quotes() {
  const { data, isLoading, isRefetching, refetch } = useQuery<QuotesResponse>({
    queryKey: ["/api/quotes"],
    refetchInterval: 5 * 60 * 1000,
  });

  return (
    <div className="p-6 space-y-6" data-testid="page-quotes">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-quotes-title">Cotações</h1>
          <p className="text-muted-foreground text-sm">
            Taxas de câmbio MERCOSUL + México (base USD)
          </p>
        </div>
        <div className="flex items-center gap-3">
          {data && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Atualizado: {new Date(data.lastUpdate).toLocaleString("pt-BR")}</span>
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
            data-testid="button-refresh-quotes"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {data?.stale && (
        <div className="flex items-center gap-2 rounded-md border border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-950 p-3 text-sm text-yellow-800 dark:text-yellow-200">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>Dados podem estar desatualizados. A fonte de cotações esta temporariamente indisponivel.</span>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[140px] rounded-lg" />
          ))}
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.currencies.map((currency) => (
              <Card key={currency.code} data-testid={`card-currency-${currency.code.toLowerCase()}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary text-xs font-bold flex-shrink-0">
                        {currency.countryCode}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold">{currency.code}</span>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {currency.country}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground font-normal">{currency.name}</p>
                      </div>
                    </div>
                    <ChangeIndicator change={currency.change24h} />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">1 USD =</p>
                      <p className="text-2xl font-bold tabular-nums" data-testid={`text-rate-${currency.code.toLowerCase()}`}>
                        {formatRate(currency.rate)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">1 {currency.code} =</p>
                      <p className="text-sm font-medium tabular-nums text-muted-foreground">
                        USD {formatRate(currency.inverse, 6)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                Tabela Completa de Cotações
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Moeda</TableHead>
                    <TableHead>País</TableHead>
                    <TableHead className="text-right">1 USD =</TableHead>
                    <TableHead className="text-right">1 Moeda = USD</TableHead>
                    <TableHead className="text-right">Variação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.currencies.map((currency) => (
                    <TableRow key={currency.code} data-testid={`row-currency-${currency.code.toLowerCase()}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded bg-primary/10 text-primary text-[10px] font-bold flex-shrink-0">
                            {currency.countryCode}
                          </div>
                          <div>
                            <span className="font-medium">{currency.code}</span>
                            <span className="text-xs text-muted-foreground ml-1.5">{currency.name}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{currency.country}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{formatRate(currency.rate)}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{formatRate(currency.inverse, 6)}</TableCell>
                      <TableCell className="text-right">
                        <ChangeIndicator change={currency.change24h} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card data-testid="card-comparison">
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                Comparativo Ontem vs Hoje
                <Badge variant="outline" className="text-[10px] ml-1">
                  {new Date(data.yesterdayDate).toLocaleDateString("pt-BR")} vs {new Date(data.date).toLocaleDateString("pt-BR")}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.currencies.some((c) => c.previousRate !== null) ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Moeda</TableHead>
                      <TableHead className="text-right">Ontem (1 USD)</TableHead>
                      <TableHead className="text-center"></TableHead>
                      <TableHead className="text-right">Hoje (1 USD)</TableHead>
                      <TableHead className="text-right">Diferença</TableHead>
                      <TableHead className="text-right">Variação %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.currencies.map((currency) => {
                      const diff = currency.previousRate && currency.rate
                        ? currency.rate - currency.previousRate
                        : null;
                      const pct = currency.previousRate && currency.rate
                        ? ((currency.rate - currency.previousRate) / currency.previousRate) * 100
                        : null;
                      const direction = diff === null ? "neutral" : diff > 0 ? "up" : diff < 0 ? "down" : "neutral";

                      return (
                        <TableRow key={`cmp-${currency.code}`} data-testid={`row-comparison-${currency.code.toLowerCase()}`}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="flex h-6 w-6 items-center justify-center rounded bg-primary/10 text-primary text-[10px] font-bold flex-shrink-0">
                                {currency.countryCode}
                              </div>
                              <span className="font-medium">{currency.code}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums">
                            {currency.previousRate !== null
                              ? formatRate(currency.previousRate)
                              : <span className="text-muted-foreground text-xs">N/A</span>}
                          </TableCell>
                          <TableCell className="text-center">
                            {direction === "up" && <ArrowUpRight className="h-4 w-4 text-red-500 dark:text-red-400 mx-auto" />}
                            {direction === "down" && <ArrowDownRight className="h-4 w-4 text-emerald-500 dark:text-emerald-400 mx-auto" />}
                            {direction === "neutral" && <ArrowRight className="h-4 w-4 text-muted-foreground mx-auto" />}
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums font-semibold">
                            {formatRate(currency.rate)}
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums">
                            {diff !== null ? (
                              <span className={
                                diff > 0
                                  ? "text-red-600 dark:text-red-400"
                                  : diff < 0
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-muted-foreground"
                              }>
                                {diff > 0 ? "+" : ""}{formatRate(diff)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs">N/A</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {pct !== null ? (
                              <Badge
                                variant="secondary"
                                className={`font-mono text-xs ${
                                  pct > 0
                                    ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                                    : pct < 0
                                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                                      : ""
                                }`}
                              >
                                {pct > 0 ? "+" : ""}{pct.toFixed(2)}%
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">N/A</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex items-center justify-center h-[100px] text-muted-foreground text-sm">
                  Dados de comparação ainda não disponíveis. Aguarde a próxima atualização.
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-3">
                Moeda subiu = USD ficou mais forte (compra mais unidades). Moeda caiu = USD enfraqueceu.
                <span className="ml-1 text-emerald-600 dark:text-emerald-400">Verde</span> = moeda local se fortaleceu.
                <span className="ml-1 text-red-600 dark:text-red-400">Vermelho</span> = moeda local se desvalorizou.
              </p>
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground text-center">
            Fonte: {data.source} — Data de referência: {new Date(data.date).toLocaleDateString("pt-BR")}
          </p>
        </>
      ) : (
        <Card>
          <CardContent className="flex items-center justify-center h-[200px]">
            <p className="text-muted-foreground">Não foi possível carregar as cotações.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
