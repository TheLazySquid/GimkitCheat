(function() {
	if(!window.gc) return alert(`You need to set up the override to use this script. Find instructions here:
	https://github.com/TheLazySquid/GimkitCheat#setting-up-an-override
	If you have it set up, try reloading this page with the console open.`)

	let binds = gc.hud.createGroup("Keybinds")
	let collectGroup = gc.hud.createGroup("Collect / Toggles")

	// set up autoselling
	let autoSelling = true
	let sellDevice = gc.getDevice({ mustHave: { channel: "sell" } })
	let sellPacket = {
		key: "interacted",
		deviceId: sellDevice.id,
		data: undefined
	}

	let sellBtn = collectGroup.addToggleBtn("Stop Auto Selling", "Auto Sell", (state) => {
		autoSelling = state
	}, true)

	setInterval(() => {
		if(autoSelling) {
			gc.socket.sendObj("MESSAGE_FOR_DEVICE", sellPacket)
		}
	}, 1000)

	let waterDevice = gc.getDevice({ mustHave: { channel: "attempt water" } })
	let waterPacket = {
		key: "interacted",
		deviceId: waterDevice.id,
		data: undefined
	}
	let researchDevice = gc.getDevice({ mustHave: { channel: "attempt research" } })
	let researchPacket = {
		key: "interacted",
		deviceId: researchDevice.id,
		data: undefined
	}

	let waterBtn = collectGroup.addBtn("Collect Water", () => {
		gc.socket.sendObj("MESSAGE_FOR_DEVICE", waterPacket)
	})
	let researchBtn = collectGroup.addBtn("Get Research", () => {
		gc.socket.sendObj("MESSAGE_FOR_DEVICE", researchPacket)
	})

	// make the seed purchase menu
	const seedIds = {
		"Corn Seed": "yellow-seed",
		"Wheat Seed": "tan-seed",
		"Potato Seed": "brown-seed",
		"Grape Seed": "purple-seed",
		"Raspberry Seed": "magenta-seed",
		"Watermelon Seed": "green-seed",
		"Coffee Bean": "bronze-seed",
		"Orange Seed": "orange-seed",
		"Gimberry Seed": "gold-seed",
		"Cash Berry Seed": "dark-green-seed",
		"Pepper Seed": "red-seed",
		"Energy Bar Seed": "blue-seed",
		"Lottery Ticket Seed": "teal-seed"
	}

	let purchases = gc.hud.createGroup("Purchase")

	for(let seed in seedIds) {
		let seedId = seedIds[seed]
		let seedDevice = gc.getDevice({ mustHave: { grantAction: "Grant Item", grantedItemId: seedId }})

		let packet = {
			key: "purchase",
			deviceId: seedDevice.id,
			data: undefined
		}

		purchases.addBtn(seed, () => {
			gc.socket.sendObj("MESSAGE_FOR_DEVICE", packet)
		})
	}

	// set up seed unlocks
	let unlockDevices = gc.getDevices({ mustHave: { purchaseChannel: "seed unlocked" }})

	let unlocks = gc.hud.createGroup("Unlock")

	for(let device of unlockDevices) {
		let seedName = device.data.grantedItemName;

		let packet = {
			key: "purchase",
			deviceId: device.id,
			data: undefined
		}

		unlocks.addBtn(seedName, () => {
			gc.socket.sendObj("MESSAGE_FOR_DEVICE", packet)
		})
	}

	let autoHarvest = true
	let harvestBtn = collectGroup.addToggleBtn("Stop Auto Harvesting", "Auto Harvest", (state) => {
		autoHarvest = state
	}, true)

	gc.socket.onDeviceChange((changes) => {
		if(!autoHarvest) return
		for(let change of changes) {
			for(let key in change.data) {
				if(!key.endsWith("status") || change.data[key] != "availableForCollection") continue
				let device = gc.getDevice({ id: change.id, mustHave: { style: "plant", channelItemFinishesCrafting: "ends planting" } })
				if(!device) continue

				// harvest it
				let packet = {
					key: "collect",
					deviceId: device.id,
					data: undefined
				}

				gc.socket.sendObj("MESSAGE_FOR_DEVICE", packet)
			}
		}
	})
	
	// set up auto seed planting
	let autoPlant = false
	let plantBtn = collectGroup.addToggleBtn("Stop Auto Planting", "Auto Plant", (state) => {
		autoPlant = state
	})
		
	let plots = gc.getDevices({ mustHave: { style: "plant" } })
	let attemptingPlot = 0

	setInterval(() => {
		if(!autoPlant) return
		let inventory = getInventory()

		// get the highest valued seed in the inventory
		let bestSeed
		let bestSeedIndex = -1
		for(let id in inventory) {
			let index = Object.values(seedIds).indexOf(id)
			if(index > bestSeedIndex) {
				bestSeedIndex = index
				bestSeed = id
			}
		}

		if(!bestSeed) return
		console.log("Attempting to plant", bestSeed)

		let plantRecipe = gc.getDevice({ mustHave: { ingredient1Item: bestSeed }})

		// make sure we have the neccesary ingredients
		let energyNeeded = plantRecipe.data.ingredient2Amount
		if((inventory.energy?.amount ?? 0) < energyNeeded) return console.log("Need more energy to plant")
		let waterNeeded = plantRecipe.data.ingredient3Amount
		if((inventory.water?.amount ?? 0) < waterNeeded) {
			if((inventory.energy?.amount ?? 0) < 5000) return console.log("Need more water to plant")
			gc.socket.sendObj("MESSAGE_FOR_DEVICE", waterPacket)
			return
		}

		let plantPacket = {
			key: "craft",
			deviceId: plots[attemptingPlot].id,
			data: {
				recipe: plantRecipe.id
			}
		}
	
		gc.socket.sendObj("MESSAGE_FOR_DEVICE", plantPacket)

		attemptingPlot++
		if(attemptingPlot >= plots.length) attemptingPlot = 0
	}, 100)


	function getInventory() {
		let user = gc.getUser();
		
		return user.inventory.slots
	}

	// add in keybinds
	binds.addKeybindSetter("Auto Sell", () => {
		sellBtn.trigger()
	})
	binds.addKeybindSetter("Collect Water", () => {
		waterBtn.trigger()
	})
	binds.addKeybindSetter("Get Research", () => {
		researchBtn.trigger()
	})
	binds.addKeybindSetter("Auto Harvest", () => {
		harvestBtn.trigger()
	})
	binds.addKeybindSetter("Auto Plant", () => {
		plantBtn.trigger()
	})
})()