/**
 * Shadowrun 2nd Edition System for Foundry VTT
 */

// Import modules
import { SR2Actor } from "./actor/actor.js";
import { SR2ActorSheet } from "./actor/actor-sheet.js";
import { SR2Item } from "./item/item.js";
import { SR2ItemSheet } from "./item/item-sheet.js";
import { initializeInitiativeTracker } from "./initiative-tracker.js";
import { SR2ItemBrowser } from "./item-browser.js";
import { SR2DataImporter } from "./data-importer.js";

/* -------------------------------------------- */
/*  Foundry VTT Initialization                  */
/* -------------------------------------------- */

Hooks.once("init", async function () {
    console.log("Shadowrun 2E | Initializing Shadowrun 2nd Edition System");
    
    // Suppress V1 Application deprecation warnings for now
    // TODO: Migrate to ApplicationV2 in future version
    const originalWarn = console.warn;
    console.warn = function(...args) {
        const message = args.join(' ');
        if (message.includes('V1 Application framework is deprecated')) {
            return; // Suppress this specific warning
        }
        originalWarn.apply(console, args);
    };
    
    // Debug: Log that we're starting initialization
    console.log("SR2E | Registering document classes...");

    // Assign custom classes and constants
    CONFIG.Actor.documentClass = SR2Actor;
    CONFIG.Item.documentClass = SR2Item;

    // Register sheet application classes
    console.log("SR2E | Unregistering core sheets...");
    Actors.unregisterSheet("core", ActorSheet);
    
    console.log("SR2E | Registering SR2ActorSheet...", SR2ActorSheet);
    Actors.registerSheet("shadowrun2e", SR2ActorSheet, { 
        types: ["character"], 
        makeDefault: true,
        label: "Shadowrun 2E Character Sheet"
    });
    
    // Force set as default for character actors
    if (!CONFIG.Actor.sheetClasses.character) {
        CONFIG.Actor.sheetClasses.character = {};
    }
    CONFIG.Actor.sheetClasses.character["shadowrun2e.SR2ActorSheet"] = {
        id: "shadowrun2e.SR2ActorSheet",
        cls: SR2ActorSheet,
        default: true
    };

    Items.unregisterSheet("core", ItemSheet);
    Items.registerSheet("shadowrun2e", SR2ItemSheet, { 
        makeDefault: true,
        label: "Shadowrun 2E Item Sheet"
    });
    
    console.log("SR2E | Sheet registration completed");

    // Register system settings
    registerSystemSettings();

    // Preload Handlebars templates
    preloadHandlebarsTemplates();

    // Register Handlebars helpers
    registerHandlebarsHelpers();

    // Initialize initiative tracker
    initializeInitiativeTracker();
});

/* -------------------------------------------- */
/*  System Settings                             */
/* -------------------------------------------- */

function registerSystemSettings() {
    game.settings.register("shadowrun2e", "useTargetNumbers", {
        name: "Use Target Numbers",
        hint: "Use target numbers for dice rolls instead of open-ended rolling",
        scope: "world",
        config: true,
        type: Boolean,
        default: true
    });

    game.settings.register("shadowrun2e", "dataImported", {
        name: "Data Imported",
        hint: "Whether the system data has been imported into compendiums",
        scope: "world",
        config: false,
        type: Boolean,
        default: false
    });

    game.settings.registerMenu("shadowrun2e", "dataImport", {
        name: "Import System Data",
        label: "Import Data",
        hint: "Import cyberware, bioware, spells, and other items into compendiums",
        icon: "fas fa-download",
        type: DataImportConfig,
        restricted: true
    });
}

/* -------------------------------------------- */
/*  Handlebars Helpers                          */
/* -------------------------------------------- */

function preloadHandlebarsTemplates() {
    const templatePaths = [
        "systems/shadowrun2e/templates/actor/character-sheet.html",
        "systems/shadowrun2e/templates/item/item-sheet.html",
        "systems/shadowrun2e/templates/apps/initiative-tracker.html",
        "systems/shadowrun2e/templates/apps/item-browser.html",
        "systems/shadowrun2e/templates/apps/data-import.html",
        "systems/shadowrun2e/templates/chat/dice-roll.html"
    ];

    return loadTemplates(templatePaths);
}

/* -------------------------------------------- */
/*  Handlebars Helpers                          */
/* -------------------------------------------- */

function registerHandlebarsHelpers() {
    // Helper to calculate initiative phases
    Handlebars.registerHelper('phases', function (initiative) {
        const phases = [];
        let currentInit = initiative;
        while (currentInit > 0) {
            phases.push(currentInit);
            currentInit -= 10;
        }
        return phases;
    });

    // Helper for greater than comparison
    Handlebars.registerHelper('gt', function (a, b) {
        return a > b;
    });

    // Helper for equality comparison
    Handlebars.registerHelper('eq', function (a, b) {
        return a === b;
    });

    // Helper to get array element by index
    Handlebars.registerHelper('lookup', function (array, index) {
        return array[index];
    });

    // Helper for string capitalization
    Handlebars.registerHelper('capitalize', function (str) {
        if (typeof str !== 'string') return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    });
}

/* -------------------------------------------- */
/*  Data Import Configuration                   */
/* -------------------------------------------- */

class DataImportConfig extends FormApplication {
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "sr2-data-import",
            title: "Import Shadowrun 2E Data",
            template: "systems/shadowrun2e/templates/apps/data-import.html",
            width: 400,
            height: 300,
            classes: ["shadowrun2e", "data-import"]
        });
    }

    getData() {
        return {
            dataImported: game.settings.get("shadowrun2e", "dataImported")
        };
    }

    activateListeners(html) {
        super.activateListeners(html);
        html.find('.import-data').click(this._onImportData.bind(this));
        html.find('.clear-data').click(this._onClearData.bind(this));
    }

    async _onImportData(event) {
        event.preventDefault();
        ui.notifications.info("Starting data import...");

        try {
            await SR2DataImporter.importAllData();
            await game.settings.set("shadowrun2e", "dataImported", true);
            this.render();
        } catch (error) {
            console.error("Data import failed:", error);
            ui.notifications.error("Data import failed. Check console for details.");
        }
    }

    async _onClearData(event) {
        event.preventDefault();

        const confirmed = await Dialog.confirm({
            title: "Clear All Data",
            content: "Are you sure you want to clear all imported data? This cannot be undone.",
            yes: () => true,
            no: () => false
        });

        if (confirmed) {
            await this._clearAllPacks();
            await game.settings.set("shadowrun2e", "dataImported", false);
            ui.notifications.info("All data cleared.");
            this.render();
        }
    }

    async _clearAllPacks() {
        const packNames = ["cyberware", "bioware", "spells", "adeptpowers", "skills"];

        for (const packName of packNames) {
            const pack = game.packs.get(`shadowrun2e.${packName}`);
            if (pack) {
                const documents = await pack.getDocuments();
                await Item.deleteDocuments(documents.map(d => d.id), { pack: pack.collection });
            }
        }
    }
}

/* -------------------------------------------- */
/*  Ready Hook - Auto Import Data              */
/* -------------------------------------------- */

Hooks.once("ready", async function () {
    // Debug: Check if our sheets are registered
    console.log("SR2E | Checking registered actor sheets:", Object.keys(game.system.documentTypes.Actor));
    console.log("SR2E | Available actor sheet classes:", Actors.registeredSheets);
    
    // Auto-import data on first world load
    if (game.user.isGM && !game.settings.get("shadowrun2e", "dataImported")) {
        const shouldImport = await Dialog.confirm({
            title: "Import Shadowrun 2E Data",
            content: `<p>This appears to be the first time loading Shadowrun 2E in this world.</p>
                     <p>Would you like to automatically import all system data (cyberware, bioware, spells, etc.) into compendiums?</p>
                     <p><em>This may take a few moments...</em></p>`,
            yes: () => true,
            no: () => false,
            defaultYes: true
        });

        if (shouldImport) {
            ui.notifications.info("Importing Shadowrun 2E data...");
            try {
                await SR2DataImporter.importAllData();
                await game.settings.set("shadowrun2e", "dataImported", true);
            } catch (error) {
                console.error("Auto-import failed:", error);
                ui.notifications.warn("Auto-import failed. You can manually import data from System Settings.");
            }
        }
    }
});