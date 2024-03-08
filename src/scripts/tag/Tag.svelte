<script lang="ts">
    import PurchaseAnywhere from "../shared/PurchaseAnywhere.svelte";
    import Group from "../../hud/Group.svelte";
    import { getUnsafeWindow } from "../../utils";
</script>

<Group name="Tag">
    <PurchaseAnywhere displayText="Speed Upgrade"
        selector={{ options: { grantedItemName: "Speed Upgrade" }}} />
    <PurchaseAnywhere displayText="Efficiency Upgrade"
        selector={{ options: { grantedItemName: "Efficiency Upgrade" }}} />
    <PurchaseAnywhere displayText="Energy Per Question Upgrade"
        selector={{ options: { grantedItemName: "Energy Per Question Upgrade" }}} />
    <PurchaseAnywhere displayText="Endurance Upgrade"
        selector={{ options: { grantedItemName: "Endurance Upgrade" }}} />
</Group>