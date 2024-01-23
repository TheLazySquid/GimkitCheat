const existingScript = document.querySelector('script[src*="index.8f9b20a8.js"]') as HTMLScriptElement
if(existingScript) {
    addModifiedScript(existingScript.src)
}

export default function addModifiedScript(src: string) {
    console.log(src)

    // we want to manually fetch the script so we can modify it
    fetch(src)
        .then(response => response.text())
        .then(text => {
            text = text.replace('import("./"+i("cMWv8").resolve("5CPH7"))', `new Promise(async (resolve) => {
    const src = "./"+i("cMWv8").resolve("5CPH7")
    console.log(src)
    const res = await fetch(src)
    let text = await res.text()
    text = text.replace('assignment:new(0,p.default)}', 'assignment:new(0,p.default)};window.stores=D;')

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

            try {
                script.appendChild(document.createTextNode(text));
                document.head.appendChild(script);
            } catch(e) {
                script.text = text;
                document.head.appendChild(script);
            }
        });
}