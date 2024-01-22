import addModifiedScript from "./addModifiedScript";

export default function setup() {
    const observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
            // Check if a new script element was added
            if (mutation.type !== 'childList') return
            const addedNodes = Array.from(mutation.addedNodes);

            for (let node of addedNodes) {
                if(!(node instanceof HTMLScriptElement)) continue;

                if(!node.src.includes("index.8f9b20a8.js")) continue;

                // get rid of the element so it doesn't get executed
                (node as HTMLElement).remove();
    
                addModifiedScript(node.src);
            }
        });
    });
    
    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });
}