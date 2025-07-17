/**
 * Character Importer for Shadowrun 2E
 * Imports characters from JSON files into Foundry actors
 */
export class SR2CharacterImporter {

  /**
   * Show the character import dialog
   */
  static async showImportDialog() {
    const dialog = new Dialog({
      title: "Import Shadowrun 2E Character",
      content: `
        <form>
          <div class="form-group">
            <label>Character JSON File:</label>
            <input type="file" name="characterFile" accept=".json" required>
          </div>
          <div class="form-group">
            <label>
              <input type="checkbox" name="createItems" checked> 
              Import gear, weapons, and spells as items
            </label>
          </div>
          <div class="form-group">
            <label>
              <input type="checkbox" name="createContacts" checked> 
              Create contact actors
            </label>
          </div>
        </form>
      `,
      buttons: {
        import: {
          icon: '<i class="fas fa-upload"></i>',
          label: "Import Character",
          callback: (html) => this._processImport(html)
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel"
        }
      },
      default: "import"
    });

    dialog.render(true);
  }

  /**
   * Process the character import
   */
  static async _processImport(html) {
    const fileInput = html.find('input[name="characterFile"]')[0];
    const createItems = html.find('input[name="createItems"]').is(':checked');
    const createContacts = html.find('input[name="createContacts"]').is(':checked');

    if (!fileInput.files.length) {
      ui.notifications.error("Please select a character file to import.");
      return;
    }

    const file = fileInput.files[0];
    
    try {
      const text = await file.text();
      const characterData = JSON.parse(text);
      
      ui.notifications.info("Importing character...");
      
      const actor = await this._createCharacterActor(characterData, createItems, createContacts);
      
      ui.notifications.success(`Character "${actor.name}" imported successfully!`);
      
      // Open the character sheet
      actor.sheet.render(true);
      
    } catch (error) {
      console.error("Character import failed:", error);
      ui.notifications.error("Failed to import character. Check console for details.");
    }
  }

  /**
   * Create the character actor from JSON data
   */
  static async _createCharacterActor(data, createItems = true, createContacts = true) {
    // Determine character name
    const characterName = data.street_name || data.name || "Imported Character";
    
    // Map race to metatype
    const metatypeMap = {
      "Human": "human",
      "Elf": "elf", 
      "Dwarf": "dwarf",
      "Ork": "ork",
      "Troll": "troll"
    };
    
    // Calculate final attributes (base + racial bonuses)
    const finalAttributes = {};
    for (const [attr, value] of Object.entries(data.attributes)) {
      const attrLower = attr.toLowerCase();
      if (attrLower === 'initative') continue; // Skip typo in source data
      
      let finalValue = value;
      
      // Add racial bonuses
      if (data.raceBonuses && data.raceBonuses[attr]) {
        finalValue += data.raceBonuses[attr];
      }
      
      // Add magical bonuses
      if (data.magicalAttributeBonuses && data.magicalAttributeBonuses[attr]) {
        finalValue += data.magicalAttributeBonuses[attr];
      }
      
      // Add cyber bonuses
      if (data.cyberAttributeBonuses && data.cyberAttributeBonuses[attr]) {
        finalValue += data.cyberAttributeBonuses[attr];
      }
      
      finalAttributes[attrLower] = Math.max(1, finalValue);
    }

    // Determine magic status
    const isMagical = data.magical || false;
    const isPhysicalAdept = data.magicalChoice?.includes("Physical Adept") || false;
    
    // Create actor data
    const actorData = {
      name: characterName,
      type: "character",
      img: "icons/svg/mystery-man.svg",
      system: {
        attributes: {
          body: { value: finalAttributes.body || 1, min: 1, max: 6 },
          quickness: { value: finalAttributes.quickness || 1, min: 1, max: 6 },
          strength: { value: finalAttributes.strength || 1, min: 1, max: 6 },
          charisma: { value: finalAttributes.charisma || 1, min: 1, max: 6 },
          intelligence: { value: finalAttributes.intelligence || 1, min: 1, max: 6 },
          willpower: { value: finalAttributes.willpower || 1, min: 1, max: 6 },
          essence: { value: finalAttributes.essence || 6, min: 0, max: 6 },
          magic: { value: finalAttributes.magic || 0, min: 0, max: 6 },
          reaction: { value: finalAttributes.reaction || 1, min: 1, max: 12 }
        },
        pools: {
          combat: { current: 0, max: 0 },
          spell: { current: 0, max: 0 },
          karma: { current: data.karmaPool || 0, total: data.karma || 0 },
          hacking: { current: 0, max: 0 },
          control: { current: 0, max: 0 },
          task: { current: 0, max: 0 },
          astral: { current: 0, max: 0 }
        },
        initiative: {
          base: (finalAttributes.reaction || 1) + (finalAttributes.quickness || 1),
          dice: 1,
          current: 0
        },
        magic: {
          awakened: isMagical,
          physicalAdept: isPhysicalAdept,
          tradition: data.magicalTradition?.name || ""
        },
        resources: {
          nuyen: data.cash || 0,
          lifestyle: "street"
        },
        details: {
          metatype: metatypeMap[data.race] || "human",
          age: data.age?.toString() || "",
          height: "",
          weight: "",
          eyes: "",
          hair: "",
          skin: "",
          concept: ""
        },
        health: {
          physical: { value: 0, max: 10 },
          stun: { value: 0, max: 10 }
        },
        biography: this._generateBiography(data)
      }
    };

    // Create the actor
    const actor = await Actor.create(actorData);

    // Import items if requested
    if (createItems) {
      await this._importCharacterItems(actor, data);
    }

    // Create contacts if requested
    if (createContacts && data.contacts) {
      await this._createContactActors(data.contacts, actor.name);
    }

    return actor;
  }

  /**
   * Import character items (skills, gear, spells, etc.)
   */
  static async _importCharacterItems(actor, data) {
    const items = [];

    // Import skills
    if (data.skills) {
      for (const skill of data.skills) {
        const skillData = {
          name: skill.name,
          type: "skill",
          img: "systems/shadowrun2e/icons/skill.svg",
          system: {
            rating: skill.rating || 0,
            attribute: "body", // Default, should be mapped properly
            baseSkill: skill.name,
            concentration: "",
            specialization: "",
            category: skill.type?.toLowerCase() || "active",
            requiresConcentration: skill.requiresConcentration || false,
            description: `Concentrations: ${skill.Concentrations?.map(c => c.name).join(', ') || 'None'}`,
            quantity: 1,
            weight: 0,
            price: 0
          }
        };
        items.push(skillData);
      }
    }

    // Import gear
    if (data.gear) {
      for (const gear of data.gear) {
        const gearData = {
          name: gear.Name,
          type: "gear",
          img: "icons/svg/item-bag.svg",
          system: {
            description: `Type: ${gear.Type || 'Unknown'}\nConcealability: ${gear.Concealability || 'N/A'}`,
            quantity: gear.Amount || 1,
            weight: parseFloat(gear.Weight) || 0,
            price: parseInt(gear.Cost) || 0,
            rating: 0,
            equipped: false
          }
        };
        items.push(gearData);
      }
    }

    // Import weapons
    if (data.weapons) {
      for (const weapon of data.weapons) {
        const weaponData = {
          name: weapon.Name,
          type: "weapon",
          img: "icons/svg/sword.svg",
          system: {
            weaponType: weapon.Type?.toLowerCase().includes('ranged') ? 'ranged' : 'melee',
            concealability: parseInt(weapon.Concealability) || 0,
            damage: weapon.Damage || "1M",
            reach: parseInt(weapon.Reach) || 0,
            mode: weapon.Mode || "SS",
            ammo: {
              current: 0,
              max: parseInt(weapon.Ammo) || 0,
              type: weapon.AmmoType || ""
            },
            recoil: parseInt(weapon.Recoil) || 0,
            equipped: false,
            description: weapon.Notes || "",
            quantity: weapon.Amount || 1,
            weight: parseFloat(weapon.Weight) || 0,
            price: parseInt(weapon.Cost) || 0
          }
        };
        items.push(weaponData);
      }
    }

    // Import spells
    if (data.spells) {
      for (const spell of data.spells) {
        const spellData = {
          name: spell.Name?.trim(),
          type: "spell",
          img: "systems/shadowrun2e/icons/spell.svg",
          system: {
            category: spell.Class?.toLowerCase() || "combat",
            type: spell.Type?.toLowerCase() || "mana",
            range: "touch",
            damage: "M",
            duration: spell.Duration?.toLowerCase() || "instant",
            drain: spell.Drain || "2",
            force: spell.Rating || 1,
            class: spell.Class || "C",
            description: `Source: ${spell.BookPage || 'Unknown'}`,
            quantity: 1,
            weight: 0,
            price: 0
          }
        };
        items.push(spellData);
      }
    }

    // Import adept powers
    if (data.powers) {
      for (const power of data.powers) {
        const powerData = {
          name: power.Name,
          type: "adeptpower",
          img: "systems/shadowrun2e/icons/adeptpower.svg",
          system: {
            cost: parseFloat(power.Cost) || 0,
            hasLevels: power.HasLevels || false,
            currentLevel: power.Level || 1,
            maxLevel: 6,
            mods: power.Mods || "",
            notes: power.Notes || "",
            bookPage: power.BookPage || "",
            description: power.Description || "",
            quantity: 1,
            weight: 0,
            price: 0
          }
        };
        items.push(powerData);
      }
    }

    // Create all items at once
    if (items.length > 0) {
      await Item.createDocuments(items, { parent: actor });
      console.log(`SR2E | Imported ${items.length} items for ${actor.name}`);
    }
  }

  /**
   * Create contact actors
   */
  static async _createContactActors(contacts, characterName) {
    for (const contact of contacts) {
      const contactData = {
        name: contact.Name,
        type: "character", // Contacts are just NPCs
        img: "icons/svg/mystery-man.svg",
        system: {
          attributes: {
            body: { value: 3, min: 1, max: 6 },
            quickness: { value: 3, min: 1, max: 6 },
            strength: { value: 3, min: 1, max: 6 },
            charisma: { value: 4, min: 1, max: 6 },
            intelligence: { value: 4, min: 1, max: 6 },
            willpower: { value: 4, min: 1, max: 6 },
            essence: { value: 6, min: 0, max: 6 },
            magic: { value: 0, min: 0, max: 6 },
            reaction: { value: 3, min: 1, max: 12 }
          },
          pools: {
            combat: { current: 0, max: 0 },
            spell: { current: 0, max: 0 },
            karma: { current: 0, total: 0 },
            hacking: { current: 0, max: 0 },
            control: { current: 0, max: 0 },
            task: { current: 0, max: 0 },
            astral: { current: 0, max: 0 }
          },
          initiative: { base: 6, dice: 1, current: 0 },
          magic: { awakened: false, physicalAdept: false, tradition: "" },
          resources: { nuyen: 0, lifestyle: "street" },
          details: {
            metatype: "human",
            age: "",
            height: "",
            weight: "",
            eyes: "",
            hair: "",
            skin: "",
            concept: contact.Archtype || "Contact"
          },
          health: {
            physical: { value: 0, max: 10 },
            stun: { value: 0, max: 10 }
          },
          biography: `Contact for: ${characterName}\nArchetype: ${contact.Archtype || 'Unknown'}\nLevel: ${contact.Level || 1}\nGeneral Info: ${contact.GeneralInfo || 'No additional information'}`
        }
      };

      await Actor.create(contactData);
    }
    
    console.log(`SR2E | Created ${contacts.length} contact actors for ${characterName}`);
  }

  /**
   * Generate character biography from import data
   */
  static _generateBiography(data) {
    let bio = `Imported Character\n\n`;
    
    if (data.race) {
      bio += `Race: ${data.race}\n`;
    }
    
    if (data.age) {
      bio += `Age: ${data.age}\n`;
    }
    
    if (data.magicalChoice) {
      bio += `Magical Type: ${data.magicalChoice}\n`;
    }
    
    if (data.magicalTradition?.name) {
      bio += `Tradition: ${data.magicalTradition.name}\n`;
    }
    
    if (data.magicalTotem?.name) {
      bio += `Totem: ${data.magicalTotem.name}\n`;
    }
    
    if (data.priorities) {
      bio += `\nPriorities:\n`;
      for (const [key, value] of Object.entries(data.priorities)) {
        bio += `  ${key}: ${value}\n`;
      }
    }
    
    if (data.raceBonuses?.Notes) {
      bio += `\nRacial Notes: ${data.raceBonuses.Notes}\n`;
    }
    
    if (data.description) {
      bio += `\nDescription: ${data.description}\n`;
    }
    
    if (data.notes) {
      bio += `\nNotes: ${data.notes}\n`;
    }
    
    return bio;
  }
}