/** Defines the provider-independent canonical envelope shared by every Vision graph node. */
import { z } from "zod";
import { DomainSchema, DomainStateSchema } from "../categorization/category";
import { PrivacyLevelSchema } from "../privacy/privacy";

/** Accepts the Version 1 object types registered in Vision's canonical graph. */
export const NodeTypeSchema = z.enum([
  "event",
  "task",
  "note",
  "commitment",
  "recommendation",
  "preference",
  "policy",
  "audit_event",
  "person",
  "calendar",
  "source_artifact",
  "alert_episode",
]);

/** Identifies the actor or system that supplied a graph fact. */
export const ProvenanceSchema = z.enum(["provider", "user", "system", "model"]);

/** Identifies the retention state of a graph object. */
export const NodeLifecycleSchema = z.enum(["active", "deleted", "purged"]);

const NodeEnvelopeBaseSchema = z
  .object({
    id: z.string().min(1),
    ownerId: z.string().min(1),
    sourceSystem: z.string().min(1).optional(),
    sourceId: z.string().min(1).optional(),
    domain: DomainSchema,
    domainState: DomainStateSchema,
    privacy: PrivacyLevelSchema,
    provenance: ProvenanceSchema,
    lifecycle: NodeLifecycleSchema,
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
    validFrom: z.string().datetime({ offset: true }),
    validTo: z.string().datetime({ offset: true }).optional(),
    version: z.number().int().positive(),
    modelConfidence: z.number().min(0).max(1).optional(),
  })
  .strict();

/** Validates a closed, discriminated canonical node envelope. */
export const NodeEnvelopeSchema = z
  .discriminatedUnion("nodeType", [
    NodeEnvelopeBaseSchema.extend({ nodeType: z.literal("event") }),
    NodeEnvelopeBaseSchema.extend({ nodeType: z.literal("task") }),
    NodeEnvelopeBaseSchema.extend({ nodeType: z.literal("note") }),
    NodeEnvelopeBaseSchema.extend({ nodeType: z.literal("commitment") }),
    NodeEnvelopeBaseSchema.extend({ nodeType: z.literal("recommendation") }),
    NodeEnvelopeBaseSchema.extend({ nodeType: z.literal("preference") }),
    NodeEnvelopeBaseSchema.extend({ nodeType: z.literal("policy") }),
    NodeEnvelopeBaseSchema.extend({ nodeType: z.literal("audit_event") }),
    NodeEnvelopeBaseSchema.extend({ nodeType: z.literal("person") }),
    NodeEnvelopeBaseSchema.extend({ nodeType: z.literal("calendar") }),
    NodeEnvelopeBaseSchema.extend({ nodeType: z.literal("source_artifact") }),
    NodeEnvelopeBaseSchema.extend({ nodeType: z.literal("alert_episode") }),
  ])
  .superRefine((node, context) => {
    if (node.domainState === "inferred" && node.modelConfidence === undefined) {
      context.addIssue({ code: "custom", path: ["modelConfidence"], message: "Inferred nodes require model confidence." });
    }

    if (node.domainState !== "inferred" && node.modelConfidence !== undefined) {
      context.addIssue({ code: "custom", path: ["modelConfidence"], message: "Only inferred nodes may include model confidence." });
    }
  });

/** A registered canonical object and the shared facts that govern it. */
export type NodeEnvelope = z.infer<typeof NodeEnvelopeSchema>;

/** A closed Version 1 graph object type. */
export type NodeType = z.infer<typeof NodeTypeSchema>;
