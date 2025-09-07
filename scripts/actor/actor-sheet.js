/**
 * Extend the basic ActorSheet with Shadowrun 2E specific functionality
 */
export class SR2ActorSheet extends foundry.applications.sheets.ActorSheet {

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["shadowrun2e", "sheet", "actor"],
      template: "systems/shadowrun2e/templates/actor/character-sheet.html",
      width: 960,
      height: 680,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "attributes" }]
    });
  }

  /** @override */
  get template() {
    // For now, all actor types use the character sheet
    // Later we can add different sheets for different actor types
    return "systems/shadowrun2e/templates/actor/character-sheet.html";
  }

  /** @override */
  async getData() {
    const context = super.getData();
    const actorData = this.actor.toObject(false);

    context.system = actorData.system;
    context.flags = actorData.flags;

    // Prepare character data and items
    if (actorData.type == 'character') {
      this._prepareItems(context);
      this._prepareCharacterData(context);
      await this._prepareSkillsData(context);
    }

    return context;
  }

  /**
   * Organize and classify Items for Character sheets.
   */
  _prepareItems(context) {
    const gear = [];
    const weapons = [];
    const armor = [];
    const cyberware = [];
    const bioware = [];
    const spells = [];
    const adeptpowers = [];
    const skills = [];

    for (let i of context.items) {
      i.img = i.img || "icons/svg/item-bag.svg";

      if (i.type === 'skill') {
        skills.push(i);
      } else if (i.type === 'weapon') {
        weapons.push(i);
      } else if (i.type === 'armor') {
        armor.push(i);
      } else if (i.type === 'cyberware') {
        cyberware.push(i);
      } else if (i.type === 'bioware') {
        bioware.push(i);
      } else if (i.type === 'spell') {
        spells.push(i);
      } else if (i.type === 'adeptpower') {
        // Calculate total cost for leveled powers
        if (i.system.hasLevels) {
          i.system.totalCost = i.system.cost * i.system.currentLevel;
        } else {
          i.system.totalCost = i.system.cost;
        }
        adeptpowers.push(i);
      } else if (i.type === 'gear') {
        gear.push(i);
      }
    }

    context.gear = gear;
    context.weapons = weapons;
    context.armor = armor;
    context.cyberware = cyberware;
    context.bioware = bioware;
    context.spells = spells;
    context.adeptpowers = adeptpowers;
    context.skills = skills;

    // Prepare totem data for shamanic magicians
    const totems = [];
    for (let i of context.items) {
      if (i.type === 'totem') {
        totems.push(i);
      }
    }
    context.totems = totems;

    // Find selected totem
    context.selectedTotem = totems.find(t => t.system.isSelected);

    // Calculate essence loss from installed cyberware
    const installedCyberware = cyberware.filter(c => c.system.installed);
    const totalEssenceLoss = installedCyberware.reduce((total, cyber) => {
      return total + (parseFloat(cyber.system.essence) || 0);
    }, 0);

    // Calculate current essence (base essence - cyberware essence loss)
    const baseEssence = this.actor.system.attributes.essence.max || 6;
    const currentEssence = Math.max(0, baseEssence - totalEssenceLoss);

    // Update the actor's current essence value
    if (this.actor.system.attributes.essence.value !== currentEssence) {
      this.actor.update({ 'system.attributes.essence.value': currentEssence });
    }

    context.essenceData = {
      base: baseEssence,
      current: currentEssence,
      loss: totalEssenceLoss,
      available: Math.max(0, currentEssence - 0.01) // Must keep at least 0.01 essence
    };

    // Calculate total power points used for adept powers
    context.powerPointsUsed = adeptpowers.reduce((total, power) => {
      return total + (power.system.totalCost || 0);
    }, 0);

    // Calculate gear summary statistics
    context.totalWeight = context.items.reduce((total, item) => {
      return total + ((item.system.weight || 0) * (item.system.quantity || 1));
    }, 0);

    context.totalValue = context.items.reduce((total, item) => {
      return total + ((item.system.price || 0) * (item.system.quantity || 1));
    }, 0);

    context.totalItems = context.items.reduce((total, item) => {
      return total + (item.system.quantity || 1);
    }, 0);
  }

  /**
   * Prepare character specific data
   */
  _prepareCharacterData(context) {
    // Calculate and display augmentation modifiers
    const modifiers = this.actor._calculateAugmentationModifiers();
    context.augmentationModifiers = modifiers;

    // Calculate total modified attributes for display
    const attrs = context.system.attributes;
    context.modifiedAttributes = {
      body: attrs.body.value + (modifiers.BOD || 0),
      quickness: attrs.quickness.value + (modifiers.QCK || 0),
      strength: attrs.strength.value + (modifiers.STR || 0),
      charisma: attrs.charisma.value + (modifiers.CHA || 0),
      intelligence: attrs.intelligence.value + (modifiers.INT || 0),
      willpower: attrs.willpower.value + (modifiers.WIL || 0),
      reaction: attrs.reaction.value, // Already includes modifiers
      initiativeDice: 1 + (modifiers.INI || 0)
    };
  }

  /**
   * Prepare skills data for the template
   */
  async _prepareSkillsData(context) {
    // Load the skills data from the JSON file
    try {
      const response = await fetch('/systems/shadowrun2e/data/skills.json');
      const skillsData = await response.json();
      context.availableSkills = skillsData;
      
      // Add concentration data for each skill
      context.skills.forEach(skill => {
        if (skill.system.baseSkill && skillsData[skill.system.baseSkill]) {
          skill.availableConcentrations = skillsData[skill.system.baseSkill].Concentrations || [];
        } else {
          skill.availableConcentrations = [];
        }
      });
      
      console.log('SR2E | Skills data loaded successfully:', Object.keys(skillsData).length, 'skills');
    } catch (error) {
      console.error('SR2E | Failed to load skills data:', error);
      context.availableSkills = {};
    }
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Rollable abilities
    html.find('.rollable').click(this._onRoll.bind(this));

    // Drag events for macros
    if (this.actor.isOwner) {
      let handler = ev => this._onDragStart(ev);
      html.find('li.item').each((i, li) => {
        if (li.classList.contains("inventory-header")) return;
        li.setAttribute("draggable", true);
        li.addEventListener("dragstart", handler, false);
      });
    }

    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    // Add Inventory Item
    html.find('.item-create').click(this._onItemCreate.bind(this));

    // Delete Inventory Item
    html.find('.item-delete').click(async ev => {
      ev.preventDefault();
      ev.stopPropagation();

      try {
        // Get item ID from button's data attribute or parent element
        const button = $(ev.currentTarget);

        // Try multiple ways to get the item ID
        let itemId = button.attr("data-item-id") ||
          button.data("item-id") ||
          button.data("itemId") ||
          button.parents(".item, .skill-item, .item-row").attr("data-item-id") ||
          button.parents(".item, .skill-item, .item-row").data("item-id") ||
          button.parents(".item, .skill-item, .item-row").data("itemId");

        console.log("SR2E | Delete item button clicked, itemId:", itemId);
        console.log("SR2E | Button data attributes:", button.get(0).dataset);
        console.log("SR2E | Available items:", this.actor.items.map(i => ({ id: i.id, name: i.name, type: i.type })));

        if (!itemId) {
          console.warn("SR2E | No item ID found for delete operation");
          ui.notifications.error("Could not find item to delete. Check console for details.");
          return;
        }

        const item = this.actor.items.get(itemId);
        if (item) {
          // Confirm deletion for important items
          const confirmDelete = game.settings.get("core", "noCanvas") ||
            confirm(`Delete ${item.name}?`);

          if (confirmDelete) {
            await item.delete();
            const row = button.parents(".item, .skill-item, .item-row");
            row.slideUp(200, () => this.render(false));
            ui.notifications.info(`${item.name} deleted successfully.`);
          }
        } else {
          console.warn(`SR2E | Item with ID ${itemId} not found in actor items`);
          console.warn("SR2E | Available item IDs:", this.actor.items.map(i => i.id));
          ui.notifications.error(`Could not find item with ID: ${itemId}`);
        }
      } catch (error) {
        console.error("SR2E | Error deleting item:", error);
        ui.notifications.error("Failed to delete item. Check console for details.");
      }
    });

    // Active Effect management
    html.find(".effect-control").click(ev => onManageActiveEffect(ev, this.actor));

    // Pool management
    html.find('.pool-adjust').click(this._onPoolAdjust.bind(this));
    html.find('.reset-all-pools').click(this._onResetAllPools.bind(this));

    // Skill management
    html.find('.base-skill-select').change(this._onBaseSkillChange.bind(this));
    html.find('.concentration-select').change(this._onConcentrationChange.bind(this));
    html.find('input[name*="specialization"]').on('input', this._onSpecializationChange.bind(this));
    html.find('.skill-roll').click(this._onSkillRoll.bind(this));

    // Attribute rolls
    html.find('.attribute-roll').click(this._onAttributeRoll.bind(this));

    // Item browser
    html.find('.browse-items').click(this._onBrowseItems.bind(this));

    // Spell casting
    html.find('.spell-cast').click(this._onSpellCast.bind(this));

    // Weapon attacks
    html.find('.weapon-attack').click(this._onWeaponAttack.bind(this));

    // Range calculator
    html.find('.range-weapon-select').change(this._onRangeWeaponChange.bind(this));
    html.find('.range-distance').on('input', this._onRangeDistanceChange.bind(this));

    // Totem management
    html.find('.browse-totems').click(this._onBrowseTotems.bind(this));
    html.find('.change-totem').click(this._onBrowseTotems.bind(this));

    // Cyberware installation management
    html.find('.cyberware-installed').change(this._onCyberwareInstall.bind(this));
    html.find('.bioware-installed').change(this._onBiowareInstall.bind(this));
  }

  /**
   * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
   */
  async _onItemCreate(event) {
    event.preventDefault();
    const header = event.currentTarget;
    const type = header.dataset.type;
    const data = foundry.utils.deepClone(header.dataset);
    const name = `New ${type.capitalize()}`;
    const itemData = {
      name: name,
      type: type,
      system: data
    };
    delete itemData.system["type"];
    return await Item.create(itemData, { parent: this.actor });
  }

  /**
   * Handle clickable rolls
   */
  _onRoll(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const dataset = element.dataset;

    // Handle item rolls
    if (dataset.rollType) {
      if (dataset.rollType == 'item') {
        const itemId = element.closest('.item').dataset.itemId;
        const item = this.actor.items.get(itemId);
        if (item) return item.roll();
      }
    }

    // Handle rolls that supply the formula directly
    if (dataset.roll) {
      let label = dataset.label ? `[ability] ${dataset.label}` : '';
      let roll = new Roll(dataset.roll, this.actor.getRollData());
      roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: label,
        rollMode: game.settings.get('core', 'rollMode'),
      });
      return roll;
    }
  }

  /**
   * Handle pool adjustments
   */
  _onPoolAdjust(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const poolType = element.dataset.pool;
    const adjustment = parseInt(element.dataset.adjust);

    const currentValue = this.actor.system.pools[poolType].current;
    const maxValue = this.actor.system.pools[poolType].max;
    const newValue = Math.clamped(currentValue + adjustment, 0, maxValue);

    this.actor.update({ [`system.pools.${poolType}.current`]: newValue });
  }

  /**
   * Reset all pools to maximum (GM only)
   */
  async _onResetAllPools(event) {
    event.preventDefault();
    
    // Confirm with GM before resetting
    const confirmed = await Dialog.confirm({
      title: "Reset All Pools",
      content: `<p>Are you sure you want to reset all dice pools to maximum for <strong>${this.actor.name}</strong>?</p>
                <p>This will restore all pools (Combat, Spell, Hacking, Control, Task, Astral) to their maximum values.</p>`,
      yes: () => true,
      no: () => false,
      defaultYes: false
    });

    if (!confirmed) return;

    // Build update data for all pools
    const updateData = {};
    const poolData = this.actor.system.pools;
    
    // Reset all pools except karma (karma is managed differently)
    const poolTypes = ['combat', 'spell', 'hacking', 'control', 'task', 'astral'];
    
    poolTypes.forEach(poolType => {
      if (poolData[poolType]) {
        updateData[`system.pools.${poolType}.current`] = poolData[poolType].max;
      }
    });

    // Update the actor
    await this.actor.update(updateData);

    // Show confirmation message
    ui.notifications.info(`All dice pools reset to maximum for ${this.actor.name}`);
    
    // Optional: Create chat message for transparency
    ChatMessage.create({
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div class="pool-reset-message">
        <h3>🔄 Pools Reset</h3>
        <p><strong>${this.actor.name}'s</strong> dice pools have been reset to maximum by the GM.</p>
        <ul>
          ${poolTypes.map(type => {
            const pool = poolData[type];
            return pool && pool.max > 0 ? `<li>${type.charAt(0).toUpperCase() + type.slice(1)} Pool: ${pool.max}/${pool.max}</li>` : '';
          }).filter(item => item).join('')}
        </ul>
      </div>`,
      whisper: [game.user.id] // Only visible to GM
    });
  }

  /**
   * Handle base skill selection change
   */
  async _onBaseSkillChange(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const skillId = element.dataset.skillId;
    const baseSkill = element.value;
    const item = this.actor.items.get(skillId);

    if (item) {
      // Clear concentration when base skill changes
      await item.update({
        'system.baseSkill': baseSkill,
        'system.concentration': '',
        'system.concentrationRating': 0,
        'name': baseSkill || 'New Skill'
      });

      // Re-render the sheet to update the UI
      this.render(false);
    }
  }

  /**
   * Handle concentration selection change
   */
  async _onConcentrationChange(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const skillId = element.closest('.skill-item').dataset.itemId;
    const concentration = element.value;
    const item = this.actor.items.get(skillId);

    if (item) {
      // Update concentration and reset concentration rating if cleared
      const updateData = {
        'system.concentration': concentration
      };
      
      // If concentration is cleared, reset the rating
      if (!concentration) {
        updateData['system.concentrationRating'] = 0;
      }

      await item.update(updateData);

      // Re-render the sheet to update the UI
      this.render(false);
    }
  }

  /**
   * Handle specialization text change
   */
  async _onSpecializationChange(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const skillId = element.closest('.skill-item').dataset.itemId;
    const specialization = element.value;
    const item = this.actor.items.get(skillId);

    if (item) {
      // Update specialization and reset specialization rating if cleared
      const updateData = {
        'system.specialization': specialization
      };
      
      // If specialization is cleared, reset the rating
      if (!specialization) {
        updateData['system.specializationRating'] = 0;
      }

      await item.update(updateData);

      // Re-render the sheet to update the UI
      this.render(false);
    }
  }



  /**
   * Handle skill roll
   */
  async _onSkillRoll(event) {
    event.preventDefault();
    const skillId = event.currentTarget.dataset.skillId;
    const rollType = event.currentTarget.dataset.rollType || 'base';
    const skill = this.actor.items.get(skillId);

    if (!skill) return;

    let skillRating = 0;
    let title = skill.name || skill.system.baseSkill || 'Unknown Skill';
    let rollDescription = '';

    // Determine which rating to use based on roll type
    switch (rollType) {
      case 'base':
        skillRating = Number(skill.system.baseRating) || 0;
        rollDescription = 'Base Skill';
        break;
      case 'concentration':
        skillRating = Number(skill.system.concentrationRating) || 0;
        if (skill.system.concentration) {
          title += ` (${skill.system.concentration})`;
          rollDescription = 'Concentration';
        } else {
          ui.notifications.warn("No concentration selected for this skill.");
          return;
        }
        break;
      case 'specialization':
        skillRating = Number(skill.system.specializationRating) || 0;
        if (skill.system.specialization) {
          title += ` [${skill.system.specialization}]`;
          rollDescription = 'Specialization';
        } else {
          ui.notifications.warn("No specialization entered for this skill.");
          return;
        }
        break;
    }

    // Calculate dice pool - skills roll only their rating in SR2E
    let dicePool = skillRating;

    // Ensure minimum dice pool of 1 (defaulting skill)
    if (dicePool < 1) {
      dicePool = 1;
    }

    // Add roll type to title
    const finalTitle = `${title} (${rollDescription})`;

    // Show TN selection dialog and roll
    await this._showTargetNumberDialog(dicePool, finalTitle, 'skill');
  }

  /**
   * Handle attribute roll
   */
  async _onAttributeRoll(event) {
    event.preventDefault();
    const attributeName = event.currentTarget.dataset.attribute;
    const attributeValue = Number(this.actor.system.attributes[attributeName]?.value) || 1;

    // Use modified attribute value if available (includes cyberware bonuses)
    const modifiers = this.actor._calculateAugmentationModifiers();
    let modifierValue = 0;
    
    // Map attribute names to modifier keys
    const modifierMap = {
      'body': 'BOD',
      'quickness': 'QCK', 
      'strength': 'STR',
      'charisma': 'CHA',
      'intelligence': 'INT',
      'willpower': 'WIL',
      'reaction': 'RCT'
    };
    
    if (modifierMap[attributeName]) {
      modifierValue = modifiers[modifierMap[attributeName]] || 0;
    }

    // Attributes roll their rating as dice pool (including modifiers)
    let dicePool = attributeValue + modifierValue;

    // Ensure minimum dice pool of 1
    if (dicePool < 1) {
      dicePool = 1;
    }

    const title = `${attributeName.charAt(0).toUpperCase() + attributeName.slice(1)} Test`;

    // Show TN selection dialog and roll
    await this._showTargetNumberDialog(dicePool, title, 'attribute');
  }

  /**
   * Get available pools for dice rolling
   */
  _getAvailablePools() {
    const pools = [];
    const poolData = this.actor.system.pools;
    
    // Add all pools that have current dice available
    const poolTypes = [
      { key: 'karma', name: 'Karma Pool', maxKey: 'total' },
      { key: 'combat', name: 'Combat Pool', maxKey: 'max' },
      { key: 'spell', name: 'Spell Pool', maxKey: 'max' },
      { key: 'hacking', name: 'Hacking Pool', maxKey: 'max' },
      { key: 'control', name: 'Control Pool', maxKey: 'max' },
      { key: 'task', name: 'Task Pool', maxKey: 'max' },
      { key: 'astral', name: 'Astral Combat Pool', maxKey: 'max' }
    ];
    
    poolTypes.forEach(poolType => {
      const pool = poolData[poolType.key];
      if (pool) {
        pools.push({ 
          key: poolType.key,
          name: poolType.name, 
          current: pool.current || 0, 
          max: pool[poolType.maxKey] || 0
        });
      }
    });
    
    return pools;
  }

  /**
   * Show Target Number selection dialog
   */
  async _showTargetNumberDialog(dicePool, title, rollType, defaultTN = 4) {
    const availablePools = this._getAvailablePools();
    
    const content = `
      <div class="target-number-dialog">
        <div class="roll-info">
          <h3>${title}</h3>
          <p><strong>Base Dice Pool:</strong> ${dicePool}</p>
        </div>
        
        <div class="target-number-section">
          <label for="target-number"><strong>Target Number:</strong></label>
          <select id="target-number" name="targetNumber">
            <option value="2" ${defaultTN === 2 ? 'selected' : ''}>2 - Trivial</option>
            <option value="3" ${defaultTN === 3 ? 'selected' : ''}>3 - Easy</option>
            <option value="4" ${defaultTN === 4 ? 'selected' : ''}>4 - Average</option>
            <option value="5" ${defaultTN === 5 ? 'selected' : ''}>5 - Fair</option>
            <option value="6" ${defaultTN === 6 ? 'selected' : ''}>6 - Hard</option>
            <option value="7" ${defaultTN === 7 ? 'selected' : ''}>7 - Extreme</option>
            <option value="8" ${defaultTN === 8 ? 'selected' : ''}>8 - Nearly Impossible</option>
            <option value="9" ${defaultTN === 9 ? 'selected' : ''}>9 - Impossible</option>
            <option value="10" ${defaultTN === 10 ? 'selected' : ''}>10 - Miraculous</option>
            <option value="11" ${defaultTN === 11 ? 'selected' : ''}>11</option>
            <option value="12" ${defaultTN === 12 ? 'selected' : ''}>12</option>
            <option value="13" ${defaultTN === 13 ? 'selected' : ''}>13</option>
            <option value="14" ${defaultTN === 14 ? 'selected' : ''}>14</option>
            <option value="15" ${defaultTN === 15 ? 'selected' : ''}>15</option>
            <option value="16" ${defaultTN === 16 ? 'selected' : ''}>16</option>
            <option value="17" ${defaultTN === 17 ? 'selected' : ''}>17</option>
            <option value="18" ${defaultTN === 18 ? 'selected' : ''}>18</option>
            <option value="19" ${defaultTN === 19 ? 'selected' : ''}>19</option>
            <option value="20" ${defaultTN === 20 ? 'selected' : ''}>20</option>
            <option value="21" ${defaultTN === 21 ? 'selected' : ''}>21</option>
            <option value="22" ${defaultTN === 22 ? 'selected' : ''}>22</option>
            <option value="23" ${defaultTN === 23 ? 'selected' : ''}>23</option>
            <option value="24" ${defaultTN === 24 ? 'selected' : ''}>24</option>
            <option value="25" ${defaultTN === 25 ? 'selected' : ''}>25</option>
            <option value="26" ${defaultTN === 26 ? 'selected' : ''}>26</option>
            <option value="27" ${defaultTN === 27 ? 'selected' : ''}>27</option>
            <option value="28" ${defaultTN === 28 ? 'selected' : ''}>28</option>
            <option value="29" ${defaultTN === 29 ? 'selected' : ''}>29</option>
            <option value="30" ${defaultTN === 30 ? 'selected' : ''}>30</option>
          </select>
        </div>

        ${availablePools.length > 0 ? `
        <div class="pool-dice-section">
          <label><strong>Pool Dice (Optional):</strong></label>
          ${availablePools.map(pool => `
            <div class="pool-option">
              <label>
                <input type="checkbox" name="pool-${pool.key}" value="${pool.key}" class="pool-checkbox">
                ${pool.name} (${pool.current}/${pool.max})
              </label>
              <input type="number" name="pool-${pool.key}-dice" 
                     min="0" max="${pool.current}" value="0" disabled class="pool-dice-input">
            </div>
          `).join('')}
        </div>
        ` : ''}

        <div class="modifiers-section">
          <label for="dice-modifier"><strong>Dice Pool Modifier:</strong></label>
          <input type="number" id="dice-modifier" name="diceModifier" value="0" min="-20" max="20">
          <small>Positive for bonuses, negative for penalties</small>
        </div>
      </div>
    `;

    const dialog = new Dialog({
      title: `${title} - Target Number Selection`,
      content: content,
      render: (html) => {
        // Handle pool checkbox interactions
        html.find('.pool-checkbox').change(function() {
          const isChecked = $(this).is(':checked');
          const poolKey = $(this).val();
          const diceInput = html.find(`input[name="pool-${poolKey}-dice"]`);
          const pool = availablePools.find(p => p.key === poolKey);
          
          if (isChecked) {
            diceInput.prop('disabled', false);
            // Only default to 1 if the pool has dice available
            if (pool && pool.current > 0) {
              diceInput.val(1);
            } else {
              diceInput.val(0);
            }
          } else {
            diceInput.prop('disabled', true);
            diceInput.val(0);
          }
        });
      },
      buttons: {
        roll: {
          icon: '<i class="fas fa-dice-d6"></i>',
          label: "Roll",
          callback: async (html) => {
            const targetNumber = parseInt(html.find('#target-number').val());
            const diceModifier = parseInt(html.find('#dice-modifier').val()) || 0;
            let finalDicePool = dicePool + diceModifier;
            
            // Handle pool dice
            const poolsUsed = [];
            let totalPoolDice = 0;
            
            availablePools.forEach(pool => {
              const checkbox = html.find(`input[name="pool-${pool.key}"]`);
              const diceInput = html.find(`input[name="pool-${pool.key}-dice"]`);
              
              if (checkbox.is(':checked')) {
                const diceUsed = parseInt(diceInput.val()) || 0;
                // Validate that we don't use more dice than available
                const actualDiceUsed = Math.min(diceUsed, pool.current);
                if (actualDiceUsed > 0) {
                  totalPoolDice += actualDiceUsed;
                  poolsUsed.push({ pool: pool, dice: actualDiceUsed });
                }
              }
            });
            
            // Add pool dice to final dice pool
            finalDicePool += totalPoolDice;
            
            // Ensure minimum dice pool of 1
            if (finalDicePool < 1) {
              finalDicePool = 1;
            }
            
            // Update actor's pool values
            if (poolsUsed.length > 0) {
              const updateData = {};
              poolsUsed.forEach(({ pool, dice }) => {
                const newCurrent = Math.max(0, pool.current - dice);
                updateData[`system.pools.${pool.key}.current`] = newCurrent;
              });
              await this.actor.update(updateData);
            }
            
            // Create enhanced title with pool info
            let finalTitle = `${title} (TN ${targetNumber})`;
            if (poolsUsed.length > 0) {
              const poolInfo = poolsUsed.map(({ pool, dice }) => `${dice} ${pool.name}`).join(', ');
              finalTitle += ` [+${totalPoolDice} from ${poolInfo}]`;
            }
            
            // Roll the dice
            this.actor.rollDice(finalDicePool, targetNumber, finalTitle);
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel"
        }
      },
      default: "roll",
      render: (html) => {
        // Enable/disable pool dice inputs when checkboxes are toggled
        html.find('input[type="checkbox"]').change(function() {
          const diceInput = html.find(`input[name="${this.name}-dice"]`);
          diceInput.prop('disabled', !this.checked);
          if (!this.checked) {
            diceInput.val(0);
          }
        });
      }
    });

    dialog.render(true);
  }

  /**
   * Handle opening item browser
   */
  async _onBrowseItems(event) {
    event.preventDefault();
    const itemType = event.currentTarget.dataset.type;

    // Import the item browser dynamically
    const { SR2ItemBrowser } = await import("/systems/shadowrun2e/scripts/item-browser.js");
    const browser = new SR2ItemBrowser(this.actor, itemType);
    browser.render(true);
  }

  /**
   * Handle spell casting
   */
  async _onSpellCast(event) {
    event.preventDefault();
    const spellId = event.currentTarget.dataset.itemId;
    const spell = this.actor.items.get(spellId);

    if (!spell) return;

    const force = spell.system.force || 1;
    const magicRating = this.actor.system.attributes.magic.value || 1;
    const sorcerySkill = this._getHighestSorcerySkill();

    // Calculate dice pool for spellcasting
    const dicePool = magicRating + sorcerySkill;

    const title = `Casting ${spell.name} (Force ${force})`;

    // Show TN selection dialog and roll for spellcasting
    await this._showTargetNumberDialog(dicePool, title, 'spell', 4);

    // Calculate drain
    const drainValue = this._calculateDrain(spell.system.drain, force);
    const drainPool = this.actor.system.attributes.willpower.value + magicRating;

    // Show TN selection dialog and roll drain resistance
    const drainTitle = `Drain Resistance for ${spell.name}`;
    await this._showTargetNumberDialog(drainPool, drainTitle, 'drain', drainValue);
  }

  /**
   * Get the highest Sorcery skill rating
   */
  _getHighestSorcerySkill() {
    const sorcerySkills = this.actor.items.filter(i =>
      i.type === 'skill' && i.system.baseSkill === 'Sorcery'
    );

    if (sorcerySkills.length === 0) return 0;

    return Math.max(...sorcerySkills.map(skill => {
      const baseRating = skill.system.baseRating || 0;
      const concRating = skill.system.concentrationRating || 0;
      const specRating = skill.system.specializationRating || 0;
      return Math.max(baseRating, concRating, specRating);
    }));
  }

  /**
   * Handle weapon attacks
   */
  async _onWeaponAttack(event) {
    event.preventDefault();
    const weaponId = event.currentTarget.dataset.itemId;
    const weapon = this.actor.items.get(weaponId);

    if (!weapon) return;

    // Get relevant attributes
    const strength = this.actor.system.attributes.strength.value || 1;
    const quickness = this.actor.system.attributes.quickness.value || 1;

    // Determine if it's a melee or ranged weapon
    const isRanged = weapon.system.weaponType === 'ranged';
    const attribute = isRanged ? quickness : strength;

    let skillRating = 0;
    let skillName = 'Defaulting';
    let rollDescription = '';

    // Check if weapon has a linked skill
    if (weapon.system.linkedSkill?.skillId) {
      const linkedSkill = this.actor.items.get(weapon.system.linkedSkill.skillId);
      
      if (linkedSkill) {
        const rollType = weapon.system.linkedSkill.rollType || 'base';
        
        // Get skill rating based on roll type
        switch (rollType) {
          case 'base':
            skillRating = Number(linkedSkill.system.baseRating) || 0;
            skillName = linkedSkill.name || linkedSkill.system.baseSkill || 'Unknown Skill';
            rollDescription = 'Base Skill';
            break;
          case 'concentration':
            skillRating = Number(linkedSkill.system.concentrationRating) || 0;
            if (linkedSkill.system.concentration) {
              skillName = `${linkedSkill.name || linkedSkill.system.baseSkill} (${linkedSkill.system.concentration})`;
              rollDescription = 'Concentration';
            } else {
              ui.notifications.warn(`${weapon.name} is linked to a skill with no concentration selected.`);
              skillRating = 0;
              skillName = 'Defaulting';
              rollDescription = 'No Concentration';
            }
            break;
          case 'specialization':
            skillRating = Number(linkedSkill.system.specializationRating) || 0;
            if (linkedSkill.system.specialization) {
              skillName = `${linkedSkill.name || linkedSkill.system.baseSkill} [${linkedSkill.system.specialization}]`;
              rollDescription = 'Specialization';
            } else {
              ui.notifications.warn(`${weapon.name} is linked to a skill with no specialization entered.`);
              skillRating = 0;
              skillName = 'Defaulting';
              rollDescription = 'No Specialization';
            }
            break;
        }
      } else {
        ui.notifications.warn(`${weapon.name} is linked to a skill that no longer exists.`);
      }
    } else {
      // Fall back to automatic skill detection for backwards compatibility
      const combatSkills = this.actor.items.filter(i =>
        i.type === 'skill' &&
        (i.system.baseSkill === 'Armed Combat' ||
          i.system.baseSkill === 'Firearms' ||
          i.system.baseSkill === 'Projectile Weapons')
      );

      if (combatSkills.length > 0) {
        // Use the highest applicable combat skill
        const bestSkill = combatSkills.reduce((best, current) => {
          const currentRating = Number(current.system.baseRating) || 0;
          const bestRating = Number(best.system.baseRating) || 0;
          return currentRating > bestRating ? current : best;
        });
        
        skillRating = Number(bestSkill.system.baseRating) || 0;
        skillName = bestSkill.name || bestSkill.system.baseSkill;
        rollDescription = 'Auto-detected';
      }
    }

    // Calculate dice pool (attribute + skill in SR2E)
    const dicePool = attribute + skillRating;

    // Create attack title
    const attackType = isRanged ? 'Ranged Attack' : 'Melee Attack';
    const title = `${attackType} with ${weapon.name}`;
    const subtitle = skillRating > 0 ? `${skillName} (${rollDescription})` : 'Defaulting to Attribute Only';

    // Show TN selection dialog and roll for attack
    await this._showTargetNumberDialog(dicePool, `${title} - ${subtitle}`, 'attack');

    // Display weapon damage in chat
    const damageCode = weapon.system.damage || "1L";
    const chatData = {
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `
        <div class="weapon-attack">
          <h3>${weapon.name} Attack</h3>
          <p><strong>Skill Used:</strong> ${skillName} ${rollDescription ? `(${rollDescription})` : ''}</p>
          <p><strong>Dice Pool:</strong> ${attribute} (${isRanged ? 'Quickness' : 'Strength'}) + ${skillRating} (Skill) = ${dicePool}</p>
          <p><strong>Damage Code:</strong> ${damageCode}</p>
          <p><strong>Concealability:</strong> ${weapon.system.concealability || 0}</p>
          ${weapon.system.reach ? `<p><strong>Reach:</strong> ${weapon.system.reach}</p>` : ''}
          ${weapon.system.mode ? `<p><strong>Mode:</strong> ${weapon.system.mode}</p>` : ''}
        </div>
      `
    };

    ChatMessage.create(chatData);

    // Handle ammo consumption for ranged weapons
    if (isRanged && weapon.system.ammo && weapon.system.ammo.current > 0) {
      const newAmmo = weapon.system.ammo.current - 1;
      await weapon.update({ 'system.ammo.current': newAmmo });

      if (newAmmo === 0) {
        ui.notifications.warn(`${weapon.name} is out of ammunition!`);
      }
    }
  }

  /**
   * Handle range weapon selection change
   */
  async _onRangeWeaponChange(event) {
    event.preventDefault();
    const weaponId = event.currentTarget.value;
    const rangeType = event.currentTarget.selectedOptions[0]?.dataset.rangeType;

    if (!weaponId || !rangeType) {
      this._hideRangeBands();
      return;
    }

    // Load ranges data and display range bands
    const rangesData = await this._loadRangesData();
    if (rangesData && rangesData[rangeType]) {
      this._displayRangeBands(rangesData[rangeType]);
      this._calculateRangeCategory();
    }
  }

  /**
   * Handle distance input change
   */
  _onRangeDistanceChange(event) {
    event.preventDefault();
    this._calculateRangeCategory();
  }

  /**
   * Load ranges data from JSON file
   */
  async _loadRangesData() {
    if (this.rangesData) {
      return this.rangesData;
    }

    try {
      const response = await fetch('/systems/shadowrun2e/data/ranges.json');
      this.rangesData = await response.json();
      return this.rangesData;
    } catch (error) {
      console.error('Failed to load ranges data:', error);
      return null;
    }
  }

  /**
   * Display range bands for selected weapon
   */
  _displayRangeBands(rangeData) {
    const rangeBands = document.getElementById('range-bands');
    if (!rangeBands) return;

    document.getElementById('short-range').textContent = rangeData.short;
    document.getElementById('medium-range').textContent = rangeData.medium;
    document.getElementById('long-range').textContent = rangeData.long;
    document.getElementById('extreme-range').textContent = rangeData.extreme;

    rangeBands.style.display = 'grid';
  }

  /**
   * Hide range bands
   */
  _hideRangeBands() {
    const rangeBands = document.getElementById('range-bands');
    if (rangeBands) {
      rangeBands.style.display = 'none';
    }

    const rangeCategory = document.getElementById('range-category');
    const rangeModifier = document.getElementById('range-modifier');
    if (rangeCategory) rangeCategory.textContent = '-';
    if (rangeModifier) rangeModifier.textContent = '';
  }

  /**
   * Calculate and display range category based on distance
   */
  async _calculateRangeCategory() {
    const weaponSelect = document.getElementById('range-weapon-select');
    const distanceInput = document.getElementById('range-distance');
    const rangeCategorySpan = document.getElementById('range-category');
    const rangeModifierSpan = document.getElementById('range-modifier');

    if (!weaponSelect || !distanceInput || !rangeCategorySpan) return;

    const weaponId = weaponSelect.value;
    const rangeType = weaponSelect.selectedOptions[0]?.dataset.rangeType;
    const distance = parseInt(distanceInput.value);

    if (!weaponId || !rangeType || !distance) {
      rangeCategorySpan.textContent = '-';
      rangeModifierSpan.textContent = '';
      return;
    }

    const rangesData = await this._loadRangesData();
    if (!rangesData || !rangesData[rangeType]) return;

    const ranges = rangesData[rangeType];
    let category = '';
    let modifier = '';
    let categoryClass = '';

    if (distance <= ranges.short) {
      category = 'Short';
      modifier = '(TN 4)';
      categoryClass = 'short';
    } else if (distance <= ranges.medium) {
      category = 'Medium';
      modifier = '(TN 5)';
      categoryClass = 'medium';
    } else if (distance <= ranges.long) {
      category = 'Long';
      modifier = '(TN 6)';
      categoryClass = 'long';
    } else if (distance <= ranges.extreme) {
      category = 'Extreme';
      modifier = '(TN 8)';
      categoryClass = 'extreme';
    } else {
      category = 'Out of Range';
      modifier = '(Impossible)';
      categoryClass = 'impossible';
    }

    rangeCategorySpan.textContent = category;
    rangeCategorySpan.className = `range-category ${categoryClass}`;
    rangeModifierSpan.textContent = modifier;
    rangeModifierSpan.className = `range-modifier ${categoryClass}`;
  }

  /**
   * Handle browsing totems for shamanic magicians
   */
  async _onBrowseTotems(event) {
    event.preventDefault();

    // Import the item browser dynamically
    const { SR2ItemBrowser } = await import("/systems/shadowrun2e/scripts/item-browser.js");

    // Create a custom item browser with totem selection handling
    const browser = new SR2ItemBrowser(this.actor, 'totem', {});

    // Override the default item creation to handle totem selection
    const originalAddItem = browser.addItem;
    browser.addItem = async (item) => {
      // First, unselect any existing totems
      const existingTotems = this.actor.items.filter(i => i.type === 'totem');
      for (const existingTotem of existingTotems) {
        await existingTotem.update({ 'system.isSelected': false });
      }

      // Then add the new totem and mark it as selected
      const newItem = await originalAddItem.call(browser, item);
      if (newItem) {
        await newItem.update({ 'system.isSelected': true });
      }
      return newItem;
    };

    browser.render(true);
  }

  /**
   * Handle cyberware installation toggle
   */
  async _onCyberwareInstall(event) {
    event.preventDefault();
    const checkbox = event.currentTarget;
    const itemId = checkbox.dataset.itemId;
    const item = this.actor.items.get(itemId);

    if (!item) return;

    const isInstalling = checkbox.checked;
    const essenceCost = parseFloat(item.system.essence) || 0;

    if (isInstalling) {
      // Check if installing this cyberware would reduce essence below 0.1
      const currentEssence = this.actor.system.attributes.essence.value || 6;
      const remainingEssence = currentEssence - essenceCost;

      if (remainingEssence < 0.1) {
        // Prevent installation
        checkbox.checked = false;
        ui.notifications.error(
          `Cannot install ${item.name}. Essence cost (${essenceCost}) would reduce your Essence below 0.1. ` +
          `Current Essence: ${currentEssence.toFixed(2)}, Required: ${essenceCost.toFixed(2)}`
        );
        return;
      }

      // Show confirmation for significant essence loss
      if (essenceCost >= 1.0) {
        const confirm = await Dialog.confirm({
          title: "Cyberware Installation",
          content: `<p>Installing <strong>${item.name}</strong> will permanently reduce your Essence by <strong>${essenceCost}</strong>.</p>
                   <p>Current Essence: <strong>${currentEssence.toFixed(2)}</strong></p>
                   <p>New Essence: <strong>${remainingEssence.toFixed(2)}</strong></p>
                   <p>This cannot be undone. Continue?</p>`,
          yes: () => true,
          no: () => false
        });

        if (!confirm) {
          checkbox.checked = false;
          return;
        }
      }

      // Install the cyberware
      await item.update({ 'system.installed': true });
      ui.notifications.info(`${item.name} installed. Essence reduced by ${essenceCost}.`);

    } else {
      // Uninstall the cyberware
      const confirm = await Dialog.confirm({
        title: "Cyberware Removal",
        content: `<p>Are you sure you want to remove <strong>${item.name}</strong>?</p>
                 <p>This will restore <strong>${essenceCost}</strong> Essence.</p>
                 <p><em>Note: In Shadowrun, cyberware removal typically requires surgery and may have complications.</em></p>`,
        yes: () => true,
        no: () => false
      });

      if (!confirm) {
        checkbox.checked = true;
        return;
      }

      await item.update({ 'system.installed': false });
      ui.notifications.info(`${item.name} removed. Essence restored by ${essenceCost}.`);
    }

    // Refresh the sheet to update essence display
    this.render(false);
  }

  /**
   * Handle bioware installation toggle
   */
  async _onBiowareInstall(event) {
    event.preventDefault();
    const checkbox = event.currentTarget;
    const itemId = checkbox.dataset.itemId;
    const item = this.actor.items.get(itemId);

    if (!item) return;

    const isInstalling = checkbox.checked;
    const bioIndex = parseFloat(item.system.bioIndex) || 0;

    if (isInstalling) {
      // Calculate current Bio Index usage
      const installedBioware = this.actor.items.filter(i =>
        i.type === 'bioware' && i.system.installed && i._id !== itemId
      );
      const currentBioIndex = installedBioware.reduce((total, bio) => {
        return total + (parseFloat(bio.system.bioIndex) || 0);
      }, 0);

      // Bio Index limit is typically equal to Essence (rounded down)
      const essenceValue = Math.floor(this.actor.system.attributes.essence.value || 6);
      const remainingBioIndex = essenceValue - currentBioIndex;

      if (bioIndex > remainingBioIndex) {
        // Prevent installation
        checkbox.checked = false;
        ui.notifications.error(
          `Cannot install ${item.name}. Bio Index cost (${bioIndex}) exceeds available capacity. ` +
          `Available Bio Index: ${remainingBioIndex.toFixed(2)}, Required: ${bioIndex.toFixed(2)}`
        );
        return;
      }

      // Show confirmation for bioware installation
      if (bioIndex >= 1.0) {
        const confirm = await Dialog.confirm({
          title: "Bioware Installation",
          content: `<p>Installing <strong>${item.name}</strong> will use <strong>${bioIndex}</strong> Bio Index.</p>
                   <p>Current Bio Index Used: <strong>${currentBioIndex.toFixed(2)}</strong></p>
                   <p>Bio Index Limit: <strong>${essenceValue}</strong></p>
                   <p>Remaining after installation: <strong>${(remainingBioIndex - bioIndex).toFixed(2)}</strong></p>
                   <p>Continue?</p>`,
          yes: () => true,
          no: () => false
        });

        if (!confirm) {
          checkbox.checked = false;
          return;
        }
      }

      // Install the bioware
      await item.update({ 'system.installed': true });
      ui.notifications.info(`${item.name} installed. Bio Index used: ${bioIndex}.`);

    } else {
      // Uninstall the bioware
      const confirm = await Dialog.confirm({
        title: "Bioware Removal",
        content: `<p>Are you sure you want to remove <strong>${item.name}</strong>?</p>
                 <p>This will free up <strong>${bioIndex}</strong> Bio Index.</p>
                 <p><em>Note: In Shadowrun, bioware removal typically requires surgery and may have complications.</em></p>`,
        yes: () => true,
        no: () => false
      });

      if (!confirm) {
        checkbox.checked = true;
        return;
      }

      await item.update({ 'system.installed': false });
      ui.notifications.info(`${item.name} removed. Bio Index freed: ${bioIndex}.`);
    }

    // Refresh the sheet to update displays
    this.render(false);
  }

  /**
   * Calculate drain value from drain code
   */
  _calculateDrain(drainCode, force) {
    if (!drainCode) return 4;

    // Parse drain codes like "(F/2)M", "[(F/2)+1]S", etc.
    let drainValue = 4; // Default

    try {
      // Replace F with force value
      let formula = drainCode.replace(/F/g, force.toString());

      // Remove brackets and damage level indicators
      formula = formula.replace(/[\[\]LMSD]/g, '');

      // Evaluate the mathematical expression
      drainValue = Math.max(2, Math.floor(eval(formula)));
    } catch (error) {
      console.warn(`Could not parse drain code: ${drainCode}`, error);
    }

    return drainValue;
  }
}