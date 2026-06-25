class SimEngine {
    constructor(dataModule) {
        this.data = dataModule;
    }

    calculateTeamRating(teamId) {
        const players = this.data.getTeamPlayers(teamId);
        if (players.length === 0) return { offense: 50, defense: 50, overall: 50 };

        let top5 = [];
        if (teamId === this.data.state.userTeamId && this.data.state.lineup.length === 5) {
            top5 = this.data.state.lineup.map(id => players.find(p => p.id === id)).filter(p => p);
        } else {
            top5 = [...players].sort((a,b) => b.overall - a.overall).slice(0, 5);
        }

        const avgOff = top5.reduce((sum, p) => sum + p.stats.offense, 0) / (top5.length || 1);
        const avgDef = top5.reduce((sum, p) => sum + p.stats.defense, 0) / (top5.length || 1);

        return {
            offense: avgOff,
            defense: avgDef,
            overall: (avgOff + avgDef) / 2,
            activePlayers: top5
        };
    }

    simulateMatch(team1Id, team2Id) {
        const t1 = this.calculateTeamRating(team1Id);
        const t2 = this.calculateTeamRating(team2Id);

        // Base score
        let t1Score = Math.floor(Math.random() * 20) + 80;
        let t2Score = Math.floor(Math.random() * 20) + 80;

        t1Score += (t1.offense - t2.defense) * 0.5;
        t2Score += (t2.offense - t1.defense) * 0.5;

        t1Score += 3; // Home court

        t1Score = Math.max(50, Math.round(t1Score));
        t2Score = Math.max(50, Math.round(t2Score));

        if (t1Score === t2Score) {
            if (Math.random() > 0.5) t1Score++; else t2Score++;
        }

        // Generate Box Score
        const generateBoxScore = (players, totalPoints) => {
            let pointsLeft = totalPoints;
            let box = {};

            // Assign points based on offense rating weight
            const totalOff = players.reduce((sum, p) => sum + p.stats.offense, 0);

            players.forEach((p, index) => {
                let pts = 0;
                if (index === players.length - 1) {
                    pts = pointsLeft;
                } else {
                    const weight = p.stats.offense / totalOff;
                    // Add some randomness
                    pts = Math.round((totalPoints * weight) * (0.8 + Math.random() * 0.4));
                    if (pts > pointsLeft) pts = pointsLeft;
                }
                pointsLeft -= pts;

                // Rebounds (Favors bigs)
                let rebBase = p.position === 'C' ? 10 : (p.position === 'PF' ? 8 : 4);
                let reb = Math.round(rebBase * (0.5 + Math.random()));

                // Assists (Favors guards)
                let astBase = p.position === 'PG' ? 8 : (p.position === 'SG' ? 5 : 2);
                let ast = Math.round(astBase * (0.5 + Math.random()));

                box[p.id] = { name: p.name, pts, reb, ast };
            });
            return box;
        };

        const t1Box = generateBoxScore(t1.activePlayers, t1Score);
        const t2Box = generateBoxScore(t2.activePlayers, t2Score);

        const team1 = this.data.getTeam(team1Id);
        const team2 = this.data.getTeam(team2Id);

        return {
            home: team1,
            away: team2,
            homeScore: t1Score,
            awayScore: t2Score,
            homeBox: t1Box,
            awayBox: t2Box,
            winner: t1Score > t2Score ? team1 : team2
        };
    }
}

const simEngine = new SimEngine(gameData);
