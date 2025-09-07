/**
 * Extend the basic ItemSheet with Shadowrun 2E specific functionality
 */
export class SR2ItemSheet extends foundry.applications.sheets.ItemSheet {

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["shadowrun2e", "sheet", "item"],
      width: 520,
      height: 480,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }]
    });
  }

  /** @override */
  get template() {
    // Use the same template for all item types
    return "systems/shadowrun2e/templates/item/item-sheet.html";
  }

  /** @override */
  async getData() {
    const context = super.getData();
    const itemData = this.item.toObject(false);
    
    context.rollData = {};
    let actor = this.object?.parent ?? null;
    if (actor) {
      context.rollData = actor.getRollData();
      
      // For weapons, get available skills for linking
      if (itemData.type === 'weapon') {
        context.availableSkills = actor.items.filter(i => i.type === 'skill');
      }
    }

    context.system = itemData.system;
    context.flags = itemData.flags;

    return context;
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    // Roll handlers, click handlers, etc. would go here
  }
}