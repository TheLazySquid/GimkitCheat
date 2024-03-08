<script lang="ts">
    import KeyboardOutline from 'svelte-material-icons/KeyboardOutline.svelte'
    import { onMount, createEventDispatcher } from 'svelte';
    import keybindManager from '../../keybindManager';
    import KeybindCreator from '../KeybindCreator.svelte';
    import { getHotkey, setHotkey } from '../hudVarsManager'

    export let hotkeyId: string;
    let dispatch = createEventDispatcher();
    let keybindCreatorOpen = false;

    let keybind = new Set<string>(getHotkey(hotkeyId) ?? []);

    function onCreatorClose(result: CustomEvent<Set<string> | null>) {
        keybindCreatorOpen = false;
        if(!result.detail) return;

        // gotta keep the refrence
        keybind.clear();
        for(let key of result.detail) {
            keybind.add(key);
        }
        
        setHotkey(hotkeyId, Array.from(keybind));
    }

    onMount(() => {
        keybindManager.addKeybind(keybind, () => {
            dispatch('trigger');
        });
    });
</script>

{#if keybindCreatorOpen}
    <KeybindCreator keys={keybind} on:close={onCreatorClose} />
{/if}

<button on:click={() => keybindCreatorOpen = !keybindCreatorOpen}>
    <KeyboardOutline width={30} height={30} />
</button>

<style>
    button {
        background-color: transparent;
        border: none;
        height: 30px;
        margin: 0px;
        padding-right: 0px;
    }
</style>