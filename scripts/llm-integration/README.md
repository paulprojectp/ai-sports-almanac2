# AI Sports Almanac - LLM Integration

This directory contains scripts for integrating real LLM predictions into the AI Sports Almanac site.

## Overview

The integration consists of three main components:

1. **LLM Prediction Service** - Makes API calls to OpenAI, Anthropic, Grok, and DeepSeek to generate real predictions for MLB games
2. **MongoDB Service** - Stores and retrieves predictions from MongoDB
3. **Fetch and Predict Script** - Main script that fetches game data, generates predictions, and updates the site

## Setup

1. Install dependencies:
```
npm install axios cheerio dotenv mongodb
```

2. Create a `.env` file in the project root with your API keys and MongoDB connection string:
```
# API Keys for LLM Providers
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
GROK_API_KEY=your_grok_api_key
DEEPSEEK_API_KEY=your_deepseek_api_key

# MongoDB Connection
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net
MONGODB_DB_NAME=ai-sports-almanac

# Data Source URL
DATA_SOURCE_URL=https://www.dratings.com/predictor/mlb-baseball-predictions/
```

## Usage

Run the main script to fetch game data, generate predictions, and update the site:

```
node scripts/llm-integration/fetch-and-predict.js
```

This will:
1. Fetch real MLB game data from Dratings.com
2. Generate predictions using the configured LLM providers
3. Store predictions in MongoDB (if connection is successful)
4. Update the site's HTML with the new predictions

## Prediction Format

All LLM predictions follow this format:
1. First line: Score prediction in the format "Team A - Team B: X-Y"
2. 2-3 sentences explaining the reasoning for the prediction

## Files

- `llm-prediction-service.js` - Service for making API calls to LLM providers
- `mongodb-service.js` - Service for storing and retrieving predictions from MongoDB
- `fetch-and-predict.js` - Main script that orchestrates the entire process

## Automation

You can set up a cron job to run the script automatically on a schedule:

```
0 */6 * * * cd /path/to/ai-sports-almanac2 && node scripts/llm-integration/fetch-and-predict.js
```

This will update predictions every 6 hours.
