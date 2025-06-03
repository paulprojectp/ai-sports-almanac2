/**
 * Main script to fetch MLB game data and generate LLM predictions
 * 
 * This script:
 * 1. Fetches real MLB game data from Dratings.com
 * 2. Generates predictions using multiple LLM providers
 * 3. Stores predictions in MongoDB
 * 4. Updates the static data file with the latest predictions
 */

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const LLMPredictionService = require('./llm-prediction-service');
const MongoDBService = require('./mongodb-service');
require('dotenv').config();

// Constants
const DATA_SOURCE_URL = process.env.DATA_SOURCE_URL || 'https://www.dratings.com/predictor/mlb-baseball-predictions/';
// Use absolute path for GitHub Actions environment
const STATIC_DATA_PATH = process.env.GITHUB_WORKSPACE ? 
  path.join(process.env.GITHUB_WORKSPACE, 'index.html') : 
  path.join(__dirname, '../../index.html');

console.log(`Using index.html path: ${STATIC_DATA_PATH}`);

// Initialize services
const llmService = new LLMPredictionService();
const mongoService = new MongoDBService();

// Rest of the script remains unchanged
