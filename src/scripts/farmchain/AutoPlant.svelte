<script lang="ts">
    import socketManager from "../../network/socketManager";
    import { devicesLoaded } from "../../stores";
    import { getUnsafeWindow } from "../../utils";
    import ToggleButton from "../../hud/components/ToggleButton.svelte";
    
    const seedRanking = [
        'yellow-seed',
        'tan-seed',
        'brown-seed',
        'purple-seed',
        'magenta-seed',
        'green-seed',
        'bronze-seed',
        'orange-seed',
        'gold-seed',
        'dark-green-seed',
        'red-seed',
        'blue-seed',
        'teal-seed'
    ]
    
    let autoPlantInterval: number | undefined = undefined

    function onClick(e: CustomEvent<boolean>) {
        if(e.detail) {
            let devices = getUnsafeWindow()?.stores?.phaser?.scene?.worldManager?.devices?.allDevices
            let plots = devices.filter((device: any) => device.options.style == "plant")
        
            let recipieDevices: Record<string, any> = {}
            for(let device of devices) {
                if(!seedRanking.includes(device.options?.ingredient1Item)) continue
                recipieDevices[device.options?.ingredient1Item] = device
            }
        
            // set up auto plant
            autoPlantInterval = setInterval(() => {   
                let inventory = getUnsafeWindow()?.stores?.me?.inventory?.slots as Map<string, any>
                if(!inventory) return
        
                // find the most valuable seed that we can plant
                let mostValuableSeed = undefined
                for(let seed of seedRanking) {
                    let recipie = recipieDevices[seed]
                    let canPlant = true

                    // check if we have enough of each ingredient
                    for(let i = 0; i < 5; i++) {
                        let reqIngredient = recipie?.options?.[`ingredient${i}Item`]
                        if(!reqIngredient) continue

                        if(!inventory.get(reqIngredient)?.amount >= recipie.options[`ingredient${i}Amount`]) {
                            canPlant = false
                            break
                        }
                    }
                    
                    if(canPlant) {
                        mostValuableSeed = seed
                        break
                    }
                }
        
                if(!mostValuableSeed) return
        
                // plant the seed in the last idle plot
                let plantPlot = plots.findLast((plot: any) => plot.state.status == "idle")
        
                socketManager.sendMessage("MESSAGE_FOR_DEVICE", {
                    key: "craft",
                    deviceId: plantPlot.id,
                    data: {
                        recipe: recipieDevices[mostValuableSeed].id
                    }
                })
            }, 100) as any
        } else {
            clearInterval(autoPlantInterval)
        }
    }
</script>

<ToggleButton offText="Start Auto Planting" onText="Stop Auto Planting" disabled={!$devicesLoaded}
on:click={onClick} disabledMsg="Farm plots not loaded" hotkeyId="farmchainAutoPlant"/>