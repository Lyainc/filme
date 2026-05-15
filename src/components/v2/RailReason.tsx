type ReasonStatus = 'idle' | 'ok' | 'warn' | 'danger';

interface RailReasonProps {
  status?: ReasonStatus;
  message?: string;
}

const DOT_STYLE: Record<ReasonStatus, string> = {
  idle: 'bg-fg-muted',
  ok: 'bg-success',
  warn: 'bg-warn',
  danger: 'bg-danger',
};

const TEXT_STYLE: Record<ReasonStatus, string> = {
  idle: 'text-fg-muted',
  ok: 'text-fg',
  warn: 'text-fg',
  danger: 'text-fg',
};

export function RailReason({ status = 'idle', message }: RailReasonProps) {
  if (!message) return null;

  return (
    <div className={`flex items-center gap-2 text-sm ${TEXT_STYLE[status]}`}>
      <span
        className={`inline-block w-2 h-2 rounded-full shrink-0 ${DOT_STYLE[status]}`}
        aria-hidden="true"
      />
      <span>{message}</span>
    </div>
  );
}
