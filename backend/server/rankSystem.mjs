const actualScores = [
    [0.5, 0.4, 0.25, 0.0],
    [0.6, 0.5, 0.4, 0.2],
    [0.75, 0.6, 0.5, 0.35],
    [1.0, 0.8, 0.65, 0.0]
]

function getKFactor(Rank) {
    if (Rank > 1500) return 20; // min K factor
    else{
        return Math.round((1500-Rank)/1500*25 + 20);
    }
}

export function updateRanks(player1Rank, player2Rank, player1Solve, player2Solve) {
    // Get the K-factors for each player based on their Rank
    const player1K = getKFactor(player1Rank);
    const player2K = getKFactor(player2Rank);

    // Calculate expected scores
    const player1Expected = 1 / (1 + Math.pow(10, (player2Rank - player1Rank) / 400));
    const player2Expected = 1 / (1 + Math.pow(10, (player1Rank - player2Rank) / 400));

    // Retrieve the actual score based on Problems solved
    const player1Actual = actualScores[player1Solve][player2Solve];
    const player2Actual = 1 - player1Actual;


    let newPlayer1Rank;
    let newPlayer2Rank;

    // Update Ranks
    if(player1Solve > player2Solve){
        newPlayer1Rank = Math.max(player1Rank + player1K * (player1Actual - player1Expected), player1Rank);
        newPlayer2Rank = Math.max(player2Rank + player2K * (player2Actual - player2Expected), 0);
    }
    else if (player2Solve > player1Solve){
        newPlayer1Rank = Math.max(player1Rank + player1K * (player1Actual - player1Expected), 0);
        newPlayer2Rank = Math.max(player2Rank + player2K * (player2Actual - player2Expected), player2Rank);
    }
    else{
        newPlayer1Rank = Math.max(player1Rank + player1K * (player1Actual - player1Expected), 0);
        newPlayer2Rank = Math.max(player2Rank + player2K * (player2Actual - player2Expected), 0);
    }

    return {
        newPlayer1Rank: Math.round(newPlayer1Rank),
        newPlayer2Rank: Math.round(newPlayer2Rank)
    };
}