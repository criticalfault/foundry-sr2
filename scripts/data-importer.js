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
    if (!pack) return;

    console.log("SR2E | Importing cyberware...");
    
    try {
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
      
    } catch (error) {
      console.error("SR2E | Failed to import cyberware:", error);
    }
  }

  /**
   * Import bioware from JSON
   */
  static async importBioware() {
    const pack = game.packs.get("shadowrun2e.bioware");
    if (!pack) return;

    console.log("SR2E | Importing bioware...");
    
    try {
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
      
    } catch (error) {
      console.error("SR2E | Failed to import bioware:", error);
    }
  }

  /**
   * Import spells from JSON
   */
  static async importSpells() {
    const pack = game.packs.get("shadowrun2e.spells");
    if (!pack) return;

    console.log("SR2E | Importing spells...");
    
    try {
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
      
    } catch (error) {
      console.error("SR2E | Failed to import spells:", error);
    }
  }

  /**
   * Import adept powers from JSON
   */
  static async importAdeptPowers() {
    const pack = game.packs.get("shadowrun2e.adeptpowers");
    if (!pack) return;

    console.log("SR2E | Importing adept powers...");
    
    try {
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
      
    } catch (error) {
      console.error("SR2E | Failed to import adept powers:", error);
    }
  }

  /**
   * Import base skills as reference items
   */
  static async importSkills() {
    const pack = game.packs.get("shadowrun2e.skills");
    if (!pack) return;

    console.log("SR2E | Importing skills...");
    
    try {
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
      
    } catch (error) {
      console.error("SR2E | Failed to import skills:", error);
    }
  }
}