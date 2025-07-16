/**
 * Data Importer for Shadowrun 2E
 * Loads items from JSON files into Foundry compendiums
 */
export class SR2DataImporter {

  /**
   * Import all data from JSON files into compendiums
   */
  static async importAllData() {
    console.log("SR2E | Starting data import...");

    try {
      await this.importCyberware();
      await this.importBioware();
      await this.importSpells();
      await this.importAdeptPowers();
      await this.importSkills();
      await this.importCyberdecks();
      await this.importVehicles();
      await this.importDrones();

      console.log("SR2E | Data import completed successfully");
      ui.notifications.info("Shadowrun 2E data imported successfully!");
    } catch (error) {
      console.error("SR2E | Data import failed:", error);
      ui.notifications.error("Failed to import Shadowrun 2E data");
    }
  }

  /**
   * Import cyberware from JSON
   */
  static async importCyberware() {
    const pack = game.packs.get("shadowrun2e.cyberware");
    if (!pack) {
      console.warn("SR2E | Cyberware compendium not found");
      return;
    }

    console.log("SR2E | Importing cyberware...");

    try {
      // Unlock the compendium for editing
      if (pack.locked) {
        await pack.configure({ locked: false });
      }

      const response = await fetch('/systems/shadowrun2e/data/cyberware.json');
      const data = await response.json();

      const items = [];

      for (const [category, categoryItems] of Object.entries(data)) {
        for (const item of categoryItems) {
          const itemData = {
            name: item.Name.trim(),
            type: "cyberware",
            img: "systems/shadowrun2e/icons/cyberware.svg",
            system: {
              description: `Category: ${category}\nSource: ${item.BookPage}`,
              essence: item.EssCost,
              cost: item.Cost,
              streetIndex: item.StreetIndex,
              mods: item.Mods || "",
              installed: false,
              rating: 0,
              bodyLocation: category.toLowerCase(),
              quantity: 1,
              weight: 0,
              price: item.Cost
            }
          };
          items.push(itemData);
        }
      }

      await Item.createDocuments(items, { pack: pack.collection });
      console.log(`SR2E | Imported ${items.length} cyberware items`);

      // Lock the compendium again after import
      await pack.configure({ locked: true });

    } catch (error) {
      console.error("SR2E | Failed to import cyberware:", error);
    }
  }

  /**
   * Import bioware from JSON
   */
  static async importBioware() {
    const pack = game.packs.get("shadowrun2e.bioware");
    if (!pack) {
      console.warn("SR2E | Bioware compendium not found");
      return;
    }

    console.log("SR2E | Importing bioware...");

    try {
      // Unlock the compendium for editing
      if (pack.locked) {
        await pack.configure({ locked: false });
      }

      const response = await fetch('/systems/shadowrun2e/data/bioware.json');
      const data = await response.json();

      const items = [];

      for (const [category, categoryItems] of Object.entries(data)) {
        for (const item of categoryItems) {
          const itemData = {
            name: item.Name.trim(),
            type: "bioware",
            img: "systems/shadowrun2e/icons/bioware.svg",
            system: {
              description: `Category: ${category}\nSource: ${item.BookPage}`,
              bioIndex: parseFloat(item.BioIndex),
              cost: item.Cost,
              streetIndex: item.StreetIndex,
              mods: item.Mods || "",
              installed: false,
              rating: 0,
              bodyLocation: category.toLowerCase(),
              quantity: 1,
              weight: 0,
              price: item.Cost
            }
          };
          items.push(itemData);
        }
      }

      await Item.createDocuments(items, { pack: pack.collection });
      console.log(`SR2E | Imported ${items.length} bioware items`);

      // Lock the compendium again after import
      await pack.configure({ locked: true });

    } catch (error) {
      console.error("SR2E | Failed to import bioware:", error);
    }
  }

  /**
   * Import spells from JSON
   */
  static async importSpells() {
    const pack = game.packs.get("shadowrun2e.spells");
    if (!pack) {
      console.warn("SR2E | Spells compendium not found");
      return;
    }

    console.log("SR2E | Importing spells...");

    try {
      // Unlock the compendium for editing
      if (pack.locked) {
        await pack.configure({ locked: false });
      }

      const response = await fetch('/systems/shadowrun2e/data/spells.json');
      const data = await response.json();

      const items = [];

      for (const spell of data) {
        const itemData = {
          name: spell.Name.trim(),
          type: "spell",
          img: "systems/shadowrun2e/icons/spell.svg",
          system: {
            description: `Source: ${spell.BookPage}`,
            drain: spell.Drain,
            type: spell.Type,
            duration: spell.Duration,
            class: spell.Class,
            force: 1,
            category: spell.Class.toLowerCase(),
            range: "touch",
            damage: "M",
            quantity: 1,
            weight: 0,
            price: 0
          }
        };
        items.push(itemData);
      }

      await Item.createDocuments(items, { pack: pack.collection });
      console.log(`SR2E | Imported ${items.length} spells`);

      // Lock the compendium again after import
      await pack.configure({ locked: true });

    } catch (error) {
      console.error("SR2E | Failed to import spells:", error);
    }
  }

  /**
   * Import adept powers from JSON
   */
  static async importAdeptPowers() {
    const pack = game.packs.get("shadowrun2e.adeptpowers");
    if (!pack) {
      console.warn("SR2E | Adept Powers compendium not found");
      return;
    }

    console.log("SR2E | Importing adept powers...");

    try {
      // Unlock the compendium for editing
      if (pack.locked) {
        await pack.configure({ locked: false });
      }

      const response = await fetch('/systems/shadowrun2e/data/AdeptPowers.json');
      const data = await response.json();

      const items = [];

      for (const power of data) {
        const itemData = {
          name: power.Name.trim(),
          type: "adeptpower",
          img: "systems/shadowrun2e/icons/adeptpower.svg",
          system: {
            description: `Source: ${power.BookPage}\n${power.Notes}`,
            cost: power.Cost,
            hasLevels: power.HasLevels,
            currentLevel: 1,
            maxLevel: 6,
            mods: power.Mods || "",
            notes: power.Notes || "",
            bookPage: power.BookPage,
            quantity: 1,
            weight: 0,
            price: 0
          }
        };
        items.push(itemData);
      }

      await Item.createDocuments(items, { pack: pack.collection });
      console.log(`SR2E | Imported ${items.length} adept powers`);

      // Lock the compendium again after import
      await pack.configure({ locked: true });

    } catch (error) {
      console.error("SR2E | Failed to import adept powers:", error);
    }
  }

  /**
   * Import base skills as reference items
   */
  static async importSkills() {
    const pack = game.packs.get("shadowrun2e.skills");
    if (!pack) {
      console.warn("SR2E | Skills compendium not found");
      return;
    }

    console.log("SR2E | Importing skills...");

    try {
      // Unlock the compendium for editing
      if (pack.locked) {
        await pack.configure({ locked: false });
      }

      const response = await fetch('/systems/shadowrun2e/data/skills.json');
      const data = await response.json();

      const items = [];

      for (const [skillName, skillData] of Object.entries(data)) {
        // Create base skill
        const itemData = {
          name: skillData.name,
          type: "skill",
          img: "systems/shadowrun2e/icons/skill.svg",
          system: {
            description: `Base Skill: ${skillData.name}\nConcentrations: ${skillData.Concentrations.map(c => c.name).join(', ')}`,
            baseSkill: skillData.name,
            concentration: "",
            specialization: "",
            rating: 0,
            attribute: "body",
            category: "active",
            requiresConcentration: skillData.requiresConcentration || false,
            quantity: 1,
            weight: 0,
            price: 0
          }
        };
        items.push(itemData);

        // Create concentration variants if they exist
        if (skillData.Concentrations && skillData.Concentrations.length > 0) {
          for (const concentration of skillData.Concentrations) {
            const concItemData = {
              name: `${skillData.name} (${concentration.name})`,
              type: "skill",
              img: "systems/shadowrun2e/icons/skill.svg",
              system: {
                description: `${skillData.name} → ${concentration.name}\nSpecializations: ${concentration.Specializations.join(', ')}`,
                baseSkill: skillData.name,
                concentration: concentration.name,
                specialization: "",
                rating: 0,
                attribute: "body",
                category: "active",
                requiresConcentration: skillData.requiresConcentration || false,
                quantity: 1,
                weight: 0,
                price: 0
              }
            };
            items.push(concItemData);
          }
        }
      }

      await Item.createDocuments(items, { pack: pack.collection });
      console.log(`SR2E | Imported ${items.length} skill items`);

      // Lock the compendium again after import
      await pack.configure({ locked: true });

    } catch (error) {
      console.error("SR2E | Failed to import skills:", error);
    }
  }

  /**
   * Import cyberdecks from JSON as actors
   */
  static async importCyberdecks() {
    const pack = game.packs.get("shadowrun2e.cyberdecks");
    if (!pack) {
      console.warn("SR2E | Cyberdecks compendium not found");
      return;
    }

    console.log("SR2E | Importing cyberdecks...");

    try {
      // Unlock the compendium for editing
      if (pack.locked) {
        await pack.configure({ locked: false });
      }

      const response = await fetch('/systems/shadowrun2e/data/cyberdeck.json');
      const data = await response.json();

      const actors = [];

      for (const deck of data) {
        const actorData = {
          name: deck.Name.trim(),
          type: "cyberdeck",
          img: "systems/shadowrun2e/icons/cyberware.svg", // Use cyberware icon for now
          system: {
            model: deck.Name.trim(),
            persona: deck.Persona,
            hardening: deck.Hardening,
            memory: {
              total: deck.Memory,
              used: 0
            },
            storage: {
              total: deck.Storage,
              used: 0
            },
            load: deck.Load,
            ioSpeed: deck["I/O Speed"],
            responseIncrease: deck["Response Increase"],
            damage: {
              icon: {
                value: 0,
                max: 10
              }
            },
            cost: deck.Cost,
            streetIndex: parseFloat(deck["Street Index"]),
            availability: deck.Availability,
            bookPage: deck.BookPage,
            biography: `Model: ${deck.Name}\nPersona: ${deck.Persona}\nHardening: ${deck.Hardening}\nMemory: ${deck.Memory} MP\nStorage: ${deck.Storage} MP\nLoad: ${deck.Load}\nI/O Speed: ${deck["I/O Speed"]}\nResponse Increase: ${deck["Response Increase"]}\nCost: ¥${deck.Cost}\nAvailability: ${deck.Availability}\nSource: ${deck.BookPage}`
          }
        };
        actors.push(actorData);
      }

      await Actor.createDocuments(actors, { pack: pack.collection });
      console.log(`SR2E | Imported ${actors.length} cyberdeck actors`);

      // Lock the compendium again after import
      await pack.configure({ locked: true });

    } catch (error) {
      console.error("SR2E | Failed to import cyberdecks:", error);
    }
  }

  /**
   * Import vehicles from JSON as actors
   */
  static async importVehicles() {
    const pack = game.packs.get("shadowrun2e.vehicles");
    if (!pack) {
      console.warn("SR2E | Vehicles compendium not found");
      return;
    }

    console.log("SR2E | Importing vehicles...");

    try {
      // Unlock the compendium for editing
      if (pack.locked) {
        await pack.configure({ locked: false });
      }

      const response = await fetch('/systems/shadowrun2e/data/vehicles.json');
      const data = await response.json();

      const actors = [];

      for (const vehicle of data) {
        // Parse handling (format: "3/4" or "3")
        let handlingOn = 0, handlingOff = 0;
        if (vehicle.Handling) {
          const handlingParts = vehicle.Handling.toString().split('/');
          handlingOn = parseInt(handlingParts[0]) || 0;
          handlingOff = parseInt(handlingParts[1]) || handlingOn;
        }

        // Parse speed/accel (format: "120/8")
        let speed = 0, accel = 0;
        if (vehicle["Speed/Accel"]) {
          const speedParts = vehicle["Speed/Accel"].toString().split('/');
          speed = parseInt(speedParts[0]) || 0;
          accel = parseInt(speedParts[1]) || 0;
        }

        // Parse body/armor (format: "3/2")
        let body = 0, armor = 0;
        if (vehicle["Body/Armor"]) {
          const bodyParts = vehicle["Body/Armor"].toString().split('/');
          body = parseInt(bodyParts[0]) || 0;
          armor = parseInt(bodyParts[1]) || 0;
        }

        // Parse sig/autonav (format: "2/3" or "2/-")
        let sig = 0, autonav = 0;
        if (vehicle["Sig/Autonav"]) {
          const sigParts = vehicle["Sig/Autonav"].toString().split('/');
          sig = parseInt(sigParts[0]) || 0;
          autonav = sigParts[1] === '-' ? 0 : parseInt(sigParts[1]) || 0;
        }

        // Parse pilot/sensor (format: "2/1" or "-/1")
        let pilot = 0, sensor = 0;
        if (vehicle["Pilot/Sensor"]) {
          const pilotParts = vehicle["Pilot/Sensor"].toString().split('/');
          pilot = pilotParts[0] === '-' ? 0 : parseInt(pilotParts[0]) || 0;
          sensor = parseInt(pilotParts[1]) || 0;
        }

        // Parse cargo/load (format: "12/110")
        let cargo = 0, load = 0;
        if (vehicle["Cargo/Load"]) {
          const cargoParts = vehicle["Cargo/Load"].toString().split('/');
          cargo = parseInt(cargoParts[0]) || 0;
          load = parseInt(cargoParts[1]) || 0;
        }

        // Determine vehicle type based on name and characteristics
        let vehicleType = "ground";
        const name = vehicle.name.toLowerCase();
        if (name.includes('aircraft') || name.includes('helicopter') || name.includes('plane') || name.includes('vtol')) {
          vehicleType = "air";
        } else if (name.includes('boat') || name.includes('ship') || name.includes('marine') || name.includes('hydrofoil')) {
          vehicleType = "water";
        }

        const actorData = {
          name: vehicle.name.trim(),
          type: "vehicle",
          img: "icons/svg/item-bag.svg", // Default vehicle icon
          system: {
            model: vehicle.name.trim(),
            vehicleType: vehicleType,
            handling: {
              on: handlingOn,
              off: handlingOff
            },
            speed: speed,
            accel: accel,
            body: body,
            armor: armor,
            sig: sig,
            autonav: autonav,
            pilot: pilot,
            sensor: sensor,
            cargo: cargo,
            load: load,
            seating: vehicle.Seating || "",
            cost: parseInt(vehicle["$Cost"]?.toString().replace(/[^\d]/g, '')) || 0,
            availability: vehicle.Availability || "",
            streetIndex: parseFloat(vehicle["Street Index"]) || 1.0,
            notes: vehicle.Notes || "",
            bookPage: vehicle["Book.Page"] || "",
            health: {
              value: 0,
              max: 10
            },
            biography: `Model: ${vehicle.name}\nHandling: ${vehicle.Handling}\nSpeed/Accel: ${vehicle["Speed/Accel"]}\nBody/Armor: ${vehicle["Body/Armor"]}\nSig/Autonav: ${vehicle["Sig/Autonav"]}\nPilot/Sensor: ${vehicle["Pilot/Sensor"]}\nCargo/Load: ${vehicle["Cargo/Load"]}\nSeating: ${vehicle.Seating}\nCost: ${vehicle["$Cost"]}\nAvailability: ${vehicle.Availability}\nStreet Index: ${vehicle["Street Index"]}\nNotes: ${vehicle.Notes}\nSource: ${vehicle["Book.Page"]}`
          }
        };
        actors.push(actorData);
      }

      await Actor.createDocuments(actors, { pack: pack.collection });
      console.log(`SR2E | Imported ${actors.length} vehicle actors`);

      // Lock the compendium again after import
      await pack.configure({ locked: true });

    } catch (error) {
      console.error("SR2E | Failed to import vehicles:", error);
    }
  }

  /**
   * Import drones from JSON as actors
   */
  static async importDrones() {
    const pack = game.packs.get("shadowrun2e.drones");
    if (!pack) {
      console.warn("SR2E | Drones compendium not found");
      return;
    }

    console.log("SR2E | Importing drones...");

    try {
      // Unlock the compendium for editing
      if (pack.locked) {
        await pack.configure({ locked: false });
      }

      const response = await fetch('/systems/shadowrun2e/data/drones.json');
      const data = await response.json();

      const actors = [];

      for (const drone of data) {
        // Parse handling (format: "3/4" or "3")
        let handlingOn = 0, handlingOff = 0;
        if (drone.Handling) {
          const handlingParts = drone.Handling.toString().split('/');
          handlingOn = parseInt(handlingParts[0]) || 0;
          handlingOff = parseInt(handlingParts[1]) || handlingOn;
        }

        // Parse speed/accel (format: "120/8")
        let speed = 0, accel = 0;
        if (drone["Speed/Accel"]) {
          const speedParts = drone["Speed/Accel"].toString().split('/');
          speed = parseInt(speedParts[0]) || 0;
          accel = parseInt(speedParts[1]) || 0;
        }

        // Parse body/armor (format: "3/2")
        let body = 0, armor = 0;
        if (drone["Body/Armor"]) {
          const bodyParts = drone["Body/Armor"].toString().split('/');
          body = parseInt(bodyParts[0]) || 0;
          armor = parseInt(bodyParts[1]) || 0;
        }

        // Parse sig/autonav (format: "2/3" or "2/-")
        let sig = 0, autonav = 0;
        if (drone["Sig/Autonav"]) {
          const sigParts = drone["Sig/Autonav"].toString().split('/');
          sig = parseInt(sigParts[0]) || 0;
          autonav = sigParts[1] === '-' ? 0 : parseInt(sigParts[1]) || 0;
        }

        // Parse pilot/sensor (format: "2/1" or "-/1")
        let pilot = 0, sensor = 0;
        if (drone["Pilot/Sensor"]) {
          const pilotParts = drone["Pilot/Sensor"].toString().split('/');
          pilot = pilotParts[0] === '-' ? 0 : parseInt(pilotParts[0]) || 0;
          sensor = parseInt(pilotParts[1]) || 0;
        }

        // Parse cargo/load (format: "12/110")
        let cargo = 0, load = 0;
        if (drone["Cargo/Load"]) {
          const cargoParts = drone["Cargo/Load"].toString().split('/');
          cargo = parseInt(cargoParts[0]) || 0;
          load = parseInt(cargoParts[1]) || 0;
        }

        const actorData = {
          name: drone.name.trim(),
          type: "vehicle",
          img: "icons/svg/item-bag.svg", // Default drone icon
          system: {
            model: drone.name.trim(),
            vehicleType: "drone",
            handling: {
              on: handlingOn,
              off: handlingOff
            },
            speed: speed,
            accel: accel,
            body: body,
            armor: armor,
            sig: sig,
            autonav: autonav,
            pilot: pilot,
            sensor: sensor,
            cargo: cargo,
            load: load,
            seating: drone.Seating || "-",
            cost: parseInt(drone["$Cost"]?.toString().replace(/[^\d]/g, '')) || 0,
            availability: drone.Availability || "",
            streetIndex: parseFloat(drone["Street Index"]) || 1.0,
            notes: drone.Notes || "",
            bookPage: drone["Book.Page"] || "",
            health: {
              value: 0,
              max: 10
            },
            biography: `Model: ${drone.name}\nHandling: ${drone.Handling}\nSpeed/Accel: ${drone["Speed/Accel"]}\nBody/Armor: ${drone["Body/Armor"]}\nSig/Autonav: ${drone["Sig/Autonav"]}\nPilot/Sensor: ${drone["Pilot/Sensor"]}\nCargo/Load: ${drone["Cargo/Load"]}\nSeating: ${drone.Seating}\nCost: ${drone["$Cost"]}\nAvailability: ${drone.Availability}\nStreet Index: ${drone["Street Index"]}\nNotes: ${drone.Notes}\nSource: ${drone["Book.Page"]}`
          }
        };
        actors.push(actorData);
      }

      await Actor.createDocuments(actors, { pack: pack.collection });
      console.log(`SR2E | Imported ${actors.length} drone actors`);

      // Lock the compendium again after import
      await pack.configure({ locked: true });

    } catch (error) {
      console.error("SR2E | Failed to import drones:", error);
    }
  }
}