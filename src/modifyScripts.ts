const selector = 'script[src^="/index"][type="module"]';

export default function setup() {
    const script = document.querySelector(selector) as HTMLScriptElement;
    if(script) {
        addModifiedScript(script.src)
        console.log("GC: Added modified script", script)
        return;
    }

    let observer = new MutationObserver((mutations) => {
        for(let mutation of mutations) {
            for(let node of mutation.addedNodes) {
                if(node instanceof HTMLScriptElement && node.src.includes("/index") && node.type == "module") {
                    addModifiedScript(node.src)
                    console.log("GC: Added modified script", node)
                    observer.disconnect()
                }
            }
        }
    })

    const attachObserver = () => {
        observer.observe(document.head, {
            childList: true
        })
    }

    if(document.head) attachObserver()
    else document.addEventListener('DOMContentLoaded', attachObserver)
}

function addModifiedScript(src: string) {
    console.log(src)

    // we want to manually fetch the script so we can modify it
    fetch(src)
        .then(response => response.text())
        .then(text => {
            // find the five character id (plus quotes) of the script we want to get
            // eg: ,"5CPH7":"App.83745002.js",
            const index = text.indexOf(':"App.')
            if(!index) {
                alert("GC: Failed to find the correct script to modify. Please open an issue on GitHub.")
                return;
            }
            const id = text.substring(index-7, index)
            const scriptModuleIndex = text.lastIndexOf(').register(JSON.parse(', index)
            const scriptModuleId = text.substring(scriptModuleIndex-7, scriptModuleIndex)
            const regex = new RegExp(`import\\("\\.\\/"\\+(.)\\(${scriptModuleId}\\)\\.resolve\\(${id}\\)\\)`, 'g')
            // get the wildcard character
            const wildcard = regex.exec(text)?.[1]
            if(!wildcard) {
                alert("GC: Failed to find the correct script to modify. Please open an issue on GitHub.")
                return;
            }

            text = text.replace(regex, `new Promise(async (resolve) => {
    const src = "./"+${wildcard}(${scriptModuleId}).resolve(${id})
    console.log(src)
    const res = await fetch(src)
    let text = await res.text()
    const endRegex = /assignment:new\\(0,(.)\\.default\\)\\}/
    const endRes = endRegex.exec(text)
    const varRegex = /(.)={network:new/
    const varRes = varRegex.exec(text)
    if(!endRes[1] || !varRes[1]) {
        alert("GC: Failed to find the correct script to modify. Please open an issue on GitHub.")
        return;
    }
    text = text.replace(endRegex, 'assignment:new(0,'+endRes[1]+'.default)};window.stores='+varRes[1]+';window.storesLoaded.set(true);console.log("GC: Stores loaded via intercept");')

    const script = document.createElement('script');
    try {
        script.appendChild(document.createTextNode(text));
        document.head.appendChild(script);
    } catch(e) { 
        script.text = text;
        document.head.appendChild(script);
    }
    setTimeout(resolve, 0)
})`)

            // replace all "./" with "/"
            text = text.replace(/"\.\/"/g, '"/"')

            // create a new script element with the modified url
            const script = document.createElement('script');
            script.type="module"
            document.querySelector("#root")?.remove();
            let root = document.createElement('div');
            root.id = "root";
            document.body.appendChild(root);

            try {
                script.appendChild(document.createTextNode(text));
                document.head.appendChild(script);
            } catch(e) {
                script.text = text;
                document.head.appendChild(script);
            }
        });
}