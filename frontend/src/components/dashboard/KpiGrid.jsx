import { Baby, HeartPulse, Activity, ShieldAlert } from "lucide-react";
import { fmt, fmtDec, tierColor } from "@/lib/tiers";

function KpiCard({ label, value, unit, hint, icon: Icon, accent, testId }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
          <p data-testid={testId} className="mt-2 font-mono text-3xl font-bold leading-none text-foreground">
            {value}
            {unit && <span className="ml-1 text-base font-semibold text-muted-foreground">{unit}</span>}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
        </div>
        <div
          className="grid place-items-center h-10 w-10 rounded-xl shrink-0"
          style={{ backgroundColor: `${accent}1a`, color: accent }}
        >
          <Icon className="h-5 w-5" strokeWidth={2.2} />
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-1" style={{ backgroundColor: accent }} />
    </div>
  );
}

export function KpiGrid({ summary, scopeLabel }) {
  const tmi = summary?.tmi ?? 0;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard
        testId="kpi-tmi-value"
        label={`Taxa de Mortalidade Infantil`}
        value={fmtDec(tmi)}
        unit="/ mil"
        hint={`${scopeLabel} · óbitos < 1 ano por 1.000 nascidos vivos`}
        icon={Activity}
        accent={tierColor(tmi)}
      />
      <KpiCard
        testId="kpi-obitos-value"
        label="Óbitos Infantis (SIM)"
        value={fmt(summary?.obitos)}
        hint="Total de óbitos de menores de 1 ano"
        icon={HeartPulse}
        accent="#D13239"
      />
      <KpiCard
        testId="kpi-nascidos-value"
        label="Nascidos Vivos (SINASC)"
        value={fmt(summary?.nascidos_vivos)}
        hint="Denominador do indicador"
        icon={Baby}
        accent="#808285"
      />
      <KpiCard
        testId="kpi-evitaveis-value"
        label="Óbitos Evitáveis"
        value={fmtDec(summary?.pct_evitaveis)}
        unit="%"
        hint={`${fmt(summary?.obitos_evitaveis)} óbitos por causas evitáveis (SUS)`}
        icon={ShieldAlert}
        accent="#AF1C27"
      />
    </div>
  );
}

export default KpiGrid;
