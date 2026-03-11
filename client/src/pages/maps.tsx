import { useEffect } from "react";
import { MapContainer, TileLayer, ZoomControl } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export default function Maps() {
  useEffect(() => {
    document.title = "Mapa Mundial — Hypertrade";
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-4 shrink-0">
        <h1 className="text-2xl font-bold tracking-tight">Mapa</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Visão geográfica das operações de exportação
        </p>
      </div>

      <div className="flex-1 px-6 pb-6 min-h-0">
        <div className="rounded-xl overflow-hidden border shadow-sm h-full min-h-[500px]">
          <MapContainer
            center={[15, -25]}
            zoom={3}
            zoomControl={false}
            style={{ height: "100%", width: "100%" }}
            attributionControl={true}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            <ZoomControl position="bottomright" />
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
