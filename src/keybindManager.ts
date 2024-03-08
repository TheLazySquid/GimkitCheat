class KeybindManager {
    keysPressed = new Set<string>();
    keybinds = new Map<Set<string>, () => void>();
    
    constructor() {
        window.addEventListener('keydown', (e) => {
            this.keysPressed.add(e.key.toLowerCase());

            // check if any keybinds are pressed
            checkKeybinds: for(const [keys, callback] of this.keybinds) {
                if(keys.size == 0) continue;
    
                for(const key of keys) {
                    if(!this.keysPressed.has(key)) {
                        continue checkKeybinds;
                    }
                }
    
                callback();
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keysPressed.delete(e.key.toLowerCase());
        });
    }

    addKeybind(keys: Set<string>, callback: () => void) {
        this.keybinds.set(keys, callback);
    }

    removeKeybind(keys: Set<string>) {
        this.keybinds.delete(keys);
    }
}

const keybindManager = new KeybindManager();
export default keybindManager;