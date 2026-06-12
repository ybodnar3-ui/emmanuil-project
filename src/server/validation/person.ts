import { z } from "zod";

/**
 * Zod schemas for every Person-related mutation input. Server actions parse
 * untrusted FormData through these before touching the data layer.
 */

export const RELATIONSHIP_TIERS = ["vip", "friend", "acquaintance"] as const;
export const FACT_CATEGORIES = [
  "family",
  "work",
  "projects",
  "interests",
  "ask-about",
] as const;
export const INTERACTION_CHANNELS = ["call", "meeting", "message"] as const;

export const personInputSchema = z.object({
  fullName: z.string().trim().min(1, "required").max(200),
  howWeMet: z.string().trim().max(2000).optional().or(z.literal("")),
  location: z.string().trim().max(200).optional().or(z.literal("")),
  birthday: z.coerce.date().optional().nullable(),
  tags: z.array(z.string().trim().min(1)).max(50).default([]),
  relationshipTier: z.enum(RELATIONSHIP_TIERS).optional().nullable(),
});
export type PersonInput = z.infer<typeof personInputSchema>;

export const factInputSchema = z.object({
  category: z.enum(FACT_CATEGORIES),
  content: z.string().trim().min(1).max(2000),
});
export type FactInput = z.infer<typeof factInputSchema>;

export const interactionInputSchema = z.object({
  date: z.coerce.date().optional(),
  channel: z.enum(INTERACTION_CHANNELS).optional().nullable(),
  summary: z.string().trim().min(1).max(4000),
});
export type InteractionInput = z.infer<typeof interactionInputSchema>;

export const cadenceInputSchema = z.object({
  intervalDays: z.coerce.number().int().positive().max(3650),
});
export type CadenceInput = z.infer<typeof cadenceInputSchema>;
