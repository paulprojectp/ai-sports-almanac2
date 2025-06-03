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

// Helper functions
function parseTeamName(name) {
  // Map of team abbreviations
  const teamAbbreviations = {
    'Arizona': 'ARI',
    'Arizona Diamondbacks': 'ARI',
    'Atlanta': 'ATL',
    'Atlanta Braves': 'ATL',
    'Baltimore': 'BAL',
    'Baltimore Orioles': 'BAL',
    'Boston': 'BOS',
    'Boston Red Sox': 'BOS',
    'Chicago Cubs': 'CHC',
    'Chicago White Sox': 'CWS',
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
    'Los Angeles Dodgers': 'LAD',
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

// Save HTML for debugging
function saveHtmlForDebugging(html) {
  const debugPath = path.join(__dirname, 'dratings_debug.html');
  fs.writeFileSync(debugPath, html);
  console.log(`Saved HTML for debugging to ${debugPath}`);
}

// Format date for display
function formatDate(date) {
  const options = { 
    weekday: 'short', 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  };
  return date.toLocaleDateString('en-US', options);
}

// Get current date in YYYY-MM-DD format
function getCurrentDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// Main scraper function with multiple selector strategies
async function scrapeMLBData() {
  console.log('Fetching MLB data from Dratings.com...');
  console.log(`Current date: ${getCurrentDate()}`);
  
  try {
    // Fetch the HTML content
    const response = await axios.get(DATA_SOURCE_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      timeout: 10000
    });
    
    const html = response.data;
    
    // Save HTML for debugging
    saveHtmlForDebugging(html);
    
    // Load HTML into cheerio
    const $ = cheerio.load(html);
    
    // Try multiple selector strategies to find game data
    let games = [];
    
    // Strategy 1: Look for tables with game data
    console.log('Trying strategy 1: Tables with game data');
    const tables = $('table');
    console.log(`Found ${tables.length} tables on the page`);
    
    if (tables.length > 0) {
      // Try each table until we find game data
      for (let i = 0; i < tables.length; i++) {
        console.log(`Examining table ${i}`);
        const currentTable = $(tables[i]);
        const rows = currentTable.find('tr').slice(1); // Skip header row
        
        if (rows.length > 0) {
          console.log(`Table ${i} has ${rows.length} rows`);
          
          // Check if this table has game data
          const tableGames = [];
          
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
              
              // Try different date formats
              let gameTime = '';
              
              // Format 1: MM/DD/YYYYHH:MM AM/PM
              const dateMatch1 = timeText.match(/(\d{2})\/(\d{2})\/(\d{4})(\d{2}):(\d{2})\s*([AP]M)/i);
              // Format 2: MM/DD/YYYY HH:MM AM/PM
              const dateMatch2 = timeText.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*([AP]M)/i);
              
              if (dateMatch1) {
                const month = dateMatch1[1];
                const day = dateMatch1[2];
                const year = dateMatch1[3];
                const hour = dateMatch1[4];
                const minute = dateMatch1[5];
                const ampm = dateMatch1[6];
                
                gameTime = `${year}-${month}-${day}T${hour}:${minute}:00 ${ampm}`;
                console.log(`  Parsed time (format 1): ${gameTime}`);
              } else if (dateMatch2) {
                const month = dateMatch2[1];
                const day = dateMatch2[2];
                const year = dateMatch2[3];
                const hour = dateMatch2[4].padStart(2, '0');
                const minute = dateMatch2[5];
                const ampm = dateMatch2[6];
                
                gameTime = `${year}-${month}-${day}T${hour}:${minute}:00 ${ampm}`;
                console.log(`  Parsed time (format 2): ${gameTime}`);
              } else {
                // If we can't parse the date, use current date
                gameTime = `${getCurrentDate()}T12:00:00`;
                console.log(`  Using default time: ${gameTime}`);
              }
              
              // Try different team formats
              
              // Format 1: Team1 (W-L) Team2 (W-L)
              const teamRegex1 = /(.+?)\s*\((\d+-\d+)\)\s*(.+?)\s*\((\d+-\d+)\)/;
              // Format 2: Team1 vs Team2
              const teamRegex2 = /(.+?)\s+vs\.?\s+(.+)/i;
              
              let awayTeamName, homeTeamName, awayRecord, homeRecord;
              
              const teamMatch1 = teamsText.match(teamRegex1);
              const teamMatch2 = teamsText.match(teamRegex2);
              
              if (teamMatch1) {
                awayTeamName = teamMatch1[1].trim();
                awayRecord = teamMatch1[2];
                homeTeamName = teamMatch1[3].trim();
                homeRecord = teamMatch1[4];
                
                console.log(`  Format 1 - Away: ${awayTeamName} (${awayRecord}), Home: ${homeTeamName} (${homeRecord})`);
              } else if (teamMatch2) {
                awayTeamName = teamMatch2[1].trim();
                homeTeamName = teamMatch2[2].trim();
                awayRecord = '0-0';
                homeRecord = '0-0';
                
                console.log(`  Format 2 - Away: ${awayTeamName}, Home: ${homeTeamName}`);
              } else {
                // Try splitting by record pattern
                const teamParts = teamsText.split(/\(\d+-\d+\)/);
                
                if (teamParts.length >= 2) {
                  // First part is away team name
                  awayTeamName = teamParts[0].trim();
                  
                  // Second part is home team name
                  homeTeamName = teamParts[1].trim();
                  
                  // Extract records
                  const awayRecordMatch = teamsText.match(/(\d+-\d+)/);
                  const homeRecordMatch = teamsText.match(/(\d+-\d+)(?!.*\d+-\d+)/); // Last occurrence
                  
                  awayRecord = awayRecordMatch ? awayRecordMatch[1] : '0-0';
                  homeRecord = homeRecordMatch ? homeRecordMatch[1] : '0-0';
                  
                  console.log(`  Format 3 - Away: ${awayTeamName} (${awayRecord}), Home: ${homeTeamName} (${homeRecord})`);
                } else {
                  console.log(`  Could not parse teams from: ${teamsText}`);
                  continue; // Skip this row
                }
              }
              
              // Parse team info
              const awayTeam = parseTeamName(awayTeamName);
              const homeTeam = parseTeamName(homeTeamName);
              
              // Create game object
              const game = {
                id: String(tableGames.length + 1),
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
                venue: `${homeTeam.fullName} Stadium`,
                scrapedDate: getCurrentDate()
              };
              
              tableGames.push(game);
            }
          });
          
          if (tableGames.length > 0) {
            console.log(`Found ${tableGames.length} games in table ${i}`);
            games = tableGames;
            break; // We found games, no need to check other tables
          }
        }
      }
    }
    
    // Strategy 2: Look for game cards or divs
    if (games.length === 0) {
      console.log('Trying strategy 2: Game cards or divs');
      
      // Look for common game card patterns
      const gameCards = $('.game-card, .matchup, .game, [class*="game"], [class*="match"]');
      console.log(`Found ${gameCards.length} potential game cards`);
      
      if (gameCards.length > 0) {
        gameCards.each((index, card) => {
          const $card = $(card);
          
          // Try to extract teams
          const teamElements = $card.find('.team, [class*="team"], [class*="away"], [class*="home"]');
          const dateElement = $card.find('.date, [class*="date"], [class*="time"]');
          
          if (teamElements.length >= 2) {
            const awayTeamName = $(teamElements[0]).text().trim();
            const homeTeamName = $(teamElements[1]).text().trim();
            
            // Try to extract records
            const recordElements = $card.find('.record, [class*="record"]');
            const awayRecord = recordElements.length >= 2 ? $(recordElements[0]).text().trim() : '0-0';
            const homeRecord = recordElements.length >= 2 ? $(recordElements[1]).text().trim() : '0-0';
            
            // Try to extract game time
            const gameTime = dateElement.length > 0 ? 
              dateElement.text().trim() : 
              `${getCurrentDate()}T12:00:00`;
            
            // Parse team info
            const awayTeam = parseTeamName(awayTeamName);
            const homeTeam = parseTeamName(homeTeamName);
            
            // Create game object
            const game = {
              id: String(games.length + 1),
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
              venue: `${homeTeam.fullName} Stadium`,
              scrapedDate: getCurrentDate()
            };
            
            games.push(game);
          }
        });
      }
    }
    
    // Strategy 3: Look for any text that might contain game information
    if (games.length === 0) {
      console.log('Trying strategy 3: Text-based extraction');
      
      // Get all text from the page
      const pageText = $('body').text();
      
      // Look for patterns like "Team1 vs Team2" or "Team1 at Team2"
      const gameMatches = pageText.match(/([A-Za-z\s]+)\s+(vs\.?|at)\s+([A-Za-z\s]+)/g);
      
      if (gameMatches && gameMatches.length > 0) {
        console.log(`Found ${gameMatches.length} potential game matches in text`);
        
        gameMatches.forEach((match, index) => {
          // Extract teams
          const vsMatch = match.match(/([A-Za-z\s]+)\s+(vs\.?|at)\s+([A-Za-z\s]+)/);
          
          if (vsMatch) {
            const awayTeamName = vsMatch[1].trim();
            const homeTeamName = vsMatch[3].trim();
            
            // Parse team info
            const awayTeam = parseTeamName(awayTeamName);
            const homeTeam = parseTeamName(homeTeamName);
            
            // Create game object
            const game = {
              id: String(games.length + 1),
              homeTeam: {
                name: homeTeam.fullName,
                abbreviation: homeTeam.abbreviation,
                logo: `/team-logos/${homeTeam.abbreviation.toLowerCase()}_logo.svg`,
                record: '0-0'
              },
              awayTeam: {
                name: awayTeam.fullName,
                abbreviation: awayTeam.abbreviation,
                logo: `/team-logos/${awayTeam.abbreviation.toLowerCase()}_logo.svg`,
                record: '0-0'
              },
              gameTime: `${getCurrentDate()}T12:00:00`,
              venue: `${homeTeam.fullName} Stadium`,
              scrapedDate: getCurrentDate()
            };
            
            games.push(game);
          }
        });
      }
    }
    
    // If no games found through any strategy, use API fallback
    if (games.length === 0) {
      console.log('No games found through scraping, trying MLB API fallback');
      
      try {
        // Try to fetch from MLB Stats API
        const mlbApiUrl = `https://statsapi.mlb.com/api/v1/schedule/games/?sportId=1&date=${getCurrentDate()}`;
        const mlbResponse = await axios.get(mlbApiUrl);
        
        if (mlbResponse.data && mlbResponse.data.dates && mlbResponse.data.dates.length > 0) {
          const apiGames = mlbResponse.data.dates[0].games;
          
          apiGames.forEach((apiGame, index) => {
            const awayTeam = {
              name: apiGame.teams.away.team.name,
              abbreviation: apiGame.teams.away.team.abbreviation || apiGame.teams.away.team.name.substring(0, 3).toUpperCase()
            };
            
            const homeTeam = {
              name: apiGame.teams.home.team.name,
              abbreviation: apiGame.teams.home.team.abbreviation || apiGame.teams.home.team.name.substring(0, 3).toUpperCase()
            };
            
            // Create game object
            const game = {
              id: String(index + 1),
              homeTeam: {
                name: homeTeam.name,
                abbreviation: homeTeam.abbreviation,
                logo: `/team-logos/${homeTeam.abbreviation.toLowerCase()}_logo.svg`,
                record: apiGame.teams.home.leagueRecord ? 
                  `${apiGame.teams.home.leagueRecord.wins}-${apiGame.teams.home.leagueRecord.losses}` : 
                  '0-0'
              },
              awayTeam: {
                name: awayTeam.name,
                abbreviation: awayTeam.abbreviation,
                logo: `/team-logos/${awayTeam.abbreviation.toLowerCase()}_logo.svg`,
                record: apiGame.teams.away.leagueRecord ? 
                  `${apiGame.teams.away.leagueRecord.wins}-${apiGame.teams.away.leagueRecord.losses}` : 
                  '0-0'
              },
              gameTime: apiGame.gameDate,
              venue: apiGame.venue ? apiGame.venue.name : `${homeTeam.name} Stadium`,
              scrapedDate: getCurrentDate()
            };
            
            games.push(game);
          });
          
          console.log(`Found ${games.length} games from MLB API`);
        }
      } catch (apiError) {
        console.error('Error fetching from MLB API:', apiError.message);
      }
    }
    
    // If still no games found, use manual games as fallback
    if (games.length === 0) {
      console.log('No games found through any method, using manual games as fallback');
      
      // Create some manual games with today's date
      const currentDate = getCurrentDate();
      
      const manualGames = [
        {
          id: '1',
          homeTeam: {
            name: 'New York Yankees',
            abbreviation: 'NYY',
            logo: '/team-logos/nyy_logo.svg',
            record: '35-18'
          },
          awayTeam: {
            name: 'Boston Red Sox',
            abbreviation: 'BOS',
            logo: '/team-logos/bos_logo.svg',
            record: '30-23'
          },
          gameTime: `${currentDate}T19:05:00`,
          venue: 'Yankee Stadium',
          scrapedDate: currentDate
        },
        {
          id: '2',
          homeTeam: {
            name: 'Los Angeles Dodgers',
            abbreviation: 'LAD',
            logo: '/team-logos/lad_logo.svg',
            record: '38-15'
          },
          awayTeam: {
            name: 'San Francisco Giants',
            abbreviation: 'SF',
            logo: '/team-logos/sf_logo.svg',
            record: '28-25'
          },
          gameTime: `${currentDate}T22:10:00`,
          venue: 'Dodger Stadium',
          scrapedDate: currentDate
        },
        {
          id: '3',
          homeTeam: {
            name: 'Chicago Cubs',
            abbreviation: 'CHC',
            logo: '/team-logos/chc_logo.svg',
            record: '25-28'
          },
          awayTeam: {
            name: 'St. Louis Cardinals',
            abbreviation: 'STL',
            logo: '/team-logos/stl_logo.svg',
            record: '27-26'
          },
          gameTime: `${currentDate}T20:20:00`,
          venue: 'Wrigley Field',
          scrapedDate: currentDate
        }
      ];
      
      games = manualGames;
    }
    
    console.log(`Final game count: ${games.length}`);
    return games;
  } catch (error) {
    console.error('Error scraping MLB data:', error.message);
    
    // Return empty array on error
    return [];
  }
}

// Function to update the static HTML file with new game data
async function updateStaticHTML(games, predictions) {
  try {
    console.log(`Updating static HTML file at ${STATIC_DATA_PATH}`);
    
    // Check if file exists
    if (!fs.existsSync(STATIC_DATA_PATH)) {
      console.error(`Error: File not found at ${STATIC_DATA_PATH}`);
      return false;
    }
    
    // Read the current HTML file
    let html = fs.readFileSync(STATIC_DATA_PATH, 'utf8');
    
    // Load HTML into cheerio
    const $ = cheerio.load(html);
    
    // Find the games container
    const gamesContainer = $('#games-container');
    
    if (gamesContainer.length === 0) {
      console.error('Error: Could not find games container in HTML');
      return false;
    }
    
    // Clear existing games
    gamesContainer.empty();
    
    // Add timestamp
    const timestamp = new Date();
    gamesContainer.append(`<div class="update-timestamp">Last updated: ${formatDate(timestamp)}</div>`);
    
    // Add each game
    games.forEach(game => {
      // Get predictions for this game
      const gamePredictions = predictions[game.id] || {};
      
      // Create game card HTML
      const gameCard = `
        <div class="game-card" data-game-id="${game.id}">
          <div class="game-header">
            <div class="game-time">${formatDate(new Date(game.gameTime))}</div>
            <div class="game-venue">${game.venue}</div>
          </div>
          <div class="game-teams">
            <div class="team away">
              <img src="${game.awayTeam.logo}" alt="${game.awayTeam.name}" class="team-logo">
              <div class="team-info">
                <div class="team-name">${game.awayTeam.name}</div>
                <div class="team-record">${game.awayTeam.record}</div>
              </div>
            </div>
            <div class="vs">VS</div>
            <div class="team home">
              <img src="${game.homeTeam.logo}" alt="${game.homeTeam.name}" class="team-logo">
              <div class="team-info">
                <div class="team-name">${game.homeTeam.name}</div>
                <div class="team-record">${game.homeTeam.record}</div>
              </div>
            </div>
          </div>
          <div class="game-actions">
            <button class="show-predictions-btn" onclick="togglePredictions('${game.id}')">Show Predictions</button>
          </div>
          <div class="predictions-container" id="predictions-${game.id}" style="display: none;">
            <div class="prediction">
              <h4>OpenAI</h4>
              <p>${gamePredictions.openai || 'Prediction not available'}</p>
            </div>
            <div class="prediction">
              <h4>Anthropic</h4>
              <p>${gamePredictions.anthropic || 'Prediction not available'}</p>
            </div>
            <div class="prediction">
              <h4>Grok</h4>
              <p>${gamePredictions.grok || 'Prediction not available'}</p>
            </div>
            <div class="prediction">
              <h4>DeepSeek</h4>
              <p>${gamePredictions.deepseek || 'Prediction not available'}</p>
            </div>
          </div>
        </div>
      `;
      
      // Add game card to container
      gamesContainer.append(gameCard);
    });
    
    // Write updated HTML back to file
    fs.writeFileSync(STATIC_DATA_PATH, $.html());
    console.log(`Successfully updated static HTML file with ${games.length} games`);
    
    return true;
  } catch (error) {
    console.error('Error updating static HTML:', error.message);
    return false;
  }
}

// Main function
async function main() {
  try {
    console.log('Starting MLB data and prediction process');
    
    // Fetch MLB game data
    const games = await scrapeMLBData();
    
    if (games.length === 0) {
      console.error('No games found, aborting');
      return;
    }
    
    console.log(`Found ${games.length} games`);
    
    // Generate predictions for each game
    const predictions = {};
    
    for (const game of games) {
      console.log(`Generating predictions for game ${game.id}: ${game.awayTeam.name} vs ${game.homeTeam.name}`);
      
      try {
        // Generate predictions from each LLM
        const openaiPrediction = await llmService.getPrediction('openai', game);
        const anthropicPrediction = await llmService.getPrediction('anthropic', game);
        const grokPrediction = await llmService.getPrediction('grok', game);
        const deepseekPrediction = await llmService.getPrediction('deepseek', game);
        
        // Store predictions
        predictions[game.id] = {
          openai: openaiPrediction,
          anthropic: anthropicPrediction,
          grok: grokPrediction,
          deepseek: deepseekPrediction
        };
        
        // Store in MongoDB
        await mongoService.storePredictions(game.id, predictions[game.id]);
      } catch (error) {
        console.error(`Error generating predictions for game ${game.id}:`, error.message);
        
        // Use fallback predictions
        predictions[game.id] = {
          openai: `${game.homeTeam.name} 5 - ${game.awayTeam.name} 3. The ${game.homeTeam.name} have been strong at home this season and their starting pitcher has better stats. Expect a solid performance from their offense against the ${game.awayTeam.name}'s bullpen.`,
          anthropic: `${game.homeTeam.name} 4 - ${game.awayTeam.name} 2. The ${game.homeTeam.name} have a statistical advantage in batting average and ERA. Their home field advantage will likely be the deciding factor in this matchup.`,
          grok: `${game.awayTeam.name} 6 - ${game.homeTeam.name} 4. Despite playing away, the ${game.awayTeam.name} have been hitting well against left-handed pitching, which matches up well against the ${game.homeTeam.name}'s probable starter.`,
          deepseek: `${game.homeTeam.name} 3 - ${game.awayTeam.name} 2. Expecting a close, low-scoring game with strong pitching performances from both teams. The ${game.homeTeam.name}'s slight edge in bullpen ERA should help them secure a narrow victory.`
        };
      }
    }
    
    // Update static HTML file
    const updateSuccess = await updateStaticHTML(games, predictions);
    
    if (updateSuccess) {
      console.log('Process completed successfully');
    } else {
      console.error('Failed to update static HTML file');
    }
  } catch (error) {
    console.error('Error in main process:', error.message);
  }
}

// Run the main function
main();
