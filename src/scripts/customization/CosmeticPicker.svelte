<script lang="ts">
    import Group from '../../hud/Group.svelte';
    import Button from '../../hud/components/Button.svelte';
    import { playerId } from '../../stores';
    import { getUnsafeWindow } from '../../utils';
    import { serializer } from '../../network/schemaDecode';
    import { knownSkins, knownTrails } from './knownCosmetics';
    import InputWithSelect from '../../hud/components/InputWithSelect.svelte';

    let skinId: string = '';
    let trailId: string = '';
    let gotSkinId: boolean = false;

    serializer.addEventListener('patch', onPatch);

    function onPatch () {
        let character = serializer.getState()?.characters?.[$playerId];
        if(!character) return;

        skinId = character.appearance.skinId;
        trailId = character.appearance.trailId;
        gotSkinId = true;

        serializer.removeEventListener('patch', onPatch);
    }

    function apply () {
        let char = getUnsafeWindow()?.stores?.phaser?.scene?.characterManager?.characters?.get($playerId)
        if(!char) return;

        if(skinId != "") {
            let setSkinId = skinId;
            if(!setSkinId.startsWith('character_')) setSkinId = 'character_' + setSkinId;
            char.skin.updateSkin(setSkinId);
        }

        if(trailId != "") {
            let setTrailId = trailId;
            if(!setTrailId.startsWith('trail_')) setTrailId = 'trail_' + setTrailId;
            char.characterTrail.updateAppearance(setTrailId);
        }
    }
</script>

<Group name="Cosmetic Picker">
    <div class="disclaimer">
        These only work client-side. Nobody else can see these cosmetics.
    </div>
    <div class="description">
        Skin ID
    </div>
    <InputWithSelect selectOptions={knownSkins} bind:value={skinId} />
    <div class="description">
        Trail ID
    </div>
    <InputWithSelect selectOptions={knownTrails} bind:value={trailId} />
    <Button disabled={!gotSkinId} disabledMsg="Character hasn't loaded" on:click={apply}>
        Apply
    </Button>
</Group>

<style>
    .disclaimer {
        margin-left: 5px;
        margin-right: 5px;
        text-align: center;
    }

    .description {
        width: 100%;
        text-align: center;
    }
</style>