<script lang="ts">
    import { onMount, createEventDispatcher } from 'svelte';
    import { defaultThemes } from './defaultThemes';
    import { ITheme } from '../../../types';
    import ColorPicker from '../../../hud/components/ColorPicker.svelte';

    let dialog: HTMLDialogElement;
    let theme: ITheme = structuredClone({...defaultThemes[0], custom: true});
    let dispatch = createEventDispatcher();

    onMount(() => {
        document.body.appendChild(dialog);
        dialog.showModal();
    })

    function submit() {
        dispatch('submit', theme);
    }

    function cancel() {
        dispatch('submit', null);
    }
</script>

<dialog bind:this={dialog} on:close={cancel}>
    <div class="pickers">
        <ColorPicker text="Question Background" allowOpacity={false} bind:color={theme.question.background} />
        <ColorPicker text="Question Text" allowOpacity={false} bind:color={theme.question.text} />
        <ColorPicker text="Option 1 Background" allowOpacity={false} bind:color={theme.palette[0].background} />
        <ColorPicker text="Option 1 Text" allowOpacity={false} bind:color={theme.palette[0].text} />
        <ColorPicker text="Option 2 Background" allowOpacity={false} bind:color={theme.palette[1].background} />
        <ColorPicker text="Option 2 Text" allowOpacity={false} bind:color={theme.palette[1].text} />
        <ColorPicker text="Option 3 Background" allowOpacity={false} bind:color={theme.palette[2].background} />
        <ColorPicker text="Option 3 Text" allowOpacity={false} bind:color={theme.palette[2].text} />
        <ColorPicker text="Option 4 Background" allowOpacity={false} bind:color={theme.palette[3].background} />
        <ColorPicker text="Option 4 Text" allowOpacity={false} bind:color={theme.palette[3].text} />
    </div>
    <div class="wrap">
        <div class="question" style="background-color:{theme.question.background};color:{theme.question.text}">
            <div>
                Example Question Text
            </div>
        </div>
        <div class="options">
            {#each { length: 4 } as _, i}
            <div class="option" style="background-color:{theme.palette[i].background};color:{theme.palette[i].text}">
                <div>
                    Option {i + 1}
                </div>
            </div>
            {/each}
        </div>
        <div class="buttons">
            <button on:click={submit} class="submit">
                Create
            </button>
            <button on:click={cancel} class="cancel">
                Cancel
            </button>
        </div>
    </div>
</dialog>

<style>
    .buttons {
        display: flex;
        flex-direction: row;
        width: 100%;
    }

    .submit, .cancel {
        padding: 10px;
        margin: 10px;
        font-size: 20px;
        border: none;
        border-radius: 5px;
        flex-grow: 1;
    }

    .submit {
        background-color: green;
    }

    .cancel {
        background-color: red;
    }

    dialog {
        width: 80%;
        height: 80%;
        display: flex;
    }

    .pickers {
        width: 200px;
        overflow-y: auto;
        overflow-x: hidden;
    }

    .wrap {
        display: flex;
        flex-direction: column;
        height: 100%;
        flex-grow: 1;
    }

    .question {
        width: 100%;
        height: 30%;
        font-family: 'Product Sans', sans-serif;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 50px;
    }

    .options {
        flex-grow: 1;
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        width: 100%;
    }

    .option {
        background-color: blue;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: 'Product Sans', sans-serif;
        font-size: 25px;
        border: 6px solid rgba(0, 0, 0, 0.3);
    }
</style>