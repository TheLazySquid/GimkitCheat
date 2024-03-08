<script lang="ts">
    import Button from "./Button.svelte";
    import { createEventDispatcher } from "svelte";
    
    export let onText: string;
    export let offText: string;
    export let enabled: boolean = false;
    export let disabled: boolean | undefined | null = null;
    export let disabledMsg: string | undefined = undefined;
    export let hotkeyId: string | undefined = undefined;

    let dispatch = createEventDispatcher();

    function onClick() {
        enabled = !enabled;
        dispatch("click", enabled);
    }
</script>

<Button on:click={onClick} {disabled} {disabledMsg} {hotkeyId}>
    {#if enabled}
        {onText}
    {:else}
        {offText}
    {/if}
</Button>