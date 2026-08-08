import tseslint from 'typescript-eslint';

/**
 * min-h-[44px]/h-11 직접 사용 금지(#647 축 2 조건, 이슈가 명시한 두 패턴만). 44px 탭 타깃은
 * tailwind.config.js spacing.touch 토큰(min-h-touch/h-touch)으로 표현한다 — 이 두 리터럴이
 * 다시 생기면 축 2가 없애려던 "44px 표현 3벌"이 조용히 부활한다.
 *
 * w-11은 일부러 안 막는다 — MobileEditorShell.tsx의 드로어 드래그 핸들(`h-24 w-11`, 96×44
 * 세로 스트립)처럼 44px 정사각 아이콘 버튼이 아니라 다른 높이와 짝지어 쓰는 정당한 용례가
 * 있고, 이슈가 막으라고 명시한 것도 h-11/min-h-[44px] 둘뿐이다.
 */
// 경계를 공백이 아니라 "단어문자·하이픈이 아님"으로 잡는다 — 추출된 클래스 문자열(공백 구분)뿐
// 아니라 JSXExpressionContainer의 raw 소스 텍스트(따옴표·백틱·중괄호로 둘러싸인)에도 같은
// 정규식을 그대로 쓰기 때문. 공백 전용 경계였으면 `'h-11'`처럼 따옴표에 붙은 경우를 놓친다.
const BANNED_CLASS_PATTERNS = [
  { pattern: /(?<![\w-])min-h-\[44px\](?![\w-])/, suggestion: 'min-h-touch' },
  { pattern: /(?<![\w-])h-11(?![\w-])/, suggestion: 'h-touch' },
];

function checkClassNameValue(context, node, value) {
  for (const { pattern, suggestion } of BANNED_CLASS_PATTERNS) {
    if (pattern.test(value)) {
      context.report({
        node,
        message: `44px 탭 타깃은 ${suggestion}로 표현하세요 (min-h-[44px]/h-11 직접 사용 금지, #647).`,
      });
    }
  }
}

/**
 * className 값의 원본 소스 텍스트 전체를 스캔한다(AST 분기별로 Literal/TemplateLiteral만 따로
 * 훑지 않는 이유) — 삼항 분기 안에 박힌 문자열(`` `flex ${cond ? 'h-11' : 'h-9'}` ``)처럼
 * 어디에 있든 걸려야, cva 함수 호출이나 새 조건부 패턴이 생겨도 우회가 안 생긴다.
 */
const noRawTouchTargetSize = {
  meta: { type: 'problem', docs: { description: 'min-h-[44px]/h-11 직접 사용 금지 — min-h-touch/h-touch를 쓸 것' } },
  create(context) {
    return {
      JSXAttribute(node) {
        if (node.name.type !== 'JSXIdentifier' || node.name.name !== 'className') return;
        const value = node.value;
        if (!value) return;
        const text =
          value.type === 'Literal' && typeof value.value === 'string'
            ? value.value
            : value.type === 'JSXExpressionContainer'
              ? context.sourceCode.getText(value.expression)
              : null;
        if (text !== null) checkClassNameValue(context, node, text);
      },
    };
  },
};

export default tseslint.config(
  {
    ignores: ['node_modules/**', '.next/**', 'public/**'],
  },
  {
    files: ['src/**/*.tsx'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: {
      local: { rules: { 'no-raw-touch-target-size': noRawTouchTargetSize } },
    },
    rules: {
      'local/no-raw-touch-target-size': 'error',
    },
  },
);
