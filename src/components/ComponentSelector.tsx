import { TicketComponents } from '@/types';
import { THEATER_CHAINS, SCREENING_FORMATS, TEXTURE_OPTIONS } from '@/utils/constants';

interface ComponentSelectorProps {
  components: TicketComponents;
  onChange: (components: Partial<TicketComponents>) => void;
}

export default function ComponentSelector({ components, onChange }: ComponentSelectorProps) {
  return (
    <section className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">3. 디자인 & 텍스처</h2>
      <div className="space-y-4">
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
