/**
 * Item Browser for Shadowrun 2E
 * Allows browsing and adding items from JSON data files
 */
export class SR2ItemBrowser extends Application {
  
  constructor(actor, itemType, options = {}) {
    super(options);
    this.actor = actor;
    this.itemType = itemType;
    this.items = [];
    this.filteredItems = [];
    this.searchTerm = "";
    this.selectedCategory = "";
  }

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "sr2-item-browser",
      title: "Item Browser",
      template: "systems/shadowrun2e/templates/apps/item-browser.html",
      width: 800,
      height: 600,
      resizable: true,
      classes: ["shadowrun2e", "item-browser"]
    });
  }

  /** @override */
  get title() {
    const typeNames = {
      cyberware: "Cyberware Browser",
      bioware: "Bioware Browser", 
      spell: "Spell Browser",
      adeptpower: "Adept Power Browser",
      totem: "Totem Browser",
      weapon: "Weapon Browser",
      armor: "Armor Browser",
      gear: "Equipment Browser"
    };
    return typeNames[this.itemType] || "Item Browser";
  }

  /** @override */
  async getData() {
    const data = super.getData();
    
    // Load items if not already loaded
    if (this.items.length === 0) {
      await this._loadItems();
    }
    
    // Filter items based on search and category
    this._filterItems();
    
    return {
      ...data,
      itemType: this.itemType,
      items: this.filteredItems,
      searchTerm: this.searchTerm,
      selectedCategory: this.selectedCategory,
      categories: this._getCategories(),
      hasItems: this.filteredItems.length > 0
    };
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Search functionality
    html.find('.item-search').on('input', this._onSearch.bind(this));
    
    // Category filter
    html.find('.category-filter').change(this._onCategoryFilter.bind(this));
    
    // Add item to character
    html.find('.add-item').click(this._onAddItem.bind(this));
    
    // Clear search
    html.find('.clear-search').click(this._onClearSearch.bind(this));
  }

  /**
   * Load items from JSON data files
   */
  async _loadItems() {
    try {
      let response;
      let data;
      
      switch (this.itemType) {
        case 'cyberware':
          response = await fetch('systems/shadowrun2e/data/cyberware.json');
          data = await response.json();
          this.items = this._processCyberwareData(data);
          break;
          
        case 'bioware':
          response = await fetch('systems/shadowrun2e/data/bioware.json');
          data = await response.json();
          this.items = this._processBiowareData(data);
          break;
          
        case 'spell':
          response = await fetch('systems/shadowrun2e/data/spells.json');
          data = await response.json();
          this.items = this._processSpellData(data);
          break;
          
        case 'adeptpower':
          response = await fetch('systems/shadowrun2e/data/AdeptPowers.json');
          data = await response.json();
          this.items = this._processAdeptPowerData(data);
          break;
          
        case 'totem':
          response = await fetch('systems/shadowrun2e/data/totems.json');
          data = await response.json();
          this.items = this._processTotemData(data);
          break;
          
        case 'weapon':
          response = await fetch('systems/shadowrun2e/data/gear.json');
          data = await response.json();
          this.items = this._processWeaponData(data);
          break;
          
        case 'armor':
          response = await fetch('systems/shadowrun2e/data/gear.json');
          data = await response.json();
          this.items = this._processArmorData(data);
          break;
          
        case 'gear':
          response = await fetch('systems/shadowrun2e/data/gear.json');
          data = await response.json();
          this.items = this._processGearData(data);
          break;
      }
    } catch (error) {
      console.error(`Failed to load ${this.itemType} data:`, error);
      ui.notifications.error(`Failed to load ${this.itemType} data`);
    }
  }

  /**
   * Process cyberware data from JSON
   */
  _processCyberwareData(data) {
    const items = [];
    
    for (const [category, categoryItems] of Object.entries(data)) {
      for (const item of categoryItems) {
        items.push({
          name: item.Name,
          category: category,
          essence: item.EssCost,
          cost: item.Cost,
          streetIndex: item.StreetIndex,
          mods: item.Mods || "",
          bookPage: item.BookPage,
          type: 'cyberware'
        });
      }
    }
    
    return items;
  }

  /**
   * Process bioware data from JSON
   */
  _processBiowareData(data) {
    const items = [];
    
    for (const [category, categoryItems] of Object.entries(data)) {
      for (const item of categoryItems) {
        items.push({
          name: item.Name,
          category: category,
          bioIndex: parseFloat(item.BioIndex),
          cost: item.Cost,
          streetIndex: item.StreetIndex,
          mods: item.Mods || "",
          bookPage: item.BookPage,
          type: 'bioware'
        });
      }
    }
    
    return items;
  }

  /**
   * Process spell data from JSON
   */
  _processSpellData(data) {
    const items = [];
    
    for (const spell of data) {
      items.push({
        name: spell.Name.trim(),
        category: spell.Class,
        drain: spell.Drain,
        type: spell.Type,
        duration: spell.Duration,
        bookPage: spell.BookPage,
        type: 'spell'
      });
    }
    
    return items;
  }

  /**
   * Process adept power data from JSON
   */
  _processAdeptPowerData(data) {
    const items = [];
    
    for (const power of data) {
      items.push({
        name: power.Name.trim(),
        category: "Adept Powers",
        cost: power.Cost,
        hasLevels: power.HasLevels,
        mods: power.Mods || "",
        notes: power.Notes || "",
        bookPage: power.BookPage,
        type: 'adeptpower'
      });
    }
    
    return items;
  }

  /**
   * Process totem data from JSON
   */
  _processTotemData(data) {
    const items = [];
    
    // Process all totems from the TOTEMS array
    if (data.TOTEMS && Array.isArray(data.TOTEMS)) {
      for (const totem of data.TOTEMS) {
        items.push({
          name: totem.name,
          category: this._getTotemCategory(totem),
          environment: totem.environment,
          advantages: totem.advantages,
          disadvantages: totem.disadvantages,
          bookPage: "SR2E Core",
          type: 'totem'
        });
      }
    }
    
    return items;
  }

  /**
   * Determine totem category based on name and environment
   */
  _getTotemCategory(totem) {
    const name = totem.name.toLowerCase();
    const env = totem.environment.toLowerCase();
    
    // Elemental totems
    if (['moon', 'mountain', 'oak', 'sea', 'stream', 'sun', 'wind'].includes(name)) {
      return "Elemental Totems";
    }
    
    // Urban totems
    if (env.includes('urban') || ['cat', 'dog', 'rat', 'gator'].includes(name)) {
      return "Urban Totems";
    }
    
    // Voodoo totems
    if (['azaca', 'damballah', 'erzulie', 'ghede', 'legba', 'obatala', 'ogoun', 'shango'].includes(name)) {
      return "Voodoo Totems";
    }
    
    // Default to Animal Totems
    return "Animal Totems";
  }

  /**
   * Get available categories for filtering
   */
  _getCategories() {
    const categories = [...new Set(this.items.map(item => item.category))];
    return categories.sort();
  }

  /**
   * Filter items based on search term and category
   */
  _filterItems() {
    this.filteredItems = this.items.filter(item => {
      // Category filter
      if (this.selectedCategory && item.category !== this.selectedCategory) {
        return false;
      }
      
      // Search filter
      if (this.searchTerm) {
        const searchLower = this.searchTerm.toLowerCase();
        return item.name.toLowerCase().includes(searchLower) ||
               (item.mods && item.mods.toLowerCase().includes(searchLower));
      }
      
      return true;
    });
  }

  /**
   * Handle search input
   */
  _onSearch(event) {
    this.searchTerm = event.target.value;
    this.render();
  }

  /**
   * Handle category filter change
   */
  _onCategoryFilter(event) {
    this.selectedCategory = event.target.value;
    this.render();
  }

  /**
   * Handle adding item to character
   */
  async _onAddItem(event) {
    event.preventDefault();
    const itemIndex = parseInt(event.currentTarget.dataset.itemIndex);
    const itemData = this.filteredItems[itemIndex];
    
    if (!itemData) return;

    await this.addItem(itemData);
  }

  /**
   * Add item to character (can be overridden for custom behavior)
   */
  async addItem(itemData) {
    // Create the item data for Foundry
    const newItemData = {
      name: itemData.name,
      type: this.itemType,
      system: this._createSystemData(itemData)
    };

    try {
      const createdItems = await this.actor.createEmbeddedDocuments("Item", [newItemData]);
      ui.notifications.info(`Added ${itemData.name} to ${this.actor.name}`);
      return createdItems[0];
    } catch (error) {
      console.error("Failed to add item:", error);
      ui.notifications.error("Failed to add item to character");
      return null;
    }
  }

  /**
   * Create system data based on item type
   */
  _createSystemData(itemData) {
    const baseData = {
      description: `Source: ${itemData.bookPage}`,
      price: itemData.cost || 0
    };

    switch (this.itemType) {
      case 'cyberware':
        return {
          ...baseData,
          essence: itemData.essence,
          streetIndex: itemData.streetIndex,
          mods: itemData.mods,
          installed: false,
          rating: 0
        };
        
      case 'bioware':
        return {
          ...baseData,
          bioIndex: itemData.bioIndex,
          streetIndex: itemData.streetIndex,
          mods: itemData.mods,
          installed: false,
          rating: 0
        };
        
      case 'spell':
        return {
          ...baseData,
          drain: itemData.drain,
          type: itemData.type,
          duration: itemData.duration,
          class: itemData.category,
          force: 1
        };
        
      case 'adeptpower':
        return {
          ...baseData,
          cost: itemData.cost,
          hasLevels: itemData.hasLevels,
          currentLevel: 1,
          maxLevel: 6,
          mods: itemData.mods,
          notes: itemData.notes
        };
        
      case 'totem':
        return {
          ...baseData,
          environment: itemData.environment,
          advantages: itemData.advantages,
          disadvantages: itemData.disadvantages,
          isSelected: false,
          quantity: 1,
          weight: 0
        };
        
      case 'armor':
        return {
          ...baseData,
          rating: parseInt(itemData.ballistic) || parseInt(itemData.impact) || 0,
          concealability: parseInt(itemData.concealability) || 0,
          ballistic: parseInt(itemData.ballistic) || 0,
          impact: parseInt(itemData.impact) || 0,
          equipped: false,
          quantity: 1,
          weight: parseFloat(itemData.weight) || 0,
          availability: itemData.availability || "",
          streetIndex: parseFloat(itemData.streetIndex) || 1.0
        };
        
      case 'weapon':
        return {
          ...baseData,
          weaponType: this._determineWeaponType(itemData.category),
          concealability: parseInt(itemData.concealability) || 0,
          damage: itemData.damage || "1L",
          reach: parseInt(itemData.reach) || 0,
          mode: itemData.mode || "SS",
          ammo: {
            current: 0,
            max: parseInt(itemData.ammo) || 0,
            type: ""
          },
          recoil: parseInt(itemData.recoil) || 0,
          rangeType: this._determineRangeType(itemData.name, itemData.category),
          equipped: false,
          quantity: 1,
          weight: parseFloat(itemData.weight) || 0,
          availability: itemData.availability || "",
          streetIndex: parseFloat(itemData.streetIndex) || 1.0
        };
        
      case 'gear':
        return {
          ...baseData,
          rating: parseInt(itemData.rating) || 0,
          equipped: false,
          quantity: 1,
          weight: parseFloat(itemData.weight) || 0,
          availability: itemData.availability || "",
          streetIndex: parseFloat(itemData.streetIndex) || 1.0
        };
    }
    
    return baseData;
  }

  /**
   * Clear search
   */
  _onClearSearch(event) {
    event.preventDefault();
    this.searchTerm = "";
    this.selectedCategory = "";
    this.render();
  }

  /**
   * Determine weapon type based on category
   */
  _determineWeaponType(categoryName) {
    const rangedCategories = ['Firearms', 'Bow and crossbow', 'Rockets and Missiles'];
    return rangedCategories.includes(categoryName) ? 'ranged' : 'melee';
  }

  /**
   * Determine range type based on weapon name and category
   */
  _determineRangeType(weaponName, categoryName) {
    const name = weaponName.toLowerCase();

    // Pistol categories
    if (name.includes('hold-out') && name.includes('light')) return '(LHOP)';
    if (name.includes('hold-out')) return '(HOPist)';
    if (name.includes('light pistol')) return '(LPist)';
    if (name.includes('machine pistol')) return '(MaPist)';
    if (name.includes('heavy pistol')) return '(HPist)';
    if (name.includes('very heavy pistol')) return '(VHP)';
    if (name.includes('medium pistol') || name.includes('pistol')) return '(MPist)';

    // Long guns
    if (name.includes('assault rifle')) return '(AsRf)';
    if (name.includes('sniper rifle')) return '(SptR)';
    if (name.includes('heavy sniper')) return '(HSR)';
    if (name.includes('sniper')) return '(Snip)';
    if (name.includes('light carbine')) return 'LCarb';
    if (name.includes('carbine')) return '(Carb)';
    if (name.includes('shotgun')) return '(ShtG)';
    if (name.includes('submachine') || name.includes('smg')) return '(SMG)';

    // Machine guns
    if (name.includes('heavy machine gun') || name.includes('hmg')) return '(HMG)';
    if (name.includes('medium machine gun') || name.includes('mmg')) return '(MMG)';
    if (name.includes('light machine gun') || name.includes('lmg')) return '(LMG)';
    if (name.includes('minigun')) return '(MinG)';

    // Heavy weapons
    if (name.includes('assault cannon')) return '(ACan)';
    if (name.includes('grenade launcher')) return '(GrLn)';
    if (name.includes('missile launcher')) return '(MisLn)';
    if (name.includes('mortar')) return '(Mrtr)';
    if (name.includes('flamethrower')) return '(FlThr)';

    // Bows and crossbows
    if (name.includes('heavy crossbow')) return '(HCB)';
    if (name.includes('medium crossbow')) return '(MCB)';
    if (name.includes('light crossbow')) return '(LCB)';
    if (name.includes('crossbow')) return '(MCB)';
    if (name.includes('bow')) return '(Bow)';

    // Thrown weapons
    if (name.includes('shuriken')) return '(SH)';
    if (name.includes('throwing knife') || name.includes('thrown knife')) return '(TK)';
    if (name.includes('net')) return '(Net)';

    // Special weapons
    if (name.includes('taser')) return '(Tasr)';
    if (name.includes('spear gun')) return '(SpGn)';
    if (name.includes('blowgun')) return '(BG)';
    if (name.includes('slingshot')) return '(SS)';
    if (name.includes('sling')) return '(SL)';

    // Default based on category
    if (categoryName === 'Firearms') return '(MPist)'; // Default to medium pistol
    if (categoryName === 'Bow and crossbow') return '(Bow)';
    if (categoryName === 'Rockets and Missiles') return '(MisLn)';

    return '(MPist)'; // Default fallback
  }

  /**
   * Process weapon data from gear.json
   */
  _processWeaponData(data) {
    const items = [];
    const weaponCategories = ['Edged weapon', 'Bow and crossbow', 'Firearms', 'Rockets and Missiles', 'Grenades', 'VehicleFire'];
    
    for (const categoryName of weaponCategories) {
      if (data[categoryName] && data[categoryName].entries) {
        for (const item of data[categoryName].entries) {
          items.push({
            name: item.Name,
            category: categoryName,
            concealability: item.Concealability || "",
            damage: item.Damage || "",
            reach: item.Reach || "",
            mode: item.Mode || "",
            ammo: item.Ammo || "",
            recoil: item.Recoil || "",
            weight: item.Weight || "",
            availability: item.Availability || "",
            cost: item.Cost || "",
            streetIndex: item["Street Index"] || "",
            bookPage: item.BookPage || "",
            type: 'weapon'
          });
        }
      }
    }
    
    return items;
  }

  /**
   * Process armor data from gear.json
   */
  _processArmorData(data) {
    const items = [];
    const armorCategories = ['Clothing and Armor'];
    
    for (const categoryName of armorCategories) {
      if (data[categoryName] && data[categoryName].entries) {
        for (const item of data[categoryName].entries) {
          items.push({
            name: item.Name,
            category: categoryName,
            ballistic: item.Ballistic || "",
            impact: item.Impact || "",
            concealability: item.Concealability || "",
            weight: item.Weight || "",
            availability: item.Availability || "",
            cost: item.Cost || "",
            streetIndex: item["Street Index"] || "",
            bookPage: item.BookPage || "",
            type: 'armor'
          });
        }
      }
    }
    
    return items;
  }

  /**
   * Process general gear/equipment data from gear.json
   */
  _processGearData(data) {
    const items = [];
    const gearCategories = Object.keys(data).filter(cat => 
      !['Edged weapon', 'Bow and crossbow', 'Firearms', 'Rockets and Missiles', 'Grenades', 'VehicleFire', 'Clothing and Armor'].includes(cat)
    );
    
    for (const categoryName of gearCategories) {
      if (data[categoryName] && data[categoryName].entries) {
        for (const item of data[categoryName].entries) {
          items.push({
            name: item.Name,
            category: categoryName,
            rating: item.Rating || "",
            weight: item.Weight || "",
            availability: item.Availability || "",
            cost: item.Cost || "",
            streetIndex: item["Street Index"] || "",
            bookPage: item.BookPage || "",
            type: 'gear'
          });
        }
      }
    }
    
    return items;
  }
}