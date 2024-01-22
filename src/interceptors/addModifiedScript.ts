export default function addModifiedScript(src: string) {
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
    const blob = new Blob([text], { type: 'text/javascript' })
    const url = URL.createObjectURL(blob)
    const script = document.createElement("script")
    script.src = url;
    script.addEventListener('load', resolve)
    document.head.appendChild(script);
})`)

            // replace all instances of ./ with /
            text = text.replace(/"\.\/"/g, '"https://www.gimkit.com/"')

            // create a new blob with the modified text
            const blob = new Blob([text], { type: 'text/javascript' });
            const url = URL.createObjectURL(blob);

            // create a new script element with the modified url
            const script = document.createElement('script');
            script.src = url;
            script.type="module"
            
            // append the script element to the document
            document.head.appendChild(script);
        });
}