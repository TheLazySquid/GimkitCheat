<script lang="ts">
    import Button from "../../hud/components/Button.svelte";
    import { devicesLoaded } from "../../stores";
    import { getUnsafeWindow } from "../../utils";

    export let selector: any;
    export let displayText: string;
    export let reusable: boolean = false;
    export let cost: number | undefined = undefined;

    let purchaseDevices: any[] = [];

    devicesLoaded.subscribe((value) => {
        if(!value) return;

        let devices = getUnsafeWindow()?.stores?.phaser?.scene?.worldManager?.devices?.allDevices

        purchaseDevices = devices.filter((device: any) => {
            let matches = true;
            for(let [category, matchFields] of Object.entries(selector)) {
                for(let [key, value] of Object.entries(matchFields)) {
                    if(value.endsWith?.("*")) {
                        value = value.slice(0, -1)
                        if(!device?.[category]?.[key]?.startsWith(value)) {
                            matches = false;
                            break
                        }
                    } else if (typeof value == "function") {
                        if(device?.[category]?.[key] != value()) {
                            matches = false;
                            break
                        }
                    } else {
                        // find an exact match
                        if(device?.[category]?.[key] != value) {
                            matches = false;
                            break
                        }
                    }
                }
            }
            return matches
        })
        
        purchaseDevices.sort((a, b) => a?.options?.amountOfRequiredItem - b?.options?.amountOfRequiredItem)
    })

    async function purchase() {
        let devices = getUnsafeWindow()?.stores?.phaser?.scene?.worldManager?.devices?.allDevices

        // this code has been here a while and I don't know what exactly it does but I don't dare remove it
        if(!purchaseDevices[0]?.interactiveZones?.onInteraction) {
            purchaseDevices = purchaseDevices.map((device: any) => {
                return devices.find((d: any) => d.id == device.id)
            })
            return
        }

        purchaseDevices[0]?.interactiveZones?.onInteraction();

        if(reusable) return;

        // check whether it was successfully purchased
        // wait 500ms for the purchase to go through
        await new Promise((resolve) => setTimeout(resolve, 500))

        if(purchaseDevices[0].state.active) return // it wasn't purchased
        purchaseDevices.shift()
        purchaseDevices = purchaseDevices;
    }
</script>

<Button disabled={!$devicesLoaded || purchaseDevices.length == 0} disabledMsg={!$devicesLoaded ? "Devices haven't loaded yet" : "No matching purchase devices"}
on:click={purchase} >
    Purchase {displayText}
    {#if purchaseDevices.length > 0 && (purchaseDevices[0]?.options?.amountOfRequiredItem || cost)}
        ({cost ?? purchaseDevices[0]?.options?.amountOfRequiredItem})
    {/if}
</Button>