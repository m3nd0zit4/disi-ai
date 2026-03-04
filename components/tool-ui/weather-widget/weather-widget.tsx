"use client";

import { Cloud, CloudRain, Sun, Snowflake, CloudLightning } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SerializableWeatherWidget, WeatherConditionCode } from "./schema";

function conditionIcon(code: WeatherConditionCode) {
  switch (code) {
    case "clear":
      return <Sun className="h-5 w-5 text-amber-500" />;
    case "rain":
    case "heavy-rain":
    case "drizzle":
      return <CloudRain className="h-5 w-5 text-blue-500" />;
    case "thunderstorm":
      return <CloudLightning className="h-5 w-5 text-amber-600" />;
    case "snow":
    case "sleet":
    case "hail":
      return <Snowflake className="h-5 w-5 text-sky-400" />;
    default:
      return <Cloud className="h-5 w-5 text-muted-foreground" />;
  }
}

export interface WeatherWidgetProps extends SerializableWeatherWidget {
  className?: string;
}

export function WeatherWidget({
  id,
  location,
  units,
  current,
  forecast,
  updatedAt,
  className,
}: WeatherWidgetProps) {
  const unit = units.temperature === "fahrenheit" ? "°F" : "°C";

  return (
    <div
      data-slot="weather-widget"
      data-tool-ui-id={id}
      className={cn(
        "rounded-lg border border-border bg-card p-4 shadow-sm",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-foreground">
            {location.name}
          </h3>
          <p className="text-2xl font-semibold tabular-nums text-foreground mt-0.5">
            {current.temperature}
            {unit}
          </p>
          <p className="text-muted-foreground text-xs mt-0.5">
            {current.tempMin}
            {unit} – {current.tempMax}
            {unit}
          </p>
        </div>
        <div className="shrink-0" aria-hidden>
          {conditionIcon(current.conditionCode)}
        </div>
      </div>
      <ul className="mt-4 flex gap-2 overflow-x-auto pb-1" role="list">
        {forecast.map((day, i) => (
          <li
            key={day.label + i}
            className="flex shrink-0 flex-col items-center rounded border border-border/60 bg-muted/20 px-3 py-2 text-center min-w-[4rem]"
            role="listitem"
          >
            <span className="text-xs font-medium text-foreground">
              {day.label}
            </span>
            <span className="text-muted-foreground text-xs mt-0.5">
              {day.tempMin}
              {unit} / {day.tempMax}
              {unit}
            </span>
          </li>
        ))}
      </ul>
      {updatedAt && (
        <p className="text-muted-foreground mt-2 text-xs">
          Actualizado: {new Date(updatedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}
