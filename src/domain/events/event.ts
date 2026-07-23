/** Defines the provider-independent planning-safe event contract linked to a canonical event node. */
import { z } from "zod";
import { DomainSchema, DomainStateSchema } from "../categorization/category";
import { PrivacyLevelSchema } from "../privacy/privacy";

/** Represents the lifecycle status that affects calendar planning. */
export const EventStatusSchema = z.enum(["confirmed", "tentative", "cancelled"]);

/** Validates the planning-safe provider identity used for synchronization and deduplication. */
export const ProviderEventIdentitySchema = z
  .object({
    sourceSystem: z.string().min(1),
    sourceCalendarId: z.string().min(1),
    sourceEventId: z.string().min(1),
    sourceVersion: z.string().min(1),
  })
  .strict();

/** Validates a provider-independent event without placing protected content in the pure planning contract. */
export const VisionEventSchema = z
  .object({
    nodeId: z.string().min(1),
    ownerId: z.string().min(1),
    identity: ProviderEventIdentitySchema,
    startsAt: z.string().datetime({ offset: true }),
    endsAt: z.string().datetime({ offset: true }),
    timeZone: z.string().min(1),
    busy: z.boolean(),
    status: EventStatusSchema,
    recurrenceId: z.string().min(1).optional(),
    domain: DomainSchema,
    domainState: DomainStateSchema,
    privacy: PrivacyLevelSchema,
    version: z.number().int().positive(),
  })
  .strict()
  .superRefine((event, context) => {
    if (Date.parse(event.endsAt) <= Date.parse(event.startsAt)) {
      context.addIssue({ code: "custom", path: ["endsAt"], message: "Event end must be after its start." });
    }
  });

/** A planning-safe canonical event that future adapters can persist without provider coupling. */
export type VisionEvent = z.infer<typeof VisionEventSchema>;
