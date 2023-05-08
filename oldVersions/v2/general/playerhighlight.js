(function() {
    let binds = gc.hud.createGroup("Keybinds")
    let highlights = gc.hud.createGroup("Highlight")

    let highlightEnemies = false
    let teamBtn = highlights.addToggleBtn("Don't highlight enemies", "Highlight Enemies", (state) => {
        highlightEnemies = state
    })
    let highlightTeammates = false
    let enemyBtn = highlights.addToggleBtn("Don't highlight teammates", "Highlight Teammates", (state) => {
        highlightTeammates = state
    })

    binds.addKeybindSetter("Highlight Enemies", () => {
        teamBtn.trigger()
    })
    binds.addKeybindSetter("Highlight Teammates", () => {
        enemyBtn.trigger()
    })
        
    // create the overlay canvas
    let canvas = document.createElement("canvas")
    canvas.style.position = "absolute"
    canvas.style.top = "0"
    canvas.style.left = "0"
    canvas.style.zIndex = "999999999"
    canvas.style.pointerEvents = "none"
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    canvas.style.width = "100%"
    canvas.style.height = "100%"
    
    document.body.appendChild(canvas)
    
    window.addEventListener("resize", () => {
        canvas.width = window.innerWidth
        canvas.height = window.innerHeight
    })
    
    let ctx = canvas.getContext("2d")
    
    gc.socket.onStateChange((state) => {
        let characters = JSON.parse(JSON.stringify(state.characters))
        let user = gc.getUser()
    
        const textDistance = 250
    
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        for(let enemy of Object.values(characters)) {
            if(enemy.id == user.id) continue

            let isEnemy = enemy.teamId != user.teamId
            if(isEnemy && !highlightEnemies) continue
            if(!isEnemy && !highlightTeammates) continue

            // render the arrow pointing to the enemy
            let angle = Math.atan2(enemy.y - gc.data.playerPos.y, enemy.x - gc.data.playerPos.x)
            let textX = canvas.width / 2 + Math.cos(angle) * textDistance
            let textY = canvas.height / 2 + Math.sin(angle) * textDistance
            ctx.strokeStyle = isEnemy ? "red" : "green"
            ctx.lineWidth = 5
            ctx.beginPath()
            ctx.moveTo(textX, textY)
            angle -= Math.PI / 4 *  3
            ctx.lineTo(textX + Math.cos(angle) * 30, textY + Math.sin(angle) * 30)
            ctx.moveTo(textX, textY)
            angle += Math.PI / 4 *  6
            ctx.lineTo(textX + Math.cos(angle) * 30, textY + Math.sin(angle) * 30)
            ctx.stroke()
    
            // add in the distance
            ctx.font = "20px Verdana"
            ctx.fillStyle = "black"
            ctx.textAlign = "center"
            ctx.textBaseline = "middle"
    
            let distance = Math.sqrt(Math.pow(enemy.x - gc.data.playerPos.x, 2) + Math.pow(enemy.y - gc.data.playerPos.y, 2))
            distance = Math.round(distance)
            ctx.fillText(`${enemy.name} (${distance})`, textX, textY)
        }
    })
})()