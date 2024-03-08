<script lang="ts">
    import Button from "./components/Button.svelte";
    import { defaultCss } from "./defaultVars";
    import { setCssVars } from "./hudVarsManager";

    function resetStyles() {
        let res = confirm("Are you sure you want to reset all styles?");
        if(!res) return;

        for(let key in defaultCss) {
            document.documentElement.style.setProperty(`--${key}`, defaultCss[key]);
        }

        setCssVars(defaultCss);
    }
</script>

<Button on:click={resetStyles}>Reset All Styles</Button>