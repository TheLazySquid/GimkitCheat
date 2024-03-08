<script lang="ts">
    import ToggleButton from "../../hud/components/ToggleButton.svelte";
import socketManager from "../../network/socketManager";

    const structures: [string, number][] = [
        ["spaceElevator", 5e7],
        ["mountain", 5e6],
        ["skyscaper", 5e5], // not a typo, it's actually called "skyscaper"
        ["shoppingMall", 5e4],
        ["house", 5e3],
        ["wall", 5e2], // called "staircase" ingame
        ["brick", 50],
        ["plank", 5]
    ]

    let money: number | null = null;
    let enabled = false;
    let cooldown = false;

    socketManager.addEventListener('blueboatMessage', (e: CustomEvent<any>) => {
        if(e.detail.data?.type == "BALANCE") {
            money = e.detail.data.value;

            if(enabled) {
                checkAutoBuy();
            }
        }
    })

    function checkAutoBuy() {
        if(cooldown || !enabled) return;

        cooldown = true;
        setTimeout(() => {
            cooldown = false;
            checkAutoBuy();
        }, 150);

        for(let structure of structures) {
            if(money >= structure[1]) {
                buyStructure(structure[0]);
                break;
            }
        }
    }

    function buyStructure(type: string) {
        socketManager.sendMessage("LAVA_PURCHASE_PIECE", {
            type
        })
    }

    function onClick(message: CustomEvent<boolean>) {
        enabled = message.detail;
        checkAutoBuy();
    }
</script>

<ToggleButton offText="Enable Auto Buy" onText="Disable Auto Buy"
hotkeyId="floorIsLavaAutoBuy" bind:enabled={enabled} on:click={onClick} />