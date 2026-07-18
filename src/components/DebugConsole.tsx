import { useEffect, useState } from 'react';

/**
 * `?debug=1` 붙었을 때만 뜨는 화면 내 콘솔 오버레이(#439). iOS Safari 실기기에서 원격 디버깅
 * (맥+케이블) 없이도 console.log/warn/error를 눈으로 볼 수 있게 한다 — #439가 몇 라운드째
 * "동일 증상"만 반복 보고돼 실제 실패 지점(어느 이미지가 어디서 왜 비는지)을 눈으로 확인할
 * 방법이 필요해서 추가. 진단 끝나면 지워도 되는 임시 도구 — 프로덕션 기본 동작에는 영향 없음
 * (query param 없으면 콘솔 patch조차 안 함).
 */
export default function DebugConsole() {
  const [lines, setLines] = useState<string[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [lastCapture, setLastCapture] = useState<string | null>(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('debug') !== '1') return;
    setEnabled(true);

    // captureToImage.ts가 toJpeg 성공 직후 쏘는 이벤트 — 공유/저장 단계를 거치기 전, html-to-image가
    // 만든 원본 dataUrl을 화면에서 바로 본다. 여기서부터 이미 깨져 있으면 캡처(html-to-image) 쪽
    // 문제, 여기선 멀쩡한데 사진 앱 저장물만 깨지면 공유/저장(후속) 단계 문제로 좁혀진다.
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

    return () => {
      console.log = original.log;
      console.warn = original.warn;
      console.error = original.error;
      window.onerror = originalOnError;
      window.removeEventListener('capture-debug-result', onCaptureResult);
    };
  }, []);

  if (!enabled) return null;

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        maxHeight: '50vh',
        overflowY: 'auto',
        background: 'rgba(0,0,0,0.92)',
        color: '#0f0',
        fontFamily: 'monospace',
        fontSize: 10,
        lineHeight: 1.4,
        padding: '6px 8px',
        zIndex: 999999,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
      }}
    >
      {lastCapture && (
        <div style={{ marginBottom: 6 }}>
          <div>↓ toJpeg 직후 원본 캡처 결과(공유/저장 전):</div>
          {/* eslint-disable-next-line @next/next/no-img-element -- 디버그 오버레이, next/image 불필요 */}
          <img src={lastCapture} alt="last capture" style={{ maxWidth: '100%', border: '1px solid #0f0' }} />
        </div>
      )}
      {lines.length === 0 ? '(no logs yet)' : lines.join('\n')}
    </div>
  );
}
