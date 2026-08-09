import {
  EVENT_FAQ_CREATED,
  EVENT_FAQ_UPDATED,
  EVENT_FAQ_DELETED,
  EVENT_FAQ_RESTORED,
} from '../constants/faq.constants';

export interface BaseFaqEventPayload {
  tenantId: string;
  faqId: string;
  actorId: string;
  requestId: string;
  occurredAt: Date;
}

export interface FaqCreatedEvent {
  type: typeof EVENT_FAQ_CREATED;
  payload: BaseFaqEventPayload & {
    question: string;
    answer: string;
  };
}

export interface FaqUpdatedEvent {
  type: typeof EVENT_FAQ_UPDATED;
  payload: BaseFaqEventPayload & {
    changedFields: string[];
    previous: any;
    current: any;
  };
}

export interface FaqDeletedEvent {
  type: typeof EVENT_FAQ_DELETED;
  payload: BaseFaqEventPayload;
}

export interface FaqRestoredEvent {
  type: typeof EVENT_FAQ_RESTORED;
  payload: BaseFaqEventPayload;
}

export type FaqDomainEvent =
  | FaqCreatedEvent
  | FaqUpdatedEvent
  | FaqDeletedEvent
  | FaqRestoredEvent;
