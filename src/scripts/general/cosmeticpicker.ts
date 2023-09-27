import { HudObject } from "../../interfaces";

let skins = ["Unchanged","default_browngreen","default_cyan","default_darkblue","default_darkgreen","default_darkpurple","default_gray","default_grayblue","default_graybrown","default_hotpink","default_lightbrown","default_lightgreen","default_lightpink","default_lightpurple","default_lightyellow","default_lime","default_maroon","default_orange","default_pink","default_red","default_yellow","sunny","glassHalfFull","stripeDoubleGreen","sprinklesRed","dayOne","vortexAgent","echoAgent","grayGradient","mustache","clown","redNinja","redDeliciousApple","polkaDotBlueAndYellow","fadedBlueGradient","whiteAndBlueVerticalStripes","volcanoCracks","pinkPaste","yellowCracksPurple","glyphsYellowBrown","camoBlue","glyphsOrangeBlue","purplePaste","mustacheBrown","mustachePink","polkaDotWhiteAndRed","camoTan","camoGreen","stripeDoublePurple","stripeDoubleRed","stripeDoubleYellow","sprinklesChocolate","coolRedBlueGradient","mountainAndSun","redDinoCostume","pencilPack","corn","luchador","fox","burger","galaxy","cellBlue","cellGold","rockyWest","puzzleRedGreen","puzzleOrangeBlue","puzzleGrayWhite","puzzleGreenBlue","puzzleYellowPurple","pumpkin","ghostCostume","mummy","fifthBirthday","pumpkinPie","feast","frostBuddy","festiveOnesieTan","festiveOnesieRed","festiveOnesieGreen","festiveOnesieBlue","hotChocolate","snowglobe","polkaDotFestive","polkaDotFestiveReverse","mustacheSanta","firework","gift","snowman","detective","yinYang","astroHelmet","hamster","pirate","rockstar","circuitGray","circuitBlue","circuitGreen","roses","heart","zebra","constellationBlackWhite","constellationBlackGreen","constellationPurpleYellow","constellationPinkGreen","constellationYellowPink","squiggles","frozenMummy","leprechaun","evilPlantGreen","evilPlantPink","fisher","rainbowWave","sketch","sketchBlue","bananaSplit","eightBit","gamerGreen","gamerPink","gamerPurple","gamerYellow","graduate","graduateBlue","arcticFox","coffee","partyPineapple","sentryRobot","construction","clock","crashTestDummy"]
let trails = ["None", "origin_token"]
skins = skins.sort();
trails = trails.sort();

const hudAddition: HudObject = {
    menus: [
        {
            name: "General Cheats",
            groups: [
                {
                    name: "Cosmetic Picker",
                    elements: [
                        {
                            type: "text",
                            options: {
                                text: "Select cosmetics to apply to your character. These changes are only visible to you."
                            }
                        },
                        {
                            type: "dropdown",
                            options: {
                                text: "Selected Skin",
                                options: skins,
                                runFunction: "setSkin",
                                default: "Unchanged"
                            }
                        },
                        {
                            type: "dropdown",
                            options: {
                                text: "Selected Trail",
                                options: trails,
                                runFunction: "setTrail",
                                default: "None"
                            }
                        }
                    ]
                }
            ]
        }
    ]
}

class CosmeticpickerClass {
    name: string = "Cosmetic Picker";
    hudAddition: HudObject = hudAddition;
    funcs: Map<string, Function> = new Map([
        ["setSkin", (skin: string) => {
            this.setSkin(skin);
        }],
        ["setTrail", (trail: string) => {
            this.setTrail(trail);
        }]
    ]);
    skinWaiting: boolean = false;
    trailWaiting: boolean = false;

    customSkin: string = "Unchaged";

    init(cheat: any) {
        // create the custom skin input
        let customSkinInput = cheat.hud.menu("General Cheats")?.group("Cosmetic Picker")?.addElement("textinput", {
            text: "Other skin input"
        });
        customSkinInput.addEventListener("input", (e: any) => {
            this.customSkin = e.detail;
        })
        let applyButton = cheat.hud.menu("General Cheats")?.group("Cosmetic Picker")?.addElement("button", {
            text: "Apply Other Skin",
        });
        applyButton.addEventListener("click", () => {
            this.setSkin(this.customSkin);
        })

        // create the custom trail input
        let customTrailInput = cheat.hud.menu("General Cheats")?.group("Cosmetic Picker")?.addElement("textinput", {
            text: "Other trail input"
        });
        customTrailInput.addEventListener("input", (e: any) => {
            this.customSkin = e.detail;
        })
        let applyTrailButton = cheat.hud.menu("General Cheats")?.group("Cosmetic Picker")?.addElement("button", {
            text: "Apply Other Trail",
        });
        applyTrailButton.addEventListener("click", () => {
            this.setTrail(this.customSkin);
        })
    }

    setSkin(skin: string) {
        if(skin == "Unchanged") return

        if(!("stores" in unsafeWindow)) {
            if(this.skinWaiting) return;

            let checkInterval = setInterval(() => {
                if("stores" in unsafeWindow) {
                    if(this.hasSkinApplied(skin)) clearInterval(checkInterval);
                    this.setSkin(skin);
                }
            }, 100)
            this.skinWaiting = true;

            return;
        }
        
        let phaser = (unsafeWindow as any).stores.phaser;
        let userId = phaser.mainCharacter?.id;
        if(!userId) return;
        
        let skinId = `character_${skin}`

        phaser.scene?.characterManager?.characters?.get(userId)?.skin?.updateSkin(skinId);
    }

    hasSkinApplied(skin: string) {
        let phaser = (unsafeWindow as any).stores.phaser;
        let userId = phaser.mainCharacter?.id;
        if(!userId) return;
        
        let skinId = `character_${skin}`

        return phaser.scene?.characterManager?.characters?.get(userId)?.skin.skinId == skinId;
    }

    setTrail(trail: string) {
        if(!("stores" in unsafeWindow)) {
            if(this.trailWaiting) return;

            let checkInterval = setInterval(() => {
                if("stores" in unsafeWindow) {
                    if(this.hasSkinApplied(trail)) clearInterval(checkInterval);
                    this.setTrail(trail);
                }
            }, 100)
            this.trailWaiting = true;

            return;
        }
        
        let phaser = (unsafeWindow as any).stores.phaser;
        let userId = phaser.mainCharacter?.id;
        if(!userId) return;
        
        // blank trail is "None"
        if(trail == "None") trail = ""
        let trailId = `trail_${trail}`

        phaser.scene?.characterManager?.characters?.get(userId)?.characterTrail?.updateAppearance(trailId);
    }
}

export function Cosmeticpicker() {
    return new CosmeticpickerClass();
}