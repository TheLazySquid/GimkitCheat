<script lang="ts">
    import Group from "../../hud/Group.svelte";
    import PurchaseAnywhere from "../shared/PurchaseAnywhere.svelte";
</script>

<Group name="One Way Out">
    <PurchaseAnywhere displayText="Med Pack" reusable={true}
        selector={{ options: { grantedItemId: "medpack" }}} />
    <PurchaseAnywhere displayText="Shield Can" reusable={true}
        selector={{ options: { grantedItemId: "shield-can" }}} />
</Group>