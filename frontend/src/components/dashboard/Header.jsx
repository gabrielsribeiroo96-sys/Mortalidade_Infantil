import { Activity, Contrast, Minus, Plus, RotateCcw, Quote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useA11y } from "@/context/AccessibilityContext";
import CitationBox from "@/components/dashboard/CitationBox";

export function Header() {
  const { hc, toggleHc, incFont, decFont, resetFont } = useA11y();

  return (
    <header className="sticky top-0 z-40 bg-card border-b border-border">
      <div className="h-1.5 w-full bg-primary" aria-hidden="true" />
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 py-3 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-3 mr-auto">
          <div className="grid place-items-center h-11 w-11 rounded-md bg-primary text-primary-foreground">
            <Activity className="h-6 w-6" strokeWidth={2.4} />
          </div>
          <div className="leading-tight">
            <div className="flex items-center gap-2">
              <span className="font-heading text-xs font-extrabold tracking-[0.18em] text-primary uppercase">
                UNIVESP
              </span>
              <span className="text-[10px] text-muted-foreground border-l border-border pl-2">
                Projeto Integrador · Grupo 15
              </span>
            </div>
            <h1 className="font-heading text-lg sm:text-xl font-extrabold tracking-tight text-foreground">
              Observatório de Mortalidade Infantil
            </h1>
            <p className="text-xs text-muted-foreground">
              Plataforma acadêmica de apoio à pesquisa em saúde · dados SIM / SINASC
            </p>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-1.5" aria-hidden="true">
          {["DATASUS", "SIM", "SINASC", "IBGE"].map((s) => (
            <span
              key={s}
              className="font-mono text-[10px] font-semibold px-2 py-1 rounded-md bg-secondary text-secondary-foreground border border-border"
            >
              {s}
            </span>
          ))}
        </div>

        {/* Barra de acessibilidade */}
        <div
          role="group"
          aria-label="Ferramentas de acessibilidade"
          className="flex items-center gap-2"
        >
          <div
            data-testid="accessibility-font-size-group"
            className="flex items-center rounded-full border border-border bg-card overflow-hidden"
          >
            <button
              data-testid="accessibility-font-decrease"
              onClick={decFont}
              aria-label="Diminuir tamanho da fonte"
              className="px-2.5 py-1.5 hover:bg-accent transition-colors"
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              data-testid="accessibility-font-reset"
              onClick={resetFont}
              aria-label="Restaurar tamanho padrão da fonte"
              className="px-2 py-1.5 text-xs font-bold hover:bg-accent transition-colors border-x border-border"
            >
              A
            </button>
            <button
              data-testid="accessibility-font-increase"
              onClick={incFont}
              aria-label="Aumentar tamanho da fonte"
              className="px-2.5 py-1.5 hover:bg-accent transition-colors"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <Button
            data-testid="accessibility-contrast-toggle"
            variant={hc ? "default" : "outline"}
            size="sm"
            onClick={toggleHc}
            aria-pressed={hc}
            aria-label="Alternar modo de alto contraste"
            className="rounded-full gap-2"
          >
            <Contrast className="h-4 w-4" />
            <span className="hidden sm:inline">Alto contraste</span>
          </Button>

          <Dialog>
            <DialogTrigger asChild>
              <Button
                data-testid="cite-platform-button"
                variant="outline"
                size="sm"
                className="rounded-full gap-2"
              >
                <Quote className="h-4 w-4" />
                <span className="hidden sm:inline">Citar</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <CitationBox />
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </header>
  );
}

export default Header;
