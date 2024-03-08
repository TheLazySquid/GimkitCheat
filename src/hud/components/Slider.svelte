<script lang="ts">
    import { createEventDispatcher } from "svelte";

    export let title: string;
    export let min: number;
    export let max: number;
    export let value: number = (min + max) / 2;
    export let step: number = 1;
    export let disabled: boolean | undefined | null = null;
    export let disabledMsg: string | undefined = undefined;

    let dispatch = createEventDispatcher();
    let input: HTMLInputElement; 

    function onInput() {
        dispatch("input", parseFloat(input.value));
    }
</script>

<div class="sliderWrap" class:disabled={disabled === true || disabled === undefined}>
    <div>{title}</div>
    <input type="range" min={min} max={max} bind:value step={step} on:mousedown|stopPropagation on:keydown|preventDefault
    on:input={onInput} bind:this={input} title={disabled ? disabledMsg : undefined}
    disabled={disabled === true || disabled === undefined} />
</div>

<style>
    .sliderWrap {
        display: flex;
        flex-direction: column;
        align-items: center;
        margin: 5px 10px;
    }

    .sliderWrap.disabled {
        opacity: 0.5;
    }

    input {
        flex-grow: 1;
        width: 100%;
    }

    input[disabled] {
        cursor: not-allowed;
    }
</style>