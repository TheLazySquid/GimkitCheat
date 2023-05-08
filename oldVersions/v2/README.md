# Gimkit Cheat

## Usage

When in a Gimkit game, open the console (Ctrl+Shift+I) and paste the code for your desired gamemode after setting up an override. Read below for more information for each gamemode.

## All scripts now require a local override to be set up. Click [here](#setting-up-the-overrides) to see how to set up a local override. If you are unable to use local overrides, you can use the [old version](/v1/general.js) that doesn't require an override. You will need to answer all questions once before it begins working.

## General Use Scripts

### [Auto answer](/general/autoanswer.js)

This script automatically answers a question every ~1 second. Manually answering questions may cause them to be wrong even if they looked correct.

### [Player Higlighter](/general/playerhighlight.js)

This script adds toggles that allow you to highlight where teammates and enemies are in relation to you. This is useful for games like Capture the Flag, Snowbrawl or Tag.

### [Cosmetic Picker](/general/cosmeticpicker.js)

This script allows you to select any cosmetic you want, including unused ones such as clown. Nobody else can see the equipped cosmetics, they are only visible to you.

### [Freecam](/general/freecam.js)

This script allows you to move your camera independent of your player. When in freecam mode, you can move the camera by hitting u, h, j and k. If i'm gonna be honest, it's not actually that useful, but it's still a neat utility to have.

## Gamemode Specific Scripts

### [Classic](/gamemodes/classic.js)

The trick for classic is loosely based around a trick found in [non-reai's Gimkit hack](https://github.com/non-reai/Gimkit-Hacks) to answer questions, rather than manually storing and answering questions. It automatically answers questions and purchases upgrades, and all you should manually do is purchase and use powerups.

### [Fishtopia](/gamemodes/fishtopia.js)

This script allows you to sell fish without being at the sell station and fish anywhere without being at water. Additionally, after using a "travel to..." thing (such as the travel to purple pond boat), you will be able to permanently use it from anywhere.

### [One Way Out](/gamemodes/one-way-out.js)

#### Patched: You can no longer use auto attack

This script allows you to do a variety of things. First, you can purchase health, shield, bridges and checkpoints from anywhere. Secondly, it comes with an "Auto Attack" feature. While holding a weapon out, it will automatically fire it and kill the nearest enemy to you, even through walls. This lets you earn the money from killing enemies from anywhere, so you can simply loiter at spawn doing this until you can afford to get the third checkpoint. You need to purchase the bridge before the checkpoint, like normal.

### [Farmchain](/gamemodes/farmchain.js)

This script does the standard stuff of getting water, research, seeds and unlocks from anywhere. On top of that, it comes with an "auto harvest" mode which will automatically collect grown crops from wherever, and an auto plant mode. Auto plant mode automatically will plant all seeds in your inventory from wherever you are, which can then be harvested with auto harvest. Once you begin using this, all you need to do is purchase and unlock seeds for it to plant.

### [Capture the flag](/gamemodes/capture-the-flag.js)

This script allows you to purchase upgrades and invisabits from anywhere. In the future it might highlight where opponents are, but that's still in the works.

### [Tag](/gamemodes/tag.js)

For now, all this lets you do is buy upgrades from anywhere. As with capture the flag, more is in the works.

### [Snowbrawl](/gamemodes/snowbrawl.js)

#### Patched: You can no longer use auto attack

This script allows you to buy health and med packs from anywhere, but more importantly, it has an "Auto Attack" button. This allows will automatically damage and quickly kill the nearest player to you. Unlike in no way out, you really are attacking real players with this one and you effectively softlock the game in smaller lobbies. Please be responsible when using this.

## Setting up the overrides

#### Tested browsers that support local overrides
Chrome and Edge

#### Tested browsers that do not support local overrides
Firefox

Overrides only work on certain browsers. If the browser you are using supports them, follow the following steps to set the one for Gimkit cheat up.

1. Open the console (Ctrl+Shift+I)
2. Click the "Sources" tab
3. On the left, open the "Overrides" tab
4. Hit "Select folder for overrides"
5. Select a folder to store the override in
6. If a "www.gimkit.com" subfolder does not exist, create one
7. Download [all files in the overrides folder](/overrides/), and place them in the "www.gimkit.com" folder
(in order to download a file, click "raw" at the top of the preview and then right click > "save as")

Whenever you load the page, keep the console open until you see the "Gimkit Cheat Override Loaded" message.

## Updating the override

In order to update the overrides, simply redownload [the overrides](/overrides/) and replace the old ones.