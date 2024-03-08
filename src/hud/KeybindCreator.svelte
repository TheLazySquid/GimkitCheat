<script lang="ts">
    import { onMount, createEventDispatcher } from 'svelte';

    export let keys: Set<string> = new Set();
    let keysDeref = new Set(keys);
    // $: keysDeref = new Set(keys);

    let recording = false;
    let dialog: HTMLDialogElement;
    let dispatch = createEventDispatcher();

    function onKeydown(event: KeyboardEvent) {
        if (!recording) return;

        if(event.key === 'Escape') {
            recording = false;
            return;
        }

        keysDeref.add(event.key.toLowerCase());
        keysDeref = keysDeref;
    }

    function toggleRecording() {
        recording = !recording;

        if(recording) {
            keysDeref.clear();
            keysDeref = keysDeref;
        }
    }

    function confirm() {
        dispatch('close', keysDeref);
    }

    function cancel() {
        dispatch('close', new Set());
    }

    onMount(() => {
        dialog.showModal();
        dialog.addEventListener('close', () => {
            dispatch('close', new Set());
        });
    })
</script>

<svelte:window on:keydown={onKeydown} />

<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<dialog bind:this={dialog} on:mousedown|stopPropagation>
    <h2>Create Hotkey</h2>
    <button on:click={toggleRecording} on:keydown|preventDefault class="recordBtn">
        {#if recording}
            Stop recording
        {:else if keysDeref.size === 0}
            Start recording
        {:else}
            Re-record
        {/if}
    </button>
    <div class="hotkeyDisplay">
        {#if keysDeref.size === 0}
            {#if recording}
                Press any keys
            {:else}
                No hotkey set
            {/if}
        {:else}
            {Array.from(keysDeref).map(key => key === ' ' ? 'Space' : key).join(' + ')}
        {/if}
    </div>
    <div class="completeContainer">
        <button disabled={keysDeref.size === 0} class="confirm"
        on:click={confirm}>
            Confirm
        </button>
        <button class="cancel" on:click={cancel}>
            No hotkey
        </button>
    </div>
</dialog>

<style>
    dialog {
        width: 400px;
        height: 300px;
        border-radius: 15px;
        background-color: white;
        border: 3px solid black;
        display: flex;
        flex-direction: column;
    }

    h2 {
        width: 100%;
        text-align: center;
    }

    button[disabled] {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .recordBtn {
        width: 100%;
        height: 50px;
        border: none;
        background-color: #f0f0f0;
        cursor: pointer;
        border-radius: 10px;
    }

    .hotkeyDisplay {
        width: 100%;
        text-align: center;
        height: 80px;
        overflow-y: auto;
        margin-top: 20px;
    }

    .completeContainer {
        display: flex;
        justify-content: space-between;
        margin-top: 20px;
    }

    .confirm, .cancel {
        width: 40%;
        border: none;
        border-radius: 3px;
    }

    .confirm {
        background-color: lightgreen;
    }

    .cancel {
        background-color: lightcoral;
    }
</style>