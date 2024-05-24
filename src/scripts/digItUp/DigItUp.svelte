<script lang="ts">
    import Group from "../../hud/Group.svelte";
    import Purchasers from "./Purchasers.svelte";
    import Rapidfire from "../shared/Rapidfire.svelte";
</script>

<Group name="Dig it Up">
    <Rapidfire message="Speedmine" hotkeyId="speedMine" />
    <Purchasers />
</Group>