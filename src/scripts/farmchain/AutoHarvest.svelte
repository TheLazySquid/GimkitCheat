<script lang="ts">
    import socketManager from "../../network/socketManager";
    import { IDeviceChange } from "../../types";
    import ToggleButton from "../../hud/components/ToggleButton.svelte";

    let autoHarvesting = false

    socketManager.addEventListener('deviceChanges', (e: CustomEvent<IDeviceChange[]>) => {
        if(!autoHarvesting) return

        let changes: any[] = e.detail;

        for(let change of changes) {
            for(let key in change.data) {
                if(!key.endsWith("status") || change.data[key] != "availableForCollection") continue

                // harvest it
                let packet = {
                    key: "collect",
                    deviceId: change.id
                }

                socketManager.sendMessage("MESSAGE_FOR_DEVICE", packet)
            }
        }
    })
</script>

<ToggleButton bind:enabled={autoHarvesting} hotkeyId="farmchainAutoHarvest"
offText="Start Auto Harvesting" onText="Stop Auto Harvesting" />