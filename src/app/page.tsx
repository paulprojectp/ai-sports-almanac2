'use client';

import { staticGames } from './lib/staticData';
import GamesList from './components/GamesList';

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50">
      <GamesList games={staticGames} sport="MLB" />
    </main>
  );
}
