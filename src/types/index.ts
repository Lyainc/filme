export interface MovieInfo {
  title: string;
  titleOg?: string;
  actors?: string;
  releaseDate?: string;
  watchDate: string;
  theater: string;
  screen?: string;
  seat?: string;
  rating: number;
  showRating: boolean;
}

export interface TicketComponents {
  chain: string;
  format: string;
  texture: string;
  posterOpacity: number;
  themeColor: string;
}

export interface PhototicketState {
  croppedImageUrl: string | null;
  movieInfo: MovieInfo;
  components: TicketComponents;
  recommendedColors: string[];
}

export interface KobisMovie {
  movieCd: string;
  movieNm: string;
  movieNmEn: string;
  openDt: string;
  genreAlt: string;
  nationAlt: string;
  prdtYear: string;
  actors?: string;
}
