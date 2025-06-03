export interface Team {
  name: string;
  abbreviation: string;
  logo: string;
  record: string;
}

export interface Predictions {
  openai: string;
  anthropic: string;
  grok: string;
  deepseek: string;
}

export interface Game {
  id: string;
  /** The sport this game belongs to (e.g. MLB, NBA). */
  sport?: string;
  homeTeam: Team;
  awayTeam: Team;
  gameTime: string;
  venue: string;
  predictions: Predictions;
}
