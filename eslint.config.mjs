import tseslint from 'typescript-eslint';

const TAP_TARGET_MESSAGE =
  '탭 타깃 44px는 tapTarget() variant(@/utils/tapTarget)로만 표기한다 — 직접 클래스는 표기 4벌째를 만든다 (#647)';

const tapTargetSelectors = ['h-11', 'min-h-\\[44px\\]'].flatMap((pattern) => [
  { selector: `Literal[value=/(^|\\s)${pattern}(\\s|$)/]`, message: TAP_TARGET_MESSAGE },
  { selector: `TemplateElement[value.raw=/(^|\\s)${pattern}(\\s|$)/]`, message: TAP_TARGET_MESSAGE },
]);

export default tseslint.config(
  { ignores: ['.next/**', 'node_modules/**'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    linterOptions: { noInlineConfig: true },
    rules: {
      'no-restricted-syntax': ['error', ...tapTargetSelectors],
    },
  }
);
