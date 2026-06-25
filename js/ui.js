class UI {
    constructor(data, office, sim, draft) {
        this.data = data;
        this.office = office;
        this.sim = sim;
        this.draft = draft;
        this.formatMoney = (num) => '$' + num.toLocaleString();
    }

    init() {
        const sourceSelect = document.getElementById('data-source');
        const apiKeyContainer = document.getElementById('api-key-container');

        sourceSelect.addEventListener('change', (e) => {
            if (e.target.value === 'api') {
                apiKeyContainer.style.display = 'block';
            } else {
                apiKeyContainer.style.display = 'none';
            }
        });

        document.getElementById('load-data-btn').addEventListener('click', async () => {
            const status = document.getElementById('init-status');
            status.textContent = "Loading data...";
            let success = false;
            if (sourceSelect.value === 'api') {
                const key = document.getElementById('api-key-input').value;
                if (!key) { status.textContent = "Please enter an API key."; return; }
                success = await this.data.initAPI(key);
            } else {
                success = await this.data.initLocal();
                // Clear out existing team assignments so we can fantasy draft from scratch
                this.data.players.forEach(p => p.team_id = null);
            }

            if (success) {
                status.textContent = "Data loaded! Select team.";
                document.getElementById('load-data-btn').style.display = 'none';
                document.getElementById('start-game-btn').style.display = 'inline-block';

                const select = document.getElementById('team-select');
                this.data.getTeams().forEach(t => {
                    const opt = document.createElement('option');
                    opt.value = t.id;
                    opt.textContent = `${t.city} ${t.name}`;
                    select.appendChild(opt);
                });
            } else {
                status.textContent = "Failed to load data.";
            }
        });


        document.getElementById('start-game-btn').addEventListener('click', () => {
            window.gameUI = this; // attach to window for testing

            const teamId = parseInt(document.getElementById('team-select').value);
            this.data.setUserTeam(teamId);
            document.getElementById('init-view').style.display = 'none';
            document.getElementById('fantasy-draft-view').style.display = 'flex';
            this.updateFantasyDraftUI();
        });

        document.getElementById('finish-fantasy-draft-btn').addEventListener('click', () => {
            document.getElementById('fantasy-draft-view').style.display = 'none';
            document.getElementById('game-view').style.display = 'block';
            this.data.autoAssignLineup('default');
            this.updateAll();
        });

        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');

                document.querySelectorAll('.view-panel').forEach(p => p.style.display = 'none');
                document.getElementById(e.target.dataset.target).style.display = 'block';
                this.updateAll();
            });
        });

        this.setupTradeUI();
        this.setupLineupsUI();
    }

    updateFantasyDraftUI() {
        const tbody = document.getElementById('fantasy-available-tbody');
        tbody.innerHTML = '';

        const roster = this.data.getTeamPlayers(this.data.state.userTeamId);
        document.getElementById('fantasy-roster-count').textContent = roster.length;

        const btn = document.getElementById('finish-fantasy-draft-btn');
        if (roster.length >= 12) {
            btn.style.display = 'block';
            document.getElementById('fantasy-draft-status').textContent = "Roster full! You can start the season.";
        } else {
            btn.style.display = 'none';
            document.getElementById('fantasy-draft-status').textContent = "Pick your players.";
        }

        // Show top 100 available free agents
        const available = this.data.getFreeAgents().sort((a,b) => b.overall - a.overall).slice(0, 100);

        available.forEach(p => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${p.name}</td>
                <td>${p.position}</td>
                <td>${p.overall}</td>
                <td>${this.formatMoney(p.salary)}</td>
                <td><button class="btn f-draft-btn" data-id="${p.id}" ${roster.length >= 12 ? 'disabled style="background:grey"' : ''}>Draft</button></td>
            `;
            tbody.appendChild(tr);
        });

        document.querySelectorAll('.f-draft-btn').forEach(b => {
            b.addEventListener('click', (e) => {
                const id = parseInt(e.target.dataset.id);
                const player = this.data.players.find(x => x.id === id);
                if (player) {
                    player.team_id = this.data.state.userTeamId;
                    this.updateFantasyDraftUI();
                }
            });
        });

        // Update roster list
        const ul = document.getElementById('fantasy-roster-list');
        ul.innerHTML = '';
        roster.sort((a,b) => b.overall - a.overall).forEach(p => {
            const li = document.createElement('li');
            li.style.padding = "10px";
            li.style.background = "#333";
            li.style.borderRadius = "4px";
            li.innerHTML = `<strong>${p.name}</strong> (${p.position}) - ${p.overall} OVR <br> <small>${this.formatMoney(p.salary)}</small>`;
            ul.appendChild(li);
        });
    }

    updateAll() {
        this.updateDashboard();
        this.updateRoster();
        this.updateLineupsView();
        this.updateFreeAgents();
        this.updateTradeMarket();
        this.updateNews();
        document.getElementById('week-display').textContent = this.data.state.currentWeek;
    }

    updateDashboard() {
        const team = this.data.getUserTeam();
        if (!team) return;
        const payroll = this.data.getTeamPayroll(team.id);
        const capSpace = this.data.state.budget - payroll;
        const rating = this.sim.calculateTeamRating(team.id);

        document.getElementById('dash-team').textContent = team.name;
        document.getElementById('dash-cap').textContent = this.formatMoney(capSpace);
        document.getElementById('dash-cap').style.color = capSpace < 0 ? 'var(--red)' : 'var(--accent)';
        document.getElementById('dash-rating').textContent = rating.overall.toFixed(1);
    }

    updateNews() {
        const ul = document.getElementById('news-list');
        ul.innerHTML = '';
        this.data.state.news.slice(0, 5).forEach(n => {
            const li = document.createElement('li');
            li.textContent = n;
            ul.appendChild(li);
        });
    }

    updateRoster() {
        const tbody = document.getElementById('roster-tbody');
        tbody.innerHTML = '';
        const players = this.data.getTeamPlayers(this.data.state.userTeamId).sort((a,b) => b.overall - a.overall);

        players.forEach(p => {
            const tr = document.createElement('tr');
            const status = p.injury ? `<span style="color:var(--red)">Injured (${p.injury}w)</span>` : `<span style="color:var(--green)">Healthy</span>`;

            tr.innerHTML = `
                <td>${p.name}</td>
                <td>${p.position}</td>
                <td>${p.overall}</td>
                <td>${this.formatMoney(p.salary)}</td>
                <td>${status}</td>
                <td><button class="btn cut-btn" data-id="${p.id}" style="padding:5px; background:var(--red)">Cut</button></td>
            `;
            tbody.appendChild(tr);
        });

        document.querySelectorAll('.cut-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.target.dataset.id);
                const p = this.data.players.find(x => x.id === id);
                if (p) {
                    p.team_id = null;
                    // Remove from all lineups if cut
                    Object.keys(this.data.state.lineups).forEach(lname => {
                        this.data.state.lineups[lname] = this.data.state.lineups[lname].map(lid => lid === id ? null : lid);
                    });
                    this.data.addNews(`Cut ${p.name} from roster.`);
                    this.updateAll();
                }
            });
        });
    }

    setupLineupsUI() {
        document.getElementById('create-lineup-btn').addEventListener('click', () => {
            const name = document.getElementById('new-lineup-name').value.trim();
            if (name && !this.data.state.lineups[name]) {
                this.data.state.lineups[name] = [null, null, null, null, null];
                this.data.state.activeLineupId = name;
                document.getElementById('new-lineup-name').value = '';
                this.updateAll();
            }
        });

        document.getElementById('lineup-select').addEventListener('change', (e) => {
            this.updateLineupsView(e.target.value);
        });

        document.getElementById('activate-lineup-btn').addEventListener('click', () => {
            const selected = document.getElementById('lineup-select').value;
            this.data.state.activeLineupId = selected;
            this.updateAll();
        });
    }

    updateLineupsView(viewLineupId = null) {
        const select = document.getElementById('lineup-select');
        const currentVal = viewLineupId || select.value || this.data.state.activeLineupId;

        select.innerHTML = '';
        Object.keys(this.data.state.lineups).forEach(lname => {
            const opt = document.createElement('option');
            opt.value = lname;
            opt.textContent = lname;
            if (lname === currentVal) opt.selected = true;
            select.appendChild(opt);
        });

        const editingLineupName = select.value;
        document.getElementById('current-editing-lineup').textContent = editingLineupName;
        document.getElementById('active-lineup-display').textContent = this.data.state.activeLineupId;

        const ltbody = document.getElementById('lineups-tbody');
        const btbody = document.getElementById('bench-tbody');
        ltbody.innerHTML = '';
        btbody.innerHTML = '';

        const players = this.data.getTeamPlayers(this.data.state.userTeamId);
        const currentLineupArr = this.data.state.lineups[editingLineupName] || [null, null, null, null, null];
        const formationSlots = ['PG', 'SG', 'SF', 'PF', 'C'];

        // Starters
        formationSlots.forEach((slot, index) => {
            const id = currentLineupArr[index];
            const p = players.find(x => x.id === id);
            const tr = document.createElement('tr');

            if (p) {
                tr.innerHTML = `
                    <td><strong>${slot}</strong></td>
                    <td>${p.name} <small style="color:#aaa">(${p.position} - ${p.overall})</small></td>
                    <td><button class="btn bench-btn" data-index="${index}" style="padding:5px; background:var(--red)">Remove</button></td>
                `;
            } else {
                tr.innerHTML = `
                    <td><strong>${slot}</strong></td>
                    <td style="color:#666">Empty</td>
                    <td></td>
                `;
            }
            ltbody.appendChild(tr);
        });

        // Bench
        players.filter(p => !currentLineupArr.includes(p.id)).forEach(p => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${p.name}</td>
                <td>${p.position}</td>
                <td>${p.overall}</td>
                <td>
                    <select class="assign-slot-select" data-id="${p.id}" style="padding:5px; background:#333; color:#fff; border:1px solid #555;">
                        <option value="">-- Slot --</option>
                        ${formationSlots.map((s, i) => `<option value="${i}">${s}</option>`).join('')}
                    </select>
                </td>
            `;
            btbody.appendChild(tr);
        });

        document.querySelectorAll('.bench-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.data.state.lineups[editingLineupName][index] = null;
                this.updateLineupsView(editingLineupName);
            });
        });

        document.querySelectorAll('.assign-slot-select').forEach(sel => {
            sel.addEventListener('change', (e) => {
                const slotIndex = parseInt(e.target.value);
                const pId = parseInt(e.target.dataset.id);
                if (!isNaN(slotIndex)) {
                    this.data.state.lineups[editingLineupName][slotIndex] = pId;
                    this.updateLineupsView(editingLineupName);
                }
            });
        });
    }

    updateFreeAgents() {
        const tbody = document.getElementById('fa-tbody');
        tbody.innerHTML = '';
        const fa = this.data.getFreeAgents().filter(p => p.id < 100000).sort((a,b) => b.overall - a.overall).slice(0, 50);

        const payroll = this.data.getTeamPayroll(this.data.state.userTeamId);
        const capSpace = this.data.state.budget - payroll;

        fa.forEach(p => {
            const tr = document.createElement('tr');
            const canAfford = capSpace >= p.salary;

            tr.innerHTML = `
                <td>${p.name}</td>
                <td>${p.position}</td>
                <td>${p.overall}</td>
                <td>${this.formatMoney(p.salary)}</td>
                <td><button class="btn sign-btn" data-id="${p.id}" ${!canAfford ? 'disabled style="background:grey"' : ''}>Sign</button></td>
            `;
            tbody.appendChild(tr);
        });

        document.querySelectorAll('.sign-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.target.dataset.id);
                const p = this.data.players.find(x => x.id === id);
                if (p) {
                    p.team_id = this.data.state.userTeamId;
                    this.data.addNews(`Signed free agent ${p.name}.`);
                    this.updateAll();
                }
            });
        });
    }

    setupTradeUI() {
        const userSelect = document.getElementById('trade-user-player');
        const teamSelect = document.getElementById('trade-target-team');
        const targetSelect = document.getElementById('trade-target-player');
        const btn = document.getElementById('propose-trade-btn');

        teamSelect.addEventListener('change', () => this.updateTradeTargetPlayers());

        btn.addEventListener('click', () => {
            const uid = parseInt(userSelect.value);
            const tid = parseInt(targetSelect.value);
            const uPlayer = this.data.players.find(p => p.id === uid);
            const tPlayer = this.data.players.find(p => p.id === tid);

            if (uPlayer && tPlayer) {
                // AI Trade Logic: Simplistic value check (Overall + Salary)
                const uValue = uPlayer.overall - (uPlayer.salary / 1000000);
                const tValue = tPlayer.overall - (tPlayer.salary / 1000000);

                if (uValue >= tValue - 5) { // AI accepts if value is close
                    const tTeamId = tPlayer.team_id;
                    uPlayer.team_id = tTeamId;
                    tPlayer.team_id = this.data.state.userTeamId;

                    // Cleanup lineup
                    Object.keys(this.data.state.lineups).forEach(lname => {
                        this.data.state.lineups[lname] = this.data.state.lineups[lname].map(lid => lid === uid ? null : lid);
                    });

                    document.getElementById('trade-status').innerHTML = `<span style="color:var(--green)">Trade Accepted!</span>`;
                    this.data.addNews(`Traded ${uPlayer.name} for ${tPlayer.name}.`);
                    this.updateAll();
                } else {
                    document.getElementById('trade-status').innerHTML = `<span style="color:var(--red)">Trade Rejected! AI thinks ${tPlayer.name} is more valuable.</span>`;
                }
            }
        });
    }

    updateTradeMarket() {
        const userSelect = document.getElementById('trade-user-player');
        userSelect.innerHTML = '';
        this.data.getTeamPlayers(this.data.state.userTeamId).forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = `${p.name} (${p.overall} OVR)`;
            userSelect.appendChild(opt);
        });

        const teamSelect = document.getElementById('trade-target-team');
        if (teamSelect.children.length === 0) {
            this.data.getTeams().filter(t => t.id !== this.data.state.userTeamId).forEach(t => {
                const opt = document.createElement('option');
                opt.value = t.id;
                opt.textContent = t.name;
                teamSelect.appendChild(opt);
            });
            this.updateTradeTargetPlayers();
        }
    }

    updateTradeTargetPlayers() {
        const teamId = parseInt(document.getElementById('trade-target-team').value);
        const targetSelect = document.getElementById('trade-target-player');
        targetSelect.innerHTML = '';
        this.data.getTeamPlayers(teamId).forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = `${p.name} (${p.overall} OVR)`;
            targetSelect.appendChild(opt);
        });
    }

    showEvent(eventObj) {
        if (!eventObj) return;
        const modal = document.getElementById('event-modal');
        document.getElementById('event-title').textContent = eventObj.title;
        document.getElementById('event-msg').textContent = eventObj.message;
        const actions = document.getElementById('event-actions');
        actions.innerHTML = '';

        if (eventObj.choices) {
            eventObj.choices.forEach(c => {
                const b = document.createElement('button');
                b.className = 'btn';
                b.textContent = c.text;
                b.onclick = () => { c.action(); modal.style.display = 'none'; this.updateAll(); };
                actions.appendChild(b);
            });
        } else {
            const b = document.createElement('button');
            b.className = 'btn';
            b.textContent = 'OK';
            b.onclick = () => { if(eventObj.action) eventObj.action(); modal.style.display = 'none'; this.updateAll(); };
            actions.appendChild(b);
        }
        modal.style.display = 'flex';
    }

    showSimResult(res) {
        const div = document.getElementById('sim-results');

        let html = `
            <div style="font-size:1.2rem; text-align:center; margin-bottom: 10px;">
                <strong>${res.home.city} ${res.home.name}</strong> ${res.homeScore} - ${res.awayScore} <strong>${res.away.city} ${res.away.name}</strong>
            </div>
            <div style="display:flex; gap:20px; justify-content:center;">
                <div style="flex:1;">
                    <h4>${res.home.name} Box Score</h4>
                    <table style="font-size:0.85rem;">
                        <tr><th>Player</th><th>PTS</th><th>REB</th><th>AST</th><th>2PT</th><th>3PT</th><th>FT</th></tr>
        `;
        Object.values(res.homeBox).forEach(b => {
            html += `<tr><td>${b.name}</td><td>${b.pts}</td><td>${b.reb}</td><td>${b.ast}</td><td>${b.fg2}</td><td>${b.fg3}</td><td>${b.ft}</td></tr>`;
        });
        html += `</table></div><div style="flex:1;">
                    <h4>${res.away.name} Box Score</h4>
                    <table style="font-size:0.85rem;">
                        <tr><th>Player</th><th>PTS</th><th>REB</th><th>AST</th><th>2PT</th><th>3PT</th><th>FT</th></tr>`;
        Object.values(res.awayBox).forEach(b => {
            html += `<tr><td>${b.name}</td><td>${b.pts}</td><td>${b.reb}</td><td>${b.ast}</td><td>${b.fg2}</td><td>${b.fg3}</td><td>${b.ft}</td></tr>`;
        });
        html += `</table></div></div>`;

        div.innerHTML = html;
    }

    setupDraft() {
        document.getElementById('start-draft-btn').addEventListener('click', () => {
            this.draft.startDraft();
            document.getElementById('start-draft-btn').style.display = 'none';
            this.renderDraftClass();
            this.nextDraftPick();
        });
    }

    renderDraftClass() {
        const tbody = document.getElementById('draft-tbody');
        tbody.innerHTML = '';
        this.draft.draftClass.forEach(p => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${p.name}</td>
                <td>${p.position}</td>
                <td>${p.overall}</td>
                <td><button class="btn draft-btn" data-id="${p.id}" style="display:none">Draft</button></td>
            `;
            tbody.appendChild(tr);
        });
    }

    nextDraftPick() {
        const pickInfo = this.draft.simulateNextPick();
        const status = document.getElementById('draft-status');

        if (!pickInfo) {
            status.textContent = "Draft is complete!";
            this.updateAll();
            return;
        }

        if (pickInfo.type === 'USER_PICK') {
            status.innerHTML = `<strong>You are on the clock!</strong> Make your pick.`;
            document.querySelectorAll('.draft-btn').forEach(b => {
                b.style.display = 'inline-block';
                const newB = b.cloneNode(true);
                b.parentNode.replaceChild(newB, b);

                newB.addEventListener('click', (e) => {
                    const id = parseInt(e.target.dataset.id);
                    const player = this.draft.draftClass.find(x => x.id === id);
                    this.draft.executePick(pickInfo.team, player);
                    document.querySelectorAll('.draft-btn').forEach(btn => btn.style.display = 'none');
                    this.renderDraftClass();
                    setTimeout(() => this.nextDraftPick(), 1000);
                });
            });
        } else if (pickInfo.type === 'AI_SKIP') {
            status.textContent = `Pick ${this.draft.currentPickIndex}: ${pickInfo.team.name} forfeited their pick (Cap Space).`;
            setTimeout(() => this.nextDraftPick(), 1000);
        } else {
            status.textContent = `Pick ${this.draft.currentPickIndex}: ${pickInfo.team.name} drafted ${pickInfo.player.name}.`;
            this.renderDraftClass();
            setTimeout(() => this.nextDraftPick(), 1000);
        }
    }
}
