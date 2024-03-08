<script lang="ts">
    import Group from "../../hud/Group.svelte";
    import ToggleButton from "../../hud/components/ToggleButton.svelte";
    import { onMount } from "svelte";
    import { serializer } from "../../network/schemaDecode";
    import { playerId } from "../../stores";
    import { getUnsafeWindow } from "../../utils";

    let canvas: HTMLCanvasElement;
    $: ctx = canvas?.getContext("2d");

    function onResize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    let highlightTeammates = false;
    let highlightEnemies = false;
    
    function render() {
        if(!serializer?.state?.characters || !ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if(!highlightTeammates && !highlightEnemies) return;

        let camera = getUnsafeWindow()?.stores?.phaser?.scene?.cameras?.cameras[0];
        let player = serializer.state.characters.$items.get($playerId);
        if(!player || !camera) return;

        let camX = camera.midPoint.x;
        let camY = camera.midPoint.y;

        for(let [id, character] of serializer.state.characters.$items) {
            if(id === $playerId) continue;

            let isTeammate = player.teamId === character.teamId;
            if(isTeammate && !highlightTeammates) continue;
            if(!isTeammate && !highlightEnemies) continue;

            // get the angle between the player and the character
            let angle = Math.atan2(character.y - camY, character.x - camX);
            let distance = Math.sqrt(Math.pow(character.x - camX, 2) + Math.pow(character.y - camY, 2)) * camera.zoom;

            let arrowDist = Math.min(250, distance);

            let arrowTipX = Math.cos(angle) * arrowDist + canvas.width / 2;
            let arrowTipY = Math.sin(angle) * arrowDist + canvas.height / 2;

            let leftAngle = angle + Math.PI / 4 * 3;
            let rightAngle = angle - Math.PI / 4 * 3;

            // draw an arrow pointing to the character
            ctx.beginPath();
            ctx.moveTo(arrowTipX, arrowTipY);

            ctx.lineTo(arrowTipX + Math.cos(leftAngle) * 50, arrowTipY + Math.sin(leftAngle) * 50);

            ctx.moveTo(arrowTipX, arrowTipY);

            ctx.lineTo(arrowTipX + Math.cos(rightAngle) * 50, arrowTipY + Math.sin(rightAngle) * 50);

            ctx.lineWidth = 3;
            ctx.strokeStyle = isTeammate ? "green" : "red";
            ctx.stroke();

            // draw the character's name and distance
            ctx.fillStyle = "black";
            ctx.font = "20px Verdana";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            ctx.fillText(`${character.name} (${Math.floor(distance)})`, arrowTipX, arrowTipY)
        }
    }

    onMount(() => {
        document.body.appendChild(canvas);
    })

    setInterval(render, 1000 / 30);
</script>

<svelte:window on:resize={onResize} />

<canvas bind:this={canvas} width={window.innerWidth} height={window.innerHeight}>
</canvas>

<Group name="Player Highlighter">
    <ToggleButton onText="Stop highlighting teammates" offText="Highlight Teammates"
    bind:enabled={highlightTeammates} on:click={render} hotkeyId="highlightTeammates" />
    <ToggleButton onText="Stop highlighting enemies" offText="Highlight Enemies"
    bind:enabled={highlightEnemies} on:click={render} hotkeyId="highlightEnemies" />
</Group>

<style>
    canvas {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        z-index: 9999;
        pointer-events: none;
    }
</style>