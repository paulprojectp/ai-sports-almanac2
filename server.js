const express = require('express');
const path = require('path');
const MongoDBService = require('./scripts/llm-integration/mongodb-service');
require('dotenv').config();

const app = express();
const mongo = new MongoDBService();

async function init() {
  await mongo.connect();
}
init().catch(err => {
  console.error('Failed to connect to MongoDB:', err);
});

app.use(express.static(path.join(__dirname)));

app.get('/api/games', async (req, res) => {
  try {
    const now = new Date();
    // Convert to Eastern Time so games remain visible for the entire ET day
    const easternNow = new Date(now.toLocaleString('en-US', {
      timeZone: 'America/New_York'
    }));
    let games = await mongo.getPredictionsByDate(easternNow);

    // Fallback to most recently updated games if none match today's date
    if (!games.length) {
      games = await mongo.getLatestPredictions();
    }

    const result = games.map(g => ({
      gameId: g.gameId,
      gameTime: g.gameDate,
      homeTeam: g.homeTeam,
      awayTeam: g.awayTeam,
      venue: g.venue,
      predictions: ['openai', 'anthropic', 'grok', 'deepseek']
        .filter(k => g.predictions[k])
        .map(k => ({ source: k, text: g.predictions[k] }))
    }));

    res.json(result);
  } catch (err) {
    console.error('Error fetching predictions:', err);
    res.status(500).json({ error: 'Failed to fetch predictions' });
  }
});

// Fetch predictions for a single game by ID
app.get('/api/games/:gameId', async (req, res) => {
  try {
    const gameId = req.params.gameId;
    const g = await mongo.getPredictions(gameId);
    if (!g) {
      return res.status(404).json({ error: 'Game not found' });
    }
    const result = {
      gameId: g.gameId,
      gameTime: g.gameDate,
      homeTeam: g.homeTeam,
      awayTeam: g.awayTeam,
      venue: g.venue,
      predictions: ['openai', 'anthropic', 'grok', 'deepseek']
        .filter(k => g.predictions[k])
        .map(k => ({ source: k, text: g.predictions[k] }))
    };
    res.json(result);
  } catch (err) {
    console.error('Error fetching game prediction:', err);
    res.status(500).json({ error: 'Failed to fetch prediction' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
