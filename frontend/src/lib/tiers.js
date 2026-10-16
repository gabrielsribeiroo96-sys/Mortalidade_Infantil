// Faixas da Taxa de Mortalidade Infantil (por 1.000 nascidos vivos)
export const TIERS = [
  { max: 10, color: "#059669", label: "Baixa (< 10)" },
  { max: 12, color: "#84CC16", label: "Moderada-baixa (10–12)" },
  { max: 14, color: "#EAB308", label: "Moderada (12–14)" },
  { max: 16, color: "#F97316", label: "Alta (14–16)" },
  { max: Infinity, color: "#DC2626", label: "Crítica (≥ 16)" },
];

export const tierColor = (tmi) => {
  for (const t of TIERS) if (tmi < t.max) return t.color;
  return "#DC2626";
};

export const fmt = (n) => new Intl.NumberFormat("pt-BR").format(n ?? 0);
export const fmtDec = (n) =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n ?? 0);
