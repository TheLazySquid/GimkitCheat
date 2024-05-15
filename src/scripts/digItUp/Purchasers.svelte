<script lang="ts">
    import { devicesLoaded } from "../../stores";
    import Group from "../../hud/Group.svelte";
    import { getUnsafeWindow } from "../../utils";
    import Button from "../../hud/components/Button.svelte";
    import socketManager from "../../network/socketManager";

    let permitDevices = [];
    let permitPurchaseDevice = null;

    let pickaxeDevices = [];
    let pickaxePurchaseDevice = null;

    const checkDevices = () => {
        let devices: any[] = getUnsafeWindow().stores.phaser.scene.worldManager.devices.allDevices;

        // set permit devices
        permitDevices = devices.filter(device => device.options.group === "permit upgrade");

        permitPurchaseDevice = permitDevices.find(d => d.options.message);
        permitDevices = permitDevices.filter(d => d !== permitPurchaseDevice);

        // set pickaxe devices
        pickaxeDevices = devices.filter(device => device.options.group === "pickaxe upgrade");

        pickaxePurchaseDevice = pickaxeDevices.find(d => d.options.message);
        pickaxeDevices = pickaxeDevices.filter(d => d !== pickaxePurchaseDevice);
    }

    devicesLoaded.subscribe(val => {
        if(!val) return;
        checkDevices();
    })

    function buyPermit(device: any) {
        socketManager.sendMessage("MESSAGE_FOR_DEVICE", {
            key: "action",
            deviceId: permitPurchaseDevice.id,
            data: {
                action: device.id
            }
        })
    }

    function buyPickaxe(device: any) {
        socketManager.sendMessage("MESSAGE_FOR_DEVICE", {
            key: "action",
            deviceId: pickaxePurchaseDevice.id,
            data: {
                action: device.id
            }
        })
    }
</script>

<Group name="Permits">
    {#if permitDevices.length == 0}
        <div class="notLoaded">
            Permits haven't loaded in yet
        </div>
        <Button on:click={checkDevices}>Retry</Button>
    {:else}
        {#each permitDevices as device}
            <Button on:click={() => buyPermit(device)}>
                {device.options.text}
            </Button>
        {/each}
    {/if}
</Group>
<Group name="Pickaxes">
    {#if pickaxeDevices.length == 0}
        <div class="notLoaded">
            Pickaxes haven't loaded in yet
        </div>
        <Button on:click={checkDevices}>Retry</Button>
    {:else}
        {#each pickaxeDevices as device}
            <Button on:click={() => buyPickaxe(device)}>
                {device.options.text}
            </Button>
        {/each}
    {/if}
</Group>

<style>
    .notLoaded {
        width: 100%;
        text-align: center;
    }
</style>