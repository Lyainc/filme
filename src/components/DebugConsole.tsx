import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * `?debug=1` 붙었을 때만 뜨는 화면 내 콘솔 오버레이(#439). iOS Safari 실기기에서 원격 디버깅
 * (맥+케이블) 없이도 console.log/warn/error를 눈으로 볼 수 있게 한다 — #439가 몇 라운드째
 * "동일 증상"만 반복 보고돼 실제 실패 지점(어느 이미지가 어디서 왜 비는지)을 눈으로 확인할
 * 방법이 필요해서 추가. 진단 끝나면 지워도 되는 임시 도구 — 프로덕션 기본 동작에는 영향 없음
 * (query param 없으면 콘솔 patch조차 안 함).
 *
 * 레이아웃 규칙(#490/#495에서 실기기 피드백으로 확정):
 * - 로그 영역은 pointerEvents:none. 화면 하단을 크게 덮는데 탭을 받으면 그 아래 업로드 버튼이
 *   눌리지 않아 "?debug=1에서 업로드가 안 됨"이 된다.
 * - 대신 조작 바(복사·접기)만 pointerEvents:auto로 살린다. 로그 영역이 탭을 안 받으니 드래그
 *   선택으로는 복사할 수 없어, 복사는 버튼이 담당한다.
 * - 접기가 필요한 이유 — 한번 뜨면 화면 절반을 계속 가려 다른 조작을 방해한다.
 */
export default function DebugConsole() {
  const [lines, setLines] = useState<string[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [lastCapture, setLastCapture] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 수동 스크롤이 막혀 있으므로(pointerEvents:none) 새 로그가 오면 자동으로 바닥까지 스크롤한다 —
  // 진단에 중요한 최신 로그가 앞선 노이즈에 묻히지 않고 보이게.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines, lastCapture, collapsed]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('debug') !== '1') return;
    setEnabled(true);

    // captureToImage.ts가 최종 합성 직후 쏘는 이벤트 — 저장/공유 단계를 거치기 전 결과물을 바로 본다.
    const onCaptureResult = (e: Event) => {
      setLastCapture((e as CustomEvent<string>).detail);
    };
    window.addEventListener('capture-debug-result', onCaptureResult);

    const format = (args: unknown[]) =>
      args
        .map((a) => {
          if (a instanceof Error) return `${a.name}: ${a.message}`;
          if (typeof a === 'object') {
            try {
              return JSON.stringify(a);
            } catch {
              return String(a);
            }
          }
          return String(a);
        })
        .join(' ');

    const original = { log: console.log, warn: console.warn, error: console.error };
    (['log', 'warn', 'error'] as const).forEach((level) => {
      console[level] = (...args: unknown[]) => {
        original[level](...args);
        setLines((prev) => [...prev.slice(-199), `[${level}] ${format(args)}`]);
      };
    });
    const originalOnError = window.onerror;
    window.onerror = (msg, ...rest) => {
      setLines((prev) => [...prev.slice(-199), `[onerror] ${String(msg)}`]);
      return originalOnError?.(msg, ...rest);
    };
    // 여기까지 안 잡히던 비동기 실패(캡처 파이프라인의 reject 등)도 남긴다 — 로그가 중간에
    // 끊길 때 원인을 눈으로 보기 위함(#490/#495 editorial 진단).
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason;
      setLines((prev) => [...prev.slice(-199), `[unhandledrejection] ${r instanceof Error ? `${r.name}: ${r.message}` : String(r)}`]);
    };
    window.addEventListener('unhandledrejection', onRejection);

    return () => {
      console.log = original.log;
      console.warn = original.warn;
      console.error = original.error;
      window.onerror = originalOnError;
      window.removeEventListener('capture-debug-result', onCaptureResult);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  const copy = useCallback(async () => {
    const text = lines.join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied('ok');
    } catch {
      // 폴백 — clipboard API가 막힌 환경(비보안 컨텍스트 등)에서도 복사되게.
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        setCopied('ok');
      } catch {
        setCopied('fail');
      }
    }
    setTimeout(() => setCopied(null), 1500);
  }, [lines]);

  if (!enabled) return null;

  const btnStyle: React.CSSProperties = {
    pointerEvents: 'auto',
    background: 'rgba(0,0,0,0.92)',
    color: '#0f0',
    border: '1px solid #0f0',
    borderRadius: 4,
    fontFamily: 'monospace',
    fontSize: 11,
    padding: '5px 9px',
    minHeight: 28,
  };

  return (
    <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 999999, pointerEvents: 'none' }}>
      {/* 조작 바 — 오버레이에서 유일하게 탭을 받는 영역. 우측 정렬·소형이라 아래 UI를 거의 안 가린다. */}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', padding: '4px 6px' }}>
        <button type="button" onClick={copy} style={btnStyle}>
          {copied === 'ok' ? '복사됨' : copied === 'fail' ? '복사실패' : `복사(${lines.length})`}
        </button>
        <button type="button" onClick={() => setCollapsed((c) => !c)} style={btnStyle}>
          {collapsed ? '로그 펼치기' : '로그 접기'}
        </button>
      </div>
      {!collapsed && (
        <div
          ref={scrollRef}
          style={{
            maxHeight: '45vh',
            overflowY: 'auto',
            background: 'rgba(0,0,0,0.92)',
            color: '#0f0',
            fontFamily: 'monospace',
            fontSize: 10,
            lineHeight: 1.4,
            padding: '6px 8px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            // 로그 영역은 절대 탭을 먹지 않는다 — 그 아래 버튼이 눌려야 한다.
            pointerEvents: 'none',
          }}
        >
          {lastCapture && (
            <div style={{ marginBottom: 6 }}>
              <div>↓ 최종 합성 결과(저장/공유 전):</div>
              {/* eslint-disable-next-line @next/next/no-img-element -- 디버그 오버레이, next/image 불필요 */}
              <img src={lastCapture} alt="last capture" style={{ maxWidth: '100%', border: '1px solid #0f0' }} />
            </div>
          )}
          {lines.length === 0 ? '(no logs yet)' : lines.join('\n')}
        </div>
      )}
    </div>
  );
}
