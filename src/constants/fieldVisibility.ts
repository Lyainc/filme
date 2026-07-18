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
  quote: true,
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
  quote: false,
};

/**
 * 티켓에서 숨길 수 없는 필수 필드(#260) — 꺼지면 제목 없는 정체불명 티켓이 된다. 데스크톱 일괄토글
 * (DesktopStudioShell)·모바일 전체표시 토글·필드 드로어 자물쇠(둘 다 FieldDrawer, #424)·인플레이스
 * 필드바 눈이 각자 'title' 리터럴을 들지 않게 여기 단일 소스로 수렴 — 경로 간 어긋남 방지.
 */
export const REQUIRED_FIELDS: readonly TicketField[] = ['title'];

export const isRequiredField = (f: TicketField): boolean => REQUIRED_FIELDS.includes(f);

/** 전체 해제 값 — 필수 필드는 켠 채 나머지만 끈다(#260, ALL_FIELDS_OFF 위에 필수만 되켬). */
export const ALL_FIELDS_OFF_KEEP_REQUIRED: Record<TicketField, boolean> =
  REQUIRED_FIELDS.reduce((acc, f) => ({ ...acc, [f]: true }), { ...ALL_FIELDS_OFF });
