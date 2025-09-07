/**
 * Extend the basic ActorSheet with Vehicle specific functionality
 */
export class SR2VehicleSheet extends foundry.applications.sheets.ActorSheet {

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["shadowrun2e", "sheet", "actor", "vehicle"],
      width: 700,
      height: 600,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "stats" }]
    });
  }

  /** @override */
  get template() {
    return "systems/shadowrun2e/templates/actor/vehicle-sheet.html";
  }

  /** @override */
  getData() {
    const context = super.getData();
    const actorData = this.actor.toObject(false);

    context.system = actorData.system;
    context.flags = actorData.flags;

    // Prepare vehicle data
    this._prepareVehicleData(context);

    return context;
  }

  /**
   * Organize and classify Items for Vehicle sheets.
   */
  _prepareVehicleData(context) {
    const gear = [];
    const weapons = [];
    const modifications = [];

    for (let i of context.items) {
      i.img = i.img || "icons/svg/item-bag.svg";
      
      if (i.type === 'weapon') {
        weapons.push(i);
      } else if (i.type === 'gear') {
        if (i.name.toLowerCase().includes('modification') || 
            i.name.toLowerCase().includes('upgrade') ||
            i.name.toLowerCase().includes('enhancement')) {
          modifications.push(i);
        } else {
          gear.push(i);
        }
      } else {
        gear.push(i);
      }
    }

    context.gear = gear;
    context.weapons = weapons;
    context.modifications = modifications;

    // Calculate total weight
    context.totalWeight = context.items.reduce((total, item) => {
      return total + ((item.system.weight || 0) * (item.system.quantity || 1));
    }, 0);

    // Determine vehicle type icon
    context.vehicleTypeIcon = this._getVehicleTypeIcon(context.system.vehicleType);
  }

  /**
   * Get appropriate icon for vehicle type
   */
  _getVehicleTypeIcon(vehicleType) {
    const icons = {
      'ground': 'fas fa-car',
      'air': 'fas fa-plane',
      'water': 'fas fa-ship',
      'drone': 'fas fa-robot'
    };
    return icons[vehicleType] || 'fas fa-car';
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    // Add Item
    html.find('.item-create').click(this._onItemCreate.bind(this));

    // Delete Item
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
                     button.parents(".item-row").attr("data-item-id") ||
                     button.parents(".item-row").data("item-id") ||
                     button.parents(".item-row").data("itemId");
        
        console.log("SR2E | Delete button clicked, itemId:", itemId);
        console.log("SR2E | Button data attributes:", button.get(0).dataset);
        console.log("SR2E | Available items:", this.actor.items.map(i => ({id: i.id, name: i.name})));
        
        if (!itemId) {
          console.warn("SR2E | No item ID found for delete operation");
          ui.notifications.error("Could not find item to delete. Check console for details.");
          return;
        }
        
        const item = this.actor.items.get(itemId);
        if (item) {
          // Confirm deletion
          const confirmDelete = game.settings.get("core", "noCanvas") || 
                               confirm(`Delete ${item.name}?`);
          
          if (confirmDelete) {
            await item.delete();
            const row = button.parents(".item-row");
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

    // Repair damage
    html.find('.repair-damage').click(this._onRepairDamage.bind(this));

    // Vehicle type change
    html.find('select[name="system.vehicleType"]').change(this._onVehicleTypeChange.bind(this));
  }

  /**
   * Handle creating a new item
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
   * Handle repairing vehicle damage
   */
  async _onRepairDamage(event) {
    event.preventDefault();
    const repairAmount = parseInt(event.currentTarget.dataset.amount) || 1;
    const currentDamage = this.actor.system.health.value;
    const newDamage = Math.max(0, currentDamage - repairAmount);
    
    await this.actor.update({'system.health.value': newDamage});
    
    if (repairAmount === 1) {
      ui.notifications.info(`Repaired 1 point of vehicle damage.`);
    } else {
      ui.notifications.info(`Fully repaired vehicle damage.`);
    }
  }

  /**
   * Handle vehicle type change
   */
  async _onVehicleTypeChange(event) {
    event.preventDefault();
    this.render(false);
  }
}