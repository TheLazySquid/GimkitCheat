export default function makeBookmarklet () {
    return {
        name: 'make-bookmarklet',
        renderChunk(code) {
            return `javascript:(function(){${encodeURIComponent(code)}})()`;
        }
    }
}