/**
 * Extend the basic ActorSheet with Cyberdeck specific functionality
 */
export class SR2CyberdeckSheet extends ActorSheet {

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["shadowrun2e", "sheet", "actor", "cyberdeck"],
      width: 600,
      height: 500,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "deck" }]
    });
  }

  /** @override */
  get template() {
    return "systems/shadowrun2e/templates/actor/cyberdeck-sheet.html";
  }

  /** @override */
  getData() {
    const context = super.getData();
    const actorData = this.actor.toObject(false);

    context.system = actorData.system;
    context.flags = actorData.flags;

    // Prepare cyberdeck data
    this._prepareCyberdeckData(context);

    return context;
  }

  /**
   * Organize and classify Items for Cyberdeck sheets.
   */
  _prepareCyberdeckData(context) {
    const programs = [];

    for (let i of context.items) {
      i.img = i.img || "icons/svg/item-bag.svg";
      
      if (i.type === 'program') {
        programs.push(i);
      }
    }

    context.programs = programs;
    
    // Calculate memory and storage usage
    context.memoryUsed = programs
      .filter(p => p.system.isLoaded)
      .reduce((total, p) => total + (p.system.memorySize || 0), 0);
    
    context.storageUsed = programs
      .reduce((total, p) => total + (p.system.memorySize || 0), 0);
    
    // Update the actor's memory and storage usage
    context.system.memory.used = context.memoryUsed;
    context.system.storage.used = context.storageUsed;
    
    // Calculate available memory and storage
    context.memoryAvailable = context.system.memory.total - context.memoryUsed;
    context.storageAvailable = context.system.storage.total - context.storageUsed;
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    // Add Program
    html.find('.item-create').click(this._onItemCreate.bind(this));

    // Delete Program
    html.find('.item-delete').click(ev => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      item.delete();
      li.slideUp(200, () => this.render(false));
    });

    // Toggle program loaded/active status
    html.find('.program-toggle').click(this._onProgramToggle.bind(this));
    
    // Repair damage
    html.find('.repair-damage').click(this._onRepairDamage.bind(this));
  }

  /**
   * Handle creating a new program
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
    return await Item.create(itemData, {parent: this.actor});
  }

  /**
   * Handle toggling program loaded/active status
   */
  async _onProgramToggle(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const programId = element.dataset.programId;
    const toggleType = element.dataset.toggle;
    const program = this.actor.items.get(programId);
    
    if (!program) return;

    const updateData = {};
    
    if (toggleType === 'loaded') {
      updateData['system.isLoaded'] = !program.system.isLoaded;
      
      // If unloading, also deactivate
      if (program.system.isLoaded) {
        updateData['system.isActive'] = false;
      }
    } else if (toggleType === 'active') {
      // Can only activate if loaded
      if (program.system.isLoaded) {
        updateData['system.isActive'] = !program.system.isActive;
      } else {
        ui.notifications.warn("Program must be loaded before it can be activated.");
        return;
      }
    }

    await program.update(updateData);
    this.render(false);
  }

  /**
   * Handle repairing icon damage
   */
  async _onRepairDamage(event) {
    event.preventDefault();
    const repairAmount = parseInt(event.currentTarget.dataset.amount) || 1;
    const currentDamage = this.actor.system.damage.icon.value;
    const newDamage = Math.max(0, currentDamage - repairAmount);
    
    await this.actor.update({'system.damage.icon.value': newDamage});
    
    if (repairAmount === 1) {
      ui.notifications.info(`Repaired 1 point of Icon damage.`);
    } else {
      ui.notifications.info(`Fully repaired Icon damage.`);
    }
  }
}