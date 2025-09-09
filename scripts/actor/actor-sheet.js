// Import the initiative tracker
import { SR2InitiativeTracker } from '../initiative-tracker.js';

/**
 * Extend the basic ActorSheet with Shadowrun 2E specific functionality
 */
export class SR2ActorSheet extends ActorSheet {

  constructor(...args) {
    super(...args);

    // Performance optimization: Cache DOM elements and debounce updates
    this._domCache = new Map();
    this._updateQueue = new Map();
    this._updateTimeout = null;
    this._lastRenderTime = 0;
    this._renderThrottle = 100; // Minimum time between renders in ms

    // Bind methods for performance
    this._debouncedUpdate = this._debounce(this._processUpdateQueue.bind(this), 50);
    this._throttledRender = this._throttle(this.render.bind(this), this._renderThrottle);
  }

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

    // Ensure health data structure exists with defaults
    if (!context.system.health) {
      context.system.health = {
        physical: { value: 0, max: 10 },
        stun: { value: 0, max: 10 }
      };
    } else {
      // Ensure physical health exists
      if (!context.system.health.physical) {
        context.system.health.physical = { value: 0, max: 10 };
      } else {
        // Ensure values are numbers, handle NaN, null, undefined
        const physValue = context.system.health.physical.value;
        const physMax = context.system.health.physical.max;

        context.system.health.physical.value = (typeof physValue === 'number' && !isNaN(physValue)) ? physValue : 0;
        context.system.health.physical.max = (typeof physMax === 'number' && !isNaN(physMax)) ? physMax : 10;
      }

      // Ensure stun health exists
      if (!context.system.health.stun) {
        context.system.health.stun = { value: 0, max: 10 };
      } else {
        // Ensure values are numbers, handle NaN, null, undefined
        const stunValue = context.system.health.stun.value;
        const stunMax = context.system.health.stun.max;

        context.system.health.stun.value = (typeof stunValue === 'number' && !isNaN(stunValue)) ? stunValue : 0;
        context.system.health.stun.max = (typeof stunMax === 'number' && !isNaN(stunMax)) ? stunMax : 10;
      }
    }

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

        // Debug logging for skill data
        console.log(`SR2E | Skill ${skill.name}: baseSkill=${skill.system.baseSkill}, concentration=${skill.system.concentration}, specialization=${skill.system.specialization}`);
        console.log(`SR2E | Ratings: base=${skill.system.baseRating}, conc=${skill.system.concentrationRating}, spec=${skill.system.specializationRating}`);
      });

      console.log('SR2E | Skills data loaded successfully:', Object.keys(skillsData).length, 'skills');
      console.log('SR2E | Actor skills:', context.skills.length);
    } catch (error) {
      console.error('SR2E | Failed to load skills data:', error);
      context.availableSkills = {};
    }
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Initialize health data if needed
    this._initializeHealthData();

    // Set up actor update listener for external changes
    Hooks.on('updateActor', this._onActorUpdate.bind(this));

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
    html.find('input[name*="specialization"]').on('change', this._onSpecializationChange.bind(this));
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

    // Damage box click handlers - use event delegation to handle clicks on child elements
    html.find('.damage-boxes').on('click', '.damage-box, .damage-box *', this._onDamageBoxClick.bind(this));

    // Damage box keyboard navigation
    html.find('.damage-box').keydown(this._onDamageBoxKeydown.bind(this));

    // Damage boxes focus management
    html.find('.damage-boxes').on('focusin', this._onDamageBoxesFocusIn.bind(this));

    // Initiative roll button
    html.find('.initiative-roll-btn').click(this._onInitiativeRoll.bind(this));
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

    console.log("SR2E | Base skill change:", skillId, baseSkill);

    if (item) {
      // Only clear concentration and specialization if the base skill actually changed
      const currentBaseSkill = item.system.baseSkill;

      if (currentBaseSkill !== baseSkill) {
        // Clear concentration and specialization when base skill changes
        await item.update({
          'system.baseSkill': baseSkill,
          'system.concentration': '',
          'system.concentrationRating': 0,
          'system.specialization': '',
          'system.specializationRating': 0,
          'name': baseSkill || 'New Skill'
        });

        console.log("SR2E | Updated skill:", item.name, "with base skill:", baseSkill);

        // Re-render the sheet to update the UI
        this.render(false);
      }
    } else {
      console.error("SR2E | Could not find skill item for base skill change:", skillId);
    }
  }

  /**
   * Handle concentration selection change
   */
  async _onConcentrationChange(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const skillId = element.dataset.skillId || element.closest('.skill-item').dataset.itemId;
    const concentration = element.value;
    const item = this.actor.items.get(skillId);

    console.log("SR2E | Concentration change:", skillId, concentration);

    if (item && item.system.concentration !== concentration) {
      // Update concentration and reset concentration rating if cleared
      const updateData = {
        'system.concentration': concentration
      };

      // If concentration is cleared, reset the rating
      if (!concentration) {
        updateData['system.concentrationRating'] = 0;
      }

      await item.update(updateData);

      // Only re-render if we need to update the available concentrations
      if (concentration) {
        this.render(false);
      }
    } else if (!item) {
      console.error("SR2E | Could not find skill item for concentration change:", skillId);
    }
  }

  /**
   * Handle specialization text change
   */
  async _onSpecializationChange(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const skillId = element.dataset.skillId || element.closest('.skill-item').dataset.itemId;
    const specialization = element.value;
    const item = this.actor.items.get(skillId);

    console.log("SR2E | Specialization change:", skillId, specialization);

    if (item && item.system.specialization !== specialization) {
      // Update specialization and reset specialization rating if cleared
      const updateData = {
        'system.specialization': specialization
      };

      // If specialization is cleared, reset the rating
      if (!specialization) {
        updateData['system.specializationRating'] = 0;
      }

      await item.update(updateData);

      // Don't auto-render for specialization changes - let the user finish typing
    } else if (!item) {
      console.error("SR2E | Could not find skill item for specialization change:", skillId);
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

    if (!skill) {
      console.error("SR2E | Skill not found for roll:", skillId);
      ui.notifications.error("Skill not found for roll");
      return;
    }

    let skillRating = 0;
    let title = skill.name || skill.system.baseSkill || 'Unknown Skill';
    let rollDescription = '';

    console.log("SR2E | Rolling skill:", skill.name, "Type:", rollType, "System data:", skill.system);

    // Determine which rating to use based on roll type
    switch (rollType) {
      case 'base':
        skillRating = parseInt(skill.system.baseRating) || 0;
        rollDescription = 'Base Skill';
        title = skill.system.baseSkill || skill.name || 'Unknown Skill';
        break;
      case 'concentration':
        skillRating = parseInt(skill.system.concentrationRating) || 0;
        if (skill.system.concentration) {
          title = `${skill.system.baseSkill || skill.name} (${skill.system.concentration})`;
          rollDescription = 'Concentration';
        } else {
          ui.notifications.warn("No concentration selected for this skill.");
          return;
        }
        break;
      case 'specialization':
        skillRating = parseInt(skill.system.specializationRating) || 0;
        if (skill.system.specialization) {
          title = `${skill.system.baseSkill || skill.name} [${skill.system.specialization}]`;
          rollDescription = 'Specialization';
        } else {
          ui.notifications.warn("No specialization entered for this skill.");
          return;
        }
        break;
    }

    console.log("SR2E | Skill rating for roll:", skillRating, "Roll type:", rollType);

    // Calculate dice pool - skills roll only their rating in SR2E
    let dicePool = skillRating;

    // Ensure minimum dice pool of 1 (defaulting skill)
    if (dicePool < 1) {
      dicePool = 1;
      console.log("SR2E | Using defaulting dice pool of 1");
    }

    // Add roll type to title
    const finalTitle = `${title} (${rollDescription})`;

    console.log("SR2E | Final dice pool:", dicePool, "Title:", finalTitle);

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
        html.find('.pool-checkbox').change(function () {
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
        html.find('input[type="checkbox"]').change(function () {
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
          <p><strong>Dice Pool:</strong> ${skillRating} (Skill) = ${dicePool}</p>
          <p><strong>Damage Code:</strong> ${damageCode}</p>
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

  /**
   * Handle damage box clicks
   */
  async _onDamageBoxClick(event) {
    event.preventDefault();
    
    // Find the actual damage box element (in case user clicked on a child element)
    let element = event.currentTarget;
    if (!element.classList.contains('damage-box')) {
      element = element.closest('.damage-box');
    }
    
    if (!element) {
      console.error('SR2E | Could not find damage box element');
      return;
    }

    try {
      // Try to get box number from multiple sources
      let boxNumberStr = element.dataset.boxNumber || element.getAttribute('data-box-number');
      
      // If we still don't have a box number, try to find it from the element's position
      if (!boxNumberStr) {
        const damageBoxes = element.parentElement.querySelectorAll('.damage-box');
        const index = Array.from(damageBoxes).indexOf(element);
        if (index >= 0) {
          boxNumberStr = (index + 1).toString();
          console.log('SR2E | Box number derived from position:', boxNumberStr);
        }
      }
      
      // Last resort: try to get it from the text content of the box-number span
      if (!boxNumberStr) {
        const boxNumberSpan = element.querySelector('.box-number');
        if (boxNumberSpan && boxNumberSpan.textContent) {
          boxNumberStr = boxNumberSpan.textContent.trim();
          console.log('SR2E | Box number derived from text content:', boxNumberStr);
        }
      }
      
      // Validate input parameters
      const boxNumber = parseInt(boxNumberStr);
      const damageBoxesContainer = element.closest('.damage-boxes');

      if (!damageBoxesContainer) {
        throw new Error("Damage box container not found");
      }

      const damageType = damageBoxesContainer.dataset.damageType;

      // Validate box number
      if (isNaN(boxNumber) || boxNumber < 1 || boxNumber > 10) {
        console.error('SR2E | Box number validation failed:', {
          boxNumberStr,
          boxNumber,
          isNaN: isNaN(boxNumber),
          element: element,
          dataset: element.dataset
        });
        throw new Error(`Invalid box number: ${boxNumber}. Must be between 1 and 10.`);
      }

      // Validate damage type
      if (!damageType || !['physical', 'stun'].includes(damageType)) {
        throw new Error(`Invalid damage type: ${damageType}. Must be 'physical' or 'stun'.`);
      }

      // Validate actor data exists and has proper structure
      if (!this.actor) {
        throw new Error("Actor not found");
      }

      if (!this.actor.system) {
        throw new Error("Actor system data not found");
      }

      if (!this.actor.system.health) {
        throw new Error("Actor health data not found");
      }

      if (!this.actor.system.health[damageType]) {
        throw new Error(`Actor ${damageType} health data not found`);
      }

      const currentDamage = this.actor.system.health[damageType].value;

      // Validate current damage value
      if (typeof currentDamage !== 'number' || isNaN(currentDamage)) {
        console.warn(`SR2E | Invalid current ${damageType} damage value: ${currentDamage}, defaulting to 0`);
        // Set a default value and continue
        await this.actor.update({
          [`system.health.${damageType}.value`]: 0
        });
        return;
      }

      let newDamage;

      // If clicking on the current damage level, reset to 0
      if (boxNumber === currentDamage) {
        newDamage = 0;
      } else {
        // Otherwise set damage to the clicked box number
        newDamage = boxNumber;
      }

      // Validate and clamp damage within bounds (0-10)
      if (typeof newDamage !== 'number' || isNaN(newDamage)) {
        throw new Error(`Invalid damage value calculated: ${newDamage}`);
      }

      newDamage = Math.clamped(newDamage, 0, 10);

      // Validate that the new damage value is different from current
      if (newDamage === currentDamage) {
        console.log(`SR2E | ${damageType} damage already at ${newDamage}, no update needed`);
        return;
      }

      // Update the actor's damage value using debounced update system
      try {
        // Use queued update for better concurrent handling
        this._queueUpdate({
          [`system.health.${damageType}.value`]: newDamage
        });

        console.log(`SR2E | Queued ${damageType} damage update from ${currentDamage} to ${newDamage}`);

        // Provide immediate UI feedback
        this._updateDamageBoxDisplay(damageType, newDamage);

        // Provide user feedback for significant damage changes
        if (newDamage >= 8 && currentDamage < 8) {
          ui.notifications.warn(`${this.actor.name} has taken severe ${damageType} damage (${newDamage}/10)!`);
        } else if (newDamage === 10 && currentDamage < 10) {
          ui.notifications.error(`${this.actor.name} has reached maximum ${damageType} damage!`);
        } else if (newDamage === 0 && currentDamage > 0) {
          ui.notifications.info(`${this.actor.name}'s ${damageType} damage has been cleared.`);
        }

      } catch (updateError) {
        console.error(`SR2E | Failed to queue ${damageType} damage update:`, updateError);
        ui.notifications.error(`Failed to update ${damageType} damage. The character sheet may be locked or you may not have permission.`);
        throw updateError;
      }

    } catch (error) {
      console.error("SR2E | Error handling damage box click:", error);
      ui.notifications.error(`Error updating damage: ${error.message}`);

      // Try to refresh the sheet to show current state
      try {
        this.render(false);
      } catch (renderError) {
        console.error("SR2E | Failed to refresh sheet after damage error:", renderError);
      }
    }
  }

  /**
   * Test function to validate damage box functionality
   */
  _testDamageBoxes() {
    console.log('SR2E | Testing damage box functionality...');
    
    const physicalBoxes = this.element.find('.damage-boxes[data-damage-type="physical"] .damage-box');
    const stunBoxes = this.element.find('.damage-boxes[data-damage-type="stun"] .damage-box');
    
    console.log('SR2E | Found physical damage boxes:', physicalBoxes.length);
    console.log('SR2E | Found stun damage boxes:', stunBoxes.length);
    
    physicalBoxes.each((index, element) => {
      const boxNumber = element.dataset.boxNumber || element.getAttribute('data-box-number');
      console.log(`SR2E | Physical box ${index + 1}: data-box-number = ${boxNumber}`);
    });
    
    stunBoxes.each((index, element) => {
      const boxNumber = element.dataset.boxNumber || element.getAttribute('data-box-number');
      console.log(`SR2E | Stun box ${index + 1}: data-box-number = ${boxNumber}`);
    });
  }

  /**
   * Handle initiative roll button clicks
   */
  async _onInitiativeRoll(event) {
    event.preventDefault();

    try {
      // Validate actor exists and has required data
      if (!this.actor) {
        throw new Error("Actor not found");
      }

      if (!this.actor.system) {
        throw new Error("Actor system data not found");
      }

      // Validate initiative data structure exists
      if (!this.actor.system.initiative) {
        console.warn("SR2E | Initiative data missing, creating default structure");
        await this.actor.update({
          'system.initiative': {
            dice: 1,
            current: 0
          }
        });
      }

      // Validate attributes data structure exists
      if (!this.actor.system.attributes) {
        throw new Error("Actor attributes data not found");
      }

      if (!this.actor.system.attributes.reaction) {
        console.warn("SR2E | Reaction attribute missing, creating default structure");
        await this.actor.update({
          'system.attributes.reaction': {
            value: 1
          }
        });
      }

      // Get initiative dice with validation and sensible defaults
      let initiativeDice = this.actor.system.initiative.dice;

      if (typeof initiativeDice !== 'number' || isNaN(initiativeDice) || initiativeDice < 1) {
        console.warn(`SR2E | Invalid initiative dice value: ${initiativeDice}, defaulting to 1`);
        initiativeDice = 1;
        // Update the actor with the corrected value
        await this.actor.update({
          'system.initiative.dice': 1
        });
      }

      // Cap initiative dice at reasonable maximum (10 dice)
      if (initiativeDice > 10) {
        console.warn(`SR2E | Initiative dice value too high: ${initiativeDice}, capping at 10`);
        initiativeDice = 10;
        await this.actor.update({
          'system.initiative.dice': 10
        });
      }

      // Get reaction bonus with validation and sensible defaults
      let reactionBonus = this.actor.system.attributes.reaction.value;

      if (typeof reactionBonus !== 'number' || isNaN(reactionBonus) || reactionBonus < 1) {
        console.warn(`SR2E | Invalid reaction value: ${reactionBonus}, defaulting to 1`);
        reactionBonus = 1;
        // Update the actor with the corrected value
        await this.actor.update({
          'system.attributes.reaction.value': 1
        });
      }

      // Cap reaction at reasonable maximum (30 for heavily augmented characters)
      if (reactionBonus > 30) {
        console.warn(`SR2E | Reaction value too high: ${reactionBonus}, capping at 30`);
        reactionBonus = 30;
        await this.actor.update({
          'system.attributes.reaction.value': 30
        });
      }

      // Create the roll formula (e.g., "3d6 + 12")
      const rollFormula = `${initiativeDice}d6 + ${reactionBonus}`;

      console.log(`SR2E | Rolling initiative for ${this.actor.name}: ${rollFormula}`);

      // Create and evaluate the roll using Foundry's Roll class
      // Note: Using standard d6 without exploding dice for initiative
      let roll;
      try {
        roll = new Roll(rollFormula);
        await roll.evaluate();
      } catch (rollError) {
        console.error("SR2E | Error creating or evaluating roll:", rollError);
        throw new Error(`Failed to create initiative roll with formula ${rollFormula}: ${rollError.message}`);
      }

      // Validate roll results
      if (!roll || typeof roll.total !== 'number' || isNaN(roll.total)) {
        throw new Error(`Invalid roll result: ${roll?.total}`);
      }

      // Extract dice results with error handling
      let diceResults = [];
      let diceTotal = 0;

      try {
        if (roll.terms && roll.terms[0] && roll.terms[0].results) {
          diceResults = roll.terms[0].results.map(r => r.result);
          diceTotal = diceResults.reduce((sum, die) => sum + die, 0);
        } else {
          // Fallback: calculate dice total from final total minus reaction bonus
          diceTotal = roll.total - reactionBonus;
          diceResults = [`${diceTotal} (total)`];
        }
      } catch (extractError) {
        console.warn("SR2E | Could not extract individual dice results:", extractError);
        diceTotal = roll.total - reactionBonus;
        diceResults = [`${diceTotal} (total)`];
      }

      const finalTotal = roll.total;

      // Validate final total is reasonable
      if (finalTotal < 1 || finalTotal > 100) {
        console.warn(`SR2E | Unusual initiative total: ${finalTotal}`);
      }

      // Update the actor's current initiative with error handling
      try {
        await this.actor.update({
          'system.initiative.current': finalTotal
        });
      } catch (updateError) {
        console.error("SR2E | Failed to update actor initiative:", updateError);
        ui.notifications.error("Failed to save initiative result. You may not have permission to modify this character.");
        // Continue with display and chat message even if update fails
      }

      // Display the result in the UI with error handling
      try {
        this._displayInitiativeResult(diceResults, diceTotal, reactionBonus, finalTotal, rollFormula);
      } catch (displayError) {
        console.error("SR2E | Failed to display initiative result:", displayError);
        ui.notifications.warn("Initiative rolled successfully but display failed. Check chat for results.");
      }

      // Send roll to chat with error handling
      try {
        await roll.toMessage({
          speaker: ChatMessage.getSpeaker({ actor: this.actor }),
          flavor: `${this.actor.name} rolls Initiative`
        });
      } catch (chatError) {
        console.error("SR2E | Failed to send initiative roll to chat:", chatError);
        ui.notifications.warn("Initiative rolled successfully but failed to post to chat.");
      }

      // Automatically add character to initiative tracker with error handling
      try {
        await this._addToInitiativeTracker(finalTotal);
      } catch (trackerError) {
        console.error("SR2E | Failed to add to initiative tracker:", trackerError);
        ui.notifications.warn(`Initiative rolled (${finalTotal}) but failed to add to tracker. You can add manually.`);
      }

      console.log(`SR2E | ${this.actor.name} rolled initiative: ${rollFormula} = ${finalTotal}`);
      ui.notifications.info(`${this.actor.name} rolled initiative: ${finalTotal}`);

    } catch (error) {
      console.error("SR2E | Error rolling initiative:", error);

      // Provide specific error messages based on error type
      let errorMessage = "Failed to roll initiative.";

      if (error.message.includes("not found")) {
        errorMessage = "Character data is missing or corrupted. Try refreshing the sheet.";
      } else if (error.message.includes("permission")) {
        errorMessage = "You don't have permission to modify this character.";
      } else if (error.message.includes("roll")) {
        errorMessage = "Failed to calculate dice roll. Check character's initiative and reaction values.";
      } else {
        errorMessage = `Initiative roll failed: ${error.message}`;
      }

      ui.notifications.error(errorMessage);

      // Try to refresh the sheet to show current state
      try {
        this.render(false);
      } catch (renderError) {
        console.error("SR2E | Failed to refresh sheet after initiative error:", renderError);
      }
    }
  }

  /**
   * Handle keyboard navigation for damage boxes
   */
  _onDamageBoxKeydown(event) {
    const element = event.currentTarget;
    const damageBoxes = element.closest('.damage-boxes');
    const allBoxes = Array.from(damageBoxes.querySelectorAll('.damage-box'));
    const currentIndex = allBoxes.indexOf(element);

    let targetIndex = currentIndex;
    let handled = false;

    switch (event.key) {
      case 'Enter':
      case ' ':
        // Activate the damage box (same as clicking)
        event.preventDefault();
        this._onDamageBoxClick(event);
        handled = true;
        break;

      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        targetIndex = Math.max(0, currentIndex - 1);
        handled = true;
        break;

      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        targetIndex = Math.min(allBoxes.length - 1, currentIndex + 1);
        handled = true;
        break;

      case 'Home':
        event.preventDefault();
        targetIndex = 0;
        handled = true;
        break;

      case 'End':
        event.preventDefault();
        targetIndex = allBoxes.length - 1;
        handled = true;
        break;

      case '0':
      case 'Delete':
      case 'Backspace':
        // Clear all damage
        event.preventDefault();
        const damageType = damageBoxes.dataset.damageType;
        this._clearDamage(damageType);
        handled = true;
        break;

      default:
        // Handle number keys 1-9 for direct damage setting
        if (event.key >= '1' && event.key <= '9') {
          event.preventDefault();
          const boxNumber = parseInt(event.key);
          if (boxNumber <= allBoxes.length) {
            // Create a synthetic click event for the target box
            const targetBox = allBoxes[boxNumber - 1];
            const syntheticEvent = {
              preventDefault: () => { },
              currentTarget: targetBox
            };
            this._onDamageBoxClick(syntheticEvent);
            // Focus the target box
            targetBox.focus();
          }
          handled = true;
        }
        break;
    }

    // Move focus to target box if navigation occurred
    if (handled && targetIndex !== currentIndex && allBoxes[targetIndex]) {
      this._updateDamageBoxTabIndex(damageBoxes, targetIndex);
      allBoxes[targetIndex].focus();
    }
  }

  /**
   * Handle focus management for damage box groups
   */
  _onDamageBoxesFocusIn(event) {
    const damageBoxes = event.currentTarget;
    const focusedBox = event.target;

    if (focusedBox.classList.contains('damage-box')) {
      const allBoxes = Array.from(damageBoxes.querySelectorAll('.damage-box'));
      const focusedIndex = allBoxes.indexOf(focusedBox);
      this._updateDamageBoxTabIndex(damageBoxes, focusedIndex);
    }
  }

  /**
   * Update tabindex for damage boxes to maintain proper keyboard navigation
   */
  _updateDamageBoxTabIndex(damageBoxes, focusedIndex) {
    const allBoxes = damageBoxes.querySelectorAll('.damage-box');
    allBoxes.forEach((box, index) => {
      box.tabIndex = index === focusedIndex ? 0 : -1;
    });
  }

  /**
   * Clear all damage for a specific damage type
   */
  async _clearDamage(damageType) {
    try {
      if (!['physical', 'stun'].includes(damageType)) {
        throw new Error(`Invalid damage type: ${damageType}`);
      }

      const currentDamage = this.actor.system.health[damageType].value;

      if (currentDamage === 0) {
        ui.notifications.info(`${damageType} damage is already at 0.`);
        return;
      }

      // Update the actor's damage value
      this._queueUpdate({
        [`system.health.${damageType}.value`]: 0
      });

      // Provide immediate UI feedback
      this._updateDamageBoxDisplay(damageType, 0);

      ui.notifications.info(`${this.actor.name}'s ${damageType} damage has been cleared.`);

    } catch (error) {
      console.error(`SR2E | Error clearing ${damageType} damage:`, error);
      ui.notifications.error(`Failed to clear ${damageType} damage: ${error.message}`);
    }
  }

  /**
   * Initialize health data structure if it doesn't exist or has invalid values
   */
  async _initializeHealthData() {
    try {
      const currentHealth = this.actor.system.health;
      let needsUpdate = false;
      const updateData = {};

      // Check if health structure exists
      if (!currentHealth) {
        updateData['system.health'] = {
          physical: { value: 0, max: 10 },
          stun: { value: 0, max: 10 }
        };
        needsUpdate = true;
      } else {
        // Check physical health
        if (!currentHealth.physical) {
          updateData['system.health.physical'] = { value: 0, max: 10 };
          needsUpdate = true;
        } else {
          if (typeof currentHealth.physical.value !== 'number' || isNaN(currentHealth.physical.value)) {
            updateData['system.health.physical.value'] = 0;
            needsUpdate = true;
          }
          if (typeof currentHealth.physical.max !== 'number' || isNaN(currentHealth.physical.max)) {
            updateData['system.health.physical.max'] = 10;
            needsUpdate = true;
          }
        }

        // Check stun health
        if (!currentHealth.stun) {
          updateData['system.health.stun'] = { value: 0, max: 10 };
          needsUpdate = true;
        } else {
          if (typeof currentHealth.stun.value !== 'number' || isNaN(currentHealth.stun.value)) {
            updateData['system.health.stun.value'] = 0;
            needsUpdate = true;
          }
          if (typeof currentHealth.stun.max !== 'number' || isNaN(currentHealth.stun.max)) {
            updateData['system.health.stun.max'] = 10;
            needsUpdate = true;
          }
        }
      }

      // Apply updates if needed
      if (needsUpdate) {
        console.log('SR2E | Initializing health data structure:', updateData);
        await this.actor.update(updateData);
      }

    } catch (error) {
      console.error('SR2E | Error initializing health data:', error);
    }
  }

  /**
   * Performance optimization: Debounce function
   */
  _debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  /**
   * Performance optimization: Throttle function
   */
  _throttle(func, limit) {
    let inThrottle;
    return function (...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  /**
   * Performance optimization: Cache DOM elements
   */
  _getCachedElement(selector) {
    if (!this._domCache.has(selector)) {
      const element = this.element.find(selector);
      if (element.length > 0) {
        this._domCache.set(selector, element);
      }
    }
    return this._domCache.get(selector);
  }

  /**
   * Performance optimization: Clear DOM cache when sheet is rendered
   */
  _clearDomCache() {
    this._domCache.clear();
  }

  /**
   * Performance optimization: Queue updates to prevent excessive database writes
   */
  _queueUpdate(updateData) {
    // Merge with existing queued updates
    for (const [key, value] of Object.entries(updateData)) {
      this._updateQueue.set(key, value);
    }

    // Debounce the actual update
    this._debouncedUpdate();
  }

  /**
   * Performance optimization: Process queued updates
   */
  async _processUpdateQueue() {
    if (this._updateQueue.size === 0) return;

    // Convert Map to object
    const updateData = {};
    for (const [key, value] of this._updateQueue.entries()) {
      updateData[key] = value;
    }

    // Clear the queue
    this._updateQueue.clear();

    try {
      await this.actor.update(updateData);
    } catch (error) {
      console.error("SR2E | Failed to process update queue:", error);
      ui.notifications.error("Failed to save changes. You may not have permission to modify this character.");
    }
  }

  /**
   * Performance optimization: Optimized damage box display update
   */
  _updateDamageBoxDisplay(damageType, newDamage) {
    try {
      // Use cached selector for better performance
      const damageBoxes = this._getCachedElement(`.damage-boxes[data-damage-type="${damageType}"] .damage-box`);

      if (!damageBoxes || damageBoxes.length === 0) {
        console.warn(`SR2E | No damage boxes found for type: ${damageType}`);
        return;
      }

      // Batch DOM updates for better performance
      const updates = [];

      damageBoxes.each((index, box) => {
        const boxNumber = parseInt(box.dataset.boxNumber);
        const shouldBeFilled = boxNumber <= newDamage;
        const currentlyFilled = box.dataset.filled === 'true';

        if (shouldBeFilled !== currentlyFilled) {
          updates.push({
            element: box,
            filled: shouldBeFilled,
            boxNumber: boxNumber
          });
        }
      });

      // Apply all updates at once
      updates.forEach(update => {
        update.element.dataset.filled = update.filled.toString();
        update.element.setAttribute('aria-checked', update.filled.toString());
      });

      // Update damage counter with cached element
      const damageCounter = this._getCachedElement(`.${damageType}-monitor .damage-counter`);
      if (damageCounter && damageCounter.length > 0) {
        const maxDamage = this.actor.system.health[damageType].max || 10;
        damageCounter.text(`${newDamage}/${maxDamage}`);
      }

    } catch (error) {
      console.error(`SR2E | Error updating ${damageType} damage display:`, error);
    }
  }

  /**
   * Performance optimization: Override render to include throttling and cache clearing
   */
  async render(force = false, options = {}) {
    // Clear DOM cache on render
    this._clearDomCache();

    // Throttle renders for performance
    const now = Date.now();
    if (!force && (now - this._lastRenderTime) < this._renderThrottle) {
      return this._throttledRender(force, options);
    }

    this._lastRenderTime = now;
    return super.render(force, options);
  }

  /**
   * Performance optimization: Cleanup on close
   */
  async close(options = {}) {
    // Process any pending updates before closing
    if (this._updateQueue.size > 0) {
      await this._processUpdateQueue();
    }

    // Clear caches
    this._clearDomCache();

    // Clear timeouts
    if (this._updateTimeout) {
      clearTimeout(this._updateTimeout);
    }

    return super.close(options);
  }

  /**
   * Display initiative roll results in the UI
   */
  _displayInitiativeResult(diceResults, diceTotal, reactionBonus, finalTotal, rollFormula) {
    try {
      // Validate UI elements exist
      if (!this.element || this.element.length === 0) {
        console.warn("SR2E | Character sheet element not found, cannot display initiative result");
        return;
      }

      const resultDiv = this.element.find('.initiative-result');
      if (resultDiv.length === 0) {
        console.warn("SR2E | Initiative result display area not found in UI");
        return;
      }

      const diceResultSpan = resultDiv.find('.dice-result');
      const bonusResultSpan = resultDiv.find('.bonus-result');
      const totalResultSpan = resultDiv.find('.total-result');
      const formulaSpan = resultDiv.find('.formula-text');

      // Format dice results display with error handling
      let diceDisplay = '';
      try {
        if (Array.isArray(diceResults) && diceResults.length > 0) {
          diceDisplay = `[${diceResults.join(', ')}] = ${diceTotal}`;
        } else {
          diceDisplay = `Dice Total: ${diceTotal}`;
        }
      } catch (displayError) {
        console.warn("SR2E | Error formatting dice display:", displayError);
        diceDisplay = `Dice Total: ${diceTotal}`;
      }

      // Update UI elements with error handling for each
      try {
        if (diceResultSpan.length > 0) {
          diceResultSpan.text(diceDisplay);
        }
      } catch (error) {
        console.warn("SR2E | Failed to update dice result display:", error);
      }

      try {
        if (bonusResultSpan.length > 0) {
          bonusResultSpan.text(`+ ${reactionBonus}`);
        }
      } catch (error) {
        console.warn("SR2E | Failed to update bonus result display:", error);
      }

      try {
        if (totalResultSpan.length > 0) {
          totalResultSpan.text(`= ${finalTotal}`);
        }
      } catch (error) {
        console.warn("SR2E | Failed to update total result display:", error);
      }

      try {
        if (formulaSpan.length > 0) {
          formulaSpan.text(`Formula: ${rollFormula}`);
        }
      } catch (error) {
        console.warn("SR2E | Failed to update formula display:", error);
      }

      // Show the result div with animation and error handling
      try {
        resultDiv.slideDown(300);
      } catch (animationError) {
        console.warn("SR2E | Failed to animate result display:", animationError);
        // Fallback to just showing the element
        try {
          resultDiv.show();
        } catch (showError) {
          console.warn("SR2E | Failed to show result display:", showError);
        }
      }

      // Trigger UI synchronization
      this._synchronizeUIState();

    } catch (error) {
      console.error("SR2E | Error displaying initiative result:", error);
      // Don't throw error, just log it since this is a display function
    }
  }

  /**
   * Calculate action phases from initiative score
   * SR2 phase system: characters act on multiple phases based on initiative
   * Each phase occurs every 10 points of initiative
   * Example: Initiative 27 = acts on phases 27, 17, 7
   */
  _calculateActionPhases(initiativeScore) {
    try {
      // Validate input
      if (typeof initiativeScore !== 'number' || isNaN(initiativeScore)) {
        throw new Error(`Invalid initiative score: ${initiativeScore}. Must be a number.`);
      }

      if (initiativeScore < 1) {
        console.warn(`SR2E | Initiative score too low: ${initiativeScore}, using minimum of 1`);
        initiativeScore = 1;
      }

      if (initiativeScore > 100) {
        console.warn(`SR2E | Initiative score very high: ${initiativeScore}, this may indicate an error`);
      }

      const phases = [];
      let currentPhase = Math.floor(initiativeScore); // Ensure integer
      let iterationCount = 0;
      const maxIterations = 20; // Safety limit to prevent infinite loops

      while (currentPhase > 0 && iterationCount < maxIterations) {
        phases.push(currentPhase);
        currentPhase -= 10;
        iterationCount++;
      }

      if (iterationCount >= maxIterations) {
        console.warn(`SR2E | Phase calculation hit iteration limit for initiative ${initiativeScore}`);
      }

      // Validate result
      if (phases.length === 0) {
        console.warn(`SR2E | No phases calculated for initiative ${initiativeScore}, adding single phase`);
        phases.push(Math.max(1, Math.floor(initiativeScore)));
      }

      console.log(`SR2E | Calculated ${phases.length} action phases for initiative ${initiativeScore}: [${phases.join(', ')}]`);
      return phases;

    } catch (error) {
      console.error("SR2E | Error calculating action phases:", error);
      // Return fallback single phase
      const fallbackPhase = Math.max(1, Math.floor(initiativeScore) || 1);
      console.warn(`SR2E | Using fallback single phase: ${fallbackPhase}`);
      return [fallbackPhase];
    }
  }

  /**
   * Add character to initiative tracker after rolling initiative
   */
  async _addToInitiativeTracker(initiativeResult) {
    try {
      // Validate initiative result
      if (typeof initiativeResult !== 'number' || isNaN(initiativeResult) || initiativeResult < 1) {
        throw new Error(`Invalid initiative result: ${initiativeResult}`);
      }

      // Validate actor data
      if (!this.actor || !this.actor.id) {
        throw new Error("Actor data is missing or invalid");
      }

      // Check if canvas and tokens are available
      if (!canvas || !canvas.tokens) {
        throw new Error("Canvas or tokens not available. Make sure you're on a scene with tokens.");
      }

      // Get or create the global initiative tracker instance
      let initiativeTracker = game.shadowrun2e?.initiativeTracker;

      if (!initiativeTracker) {
        try {
          // Create new tracker instance if it doesn't exist
          initiativeTracker = new SR2InitiativeTracker();

          // Store reference globally for access from other parts of the system
          if (!game.shadowrun2e) {
            game.shadowrun2e = {};
          }
          game.shadowrun2e.initiativeTracker = initiativeTracker;
        } catch (trackerError) {
          throw new Error(`Failed to create initiative tracker: ${trackerError.message}`);
        }
      }

      // Get the token for this actor (prefer controlled token, fallback to any token)
      let token = null;

      try {
        const controlledTokens = canvas.tokens.controlled.filter(t => t.actor?.id === this.actor.id);

        if (controlledTokens.length > 0) {
          token = controlledTokens[0];
        } else {
          // Find any token representing this actor on the current scene
          token = canvas.tokens.placeables.find(t => t.actor?.id === this.actor.id);
        }
      } catch (tokenError) {
        console.error("SR2E | Error finding token:", tokenError);
      }

      if (!token) {
        console.warn(`SR2E | No token found for actor ${this.actor.name}, cannot add to initiative tracker`);
        ui.notifications.warn(`No token found for ${this.actor.name}. Place a token on the scene to add to initiative tracker.`);
        return;
      }

      // Validate token data
      if (!token.id) {
        throw new Error("Token ID is missing");
      }

      // Validate initiative tracker has combatants array
      if (!Array.isArray(initiativeTracker.combatants)) {
        console.warn("SR2E | Initiative tracker combatants array missing, creating new array");
        initiativeTracker.combatants = [];
      }

      // Check if character is already in the tracker
      const existingCombatant = initiativeTracker.combatants.find(c => c.actorId === this.actor.id);

      // Calculate action phases for this initiative result with error handling
      let actionPhases;
      try {
        actionPhases = this._calculateActionPhases(initiativeResult);

        // Validate action phases result
        if (!Array.isArray(actionPhases) || actionPhases.length === 0) {
          throw new Error(`Invalid action phases calculated: ${actionPhases}`);
        }
      } catch (phaseError) {
        console.error("SR2E | Error calculating action phases:", phaseError);
        // Fallback to simple single phase
        actionPhases = [initiativeResult];
      }

      // Get safe values for initiative dice and reaction
      const initiativeDice = (this.actor.system?.initiative?.dice &&
        typeof this.actor.system.initiative.dice === 'number' &&
        !isNaN(this.actor.system.initiative.dice))
        ? this.actor.system.initiative.dice : 1;

      const reaction = (this.actor.system?.attributes?.reaction?.value &&
        typeof this.actor.system.attributes.reaction.value === 'number' &&
        !isNaN(this.actor.system.attributes.reaction.value))
        ? this.actor.system.attributes.reaction.value : 1;

      if (existingCombatant) {
        // Update existing combatant's initiative and phases
        try {
          existingCombatant.initiative = initiativeResult;
          existingCombatant.actionPhases = actionPhases;
          existingCombatant.hasRolled = true;
          existingCombatant.initiativeDice = initiativeDice;
          existingCombatant.reaction = reaction;

          console.log(`SR2E | Updated ${this.actor.name}'s initiative in tracker: ${initiativeResult}, phases: [${actionPhases.join(', ')}]`);
        } catch (updateError) {
          throw new Error(`Failed to update existing combatant: ${updateError.message}`);
        }
      } else {
        // Add new combatant to tracker
        try {
          const combatant = {
            id: foundry.utils.randomID(),
            tokenId: token.id,
            actorId: this.actor.id,
            name: this.actor.name || "Unknown Character",
            img: this.actor.img || "icons/svg/mystery-man.svg",
            initiative: initiativeResult,
            actionPhases: actionPhases,
            initiativeDice: initiativeDice,
            reaction: reaction,
            hasRolled: true
          };

          initiativeTracker.combatants.push(combatant);
          console.log(`SR2E | Added ${this.actor.name} to initiative tracker with initiative ${initiativeResult}, phases: [${actionPhases.join(', ')}]`);
        } catch (addError) {
          throw new Error(`Failed to add new combatant: ${addError.message}`);
        }
      }

      // Render the tracker if it's currently open
      try {
        if (initiativeTracker.rendered) {
          initiativeTracker.render();
        }
      } catch (renderError) {
        console.warn("SR2E | Failed to render initiative tracker:", renderError);
        // Don't throw error for render failure, it's not critical
      }

      // Show notification
      const message = existingCombatant
        ? `${this.actor.name} updated in initiative tracker with initiative ${initiativeResult}`
        : `${this.actor.name} added to initiative tracker with initiative ${initiativeResult}`;
      ui.notifications.info(message);

    } catch (error) {
      console.error("SR2E | Error adding character to initiative tracker:", error);

      // Provide specific error messages
      let errorMessage = "Failed to add character to initiative tracker.";

      if (error.message.includes("Canvas")) {
        errorMessage = "No active scene found. Open a scene with tokens to use the initiative tracker.";
      } else if (error.message.includes("token")) {
        errorMessage = `No token found for ${this.actor.name}. Place a token on the scene first.`;
      } else if (error.message.includes("tracker")) {
        errorMessage = "Initiative tracker system error. Try reloading the page.";
      } else {
        errorMessage = `Initiative tracker error: ${error.message}`;
      }

      ui.notifications.error(errorMessage);
      throw error; // Re-throw to be handled by calling function
    }
  }

  /**
   * Synchronize UI state across different parts of the character sheet
   * Ensures combat panel updates are reflected elsewhere
   */
  _synchronizeUIState() {
    try {
      // Update damage displays in other tabs if they exist
      this._updateDamageDisplays();

      // Update initiative displays in other parts of the sheet
      this._updateInitiativeDisplays();

      // Trigger any dependent calculations
      this._updateDependentValues();

      // Emit custom event for other systems to listen to
      this._emitCombatStateChange();

    } catch (error) {
      console.error("SR2E | Error synchronizing UI state:", error);
      // Don't throw error, just log it since this is a synchronization function
    }
  }

  /**
   * Update damage displays throughout the character sheet
   */
  _updateDamageDisplays() {
    try {
      if (!this.actor?.system?.health) return;

      const physicalDamage = this.actor.system.health.physical?.value || 0;
      const stunDamage = this.actor.system.health.stun?.value || 0;

      // Update any damage indicators outside the combat panel
      const damageIndicators = this.element.find('.damage-indicator, .health-status');
      damageIndicators.each((index, element) => {
        try {
          const $element = $(element);
          const damageType = $element.data('damage-type');

          if (damageType === 'physical') {
            $element.text(physicalDamage);
            $element.attr('data-damage-level', physicalDamage);
          } else if (damageType === 'stun') {
            $element.text(stunDamage);
            $element.attr('data-damage-level', stunDamage);
          }
        } catch (elementError) {
          console.warn("SR2E | Error updating damage indicator:", elementError);
        }
      });

      // Update damage-based CSS classes for visual feedback
      this.element.removeClass('light-damage moderate-damage heavy-damage critical-damage');

      const totalDamage = physicalDamage + stunDamage;
      if (totalDamage >= 16) {
        this.element.addClass('critical-damage');
      } else if (totalDamage >= 12) {
        this.element.addClass('heavy-damage');
      } else if (totalDamage >= 6) {
        this.element.addClass('moderate-damage');
      } else if (totalDamage > 0) {
        this.element.addClass('light-damage');
      }

    } catch (error) {
      console.error("SR2E | Error updating damage displays:", error);
    }
  }

  /**
   * Update initiative displays throughout the character sheet
   */
  _updateInitiativeDisplays() {
    try {
      if (!this.actor?.system?.initiative) return;

      const currentInitiative = this.actor.system.initiative.current || 0;

      // Update any initiative indicators outside the combat panel
      const initiativeIndicators = this.element.find('.initiative-indicator, .initiative-display');
      initiativeIndicators.each((index, element) => {
        try {
          const $element = $(element);
          $element.text(currentInitiative);
          $element.attr('data-initiative', currentInitiative);
        } catch (elementError) {
          console.warn("SR2E | Error updating initiative indicator:", elementError);
        }
      });

    } catch (error) {
      console.error("SR2E | Error updating initiative displays:", error);
    }
  }

  /**
   * Update values that depend on combat state (damage penalties, etc.)
   */
  _updateDependentValues() {
    try {
      if (!this.actor?.system?.health) return;

      const physicalDamage = this.actor.system.health.physical?.value || 0;
      const stunDamage = this.actor.system.health.stun?.value || 0;

      // Calculate damage penalties according to SR2 rules
      // Physical damage: -1 die per 3 boxes of damage
      // Stun damage: -1 die per 3 boxes of damage
      const physicalPenalty = Math.floor(physicalDamage / 3);
      const stunPenalty = Math.floor(stunDamage / 3);
      const totalPenalty = physicalPenalty + stunPenalty;

      // Update penalty displays
      const penaltyIndicators = this.element.find('.damage-penalty, .wound-penalty');
      penaltyIndicators.each((index, element) => {
        try {
          const $element = $(element);
          $element.text(totalPenalty > 0 ? `-${totalPenalty}` : '0');
          $element.attr('data-penalty', totalPenalty);

          // Add visual styling based on penalty severity
          $element.removeClass('minor-penalty major-penalty severe-penalty');
          if (totalPenalty >= 6) {
            $element.addClass('severe-penalty');
          } else if (totalPenalty >= 3) {
            $element.addClass('major-penalty');
          } else if (totalPenalty > 0) {
            $element.addClass('minor-penalty');
          }
        } catch (elementError) {
          console.warn("SR2E | Error updating penalty indicator:", elementError);
        }
      });

    } catch (error) {
      console.error("SR2E | Error updating dependent values:", error);
    }
  }

  /**
   * Emit custom event for combat state changes
   */
  _emitCombatStateChange() {
    try {
      const combatState = {
        actorId: this.actor.id,
        physicalDamage: this.actor.system.health?.physical?.value || 0,
        stunDamage: this.actor.system.health?.stun?.value || 0,
        initiative: this.actor.system.initiative?.current || 0,
        timestamp: Date.now()
      };

      // Emit event for other systems to listen to
      Hooks.callAll('sr2e.combatStateChanged', combatState);

      // Also emit on the actor for actor-specific listeners
      if (this.actor.sheet) {
        $(this.actor.sheet.element).trigger('combatStateChanged', combatState);
      }

    } catch (error) {
      console.error("SR2E | Error emitting combat state change:", error);
    }
  }

  /**
   * Handle concurrent updates gracefully with debouncing
   */
  _debouncedUpdate = foundry.utils.debounce(async (updateData) => {
    try {
      // Check if actor is still valid and editable
      if (!this.actor || !this.actor.isOwner) {
        console.warn("SR2E | Cannot update actor: not owner or actor invalid");
        return;
      }

      // Merge any pending updates
      if (this._pendingUpdates) {
        updateData = foundry.utils.mergeObject(this._pendingUpdates, updateData);
        this._pendingUpdates = null;
      }

      // Perform the update with error handling
      await this.actor.update(updateData);

      // Synchronize UI after successful update
      this._synchronizeUIState();

    } catch (error) {
      console.error("SR2E | Error in debounced update:", error);
      ui.notifications.error("Failed to save changes. You may not have permission or the data may be invalid.");
    }
  }, 300);



  /**
   * Override the render method to handle loading states
   */
  async render(force = false, options = {}) {
    try {
      // Add loading state
      if (this.element && this.element.length > 0) {
        this.element.addClass('loading');
      }

      // Call parent render method
      const result = await super.render(force, options);

      // Remove loading state and synchronize UI
      if (this.element && this.element.length > 0) {
        this.element.removeClass('loading');

        // Synchronize UI state after render
        setTimeout(() => {
          this._synchronizeUIState();
        }, 100);
      }

      return result;

    } catch (error) {
      console.error("SR2E | Error rendering character sheet:", error);

      // Remove loading state even on error
      if (this.element && this.element.length > 0) {
        this.element.removeClass('loading');
      }

      // Show user-friendly error
      ui.notifications.error("Failed to render character sheet. Try refreshing the page.");
      throw error;
    }
  }

  /**
   * Handle actor data updates from external sources
   */
  _onActorUpdate(actor, updateData, options, userId) {
    try {
      // Only process updates for this actor
      if (actor.id !== this.actor.id) return;

      // Check if combat-related data was updated
      const combatDataUpdated = (
        updateData.system?.health ||
        updateData.system?.initiative ||
        updateData.system?.attributes?.reaction
      );

      if (combatDataUpdated) {
        console.log("SR2E | Combat data updated externally, synchronizing UI");

        // Synchronize UI with a small delay to ensure data is fully updated
        setTimeout(() => {
          this._synchronizeUIState();
        }, 50);
      }

    } catch (error) {
      console.error("SR2E | Error handling actor update:", error);
    }
  }



  /**
   * Clean up listeners when sheet is closed
   */
  close(options = {}) {
    // Remove actor update listener
    Hooks.off('updateActor', this._onActorUpdate);

    return super.close(options);
  }
}