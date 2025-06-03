'use client';

import React from 'react';
import { Game } from '../lib/types';
import GameCard from './GameCard';

interface GamesListProps {
  games: Game[];
  sport?: string;
}

const GamesList: React.FC<GamesListProps> = ({ games, sport = 'MLB' }) => {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Today&apos;s {sport} Games</h1>
      
      <p className="text-gray-700 mb-8">
        View predictions from multiple AI models for upcoming baseball games.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {games.map((game) => (
          <GameCard key={game.id} game={game} />
        ))}
      </div>
    </div>
  );
};

export default GamesList;
