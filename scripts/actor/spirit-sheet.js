/**
 * Extend the basic ActorSheet with Spirit specific functionality
 */
export class SR2SpiritSheet extends ActorSheet {

    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["shadowrun2e", "sheet", "actor", "spirit"],
            width: 600,
            height: 500,
            tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "stats" }]
        });
    }

    /** @override */
    get template() {
        return "systems/shadowrun2e/templates/actor/spirit-sheet.html";
    }

    /** @override */
    getData() {
        const context = super.getData();
        const actorData = this.actor.toObject(false);

        context.system = actorData.system;
        context.flags = actorData.flags;

        // Prepare spirit data
        this._prepareSpiritData(context);

        return context;
    }

    /**
     * Organize and classify data for Spirit sheets.
     */
    _prepareSpiritData(context) {
        // Calculate derived values
        context.initiative = context.system.attributes.reaction.value + context.system.attributes.quickness.value;

        // Spirit type icon
        context.spiritTypeIcon = this._getSpiritTypeIcon(context.system.spiritType);

        // Services remaining display
        context.servicesRemaining = Math.max(0, context.system.services);
    }

    /**
     * Get appropriate icon for spirit type
     */
    _getSpiritTypeIcon(spiritType) {
        const icons = {
            'elemental': 'fas fa-fire',
            'nature': 'fas fa-leaf',
            'city': 'fas fa-city',
            'hearth': 'fas fa-home',
            'ancestor': 'fas fa-ghost',
            'task': 'fas fa-cog',
            'guidance': 'fas fa-compass',
            'plant': 'fas fa-seedling',
            'beast': 'fas fa-paw',
            'water': 'fas fa-water',
            'air': 'fas fa-wind',
            'earth': 'fas fa-mountain',
            'fire': 'fas fa-fire-flame-curved',
            'man': 'fas fa-user',
            'toxic': 'fas fa-skull-crossbones'
        };
        return icons[spiritType?.toLowerCase()] || 'fas fa-ghost';
    }

    /** @override */
    activateListeners(html) {
        super.activateListeners(html);

        // Everything below here is only needed if the sheet is editable
        if (!this.isEditable) return;

        // Heal damage
        html.find('.heal-damage').click(this._onHealDamage.bind(this));

        // Service buttons
        html.find('.use-service').click(this._onUseService.bind(this));
        html.find('.add-service').click(this._onAddService.bind(this));

        // Spirit type change
        html.find('select[name="system.spiritType"]').change(this._onSpiritTypeChange.bind(this));
    }

    /**
     * Handle healing spirit damage
     */
    async _onHealDamage(event) {
        event.preventDefault();
        const healAmount = parseInt(event.currentTarget.dataset.amount) || 1;
        const currentDamage = this.actor.system.health.value;
        const newDamage = Math.max(0, currentDamage - healAmount);

        await this.actor.update({ 'system.health.value': newDamage });

        if (healAmount === 1) {
            ui.notifications.info(`Healed 1 point of spirit damage.`);
        } else {
            ui.notifications.info(`Fully healed spirit damage.`);
        }
    }

    /**
     * Handle using a service
     */
    async _onUseService(event) {
        event.preventDefault();
        const currentServices = this.actor.system.services;

        if (currentServices > 0) {
            await this.actor.update({ 'system.services': currentServices - 1 });
            ui.notifications.info(`Service used. ${currentServices - 1} services remaining.`);

            if (currentServices - 1 === 0) {
                ui.notifications.warn("Spirit has no more services remaining and may depart!");
            }
        } else {
            ui.notifications.warn("Spirit has no services remaining!");
        }
    }

    /**
     * Handle adding services
     */
    async _onAddService(event) {
        event.preventDefault();
        const currentServices = this.actor.system.services;
        await this.actor.update({ 'system.services': currentServices + 1 });
        ui.notifications.info(`Service added. ${currentServices + 1} services available.`);
    }

    /**
     * Handle spirit type change
     */
    async _onSpiritTypeChange(event) {
        event.preventDefault();
        this.render(false);
    }
}