/** Defines closed provider-neutral event changes before they cross the encrypted repository boundary. */
import { z } from "zod";
import { ProviderEventIdentitySchema } from "../events/event";

const nonEmptyText = z.string().min(1);

/** Validates a non-content attachment locator without copying attachment bytes or display text. */
export const ProviderAttachmentReferenceSchema = z
  .object({
    id: nonEmptyText.nullable(),
    mimeType: nonEmptyText.nullable(),
    url: nonEmptyText.nullable(),
  })
  .strict()
  .refine((reference) => reference.id !== null || reference.url !== null, {
    message: "Attachment references require an opaque ID or URL.",
  });

/** Describes protected event content that must be encrypted before persistence. */
export const ProviderEventProtectedPayloadSchema = z
  .object({
    attachmentReferences: z.array(ProviderAttachmentReferenceSchema),
    attendees: z.array(nonEmptyText),
    description: z.string().nullable(),
    location: z.string().nullable(),
    meetingLinks: z.array(nonEmptyText),
    title: z.string().nullable(),
  })
  .strict();

/** Distinguishes standalone events, recurring masters, and individual recurring occurrences. */
export const ProviderRecurrenceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("single") }).strict(),
  z.object({ kind: z.literal("master"), masterEventId: nonEmptyText }).strict(),
  z
    .object({
      kind: z.literal("occurrence"),
      masterEventId: nonEmptyText,
      originalStartAt: z.string().datetime({ offset: true }).optional(),
    })
    .strict(),
]);

/** Stores the closed planning-safe projection for a provider event that currently exists. */
export const UpsertEventSchema = z
  .object({
    busy: z.boolean(),
    endsAt: z.string().datetime({ offset: true }),
    identity: ProviderEventIdentitySchema,
    protected: ProviderEventProtectedPayloadSchema,
    recurrence: ProviderRecurrenceSchema,
    startsAt: z.string().datetime({ offset: true }),
    status: z.enum(["confirmed", "tentative"]),
    timeZone: nonEmptyText,
    type: z.literal("upsert"),
  })
  .strict()
  .superRefine((event, context) => {
    if (Date.parse(event.endsAt) <= Date.parse(event.startsAt)) {
      context.addIssue({ code: "custom", path: ["endsAt"], message: "Event end must be after its start." });
    }
  });

/** Stores an explicit provider tombstone without retaining protected event content. */
export const DeleteEventSchema = z
  .object({
    identity: ProviderEventIdentitySchema,
    recurrence: ProviderRecurrenceSchema,
    type: z.literal("delete"),
  })
  .strict();

/** Validates every provider-neutral event mutation that a synchronization job may stage. */
export const ProviderEventChangeSchema = z.discriminatedUnion("type", [
  UpsertEventSchema,
  DeleteEventSchema,
]);

/** A non-provider-specific attachment reference retained only inside encrypted event content. */
export type ProviderAttachmentReference = z.infer<typeof ProviderAttachmentReferenceSchema>;

/** The protected content that an encrypted repository must accept separately from planning fields. */
export type ProviderEventProtectedPayload = z.infer<typeof ProviderEventProtectedPayloadSchema>;

/** A provider-neutral recurrence identity that survives a mapper boundary. */
export type ProviderRecurrence = z.infer<typeof ProviderRecurrenceSchema>;

/** A current provider event projection that can be persisted after deterministic Vision policy resolution. */
export type UpsertEvent = z.infer<typeof UpsertEventSchema>;

/** A provider event tombstone that removes provider content without deleting Vision-owned metadata. */
export type DeleteEvent = z.infer<typeof DeleteEventSchema>;

/** Every immutable provider event mutation emitted by a calendar adapter. */
export type ProviderEventChange = z.infer<typeof ProviderEventChangeSchema>;
