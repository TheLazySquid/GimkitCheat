(function() {
	if(!window.gc) return alert(`You need to set up the override to use this script. Find instructions here:
	https://github.com/TheLazySquid/GimkitCheat#setting-up-the-overrides
	If you have it set up, try reloading this page with the console open.`)

	let purchases = gc.hud.createGroup("Purchase")

	// add the invisabit purchaser
	let invisDevice = gc.getDevice({ mustHave: { grantedItemId: "silver-ore"} })
	let packet = {
		key: "purchase",
		deviceId: invisDevice.id,
		data: undefined
	}

	purchases.addBtn("Invisabits", () => {
		gc.socket.sendObj("MESSAGE_FOR_DEVICE", packet)
	})

	const upgrades = {
		"Speed Upgrade": "upgrade speed",
		"Efficiency Upgrade": "upgrade efficiency",
		"Energy Per Question Upgrade": "upgrade energy per question"
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

			let btn = purchases.addBtn(key, () => {
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