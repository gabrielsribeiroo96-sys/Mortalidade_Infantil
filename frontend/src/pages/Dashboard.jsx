import { useEffect, useState, useCallback } from "react";
import { Loader2, Info } from "lucide-react";
import Header from "@/components/dashboard/Header";
import FilterBar from "@/components/dashboard/FilterBar";
import KpiGrid from "@/components/dashboard/KpiGrid";
import MortalityMap from "@/components/dashboard/MortalityMap";
import DataTable from "@/components/dashboard/DataTable";
import AnalyticsCharts from "@/components/dashboard/AnalyticsCharts";
import { useA11y } from "@/context/AccessibilityContext";
import {
  getMeta, getSummary, getMap, getRecords, getTrends, getCauses, getRegions,
} from "@/lib/api";

export default function Dashboard() {
  const { announce, announcement } = useA11y();
  const [meta, setMeta] = useState(null);
  const [filters, setFilters] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tableAllYears, setTableAllYears] = useState(false);
  const [tableRows, setTableRows] = useState([]);

  useEffect(() => {
    getMeta().then((m) => {
      setMeta(m);
      const latest = m.years[m.years.length - 1];
      setFilters({ year: latest, uf: null, search: "", cause: "ALL" });
    });
  }, []);

  const load = useCallback(async (f) => {
    setLoading(true);
    const [summary, map, records, trends, causes, regions] = await Promise.all([
      getSummary(f), getMap(f), getRecords(f), getTrends(f), getCauses(f), getRegions(f),
    ]);
    setData({ summary, map, records, trends, causes, regions });
    setLoading(false);
    announce(`Dados atualizados. ${records.length} registros carregados para ${f.uf || "Brasil"} em ${f.year}.`);
  }, [announce]);

  useEffect(() => {
    if (filters) load(filters);
  }, [filters, load]);

  // Linhas da tabela (respeitam a opção "todos os anos", independente do mapa/KPIs)
  useEffect(() => {
    if (!filters) return;
    getRecords({ year: filters.year, uf: filters.uf, search: filters.search, allYears: tableAllYears })
      .then(setTableRows);
  }, [filters, tableAllYears]);

  const scopeLabel = filters?.uf
    ? meta?.states.find((s) => s.uf === filters.uf)?.name || filters.uf
    : "Brasil";

  const selectUf = (uf) => setFilters((f) => ({ ...f, uf, search: "" }));

  if (!meta || !filters) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p>Carregando dados… (o primeiro acesso pode levar até 1 minuto)</p>
        </div>
      </div>
    );
  }

  return (
    <div className="App min-h-screen">
      <a href="#conteudo" className="skip-link">Pular para o conteúdo</a>
      <Header />

      {/* Região de anúncios para leitores de tela */}
      <div aria-live="polite" className="sr-only" data-testid="sr-live-region">{announcement}</div>

      <main id="conteudo" className="mx-auto max-w-[1600px] px-4 sm:px-6 py-6 space-y-6">
        <FilterBar meta={meta} filters={filters} setFilters={setFilters} causes={meta.causes} />

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 shrink-0" />
          <p>
            {meta.source?.source === "datasus"
              ? "Dados oficiais do SIM e SINASC (DATASUS), por município de residência. Óbitos evitáveis: classificação aproximada da Lista Brasileira de Causas Evitáveis."
              : "Dados representativos baseados em SIM/SINASC (DATASUS) para fins de demonstração acadêmica."}
            {" "}Municípios/IBGE e ViaCEP via APIs públicas gratuitas.
            {loading && <span className="ml-2 inline-flex items-center gap-1 text-primary"><Loader2 className="h-3 w-3 animate-spin" /> atualizando…</span>}
          </p>
        </div>

        <KpiGrid summary={data?.summary} scopeLabel={scopeLabel} />

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <div className="xl:col-span-7">
            <MortalityMap
              mapData={data?.map || {}}
              munData={filters.uf ? data?.records || [] : []}
              year={filters.year}
              selectedUf={filters.uf}
              onSelectUf={selectUf}
              onResetUf={() => setFilters((f) => ({ ...f, uf: null, search: "" }))}
            />
          </div>
          <div className="xl:col-span-5">
            <DataTable
              rows={tableRows}
              filters={filters}
              scopeLabel={scopeLabel}
              causeMeta={meta.causes}
              allYears={tableAllYears}
              setAllYears={setTableAllYears}
            />
          </div>
        </div>

        <section aria-label="Análise de dados" className="space-y-4">
          <h2 className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Análise de dados
          </h2>
          <AnalyticsCharts
            trends={data?.trends || []}
            causes={data?.causes || []}
            regions={data?.regions || []}
            scopeLabel={scopeLabel}
            selectedCause={filters.cause}
          />
        </section>

        <footer className="pt-4 pb-8 text-center text-xs text-muted-foreground">
          Observatório de Mortalidade Infantil · Projeto Integrador em Computação II — UNIVESP · Grupo 15 ·
          Fontes: SIM, SINASC (DATASUS), IBGE e ViaCEP
        </footer>
      </main>
    </div>
  );
}
