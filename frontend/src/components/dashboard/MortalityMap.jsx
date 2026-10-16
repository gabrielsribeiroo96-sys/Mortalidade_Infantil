import { useEffect, useState, useMemo } from "react";
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Tooltip as LTooltip, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { ArrowLeft } from "lucide-react";
import { TIERS, tierColor, fmt, fmtDec } from "@/lib/tiers";
import { useA11y } from "@/context/AccessibilityContext";

function MapController({ selectedUf, geo }) {
  const map = useMap();
  useEffect(() => {
    if (selectedUf && geo) {
      const feature = geo.features.find((f) => f.properties.sigla === selectedUf);
      if (feature) {
        const bounds = L.geoJSON(feature).getBounds();
        map.flyToBounds(bounds, { padding: [24, 24], duration: 0.8, maxZoom: 8 });
        return;
      }
    }
    map.flyTo([-14.5, -52], 4, { duration: 0.8 });
  }, [selectedUf, geo, map]);
  return null;
}

export function MortalityMap({ mapData, munData, year, selectedUf, onSelectUf, onResetUf }) {
  const [geo, setGeo] = useState(null);
  const { hc } = useA11y();

  useEffect(() => {
    fetch(`${process.env.PUBLIC_URL}/brazil-states.geojson`)
      .then((r) => r.json())
      .then(setGeo)
      .catch(() => setGeo(null));
  }, []);

  const styleFn = (feature) => {
    const sigla = feature.properties.sigla;
    const d = mapData?.[sigla];
    const isSel = selectedUf === sigla;
    const dimmed = selectedUf && !isSel;
    return {
      fillColor: d ? tierColor(d.tmi) : "#cbd5cd",
      weight: isSel ? 3 : 1,
      color: hc ? "#ffffff" : isSel ? "#111111" : "#ffffff",
      fillOpacity: dimmed ? 0.18 : isSel ? 0.9 : 0.8,
    };
  };

  const onEach = (feature, layer) => {
    const sigla = feature.properties.sigla;
    const d = mapData?.[sigla];
    const nome = feature.properties.name;
    layer.bindTooltip(
      `<div class="map-tooltip"><strong>${nome} (${sigla})</strong><br/>` +
        (d
          ? `TMI: <b>${fmtDec(d.tmi)}</b> / mil<br/>Óbitos: ${fmt(d.obitos)}<br/>Nascidos: ${fmt(d.nascidos_vivos)}`
          : "sem dados") +
        `</div>`,
      { sticky: true }
    );
    layer.on({
      click: () => onSelectUf(selectedUf === sigla ? null : sigla),
      mouseover: (e) => e.target.setStyle({ weight: 3, fillOpacity: 0.95 }),
      mouseout: (e) => e.target.setStyle(styleFn(feature)),
    });
    layer.options.keyboard = true;
  };

  const geoKey = useMemo(() => `${year}-${selectedUf}-${hc}`, [year, selectedUf, hc]);
  const points = useMemo(
    // Maiores primeiro, para que os municípios pequenos fiquem por cima e clicáveis
    () => (selectedUf
      ? (munData || []).filter((m) => m.lat != null && m.lng != null)
        .sort((a, b) => b.nascidos_vivos - a.nascidos_vivos)
      : []),
    [munData, selectedUf]
  );

  return (
    <div className="relative rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <div>
          <h2 className="font-heading text-lg font-bold text-foreground">Mapa da mortalidade infantil</h2>
          <p className="text-xs text-muted-foreground">
            {selectedUf
              ? `Municípios de ${mapData?.[selectedUf]?.uf_name || selectedUf} · ${year} · passe o mouse nos pontos`
              : `TMI por estado · ${year} · clique em um estado para explorar os municípios`}
          </p>
        </div>
        <span className="font-mono text-xs px-2 py-1 rounded-md bg-secondary text-secondary-foreground">
          {year}
        </span>
      </div>

      <div
        data-testid="leaflet-map-container"
        className="relative h-[420px] lg:h-[560px] w-full"
        role="application"
        aria-label={`Mapa do Brasil com a taxa de mortalidade infantil em ${year}. Use as setas para navegar e +/- para zoom.`}
      >
        {selectedUf && (
          <button
            data-testid="map-back-button"
            onClick={onResetUf}
            className="absolute left-3 top-3 z-[1000] inline-flex items-center gap-1.5 rounded-md bg-card border border-border px-3 py-1.5 text-sm font-semibold shadow-md hover:bg-accent transition-colors"
            aria-label="Voltar para o mapa do Brasil"
          >
            <ArrowLeft className="h-4 w-4" /> Ver Brasil
          </button>
        )}
        {geo && (
          <MapContainer
            center={[-14.5, -52]}
            zoom={4}
            minZoom={3}
            maxZoom={10}
            scrollWheelZoom={false}
            style={{ height: "100%", width: "100%" }}
            keyboard
            preferCanvas
          >
            <TileLayer
              attribution='&copy; OpenStreetMap'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <GeoJSON key={geoKey} data={geo} style={styleFn} onEachFeature={onEach} />
            <MapController selectedUf={selectedUf} geo={geo} />
            {points.map((m) => {
              // Área proporcional aos nascidos vivos (estado pode ter centenas de municípios)
              const r = 3 + Math.min(13, Math.sqrt(m.nascidos_vivos) / 12);
              return (
                <CircleMarker
                  key={m.municipality_code}
                  center={[m.lat, m.lng]}
                  radius={r}
                  pathOptions={{
                    color: "#111111",
                    weight: 0.6,
                    fillColor: tierColor(m.tmi),
                    fillOpacity: 0.92,
                  }}
                >
                  <LTooltip direction="top" offset={[0, -4]}>
                    <div className="map-tooltip">
                      <strong>{m.municipality_name}</strong>
                      <br />TMI: <b>{fmtDec(m.tmi)}</b> / mil
                      <br />Óbitos: {fmt(m.obitos)} · Nascidos: {fmt(m.nascidos_vivos)}
                    </div>
                  </LTooltip>
                  <Popup>
                    <div className="map-tooltip">
                      <strong>{m.municipality_name} ({m.uf})</strong>
                      <br />Cód. IBGE: {m.municipality_code}
                      <br />TMI: <b>{fmtDec(m.tmi)}</b> por mil nascidos
                      <br />Óbitos &lt; 1 ano: {fmt(m.obitos)}
                      <br />Nascidos vivos: {fmt(m.nascidos_vivos)}
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        )}
      </div>

      {/* Legenda */}
      <div className="px-5 py-3 border-t border-border">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          Taxa por 1.000 nascidos vivos {selectedUf && "· tamanho do ponto = nº de óbitos"}
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {TIERS.map((t) => (
            <div key={t.label} className="flex items-center gap-1.5">
              <span className="h-3.5 w-3.5 rounded-sm border border-black/10" style={{ backgroundColor: t.color }} />
              <span className="text-xs text-foreground">{t.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default MortalityMap;
