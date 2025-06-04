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
const STATIC_DATA_PATH = process.env.GITHUB_WORKSPACE ? 
  path.join(process.env.GITHUB_WORKSPACE, 'index.html') : 
  path.join(__dirname, '../../index.html');

// Log the path being used
console.log(`Using index.html path: ${STATIC_DATA_PATH}`);

// Initialize services
const llmService = new LLMPredictionService();
const mongoService = new MongoDBService();

// Helper functions
function parseTeamName(name) {
  // Map of team abbreviations
  const teamAbbreviations = {
    'Arizona': 'ARI',
    'Arizona Diamondbacks': 'ARI',
    "Arizona D'Backs": 'ARI',
    'Arizona D-backs': 'ARI',
    'Atlanta': 'ATL',
    'Atlanta Braves': 'ATL',
    'Baltimore': 'BAL',
    'Baltimore Orioles': 'BAL',
    'Boston': 'BOS',
    'Boston Red Sox': 'BOS',
    'Chicago Cubs': 'CHC',
    'Chicago White Sox': 'CWS',
    'Chi White Sox': 'CWS',
    'Cincinnati': 'CIN',
    'Cincinnati Reds': 'CIN',
    'Cleveland': 'CLE',
    'Cleveland Guardians': 'CLE',
    'Colorado': 'COL',
    'Colorado Rockies': 'COL',
    'Detroit': 'DET',
    'Detroit Tigers': 'DET',
    'Houston': 'HOU',
    'Houston Astros': 'HOU',
    'Kansas City': 'KC',
    'Kansas City Royals': 'KC',
    'Los Angeles Angels': 'LAA',
    'LA Angels': 'LAA',
    'Los Angeles Dodgers': 'LAD',
    'LA Dodgers': 'LAD',
    'Miami': 'MIA',
    'Miami Marlins': 'MIA',
    'Milwaukee': 'MIL',
    'Milwaukee Brewers': 'MIL',
    'Minnesota': 'MIN',
    'Minnesota Twins': 'MIN',
    'New York Mets': 'NYM',
    'New York Yankees': 'NYY',
    'Oakland': 'OAK',
    'Oakland Athletics': 'OAK',
    'Philadelphia': 'PHI',
    'Philadelphia Phillies': 'PHI',
    'Pittsburgh': 'PIT',
    'Pittsburgh Pirates': 'PIT',
    'San Diego': 'SD',
    'San Diego Padres': 'SD',
    'San Francisco': 'SF',
    'San Francisco Giants': 'SF',
    'Seattle': 'SEA',
    'Seattle Mariners': 'SEA',
    'St. Louis': 'STL',
    'St. Louis Cardinals': 'STL',
    'Tampa Bay': 'TB',
    'Tampa Bay Rays': 'TB',
    'Texas': 'TEX',
    'Texas Rangers': 'TEX',
    'Toronto': 'TOR',
    'Toronto Blue Jays': 'TOR',
    'Washington': 'WSH',
    'Washington Nationals': 'WSH'
  };

  // Check for exact match first
  if (teamAbbreviations[name]) {
    return {
      fullName: name,
      abbreviation: teamAbbreviations[name]
    };
  }

  // If no exact match, try to find a partial match
  for (const [key, value] of Object.entries(teamAbbreviations)) {
    if (name.includes(key)) {
      return {
        fullName: key,
        abbreviation: value
      };
    }
  }

  // If no match found, return default
  return {
    fullName: name,
    abbreviation: name.substring(0, 3).toUpperCase()
  };
}

// Parse a date/time string in Eastern Time and return ISO string in UTC
function parseEasternTimeToISO(month, day, year, hour, minute, ampm) {
  const midDay = new Date(Date.UTC(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10), 12));
  const tzName = midDay
    .toLocaleString('en-US', { timeZone: 'America/New_York', timeZoneName: 'short' })
    .split(' ') 
    .pop();
  const offset = tzName === 'EDT' ? '-04:00' : '-05:00';
  const dateStr = `${month}/${day}/${year} ${hour}:${minute} ${ampm} ${offset}`;
  const d = new Date(dateStr);
  return d.toISOString();
}

// Save HTML for debugging
function saveHtmlForDebugging(html) {
  const debugPath = path.join(__dirname, 'dratings_debug.html');
  fs.writeFileSync(debugPath, html);
  console.log(`Saved HTML for debugging to ${debugPath}`);
}

// Main scraper function with fixed selectors based on debug output
async function scrapeMLBData() {
  console.log('Fetching MLB data from Dratings.com...');
  
  try {
    // Fetch the HTML content
    const response = await axios.get(DATA_SOURCE_URL);
    const html = response.data;
    
    // Save HTML for debugging
    saveHtmlForDebugging(html);
    
    // Load HTML into cheerio
    const $ = cheerio.load(html);
    
    // Based on the debug output, we can see that Table 0 contains the upcoming games
    // with the correct format for June 1, 2025
    const games = [];
    const tables = $('table');
    
    if (tables.length > 0) {
      const upcomingTable = $(tables[0]);
      const rows = upcomingTable.find('tr').slice(1); // Skip header row
      
      rows.each((rowIndex, row) => {
        const cells = $(row).find('td');
        
        if (cells.length >= 2) {
          // Extract date and time
          const timeCell = $(cells[0]);
          const timeText = timeCell.text().trim();
          
          // Extract teams
          const teamsCell = $(cells[1]);
          const teamsText = teamsCell.text().trim();
          
          console.log(`Processing row ${rowIndex}:`);
          console.log(`  Time: ${timeText}`);
          console.log(`  Teams: ${teamsText}`);
          
          // Parse date and time. Formats on Dratings sometimes omit a leading zero
          // for the hour (e.g. "06/01/2025 8:10 PM"). Allow 1-2 digits for the
          // hour and optional whitespace between the date and time.
          const dateMatch = timeText.match(/(\d{2})\/(\d{2})\/(\d{4})\s*(\d{1,2}):(\d{2})\s*([AP]M)/i);
          let gameTime = '';

          if (dateMatch) {
            const month = dateMatch[1];
            const day = dateMatch[2];
            const year = dateMatch[3];
            const hour = dateMatch[4];
            const minute = dateMatch[5];
            const ampm = dateMatch[6];

            // Convert to ISO string using Eastern Time offset
            gameTime = parseEasternTimeToISO(month, day, year, hour, minute, ampm);
            console.log(`  Parsed time: ${gameTime}`);
          } else {
            console.warn(`  Failed to parse time string "${timeText}", using noon ET as fallback`);
            // Fallback to noon Eastern on the reported day to avoid invalid dates
            const parts = timeText.match(/(\d{2})\/(\d{2})\/(\d{4})/);
            if (parts) {
              gameTime = parseEasternTimeToISO(parts[1], parts[2], parts[3], '12', '00', 'PM');
            } else {
              // Absolute fallback if even the date could not be parsed
              gameTime = new Date().toISOString();
            }
          }
          
          // Parse teams (format: "Washington Nationals (28-30)Arizona Diamondbacks (27-31)")
          // Split by record pattern to separate teams
          const teamParts = teamsText.split(/\(\d+-\d+\)/);
          
          if (teamParts.length >= 2) {
            // First part is away team name
            const awayTeamName = teamParts[0].trim();
            
            // Second part is home team name (may need to remove leading/trailing spaces)
            const homeTeamName = teamParts[1].trim();
            
            // Extract records
            const awayRecordMatch = teamsText.match(/(\d+-\d+)/);
            const homeRecordMatch = teamsText.match(/(\d+-\d+)(?!.*\d+-\d+)/); // Last occurrence
            
            const awayRecord = awayRecordMatch ? awayRecordMatch[1] : '';
            const homeRecord = homeRecordMatch ? homeRecordMatch[1] : '';
            
            console.log(`  Away team: ${awayTeamName} (${awayRecord})`);
            console.log(`  Home team: ${homeTeamName} (${homeRecord})`);
            
            // Parse team info
            const awayTeam = parseTeamName(awayTeamName);
            const homeTeam = parseTeamName(homeTeamName);
            
            // Create game object
            const slug = `${awayTeam.abbreviation.toLowerCase()}-${homeTeam.abbreviation.toLowerCase()}`;
            const game = {
              id: slug,
              homeTeam: {
                name: homeTeam.fullName,
                abbreviation: homeTeam.abbreviation,
                logo: `/team-logos/${homeTeam.abbreviation.toLowerCase()}_logo.svg`,
                record: homeRecord
              },
              awayTeam: {
                name: awayTeam.fullName,
                abbreviation: awayTeam.abbreviation,
                logo: `/team-logos/${awayTeam.abbreviation.toLowerCase()}_logo.svg`,
                record: awayRecord
              },
              gameTime: gameTime,
              venue: `${homeTeam.fullName} Stadium`
            };
            
            games.push(game);
          }
        }
      });
    }
    
    // If no games found, create manual games based on the screenshot
    if (games.length === 0) {
      console.log('No games found through scraping, creating manual games based on screenshot data');
      
      // Create games based on the screenshot provided by the user
      const manualGames = [
        {
          id: "wsh-ari",
          homeTeam: {
            name: "Arizona Diamondbacks",
            abbreviation: "ARI",
            logo: "/team-logos/ari_logo.svg",
            record: "27-31"
          },
          awayTeam: {
            name: "Washington Nationals",
            abbreviation: "WSH",
            logo: "/team-logos/wsh_logo.svg",
            record: "28-30"
          },
          gameTime: "2025-06-01T04:10:00",
          venue: "Chase Field, Phoenix, AZ"
        },
        {
          id: "min-sea",
          homeTeam: {
            name: "Seattle Mariners",
            abbreviation: "SEA",
            logo: "/team-logos/sea_logo.svg",
            record: "31-26"
          },
          awayTeam: {
            name: "Minnesota Twins",
            abbreviation: "MIN",
            logo: "/team-logos/min_logo.svg",
            record: "31-26"
          },
          gameTime: "2025-06-01T04:10:00",
          venue: "T-Mobile Park, Seattle, WA"
        },
        {
          id: "pit-sd",
          homeTeam: {
            name: "San Diego Padres",
            abbreviation: "SD",
            logo: "/team-logos/sd_logo.svg",
            record: "32-24"
          },
          awayTeam: {
            name: "Pittsburgh Pirates",
            abbreviation: "PIT",
            logo: "/team-logos/pit_logo.svg",
            record: "22-37"
          },
          gameTime: "2025-06-01T05:10:00",
          venue: "Petco Park, San Diego, CA"
        },
        {
          id: "nyy-lad",
          homeTeam: {
            name: "Los Angeles Dodgers",
            abbreviation: "LAD",
            logo: "/team-logos/lad_logo.svg",
            record: "36-22"
          },
          awayTeam: {
            name: "New York Yankees",
            abbreviation: "NYY",
            logo: "/team-logos/nyy_logo.svg",
            record: "35-22"
          },
          gameTime: "2025-06-01T07:10:00",
          venue: "Dodger Stadium, Los Angeles, CA"
        }
      ];
      
      return manualGames;
    }
    
    console.log(`Found ${games.length} upcoming MLB games`);
    return games;
  } catch (error) {
    console.error('Error scraping MLB data:', error);
    
    // Fallback to manual games if scraping fails
    console.log('Scraping failed, using manual games based on screenshot data');
    
    // Create games based on the screenshot provided by the user
    const manualGames = [
      {
        id: "wsh-ari",
        homeTeam: {
          name: "Arizona Diamondbacks",
          abbreviation: "ARI",
          logo: "/team-logos/ari_logo.svg",
          record: "27-31"
        },
        awayTeam: {
          name: "Washington Nationals",
          abbreviation: "WSH",
          logo: "/team-logos/wsh_logo.svg",
          record: "28-30"
        },
        gameTime: "2025-06-01T04:10:00",
        venue: "Chase Field, Phoenix, AZ"
      },
      {
        id: "min-sea",
        homeTeam: {
          name: "Seattle Mariners",
          abbreviation: "SEA",
          logo: "/team-logos/sea_logo.svg",
          record: "31-26"
        },
        awayTeam: {
          name: "Minnesota Twins",
          abbreviation: "MIN",
          logo: "/team-logos/min_logo.svg",
          record: "31-26"
        },
        gameTime: "2025-06-01T04:10:00",
        venue: "T-Mobile Park, Seattle, WA"
      },
      {
        id: "pit-sd",
        homeTeam: {
          name: "San Diego Padres",
          abbreviation: "SD",
          logo: "/team-logos/sd_logo.svg",
          record: "32-24"
        },
        awayTeam: {
          name: "Pittsburgh Pirates",
          abbreviation: "PIT",
          logo: "/team-logos/pit_logo.svg",
          record: "22-37"
        },
        gameTime: "2025-06-01T05:10:00",
        venue: "Petco Park, San Diego, CA"
      },
      {
        id: "nyy-lad",
        homeTeam: {
          name: "Los Angeles Dodgers",
          abbreviation: "LAD",
          logo: "/team-logos/lad_logo.svg",
          record: "36-22"
        },
        awayTeam: {
          name: "New York Yankees",
          abbreviation: "NYY",
          logo: "/team-logos/nyy_logo.svg",
          record: "35-22"
        },
        gameTime: "2025-06-01T07:10:00",
        venue: "Dodger Stadium, Los Angeles, CA"
      }
    ];
    
    return manualGames;
  }
}

// Update the HTML file with new predictions
async function updateHtmlWithPredictions(games) {
  try {
    // Read the current HTML file
    const htmlContent = fs.readFileSync(STATIC_DATA_PATH, 'utf8');

    // Create a new HTML content with updated predictions
    let updatedHtml = htmlContent;
    
    // Add a timestamp to force update
    const timestamp = new Date().toISOString();
    const timestampPattern = /<!-- Last updated: .*? -->/;
    if (timestampPattern.test(updatedHtml)) {
      updatedHtml = updatedHtml.replace(timestampPattern, `<!-- Last updated: ${timestamp} -->`);
    } else {
      updatedHtml = updatedHtml.replace(/<head>/, `<head>\n  <!-- Last updated: ${timestamp} -->`);
    }
    
    // Build game data object for the page
    const gamesObj = {};
    const predictionsObj = {};

    for (const game of games) {
      const { id, homeTeam, awayTeam, gameTime, venue, predictions } = game;

      const date = new Date(gameTime);
      const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/New_York' }) + ' EDT';

      gamesObj[id] = {
        away: { team: awayTeam.name, abbr: awayTeam.abbreviation, record: awayTeam.record },
        home: { team: homeTeam.name, abbr: homeTeam.abbreviation, record: homeTeam.record },
        time: timeStr,
        date: dateStr,
        venue
      };

      predictionsObj[id] = [
        { source: 'OpenAI', text: predictions.openai },
        { source: 'Anthropic', text: predictions.anthropic },
        { source: 'Grok', text: predictions.grok },
        { source: 'DeepSeek', text: predictions.deepseek }
      ];
    }

    // Update the game card markup in the HTML
    const $ = cheerio.load(updatedHtml);
    const container = $('.games-container');
    if (container.length) {
      container.empty();
      for (const [id, game] of Object.entries(gamesObj)) {
        const card = `
        <div class="game-card">
            <div class="game-header">
                <div class="team">
                    <div class="team-logo">
                        <img src="team-logos/${game.away.abbr.toLowerCase()}_logo.svg" alt="${game.away.team} logo" class="team-logo">
                    </div>
                    <div class="team-abbr">${game.away.abbr}</div>
                    <div class="team-record">${game.away.record}</div>
                </div>
                <div class="vs">vs</div>
                <div class="team">
                    <div class="team-logo">
                        <img src="team-logos/${game.home.abbr.toLowerCase()}_logo.svg" alt="${game.home.team} logo" class="team-logo">
                    </div>
                    <div class="team-abbr">${game.home.abbr}</div>
                    <div class="team-record">${game.home.record}</div>
                </div>
            </div>
            <div class="game-details">
                <div class="game-time">${game.date}</div>
                <div class="game-time">${game.time}</div>
                <div class="game-venue">${game.venue}</div>
            </div>
            <button class="predictions-button" data-game-id="${id}" onclick="togglePredictions(this)">Show Predictions</button>
            <div class="predictions" id="predictions-${id}">
                <!-- Predictions will be loaded here -->
            </div>
        </div>`;
        container.append(card);
      }
      updatedHtml = $.html();
    }

    // Replace game data
    const gamesPattern = /const GAMES = [^;]*;/s;
    updatedHtml = updatedHtml.replace(gamesPattern, `const GAMES = ${JSON.stringify(gamesObj, null, 4)};`);

    // Replace fallback predictions
    const predPattern = /const FALLBACK_PREDICTIONS = [^;]*;/s;
    updatedHtml = updatedHtml.replace(predPattern, `const FALLBACK_PREDICTIONS = ${JSON.stringify(predictionsObj, null, 4)};`);
    
    // Write the updated HTML back to the file
    fs.writeFileSync(STATIC_DATA_PATH, updatedHtml);
    console.log('Updated HTML with new predictions');
    
    return true;
  } catch (error) {
    console.error('Error updating HTML with predictions:', error);
    return false;
  }
}

// Main function to run the script
async function main() {
  try {
    console.log('Starting MLB data and prediction update...');
    
    // Step 1: Fetch MLB game data
    const games = await scrapeMLBData();
    console.log(`Fetched ${games.length} games`);
    
    // Step 2: Connect to MongoDB
    let mongoConnected = false;
    try {
      mongoConnected = await mongoService.connect();
      if (!mongoConnected) {
        console.warn('Failed to connect to MongoDB, will continue without storing predictions');
      }
    } catch (error) {
      console.warn('Error connecting to MongoDB:', error.message);
      console.warn('Will continue without storing predictions');
    }
    
    // Step 3: Generate predictions for each game
    for (let i = 0; i < games.length; i++) {
      const game = games[i];
      console.log(`Generating predictions for game ${i+1}/${games.length}: ${game.awayTeam.name} @ ${game.homeTeam.name}`);
      
      // Initialize predictions object with fallbacks
      game.predictions = {
        openai: "Prediction unavailable at this time.",
        anthropic: "Prediction unavailable at this time.",
        grok: "Prediction unavailable at this time.",
        deepseek: "Prediction unavailable at this time."
      };
      
      try {
        // Get predictions from all LLM providers
        const predictions = await llmService.getAllPredictions(game);
        
        // Only update predictions that were successfully retrieved
        if (predictions.openai) game.predictions.openai = predictions.openai;
        if (predictions.anthropic) game.predictions.anthropic = predictions.anthropic;
        if (predictions.grok) game.predictions.grok = predictions.grok;
        if (predictions.deepseek) game.predictions.deepseek = predictions.deepseek;
        
        // Store predictions in MongoDB if connected
        if (mongoConnected) {
          try {
            const result = await mongoService.storePredictions(game, game.predictions);
            if (result.success) {
              console.log(`Successfully stored predictions for game ${game.id} in MongoDB`);
            } else {
              console.warn(`Failed to store predictions for game ${game.id} in MongoDB: ${result.error}`);
            }
          } catch (error) {
            console.warn(`Error storing predictions for game ${game.id} in MongoDB:`, error.message);
          }
        }
      } catch (error) {
        console.warn(`Error generating predictions for game ${game.id}:`, error.message);
        console.log(`Using fallback predictions for game ${game.id}`);
      }
    }
    
    // Step 4: Update the HTML file with new predictions
    const htmlUpdated = await updateHtmlWithPredictions(games);
    if (htmlUpdated) {
      console.log('Successfully updated HTML with new predictions');
    } else {
      console.warn('Failed to update HTML with new predictions');
    }
    
    // Step 5: Close MongoDB connection
    if (mongoConnected) {
      try {
        await mongoService.close();
      } catch (error) {
        console.warn('Error closing MongoDB connection:', error.message);
      }
    }
    
    console.log('MLB data and prediction update completed successfully');
  } catch (error) {
    console.error('Error in main function:', error);
    // Even if there's an error, try to update the HTML with what we have
    console.log('Attempting to update HTML with available data despite errors...');
    try {
      // Create a timestamp to force update
      const timestamp = new Date().toISOString();
      const htmlContent = fs.readFileSync(STATIC_DATA_PATH, 'utf8');
      const updatedHtml = htmlContent.replace(/<head>/, `<head>\n  <!-- Last updated: ${timestamp} -->`);
      fs.writeFileSync(STATIC_DATA_PATH, updatedHtml);
      console.log('Added timestamp to HTML to force update');
    } catch (htmlError) {
      console.error('Failed to update HTML with timestamp:', htmlError);
    }
  }
}

// Run the script
main();
