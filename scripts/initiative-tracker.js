/**
 * Shadowrun 2E Initiative Tracker
 * Handles initiative rolling, phase tracking, and turn order
 */
export class SR2InitiativeTracker extends Application {

    constructor(options = {}) {
        super(options);
        this.combatants = [];
        this.currentPhase = 1;
        this.currentTurn = 0;
        this.isActive = false;
    }

    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "sr2-initiative-tracker",
            title: "Initiative Tracker",
            template: "systems/shadowrun2e/templates/apps/initiative-tracker.html",
            width: 400,
            height: 600,
            resizable: true,
            classes: ["shadowrun2e", "initiative-tracker"]
        });
    }

    /** @override */
    getData() {
        const data = super.getData();

        // Sort combatants by current initiative (highest first)
        const sortedCombatants = this.combatants
            .map(c => ({
                ...c,
                currentInit: this.getCurrentInitiative(c),
                isActive: this.isActive && this.combatants[this.currentTurn]?.id === c.id
            }))
            .sort((a, b) => b.currentInit - a.currentInit);

        return {
            ...data,
            combatants: sortedCombatants,
            currentPhase: this.currentPhase,
            isActive: this.isActive,
            hasActiveCombat: this.combatants.length > 0
        };
    }

    /** @override */
    activateListeners(html) {
        super.activateListeners(html);

        // Add combatant
        html.find('.add-combatant').click(this._onAddCombatant.bind(this));

        // Remove combatant
        html.find('.remove-combatant').click(this._onRemoveCombatant.bind(this));

        // Roll initiative
        html.find('.roll-initiative').click(this._onRollInitiative.bind(this));

        // Roll all initiative
        html.find('.roll-all-initiative').click(this._onRollAllInitiative.bind(this));

        // Start combat
        html.find('.start-combat').click(this._onStartCombat.bind(this));

        // Next turn
        html.find('.next-turn').click(this._onNextTurn.bind(this));

        // Next phase
        html.find('.next-phase').click(this._onNextPhase.bind(this));

        // Reset combat
        html.find('.reset-combat').click(this._onResetCombat.bind(this));

        // Edit initiative
        html.find('.edit-initiative').change(this._onEditInitiative.bind(this));
    }

    /**
     * Add a combatant to the tracker
     */
    async _onAddCombatant(event) {
        event.preventDefault();

        // Get selected tokens or actors
        const controlled = canvas.tokens.controlled;

        if (controlled.length === 0) {
            ui.notifications.warn("Please select one or more tokens to add to initiative.");
            return;
        }

        for (const token of controlled) {
            const actor = token.actor;
            if (!actor) continue;

            // Check if already in tracker
            if (this.combatants.find(c => c.tokenId === token.id)) {
                ui.notifications.warn(`${actor.name} is already in the initiative tracker.`);
                continue;
            }

            const combatant = {
                id: foundry.utils.randomID(),
                tokenId: token.id,
                actorId: actor.id,
                name: actor.name,
                img: actor.img,
                initiative: 0,
                initiativeDice: this._getInitiativeDice(actor),
                reaction: this._getReaction(actor),
                hasRolled: false
            };

            this.combatants.push(combatant);
        }

        this.render();
    }

    /**
     * Remove a combatant from the tracker
     */
    _onRemoveCombatant(event) {
        event.preventDefault();
        const combatantId = event.currentTarget.dataset.combatantId;
        this.combatants = this.combatants.filter(c => c.id !== combatantId);

        // Adjust current turn if necessary
        if (this.currentTurn >= this.combatants.length) {
            this.currentTurn = 0;
        }

        this.render();
    }

    /**
     * Roll initiative for a single combatant
     */
    async _onRollInitiative(event) {
        event.preventDefault();
        const combatantId = event.currentTarget.dataset.combatantId;
        const combatant = this.combatants.find(c => c.id === combatantId);

        if (!combatant) return;

        await this._rollInitiativeForCombatant(combatant);
        this.render();
    }

    /**
     * Roll initiative for all combatants
     */
    async _onRollAllInitiative(event) {
        event.preventDefault();

        for (const combatant of this.combatants) {
            if (!combatant.hasRolled) {
                await this._rollInitiativeForCombatant(combatant);
            }
        }

        this.render();
    }

    /**
     * Start combat
     */
    _onStartCombat(event) {
        event.preventDefault();

        if (this.combatants.length === 0) {
            ui.notifications.warn("No combatants in initiative tracker.");
            return;
        }

        // Check if all have rolled initiative
        const unrolled = this.combatants.filter(c => !c.hasRolled);
        if (unrolled.length > 0) {
            ui.notifications.warn("Not all combatants have rolled initiative.");
            return;
        }

        this.isActive = true;
        this.currentPhase = 1;
        this.currentTurn = 0;

        this._announceCurrentTurn();
        this.render();
    }

    /**
     * Advance to next turn
     */
    _onNextTurn(event) {
        event.preventDefault();

        if (!this.isActive) return;

        this.currentTurn++;

        // Check if we need to move to next phase
        const activeCombatants = this._getActiveCombatantsForPhase();
        if (this.currentTurn >= activeCombatants.length) {
            this._onNextPhase();
            return;
        }

        this._announceCurrentTurn();
        this.render();
    }

    /**
     * Advance to next phase
     */
    _onNextPhase(event = null) {
        if (event) event.preventDefault();

        if (!this.isActive) return;

        this.currentPhase++;
        this.currentTurn = 0;

        // Check if any combatants are still active
        const activeCombatants = this._getActiveCombatantsForPhase();
        if (activeCombatants.length === 0) {
            // Start new round
            this.currentPhase = 1;
            ChatMessage.create({
                content: "<h3>New Combat Round</h3>",
                speaker: { alias: "Initiative Tracker" }
            });
        }

        this._announceCurrentTurn();
        this.render();
    }

    /**
     * Reset combat
     */
    _onResetCombat(event) {
        event.preventDefault();

        this.isActive = false;
        this.currentPhase = 1;
        this.currentTurn = 0;

        // Reset all initiative rolls
        this.combatants.forEach(c => {
            c.initiative = 0;
            c.hasRolled = false;
        });

        this.render();
    }

    /**
     * Edit initiative value
     */
    _onEditInitiative(event) {
        event.preventDefault();
        const combatantId = event.currentTarget.dataset.combatantId;
        const newValue = parseInt(event.currentTarget.value) || 0;

        const combatant = this.combatants.find(c => c.id === combatantId);
        if (combatant) {
            combatant.initiative = newValue;
            combatant.hasRolled = true;
            this.render();
        }
    }

    /**
     * Roll initiative for a specific combatant
     */
    async _rollInitiativeForCombatant(combatant) {
        const diceRoll = await new Roll(`${combatant.initiativeDice}d6`).evaluate();
        const total = diceRoll.total + combatant.reaction;

        combatant.initiative = total;
        combatant.hasRolled = true;

        // Create chat message
        const chatData = {
            user: game.user.id,
            content: `<div class="initiative-roll">
        <h3>${combatant.name} rolls Initiative</h3>
        <div class="roll-result">
          <span class="dice-result">${diceRoll.total}</span> + 
          <span class="reaction-bonus">${combatant.reaction}</span> = 
          <span class="total-initiative">${total}</span>
        </div>
        <div class="roll-details">
          ${combatant.initiativeDice}d6 + Reaction (${combatant.reaction})
        </div>
      </div>`,
            speaker: { alias: "Initiative Tracker" }
        };

        ChatMessage.create(chatData);
    }

    /**
     * Get initiative dice for an actor (base 1 + cyberware bonuses)
     */
    _getInitiativeDice(actor) {
        let dice = 1; // Base initiative dice

        // Check for cyberware that adds initiative dice
        const cyberware = actor.items.filter(i => i.type === 'cyberware');
        for (const item of cyberware) {
            if (item.system.initiativeDice) {
                dice += item.system.initiativeDice;
            }
        }

        return dice;
    }

    /**
     * Get reaction score for an actor
     */
    _getReaction(actor) {
        let reaction = actor.system.attributes?.reaction?.value || 0;

        // Check for cyberware that adds reaction
        const cyberware = actor.items.filter(i => i.type === 'cyberware');
        for (const item of cyberware) {
            if (item.system.reactionBonus) {
                reaction += item.system.reactionBonus;
            }
        }

        return reaction;
    }

    /**
     * Get current initiative for a combatant based on phase
     */
    getCurrentInitiative(combatant) {
        if (!combatant.hasRolled) return 0;
        return Math.max(0, combatant.initiative - ((this.currentPhase - 1) * 10));
    }

    /**
     * Get combatants that are active in the current phase
     */
    _getActiveCombatantsForPhase() {
        return this.combatants
            .filter(c => this.getCurrentInitiative(c) > 0)
            .sort((a, b) => this.getCurrentInitiative(b) - this.getCurrentInitiative(a));
    }

    /**
     * Announce the current turn in chat
     */
    _announceCurrentTurn() {
        const activeCombatants = this._getActiveCombatantsForPhase();

        if (activeCombatants.length === 0) return;

        const currentCombatant = activeCombatants[this.currentTurn];
        if (!currentCombatant) return;

        const currentInit = this.getCurrentInitiative(currentCombatant);

        ChatMessage.create({
            content: `<div class="turn-announcement">
        <h3>Phase ${this.currentPhase}</h3>
        <p><strong>${currentCombatant.name}</strong> acts on initiative ${currentInit}</p>
      </div>`,
            speaker: { alias: "Initiative Tracker" }
        });
    }
}

// Global instance
let initiativeTracker = null;

/**
 * Initialize the initiative tracker
 */
export function initializeInitiativeTracker() {
    // Add button to token controls
    Hooks.on("getSceneControlButtons", (controls) => {
        // Handle different possible formats for controls parameter
        let controlsArray = controls;
        if (!Array.isArray(controls)) {
            // In some Foundry versions, controls might be an object with a controls property
            if (controls && controls.controls && Array.isArray(controls.controls)) {
                controlsArray = controls.controls;
            } else {
                console.warn("SR2E | getSceneControlButtons: Unexpected controls format", controls);
                return;
            }
        }

        const tokenControls = controlsArray.find(c => c.name === "token");
        if (tokenControls) {
            tokenControls.tools.push({
                name: "initiative-tracker",
                title: "Initiative Tracker",
                icon: "fas fa-stopwatch",
                button: true,
                onClick: () => {
                    if (!initiativeTracker) {
                        initiativeTracker = new SR2InitiativeTracker();
                    }
                    initiativeTracker.render(true);
                }
            });
        }
    });

    // Add hotkey
    game.keybindings.register("shadowrun2e", "openInitiativeTracker", {
        name: "Open Initiative Tracker",
        hint: "Opens the Shadowrun 2E Initiative Tracker",
        editable: [{ key: "KeyI", modifiers: ["Control"] }],
        onDown: () => {
            if (!initiativeTracker) {
                initiativeTracker = new SR2InitiativeTracker();
            }
            initiativeTracker.render(true);
        }
    });
}