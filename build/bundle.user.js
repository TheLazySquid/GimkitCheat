// ==UserScript==
// @name        gimkitcheat
// @description A userscript that allows you to cheat across various gimkit games
// @namespace   https://www.github.com/TheLazySquid/GimkitCheat
// @match       https://www.gimkit.com/join*
// @run-at      document-start
// @iconURL     https://www.gimkit.com/favicon.png
// @author      TheLazySquid
// @updateURL   https://raw.githubusercontent.com/TheLazySquid/GimkitCheat/main/build/bundle.user.js
// @downloadURL https://raw.githubusercontent.com/TheLazySquid/GimkitCheat/main/build/bundle.user.js
// @version     0.3.6
// @license     ISC
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_deleteValue
// ==/UserScript==
(function () {
  'use strict';

  var version = "0.3.6";

  function utf8Read$1(bytes, offset, length) {
  	var string = '', chr = 0;
  	for (var i = offset, end = offset + length; i < end; i++) {
  		var byte = bytes[i];
  		if ((byte & 0x80) === 0x00) {
  			string += String.fromCharCode(byte);
  			continue;
  		}
  		if ((byte & 0xe0) === 0xc0) {
  			string += String.fromCharCode(
  				((byte & 0x1f) << 6) |
  				(bytes[++i] & 0x3f)
  			);
  			continue;
  		}
  		if ((byte & 0xf0) === 0xe0) {
  			string += String.fromCharCode(
  				((byte & 0x0f) << 12) |
  				((bytes[++i] & 0x3f) << 6) |
  				((bytes[++i] & 0x3f) << 0)
  			);
  			continue;
  		}
  		if ((byte & 0xf8) === 0xf0) {
  			chr = ((byte & 0x07) << 18) |
  				((bytes[++i] & 0x3f) << 12) |
  				((bytes[++i] & 0x3f) << 6) |
  				((bytes[++i] & 0x3f) << 0);
  			if (chr >= 0x010000) { // surrogate pair
  				chr -= 0x010000;
  				string += String.fromCharCode((chr >>> 10) + 0xD800, (chr & 0x3FF) + 0xDC00);
  			} else {
  				string += String.fromCharCode(chr);
  			}
  			continue;
  		}

  		console.error('Invalid byte ' + byte.toString(16));
  		// (do not throw error to avoid server/client from crashing due to hack attemps)
  		// throw new Error('Invalid byte ' + byte.toString(16));
  	}
  	return string;
  }

  function int8(bytes, it) {
  	return uint8(bytes, it) << 24 >> 24;
  }
  function uint8(bytes, it) {
  	return bytes[it.offset++];
  }
  function int16(bytes, it) {
  	return uint16(bytes, it) << 16 >> 16;
  }
  function uint16(bytes, it) {
  	return bytes[it.offset++] | bytes[it.offset++] << 8;
  }
  function int32(bytes, it) {
  	return bytes[it.offset++] | bytes[it.offset++] << 8 | bytes[it.offset++] << 16 | bytes[it.offset++] << 24;
  }
  function uint32(bytes, it) {
  	return int32(bytes, it) >>> 0;
  }
  function int64(bytes, it) {
  	const low = uint32(bytes, it);
  	const high = int32(bytes, it) * Math.pow(2, 32);
  	return high + low;
  }
  function uint64(bytes, it) {
  	const low = uint32(bytes, it);
  	const high = uint32(bytes, it) * Math.pow(2, 32);
  	return high + low;
  }const _int32 = new Int32Array(2);
  const _float32 = new Float32Array(_int32.buffer);
  const _float64 = new Float64Array(_int32.buffer);

  function readFloat32(bytes, it) {
  	_int32[0] = int32(bytes, it);
  	return _float32[0];
  }
  function readFloat64(bytes, it) {
  	_int32[0 ] = int32(bytes, it);
  	_int32[1 ] = int32(bytes, it);
  	return _float64[0];
  }
  function string(bytes, it) {
  	const prefix = bytes[it.offset++];
  	let length;

  	if (prefix < 0xc0) {
  		// fixstr
  		length = prefix & 0x1f;

  	} else if (prefix === 0xd9) {
  		length = uint8(bytes, it);

  	} else if (prefix === 0xda) {
  		length = uint16(bytes, it);

  	} else if (prefix === 0xdb) {
  		length = uint32(bytes, it);
  	}

  	const value = utf8Read$1(bytes, it.offset, length);
  	it.offset += length;

  	return value;
  }

  function stringCheck(bytes, it) {
  	const prefix = bytes[it.offset];
  	return (
  		// fixstr
  		(prefix < 0xc0 && prefix > 0xa0) ||
  		// str 8
  		prefix === 0xd9 ||
  		// str 16
  		prefix === 0xda ||
  		// str 32
  		prefix === 0xdb
  	);
  }

  function number(bytes, it) {
  	const prefix = bytes[it.offset++];

  	if (prefix < 0x80) {
  		// positive fixint
  		return prefix;

  	} else if (prefix === 0xca) {
  		// float 32
  		return readFloat32(bytes, it);

  	} else if (prefix === 0xcb) {
  		// float 64
  		return readFloat64(bytes, it);

  	} else if (prefix === 0xcc) {
  		// uint 8
  		return uint8(bytes, it);

  	} else if (prefix === 0xcd) {
  		// uint 16
  		return uint16(bytes, it);

  	} else if (prefix === 0xce) {
  		// uint 32
  		return uint32(bytes, it);

  	} else if (prefix === 0xcf) {
  		// uint 64
  		return uint64(bytes, it);

  	} else if (prefix === 0xd0) {
  		// int 8
  		return int8(bytes, it);

  	} else if (prefix === 0xd1) {
  		// int 16
  		return int16(bytes, it);

  	} else if (prefix === 0xd2) {
  		// int 32
  		return int32(bytes, it);

  	} else if (prefix === 0xd3) {
  		// int 64
  		return int64(bytes, it);

  	} else if (prefix > 0xdf) {
  		// negative fixint
  		return (0xff - prefix + 1) * -1
  	}
  }

  const Protocol = {
      // Room-related (10~19)
      JOIN_ROOM: 10,
      ERROR: 11,
      LEAVE_ROOM: 12,
      ROOM_DATA: 13,
      ROOM_STATE: 14,
      ROOM_STATE_PATCH: 15,
      ROOM_DATA_SCHEMA: 16
  };

  function Decoder(buffer, offset) {
      this._offset = offset;
      if (buffer instanceof ArrayBuffer) {
          this._buffer = buffer;
          this._view = new DataView(this._buffer);
      }
      else if (ArrayBuffer.isView(buffer)) {
          this._buffer = buffer.buffer;
          this._view = new DataView(this._buffer, buffer.byteOffset, buffer.byteLength);
      }
      else {
          throw new Error('Invalid argument');
      }
  }
  function utf8Read(view, offset, length) {
      var string = '', chr = 0;
      for (var i = offset, end = offset + length; i < end; i++) {
          var byte = view.getUint8(i);
          if ((byte & 0x80) === 0x00) {
              string += String.fromCharCode(byte);
              continue;
          }
          if ((byte & 0xe0) === 0xc0) {
              string += String.fromCharCode(((byte & 0x1f) << 6) |
                  (view.getUint8(++i) & 0x3f));
              continue;
          }
          if ((byte & 0xf0) === 0xe0) {
              string += String.fromCharCode(((byte & 0x0f) << 12) |
                  ((view.getUint8(++i) & 0x3f) << 6) |
                  ((view.getUint8(++i) & 0x3f) << 0));
              continue;
          }
          if ((byte & 0xf8) === 0xf0) {
              chr = ((byte & 0x07) << 18) |
                  ((view.getUint8(++i) & 0x3f) << 12) |
                  ((view.getUint8(++i) & 0x3f) << 6) |
                  ((view.getUint8(++i) & 0x3f) << 0);
              if (chr >= 0x010000) { // surrogate pair
                  chr -= 0x010000;
                  string += String.fromCharCode((chr >>> 10) + 0xD800, (chr & 0x3FF) + 0xDC00);
              }
              else {
                  string += String.fromCharCode(chr);
              }
              continue;
          }
          throw new Error('Invalid byte ' + byte.toString(16));
      }
      return string;
  }
  Decoder.prototype._array = function (length) {
      var value = new Array(length);
      for (var i = 0; i < length; i++) {
          value[i] = this._parse();
      }
      return value;
  };
  Decoder.prototype._map = function (length) {
      var key = '', value = {};
      for (var i = 0; i < length; i++) {
          key = this._parse();
          value[key] = this._parse();
      }
      return value;
  };
  Decoder.prototype._str = function (length) {
      var value = utf8Read(this._view, this._offset, length);
      this._offset += length;
      return value;
  };
  Decoder.prototype._bin = function (length) {
      var value = this._buffer.slice(this._offset, this._offset + length);
      this._offset += length;
      return value;
  };
  Decoder.prototype._parse = function () {
      var prefix = this._view.getUint8(this._offset++);
      var value, length = 0, type = 0, hi = 0, lo = 0;
      if (prefix < 0xc0) {
          // positive fixint
          if (prefix < 0x80) {
              return prefix;
          }
          // fixmap
          if (prefix < 0x90) {
              return this._map(prefix & 0x0f);
          }
          // fixarray
          if (prefix < 0xa0) {
              return this._array(prefix & 0x0f);
          }
          // fixstr
          return this._str(prefix & 0x1f);
      }
      // negative fixint
      if (prefix > 0xdf) {
          return (0xff - prefix + 1) * -1;
      }
      switch (prefix) {
          // nil
          case 0xc0:
              return null;
          // false
          case 0xc2:
              return false;
          // true
          case 0xc3:
              return true;
          // bin
          case 0xc4:
              length = this._view.getUint8(this._offset);
              this._offset += 1;
              return this._bin(length);
          case 0xc5:
              length = this._view.getUint16(this._offset);
              this._offset += 2;
              return this._bin(length);
          case 0xc6:
              length = this._view.getUint32(this._offset);
              this._offset += 4;
              return this._bin(length);
          // ext
          case 0xc7:
              length = this._view.getUint8(this._offset);
              type = this._view.getInt8(this._offset + 1);
              this._offset += 2;
              return [type, this._bin(length)];
          case 0xc8:
              length = this._view.getUint16(this._offset);
              type = this._view.getInt8(this._offset + 2);
              this._offset += 3;
              return [type, this._bin(length)];
          case 0xc9:
              length = this._view.getUint32(this._offset);
              type = this._view.getInt8(this._offset + 4);
              this._offset += 5;
              return [type, this._bin(length)];
          // float
          case 0xca:
              value = this._view.getFloat32(this._offset);
              this._offset += 4;
              return value;
          case 0xcb:
              value = this._view.getFloat64(this._offset);
              this._offset += 8;
              return value;
          // uint
          case 0xcc:
              value = this._view.getUint8(this._offset);
              this._offset += 1;
              return value;
          case 0xcd:
              value = this._view.getUint16(this._offset);
              this._offset += 2;
              return value;
          case 0xce:
              value = this._view.getUint32(this._offset);
              this._offset += 4;
              return value;
          case 0xcf:
              hi = this._view.getUint32(this._offset) * Math.pow(2, 32);
              lo = this._view.getUint32(this._offset + 4);
              this._offset += 8;
              return hi + lo;
          // int
          case 0xd0:
              value = this._view.getInt8(this._offset);
              this._offset += 1;
              return value;
          case 0xd1:
              value = this._view.getInt16(this._offset);
              this._offset += 2;
              return value;
          case 0xd2:
              value = this._view.getInt32(this._offset);
              this._offset += 4;
              return value;
          case 0xd3:
              hi = this._view.getInt32(this._offset) * Math.pow(2, 32);
              lo = this._view.getUint32(this._offset + 4);
              this._offset += 8;
              return hi + lo;
          // fixext
          case 0xd4:
              type = this._view.getInt8(this._offset);
              this._offset += 1;
              if (type === 0x00) {
                  this._offset += 1;
                  return void 0;
              }
              return [type, this._bin(1)];
          case 0xd5:
              type = this._view.getInt8(this._offset);
              this._offset += 1;
              return [type, this._bin(2)];
          case 0xd6:
              type = this._view.getInt8(this._offset);
              this._offset += 1;
              return [type, this._bin(4)];
          case 0xd7:
              type = this._view.getInt8(this._offset);
              this._offset += 1;
              if (type === 0x00) {
                  hi = this._view.getInt32(this._offset) * Math.pow(2, 32);
                  lo = this._view.getUint32(this._offset + 4);
                  this._offset += 8;
                  return new Date(hi + lo);
              }
              return [type, this._bin(8)];
          case 0xd8:
              type = this._view.getInt8(this._offset);
              this._offset += 1;
              return [type, this._bin(16)];
          // str
          case 0xd9:
              length = this._view.getUint8(this._offset);
              this._offset += 1;
              return this._str(length);
          case 0xda:
              length = this._view.getUint16(this._offset);
              this._offset += 2;
              return this._str(length);
          case 0xdb:
              length = this._view.getUint32(this._offset);
              this._offset += 4;
              return this._str(length);
          // array
          case 0xdc:
              length = this._view.getUint16(this._offset);
              this._offset += 2;
              return this._array(length);
          case 0xdd:
              length = this._view.getUint32(this._offset);
              this._offset += 4;
              return this._array(length);
          // map
          case 0xde:
              length = this._view.getUint16(this._offset);
              this._offset += 2;
              return this._map(length);
          case 0xdf:
              length = this._view.getUint32(this._offset);
              this._offset += 4;
              return this._map(length);
      }
      throw new Error('Could not parse');
  };
  function decode$1(buffer, offset) {
      if (offset === void 0) { offset = 0; }
      var decoder = new Decoder(buffer, offset);
      var value = decoder._parse();
      if (decoder._offset !== buffer.byteLength) {
          throw new Error((buffer.byteLength - decoder._offset) + ' trailing bytes');
      }
      return value;
  }
  // 
  // ENCODER
  // 
  function utf8Write(view, offset, str) {
      var c = 0;
      for (var i = 0, l = str.length; i < l; i++) {
          c = str.charCodeAt(i);
          if (c < 0x80) {
              view.setUint8(offset++, c);
          }
          else if (c < 0x800) {
              view.setUint8(offset++, 0xc0 | (c >> 6));
              view.setUint8(offset++, 0x80 | (c & 0x3f));
          }
          else if (c < 0xd800 || c >= 0xe000) {
              view.setUint8(offset++, 0xe0 | (c >> 12));
              view.setUint8(offset++, 0x80 | (c >> 6) & 0x3f);
              view.setUint8(offset++, 0x80 | (c & 0x3f));
          }
          else {
              i++;
              c = 0x10000 + (((c & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
              view.setUint8(offset++, 0xf0 | (c >> 18));
              view.setUint8(offset++, 0x80 | (c >> 12) & 0x3f);
              view.setUint8(offset++, 0x80 | (c >> 6) & 0x3f);
              view.setUint8(offset++, 0x80 | (c & 0x3f));
          }
      }
  }
  function utf8Length(str) {
      var c = 0, length = 0;
      for (var i = 0, l = str.length; i < l; i++) {
          c = str.charCodeAt(i);
          if (c < 0x80) {
              length += 1;
          }
          else if (c < 0x800) {
              length += 2;
          }
          else if (c < 0xd800 || c >= 0xe000) {
              length += 3;
          }
          else {
              i++;
              length += 4;
          }
      }
      return length;
  }
  function _encode(bytes, defers, value) {
      var type = typeof value, i = 0, l = 0, hi = 0, lo = 0, length = 0, size = 0;
      if (type === 'string') {
          length = utf8Length(value);
          // fixstr
          if (length < 0x20) {
              bytes.push(length | 0xa0);
              size = 1;
          }
          // str 8
          else if (length < 0x100) {
              bytes.push(0xd9, length);
              size = 2;
          }
          // str 16
          else if (length < 0x10000) {
              bytes.push(0xda, length >> 8, length);
              size = 3;
          }
          // str 32
          else if (length < 0x100000000) {
              bytes.push(0xdb, length >> 24, length >> 16, length >> 8, length);
              size = 5;
          }
          else {
              throw new Error('String too long');
          }
          defers.push({ _str: value, _length: length, _offset: bytes.length });
          return size + length;
      }
      if (type === 'number') {
          // TODO: encode to float 32?
          // float 64
          if (Math.floor(value) !== value || !isFinite(value)) {
              bytes.push(0xcb);
              defers.push({ _float: value, _length: 8, _offset: bytes.length });
              return 9;
          }
          if (value >= 0) {
              // positive fixnum
              if (value < 0x80) {
                  bytes.push(value);
                  return 1;
              }
              // uint 8
              if (value < 0x100) {
                  bytes.push(0xcc, value);
                  return 2;
              }
              // uint 16
              if (value < 0x10000) {
                  bytes.push(0xcd, value >> 8, value);
                  return 3;
              }
              // uint 32
              if (value < 0x100000000) {
                  bytes.push(0xce, value >> 24, value >> 16, value >> 8, value);
                  return 5;
              }
              // uint 64
              hi = (value / Math.pow(2, 32)) >> 0;
              lo = value >>> 0;
              bytes.push(0xcf, hi >> 24, hi >> 16, hi >> 8, hi, lo >> 24, lo >> 16, lo >> 8, lo);
              return 9;
          }
          else {
              // negative fixnum
              if (value >= -0x20) {
                  bytes.push(value);
                  return 1;
              }
              // int 8
              if (value >= -0x80) {
                  bytes.push(0xd0, value);
                  return 2;
              }
              // int 16
              if (value >= -0x8000) {
                  bytes.push(0xd1, value >> 8, value);
                  return 3;
              }
              // int 32
              if (value >= -0x80000000) {
                  bytes.push(0xd2, value >> 24, value >> 16, value >> 8, value);
                  return 5;
              }
              // int 64
              hi = Math.floor(value / Math.pow(2, 32));
              lo = value >>> 0;
              bytes.push(0xd3, hi >> 24, hi >> 16, hi >> 8, hi, lo >> 24, lo >> 16, lo >> 8, lo);
              return 9;
          }
      }
      if (type === 'object') {
          // nil
          if (value === null) {
              bytes.push(0xc0);
              return 1;
          }
          if (Array.isArray(value)) {
              length = value.length;
              // fixarray
              if (length < 0x10) {
                  bytes.push(length | 0x90);
                  size = 1;
              }
              // array 16
              else if (length < 0x10000) {
                  bytes.push(0xdc, length >> 8, length);
                  size = 3;
              }
              // array 32
              else if (length < 0x100000000) {
                  bytes.push(0xdd, length >> 24, length >> 16, length >> 8, length);
                  size = 5;
              }
              else {
                  throw new Error('Array too large');
              }
              for (i = 0; i < length; i++) {
                  size += _encode(bytes, defers, value[i]);
              }
              return size;
          }
          // fixext 8 / Date
          if (value instanceof Date) {
              var time = value.getTime();
              hi = Math.floor(time / Math.pow(2, 32));
              lo = time >>> 0;
              bytes.push(0xd7, 0, hi >> 24, hi >> 16, hi >> 8, hi, lo >> 24, lo >> 16, lo >> 8, lo);
              return 10;
          }
          if (value instanceof ArrayBuffer) {
              length = value.byteLength;
              // bin 8
              if (length < 0x100) {
                  bytes.push(0xc4, length);
                  size = 2;
              }
              else 
              // bin 16
              if (length < 0x10000) {
                  bytes.push(0xc5, length >> 8, length);
                  size = 3;
              }
              else 
              // bin 32
              if (length < 0x100000000) {
                  bytes.push(0xc6, length >> 24, length >> 16, length >> 8, length);
                  size = 5;
              }
              else {
                  throw new Error('Buffer too large');
              }
              defers.push({ _bin: value, _length: length, _offset: bytes.length });
              return size + length;
          }
          if (typeof value.toJSON === 'function') {
              return _encode(bytes, defers, value.toJSON());
          }
          var keys = [], key = '';
          var allKeys = Object.keys(value);
          for (i = 0, l = allKeys.length; i < l; i++) {
              key = allKeys[i];
              if (typeof value[key] !== 'function') {
                  keys.push(key);
              }
          }
          length = keys.length;
          // fixmap
          if (length < 0x10) {
              bytes.push(length | 0x80);
              size = 1;
          }
          // map 16
          else if (length < 0x10000) {
              bytes.push(0xde, length >> 8, length);
              size = 3;
          }
          // map 32
          else if (length < 0x100000000) {
              bytes.push(0xdf, length >> 24, length >> 16, length >> 8, length);
              size = 5;
          }
          else {
              throw new Error('Object too large');
          }
          for (i = 0; i < length; i++) {
              key = keys[i];
              size += _encode(bytes, defers, key);
              size += _encode(bytes, defers, value[key]);
          }
          return size;
      }
      // false/true
      if (type === 'boolean') {
          bytes.push(value ? 0xc3 : 0xc2);
          return 1;
      }
      // fixext 1 / undefined
      if (type === 'undefined') {
          bytes.push(0xd4, 0, 0);
          return 3;
      }
      throw new Error('Could not encode');
  }
  function encode$1(value) {
      var bytes = [];
      var defers = [];
      var size = _encode(bytes, defers, value);
      var buf = new ArrayBuffer(size);
      var view = new DataView(buf);
      var deferIndex = 0;
      var deferWritten = 0;
      var nextOffset = -1;
      if (defers.length > 0) {
          nextOffset = defers[0]._offset;
      }
      var defer, deferLength = 0, offset = 0;
      for (var i = 0, l = bytes.length; i < l; i++) {
          view.setUint8(deferWritten + i, bytes[i]);
          if (i + 1 !== nextOffset) {
              continue;
          }
          defer = defers[deferIndex];
          deferLength = defer._length;
          offset = deferWritten + nextOffset;
          if (defer._bin) {
              var bin = new Uint8Array(defer._bin);
              for (var j = 0; j < deferLength; j++) {
                  view.setUint8(offset + j, bin[j]);
              }
          }
          else if (defer._str) {
              utf8Write(view, offset, defer._str);
          }
          else if (defer._float !== undefined) {
              view.setFloat64(offset, defer._float);
          }
          deferIndex++;
          deferWritten += deferLength;
          if (defers[deferIndex]) {
              nextOffset = defers[deferIndex]._offset;
          }
      }
      return buf;
  }

  function decodeExport(packet) {
      const u8arr = new Uint8Array(packet);
      const bytes = Array.from(u8arr);
      const prefix = bytes[0];

      if(prefix == Protocol.ROOM_DATA) {
          let it = { offset: 1 };

          stringCheck(bytes, it) ? string(bytes, it) : number(bytes, it);
          let parsed = decode$1(packet, it.offset);
          return parsed
      } else {
          return null; // hopefully isn't important lol
      }
  }

  function encodeExport(channel, packet) {
      let header = [Protocol.ROOM_DATA];
      let channelEncoded = encode$1(channel);
      let packetEncoded = encode$1(packet);

      // combine the arraybuffers
      let combined = new Uint8Array(channelEncoded.byteLength + packetEncoded.byteLength + header.length);
      combined.set(header);
      combined.set(new Uint8Array(channelEncoded), header.length);
      combined.set(new Uint8Array(packetEncoded), header.length + channelEncoded.byteLength);

      return combined.buffer
  }

  var colyseus = {
      decode: decodeExport,
      encode: encodeExport
  };

  // this code was stolen from the original Gimkit Util extension
  function n(t, e, n) {
      for (var i = 0, s = 0, o = n.length; s < o; s++)(i = n.charCodeAt(s)) < 128 ? t.setUint8(e++, i) : (i < 2048 ? t.setUint8(e++, 192 | i >> 6) : (i < 55296 || 57344 <= i ? t.setUint8(e++, 224 | i >> 12) : (s++, i = 65536 + ((1023 & i) << 10 | 1023 & n.charCodeAt(s)), t.setUint8(e++, 240 | i >> 18), t.setUint8(e++, 128 | i >> 12 & 63)), t.setUint8(e++, 128 | i >> 6 & 63)), t.setUint8(e++, 128 | 63 & i));
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
                          e.push(219, l >> 24, l >> 16, l >> 8, l), u = 5;
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
                              e.push(221, l >> 24, l >> 16, l >> 8, l), u = 5;
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
                              e.push(198, l >> 24, l >> 16, l >> 8, l), u = 5;
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
                          e.push(223, l >> 24, l >> 16, l >> 8, l), u = 5;
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
                  c += h, i[++a] && (l = i[a].t);
              } let y = Array.from(new Uint8Array(o));
          y.unshift(4);
          return new Uint8Array(y).buffer 
      }(o)
  }

  function decode(packet) {
      function e(t) {
          if (this.t = 0, t instanceof ArrayBuffer) this.i = t, this.s = new DataView(this.i);
          else {
              if (!ArrayBuffer.isView(t)) return null;
              this.i = t.buffer, this.s = new DataView(this.i, t.byteOffset, t.byteLength);
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
                              65536 <= (s = (7 & a) << 18 | (63 & t.getUint8(++o)) << 12 | (63 & t.getUint8(++o)) << 6 | (63 & t.getUint8(++o)) << 0) ? (s -= 65536, i += String.fromCharCode(55296 + (s >>> 10), 56320 + (1023 & s))) : i += String.fromCharCode(s);
                          } else i += String.fromCharCode((15 & a) << 12 | (63 & t.getUint8(++o)) << 6 | (63 & t.getUint8(++o)) << 0);
                  else i += String.fromCharCode((31 & a) << 6 | 63 & t.getUint8(++o));
                  else i += String.fromCharCode(a);
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

  var blueboat = {
      encode,
      decode
  };

  function HexAlphaToRGBA(hex, alpha) {
      let r = parseInt(hex.slice(1, 3), 16);
      let g = parseInt(hex.slice(3, 5), 16);
      let b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  function RGBAtoHexAlpha(rgba) {
      let [r, g, b, a] = rgba.slice(5, -1).split(",").map(x => parseFloat(x.trim()));
      let hex = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
      return [hex, a];
  }
  function parseChangePacket(packet) {
      let returnVar = [];
      for (let change of packet.changes) {
          let data = {};
          let keys = change[1].map((index) => packet.values[index]);
          for (let i = 0; i < keys.length; i++) {
              data[keys[i]] = change[2][i];
          }
          returnVar.push({
              id: change[0],
              data
          });
      }
      return returnVar;
  }

  // @ts-ignore (can't be bothered to figure out how to import this)
  class SocketHandler extends EventTarget {
      constructor(cheat) {
          super();
          this.socket = null;
          this.hasFired = false;
          this.transportType = "unknown";
          this.blueboatRoomId = null;
          this.cheat = cheat;
      }
      getSocket() {
          let handlerThis = this;
          if (!Object.isFrozen(WebSocket)) {
              // intercept any outgoing socket connections
              WebSocket.prototype._send = WebSocket.prototype.send;
              WebSocket.prototype.send = function (data) {
                  // if the url is a local url, don't intercept it
                  if (this.url.startsWith("ws://localhost"))
                      return this._send(data);
                  handlerThis.registerSocket(this);
                  if (!handlerThis.socket)
                      return;
                  handlerThis.socket._send(data);
                  // attempt to get the room id
                  if (handlerThis.transportType == "blueboat") {
                      let decoded = blueboat.decode(data);
                      if (decoded.roomId)
                          handlerThis.blueboatRoomId = decoded.roomId;
                      if (decoded.room)
                          handlerThis.blueboatRoomId = decoded.room;
                      if (!handlerThis.blueboatRoomId)
                          handlerThis.cheat.log("Room ID: ", handlerThis.blueboatRoomId);
                  }
              };
          }
          else {
              // periodically attempt to extract the socket, in case something failed
              let tryGetSocket = setInterval(() => {
                  var _a, _b, _c, _d, _e;
                  let gotSocket = (_e = (_d = (_c = (_b = (_a = window === null || window === void 0 ? void 0 : window.stores) === null || _a === void 0 ? void 0 : _a.network) === null || _b === void 0 ? void 0 : _b.room) === null || _c === void 0 ? void 0 : _c.connection) === null || _d === void 0 ? void 0 : _d.transport) === null || _e === void 0 ? void 0 : _e.ws;
                  if (gotSocket) {
                      handlerThis.registerSocket(gotSocket);
                      clearInterval(tryGetSocket);
                  }
              }, 100);
          }
      }
      registerSocket(socket) {
          if (this.hasFired)
              return;
          this.socket = socket;
          this.hasFired = true;
          this.dispatchEvent(new CustomEvent("socket", { detail: socket }));
          // detect the transport type
          if ("stores" in unsafeWindow)
              this.transportType = "colyseus";
          else
              this.transportType = "blueboat";
          let handlerThis = this;
          socket.addEventListener("message", (e) => {
              // decode the message
              let decoded;
              if (this.transportType == "colyseus")
                  decoded = colyseus.decode(e.data);
              else
                  decoded = blueboat.decode(e.data);
              if (!decoded)
                  return;
              handlerThis.dispatchEvent(new CustomEvent("recieveMessage", { detail: decoded }));
              if (typeof decoded != "object")
                  return;
              if ('changes' in decoded) {
                  let parsed = parseChangePacket(decoded);
                  handlerThis.dispatchEvent(new CustomEvent("recieveChanges", { detail: parsed }));
              }
          });
      }
      sendData(channel, data) {
          if (!this.socket)
              return;
          if (!this.blueboatRoomId && this.transportType == "blueboat")
              return this.cheat.log("Room ID not found, can't send data");
          let encoded;
          if (this.transportType == "colyseus")
              encoded = colyseus.encode(channel, data);
          else
              encoded = blueboat.encode(channel, data, this.blueboatRoomId);
          this.socket.send(encoded);
      }
  }

  class KeybindManager {
      constructor() {
          this.keys = new Set();
          this.binds = [];
          this.addListeners();
      }
      addListeners() {
          window.addEventListener("keydown", (e) => {
              this.keys.add(e.key.toLowerCase());
              this.checkBinds(e);
          });
          window.addEventListener("keyup", (e) => {
              this.keys.delete(e.key.toLowerCase());
          });
          window.addEventListener("blur", () => {
              this.keys.clear();
          });
      }
      checkBinds(e) {
          var _a;
          if (e.repeat)
              return;
          for (let bind of this.binds) {
              if (!bind.keys.has(e.key.toLowerCase()))
                  continue;
              if (bind.keys.size == 0)
                  continue;
              // if the bind is exclusive, make sure no other keys are pressed
              if (bind.exclusive && bind.keys.size != this.keys.size)
                  continue;
              // check whether the keys in the bind are pressed
              if (Array.from(bind.keys).every(key => this.keys.has(key))) {
                  (_a = bind.callback) === null || _a === void 0 ? void 0 : _a.call(bind);
              }
          }
      }
      registerBind(bind) {
          if (this.binds.includes(bind))
              return;
          this.binds.push(bind);
      }
      removeBind(bind) {
          if (!this.binds.includes(bind))
              return;
          this.binds.splice(this.binds.indexOf(bind), 1);
      }
      clearBinds() {
          this.binds = [];
      }
  }

  var css = "#gc_hud {\r\n    position: absolute;\r\n    top: 0;\r\n    left: 0;\r\n    width: 100%;\r\n    height: 100%;\r\n    z-index: 999999999999;\r\n    pointer-events: none;\r\n    color: var(--text-color);\r\n}\r\n\r\n#gc_hud .menu_controls {\r\n    width: 100%;\r\n    height: 20px;\r\n    background-color: var(--menu-controls-bg-color);\r\n    color: var(--menu-controls-text-color);\r\n    border-radius: 5px 5px 0px 0px;\r\n    text-align: center;\r\n    position: relative;\r\n}\r\n\r\n#gc_hud .menu_minimizer {\r\n    margin-left: 20px;\r\n    margin-right: 20px;\r\n    position: absolute;\r\n    top: 0;\r\n    right: 0;\r\n    user-select: none;\r\n}\r\n\r\n#gc_hud .menu {\r\n    pointer-events: auto;\r\n    position: absolute;\r\n    background-color: var(--menu-bg-color);\r\n    display: inline-block;\r\n    border-radius: 5px;\r\n    overflow-x: hidden;\r\n    overflow-y: hidden;\r\n    resize: both;\r\n    width: 300px;\r\n    height: 200px;\r\n    outline: 3px solid var(--menu-border-color);\r\n}\r\n\r\n#gc_hud .menu.minimized {\r\n    height: 20px !important;\r\n    overflow-y: hidden;\r\n    resize: horizontal;\r\n}\r\n\r\n#gc_hud .group {\r\n    margin: 0px;\r\n    padding: 0px;\r\n    width: 100%;\r\n    /* allocate some space at the top and bottom */\r\n    height: calc(100% - 40px); \r\n    position: absolute;\r\n    top: 20px;\r\n    left: 0;\r\n    display: flex;\r\n    flex-direction: column;\r\n    justify-content: flex-start;\r\n    align-items: center;\r\n    overflow-y: auto;\r\n    overflow-x: hidden;\r\n}\r\n\r\n#gc_hud .button, #gc_hud .group_opener {\r\n    background-color: var(--button-bg-color);\r\n    border: 1px solid var(--button-border-color);\r\n}\r\n\r\n#gc_hud .toggle {\r\n    background-color: var(--toggle-bg-color);\r\n    border: 1px solid var(--toggle-border-color);\r\n}\r\n\r\n#gc_hud .button, #gc_hud .toggle, #gc_hud .group_opener {\r\n    border-radius: 5px;\r\n    padding: 5px;\r\n    margin: 5px;\r\n    cursor: pointer;\r\n    width: 90%;\r\n    transition: transform 0.2s ease-in-out;\r\n}\r\n\r\n/* make it bounce smaller when clicked */\r\n#gc_hud .button:active, #gc_hud .toggle:active, #gc_hud .group_opener:active {\r\n    transform: scale(0.93);\r\n}\r\n\r\n#gc_hud .colorpicker {\r\n    width: 100%;\r\n}\r\n\r\n#gc_hud .colorpicker_wrapper {\r\n    width: 100%;\r\n    display: flex;\r\n    flex-direction: row;\r\n    justify-content: space-around;\r\n    align-items: center;\r\n    margin: 5px;\r\n}\r\n\r\n#gc_hud .colorpicker_opacity_wrapper {\r\n    display: flex;\r\n    flex-direction: column;\r\n    justify-content: space-around;\r\n    align-items: center;\r\n}\r\n\r\n#gc_hud .colorpicker_preview {\r\n    width: 50px;\r\n    height: 50px;\r\n    border-radius: 5px;\r\n    opacity: 1;\r\n}\r\n\r\n#gc_hud .text {\r\n    text-align: center;\r\n    width: 100%;\r\n}\r\n\r\n#gc_hud .textinput_wrapper, #gc_hud .dropdown_wrapper, #gc_hud .slider_wrapper {\r\n    width: 100%;\r\n    display: flex;\r\n    flex-direction: column;\r\n    justify-content: space-around;\r\n    align-items: center;\r\n}\r\n\r\n#gc_hud .textinput {\r\n    width: 90%;\r\n    border-radius: 5px;\r\n    border: 1px solid var(--textinput-border-color);\r\n    background-color: var(--textinput-bg-color);\r\n    color: var(--text-color);\r\n    padding: 5px;\r\n    margin: 5px;\r\n}\r\n\r\n#gc_hud .dropdown {\r\n    width: 90%;\r\n    border-radius: 5px;\r\n    border: 1px solid var(--dropdown-border-color);\r\n    background-color: var(--dropdown-bg-color);\r\n    color: var(--text-color);\r\n    padding: 5px;\r\n    margin: 5px;\r\n}\r\n\r\n#gc_hud .toggle_wrapper, #gc_hud .button_wrapper {\r\n    width: 90%;\r\n    display: flex;\r\n    flex-direction: row;\r\n    justify-content: space-around;\r\n    align-items: center;\r\n    padding: 0px;\r\n}\r\n\r\n#gc_hud .toggle, #gc_hud .button {\r\n    /* make it take up as much space as possible */\r\n    width: 100%;\r\n    margin-left: 0px;\r\n    margin-right: 0px;\r\n}\r\n\r\n#gc_hud .keybind_opener {\r\n    width: 30px;\r\n    height: 30px;\r\n    font-size: 30px;\r\n    margin-left: 10px;\r\n}\r\n\r\n#gc_hud .keybind_editor_wrapper {\r\n    background-color: var(--keybind-editor-bg-color);\r\n    border: 3px solid var(--keybind-editor-border-color);\r\n    border-radius: 8px;\r\n}\r\n\r\n#gc_hud .keybind_editor {\r\n    width: 50vw;\r\n    height: 50vh;\r\n    display: flex;\r\n    flex-direction: column;\r\n    justify-content: space-around;\r\n    align-items: center;\r\n    color: var(--text-color);\r\n}\r\n\r\n#gc_hud .close {\r\n    position: absolute;\r\n    top: 0;\r\n    right: 0;\r\n    width: 20px;\r\n    height: 20px;\r\n    font-size: 20px;\r\n    cursor: pointer;\r\n    user-select: none;\r\n}\r\n\r\n#gc_hud .keybind_title {\r\n    font-size: 40px;\r\n    text-align: center;\r\n}\r\n\r\n#gc_hud .keybind_controls {\r\n    width: 100%;\r\n    display: flex;\r\n    flex-direction: row;\r\n    justify-content: space-around;\r\n    align-items: center;\r\n}\r\n\r\n#gc_hud .keybind_display {\r\n    border: 3px solid white;\r\n    min-width: 300px;\r\n    border-radius: 5px;\r\n    height: 50px;\r\n    text-align: center;\r\n    display: flex;\r\n    justify-content: center;\r\n    align-items: center;\r\n    cursor: pointer;\r\n}\r\n\r\n#gc_hud .keybind_exclusive {\r\n    display: flex;\r\n}\r\n\r\n#gc_hud .keybind_exclusive .text {\r\n    margin-right: 10px;\r\n}\r\n\r\n#gc_hud .keybind_editor .action {\r\n    cursor: pointer;\r\n}\r\n\r\n#gc_hud .slider {\r\n    width: 90%;\r\n    margin: 5px;\r\n}\r\n\r\n.gc_overlay_canvas {\r\n    position: absolute;\r\n    top: 0;\r\n    left: 0;\r\n    width: 100vw;\r\n    height: 100vh;\r\n    z-index: 9999;\r\n    pointer-events: none;\r\n}\r\n\r\n@keyframes slide_out_left {\r\n    0% {\r\n        transform: translateX(0);\r\n        opacity: 1;\r\n        pointer-events: all;\r\n    }\r\n\r\n    100% {\r\n        transform: translateX(-100%);\r\n        opacity: 0;\r\n        pointer-events: none;\r\n    }\r\n}\r\n\r\n@keyframes slide_out_right {\r\n    0% {\r\n        transform: translateX(0);\r\n        opacity: 1;\r\n        pointer-events: all;\r\n    }\r\n\r\n    100% {\r\n        transform: translateX(100%);\r\n        opacity: 0;\r\n        pointer-events: none;\r\n    }\r\n}\r\n\r\n@keyframes slide_in_left {\r\n    0% {\r\n        transform: translateX(-100%);\r\n        opacity: 0;\r\n        pointer-events: none;\r\n    }\r\n\r\n    100% {\r\n        transform: translateX(0);\r\n        opacity: 1;\r\n        pointer-events: all;\r\n    }\r\n}\r\n\r\n@keyframes slide_in_right {\r\n    0% {\r\n        transform: translateX(100%);\r\n        opacity: 0;\r\n        pointer-events: none;\r\n    }\r\n\r\n    100% {\r\n        transform: translateX(0);\r\n        opacity: 1;\r\n        pointer-events: all;\r\n    }\r\n}\r\n\r\n@keyframes idle {}";

  class HudElement extends EventTarget {
      // any is used to avoid circular dependencies
      constructor(group, options) {
          super();
          this.group = null;
          this.options = null;
          this.element = null;
          this.type = 'element';
          this.group = group;
          this.options = options;
      }
      remove() {
          var _a;
          (_a = this.element) === null || _a === void 0 ? void 0 : _a.remove();
          this.group.elements.splice(this.group.elements.indexOf(this), 1);
      }
  }

  class Text extends HudElement {
      constructor(group, options) {
          super(group, options);
          this.type = "text";
          this.element = document.createElement("div");
          this.element.classList.add("text");
          this.element.innerText = this.options.text;
      }
      set text(text) {
          this.element.innerText = text;
      }
      get text() {
          return this.element.innerText;
      }
  }

  class GroupOpener extends HudElement {
      constructor(group, options) {
          super(group, options);
          this.type = "groupOpener";
          this.element = document.createElement("button");
          this.element.classList.add("group_opener");
          this.element.innerText = this.options.text;
          this.element.addEventListener("click", () => {
              var _a;
              let direction = (_a = this.options.direction) !== null && _a !== void 0 ? _a : "right";
              let oppositeDirection = direction == "right" ? "left" : "right";
              // open the group
              this.group.slide("out", direction);
              let groupToOpen = this.group.menu.getAnyGroup(this.options.openGroup);
              if (!groupToOpen)
                  return;
              groupToOpen.slide("in", oppositeDirection);
          });
      }
      set text(text) {
          this.element.innerText = text;
      }
      get text() {
          return this.element.innerText;
      }
  }

  class ColorPicker extends HudElement {
      constructor(group, options) {
          var _a, _b;
          super(group, options);
          this.opacitySlider = null;
          this.colorPicker = null;
          this.preview = null;
          this.type = "colorpicker";
          // create the element
          let element = document.createElement("div");
          element.innerHTML = `
            <div class="text">${this.options.text}</div>
            <div class="colorpicker_wrapper">
                <div class="colorpicker_opacity_wrapper">
                    <div class="text">Opacity</div>
                    <input type="range" min="0" max="255" value="255" class="colorpicker_opacity">
                </div>
                <input type="color" value="#ffffff" class="colorpicker_color">
                <div class="colorpicker_preview"></div>
            </div>
        `;
          element.classList.add("colorpicker");
          this.opacitySlider = element.querySelector(".colorpicker_opacity");
          this.colorPicker = element.querySelector(".colorpicker_color");
          this.preview = element.querySelector(".colorpicker_preview");
          if (this.options.bindVar)
              this.color = window.cheat.hud.syncedVars.get("cssVars").get(this.options.bindVar);
          else if (this.options.color)
              this.color = this.options.color;
          // prevent the menu from being dragged when the slider is moved
          this.opacitySlider.addEventListener("mousedown", (e) => { e.stopPropagation(); });
          (_a = this.opacitySlider) === null || _a === void 0 ? void 0 : _a.addEventListener("input", () => { this.updatePreview(); });
          (_b = this.colorPicker) === null || _b === void 0 ? void 0 : _b.addEventListener("input", () => { this.updatePreview(); });
          this.element = element;
          this.updatePreview();
      }
      updatePreview() {
          let color = this.colorPicker.value;
          let opacity = parseInt(this.opacitySlider.value);
          this.preview.style.backgroundColor = color;
          this.preview.style.opacity = `${opacity / 255}`;
          if (this.options.bindVar) {
              window.cheat.hud.updateCssVar(this.options.bindVar, this.color);
          }
          this.dispatchEvent(new CustomEvent("change", {
              detail: this.color
          }));
      }
      set color(color) {
          let [hex, alpha] = RGBAtoHexAlpha(color);
          this.colorPicker.value = hex;
          this.opacitySlider.value = `${255 * alpha}`;
          this.updatePreview();
      }
      get color() {
          let color = this.colorPicker.value;
          let opacity = parseInt(this.opacitySlider.value);
          let rgba = HexAlphaToRGBA(color, opacity / 255);
          return rgba;
      }
  }

  function keyboard() {
  	return (new DOMParser().parseFromString("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 50 40\"><rect width=\"40\" height=\"26\" x=\"4\" y=\"10\" rx=\"2.038\" ry=\"2.234\" style=\"fill:#000;fill-opacity:1;fill-rule:evenodd;stroke:#fff;stroke-width:8;stroke-linecap:butt;stroke-linejoin:miter;stroke-opacity:1;stroke-miterlimit:4;stroke-dasharray:none\"/><rect width=\"40\" height=\"26\" x=\"4\" y=\"10\" rx=\"2.038\" ry=\"2.234\" style=\"fill:#000;fill-opacity:1;fill-rule:evenodd;stroke:none;stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;stroke-opacity:1\"/><path d=\"M14 30h19M7 30h5M35 30h6M7 16h4M13 16h4M19 16h4M25 16h4M31 16h4M34 23h4M28 23h4M22 23h4M16 23h4M37 16h4M10 23h4\" style=\"fill:none;fill-opacity:.75;fill-rule:evenodd;stroke:#fff;stroke-width:4;stroke-linecap:butt;stroke-linejoin:miter;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1\"/></svg>", 'image/svg+xml')).firstChild;
  }

  // @ts-ignore
  class KeybindEditor {
      constructor(options) {
          var _a;
          this.capturing = false;
          this.keys = new Set();
          this.actionState = "start";
          this.type = "keybindEditor";
          this.options = options;
          this.keybindOpener = keyboard();
          this.keybindOpener.classList.add("keybind_opener");
          this.keybindEditor = document.createElement("dialog");
          this.keybindEditor.classList.add("keybind_editor_wrapper");
          this.keybindEditor.innerHTML = `
			<div class="keybind_editor">
				<div class="close">x</div>
				<h1 class="keybind_title">${options.title}</h1>
				<div class="keybind_controls">
					<div class="keybind_display"></div>
					<div class="keybind_exclusive">
						<div class="text">Exclusive?</div>
						<input type="checkbox" class="exclusive" />
					</div>
					<div class="action">Start Capture</div>
				</div>
			</div>
		`;
          let bindExclusive = (_a = options.exclusive) !== null && _a !== void 0 ? _a : false;
          let existingKeybind = window.cheat.hud.syncedVars.get("keybinds").get(options.id);
          if (existingKeybind) {
              this.keys = new Set(existingKeybind.keys);
              bindExclusive = existingKeybind.exclusive;
          }
          else if (options.keys)
              this.keys = options.keys;
          if (bindExclusive)
              this.keybindEditor.querySelector(".exclusive").setAttribute("checked", "true");
          this.bind = {
              keys: this.keys,
              exclusive: bindExclusive,
              callback: options.callback
          };
          window.cheat.keybindManager.registerBind(this.bind);
          this.updateAction();
          this.updateDisplay();
          this.addEventListeners();
      }
      addEventListeners() {
          let action = this.keybindEditor.querySelector(".action");
          let close = this.keybindEditor.querySelector(".close");
          let display = this.keybindEditor.querySelector(".keybind_display");
          let exclusive = this.keybindEditor.querySelector(".exclusive");
          this.keybindOpener.addEventListener("click", () => {
              this.keybindEditor.showModal();
          });
          // prevent the menu from being dragged by the dialog
          this.keybindEditor.addEventListener("mousedown", (e) => {
              e.stopPropagation();
              if (!this.capturing)
                  return;
              if (e.target == action)
                  return;
              this.endCapture();
          });
          display.addEventListener("mousedown", (e) => {
              e.stopPropagation();
              this.beginCapture();
          });
          close.addEventListener("click", () => {
              this.keybindEditor.close();
          });
          action.addEventListener("click", () => {
              if (this.actionState == "Start Capture")
                  this.beginCapture();
              else if (this.actionState == "End Capture")
                  this.endCapture();
              else if (this.actionState == "Reset") {
                  this.keys.clear();
                  this.updateDisplay();
                  this.updateAction();
              }
          });
          exclusive.addEventListener("change", () => {
              this.bind.exclusive = exclusive.checked;
              this.syncBind();
          });
      }
      beginCapture() {
          this.capturing = true;
          this.keys.clear();
          this.keybindEditor.querySelector(".keybind_display").innerHTML = "Press any key...";
          document.addEventListener("keydown", this.keybindCapture.bind(this));
          this.updateAction();
      }
      keybindCapture(e) {
          if (!this.capturing)
              return;
          e.preventDefault();
          if (e.key === "Escape" || e.key === "Enter") {
              this.endCapture();
              return;
          }
          this.keys.add(e.key.toLowerCase());
          this.updateDisplay();
      }
      endCapture() {
          this.capturing = false;
          document.removeEventListener("keydown", this.keybindCapture.bind(this));
          this.updateAction();
          this.syncBind();
      }
      updateDisplay() {
          let keybindDisplay = this.keybindEditor.querySelector(".keybind_display");
          let keys = Array.from(this.keys);
          // replace space with "space"
          keys = keys.map((key) => key === " " ? "space" : key);
          keybindDisplay.innerHTML = keys.join(" + ");
      }
      updateAction() {
          let action = this.keybindEditor.querySelector(".action");
          if (this.capturing)
              this.actionState = "End Capture";
          else if (this.keys.size == 0)
              this.actionState = "Start Capture";
          else
              this.actionState = "Reset";
          action.innerHTML = this.actionState;
      }
      attachTo(element) {
          element.appendChild(this.keybindOpener);
          element.appendChild(this.keybindEditor);
      }
      syncBind() {
          if (!this.options.id)
              return;
          window.cheat.hud.updateKeybind(this.options.id, {
              keys: Array.from(this.keys),
              exclusive: this.bind.exclusive
          });
      }
  }

  class Button extends HudElement {
      constructor(group, options) {
          var _a, _b;
          super(group, options);
          this.type = "button";
          let element = document.createElement("div");
          element.classList.add("button_wrapper");
          element.innerHTML = `
            <button class="button">${this.options.text}</button>
        `;
          this.element = element;
          this.button = element.querySelector("button");
          this.button.addEventListener("click", () => {
              var _a;
              this.dispatchEvent(new CustomEvent("click"));
              if (this.options.runFunction)
                  (_a = window.cheat.funcs.get(this.options.runFunction)) === null || _a === void 0 ? void 0 : _a.call(this);
          });
          if (this.options.keybind) {
              let keybindEditor = new KeybindEditor({
                  title: (_a = options.title) !== null && _a !== void 0 ? _a : `Set keybind for ${this.button.innerText}`,
                  keys: (_b = options.defaultKeybind) !== null && _b !== void 0 ? _b : new Set(),
                  exclusive: false,
                  callback: () => {
                      this.dispatchEvent(new CustomEvent("click"));
                  }
              });
              keybindEditor.attachTo(element);
          }
      }
      set text(text) {
          this.button.innerText = text;
      }
      get text() {
          return this.button.innerText;
      }
  }

  class TextInput extends HudElement {
      constructor(group, options) {
          var _a;
          super(group, options);
          this.input = null;
          this.type = "textInput";
          let element = document.createElement("div");
          element.innerHTML = `
            <div class="text">${this.options.text}</div>
            <input type="text" class="textinput" placeholder="${(_a = this.options.placeholder) !== null && _a !== void 0 ? _a : ""}">
        `;
          element.classList.add("textinput_wrapper");
          this.element = element;
          this.input = element.querySelector("input");
          this.input.addEventListener("input", () => {
              this.dispatchEvent(new CustomEvent("input", {
                  detail: this.text
              }));
          });
      }
      set text(text) {
          this.input.value = text;
      }
      get text() {
          return this.input.value;
      }
  }

  class Toggle extends HudElement {
      constructor(group, options) {
          var _a, _b, _c;
          super(group, options);
          this.type = "toggle";
          // create the element
          let element = document.createElement("div");
          element.innerHTML = `
			<button class="toggle"></button>
		`;
          element.classList.add("toggle_wrapper");
          // add a keybind if needed
          if (options.keybind) {
              let editorOptions = {
                  title: (_a = options.title) !== null && _a !== void 0 ? _a : "Set keybind for toggle",
                  keys: (_b = options.defaultKeybind) !== null && _b !== void 0 ? _b : new Set(),
                  exclusive: false,
                  callback: () => {
                      this.toggle();
                  }
              };
              if (options.keybindId)
                  editorOptions.id = options.keybindId;
              let keybindEditor = new KeybindEditor(editorOptions);
              keybindEditor.attachTo(element);
          }
          this.enabled = (_c = this.options.default) !== null && _c !== void 0 ? _c : false;
          this.element = element;
          this.button = element.querySelector("button");
          this._textEnabled = this.options.textEnabled;
          this._textDisabled = this.options.textDisabled;
          this.updateButton();
          // prevent the menu from being activated with enter
          this.button.addEventListener("keydown", (e) => e.preventDefault());
          this.button.addEventListener("click", () => {
              this.toggle();
          });
      }
      updateButton() {
          this.button.innerHTML = this.enabled ? this._textEnabled : this._textDisabled;
          this.button.classList.toggle("enabled", this.enabled);
      }
      toggle() {
          this.enabled = !this.enabled;
          this.updateButton();
          if (this.options.runFunction)
              window.cheat.funcs.get(this.options.runFunction)(this.enabled);
          this.dispatchEvent(new CustomEvent("change", {
              detail: this.enabled
          }));
      }
      get value() {
          var _a;
          return (_a = this.enabled) !== null && _a !== void 0 ? _a : false;
      }
      set value(value) {
          this.enabled = value;
          this.updateButton();
      }
      get textEnabled() {
          return this._textEnabled;
      }
      set textEnabled(text) {
          this._textEnabled = text;
          this.updateButton();
      }
      get textDisabled() {
          return this._textDisabled;
      }
      set textDisabled(text) {
          this._textDisabled = text;
          this.updateButton();
      }
  }

  class Dropdown extends HudElement {
      constructor(group, options) {
          super(group, options);
          this.type = "dropdown";
          // create the element
          this.element = document.createElement("div");
          this.element.classList.add("dropdown_wrapper");
          this.element.innerHTML = `
			<div class="text">${options.text}</div>
			<select class="dropdown">
				${options.options.map((option) => {
            return `<option value="${option}" ${option === options.default ? "selected" : ""}>
						${option}
					</option>`;
        }).join("")}
			</select>
		`;
          this.select = this.element.querySelector(".dropdown");
          // prevent accidental navigation with arrows
          this.select.addEventListener("keydown", (e) => e.preventDefault());
          // add the event listener
          this.select.addEventListener("change", () => {
              if (options.runFunction) {
                  window.cheat.funcs.get(this.options.runFunction)(this.select.value);
              }
              this.dispatchEvent(new CustomEvent("change", {
                  detail: this.select.value
              }));
          });
      }
      addOption(option) {
          let optionElement = document.createElement("option");
          optionElement.value = option;
          optionElement.innerText = option;
          this.select.appendChild(optionElement);
      }
      removeOption(option) {
          let optionElement = this.select.querySelector(`option[value="${option}"]`);
          if (optionElement) {
              this.select.removeChild(optionElement);
          }
          if (this.select.value === option) {
              this.select.value = this.select.options[0].value;
          }
      }
      setOptions(options) {
          this.select.innerHTML = "";
          options.forEach((option) => {
              this.addOption(option);
          });
      }
      get value() {
          return this.select.value;
      }
      set value(value) {
          this.select.value = value;
      }
  }

  class Slider extends HudElement {
      constructor(group, options) {
          var _a;
          super(group, options);
          this.type = "slider";
          let element = document.createElement("div");
          element.classList.add("slider_wrapper");
          element.innerHTML = `
			<div class = "text">${options.text}</div>
			<input type = "range" min = "${options.min}" max = "${options.max}" value = "${(_a = options.default) !== null && _a !== void 0 ? _a : 0}" class = "slider">
		`;
          this.slider = element.querySelector(".slider");
          this.element = element;
          // prevent the slider from dragging the menu when clicked
          this.slider.addEventListener("mousedown", (e) => {
              e.stopPropagation();
          });
          // listen for changes
          this.slider.addEventListener("input", () => {
              if (this.options.runFunction)
                  window.cheat.funcs.get(this.options.runFunction)(this.slider.value);
              this.dispatchEvent(new CustomEvent("change", {
                  detail: this.slider.value
              }));
          });
      }
      set value(value) {
          this.slider.value = value.toString();
      }
      get value() {
          return Number(this.slider.value);
      }
  }

  class Group {
      constructor(menu, parentGroup, name, isRoot = false) {
          this.name = "";
          this.hideTimeout = null;
          this.element = null;
          this.isRoot = false;
          this.groups = [];
          this.parentGroup = null;
          this.elements = [];
          this.menu = null;
          this.menu = menu;
          this.parentGroup = parentGroup;
          this.name = name;
          this.isRoot = isRoot;
          this.init();
      }
      init() {
          var _a, _b;
          let element = document.createElement("div");
          element.classList.add("group");
          if (!this.isRoot)
              element.style.display = "none";
          this.element = element;
          (_b = (_a = this.menu) === null || _a === void 0 ? void 0 : _a.element) === null || _b === void 0 ? void 0 : _b.appendChild(element);
          // add a back button if this isn't the root group
          if (!this.isRoot) {
              this.addElement("groupopener", {
                  text: "Back",
                  openGroup: this.parentGroup.name,
                  direction: "right"
              });
          }
      }
      addElement(type, options) {
          var _a;
          let element;
          switch (type.toLowerCase()) {
              case "text":
                  element = new Text(this, options);
                  break;
              case "groupopener":
                  element = new GroupOpener(this, options);
                  break;
              case "colorpicker":
                  element = new ColorPicker(this, options);
                  break;
              case "button":
                  element = new Button(this, options);
                  break;
              case "textinput":
                  element = new TextInput(this, options);
                  break;
              case "toggle":
                  element = new Toggle(this, options);
                  break;
              case "dropdown":
                  element = new Dropdown(this, options);
                  break;
              case "slider":
                  element = new Slider(this, options);
                  break;
              default:
                  console.error(`Unknown element type: ${type}`);
          }
          if (!element)
              return null;
          (_a = this.element) === null || _a === void 0 ? void 0 : _a.appendChild(element.element);
          this.elements.push(element);
          return element;
      }
      slide(mode, direction) {
          if (this.hideTimeout)
              clearTimeout(this.hideTimeout);
          this.element.style.animation = `slide_${mode}_${direction} both 0.5s`;
          if (mode == "in")
              this.element.style.display = "flex";
          else if (mode == "out") {
              this.hideTimeout = setTimeout(() => this.element.style.display = "none", 500);
          }
      }
      createGroup(name) {
          let existingGroup = this.menu.getAnyGroup(name);
          if (existingGroup)
              return existingGroup;
          let group = new Group(this.menu, this, name);
          this.groups.push(group);
          this.menu.groups.push(group);
          // add a button to open the group
          this.addElement("groupopener", {
              text: name,
              openGroup: name,
              direction: "left"
          });
          return group;
      }
      group(name) {
          for (let i = 0; i < this.groups.length; i++) {
              if (this.groups[i].name == name) {
                  return this.groups[i];
              }
          }
          return null;
      }
      remove() {
          var _a, _b;
          (_a = this.element) === null || _a === void 0 ? void 0 : _a.remove();
          (_b = this.parentGroup) === null || _b === void 0 ? void 0 : _b.groups.splice(this.parentGroup.groups.indexOf(this), 1);
          this.menu.groups.splice(this.menu.groups.indexOf(this), 1);
      }
      clearElements() {
          for (let i = 0; i < this.elements.length; i++) {
              let element = this.elements[i];
              if (element.type == "groupOpener")
                  continue;
              element.remove();
              i--;
          }
      }
      loadFromObject(object) {
          const loadGroups = () => {
              if (object.groups) {
                  for (let group of object.groups) {
                      let newGroup = this.createGroup(group.name);
                      newGroup.loadFromObject(group);
                  }
              }
          };
          const loadElements = () => {
              if (object.elements) {
                  for (let element of object.elements) {
                      this.addElement(element.type, element.options);
                  }
              }
          };
          if (object.order == "elementsFirst") {
              loadElements();
              loadGroups();
          }
          else {
              loadGroups();
              loadElements();
          }
      }
  }

  class MenuControls {
      constructor(menu) {
          this.menu = null;
          this.element = null;
          this.menu = menu;
          this.init();
      }
      init() {
          var _a, _b;
          let element = document.createElement("div");
          element.classList.add("menu_controls");
          element.innerHTML = this.menu.name;
          // create the minimizer
          let minimizer = document.createElement("div");
          minimizer.classList.add("menu_minimizer");
          this.element = element;
          this.element.appendChild(minimizer);
          (_b = (_a = this.menu) === null || _a === void 0 ? void 0 : _a.element) === null || _b === void 0 ? void 0 : _b.appendChild(element);
          this.updateMinimizer();
          minimizer.addEventListener("click", () => {
              var _a;
              (_a = this.menu) === null || _a === void 0 ? void 0 : _a.minimize();
              this.updateMinimizer();
          });
      }
      updateMinimizer() {
          var _a;
          if (!this.element)
              return;
          let minimizer = this.element.querySelector(".menu_minimizer");
          if (!minimizer)
              return;
          minimizer.innerHTML = ((_a = this.menu) === null || _a === void 0 ? void 0 : _a.minimized) ? "+" : "-";
      }
  }

  class Menu {
      // any is used to avoid circular dependencies
      constructor(hud, name, transform) {
          this.hud = null;
          this.element = null;
          this.rootGroup = null;
          this.name = "";
          this.groups = [];
          this.minimized = false;
          this.transform = {
              top: 0,
              left: 0,
              width: 300,
              height: 200,
              minimized: false
          };
          this.hud = hud;
          this.name = name;
          if (transform)
              this.transform = transform;
          this.init();
      }
      applyTransform(transform) {
          var _a;
          if (!this.element)
              return;
          if (transform.height < 50)
              transform.height = 50;
          if (transform.width < 50)
              transform.width = 50;
          this.element.style.top = `${transform.top}px`;
          this.element.style.left = `${transform.left}px`;
          this.element.style.width = `${transform.width}px`;
          this.element.style.height = `${transform.height}px`;
          this.minimize((_a = transform.minimized) !== null && _a !== void 0 ? _a : false);
      }
      init() {
          var _a;
          let element = document.createElement("div");
          element.classList.add("menu");
          this.element = element;
          (_a = this.hud) === null || _a === void 0 ? void 0 : _a.element.appendChild(element);
          this.applyTransform(this.transform);
          // create the menu controls
          new MenuControls(this);
          // create the root group
          let rootGroup = new Group(this, null, "root", true);
          this.rootGroup = rootGroup;
          this.groups.push(rootGroup);
          // add the root group to the menu
          if (rootGroup.element) {
              this.element.appendChild(rootGroup.element);
          }
          this.addListeners();
      }
      addListeners() {
          if (!this.element)
              return;
          let dragging = false;
          let dragStart = { x: 0, y: 0 };
          let dragDistance = 0;
          this.element.addEventListener("mousedown", (e) => {
              dragging = true;
              dragStart.x = e.clientX;
              dragStart.y = e.clientY;
              dragDistance = 0;
          });
          // cancel dragging if it's being resized
          window.addEventListener("mouseup", () => { dragging = false; });
          let observer = new ResizeObserver((e) => {
              // if the element is invisible ignore it
              if (e[0].contentRect.width == 0 || e[0].contentRect.height == 0)
                  return;
              dragging = false;
              this.transform.width = e[0].contentRect.width;
              if (!this.minimized)
                  this.transform.height = e[0].contentRect.height;
              this.syncTransform();
          });
          observer.observe(this.element);
          window.addEventListener("mousemove", (e) => {
              if (!dragging)
                  return;
              dragDistance += Math.abs(e.clientX - dragStart.x) + Math.abs(e.clientY - dragStart.y);
              if (dragDistance < 10)
                  return;
              let x = e.clientX - dragStart.x;
              let y = e.clientY - dragStart.y;
              this.element.style.left = `${this.element.offsetLeft + x}px`;
              this.element.style.top = `${this.element.offsetTop + y}px`;
              // sync the transform
              this.transform.top = this.element.offsetTop;
              this.transform.left = this.element.offsetLeft;
              this.syncTransform();
              // prevent the menu from going off screen
              if (this.element.offsetLeft < 0)
                  this.element.style.left = "0px";
              if (this.element.offsetTop < 0)
                  this.element.style.top = "0px";
              if (this.element.offsetLeft + this.element.offsetWidth > window.innerWidth)
                  this.element.style.left = `${window.innerWidth - this.element.offsetWidth}px`;
              if (this.element.offsetTop + this.element.offsetHeight > window.innerHeight)
                  this.element.style.top = `${window.innerHeight - this.element.offsetHeight}px`;
              dragStart.x = e.clientX;
              dragStart.y = e.clientY;
          });
      }
      syncTransform() {
          this.hud.updateMenuTransform(this.name, this.transform);
      }
      // adding a group to the menu instead places it in the root group
      createGroup(name) {
          return this.rootGroup.createGroup(name);
      }
      group(name) {
          return this.rootGroup.group(name);
      }
      addElement(type, options) {
          return this.rootGroup.addElement(type, options);
      }
      getAnyGroup(name) {
          for (let group of this.groups) {
              if (group.name == name)
                  return group;
          }
          return null;
      }
      remove() {
          var _a;
          (_a = this.element) === null || _a === void 0 ? void 0 : _a.remove();
          this.hud.menus.splice(this.hud.menus.indexOf(this), 1);
      }
      minimize(force = null) {
          if (force == null)
              this.minimized = !this.minimized;
          else
              this.minimized = force;
          this.element.classList.toggle("minimized", this.minimized);
          this.transform.minimized = this.minimized;
          this.syncTransform();
      }
      loadFromObject(object) {
          this.rootGroup.loadFromObject(object);
      }
  }

  const DefaultCss = new Map([
      ["menu-bg-color", "rgba(0, 0, 0, 0.5)"],
      ["menu-border-color", "rgba(0, 0, 0, 0)"],
      ["text-color", "rgba(255, 255, 255, 1)"],
      ["button-bg-color", "rgba(0, 0, 0, 0.5)"],
      ["button-border-color", "rgba(255, 255, 255, 1)"],
      ["menu-controls-bg-color", "rgba(0, 0, 255, 0.5)"],
      ["menu-controls-text-color", "rgba(255, 255, 255, 1)"],
      ["textinput-border-color", "rgba(255, 255, 255, 1)"],
      ["textinput-bg-color", "rgba(0, 0, 0, 0.5)"],
      ["toggle-bg-color", "rgba(0, 0, 0, 0.5)"],
      ["toggle-border-color", "rgba(255, 255, 255, 1)"],
      ["dropdown-bg-color", "rgba(0, 0, 0, 0.5)"],
      ["dropdown-border-color", "rgba(255, 255, 255, 1)"],
      ["keybind-editor-bg-color", "rgba(0, 0, 0, 0.75)"],
      ["keybind-editor-border-color", "rgba(255, 255, 255, 1)"]
  ]);
  const DefaultMenuTransforms = new Map([
      ["HUD Customization", {
              top: 10,
              left: 10,
              width: Math.min(window.innerWidth / 4, 350),
              height: window.innerHeight / 2,
              minimized: false
          }],
      ["Devtools", {
              top: window.innerHeight / 2 + 10,
              left: 10,
              width: Math.min(window.innerWidth / 4, 350),
              height: window.innerHeight / 2,
              minimized: true
          }],
      ["General Cheats", {
              top: 10,
              left: window.innerWidth / 3 + 20,
              width: Math.min(window.innerWidth / 4, 350),
              height: window.innerHeight / 2,
              minimized: false
          }],
      ["Cheats for gamemodes", {
              top: 10,
              left: window.innerWidth / 3 * 2 + 30,
              width: Math.min(window.innerWidth / 4, 350),
              height: window.innerHeight / 2,
              minimized: false
          }]
  ]);
  const DefaultKeybinds = new Map([]);
  const HudCustomizerMenu = {
      menus: [
          {
              name: "HUD Customization",
              groups: [
                  {
                      name: "General",
                      order: "elementsFirst",
                      elements: [
                          {
                              type: "colorpicker",
                              options: {
                                  text: "Text Color",
                                  bindVar: "text-color"
                              }
                          }
                      ],
                      groups: [
                          {
                              name: "Menu Appearance",
                              elements: [
                                  {
                                      type: "colorpicker",
                                      options: {
                                          text: "Menu Background Color",
                                          bindVar: "menu-bg-color"
                                      }
                                  },
                                  {
                                      type: "colorpicker",
                                      options: {
                                          text: "Menu Border Color",
                                          bindVar: "menu-border-color"
                                      }
                                  }
                              ]
                          },
                          {
                              name: "Menu Controls Appearance",
                              elements: [
                                  {
                                      type: "colorpicker",
                                      options: {
                                          text: "Menu Controls Background Color",
                                          bindVar: "menu-controls-bg-color"
                                      }
                                  },
                                  {
                                      type: "colorpicker",
                                      options: {
                                          text: "Menu Controls Text Color",
                                          bindVar: "menu-controls-text-color"
                                      }
                                  }
                              ]
                          },
                          {
                              name: "Keybind Editor Appearance",
                              elements: [
                                  {
                                      type: "colorpicker",
                                      options: {
                                          text: "Keybind Editor Background Color",
                                          bindVar: "keybind-editor-bg-color"
                                      }
                                  },
                                  {
                                      type: "colorpicker",
                                      options: {
                                          text: "Keybind Editor Border Color",
                                          bindVar: "keybind-editor-border-color"
                                      }
                                  }
                              ]
                          }
                      ]
                  },
                  {
                      name: "Elements",
                      groups: [
                          {
                              name: "Buttons",
                              elements: [
                                  {
                                      type: "colorpicker",
                                      options: {
                                          text: "Button Background Color",
                                          bindVar: "button-bg-color"
                                      }
                                  },
                                  {
                                      type: "colorpicker",
                                      options: {
                                          text: "Button Border Color",
                                          bindVar: "button-border-color"
                                      }
                                  }
                              ]
                          },
                          {
                              name: "Text Inputs",
                              elements: [
                                  {
                                      type: "colorpicker",
                                      options: {
                                          text: "Text Input Background Color",
                                          bindVar: "textinput-bg-color"
                                      }
                                  },
                                  {
                                      type: "colorpicker",
                                      options: {
                                          text: "Text Input Border Color",
                                          bindVar: "textinput-border-color"
                                      }
                                  }
                              ]
                          },
                          {
                              name: "Toggles",
                              elements: [
                                  {
                                      type: "colorpicker",
                                      options: {
                                          text: "Toggle Background Color",
                                          bindVar: "toggle-bg-color"
                                      }
                                  },
                                  {
                                      type: "colorpicker",
                                      options: {
                                          text: "Toggle Border Color",
                                          bindVar: "toggle-border-color"
                                      }
                                  }
                              ]
                          },
                          {
                              name: "Dropdowns",
                              elements: [
                                  {
                                      type: "colorpicker",
                                      options: {
                                          text: "Dropdown Background Color",
                                          bindVar: "dropdown-bg-color"
                                      }
                                  },
                                  {
                                      type: "colorpicker",
                                      options: {
                                          text: "Dropdown Border Color",
                                          bindVar: "dropdown-border-color"
                                      }
                                  }
                              ]
                          }
                      ]
                  }
              ],
              elements: [
                  {
                      type: "button",
                      options: {
                          text: "Reset settings",
                          runFunction: "resetSettings"
                      }
                  }
              ]
          }
      ]
  };

  class OverlayCanvas {
      constructor() {
          this.canvas = document.createElement("canvas");
          this.canvas.classList.add("gc_overlay_canvas");
          this.canvas.width = window.innerWidth;
          this.canvas.height = window.innerHeight;
          // keep the canvas scaled to the window size
          window.addEventListener("resize", () => {
              this.canvas.width = window.innerWidth;
              this.canvas.height = window.innerHeight;
          });
      }
      get context() {
          return this.canvas.getContext("2d");
      }
  }

  // @ts-ignore
  class Hud {
      constructor(cheat) {
          this.element = null;
          this.menus = [];
          this.cssVarsSheet = null;
          // so we can access this globally while it's being constructed
          window.cheat.hud = this;
          this.syncedVars = new Map();
          this.cheat = cheat;
          this.cheat.funcs.set("resetSettings", this.resetSettings.bind(this));
          this.loadSyncedVar("cssVars", DefaultCss);
          this.loadSyncedVar("menuTransforms", DefaultMenuTransforms);
          this.loadSyncedVar("keybinds", DefaultKeybinds);
          this.updateCssVars();
          this.init();
          // load the customizer menu by default
          this.loadFromObject(HudCustomizerMenu);
          this.addToggle();
      }
      resetSettings() {
          if (!confirm("Setting updates will only take place after you reload the page, are you sure you want to reset settings?"))
              return;
          GM_deleteValue("cssVars");
          GM_deleteValue("menuTransforms");
          GM_deleteValue("keybinds");
      }
      addToggle() {
          this.cheat.keybindManager.registerBind({
              keys: new Set(["\\"]),
              exclusive: false,
              callback: () => {
                  if (this.element) {
                      this.element.style.display = this.element.style.display == "none" ? "" : "none";
                  }
              }
          });
      }
      createMenu(name) {
          var _a;
          let existingMenu = this.menu(name);
          if (existingMenu)
              return existingMenu;
          let menuTransform = (_a = this.syncedVars.get("menuTransforms")) === null || _a === void 0 ? void 0 : _a.get(name);
          let menu = new Menu(this, name, menuTransform);
          this.menus.push(menu);
          return menu;
      }
      menu(name) {
          for (let i = 0; i < this.menus.length; i++) {
              if (this.menus[i].name == name) {
                  return this.menus[i];
              }
          }
          return null;
      }
      loadSyncedVar(name, defaultValue) {
          let loadedValue = GM_getValue(name, "{}");
          let storedValue = JSON.parse(loadedValue);
          for (let [key, value] of defaultValue) {
              if (!storedValue[key])
                  storedValue[key] = value;
          }
          this.syncedVars.set(name, new Map(Object.entries(storedValue)));
      }
      updateCssVar(key, value) {
          var _a, _b;
          (_a = this.syncedVars.get("cssVars")) === null || _a === void 0 ? void 0 : _a.set(key, value);
          this.updateCssVars();
          // save the css vars
          let cssVars = JSON.stringify(Object.fromEntries((_b = this.syncedVars.get("cssVars")) !== null && _b !== void 0 ? _b : []));
          GM_setValue("cssVars", cssVars);
      }
      updateMenuTransform(name, transform) {
          var _a, _b;
          (_a = this.syncedVars.get("menuTransforms")) === null || _a === void 0 ? void 0 : _a.set(name, transform);
          // save the menu transforms
          let menuTransforms = JSON.stringify(Object.fromEntries((_b = this.syncedVars.get("menuTransforms")) !== null && _b !== void 0 ? _b : []));
          GM_setValue("menuTransforms", menuTransforms);
      }
      updateKeybind(id, value) {
          var _a, _b;
          console.log(id, value);
          (_a = this.syncedVars.get("keybinds")) === null || _a === void 0 ? void 0 : _a.set(id, value);
          // save the keybinds
          let keybinds = JSON.stringify(Object.fromEntries((_b = this.syncedVars.get("keybinds")) !== null && _b !== void 0 ? _b : []));
          GM_setValue("keybinds", keybinds);
      }
      updateCssVars() {
          var _a;
          if (!this.cssVarsSheet) {
              this.cssVarsSheet = new CSSStyleSheet();
              document.adoptedStyleSheets = [...document.adoptedStyleSheets, this.cssVarsSheet];
          }
          let cssVars = ":root {\n";
          for (let [key, value] of (_a = this.syncedVars.get("cssVars")) !== null && _a !== void 0 ? _a : []) {
              cssVars += `\t--${key}: ${value};\n`;
          }
          cssVars += "}";
          this.cssVarsSheet.replaceSync(cssVars);
      }
      init() {
          let style = new CSSStyleSheet();
          style.replaceSync(css);
          document.adoptedStyleSheets = [...document.adoptedStyleSheets, style];
          let hud = document.createElement("div");
          hud.id = "gc_hud";
          this.element = hud;
          // the body is not loaded yet, so we have to wait
          document.addEventListener("DOMContentLoaded", () => {
              document.body.appendChild(hud);
          });
          this.updateCssVars();
      }
      loadFromObject(obj) {
          for (let menu of obj.menus) {
              let newMenu = this.createMenu(menu.name);
              newMenu.loadFromObject(menu);
          }
      }
      createOverlayCanvas() {
          var _a;
          let canvas = new OverlayCanvas();
          (_a = document.body) === null || _a === void 0 ? void 0 : _a.appendChild(canvas.canvas);
          return canvas;
      }
  }

  const hudAddition$7 = {
      menus: [
          {
              name: "Devtools",
              elements: [
                  {
                      type: "toggle",
                      options: {
                          textEnabled: "Stop logging incoming messages",
                          textDisabled: "Log incoming messages",
                          default: false,
                          runFunction: "logIncomingMessages"
                      }
                  },
                  {
                      type: "button",
                      options: {
                          text: "Log closest device",
                          runFunction: "logClosestDevice"
                      }
                  }
              ]
          }
      ]
  };
  class DevtoolsClass {
      constructor() {
          this.name = "Gimkit Cheat Devtools";
          this.hudAddition = hudAddition$7;
          this.loggingIncomingMessages = false;
          this.funcs = new Map([
              ["logIncomingMessages", (enabled) => {
                      this.loggingIncomingMessages = enabled;
                  }],
              ["logClosestDevice", () => {
                      this.logClosestDevice();
                  }]
          ]);
      }
      init(cheat) {
          cheat.socketHandler.addEventListener("recieveMessage", (e) => {
              if (!this.loggingIncomingMessages)
                  return;
              cheat.log("Incoming message", e.detail);
          });
      }
      logClosestDevice() {
          var _a, _b, _c, _d, _e, _f, _g, _h;
          let devices = (_e = (_d = (_c = (_b = (_a = unsafeWindow === null || unsafeWindow === void 0 ? void 0 : unsafeWindow.stores) === null || _a === void 0 ? void 0 : _a.phaser) === null || _b === void 0 ? void 0 : _b.scene) === null || _c === void 0 ? void 0 : _c.worldManager) === null || _d === void 0 ? void 0 : _d.devices) === null || _e === void 0 ? void 0 : _e.devicesInView;
          let body = (_h = (_g = (_f = unsafeWindow === null || unsafeWindow === void 0 ? void 0 : unsafeWindow.stores) === null || _f === void 0 ? void 0 : _f.phaser) === null || _g === void 0 ? void 0 : _g.mainCharacter) === null || _h === void 0 ? void 0 : _h.body;
          let closest = null;
          let closestDistance = Infinity;
          for (let device of devices) {
              if (device.interactiveZones.zones.length == 0)
                  continue;
              let distance = Math.sqrt(Math.pow(device.x - body.x, 2) + Math.pow(device.y - body.y, 2));
              if (distance < closestDistance) {
                  closest = device;
                  closestDistance = distance;
              }
          }
          console.log(closest);
      }
  }
  function Devtools() {
      return new DevtoolsClass();
  }

  const hudAddition$6 = {
      menus: [
          {
              name: "General Cheats",
              elements: [
                  {
                      type: "toggle",
                      options: {
                          textEnabled: "Stop auto answering",
                          textDisabled: "Auto answer",
                          default: false,
                          runFunction: "setAutoAnswer",
                          keybind: true,
                          keybindId: "autoAnswer"
                      }
                  }
              ]
          }
      ]
  };
  class AutoanswerClass {
      constructor() {
          this.name = "Autoanswer";
          this.hudAddition = hudAddition$6;
          this.autoAnswering = false;
          this.funcs = new Map([
              ["setAutoAnswer", (enabled) => {
                      this.autoAnswering = enabled;
                  }]
          ]);
          this.currentQuestionId = "";
          this.answerDeviceId = "";
          this.questions = [];
          // blueboat specific
          this.questionIdList = [];
          this.currentQuestionIndex = 0;
      }
      init(cheat) {
          cheat.socketHandler.addEventListener("recieveMessage", (e) => {
              var _a;
              if (cheat.socketHandler.transportType == "colyseus")
                  return;
              // get the questions and question list
              if (((_a = e.detail) === null || _a === void 0 ? void 0 : _a.key) != "STATE_UPDATE")
                  return;
              switch (e.detail.data.type) {
                  case "GAME_QUESTIONS":
                      this.questions = e.detail.data.value;
                      break;
                  case "PLAYER_QUESTION_LIST":
                      this.questionIdList = e.detail.data.value.questionList;
                      this.currentQuestionIndex = e.detail.data.value.questionIndex;
                      break;
                  case "PLAYER_QUESTION_LIST_INDEX":
                      this.currentQuestionIndex = e.detail.data.value;
                      break;
              }
          });
          cheat.socketHandler.addEventListener("recieveChanges", (e) => {
              var _a, _b, _c;
              let changes = e.detail;
              for (let change of changes) {
                  // try to get the device ID of the answer device
                  for (let [key, value] of Object.entries(change.data)) {
                      if (key != "GLOBAL_questions")
                          continue;
                      this.questions = JSON.parse(value);
                      this.answerDeviceId = change.id;
                  }
                  // check whether it includes the new question ID
                  for (let [key, value] of Object.entries(change.data)) {
                      if (key.includes("currentQuestionId") && key.includes((_c = (_b = (_a = unsafeWindow.stores) === null || _a === void 0 ? void 0 : _a.phaser) === null || _b === void 0 ? void 0 : _b.mainCharacter) === null || _c === void 0 ? void 0 : _c.id)) {
                          this.currentQuestionId = value;
                      }
                  }
              }
          });
          setInterval(() => {
              var _a;
              if (!this.autoAnswering)
                  return;
              if (cheat.socketHandler.transportType == "colyseus") {
                  if (this.currentQuestionId == "")
                      return;
                  let correctQuestion = (_a = this.questions) === null || _a === void 0 ? void 0 : _a.find(q => q._id == this.currentQuestionId);
                  if (!correctQuestion)
                      return;
                  let packet = {
                      key: 'answered',
                      deviceId: this.answerDeviceId,
                      data: {}
                  };
                  if (correctQuestion.type == 'text') {
                      packet.data.answer = correctQuestion.answers[0].text;
                  }
                  else {
                      let correctAnswerId = correctQuestion.answers.find((a) => a.correct)._id;
                      packet.data.answer = correctAnswerId;
                  }
                  cheat.socketHandler.sendData("MESSAGE_FOR_DEVICE", packet);
              }
              else {
                  let questionId = this.questionIdList[this.currentQuestionIndex];
                  let question = this.questions.find(q => q._id == questionId);
                  if (!question)
                      return;
                  let answer;
                  if (question.type == 'mc') {
                      answer = question.answers.find((a) => a.correct)._id;
                  }
                  else {
                      answer = question.answers[0].text;
                  }
                  cheat.socketHandler.sendData("QUESTION_ANSWERED", {
                      answer,
                      questionId: questionId
                  });
              }
          }, 1000);
      }
  }
  function Autoanswer() {
      return new AutoanswerClass();
  }

  let skins = ["Unchanged", "default_browngreen", "default_cyan", "default_darkblue", "default_darkgreen", "default_darkpurple", "default_gray", "default_grayblue", "default_graybrown", "default_hotpink", "default_lightbrown", "default_lightgreen", "default_lightpink", "default_lightpurple", "default_lightyellow", "default_lime", "default_maroon", "default_orange", "default_pink", "default_red", "default_yellow", "sunny", "glassHalfFull", "stripeDoubleGreen", "sprinklesRed", "dayOne", "vortexAgent", "echoAgent", "grayGradient", "mustache", "clown", "redNinja", "redDeliciousApple", "polkaDotBlueAndYellow", "fadedBlueGradient", "whiteAndBlueVerticalStripes", "volcanoCracks", "pinkPaste", "yellowCracksPurple", "glyphsYellowBrown", "camoBlue", "glyphsOrangeBlue", "purplePaste", "mustacheBrown", "mustachePink", "polkaDotWhiteAndRed", "camoTan", "camoGreen", "stripeDoublePurple", "stripeDoubleRed", "stripeDoubleYellow", "sprinklesChocolate", "coolRedBlueGradient", "mountainAndSun", "redDinoCostume", "pencilPack", "corn", "luchador", "fox", "burger", "galaxy", "cellBlue", "cellGold", "rockyWest", "puzzleRedGreen", "puzzleOrangeBlue", "puzzleGrayWhite", "puzzleGreenBlue", "puzzleYellowPurple", "pumpkin", "ghostCostume", "mummy", "fifthBirthday", "pumpkinPie", "feast", "frostBuddy", "festiveOnesieTan", "festiveOnesieRed", "festiveOnesieGreen", "festiveOnesieBlue", "hotChocolate", "snowglobe", "polkaDotFestive", "polkaDotFestiveReverse", "mustacheSanta", "firework", "gift", "snowman", "detective", "yinYang", "astroHelmet", "hamster", "pirate", "rockstar", "circuitGray", "circuitBlue", "circuitGreen", "roses", "heart", "zebra", "constellationBlackWhite", "constellationBlackGreen", "constellationPurpleYellow", "constellationPinkGreen", "constellationYellowPink", "squiggles", "frozenMummy", "leprechaun", "evilPlantGreen", "evilPlantPink", "fisher", "rainbowWave", "sketch", "sketchBlue", "bananaSplit", "eightBit", "gamerGreen", "gamerPink", "gamerPurple", "gamerYellow", "graduate", "graduateBlue", "arcticFox", "coffee", "partyPineapple", "sentryRobot", "construction", "clock", "crashTestDummy"];
  let trails = ["None", "origin_token"];
  skins = skins.sort();
  trails = trails.sort();
  const hudAddition$5 = {
      menus: [
          {
              name: "General Cheats",
              groups: [
                  {
                      name: "Cosmetic Picker",
                      elements: [
                          {
                              type: "text",
                              options: {
                                  text: "Select cosmetics to apply to your character. These changes are only visible to you."
                              }
                          },
                          {
                              type: "dropdown",
                              options: {
                                  text: "Selected Skin",
                                  options: skins,
                                  runFunction: "setSkin",
                                  default: "Unchanged"
                              }
                          },
                          {
                              type: "dropdown",
                              options: {
                                  text: "Selected Trail",
                                  options: trails,
                                  runFunction: "setTrail",
                                  default: "None"
                              }
                          }
                      ]
                  }
              ]
          }
      ]
  };
  class CosmeticpickerClass {
      constructor() {
          this.name = "Cosmetic Picker";
          this.hudAddition = hudAddition$5;
          this.funcs = new Map([
              ["setSkin", (skin) => {
                      this.setSkin(skin);
                  }],
              ["setTrail", (trail) => {
                      this.setTrail(trail);
                  }]
          ]);
          this.skinWaiting = false;
          this.trailWaiting = false;
          this.customSkin = "Unchaged";
      }
      init(cheat) {
          var _a, _b, _c, _d, _e, _f, _g, _h;
          // create the custom skin input
          let customSkinInput = (_b = (_a = cheat.hud.menu("General Cheats")) === null || _a === void 0 ? void 0 : _a.group("Cosmetic Picker")) === null || _b === void 0 ? void 0 : _b.addElement("textinput", {
              text: "Other skin input"
          });
          customSkinInput.addEventListener("input", (e) => {
              this.customSkin = e.detail;
          });
          let applyButton = (_d = (_c = cheat.hud.menu("General Cheats")) === null || _c === void 0 ? void 0 : _c.group("Cosmetic Picker")) === null || _d === void 0 ? void 0 : _d.addElement("button", {
              text: "Apply Other Skin",
          });
          applyButton.addEventListener("click", () => {
              this.setSkin(this.customSkin);
          });
          // create the custom trail input
          let customTrailInput = (_f = (_e = cheat.hud.menu("General Cheats")) === null || _e === void 0 ? void 0 : _e.group("Cosmetic Picker")) === null || _f === void 0 ? void 0 : _f.addElement("textinput", {
              text: "Other trail input"
          });
          customTrailInput.addEventListener("input", (e) => {
              this.customSkin = e.detail;
          });
          let applyTrailButton = (_h = (_g = cheat.hud.menu("General Cheats")) === null || _g === void 0 ? void 0 : _g.group("Cosmetic Picker")) === null || _h === void 0 ? void 0 : _h.addElement("button", {
              text: "Apply Other Trail",
          });
          applyTrailButton.addEventListener("click", () => {
              this.setTrail(this.customSkin);
          });
      }
      setSkin(skin) {
          var _a, _b, _c, _d, _e, _f;
          if (skin == "Unchanged")
              return;
          if (!("stores" in unsafeWindow)) {
              if (this.skinWaiting)
                  return;
              let checkInterval = setInterval(() => {
                  if ("stores" in unsafeWindow) {
                      if (this.hasSkinApplied(skin))
                          clearInterval(checkInterval);
                      this.setSkin(skin);
                  }
              }, 100);
              this.skinWaiting = true;
              return;
          }
          let phaser = unsafeWindow.stores.phaser;
          let userId = (_a = phaser.mainCharacter) === null || _a === void 0 ? void 0 : _a.id;
          if (!userId)
              return;
          let skinId = `character_${skin}`;
          (_f = (_e = (_d = (_c = (_b = phaser.scene) === null || _b === void 0 ? void 0 : _b.characterManager) === null || _c === void 0 ? void 0 : _c.characters) === null || _d === void 0 ? void 0 : _d.get(userId)) === null || _e === void 0 ? void 0 : _e.skin) === null || _f === void 0 ? void 0 : _f.updateSkin(skinId);
      }
      hasSkinApplied(skin) {
          var _a, _b, _c, _d, _e;
          let phaser = unsafeWindow.stores.phaser;
          let userId = (_a = phaser.mainCharacter) === null || _a === void 0 ? void 0 : _a.id;
          if (!userId)
              return;
          let skinId = `character_${skin}`;
          return ((_e = (_d = (_c = (_b = phaser.scene) === null || _b === void 0 ? void 0 : _b.characterManager) === null || _c === void 0 ? void 0 : _c.characters) === null || _d === void 0 ? void 0 : _d.get(userId)) === null || _e === void 0 ? void 0 : _e.skin.skinId) == skinId;
      }
      setTrail(trail) {
          var _a, _b, _c, _d, _e, _f;
          if (!("stores" in unsafeWindow)) {
              if (this.trailWaiting)
                  return;
              let checkInterval = setInterval(() => {
                  if ("stores" in unsafeWindow) {
                      if (this.hasSkinApplied(trail))
                          clearInterval(checkInterval);
                      this.setTrail(trail);
                  }
              }, 100);
              this.trailWaiting = true;
              return;
          }
          let phaser = unsafeWindow.stores.phaser;
          let userId = (_a = phaser.mainCharacter) === null || _a === void 0 ? void 0 : _a.id;
          if (!userId)
              return;
          // blank trail is "None"
          if (trail == "None")
              trail = "";
          let trailId = `trail_${trail}`;
          (_f = (_e = (_d = (_c = (_b = phaser.scene) === null || _b === void 0 ? void 0 : _b.characterManager) === null || _c === void 0 ? void 0 : _c.characters) === null || _d === void 0 ? void 0 : _d.get(userId)) === null || _e === void 0 ? void 0 : _e.characterTrail) === null || _f === void 0 ? void 0 : _f.updateAppearance(trailId);
      }
  }
  function Cosmeticpicker() {
      return new CosmeticpickerClass();
  }

  const hudAddition$4 = {
      menus: [
          {
              name: "General Cheats",
              groups: [
                  {
                      name: "Player Highlighter",
                      elements: [
                          {
                              type: "toggle",
                              options: {
                                  textEnabled: "Stop Highlighting Teammates",
                                  textDisabled: "Highlight Teammates",
                                  runFunction: "highlightTeammates",
                                  keybind: true,
                                  keybindId: "highlightTeammates"
                              }
                          },
                          {
                              type: "toggle",
                              options: {
                                  textEnabled: "Stop Highlighting Enemies",
                                  textDisabled: "Highlight Enemies",
                                  runFunction: "highlightEnemies",
                                  keybind: true,
                                  keybindId: "highlightEnemies"
                              }
                          },
                          {
                              type: "slider",
                              options: {
                                  text: "Arrow Distance",
                                  min: 20,
                                  max: 750,
                                  default: 200,
                                  runFunction: "setArrowDistance"
                              }
                          }
                      ]
                  }
              ]
          }
      ]
  };
  class PlayerhighlighterClass {
      constructor() {
          this.name = "Player Highlighter";
          this.hudAddition = hudAddition$4;
          this.funcs = new Map([
              ["highlightTeammates", (value) => {
                      this.highlightingTeammates = value;
                  }],
              ["highlightEnemies", (value) => {
                      this.highlightingEnemies = value;
                  }],
              ["setArrowDistance", (value) => {
                      this.arrowDistance = value;
                  }]
          ]);
          this.highlightingTeammates = false;
          this.highlightingEnemies = false;
          this.ctx = null;
          this.canvas = null;
          this.arrowDistance = 200;
      }
      init(cheat) {
          setInterval(() => {
              var _a, _b;
              if (!((_b = (_a = unsafeWindow === null || unsafeWindow === void 0 ? void 0 : unsafeWindow.stores) === null || _a === void 0 ? void 0 : _a.phaser) === null || _b === void 0 ? void 0 : _b.scene))
                  return;
              if (this.canvas == null) {
                  this.canvas = cheat.hud.createOverlayCanvas();
                  this.ctx = this.canvas.context;
              }
              this.render();
          }, 100);
      }
      render() {
          var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
          (_a = this.ctx) === null || _a === void 0 ? void 0 : _a.clearRect(0, 0, (_c = (_b = this.canvas) === null || _b === void 0 ? void 0 : _b.canvas.width) !== null && _c !== void 0 ? _c : 1920, (_e = (_d = this.canvas) === null || _d === void 0 ? void 0 : _d.canvas.height) !== null && _e !== void 0 ? _e : 1080);
          let phaser = unsafeWindow.stores.phaser;
          let characters = phaser.scene.characterManager.characters;
          let user = phaser.mainCharacter;
          for (let [id, data] of characters) {
              if (id == user.id)
                  continue;
              let isEnemy = data.teamId != user.teamId;
              if (isEnemy && !this.highlightingEnemies)
                  continue;
              if (!isEnemy && !this.highlightingTeammates)
                  continue;
              this.ctx.strokeStyle = isEnemy ? "red" : "green";
              this.ctx.lineWidth = 5;
              // render an arrow pointing to the player
              let angle = Math.atan2(data.body.y - user.body.y, data.body.x - user.body.x);
              let distance = Math.sqrt(Math.pow(data.body.x - user.body.x, 2) + Math.pow(data.body.y - user.body.y, 2));
              let arrowDistance = Math.min(distance, this.arrowDistance);
              let arrowTip = {
                  x: Math.cos(angle) * arrowDistance + this.canvas.canvas.width / 2,
                  y: Math.sin(angle) * arrowDistance + this.canvas.canvas.height / 2
              };
              let leftTipAngle = angle - Math.PI / 4 * 3;
              let rightTipAngle = angle + Math.PI / 4 * 3;
              // draw a line from the center to both tips
              (_f = this.ctx) === null || _f === void 0 ? void 0 : _f.beginPath();
              (_g = this.ctx) === null || _g === void 0 ? void 0 : _g.moveTo(arrowTip.x, arrowTip.y);
              (_h = this.ctx) === null || _h === void 0 ? void 0 : _h.lineTo(Math.cos(leftTipAngle) * 50 + arrowTip.x, Math.sin(leftTipAngle) * 50 + arrowTip.y);
              (_j = this.ctx) === null || _j === void 0 ? void 0 : _j.moveTo(arrowTip.x, arrowTip.y);
              (_k = this.ctx) === null || _k === void 0 ? void 0 : _k.lineTo(Math.cos(rightTipAngle) * 50 + arrowTip.x, Math.sin(rightTipAngle) * 50 + arrowTip.y);
              (_l = this.ctx) === null || _l === void 0 ? void 0 : _l.stroke();
              // write the user's name and distance
              this.ctx.fillStyle = "black";
              this.ctx.font = "20px Verdana";
              this.ctx.textAlign = "center";
              this.ctx.textBaseline = "middle";
              this.ctx.fillText(`${data.nametag.name} (${Math.round(distance)})`, arrowTip.x, arrowTip.y);
          }
      }
  }
  function Playerhighlighter() {
      return new PlayerhighlighterClass();
  }

  class FreecamClass {
      constructor() {
          this.name = "Cosmetic Picker";
          this.freecamming = false;
          this.freeCamPos = { x: 0, y: 0 };
          this.toggleFreecam = null;
          this.spectateMenu = null;
          this.keys = new Set();
          this.lastPlayers = [];
      }
      init(cheat) {
          let camGroup = cheat.hud.createMenu("General Cheats").createGroup("Freecam");
          // initialize all the elements
          let toggleFreecam = camGroup.addElement("toggle", {
              textEnabled: "Stop Freecamming",
              textDisabled: "Unbind Camera",
              keybind: true,
              keybindId: "toggleFreecam"
          });
          toggleFreecam.addEventListener("change", (e) => {
              if (!this.camHelper) {
                  toggleFreecam.value = false;
                  return;
              }
              this.enableFreecam(e.detail);
          });
          let dropdown = camGroup.addElement("dropdown", {
              text: "Spectate Player",
              options: ["None"]
          });
          dropdown.addEventListener("change", (e) => {
              this.spectatePlayer(e.detail);
          });
          this.toggleFreecam = toggleFreecam;
          this.spectateMenu = dropdown;
          cheat.addEventListener('gameLoaded', () => {
              this.camHelper = unsafeWindow.stores.phaser.scene.cameraHelper;
              // add in the update loop
              setInterval(() => {
                  this.update();
              }, 1000 / 60);
          });
          window.addEventListener("keydown", (e) => {
              if (!this.freecamming)
                  return;
              if (!e.key.includes("Arrow"))
                  return;
              e.stopImmediatePropagation();
              this.keys.add(e.key);
          });
          window.addEventListener("keyup", (e) => {
              this.keys.delete(e.key);
          });
      }
      enableFreecam(value) {
          let phaser = unsafeWindow.stores.phaser;
          let camera = phaser.scene.cameras.cameras[0];
          if (value) {
              this.camHelper.stopFollow();
              this.freeCamPos.x = camera.midPoint.x;
              this.freeCamPos.y = camera.midPoint.y;
              camera.useBounds = false;
          }
          else {
              let charObj = phaser.scene.characterManager.characters.get(phaser.mainCharacter.id).body;
              this.camHelper.startFollowingObject({ object: charObj });
              camera.useBounds = true;
          }
          this.freecamming = value;
      }
      spectatePlayer(name) {
          // prevent freecamming if we already are
          this.enableFreecam(false);
          if (name == "None")
              return;
          this.toggleFreecam.value = true;
          let phaser = unsafeWindow.stores.phaser;
          let players = phaser.scene.characterManager.characters;
          for (let [id, player] of players) {
              if (player.nametag.name == name) {
                  this.camHelper.startFollowingObject({ object: player.body });
                  break;
              }
          }
      }
      update() {
          this.updateSpectatablePlayers();
          if (!this.freecamming)
              return;
          // move the camera
          if (this.keys.has("ArrowUp"))
              this.freeCamPos.y -= 20;
          if (this.keys.has("ArrowDown"))
              this.freeCamPos.y += 20;
          if (this.keys.has("ArrowLeft"))
              this.freeCamPos.x -= 20;
          if (this.keys.has("ArrowRight"))
              this.freeCamPos.x += 20;
          this.camHelper.goTo(this.freeCamPos);
      }
      updateSpectatablePlayers() {
          var _a;
          let phaser = unsafeWindow.stores.phaser;
          let players = phaser.scene.characterManager.characters;
          let options = ["None"];
          for (let [id, player] of players) {
              if (id == phaser.mainCharacter.id)
                  continue;
              options.push(player.nametag.name);
          }
          // make sure the list of players has changed
          let same = true;
          if (this.lastPlayers.length != options.length)
              same = false;
          else {
              for (let i = 0; i < this.lastPlayers.length; i++) {
                  if (this.lastPlayers[i] != options[i]) {
                      same = false;
                      break;
                  }
              }
          }
          if (same)
              return;
          this.lastPlayers = options;
          (_a = this.spectateMenu) === null || _a === void 0 ? void 0 : _a.setOptions(options);
      }
  }
  function Freecam() {
      return new FreecamClass();
  }

  var UpgradeType;
  (function (UpgradeType) {
      UpgradeType["Insurance"] = "insurance";
      UpgradeType["Money Per Question"] = "moneyPerQuestion";
      UpgradeType["Multiplier"] = "multiplier";
      UpgradeType["Streak Bonus"] = "streakBonus";
  })(UpgradeType || (UpgradeType = {}));
  const hudAddition$3 = {
      menus: [
          {
              name: "Cheats for gamemodes",
              groups: [
                  {
                      name: "Classic",
                      elements: [
                          {
                              type: "toggle",
                              options: {
                                  textEnabled: "Stop Auto Purchasing",
                                  textDisabled: "Start Auto Purchasing",
                                  default: false,
                                  runFunction: "setAutoPurchasingClassic",
                                  keybind: true,
                                  keybindId: "autoPurchasingClassic"
                              }
                          }
                      ]
                  }
              ]
          }
      ]
  };
  class ClassicClass {
      constructor() {
          this.name = "Classic Script";
          this.money = 0;
          this.upgradeLevels = {
              insurance: 1,
              moneyPerQuestion: 1,
              multiplier: 1,
              streakBonus: 1
          };
          this.hudAddition = hudAddition$3;
          this.autoPurchasing = false;
          this.funcs = new Map([
              ["setAutoPurchasingClassic", (enabled) => {
                      this.autoPurchasing = enabled;
                      if (this.autoPurchasing)
                          this.checkAutoBuy();
                  }]
          ]);
          this.upgradesToGet = [
              ["Streak Bonus", 2, 20],
              ["Money Per Question", 3, 100],
              ["Streak Bonus", 3, 200],
              ["Multiplier", 3, 300],
              ["Streak Bonus", 4, 2000],
              ["Multiplier", 4, 2000],
              ["Money Per Question", 5, 10000],
              ["Streak Bonus", 5, 20000],
              ["Multiplier", 5, 12000],
              ["Money Per Question", 6, 75000],
              ["Multiplier", 6, 85000],
              ["Streak Bonus", 6, 200000],
              ["Streak Bonus", 7, 2000000],
              ["Streak Bonus", 8, 20000000],
              ["Multiplier", 7, 700000],
              ["Money Per Question", 9, 10000000],
              ["Multiplier", 8, 6500000],
              ["Streak Bonus", 9, 200000000],
              ["Multiplier", 9, 65000000],
              ["Streak Bonus", 10, 2000000000],
              ["Money Per Question", 10, 100000000],
              ["Multiplier", 10, 1000000000]
          ];
      }
      init(cheat) {
          this.cheat = cheat;
          // get the amount of money
          this.cheat.socketHandler.addEventListener("recieveMessage", (e) => {
              var _a, _b;
              if (this.cheat.socketHandler.transportType != "blueboat")
                  return;
              if (((_a = e.detail.data) === null || _a === void 0 ? void 0 : _a.type) == "UPGRADE_LEVELS") {
                  this.upgradeLevels = e.detail.data.value;
                  // delete any upgrades that we already have
                  for (let i = 0; i < this.upgradesToGet.length; i++) {
                      let upgrade = this.upgradesToGet[i];
                      // check if we have the upgrade
                      let upgradeAmount = this.upgradeLevels[UpgradeType[upgrade[0]]];
                      if (upgradeAmount >= upgrade[1]) {
                          this.upgradesToGet.splice(i, 1);
                          i--;
                      }
                  }
              }
              if (((_b = e.detail.data) === null || _b === void 0 ? void 0 : _b.type) == "BALANCE") {
                  this.money = e.detail.data.value;
                  this.checkAutoBuy();
              }
          });
      }
      checkAutoBuy() {
          if (!this.autoPurchasing)
              return;
          let upgrade = this.upgradesToGet[0];
          if (!upgrade)
              return;
          if (this.money >= upgrade[2]) {
              this.purchaseUpgrade(upgrade[0], upgrade[1]);
          }
      }
      purchaseUpgrade(name, level) {
          this.cheat.log("Purchasing upgrade", name, level);
          this.cheat.socketHandler.sendData("UPGRADE_PURCHASED", {
              upgradeName: name,
              level
          });
      }
  }
  function Classic() {
      return new ClassicClass();
  }

  const hudAddition$2 = {
      menus: [
          {
              name: "Cheats for gamemodes",
              groups: [
                  {
                      name: "Super Rich Mode",
                      elements: [
                          {
                              type: "toggle",
                              options: {
                                  textEnabled: "Stop Auto Purchasing",
                                  textDisabled: "Start Auto Purchasing",
                                  default: false,
                                  runFunction: "setAutoPurchasingRichMode",
                                  keybind: true,
                                  keybindId: "autoPurchasingRichMode"
                              }
                          }
                      ]
                  }
              ]
          }
      ]
  };
  class RichModeClass extends ClassicClass {
      constructor() {
          super(...arguments);
          this.name = "Rich Mode Script";
          this.hudAddition = hudAddition$2;
          this.funcs = new Map([
              ["setAutoPurchasingRichMode", (enabled) => {
                      this.autoPurchasing = enabled;
                      if (this.autoPurchasing)
                          this.checkAutoBuy();
                  }]
          ]);
          this.upgradesToGet = [
              ["Streak Bonus", 2, 10000],
              ["Money Per Question", 3, 5000],
              ["Streak Bonus", 3, 100000],
              ["Multiplier", 3, 150000],
              ["Streak Bonus", 4, 1000000],
              ["Multiplier", 4, 1000000],
              ["Money Per Question", 5, 5000000],
              ["Streak Bonus", 5, 10000000],
              ["Multiplier", 5, 6000000],
              ["Money Per Question", 6, 37500000],
              ["Multiplier", 6, 42500000],
              ["Streak Bonus", 6, 100000000],
              ["Streak Bonus", 7, 1000000000],
              ["Streak Bonus", 8, 10000000000],
              ["Multiplier", 7, 350000000],
              ["Money Per Question", 9, 5000000000],
              ["Multiplier", 8, 3250000000],
              ["Streak Bonus", 9, 100000000000],
              ["Multiplier", 9, 32500000000],
              ["Streak Bonus", 10, 1000000000000],
              ["Money Per Question", 10, 50000000000],
              ["Multiplier", 10, 500000000000]
          ];
      }
  }
  function RichMode() {
      return new RichModeClass();
  }

  class TrustNoOneClass {
      constructor() {
          this.name = "Trust No One Script";
          this.people = [];
      }
      init(cheat) {
          this.cheat = cheat;
          // add the imposter display
          let group = cheat.hud.createMenu("Cheats for gamemodes").createGroup("Trust No One");
          let text = group.addElement("text", {
              text: "Imposters: Waiting... (only works if you don't join mid-game)"
          });
          cheat.socketHandler.addEventListener("recieveMessage", (e) => {
              if (this.cheat.socketHandler.transportType != "blueboat")
                  return;
              if (e.detail.key == "IMPOSTER_MODE_PEOPLE") {
                  this.people = e.detail.data;
                  let imposters = this.people.filter((person) => person.role == "imposter");
                  text.text = `Imposter(s): ${imposters.map((person) => person.name).join(", ")}`;
              }
          });
      }
  }
  function TrustNoOne() {
      return new TrustNoOneClass();
  }

  const hudAddition$1 = {
      menus: [
          {
              name: "General Cheats",
              elements: [
                  {
                      type: "toggle",
                      options: {
                          textEnabled: "Stop instant use",
                          textDisabled: "Instant use",
                          default: true,
                          runFunction: "setInstantUse",
                          keybind: true,
                          keybindId: "instantUse"
                      }
                  }
              ]
          }
      ]
  };
  class InstantuseClass {
      constructor() {
          this.name = "Instantuse";
          this.hudAddition = hudAddition$1;
          this.instantUseEnabled = true;
          this.funcs = new Map([
              ["setInstantUse", (enabled) => {
                      this.instantUseEnabled = enabled;
                  }]
          ]);
      }
      init(cheat) {
          let self = this;
          cheat.keybindManager.registerBind({
              keys: new Set(["enter"]),
              exclusive: false,
              callback() {
                  self.useNearest();
              }
          });
      }
      useNearest() {
          var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
          let devices = (_e = (_d = (_c = (_b = (_a = unsafeWindow === null || unsafeWindow === void 0 ? void 0 : unsafeWindow.stores) === null || _a === void 0 ? void 0 : _a.phaser) === null || _b === void 0 ? void 0 : _b.scene) === null || _c === void 0 ? void 0 : _c.worldManager) === null || _d === void 0 ? void 0 : _d.devices) === null || _e === void 0 ? void 0 : _e.devicesInView;
          let body = (_h = (_g = (_f = unsafeWindow === null || unsafeWindow === void 0 ? void 0 : unsafeWindow.stores) === null || _f === void 0 ? void 0 : _f.phaser) === null || _g === void 0 ? void 0 : _g.mainCharacter) === null || _h === void 0 ? void 0 : _h.body;
          if (!devices || !body)
              return;
          let closest = null;
          let closestDistance = Infinity;
          for (let device of devices) {
              if (device.interactiveZones.zones.length == 0)
                  continue;
              let distance = Math.sqrt(Math.pow(device.x - body.x, 2) + Math.pow(device.y - body.y, 2));
              if (distance < closestDistance) {
                  closest = device;
                  closestDistance = distance;
              }
          }
          if (!closest)
              return;
          (_k = (_j = closest === null || closest === void 0 ? void 0 : closest.interactiveZones) === null || _j === void 0 ? void 0 : _j.onInteraction) === null || _k === void 0 ? void 0 : _k.call(_j);
      }
  }
  function Instantuse() {
      return new InstantuseClass();
  }

  /******************************************************************************
  Copyright (c) Microsoft Corporation.

  Permission to use, copy, modify, and/or distribute this software for any
  purpose with or without fee is hereby granted.

  THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
  REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
  AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
  INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
  LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
  OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
  PERFORMANCE OF THIS SOFTWARE.
  ***************************************************************************** */

  function __awaiter(thisArg, _arguments, P, generator) {
      function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
      return new (P || (P = Promise))(function (resolve, reject) {
          function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
          function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
          function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
          step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
  }

  const purchases = {
      "Capture The Flag": [
          {
              displayName: "Speed Upgrade",
              selector: {
                  grantedItemName: "Speed Upgrade",
              },
              reusable: false
          },
          {
              displayName: "Efficiency Upgrade",
              selector: {
                  grantedItemName: "Efficiency Upgrade",
              },
              reusable: false
          },
          {
              displayName: "Energy Per Question Upgrade",
              selector: {
                  grantedItemName: "Energy Per Question Upgrade",
              },
              reusable: false
          },
          {
              displayName: "InvisaBits",
              selector: {
                  grantedItemId: "silver-ore"
              },
              reusable: true
          }
      ],
      "Tag": [
          {
              displayName: "Speed Upgrade",
              selector: {
                  grantedItemName: "Speed Upgrade"
              },
              reusable: false
          },
          {
              displayName: "Efficiency Upgrade",
              selector: {
                  grantedItemName: "Efficiency Upgrade"
              },
              reusable: false
          },
          {
              displayName: "Energy Per Question Upgrade",
              selector: {
                  grantedItemName: "Energy Per Question Upgrade"
              },
              reusable: false
          },
          {
              displayName: "Endurance Upgrade",
              selector: {
                  grantedItemName: "Endurance Upgrade"
              },
              reusable: false
          }
      ],
      "Snowbrawl": [
          {
              displayName: "Med Pack",
              selector: {
                  grantedItemId: "medpack"
              },
              reusable: true
          },
          {
              displayName: "Shield Can",
              selector: {
                  grantedItemId: "shield-can"
              },
              reusable: true
          }
      ],
      "One Way Out": [
          {
              displayName: "Med Pack",
              selector: {
                  grantedItemId: "medpack"
              },
              reusable: true
          },
          {
              displayName: "Shield Can",
              selector: {
                  grantedItemId: "shield-can"
              },
              reusable: true
          }
      ],
      "Farmchain": {
          "Seeds": [
              {
                  displayName: "Corn Seed",
                  selector: {
                      grantedItemId: "yellow-seed"
                  },
                  reusable: true
              },
              {
                  displayName: "Wheat Seed",
                  selector: {
                      grantedItemId: "tan-seed",
                      grantAction: "Grant Item"
                  },
                  reusable: true
              },
              {
                  displayName: "Potato Seed",
                  selector: {
                      grantedItemId: "brown-seed"
                  },
                  reusable: true
              },
              {
                  displayName: "Grape Seed",
                  selector: {
                      grantedItemId: "purple-seed"
                  },
                  reusable: true
              },
              {
                  displayName: "Raspberry Seed",
                  selector: {
                      grantedItemId: "magenta-seed"
                  },
                  reusable: true
              },
              {
                  displayName: "Watermelon Seed",
                  selector: {
                      grantedItemId: "green-seed"
                  },
                  reusable: true
              },
              {
                  displayName: "Coffee Bean",
                  selector: {
                      grantedItemId: "bronze-seed"
                  },
                  reusable: true
              },
              {
                  displayName: "Orange Seed",
                  selector: {
                      grantedItemId: "orange-seed"
                  },
                  reusable: true
              },
              {
                  displayName: "Gimberry Seed",
                  selector: {
                      grantedItemId: "gold-seed"
                  },
                  reusable: true
              },
              {
                  displayName: "Cash Berry Seed",
                  selector: {
                      grantedItemId: "dark-green-seed"
                  },
                  reusable: true
              },
              {
                  displayName: "Pepper Seed",
                  selector: {
                      grantedItemId: "red-seed"
                  },
                  reusable: true
              },
              {
                  displayName: "Energy Bar Seed",
                  selector: {
                      grantedItemId: "blue-seed"
                  },
                  reusable: true
              },
              {
                  displayName: "Lottery Ticket Seed",
                  selector: {
                      grantedItemId: "teal-seed"
                  },
                  reusable: true
              }
          ],
          "Seed Unlocks": [
              {
                  displayName: "Wheat Seed Unlock",
                  selector: {
                      grantedItemName: "Wheat Seed Unlock"
                  },
                  reusable: false
              },
              {
                  displayName: "Potato Seed Unlock",
                  selector: {
                      grantedItemName: "Potato Seed Unlock"
                  },
                  reusable: false
              },
              {
                  displayName: "Grape Seed Unlock",
                  selector: {
                      grantedItemName: "Grape Seed Unlock"
                  },
                  reusable: false
              },
              {
                  displayName: "Raspberry Seed Unlock",
                  selector: {
                      grantedItemName: "Raspberry Seed Unlock"
                  },
                  reusable: false
              },
              {
                  displayName: "Watermelon Seed Unlock",
                  selector: {
                      grantedItemName: "Watermelon Seed Unlock"
                  },
                  reusable: false
              },
              {
                  displayName: "Coffee Bean Seed Unlock",
                  selector: {
                      grantedItemName: "Coffee Bean Seed Unlock"
                  },
                  reusable: false
              },
              {
                  displayName: "Orange Seed Unlock",
                  selector: {
                      grantedItemName: "Orange Seed Unlock"
                  },
                  reusable: false
              },
              {
                  displayName: "Gimberry Seed Unlock",
                  selector: {
                      grantedItemName: "Gimberry Seed Unlock"
                  },
                  reusable: false
              }
          ]
      }
  };

  class InstapurchasersClass {
      constructor() {
          this.name = "Purchasers";
      }
      init(cheat) {
          cheat.addEventListener("gameLoaded", () => {
              this.createButtons(cheat);
          });
      }
      createButtons(cheat) {
          var _a, _b, _c, _d, _e;
          let devices = (_e = (_d = (_c = (_b = (_a = unsafeWindow === null || unsafeWindow === void 0 ? void 0 : unsafeWindow.stores) === null || _a === void 0 ? void 0 : _a.phaser) === null || _b === void 0 ? void 0 : _b.scene) === null || _c === void 0 ? void 0 : _c.worldManager) === null || _d === void 0 ? void 0 : _d.devices) === null || _e === void 0 ? void 0 : _e.allDevices;
          if (!devices) {
              setTimeout(() => this.createButtons(cheat), 1000); // try again in case something went wrong
              return;
          }
          for (let gamemode in purchases) {
              this.createGamemodeButtons(gamemode, purchases[gamemode], cheat.hud.createMenu("Cheats for gamemodes"));
          }
      }
      createGamemodeButtons(gamemode, content, rootGroup) {
          var _a, _b, _c, _d, _e, _f, _g;
          let devices = (_e = (_d = (_c = (_b = (_a = unsafeWindow === null || unsafeWindow === void 0 ? void 0 : unsafeWindow.stores) === null || _a === void 0 ? void 0 : _a.phaser) === null || _b === void 0 ? void 0 : _b.scene) === null || _c === void 0 ? void 0 : _c.worldManager) === null || _d === void 0 ? void 0 : _d.devices) === null || _e === void 0 ? void 0 : _e.allDevices;
          let group = rootGroup.createGroup(gamemode);
          if (!Array.isArray(content)) {
              for (let [name, menu] of Object.entries(content)) {
                  this.createGamemodeButtons(name, menu, group);
              }
              return;
          }
          for (let purchase of content) {
              let { selector, displayName, reusable } = purchase;
              // filter devices by selector
              let purchaseDevices = devices.filter((device) => {
                  var _a;
                  let matches = true;
                  for (let [key, value] of Object.entries(selector)) {
                      if (((_a = device.options) === null || _a === void 0 ? void 0 : _a[key]) != value) {
                          matches = false;
                          break;
                      }
                  }
                  return matches;
              });
              if (purchaseDevices.length == 0)
                  continue;
              // sort them by price
              purchaseDevices.sort((a, b) => { var _a, _b; return ((_a = a === null || a === void 0 ? void 0 : a.options) === null || _a === void 0 ? void 0 : _a.amountOfRequiredItem) - ((_b = b === null || b === void 0 ? void 0 : b.options) === null || _b === void 0 ? void 0 : _b.amountOfRequiredItem); });
              let buttonText = `Purchase ${displayName} (${(_g = (_f = purchaseDevices[0]) === null || _f === void 0 ? void 0 : _f.options) === null || _g === void 0 ? void 0 : _g.amountOfRequiredItem})`;
              let button = group.addElement('button', {
                  text: buttonText
              });
              button.addEventListener('click', () => __awaiter(this, void 0, void 0, function* () {
                  var _h, _j, _k, _l, _m, _o, _p;
                  if (!((_j = (_h = purchaseDevices[0]) === null || _h === void 0 ? void 0 : _h.interactiveZones) === null || _j === void 0 ? void 0 : _j.onInteraction)) {
                      // this happened to me a few times and I don't know why, just re-get the devices
                      purchaseDevices = purchaseDevices.map((device) => {
                          return devices.find((d) => d.id == device.id);
                      });
                      return;
                  }
                  (_m = (_l = (_k = purchaseDevices[0]) === null || _k === void 0 ? void 0 : _k.interactiveZones) === null || _l === void 0 ? void 0 : _l.onInteraction) === null || _m === void 0 ? void 0 : _m.call(_l);
                  if (reusable)
                      return;
                  // check whether it was successfully purchased
                  // wait 500ms for the purchase to go through
                  yield new Promise((resolve) => setTimeout(resolve, 500));
                  if (purchaseDevices[0].state.active)
                      return; // it wasn't purchased
                  purchaseDevices.shift();
                  if (purchaseDevices.length == 0) {
                      button.remove();
                      return;
                  }
                  // update the button text
                  buttonText = `Purchase ${displayName} (${(_p = (_o = purchaseDevices[0]) === null || _o === void 0 ? void 0 : _o.options) === null || _p === void 0 ? void 0 : _p.amountOfRequiredItem})`;
                  button.text = buttonText;
              }));
          }
      }
  }
  function Instapurchasers() {
      return new InstapurchasersClass();
  }

  const hudAddition = {
      menus: [
          {
              name: "Cheats for gamemodes",
              groups: [
                  {
                      name: "Farmchain",
                      elements: [
                          {
                              type: "toggle",
                              options: {
                                  textEnabled: "Stop auto harvesting",
                                  textDisabled: "Start auto harvesting",
                                  keybind: true,
                                  keybindId: "autoHarvesting",
                                  default: true,
                                  runFunction: "setAutoHarvest"
                              }
                          },
                          {
                              type: "toggle",
                              options: {
                                  textEnabled: "Stop auto planting",
                                  textDisabled: "Start auto planting",
                                  keybind: true,
                                  keybindId: "autoPlanting",
                                  default: false,
                                  runFunction: "setAutoPlant"
                              }
                          }
                      ]
                  }
              ]
          }
      ]
  };
  const seedRanking = [
      'yellow-seed',
      'tan-seed',
      'brown-seed',
      'purple-seed',
      'magenta-seed',
      'green-seed',
      'bronze-seed',
      'orange-seed',
      'gold-seed',
      'dark-green-seed',
      'red-seed',
      'blue-seed',
      'teal-seed'
  ];
  class FarmchainClass {
      constructor() {
          this.name = "Farmchain";
          this.hudAddition = hudAddition;
          this.autoHarvesting = true;
          this.autoPlanting = false;
          this.funcs = new Map([
              ["setAutoHarvest", (enabled) => {
                      this.autoHarvesting = enabled;
                  }],
              ["setAutoPlant", (enabled) => {
                      this.autoPlanting = enabled;
                  }]
          ]);
      }
      init(cheat) {
          // set up auto harvest
          cheat.socketHandler.addEventListener("recieveChanges", (e) => {
              let changes = e.detail;
              for (let change of changes) {
                  for (let key in change.data) {
                      if (!key.endsWith("status") || change.data[key] != "availableForCollection")
                          continue;
                      // harvest it
                      let packet = {
                          key: "collect",
                          deviceId: change.id,
                          data: undefined
                      };
                      cheat.socketHandler.sendData("MESSAGE_FOR_DEVICE", packet);
                  }
              }
          });
          cheat.addEventListener("gameLoaded", () => {
              var _a, _b, _c, _d, _e, _f, _g;
              let devices = (_e = (_d = (_c = (_b = (_a = unsafeWindow === null || unsafeWindow === void 0 ? void 0 : unsafeWindow.stores) === null || _a === void 0 ? void 0 : _a.phaser) === null || _b === void 0 ? void 0 : _b.scene) === null || _c === void 0 ? void 0 : _c.worldManager) === null || _d === void 0 ? void 0 : _d.devices) === null || _e === void 0 ? void 0 : _e.allDevices;
              let plots = devices.filter((device) => device.options.style == "plant");
              let recipieDevices = {};
              for (let device of devices) {
                  if (!seedRanking.includes((_f = device.options) === null || _f === void 0 ? void 0 : _f.ingredient1Item))
                      continue;
                  recipieDevices[(_g = device.options) === null || _g === void 0 ? void 0 : _g.ingredient1Item] = device;
              }
              // set up auto plant
              setInterval(() => {
                  var _a, _b, _c;
                  if (!this.autoPlanting)
                      return;
                  let inventory = (_c = (_b = (_a = unsafeWindow === null || unsafeWindow === void 0 ? void 0 : unsafeWindow.stores) === null || _a === void 0 ? void 0 : _a.me) === null || _b === void 0 ? void 0 : _b.inventory) === null || _c === void 0 ? void 0 : _c.slots;
                  if (!inventory)
                      return;
                  // find the most valuable seed in the inventory
                  let mostValuableSeed = undefined;
                  for (let seed of seedRanking) {
                      if (inventory.has(seed)) {
                          mostValuableSeed = seed;
                          break;
                      }
                  }
                  if (!mostValuableSeed)
                      return;
                  // plant the seed in the last idle plot
                  let plantPlot = plots.findLast((plot) => plot.state.status == "idle");
                  cheat.socketHandler.sendData("MESSAGE_FOR_DEVICE", {
                      key: "craft",
                      deviceId: plantPlot.id,
                      data: {
                          recipe: recipieDevices[mostValuableSeed].id
                      }
                  });
              }, 50);
          });
      }
  }
  function Farmchain() {
      return new FarmchainClass();
  }

  // import { BotCreator } from './scripts/general/botcreator';
  class Cheat extends EventTarget {
      constructor() {
          super();
          this.keybindManager = new KeybindManager();
          this.funcs = new Map();
          this.scripts = [];
          // add cheat to the global scope
          window.cheat = this;
          this.socketHandler = new SocketHandler(this);
          this.socketHandler.addEventListener("socket", (e) => {
              cheat.log("Socket connected", e);
          });
          this.socketHandler.getSocket();
          this.hud = new Hud(this);
          // initialize any scripts
          this.scripts = [
              Devtools(),
              Instantuse(),
              Autoanswer(),
              Cosmeticpicker(),
              Playerhighlighter(),
              Freecam(),
              Classic(),
              RichMode(),
              TrustNoOne(),
              Farmchain(),
              Instapurchasers(),
              // BotCreator()
          ];
          this.initScripts();
          this.waitForLoad();
      }
      waitForLoad() {
          // colyseus exclusive
          let loadInterval = setInterval(() => {
              var _a, _b, _c, _d;
              let loadedData = (_a = unsafeWindow === null || unsafeWindow === void 0 ? void 0 : unsafeWindow.stores) === null || _a === void 0 ? void 0 : _a.loading;
              let loaded = (loadedData === null || loadedData === void 0 ? void 0 : loadedData.percentageAssetsLoaded) >= 100 && (loadedData === null || loadedData === void 0 ? void 0 : loadedData.completedInitialLoad)
                  && (loadedData === null || loadedData === void 0 ? void 0 : loadedData.loadedInitialDevices) && (loadedData === null || loadedData === void 0 ? void 0 : loadedData.loadedInitialTerrain);
              if (!loaded)
                  return;
              // check whether we've been assigned to a team
              let team = (_d = (_c = (_b = unsafeWindow === null || unsafeWindow === void 0 ? void 0 : unsafeWindow.stores) === null || _b === void 0 ? void 0 : _b.phaser) === null || _c === void 0 ? void 0 : _c.mainCharacter) === null || _d === void 0 ? void 0 : _d.teamId;
              if (team == "__NO_TEAM_ID")
                  return;
              clearInterval(loadInterval);
              this.log("Game Loaded");
              this.dispatchEvent(new CustomEvent("gameLoaded"));
          }, 1000 / 60);
          // TODO: Add blueboat load detection
      }
      initScripts() {
          for (let script of this.scripts) {
              // add functions
              if (script.funcs) {
                  for (let [name, func] of script.funcs) {
                      this.funcs.set(name, func);
                  }
              }
              // add hud additions
              if (script.hudAddition) {
                  this.hud.loadFromObject(script.hudAddition);
              }
              // initialize the script
              if (script.init) {
                  script.init(this);
              }
          }
      }
      antifreeze() {
          let nativeFreeze = Object.freeze;
          Object.freeze = (obj) => {
              var _a;
              if (((_a = obj.constructor) === null || _a === void 0 ? void 0 : _a.name) == "WebSocket" || obj.name == "WebSocket")
                  return obj;
              return nativeFreeze(obj);
          };
          // ignore any attempts to modify WebSocket.prototype.send
          var originalSend = WebSocket.prototype.send;
          Object.defineProperty(WebSocket.prototype, 'send', {
              configurable: false,
              enumerable: false,
              get: function () {
                  return originalSend;
              },
              set: function (value) {
                  if (value === originalSend) {
                      return; // allow setting to the original value
                  }
                  console.log("Attempted to modify WebSocket.prototype.send");
              }
          });
      }
      log(...args) {
          console.log("[GC]", ...args);
      }
      getScript(name) {
          for (let script of this.scripts) {
              if (script.name == name)
                  return script;
          }
          return null;
      }
  }
  const cheat = new Cheat();

  cheat.log("Loaded Gimkit Cheat version: " + version);
  cheat.antifreeze();
  // make sure the cheat is running
  if (Object.isFrozen(WebSocket)) {
      alert("WebSocket object is still frozen. Please try refreshing the page. If this persists, open an issue on GitHub.");
  }

})();
