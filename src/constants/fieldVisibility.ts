import type { TicketField } from '@/types';

/** 모든 티켓 필드를 표시하는 기본값 — 초기 상태·전체 선택의 도메인 소스. */
export const ALL_FIELDS_ON: Record<TicketField, boolean> = {
  title: true,
  titleOg: true,
  actors: true,
  watchDate: true,
  watchTime: true,
  theater: true,
  screen: true,
  seat: true,
  runtime: true,
  rating: true,
  releaseDate: true,
  reissue: true,
  bookingNo: true,
  signature: true,
};

/** 모든 티켓 필드를 숨기는 값 — 전체 해제의 도메인 소스(ALL_FIELDS_ON과 대칭). */
export const ALL_FIELDS_OFF: Record<TicketField, boolean> = {
  title: false,
  titleOg: false,
  actors: false,
  watchDate: false,
  watchTime: false,
  theater: false,
  screen: false,
  seat: false,
  runtime: false,
  rating: false,
  releaseDate: false,
  reissue: false,
  bookingNo: false,
  signature: false,
};
