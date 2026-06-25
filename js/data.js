class DataModule {
    constructor() {
        this.teams = [];
        this.players = [];
        this.state = {
            currentWeek: 1,
            userTeamId: null,
            budget: 140000000,
            news: [],
            lineup: [] // Array of player IDs representing the starters
        };
    }

    async initLocal() {
        try {
            const res = await fetch('data/nba_data.json');
            const data = await res.json();
            this.teams = data.teams;
            this.players = data.players;
            console.log("Data loaded from local fallback.");
            return true;
        } catch(e) {
            console.error("Failed to load local data", e);
            return false;
        }
    }

    async initAPI(apiKey) {
        try {
            const headers = { 'Authorization': apiKey };

            // Fetch teams
            const teamsRes = await fetch('https://api.balldontlie.io/v1/teams', { headers });
            if (!teamsRes.ok) throw new Error("Invalid API Key or rate limit reached.");
            const teamsData = await teamsRes.json();
            this.teams = teamsData.data.filter(t => t.id <= 30);

            // Fetch players (just one page for fast startup, the rest can be mock or paginated)
            const playersRes = await fetch('https://api.balldontlie.io/v1/players?per_page=100', { headers });
            const playersData = await playersRes.json();

            // Process API players to add game attributes
            this.players = playersData.data.map(p => {
                const positions = ['PG', 'SG', 'SF', 'PF', 'C'];
                const position = p.position && positions.includes(p.position) ? p.position : positions[Math.floor(Math.random() * positions.length)];
                const offense = Math.floor(Math.random() * 30) + 60;
                const defense = Math.floor(Math.random() * 30) + 60;
                const overall = Math.floor((offense + defense) / 2);

                let salary = 1000000;
                if (overall >= 85) salary = 35000000;
                else if (overall >= 80) salary = 25000000;
                else if (overall >= 75) salary = 15000000;
                else if (overall >= 70) salary = 8000000;

                return {
                    id: p.id,
                    name: `${p.first_name} ${p.last_name}`.trim(),
                    position: position,
                    team_id: p.team ? p.team.id : null,
                    overall: overall,
                    stats: { offense, defense },
                    salary: salary,
                    injury: null,
                    morale: 100
                };
            });

            // Add rookies to ensure draft pool
            for (let i = 1; i <= 60; i++) {
                const off = Math.floor(Math.random() * 20) + 60;
                const def = Math.floor(Math.random() * 20) + 60;
                this.players.push({
                    id: 100000 + i,
                    name: `Rookie Prospect ${i}`,
                    position: ['PG', 'SG', 'SF', 'PF', 'C'][Math.floor(Math.random() * 5)],
                    team_id: null,
                    overall: Math.floor((off + def) / 2),
                    stats: { offense: off, defense: def },
                    salary: 3000000,
                    injury: null,
                    morale: 100
                });
            }

            console.log("Data loaded from balldontlie API.");
            return true;
        } catch(e) {
            console.error("API loading failed:", e);
            return false;
        }
    }

    getTeams() {
        return this.teams;
    }

    getTeam(id) {
        return this.teams.find(t => t.id === id);
    }

    getPlayers() {
        return this.players;
    }

    getTeamPlayers(teamId) {
        return this.players.filter(p => p.team_id === teamId);
    }

    getFreeAgents() {
        return this.players.filter(p => p.team_id === null);
    }

    setUserTeam(teamId) {
        this.state.userTeamId = teamId;
        this.state.budget = 140000000; // $140M cap
        // Auto-set initial lineup
        const roster = this.getTeamPlayers(teamId).sort((a,b) => b.overall - a.overall);
        this.state.lineup = roster.slice(0, 5).map(p => p.id);
    }

    getUserTeam() {
        return this.getTeam(this.state.userTeamId);
    }

    getTeamPayroll(teamId) {
        const teamPlayers = this.getTeamPlayers(teamId);
        return teamPlayers.reduce((sum, p) => sum + p.salary, 0);
    }

    addNews(msg) {
        this.state.news.unshift(`Week ${this.state.currentWeek}: ${msg}`);
    }
}

const gameData = new DataModule();
