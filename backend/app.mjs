import { createServer } from "http";
import express from "express";
import fetch from 'node-fetch';
import dotenv  from "dotenv";
import cors from 'cors';
import session from "express-session";
import { serialize } from "cookie";
import db from './db/connection.mjs'; 
import { WebSocketServer } from "ws";
import { updateRanks } from "./gameplay/rankSystem.mjs";
import { execPythonScript } from "./gameplay/dockerManager.mjs"

dotenv.config();
const PORT = 4000;
const app = express();
app.use(express.json());

console.log("CORS allowing origin:", process.env.FRONTEND);

app.use(
    cors({
      origin: process.env.FRONTEND,
      credentials: true,
    })
);

// app.use((req, res, next) => {
//     res.setHeader('Access-Control-Allow-Origin', '*');
//     res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
//     res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
//     res.setHeader('Access-Control-Allow-Credentials', 'true');
//     next();
// });

const middleware = session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: true
});

app.use(
    middleware
);
  
app.use(function (req, res, next) {
    const username = req.session.user ? req.session.user.username : "";
    req.username = (username)? username : null;
    res.setHeader('Set-Cookie', serialize('username', username, {
        path : '/', 
        maxAge: 60 * 60 * 24 * 7 // 1 week in number of seconds
    }));
    console.log("HTTP request", req.username, req.method, req.url, req.body);
    next();
});

const isAuthenticated = function (req, res, next) {
    if (!req.session.user) return res.status(401).end("access denied");
    next();
};

/* endpoints */
app.get('/', (req, res) => {
    if (!req.session.user) {
        return null;
    }
    return res.json(req.session.user);
});

app.post("/signUp/", async function(req, res, next){
    /* Get User Access Token from code given from Github */
    const code = req.body.code;
    getAccessToken(code)
    .then(data => {
        /* Get all User Data using that Access Token */
        if (data.access_token) {
            getUserData(data.access_token)
            .then(async userData => {
                /* Check if user is already registered */
                getUser(userData.login)
                .then(async user => {
                    if (user) {
                        console.log("User already registered, log in instead");
                        return res.status(409).end("username " + user.username + " is already registered");
                    }
                    /* Get specific user data and add to database since not registered yet */
                    addUser(userData)
                    .then(async result => {
                        console.log("User added");
                        // /* Create session and cookie for current signed up user */
                        getUserById(result.insertedId)
                        .then(user => {
                            req.session.user = user;
                            res.setHeader(
                                "Set-Cookie",
                                serialize("username", user.username, {
                                    path: "/",
                                    maxAge: 60 * 60 * 24 * 7,
                                }),
                            );
                            return res.json(user);
                        })
                    })
                    .catch(error => {
                        console.log(error);
                    })
                })
                .catch(error => {
                    console.log(error);
                })
            })
            .catch(error => {
                console.log(error);
            });
        }
    })
    .catch(error => {
        console.log(error);
        return res.status(500).end("Internal Server Error");
    });
})

app.post("/login/", async function(req, res, next){
    /* Get User Access Token from code given from Github */
    const code = req.body.code;
    getAccessToken(code)
    .then(data => {
        /* Get all User Data using that Access Token */
        if (data.access_token) {
            getUserData(data.access_token)
            .then(async userData => {
                /* Check if user exists */
                getUser(userData.login)
                .then(async user => {
                    if (user) {
                        /* Create session and cookie for current logged in user */
                        req.session.user = user;
                        res.setHeader(
                            "Set-Cookie",
                            serialize("username", user.username, {
                                path: "/",
                                maxAge: 60 * 60 * 24 * 7,
                            }),
                        );
                        console.log("User logged in");
                        return res.json(user);
                    }
                    else {
                        console.log("User not yet registered, sign up first");
                        return res.status(409).end("user not yet registered");
                    }
                })
                .catch(error => {
                    console.log(error);
                })
            })
            .catch(error => {
                console.log(error);
            });
        }
    })
    .catch(error => {
        console.log(error);
        return res.status(500).end("Internal Server Error");
    });
})

app.get("/logout/", function (req, res, next) {
    req.session.destroy();
    res.setHeader(
      "Set-Cookie",
      serialize("username", "", {
        path: "/",
        maxAge: 60 * 60 * 24 * 7, // 1 week in number of seconds
      }),
    );
    res.end();
});

app.get("/user/", async function(req, res) {
    if (!req.session.user) {
        return res.json(null);
    }
    req.session.user.rank = await getLatestRank(req.session.user.username);
    return res.json(req.session.user);
});

app.get("/matchhistory/", (req, res) => {
    getMatchHistory(req.session.user.username).then(async games => {
        if (games) {
            return res.json(games);
        }
        else {
            return res.status(409).end("No games");
        }
    })
    .catch(error => {
        console.log(error);
        return res.status(500).end("Internal Server Error");
    });
});

app.get("/leaderboard/", (req, res) => {
    getTop50().then(async users => {
        if (users) {
            return res.json(users);
        }
        else {
            return res.status(409).end("No users");
        }
    })
    .catch(error => {
        console.log(error);
        return res.status(500).end("Internal Server Error");
    });
});

/* GitHub API Functions */
function getAccessToken(code) {
    const params = `?client_id=${process.env.GITHUB_CLIENT_ID}&client_secret=${process.env.GITHUB_CLIENT_SECRET}&code=${code}`;
    return new Promise(async function(resolve, reject){
        await fetch(`https://github.com/login/oauth/access_token${params}`, {
            method: "POST",
            headers: {
                "Accept": "application/json"
            }
        }).then((response) => {
            return response.json();
        }).then((data) => {
            return resolve(data);
        }).catch(error => {
            reject(error);
        });
    });
}

function getUserData(accessToken) {
    return new Promise(async function(resolve, reject){
        await fetch(`https://api.github.com/user`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${accessToken}`
            }
        }).then((response) => {
            return response.json();
        }).then((data) => {
            return resolve(data);
        }).catch(error => {
            reject(error);
        });
    });
}

/* Database Queries */
function getUserById(id){
    return new Promise(async(resolve, reject) => {
        const user = await db.collection('users').findOne({ _id: id });
        if (!user) {
            return resolve(null);
        }
        if (user instanceof Error) {
            return reject(user);
        }
        return resolve(user);
    })
}

function getUser(username){
    return new Promise(async(resolve, reject) => {
        const user = await db.collection('users').findOne({ username: username });
        console.log(user);
        if (!user) {
            return resolve(null);
        }
        if (user instanceof Error) {
            return reject(user);
        }
        return resolve(user);
    })
}

function addUser(data) {
    return new Promise(async(resolve, reject) => {
        const body = { username: data.login, pfp: data.avatar_url, rank: 0, createdAt: Date.now() }                
        const user = await db.collection('users').insertOne(body); 
        if (user instanceof Error) {
            return reject(user);
        }
        return resolve(user);
    })
}

function getMatchHistory(username) {
    return new Promise(async(resolve, reject) => {
        const games = await db.collection('games').find({
            $and: [
              { $or: [{ player1: username }, { player2: username }] },
              { player2: { $ne: null, $ne: "" } }
            ]
        }).sort({ _id: -1 }).limit(20).toArray();
        if (!games) {
            return resolve(null);
        }
        if (games instanceof Error) {
            return reject(games);
        }
        return resolve(games);
    })
}

function getTop50() {
    return new Promise(async(resolve, reject) => {
        const users = await db.collection('users').find().sort({ rank: -1 }).limit(50).toArray();
        console.log(users);
        if (!users) {
            return resolve(null);
        }
        if (users instanceof Error) {
            return reject(users);
        }
        return resolve(users);
    })
}

async function addGame(gamePin, player1Id) {
    try {

        const body = {
            gamePin: gamePin,
            player1: player1Id,
            player2: "",
            player1Score: 0,
            player2Score: 0,
        };

        const game = await db.collection('games').insertOne(body);
        
        // Assuming `insertOne` returns the document on success
        return game;
    } catch (error) {
        console.error("Error in addGame:", error);
        throw error; // Propagate the error to be handled by the caller
    }
}

async function updateGamePlayer2(gamePin, player2Id) {
    try {
        const updateResult = await db.collection('games').updateOne(
            { gamePin: gamePin },
            { $set: { player2: player2Id } }
        );

        if (updateResult.matchedCount === 0) {
            throw new Error("Game not found with provided gamePin.");
        }

        if (updateResult.modifiedCount === 0) {
            throw new Error("Game found, but data was not updated.");
        }
        return updateResult;
    } catch (error) {
        throw error; // Rethrow the error to be handled by the caller
    }
}

async function setPlayerScores(gamePin, player1Submits, player2Submits) {
    try {
        
        const updateResult = await db.collection('games').updateOne(
            { gamePin: gamePin },
            { $set: { player1Score: player1Submits, player2Score: player2Submits } }
        );

        // Check if the document was found and updated
        if (updateResult.matchedCount === 0) {
            throw new Error("Game not found with provided gamePin.");
        }

        return updateResult;
    } catch (error) {
        // Rethrow the error to be handled by the caller
        throw error;
    }
}

async function updatePlayerRanks(player1Id, player2Id, player1Rank, player2Rank) {
    try {
        // Update rank for player1
        const updateResult1 = await db.collection('users').updateOne(
            { username: player1Id },
            { $set: { rank: player1Rank } }
        );

        // Check if the document for player1 was found and updated
        if (updateResult1.matchedCount === 0) {
            throw new Error("User not found with provided player1Id.");
        }

        // Update rank for player2
        const updateResult2 = await db.collection('users').updateOne(
            { username: player2Id },
            { $set: { rank: player2Rank } }
        );

        // Check if the document for player2 was found and updated
        if (updateResult2.matchedCount === 0) {
            throw new Error("User not found with provided player2Id.");
        }

        return { player1Update: updateResult1, player2Update: updateResult2 };
    } catch (error) {
        // Rethrow the error to be handled by the caller
        throw error;
    }
}

async function getPlayerRanks(player1Id, player2Id) {
    try {
        // Query the database to get the rank of player 1
        const player1 = await db.collection('users').findOne({ username: player1Id }, { projection: { rank: 1 } });
        if (!player1) throw new Error("Player 1 not found.");

        // Query the database to get the rank of player 2
        const player2 = await db.collection('users').findOne({ username: player2Id }, { projection: { rank: 1 } });
        if (!player2) throw new Error("Player 2 not found.");

        return { player1Rank: player1.rank, player2Rank: player2.rank };
    } catch (error) {
        console.error("Error fetching player ranks:", error);
        throw error; // Rethrow the error to be handled by the caller
    }
}

async function getLatestRank(username) {
    try {
        // Query the database to get the user document for the given username
        const user = await db.collection('users').findOne({ username: username }, { projection: { rank: 1 } });

        // Check if the user was found
        if (!user) {
            throw new Error("User not found.");
        }

        // Return the rank of the user
        return user.rank;
    } catch (error) {
        console.error("Error fetching user rank:", error);
        throw error; // Rethrow the error to be handled by the caller
    }
}
/* Debugging */
async function getGame(gamePin){
    try {
        const game = await db.collection('games').findOne({ gamePin: gamePin });
        console.log(game); // Log the game object

        // If no game is found, return null, otherwise return the game object
        return game ? game : null;
    } catch (error) {
        // Log and rethrow the error
        console.error("Error fetching game:", error);
        throw error;
    }
}
async function getThreeRandomQuestions() {
    try {
        // Aggregate pipeline to fetch 3 random documents with only id and desc fields
        const questions = await db.collection('problems').aggregate([
            { $sample: { size: 3 } },
            { $project: { _id: 1, desc: 1 } }
        ]).toArray();

        // Check if three questions were retrieved
        if (questions.length < 3) {
            throw new Error("Not enough questions in the database.");
        }

        return questions;
    } catch (error) {
        throw error; // Rethrow the error to be handled by the caller
    }
}

const server = createServer(app).listen(PORT, function (err) {
    if (err) console.log(err);
    else console.log("HTTP server on http://localhost:%s", PORT);
});  

/* WebSocket Game */
const clients = {};
const games = {};
const timers = {};
const gamesBackend = {};

// Handling the upgrade event for WebSocket connections
server.on('upgrade', (req, socket, head) => {
    console.log("Received upgrade request");

    if (socket.upgraded) {
        console.log("Socket already upgraded");
        return;
    }

    middleware(req, {}, () => {
        if (!req.session || !req.session.user) {
            console.log("Session not found, destroying socket");
            socket.destroy();
            return;
        }

        console.log("Upgrading socket for WebSocket connection");
        socket.upgraded = true;
        webSocket.handleUpgrade(req, socket, head, (ws) => {
            console.log("Emitting WebSocket connection event");
            webSocket.emit('connection', ws, req);
        });
    });
});

const webSocket = new WebSocketServer({ noServer: true });


/* Helper Functions */
function startTimer(gameId, durationInSeconds) {
    const endTime = Date.now() + durationInSeconds * 1000;

    // Update game state
    games[gameId].endTime = endTime;

    // Send an immediate timer update to clients
    sendTimeUpdateToClients(gameId, durationInSeconds * 1000);

    // Periodic updates
    const updateInterval = setInterval(() => {
        const remainingTime = Math.max(endTime - Date.now(), 0);
        sendTimeUpdateToClients(gameId, remainingTime);

        // End of timer
        if (remainingTime <= 0) {
            clearInterval(updateInterval);
            evaluateWinneronTimerEnd(gameId);
        }
    }, 950); // Update every second

    // Store the timer reference in the timers object
    timers[gameId] = { updateInterval };

}

function sendTimeUpdateToClients(gameId, remainingTime) {
    const payload = {
        "method": "timer",
        "timeLeft": remainingTime
    };
    games[gameId].clients.forEach(client => {
        clients[client.clientId].connection.send(JSON.stringify(payload));
    });
}

async function evaluateWinneronTimerEnd(gameId) {
    const game = games[gameId];
    let winnerId = null;

    if (game.clients[0].submits > game.clients[1].submits) {
        winnerId = game.clients[0].clientId;
    } else if (game.clients[1].submits > game.clients[0].submits) {
        winnerId = game.clients[1].clientId;
    } else if (game.clients[1].submits === game.clients[0].submits) {
        winnerId = "tie";
    }

    // Get submits count for both players
    const player1Submits = game.clients[0]?.submits || 0;
    const player2Submits = game.clients[1]?.submits || 0;

    try {
        await setPlayerScores(gameId, player1Submits, player2Submits);
    } catch (error) {
        console.error("Error setting player scores:", error);
        // Handle error or rethrow if necessary
    }
    
    try {
        const currRanks = await getPlayerRanks(game.clients[0].clientId, game.clients[1].clientId);
        const newRanks = updateRanks(currRanks.player1Rank, currRanks.player2Rank, player1Submits, player2Submits);
        await updatePlayerRanks(game.clients[0].clientId, game.clients[1].clientId, newRanks.newPlayer1Rank, newRanks.newPlayer2Rank);
    } catch (error) {
        console.error("Error updating player ranks:", error);
        // Handle error or rethrow if necessary
    }

    
    const payload = {
        "method": "end",
        "game": game,
        "winner": winnerId
    };

    game.clients.forEach(client => {
        clients[client.clientId].connection.send(JSON.stringify(payload));
    });

    // Clean up the game state
    delete games[gameId];

    // Clear the timer if necessary
    if (timers[gameId] && timers[gameId].updateInterval) {
        clearInterval(timers[gameId].updateInterval);
        delete timers[gameId];
    }
}


function findGameForClient(clientId) {
    for (const gameId in games) {
      const game = games[gameId];
      const client = game.clients.find((client) => client.clientId === clientId);
      if (client) {
        // The client is in this game
        return game;
      }
    }
    // The client is not in any game
    return null;
}

/* For python script execution */
async function getProblemTestsForUser(clientId) {
    try {
        const game = findGameForClient(clientId);
        // Check if the client is in a game
        if (!game) {
            throw new Error("Client is not in any game.");
        }

        // Extract the client's problem from the game
        const client = game.clients.find(client => client.clientId === clientId);

        // Check if the client's problem exists and has an _id
        if (!client || !client.problem || !client.problem._id) {
            throw new Error("Problem not found for the client in the game.");
        }

        // Fetch the problem's test cases and test results from the database
        const problemTests = await db.collection('problems').findOne({ _id: client.problem._id }, { projection: { _id: 0, test_cases: 1, test_results: 1 } });

        // Check if the problem tests were retrieved
        if (!problemTests) {
            throw new Error("Problem tests not found in the database.");
        }

        return problemTests;
    } catch (error) {
        throw error; // Rethrow the error to be handled by the caller
    }
}
  
webSocket.on("connection", (ws, req) => {
    const clientId = req.session.user.username;
    console.log((new Date()) + ' Received a new connection from origin ' + req.headers['origin'] + '.');

    clients[clientId] = { "connection": ws };

    ws.on("open", () => console.log("opened!"));
    ws.on("close", () => {
        // Check if the client is in any game
        for (const [gameId, game] of Object.entries(games)) {
            // Find if the current client is part of this game
            const clientIndex = game.clients.findIndex(client => client.clientId === clientId);
            // If the client is part of this game
            if (clientIndex !== -1) {
                // Remove this game from the list of active games
                delete games[gameId];

                // If there is a timer associated with this game, clear it
                if (timers[gameId]) {
                    clearInterval(timers[gameId].updateInterval);
                    delete timers[gameId];
                }
                break;
            }
        }
        delete clients[clientId];
        console.log("closed!")
    });
    ws.on("message", async (message) => {
        console.log("message");
        const result = JSON.parse(message);

        // user wants to create game
        if (result.method === "create"){
            const clientId = result.clientId;

            const gameId = guid();
            await addGame(gameId, clientId);
            const user = await getUser(clientId);
            
            games[gameId] = {
                "id": gameId,
                "clients": [{"clientId": clientId, "submits": 0, "user": user, "problem": ""}],      
            }

            const payload = {
                "method": "create",
                "game": games[gameId],
                "clientId": clientId
            }

            const connect = clients[clientId].connection;
            connect.send(JSON.stringify(payload));
        }

        if (result.method === "join"){
            const clientId = result.clientId;
            const gameId = result.gameId;

            // Check if the game ID is valid
            if (!games[gameId]) {
                // Handle invalid game ID (e.g., send an error message to the client)
                const errorPayload = {
                    "method": "error",
                    "message": "Invalid game ID"
                };
                clients[clientId].connection.send(JSON.stringify(errorPayload));
                return;
            }
            const game = games[gameId];

            // Check if game already has max players
            if (game.clients && game.clients.length >= 2) {
                const errorPayload = {
                    "method": "error",
                    "message": "Cannot join the game as it is already full."
                };
                clients[clientId].connection.send(JSON.stringify(errorPayload));
                return;
            }

            // Check if the same player is trying to join
            if (game.clients.some(client => client.clientId === clientId)) {
                const errorPayload = {
                    "method": "error",
                    "message": "Cannot join the game as you are already in it."
                };
                clients[clientId].connection.send(JSON.stringify(errorPayload));
                return;
            }

            // Check if the user is already in an ongoing game
            let isAlreadyInGame = false;
            for (const otherGame of Object.values(games)) {
                if (otherGame.clients.some(client => client.clientId === clientId)) {
                    isAlreadyInGame = true;
                    break;
                }
            }

            // Handle case where user is already in another game
            if (isAlreadyInGame) {
                const errorPayload = {
                    "method": "error",
                    "message": "Cannot join a new game while already in an ongoing game."
                };
                clients[clientId].connection.send(JSON.stringify(errorPayload));
                return;
            }

            // join game
            const user = await getUser(clientId);

            await updateGamePlayer2(gameId, clientId);
            const problems = await getThreeRandomQuestions();
            gamesBackend[gameId] = problems;

            // assign first question for both
            game.clients[0].problem = gamesBackend[gameId][0];
            game.clients.push({"clientId": clientId, "submits": 0, "user": user, "problem": gamesBackend[gameId][0]});
            const payLoad = {
                "method": "join",
                "game": game
            }
            // notify player that other player has joined
            game.clients.forEach(client => {
                clients[client.clientId].connection.send(JSON.stringify(payLoad));
            });

            // If this is the second player joining, start the timer after notification
            if (game.clients.length === 2) {
                // Start the game timer here
                startTimer(gameId, 150); // Assuming a 10-second game for example
            }
        }

        if (result.method === "submit"){
            const clientId = result.clientId;
            const gameId = result.gameId;
            const game = games[gameId];
            if (game){
                const clientIndex = game.clients.findIndex(c => c.clientId === clientId);

                if (clientIndex !== -1){
                    const tests = await getProblemTestsForUser(game.clients[clientIndex].clientId);
                    const execResult = await execPythonScript(result.code, tests);
                    // if code failed
                    if (!execResult.status){
                        const payLoad = {
                            "method": "wrongAnswer",
                            "message": execResult.output,
                        }
                        clients[clientId].connection.send(JSON.stringify(payLoad));

                    }
                    // code passed
                    else{
                        game.clients[clientIndex].submits++;
                        game.clients[clientIndex].problem = gamesBackend[gameId][game.clients[clientIndex].submits];
                        const payLoad = {
                            "method": "nextQuestion",
                            "game": game,
                        }
                        clients[clientId].connection.send(JSON.stringify(payLoad));
                    }
                    if (game.clients[clientIndex].submits >= 3){
                        const payLoad = {
                            "method": "submit",
                            "game": game,
                            "winner": clientId
                        }
    
                        // Get submits count for both players
                        const player1Submits = game.clients[0]?.submits || 0;
                        const player2Submits = game.clients[1]?.submits || 0;
                        try {
                            await setPlayerScores(gameId, player1Submits, player2Submits);
                        } catch (error) {
                            console.error("Error setting player scores:", error);
                            // Handle error or rethrow if necessary
                        }
                        try {
                            const currRanks = await getPlayerRanks(game.clients[0].clientId, game.clients[1].clientId);
                            const newRanks = updateRanks(currRanks.player1Rank, currRanks.player2Rank, player1Submits, player2Submits);
                            await updatePlayerRanks(game.clients[0].clientId, game.clients[1].clientId, newRanks.newPlayer1Rank, newRanks.newPlayer2Rank);
                        } catch (error) {
                            console.error("Error updating player ranks:", error);
                            // Handle error or rethrow if necessary
                        }                       
                        game.clients.forEach(client => {
                            clients[client.clientId].connection.send(JSON.stringify(payLoad));
                        });

                        // Clear the game timer
                        const gameTimer = timers[gameId]?.updateInterval;
                        if (gameTimer) {
                            clearInterval(gameTimer);
                            delete timers[gameId];
                        }
                        delete games[gameId];
                    }
                }
            }
        }
    });

    // Send a message back to the client to confirm connection
    const payLoad = {
        "method": "connect",
        "clientId": clientId
    };
    ws.send(JSON.stringify(payLoad));
});


// stack exchange randomized id
function S4() {
    return (((1+Math.random())*0x10000)|0).toString(16).substring(1); 
}
 
// then to call it, plus stitch in '4' in the third group
const guid = () => (S4() + S4() + "-" + S4() + "-4" + S4().substring(0,3) + "-" + S4() + "-" + S4() + S4() + S4()).toLowerCase();