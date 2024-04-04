<script lang="ts">
    import { getUnsafeWindow } from '../../utils';
    import { storesLoaded } from '../../stores';
    import { physicsConsts } from '../../exposeValues';
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
        let mapStyle = getUnsafeWindow().stores.session.mapStyle;

        // restore or set the speed
        if(mapStyle == "platformer") {
            if(!value) {
                $physicsConsts.platformerGroundSpeed = nativeSpeed;
            } else {
                let newSpeed = nativeSpeed * speedupMultiplier;
                lastSetTo = newSpeed;
                $physicsConsts.platformerGroundSpeed = newSpeed;
            }
        } else {
            if(!value) {
                getUnsafeWindow().stores.me.movementSpeed = nativeSpeed;
            } else {
                let newSpeed = nativeSpeed * speedupMultiplier;
                lastSetTo = newSpeed;
                getUnsafeWindow().stores.me.movementSpeed = newSpeed;
            }
        }
    }

    setInterval(checkSpeed, 500);

    function checkSpeed() {
        if(!getUnsafeWindow()?.stores?.me) return;
        let mapStyle = getUnsafeWindow().stores.session.mapStyle;
        if(!mapStyle) return;

        if(mapStyle == "platformer") {
            // 2d platformer modes
            let currentSpeed = $physicsConsts.platformerGroundSpeed;
            if(currentSpeed !== lastSetTo) {
                nativeSpeed = currentSpeed;
                if(speedupEnabled) enableSpeedup(true);
            }
        } else {
            // 2d modes
            let currentSpeed = getUnsafeWindow().stores.me.movementSpeed;
            if(currentSpeed !== lastSetTo) {
                nativeSpeed = currentSpeed;
                if(speedupEnabled) enableSpeedup(true);
            }
        }
    }

    function onSpeedupMultChange(value: CustomEvent<number>) {
        speedupMultiplier = value.detail;

        if(!getUnsafeWindow()?.stores?.me || !speedupEnabled) return;
        let mapStyle = getUnsafeWindow().stores.session.mapStyle;
        if(!mapStyle) return;

        let newSpeed = nativeSpeed * value.detail;
        lastSetTo = newSpeed;

        if(mapStyle == "platformer") {
            $physicsConsts.platformerGroundSpeed = newSpeed;
        } else {
            getUnsafeWindow().stores.me.movementSpeed = newSpeed;
        }
    }

    let jumpboostEnabled = false;
    let jumpboostMultiplier = 1;
    let nativeJumpboost: number = -1;

    function enableJumpboost(value: boolean) {
        if(nativeJumpboost == -1) nativeJumpboost = $physicsConsts.jump.height;
        
        if(!value) {
            $physicsConsts.jump.height = nativeJumpboost;
        } else {
            let newJump = nativeJumpboost * jumpboostMultiplier;
            $physicsConsts.jump.height = newJump;
        }
    }

    function onJumpboostMultChange(e: CustomEvent<number>) {
        jumpboostMultiplier = e.detail;
        
        if(!jumpboostEnabled || !$physicsConsts) return;
        if(nativeJumpboost == -1) nativeJumpboost = $physicsConsts.jump.height;

        let newJump = nativeJumpboost * e.detail;
        $physicsConsts.jump.height = newJump;
    }
</script>

<Group name="Movement">
    <Slider title="Speedup Amount" min={1} max={maxSpeedupMultiplier} step={0.005}
    on:input={onSpeedupMultChange} bind:value={speedupMultiplier} />
    <ToggleButton disabled={!$storesLoaded} onText="Speedup: On" offText="Speedup: Off"
    on:click={(e) => enableSpeedup(e.detail)} bind:enabled={speedupEnabled} hotkeyId="speedup" />
    <Slider title="Jump Boost Amount" min={1} max={maxSpeedupMultiplier} step={0.005}
    on:input={onJumpboostMultChange} bind:value={jumpboostMultiplier} />
    <ToggleButton disabled={!$physicsConsts} onText="Jump Boost: On" offText="Jump Boost: Off"
    on:click={(e) => enableJumpboost(e.detail)} bind:enabled={jumpboostEnabled} hotkeyId="jumpboost" />
</Group>