import { z } from "zod";
import { defineToolUiContract } from "../shared/contract";
import { ToolUIIdSchema, ToolUIRoleSchema } from "../shared/schema";

export const WeatherConditionCodeSchema = z.enum([
  "clear",
  "partly-cloudy",
  "cloudy",
  "overcast",
  "fog",
  "drizzle",
  "rain",
  "heavy-rain",
  "thunderstorm",
  "snow",
  "sleet",
  "hail",
  "windy",
]);

export const CurrentWeatherSchema = z.object({
  temperature: z.number(),
  tempMin: z.number(),
  tempMax: z.number(),
  conditionCode: WeatherConditionCodeSchema,
  windSpeed: z.number().optional(),
  precipitationLevel: z.enum(["none", "light", "moderate", "heavy"]).optional(),
  visibility: z.number().optional(),
});

export const ForecastDaySchema = z.object({
  label: z.string(),
  tempMin: z.number(),
  tempMax: z.number(),
  conditionCode: WeatherConditionCodeSchema,
});

export const SerializableWeatherWidgetSchema = z.object({
  id: ToolUIIdSchema,
  role: ToolUIRoleSchema.optional(),
  location: z.object({ name: z.string().min(1) }),
  units: z.object({
    temperature: z.enum(["celsius", "fahrenheit"]),
  }),
  current: CurrentWeatherSchema,
  forecast: z.array(ForecastDaySchema).min(1).max(7),
  time: z
    .object({
      timeBucket: z.number().min(0).max(11).optional(),
      localTimeOfDay: z.number().min(0).max(1).optional(),
    })
    .optional(),
  updatedAt: z.string().optional(),
});

export type SerializableWeatherWidget = z.infer<
  typeof SerializableWeatherWidgetSchema
>;
export type WeatherConditionCode = z.infer<typeof WeatherConditionCodeSchema>;

const Contract = defineToolUiContract(
  "WeatherWidget",
  SerializableWeatherWidgetSchema,
);

export const parseSerializableWeatherWidget: (
  input: unknown,
) => SerializableWeatherWidget = Contract.parse;

export const safeParseSerializableWeatherWidget: (
  input: unknown,
) => SerializableWeatherWidget | null = Contract.safeParse;
