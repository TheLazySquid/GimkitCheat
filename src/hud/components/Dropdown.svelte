<script lang="ts">
    import { createEventDispatcher } from "svelte";

    export let options: Array<{ label: string; value: string }> = [];
    export let placeholder: string = "Select an option";
    export let selected: string = ""; // Track the selected value

    const dispatch = createEventDispatcher();

    function handleSelectionChange(event: Event) {
        selected = (event.target as HTMLSelectElement).value;
        dispatch("change", { selected });
    }
</script>

<div class="dropdown-wrap">
    <select on:change={handleSelectionChange} bind:value={selected} class="dropdown">
        <option value="" disabled selected>{placeholder}</option>
        {#each options as option}
            <option value={option.value}>{option.label}</option>
        {/each}
    </select>
</div>

<style>
    .dropdown-wrap {
        display: inline-block;
        position: relative;
    }

    .dropdown {
        padding: 10px;
        border-radius: 5px;
        border: none; /* No borders to match the design */
        font-size: 1em;
        color: white;
        background-color: black;
        appearance: none;
        width: 100%; /* Ensures it stretches across the container */
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        cursor: pointer;
    }

    .dropdown option {
        background-color: black;
        color: white;
    }

    /* Optional: Custom arrow styling */
    .dropdown-wrap::after {
        content: '▼';
        position: absolute;
        top: 50%;
        right: 15px;
        transform: translateY(-50%);
        color: white;
        pointer-events: none;
    }

    .dropdown:focus {
        outline: none; /* Remove the default blue outline */
        border: 1px solid #333; /* Custom focus state */
    }
</style>
