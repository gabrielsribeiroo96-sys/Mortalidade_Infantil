import { useState } from "react";
import { Search, RotateCcw, MapPin, Loader2 } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { searchCep } from "@/lib/api";
import { toast } from "sonner";

const ALL = "ALL";

export function FilterBar({ meta, filters, setFilters, causes }) {
  const [search, setSearch] = useState("");
  const [cep, setCep] = useState("");
  const [cepLoading, setCepLoading] = useState(false);

  const update = (patch) => setFilters((f) => ({ ...f, ...patch }));

  const submitSearch = (e) => {
    e.preventDefault();
    update({ search: search.trim() });
  };

  const handleCep = async (e) => {
    e.preventDefault();
    const clean = cep.replace(/\D/g, "");
    if (clean.length !== 8) {
      toast.error("Digite um CEP válido com 8 dígitos.");
      return;
    }
    setCepLoading(true);
    try {
      const res = await searchCep(clean);
      const st = meta.states.find((s) => s.uf === res.uf);
      if (st) {
        update({ uf: st.uf, search: res.localidade || "" });
        setSearch(res.localidade || "");
        toast.success(`CEP localizado: ${res.localidade} / ${res.uf} (ViaCEP + IBGE)`);
      } else {
        toast.error("Não foi possível mapear a UF do CEP.");
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Falha ao consultar o ViaCEP.");
    } finally {
      setCepLoading(false);
    }
  };

  const reset = () => {
    setFilters((f) => ({ year: f.year, uf: null, search: "", cause: ALL }));
    setSearch("");
    setCep("");
  };

  return (
    <section
      aria-label="Filtros de consulta"
      className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm"
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Ano */}
        <div className="space-y-1.5">
          <Label htmlFor="year-filter-select" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Ano de referência
          </Label>
          <Select value={String(filters.year)} onValueChange={(v) => update({ year: Number(v) })}>
            <SelectTrigger id="year-filter-select" data-testid="year-filter-select" aria-label="Selecionar ano">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {meta.years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}{meta.source?.anos_preliminares?.includes(y) ? " (preliminar)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* UF */}
        <div className="space-y-1.5">
          <Label htmlFor="uf-filter-select" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Estado (UF)
          </Label>
          <Select
            value={filters.uf || ALL}
            onValueChange={(v) => update({ uf: v === ALL ? null : v, search: "" })}
          >
            <SelectTrigger id="uf-filter-select" data-testid="uf-filter-select" aria-label="Selecionar estado">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value={ALL}>Brasil (todos os estados)</SelectItem>
              {meta.states.map((s) => (
                <SelectItem key={s.code} value={s.uf}>{s.name} ({s.uf})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Busca de município */}
        <form onSubmit={submitSearch} className="space-y-1.5">
          <Label htmlFor="municipality-search-input" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Buscar município
          </Label>
          <div className="flex gap-2">
            <Input
              id="municipality-search-input"
              data-testid="municipality-search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={filters.uf ? "Nome do município..." : "Selecione uma UF primeiro"}
              aria-label="Buscar município por nome"
            />
            <Button type="submit" size="icon" variant="secondary" aria-label="Aplicar busca" className="shrink-0">
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </form>

        {/* Cause filter */}
        <div className="space-y-1.5">
          <Label htmlFor="cause-filter-select" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Causa (Capítulo CID-10)
          </Label>
          <Select value={filters.cause || ALL} onValueChange={(v) => update({ cause: v })}>
            <SelectTrigger id="cause-filter-select" data-testid="cause-filter-select" aria-label="Selecionar causa CID-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value={ALL}>Todas as causas</SelectItem>
              {causes.map((c) => (
                <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        {/* Busca por CEP (ViaCEP) */}
        <form onSubmit={handleCep} className="flex items-end gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="cep-input" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> Buscar por CEP (ViaCEP)
            </Label>
            <Input
              id="cep-input"
              data-testid="cep-input"
              value={cep}
              onChange={(e) => setCep(e.target.value)}
              placeholder="00000-000"
              className="w-40 font-mono"
              aria-label="Buscar localidade por CEP"
            />
          </div>
          <Button type="submit" variant="secondary" disabled={cepLoading} data-testid="cep-search-button">
            {cepLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Localizar"}
          </Button>
        </form>

        <Button
          data-testid="reset-filters-button"
          variant="ghost"
          onClick={reset}
          className="ml-auto gap-2 text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="h-4 w-4" /> Limpar filtros
        </Button>
      </div>
    </section>
  );
}

export default FilterBar;
