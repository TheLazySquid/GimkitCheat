// this code was stolen from the original Gimkit Util extension
function n(t, e, n) {
    for (var i = 0, s = 0, o = n.length; s < o; s++)(i = n.charCodeAt(s)) < 128 ? t.setUint8(e++, i) : (i < 2048 ? t.setUint8(e++, 192 | i >> 6) : (i < 55296 || 57344 <= i ? t.setUint8(e++, 224 | i >> 12) : (s++, i = 65536 + ((1023 & i) << 10 | 1023 & n.charCodeAt(s)), t.setUint8(e++, 240 | i >> 18), t.setUint8(e++, 128 | i >> 12 & 63)), t.setUint8(e++, 128 | i >> 6 & 63)), t.setUint8(e++, 128 | 63 & i))
}

function encode(t, e, s) {
    const o = {
        type: 2,
        data: ["blueboat_SEND_MESSAGE", {
            room: s,
            key: t,
            data: e
        }],
        options: {
            compress: !0
        },
        nsp: "/"
    };
    return function(t) {
        var e = [],
            i = [],
            s = function t(e, n, i) {
                var s = typeof i,
                    o = 0,
                    r = 0,
                    a = 0,
                    c = 0,
                    l = 0,
                    u = 0;
                if ("string" === s) {
                    if ((l = function(t) {
                            for (var e = 0, n = 0, i = 0, s = t.length; i < s; i++)(e = t.charCodeAt(i)) < 128 ? n += 1 : e < 2048 ? n += 2 : e < 55296 || 57344 <= e ? n += 3 : (i++, n += 4);
                            return n
                        }(i)) < 32) e.push(160 | l), u = 1;
                    else if (l < 256) e.push(217, l), u = 2;
                    else if (l < 65536) e.push(218, l >> 8, l), u = 3;
                    else {
                        if (!(l < 4294967296)) throw new Error("String too long");
                        e.push(219, l >> 24, l >> 16, l >> 8, l), u = 5
                    }
                    return n.push({
                        h: i,
                        u: l,
                        t: e.length
                    }), u + l
                }
                if ("number" === s) return Math.floor(i) === i && isFinite(i) ? 0 <= i ? i < 128 ? (e.push(i), 1) : i < 256 ? (e.push(204, i), 2) : i < 65536 ? (e.push(205, i >> 8, i), 3) : i < 4294967296 ? (e.push(206, i >> 24, i >> 16, i >> 8, i), 5) : (a = i / Math.pow(2, 32) >> 0, c = i >>> 0, e.push(207, a >> 24, a >> 16, a >> 8, a, c >> 24, c >> 16, c >> 8, c), 9) : -32 <= i ? (e.push(i), 1) : -128 <= i ? (e.push(208, i), 2) : -32768 <= i ? (e.push(209, i >> 8, i), 3) : -2147483648 <= i ? (e.push(210, i >> 24, i >> 16, i >> 8, i), 5) : (a = Math.floor(i / Math.pow(2, 32)), c = i >>> 0, e.push(211, a >> 24, a >> 16, a >> 8, a, c >> 24, c >> 16, c >> 8, c), 9) : (e.push(203), n.push({
                    o: i,
                    u: 8,
                    t: e.length
                }), 9);
                if ("object" === s) {
                    if (null === i) return e.push(192), 1;
                    if (Array.isArray(i)) {
                        if ((l = i.length) < 16) e.push(144 | l), u = 1;
                        else if (l < 65536) e.push(220, l >> 8, l), u = 3;
                        else {
                            if (!(l < 4294967296)) throw new Error("Array too large");
                            e.push(221, l >> 24, l >> 16, l >> 8, l), u = 5
                        }
                        for (o = 0; o < l; o++) u += t(e, n, i[o]);
                        return u
                    }
                    if (i instanceof Date) {
                        var h = i.getTime();
                        return a = Math.floor(h / Math.pow(2, 32)), c = h >>> 0, e.push(215, 0, a >> 24, a >> 16, a >> 8, a, c >> 24, c >> 16, c >> 8, c), 10
                    }
                    if (i instanceof ArrayBuffer) {
                        if ((l = i.byteLength) < 256) e.push(196, l), u = 2;
                        else if (l < 65536) e.push(197, l >> 8, l), u = 3;
                        else {
                            if (!(l < 4294967296)) throw new Error("Buffer too large");
                            e.push(198, l >> 24, l >> 16, l >> 8, l), u = 5
                        }
                        return n.push({
                            l: i,
                            u: l,
                            t: e.length
                        }), u + l
                    }
                    if ("function" == typeof i.toJSON) return t(e, n, i.toJSON());
                    var d = [],
                        f = "",
                        p = Object.keys(i);
                    for (o = 0, r = p.length; o < r; o++) "function" != typeof i[f = p[o]] && d.push(f);
                    if ((l = d.length) < 16) e.push(128 | l), u = 1;
                    else if (l < 65536) e.push(222, l >> 8, l), u = 3;
                    else {
                        if (!(l < 4294967296)) throw new Error("Object too large");
                        e.push(223, l >> 24, l >> 16, l >> 8, l), u = 5
                    }
                    for (o = 0; o < l; o++) u += t(e, n, f = d[o]), u += t(e, n, i[f]);
                    return u
                }
                if ("boolean" === s) return e.push(i ? 195 : 194), 1;
                if ("undefined" === s) return e.push(212, 0, 0), 3;
                throw new Error("Could not encode")
            }(e, i, t),
            o = new ArrayBuffer(s),
            r = new DataView(o),
            a = 0,
            c = 0,
            l = -1;
        0 < i.length && (l = i[0].t);
        for (var u, h = 0, d = 0, f = 0, p = e.length; f < p; f++)
            if (r.setUint8(c + f, e[f]), f + 1 === l) {
                if (h = (u = i[a]).u, d = c + l, u.l)
                    for (var g = new Uint8Array(u.l), E = 0; E < h; E++) r.setUint8(d + E, g[E]);
                else u.h ? n(r, d, u.h) : void 0 !== u.o && r.setFloat64(d, u.o);
                c += h, i[++a] && (l = i[a].t)
            } let y = Array.from(new Uint8Array(o));
        y.unshift(4)
        return new Uint8Array(y).buffer 
    }(o)
}

function decode(packet) {
    function e(t) {
        if (this.t = 0, t instanceof ArrayBuffer) this.i = t, this.s = new DataView(this.i);
        else {
            if (!ArrayBuffer.isView(t)) return null;
            this.i = t.buffer, this.s = new DataView(this.i, t.byteOffset, t.byteLength)
        }
    }

    e.prototype.g = function(t) {
        for (var e = new Array(t), n = 0; n < t; n++) e[n] = this.v();
        return e
    }, e.prototype.M = function(t) {
        for (var e = {}, n = 0; n < t; n++) e[this.v()] = this.v();
        return e
    }, e.prototype.h = function(t) {
        var e = function(t, e, n) {
            for (var i = "", s = 0, o = e, r = e + n; o < r; o++) {
                var a = t.getUint8(o);
                if (0 != (128 & a))
                    if (192 != (224 & a))
                        if (224 != (240 & a)) {
                            if (240 != (248 & a)) throw new Error("Invalid byte " + a.toString(16));
                            65536 <= (s = (7 & a) << 18 | (63 & t.getUint8(++o)) << 12 | (63 & t.getUint8(++o)) << 6 | (63 & t.getUint8(++o)) << 0) ? (s -= 65536, i += String.fromCharCode(55296 + (s >>> 10), 56320 + (1023 & s))) : i += String.fromCharCode(s)
                        } else i += String.fromCharCode((15 & a) << 12 | (63 & t.getUint8(++o)) << 6 | (63 & t.getUint8(++o)) << 0);
                else i += String.fromCharCode((31 & a) << 6 | 63 & t.getUint8(++o));
                else i += String.fromCharCode(a)
            }
            return i
        }(this.s, this.t, t);
        return this.t += t, e
    }, e.prototype.l = function(t) {
        var e = this.i.slice(this.t, this.t + t);
        return this.t += t, e
    }, e.prototype.v = function() {
        if(!this.s) return null;
        var t, e = this.s.getUint8(this.t++),
            n = 0,
            i = 0,
            s = 0,
            o = 0;
        if (e < 192) return e < 128 ? e : e < 144 ? this.M(15 & e) : e < 160 ? this.g(15 & e) : this.h(31 & e);
        if (223 < e) return -1 * (255 - e + 1);
        switch (e) {
            case 192:
                return null;
            case 194:
                return !1;
            case 195:
                return !0;
            case 196:
                return n = this.s.getUint8(this.t), this.t += 1, this.l(n);
            case 197:
                return n = this.s.getUint16(this.t), this.t += 2, this.l(n);
            case 198:
                return n = this.s.getUint32(this.t), this.t += 4, this.l(n);
            case 199:
                return n = this.s.getUint8(this.t), i = this.s.getInt8(this.t + 1), this.t += 2, [i, this.l(n)];
            case 200:
                return n = this.s.getUint16(this.t), i = this.s.getInt8(this.t + 2), this.t += 3, [i, this.l(n)];
            case 201:
                return n = this.s.getUint32(this.t), i = this.s.getInt8(this.t + 4), this.t += 5, [i, this.l(n)];
            case 202:
                return t = this.s.getFloat32(this.t), this.t += 4, t;
            case 203:
                return t = this.s.getFloat64(this.t), this.t += 8, t;
            case 204:
                return t = this.s.getUint8(this.t), this.t += 1, t;
            case 205:
                return t = this.s.getUint16(this.t), this.t += 2, t;
            case 206:
                return t = this.s.getUint32(this.t), this.t += 4, t;
            case 207:
                return s = this.s.getUint32(this.t) * Math.pow(2, 32), o = this.s.getUint32(this.t + 4), this.t += 8, s + o;
            case 208:
                return t = this.s.getInt8(this.t), this.t += 1, t;
            case 209:
                return t = this.s.getInt16(this.t), this.t += 2, t;
            case 210:
                return t = this.s.getInt32(this.t), this.t += 4, t;
            case 211:
                return s = this.s.getInt32(this.t) * Math.pow(2, 32), o = this.s.getUint32(this.t + 4), this.t += 8, s + o;
            case 212:
                return i = this.s.getInt8(this.t), this.t += 1, 0 === i ? void(this.t += 1) : [i, this.l(1)];
            case 213:
                return i = this.s.getInt8(this.t), this.t += 1, [i, this.l(2)];
            case 214:
                return i = this.s.getInt8(this.t), this.t += 1, [i, this.l(4)];
            case 215:
                return i = this.s.getInt8(this.t), this.t += 1, 0 === i ? (s = this.s.getInt32(this.t) * Math.pow(2, 32), o = this.s.getUint32(this.t + 4), this.t += 8, new Date(s + o)) : [i, this.l(8)];
            case 216:
                return i = this.s.getInt8(this.t), this.t += 1, [i, this.l(16)];
            case 217:
                return n = this.s.getUint8(this.t), this.t += 1, this.h(n);
            case 218:
                return n = this.s.getUint16(this.t), this.t += 2, this.h(n);
            case 219:
                return n = this.s.getUint32(this.t), this.t += 4, this.h(n);
            case 220:
                return n = this.s.getUint16(this.t), this.t += 2, this.g(n);
            case 221:
                return n = this.s.getUint32(this.t), this.t += 4, this.g(n);
            case 222:
                return n = this.s.getUint16(this.t), this.t += 2, this.M(n);
            case 223:
                return n = this.s.getUint32(this.t), this.t += 4, this.M(n)
        }
        throw new Error("Could not parse")
    };

    const q = function(t) {
        var n = new e(t = t.slice(1)),
            i = n.v();
        if (n.t === t.byteLength) return i;
        return null
    }(packet);

    return q?.data?.[1];
}

export default {
    encode,
    decode
}