<script lang="ts">
    import ToggleButton from "../../hud/components/ToggleButton.svelte";

    let hidingPopups = false;

    let observer = new MutationObserver((mutations) => {
        if(!hidingPopups) return;
        for(let mutation of mutations) {
            for(let node of mutation.addedNodes) {
                if(!(node instanceof HTMLElement)) continue;
                if(node.matches(".Toastify__toast")) {
                    node.style.display = "none";
                    node.querySelector<HTMLElement>('.Toastify__close-button')?.click();
                }
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

    function onClick(message: CustomEvent<boolean>) {
        if(!message.detail) return;
        document.querySelectorAll(".Toastify__toast").forEach((node: HTMLElement) => {
            node.style.display = "none";
            node.querySelector<HTMLElement>('.Toastify__close-button')?.click();
        });
    }
</script>

<ToggleButton offText="Hide Purchase Popups" onText="Show Purchase Popups"
hotkeyId="floorIsLavaHidePopups" bind:enabled={hidingPopups} on:click={onClick}/>