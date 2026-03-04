"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { GeoMapProps } from "./schema";
import { GeoMapEngine } from "./geo-map-engine";

const DEFAULT_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

export function GeoMap({
  id,
  title,
  description,
  markers,
  routes,
  clustering,
  className,
  style,
  viewport,
  showZoomControl = true,
  popupClassName,
  tooltipClassName,
  onMarkerClick,
  onRouteClick,
}: GeoMapProps) {
  const [mapReady, setMapReady] = useState(false);
  const mapAriaLabel = [title, description].filter(Boolean).join(". ") || "Mapa";

  return (
    <div
      data-slot="geo-map"
      data-tool-ui-id={id}
      className={cn(
        "rounded-lg border border-border bg-card overflow-hidden shadow-sm",
        className,
      )}
      style={style}
    >
      {(title || description) && (
        <div className="p-3 pb-0">
          {title && (
            <h3 className="text-sm font-medium text-foreground">{title}</h3>
          )}
          {description && (
            <p className="text-muted-foreground text-xs mt-0.5">{description}</p>
          )}
        </div>
      )}
      <div
        className="relative h-[280px] w-full p-3 pt-2 nodrag"
        title="Arrastra aquí para mover el mapa"
      >
        {!mapReady && (
          <div
            className="absolute inset-0 flex items-center justify-center rounded-md bg-muted/30 text-sm text-muted-foreground"
            aria-hidden
          >
            Cargando mapa…
          </div>
        )}
        <GeoMapEngine
          id={id}
          markers={markers}
          routes={routes}
          clustering={clustering}
          viewport={viewport ?? { mode: "fit", target: "all", padding: 40 }}
          showZoomControl={showZoomControl}
          tileUrl={DEFAULT_TILE_URL}
          mapAriaLabel={mapAriaLabel}
          tooltipClassName={tooltipClassName}
          popupClassName={popupClassName}
          onMarkerClick={onMarkerClick}
          onRouteClick={onRouteClick}
          onReadyChange={setMapReady}
        />
      </div>
    </div>
  );
}
