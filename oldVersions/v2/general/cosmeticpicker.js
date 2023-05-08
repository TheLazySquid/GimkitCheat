(function() {
	if(!window.gc) return alert(`You need to set up the override to use this script. Find instructions here:
	https://github.com/TheLazySquid/GimkitCheat#setting-up-an-override
	If you have it set up, try reloading this page with the console open.`)

	let newStyles = new CSSStyleSheet()
	newStyles.replaceSync(`
		.gc_cosmeticpicker {
			position: absolute;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			display: none;
			z-index: 99999999999;
			background: rgba(0, 0, 0, 0.5);
			display: none;
			flex-direction: column;
			align-items: center;
			color: white;
			padding-top: 50px;
			text-align: center;
		}

		.gc_cosmeticpicker select, .gc_cosmeticpicker button {
			width: 100%;
			max-width: 300px;
			margin: 10px 0;
			border-radius: 5px;
			border: none;
			padding: 5px;
			background: rgba(0, 0, 0, 0.5);
		}

		.gc_cosmeticpicker button {
			cursor: pointer;
		}
	`)
	document.adoptedStyleSheets = [...document.adoptedStyleSheets, newStyles]

	const skins = ["default_browngreen", "default_cyan", "default_darkblue", "default_darkgreen", "default_darkpurple", "default_gray", "default_grayblue", "default_graybrown", "default_hotpink", "default_lightbrown", "default_lightgreen", "default_lightpink", "default_lightpurple", "default_lightyellow", "default_lime", "default_maroon", "default_orange", "default_pink", "default_red", "default_yellow", "sunny", "glassHalfFull", "stripeDoubleGreen", "sprinklesRed", "dayOne", "vortexAgent", "echoAgent", "grayGradient", "mustache", "clown", "redNinja", "redDeliciousApple", "polkaDotBlueAndYellow", "fadedBlueGradient", "whiteAndBlueVerticalStripes", "volcanoCracks", "pinkPaste", "yellowCracksPurple", "glyphsYellowBrown", "camoBlue", "glyphsOrangeBlue", "purplePaste", "mustacheBrown", "mustachePink", "polkaDotWhiteAndRed", "camoTan", "camoGreen", "stripeDoublePurple", "stripeDoubleRed", "stripeDoubleYellow", "sprinklesChocolate", "coolRedBlueGradient", "mountainAndSun", "redDinoCostume", "pencilPack", "corn", "luchador", "fox", "burger", "galaxy", "cellBlue", "cellGold", "rockyWest", "puzzleRedGreen", "puzzleOrangeBlue", "puzzleGrayWhite", "puzzleGreenBlue", "puzzleYellowPurple", "pumpkin", "ghostCostume", "mummy", "fifthBirthday", "pumpkinPie", "feast", "frostBuddy", "festiveOnesieTan", "festiveOnesieRed", "festiveOnesieGreen", "festiveOnesieBlue", "hotChocolate", "snowglobe", "polkaDotFestive", "polkaDotFestiveReverse", "mustacheSanta", "firework", "gift", "snowman", "detective", "yinYang", "astroHelmet", "hamster", "pirate", "rockstar", "circuitGray", "circuitBlue", "circuitGreen", "roses", "heart", "zebra", "constellationBlackWhite", "constellationBlackGreen", "constellationPurpleYellow", "constellationPinkGreen", "constellationYellowPink", "squiggles", "frozenMummy", "leprechaun", "evilPlantGreen", "evilPlantPink", "fisher", "rainbowWave", "sketch", "sketchBlue", "bananaSplit", "eightBit", "gamerGreen", "gamerPink", "gamerPurple", "gamerYellow", "graduate", "graduateBlue", "arcticFox"]
	const trails = ["", "origin_token"]
	skins.sort()
	trails.sort()
	let user = gc.getUser();

	// create the list of cosmetics
	let overlay = document.createElement('div')
	overlay.classList.add('gc_cosmeticpicker')
	overlay.innerHTML = `
		<h1>Nobody Else Can See Selected Cosmetics</h1>
		<div>Skin</div>
		<select class="skin">
			${skins.map(skin => `
			<option value="${skin}"
			${user.appearance.skinId == `character_${skin}` ? 'selected' : ''}>
				${skin}
			</option>`).join('')}
		</select>
		<div>Trail</div>
		<select class="trail">
			${trails.map(trail => `<option value="${trail}"
			${user.appearance.trailId == `trail_${trail}` ? 'selected' : ''}>
				${trail}
			</option>`).join('')}
		</select>
		<button>Close</button>
	`
	
	overlay.querySelector('button').addEventListener('click', () => {
		overlay.style.display = 'none'
	})

	overlay.querySelector('.skin').addEventListener('change', e => {
		let skinId = `character_${e.target.value}`
		stores.phaser.scene.characterManager.characters.get(user.id).skin.updateSkin(skinId)
	})

	overlay.querySelector('.trail').addEventListener('change', e => {
		let trailId = `trail_${e.target.value}`
		stores.phaser.scene.characterManager.characters.get(user.id).characterTrail.updateAppearance(trailId)
	})

	document.body.appendChild(overlay)

	gc.hud.addBtn('Open Cosmetic Picker', () => {
		overlay.style.display = 'flex'
	})
})()