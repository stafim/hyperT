import { useEffect, useState, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  ZoomControl,
  Marker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Search, Ship, Navigation, Wind, Anchor, RotateCcw, Info, MapPin, Loader2, ChevronRight } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

// Fix Leaflet default marker icons in webpack/vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const vesselIcon = L.divIcon({
  className: "",
  html: `<div style="
    width:32px;height:32px;background:#3b82f6;border:3px solid white;
    border-radius:50% 50% 50% 0;transform:rotate(-45deg);
    box-shadow:0 2px 8px rgba(0,0,0,0.4)">
  </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -36],
});

const fleetIcon = L.divIcon({
  className: "",
  html: `<div style="
    width:32px;height:32px;background:#10b981;border:3px solid white;
    border-radius:50% 50% 50% 0;transform:rotate(-45deg);
    box-shadow:0 2px 8px rgba(0,0,0,0.4)">
  </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -36],
});

function FlyTo({ lat, lng, zoom = 8 }: { lat: number; lng: number; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], zoom, { duration: 1.5 });
  }, [lat, lng, zoom, map]);
  return null;
}

function speedBadge(speed: number | null | undefined) {
  if (speed == null) return <Badge variant="secondary">—</Badge>;
  const v = Number(speed);
  if (v < 1) return <Badge className="bg-slate-500 text-white">Parado</Badge>;
  if (v < 8) return <Badge className="bg-amber-500 text-white">{v.toFixed(1)} kn</Badge>;
  return <Badge className="bg-emerald-600 text-white">{v.toFixed(1)} kn</Badge>;
}

function navStatus(code: number | null | undefined) {
  const map: Record<number, string> = {
    0: "Em navegação", 1: "Fundeado", 2: "Não controlado",
    3: "Manobra restrita", 4: "Calado restrito", 5: "Atracado",
    6: "Encalhado", 7: "Pescando", 8: "Velando", 15: "Indefinido",
  };
  return map[code as number] ?? "—";
}

function vesselTypeLabel(t: number | null | undefined) {
  if (t == null) return "—";
  if (t >= 70 && t < 80) return "Graneleiro";
  if (t >= 80 && t < 90) return "Tanker";
  if (t >= 60 && t < 70) return "Passageiros";
  if (t >= 30 && t < 40) return "Pescador";
  if (t >= 40 && t < 50) return "Alta velocidade";
  return `Tipo ${t}`;
}

interface VesselData {
  mmsi?: number;
  imo?: string;
  name?: string;
  lat?: number;
  lng?: number;
  speed?: number;
  heading?: number;
  nav_status?: number;
  vessel_type?: number;
  vessel_type_label?: string;
  flag?: string;
  length?: number;
  width?: number;
  draught?: number;
  destination?: string;
  eta?: string;
  timestamp?: string;
  last_port?: string;
  last_port_country?: string;
  next_port?: string;
  next_port_eta?: string;
  wind_knots?: number;
  wind_direction?: string;
  temperature?: number;
  avg_sog?: number;
  gt?: number;
  dwt?: number;
  built?: number;
}

function extractVessel(data: any): VesselData | null {
  const d = data?.data ?? data;
  if (!d) return null;
  const v = Array.isArray(d) ? d[0] : d;
  if (!v) return null;
  return {
    mmsi: v.mmsi,
    imo: v.imo ? String(v.imo) : undefined,
    name: v.name ?? v.vessel_name,
    lat: parseFloat(v.lat ?? v.latitude),
    lng: parseFloat(v.lng ?? v.lon ?? v.longitude),
    speed: v.speed != null ? parseFloat(v.speed) : undefined,
    heading: v.course ?? (v.heading != null ? parseFloat(v.heading) : undefined),
    nav_status: v.nav_status,
    vessel_type: v.vtype ?? v.vessel_type,
    vessel_type_label: v.vessel_type ?? undefined,
    flag: v.flag,
    length: v.size_a != null ? parseFloat(v.size_a) + parseFloat(v.size_b ?? 0) : undefined,
    width: v.size_c != null ? parseFloat(v.size_c) + parseFloat(v.size_d ?? 0) : undefined,
    draught: v.draught != null ? parseFloat(v.draught) : undefined,
    destination: v.destination ? String(v.destination).replace(/&gt;/g, "→") : undefined,
    eta: v.next_port_eta_utc ?? v.eta,
    timestamp: v.received ?? v.timestamp ?? v.time,
    last_port: v.last_port ? `${v.last_port}${v.last_port_country ? `, ${v.last_port_country}` : ""}` : undefined,
    next_port: v.next_port ? `${v.next_port}${v.next_port_country ? `, ${v.next_port_country}` : ""}` : undefined,
    next_port_eta: v.next_port_eta_utc,
    wind_knots: v.wind_knots != null ? parseFloat(v.wind_knots) : undefined,
    wind_direction: v.wind_direction,
    temperature: v.temperature != null ? parseFloat(v.temperature) : undefined,
    avg_sog: v.avg_sog != null ? parseFloat(v.avg_sog) : undefined,
    gt: v.gt,
    dwt: v.dwt,
    built: v.built,
  };
}

function extractSearchResults(data: any): VesselData[] {
  const d = data?.data ?? data;
  if (!d) return [];
  const arr = Array.isArray(d) ? d : [d];
  return arr
    .map((v: any) => ({
      mmsi: v.mmsi,
      imo: v.imo,
      name: v.name ?? v.vessel_name,
      lat: parseFloat(v.lat ?? v.latitude),
      lng: parseFloat(v.lng ?? v.lon ?? v.longitude),
      speed: v.speed != null ? parseFloat(v.speed) : undefined,
      heading: v.heading != null ? parseFloat(v.heading) : undefined,
      nav_status: v.nav_status,
      vessel_type: v.vessel_type,
      flag: v.flag,
      destination: v.destination,
      timestamp: v.timestamp ?? v.time,
    }))
    .filter((v: VesselData) => !isNaN(v.lat!) && !isNaN(v.lng!));
}

function extractTrack(data: any): [number, number][] {
  const d = data?.data ?? data;
  if (!d) return [];
  const arr = Array.isArray(d) ? d : [d];
  return arr
    .map((p: any) => [parseFloat(p.lat ?? p.latitude), parseFloat(p.lng ?? p.lon ?? p.longitude)] as [number, number])
    .filter(([lat, lng]: [number, number]) => !isNaN(lat) && !isNaN(lng));
}

function VesselCard({ v, onTrack, onSelect, selected }: {
  v: VesselData; onTrack: (v: VesselData) => void;
  onSelect: (v: VesselData) => void; selected?: boolean;
}) {
  return (
    <div
      className={cn(
        "border rounded-lg p-3 cursor-pointer hover:bg-accent transition-colors",
        selected && "border-blue-500 bg-blue-50 dark:bg-blue-950"
      )}
      onClick={() => onSelect(v)}
      data-testid={`vessel-card-${v.mmsi ?? v.imo}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{v.name ?? "Navio sem nome"}</p>
          <p className="text-xs text-muted-foreground">
            MMSI: {v.mmsi ?? "—"} {v.imo ? `· IMO: ${v.imo}` : ""}
          </p>
          {v.flag && <p className="text-xs text-muted-foreground">Bandeira: {v.flag}</p>}
        </div>
        {speedBadge(v.speed)}
      </div>
      <div className="flex items-center gap-2 mt-2">
        <span className="text-xs text-muted-foreground">{navStatus(v.nav_status)}</span>
        {v.destination && (
          <>
            <span className="text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground truncate">→ {v.destination}</span>
          </>
        )}
      </div>
      <div className="flex gap-2 mt-2">
        <Button
          size="sm" variant="outline" className="h-7 text-xs flex-1"
          onClick={(e) => { e.stopPropagation(); onTrack(v); }}
          data-testid={`btn-track-${v.mmsi ?? v.imo}`}
        >
          <Navigation className="h-3 w-3 mr-1" /> Rastro
        </Button>
        <Button
          size="sm" variant="default" className="h-7 text-xs flex-1"
          onClick={(e) => { e.stopPropagation(); onSelect(v); }}
          data-testid={`btn-show-${v.mmsi ?? v.imo}`}
        >
          <MapPin className="h-3 w-3 mr-1" /> Ver no Mapa
        </Button>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === "" || value === "—") return null;
  return (
    <div className="flex justify-between text-sm py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right max-w-[60%] break-words">{String(value)}</span>
    </div>
  );
}

export default function Maps() {
  const [tab, setTab] = useState("busca");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const initialMmsi = new URLSearchParams(window.location.search).get("mmsi") ?? "";
  const [mmsiInput, setMmsiInput] = useState(initialMmsi);
  const [directMmsi, setDirectMmsi] = useState(initialMmsi);

  useEffect(() => {
    document.title = "Mapa de Navios — Hypertrade";
  }, []);

  const [selectedVessel, setSelectedVessel] = useState<VesselData | null>(null);
  const [trackVessel, setTrackVessel] = useState<VesselData | null>(null);
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);

  // Search by name
  const searchQuery_ = useQuery({
    queryKey: [`/api/shiptracking/search?name=${encodeURIComponent(searchQuery)}`],
    enabled: !!searchQuery,
    staleTime: 30_000,
  });

  // Direct lookup by MMSI/IMO
  const directQuery = useQuery({
    queryKey: [`/api/shiptracking/vessel?mmsi=${encodeURIComponent(directMmsi)}`],
    enabled: !!directMmsi,
    staleTime: 30_000,
  });

  // Fleet (orders with MMSI)
  const fleetQuery = useQuery({
    queryKey: ["/api/shiptracking/fleet"],
    enabled: tab === "frota",
    staleTime: 60_000,
    refetchInterval: tab === "frota" ? 120_000 : false,
  });

  // Historical track
  const trackMmsi = trackVessel?.mmsi;
  const trackImo = trackVessel?.imo;
  const trackUrl = trackMmsi
    ? `/api/shiptracking/track?mmsi=${trackMmsi}`
    : trackImo
    ? `/api/shiptracking/track?imo=${trackImo}`
    : "";
  const trackQuery = useQuery({
    queryKey: [trackUrl],
    enabled: !!trackUrl,
    staleTime: 60_000,
  });

  const searchResults: VesselData[] = searchQuery_.data
    ? extractSearchResults(searchQuery_.data)
    : [];

  const directVessel: VesselData | null = directQuery.data
    ? extractVessel(directQuery.data)
    : null;

  const allSearchVessels: VesselData[] = [
    ...(directVessel ? [directVessel] : []),
    ...searchResults,
  ];

  const fleetVessels: { order: any; vessel: VesselData }[] = (fleetQuery.data as any)?.fleet
    ? (fleetQuery.data as any).fleet
        .map((item: any) => {
          const v = extractVessel(item.tracking);
          return v ? { order: item.order, vessel: v } : null;
        })
        .filter(Boolean)
    : [];

  const trackPoints: [number, number][] = trackQuery.data
    ? extractTrack(trackQuery.data)
    : [];

  const handleSelectVessel = useCallback((v: VesselData) => {
    setSelectedVessel(v);
    if (v.lat != null && v.lng != null && !isNaN(v.lat) && !isNaN(v.lng)) {
      setFlyTarget({ lat: v.lat, lng: v.lng, zoom: 8 });
    }
  }, []);

  const handleSearchSubmit = () => {
    const val = searchInput.trim();
    if (!val) return;
    const isNumeric = /^\d+$/.test(val);
    if (isNumeric && val.length >= 7) {
      setDirectMmsi(val);
      setSearchQuery("");
    } else {
      setSearchQuery(val);
      setDirectMmsi("");
    }
  };

  const handleMmsiSubmit = () => {
    const val = mmsiInput.trim();
    if (!val) return;
    setDirectMmsi(val);
    setSearchQuery("");
  };

  const isSearchLoading = searchQuery_.isFetching || directQuery.isFetching;

  const displayVessels = tab === "frota"
    ? fleetVessels.map((f) => f.vessel)
    : allSearchVessels;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left Panel */}
      <div className="w-80 flex-shrink-0 flex flex-col border-r bg-background overflow-hidden">
        <div className="px-4 pt-5 pb-3 shrink-0">
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Ship className="h-5 w-5 text-blue-500" /> Rastreamento de Navios
          </h1>
          <p className="text-muted-foreground text-xs mt-1">Powered by MyShipTracking</p>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="flex flex-col flex-1 min-h-0">
          <TabsList className="mx-4 mb-2 shrink-0">
            <TabsTrigger value="busca" className="flex-1" data-testid="tab-busca">Buscar</TabsTrigger>
            <TabsTrigger value="frota" className="flex-1" data-testid="tab-frota">Minha Frota</TabsTrigger>
          </TabsList>

          <TabsContent value="busca" className="flex-1 flex flex-col overflow-hidden m-0 px-4">
            {/* Search by name */}
            <div className="flex gap-2 shrink-0">
              <Input
                placeholder="Nome do navio ou MMSI..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearchSubmit()}
                data-testid="input-vessel-search"
                className="flex-1"
              />
              <Button size="icon" onClick={handleSearchSubmit} disabled={isSearchLoading} data-testid="btn-search">
                {isSearchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>

            {/* MMSI/IMO direct lookup */}
            <div className="flex gap-2 mt-2 shrink-0">
              <Input
                placeholder="MMSI ou IMO direto..."
                value={mmsiInput}
                onChange={(e) => setMmsiInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleMmsiSubmit()}
                data-testid="input-mmsi"
              />
              <Button size="sm" variant="outline" onClick={handleMmsiSubmit} disabled={isSearchLoading} data-testid="btn-mmsi-lookup">
                <Anchor className="h-3 w-3 mr-1" /> OK
              </Button>
            </div>

            <Separator className="my-3 shrink-0" />

            {/* Results */}
            <div className="flex-1 overflow-y-auto space-y-2 pb-4">
              {isSearchLoading && (
                <div className="flex items-center justify-center py-10 text-muted-foreground text-sm gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Buscando...
                </div>
              )}
              {!isSearchLoading && allSearchVessels.length === 0 && (searchQuery || directMmsi) && (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  Nenhum navio encontrado.<br />Tente outro nome ou MMSI.
                </div>
              )}
              {!isSearchLoading && allSearchVessels.length === 0 && !searchQuery && !directMmsi && (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  <Ship className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  Pesquise por nome, MMSI ou IMO para localizar um navio no mapa.
                </div>
              )}
              {allSearchVessels.map((v, i) => (
                <VesselCard
                  key={v.mmsi ?? v.imo ?? i}
                  v={v}
                  onSelect={handleSelectVessel}
                  onTrack={setTrackVessel}
                  selected={selectedVessel?.mmsi === v.mmsi && selectedVessel?.imo === v.imo}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="frota" className="flex-1 flex flex-col overflow-hidden m-0 px-4">
            <p className="text-xs text-muted-foreground mb-3 shrink-0">
              Navios com MMSI cadastrado nas Ordens de Exportação.
            </p>
            {fleetQuery.isFetching && (
              <div className="flex items-center justify-center py-10 text-muted-foreground text-sm gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando frota...
              </div>
            )}
            {!fleetQuery.isFetching && fleetVessels.length === 0 && (
              <div className="text-center py-10 text-muted-foreground text-sm">
                <Ship className="h-8 w-8 mx-auto mb-2 opacity-30" />
                Nenhuma ordem com MMSI cadastrado.<br />
                Adicione MMSI nas ordens de exportação.
              </div>
            )}
            <div className="flex-1 overflow-y-auto space-y-2 pb-4">
              {fleetVessels.map(({ order, vessel }, i) => (
                <div key={i} className="space-y-1">
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                    {order.invoice}
                  </p>
                  <VesselCard
                    v={vessel}
                    onSelect={handleSelectVessel}
                    onTrack={setTrackVessel}
                    selected={selectedVessel?.mmsi === vessel.mmsi}
                  />
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Map */}
      <div className="flex-1 relative overflow-hidden">
        <MapContainer
          center={[15, -25]}
          zoom={3}
          zoomControl={false}
          style={{ height: "100%", width: "100%" }}
          attributionControl={true}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          <ZoomControl position="bottomright" />

          {flyTarget && <FlyTo lat={flyTarget.lat} lng={flyTarget.lng} zoom={flyTarget.zoom} />}

          {/* Search results markers */}
          {displayVessels
            .filter((v) => v.lat != null && v.lng != null && !isNaN(v.lat!) && !isNaN(v.lng!))
            .map((v, i) => (
              <Marker
                key={v.mmsi ?? v.imo ?? i}
                position={[v.lat!, v.lng!]}
                icon={tab === "frota" ? fleetIcon : vesselIcon}
                eventHandlers={{ click: () => handleSelectVessel(v) }}
              >
                <Popup>
                  <div className="min-w-[180px] text-sm font-sans">
                    <p className="font-bold text-base mb-1">{v.name ?? "Navio"}</p>
                    <p className="text-muted-foreground text-xs mb-2">MMSI: {v.mmsi ?? "—"}</p>
                    <div className="space-y-0.5">
                      <div className="flex justify-between"><span className="text-gray-500">Status</span><span>{navStatus(v.nav_status)}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Velocidade</span><span>{v.speed != null ? `${Number(v.speed).toFixed(1)} kn` : "—"}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Rumo</span><span>{v.heading != null ? `${Number(v.heading).toFixed(0)}°` : "—"}</span></div>
                      {v.destination && <div className="flex justify-between"><span className="text-gray-500">Destino</span><span className="text-right max-w-[100px] break-words">{v.destination}</span></div>}
                      {v.flag && <div className="flex justify-between"><span className="text-gray-500">Bandeira</span><span>{v.flag}</span></div>}
                    </div>
                    <button
                      className="mt-2 w-full text-xs bg-slate-100 hover:bg-slate-200 rounded px-2 py-1 text-left transition-colors"
                      onClick={() => setTrackVessel(v)}
                    >
                      🗺 Ver rastro histórico
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}

          {/* Historical track polyline */}
          {trackPoints.length > 1 && (
            <Polyline positions={trackPoints} color="#3b82f6" weight={3} opacity={0.8} />
          )}
          {trackPoints.length > 0 && (
            <Marker position={trackPoints[trackPoints.length - 1]} icon={vesselIcon}>
              <Popup>Posição mais recente — {trackVessel?.name}</Popup>
            </Marker>
          )}
        </MapContainer>

        {/* Selected vessel detail overlay */}
        {selectedVessel && (
          <div className="absolute top-4 right-4 w-72 z-[1000] shadow-xl rounded-xl overflow-hidden border bg-background">
            <div className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{selectedVessel.name ?? "Navio"}</p>
                <p className="text-blue-200 text-xs">{vesselTypeLabel(selectedVessel.vessel_type)}</p>
              </div>
              <button
                className="text-blue-200 hover:text-white ml-2"
                onClick={() => setSelectedVessel(null)}
                data-testid="btn-close-vessel-detail"
              >✕</button>
            </div>
            <div className="px-4 py-3 space-y-0.5 max-h-64 overflow-y-auto">
              <InfoRow label="MMSI" value={selectedVessel.mmsi} />
              <InfoRow label="IMO" value={selectedVessel.imo} />
              <InfoRow label="Bandeira" value={selectedVessel.flag} />
              <InfoRow label="Tipo" value={selectedVessel.vessel_type_label} />
              <InfoRow label="Construído" value={selectedVessel.built} />
              <InfoRow label="GT / DWT" value={selectedVessel.gt != null ? `${selectedVessel.gt.toLocaleString()} / ${selectedVessel.dwt?.toLocaleString()}` : undefined} />
              <InfoRow label="Status Nav." value={navStatus(selectedVessel.nav_status)} />
              <InfoRow label="Velocidade" value={selectedVessel.speed != null ? `${Number(selectedVessel.speed).toFixed(1)} nós` : undefined} />
              <InfoRow label="Vel. Média" value={selectedVessel.avg_sog != null ? `${Number(selectedVessel.avg_sog).toFixed(1)} nós` : undefined} />
              <InfoRow label="Rumo" value={selectedVessel.heading != null ? `${Number(selectedVessel.heading).toFixed(0)}°` : undefined} />
              <InfoRow label="Calado" value={selectedVessel.draught != null ? `${selectedVessel.draught} m` : undefined} />
              <InfoRow label="Destino" value={selectedVessel.destination} />
              <InfoRow label="Últ. Porto" value={selectedVessel.last_port} />
              <InfoRow label="Próx. Porto" value={selectedVessel.next_port} />
              <InfoRow label="ETA Próx." value={selectedVessel.next_port_eta ? new Date(selectedVessel.next_port_eta).toLocaleString("pt-BR") : undefined} />
              <InfoRow label="Vento" value={selectedVessel.wind_knots != null ? `${selectedVessel.wind_knots} kn ${selectedVessel.wind_direction ?? ""}` : undefined} />
              <InfoRow label="Temperatura" value={selectedVessel.temperature != null ? `${selectedVessel.temperature.toFixed(1)} °C` : undefined} />
              {selectedVessel.lat != null && (
                <InfoRow label="Posição" value={`${Number(selectedVessel.lat).toFixed(4)}°, ${Number(selectedVessel.lng).toFixed(4)}°`} />
              )}
            </div>
            <div className="px-4 pb-3">
              <Button
                variant="outline" size="sm" className="w-full text-xs"
                onClick={() => setTrackVessel(selectedVessel)}
                data-testid="btn-load-track"
              >
                <Navigation className="h-3 w-3 mr-1" />
                {trackQuery.isFetching && trackVessel?.mmsi === selectedVessel.mmsi
                  ? "Carregando rastro..."
                  : "Carregar Rastro Histórico"}
              </Button>
              {trackPoints.length > 0 && trackVessel?.mmsi === selectedVessel.mmsi && (
                <p className="text-xs text-muted-foreground text-center mt-1">
                  {trackPoints.length} pontos carregados
                </p>
              )}
            </div>
          </div>
        )}

        {/* Track status badge */}
        {trackQuery.isFetching && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-[1000] bg-blue-600 text-white text-xs px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" /> Carregando rastro histórico...
          </div>
        )}

        {/* Clear track button */}
        {trackPoints.length > 0 && !trackQuery.isFetching && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-[1000]">
            <Button
              size="sm" variant="secondary"
              className="shadow-lg text-xs"
              onClick={() => setTrackVessel(null)}
              data-testid="btn-clear-track"
            >
              <RotateCcw className="h-3 w-3 mr-1" /> Limpar Rastro ({trackPoints.length} pts)
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
