<script lang="ts">
    import { getCssVar, setCssVar } from '../hudVarsManager'
    import { parseHex, parseRGBA, rgbToHex } from '../../utils'
    import debounce from 'debounce';

    export let text: string;
    export let color: string | undefined = undefined;
    export let bindValue: string | undefined = undefined;
    export let allowOpacity: boolean = true;
    export let minOpactiy: number = 0;

    let useColor = color ?? getCssVar(bindValue) ?? 'rgba(255, 255, 255, 1)';
    let channels = parseRGBA(useColor);

    let colorVal = rgbToHex(channels.r, channels.g, channels.b);
    let alphaVal = channels.a;

    let displayColor = useColor;

    function setVar(color: string) {
        setCssVar(bindValue, color);
    }

    const setVarDebounce = debounce(setVar, 100);

    function onChange() {
        let hexChannels = parseHex(colorVal);
        let newColor = `rgba(${hexChannels.r}, ${hexChannels.g}, ${hexChannels.b}, ${alphaVal})`;
        if (bindValue) {
            setVarDebounce(newColor);
            document.documentElement.style.setProperty(`--${bindValue}`, newColor);
        }
        displayColor = newColor;
        if(color) color = newColor;
    }
</script>

<div class="colorPicker">
    <div>
        {text}
    </div>
    <div class="inputs">
        {#if allowOpacity}
            <div class="opacityBlock">
                <div>
                    Opacity
                </div>
                <input type="range" min={minOpactiy} max="1" step="0.01" bind:value={alphaVal}  class="alphaInput"
                on:input={onChange} on:mousedown|stopPropagation />
            </div>
        {/if}
        <input type="color" bind:value={colorVal} class="colorInput"
        on:input={onChange} on:mousedown|stopPropagation />
        <div class="preview" style:background-color={displayColor}></div>
    </div>
</div>

<style>
.colorPicker {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
}

.inputs {
    display: flex;
    align-items: center;
    justify-content: space-around;
    width: 100%;
    max-width: 100%;
}

.opacityBlock {
    display: flex;
    flex-direction: column;
    align-items: center;
}

.alphaInput {
    flex-shrink: 1;
    min-width: 0;
    width: 100%;
}

.colorInput {
    flex-shrink: 0;
}

.preview {
    width: 50px;
    height: 50px;
    border-radius: 10px;
    flex-shrink: 0;
    border: 2px solid black;
}
</style>