# Shadowrun 2nd Edition for Foundry VTT

A comprehensive game system for playing Shadowrun 2nd Edition in Foundry Virtual Tabletop.

## Features

### Character Management
- Complete attribute system (Body, Quickness, Strength, Charisma, Intelligence, Willpower, Essence, Magic, Reaction)
- Automatic calculation of derived attributes and dice pools
- Condition monitors for Physical and Stun damage
- Magic system with awakened character support

### Skills System
- Three-tier skill structure: Base Skills → Concentrations → Specializations
- Dynamic skill selection from comprehensive skill database
- Automatic dice pool calculations with attribute bonuses
- Specialization bonuses (+2 dice when applicable)

### Dice Pools
- **Combat Pool**: (Quickness + Intelligence + Willpower) ÷ 2
- **Hacking Pool**: Reaction + highest Computer skill
- **Control Pool**: Reaction + Vehicle Control Rig bonuses
- **Spell Pool**: Highest Sorcery skill rating
- **Astral Combat Pool**: Willpower + Charisma (awakened only)
- **Task Pool**: Intelligence base
- **Karma Pool**: Manual management

### Equipment & Augmentation
- **Cyberware**: Browse from comprehensive catalog with essence costs
- **Bioware**: Bio Index tracking and installation management
- **Spells**: Complete spell catalog with force and drain mechanics
- **Adept Powers**: Power point management with level-based costs

### Combat & Initiative
- Multi-phase initiative system authentic to SR2e
- Automatic initiative dice and reaction bonuses from cyberware
- Initiative tracker with phase management
- Multiple actions per round based on initiative scores

### Dice Rolling
- Exploding 6s system
- Success counting (TN 4 default)
- Critical failure detection
- Detailed roll results with chat integration

## Installation

### Method 1: Manifest URL (Recommended)
1. Open Foundry VTT
2. Go to "Game Systems" tab
3. Click "Install System"
4. Paste this manifest URL: `https://github.com/criticalfault/foundry-sr2/releases/latest/download/system.json`
5. Click "Install"

### Method 2: Manual Installation
1. Download the latest release from [GitHub](https://github.com/criticalfault/foundry-sr2/releases)
2. Extract the zip file to your Foundry `Data/systems/` directory
3. Restart Foundry VTT

## Usage

### Creating Characters
1. Create a new Actor and select "Character" type
2. Fill in attributes on the Attributes tab
3. Add skills using the Skills tab - select base skills and concentrations
4. Browse and add cyberware, bioware, spells, or adept powers as needed
5. Set awakened status in the Magic tab if playing a magical character

### Combat
1. Select tokens and open the Initiative Tracker (Ctrl+I or token controls)
2. Add combatants and roll initiative
3. Start combat and use Next Turn/Next Phase to progress
4. Characters act multiple times based on initiative scores

### Dice Rolling
- Click rollable elements throughout the character sheet
- Skills automatically calculate dice pools (Attribute + Skill + Specialization)
- Spells include automatic drain resistance rolls

## Compatibility

- **Foundry VTT**: Version 11+ (Verified on v12)
- **System Version**: 1.0.0

## Support

- **Issues**: [GitHub Issues](https://github.com/criticalfault/foundry-sr2/issues)
- **Discussions**: [GitHub Discussions](https://github.com/criticalfault/foundry-sr2/discussions)

## License

This system is licensed under the terms specified in the LICENSE file.

## Acknowledgments

- Based on Shadowrun 2nd Edition by FASA Corporation
- Built for the Foundry VTT community
- Includes comprehensive data from official sourcebooks

---

*Shadowrun is a trademark of Catalyst Game Labs. This system is not affiliated with or endorsed by Catalyst Game Labs.*