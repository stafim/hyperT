import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  Legend, ResponsiveContainer,
} from "recharts";
import { BarChart2, TrendingUp, PieChartIcon, Sparkles, TableIcon } from "lucide-react";

export const CHART_COLORS = ["#1E4D7B", "#2276BB", "#3B82F6", "#0EA5E9", "#64748B", "#7FAFD4", "#1D4ED8", "#94A3B8"];

export type ChartKind = "bar" | "line" | "pie" | "kpi" | "table";

export interface ChartSuggestion {
  type: ChartKind;
  label: string;
  reason: string;
}

export interface QueryResult {
  sql: string;
  rows: Record<string, any>[];
  columns: string[];
  chartSuggestions: ChartSuggestion[];
  chartTitle: string;
  xAxisKey: string;
  yAxisKey: string;
  valueLabel: string;
}

export function chartKindIcon(type: ChartKind, cls = "h-4 w-4") {
  if (type === "line") return <TrendingUp className={cls} />;
  if (type === "pie") return <PieChartIcon className={cls} />;
  if (type === "kpi") return <Sparkles className={cls} />;
  if (type === "table") return <TableIcon className={cls} />;
  return <BarChart2 className={cls} />;
}

export function KPICard({ value, label, title }: { value: any; label: string; title: string }) {
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

export function DynamicChart({
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
            {numericRows.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
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
          {numericRows.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
