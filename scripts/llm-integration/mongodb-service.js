/**
 * MongoDB Service
 * 
 * This service handles connections to MongoDB and provides methods
 * for storing and retrieving LLM predictions for MLB games.
 */

const { MongoClient } = require('mongodb');
require('dotenv').config();

class MongoDBService {
  constructor(uri = null) {
    this.uri = uri || process.env.MONGODB_URI;
    this.client = null;
    this.db = null;
    this.predictions = null;
  }

  /**
   * Connect to MongoDB
   * @returns {Promise<boolean>} - Connection success status
   */
  async connect() {
    if (!this.uri) {
      console.error('MongoDB URI not provided');
      return false;
    }

    try {
      this.client = new MongoClient(this.uri);
      await this.client.connect();

      const dbName = process.env.MONGODB_DB_NAME || 'ai-sports-almanac';
      this.db = this.client.db(dbName);
      this.predictions = this.db.collection('predictions');
      
      console.log('Connected to MongoDB');
      return true;
    } catch (error) {
      console.error('MongoDB connection error:', error);
      return false;
    }
  }

  /**
   * Close MongoDB connection
   */
  async close() {
    if (this.client) {
      await this.client.close();
      console.log('MongoDB connection closed');
    }
  }

  /**
   * Store predictions for a game
   * @param {Object} game - Game data object
   * @param {Object} predictions - Predictions from all LLM providers
   * @returns {Promise<Object>} - Result of the operation
   */
  async storePredictions(game, predictions) {
    if (!this.predictions) {
      const connected = await this.connect();
      if (!connected) {
        return { success: false, error: 'Failed to connect to MongoDB' };
      }
    }

    try {
      // Create a document with game info and predictions
      const document = {
        gameId: game.id,
        gameDate: new Date(game.gameTime),
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        venue: game.venue,
        predictions: predictions,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Check if prediction for this game already exists
      const existingPrediction = await this.predictions.findOne({ gameId: game.id });
      
      let result;
      if (existingPrediction) {
        // Update existing prediction
        result = await this.predictions.updateOne(
          { gameId: game.id },
          { $set: { predictions: predictions, updatedAt: new Date() } }
        );
        console.log(`Updated predictions for game ${game.id}`);
      } else {
        // Insert new prediction
        result = await this.predictions.insertOne(document);
        console.log(`Stored new predictions for game ${game.id}`);
      }

      return { success: true, result };
    } catch (error) {
      console.error('Error storing predictions:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get predictions for a game
   * @param {String} gameId - Game ID
   * @returns {Promise<Object>} - Game predictions or null if not found
   */
  async getPredictions(gameId) {
    if (!this.predictions) {
      const connected = await this.connect();
      if (!connected) {
        return null;
      }
    }

    try {
      const result = await this.predictions.findOne({ gameId });
      return result;
    } catch (error) {
      console.error('Error getting predictions:', error);
      return null;
    }
  }

  /**
   * Get predictions for all games on a specific date
   * @param {Date} date - Date to filter by
   * @returns {Promise<Array>} - Array of game predictions
   */
  async getPredictionsByDate(date) {
    if (!this.predictions) {
      const connected = await this.connect();
      if (!connected) {
        return [];
      }
    }

    try {
      // Create start and end of the day for date filtering
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      
      const results = await this.predictions
        .find({ 
          gameDate: { 
            $gte: startDate, 
            $lte: endDate 
          } 
        })
        .toArray();
        
      return results;
    } catch (error) {
      console.error('Error getting predictions by date:', error);
      return [];
    }
  }

  /**
   * Delete predictions for a game
   * @param {String} gameId - Game ID
   * @returns {Promise<boolean>} - Success status
   */
  async deletePredictions(gameId) {
    if (!this.predictions) {
      const connected = await this.connect();
      if (!connected) {
        return false;
      }
    }

    try {
      const result = await this.predictions.deleteOne({ gameId });
      console.log(`Deleted predictions for game ${gameId}`);
      return result.deletedCount > 0;
    } catch (error) {
      console.error('Error deleting predictions:', error);
      return false;
    }
  }
}

module.exports = MongoDBService;
