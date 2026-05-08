import { TicketComponents } from '@/types';
import { THEATER_CHAINS, SCREENING_FORMATS, TEXTURE_OPTIONS } from '@/utils/constants';

interface ComponentSelectorProps {
  components: TicketComponents;
  recommendedColors: string[];
  onChange: (components: Partial<TicketComponents>) => void;
}

export default function ComponentSelector({ components, recommendedColors, onChange }: ComponentSelectorProps) {
  const colorOptions = [
    { label: 'White', value: '#FFFFFF' },
    { label: 'Black', value: '#000000' },
    ...(recommendedColors[0] ? [{ label: '추천 1', value: recommendedColors[0] }] : []),
    ...(recommendedColors[1] ? [{ label: '추천 2', value: recommendedColors[1] }] : []),
  ];

  const isCustomColor = !colorOptions.some(opt => opt.value === components.themeColor);

  return (
    <section className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">3. 디자인 & 텍스처</h2>
      <div className="space-y-6">
        {/* 포스터 투명도 (시인성) */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label htmlFor="posterOpacity" className="block text-sm font-medium">
              포스터 밝기 (시인성 조절)
            </label>
            <span className="text-xs font-mono text-gray-500">
              {Math.round(components.posterOpacity * 100)}%
            </span>
          </div>
          <input
            id="posterOpacity"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={components.posterOpacity}
            onChange={(e) => onChange({ posterOpacity: parseFloat(e.target.value) })}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
        </div>

        {/* 테마 색상 선택 */}
        <div>
          <label className="block text-sm font-medium mb-2">테마 색상 (로고/텍스트/테두리)</label>
          <div className="flex flex-wrap gap-2 items-center">
            {colorOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onChange({ themeColor: opt.value })}
                className={`group relative w-10 h-10 rounded-full border-2 transition-all ${
                  components.themeColor === opt.value ? 'border-blue-600 scale-110 shadow-md' : 'border-gray-200 hover:border-gray-400'
                }`}
                style={{ backgroundColor: opt.value }}
                title={opt.label}
              >
                {components.themeColor === opt.value && (
                  <span className="absolute inset-0 flex items-center justify-center text-xs mix-blend-difference text-white">
                    ✓
                  </span>
                )}
              </button>
            ))}

            {/* 스포이드 / 커스텀 색상 */}
            <div className="relative group">
              <input
                type="color"
                value={isCustomColor ? components.themeColor : '#FFFFFF'}
                onChange={(e) => onChange({ themeColor: e.target.value })}
                className={`w-10 h-10 rounded-full border-2 cursor-pointer transition-all ${
                  isCustomColor ? 'border-blue-600 scale-110 shadow-md' : 'border-gray-200 hover:border-gray-400'
                }`}
              />
              <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-gray-400 whitespace-nowrap">
                커스텀
              </span>
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="texture" className="block text-sm font-medium mb-1">
            후가공 재질 (특수 용지)
          </label>
          <select
            id="texture"
            value={components.texture}
            onChange={(e) => onChange({ texture: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {TEXTURE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="chain" className="block text-sm font-medium mb-1">
              극장 체인
            </label>
            <select
              id="chain"
              value={components.chain}
              onChange={(e) => onChange({ chain: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {THEATER_CHAINS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="format" className="block text-sm font-medium mb-1">
              상영 포맷
            </label>
            <select
              id="format"
              value={components.format}
              onChange={(e) => onChange({ format: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {SCREENING_FORMATS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </section>
  );
}
