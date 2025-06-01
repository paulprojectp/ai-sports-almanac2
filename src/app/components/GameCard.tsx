'use client';
import React, { useState } from 'react';
import { Game } from '../lib/types';

interface GameCardProps {
  game: Game;
}

const GameCard: React.FC<GameCardProps> = ({ game }) => {
  const { homeTeam, awayTeam, gameTime, venue, predictions } = game;
  const [showPredictions, setShowPredictions] = useState(false);
  
  // Format the game time
  const formattedDate = new Date(gameTime).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
  
  const formattedTime = new Date(gameTime).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });

  // Get the base path from environment or default to empty string
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
      <div className="p-4">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center">
            <div className="w-16 h-16 flex items-center justify-center bg-gray-100 rounded-full overflow-hidden">
              <img 
                src={`${basePath}${awayTeam.logo}`} 
                alt={`${awayTeam.name} logo`}
                className="w-12 h-12 object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = `${basePath}/team-logos/default.svg`;
                }}
              />
            </div>
            <div className="ml-3">
              <h3 className="font-bold text-gray-800">{awayTeam.abbreviation}</h3>
              <p className="text-sm text-gray-600">{awayTeam.record}</p>
            </div>
          </div>
          <div className="text-center mx-4">
            <span className="text-xl font-bold text-gray-700">vs</span>
          </div>
          <div className="flex items-center">
            <div className="mr-3 text-right">
              <h3 className="font-bold text-gray-800">{homeTeam.abbreviation}</h3>
              <p className="text-sm text-gray-600">{homeTeam.record}</p>
            </div>
            <div className="w-16 h-16 flex items-center justify-center bg-gray-100 rounded-full overflow-hidden">
              <img 
                src={`${basePath}${homeTeam.logo}`} 
                alt={`${homeTeam.name} logo`}
                className="w-12 h-12 object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = `${basePath}/team-logos/default.svg`;
                }}
              />
            </div>
          </div>
        </div>
        
        <div className="text-center mb-4">
          <p className="text-sm text-gray-500">{formattedDate}</p>
          <p className="text-md font-medium text-gray-700">{formattedTime}</p>
          <p className="text-sm text-gray-500">{venue}</p>
        </div>
        
        <button 
          onClick={() => setShowPredictions(!showPredictions)}
          className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded transition-colors"
        >
          {showPredictions ? 'Hide Predictions' : 'Show Predictions'}
        </button>
        
        {showPredictions && (
          <div className="mt-4 border-t pt-4">
            <h4 className="font-semibold mb-3 text-gray-800">AI Predictions</h4>
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-blue-600">OpenAI:</p>
                <p className="text-sm text-gray-700">{predictions.openai}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-purple-600">Anthropic:</p>
                <p className="text-sm text-gray-700">{predictions.anthropic}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-green-600">Grok:</p>
                <p className="text-sm text-gray-700">{predictions.grok}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-orange-600">DeepSeek:</p>
                <p className="text-sm text-gray-700">{predictions.deepseek}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GameCard;
