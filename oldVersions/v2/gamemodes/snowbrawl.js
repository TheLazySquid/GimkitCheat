(function() {
    let binds = gc.hud.createGroup("Keybinds")
    let purchases = gc.hud.createGroup("Purchase")

    let healthDevice = gc.getDevice({ mustHave: { grantedItemId: "medpack" } })
    let healthPacket = {
        key: "purchase",
        data: undefined,
        deviceId: healthDevice.id
    }

    let medpackBtn = purchases.addBtn("Medpack", () => {
        gc.socket.sendObj("MESSAGE_FOR_DEVICE", healthPacket)
    })

    let shieldDevice = gc.getDevice({ mustHave: { grantedItemId: "shield-can" } })
    let shieldPacket = {
        key: "purchase",
        data: undefined,
        deviceId: shieldDevice.id
    }

    let shieldBtn = purchases.addBtn("Shield Can", () => {
        gc.socket.sendObj("MESSAGE_FOR_DEVICE", shieldPacket)
    })

    let autoAttacking = false
    let autoAttackBtn = gc.hud.addToggleBtn("Stop auto attacking", "Auto Attack", (state) => {
        autoAttacking = state
    }, false)

    // add keybinds
    binds.addKeybindSetter("Buy Medpack", () => {
        medpackBtn.trigger()
    })
    binds.addKeybindSetter("Buy Shield Can", () => {
        shieldBtn.trigger()
    })
    binds.addKeybindSetter("Auto Attack", () => {
        autoAttackBtn.trigger()
    })

    let user = gc.getUser()
    
    setInterval(() => {
        if(!autoAttacking) return
        let characters = JSON.parse(JSON.stringify(gc.data.serializer.getState().characters))
    
        // calculate the closest player to the last position we were at
        let target
        let shortedDistance = Infinity
        for(let id in characters) {
            if(id == user.id) continue
            let character = characters[id]

            // don't attack respawning players
            if(character.isRespawning || character.health.spawnImmunityActive) continue
            let distance = Math.sqrt(Math.pow(character.x - gc.data.playerPos.x, 2) + 
                Math.pow(character.y - gc.data.playerPos.y, 2))
            if(distance < shortedDistance) {
                target = character
                shortedDistance = distance
            }
        }
    
        if(!target) return
        gc.socket.sendObj("FIRE", {
            angle: 0,
            x: target.x,
            y: target.y
        })
    }, 100)
})()