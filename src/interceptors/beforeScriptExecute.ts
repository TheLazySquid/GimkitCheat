import addModifiedScript from "./addModifiedScript";

export default function setup() {
    function interceptScript(e: Event) {
        // this is bad bad very bad
        if(!e.srcElement) return;
        if(!(e.srcElement instanceof HTMLScriptElement)) return;

        let src = e.srcElement.src;
        
        if(!src.includes("index.8f9b20a8.js")) return;
        e.preventDefault();

        addModifiedScript(src);

        window.removeEventListener('beforescriptexecute', interceptScript);
    }

    // @ts-ignore beforescriptexecute is non-standard and only works on firefox. Fortunately, it's just firefox that need to run this script, so we're good.
    window.addEventListener('beforescriptexecute', interceptScript);
}