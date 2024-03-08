<script lang="ts">
    // storesLoaded refers to the window.stores object existing, not svelte stores
    import Group from "../../hud/Group.svelte";
    import Button from "../../hud/components/Button.svelte";
    import Slider from "../../hud/components/Slider.svelte";
    import { serializer } from "../../network/schemaDecode";
    import { storesLoaded, playerId } from "../../stores";
    import { getUnsafeWindow } from "../../utils";

    let keys = new Set();
    let select: HTMLSelectElement;

    let freecamming = false;
    function onKeydown(event: KeyboardEvent) {
        if(!event.key.startsWith("Arrow")) return;
        
        // Prevent arrow keys from moving the character
        if(freecamming) {
            event.stopImmediatePropagation();
        }
        keys.add(event.key);
    }

    function onKeyup(event: KeyboardEvent) {
        keys.delete(event.key);
    }

    let freecamPos = { x: 0, y: 0 };
    let freecamUpdateInterval: number;

    let zoomValue = 1;

    function startFreecam() {
        let scene = getUnsafeWindow().stores.phaser.scene;
        let camera = scene.cameras.cameras[0];

        scene.cameraHelper.stopFollow();
        freecamPos = { x: camera.midPoint.x, y: camera.midPoint.y };
        camera.useBounds = false;

        freecamUpdateInterval = setInterval(() => {
            let freecamSpeed = 20 / zoomValue * 1.75;
            
            if(keys.has("ArrowUp")) freecamPos.y -= freecamSpeed
            if(keys.has("ArrowDown")) freecamPos.y += freecamSpeed
            if(keys.has("ArrowLeft")) freecamPos.x -= freecamSpeed
            if(keys.has("ArrowRight")) freecamPos.x += freecamSpeed

            scene.cameraHelper.goTo(freecamPos)
        }, 1000 / 30) as any;
    }

    function stopFreecam() {
        let phaser = getUnsafeWindow().stores.phaser;
        let charObj = phaser.scene.characterManager.characters
            .get(phaser.mainCharacter.id).body

        phaser.scene.cameraHelper.startFollowingObject({ object: charObj });
        phaser.scene.cameras.cameras[0].useBounds = true;

        clearInterval(freecamUpdateInterval);
    }

    storesLoaded.subscribe(loaded => {
        if(!loaded) return;

        let getZoomInterval = setInterval(() => {
            let zoom = getUnsafeWindow()?.stores?.phaser?.scene?.cameras?.cameras[0]?.zoom;
            if(zoom) {
                zoomValue = zoom;
                clearInterval(getZoomInterval);
            }
        }, 50)
    })

    function setZoom(event: CustomEvent<number>) {
        zoomValue = event.detail;

        getUnsafeWindow().stores.phaser.scene
            .cameras.cameras[0].setZoom(event.detail);
    }

    let specCharacters = [];
    let unbinds = [];

    playerId.subscribe(id => {
        specCharacters = specCharacters.filter(char => char.id !== id);
    })

    serializer.addEventListener("load", () => {
        const reloadCharacters = () => {
            specCharacters = [];
            for(let unbind of unbinds) unbind();
            for(let [id, char] of serializer.state.characters.$items) {
                if(!char.isActive || id === $playerId) continue;
                specCharacters.push({
                    id,
                    name: char.name
                })
                let unbind = char.listen("isActive", (_: boolean, prevVal: boolean | undefined) => {
                    if(prevVal === undefined) return;
                    reloadCharacters();
                });
                unbinds.push(unbind);
            }
        }

        serializer.state.characters.onChange(reloadCharacters);
        reloadCharacters();
    })

    let spectating = false;

    function onBtnClick() {
        if(spectating) {
            spectating = false;
            stopFreecam();
            select.value = "";
        } else {
            freecamming = !freecamming;
            if(freecamming) startFreecam();
            else stopFreecam();
        }
    }

    function selectPlayer() {
        if(!select.value) return;

        spectating = true;
        freecamming = false;
        stopFreecam();

        let char = getUnsafeWindow().stores.phaser.scene.characterManager.characters.get(select.value);
        if(!char) return;

        let camHelper = getUnsafeWindow().stores.phaser.scene.cameraHelper;
        camHelper.startFollowingObject({ object: char.body });
    }
</script>

<svelte:window on:keydown={onKeydown} on:keyup={onKeyup} />

<Group name="Freecam">
    <Button disabled={!$storesLoaded} disabledMsg="Camera hasn't loaded"
    on:click={onBtnClick}>
        {#if spectating}
            Stop Spectating
        {:else}
            {freecamming ? "Stop" : "Start"} Freecam
        {/if}
    </Button>
    <Slider title="Camera Zoom" min={0.1} max={5} step={0.1} on:input={setZoom}
    disabled={!$storesLoaded} value={zoomValue} disabledMsg="Camera hasn't loaded" />
    <select disabled={specCharacters.length === 0} on:change={selectPlayer} bind:this={select}
    on:keydown|preventDefault
    title={specCharacters.length === 0 ? "No characters to spectate" : undefined}>
        <option value="" selected>Pick a player to spectate</option>
        {#each specCharacters as char}
            <option value={char.id}>{char.name}</option>
        {/each}
    </select>
</Group>

<style>
    select {
        width: calc(100% - 10px);
        padding: 5px;
        margin-left: 5px;
        margin-right: 5px;
        color: black;
    }
    select[disabled] {
        cursor: not-allowed;
    }
</style>