class GameApp {
    constructor() {
        this.ui = new UI(gameData, officeEngine, simEngine, draftEngine);
    }

    start() {
        this.ui.init();
        this.ui.setupDraft();

        document.getElementById('advance-week-btn').addEventListener('click', () => {
            this.advanceWeek();
        });
    }

    advanceWeek() {
        // Simulate a game for the user team against a random opponent
        const userTeamId = gameData.state.userTeamId;
        const validOpponents = gameData.getTeams().filter(t => t.id !== userTeamId);

        if (validOpponents.length === 0) return;

        const opp = validOpponents[Math.floor(Math.random() * validOpponents.length)];

        const simRes = simEngine.simulateMatch(userTeamId, opp.id);
        this.ui.showSimResult(simRes);

        const resultMsg = simRes.winner.id === userTeamId ? `Won against ${opp.name}` : `Lost to ${opp.name}`;
        gameData.addNews(`Simulated Game: ${resultMsg} (${simRes.homeScore}-${simRes.awayScore})`);

        // Process office logic
        officeEngine.processInjuries();
        const event = officeEngine.generateEvent();

        // Advance time
        gameData.state.currentWeek++;

        this.ui.updateAll();

        if (event) {
            this.ui.showEvent(event);
        }
    }
}

const app = new GameApp();
window.onload = () => app.start();
