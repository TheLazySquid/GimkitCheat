<script lang="ts">
    import Group from "../../hud/Group.svelte";
    import PurchaseAnywhere from "../shared/PurchaseAnywhere.svelte";
    import Rapidfire from "../shared/Rapidfire.svelte";
</script>

<Group name="Snowbrawl">
    <PurchaseAnywhere displayText="Med Pack" reusable={true}
        selector={{ options: { grantedItemId: "medpack" }}} />
    <PurchaseAnywhere displayText="Shield Can" reusable={true}
        selector={{ options: { grantedItemId: "shield-can" }}} />
    <Rapidfire message="Rapid fire" hotkeyId="snowbrawlRapidFire" />
</Group>