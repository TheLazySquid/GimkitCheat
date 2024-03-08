<script lang="ts">
    import ToggleButton from "../../hud/components/ToggleButton.svelte";
    import keybindManager from "../../keybindManager";
    import { getUnsafeWindow } from "../../utils";

    let enabled = true;
    keybindManager.addKeybind(new Set(["enter"]), useNearest)

    function useNearest() {
		if(!enabled) return
		
        let win = getUnsafeWindow();
        
        let devices = win?.stores?.phaser?.scene?.worldManager?.devices?.devicesInView
		let body = win?.stores?.phaser?.mainCharacter?.body

		if(!devices || !body) return

		let closest = null
		let closestDistance = Infinity

		// Find the closest device with interactive zones
		for(let device of devices) {
			if(device.interactiveZones.zones.length == 0) continue
			let distance = Math.sqrt(Math.pow(device.x - body.x, 2) + Math.pow(device.y - body.y, 2))
			
			if(distance < closestDistance) {
				closest = device
				closestDistance = distance
			}
		}

		if(!closest) return

		closest?.interactiveZones?.onInteraction?.()
    } 
</script>

<ToggleButton onText="Stop instant use" offText="Enable instant use"
bind:enabled={enabled} hotkeyId="instantUse" />