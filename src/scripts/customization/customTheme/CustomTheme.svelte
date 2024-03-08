<script lang="ts">
    import Group from "../../../hud/Group.svelte";
    import { defaultThemes } from './defaultThemes'
    import Delete from 'svelte-material-icons/Delete.svelte';
    import PlusCircleOutline from 'svelte-material-icons/PlusCircleOutline.svelte';
    import { setValue, getValue } from "../../../persist";
    import Button from "../../../hud/components/Button.svelte";
    import CreateTheme from "./CreateTheme.svelte";
    import { ITheme } from "../../../types";
    import socketManager from '../../../network/socketManager';

    let { transportType } = socketManager;

    let themesString = getValue('customThemes');
    let themes: ITheme[] = [];
    if(themesString) {
        themes = JSON.parse(themesString);
    } else {
        themes = defaultThemes.map(theme => ({...theme, custom: false}));
    }

    let questionElement: HTMLElement | null = null;

    const selector = '[style^="opacity:"][style*="transform: translateY(0%)"]'

    let observer = new MutationObserver((mutations) => {
        for(let mutation of mutations) {
            for(let node of mutation.addedNodes) {
                if(!(node instanceof HTMLElement)) continue;

                let found: HTMLElement;

                if($transportType === 'colyseus') {
                    found = node.querySelector(selector);
                } else if($transportType === 'blueboat') {
                    if(node.matches(selector)) {
                        found = node;
                    }
                }

                if(!found) continue;
                questionElement = found;
                applyTheme();
            }
        }
    })

    const attachObserver = () => {
        observer.observe(document.body, {
            childList: true,
            subtree: true
        })
    }

    if(!document.body) {
        window.addEventListener('DOMContentLoaded', attachObserver);
    } else {
        attachObserver();
    }

    let selectedTheme = themes[parseInt(getValue('selectedTheme', '0'))];
    let themeEnabled = getValue('themeEnabled') === 'true';

    function updateEnabled() {
        if(themeEnabled) {
            setValue('themeEnabled', 'true');
            setTheme(selectedTheme);
        } else {
            setValue('themeEnabled', 'false');
            removeTheme();
        }
    }

    function setTheme(theme: ITheme) {
        selectedTheme = theme;
        setValue('selectedTheme', themes.indexOf(theme).toString());
        if(themeEnabled) applyTheme();
    }

    function applyTheme() {
        if(!questionElement || !themeEnabled) return;
        let questionDisplay = questionElement.firstChild.firstChild.firstChild.firstChild as HTMLElement;
        questionDisplay.style.background = selectedTheme.question.background;
        questionDisplay.style.color = selectedTheme.question.text;

        for(let i = 0; i < questionElement.children[1].children.length; i++) {
            let option = questionElement.children[1].children[i];
            let optionDisplay = option.firstChild as HTMLElement;
            optionDisplay.style.background = selectedTheme.palette[i].background;
            optionDisplay.style.color = selectedTheme.palette[i].text;
        }
    }

    function removeTheme() {
        if(!questionElement) return;
        let questionDisplay = questionElement.firstChild.firstChild.firstChild.firstChild as HTMLElement;
        questionDisplay.style.background = '';
        questionDisplay.style.color = '';

        for(let i = 0; i < questionElement.children[1].children.length; i++) {
            let option = questionElement.children[1].children[i];
            let optionDisplay = option.firstChild as HTMLElement;
            optionDisplay.style.background = '';
            optionDisplay.style.color = '';
        }
    }

    let createOpen = false;

    function onSubmit(message: CustomEvent<ITheme | null>) {
        createOpen = false;

        if(!message.detail) return;
        selectedTheme = message.detail;
        themes = [message.detail, ...themes];
        setValue('selectedTheme', '0');
        setValue('customThemes', JSON.stringify(themes));

        applyTheme();
    }

    function deleteTheme(theme: ITheme) {
        let res = confirm('Are you sure you want to delete this theme?');
        if(!res) return;

        let index = themes.indexOf(theme);
        themes.splice(index, 1);
        setValue('customThemes', JSON.stringify(themes));
        if(theme === selectedTheme) {
            selectedTheme = themes[0];
            setValue('selectedTheme', '0');
            applyTheme();
        }
        themes = themes; // rerender
    }
</script>

{#if createOpen}
    <CreateTheme on:submit={onSubmit} />
{/if}

<Group name="Custom Theme">
    <div class="themeEnabled">
        <div>Use Custom Theme?</div>
        <input type="checkbox" bind:checked={themeEnabled} on:change={updateEnabled} />
    </div>
    <Button on:click={() => createOpen = true}>
        <div class="createTheme">
            New Theme
            <PlusCircleOutline width={30} height={30} />
        </div>
    </Button>
    {#each themes as theme, i}
        <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
        <div class="theme" style="background-color:{theme.question.background};color:{theme.question.text}"
        class:selected={selectedTheme === theme} on:click={() => setTheme(theme)}>
            <div class="title">
                Theme {i + 1}
                {#if theme.custom}
                    <div on:click|stopPropagation={() => deleteTheme(theme)}>
                        <Delete width={25} height={25} />
                    </div>
                {/if}
            </div>
            <div class="options">
                {#each theme.palette as color, j}
                    <div class="option" style="background-color:{color.background};color:{color.text};">
                        {j + 1}
                    </div>
                {/each}
            </div>
        </div>
    {/each}
</Group>

<style>
    .createTheme {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
    }

    .title {
        position: relative;
        width: 100%;
        text-align: center;
        display: flex;
        justify-content: center;
    }

    .title > div {
        position: absolute;
        right: 0;
        top: 0;
    }

    .theme {
        display: flex;
        flex-direction: column;
        align-items: center;
        margin: 10px;
    }

    .theme.selected {
        /* perhaps a little overkill */
        border: 5px solid black;
        outline: 3px solid white;
    }

    .options {
        display: flex;
        flex-direction: row;
        align-items: center;
        width: 100%;
    }

    .option {
        flex-grow: 1;
        text-align: center;
        margin: 5px;
    }

    .themeEnabled {
        display: flex;
        align-items: center;
        justify-content: center;
        margin-left: 10px;
        margin-right: 10px;
    }
    .themeEnabled > div {
        margin-right: 10px;
    }
    .themeEnabled > input {
        width: 20px;
        height: 20px;
    }
</style>