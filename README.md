# Gimkit Cheat

This is a new version of GimkitCheat. If you want to use the older version, it can be found [here](https://github.com/TheLazySquid/GimkitCheat/tree/a19d802eca25893e6f262b9d6e74f1278dbebd2f). This version features a nicer UI made using Svelte, and several new cheats/quality of life features not present in the older version. Additionally, it is able to be used as both a bookmarklet and a script you can paste into the console. I decided not to port over the dummy account spawner, as it massively increased the bundle size, caused a lot of issues when compiling and was generally not very useful. There is still a working standalone version of the account spawner [here](https://github.com/TheLazySquid/GimkitSpawner).

## Usage

#### ViolentMonkey (recommended)

1. Install the [ViolentMonkey](https://violentmonkey.github.io/get-it/) extension for your browser.
2. Click [here](https://raw.githubusercontent.com/TheLazySquid/GimkitCheat/main/build/bundle.user.js) to install the script.

#### Copy/Paste

1. Copy the script from [here](/build/bundle.user.js).
2. Open up the Gimkit join page. **Do not join the game yet.**
3. Open up the developer console (usually F12 or Ctrl+Shift+I).
4. Paste the script into the console and press enter.

#### Bookmarklet

This does not work on Firefox, due to it's 32kb limit on bookmarklets.

1. Copy the script from [here](/build/bundle.bookmarklet.txt).
2. Create a new bookmark in your browser.
3. Paste the script into the URL field.
4. Open up the Gimkit join page. **Do not join the game yet.**
5. Click the bookmark to run the script.

## Features

Hitting backslash (\\) at any point will hide the overlay. Hitting it again will cause it to reappear.

#### General

- **Auto Answer**: Automatically answers questions in all gamemodes.
- **Freecam**: Allows you to move your camera around the map freely, or spectate other players.
- **Player Highlighter**: Draws arrows pointing towards teammates/enemies, allowing you to easily find them.
- **Instant Use**: Will instantly use any interactible object rather than needing to hold down enter for a few seconds.
- **Movement**: Lets you move faster up to 1.4x faster than usual. This stacks with in-game speed upgrades. Also lets you jump higher in platformer modes.

#### Gamemode Specific

- **Auto Purchase**: Automatically purchases upgrades for you. Works for classic and similar gamemodes.
- **Super Rich Mode**: Identical to Auto Purchase, but with adjusted values for Super Rich mode.
- **Dig it Up**: Allows you to mine extremely fast.
- **Trust No One**: Shows you who the imposters are in Trust No One mode. This does not work if you join mid-game.
- **Capture the Flag**: Allows you to purchase upgrades and build walls anywhere.
- **Tag**: Allows you to purchase upgrades anywhere.
- **Snowbrawl**: Allows you to purchase medkits and shield cans anywhere, and fire snowballs faster.
- **One Way Out**: Allows you to purchase medkits and shield cans anywhere.
- **Farmchain**: Allows you to automatically plant seeds (assuming you have enough water and energy) and automatically harvest the plants once they grow. This will actually plant the seeds in plots that are supposed to be inaccessible until later in the game; the only thing stopping you from using them is the box on top that the script ignores. So while you might not see your plants growing, they are still being grown. Additionally, this script lets you purchase/unlock seeds anywhere.
- **The Floor is Lava**: Lets you automatically build structures when you have enough money. Also allows you to hide the "You purchased/built x" popups. Leaving this off may cause them to pile up and lag your game.
- **Knockback**: Allows you to fire faster.

#### Cosmetic

- **Hud Customization**: The hud is easily customizable, allowing you to change the color of buttons, menus, groups and text.
- **Cosmetic Picker**: Allows you to pick any skin or trail to use. This will only be visible to you; no one else will see it. There is an unmaintained list of cosmetics you can equip, or you can enter its internal ID to use it. This is usually listed on the [Gimkit Wiki](https://gimkit.wiki/wiki/Cosmetics).
- **Custom Theme**: Allows you to create a custom theme, or use any built-in theme. This works in all gamemodes, even ones that don't normally allow you to change your theme.
