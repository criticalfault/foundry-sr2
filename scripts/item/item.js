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
    const label = `[${item.type}] ${item.name}`;

    // If there's no roll data, send a description instead
    if (!this.system.formula) {
      ChatMessage.create({
        speaker: speaker,
        rollMode: rollMode,
        flavor: label,
        content: item.system.description ?? ''
      });
    } else {
      // Otherwise, create a roll and send a chat message from it
      const rollData = this.getRollData();
      const roll = new Roll(rollData.item.formula, rollData);
      
      // If you need to store the roll somewhere, uncomment the next line
      // roll.toMessage({
      //   speaker: speaker,
      //   rollMode: rollMode,
      //   flavor: label,
      // });
      return roll;
    }
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