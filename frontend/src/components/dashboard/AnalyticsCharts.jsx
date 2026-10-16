import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, Cell,
} from "recharts";
import { TrendingDown, ListTree, Map as MapIcon } from "lucide-react";
import { fmt, fmtDec } from "@/lib/tiers";

const CHART_GRID = "hsl(var(--border))";
const AXIS = "hsl(var(--muted-foreground))";

function Panel({ title, subtitle, icon: Icon, children }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <div className="grid place-items-center h-8 w-8 rounded-lg bg-secondary text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <h3 className="font-heading text-base font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

const REGION_COLORS = {
  Norte: "#AF1C27", Nordeste: "#D13239", "Centro-Oeste": "#ED3B48",
  Sudeste: "#808285", Sul: "#B0B2B5",
};

export function AnalyticsCharts({ trends, causes, regions, scopeLabel, selectedCause }) {
  const causeData = causes.map((c) => ({
    ...c,
    short: c.label.split("(")[0].trim(),
    active: selectedCause && selectedCause !== "ALL" ? c.key === selectedCause : true,
  }));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel title="Evolução da TMI" subtitle={`${scopeLabel} · série histórica`} icon={TrendingDown}>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={trends} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
            <XAxis dataKey="year" stroke={AXIS} fontSize={12} tickLine={false} />
            <YAxis stroke={AXIS} fontSize={12} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
            <Tooltip
              formatter={(v) => [`${fmtDec(v)} / mil`, "TMI"]}
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 13 }}
            />
            <Line type="monotone" dataKey="tmi" stroke="hsl(var(--primary))" strokeWidth={3}
              dot={{ r: 4, fill: "hsl(var(--primary))" }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="Regiões do Brasil" subtitle="Comparativo da TMI por macrorregião" icon={MapIcon}>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={regions} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
            <XAxis dataKey="region" stroke={AXIS} fontSize={11} tickLine={false} interval={0} />
            <YAxis stroke={AXIS} fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip
              formatter={(v) => [`${fmtDec(v)} / mil`, "TMI"]}
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 13 }}
            />
            <Bar dataKey="tmi" radius={[6, 6, 0, 0]}>
              {regions.map((r) => <Cell key={r.region} fill={REGION_COLORS[r.region] || "#1E4A38"} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="Causas dos óbitos (CID-10)" subtitle={`${scopeLabel} · capítulos da CID-10`} icon={ListTree}>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={causeData} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} horizontal={false} />
            <XAxis type="number" stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="short" stroke={AXIS} fontSize={11} width={130} tickLine={false} axisLine={false} />
            <Tooltip
              formatter={(v) => [fmt(v), "Óbitos"]}
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 13 }}
            />
            <Bar dataKey="value" radius={[0, 6, 6, 0]}>
              {causeData.map((c) => (
                <Cell key={c.key} fill={c.active ? "#D13239" : "hsl(var(--border))"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="Nascidos vivos x Óbitos" subtitle={`${scopeLabel} · SINASC vs SIM`} icon={TrendingDown}>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={trends} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
            <XAxis dataKey="year" stroke={AXIS} fontSize={12} tickLine={false} />
            <YAxis stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip
              formatter={(v, n) => [fmt(v), n === "obitos" ? "Óbitos" : "Nascidos vivos"]}
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 13 }}
            />
            <Bar dataKey="nascidos_vivos" fill="#808285" radius={[6, 6, 0, 0]} />
            <Bar dataKey="obitos" fill="#D13239" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>
    </div>
  );
}

export default AnalyticsCharts;
