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
 * 문자열 리터럴/템플릿 리터럴 자체를 파일 전체에서 스캔한다 — JSX className 위치로 좁히지
 * 않는 이유는 이 리포의 실제 관용구가 그걸 우회하기 때문이다(#647 리뷰 발견). FloatingToolbar의
 * `TB_TARGET`/`btn`, InPlaceFieldEditor의 `barBtnCls`, FieldEditorBody의 `INPUT_CLS`처럼 클래스
 * 문자열을 const로 뽑아 `className={btn}`으로 참조하는 패턴이 이미 이 코드베이스의 표준이라,
 * className 어트리뷰트만 보면 그 const 선언 자체(정작 값이 사는 자리)는 그냥 통과한다. 두
 * 패턴(`min-h-[44px]`/`h-11`)이 클래스 문자열 아닌 곳에 우연히 등장할 가능성은 사실상 0이라
 * (특이한 하이픈+대괄호 조합), 스코프를 넓혀도 오탐 위험보다 우회를 막는 이득이 크다.
 */
const noRawTouchTargetSize = {
  meta: { type: 'problem', docs: { description: 'min-h-[44px]/h-11 직접 사용 금지 — min-h-touch/h-touch를 쓸 것' } },
  create(context) {
    return {
      Literal(node) {
        if (typeof node.value === 'string') checkClassNameValue(context, node, node.value);
      },
      TemplateElement(node) {
        checkClassNameValue(context, node, node.value.raw);
      },
    };
  },
};

export default tseslint.config(
  {
    ignores: ['node_modules/**', '.next/**', 'public/**'],
  },
  {
    // .ts도 포함 — variants.ts 자체가 이 규칙이 지키려는 "44px 표현의 단일 소스"라, .tsx만
    // 보면 정작 그 파일은 안 걸린다(#647 리뷰 발견).
    files: ['src/**/*.{ts,tsx}'],
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
