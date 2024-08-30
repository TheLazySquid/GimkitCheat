<script lang="ts">
    import ToggleButton from "../../hud/components/ToggleButton.svelte";
    import keybindManager from "../../keybindManager";
    import { getUnsafeWindow } from "../../utils";
    import Group from "../../hud/Group.svelte";
    import MegaBonus from "./MegaBonus.svelte";
    import MiniBouns from "./MiniBouns.svelte";
    import MinuteToWinIt from "./MinuteToWinIt.svelte";
    import Quadgrader from "./Quadgrader.svelte";
    import Rebooter from "./Rebooter.svelte";

    let enabled = true;

 
</script>

<Group name="Powerups">
<Rebooter />
<Quadgrader />
<MinuteToWinIt />
<MiniBouns />
<MegaBonus />
</Group>

