import { useMemo, useState, Fragment } from "react";
import {
  ArrowUpDown, Download, ChevronLeft, ChevronRight, ChevronDown, ChevronRight as ChevronR, FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { fmt, fmtDec, tierColor } from "@/lib/tiers";
import { exportUrl, exportDetailedUrl } from "@/lib/api";

const COLUMNS = [
  { key: "municipality_code", label: "Cód. IBGE", sortable: false },
  { key: "municipality_name", label: "Local", sortable: false },
  { key: "uf", label: "UF", sortable: false },
  { key: "year", label: "Ano", num: true, sortable: true },
  { key: "obitos", label: "Óbitos", num: true, sortable: true },
  { key: "nascidos_vivos", label: "Nascidos", num: true, sortable: true },
  { key: "tmi", label: "TMI", num: true, sortable: true },
];

function CauseBreakdown({ row, causeMeta }) {
  const total = row.obitos || 1;
  const items = causeMeta
    .map((c) => ({ label: c.label, value: row.causes?.[c.key] || 0 }))
    .sort((a, b) => b.value - a.value);
  return (
    <div className="px-6 py-4 bg-secondary/40 border-l-2 border-primary">
      <div className="flex flex-wrap gap-x-8 gap-y-1 mb-3 text-xs">
        <span><span className="text-muted-foreground">Nascidos vivos (SINASC): </span><b className="font-mono">{fmt(row.nascidos_vivos)}</b></span>
        <span><span className="text-muted-foreground">Óbitos evitáveis (SUS): </span><b className="font-mono">{fmt(row.obitos_evitaveis)}</b></span>
        <span><span className="text-muted-foreground">TMI: </span><b className="font-mono">{fmtDec(row.tmi)} / mil</b></span>
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        Óbitos por causa (Capítulo da CID-10) · {row.year}
      </p>
      <div className="space-y-1.5">
        {items.map((it) => {
          const pct = (it.value / total) * 100;
          return (
            <div key={it.label} className="grid grid-cols-[1fr_auto] items-center gap-3">
              <div>
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-foreground">{it.label}</span>
                  <span className="font-mono text-muted-foreground">{fmt(it.value)} ({fmtDec(pct)}%)</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-border overflow-hidden">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DataTable({ rows, filters, scopeLabel, causeMeta, allYears, setAllYears }) {
  const [sort, setSort] = useState({ key: "tmi", dir: "desc" });
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState(null);

  const sorted = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      const av = a[sort.key], bv = b[sort.key];
      return sort.dir === "asc" ? av - bv : bv - av;
    });
    return arr;
  }, [rows, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
  const curPage = Math.min(page, totalPages);
  const pageRows = sorted.slice((curPage - 1) * perPage, curPage * perPage);

  const toggleSort = (key) =>
    setSort((s) => ({ key, dir: s.key === key && s.dir === "desc" ? "asc" : "desc" }));

  const rowKey = (r) => `${r.municipality_code}-${r.year}`;

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4 pb-3">
        <div>
          <h2 className="font-heading text-lg font-bold text-foreground">Tabela de indicadores</h2>
          <p className="text-xs text-muted-foreground">
            {scopeLabel} · {sorted.length} {sorted.length === 1 ? "registro" : "registros"} · clique numa linha para ver as causas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" data-testid="export-csv-button" className="gap-2 rounded-full">
            <a href={exportUrl(filters)} download>
              <Download className="h-4 w-4" /> CSV
            </a>
          </Button>
          <Button asChild size="sm" data-testid="export-csv-detailed-button" className="gap-2 rounded-full">
            <a href={exportDetailedUrl(filters)} download>
              <FileSpreadsheet className="h-4 w-4" /> CSV detalhado
            </a>
          </Button>
        </div>
      </div>

      {/* Controle de período */}
      <div className="flex items-center gap-2 px-5 pb-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Período</span>
        <Select value={allYears ? "all" : "one"} onValueChange={(v) => setAllYears(v === "all")}>
          <SelectTrigger className="h-8 w-[220px]" data-testid="table-period-select" aria-label="Período exibido na tabela">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="one">Apenas o ano selecionado ({filters.year})</SelectItem>
            <SelectItem value="all">Todos os anos (2018–2024)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div data-testid="data-table-container" className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-y border-border bg-secondary/60">
              <th className="w-8 px-2 py-2.5" aria-label="Expandir" />
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  className={`px-3 py-2.5 font-semibold text-xs uppercase tracking-wide text-muted-foreground ${c.num ? "text-right" : ""}`}
                >
                  {c.sortable ? (
                    <button
                      onClick={() => toggleSort(c.key)}
                      data-testid={`sort-${c.key}`}
                      className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${c.num ? "flex-row-reverse" : ""}`}
                      aria-label={`Ordenar por ${c.label}`}
                    >
                      <ArrowUpDown className="h-3 w-3" /> {c.label}
                    </button>
                  ) : (
                    c.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length + 1} className="px-4 py-10 text-center text-muted-foreground">
                  Nenhum registro encontrado para os filtros selecionados.
                </td>
              </tr>
            )}
            {pageRows.map((r) => {
              const k = rowKey(r);
              const isOpen = expanded === k;
              return (
                <Fragment key={k}>
                  <tr
                    data-testid={`row-${k}`}
                    onClick={() => setExpanded(isOpen ? null : k)}
                    className={`cursor-pointer transition-colors ${isOpen ? "bg-accent/60" : "hover:bg-accent/40"}`}
                  >
                    <td className="px-2 py-2.5 text-muted-foreground">
                      <button
                        data-testid={`expand-${k}`}
                        aria-label={isOpen ? "Recolher detalhes" : "Expandir detalhes por causa"}
                        aria-expanded={isOpen}
                        onClick={(e) => { e.stopPropagation(); setExpanded(isOpen ? null : k); }}
                      >
                        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronR className="h-4 w-4" />}
                      </button>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{r.municipality_code}</td>
                    <td className="px-3 py-2.5 font-medium text-foreground">{r.municipality_name}</td>
                    <td className="px-3 py-2.5 font-mono text-xs">{r.uf}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{r.year}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{fmt(r.obitos)}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{fmt(r.nascidos_vivos)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <span
                        className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold font-mono border"
                        style={{ color: tierColor(r.tmi), backgroundColor: `${tierColor(r.tmi)}22`, borderColor: `${tierColor(r.tmi)}66` }}
                      >
                        {fmtDec(r.tmi)}
                      </span>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr key={`${k}-detail`} data-testid={`detail-${k}`}>
                      <td colSpan={COLUMNS.length + 1} className="p-0">
                        <CauseBreakdown row={r} causeMeta={causeMeta} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-border">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Por página</span>
          <Select value={String(perPage)} onValueChange={(v) => { setPerPage(Number(v)); setPage(1); }}>
            <SelectTrigger className="h-8 w-[72px]" data-testid="per-page-select" aria-label="Itens por página">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 25, 50].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">Página {curPage} de {totalPages}</span>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={curPage <= 1}
              onClick={() => setPage((p) => p - 1)} aria-label="Página anterior">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={curPage >= totalPages}
              onClick={() => setPage((p) => p + 1)} aria-label="Próxima página">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DataTable;
