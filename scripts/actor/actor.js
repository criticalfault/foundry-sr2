/**
 * Extend the base Actor document to support Shadowrun 2E
 */
export class SR2Actor extends Actor {

  /** @override */
  prepareData() {
    super.prepareData();
  }

  /** @override */
  prepareBaseData() {
    // Data modifications in this step occur before processing derived data
  }

  /** @override */
  prepareDerivedData() {
    const actorData = this;
    const systemData = actorData.system;
    const flags = actorData.flags.shadowrun2e || {};

    // Make separate methods for each Actor type to keep things organized
    this._prepareCharacterData(actorData);
  }

  /**
   * Prepare Character type specific data
   */
  _prepareCharacterData(actorData) {
    if (actorData.type !== 'character') return;

    const systemData = actorData.system;

    // Calculate derived attributes
    this._calculateDerivedAttributes(systemData);
    this._calculateConditionMonitors(systemData);
    this._calculateInitiative(systemData);
  }

  /**
   * Calculate derived attributes like Reaction, Initiative, etc.
   */
  _calculateDerivedAttributes(systemData) {
    const attrs = systemData.attributes;
    
    // Reaction = (Quickness + Intelligence) / 2
    attrs.reaction.value = Math.ceil((attrs.quickness.value + attrs.intelligence.value) / 2);
    
    // Combat Pool = (Quickness + Intelligence + Willpower) / 2
    systemData.pools.combat.max = Math.floor((attrs.quickness.value + attrs.intelligence.value + attrs.willpower.value) / 2);
    
    // Spell Pool = highest Sorcery skill (if awakened)
    if (systemData.magic.awakened) {
      const sorcerySkill = this._getHighestSorcerySkill();
      systemData.pools.spell.max = sorcerySkill;
    } else {
      systemData.pools.spell.max = 0;
    }
    
    // Hacking Pool = Reaction + highest Computer skill (Computer, Computer->Software, Computer->Software->Decking)
    const hackingSkill = this._getHighestComputerSkill();
    systemData.pools.hacking.max = attrs.reaction.value + hackingSkill;
    
    // Control Pool = Reaction + Vehicle Control Rig bonus
    const controlRigBonus = this._getControlRigBonus();
    systemData.pools.control.max = attrs.reaction.value + controlRigBonus;
    
    // Task Pool = Intelligence + highest relevant skill (simplified - using Intelligence base)
    systemData.pools.task.max = attrs.intelligence.value;
    
    // Astral Combat Pool = Willpower + Charisma (for astral combat)
    if (systemData.magic.awakened) {
      systemData.pools.astral.max = attrs.willpower.value + attrs.charisma.value;
    } else {
      systemData.pools.astral.max = 0;
    }
    
    // Initialize current values if not set
    Object.keys(systemData.pools).forEach(poolName => {
      if (poolName !== 'karma' && systemData.pools[poolName].current === undefined) {
        systemData.pools[poolName].current = systemData.pools[poolName].max;
      }
    });
  }

  /**
   * Get the rating of a skill by base skill name
   */
  _getSkillRating(baseSkillName) {
    const skills = this.items.filter(i => i.type === 'skill' && i.system.baseSkill === baseSkillName);
    if (skills.length === 0) return 0;
    
    // Return the highest rating if multiple concentrations exist
    return Math.max(...skills.map(skill => skill.system.rating || 0));
  }

  /**
   * Get the highest Computer skill rating for Hacking Pool
   * Looks for Computer base skill and any concentrations (Software, etc.)
   */
  _getHighestComputerSkill() {
    const computerSkills = this.items.filter(i => 
      i.type === 'skill' && i.system.baseSkill === 'Computer'
    );
    
    if (computerSkills.length === 0) return 0;
    
    // Return the highest rating among all Computer skill concentrations
    return Math.max(...computerSkills.map(skill => skill.system.rating || 0));
  }

  /**
   * Get the highest Sorcery skill rating for Magic Pool
   * Looks for Sorcery base skill and any concentrations
   */
  _getHighestSorcerySkill() {
    const sorcerySkills = this.items.filter(i => 
      i.type === 'skill' && i.system.baseSkill === 'Sorcery'
    );
    
    if (sorcerySkills.length === 0) return 0;
    
    // Return the highest rating among all Sorcery skill concentrations
    return Math.max(...sorcerySkills.map(skill => skill.system.rating || 0));
  }

  /**
   * Get Vehicle Control Rig bonus for Control Pool
   * Level 1 = +2, Level 2 = +4, Level 3 = +6
   */
  _getControlRigBonus() {
    const controlRigs = this.items.filter(i => 
      i.type === 'cyberware' && 
      i.system.installed && 
      i.name.toLowerCase().includes('control rig')
    );
    
    if (controlRigs.length === 0) return 0;
    
    // Find the highest level control rig
    let highestLevel = 0;
    for (const rig of controlRigs) {
      const rating = rig.system.rating || 0;
      if (rating > highestLevel) {
        highestLevel = rating;
      }
    }
    
    // Convert rating to bonus: Level 1 = +2, Level 2 = +4, Level 3 = +6
    return highestLevel * 2;
  }

  /**
   * Calculate condition monitors (Physical and Stun damage)
   */
  _calculateConditionMonitors(systemData) {
    const attrs = systemData.attributes;
    
    // Physical Condition Monitor = 10
    systemData.health.physical.max = 10;
    
    // Stun Condition Monitor = 10  
    systemData.health.stun.max = 10;
  }

  /**
   * Calculate initiative
   */
  _calculateInitiative(systemData) {
    const attrs = systemData.attributes;
    systemData.initiative.base = attrs.quickness.value + attrs.reaction.value;
  }

  /**
   * Roll dice for Shadowrun 2E with exploding 6s
   */
  async rollDice(dicePool, targetNumber = 4, title = "Dice Roll") {
    const diceResults = [];
    let totalSuccesses = 0;
    let totalOnes = 0;
    
    // Roll each die in the pool
    for (let i = 0; i < dicePool; i++) {
      const dieResults = [];
      let currentRoll = Math.floor(Math.random() * 6) + 1;
      let dieTotal = currentRoll;
      dieResults.push(currentRoll);
      
      // Exploding 6s - keep rolling while we get 6s
      while (currentRoll === 6) {
        currentRoll = Math.floor(Math.random() * 6) + 1;
        dieTotal += currentRoll;
        dieResults.push(currentRoll);
      }
      
      // Count successes and ones for this die
      if (dieTotal >= targetNumber) {
        totalSuccesses++;
      }
      if (dieResults[0] === 1) { // Only the first roll counts for ones
        totalOnes++;
      }
      
      diceResults.push({
        results: dieResults,
        total: dieTotal,
        success: dieTotal >= targetNumber,
        isOne: dieResults[0] === 1
      });
    }
    
    // Critical failure only occurs when ALL dice show 1 on their first roll
    const isCriticalFailure = totalOnes === dicePool && totalSuccesses === 0;
    
    const chatData = {
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: await renderTemplate("systems/shadowrun2e/templates/chat/dice-roll.html", {
        title: title,
        successes: totalSuccesses,
        ones: totalOnes,
        isCriticalFailure: isCriticalFailure,
        dicePool: dicePool,
        targetNumber: targetNumber,
        diceResults: diceResults
      })
    };
    
    ChatMessage.create(chatData);
    return { successes: totalSuccesses, ones: totalOnes, isCriticalFailure: isCriticalFailure };
  }

  /**
   * Prepare a data object which is passed to any Roll formulas
   */
  getRollData() {
    const data = {};

    // Copy the actor's system data
    if (this.system) {
      data.actor = foundry.utils.deepClone(this.system);
    }

    // Add level for easier access, or fall back to 0
    if (this.system.details?.level) {
      data.lvl = this.system.details.level;
    } else {
      data.lvl = 0;
    }

    return data;
  }
}