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
    const today = new Date();
    let games = await mongo.getPredictionsByDate(today);

    // Fallback to most recently updated games if none match today's date
    if (!games.length) {
      games = await mongo.getLatestPredictions();
    }

    const result = games.map(g => ({
      gameTime: g.gameDate,
      homeTeam: g.homeTeam,
      awayTeam: g.awayTeam,
      venue: g.venue,
      predictions: Object.entries(g.predictions).map(([source, text]) => ({ source, text }))
    }));

    res.json(result);
  } catch (err) {
    console.error('Error fetching predictions:', err);
    res.status(500).json({ error: 'Failed to fetch predictions' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
