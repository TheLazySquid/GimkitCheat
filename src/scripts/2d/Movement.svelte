<script lang="ts">
    import { getUnsafeWindow } from '../../utils';
    import { storesLoaded } from '../../stores';
    import ToggleButton from '../../hud/components/ToggleButton.svelte';
    import Slider from '../../hud/components/Slider.svelte';
    import Group from '../../hud/Group.svelte';

    const maxSpeedupMultiplier = 490/357; // gathered from some testing, any higher and we get teleported back

    // this file is a hot mess, but it works
    let speedupMultiplier = 1;
    let nativeSpeed: number = -1;
    let lastSetTo: undefined | number = undefined;
    let speedupEnabled = false;

    function enableSpeedup(value: boolean) {
        if(!getUnsafeWindow()?.stores?.me) return;

        // restore or set the speed
        if(!value) {
            getUnsafeWindow().stores.me.movementSpeed = nativeSpeed;
        } else {
            let newSpeed = nativeSpeed * speedupMultiplier;
            lastSetTo = newSpeed;
            getUnsafeWindow().stores.me.movementSpeed = newSpeed;
        }
    }

    setInterval(checkSpeed, 500);

    function checkSpeed() {
        if(!getUnsafeWindow()?.stores?.me) return;

        // 2d modes
        let currentSpeed = getUnsafeWindow().stores.me.movementSpeed;
        if(currentSpeed !== lastSetTo) {
            nativeSpeed = currentSpeed;
            if(speedupEnabled) enableSpeedup(true);
        }
    }

    function onSpeedupMultChange(value: CustomEvent<number>) {
        speedupMultiplier = value.detail;

        if(!getUnsafeWindow()?.stores?.me || !speedupEnabled) return;

        let newSpeed = nativeSpeed * value.detail;
        lastSetTo = newSpeed;
        getUnsafeWindow().stores.me.movementSpeed = newSpeed;
    }
</script>

<Group name="Movement">
    <Slider title="Speedup Amount" min={1} max={maxSpeedupMultiplier} step={0.005}
    on:input={onSpeedupMultChange} bind:value={speedupMultiplier} />
    <ToggleButton disabled={!$storesLoaded} onText="Speedup: On" offText="Speedup: Off"
    on:click={(e) => enableSpeedup(e.detail)} bind:enabled={speedupEnabled} hotkeyId="speedup" />
</Group>