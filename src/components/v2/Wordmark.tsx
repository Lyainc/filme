import { Sprocket } from './Sprocket';

/** Sprocket + "FILME" 텍스트 lockup. 감싸는 랜드마크(h1/Link)는 호출부가 결정한다. */
export function Wordmark({ as: Tag = 'span' }: { as?: 'h1' | 'span' }) {
  return (
    <>
      <Sprocket size={20} className="text-accent" />
      <Tag
        className="font-sans text-fg"
        style={{ fontSize: 19, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' }}
      >
        FILME
      </Tag>
    </>
  );
}
