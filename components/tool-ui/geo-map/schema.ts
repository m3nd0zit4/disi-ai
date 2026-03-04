import type { CSSProperties } from "react";
import { z } from "zod";
import { defineToolUiContract } from "../shared/contract";
import { ToolUIIdSchema, ToolUIRoleSchema } from "../shared/schema";

const GeoMapPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const GeoMapMarkerIconSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("image"), url: z.string().url() }),
  z.object({ type: z.literal("emoji"), value: z.string() }),
  z.object({
    type: z.literal("dot"),
    color: z.string().optional(),
    borderColor: z.string().optional(),
    radius: z.number().optional(),
  }),
]);

export const GeoMapMarkerSchema = z.object({
  id: z.string().optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  label: z.string().optional(),
  description: z.string().optional(),
  tooltip: z.enum(["none", "hover", "always"]).optional(),
  icon: GeoMapMarkerIconSchema.optional(),
});

export const GeoMapRouteSchema = z.object({
  id: z.string().optional(),
  points: z.array(GeoMapPointSchema).min(2),
  label: z.string().optional(),
  description: z.string().optional(),
  color: z.string().optional(),
  weight: z.number().min(1).max(12).optional(),
  opacity: z.number().min(0).max(1).optional(),
});

const GeoMapClusteringSchema = z.object({
  enabled: z.boolean().optional(),
  radius: z.number().min(20).max(120).optional(),
  maxZoom: z.number().min(1).max(22).optional(),
  minPoints: z.number().min(2).max(20).optional(),
});

export const SerializableGeoMapSchema = z.object({
  id: ToolUIIdSchema,
  role: ToolUIRoleSchema.optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  markers: z.array(GeoMapMarkerSchema).min(1),
  routes: z.array(GeoMapRouteSchema).optional(),
  clustering: GeoMapClusteringSchema.optional(),
});

export type SerializableGeoMap = z.infer<typeof SerializableGeoMapSchema>;
export type GeoMapMarker = z.infer<typeof GeoMapMarkerSchema>;
export type GeoMapMarkerIcon = z.infer<typeof GeoMapMarkerIconSchema>;
export type GeoMapRoute = z.infer<typeof GeoMapRouteSchema>;
export type GeoMapClustering = z.infer<typeof GeoMapClusteringSchema>;

export type GeoMapFitTarget = "markers" | "routes" | "all";

export type GeoMapViewport =
  | {
      mode: "fit";
      target?: GeoMapFitTarget;
      padding?: number;
      maxZoom?: number;
    }
  | {
      mode: "center";
      center: { lat: number; lng: number };
      zoom: number;
    };

export type GeoMapStyle = CSSProperties;
export type GeoMapProps = SerializableGeoMap & {
  className?: string;
  style?: GeoMapStyle;
  viewport?: GeoMapViewport;
  showZoomControl?: boolean;
  theme?: "light" | "dark";
  popupClassName?: string;
  tooltipClassName?: string;
  onMarkerClick?: (marker: GeoMapMarker) => void;
  onRouteClick?: (route: GeoMapRoute) => void;
};
export type GeoMapClientProps = GeoMapProps;

const Contract = defineToolUiContract("GeoMap", SerializableGeoMapSchema);

export const parseSerializableGeoMap: (input: unknown) => SerializableGeoMap =
  Contract.parse;

export const safeParseSerializableGeoMap: (
  input: unknown,
) => SerializableGeoMap | null = Contract.safeParse;
