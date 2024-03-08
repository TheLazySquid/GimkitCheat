<script lang="ts">
    import { createEventDispatcher } from 'svelte';

    export let name: string;
    export let value: string = "";

    const dispatch = createEventDispatcher();

    function onInput() {
        dispatch('input', value);
    }
</script>

<div class="wrap">
    <div>{name}</div>
    <input type="text" bind:value={value} on:input={onInput} 
    on:mousedown|stopPropagation spellcheck="false"/>
</div>

<style>
    .wrap {
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    input {
        color: black;
        width: 90%;
        border: none;
        border-radius: 5px;
    }
</style>