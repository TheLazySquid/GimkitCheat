<script lang="ts">
    import ToggleButton from '../../hud/components/ToggleButton.svelte'
    import Group from '../../hud/Group.svelte'
    import socketManager from '../../network/socketManager'

    // taken from https://github.com/Noble-Mushtak/Gimkit-Strategy/ which is no longer accurate
    const upgradesToGet = [
        ["Streak Bonus", 2, 1e4],
        ["Money Per Question", 3, 5e3],
        ["Streak Bonus", 3, 1e5],
        ["Multiplier", 3, 15e4],
        ["Streak Bonus", 4, 1e6],
        ["Multiplier", 4, 1e6],
        ["Money Per Question", 5, 5e6],
        ["Streak Bonus", 5, 1e7],
        ["Multiplier", 5, 6e6],
        ["Money Per Question", 6, 375e5],
        ["Multiplier", 6, 425e5],
        ["Streak Bonus", 6, 1e8],
        ["Streak Bonus", 7, 1e9],
        ["Streak Bonus", 8, 1e10],
        ["Multiplier", 7, 35e7],
        ["Money Per Question", 9, 5e9],
        ["Multiplier", 8, 325e7],
        ["Streak Bonus", 9, 1e11],
        ["Multiplier", 9, 325e8],
        ["Streak Bonus", 10, 1e12],
        ["Money Per Question", 10, 5e10],
        ["Multiplier", 10, 5e11]
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

<Group name="Super Rich Mode">
    <ToggleButton onText="Stop auto purchasing" offText="Auto Purchase Upgrades" hotkeyId="richModeAutoPurchase"
    on:click={onClick} disabled={money == null} disabledMsg="Money hasn't loaded yet" />
</Group>