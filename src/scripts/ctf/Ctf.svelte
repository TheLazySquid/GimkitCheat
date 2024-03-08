<script lang="ts">
    import PurchaseAnywhere from "../shared/PurchaseAnywhere.svelte";
    import Group from "../../hud/Group.svelte";
    import { getUnsafeWindow } from "../../utils";
</script>

<Group name="Capture the Flag">
    <PurchaseAnywhere displayText="Speed Upgrade"
        selector={{ options: { grantedItemName: "Speed Upgrade" }}} />
    <PurchaseAnywhere displayText="Efficiency Upgrade"
        selector={{ options: { grantedItemName: "Efficiency Upgrade" }}} />
    <PurchaseAnywhere displayText="Energy Per Question Upgrade"
        selector={{ options: { grantedItemName: "Energy Per Question Upgrade" }}} />
    <PurchaseAnywhere displayText="Invisabits" reusable={true}
        selector={{ options: { grantedItemId: "silver-ore" }}} />
    <PurchaseAnywhere displayText="Barrier"
        selector={{
            state: { active: true },
            options: { grantedItemName: "Barrier*",
            allowedPurchaseTeam: () => getUnsafeWindow()?.stores?.phaser?.mainCharacter?.teamId }
        }} />
    <PurchaseAnywhere displayText="Big Barrier"
        selector={{
            state: { active: true },
            options: { grantedItemName: "Big Barrier*",
            allowedPurchaseTeam: () => getUnsafeWindow()?.stores?.phaser?.mainCharacter?.teamId }
        }} />
</Group>