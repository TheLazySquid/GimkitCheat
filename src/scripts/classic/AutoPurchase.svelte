<script lang="ts">
    import ToggleButton from '../../hud/components/ToggleButton.svelte'
    import Group from '../../hud/Group.svelte'
    import socketManager from '../../network/socketManager'
    import Powerups from '../powerups/Powerups.svelte';

    const upgradesToGet = [
        ["Streak Bonus", 2, 20],
        ["Money Per Question", 3, 100],
        ["Streak Bonus", 3, 200],
        ["Multiplier", 3, 300],
        ["Streak Bonus", 4, 2e3],
        ["Multiplier", 4, 2e3],
        ["Money Per Question", 5, 1e4],
        ["Streak Bonus", 5, 2e4],
        ["Multiplier", 5, 12e3],
        ["Money Per Question", 6, 75e3],
        ["Multiplier", 6, 85e3],
        ["Streak Bonus", 6, 2e5],
        ["Streak Bonus", 7, 2e6],
        ["Streak Bonus", 8, 2e7],
        ["Multiplier", 7, 7e5],
        ["Money Per Question", 9, 1e7],
        ["Multiplier", 8, 65e5],
        ["Streak Bonus", 9, 2e8],
        ["Multiplier", 9, 65e6],
        ["Streak Bonus", 10, 2e9],
        ["Money Per Question", 10, 1e8],
        ["Multiplier", 10, 1e9]
    ]

    enum UpgradeType {
        "Insurance" = "insurance",
        "Money Per Question" = "moneyPerQuestion",
        "Multiplier" = "multiplier",
        "Streak Bonus" = "streakBonus"
    }
    
    let money: number | null = null;
    let upgradeLevels: Record<string, number> = {};

    let autoBuy = false;

    socketManager.addEventListener("blueboatMessage", (e: CustomEvent<any>) => {
        if(e.detail.data?.type == "UPGRADE_LEVELS") {
            upgradeLevels = e.detail.data.value;
            // delete any upgrades that we already have
            for(let i = 0; i < upgradesToGet.length; i++) {
                let upgrade = upgradesToGet[i];
                // check if we have the upgrade
                let upgradeAmount = upgradeLevels[UpgradeType[upgrade[0] as keyof typeof UpgradeType]];
                if(upgradeAmount >= (upgrade[1] as number)) {
                    upgradesToGet.splice(i, 1);
                    i--;
                }
            }
        }

        if(e.detail.data?.type == "BALANCE") {
            money = e.detail.data.value;
            checkAutoBuy();
        }
    })

    function checkAutoBuy() {
        if(!autoBuy) return;

        let upgrade = upgradesToGet[0];
        if(!upgrade) return;

        if(money >= (upgrade[2] as number)) {
            purchaseUpgrade(upgrade[0] as string, upgrade[1] as number);
        }
    }

    function purchaseUpgrade(name: string, level: number) {
        socketManager.sendMessage("UPGRADE_PURCHASED", {
            upgradeName: name,
            level
        });
    }

    function onClick(message: CustomEvent<boolean>) {
        if(message.detail) {
            autoBuy = true;
            checkAutoBuy();
        } else {
            autoBuy = false;
        }
    }
</script>

<Group name="Classic">
    <ToggleButton onText="Stop auto purchasing" offText="Auto Purchase Upgrades" hotkeyId="classicAutoPurchase"
    on:click={onClick} disabled={money == null} disabledMsg="Money hasn't loaded yet" />
    <Powerups />
</Group>