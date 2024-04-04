<script lang="ts">
    import Menu from "./Menu.svelte";
    import Group from "./Group.svelte";
    import ColorPicker from "./components/ColorPicker.svelte";
    
    import { showHud } from '../stores';
    import keybindManager from "../keybindManager";
    import ResetStyles from "./ResetStyles.svelte" ;
    
    import AutoAnswer from "../scripts/AutoAnswer.svelte";
    import InstantUse from "../scripts/2d/InstantUse.svelte";
    import CosmeticPicker from "../scripts/customization/CosmeticPicker.svelte";
    import CustomTheme from "../scripts/customization/customTheme/CustomTheme.svelte";
    import PlayerHighlighter from "../scripts/2d/PlayerHighlighter.svelte";
    import Freecam from "../scripts/2d/Freecam.svelte";
    import HideEnergyPopup from "../scripts/2d/HideEnergyPopup.svelte";
    import ClassicAutoPurchase from "../scripts/classic/AutoPurchase.svelte";
    import RichAutoPurchase from "../scripts/superRichMode/AutoPurchase.svelte";
    import ShowImposters from "../scripts/trustNoOne/ShowImposters.svelte";
    import Ctf from "../scripts/ctf/Ctf.svelte";
    import Tag from "../scripts/tag/Tag.svelte";
    import OneWayOut from "../scripts/oneWayOut/OneWayOut.svelte";
    import Snowbrawl from "../scripts/snowbrawl/Snowbrawl.svelte";
    import FloorIsLava from "../scripts/floorIsLava/FloorIsLava.svelte";
    import Farmchain from "../scripts/farmchain/Farmchain.svelte";
    import Movement from "../scripts/2d/Movement.svelte";
    import DigItUp from "../scripts/digItUp/DigItUp.svelte";

    keybindManager.addKeybind(new Set(["\\"]), () => {
        showHud.update(v => !v);
    })
</script>

<div id="gc-hud" style="display: {$showHud ? 'block' : 'none'}">
    <Menu name="Customization">
        <Group name="HUD Appearance">
            <ColorPicker text="Text Color" bindValue="textColor" minOpactiy={0.3} />
            <Group name="Menu Appearance">
                <ColorPicker text="Background Color" bindValue="menuBackgroundColor" />
                <ColorPicker text="Outline Color" bindValue="menuOutlineColor" />
                <ColorPicker text="Header Color" bindValue="menuHeaderBackgroundColor" />
                <ColorPicker text="Header Text Color" bindValue="menuHeaderTextColor" />
            </Group>
            <Group name="Button Appearance">
                <ColorPicker text="Background Color" bindValue="buttonBackgroundColor" />
                <ColorPicker text="Outline Color" bindValue="buttonBorderColor" />
            </Group>
        </Group>
        <ResetStyles />
        <CosmeticPicker />
        <CustomTheme />
    </Menu>

    <Menu name="General Cheats">
        <AutoAnswer />
        <InstantUse />
        <Movement />
        <PlayerHighlighter />
        <Freecam />
        <HideEnergyPopup />
    </Menu>

    <Menu name="Gamemode Specific Cheats">
        <ClassicAutoPurchase />
        <RichAutoPurchase />
        <DigItUp />
        <Ctf />
        <Tag />
        <OneWayOut />
        <Snowbrawl />
        <FloorIsLava />
        <ShowImposters />
        <Farmchain />
    </Menu>
</div>

<style>
#gc-hud {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 9999999999;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
    color: var(--textColor);
}
</style>