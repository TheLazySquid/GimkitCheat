<script lang="ts">
    export let selectOptions: string[] = [];
    export let value: string = "";

    function updateValue(e: Event) {
        value = (e.target as HTMLSelectElement).value;
    }
</script>

<div class="container">
    <input spellcheck="false" bind:value={value} />
    <select on:change={updateValue}>
        {#each selectOptions as option}
            <option value={option}>{option}</option>
        {/each}
    </select>
</div>

<style>
    .container {
        display: flex;
        padding: 5px 10px;
        width: 100%;
        justify-items: center;
        align-self: center;
    }

    input {
        flex-grow: 1;
        color: black;
    }

    select {
        width: 20px;
        color: black;
    }
</style>