(function() {
    let binds = gc.hud.createGroup("Keybinds")

    let freecamming = false
    let camHelper = stores.phaser.scene.cameraHelper

    let cameraPos = {x: 0, y: 0}
    
    let freeCamBtn = gc.hud.addToggleBtn("Stop Freecamming", "Freecam", (state) => {
        freecamming = state
        if(freecamming) {
            camHelper.stopFollow()
            cameraPos.x = stores.phaser.scene.cameras.cameras[0].midPoint.x
            cameraPos.y = stores.phaser.scene.cameras.cameras[0].midPoint.y
        } else {
            let charObj = stores.phaser.scene.characterManager.characters.get(stores.phaser.mainCharacter.id).body
            camHelper.startFollowingObject({object: charObj})
        }
    }, false)

    binds.addKeybindSetter("Freecam", () => {
        freeCamBtn.trigger()
    })

    let keysPressed = new Set()

    window.addEventListener("keydown", (e) => {
        if(freecamming) {
            keysPressed.add(e.key)
        }
    })
    
    window.addEventListener("keyup", (e) => {
        keysPressed.delete(e.key)
    })

    setInterval(() => {
        if(!freecamming) return
        if(keysPressed.has("u")) cameraPos.y -= 20
        if(keysPressed.has("j")) cameraPos.y += 20
        if(keysPressed.has("h")) cameraPos.x -= 20
        if(keysPressed.has("k")) cameraPos.x += 20
        camHelper.goTo(cameraPos)
    }, 1000/60)
})()