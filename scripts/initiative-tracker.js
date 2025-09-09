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

        // Get active combatants for current phase and sort by current initiative (highest first)
        const activeCombatants = this._getActiveCombatantsForPhase();
        
        // Map all combatants with current phase information
        const sortedCombatants = this.combatants
            .map(c => ({
                ...c,
                currentInit: this.getCurrentInitiative(c),
                isActive: this.isActive && activeCombatants[this.currentTurn]?.id === c.id,
                isActiveInPhase: this.getCurrentInitiative(c) > 0
            }))
            .sort((a, b) => {
                // Sort by current initiative for this phase, then by original initiative
                const aInit = this.getCurrentInitiative(a);
                const bInit = this.getCurrentInitiative(b);
                if (aInit !== bInit) {
                    return bInit - aInit;
                }
                return (b.initiative || 0) - (a.initiative || 0);
            });

        return {
            ...data,
            combatants: sortedCombatants,
            activeCombatants: activeCombatants,
            currentPhase: this.currentPhase,
            isActive: this.isActive,
            hasActiveCombat: this.combatants.length > 0,
            maxPhases: this._getMaximumPhases()
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

        // GM NPC controls
        html.find('.add-npc').click(this._onAddNPC.bind(this));
        html.find('.roll-npc-initiative').click(this._onRollNPCInitiative.bind(this));
        html.find('.modify-npc').click(this._onModifyNPC.bind(this));
        html.find('.manage-npcs').click(this._onManageNPCs.bind(this));
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
                hasRolled: false,
                isNPC: this._isNPC(actor)
            };

            this.combatants.push(combatant);
        }

        this.render();
    }

    /**
     * Add NPCs to the tracker (GM only)
     */
    async _onAddNPC(event) {
        event.preventDefault();

        if (!game.user.isGM) {
            ui.notifications.warn("Only GMs can add NPCs to the initiative tracker.");
            return;
        }

        // Show dialog to select NPCs from available actors
        const npcActors = game.actors.filter(actor => 
            actor.type === 'character' && this._isNPC(actor)
        );

        if (npcActors.length === 0) {
            ui.notifications.warn("No NPC actors found. Create NPC actors first.");
            return;
        }

        const content = `
            <div class="npc-selection-dialog">
                <h3>Select NPCs to Add</h3>
                <div class="npc-list">
                    ${npcActors.map(actor => `
                        <div class="npc-option">
                            <label>
                                <input type="checkbox" name="npc-${actor.id}" value="${actor.id}">
                                <img src="${actor.img}" width="24" height="24">
                                ${actor.name}
                            </label>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        const dialog = new Dialog({
            title: "Add NPCs to Initiative Tracker",
            content: content,
            buttons: {
                add: {
                    icon: '<i class="fas fa-plus"></i>',
                    label: "Add Selected",
                    callback: async (html) => {
                        const selectedNPCs = [];
                        html.find('input[type="checkbox"]:checked').each((i, checkbox) => {
                            const actorId = checkbox.value;
                            const actor = game.actors.get(actorId);
                            if (actor) selectedNPCs.push(actor);
                        });

                        if (selectedNPCs.length === 0) {
                            ui.notifications.warn("No NPCs selected.");
                            return;
                        }

                        for (const actor of selectedNPCs) {
                            // Check if already in tracker
                            if (this.combatants.find(c => c.actorId === actor.id)) {
                                ui.notifications.warn(`${actor.name} is already in the initiative tracker.`);
                                continue;
                            }

                            const combatant = {
                                id: foundry.utils.randomID(),
                                tokenId: null, // NPCs might not have tokens
                                actorId: actor.id,
                                name: actor.name,
                                img: actor.img,
                                initiative: 0,
                                initiativeDice: this._getInitiativeDice(actor),
                                reaction: this._getReaction(actor),
                                hasRolled: false,
                                isNPC: true
                            };

                            this.combatants.push(combatant);
                        }

                        this.render();
                        ui.notifications.info(`Added ${selectedNPCs.length} NPC(s) to initiative tracker.`);
                    }
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: "Cancel"
                }
            },
            default: "add"
        });

        dialog.render(true);
    }

    /**
     * Roll initiative for NPCs (GM only)
     */
    async _onRollNPCInitiative(event) {
        event.preventDefault();

        if (!game.user.isGM) {
            ui.notifications.warn("Only GMs can roll initiative for NPCs.");
            return;
        }

        const npcCombatants = this.combatants.filter(c => c.isNPC && !c.hasRolled);

        if (npcCombatants.length === 0) {
            ui.notifications.warn("No NPCs need initiative rolls.");
            return;
        }

        for (const combatant of npcCombatants) {
            await this._rollInitiativeForCombatant(combatant);
        }

        this.render();
        ui.notifications.info(`Rolled initiative for ${npcCombatants.length} NPC(s).`);
    }

    /**
     * Modify NPC stats (GM only)
     */
    async _onModifyNPC(event) {
        event.preventDefault();

        if (!game.user.isGM) {
            ui.notifications.warn("Only GMs can modify NPC stats.");
            return;
        }

        const combatantId = event.currentTarget.dataset.combatantId;
        const combatant = this.combatants.find(c => c.id === combatantId);

        if (!combatant || !combatant.isNPC) {
            ui.notifications.warn("Can only modify NPC combatants.");
            return;
        }

        const content = `
            <div class="npc-modify-dialog">
                <h3>Modify ${combatant.name}</h3>
                <div class="modify-fields">
                    <div class="field-group">
                        <label for="npc-name">Name:</label>
                        <input type="text" id="npc-name" value="${combatant.name}">
                    </div>
                    <div class="field-group">
                        <label for="npc-initiative-dice">Initiative Dice:</label>
                        <input type="number" id="npc-initiative-dice" value="${combatant.initiativeDice}" min="1" max="10">
                    </div>
                    <div class="field-group">
                        <label for="npc-reaction">Reaction:</label>
                        <input type="number" id="npc-reaction" value="${combatant.reaction}" min="1" max="30">
                    </div>
                    <div class="field-group">
                        <label for="npc-current-init">Current Initiative:</label>
                        <input type="number" id="npc-current-init" value="${combatant.initiative}" min="0" max="50">
                    </div>
                </div>
            </div>
        `;

        const dialog = new Dialog({
            title: `Modify NPC: ${combatant.name}`,
            content: content,
            buttons: {
                save: {
                    icon: '<i class="fas fa-save"></i>',
                    label: "Save Changes",
                    callback: async (html) => {
                        const newName = html.find('#npc-name').val().trim();
                        const newInitiativeDice = parseInt(html.find('#npc-initiative-dice').val()) || 1;
                        const newReaction = parseInt(html.find('#npc-reaction').val()) || 1;
                        const newCurrentInit = parseInt(html.find('#npc-current-init').val()) || 0;

                        if (!newName) {
                            ui.notifications.warn("NPC name cannot be empty.");
                            return;
                        }

                        // Update combatant data
                        combatant.name = newName;
                        combatant.initiativeDice = newInitiativeDice;
                        combatant.reaction = newReaction;
                        combatant.initiative = newCurrentInit;

                        // Recalculate action phases if initiative changed
                        if (combatant.hasRolled) {
                            combatant.actionPhases = this._calculateActionPhases(newCurrentInit);
                        }

                        this.render();
                        ui.notifications.info(`${newName} stats updated successfully.`);
                    }
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: "Cancel"
                }
            },
            default: "save",
            render: (html) => {
                // Style the dialog
                html.find('.npc-modify-dialog').css({
                    'font-family': 'Courier New, monospace',
                    'color': '#e0e0e0'
                });
                html.find('.field-group').css({
                    'display': 'flex',
                    'justify-content': 'space-between',
                    'align-items': 'center',
                    'margin-bottom': '10px'
                });
                html.find('label').css({
                    'font-weight': 'bold',
                    'min-width': '120px'
                });
                html.find('input').css({
                    'background': '#1a1a1a',
                    'color': '#00ffff',
                    'border': '1px solid #333',
                    'padding': '4px 8px',
                    'border-radius': '3px'
                });
            }
        });

        dialog.render(true);
    }

    /**
     * Remove a combatant from the tracker
     */
    _onRemoveCombatant(event) {
        event.preventDefault();
        const combatantId = event.currentTarget.dataset.combatantId;
        const combatant = this.combatants.find(c => c.id === combatantId);
        
        if (!combatant) return;

        // For NPCs, only GMs can remove them
        if (combatant.isNPC && !game.user.isGM) {
            ui.notifications.warn("Only GMs can remove NPCs from the initiative tracker.");
            return;
        }

        // Confirm removal for NPCs
        if (combatant.isNPC) {
            const confirmed = confirm(`Remove ${combatant.name} from combat?`);
            if (!confirmed) return;
        }

        this.combatants = this.combatants.filter(c => c.id !== combatantId);

        // Adjust current turn if necessary
        if (this.currentTurn >= this.combatants.length) {
            this.currentTurn = 0;
        }

        // Show notification
        const actorType = combatant.isNPC ? "NPC" : "PC";
        ui.notifications.info(`${combatant.name} (${actorType}) removed from initiative tracker.`);

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
     * Updated to handle SR2 phase system properly
     */
    _onNextPhase(event = null) {
        if (event) event.preventDefault();

        if (!this.isActive) return;

        this.currentPhase++;
        this.currentTurn = 0;

        // Check if any combatants are still active in this phase
        const activeCombatants = this._getActiveCombatantsForPhase();
        if (activeCombatants.length === 0) {
            // Check if we've reached the maximum possible phases
            const maxPhases = this._getMaximumPhases();
            
            if (this.currentPhase > maxPhases) {
                // Start new round
                this.currentPhase = 1;
                ChatMessage.create({
                    content: "<h3>New Combat Round</h3><p>All combatants have completed their actions. Starting new round.</p>",
                    speaker: { alias: "Initiative Tracker" }
                });
            } else {
                // Continue to next phase even if no one acts (for proper phase tracking)
                ChatMessage.create({
                    content: `<h3>Phase ${this.currentPhase}</h3><p>No combatants act in this phase.</p>`,
                    speaker: { alias: "Initiative Tracker" }
                });
            }
        }

        this._announceCurrentTurn();
        this.render();
    }

    /**
     * Get the maximum number of phases needed for this round
     * Based on the highest initiative score divided by 10, rounded up
     */
    _getMaximumPhases() {
        if (this.combatants.length === 0) return 1;
        
        const maxInitiative = Math.max(...this.combatants.map(c => c.initiative || 0));
        return Math.ceil(maxInitiative / 10);
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
        combatant.actionPhases = this._calculateActionPhases(total);
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
     * Calculate action phases from initiative score
     * SR2 phase system: characters act on multiple phases based on initiative
     * Each phase occurs every 10 points of initiative
     * Example: Initiative 27 = acts on phases 27, 17, 7
     */
    _calculateActionPhases(initiativeScore) {
        const phases = [];
        let currentPhase = initiativeScore;

        while (currentPhase > 0) {
            phases.push(currentPhase);
            currentPhase -= 10;
        }

        return phases;
    }

    /**
     * Determine if an actor is an NPC (no player owners)
     */
    _isNPC(actor) {
        // Check if the actor has any player owners
        const playerOwners = Object.entries(actor.ownership || {})
            .filter(([userId, permission]) => {
                const user = game.users.get(userId);
                return user && !user.isGM && permission >= CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
            });
        
        return playerOwners.length === 0;
    }

    /**
     * Get current initiative for a combatant based on phase
     * Updated to use SR2 phase system with action phases array
     */
    getCurrentInitiative(combatant) {
        if (!combatant.hasRolled) return 0;
        
        // If combatant has action phases array (new system), use it
        if (combatant.actionPhases && Array.isArray(combatant.actionPhases)) {
            // Find the phase value for the current phase number
            const phaseIndex = this.currentPhase - 1;
            if (phaseIndex < combatant.actionPhases.length) {
                return combatant.actionPhases[phaseIndex];
            } else {
                return 0; // No more actions this round
            }
        }
        
        // Fallback to old calculation for backwards compatibility
        return Math.max(0, combatant.initiative - ((this.currentPhase - 1) * 10));
    }

    /**
     * Get combatants that are active in the current phase
     * Updated to work with SR2 phase system
     */
    _getActiveCombatantsForPhase() {
        return this.combatants
            .filter(c => {
                const currentInit = this.getCurrentInitiative(c);
                return currentInit > 0;
            })
            .sort((a, b) => this.getCurrentInitiative(b) - this.getCurrentInitiative(a));
    }

    /**
     * Determine if an actor is an NPC (no player owners)
     */
    _isNPC(actor) {
        // Check if the actor has any player owners
        const playerOwners = Object.entries(actor.ownership || {})
            .filter(([userId, permission]) => {
                const user = game.users.get(userId);
                return user && !user.isGM && permission >= CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
            });
        
        return playerOwners.length === 0;
    }

    /**
     * Bulk manage NPCs (GM only)
     */
    async _onManageNPCs(event) {
        event.preventDefault();

        if (!game.user.isGM) {
            ui.notifications.warn("Only GMs can manage NPCs.");
            return;
        }

        const npcCombatants = this.combatants.filter(c => c.isNPC);

        if (npcCombatants.length === 0) {
            ui.notifications.warn("No NPCs in the initiative tracker.");
            return;
        }

        const content = `
            <div class="npc-management-dialog">
                <h3>Manage NPCs in Combat</h3>
                <div class="npc-management-list">
                    ${npcCombatants.map(npc => `
                        <div class="npc-management-item" data-combatant-id="${npc.id}">
                            <div class="npc-info">
                                <img src="${npc.img}" width="32" height="32">
                                <div class="npc-details">
                                    <strong>${npc.name}</strong>
                                    <div class="npc-stats">
                                        Initiative: ${npc.initiative} | Dice: ${npc.initiativeDice}d6 | Reaction: +${npc.reaction}
                                    </div>
                                </div>
                            </div>
                            <div class="npc-actions">
                                <button class="quick-modify" data-combatant-id="${npc.id}" title="Quick Modify">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="quick-remove" data-combatant-id="${npc.id}" title="Remove from Combat">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div class="bulk-actions">
                    <button class="remove-all-npcs" title="Remove All NPCs">
                        <i class="fas fa-trash"></i> Remove All NPCs
                    </button>
                    <button class="reroll-all-npcs" title="Reroll All NPC Initiative">
                        <i class="fas fa-dice"></i> Reroll All Initiative
                    </button>
                </div>
            </div>
        `;

        const dialog = new Dialog({
            title: "NPC Management",
            content: content,
            buttons: {
                close: {
                    icon: '<i class="fas fa-times"></i>',
                    label: "Close"
                }
            },
            render: (html) => {
                // Quick modify buttons
                html.find('.quick-modify').click((e) => {
                    const combatantId = e.currentTarget.dataset.combatantId;
                    const mockEvent = { currentTarget: { dataset: { combatantId } }, preventDefault: () => {} };
                    this._onModifyNPC(mockEvent);
                });

                // Quick remove buttons
                html.find('.quick-remove').click((e) => {
                    const combatantId = e.currentTarget.dataset.combatantId;
                    const combatant = this.combatants.find(c => c.id === combatantId);
                    if (combatant && confirm(`Remove ${combatant.name} from combat?`)) {
                        this.combatants = this.combatants.filter(c => c.id !== combatantId);
                        this.render();
                        ui.notifications.info(`${combatant.name} removed from combat.`);
                        // Update the dialog
                        dialog.close();
                        this._onManageNPCs(event);
                    }
                });

                // Remove all NPCs
                html.find('.remove-all-npcs').click(() => {
                    if (confirm(`Remove all ${npcCombatants.length} NPCs from combat?`)) {
                        this.combatants = this.combatants.filter(c => !c.isNPC);
                        this.render();
                        ui.notifications.info(`All NPCs removed from combat.`);
                        dialog.close();
                    }
                });

                // Reroll all NPC initiative
                html.find('.reroll-all-npcs').click(async () => {
                    if (confirm(`Reroll initiative for all ${npcCombatants.length} NPCs?`)) {
                        for (const npc of npcCombatants) {
                            await this._rollInitiativeForCombatant(npc);
                        }
                        this.render();
                        ui.notifications.info(`Initiative rerolled for all NPCs.`);
                        dialog.close();
                    }
                });

                // Style the dialog
                html.find('.npc-management-dialog').css({
                    'font-family': 'Courier New, monospace',
                    'color': '#e0e0e0'
                });
            },
            width: 600,
            height: 500
        });

        dialog.render(true);
    }

    /**
     * Announce the current turn in chat
     */
    _announceCurrentTurn() {
        const activeCombatants = this._getActiveCombatantsForPhase();

        if (activeCombatants.length === 0) {
            // Announce empty phase
            ChatMessage.create({
                content: `<div class="turn-announcement">
            <h3>Phase ${this.currentPhase}</h3>
            <p>No combatants act in this phase.</p>
          </div>`,
                speaker: { alias: "Initiative Tracker" }
            });
            return;
        }

        const currentCombatant = activeCombatants[this.currentTurn];
        if (!currentCombatant) return;

        const currentInit = this.getCurrentInitiative(currentCombatant);

        ChatMessage.create({
            content: `<div class="turn-announcement">
        <h3>Phase ${this.currentPhase}</h3>
        <p><strong>${currentCombatant.name}</strong> acts on initiative ${currentInit}</p>
        ${currentCombatant.actionPhases ? `<p><small>Action phases: [${currentCombatant.actionPhases.join(', ')}]</small></p>` : ''}
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
    // Register Handlebars helpers for initiative tracker
    Handlebars.registerHelper('phases', function(initiative) {
        const phases = [];
        let currentPhase = initiative;
        while (currentPhase > 0) {
            phases.push(currentPhase);
            currentPhase -= 10;
        }
        return phases;
    });

    Handlebars.registerHelper('eq', function(a, b) {
        return a === b;
    });

    Handlebars.registerHelper('gt', function(a, b) {
        return a > b;
    });
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