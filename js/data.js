class DataModule {
    constructor() {
        this.teams = [];
        this.players = [];
        this.state = {
            currentWeek: 1,
            userTeamId: null,
            budget: 140000000,
            news: [],
            activeLineupId: 'default',
            lineups: {
                'default': [null, null, null, null, null] // PG, SG, SF, PF, C slots
            }
        };
    }

    async initLocal() {
        try {
            const res = await fetch('data/nba_data.json');
            const data = await res.json();
            this.teams = data.teams;

            this.players = data.players.map(p => ({...p, team_id: null}));


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

            // Fetch multiple pages of players for a full 400+ roster
            this.players = [];
            let cursor = 0;
            for (let page = 1; page <= 5; page++) {
                const playersRes = await fetch(`https://api.balldontlie.io/v1/players?per_page=100${cursor ? '&cursor='+cursor : ''}`, { headers });
                if (!playersRes.ok) break;

                const playersData = await playersRes.json();
                if(!playersData.data || playersData.data.length === 0) break;

                const processed = playersData.data.map(p => {
                    const positions = ['PG', 'SG', 'SF', 'PF', 'C'];
                    let posObj = p.position || '';
                    let position = 'PG';
                    if (posObj.includes('G')) position = Math.random() > 0.5 ? 'PG' : 'SG';
                    else if (posObj.includes('F')) position = Math.random() > 0.5 ? 'SF' : 'PF';
                    else if (posObj.includes('C')) position = 'C';
                    else position = positions[Math.floor(Math.random() * positions.length)];

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
                        team_id: null,
                        overall: overall,
                        stats: { offense, defense },
                        salary: salary,
                        injury: null,
                        morale: 100
                    };
                });

                this.players = this.players.concat(processed);
                if (playersData.meta && playersData.meta.next_cursor) {
                    cursor = playersData.meta.next_cursor;
                } else {
                    break;
                }
            }

            // Add rookies



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
        return this.players.filter(p => p.team_id === null || p.team_id === undefined);
    }

    setUserTeam(teamId) {
        this.state.userTeamId = teamId;
        this.state.budget = 140000000; // $140M cap

        // Prepare AI teams with random 12 players to simulate fantasy draft for them
        const allTeams = this.getTeams().filter(t => t.id !== teamId);
        let freeAgents = this.getFreeAgents().sort((a,b) => b.overall - a.overall);

        allTeams.forEach(team => {
            for(let i = 0; i < 12; i++) {
                if (freeAgents.length > 0) {
                    const p = freeAgents.shift();
                    p.team_id = team.id;
                }
            }
        });
    }

    autoAssignLineup(lineupName) {
        if (!this.state.lineups[lineupName]) {
            this.state.lineups[lineupName] = [null, null, null, null, null];
        }
        const roster = this.getTeamPlayers(this.state.userTeamId).sort((a,b) => b.overall - a.overall);
        const newLineup = [null, null, null, null, null];
        const assignedIds = new Set();

        // Very basic positional auto-assign (PG, SG, SF, PF, C)
        const positions = ['PG', 'SG', 'SF', 'PF', 'C'];

        positions.forEach((pos, idx) => {
            let player = roster.find(p => p.position === pos && !assignedIds.has(p.id));
            if (!player) {
                player = roster.find(p => !assignedIds.has(p.id));
            }
            if (player) {
                newLineup[idx] = player.id;
                assignedIds.add(player.id);
            }
        });

        this.state.lineups[lineupName] = newLineup;
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
