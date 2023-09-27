# Gimkit Cheat

This version of Gimkit Cheat was inspired by Gimkit Utility by [UndercoverGoose](https://github.com/UndercoverGoose), which was sadly taken down. The main things that were carried over from the other script are using Typescript, Rollup and Tampermonkey, which makes it easier to develop and use. If you do want to try out the older versions, check out [v1 here](/v1) or [v2 here](/v2).

Install/Update it by clicking on [this link](https://raw.githubusercontent.com/TheLazySquid/GimkitCheat/main/build/bundle.user.js) while having [Tampermonkey](https://www.tampermonkey.net/) installed on your browser.

## Features

Gimkit Cheat provides a nice, unified way to use different cheats. To open/close the hud, press "\\" (backslash) on your keyboard while on Gimkit. It will show various menus, which should be fairly self explanatory. If you find any issues, please open a new [issue](https://github.com/TheLazySquid/GimkitCheat/issues/new) on this repository.

### General Cheats

- **Auto Answer**: Automatically answers questions for you.
- **Cosmetic Picker**: Allows you to use any cosmetic you want, even unused ones. These are only visible to you.

**Note**: The list of cosmetics is unmaintained. There is an input that allows you to use equip cosmetics with a custom id, but it requires the internal id of the cosmetic, which is often misleading.

- **Freecam**: Allows you to move your camera wherever you want, or even spectate other players. Once in freecam, use the arrow keys to move the camera.
- **Player Highlighter**: Marks on your screen where teammates or enemies are in relation to you.
- **Instant Use**: Tired of waiting for painfully slow bars to fill up just to purchase something minor? This allows you to use the nearest thing instantly by hitting enter.

### Gamemode Specific Cheats

- **Classic**: Automatically purchases upgrades for you. Best used with Auto Answer.
- **Super Rich Mode**: Identical to Classic, with adjusted values.
- **Trust No One**: Tells you who the imposters are. Doesn't work if you join mid-game.
- **Capture The Flag**: Purchase upgrades from anywhere
- **Tag**: Purchase upgrades from anywhere
- **Snowbrawl**: Purchase shield cans/medpacks from anywhere
- **One Way Out**: Purchase shield cans/medpacks from anywhere
- **Farmchain**: Adds options to automatically harvest/plant crops from anywhere

As of late, I'm not super happy with the way I made this, especially the HUD. It's going to be a massive pain to make any major changes. Maybe i'll do an overhaul sometime, but for now there are no plans to.