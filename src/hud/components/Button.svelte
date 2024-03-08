<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import Hotkey from "./Hotkey.svelte";

    export let disabled: boolean | undefined | null = null;
    export let disabledMsg: string | undefined = undefined;
    export let hotkeyId: string | undefined = undefined;

    let dispatch = createEventDispatcher();
    let button: HTMLButtonElement;

    let active = false;
    
    function onClick() {
        dispatch("click");
    }

    function trigger() {
        dispatch("click");
        active = true;
        setTimeout(() => active = false, 100);
    }
</script>

<div class="wrap">
    <button on:click={onClick} disabled={disabled === true || disabled === undefined} title={disabled ? disabledMsg : undefined}
    bind:this={button} class:active={active} on:keydown|preventDefault>
        <slot />
    </button>
    
    {#if hotkeyId}
        <Hotkey on:trigger={trigger} {hotkeyId} />
    {/if}
</div>

<style>
    .wrap {
        display: flex;
        flex-wrap: nowrap;
        align-items: center;
        justify-content: space-between;
        margin: 5px 10px;
    }

    button {
        background-color: var(--buttonBackgroundColor);
        border: 1px solid var(--buttonBorderColor);
        border-radius: 5px;
        transition: transform 0.1s;
        flex-grow: 1;
    }

    button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    button:active, button.active {
        transform: scale(0.95);
    }
</style>