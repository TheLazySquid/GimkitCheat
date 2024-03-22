<script lang="ts">
    import { getUnsafeWindow } from '../../utils';
    import { storesLoaded } from '../../stores';
    import ToggleButton from '../../hud/components/ToggleButton.svelte';

    const speedupMultiplier = 600/500; // gathered from some testing, any higher and we get teleported back

    let nativeSpeed: number = 550;
    let lastSetTo: undefined | number = undefined;
    let speedupEnabled = false;

    function enableSpeedup(value: boolean) {
        if(!getUnsafeWindow()?.stores?.me) return;

        if(!value) {
            getUnsafeWindow().stores.me.movementSpeed = nativeSpeed;
        } else {
            let newSpeed = nativeSpeed * speedupMultiplier;
            lastSetTo = newSpeed;
            getUnsafeWindow().stores.me.movementSpeed = newSpeed;
        }
    }

    setInterval(checkSpeed, 8000); // experimented and with this you only slightly get laggedback

    function checkSpeed() {
        if(!getUnsafeWindow()?.stores?.me) return;

        let currentSpeed = getUnsafeWindow().stores.me.movementSpeed;
        if(currentSpeed !== lastSetTo) {
            nativeSpeed = currentSpeed;
            if(speedupEnabled) enableSpeedup(true);
        }
    }
</script>

<ToggleButton disabled={!$storesLoaded} onText="Speedup: On" offText="Speedup: Off"
on:click={(e) => enableSpeedup(e.detail)} bind:enabled={speedupEnabled} hotkeyId="speedup" />
