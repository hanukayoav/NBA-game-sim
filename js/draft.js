class DraftEngine {
    constructor(dataModule) {
        this.data = dataModule;
        this.draftOrder = [];
        this.draftClass = [];
        this.currentPickIndex = 0;
    }

    startDraft() {
        // Simple draft order (reverse of ID for simplicity, in a real game would be lottery)
        this.draftOrder = [...this.data.getTeams()].reverse();
        // Pool is rookies
        this.draftClass = this.data.getFreeAgents().filter(p => p.id > 100000).sort((a,b) => b.overall - a.overall);
        this.currentPickIndex = 0;
        this.data.addNews("The NBA Draft has started!");
    }

    simulateNextPick() {
        if (this.currentPickIndex >= this.draftOrder.length) return null;
        if (this.draftClass.length === 0) return null;

        const pickingTeam = this.draftOrder[this.currentPickIndex];
        const isUser = pickingTeam.id === this.data.state.userTeamId;

        if (isUser) {
            return { type: 'USER_PICK', team: pickingTeam };
        } else {
            // AI Draft Logic: Needs vs BPA (Best Player Available)
            const teamPlayers = this.data.getTeamPlayers(pickingTeam.id);
            const teamPositions = teamPlayers.reduce((acc, p) => {
                acc[p.position] = (acc[p.position] || 0) + 1;
                return acc;
            }, {});

            // Find weakest position (simplistic: position with fewest players)
            const positions = ['PG', 'SG', 'SF', 'PF', 'C'];
            let weakestPos = positions[0];
            let minCount = 99;
            for(let pos of positions) {
                const count = teamPositions[pos] || 0;
                if (count < minCount) {
                    minCount = count;
                    weakestPos = pos;
                }
            }

            // Cap Space Check
            const payroll = this.data.getTeamPayroll(pickingTeam.id);
            const capSpace = 140000000 - payroll; // $140M budget

            // Filter out players AI can't afford
            const affordableClass = this.draftClass.filter(p => p.salary <= capSpace);

            let pickedPlayer;
            if (affordableClass.length === 0) {
                 // Skip pick if broke
                 this.data.addNews(`${pickingTeam.name} forfeited their pick due to cap space limits.`);
                 this.currentPickIndex++;
                 return { type: 'AI_SKIP', team: pickingTeam };
            }

            // Try to find top player at weakest position
            const needPicks = affordableClass.filter(p => p.position === weakestPos);

            // If the best player at the needed position is relatively close to the Best Player Available, pick for need
            const bestAvailable = affordableClass[0];

            if (needPicks.length > 0 && (bestAvailable.overall - needPicks[0].overall) < 5) {
                pickedPlayer = needPicks[0];
            } else {
                pickedPlayer = bestAvailable;
            }

            this.executePick(pickingTeam, pickedPlayer);
            return { type: 'AI_PICK', team: pickingTeam, player: pickedPlayer };
        }
    }

    executePick(team, player) {
        player.team_id = team.id;
        const index = this.draftClass.findIndex(p => p.id === player.id);
        if (index > -1) this.draftClass.splice(index, 1);

        this.data.addNews(`${team.name} drafted ${player.name} (${player.position}) OVR: ${player.overall}`);
        this.currentPickIndex++;
    }
}

const draftEngine = new DraftEngine(gameData);
