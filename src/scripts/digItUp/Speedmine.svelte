<script lang="ts">
    import ToggleButton from "../../hud/components/ToggleButton.svelte";
    import { getUnsafeWindow } from "../../utils";
    import socketManager from "../../network/socketManager";

    let speedmineEnabled = false

    setInterval(() => {
        if(!speedmineEnabled) return

        let mousePointer = getUnsafeWindow().stores.phaser.scene.input.mousePointer
        let body = getUnsafeWindow().stores.phaser.mainCharacter.body
        if(!mousePointer || !body || !mousePointer.isDown) return
        
        // calculate the angle and mine
        let Vector2 = getUnsafeWindow().Phaser.Math.Vector2
        let vector = new Vector2(mousePointer.worldX - body.x, mousePointer.worldY - (body.y - 3)).normalize()
        let angle = getUnsafeWindow().Phaser.Math.Angle.Between(0, 0, vector.x, vector.y)
        socketManager.sendMessage("FIRE", {
            angle,
            x: body.x,
            y: body.y
        })
    }, 50)
</script>

<ToggleButton onText="Speedmine: On" offText="Speedmine: Off" hotkeyId="speedMine"
bind:enabled={speedmineEnabled} />