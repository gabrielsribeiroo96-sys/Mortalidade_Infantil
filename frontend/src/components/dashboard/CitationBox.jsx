import { useState } from "react";
import { Copy, Check, Quote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

const HOJE = new Date();
const ACCESS = HOJE.toLocaleDateString("pt-BR");
const ANO = HOJE.getFullYear();
const URL = typeof window !== "undefined" ? window.location.origin : "";

const ABNT =
  `OBSERVATÓRIO DE MORTALIDADE INFANTIL. Plataforma web para análise e apoio à pesquisa acadêmica em saúde. ${ANO}. ` +
  `Dados provenientes do Sistema de Informações sobre Mortalidade (SIM) e do Sistema de Informações sobre Nascidos Vivos (SINASC) — DATASUS/Ministério da Saúde. ` +
  `Disponível em: ${URL}. Acesso em: ${ACCESS}.`;

const VANCOUVER =
  `Observatório de Mortalidade Infantil [Internet]. Plataforma web para análise e apoio à pesquisa acadêmica em saúde. ${ANO} ` +
  `[citado ${ACCESS}]. Fontes: SIM e SINASC (DATASUS). Disponível em: ${URL}`;

export function CitationBox() {
  const [copied, setCopied] = useState(null);

  const copy = async (text, kind) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      toast.success("Citação copiada para a área de transferência.");
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Quote className="h-5 w-5 text-primary" />
        <h2 className="font-heading text-xl font-bold text-foreground">Como citar esta plataforma</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Gere a referência para seu TCC, dissertação ou artigo científico.
      </p>

      <Tabs defaultValue="abnt">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="abnt" data-testid="citation-tab-abnt">ABNT</TabsTrigger>
          <TabsTrigger value="vancouver" data-testid="citation-tab-vancouver">Vancouver</TabsTrigger>
        </TabsList>

        <TabsContent value="abnt">
          <div className="rounded-xl border border-border bg-secondary/50 p-4 text-sm leading-relaxed text-foreground">
            {ABNT}
          </div>
          <Button data-testid="citation-copy-button" onClick={() => copy(ABNT, "abnt")} className="mt-3 gap-2 rounded-full">
            {copied === "abnt" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            Copiar referência ABNT
          </Button>
        </TabsContent>

        <TabsContent value="vancouver">
          <div className="rounded-xl border border-border bg-secondary/50 p-4 text-sm leading-relaxed text-foreground">
            {VANCOUVER}
          </div>
          <Button onClick={() => copy(VANCOUVER, "vancouver")} className="mt-3 gap-2 rounded-full">
            {copied === "vancouver" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            Copiar referência Vancouver
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default CitationBox;
