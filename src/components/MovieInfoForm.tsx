import { MovieInfo } from '@/types';

interface MovieInfoFormProps {
  movieInfo: MovieInfo;
  onChange: (info: Partial<MovieInfo>) => void;
}

export default function MovieInfoForm({ movieInfo, onChange }: MovieInfoFormProps) {
  return (
    <section className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">2. 영화 정보</h2>
      <div className="space-y-4">
        <div>
          <label htmlFor="movieTitle" className="block text-sm font-medium mb-1">
            영화 제목
          </label>
          <input
            id="movieTitle"
            type="text"
            value={movieInfo.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="인터스텔라"
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="watchDate" className="block text-sm font-medium mb-1">
            관람일
          </label>
          <input
            id="watchDate"
            type="text"
            value={movieInfo.watchDate}
            onChange={(e) => onChange({ watchDate: e.target.value })}
            placeholder="2024. 11. 28."
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="theater" className="block text-sm font-medium mb-1">
            극장 위치
          </label>
          <input
            id="theater"
            type="text"
            value={movieInfo.theater}
            onChange={(e) => onChange({ theater: e.target.value })}
            placeholder="CGV 용산아이파크몰"
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="screen" className="block text-sm font-medium mb-1">
              상영관 <span className="text-gray-400 font-normal">(선택)</span>
            </label>
            <input
              id="screen"
              type="text"
              value={movieInfo.screen || ''}
              onChange={(e) => onChange({ screen: e.target.value })}
              placeholder="IMAX관"
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="seat" className="block text-sm font-medium mb-1">
              좌석 번호 <span className="text-gray-400 font-normal">(선택)</span>
            </label>
            <input
              id="seat"
              type="text"
              value={movieInfo.seat || ''}
              onChange={(e) => onChange({ seat: e.target.value })}
              placeholder="G14, G15"
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
