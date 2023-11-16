import { createServer } from "http";
import express from "express";
import fetch from 'node-fetch';
import dotenv  from "dotenv";
import cors from 'cors';
import session from "express-session";
import { serialize } from "cookie";
import db from './db/connection.mjs'; 

dotenv.config();
const PORT = 4000;
const app = express();

app.use(express.json());

app.use(
    cors({
      origin: "http://localhost:3000",
      credentials: true,
    })
);

app.use(
    session({
      secret: process.env.SECRET,
      resave: false,
      saveUninitialized: true
    })
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

app.get("/user/", (req, res) => {
    if (!req.session.user) {
        return res.json(null);
    }
    return res.json(req.session.user);
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

const server = createServer(app).listen(PORT, function (err) {
    if (err) console.log(err);
    else console.log("HTTP server on http://localhost:%s", PORT);
});  