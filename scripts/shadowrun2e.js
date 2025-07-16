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

/* -------------------------------------------- */
/*  Foundry VTT Initialization                  */
/* -------------------------------------------- */

Hooks.once("init", async function () {
    console.log("Shadowrun 2E | Initializing Shadowrun 2nd Edition System");

    // Assign custom classes and constants
    CONFIG.Actor.documentClass = SR2Actor;
    CONFIG.Item.documentClass = SR2Item;

    // Register sheet application classes
    Actors.unregisterSheet("core", ActorSheet);
    Actors.registerSheet("shadowrun2e", SR2ActorSheet, { makeDefault: true });

    Items.unregisterSheet("core", ItemSheet);
    Items.registerSheet("shadowrun2e", SR2ItemSheet, { makeDefault: true });

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
}

/* -------------------------------------------- */
/*  Handlebars Helpers                          */
/* -------------------------------------------- */

function preloadHandlebarsTemplates() {
    const templatePaths = [
        "systems/shadowrun2e/templates/actor/character-sheet.html",
        "systems/shadowrun2e/templates/actor/parts/character-header.html",
        "systems/shadowrun2e/templates/actor/parts/character-attributes.html",
        "systems/shadowrun2e/templates/actor/parts/character-skills.html",
        "systems/shadowrun2e/templates/actor/parts/character-combat.html",
        "systems/shadowrun2e/templates/item/item-sheet.html",
        "systems/shadowrun2e/templates/apps/initiative-tracker.html",
        "systems/shadowrun2e/templates/apps/item-browser.html"
    ];

    return loadTemplates(templatePaths);
}

/* -------------------------------------------- */
/*  Handlebars Helpers                          */
/* -------------------------------------------- */

function registerHandlebarsHelpers() {
    // Helper to calculate initiative phases
    Handlebars.registerHelper('phases', function(initiative) {
        const phases = [];
        let currentInit = initiative;
        while (currentInit > 0) {
            phases.push(currentInit);
            currentInit -= 10;
        }
        return phases;
    });

    // Helper for greater than comparison
    Handlebars.registerHelper('gt', function(a, b) {
        return a > b;
    });

    // Helper for equality comparison
    Handlebars.registerHelper('eq', function(a, b) {
        return a === b;
    });

    // Helper to get array element by index
    Handlebars.registerHelper('lookup', function(array, index) {
        return array[index];
    });
}