/** Loads one owner-bound encrypted event and derives Vision's trusted minimum AI category packet. */
import {
  EventContentAccessDeniedError,
  EventReadStaleError,
  type EventRepositoryPort,
  type PlaintextEvent,
} from "../../data/repositories/event-repository";
import type { CategoryProposalRequest } from "../../integrations/openai/ai-provider";
import { buildCategoryContext } from "../../integrations/openai/context-builder";

const CATEGORY_POLICY_VERSION = "ai-category-v1";

/** Loads one event reference through an already owner-bound protected repository. */
export interface AiCategoryContextLoader {
  /** Resolves an eligible persisted event to the server-minimized category request. */
  load(eventId: string): Promise<CategoryProposalRequest | undefined>;
}

/** Creates the trusted disclosure-policy boundary over an owner-scoped event repository. */
export function createAiCategoryContextLoader(
  repository: Pick<EventRepositoryPort, "get">,
): AiCategoryContextLoader {
  return Object.freeze({
    /** Loads/decrypts after admission, then copies only category-required trusted fields. */
    async load(eventId: string): Promise<CategoryProposalRequest | undefined> {
      let event: PlaintextEvent | undefined;
      try {
        event = await repository.get(eventId);
      } catch (error) {
        if (
          error instanceof EventContentAccessDeniedError ||
          error instanceof EventReadStaleError
        ) {
          return undefined;
        }
        throw error;
      }
      if (event === undefined || event.status === "cancelled") {
        return undefined;
      }
      return buildTrustedCategoryRequest(event);
    },
  });
}

/** Derives disclosure permissions and evidence exclusively from trusted persisted event facts. */
function buildTrustedCategoryRequest(
  event: PlaintextEvent,
): CategoryProposalRequest {
  const packet = buildCategoryContext(
    {
      eventId: event.nodeId,
      start: event.startsAt,
      end: event.endsAt,
      // The Phase B projection does not retain a distinct all-day bit, so do not infer one from content.
      allDay: false,
      timeZone: event.timeZone,
      ...(event.title === null ? {} : { title: event.title }),
    },
    {
      policyVersion: CATEGORY_POLICY_VERSION,
      title:
        event.title === null
          ? { mode: "omit" }
          : { mode: "plaintext" },
      evidence: [
        {
          id: "event-status",
          fact: `status ${event.status} busy ${event.busy ? "yes" : "no"}`,
        },
      ],
    },
  );
  return {
    subjectId: packet.eventId,
    evidenceIds: packet.evidence.map(({ id }) => id),
    policyVersion: packet.policyVersion,
    context: { ...packet },
  };
}
