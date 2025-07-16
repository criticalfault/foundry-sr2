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

    // Calculate total power points used for adept powers
    context.powerPointsUsed = adeptpowers.reduce((total, power) => {
      return total + (power.system.totalCost || 0);
    }, 0);
  }

  /**
   * Prepare character specific data
   */
  _prepareCharacterData(context) {
    // Add any character-specific data preparation here
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
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      item.delete();
      li.slideUp(200, () => this.render(false));
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