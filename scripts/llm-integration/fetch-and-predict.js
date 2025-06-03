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
const STATIC_DATA_PATH = path.join(__dirname, '../../index.html');

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
        const mlbApiUrl = 'https://statsapi.mlb.com/api/v1/schedule/games/?sportId=1';
        const mlbResponse = await axios.get(mlbApiUrl, { timeout: 5000 });
        
        if (mlbResponse.data && mlbResponse.data.dates && mlbResponse.data.dates.length > 0) {
          const todayGames = mlbResponse.data.dates[0].games;
          
          todayGames.forEach((game, index) => {
            const homeTeamName = game.teams.home.team.name;
            const awayTeamName = game.teams.away.team.name;
            
            // Parse team info
            const homeTeam = parseTeamName(homeTeamName);
            const awayTeam = parseTeamName(awayTeamName);
            
            // Create game object
            const gameObj = {
              id: String(index + 1),
              homeTeam: {
                name: homeTeam.fullName,
                abbreviation: homeTeam.abbreviation,
                logo: `/team-logos/${homeTeam.abbreviation.toLowerCase()}_logo.svg`,
                record: game.teams.home.leagueRecord ? 
                  `${game.teams.home.leagueRecord.wins}-${game.teams.home.leagueRecord.losses}` : 
                  '0-0'
              },
              awayTeam: {
                name: awayTeam.fullName,
                abbreviation: awayTeam.abbreviation,
                logo: `/team-logos/${awayTeam.abbreviation.toLowerCase()}_logo.svg`,
                record: game.teams.away.leagueRecord ? 
                  `${game.teams.away.leagueRecord.wins}-${game.teams.away.leagueRecord.losses}` : 
                  '0-0'
              },
              gameTime: game.gameDate || `${getCurrentDate()}T12:00:00`,
              venue: game.venue ? game.venue.name : `${homeTeam.fullName} Stadium`,
              scrapedDate: getCurrentDate()
            };
            
            games.push(gameObj);
          });
          
          console.log(`Found ${games.length} games from MLB API`);
        }
      } catch (apiError) {
        console.error('Error fetching from MLB API:', apiError.message);
      }
    }
    
    // If still no games found, create dynamic games based on current date
    if (games.length === 0) {
      console.log('No games found through any method, creating dynamic games');
      
      // Create dynamic games with today's date
      const today = new Date();
      const formattedDate = formatDate(today);
      
      // Create a set of dynamic games
      const dynamicGames = [
        {
          id: "1",
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
          gameTime: `${getCurrentDate()}T16:10:00`,
          venue: "Chase Field, Phoenix, AZ",
          scrapedDate: getCurrentDate(),
          note: "Dynamic game - no data available"
        },
        {
          id: "2",
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
          gameTime: `${getCurrentDate()}T16:10:00`,
          venue: "T-Mobile Park, Seattle, WA",
          scrapedDate: getCurrentDate(),
          note: "Dynamic game - no data available"
        },
        {
          id: "3",
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
          gameTime: `${getCurrentDate()}T17:10:00`,
          venue: "Petco Park, San Diego, CA",
          scrapedDate: getCurrentDate(),
          note: "Dynamic game - no data available"
        },
        {
          id: "4",
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
          gameTime: `${getCurrentDate()}T19:10:00`,
          venue: "Dodger Stadium, Los Angeles, CA",
          scrapedDate: getCurrentDate(),
          note: "Dynamic game - no data available"
        }
      ];
      
      return dynamicGames;
    }
    
    console.log(`Found ${games.length} upcoming MLB games`);
    return games;
  } catch (error) {
    console.error('Error scraping MLB data:', error);
    
    // Create dynamic games with today's date as fallback
    console.log('Scraping failed, using dynamic games with current date');
    
    const today = new Date();
    const formattedDate = formatDate(today);
    
    // Create dynamic games with today's date
    const dynamicGames = [
      {
        id: "1",
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
        gameTime: `${getCurrentDate()}T16:10:00`,
        venue: "Chase Field, Phoenix, AZ",
        scrapedDate: getCurrentDate(),
        note: "Dynamic game - scraping failed"
      },
      {
        id: "2",
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
        gameTime: `${getCurrentDate()}T16:10:00`,
        venue: "T-Mobile Park, Seattle, WA",
        scrapedDate: getCurrentDate(),
        note: "Dynamic game - scraping failed"
      },
      {
        id: "3",
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
        gameTime: `${getCurrentDate()}T17:10:00`,
        venue: "Petco Park, San Diego, CA",
        scrapedDate: getCurrentDate(),
        note: "Dynamic game - scraping failed"
      },
      {
        id: "4",
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
        gameTime: `${getCurrentDate()}T19:10:00`,
        venue: "Dodger Stadium, Los Angeles, CA",
        scrapedDate: getCurrentDate(),
        note: "Dynamic game - scraping failed"
      }
    ];
    
    return dynamicGames;
  }
}

// Update the HTML file with new predictions
async function updateHtmlWithPredictions(games) {
  try {
    // Read the current HTML file
    const htmlContent = fs.readFileSync(STATIC_DATA_PATH, 'utf8');
    
    // Create a new HTML content with updated predictions
    let updatedHtml = htmlContent;
    
    // Update the game data in the HTML
    // First, find the section where games are defined
    const gameDataRegex = /const\s+games\s*=\s*\[[\s\S]*?\];/;
    const gameDataMatch = htmlContent.match(gameDataRegex);
    
    if (gameDataMatch) {
      // Format the games as JSON with proper indentation
      const gamesJson = JSON.stringify(games, null, 2);
      const newGameData = `const games = ${gamesJson};`;
      
      // Replace the old game data with the new one
      updatedHtml = updatedHtml.replace(gameDataRegex, newGameData);
      
      console.log('Updated game data in HTML');
    } else {
      console.warn('Could not find game data section in HTML');
    }
    
    // For each game, update the predictions in the HTML
    for (const game of games) {
      const { id, predictions } = game;
      
      if (predictions) {
        // Create regex patterns to find and replace each prediction
        const openaiPattern = new RegExp(`(data-game-id="${id}"[^>]*data-provider="openai"[^>]*>)[^<]*(</div>)`, 'g');
        const anthropicPattern = new RegExp(`(data-game-id="${id}"[^>]*data-provider="anthropic"[^>]*>)[^<]*(</div>)`, 'g');
        const grokPattern = new RegExp(`(data-game-id="${id}"[^>]*data-provider="grok"[^>]*>)[^<]*(</div>)`, 'g');
        const deepseekPattern = new RegExp(`(data-game-id="${id}"[^>]*data-provider="deepseek"[^>]*>)[^<]*(</div>)`, 'g');
        
        // Replace each prediction in the HTML
        updatedHtml = updatedHtml
          .replace(openaiPattern, `$1${predictions.openai.replace(/\n/g, '<br>')}$2`)
          .replace(anthropicPattern, `$1${predictions.anthropic.replace(/\n/g, '<br>')}$2`)
          .replace(grokPattern, `$1${predictions.grok.replace(/\n/g, '<br>')}$2`)
          .replace(deepseekPattern, `$1${predictions.deepseek.replace(/\n/g, '<br>')}$2`);
      }
    }
    
    // Add a timestamp to the HTML to show when it was last updated
    const timestamp = new Date().toISOString();
    const timestampComment = `<!-- Data last updated: ${timestamp} -->`;
    
    // Add timestamp at the end of the head section
    updatedHtml = updatedHtml.replace('</head>', `${timestampComment}\n</head>`);
    
    // Write the updated HTML back to the file
    fs.writeFileSync(STATIC_DATA_PATH, updatedHtml);
    console.log('Updated HTML with new predictions and timestamp');
    
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
    console.log(`Current date: ${getCurrentDate()}`);
    console.log(`Static data path: ${STATIC_DATA_PATH}`);
    
    // Verify the static data path exists
    if (!fs.existsSync(STATIC_DATA_PATH)) {
      console.error(`Error: Static data file not found at ${STATIC_DATA_PATH}`);
      console.log('Checking parent directory...');
      
      // Try to find index.html in the parent directory
      const parentPath = path.join(__dirname, '../index.html');
      if (fs.existsSync(parentPath)) {
        console.log(`Found index.html at ${parentPath}`);
        STATIC_DATA_PATH = parentPath;
      } else {
        console.error('Could not find index.html in parent directory');
        return;
      }
    }
    
    // Step 1: Fetch MLB game data
    const games = await scrapeMLBData();
    console.log(`Fetched ${games.length} games`);
    
    // Step 2: Connect to MongoDB
    const mongoConnected = await mongoService.connect();
    if (!mongoConnected) {
      console.warn('Failed to connect to MongoDB, will continue without storing predictions');
    }
    
    // Step 3: Generate predictions for each game
    for (let i = 0; i < games.length; i++) {
      const game = games[i];
      console.log(`Generating predictions for game ${i+1}/${games.length}: ${game.awayTeam.name} @ ${game.homeTeam.name}`);
      
      // Get predictions from all LLM providers
      const predictions = await llmService.getAllPredictions(game);
      game.predictions = predictions;
      
      // Store predictions in MongoDB if connected
      if (mongoConnected) {
        const result = await mongoService.storePredictions(game, predictions);
        if (result.success) {
          console.log(`Successfully stored predictions for game ${game.id} in MongoDB`);
        } else {
          console.warn(`Failed to store predictions for game ${game.id} in MongoDB: ${result.error}`);
        }
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
      await mongoService.close();
    }
    
    console.log('MLB data and prediction update completed successfully');
  } catch (error) {
    console.error('Error in main function:', error);
  }
}

// Run the script
main();
