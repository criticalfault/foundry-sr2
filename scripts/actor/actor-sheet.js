/**
 * Extend the basic ActorSheet with Shadowrun 2E specific functionality
 */
export class SR2ActorSheet extends ActorSheet {

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["shadowrun2e", "sheet", "actor"],
      template: "systems/shadowrun2e/templates/actor/character-sheet.html",
      width: 720,
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
  getData() {
    const context = super.getData();
    const actorData = this.actor.toObject(false);

    context.system = actorData.system;
    context.flags = actorData.flags;

    // Prepare character data and items
    if (actorData.type == 'character') {
      this._prepareItems(context);
      this._prepareCharacterData(context);
      this._prepareSkillsData(context);
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
    } catch (error) {
      console.error('Failed to load skills data:', error);
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
    html.find('.item-delete').click(ev => {
      ev.preventDefault();
      ev.stopPropagation();
      
      try {
        const li = $(ev.currentTarget).parents(".item, .skill-item, .item-row");
        const itemId = li.data("itemId") || li.data("item-id");
        
        if (!itemId) {
          console.warn("SR2E | No item ID found for delete operation");
          return;
        }
        
        const item = this.actor.items.get(itemId);
        if (item) {
          // Confirm deletion for important items
          const confirmDelete = game.settings.get("core", "noCanvas") || 
                               confirm(`Delete ${item.name}?`);
          
          if (confirmDelete) {
            item.delete();
            li.slideUp(200, () => this.render(false));
          }
        } else {
          console.warn(`SR2E | Item with ID ${itemId} not found`);
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

    // Skill management
    html.find('.base-skill-select').change(this._onBaseSkillChange.bind(this));
    html.find('.skill-roll').click(this._onSkillRoll.bind(this));

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
        'name': baseSkill || 'New Skill'
      });
      this.render(false);
    }
  }

  /**
   * Handle skill roll
   */
  async _onSkillRoll(event) {
    event.preventDefault();
    const skillId = event.currentTarget.dataset.skillId;
    const skill = this.actor.items.get(skillId);

    if (!skill) return;

    const skillRating = skill.system.rating || 0;
    const attributeName = skill.system.attribute || 'body';
    const attributeValue = this.actor.system.attributes[attributeName]?.value || 1;

    // Calculate dice pool
    let dicePool = skillRating + attributeValue;

    // Add specialization bonus if applicable
    let title = skill.name;
    if (skill.system.concentration) {
      title += ` (${skill.system.concentration})`;
    }
    if (skill.system.specialization) {
      title += ` [${skill.system.specialization}]`;
      // Specialization gives +2 dice when applicable
      dicePool += 2;
    }

    // Roll the dice
    await this.actor.rollDice(dicePool, 4, title);
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

    // Calculate target number (usually 4, but can be modified)
    const targetNumber = 4;

    const title = `Casting ${spell.name} (Force ${force})`;

    // Roll for spellcasting
    const result = await this.actor.rollDice(dicePool, targetNumber, title);

    // Calculate drain
    const drainValue = this._calculateDrain(spell.system.drain, force);
    const drainPool = this.actor.system.attributes.willpower.value + magicRating;

    // Roll drain resistance
    const drainTitle = `Drain Resistance for ${spell.name}`;
    await this.actor.rollDice(drainPool, drainValue, drainTitle);
  }

  /**
   * Get the highest Sorcery skill rating
   */
  _getHighestSorcerySkill() {
    const sorcerySkills = this.actor.items.filter(i =>
      i.type === 'skill' && i.system.baseSkill === 'Sorcery'
    );

    if (sorcerySkills.length === 0) return 0;

    return Math.max(...sorcerySkills.map(skill => skill.system.rating || 0));
  }

  /**
   * Handle weapon attacks
   */
  async _onWeaponAttack(event) {
    event.preventDefault();
    const weaponId = event.currentTarget.dataset.itemId;
    const weapon = this.actor.items.get(weaponId);

    if (!weapon) return;

    // Get relevant attributes and skills
    const strength = this.actor.system.attributes.strength.value || 1;
    const quickness = this.actor.system.attributes.quickness.value || 1;
    
    // Determine if it's a melee or ranged weapon
    const isRanged = weapon.system.weaponType === 'ranged';
    const attribute = isRanged ? quickness : strength;
    
    // Get appropriate combat skill
    const combatSkills = this.actor.items.filter(i => 
      i.type === 'skill' && 
      (i.system.baseSkill === 'Armed Combat' || 
       i.system.baseSkill === 'Firearms' || 
       i.system.baseSkill === 'Projectile Weapons')
    );
    
    let skillRating = 0;
    if (combatSkills.length > 0) {
      // Use the highest applicable combat skill
      skillRating = Math.max(...combatSkills.map(skill => skill.system.rating || 0));
    }

    // Calculate dice pool
    const dicePool = attribute + skillRating;
    
    // Create attack title
    const attackType = isRanged ? 'Ranged Attack' : 'Melee Attack';
    const title = `${attackType} with ${weapon.name}`;

    // Roll for attack
    const result = await this.actor.rollDice(dicePool, 4, title);

    // Display weapon damage in chat
    const damageCode = weapon.system.damage || "1L";
    const chatData = {
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `
        <div class="weapon-attack">
          <h3>${weapon.name} Attack</h3>
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
      await weapon.update({'system.ammo.current': newAmmo});
      
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
    const browser = new SR2ItemBrowser(this.actor, 'totem', 'shadowrun2e.totems');
    
    // Override the default item creation to handle totem selection
    const originalAddItem = browser.addItem;
    browser.addItem = async (item) => {
      // First, unselect any existing totems
      const existingTotems = this.actor.items.filter(i => i.type === 'totem');
      for (const existingTotem of existingTotems) {
        await existingTotem.update({'system.isSelected': false});
      }
      
      // Then add the new totem and mark it as selected
      const newItem = await originalAddItem.call(browser, item);
      if (newItem) {
        await newItem.update({'system.isSelected': true});
      }
      return newItem;
    };
    
    browser.render(true);
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