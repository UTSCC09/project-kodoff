'use client'
import React, { useEffect, useRef, useState } from 'react';

const wsUrl = 'ws://localhost:4000'; 

export default function Home() {
  const ws = useRef(null);
  const [clientId, setClientId] = useState(null);
  const [creatorId, setCreatorId] = useState(null);
  const [gameId, setGameId] = useState(null);
  const [game, setGame] = useState(null);
  const [winner, setWinner] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    // Initialize WebSocket connection
    const newWs = new WebSocket(wsUrl);

    newWs.onopen = () => {
      console.log('WebSocket connection opened');
    };

    newWs.onmessage = (message) => {
      const response = JSON.parse(message.data);
      console.log('Received:', response);

      // connect
      if (response.method === "connect") {
        setClientId(response.clientId);
      }

      // create
      if (response.method === "create") {
        setGameId(response.game.id);
        setCreatorId(response.clientId);
        setGame(response.game);
      }

      // join
      if (response.method === "join"){
        setGame(response.game);
      }

      if (response.method === "submit"){
        setGame(response.game);
        setWinner(response.winner);
      }

      if (response.method === "end"){
        setGame(response.game);
        setWinner(response.winner);
      }

      // Handle timer updates
      if (response.method === "timer") {
        setTimeLeft(response.timeLeft);
      }

      // Handle error
      if (response.method === "error") {
        setErrorMessage(response.message);
        return; // Early return to prevent further processing
      }
    };

    newWs.onclose = () => {
      console.log('WebSocket connection closed');
    };

    ws.current = newWs;

    // Cleanup on component unmount
    return () => newWs.close();
  }, []);

  useEffect(() => {
    if (clientId) {
      console.log("Client id set successfully " + clientId);
    }
  }, [clientId]);

  useEffect(() => {
    if (creatorId) {
      console.log("Creator id set successfully " + creatorId);
    }
  }, [creatorId]);

  useEffect(() => {
    if (gameId) {
      console.log("Game id set successfully " + gameId);
    }
  }, [gameId]);

  useEffect(() => {
    if (game) {
      console.log("Game set successfully");
    }
  }, [game]);

  useEffect(() => {
    if (winner) {
      console.log("Winner set successfully");
    }
  }, [winner]);

  useEffect(() => {
    if (timeLeft !== null) {
      console.log("Timer updated: " + timeLeft + " milliseconds remaining");
    }
  }, [timeLeft]);
  

  const handleCreateGame = () => {
    const payload = {
      "method": "create",
      "clientId": clientId,
    };
    ws.current.send(JSON.stringify(payload));
  };

  const handleJoinGame = () => {
    const payload = {
      "method": "join",
      "clientId": clientId,
      "gameId": gameId,
    };
    ws.current.send(JSON.stringify(payload));
  };

  const handleSubmit = () => {
    const payload = {
        "method": "submit",
        "clientId": clientId,
        "gameId": gameId,
    };
    ws.current.send(JSON.stringify(payload));
  };

  return (
    <div className='main-body'>
        <h1>Project Kodoff</h1>
        {errorMessage && (
        <div style={{ color: 'red' }}>
          Error: {errorMessage}
        </div>
        )}
        <button onClick={handleCreateGame}>New Game</button>
        <button onClick={handleJoinGame}>Join Game</button>
        <input type='text' onChange={(e) => setGameId(e.target.value)} />
        <div className='game-pin-div'>
          {gameId && clientId === creatorId && (
            <div>
              <span className='game-pin-label'>Game Pin:</span> {gameId}
            </div>
          )}
        </div>
        <div className='players-section'>
          {game?.clients && game.clients.length > 0 && (
            <div>
              <div className='player-heading'>Players:</div>
              {game.clients.map((c, index) => (
                <div key={c.clientId}>
                  Player {index + 1}: {c.clientId}
                </div>
              ))}
            </div>
          )}
        </div>
        {timeLeft !== null && (
          <div>
            Time Left: {Math.floor(timeLeft / 1000)} seconds
          </div>
        )}
        <button onClick={handleSubmit}>Submit</button>
        {game && winner && (
          <p>
              {winner === clientId ? "You win!" : 
              winner === "tie" ? "It's a tie!" : "You lose."}
          </p>
        )}
    </div>
  );
}