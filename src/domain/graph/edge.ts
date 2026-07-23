/** Defines governed graph relationships and enforces node ownership, family, and privacy invariants. */
import { z } from "zod";
import { doesNotReducePrivacy, PrivacyLevelSchema } from "../privacy/privacy";
import { NodeEnvelopeSchema, type NodeEnvelope } from "./node";

/** Records the allowed source of a relationship fact. */
export const EdgeOriginSchema = z.enum(["provider", "user", "system", "model"]);

/** Records the lifecycle state of a governed relationship. */
export const EdgeLifecycleSchema = z.enum(["proposed", "confirmed", "rejected", "retracted"]);

const EdgeBaseSchema = z
  .object({
    id: z.string().min(1),
    sourceNodeId: z.string().min(1),
    destinationNodeId: z.string().min(1),
    origin: EdgeOriginSchema,
    evidence: z.string().min(1).optional(),
    confidence: z.number().min(0).max(1).optional(),
    lifecycle: EdgeLifecycleSchema,
    privacy: PrivacyLevelSchema,
    validFrom: z.string().datetime({ offset: true }).optional(),
    validTo: z.string().datetime({ offset: true }).optional(),
    version: z.number().int().positive(),
  })
  .strict();

/** Validates one registered relation family and its legal endpoint types. */
export const EdgeSchema = z.discriminatedUnion("relation", [
  EdgeBaseSchema.extend({ relation: z.literal("event_in_calendar"), sourceType: z.literal("event"), destinationType: z.literal("calendar") }),
  EdgeBaseSchema.extend({ relation: z.literal("task_from_source"), sourceType: z.literal("task"), destinationType: z.literal("source_artifact") }),
  EdgeBaseSchema.extend({ relation: z.literal("note_about_event"), sourceType: z.literal("note"), destinationType: z.literal("event") }),
  EdgeBaseSchema.extend({ relation: z.literal("commitment_for_person"), sourceType: z.literal("commitment"), destinationType: z.literal("person") }),
  EdgeBaseSchema.extend({ relation: z.literal("recommendation_for_event"), sourceType: z.literal("recommendation"), destinationType: z.literal("event") }),
  EdgeBaseSchema.extend({ relation: z.literal("preference_for_policy"), sourceType: z.literal("preference"), destinationType: z.literal("policy") }),
  EdgeBaseSchema.extend({ relation: z.literal("policy_governs_event"), sourceType: z.literal("policy"), destinationType: z.literal("event") }),
  EdgeBaseSchema.extend({ relation: z.literal("alert_episode_for_event"), sourceType: z.literal("alert_episode"), destinationType: z.literal("event") }),
]);

/** A governed relationship whose family is known to Vision policy. */
export type Edge = z.infer<typeof EdgeSchema>;

/** Validates an edge against its actual canonical endpoints before it enters the graph. */
export function validateEdge(edge: Edge, source: NodeEnvelope, destination: NodeEnvelope): Edge {
  const parsedEdge = EdgeSchema.parse(edge);
  const parsedSource = NodeEnvelopeSchema.parse(source);
  const parsedDestination = NodeEnvelopeSchema.parse(destination);

  if (parsedSource.id !== parsedEdge.sourceNodeId || parsedDestination.id !== parsedEdge.destinationNodeId) {
    throw new Error("Edge endpoints must match the supplied node IDs.");
  }

  if (parsedSource.ownerId !== parsedDestination.ownerId) {
    throw new Error("Governed edges must connect nodes with the same owner.");
  }

  if (parsedSource.nodeType !== parsedEdge.sourceType || parsedDestination.nodeType !== parsedEdge.destinationType) {
    throw new Error("Edge family does not match the supplied node types.");
  }

  if (!doesNotReducePrivacy(parsedSource.privacy, parsedEdge.privacy) || !doesNotReducePrivacy(parsedDestination.privacy, parsedEdge.privacy)) {
    // An edge is contextual metadata, never a channel for weakening either endpoint's protection.
    throw new Error("Edges cannot reduce endpoint privacy.");
  }

  return parsedEdge;
}
