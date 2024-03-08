const useGM = typeof GM_getValue !== 'undefined'

export function setValue(key: string, value: string) {
    if (useGM) {
        GM_setValue(key, value)
    } else {
        localStorage.setItem(`gc-${key}`, value)
    }
}

export function getValue(key: string, defaultValue?: string) {
    if (useGM) {
        return GM_getValue(key, defaultValue)
    } else {
        return localStorage.getItem(`gc-${key}`) ?? defaultValue
    }
}

export function deleteValue(key: string) {
    if (useGM) {
        GM_deleteValue(key)
    } else {
        localStorage.removeItem(`gc-${key}`)
    }
}