/**
 * Shadowrun 2E Hotbar Macro functionality
 */

/**
 * Create a macro when an item is dropped on the hotbar
 */
export async function createItemMacro(data, slot) {
    // Validate the drop data
    if (data.type !== "Item") return;

    const item = await fromUuid(data.uuid);
    if (!item) {
        ui.notifications.warn("Could not find the item for this macro");
        return;
    }

    const actor = item.parent;
    if (!actor) {
        ui.notifications.warn("This item must be owned by an actor to create a macro");
        return;
    }

    // Create the macro command based on item type
    let command = "";
    let macroName = "";

    switch (item.type) {
        case "weapon":
            macroName = `${item.name} (Attack)`;
            command = `// Shadowrun 2E Weapon Attack Macro
executeSR2Macro("${actor.id}", "${item.id}", "attack");`;
            break;

        case "spell":
            macroName = `${item.name} (Cast)`;
            command = `// Shadowrun 2E Spell Casting Macro
executeSR2Macro("${actor.id}", "${item.id}", "cast");`;
            break;

        case "skill":
            macroName = `${item.name} (Roll)`;
            command = `// Shadowrun 2E Skill Roll Macro
executeSR2Macro("${actor.id}", "${item.id}", "base");`;
            break;

        case "adeptpower":
            macroName = `${item.name} (Activate)`;
            command = `// Shadowrun 2E Adept Power Macro
executeSR2Macro("${actor.id}", "${item.id}", "activate");`;
            break;

        default:
            macroName = `${item.name}`;
            command = `// Shadowrun 2E Item Macro
executeSR2Macro("${actor.id}", "${item.id}", "use");`;
            break;
    }

    // Create the macro
    const macro = await Macro.create({
        name: macroName,
        type: "script",
        img: item.img,
        command: command,
        flags: {
            "shadowrun2e": {
                itemId: item.id,
                actorId: actor.id,
                itemType: item.type
            }
        }
    });

    // Assign the macro to the hotbar slot
    game.user.assignHotbarMacro(macro, slot);

    ui.notifications.info(`Created macro for ${item.name}`);
}

/**
 * Handle hotbar drop events
 */
Hooks.on("hotbarDrop", (bar, data, slot) => {
    if (data.type === "Item") {
        createItemMacro(data, slot);
        return false; // Prevent default behavior
    }
});

/**
 * Execute a Shadowrun 2E item macro
 */
window.executeSR2Macro = function (actorId, itemId, actionType = "default") {
    const actor = game.actors.get(actorId);
    const item = actor?.items.get(itemId);

    if (!actor) {
        ui.notifications.error("Actor not found for this macro");
        return;
    }

    if (!item) {
        ui.notifications.error("Item not found on actor");
        return;
    }

    console.log(`SR2E | Executing macro for ${item.name} (${item.type}) - Action: ${actionType}`);

    // Execute the appropriate action based on item type and action
    switch (item.type) {
        case "weapon":
            if (actor.sheet._onWeaponAttack) {
                const fakeEvent = {
                    preventDefault: () => { },
                    currentTarget: { dataset: { itemId: itemId } }
                };
                actor.sheet._onWeaponAttack(fakeEvent);
            } else {
                item.roll();
            }
            break;

        case "spell":
            if (actor.sheet._onSpellCast) {
                const fakeEvent = {
                    preventDefault: () => { },
                    currentTarget: { dataset: { itemId: itemId } }
                };
                actor.sheet._onSpellCast(fakeEvent);
            } else {
                item.roll();
            }
            break;

        case "skill":
            if (actor.sheet._onSkillRoll) {
                const fakeEvent = {
                    preventDefault: () => { },
                    currentTarget: {
                        dataset: {
                            skillId: itemId,
                            rollType: actionType === "concentration" ? "concentration" :
                                actionType === "specialization" ? "specialization" : "base"
                        }
                    }
                };
                actor.sheet._onSkillRoll(fakeEvent);
            } else {
                item.roll();
            }
            break;

        default:
            item.roll();
            break;
    }
};