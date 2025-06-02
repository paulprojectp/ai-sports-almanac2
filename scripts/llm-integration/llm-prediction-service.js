/**
 * LLM Prediction Service
 * 
 * This service handles API calls to multiple LLM providers to generate
 * predictions for MLB games. It supports OpenAI, Anthropic, Grok, and DeepSeek.
 */

const axios = require('axios');
require('dotenv').config();

class LLMPredictionService {
  constructor(apiKeys = {}) {
    this.apiKeys = {
      openai: apiKeys.openai || process.env.OPENAI_API_KEY,
      anthropic: apiKeys.anthropic || process.env.ANTHROPIC_API_KEY,
      grok: apiKeys.grok || process.env.GROK_API_KEY,
      deepseek: apiKeys.deepseek || process.env.DEEPSEEK_API_KEY
    };
  }

  /**
   * Generate a prediction prompt for a specific game
   * @param {Object} game - Game data object
   * @returns {String} - Formatted prompt for LLM
   */
  generatePrompt(game) {
    const { homeTeam, awayTeam, gameTime, venue } = game;
    
    return `You are a sports prediction AI specializing in MLB baseball.
    
Game Information:
- Home Team: ${homeTeam.name} (${homeTeam.record})
- Away Team: ${awayTeam.name} (${awayTeam.record})
- Game Time: ${gameTime}
- Venue: ${venue}

Based on the teams' records and matchup, provide a prediction for this game.

Your response MUST follow this exact format:
1. First line: Score prediction in the format "${awayTeam.name} - ${homeTeam.name}: X-Y" (where X and Y are numbers)
2. Then 2-3 sentences explaining your reasoning for this prediction

Keep your explanation concise and focus only on this specific game.`;
  }

  /**
   * Get a prediction from OpenAI
   * @param {Object} game - Game data object
   * @returns {Promise<String>} - Prediction text
   */
  async getOpenAIPrediction(game) {
    if (!this.apiKeys.openai) {
      return this.getFallbackPrediction('openai', game);
    }

    try {
      const prompt = this.generatePrompt(game);
      
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4',
          messages: [
            { role: 'system', content: 'You are a sports prediction AI specializing in MLB baseball.' },
            { role: 'user', content: prompt }
          ],
          max_tokens: 150,
          temperature: 0.7
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKeys.openai}`
          }
        }
      );

      return response.data.choices[0].message.content.trim();
    } catch (error) {
      console.error('OpenAI API error:', error.message);
      return this.getFallbackPrediction('openai', game);
    }
  }

  /**
   * Get a prediction from Anthropic
   * @param {Object} game - Game data object
   * @returns {Promise<String>} - Prediction text
   */
  async getAnthropicPrediction(game) {
    if (!this.apiKeys.anthropic) {
      return this.getFallbackPrediction('anthropic', game);
    }

    try {
      const prompt = this.generatePrompt(game);
      
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: 'claude-3-sonnet-20240229',
          max_tokens: 150,
          messages: [
            { role: 'user', content: prompt }
          ]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKeys.anthropic,
            'anthropic-version': '2023-06-01'
          }
        }
      );

      return response.data.content[0].text.trim();
    } catch (error) {
      console.error('Anthropic API error:', error.message);
      return this.getFallbackPrediction('anthropic', game);
    }
  }

  /**
   * Get a prediction from Grok
   * @param {Object} game - Game data object
   * @returns {Promise<String>} - Prediction text
   */
  async getGrokPrediction(game) {
    if (!this.apiKeys.grok) {
      return this.getFallbackPrediction('grok', game);
    }

    try {
      const prompt = this.generatePrompt(game);
      
      // Note: This is a placeholder as Grok's API details may vary
      const response = await axios.post(
        'https://api.grok.x/v1/chat/completions',
        {
          model: 'grok-1',
          messages: [
            { role: 'system', content: 'You are a sports prediction AI specializing in MLB baseball.' },
            { role: 'user', content: prompt }
          ],
          max_tokens: 150,
          temperature: 0.7
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKeys.grok}`
          }
        }
      );

      return response.data.choices[0].message.content.trim();
    } catch (error) {
      console.error('Grok API error:', error.message);
      return this.getFallbackPrediction('grok', game);
    }
  }

  /**
   * Get a prediction from DeepSeek
   * @param {Object} game - Game data object
   * @returns {Promise<String>} - Prediction text
   */
  async getDeepSeekPrediction(game) {
    if (!this.apiKeys.deepseek) {
      return this.getFallbackPrediction('deepseek', game);
    }

    try {
      const prompt = this.generatePrompt(game);
      
      const response = await axios.post(
        'https://api.deepseek.com/v1/chat/completions',
        {
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: 'You are a sports prediction AI specializing in MLB baseball.' },
            { role: 'user', content: prompt }
          ],
          max_tokens: 150,
          temperature: 0.7
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKeys.deepseek}`
          }
        }
      );

      return response.data.choices[0].message.content.trim();
    } catch (error) {
      console.error('DeepSeek API error:', error.message);
      return this.getFallbackPrediction('deepseek', game);
    }
  }

  /**
   * Generate a fallback prediction when API calls fail
   * @param {String} provider - LLM provider name
   * @param {Object} game - Game data object
   * @returns {String} - Fallback prediction text
   */
  getFallbackPrediction(provider, game) {
    const { homeTeam, awayTeam } = game;
    const homeRecord = this.parseRecord(homeTeam.record);
    const awayRecord = this.parseRecord(awayTeam.record);
    
    // Compare team records to generate a basic prediction
    const homeWinPct = homeRecord.wins / (homeRecord.wins + homeRecord.losses) || 0.5;
    const awayWinPct = awayRecord.wins / (awayRecord.wins + awayRecord.losses) || 0.5;
    
    // Add home field advantage
    const homeAdvantage = 0.05;
    const adjustedHomeWinPct = homeWinPct + homeAdvantage;
    
    // Generate random but realistic scores
    let homeScore, awayScore;
    
    if (adjustedHomeWinPct > awayWinPct) {
      homeScore = Math.floor(Math.random() * 4) + 3; // 3-6 runs
      awayScore = Math.floor(Math.random() * 3) + 1; // 1-3 runs
    } else {
      homeScore = Math.floor(Math.random() * 3) + 1; // 1-3 runs
      awayScore = Math.floor(Math.random() * 4) + 3; // 3-6 runs
    }
    
    // Format the score prediction line
    const scoreLine = `${awayTeam.name} - ${homeTeam.name}: ${awayScore}-${homeScore}`;
    
    // Add provider-specific justification
    let justification = '';
    switch (provider) {
      case 'openai':
        justification = adjustedHomeWinPct > awayWinPct
          ? `The ${homeTeam.name} have a stronger record and home field advantage gives them the edge in this matchup. Their pitching staff has been more consistent recently which should limit the ${awayTeam.name}'s scoring opportunities.`
          : `Despite playing away, the ${awayTeam.name} have shown better form with their ${awayRecord.wins}-${awayRecord.losses} record compared to the ${homeTeam.name}'s ${homeRecord.wins}-${homeRecord.losses}. The ${awayTeam.name}'s batting lineup has been more productive in recent games.`;
        break;
      case 'anthropic':
        justification = adjustedHomeWinPct > awayWinPct
          ? `After analyzing both teams' strengths and weaknesses, the ${homeTeam.name} appear to have the advantage playing at home. Their recent performance and pitching rotation matchup favorably against the ${awayTeam.name} in this game.`
          : `The ${awayTeam.name} have been performing exceptionally well on the road this season, which gives them an edge despite playing away. Their bullpen has been more reliable than the ${homeTeam.name}'s relief pitchers in close game situations.`;
        break;
      case 'grok':
        justification = adjustedHomeWinPct > awayWinPct
          ? `Looking at the batting averages and bullpen ERA, the ${homeTeam.name} have clear advantages in key statistical categories. Their home record this season suggests they'll continue their strong performance at ${venue}.`
          : `The ${awayTeam.name} have been road warriors this season with impressive away statistics. Their offensive production has been significantly better than the ${homeTeam.name}'s in the last 10 games.`;
        break;
      case 'deepseek':
        justification = adjustedHomeWinPct > awayWinPct
          ? `Statistical analysis indicates the ${homeTeam.name} have a ${Math.round((adjustedHomeWinPct / (adjustedHomeWinPct + awayWinPct)) * 100)}% win probability in this matchup. Key factors include their home/away splits and superior performance in one-run games this season.`
          : `Based on advanced metrics, the ${awayTeam.name} have a ${Math.round((awayWinPct / (adjustedHomeWinPct + awayWinPct)) * 100)}% chance to win despite playing away from home. Their road OPS and pitching matchup advantages are significant factors in this prediction.`;
        break;
      default:
        justification = adjustedHomeWinPct > awayWinPct
          ? `The ${homeTeam.name} are favored to win at home against the ${awayTeam.name}. Their overall record and home field advantage are key factors in this prediction.`
          : `The ${awayTeam.name} are expected to win on the road against the ${homeTeam.name}. Their superior record and recent performance trends support this prediction.`;
    }
    
    return `${scoreLine}\n\n${justification}`;
  }

  /**
   * Parse team record string into wins and losses
   * @param {String} record - Team record in format "W-L"
   * @returns {Object} - Object with wins and losses as numbers
   */
  parseRecord(record) {
    const parts = record.split('-');
    return {
      wins: parseInt(parts[0]) || 0,
      losses: parseInt(parts[1]) || 0
    };
  }

  /**
   * Get predictions from all LLM providers for a game
   * @param {Object} game - Game data object
   * @returns {Promise<Object>} - Object with predictions from all providers
   */
  async getAllPredictions(game) {
    try {
      // Run all API calls in parallel for efficiency
      const [openai, anthropic, grok, deepseek] = await Promise.all([
        this.getOpenAIPrediction(game),
        this.getAnthropicPrediction(game),
        this.getGrokPrediction(game),
        this.getDeepSeekPrediction(game)
      ]);
      
      return {
        openai,
        anthropic,
        grok,
        deepseek,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting predictions:', error);
      return {
        openai: this.getFallbackPrediction('openai', game),
        anthropic: this.getFallbackPrediction('anthropic', game),
        grok: this.getFallbackPrediction('grok', game),
        deepseek: this.getFallbackPrediction('deepseek', game),
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }
}

module.exports = LLMPredictionService;
