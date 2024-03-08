<script lang="ts">
    import Group from '../../hud/Group.svelte'
    import AutoPlant from './AutoPlant.svelte';
    import AutoHarvest from './AutoHarvest.svelte';
    import PurchaseAnywhere from '../shared/PurchaseAnywhere.svelte'
</script>

<Group name="Farmchain">
    <AutoHarvest />
    <AutoPlant />
    <Group name="Purchase Seeds">
        <PurchaseAnywhere displayText="Corn Seed" reusable={true}
            selector={{ options: { grantedItemId: "yellow-seed" }}} />
        <PurchaseAnywhere displayText="Wheat Seed" reusable={true}
            selector={{ options: { grantedItemId: "tan-seed" }}} />
        <PurchaseAnywhere displayText="Potato Seed" reusable={true}
            selector={{ options: { grantedItemId: "brown-seed" }}} />
        <PurchaseAnywhere displayText="Grape Seed" reusable={true}
            selector={{ options: { grantedItemId: "purple-seed" }}} />
        <PurchaseAnywhere displayText="Raspberry Seed" reusable={true}
            selector={{ options: { grantedItemId: "magenta-seed" }}} />
        <PurchaseAnywhere displayText="Watermelon Seed" reusable={true}
            selector={{ options: { grantedItemId: "green-seed" }}} />
        <PurchaseAnywhere displayText="Coffee Bean Seed" reusable={true}
            selector={{ options: { grantedItemId: "bronze-seed" }}} />
        <PurchaseAnywhere displayText="Orange Seed" reusable={true}
            selector={{ options: { grantedItemId: "orange-seed" }}} />
        <PurchaseAnywhere displayText="Gimberry Seed" reusable={true}
            selector={{ options: { grantedItemId: "gold-seed" }}} />
        <PurchaseAnywhere displayText="Cash Berry Seed" reusable={true}
            selector={{ options: { grantedItemId: "dark-green-seed" }}} />
        <PurchaseAnywhere displayText="Pepper Seed" reusable={true}
            selector={{ options: { grantedItemId: "red-seed" }}} />
        <PurchaseAnywhere displayText="Energy Bar Seed" reusable={true}
            selector={{ options: { grantedItemId: "blue-seed" }}} />
        <PurchaseAnywhere displayText="Lottery Ticket Seed" reusable={true}
            selector={{ options: { grantedItemId: "teal-seed" }}} />
    </Group>
    <Group name="Unlock Seeds">
        <PurchaseAnywhere displayText="Unlock Wheat Seed"
            selector={{ options: { grantedItemName: "Wheat Seed Unlock" }}} />
        <PurchaseAnywhere displayText="Unlock Potato Seed"
            selector={{ options: { grantedItemName: "Potato Seed Unlock" }}} />
        <PurchaseAnywhere displayText="Unlock Grape Seed"
            selector={{ options: { grantedItemName: "Grape Seed Unlock" }}} />
        <PurchaseAnywhere displayText="Unlock Raspberry Seed"
            selector={{ options: { grantedItemName: "Raspberry Seed Unlock" }}} />
        <PurchaseAnywhere displayText="Unlock Watermelon Seed"
            selector={{ options: { grantedItemName: "Watermelon Seed Unlock" }}} />
        <PurchaseAnywhere displayText="Unlock Coffee Bean Seed"
            selector={{ options: { grantedItemName: "Coffee Bean Seed Unlock" }}} />
        <PurchaseAnywhere displayText="Unlock Orange Seed"
            selector={{ options: { grantedItemName: "Orange Seed Unlock" }}} />
        <PurchaseAnywhere displayText="Unlock Gimberry Seed"
            selector={{ options: { grantedItemName: "Gimberry Seed Unlock" }}} />
    </Group>
</Group>