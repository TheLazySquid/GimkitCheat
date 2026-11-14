<script lang="ts">
    import Button from "../../hud/components/Button.svelte";
    import { devicesLoaded } from "../../stores";
    import { get } from "svelte/store";
    import { onDestroy } from "svelte";
    import { getUnsafeWindow } from "../../utils";

    export let selector: any;
    export let displayText: string;
    export let reusable: boolean = false;
    export let cost: number | undefined = undefined;

    let purchaseDevices: any[] = [];

    function matchesSelector(device: any) {
        for(let [category, matchFields] of Object.entries(selector)) {
            for(let [key, value] of Object.entries(matchFields)) {
                let actual = device?.[category]?.[key];
                if(typeof value == "function") {
                    if(actual != value()) return false;
                } else if(typeof value == "string" && value.endsWith("*")) {
                    if(!actual?.startsWith?.(value.slice(0, -1))) return false;
                } else if(actual != value) {
                    return false;
                }
            }
        }
        return true;
    }

    // Re-run the selector regularly: some selectors depend on values (like the
    // player's team) that aren't set yet when the devices first load, and the
    // device objects can be replaced by the game.
    function refreshDevices() {
        let devices = getUnsafeWindow()?.stores?.phaser?.scene?.worldManager?.devices?.allDevices;
        if(!devices) return;

        purchaseDevices = devices
            .filter((device: any) => matchesSelector(device) && (reusable || device?.state?.active !== false))
            .sort((a: any, b: any) => a?.options?.amountOfRequiredItem - b?.options?.amountOfRequiredItem);
    }

    devicesLoaded.subscribe((value) => {
        if(value) refreshDevices();
    })

    const refreshInterval = setInterval(() => {
        if(get(devicesLoaded)) refreshDevices();
    }, 1000);
    onDestroy(() => clearInterval(refreshInterval));

    async function purchase() {
        refreshDevices();
        purchaseDevices[0]?.interactiveZones?.onInteraction?.();

        if(reusable) return;

        // wait for the purchase to go through, then drop it if it succeeded
        await new Promise((resolve) => setTimeout(resolve, 500));
        refreshDevices();
    }
</script>

<Button disabled={!$devicesLoaded || purchaseDevices.length == 0} disabledMsg={!$devicesLoaded ? "Devices haven't loaded yet" : "No matching purchase devices"}
on:click={purchase} >
    Purchase {displayText}
    {#if purchaseDevices.length > 0 && (purchaseDevices[0]?.options?.amountOfRequiredItem || cost)}
        ({cost ?? purchaseDevices[0]?.options?.amountOfRequiredItem})
    {/if}
</Button>