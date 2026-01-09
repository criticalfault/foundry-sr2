/**
 * Extend the basic Item with Shadowrun 2E specific functionality
 */
export class SR2Item extends Item {

  /** @override */
  prepareData() {
    super.prepareData();
  }

  /** @override */
  prepareDerivedData() {
    const itemData = this;
    const systemData = itemData.system;
    const flags = itemData.flags.shadowrun2e || {};

    // Make separate methods for each Item type to keep things organized
    this._prepareWeaponData(itemData);
    this._prepareArmorData(itemData);
  }

  /**
   * Prepare weapon specific data
   */
  _prepareWeaponData(itemData) {
    if (itemData.type !== 'weapon') return;
    
    const systemData = itemData.system;
    // Add weapon-specific calculations here
  }

  /**
   * Prepare armor specific data  
   */
  _prepareArmorData(itemData) {
    if (itemData.type !== 'armor') return;
    
    const systemData = itemData.system;
    // Add armor-specific calculations here
  }

  /**
   * Handle clickable rolls for items
   */
  async roll() {
    const item = this;
    
    // Initialize chat data
    const speaker = ChatMessage.getSpeaker({ actor: this.actor });
    const rollMode = game.settings.get('core', 'rollMode');
    const label = `[${item.type.capitalize()}] ${item.name}`;

    // Handle different item types
    switch (item.type) {
      case 'weapon':
        return this._rollWeapon();
      case 'spell':
        return this._rollSpell();
      case 'skill':
        return this._rollSkill();
      default:
        // For other items, show description or basic info
        ChatMessage.create({
          speaker: speaker,
          rollMode: rollMode,
          flavor: label,
          content: this._getItemDescription()
        });
        break;
    }
  }

  /**
   * Roll a weapon attack
   */
  async _rollWeapon() {
    const speaker = ChatMessage.getSpeaker({ actor: this.actor });
    const rollMode = game.settings.get('core', 'rollMode');
    
    let content = `<div class="weapon-roll">
      <h3>${this.name}</h3>
      <p><strong>Damage:</strong> ${this.system.damage || 'Unknown'}</p>
      <p><strong>Reach:</strong> ${this.system.reach || 'Unknown'}</p>
    `;
    
    if (this.system.description) {
      content += `<p><em>${this.system.description}</em></p>`;
    }
    
    content += `<p><em>Use the weapon attack button for full combat rolls.</em></p></div>`;

    ChatMessage.create({
      speaker: speaker,
      rollMode: rollMode,
      flavor: `Weapon: ${this.name}`,
      content: content
    });
  }

  /**
   * Roll a spell
   */
  async _rollSpell() {
    const speaker = ChatMessage.getSpeaker({ actor: this.actor });
    const rollMode = game.settings.get('core', 'rollMode');
    
    let content = `<div class="spell-roll">
      <h3>${this.name}</h3>
      <p><strong>Category:</strong> ${this.system.category || 'Unknown'}</p>
      <p><strong>Target:</strong> ${this.system.target || 'Unknown'}</p>
      <p><strong>Drain:</strong> ${this.system.drain || 'Unknown'}</p>
    `;
    
    if (this.system.description) {
      content += `<p><em>${this.system.description}</em></p>`;
    }
    
    content += `<p><em>Use the spell cast button for full spellcasting rolls.</em></p></div>`;

    ChatMessage.create({
      speaker: speaker,
      rollMode: rollMode,
      flavor: `Spell: ${this.name}`,
      content: content
    });
  }

  /**
   * Roll a skill
   */
  async _rollSkill() {
    const speaker = ChatMessage.getSpeaker({ actor: this.actor });
    const rollMode = game.settings.get('core', 'rollMode');
    
    let content = `<div class="skill-roll">
      <h3>${this.name}</h3>
      <p><strong>Base Skill:</strong> ${this.system.baseSkill || 'None'}</p>
      <p><strong>Base Rating:</strong> ${this.system.baseRating || 0}</p>
    `;
    
    if (this.system.concentration) {
      content += `<p><strong>Concentration:</strong> ${this.system.concentration} (${this.system.concentrationRating || 0})</p>`;
    }
    
    if (this.system.specialization) {
      content += `<p><strong>Specialization:</strong> ${this.system.specialization} (${this.system.specializationRating || 0})</p>`;
    }
    
    content += `<p><em>Use the skill roll button for dice rolls.</em></p></div>`;

    ChatMessage.create({
      speaker: speaker,
      rollMode: rollMode,
      flavor: `Skill: ${this.name}`,
      content: content
    });
  }

  /**
   * Get item description for display
   */
  _getItemDescription() {
    let content = `<div class="item-info">
      <h3>${this.name}</h3>
    `;
    
    if (this.system.description) {
      content += `<p>${this.system.description}</p>`;
    } else {
      content += `<p><em>No description available.</em></p>`;
    }
    
    // Add type-specific info
    if (this.system.price) {
      content += `<p><strong>Price:</strong> ${this.system.price}¥</p>`;
    }
    
    if (this.system.weight) {
      content += `<p><strong>Weight:</strong> ${this.system.weight} kg</p>`;
    }
    
    content += `</div>`;
    return content;
  }

  /**
   * Prepare a data object which is passed to any Roll formulas
   */
  getRollData() {
    if (!this.actor) return null;
    const rollData = this.actor.getRollData();
    rollData.item = foundry.utils.deepClone(this.system);
    return rollData;
  }
}