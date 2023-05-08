(function() {
	if(!window.gc) return alert(`You need to set up the override to use this script. Find instructions here:
	https://github.com/TheLazySquid/GimkitCheat#setting-up-the-overrides
	If you have it set up, try reloading this page with the console open.`)

	let purchases = gc.hud.createGroup("Purchase")

	const upgrades = {
		"Speed Upgrade": "speed purchased",
		"Efficiency Upgrade": "efficiency purchased",
		"Energy Per Question Upgrade": "energyPerQuestion purchased",
        "Endurance Upgrade": "endurance purchased",
	}

	let lastUsed = null
	let lastUpgrade = null

	for(let key in upgrades) {
		let devices = gc.getDevices({ mustHave: { grantedItemName: key }})
		for(let device of devices) {
			let packet = {
				key: "purchase",
				deviceId: device.id,
				data: undefined
			}

            let price = device.data.amountOfRequiredItem

			let btn = purchases.addBtn(`${key} (${price})`, () => {
				gc.socket.sendObj("MESSAGE_FOR_DEVICE", packet)
				lastUsed = btn
				lastUpgrade = upgrades[key]
			})
		}
	}

	// remove buttons once the upgrade is purchased
	gc.socket.onOutgoingMsg((key, msg) => {
		if(key != "UPDATE_DEVICE_UI_PRESENCE") return
		if(!msg?.action == "CLOSE") return
		let device = gc.getDevice({ id: msg.deviceId })
		if(!device) return
		if(device.data.openWhenReceivingFrom === lastUpgrade) {
			lastUsed.remove()
		} else {
			lastUsed = null
			lastUpgrade = null
		}
	})
})()