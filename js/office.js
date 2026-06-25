class OfficeEngine {
    constructor(dataModule) {
        this.data = dataModule;
    }

    generateEvent() {
        const events = [
            this.eventInjury.bind(this),
            this.eventContractDemand.bind(this),
            this.eventMediaDrama.bind(this)
        ];

        // 30% chance for an event each week
        if (Math.random() < 0.3) {
            const randomEvent = events[Math.floor(Math.random() * events.length)];
            return randomEvent();
        }
        return null;
    }

    eventInjury() {
        const userPlayers = this.data.getTeamPlayers(this.data.state.userTeamId);
        if (userPlayers.length === 0) return null;

        const player = userPlayers[Math.floor(Math.random() * userPlayers.length)];
        const duration = Math.floor(Math.random() * 4) + 1; // 1-4 weeks
        player.injury = duration;

        return {
            title: "Player Injured",
            message: `${player.name} suffered an injury in practice and will be out for ${duration} weeks.`,
            action: () => this.data.addNews(`Injury update: ${player.name} out for ${duration} weeks.`)
        };
    }

    eventContractDemand() {
        const userPlayers = this.data.getTeamPlayers(this.data.state.userTeamId);
        if (userPlayers.length === 0) return null;

        const player = userPlayers[Math.floor(Math.random() * userPlayers.length)];
        const newSalary = player.salary * 1.5;

        return {
            title: "Contract Demand",
            message: `${player.name} is demanding a contract extension. Increase his salary to $${newSalary.toLocaleString()} or deny and lower morale?`,
            choices: [
                {
                    text: "Accept",
                    action: () => {
                        player.salary = newSalary;
                        player.morale = 100;
                        this.data.addNews(`${player.name} signed a contract extension.`);
                    }
                },
                {
                    text: "Deny",
                    action: () => {
                        player.morale -= 20;
                        this.data.addNews(`${player.name} is unhappy after extension denied.`);
                    }
                }
            ]
        };
    }

    eventMediaDrama() {
        return {
            title: "Media Drama",
            message: "A controversial quote from your head coach was leaked to the media. Team chemistry is slightly affected.",
            action: () => {
                const userPlayers = this.data.getTeamPlayers(this.data.state.userTeamId);
                userPlayers.forEach(p => p.morale = Math.max(0, p.morale - 5));
                this.data.addNews("Media drama negatively impacted team morale.");
            }
        };
    }

    processInjuries() {
        this.data.players.forEach(p => {
            if (p.injury !== null) {
                p.injury -= 1;
                if (p.injury <= 0) {
                    p.injury = null;
                    if (p.team_id === this.data.state.userTeamId) {
                        this.data.addNews(`${p.name} has recovered from injury.`);
                    }
                }
            }
        });
    }
}

const officeEngine = new OfficeEngine(gameData);
