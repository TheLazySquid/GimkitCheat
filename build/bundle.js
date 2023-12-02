(function () {
  'use strict';

  var version$1 = "0.3.8";

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
  function utf8Write$1(view, offset, str) {
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
              utf8Write$1(view, offset, defer._str);
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
      let o;

      if(Array.isArray(t)) {
          o = {
              type: 2,
              data: t,
              options: {
                  compress: !0
              },
              nsp: "/"
          };
      } else {
          o = {
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
      }

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

  const hudAddition$a = {
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
          this.hudAddition = hudAddition$a;
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

  const hudAddition$9 = {
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
          this.hudAddition = hudAddition$9;
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
  const hudAddition$8 = {
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
          this.hudAddition = hudAddition$8;
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

  const hudAddition$7 = {
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
          this.hudAddition = hudAddition$7;
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
  const hudAddition$6 = {
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
          this.hudAddition = hudAddition$6;
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

  const hudAddition$5 = {
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
          this.hudAddition = hudAddition$5;
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

  const hudAddition$4 = {
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
          this.hudAddition = hudAddition$4;
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

  /*! *****************************************************************************
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
  /* global Reflect, Promise */


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

  const hudAddition$3 = {
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
          this.hudAddition = hudAddition$3;
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

  const hudAddition$2 = {
      menus: [
          {
              name: "General Cheats",
              elements: [
                  {
                      type: "toggle",
                      options: {
                          textEnabled: "Show Energy Popup",
                          textDisabled: "Hide Energy Popup",
                          runFunction: "toggleEnergyPopup"
                      }
                  }
              ]
          }
      ]
  };
  class HideEnergyClass {
      constructor() {
          this.name = "Hide Energy";
          this.hudAddition = hudAddition$2;
          this.enabled = false;
          this.funcs = new Map([
              ["toggleEnergyPopup", (event) => {
                      this.enabled = event;
                      console.log(this.popupElement, this.enabled);
                      if (!this.popupElement)
                          return;
                      if (this.enabled) {
                          this.popupElement.style.display = "none";
                      }
                      else {
                          this.popupElement.style.display = "";
                      }
                  }]
          ]);
      }
      init() {
          let observer = new MutationObserver((mutations) => {
              for (let mutation of mutations) {
                  for (let node of mutation.addedNodes) {
                      if (node.nodeType != Node.ELEMENT_NODE)
                          continue;
                      // check that the element is the energy popup
                      if (node.matches(".maxAll.flex.hc") &&
                          node.querySelector("img[src='/assets/map/inventory/resources/energy.png']")) {
                          this.popupElement = node;
                          if (!this.enabled)
                              return;
                          // hide the popup
                          this.popupElement.style.display = "none";
                      }
                  }
              }
          });
          window.addEventListener("load", () => {
              observer.observe(document.body, {
                  childList: true,
                  subtree: true
              });
          });
      }
  }
  function HideEnergy() {
      return new HideEnergyClass();
  }

  var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

  function getDefaultExportFromCjs (x) {
  	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
  }

  function getAugmentedNamespace(n) {
    if (n.__esModule) return n;
    var f = n.default;
  	if (typeof f == "function") {
  		var a = function a () {
  			if (this instanceof a) {
  				var args = [null];
  				args.push.apply(args, arguments);
  				var Ctor = Function.bind.apply(f, args);
  				return new Ctor();
  			}
  			return f.apply(this, arguments);
  		};
  		a.prototype = f.prototype;
    } else a = {};
    Object.defineProperty(a, '__esModule', {value: true});
  	Object.keys(n).forEach(function (k) {
  		var d = Object.getOwnPropertyDescriptor(n, k);
  		Object.defineProperty(a, k, d.get ? d : {
  			enumerable: true,
  			get: function () {
  				return n[k];
  			}
  		});
  	});
  	return a;
  }

  /**
   * A function that always returns `false`. Any passed in parameters are ignored.
   *
   * @func
   * @memberOf R
   * @since v0.9.0
   * @category Function
   * @sig * -> Boolean
   * @param {*}
   * @return {Boolean}
   * @see R.T
   * @example
   *
   *      R.F(); //=> false
   */
  var F = function () {
    return false;
  };

  var F$1 = F;

  /**
   * A function that always returns `true`. Any passed in parameters are ignored.
   *
   * @func
   * @memberOf R
   * @since v0.9.0
   * @category Function
   * @sig * -> Boolean
   * @param {*}
   * @return {Boolean}
   * @see R.F
   * @example
   *
   *      R.T(); //=> true
   */
  var T = function () {
    return true;
  };

  var T$1 = T;

  /**
   * A special placeholder value used to specify "gaps" within curried functions,
   * allowing partial application of any combination of arguments, regardless of
   * their positions.
   *
   * If `g` is a curried ternary function and `_` is `R.__`, the following are
   * equivalent:
   *
   *   - `g(1, 2, 3)`
   *   - `g(_, 2, 3)(1)`
   *   - `g(_, _, 3)(1)(2)`
   *   - `g(_, _, 3)(1, 2)`
   *   - `g(_, 2, _)(1, 3)`
   *   - `g(_, 2)(1)(3)`
   *   - `g(_, 2)(1, 3)`
   *   - `g(_, 2)(_, 3)(1)`
   *
   * @name __
   * @constant
   * @memberOf R
   * @since v0.6.0
   * @category Function
   * @example
   *
   *      const greet = R.replace('{name}', R.__, 'Hello, {name}!');
   *      greet('Alice'); //=> 'Hello, Alice!'
   */
  var __$2 = {
    '@@functional/placeholder': true
  };

  function _isPlaceholder(a) {
    return a != null && typeof a === 'object' && a['@@functional/placeholder'] === true;
  }

  /**
   * Optimized internal one-arity curry function.
   *
   * @private
   * @category Function
   * @param {Function} fn The function to curry.
   * @return {Function} The curried function.
   */

  function _curry1(fn) {
    return function f1(a) {
      if (arguments.length === 0 || _isPlaceholder(a)) {
        return f1;
      } else {
        return fn.apply(this, arguments);
      }
    };
  }

  /**
   * Optimized internal two-arity curry function.
   *
   * @private
   * @category Function
   * @param {Function} fn The function to curry.
   * @return {Function} The curried function.
   */

  function _curry2(fn) {
    return function f2(a, b) {
      switch (arguments.length) {
        case 0:
          return f2;

        case 1:
          return _isPlaceholder(a) ? f2 : _curry1(function (_b) {
            return fn(a, _b);
          });

        default:
          return _isPlaceholder(a) && _isPlaceholder(b) ? f2 : _isPlaceholder(a) ? _curry1(function (_a) {
            return fn(_a, b);
          }) : _isPlaceholder(b) ? _curry1(function (_b) {
            return fn(a, _b);
          }) : fn(a, b);
      }
    };
  }

  /**
   * Adds two values.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category Math
   * @sig Number -> Number -> Number
   * @param {Number} a
   * @param {Number} b
   * @return {Number}
   * @see R.subtract
   * @example
   *
   *      R.add(2, 3);       //=>  5
   *      R.add(7)(10);      //=> 17
   */

  var add =
  /*#__PURE__*/
  _curry2(function add(a, b) {
    return Number(a) + Number(b);
  });

  var add$1 = add;

  /**
   * Private `concat` function to merge two array-like objects.
   *
   * @private
   * @param {Array|Arguments} [set1=[]] An array-like object.
   * @param {Array|Arguments} [set2=[]] An array-like object.
   * @return {Array} A new, merged array.
   * @example
   *
   *      _concat([4, 5, 6], [1, 2, 3]); //=> [4, 5, 6, 1, 2, 3]
   */
  function _concat(set1, set2) {
    set1 = set1 || [];
    set2 = set2 || [];
    var idx;
    var len1 = set1.length;
    var len2 = set2.length;
    var result = [];
    idx = 0;

    while (idx < len1) {
      result[result.length] = set1[idx];
      idx += 1;
    }

    idx = 0;

    while (idx < len2) {
      result[result.length] = set2[idx];
      idx += 1;
    }

    return result;
  }

  function _arity(n, fn) {
    /* eslint-disable no-unused-vars */
    switch (n) {
      case 0:
        return function () {
          return fn.apply(this, arguments);
        };

      case 1:
        return function (a0) {
          return fn.apply(this, arguments);
        };

      case 2:
        return function (a0, a1) {
          return fn.apply(this, arguments);
        };

      case 3:
        return function (a0, a1, a2) {
          return fn.apply(this, arguments);
        };

      case 4:
        return function (a0, a1, a2, a3) {
          return fn.apply(this, arguments);
        };

      case 5:
        return function (a0, a1, a2, a3, a4) {
          return fn.apply(this, arguments);
        };

      case 6:
        return function (a0, a1, a2, a3, a4, a5) {
          return fn.apply(this, arguments);
        };

      case 7:
        return function (a0, a1, a2, a3, a4, a5, a6) {
          return fn.apply(this, arguments);
        };

      case 8:
        return function (a0, a1, a2, a3, a4, a5, a6, a7) {
          return fn.apply(this, arguments);
        };

      case 9:
        return function (a0, a1, a2, a3, a4, a5, a6, a7, a8) {
          return fn.apply(this, arguments);
        };

      case 10:
        return function (a0, a1, a2, a3, a4, a5, a6, a7, a8, a9) {
          return fn.apply(this, arguments);
        };

      default:
        throw new Error('First argument to _arity must be a non-negative integer no greater than ten');
    }
  }

  /**
   * Internal curryN function.
   *
   * @private
   * @category Function
   * @param {Number} length The arity of the curried function.
   * @param {Array} received An array of arguments received thus far.
   * @param {Function} fn The function to curry.
   * @return {Function} The curried function.
   */

  function _curryN(length, received, fn) {
    return function () {
      var combined = [];
      var argsIdx = 0;
      var left = length;
      var combinedIdx = 0;

      while (combinedIdx < received.length || argsIdx < arguments.length) {
        var result;

        if (combinedIdx < received.length && (!_isPlaceholder(received[combinedIdx]) || argsIdx >= arguments.length)) {
          result = received[combinedIdx];
        } else {
          result = arguments[argsIdx];
          argsIdx += 1;
        }

        combined[combinedIdx] = result;

        if (!_isPlaceholder(result)) {
          left -= 1;
        }

        combinedIdx += 1;
      }

      return left <= 0 ? fn.apply(this, combined) : _arity(left, _curryN(length, combined, fn));
    };
  }

  /**
   * Returns a curried equivalent of the provided function, with the specified
   * arity. The curried function has two unusual capabilities. First, its
   * arguments needn't be provided one at a time. If `g` is `R.curryN(3, f)`, the
   * following are equivalent:
   *
   *   - `g(1)(2)(3)`
   *   - `g(1)(2, 3)`
   *   - `g(1, 2)(3)`
   *   - `g(1, 2, 3)`
   *
   * Secondly, the special placeholder value [`R.__`](#__) may be used to specify
   * "gaps", allowing partial application of any combination of arguments,
   * regardless of their positions. If `g` is as above and `_` is [`R.__`](#__),
   * the following are equivalent:
   *
   *   - `g(1, 2, 3)`
   *   - `g(_, 2, 3)(1)`
   *   - `g(_, _, 3)(1)(2)`
   *   - `g(_, _, 3)(1, 2)`
   *   - `g(_, 2)(1)(3)`
   *   - `g(_, 2)(1, 3)`
   *   - `g(_, 2)(_, 3)(1)`
   *
   * @func
   * @memberOf R
   * @since v0.5.0
   * @category Function
   * @sig Number -> (* -> a) -> (* -> a)
   * @param {Number} length The arity for the returned function.
   * @param {Function} fn The function to curry.
   * @return {Function} A new, curried function.
   * @see R.curry
   * @example
   *
   *      const sumArgs = (...args) => R.sum(args);
   *
   *      const curriedAddFourNumbers = R.curryN(4, sumArgs);
   *      const f = curriedAddFourNumbers(1, 2);
   *      const g = f(3);
   *      g(4); //=> 10
   */

  var curryN =
  /*#__PURE__*/
  _curry2(function curryN(length, fn) {
    if (length === 1) {
      return _curry1(fn);
    }

    return _arity(length, _curryN(length, [], fn));
  });

  var curryN$1 = curryN;

  /**
   * Creates a new list iteration function from an existing one by adding two new
   * parameters to its callback function: the current index, and the entire list.
   *
   * This would turn, for instance, [`R.map`](#map) function into one that
   * more closely resembles `Array.prototype.map`. Note that this will only work
   * for functions in which the iteration callback function is the first
   * parameter, and where the list is the last parameter. (This latter might be
   * unimportant if the list parameter is not used.)
   *
   * @func
   * @memberOf R
   * @since v0.15.0
   * @category Function
   * @category List
   * @sig ((a ... -> b) ... -> [a] -> *) -> ((a ..., Int, [a] -> b) ... -> [a] -> *)
   * @param {Function} fn A list iteration function that does not pass index or list to its callback
   * @return {Function} An altered list iteration function that passes (item, index, list) to its callback
   * @example
   *
   *      const mapIndexed = R.addIndex(R.map);
   *      mapIndexed((val, idx) => idx + '-' + val, ['f', 'o', 'o', 'b', 'a', 'r']);
   *      //=> ['0-f', '1-o', '2-o', '3-b', '4-a', '5-r']
   */

  var addIndex =
  /*#__PURE__*/
  _curry1(function addIndex(fn) {
    return curryN$1(fn.length, function () {
      var idx = 0;
      var origFn = arguments[0];
      var list = arguments[arguments.length - 1];
      var args = Array.prototype.slice.call(arguments, 0);

      args[0] = function () {
        var result = origFn.apply(this, _concat(arguments, [idx, list]));
        idx += 1;
        return result;
      };

      return fn.apply(this, args);
    });
  });

  var addIndex$1 = addIndex;

  /**
   * Optimized internal three-arity curry function.
   *
   * @private
   * @category Function
   * @param {Function} fn The function to curry.
   * @return {Function} The curried function.
   */

  function _curry3(fn) {
    return function f3(a, b, c) {
      switch (arguments.length) {
        case 0:
          return f3;

        case 1:
          return _isPlaceholder(a) ? f3 : _curry2(function (_b, _c) {
            return fn(a, _b, _c);
          });

        case 2:
          return _isPlaceholder(a) && _isPlaceholder(b) ? f3 : _isPlaceholder(a) ? _curry2(function (_a, _c) {
            return fn(_a, b, _c);
          }) : _isPlaceholder(b) ? _curry2(function (_b, _c) {
            return fn(a, _b, _c);
          }) : _curry1(function (_c) {
            return fn(a, b, _c);
          });

        default:
          return _isPlaceholder(a) && _isPlaceholder(b) && _isPlaceholder(c) ? f3 : _isPlaceholder(a) && _isPlaceholder(b) ? _curry2(function (_a, _b) {
            return fn(_a, _b, c);
          }) : _isPlaceholder(a) && _isPlaceholder(c) ? _curry2(function (_a, _c) {
            return fn(_a, b, _c);
          }) : _isPlaceholder(b) && _isPlaceholder(c) ? _curry2(function (_b, _c) {
            return fn(a, _b, _c);
          }) : _isPlaceholder(a) ? _curry1(function (_a) {
            return fn(_a, b, c);
          }) : _isPlaceholder(b) ? _curry1(function (_b) {
            return fn(a, _b, c);
          }) : _isPlaceholder(c) ? _curry1(function (_c) {
            return fn(a, b, _c);
          }) : fn(a, b, c);
      }
    };
  }

  /**
   * Applies a function to the value at the given index of an array, returning a
   * new copy of the array with the element at the given index replaced with the
   * result of the function application.
   *
   * @func
   * @memberOf R
   * @since v0.14.0
   * @category List
   * @sig Number -> (a -> a) -> [a] -> [a]
   * @param {Number} idx The index.
   * @param {Function} fn The function to apply.
   * @param {Array|Arguments} list An array-like object whose value
   *        at the supplied index will be replaced.
   * @return {Array} A copy of the supplied array-like object with
   *         the element at index `idx` replaced with the value
   *         returned by applying `fn` to the existing element.
   * @see R.update
   * @example
   *
   *      R.adjust(1, R.toUpper, ['a', 'b', 'c', 'd']);      //=> ['a', 'B', 'c', 'd']
   *      R.adjust(-1, R.toUpper, ['a', 'b', 'c', 'd']);     //=> ['a', 'b', 'c', 'D']
   * @symb R.adjust(-1, f, [a, b]) = [a, f(b)]
   * @symb R.adjust(0, f, [a, b]) = [f(a), b]
   */

  var adjust =
  /*#__PURE__*/
  _curry3(function adjust(idx, fn, list) {
    if (idx >= list.length || idx < -list.length) {
      return list;
    }

    var start = idx < 0 ? list.length : 0;

    var _idx = start + idx;

    var _list = _concat(list);

    _list[_idx] = fn(list[_idx]);
    return _list;
  });

  var adjust$1 = adjust;

  /**
   * Tests whether or not an object is an array.
   *
   * @private
   * @param {*} val The object to test.
   * @return {Boolean} `true` if `val` is an array, `false` otherwise.
   * @example
   *
   *      _isArray([]); //=> true
   *      _isArray(null); //=> false
   *      _isArray({}); //=> false
   */
  var _isArray = Array.isArray || function _isArray(val) {
    return val != null && val.length >= 0 && Object.prototype.toString.call(val) === '[object Array]';
  };

  function _isTransformer(obj) {
    return obj != null && typeof obj['@@transducer/step'] === 'function';
  }

  /**
   * Returns a function that dispatches with different strategies based on the
   * object in list position (last argument). If it is an array, executes [fn].
   * Otherwise, if it has a function with one of the given method names, it will
   * execute that function (functor case). Otherwise, if it is a transformer,
   * uses transducer [xf] to return a new transformer (transducer case).
   * Otherwise, it will default to executing [fn].
   *
   * @private
   * @param {Array} methodNames properties to check for a custom implementation
   * @param {Function} xf transducer to initialize if object is transformer
   * @param {Function} fn default ramda implementation
   * @return {Function} A function that dispatches on object in list position
   */

  function _dispatchable(methodNames, xf, fn) {
    return function () {
      if (arguments.length === 0) {
        return fn();
      }

      var args = Array.prototype.slice.call(arguments, 0);
      var obj = args.pop();

      if (!_isArray(obj)) {
        var idx = 0;

        while (idx < methodNames.length) {
          if (typeof obj[methodNames[idx]] === 'function') {
            return obj[methodNames[idx]].apply(obj, args);
          }

          idx += 1;
        }

        if (_isTransformer(obj)) {
          var transducer = xf.apply(null, args);
          return transducer(obj);
        }
      }

      return fn.apply(this, arguments);
    };
  }

  function _reduced(x) {
    return x && x['@@transducer/reduced'] ? x : {
      '@@transducer/value': x,
      '@@transducer/reduced': true
    };
  }

  var _xfBase = {
    init: function () {
      return this.xf['@@transducer/init']();
    },
    result: function (result) {
      return this.xf['@@transducer/result'](result);
    }
  };

  var XAll =
  /*#__PURE__*/
  function () {
    function XAll(f, xf) {
      this.xf = xf;
      this.f = f;
      this.all = true;
    }

    XAll.prototype['@@transducer/init'] = _xfBase.init;

    XAll.prototype['@@transducer/result'] = function (result) {
      if (this.all) {
        result = this.xf['@@transducer/step'](result, true);
      }

      return this.xf['@@transducer/result'](result);
    };

    XAll.prototype['@@transducer/step'] = function (result, input) {
      if (!this.f(input)) {
        this.all = false;
        result = _reduced(this.xf['@@transducer/step'](result, false));
      }

      return result;
    };

    return XAll;
  }();

  var _xall =
  /*#__PURE__*/
  _curry2(function _xall(f, xf) {
    return new XAll(f, xf);
  });

  var _xall$1 = _xall;

  /**
   * Returns `true` if all elements of the list match the predicate, `false` if
   * there are any that don't.
   *
   * Dispatches to the `all` method of the second argument, if present.
   *
   * Acts as a transducer if a transformer is given in list position.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category List
   * @sig (a -> Boolean) -> [a] -> Boolean
   * @param {Function} fn The predicate function.
   * @param {Array} list The array to consider.
   * @return {Boolean} `true` if the predicate is satisfied by every element, `false`
   *         otherwise.
   * @see R.any, R.none, R.transduce
   * @example
   *
   *      const equals3 = R.equals(3);
   *      R.all(equals3)([3, 3, 3, 3]); //=> true
   *      R.all(equals3)([3, 3, 1, 3]); //=> false
   */

  var all =
  /*#__PURE__*/
  _curry2(
  /*#__PURE__*/
  _dispatchable(['all'], _xall$1, function all(fn, list) {
    var idx = 0;

    while (idx < list.length) {
      if (!fn(list[idx])) {
        return false;
      }

      idx += 1;
    }

    return true;
  }));

  var all$1 = all;

  /**
   * Returns the larger of its two arguments.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category Relation
   * @sig Ord a => a -> a -> a
   * @param {*} a
   * @param {*} b
   * @return {*}
   * @see R.maxBy, R.min
   * @example
   *
   *      R.max(789, 123); //=> 789
   *      R.max('a', 'b'); //=> 'b'
   */

  var max =
  /*#__PURE__*/
  _curry2(function max(a, b) {
    return b > a ? b : a;
  });

  var max$1 = max;

  function _map(fn, functor) {
    var idx = 0;
    var len = functor.length;
    var result = Array(len);

    while (idx < len) {
      result[idx] = fn(functor[idx]);
      idx += 1;
    }

    return result;
  }

  function _isString(x) {
    return Object.prototype.toString.call(x) === '[object String]';
  }

  /**
   * Tests whether or not an object is similar to an array.
   *
   * @private
   * @category Type
   * @category List
   * @sig * -> Boolean
   * @param {*} x The object to test.
   * @return {Boolean} `true` if `x` has a numeric length property and extreme indices defined; `false` otherwise.
   * @example
   *
   *      _isArrayLike([]); //=> true
   *      _isArrayLike(true); //=> false
   *      _isArrayLike({}); //=> false
   *      _isArrayLike({length: 10}); //=> false
   *      _isArrayLike({0: 'zero', 9: 'nine', length: 10}); //=> true
   */

  var _isArrayLike =
  /*#__PURE__*/
  _curry1(function isArrayLike(x) {
    if (_isArray(x)) {
      return true;
    }

    if (!x) {
      return false;
    }

    if (typeof x !== 'object') {
      return false;
    }

    if (_isString(x)) {
      return false;
    }

    if (x.nodeType === 1) {
      return !!x.length;
    }

    if (x.length === 0) {
      return true;
    }

    if (x.length > 0) {
      return x.hasOwnProperty(0) && x.hasOwnProperty(x.length - 1);
    }

    return false;
  });

  var _isArrayLike$1 = _isArrayLike;

  var XWrap =
  /*#__PURE__*/
  function () {
    function XWrap(fn) {
      this.f = fn;
    }

    XWrap.prototype['@@transducer/init'] = function () {
      throw new Error('init not implemented on XWrap');
    };

    XWrap.prototype['@@transducer/result'] = function (acc) {
      return acc;
    };

    XWrap.prototype['@@transducer/step'] = function (acc, x) {
      return this.f(acc, x);
    };

    return XWrap;
  }();

  function _xwrap(fn) {
    return new XWrap(fn);
  }

  /**
   * Creates a function that is bound to a context.
   * Note: `R.bind` does not provide the additional argument-binding capabilities of
   * [Function.prototype.bind](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/bind).
   *
   * @func
   * @memberOf R
   * @since v0.6.0
   * @category Function
   * @category Object
   * @sig (* -> *) -> {*} -> (* -> *)
   * @param {Function} fn The function to bind to context
   * @param {Object} thisObj The context to bind `fn` to
   * @return {Function} A function that will execute in the context of `thisObj`.
   * @see R.partial
   * @example
   *
   *      const log = R.bind(console.log, console);
   *      R.pipe(R.assoc('a', 2), R.tap(log), R.assoc('a', 3))({a: 1}); //=> {a: 3}
   *      // logs {a: 2}
   * @symb R.bind(f, o)(a, b) = f.call(o, a, b)
   */

  var bind =
  /*#__PURE__*/
  _curry2(function bind(fn, thisObj) {
    return _arity(fn.length, function () {
      return fn.apply(thisObj, arguments);
    });
  });

  var bind$1 = bind;

  function _arrayReduce(xf, acc, list) {
    var idx = 0;
    var len = list.length;

    while (idx < len) {
      acc = xf['@@transducer/step'](acc, list[idx]);

      if (acc && acc['@@transducer/reduced']) {
        acc = acc['@@transducer/value'];
        break;
      }

      idx += 1;
    }

    return xf['@@transducer/result'](acc);
  }

  function _iterableReduce(xf, acc, iter) {
    var step = iter.next();

    while (!step.done) {
      acc = xf['@@transducer/step'](acc, step.value);

      if (acc && acc['@@transducer/reduced']) {
        acc = acc['@@transducer/value'];
        break;
      }

      step = iter.next();
    }

    return xf['@@transducer/result'](acc);
  }

  function _methodReduce(xf, acc, obj, methodName) {
    return xf['@@transducer/result'](obj[methodName](bind$1(xf['@@transducer/step'], xf), acc));
  }

  var symIterator = typeof Symbol !== 'undefined' ? Symbol.iterator : '@@iterator';
  function _reduce(fn, acc, list) {
    if (typeof fn === 'function') {
      fn = _xwrap(fn);
    }

    if (_isArrayLike$1(list)) {
      return _arrayReduce(fn, acc, list);
    }

    if (typeof list['fantasy-land/reduce'] === 'function') {
      return _methodReduce(fn, acc, list, 'fantasy-land/reduce');
    }

    if (list[symIterator] != null) {
      return _iterableReduce(fn, acc, list[symIterator]());
    }

    if (typeof list.next === 'function') {
      return _iterableReduce(fn, acc, list);
    }

    if (typeof list.reduce === 'function') {
      return _methodReduce(fn, acc, list, 'reduce');
    }

    throw new TypeError('reduce: list must be array or iterable');
  }

  var XMap =
  /*#__PURE__*/
  function () {
    function XMap(f, xf) {
      this.xf = xf;
      this.f = f;
    }

    XMap.prototype['@@transducer/init'] = _xfBase.init;
    XMap.prototype['@@transducer/result'] = _xfBase.result;

    XMap.prototype['@@transducer/step'] = function (result, input) {
      return this.xf['@@transducer/step'](result, this.f(input));
    };

    return XMap;
  }();

  var _xmap =
  /*#__PURE__*/
  _curry2(function _xmap(f, xf) {
    return new XMap(f, xf);
  });

  var _xmap$1 = _xmap;

  function _has(prop, obj) {
    return Object.prototype.hasOwnProperty.call(obj, prop);
  }

  var toString$3 = Object.prototype.toString;

  var _isArguments =
  /*#__PURE__*/
  function () {
    return toString$3.call(arguments) === '[object Arguments]' ? function _isArguments(x) {
      return toString$3.call(x) === '[object Arguments]';
    } : function _isArguments(x) {
      return _has('callee', x);
    };
  }();

  var _isArguments$1 = _isArguments;

  var hasEnumBug = !
  /*#__PURE__*/
  {
    toString: null
  }.propertyIsEnumerable('toString');
  var nonEnumerableProps = ['constructor', 'valueOf', 'isPrototypeOf', 'toString', 'propertyIsEnumerable', 'hasOwnProperty', 'toLocaleString']; // Safari bug

  var hasArgsEnumBug =
  /*#__PURE__*/
  function () {

    return arguments.propertyIsEnumerable('length');
  }();

  var contains$2 = function contains(list, item) {
    var idx = 0;

    while (idx < list.length) {
      if (list[idx] === item) {
        return true;
      }

      idx += 1;
    }

    return false;
  };
  /**
   * Returns a list containing the names of all the enumerable own properties of
   * the supplied object.
   * Note that the order of the output array is not guaranteed to be consistent
   * across different JS platforms.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category Object
   * @sig {k: v} -> [k]
   * @param {Object} obj The object to extract properties from
   * @return {Array} An array of the object's own properties.
   * @see R.keysIn, R.values
   * @example
   *
   *      R.keys({a: 1, b: 2, c: 3}); //=> ['a', 'b', 'c']
   */


  var keys$1 = typeof Object.keys === 'function' && !hasArgsEnumBug ?
  /*#__PURE__*/
  _curry1(function keys(obj) {
    return Object(obj) !== obj ? [] : Object.keys(obj);
  }) :
  /*#__PURE__*/
  _curry1(function keys(obj) {
    if (Object(obj) !== obj) {
      return [];
    }

    var prop, nIdx;
    var ks = [];

    var checkArgsLength = hasArgsEnumBug && _isArguments$1(obj);

    for (prop in obj) {
      if (_has(prop, obj) && (!checkArgsLength || prop !== 'length')) {
        ks[ks.length] = prop;
      }
    }

    if (hasEnumBug) {
      nIdx = nonEnumerableProps.length - 1;

      while (nIdx >= 0) {
        prop = nonEnumerableProps[nIdx];

        if (_has(prop, obj) && !contains$2(ks, prop)) {
          ks[ks.length] = prop;
        }

        nIdx -= 1;
      }
    }

    return ks;
  });
  var keys$2 = keys$1;

  /**
   * Takes a function and
   * a [functor](https://github.com/fantasyland/fantasy-land#functor),
   * applies the function to each of the functor's values, and returns
   * a functor of the same shape.
   *
   * Ramda provides suitable `map` implementations for `Array` and `Object`,
   * so this function may be applied to `[1, 2, 3]` or `{x: 1, y: 2, z: 3}`.
   *
   * Dispatches to the `map` method of the second argument, if present.
   *
   * Acts as a transducer if a transformer is given in list position.
   *
   * Also treats functions as functors and will compose them together.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category List
   * @sig Functor f => (a -> b) -> f a -> f b
   * @param {Function} fn The function to be called on every element of the input `list`.
   * @param {Array} list The list to be iterated over.
   * @return {Array} The new list.
   * @see R.transduce, R.addIndex
   * @example
   *
   *      const double = x => x * 2;
   *
   *      R.map(double, [1, 2, 3]); //=> [2, 4, 6]
   *
   *      R.map(double, {x: 1, y: 2, z: 3}); //=> {x: 2, y: 4, z: 6}
   * @symb R.map(f, [a, b]) = [f(a), f(b)]
   * @symb R.map(f, { x: a, y: b }) = { x: f(a), y: f(b) }
   * @symb R.map(f, functor_o) = functor_o.map(f)
   */

  var map$2 =
  /*#__PURE__*/
  _curry2(
  /*#__PURE__*/
  _dispatchable(['fantasy-land/map', 'map'], _xmap$1, function map(fn, functor) {
    switch (Object.prototype.toString.call(functor)) {
      case '[object Function]':
        return curryN$1(functor.length, function () {
          return fn.call(this, functor.apply(this, arguments));
        });

      case '[object Object]':
        return _reduce(function (acc, key) {
          acc[key] = fn(functor[key]);
          return acc;
        }, {}, keys$2(functor));

      default:
        return _map(fn, functor);
    }
  }));

  var map$3 = map$2;

  /**
   * Determine if the passed argument is an integer.
   *
   * @private
   * @param {*} n
   * @category Type
   * @return {Boolean}
   */
  var _isInteger = Number.isInteger || function _isInteger(n) {
    return n << 0 === n;
  };

  /**
   * Returns the nth element of the given list or string. If n is negative the
   * element at index length + n is returned.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category List
   * @sig Number -> [a] -> a | Undefined
   * @sig Number -> String -> String
   * @param {Number} offset
   * @param {*} list
   * @return {*}
   * @example
   *
   *      const list = ['foo', 'bar', 'baz', 'quux'];
   *      R.nth(1, list); //=> 'bar'
   *      R.nth(-1, list); //=> 'quux'
   *      R.nth(-99, list); //=> undefined
   *
   *      R.nth(2, 'abc'); //=> 'c'
   *      R.nth(3, 'abc'); //=> ''
   * @symb R.nth(-1, [a, b, c]) = c
   * @symb R.nth(0, [a, b, c]) = a
   * @symb R.nth(1, [a, b, c]) = b
   */

  var nth =
  /*#__PURE__*/
  _curry2(function nth(offset, list) {
    var idx = offset < 0 ? list.length + offset : offset;
    return _isString(list) ? list.charAt(idx) : list[idx];
  });

  var nth$1 = nth;

  /**
   * Retrieves the values at given paths of an object.
   *
   * @func
   * @memberOf R
   * @since v0.27.1
   * @category Object
   * @typedefn Idx = [String | Int]
   * @sig [Idx] -> {a} -> [a | Undefined]
   * @param {Array} pathsArray The array of paths to be fetched.
   * @param {Object} obj The object to retrieve the nested properties from.
   * @return {Array} A list consisting of values at paths specified by "pathsArray".
   * @see R.path
   * @example
   *
   *      R.paths([['a', 'b'], ['p', 0, 'q']], {a: {b: 2}, p: [{q: 3}]}); //=> [2, 3]
   *      R.paths([['a', 'b'], ['p', 'r']], {a: {b: 2}, p: [{q: 3}]}); //=> [2, undefined]
   */

  var paths =
  /*#__PURE__*/
  _curry2(function paths(pathsArray, obj) {
    return pathsArray.map(function (paths) {
      var val = obj;
      var idx = 0;
      var p;

      while (idx < paths.length) {
        if (val == null) {
          return;
        }

        p = paths[idx];
        val = _isInteger(p) ? nth$1(p, val) : val[p];
        idx += 1;
      }

      return val;
    });
  });

  var paths$1 = paths;

  /**
   * Retrieve the value at a given path.
   *
   * @func
   * @memberOf R
   * @since v0.2.0
   * @category Object
   * @typedefn Idx = String | Int
   * @sig [Idx] -> {a} -> a | Undefined
   * @param {Array} path The path to use.
   * @param {Object} obj The object to retrieve the nested property from.
   * @return {*} The data at `path`.
   * @see R.prop, R.nth
   * @example
   *
   *      R.path(['a', 'b'], {a: {b: 2}}); //=> 2
   *      R.path(['a', 'b'], {c: {b: 2}}); //=> undefined
   *      R.path(['a', 'b', 0], {a: {b: [1, 2, 3]}}); //=> 1
   *      R.path(['a', 'b', -2], {a: {b: [1, 2, 3]}}); //=> 2
   */

  var path =
  /*#__PURE__*/
  _curry2(function path(pathAr, obj) {
    return paths$1([pathAr], obj)[0];
  });

  var path$1 = path;

  /**
   * Returns a function that when supplied an object returns the indicated
   * property of that object, if it exists.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category Object
   * @typedefn Idx = String | Int
   * @sig Idx -> {s: a} -> a | Undefined
   * @param {String|Number} p The property name or array index
   * @param {Object} obj The object to query
   * @return {*} The value at `obj.p`.
   * @see R.path, R.nth
   * @example
   *
   *      R.prop('x', {x: 100}); //=> 100
   *      R.prop('x', {}); //=> undefined
   *      R.prop(0, [100]); //=> 100
   *      R.compose(R.inc, R.prop('x'))({ x: 3 }) //=> 4
   */

  var prop =
  /*#__PURE__*/
  _curry2(function prop(p, obj) {
    return path$1([p], obj);
  });

  var prop$1 = prop;

  /**
   * Returns a new list by plucking the same named property off all objects in
   * the list supplied.
   *
   * `pluck` will work on
   * any [functor](https://github.com/fantasyland/fantasy-land#functor) in
   * addition to arrays, as it is equivalent to `R.map(R.prop(k), f)`.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category List
   * @sig Functor f => k -> f {k: v} -> f v
   * @param {Number|String} key The key name to pluck off of each object.
   * @param {Array} f The array or functor to consider.
   * @return {Array} The list of values for the given key.
   * @see R.props
   * @example
   *
   *      var getAges = R.pluck('age');
   *      getAges([{name: 'fred', age: 29}, {name: 'wilma', age: 27}]); //=> [29, 27]
   *
   *      R.pluck(0, [[1, 2], [3, 4]]);               //=> [1, 3]
   *      R.pluck('val', {a: {val: 3}, b: {val: 5}}); //=> {a: 3, b: 5}
   * @symb R.pluck('x', [{x: 1, y: 2}, {x: 3, y: 4}, {x: 5, y: 6}]) = [1, 3, 5]
   * @symb R.pluck(0, [[1, 2], [3, 4], [5, 6]]) = [1, 3, 5]
   */

  var pluck =
  /*#__PURE__*/
  _curry2(function pluck(p, list) {
    return map$3(prop$1(p), list);
  });

  var pluck$1 = pluck;

  /**
   * Returns a single item by iterating through the list, successively calling
   * the iterator function and passing it an accumulator value and the current
   * value from the array, and then passing the result to the next call.
   *
   * The iterator function receives two values: *(acc, value)*. It may use
   * [`R.reduced`](#reduced) to shortcut the iteration.
   *
   * The arguments' order of [`reduceRight`](#reduceRight)'s iterator function
   * is *(value, acc)*.
   *
   * Note: `R.reduce` does not skip deleted or unassigned indices (sparse
   * arrays), unlike the native `Array.prototype.reduce` method. For more details
   * on this behavior, see:
   * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce#Description
   *
   * Dispatches to the `reduce` method of the third argument, if present. When
   * doing so, it is up to the user to handle the [`R.reduced`](#reduced)
   * shortcuting, as this is not implemented by `reduce`.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category List
   * @sig ((a, b) -> a) -> a -> [b] -> a
   * @param {Function} fn The iterator function. Receives two values, the accumulator and the
   *        current element from the array.
   * @param {*} acc The accumulator value.
   * @param {Array} list The list to iterate over.
   * @return {*} The final, accumulated value.
   * @see R.reduced, R.addIndex, R.reduceRight
   * @example
   *
   *      R.reduce(R.subtract, 0, [1, 2, 3, 4]) // => ((((0 - 1) - 2) - 3) - 4) = -10
   *      //          -               -10
   *      //         / \              / \
   *      //        -   4           -6   4
   *      //       / \              / \
   *      //      -   3   ==>     -3   3
   *      //     / \              / \
   *      //    -   2           -1   2
   *      //   / \              / \
   *      //  0   1            0   1
   *
   * @symb R.reduce(f, a, [b, c, d]) = f(f(f(a, b), c), d)
   */

  var reduce =
  /*#__PURE__*/
  _curry3(_reduce);

  var reduce$1 = reduce;

  /**
   * Takes a list of predicates and returns a predicate that returns true for a
   * given list of arguments if every one of the provided predicates is satisfied
   * by those arguments.
   *
   * The function returned is a curried function whose arity matches that of the
   * highest-arity predicate.
   *
   * @func
   * @memberOf R
   * @since v0.9.0
   * @category Logic
   * @sig [(*... -> Boolean)] -> (*... -> Boolean)
   * @param {Array} predicates An array of predicates to check
   * @return {Function} The combined predicate
   * @see R.anyPass
   * @example
   *
   *      const isQueen = R.propEq('rank', 'Q');
   *      const isSpade = R.propEq('suit', '♠︎');
   *      const isQueenOfSpades = R.allPass([isQueen, isSpade]);
   *
   *      isQueenOfSpades({rank: 'Q', suit: '♣︎'}); //=> false
   *      isQueenOfSpades({rank: 'Q', suit: '♠︎'}); //=> true
   */

  var allPass =
  /*#__PURE__*/
  _curry1(function allPass(preds) {
    return curryN$1(reduce$1(max$1, 0, pluck$1('length', preds)), function () {
      var idx = 0;
      var len = preds.length;

      while (idx < len) {
        if (!preds[idx].apply(this, arguments)) {
          return false;
        }

        idx += 1;
      }

      return true;
    });
  });

  var allPass$1 = allPass;

  /**
   * Returns a function that always returns the given value. Note that for
   * non-primitives the value returned is a reference to the original value.
   *
   * This function is known as `const`, `constant`, or `K` (for K combinator) in
   * other languages and libraries.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category Function
   * @sig a -> (* -> a)
   * @param {*} val The value to wrap in a function
   * @return {Function} A Function :: * -> val.
   * @example
   *
   *      const t = R.always('Tee');
   *      t(); //=> 'Tee'
   */

  var always =
  /*#__PURE__*/
  _curry1(function always(val) {
    return function () {
      return val;
    };
  });

  var always$1 = always;

  /**
   * Returns `true` if both arguments are `true`; `false` otherwise.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category Logic
   * @sig a -> b -> a | b
   * @param {Any} a
   * @param {Any} b
   * @return {Any} the first argument if it is falsy, otherwise the second argument.
   * @see R.both, R.xor
   * @example
   *
   *      R.and(true, true); //=> true
   *      R.and(true, false); //=> false
   *      R.and(false, true); //=> false
   *      R.and(false, false); //=> false
   */

  var and =
  /*#__PURE__*/
  _curry2(function and(a, b) {
    return a && b;
  });

  var and$1 = and;

  var XAny =
  /*#__PURE__*/
  function () {
    function XAny(f, xf) {
      this.xf = xf;
      this.f = f;
      this.any = false;
    }

    XAny.prototype['@@transducer/init'] = _xfBase.init;

    XAny.prototype['@@transducer/result'] = function (result) {
      if (!this.any) {
        result = this.xf['@@transducer/step'](result, false);
      }

      return this.xf['@@transducer/result'](result);
    };

    XAny.prototype['@@transducer/step'] = function (result, input) {
      if (this.f(input)) {
        this.any = true;
        result = _reduced(this.xf['@@transducer/step'](result, true));
      }

      return result;
    };

    return XAny;
  }();

  var _xany =
  /*#__PURE__*/
  _curry2(function _xany(f, xf) {
    return new XAny(f, xf);
  });

  var _xany$1 = _xany;

  /**
   * Returns `true` if at least one of the elements of the list match the predicate,
   * `false` otherwise.
   *
   * Dispatches to the `any` method of the second argument, if present.
   *
   * Acts as a transducer if a transformer is given in list position.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category List
   * @sig (a -> Boolean) -> [a] -> Boolean
   * @param {Function} fn The predicate function.
   * @param {Array} list The array to consider.
   * @return {Boolean} `true` if the predicate is satisfied by at least one element, `false`
   *         otherwise.
   * @see R.all, R.none, R.transduce
   * @example
   *
   *      const lessThan0 = R.flip(R.lt)(0);
   *      const lessThan2 = R.flip(R.lt)(2);
   *      R.any(lessThan0)([1, 2]); //=> false
   *      R.any(lessThan2)([1, 2]); //=> true
   */

  var any =
  /*#__PURE__*/
  _curry2(
  /*#__PURE__*/
  _dispatchable(['any'], _xany$1, function any(fn, list) {
    var idx = 0;

    while (idx < list.length) {
      if (fn(list[idx])) {
        return true;
      }

      idx += 1;
    }

    return false;
  }));

  var any$1 = any;

  /**
   * Takes a list of predicates and returns a predicate that returns true for a
   * given list of arguments if at least one of the provided predicates is
   * satisfied by those arguments.
   *
   * The function returned is a curried function whose arity matches that of the
   * highest-arity predicate.
   *
   * @func
   * @memberOf R
   * @since v0.9.0
   * @category Logic
   * @sig [(*... -> Boolean)] -> (*... -> Boolean)
   * @param {Array} predicates An array of predicates to check
   * @return {Function} The combined predicate
   * @see R.allPass
   * @example
   *
   *      const isClub = R.propEq('suit', '♣');
   *      const isSpade = R.propEq('suit', '♠');
   *      const isBlackCard = R.anyPass([isClub, isSpade]);
   *
   *      isBlackCard({rank: '10', suit: '♣'}); //=> true
   *      isBlackCard({rank: 'Q', suit: '♠'}); //=> true
   *      isBlackCard({rank: 'Q', suit: '♦'}); //=> false
   */

  var anyPass =
  /*#__PURE__*/
  _curry1(function anyPass(preds) {
    return curryN$1(reduce$1(max$1, 0, pluck$1('length', preds)), function () {
      var idx = 0;
      var len = preds.length;

      while (idx < len) {
        if (preds[idx].apply(this, arguments)) {
          return true;
        }

        idx += 1;
      }

      return false;
    });
  });

  var anyPass$1 = anyPass;

  /**
   * ap applies a list of functions to a list of values.
   *
   * Dispatches to the `ap` method of the second argument, if present. Also
   * treats curried functions as applicatives.
   *
   * @func
   * @memberOf R
   * @since v0.3.0
   * @category Function
   * @sig [a -> b] -> [a] -> [b]
   * @sig Apply f => f (a -> b) -> f a -> f b
   * @sig (r -> a -> b) -> (r -> a) -> (r -> b)
   * @param {*} applyF
   * @param {*} applyX
   * @return {*}
   * @example
   *
   *      R.ap([R.multiply(2), R.add(3)], [1,2,3]); //=> [2, 4, 6, 4, 5, 6]
   *      R.ap([R.concat('tasty '), R.toUpper], ['pizza', 'salad']); //=> ["tasty pizza", "tasty salad", "PIZZA", "SALAD"]
   *
   *      // R.ap can also be used as S combinator
   *      // when only two functions are passed
   *      R.ap(R.concat, R.toUpper)('Ramda') //=> 'RamdaRAMDA'
   * @symb R.ap([f, g], [a, b]) = [f(a), f(b), g(a), g(b)]
   */

  var ap =
  /*#__PURE__*/
  _curry2(function ap(applyF, applyX) {
    return typeof applyX['fantasy-land/ap'] === 'function' ? applyX['fantasy-land/ap'](applyF) : typeof applyF.ap === 'function' ? applyF.ap(applyX) : typeof applyF === 'function' ? function (x) {
      return applyF(x)(applyX(x));
    } : _reduce(function (acc, f) {
      return _concat(acc, map$3(f, applyX));
    }, [], applyF);
  });

  var ap$1 = ap;

  function _aperture(n, list) {
    var idx = 0;
    var limit = list.length - (n - 1);
    var acc = new Array(limit >= 0 ? limit : 0);

    while (idx < limit) {
      acc[idx] = Array.prototype.slice.call(list, idx, idx + n);
      idx += 1;
    }

    return acc;
  }

  var XAperture =
  /*#__PURE__*/
  function () {
    function XAperture(n, xf) {
      this.xf = xf;
      this.pos = 0;
      this.full = false;
      this.acc = new Array(n);
    }

    XAperture.prototype['@@transducer/init'] = _xfBase.init;

    XAperture.prototype['@@transducer/result'] = function (result) {
      this.acc = null;
      return this.xf['@@transducer/result'](result);
    };

    XAperture.prototype['@@transducer/step'] = function (result, input) {
      this.store(input);
      return this.full ? this.xf['@@transducer/step'](result, this.getCopy()) : result;
    };

    XAperture.prototype.store = function (input) {
      this.acc[this.pos] = input;
      this.pos += 1;

      if (this.pos === this.acc.length) {
        this.pos = 0;
        this.full = true;
      }
    };

    XAperture.prototype.getCopy = function () {
      return _concat(Array.prototype.slice.call(this.acc, this.pos), Array.prototype.slice.call(this.acc, 0, this.pos));
    };

    return XAperture;
  }();

  var _xaperture =
  /*#__PURE__*/
  _curry2(function _xaperture(n, xf) {
    return new XAperture(n, xf);
  });

  var _xaperture$1 = _xaperture;

  /**
   * Returns a new list, composed of n-tuples of consecutive elements. If `n` is
   * greater than the length of the list, an empty list is returned.
   *
   * Acts as a transducer if a transformer is given in list position.
   *
   * @func
   * @memberOf R
   * @since v0.12.0
   * @category List
   * @sig Number -> [a] -> [[a]]
   * @param {Number} n The size of the tuples to create
   * @param {Array} list The list to split into `n`-length tuples
   * @return {Array} The resulting list of `n`-length tuples
   * @see R.transduce
   * @example
   *
   *      R.aperture(2, [1, 2, 3, 4, 5]); //=> [[1, 2], [2, 3], [3, 4], [4, 5]]
   *      R.aperture(3, [1, 2, 3, 4, 5]); //=> [[1, 2, 3], [2, 3, 4], [3, 4, 5]]
   *      R.aperture(7, [1, 2, 3, 4, 5]); //=> []
   */

  var aperture =
  /*#__PURE__*/
  _curry2(
  /*#__PURE__*/
  _dispatchable([], _xaperture$1, _aperture));

  var aperture$1 = aperture;

  /**
   * Returns a new list containing the contents of the given list, followed by
   * the given element.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category List
   * @sig a -> [a] -> [a]
   * @param {*} el The element to add to the end of the new list.
   * @param {Array} list The list of elements to add a new item to.
   *        list.
   * @return {Array} A new list containing the elements of the old list followed by `el`.
   * @see R.prepend
   * @example
   *
   *      R.append('tests', ['write', 'more']); //=> ['write', 'more', 'tests']
   *      R.append('tests', []); //=> ['tests']
   *      R.append(['tests'], ['write', 'more']); //=> ['write', 'more', ['tests']]
   */

  var append =
  /*#__PURE__*/
  _curry2(function append(el, list) {
    return _concat(list, [el]);
  });

  var append$1 = append;

  /**
   * Applies function `fn` to the argument list `args`. This is useful for
   * creating a fixed-arity function from a variadic function. `fn` should be a
   * bound function if context is significant.
   *
   * @func
   * @memberOf R
   * @since v0.7.0
   * @category Function
   * @sig (*... -> a) -> [*] -> a
   * @param {Function} fn The function which will be called with `args`
   * @param {Array} args The arguments to call `fn` with
   * @return {*} result The result, equivalent to `fn(...args)`
   * @see R.call, R.unapply
   * @example
   *
   *      const nums = [1, 2, 3, -99, 42, 6, 7];
   *      R.apply(Math.max, nums); //=> 42
   * @symb R.apply(f, [a, b, c]) = f(a, b, c)
   */

  var apply =
  /*#__PURE__*/
  _curry2(function apply(fn, args) {
    return fn.apply(this, args);
  });

  var apply$1 = apply;

  /**
   * Returns a list of all the enumerable own properties of the supplied object.
   * Note that the order of the output array is not guaranteed across different
   * JS platforms.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category Object
   * @sig {k: v} -> [v]
   * @param {Object} obj The object to extract values from
   * @return {Array} An array of the values of the object's own properties.
   * @see R.valuesIn, R.keys
   * @example
   *
   *      R.values({a: 1, b: 2, c: 3}); //=> [1, 2, 3]
   */

  var values =
  /*#__PURE__*/
  _curry1(function values(obj) {
    var props = keys$2(obj);
    var len = props.length;
    var vals = [];
    var idx = 0;

    while (idx < len) {
      vals[idx] = obj[props[idx]];
      idx += 1;
    }

    return vals;
  });

  var values$1 = values;

  // delegating calls to .map

  function mapValues(fn, obj) {
    return keys$2(obj).reduce(function (acc, key) {
      acc[key] = fn(obj[key]);
      return acc;
    }, {});
  }
  /**
   * Given a spec object recursively mapping properties to functions, creates a
   * function producing an object of the same structure, by mapping each property
   * to the result of calling its associated function with the supplied arguments.
   *
   * @func
   * @memberOf R
   * @since v0.20.0
   * @category Function
   * @sig {k: ((a, b, ..., m) -> v)} -> ((a, b, ..., m) -> {k: v})
   * @param {Object} spec an object recursively mapping properties to functions for
   *        producing the values for these properties.
   * @return {Function} A function that returns an object of the same structure
   * as `spec', with each property set to the value returned by calling its
   * associated function with the supplied arguments.
   * @see R.converge, R.juxt
   * @example
   *
   *      const getMetrics = R.applySpec({
   *        sum: R.add,
   *        nested: { mul: R.multiply }
   *      });
   *      getMetrics(2, 4); // => { sum: 6, nested: { mul: 8 } }
   * @symb R.applySpec({ x: f, y: { z: g } })(a, b) = { x: f(a, b), y: { z: g(a, b) } }
   */


  var applySpec =
  /*#__PURE__*/
  _curry1(function applySpec(spec) {
    spec = mapValues(function (v) {
      return typeof v == 'function' ? v : applySpec(v);
    }, spec);
    return curryN$1(reduce$1(max$1, 0, pluck$1('length', values$1(spec))), function () {
      var args = arguments;
      return mapValues(function (f) {
        return apply$1(f, args);
      }, spec);
    });
  });

  var applySpec$1 = applySpec;

  /**
   * Takes a value and applies a function to it.
   *
   * This function is also known as the `thrush` combinator.
   *
   * @func
   * @memberOf R
   * @since v0.25.0
   * @category Function
   * @sig a -> (a -> b) -> b
   * @param {*} x The value
   * @param {Function} f The function to apply
   * @return {*} The result of applying `f` to `x`
   * @example
   *
   *      const t42 = R.applyTo(42);
   *      t42(R.identity); //=> 42
   *      t42(R.add(1)); //=> 43
   */

  var applyTo =
  /*#__PURE__*/
  _curry2(function applyTo(x, f) {
    return f(x);
  });

  var applyTo$1 = applyTo;

  /**
   * Makes an ascending comparator function out of a function that returns a value
   * that can be compared with `<` and `>`.
   *
   * @func
   * @memberOf R
   * @since v0.23.0
   * @category Function
   * @sig Ord b => (a -> b) -> a -> a -> Number
   * @param {Function} fn A function of arity one that returns a value that can be compared
   * @param {*} a The first item to be compared.
   * @param {*} b The second item to be compared.
   * @return {Number} `-1` if fn(a) < fn(b), `1` if fn(b) < fn(a), otherwise `0`
   * @see R.descend
   * @example
   *
   *      const byAge = R.ascend(R.prop('age'));
   *      const people = [
   *        { name: 'Emma', age: 70 },
   *        { name: 'Peter', age: 78 },
   *        { name: 'Mikhail', age: 62 },
   *      ];
   *      const peopleByYoungestFirst = R.sort(byAge, people);
   *        //=> [{ name: 'Mikhail', age: 62 },{ name: 'Emma', age: 70 }, { name: 'Peter', age: 78 }]
   */

  var ascend =
  /*#__PURE__*/
  _curry3(function ascend(fn, a, b) {
    var aa = fn(a);
    var bb = fn(b);
    return aa < bb ? -1 : aa > bb ? 1 : 0;
  });

  var ascend$1 = ascend;

  /**
   * Makes a shallow clone of an object, setting or overriding the specified
   * property with the given value. Note that this copies and flattens prototype
   * properties onto the new object as well. All non-primitive properties are
   * copied by reference.
   *
   * @func
   * @memberOf R
   * @since v0.8.0
   * @category Object
   * @sig String -> a -> {k: v} -> {k: v}
   * @param {String} prop The property name to set
   * @param {*} val The new value
   * @param {Object} obj The object to clone
   * @return {Object} A new object equivalent to the original except for the changed property.
   * @see R.dissoc, R.pick
   * @example
   *
   *      R.assoc('c', 3, {a: 1, b: 2}); //=> {a: 1, b: 2, c: 3}
   */

  var assoc =
  /*#__PURE__*/
  _curry3(function assoc(prop, val, obj) {
    var result = {};

    for (var p in obj) {
      result[p] = obj[p];
    }

    result[prop] = val;
    return result;
  });

  var assoc$1 = assoc;

  /**
   * Checks if the input value is `null` or `undefined`.
   *
   * @func
   * @memberOf R
   * @since v0.9.0
   * @category Type
   * @sig * -> Boolean
   * @param {*} x The value to test.
   * @return {Boolean} `true` if `x` is `undefined` or `null`, otherwise `false`.
   * @example
   *
   *      R.isNil(null); //=> true
   *      R.isNil(undefined); //=> true
   *      R.isNil(0); //=> false
   *      R.isNil([]); //=> false
   */

  var isNil =
  /*#__PURE__*/
  _curry1(function isNil(x) {
    return x == null;
  });

  var isNil$1 = isNil;

  /**
   * Makes a shallow clone of an object, setting or overriding the nodes required
   * to create the given path, and placing the specific value at the tail end of
   * that path. Note that this copies and flattens prototype properties onto the
   * new object as well. All non-primitive properties are copied by reference.
   *
   * @func
   * @memberOf R
   * @since v0.8.0
   * @category Object
   * @typedefn Idx = String | Int
   * @sig [Idx] -> a -> {a} -> {a}
   * @param {Array} path the path to set
   * @param {*} val The new value
   * @param {Object} obj The object to clone
   * @return {Object} A new object equivalent to the original except along the specified path.
   * @see R.dissocPath
   * @example
   *
   *      R.assocPath(['a', 'b', 'c'], 42, {a: {b: {c: 0}}}); //=> {a: {b: {c: 42}}}
   *
   *      // Any missing or non-object keys in path will be overridden
   *      R.assocPath(['a', 'b', 'c'], 42, {a: 5}); //=> {a: {b: {c: 42}}}
   */

  var assocPath =
  /*#__PURE__*/
  _curry3(function assocPath(path, val, obj) {
    if (path.length === 0) {
      return val;
    }

    var idx = path[0];

    if (path.length > 1) {
      var nextObj = !isNil$1(obj) && _has(idx, obj) ? obj[idx] : _isInteger(path[1]) ? [] : {};
      val = assocPath(Array.prototype.slice.call(path, 1), val, nextObj);
    }

    if (_isInteger(idx) && _isArray(obj)) {
      var arr = [].concat(obj);
      arr[idx] = val;
      return arr;
    } else {
      return assoc$1(idx, val, obj);
    }
  });

  var assocPath$1 = assocPath;

  /**
   * Wraps a function of any arity (including nullary) in a function that accepts
   * exactly `n` parameters. Any extraneous parameters will not be passed to the
   * supplied function.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category Function
   * @sig Number -> (* -> a) -> (* -> a)
   * @param {Number} n The desired arity of the new function.
   * @param {Function} fn The function to wrap.
   * @return {Function} A new function wrapping `fn`. The new function is guaranteed to be of
   *         arity `n`.
   * @see R.binary, R.unary
   * @example
   *
   *      const takesTwoArgs = (a, b) => [a, b];
   *
   *      takesTwoArgs.length; //=> 2
   *      takesTwoArgs(1, 2); //=> [1, 2]
   *
   *      const takesOneArg = R.nAry(1, takesTwoArgs);
   *      takesOneArg.length; //=> 1
   *      // Only `n` arguments are passed to the wrapped function
   *      takesOneArg(1, 2); //=> [1, undefined]
   * @symb R.nAry(0, f)(a, b) = f()
   * @symb R.nAry(1, f)(a, b) = f(a)
   * @symb R.nAry(2, f)(a, b) = f(a, b)
   */

  var nAry =
  /*#__PURE__*/
  _curry2(function nAry(n, fn) {
    switch (n) {
      case 0:
        return function () {
          return fn.call(this);
        };

      case 1:
        return function (a0) {
          return fn.call(this, a0);
        };

      case 2:
        return function (a0, a1) {
          return fn.call(this, a0, a1);
        };

      case 3:
        return function (a0, a1, a2) {
          return fn.call(this, a0, a1, a2);
        };

      case 4:
        return function (a0, a1, a2, a3) {
          return fn.call(this, a0, a1, a2, a3);
        };

      case 5:
        return function (a0, a1, a2, a3, a4) {
          return fn.call(this, a0, a1, a2, a3, a4);
        };

      case 6:
        return function (a0, a1, a2, a3, a4, a5) {
          return fn.call(this, a0, a1, a2, a3, a4, a5);
        };

      case 7:
        return function (a0, a1, a2, a3, a4, a5, a6) {
          return fn.call(this, a0, a1, a2, a3, a4, a5, a6);
        };

      case 8:
        return function (a0, a1, a2, a3, a4, a5, a6, a7) {
          return fn.call(this, a0, a1, a2, a3, a4, a5, a6, a7);
        };

      case 9:
        return function (a0, a1, a2, a3, a4, a5, a6, a7, a8) {
          return fn.call(this, a0, a1, a2, a3, a4, a5, a6, a7, a8);
        };

      case 10:
        return function (a0, a1, a2, a3, a4, a5, a6, a7, a8, a9) {
          return fn.call(this, a0, a1, a2, a3, a4, a5, a6, a7, a8, a9);
        };

      default:
        throw new Error('First argument to nAry must be a non-negative integer no greater than ten');
    }
  });

  var nAry$1 = nAry;

  /**
   * Wraps a function of any arity (including nullary) in a function that accepts
   * exactly 2 parameters. Any extraneous parameters will not be passed to the
   * supplied function.
   *
   * @func
   * @memberOf R
   * @since v0.2.0
   * @category Function
   * @sig (* -> c) -> (a, b -> c)
   * @param {Function} fn The function to wrap.
   * @return {Function} A new function wrapping `fn`. The new function is guaranteed to be of
   *         arity 2.
   * @see R.nAry, R.unary
   * @example
   *
   *      const takesThreeArgs = function(a, b, c) {
   *        return [a, b, c];
   *      };
   *      takesThreeArgs.length; //=> 3
   *      takesThreeArgs(1, 2, 3); //=> [1, 2, 3]
   *
   *      const takesTwoArgs = R.binary(takesThreeArgs);
   *      takesTwoArgs.length; //=> 2
   *      // Only 2 arguments are passed to the wrapped function
   *      takesTwoArgs(1, 2, 3); //=> [1, 2, undefined]
   * @symb R.binary(f)(a, b, c) = f(a, b)
   */

  var binary =
  /*#__PURE__*/
  _curry1(function binary(fn) {
    return nAry$1(2, fn);
  });

  var binary$1 = binary;

  function _isFunction(x) {
    var type = Object.prototype.toString.call(x);
    return type === '[object Function]' || type === '[object AsyncFunction]' || type === '[object GeneratorFunction]' || type === '[object AsyncGeneratorFunction]';
  }

  /**
   * "lifts" a function to be the specified arity, so that it may "map over" that
   * many lists, Functions or other objects that satisfy the [FantasyLand Apply spec](https://github.com/fantasyland/fantasy-land#apply).
   *
   * @func
   * @memberOf R
   * @since v0.7.0
   * @category Function
   * @sig Number -> (*... -> *) -> ([*]... -> [*])
   * @param {Function} fn The function to lift into higher context
   * @return {Function} The lifted function.
   * @see R.lift, R.ap
   * @example
   *
   *      const madd3 = R.liftN(3, (...args) => R.sum(args));
   *      madd3([1,2,3], [1,2,3], [1]); //=> [3, 4, 5, 4, 5, 6, 5, 6, 7]
   */

  var liftN =
  /*#__PURE__*/
  _curry2(function liftN(arity, fn) {
    var lifted = curryN$1(arity, fn);
    return curryN$1(arity, function () {
      return _reduce(ap$1, map$3(lifted, arguments[0]), Array.prototype.slice.call(arguments, 1));
    });
  });

  var liftN$1 = liftN;

  /**
   * "lifts" a function of arity > 1 so that it may "map over" a list, Function or other
   * object that satisfies the [FantasyLand Apply spec](https://github.com/fantasyland/fantasy-land#apply).
   *
   * @func
   * @memberOf R
   * @since v0.7.0
   * @category Function
   * @sig (*... -> *) -> ([*]... -> [*])
   * @param {Function} fn The function to lift into higher context
   * @return {Function} The lifted function.
   * @see R.liftN
   * @example
   *
   *      const madd3 = R.lift((a, b, c) => a + b + c);
   *
   *      madd3([1,2,3], [1,2,3], [1]); //=> [3, 4, 5, 4, 5, 6, 5, 6, 7]
   *
   *      const madd5 = R.lift((a, b, c, d, e) => a + b + c + d + e);
   *
   *      madd5([1,2], [3], [4, 5], [6], [7, 8]); //=> [21, 22, 22, 23, 22, 23, 23, 24]
   */

  var lift =
  /*#__PURE__*/
  _curry1(function lift(fn) {
    return liftN$1(fn.length, fn);
  });

  var lift$1 = lift;

  /**
   * A function which calls the two provided functions and returns the `&&`
   * of the results.
   * It returns the result of the first function if it is false-y and the result
   * of the second function otherwise. Note that this is short-circuited,
   * meaning that the second function will not be invoked if the first returns a
   * false-y value.
   *
   * In addition to functions, `R.both` also accepts any fantasy-land compatible
   * applicative functor.
   *
   * @func
   * @memberOf R
   * @since v0.12.0
   * @category Logic
   * @sig (*... -> Boolean) -> (*... -> Boolean) -> (*... -> Boolean)
   * @param {Function} f A predicate
   * @param {Function} g Another predicate
   * @return {Function} a function that applies its arguments to `f` and `g` and `&&`s their outputs together.
   * @see R.and
   * @example
   *
   *      const gt10 = R.gt(R.__, 10)
   *      const lt20 = R.lt(R.__, 20)
   *      const f = R.both(gt10, lt20);
   *      f(15); //=> true
   *      f(30); //=> false
   *
   *      R.both(Maybe.Just(false), Maybe.Just(55)); // => Maybe.Just(false)
   *      R.both([false, false, 'a'], [11]); //=> [false, false, 11]
   */

  var both =
  /*#__PURE__*/
  _curry2(function both(f, g) {
    return _isFunction(f) ? function _both() {
      return f.apply(this, arguments) && g.apply(this, arguments);
    } : lift$1(and$1)(f, g);
  });

  var both$1 = both;

  /**
   * Returns a curried equivalent of the provided function. The curried function
   * has two unusual capabilities. First, its arguments needn't be provided one
   * at a time. If `f` is a ternary function and `g` is `R.curry(f)`, the
   * following are equivalent:
   *
   *   - `g(1)(2)(3)`
   *   - `g(1)(2, 3)`
   *   - `g(1, 2)(3)`
   *   - `g(1, 2, 3)`
   *
   * Secondly, the special placeholder value [`R.__`](#__) may be used to specify
   * "gaps", allowing partial application of any combination of arguments,
   * regardless of their positions. If `g` is as above and `_` is [`R.__`](#__),
   * the following are equivalent:
   *
   *   - `g(1, 2, 3)`
   *   - `g(_, 2, 3)(1)`
   *   - `g(_, _, 3)(1)(2)`
   *   - `g(_, _, 3)(1, 2)`
   *   - `g(_, 2)(1)(3)`
   *   - `g(_, 2)(1, 3)`
   *   - `g(_, 2)(_, 3)(1)`
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category Function
   * @sig (* -> a) -> (* -> a)
   * @param {Function} fn The function to curry.
   * @return {Function} A new, curried function.
   * @see R.curryN, R.partial
   * @example
   *
   *      const addFourNumbers = (a, b, c, d) => a + b + c + d;
   *
   *      const curriedAddFourNumbers = R.curry(addFourNumbers);
   *      const f = curriedAddFourNumbers(1, 2);
   *      const g = f(3);
   *      g(4); //=> 10
   */

  var curry$4 =
  /*#__PURE__*/
  _curry1(function curry(fn) {
    return curryN$1(fn.length, fn);
  });

  var curry$5 = curry$4;

  /**
   * Returns the result of calling its first argument with the remaining
   * arguments. This is occasionally useful as a converging function for
   * [`R.converge`](#converge): the first branch can produce a function while the
   * remaining branches produce values to be passed to that function as its
   * arguments.
   *
   * @func
   * @memberOf R
   * @since v0.9.0
   * @category Function
   * @sig (*... -> a),*... -> a
   * @param {Function} fn The function to apply to the remaining arguments.
   * @param {...*} args Any number of positional arguments.
   * @return {*}
   * @see R.apply
   * @example
   *
   *      R.call(R.add, 1, 2); //=> 3
   *
   *      const indentN = R.pipe(R.repeat(' '),
   *                           R.join(''),
   *                           R.replace(/^(?!$)/gm));
   *
   *      const format = R.converge(R.call, [
   *                                  R.pipe(R.prop('indent'), indentN),
   *                                  R.prop('value')
   *                              ]);
   *
   *      format({indent: 2, value: 'foo\nbar\nbaz\n'}); //=> '  foo\n  bar\n  baz\n'
   * @symb R.call(f, a, b) = f(a, b)
   */

  var call =
  /*#__PURE__*/
  curry$5(function call(fn) {
    return fn.apply(this, Array.prototype.slice.call(arguments, 1));
  });
  var call$1 = call;

  /**
   * `_makeFlat` is a helper function that returns a one-level or fully recursive
   * function based on the flag passed in.
   *
   * @private
   */

  function _makeFlat(recursive) {
    return function flatt(list) {
      var value, jlen, j;
      var result = [];
      var idx = 0;
      var ilen = list.length;

      while (idx < ilen) {
        if (_isArrayLike$1(list[idx])) {
          value = recursive ? flatt(list[idx]) : list[idx];
          j = 0;
          jlen = value.length;

          while (j < jlen) {
            result[result.length] = value[j];
            j += 1;
          }
        } else {
          result[result.length] = list[idx];
        }

        idx += 1;
      }

      return result;
    };
  }

  function _forceReduced(x) {
    return {
      '@@transducer/value': x,
      '@@transducer/reduced': true
    };
  }

  var preservingReduced = function (xf) {
    return {
      '@@transducer/init': _xfBase.init,
      '@@transducer/result': function (result) {
        return xf['@@transducer/result'](result);
      },
      '@@transducer/step': function (result, input) {
        var ret = xf['@@transducer/step'](result, input);
        return ret['@@transducer/reduced'] ? _forceReduced(ret) : ret;
      }
    };
  };

  var _flatCat = function _xcat(xf) {
    var rxf = preservingReduced(xf);
    return {
      '@@transducer/init': _xfBase.init,
      '@@transducer/result': function (result) {
        return rxf['@@transducer/result'](result);
      },
      '@@transducer/step': function (result, input) {
        return !_isArrayLike$1(input) ? _reduce(rxf, result, [input]) : _reduce(rxf, result, input);
      }
    };
  };

  var _flatCat$1 = _flatCat;

  var _xchain =
  /*#__PURE__*/
  _curry2(function _xchain(f, xf) {
    return map$3(f, _flatCat$1(xf));
  });

  var _xchain$1 = _xchain;

  /**
   * `chain` maps a function over a list and concatenates the results. `chain`
   * is also known as `flatMap` in some libraries.
   *
   * Dispatches to the `chain` method of the second argument, if present,
   * according to the [FantasyLand Chain spec](https://github.com/fantasyland/fantasy-land#chain).
   *
   * If second argument is a function, `chain(f, g)(x)` is equivalent to `f(g(x), x)`.
   *
   * Acts as a transducer if a transformer is given in list position.
   *
   * @func
   * @memberOf R
   * @since v0.3.0
   * @category List
   * @sig Chain m => (a -> m b) -> m a -> m b
   * @param {Function} fn The function to map with
   * @param {Array} list The list to map over
   * @return {Array} The result of flat-mapping `list` with `fn`
   * @example
   *
   *      const duplicate = n => [n, n];
   *      R.chain(duplicate, [1, 2, 3]); //=> [1, 1, 2, 2, 3, 3]
   *
   *      R.chain(R.append, R.head)([1, 2, 3]); //=> [1, 2, 3, 1]
   */

  var chain =
  /*#__PURE__*/
  _curry2(
  /*#__PURE__*/
  _dispatchable(['fantasy-land/chain', 'chain'], _xchain$1, function chain(fn, monad) {
    if (typeof monad === 'function') {
      return function (x) {
        return fn(monad(x))(x);
      };
    }

    return _makeFlat(false)(map$3(fn, monad));
  }));

  var chain$1 = chain;

  /**
   * Restricts a number to be within a range.
   *
   * Also works for other ordered types such as Strings and Dates.
   *
   * @func
   * @memberOf R
   * @since v0.20.0
   * @category Relation
   * @sig Ord a => a -> a -> a -> a
   * @param {Number} minimum The lower limit of the clamp (inclusive)
   * @param {Number} maximum The upper limit of the clamp (inclusive)
   * @param {Number} value Value to be clamped
   * @return {Number} Returns `minimum` when `val < minimum`, `maximum` when `val > maximum`, returns `val` otherwise
   * @example
   *
   *      R.clamp(1, 10, -5) // => 1
   *      R.clamp(1, 10, 15) // => 10
   *      R.clamp(1, 10, 4)  // => 4
   */

  var clamp =
  /*#__PURE__*/
  _curry3(function clamp(min, max, value) {
    if (min > max) {
      throw new Error('min must not be greater than max in clamp(min, max, value)');
    }

    return value < min ? min : value > max ? max : value;
  });

  var clamp$1 = clamp;

  function _cloneRegExp(pattern) {
    return new RegExp(pattern.source, (pattern.global ? 'g' : '') + (pattern.ignoreCase ? 'i' : '') + (pattern.multiline ? 'm' : '') + (pattern.sticky ? 'y' : '') + (pattern.unicode ? 'u' : ''));
  }

  /**
   * Gives a single-word string description of the (native) type of a value,
   * returning such answers as 'Object', 'Number', 'Array', or 'Null'. Does not
   * attempt to distinguish user Object types any further, reporting them all as
   * 'Object'.
   *
   * @func
   * @memberOf R
   * @since v0.8.0
   * @category Type
   * @sig (* -> {*}) -> String
   * @param {*} val The value to test
   * @return {String}
   * @example
   *
   *      R.type({}); //=> "Object"
   *      R.type(1); //=> "Number"
   *      R.type(false); //=> "Boolean"
   *      R.type('s'); //=> "String"
   *      R.type(null); //=> "Null"
   *      R.type([]); //=> "Array"
   *      R.type(/[A-z]/); //=> "RegExp"
   *      R.type(() => {}); //=> "Function"
   *      R.type(undefined); //=> "Undefined"
   */

  var type =
  /*#__PURE__*/
  _curry1(function type(val) {
    return val === null ? 'Null' : val === undefined ? 'Undefined' : Object.prototype.toString.call(val).slice(8, -1);
  });

  var type$1 = type;

  /**
   * Copies an object.
   *
   * @private
   * @param {*} value The value to be copied
   * @param {Array} refFrom Array containing the source references
   * @param {Array} refTo Array containing the copied source references
   * @param {Boolean} deep Whether or not to perform deep cloning.
   * @return {*} The copied value.
   */

  function _clone(value, refFrom, refTo, deep) {
    var copy = function copy(copiedValue) {
      var len = refFrom.length;
      var idx = 0;

      while (idx < len) {
        if (value === refFrom[idx]) {
          return refTo[idx];
        }

        idx += 1;
      }

      refFrom[idx + 1] = value;
      refTo[idx + 1] = copiedValue;

      for (var key in value) {
        copiedValue[key] = deep ? _clone(value[key], refFrom, refTo, true) : value[key];
      }

      return copiedValue;
    };

    switch (type$1(value)) {
      case 'Object':
        return copy({});

      case 'Array':
        return copy([]);

      case 'Date':
        return new Date(value.valueOf());

      case 'RegExp':
        return _cloneRegExp(value);

      default:
        return value;
    }
  }

  /**
   * Creates a deep copy of the value which may contain (nested) `Array`s and
   * `Object`s, `Number`s, `String`s, `Boolean`s and `Date`s. `Function`s are
   * assigned by reference rather than copied
   *
   * Dispatches to a `clone` method if present.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category Object
   * @sig {*} -> {*}
   * @param {*} value The object or array to clone
   * @return {*} A deeply cloned copy of `val`
   * @example
   *
   *      const objects = [{}, {}, {}];
   *      const objectsClone = R.clone(objects);
   *      objects === objectsClone; //=> false
   *      objects[0] === objectsClone[0]; //=> false
   */

  var clone =
  /*#__PURE__*/
  _curry1(function clone(value) {
    return value != null && typeof value.clone === 'function' ? value.clone() : _clone(value, [], [], true);
  });

  var clone$1 = clone;

  /**
   * Makes a comparator function out of a function that reports whether the first
   * element is less than the second.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category Function
   * @sig ((a, b) -> Boolean) -> ((a, b) -> Number)
   * @param {Function} pred A predicate function of arity two which will return `true` if the first argument
   * is less than the second, `false` otherwise
   * @return {Function} A Function :: a -> b -> Int that returns `-1` if a < b, `1` if b < a, otherwise `0`
   * @example
   *
   *      const byAge = R.comparator((a, b) => a.age < b.age);
   *      const people = [
   *        { name: 'Emma', age: 70 },
   *        { name: 'Peter', age: 78 },
   *        { name: 'Mikhail', age: 62 },
   *      ];
   *      const peopleByIncreasingAge = R.sort(byAge, people);
   *        //=> [{ name: 'Mikhail', age: 62 },{ name: 'Emma', age: 70 }, { name: 'Peter', age: 78 }]
   */

  var comparator =
  /*#__PURE__*/
  _curry1(function comparator(pred) {
    return function (a, b) {
      return pred(a, b) ? -1 : pred(b, a) ? 1 : 0;
    };
  });

  var comparator$1 = comparator;

  /**
   * A function that returns the `!` of its argument. It will return `true` when
   * passed false-y value, and `false` when passed a truth-y one.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category Logic
   * @sig * -> Boolean
   * @param {*} a any value
   * @return {Boolean} the logical inverse of passed argument.
   * @see R.complement
   * @example
   *
   *      R.not(true); //=> false
   *      R.not(false); //=> true
   *      R.not(0); //=> true
   *      R.not(1); //=> false
   */

  var not =
  /*#__PURE__*/
  _curry1(function not(a) {
    return !a;
  });

  var not$1 = not;

  /**
   * Takes a function `f` and returns a function `g` such that if called with the same arguments
   * when `f` returns a "truthy" value, `g` returns `false` and when `f` returns a "falsy" value `g` returns `true`.
   *
   * `R.complement` may be applied to any functor
   *
   * @func
   * @memberOf R
   * @since v0.12.0
   * @category Logic
   * @sig (*... -> *) -> (*... -> Boolean)
   * @param {Function} f
   * @return {Function}
   * @see R.not
   * @example
   *
   *      const isNotNil = R.complement(R.isNil);
   *      isNil(null); //=> true
   *      isNotNil(null); //=> false
   *      isNil(7); //=> false
   *      isNotNil(7); //=> true
   */

  var complement =
  /*#__PURE__*/
  lift$1(not$1);
  var complement$1 = complement;

  function _pipe(f, g) {
    return function () {
      return g.call(this, f.apply(this, arguments));
    };
  }

  /**
   * This checks whether a function has a [methodname] function. If it isn't an
   * array it will execute that function otherwise it will default to the ramda
   * implementation.
   *
   * @private
   * @param {Function} fn ramda implemtation
   * @param {String} methodname property to check for a custom implementation
   * @return {Object} Whatever the return value of the method is.
   */

  function _checkForMethod(methodname, fn) {
    return function () {
      var length = arguments.length;

      if (length === 0) {
        return fn();
      }

      var obj = arguments[length - 1];
      return _isArray(obj) || typeof obj[methodname] !== 'function' ? fn.apply(this, arguments) : obj[methodname].apply(obj, Array.prototype.slice.call(arguments, 0, length - 1));
    };
  }

  /**
   * Returns the elements of the given list or string (or object with a `slice`
   * method) from `fromIndex` (inclusive) to `toIndex` (exclusive).
   *
   * Dispatches to the `slice` method of the third argument, if present.
   *
   * @func
   * @memberOf R
   * @since v0.1.4
   * @category List
   * @sig Number -> Number -> [a] -> [a]
   * @sig Number -> Number -> String -> String
   * @param {Number} fromIndex The start index (inclusive).
   * @param {Number} toIndex The end index (exclusive).
   * @param {*} list
   * @return {*}
   * @example
   *
   *      R.slice(1, 3, ['a', 'b', 'c', 'd']);        //=> ['b', 'c']
   *      R.slice(1, Infinity, ['a', 'b', 'c', 'd']); //=> ['b', 'c', 'd']
   *      R.slice(0, -1, ['a', 'b', 'c', 'd']);       //=> ['a', 'b', 'c']
   *      R.slice(-3, -1, ['a', 'b', 'c', 'd']);      //=> ['b', 'c']
   *      R.slice(0, 3, 'ramda');                     //=> 'ram'
   */

  var slice$2 =
  /*#__PURE__*/
  _curry3(
  /*#__PURE__*/
  _checkForMethod('slice', function slice(fromIndex, toIndex, list) {
    return Array.prototype.slice.call(list, fromIndex, toIndex);
  }));

  var slice$3 = slice$2;

  /**
   * Returns all but the first element of the given list or string (or object
   * with a `tail` method).
   *
   * Dispatches to the `slice` method of the first argument, if present.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category List
   * @sig [a] -> [a]
   * @sig String -> String
   * @param {*} list
   * @return {*}
   * @see R.head, R.init, R.last
   * @example
   *
   *      R.tail([1, 2, 3]);  //=> [2, 3]
   *      R.tail([1, 2]);     //=> [2]
   *      R.tail([1]);        //=> []
   *      R.tail([]);         //=> []
   *
   *      R.tail('abc');  //=> 'bc'
   *      R.tail('ab');   //=> 'b'
   *      R.tail('a');    //=> ''
   *      R.tail('');     //=> ''
   */

  var tail =
  /*#__PURE__*/
  _curry1(
  /*#__PURE__*/
  _checkForMethod('tail',
  /*#__PURE__*/
  slice$3(1, Infinity)));

  var tail$1 = tail;

  /**
   * Performs left-to-right function composition. The first argument may have
   * any arity; the remaining arguments must be unary.
   *
   * In some libraries this function is named `sequence`.
   *
   * **Note:** The result of pipe is not automatically curried.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category Function
   * @sig (((a, b, ..., n) -> o), (o -> p), ..., (x -> y), (y -> z)) -> ((a, b, ..., n) -> z)
   * @param {...Function} functions
   * @return {Function}
   * @see R.compose
   * @example
   *
   *      const f = R.pipe(Math.pow, R.negate, R.inc);
   *
   *      f(3, 4); // -(3^4) + 1
   * @symb R.pipe(f, g, h)(a, b) = h(g(f(a, b)))
   */

  function pipe$3() {
    if (arguments.length === 0) {
      throw new Error('pipe requires at least one argument');
    }

    return _arity(arguments[0].length, reduce$1(_pipe, arguments[0], tail$1(arguments)));
  }

  /**
   * Returns a new list or string with the elements or characters in reverse
   * order.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category List
   * @sig [a] -> [a]
   * @sig String -> String
   * @param {Array|String} list
   * @return {Array|String}
   * @example
   *
   *      R.reverse([1, 2, 3]);  //=> [3, 2, 1]
   *      R.reverse([1, 2]);     //=> [2, 1]
   *      R.reverse([1]);        //=> [1]
   *      R.reverse([]);         //=> []
   *
   *      R.reverse('abc');      //=> 'cba'
   *      R.reverse('ab');       //=> 'ba'
   *      R.reverse('a');        //=> 'a'
   *      R.reverse('');         //=> ''
   */

  var reverse =
  /*#__PURE__*/
  _curry1(function reverse(list) {
    return _isString(list) ? list.split('').reverse().join('') : Array.prototype.slice.call(list, 0).reverse();
  });

  var reverse$1 = reverse;

  /**
   * Performs right-to-left function composition. The last argument may have
   * any arity; the remaining arguments must be unary.
   *
   * **Note:** The result of compose is not automatically curried.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category Function
   * @sig ((y -> z), (x -> y), ..., (o -> p), ((a, b, ..., n) -> o)) -> ((a, b, ..., n) -> z)
   * @param {...Function} ...functions The functions to compose
   * @return {Function}
   * @see R.pipe
   * @example
   *
   *      const classyGreeting = (firstName, lastName) => "The name's " + lastName + ", " + firstName + " " + lastName
   *      const yellGreeting = R.compose(R.toUpper, classyGreeting);
   *      yellGreeting('James', 'Bond'); //=> "THE NAME'S BOND, JAMES BOND"
   *
   *      R.compose(Math.abs, R.add(1), R.multiply(2))(-4) //=> 7
   *
   * @symb R.compose(f, g, h)(a, b) = f(g(h(a, b)))
   */

  function compose() {
    if (arguments.length === 0) {
      throw new Error('compose requires at least one argument');
    }

    return pipe$3.apply(this, reverse$1(arguments));
  }

  /**
   * Returns the right-to-left Kleisli composition of the provided functions,
   * each of which must return a value of a type supported by [`chain`](#chain).
   *
   * `R.composeK(h, g, f)` is equivalent to `R.compose(R.chain(h), R.chain(g), f)`.
   *
   * @func
   * @memberOf R
   * @since v0.16.0
   * @category Function
   * @sig Chain m => ((y -> m z), (x -> m y), ..., (a -> m b)) -> (a -> m z)
   * @param {...Function} ...functions The functions to compose
   * @return {Function}
   * @see R.pipeK
   * @deprecated since v0.26.0
   * @example
   *
   *       //  get :: String -> Object -> Maybe *
   *       const get = R.curry((propName, obj) => Maybe(obj[propName]))
   *
   *       //  getStateCode :: Maybe String -> Maybe String
   *       const getStateCode = R.composeK(
   *         R.compose(Maybe.of, R.toUpper),
   *         get('state'),
   *         get('address'),
   *         get('user'),
   *       );
   *       getStateCode({"user":{"address":{"state":"ny"}}}); //=> Maybe.Just("NY")
   *       getStateCode({}); //=> Maybe.Nothing()
   * @symb R.composeK(f, g, h)(a) = R.chain(f, R.chain(g, h(a)))
   */

  function composeK() {
    if (arguments.length === 0) {
      throw new Error('composeK requires at least one argument');
    }

    var init = Array.prototype.slice.call(arguments);
    var last = init.pop();
    return compose(compose.apply(this, map$3(chain$1, init)), last);
  }

  function _pipeP(f, g) {
    return function () {
      var ctx = this;
      return f.apply(ctx, arguments).then(function (x) {
        return g.call(ctx, x);
      });
    };
  }

  /**
   * Performs left-to-right composition of one or more Promise-returning
   * functions. The first argument may have any arity; the remaining arguments
   * must be unary.
   *
   * @func
   * @memberOf R
   * @since v0.10.0
   * @category Function
   * @sig ((a -> Promise b), (b -> Promise c), ..., (y -> Promise z)) -> (a -> Promise z)
   * @param {...Function} functions
   * @return {Function}
   * @see R.composeP
   * @deprecated since v0.26.0
   * @example
   *
   *      //  followersForUser :: String -> Promise [User]
   *      const followersForUser = R.pipeP(db.getUserById, db.getFollowers);
   */

  function pipeP() {
    if (arguments.length === 0) {
      throw new Error('pipeP requires at least one argument');
    }

    return _arity(arguments[0].length, reduce$1(_pipeP, arguments[0], tail$1(arguments)));
  }

  /**
   * Performs right-to-left composition of one or more Promise-returning
   * functions. The last arguments may have any arity; the remaining
   * arguments must be unary.
   *
   * @func
   * @memberOf R
   * @since v0.10.0
   * @category Function
   * @sig ((y -> Promise z), (x -> Promise y), ..., (a -> Promise b)) -> (a -> Promise z)
   * @param {...Function} functions The functions to compose
   * @return {Function}
   * @see R.pipeP
   * @deprecated since v0.26.0
   * @example
   *
   *      const db = {
   *        users: {
   *          JOE: {
   *            name: 'Joe',
   *            followers: ['STEVE', 'SUZY']
   *          }
   *        }
   *      }
   *
   *      // We'll pretend to do a db lookup which returns a promise
   *      const lookupUser = (userId) => Promise.resolve(db.users[userId])
   *      const lookupFollowers = (user) => Promise.resolve(user.followers)
   *      lookupUser('JOE').then(lookupFollowers)
   *
   *      //  followersForUser :: String -> Promise [UserId]
   *      const followersForUser = R.composeP(lookupFollowers, lookupUser);
   *      followersForUser('JOE').then(followers => console.log('Followers:', followers))
   *      // Followers: ["STEVE","SUZY"]
   */

  function composeP() {
    if (arguments.length === 0) {
      throw new Error('composeP requires at least one argument');
    }

    return pipeP.apply(this, reverse$1(arguments));
  }

  /**
   * Returns the first element of the given list or string. In some libraries
   * this function is named `first`.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category List
   * @sig [a] -> a | Undefined
   * @sig String -> String
   * @param {Array|String} list
   * @return {*}
   * @see R.tail, R.init, R.last
   * @example
   *
   *      R.head(['fi', 'fo', 'fum']); //=> 'fi'
   *      R.head([]); //=> undefined
   *
   *      R.head('abc'); //=> 'a'
   *      R.head(''); //=> ''
   */

  var head =
  /*#__PURE__*/
  nth$1(0);
  var head$1 = head;

  function _identity(x) {
    return x;
  }

  /**
   * A function that does nothing but return the parameter supplied to it. Good
   * as a default or placeholder function.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category Function
   * @sig a -> a
   * @param {*} x The value to return.
   * @return {*} The input value, `x`.
   * @example
   *
   *      R.identity(1); //=> 1
   *
   *      const obj = {};
   *      R.identity(obj) === obj; //=> true
   * @symb R.identity(a) = a
   */

  var identity =
  /*#__PURE__*/
  _curry1(_identity);

  var identity$1 = identity;

  /**
   * Performs left-to-right function composition using transforming function. The first argument may have
   * any arity; the remaining arguments must be unary.
   *
   * **Note:** The result of pipeWith is not automatically curried. Transforming function is not used on the
   * first argument.
   *
   * @func
   * @memberOf R
   * @since v0.26.0
   * @category Function
   * @sig ((* -> *), [((a, b, ..., n) -> o), (o -> p), ..., (x -> y), (y -> z)]) -> ((a, b, ..., n) -> z)
   * @param {...Function} functions
   * @return {Function}
   * @see R.composeWith, R.pipe
   * @example
   *
   *      const pipeWhileNotNil = R.pipeWith((f, res) => R.isNil(res) ? res : f(res));
   *      const f = pipeWhileNotNil([Math.pow, R.negate, R.inc])
   *
   *      f(3, 4); // -(3^4) + 1
   * @symb R.pipeWith(f)([g, h, i])(...args) = f(i, f(h, g(...args)))
   */

  var pipeWith =
  /*#__PURE__*/
  _curry2(function pipeWith(xf, list) {
    if (list.length <= 0) {
      return identity$1;
    }

    var headList = head$1(list);
    var tailList = tail$1(list);
    return _arity(headList.length, function () {
      return _reduce(function (result, f) {
        return xf.call(this, f, result);
      }, headList.apply(this, arguments), tailList);
    });
  });

  var pipeWith$1 = pipeWith;

  /**
   * Performs right-to-left function composition using transforming function. The last argument may have
   * any arity; the remaining arguments must be unary.
   *
   * **Note:** The result of compose is not automatically curried. Transforming function is not used on the
   * last argument.
   *
   * @func
   * @memberOf R
   * @since v0.26.0
   * @category Function
   * @sig ((* -> *), [(y -> z), (x -> y), ..., (o -> p), ((a, b, ..., n) -> o)]) -> ((a, b, ..., n) -> z)
   * @param {...Function} ...functions The functions to compose
   * @return {Function}
   * @see R.compose, R.pipeWith
   * @example
   *
   *      const composeWhileNotNil = R.composeWith((f, res) => R.isNil(res) ? res : f(res));
   *
   *      composeWhileNotNil([R.inc, R.prop('age')])({age: 1}) //=> 2
   *      composeWhileNotNil([R.inc, R.prop('age')])({}) //=> undefined
   *
   * @symb R.composeWith(f)([g, h, i])(...args) = f(g, f(h, i(...args)))
   */

  var composeWith =
  /*#__PURE__*/
  _curry2(function composeWith(xf, list) {
    return pipeWith$1.apply(this, [xf, reverse$1(list)]);
  });

  var composeWith$1 = composeWith;

  function _arrayFromIterator(iter) {
    var list = [];
    var next;

    while (!(next = iter.next()).done) {
      list.push(next.value);
    }

    return list;
  }

  function _includesWith(pred, x, list) {
    var idx = 0;
    var len = list.length;

    while (idx < len) {
      if (pred(x, list[idx])) {
        return true;
      }

      idx += 1;
    }

    return false;
  }

  function _functionName(f) {
    // String(x => x) evaluates to "x => x", so the pattern may not match.
    var match = String(f).match(/^function (\w*)/);
    return match == null ? '' : match[1];
  }

  // Based on https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is
  function _objectIs(a, b) {
    // SameValue algorithm
    if (a === b) {
      // Steps 1-5, 7-10
      // Steps 6.b-6.e: +0 != -0
      return a !== 0 || 1 / a === 1 / b;
    } else {
      // Step 6.a: NaN == NaN
      return a !== a && b !== b;
    }
  }

  var _objectIs$1 = typeof Object.is === 'function' ? Object.is : _objectIs;

  /**
   * private _uniqContentEquals function.
   * That function is checking equality of 2 iterator contents with 2 assumptions
   * - iterators lengths are the same
   * - iterators values are unique
   *
   * false-positive result will be returned for comparision of, e.g.
   * - [1,2,3] and [1,2,3,4]
   * - [1,1,1] and [1,2,3]
   * */

  function _uniqContentEquals(aIterator, bIterator, stackA, stackB) {
    var a = _arrayFromIterator(aIterator);

    var b = _arrayFromIterator(bIterator);

    function eq(_a, _b) {
      return _equals(_a, _b, stackA.slice(), stackB.slice());
    } // if *a* array contains any element that is not included in *b*


    return !_includesWith(function (b, aItem) {
      return !_includesWith(eq, aItem, b);
    }, b, a);
  }

  function _equals(a, b, stackA, stackB) {
    if (_objectIs$1(a, b)) {
      return true;
    }

    var typeA = type$1(a);

    if (typeA !== type$1(b)) {
      return false;
    }

    if (a == null || b == null) {
      return false;
    }

    if (typeof a['fantasy-land/equals'] === 'function' || typeof b['fantasy-land/equals'] === 'function') {
      return typeof a['fantasy-land/equals'] === 'function' && a['fantasy-land/equals'](b) && typeof b['fantasy-land/equals'] === 'function' && b['fantasy-land/equals'](a);
    }

    if (typeof a.equals === 'function' || typeof b.equals === 'function') {
      return typeof a.equals === 'function' && a.equals(b) && typeof b.equals === 'function' && b.equals(a);
    }

    switch (typeA) {
      case 'Arguments':
      case 'Array':
      case 'Object':
        if (typeof a.constructor === 'function' && _functionName(a.constructor) === 'Promise') {
          return a === b;
        }

        break;

      case 'Boolean':
      case 'Number':
      case 'String':
        if (!(typeof a === typeof b && _objectIs$1(a.valueOf(), b.valueOf()))) {
          return false;
        }

        break;

      case 'Date':
        if (!_objectIs$1(a.valueOf(), b.valueOf())) {
          return false;
        }

        break;

      case 'Error':
        return a.name === b.name && a.message === b.message;

      case 'RegExp':
        if (!(a.source === b.source && a.global === b.global && a.ignoreCase === b.ignoreCase && a.multiline === b.multiline && a.sticky === b.sticky && a.unicode === b.unicode)) {
          return false;
        }

        break;
    }

    var idx = stackA.length - 1;

    while (idx >= 0) {
      if (stackA[idx] === a) {
        return stackB[idx] === b;
      }

      idx -= 1;
    }

    switch (typeA) {
      case 'Map':
        if (a.size !== b.size) {
          return false;
        }

        return _uniqContentEquals(a.entries(), b.entries(), stackA.concat([a]), stackB.concat([b]));

      case 'Set':
        if (a.size !== b.size) {
          return false;
        }

        return _uniqContentEquals(a.values(), b.values(), stackA.concat([a]), stackB.concat([b]));

      case 'Arguments':
      case 'Array':
      case 'Object':
      case 'Boolean':
      case 'Number':
      case 'String':
      case 'Date':
      case 'Error':
      case 'RegExp':
      case 'Int8Array':
      case 'Uint8Array':
      case 'Uint8ClampedArray':
      case 'Int16Array':
      case 'Uint16Array':
      case 'Int32Array':
      case 'Uint32Array':
      case 'Float32Array':
      case 'Float64Array':
      case 'ArrayBuffer':
        break;

      default:
        // Values of other types are only equal if identical.
        return false;
    }

    var keysA = keys$2(a);

    if (keysA.length !== keys$2(b).length) {
      return false;
    }

    var extendedStackA = stackA.concat([a]);
    var extendedStackB = stackB.concat([b]);
    idx = keysA.length - 1;

    while (idx >= 0) {
      var key = keysA[idx];

      if (!(_has(key, b) && _equals(b[key], a[key], extendedStackA, extendedStackB))) {
        return false;
      }

      idx -= 1;
    }

    return true;
  }

  /**
   * Returns `true` if its arguments are equivalent, `false` otherwise. Handles
   * cyclical data structures.
   *
   * Dispatches symmetrically to the `equals` methods of both arguments, if
   * present.
   *
   * @func
   * @memberOf R
   * @since v0.15.0
   * @category Relation
   * @sig a -> b -> Boolean
   * @param {*} a
   * @param {*} b
   * @return {Boolean}
   * @example
   *
   *      R.equals(1, 1); //=> true
   *      R.equals(1, '1'); //=> false
   *      R.equals([1, 2, 3], [1, 2, 3]); //=> true
   *
   *      const a = {}; a.v = a;
   *      const b = {}; b.v = b;
   *      R.equals(a, b); //=> true
   */

  var equals =
  /*#__PURE__*/
  _curry2(function equals(a, b) {
    return _equals(a, b, [], []);
  });

  var equals$1 = equals;

  function _indexOf(list, a, idx) {
    var inf, item; // Array.prototype.indexOf doesn't exist below IE9

    if (typeof list.indexOf === 'function') {
      switch (typeof a) {
        case 'number':
          if (a === 0) {
            // manually crawl the list to distinguish between +0 and -0
            inf = 1 / a;

            while (idx < list.length) {
              item = list[idx];

              if (item === 0 && 1 / item === inf) {
                return idx;
              }

              idx += 1;
            }

            return -1;
          } else if (a !== a) {
            // NaN
            while (idx < list.length) {
              item = list[idx];

              if (typeof item === 'number' && item !== item) {
                return idx;
              }

              idx += 1;
            }

            return -1;
          } // non-zero numbers can utilise Set


          return list.indexOf(a, idx);
        // all these types can utilise Set

        case 'string':
        case 'boolean':
        case 'function':
        case 'undefined':
          return list.indexOf(a, idx);

        case 'object':
          if (a === null) {
            // null can utilise Set
            return list.indexOf(a, idx);
          }

      }
    } // anything else not covered above, defer to R.equals


    while (idx < list.length) {
      if (equals$1(list[idx], a)) {
        return idx;
      }

      idx += 1;
    }

    return -1;
  }

  function _includes(a, list) {
    return _indexOf(list, a, 0) >= 0;
  }

  function _quote(s) {
    var escaped = s.replace(/\\/g, '\\\\').replace(/[\b]/g, '\\b') // \b matches word boundary; [\b] matches backspace
    .replace(/\f/g, '\\f').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t').replace(/\v/g, '\\v').replace(/\0/g, '\\0');
    return '"' + escaped.replace(/"/g, '\\"') + '"';
  }

  /**
   * Polyfill from <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toISOString>.
   */
  var pad$1 = function pad(n) {
    return (n < 10 ? '0' : '') + n;
  };

  var _toISOString = typeof Date.prototype.toISOString === 'function' ? function _toISOString(d) {
    return d.toISOString();
  } : function _toISOString(d) {
    return d.getUTCFullYear() + '-' + pad$1(d.getUTCMonth() + 1) + '-' + pad$1(d.getUTCDate()) + 'T' + pad$1(d.getUTCHours()) + ':' + pad$1(d.getUTCMinutes()) + ':' + pad$1(d.getUTCSeconds()) + '.' + (d.getUTCMilliseconds() / 1000).toFixed(3).slice(2, 5) + 'Z';
  };

  var _toISOString$1 = _toISOString;

  function _complement(f) {
    return function () {
      return !f.apply(this, arguments);
    };
  }

  function _filter(fn, list) {
    var idx = 0;
    var len = list.length;
    var result = [];

    while (idx < len) {
      if (fn(list[idx])) {
        result[result.length] = list[idx];
      }

      idx += 1;
    }

    return result;
  }

  function _isObject(x) {
    return Object.prototype.toString.call(x) === '[object Object]';
  }

  var XFilter =
  /*#__PURE__*/
  function () {
    function XFilter(f, xf) {
      this.xf = xf;
      this.f = f;
    }

    XFilter.prototype['@@transducer/init'] = _xfBase.init;
    XFilter.prototype['@@transducer/result'] = _xfBase.result;

    XFilter.prototype['@@transducer/step'] = function (result, input) {
      return this.f(input) ? this.xf['@@transducer/step'](result, input) : result;
    };

    return XFilter;
  }();

  var _xfilter =
  /*#__PURE__*/
  _curry2(function _xfilter(f, xf) {
    return new XFilter(f, xf);
  });

  var _xfilter$1 = _xfilter;

  /**
   * Takes a predicate and a `Filterable`, and returns a new filterable of the
   * same type containing the members of the given filterable which satisfy the
   * given predicate. Filterable objects include plain objects or any object
   * that has a filter method such as `Array`.
   *
   * Dispatches to the `filter` method of the second argument, if present.
   *
   * Acts as a transducer if a transformer is given in list position.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category List
   * @sig Filterable f => (a -> Boolean) -> f a -> f a
   * @param {Function} pred
   * @param {Array} filterable
   * @return {Array} Filterable
   * @see R.reject, R.transduce, R.addIndex
   * @example
   *
   *      const isEven = n => n % 2 === 0;
   *
   *      R.filter(isEven, [1, 2, 3, 4]); //=> [2, 4]
   *
   *      R.filter(isEven, {a: 1, b: 2, c: 3, d: 4}); //=> {b: 2, d: 4}
   */

  var filter =
  /*#__PURE__*/
  _curry2(
  /*#__PURE__*/
  _dispatchable(['filter'], _xfilter$1, function (pred, filterable) {
    return _isObject(filterable) ? _reduce(function (acc, key) {
      if (pred(filterable[key])) {
        acc[key] = filterable[key];
      }

      return acc;
    }, {}, keys$2(filterable)) : // else
    _filter(pred, filterable);
  }));

  var filter$1 = filter;

  /**
   * The complement of [`filter`](#filter).
   *
   * Acts as a transducer if a transformer is given in list position. Filterable
   * objects include plain objects or any object that has a filter method such
   * as `Array`.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category List
   * @sig Filterable f => (a -> Boolean) -> f a -> f a
   * @param {Function} pred
   * @param {Array} filterable
   * @return {Array}
   * @see R.filter, R.transduce, R.addIndex
   * @example
   *
   *      const isOdd = (n) => n % 2 === 1;
   *
   *      R.reject(isOdd, [1, 2, 3, 4]); //=> [2, 4]
   *
   *      R.reject(isOdd, {a: 1, b: 2, c: 3, d: 4}); //=> {b: 2, d: 4}
   */

  var reject =
  /*#__PURE__*/
  _curry2(function reject(pred, filterable) {
    return filter$1(_complement(pred), filterable);
  });

  var reject$1 = reject;

  function _toString(x, seen) {
    var recur = function recur(y) {
      var xs = seen.concat([x]);
      return _includes(y, xs) ? '<Circular>' : _toString(y, xs);
    }; //  mapPairs :: (Object, [String]) -> [String]


    var mapPairs = function (obj, keys) {
      return _map(function (k) {
        return _quote(k) + ': ' + recur(obj[k]);
      }, keys.slice().sort());
    };

    switch (Object.prototype.toString.call(x)) {
      case '[object Arguments]':
        return '(function() { return arguments; }(' + _map(recur, x).join(', ') + '))';

      case '[object Array]':
        return '[' + _map(recur, x).concat(mapPairs(x, reject$1(function (k) {
          return /^\d+$/.test(k);
        }, keys$2(x)))).join(', ') + ']';

      case '[object Boolean]':
        return typeof x === 'object' ? 'new Boolean(' + recur(x.valueOf()) + ')' : x.toString();

      case '[object Date]':
        return 'new Date(' + (isNaN(x.valueOf()) ? recur(NaN) : _quote(_toISOString$1(x))) + ')';

      case '[object Null]':
        return 'null';

      case '[object Number]':
        return typeof x === 'object' ? 'new Number(' + recur(x.valueOf()) + ')' : 1 / x === -Infinity ? '-0' : x.toString(10);

      case '[object String]':
        return typeof x === 'object' ? 'new String(' + recur(x.valueOf()) + ')' : _quote(x);

      case '[object Undefined]':
        return 'undefined';

      default:
        if (typeof x.toString === 'function') {
          var repr = x.toString();

          if (repr !== '[object Object]') {
            return repr;
          }
        }

        return '{' + mapPairs(x, keys$2(x)).join(', ') + '}';
    }
  }

  /**
   * Returns the string representation of the given value. `eval`'ing the output
   * should result in a value equivalent to the input value. Many of the built-in
   * `toString` methods do not satisfy this requirement.
   *
   * If the given value is an `[object Object]` with a `toString` method other
   * than `Object.prototype.toString`, this method is invoked with no arguments
   * to produce the return value. This means user-defined constructor functions
   * can provide a suitable `toString` method. For example:
   *
   *     function Point(x, y) {
   *       this.x = x;
   *       this.y = y;
   *     }
   *
   *     Point.prototype.toString = function() {
   *       return 'new Point(' + this.x + ', ' + this.y + ')';
   *     };
   *
   *     R.toString(new Point(1, 2)); //=> 'new Point(1, 2)'
   *
   * @func
   * @memberOf R
   * @since v0.14.0
   * @category String
   * @sig * -> String
   * @param {*} val
   * @return {String}
   * @example
   *
   *      R.toString(42); //=> '42'
   *      R.toString('abc'); //=> '"abc"'
   *      R.toString([1, 2, 3]); //=> '[1, 2, 3]'
   *      R.toString({foo: 1, bar: 2, baz: 3}); //=> '{"bar": 2, "baz": 3, "foo": 1}'
   *      R.toString(new Date('2001-02-03T04:05:06Z')); //=> 'new Date("2001-02-03T04:05:06.000Z")'
   */

  var toString$1 =
  /*#__PURE__*/
  _curry1(function toString(val) {
    return _toString(val, []);
  });

  var toString$2 = toString$1;

  /**
   * Returns the result of concatenating the given lists or strings.
   *
   * Note: `R.concat` expects both arguments to be of the same type,
   * unlike the native `Array.prototype.concat` method. It will throw
   * an error if you `concat` an Array with a non-Array value.
   *
   * Dispatches to the `concat` method of the first argument, if present.
   * Can also concatenate two members of a [fantasy-land
   * compatible semigroup](https://github.com/fantasyland/fantasy-land#semigroup).
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category List
   * @sig [a] -> [a] -> [a]
   * @sig String -> String -> String
   * @param {Array|String} firstList The first list
   * @param {Array|String} secondList The second list
   * @return {Array|String} A list consisting of the elements of `firstList` followed by the elements of
   * `secondList`.
   *
   * @example
   *
   *      R.concat('ABC', 'DEF'); // 'ABCDEF'
   *      R.concat([4, 5, 6], [1, 2, 3]); //=> [4, 5, 6, 1, 2, 3]
   *      R.concat([], []); //=> []
   */

  var concat =
  /*#__PURE__*/
  _curry2(function concat(a, b) {
    if (_isArray(a)) {
      if (_isArray(b)) {
        return a.concat(b);
      }

      throw new TypeError(toString$2(b) + ' is not an array');
    }

    if (_isString(a)) {
      if (_isString(b)) {
        return a + b;
      }

      throw new TypeError(toString$2(b) + ' is not a string');
    }

    if (a != null && _isFunction(a['fantasy-land/concat'])) {
      return a['fantasy-land/concat'](b);
    }

    if (a != null && _isFunction(a.concat)) {
      return a.concat(b);
    }

    throw new TypeError(toString$2(a) + ' does not have a method named "concat" or "fantasy-land/concat"');
  });

  var concat$1 = concat;

  /**
   * Returns a function, `fn`, which encapsulates `if/else, if/else, ...` logic.
   * `R.cond` takes a list of [predicate, transformer] pairs. All of the arguments
   * to `fn` are applied to each of the predicates in turn until one returns a
   * "truthy" value, at which point `fn` returns the result of applying its
   * arguments to the corresponding transformer. If none of the predicates
   * matches, `fn` returns undefined.
   *
   * @func
   * @memberOf R
   * @since v0.6.0
   * @category Logic
   * @sig [[(*... -> Boolean),(*... -> *)]] -> (*... -> *)
   * @param {Array} pairs A list of [predicate, transformer]
   * @return {Function}
   * @see R.ifElse, R.unless, R.when
   * @example
   *
   *      const fn = R.cond([
   *        [R.equals(0),   R.always('water freezes at 0°C')],
   *        [R.equals(100), R.always('water boils at 100°C')],
   *        [R.T,           temp => 'nothing special happens at ' + temp + '°C']
   *      ]);
   *      fn(0); //=> 'water freezes at 0°C'
   *      fn(50); //=> 'nothing special happens at 50°C'
   *      fn(100); //=> 'water boils at 100°C'
   */

  var cond =
  /*#__PURE__*/
  _curry1(function cond(pairs) {
    var arity = reduce$1(max$1, 0, map$3(function (pair) {
      return pair[0].length;
    }, pairs));
    return _arity(arity, function () {
      var idx = 0;

      while (idx < pairs.length) {
        if (pairs[idx][0].apply(this, arguments)) {
          return pairs[idx][1].apply(this, arguments);
        }

        idx += 1;
      }
    });
  });

  var cond$1 = cond;

  /**
   * Wraps a constructor function inside a curried function that can be called
   * with the same arguments and returns the same type. The arity of the function
   * returned is specified to allow using variadic constructor functions.
   *
   * @func
   * @memberOf R
   * @since v0.4.0
   * @category Function
   * @sig Number -> (* -> {*}) -> (* -> {*})
   * @param {Number} n The arity of the constructor function.
   * @param {Function} Fn The constructor function to wrap.
   * @return {Function} A wrapped, curried constructor function.
   * @example
   *
   *      // Variadic Constructor function
   *      function Salad() {
   *        this.ingredients = arguments;
   *      }
   *
   *      Salad.prototype.recipe = function() {
   *        const instructions = R.map(ingredient => 'Add a dollop of ' + ingredient, this.ingredients);
   *        return R.join('\n', instructions);
   *      };
   *
   *      const ThreeLayerSalad = R.constructN(3, Salad);
   *
   *      // Notice we no longer need the 'new' keyword, and the constructor is curried for 3 arguments.
   *      const salad = ThreeLayerSalad('Mayonnaise')('Potato Chips')('Ketchup');
   *
   *      console.log(salad.recipe());
   *      // Add a dollop of Mayonnaise
   *      // Add a dollop of Potato Chips
   *      // Add a dollop of Ketchup
   */

  var constructN =
  /*#__PURE__*/
  _curry2(function constructN(n, Fn) {
    if (n > 10) {
      throw new Error('Constructor with greater than ten arguments');
    }

    if (n === 0) {
      return function () {
        return new Fn();
      };
    }

    return curry$5(nAry$1(n, function ($0, $1, $2, $3, $4, $5, $6, $7, $8, $9) {
      switch (arguments.length) {
        case 1:
          return new Fn($0);

        case 2:
          return new Fn($0, $1);

        case 3:
          return new Fn($0, $1, $2);

        case 4:
          return new Fn($0, $1, $2, $3);

        case 5:
          return new Fn($0, $1, $2, $3, $4);

        case 6:
          return new Fn($0, $1, $2, $3, $4, $5);

        case 7:
          return new Fn($0, $1, $2, $3, $4, $5, $6);

        case 8:
          return new Fn($0, $1, $2, $3, $4, $5, $6, $7);

        case 9:
          return new Fn($0, $1, $2, $3, $4, $5, $6, $7, $8);

        case 10:
          return new Fn($0, $1, $2, $3, $4, $5, $6, $7, $8, $9);
      }
    }));
  });

  var constructN$1 = constructN;

  /**
   * Wraps a constructor function inside a curried function that can be called
   * with the same arguments and returns the same type.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category Function
   * @sig (* -> {*}) -> (* -> {*})
   * @param {Function} fn The constructor function to wrap.
   * @return {Function} A wrapped, curried constructor function.
   * @see R.invoker
   * @example
   *
   *      // Constructor function
   *      function Animal(kind) {
   *        this.kind = kind;
   *      };
   *      Animal.prototype.sighting = function() {
   *        return "It's a " + this.kind + "!";
   *      }
   *
   *      const AnimalConstructor = R.construct(Animal)
   *
   *      // Notice we no longer need the 'new' keyword:
   *      AnimalConstructor('Pig'); //=> {"kind": "Pig", "sighting": function (){...}};
   *
   *      const animalTypes = ["Lion", "Tiger", "Bear"];
   *      const animalSighting = R.invoker(0, 'sighting');
   *      const sightNewAnimal = R.compose(animalSighting, AnimalConstructor);
   *      R.map(sightNewAnimal, animalTypes); //=> ["It's a Lion!", "It's a Tiger!", "It's a Bear!"]
   */

  var construct =
  /*#__PURE__*/
  _curry1(function construct(Fn) {
    return constructN$1(Fn.length, Fn);
  });

  var construct$1 = construct;

  /**
   * Returns `true` if the specified value is equal, in [`R.equals`](#equals)
   * terms, to at least one element of the given list; `false` otherwise.
   * Works also with strings.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category List
   * @sig a -> [a] -> Boolean
   * @param {Object} a The item to compare against.
   * @param {Array} list The array to consider.
   * @return {Boolean} `true` if an equivalent item is in the list, `false` otherwise.
   * @see R.includes
   * @deprecated since v0.26.0
   * @example
   *
   *      R.contains(3, [1, 2, 3]); //=> true
   *      R.contains(4, [1, 2, 3]); //=> false
   *      R.contains({ name: 'Fred' }, [{ name: 'Fred' }]); //=> true
   *      R.contains([42], [[42]]); //=> true
   *      R.contains('ba', 'banana'); //=>true
   */

  var contains =
  /*#__PURE__*/
  _curry2(_includes);

  var contains$1 = contains;

  /**
   * Accepts a converging function and a list of branching functions and returns
   * a new function. The arity of the new function is the same as the arity of
   * the longest branching function. When invoked, this new function is applied
   * to some arguments, and each branching function is applied to those same
   * arguments. The results of each branching function are passed as arguments
   * to the converging function to produce the return value.
   *
   * @func
   * @memberOf R
   * @since v0.4.2
   * @category Function
   * @sig ((x1, x2, ...) -> z) -> [((a, b, ...) -> x1), ((a, b, ...) -> x2), ...] -> (a -> b -> ... -> z)
   * @param {Function} after A function. `after` will be invoked with the return values of
   *        `fn1` and `fn2` as its arguments.
   * @param {Array} functions A list of functions.
   * @return {Function} A new function.
   * @see R.useWith
   * @example
   *
   *      const average = R.converge(R.divide, [R.sum, R.length])
   *      average([1, 2, 3, 4, 5, 6, 7]) //=> 4
   *
   *      const strangeConcat = R.converge(R.concat, [R.toUpper, R.toLower])
   *      strangeConcat("Yodel") //=> "YODELyodel"
   *
   * @symb R.converge(f, [g, h])(a, b) = f(g(a, b), h(a, b))
   */

  var converge =
  /*#__PURE__*/
  _curry2(function converge(after, fns) {
    return curryN$1(reduce$1(max$1, 0, pluck$1('length', fns)), function () {
      var args = arguments;
      var context = this;
      return after.apply(context, _map(function (fn) {
        return fn.apply(context, args);
      }, fns));
    });
  });

  var converge$1 = converge;

  var XReduceBy =
  /*#__PURE__*/
  function () {
    function XReduceBy(valueFn, valueAcc, keyFn, xf) {
      this.valueFn = valueFn;
      this.valueAcc = valueAcc;
      this.keyFn = keyFn;
      this.xf = xf;
      this.inputs = {};
    }

    XReduceBy.prototype['@@transducer/init'] = _xfBase.init;

    XReduceBy.prototype['@@transducer/result'] = function (result) {
      var key;

      for (key in this.inputs) {
        if (_has(key, this.inputs)) {
          result = this.xf['@@transducer/step'](result, this.inputs[key]);

          if (result['@@transducer/reduced']) {
            result = result['@@transducer/value'];
            break;
          }
        }
      }

      this.inputs = null;
      return this.xf['@@transducer/result'](result);
    };

    XReduceBy.prototype['@@transducer/step'] = function (result, input) {
      var key = this.keyFn(input);
      this.inputs[key] = this.inputs[key] || [key, this.valueAcc];
      this.inputs[key][1] = this.valueFn(this.inputs[key][1], input);
      return result;
    };

    return XReduceBy;
  }();

  var _xreduceBy =
  /*#__PURE__*/
  _curryN(4, [], function _xreduceBy(valueFn, valueAcc, keyFn, xf) {
    return new XReduceBy(valueFn, valueAcc, keyFn, xf);
  });

  var _xreduceBy$1 = _xreduceBy;

  /**
   * Groups the elements of the list according to the result of calling
   * the String-returning function `keyFn` on each element and reduces the elements
   * of each group to a single value via the reducer function `valueFn`.
   *
   * This function is basically a more general [`groupBy`](#groupBy) function.
   *
   * Acts as a transducer if a transformer is given in list position.
   *
   * @func
   * @memberOf R
   * @since v0.20.0
   * @category List
   * @sig ((a, b) -> a) -> a -> (b -> String) -> [b] -> {String: a}
   * @param {Function} valueFn The function that reduces the elements of each group to a single
   *        value. Receives two values, accumulator for a particular group and the current element.
   * @param {*} acc The (initial) accumulator value for each group.
   * @param {Function} keyFn The function that maps the list's element into a key.
   * @param {Array} list The array to group.
   * @return {Object} An object with the output of `keyFn` for keys, mapped to the output of
   *         `valueFn` for elements which produced that key when passed to `keyFn`.
   * @see R.groupBy, R.reduce
   * @example
   *
   *      const groupNames = (acc, {name}) => acc.concat(name)
   *      const toGrade = ({score}) =>
   *        score < 65 ? 'F' :
   *        score < 70 ? 'D' :
   *        score < 80 ? 'C' :
   *        score < 90 ? 'B' : 'A'
   *
   *      var students = [
   *        {name: 'Abby', score: 83},
   *        {name: 'Bart', score: 62},
   *        {name: 'Curt', score: 88},
   *        {name: 'Dora', score: 92},
   *      ]
   *
   *      reduceBy(groupNames, [], toGrade, students)
   *      //=> {"A": ["Dora"], "B": ["Abby", "Curt"], "F": ["Bart"]}
   */

  var reduceBy =
  /*#__PURE__*/
  _curryN(4, [],
  /*#__PURE__*/
  _dispatchable([], _xreduceBy$1, function reduceBy(valueFn, valueAcc, keyFn, list) {
    return _reduce(function (acc, elt) {
      var key = keyFn(elt);
      acc[key] = valueFn(_has(key, acc) ? acc[key] : _clone(valueAcc, [], [], false), elt);
      return acc;
    }, {}, list);
  }));

  var reduceBy$1 = reduceBy;

  /**
   * Counts the elements of a list according to how many match each value of a
   * key generated by the supplied function. Returns an object mapping the keys
   * produced by `fn` to the number of occurrences in the list. Note that all
   * keys are coerced to strings because of how JavaScript objects work.
   *
   * Acts as a transducer if a transformer is given in list position.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category Relation
   * @sig (a -> String) -> [a] -> {*}
   * @param {Function} fn The function used to map values to keys.
   * @param {Array} list The list to count elements from.
   * @return {Object} An object mapping keys to number of occurrences in the list.
   * @example
   *
   *      const numbers = [1.0, 1.1, 1.2, 2.0, 3.0, 2.2];
   *      R.countBy(Math.floor)(numbers);    //=> {'1': 3, '2': 2, '3': 1}
   *
   *      const letters = ['a', 'b', 'A', 'a', 'B', 'c'];
   *      R.countBy(R.toLower)(letters);   //=> {'a': 3, 'b': 2, 'c': 1}
   */

  var countBy =
  /*#__PURE__*/
  reduceBy$1(function (acc, elem) {
    return acc + 1;
  }, 0);
  var countBy$1 = countBy;

  /**
   * Decrements its argument.
   *
   * @func
   * @memberOf R
   * @since v0.9.0
   * @category Math
   * @sig Number -> Number
   * @param {Number} n
   * @return {Number} n - 1
   * @see R.inc
   * @example
   *
   *      R.dec(42); //=> 41
   */

  var dec =
  /*#__PURE__*/
  add$1(-1);
  var dec$1 = dec;

  /**
   * Returns the second argument if it is not `null`, `undefined` or `NaN`;
   * otherwise the first argument is returned.
   *
   * @func
   * @memberOf R
   * @since v0.10.0
   * @category Logic
   * @sig a -> b -> a | b
   * @param {a} default The default value.
   * @param {b} val `val` will be returned instead of `default` unless `val` is `null`, `undefined` or `NaN`.
   * @return {*} The second value if it is not `null`, `undefined` or `NaN`, otherwise the default value
   * @example
   *
   *      const defaultTo42 = R.defaultTo(42);
   *
   *      defaultTo42(null);  //=> 42
   *      defaultTo42(undefined);  //=> 42
   *      defaultTo42(false);  //=> false
   *      defaultTo42('Ramda');  //=> 'Ramda'
   *      // parseInt('string') results in NaN
   *      defaultTo42(parseInt('string')); //=> 42
   */

  var defaultTo =
  /*#__PURE__*/
  _curry2(function defaultTo(d, v) {
    return v == null || v !== v ? d : v;
  });

  var defaultTo$1 = defaultTo;

  /**
   * Makes a descending comparator function out of a function that returns a value
   * that can be compared with `<` and `>`.
   *
   * @func
   * @memberOf R
   * @since v0.23.0
   * @category Function
   * @sig Ord b => (a -> b) -> a -> a -> Number
   * @param {Function} fn A function of arity one that returns a value that can be compared
   * @param {*} a The first item to be compared.
   * @param {*} b The second item to be compared.
   * @return {Number} `-1` if fn(a) > fn(b), `1` if fn(b) > fn(a), otherwise `0`
   * @see R.ascend
   * @example
   *
   *      const byAge = R.descend(R.prop('age'));
   *      const people = [
   *        { name: 'Emma', age: 70 },
   *        { name: 'Peter', age: 78 },
   *        { name: 'Mikhail', age: 62 },
   *      ];
   *      const peopleByOldestFirst = R.sort(byAge, people);
   *        //=> [{ name: 'Peter', age: 78 }, { name: 'Emma', age: 70 }, { name: 'Mikhail', age: 62 }]
   */

  var descend =
  /*#__PURE__*/
  _curry3(function descend(fn, a, b) {
    var aa = fn(a);
    var bb = fn(b);
    return aa > bb ? -1 : aa < bb ? 1 : 0;
  });

  var descend$1 = descend;

  var _Set =
  /*#__PURE__*/
  function () {
    function _Set() {
      /* globals Set */
      this._nativeSet = typeof Set === 'function' ? new Set() : null;
      this._items = {};
    }

    // until we figure out why jsdoc chokes on this
    // @param item The item to add to the Set
    // @returns {boolean} true if the item did not exist prior, otherwise false
    //
    _Set.prototype.add = function (item) {
      return !hasOrAdd(item, true, this);
    }; //
    // @param item The item to check for existence in the Set
    // @returns {boolean} true if the item exists in the Set, otherwise false
    //


    _Set.prototype.has = function (item) {
      return hasOrAdd(item, false, this);
    }; //
    // Combines the logic for checking whether an item is a member of the set and
    // for adding a new item to the set.
    //
    // @param item       The item to check or add to the Set instance.
    // @param shouldAdd  If true, the item will be added to the set if it doesn't
    //                   already exist.
    // @param set        The set instance to check or add to.
    // @return {boolean} true if the item already existed, otherwise false.
    //


    return _Set;
  }();

  function hasOrAdd(item, shouldAdd, set) {
    var type = typeof item;
    var prevSize, newSize;

    switch (type) {
      case 'string':
      case 'number':
        // distinguish between +0 and -0
        if (item === 0 && 1 / item === -Infinity) {
          if (set._items['-0']) {
            return true;
          } else {
            if (shouldAdd) {
              set._items['-0'] = true;
            }

            return false;
          }
        } // these types can all utilise the native Set


        if (set._nativeSet !== null) {
          if (shouldAdd) {
            prevSize = set._nativeSet.size;

            set._nativeSet.add(item);

            newSize = set._nativeSet.size;
            return newSize === prevSize;
          } else {
            return set._nativeSet.has(item);
          }
        } else {
          if (!(type in set._items)) {
            if (shouldAdd) {
              set._items[type] = {};
              set._items[type][item] = true;
            }

            return false;
          } else if (item in set._items[type]) {
            return true;
          } else {
            if (shouldAdd) {
              set._items[type][item] = true;
            }

            return false;
          }
        }

      case 'boolean':
        // set._items['boolean'] holds a two element array
        // representing [ falseExists, trueExists ]
        if (type in set._items) {
          var bIdx = item ? 1 : 0;

          if (set._items[type][bIdx]) {
            return true;
          } else {
            if (shouldAdd) {
              set._items[type][bIdx] = true;
            }

            return false;
          }
        } else {
          if (shouldAdd) {
            set._items[type] = item ? [false, true] : [true, false];
          }

          return false;
        }

      case 'function':
        // compare functions for reference equality
        if (set._nativeSet !== null) {
          if (shouldAdd) {
            prevSize = set._nativeSet.size;

            set._nativeSet.add(item);

            newSize = set._nativeSet.size;
            return newSize === prevSize;
          } else {
            return set._nativeSet.has(item);
          }
        } else {
          if (!(type in set._items)) {
            if (shouldAdd) {
              set._items[type] = [item];
            }

            return false;
          }

          if (!_includes(item, set._items[type])) {
            if (shouldAdd) {
              set._items[type].push(item);
            }

            return false;
          }

          return true;
        }

      case 'undefined':
        if (set._items[type]) {
          return true;
        } else {
          if (shouldAdd) {
            set._items[type] = true;
          }

          return false;
        }

      case 'object':
        if (item === null) {
          if (!set._items['null']) {
            if (shouldAdd) {
              set._items['null'] = true;
            }

            return false;
          }

          return true;
        }

      /* falls through */

      default:
        // reduce the search size of heterogeneous sets by creating buckets
        // for each type.
        type = Object.prototype.toString.call(item);

        if (!(type in set._items)) {
          if (shouldAdd) {
            set._items[type] = [item];
          }

          return false;
        } // scan through all previously applied items


        if (!_includes(item, set._items[type])) {
          if (shouldAdd) {
            set._items[type].push(item);
          }

          return false;
        }

        return true;
    }
  } // A simple Set type that honours R.equals semantics


  var _Set$1 = _Set;

  /**
   * Finds the set (i.e. no duplicates) of all elements in the first list not
   * contained in the second list. Objects and Arrays are compared in terms of
   * value equality, not reference equality.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category Relation
   * @sig [*] -> [*] -> [*]
   * @param {Array} list1 The first list.
   * @param {Array} list2 The second list.
   * @return {Array} The elements in `list1` that are not in `list2`.
   * @see R.differenceWith, R.symmetricDifference, R.symmetricDifferenceWith, R.without
   * @example
   *
   *      R.difference([1,2,3,4], [7,6,5,4,3]); //=> [1,2]
   *      R.difference([7,6,5,4,3], [1,2,3,4]); //=> [7,6,5]
   *      R.difference([{a: 1}, {b: 2}], [{a: 1}, {c: 3}]) //=> [{b: 2}]
   */

  var difference$1 =
  /*#__PURE__*/
  _curry2(function difference(first, second) {
    var out = [];
    var idx = 0;
    var firstLen = first.length;
    var secondLen = second.length;
    var toFilterOut = new _Set$1();

    for (var i = 0; i < secondLen; i += 1) {
      toFilterOut.add(second[i]);
    }

    while (idx < firstLen) {
      if (toFilterOut.add(first[idx])) {
        out[out.length] = first[idx];
      }

      idx += 1;
    }

    return out;
  });

  var difference$2 = difference$1;

  /**
   * Finds the set (i.e. no duplicates) of all elements in the first list not
   * contained in the second list. Duplication is determined according to the
   * value returned by applying the supplied predicate to two list elements.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category Relation
   * @sig ((a, a) -> Boolean) -> [a] -> [a] -> [a]
   * @param {Function} pred A predicate used to test whether two items are equal.
   * @param {Array} list1 The first list.
   * @param {Array} list2 The second list.
   * @return {Array} The elements in `list1` that are not in `list2`.
   * @see R.difference, R.symmetricDifference, R.symmetricDifferenceWith
   * @example
   *
   *      const cmp = (x, y) => x.a === y.a;
   *      const l1 = [{a: 1}, {a: 2}, {a: 3}];
   *      const l2 = [{a: 3}, {a: 4}];
   *      R.differenceWith(cmp, l1, l2); //=> [{a: 1}, {a: 2}]
   */

  var differenceWith =
  /*#__PURE__*/
  _curry3(function differenceWith(pred, first, second) {
    var out = [];
    var idx = 0;
    var firstLen = first.length;

    while (idx < firstLen) {
      if (!_includesWith(pred, first[idx], second) && !_includesWith(pred, first[idx], out)) {
        out.push(first[idx]);
      }

      idx += 1;
    }

    return out;
  });

  var differenceWith$1 = differenceWith;

  /**
   * Returns a new object that does not contain a `prop` property.
   *
   * @func
   * @memberOf R
   * @since v0.10.0
   * @category Object
   * @sig String -> {k: v} -> {k: v}
   * @param {String} prop The name of the property to dissociate
   * @param {Object} obj The object to clone
   * @return {Object} A new object equivalent to the original but without the specified property
   * @see R.assoc, R.omit
   * @example
   *
   *      R.dissoc('b', {a: 1, b: 2, c: 3}); //=> {a: 1, c: 3}
   */

  var dissoc =
  /*#__PURE__*/
  _curry2(function dissoc(prop, obj) {
    var result = {};

    for (var p in obj) {
      result[p] = obj[p];
    }

    delete result[prop];
    return result;
  });

  var dissoc$1 = dissoc;

  /**
   * Removes the sub-list of `list` starting at index `start` and containing
   * `count` elements. _Note that this is not destructive_: it returns a copy of
   * the list with the changes.
   * <small>No lists have been harmed in the application of this function.</small>
   *
   * @func
   * @memberOf R
   * @since v0.2.2
   * @category List
   * @sig Number -> Number -> [a] -> [a]
   * @param {Number} start The position to start removing elements
   * @param {Number} count The number of elements to remove
   * @param {Array} list The list to remove from
   * @return {Array} A new Array with `count` elements from `start` removed.
   * @see R.without
   * @example
   *
   *      R.remove(2, 3, [1,2,3,4,5,6,7,8]); //=> [1,2,6,7,8]
   */

  var remove =
  /*#__PURE__*/
  _curry3(function remove(start, count, list) {
    var result = Array.prototype.slice.call(list, 0);
    result.splice(start, count);
    return result;
  });

  var remove$1 = remove;

  /**
   * Returns a new copy of the array with the element at the provided index
   * replaced with the given value.
   *
   * @func
   * @memberOf R
   * @since v0.14.0
   * @category List
   * @sig Number -> a -> [a] -> [a]
   * @param {Number} idx The index to update.
   * @param {*} x The value to exist at the given index of the returned array.
   * @param {Array|Arguments} list The source array-like object to be updated.
   * @return {Array} A copy of `list` with the value at index `idx` replaced with `x`.
   * @see R.adjust
   * @example
   *
   *      R.update(1, '_', ['a', 'b', 'c']);      //=> ['a', '_', 'c']
   *      R.update(-1, '_', ['a', 'b', 'c']);     //=> ['a', 'b', '_']
   * @symb R.update(-1, a, [b, c]) = [b, a]
   * @symb R.update(0, a, [b, c]) = [a, c]
   * @symb R.update(1, a, [b, c]) = [b, a]
   */

  var update =
  /*#__PURE__*/
  _curry3(function update(idx, x, list) {
    return adjust$1(idx, always$1(x), list);
  });

  var update$1 = update;

  /**
   * Makes a shallow clone of an object, omitting the property at the given path.
   * Note that this copies and flattens prototype properties onto the new object
   * as well. All non-primitive properties are copied by reference.
   *
   * @func
   * @memberOf R
   * @since v0.11.0
   * @category Object
   * @typedefn Idx = String | Int
   * @sig [Idx] -> {k: v} -> {k: v}
   * @param {Array} path The path to the value to omit
   * @param {Object} obj The object to clone
   * @return {Object} A new object without the property at path
   * @see R.assocPath
   * @example
   *
   *      R.dissocPath(['a', 'b', 'c'], {a: {b: {c: 42}}}); //=> {a: {b: {}}}
   */

  var dissocPath =
  /*#__PURE__*/
  _curry2(function dissocPath(path, obj) {
    switch (path.length) {
      case 0:
        return obj;

      case 1:
        return _isInteger(path[0]) && _isArray(obj) ? remove$1(path[0], 1, obj) : dissoc$1(path[0], obj);

      default:
        var head = path[0];
        var tail = Array.prototype.slice.call(path, 1);

        if (obj[head] == null) {
          return obj;
        } else if (_isInteger(head) && _isArray(obj)) {
          return update$1(head, dissocPath(tail, obj[head]), obj);
        } else {
          return assoc$1(head, dissocPath(tail, obj[head]), obj);
        }

    }
  });

  var dissocPath$1 = dissocPath;

  /**
   * Divides two numbers. Equivalent to `a / b`.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category Math
   * @sig Number -> Number -> Number
   * @param {Number} a The first value.
   * @param {Number} b The second value.
   * @return {Number} The result of `a / b`.
   * @see R.multiply
   * @example
   *
   *      R.divide(71, 100); //=> 0.71
   *
   *      const half = R.divide(R.__, 2);
   *      half(42); //=> 21
   *
   *      const reciprocal = R.divide(1);
   *      reciprocal(4);   //=> 0.25
   */

  var divide =
  /*#__PURE__*/
  _curry2(function divide(a, b) {
    return a / b;
  });

  var divide$1 = divide;

  var XDrop =
  /*#__PURE__*/
  function () {
    function XDrop(n, xf) {
      this.xf = xf;
      this.n = n;
    }

    XDrop.prototype['@@transducer/init'] = _xfBase.init;
    XDrop.prototype['@@transducer/result'] = _xfBase.result;

    XDrop.prototype['@@transducer/step'] = function (result, input) {
      if (this.n > 0) {
        this.n -= 1;
        return result;
      }

      return this.xf['@@transducer/step'](result, input);
    };

    return XDrop;
  }();

  var _xdrop =
  /*#__PURE__*/
  _curry2(function _xdrop(n, xf) {
    return new XDrop(n, xf);
  });

  var _xdrop$1 = _xdrop;

  /**
   * Returns all but the first `n` elements of the given list, string, or
   * transducer/transformer (or object with a `drop` method).
   *
   * Dispatches to the `drop` method of the second argument, if present.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category List
   * @sig Number -> [a] -> [a]
   * @sig Number -> String -> String
   * @param {Number} n
   * @param {*} list
   * @return {*} A copy of list without the first `n` elements
   * @see R.take, R.transduce, R.dropLast, R.dropWhile
   * @example
   *
   *      R.drop(1, ['foo', 'bar', 'baz']); //=> ['bar', 'baz']
   *      R.drop(2, ['foo', 'bar', 'baz']); //=> ['baz']
   *      R.drop(3, ['foo', 'bar', 'baz']); //=> []
   *      R.drop(4, ['foo', 'bar', 'baz']); //=> []
   *      R.drop(3, 'ramda');               //=> 'da'
   */

  var drop =
  /*#__PURE__*/
  _curry2(
  /*#__PURE__*/
  _dispatchable(['drop'], _xdrop$1, function drop(n, xs) {
    return slice$3(Math.max(0, n), Infinity, xs);
  }));

  var drop$1 = drop;

  var XTake =
  /*#__PURE__*/
  function () {
    function XTake(n, xf) {
      this.xf = xf;
      this.n = n;
      this.i = 0;
    }

    XTake.prototype['@@transducer/init'] = _xfBase.init;
    XTake.prototype['@@transducer/result'] = _xfBase.result;

    XTake.prototype['@@transducer/step'] = function (result, input) {
      this.i += 1;
      var ret = this.n === 0 ? result : this.xf['@@transducer/step'](result, input);
      return this.n >= 0 && this.i >= this.n ? _reduced(ret) : ret;
    };

    return XTake;
  }();

  var _xtake =
  /*#__PURE__*/
  _curry2(function _xtake(n, xf) {
    return new XTake(n, xf);
  });

  var _xtake$1 = _xtake;

  /**
   * Returns the first `n` elements of the given list, string, or
   * transducer/transformer (or object with a `take` method).
   *
   * Dispatches to the `take` method of the second argument, if present.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category List
   * @sig Number -> [a] -> [a]
   * @sig Number -> String -> String
   * @param {Number} n
   * @param {*} list
   * @return {*}
   * @see R.drop
   * @example
   *
   *      R.take(1, ['foo', 'bar', 'baz']); //=> ['foo']
   *      R.take(2, ['foo', 'bar', 'baz']); //=> ['foo', 'bar']
   *      R.take(3, ['foo', 'bar', 'baz']); //=> ['foo', 'bar', 'baz']
   *      R.take(4, ['foo', 'bar', 'baz']); //=> ['foo', 'bar', 'baz']
   *      R.take(3, 'ramda');               //=> 'ram'
   *
   *      const personnel = [
   *        'Dave Brubeck',
   *        'Paul Desmond',
   *        'Eugene Wright',
   *        'Joe Morello',
   *        'Gerry Mulligan',
   *        'Bob Bates',
   *        'Joe Dodge',
   *        'Ron Crotty'
   *      ];
   *
   *      const takeFive = R.take(5);
   *      takeFive(personnel);
   *      //=> ['Dave Brubeck', 'Paul Desmond', 'Eugene Wright', 'Joe Morello', 'Gerry Mulligan']
   * @symb R.take(-1, [a, b]) = [a, b]
   * @symb R.take(0, [a, b]) = []
   * @symb R.take(1, [a, b]) = [a]
   * @symb R.take(2, [a, b]) = [a, b]
   */

  var take =
  /*#__PURE__*/
  _curry2(
  /*#__PURE__*/
  _dispatchable(['take'], _xtake$1, function take(n, xs) {
    return slice$3(0, n < 0 ? Infinity : n, xs);
  }));

  var take$1 = take;

  function dropLast$3(n, xs) {
    return take$1(n < xs.length ? xs.length - n : 0, xs);
  }

  var XDropLast =
  /*#__PURE__*/
  function () {
    function XDropLast(n, xf) {
      this.xf = xf;
      this.pos = 0;
      this.full = false;
      this.acc = new Array(n);
    }

    XDropLast.prototype['@@transducer/init'] = _xfBase.init;

    XDropLast.prototype['@@transducer/result'] = function (result) {
      this.acc = null;
      return this.xf['@@transducer/result'](result);
    };

    XDropLast.prototype['@@transducer/step'] = function (result, input) {
      if (this.full) {
        result = this.xf['@@transducer/step'](result, this.acc[this.pos]);
      }

      this.store(input);
      return result;
    };

    XDropLast.prototype.store = function (input) {
      this.acc[this.pos] = input;
      this.pos += 1;

      if (this.pos === this.acc.length) {
        this.pos = 0;
        this.full = true;
      }
    };

    return XDropLast;
  }();

  var _xdropLast =
  /*#__PURE__*/
  _curry2(function _xdropLast(n, xf) {
    return new XDropLast(n, xf);
  });

  var _xdropLast$1 = _xdropLast;

  /**
   * Returns a list containing all but the last `n` elements of the given `list`.
   *
   * Acts as a transducer if a transformer is given in list position.
   *
   * @func
   * @memberOf R
   * @since v0.16.0
   * @category List
   * @sig Number -> [a] -> [a]
   * @sig Number -> String -> String
   * @param {Number} n The number of elements of `list` to skip.
   * @param {Array} list The list of elements to consider.
   * @return {Array} A copy of the list with only the first `list.length - n` elements
   * @see R.takeLast, R.drop, R.dropWhile, R.dropLastWhile
   * @example
   *
   *      R.dropLast(1, ['foo', 'bar', 'baz']); //=> ['foo', 'bar']
   *      R.dropLast(2, ['foo', 'bar', 'baz']); //=> ['foo']
   *      R.dropLast(3, ['foo', 'bar', 'baz']); //=> []
   *      R.dropLast(4, ['foo', 'bar', 'baz']); //=> []
   *      R.dropLast(3, 'ramda');               //=> 'ra'
   */

  var dropLast$1 =
  /*#__PURE__*/
  _curry2(
  /*#__PURE__*/
  _dispatchable([], _xdropLast$1, dropLast$3));

  var dropLast$2 = dropLast$1;

  function dropLastWhile$2(pred, xs) {
    var idx = xs.length - 1;

    while (idx >= 0 && pred(xs[idx])) {
      idx -= 1;
    }

    return slice$3(0, idx + 1, xs);
  }

  var XDropLastWhile =
  /*#__PURE__*/
  function () {
    function XDropLastWhile(fn, xf) {
      this.f = fn;
      this.retained = [];
      this.xf = xf;
    }

    XDropLastWhile.prototype['@@transducer/init'] = _xfBase.init;

    XDropLastWhile.prototype['@@transducer/result'] = function (result) {
      this.retained = null;
      return this.xf['@@transducer/result'](result);
    };

    XDropLastWhile.prototype['@@transducer/step'] = function (result, input) {
      return this.f(input) ? this.retain(result, input) : this.flush(result, input);
    };

    XDropLastWhile.prototype.flush = function (result, input) {
      result = _reduce(this.xf['@@transducer/step'], result, this.retained);
      this.retained = [];
      return this.xf['@@transducer/step'](result, input);
    };

    XDropLastWhile.prototype.retain = function (result, input) {
      this.retained.push(input);
      return result;
    };

    return XDropLastWhile;
  }();

  var _xdropLastWhile =
  /*#__PURE__*/
  _curry2(function _xdropLastWhile(fn, xf) {
    return new XDropLastWhile(fn, xf);
  });

  var _xdropLastWhile$1 = _xdropLastWhile;

  /**
   * Returns a new list excluding all the tailing elements of a given list which
   * satisfy the supplied predicate function. It passes each value from the right
   * to the supplied predicate function, skipping elements until the predicate
   * function returns a `falsy` value. The predicate function is applied to one argument:
   * *(value)*.
   *
   * Acts as a transducer if a transformer is given in list position.
   *
   * @func
   * @memberOf R
   * @since v0.16.0
   * @category List
   * @sig (a -> Boolean) -> [a] -> [a]
   * @sig (a -> Boolean) -> String -> String
   * @param {Function} predicate The function to be called on each element
   * @param {Array} xs The collection to iterate over.
   * @return {Array} A new array without any trailing elements that return `falsy` values from the `predicate`.
   * @see R.takeLastWhile, R.addIndex, R.drop, R.dropWhile
   * @example
   *
   *      const lteThree = x => x <= 3;
   *
   *      R.dropLastWhile(lteThree, [1, 2, 3, 4, 3, 2, 1]); //=> [1, 2, 3, 4]
   *
   *      R.dropLastWhile(x => x !== 'd' , 'Ramda'); //=> 'Ramd'
   */

  var dropLastWhile =
  /*#__PURE__*/
  _curry2(
  /*#__PURE__*/
  _dispatchable([], _xdropLastWhile$1, dropLastWhile$2));

  var dropLastWhile$1 = dropLastWhile;

  var XDropRepeatsWith =
  /*#__PURE__*/
  function () {
    function XDropRepeatsWith(pred, xf) {
      this.xf = xf;
      this.pred = pred;
      this.lastValue = undefined;
      this.seenFirstValue = false;
    }

    XDropRepeatsWith.prototype['@@transducer/init'] = _xfBase.init;
    XDropRepeatsWith.prototype['@@transducer/result'] = _xfBase.result;

    XDropRepeatsWith.prototype['@@transducer/step'] = function (result, input) {
      var sameAsLast = false;

      if (!this.seenFirstValue) {
        this.seenFirstValue = true;
      } else if (this.pred(this.lastValue, input)) {
        sameAsLast = true;
      }

      this.lastValue = input;
      return sameAsLast ? result : this.xf['@@transducer/step'](result, input);
    };

    return XDropRepeatsWith;
  }();

  var _xdropRepeatsWith =
  /*#__PURE__*/
  _curry2(function _xdropRepeatsWith(pred, xf) {
    return new XDropRepeatsWith(pred, xf);
  });

  var _xdropRepeatsWith$1 = _xdropRepeatsWith;

  /**
   * Returns the last element of the given list or string.
   *
   * @func
   * @memberOf R
   * @since v0.1.4
   * @category List
   * @sig [a] -> a | Undefined
   * @sig String -> String
   * @param {*} list
   * @return {*}
   * @see R.init, R.head, R.tail
   * @example
   *
   *      R.last(['fi', 'fo', 'fum']); //=> 'fum'
   *      R.last([]); //=> undefined
   *
   *      R.last('abc'); //=> 'c'
   *      R.last(''); //=> ''
   */

  var last =
  /*#__PURE__*/
  nth$1(-1);
  var last$1 = last;

  /**
   * Returns a new list without any consecutively repeating elements. Equality is
   * determined by applying the supplied predicate to each pair of consecutive elements. The
   * first element in a series of equal elements will be preserved.
   *
   * Acts as a transducer if a transformer is given in list position.
   *
   * @func
   * @memberOf R
   * @since v0.14.0
   * @category List
   * @sig ((a, a) -> Boolean) -> [a] -> [a]
   * @param {Function} pred A predicate used to test whether two items are equal.
   * @param {Array} list The array to consider.
   * @return {Array} `list` without repeating elements.
   * @see R.transduce
   * @example
   *
   *      const l = [1, -1, 1, 3, 4, -4, -4, -5, 5, 3, 3];
   *      R.dropRepeatsWith(R.eqBy(Math.abs), l); //=> [1, 3, 4, -5, 3]
   */

  var dropRepeatsWith =
  /*#__PURE__*/
  _curry2(
  /*#__PURE__*/
  _dispatchable([], _xdropRepeatsWith$1, function dropRepeatsWith(pred, list) {
    var result = [];
    var idx = 1;
    var len = list.length;

    if (len !== 0) {
      result[0] = list[0];

      while (idx < len) {
        if (!pred(last$1(result), list[idx])) {
          result[result.length] = list[idx];
        }

        idx += 1;
      }
    }

    return result;
  }));

  var dropRepeatsWith$1 = dropRepeatsWith;

  /**
   * Returns a new list without any consecutively repeating elements.
   * [`R.equals`](#equals) is used to determine equality.
   *
   * Acts as a transducer if a transformer is given in list position.
   *
   * @func
   * @memberOf R
   * @since v0.14.0
   * @category List
   * @sig [a] -> [a]
   * @param {Array} list The array to consider.
   * @return {Array} `list` without repeating elements.
   * @see R.transduce
   * @example
   *
   *     R.dropRepeats([1, 1, 1, 2, 3, 4, 4, 2, 2]); //=> [1, 2, 3, 4, 2]
   */

  var dropRepeats =
  /*#__PURE__*/
  _curry1(
  /*#__PURE__*/
  _dispatchable([],
  /*#__PURE__*/
  _xdropRepeatsWith$1(equals$1),
  /*#__PURE__*/
  dropRepeatsWith$1(equals$1)));

  var dropRepeats$1 = dropRepeats;

  var XDropWhile =
  /*#__PURE__*/
  function () {
    function XDropWhile(f, xf) {
      this.xf = xf;
      this.f = f;
    }

    XDropWhile.prototype['@@transducer/init'] = _xfBase.init;
    XDropWhile.prototype['@@transducer/result'] = _xfBase.result;

    XDropWhile.prototype['@@transducer/step'] = function (result, input) {
      if (this.f) {
        if (this.f(input)) {
          return result;
        }

        this.f = null;
      }

      return this.xf['@@transducer/step'](result, input);
    };

    return XDropWhile;
  }();

  var _xdropWhile =
  /*#__PURE__*/
  _curry2(function _xdropWhile(f, xf) {
    return new XDropWhile(f, xf);
  });

  var _xdropWhile$1 = _xdropWhile;

  /**
   * Returns a new list excluding the leading elements of a given list which
   * satisfy the supplied predicate function. It passes each value to the supplied
   * predicate function, skipping elements while the predicate function returns
   * `true`. The predicate function is applied to one argument: *(value)*.
   *
   * Dispatches to the `dropWhile` method of the second argument, if present.
   *
   * Acts as a transducer if a transformer is given in list position.
   *
   * @func
   * @memberOf R
   * @since v0.9.0
   * @category List
   * @sig (a -> Boolean) -> [a] -> [a]
   * @sig (a -> Boolean) -> String -> String
   * @param {Function} fn The function called per iteration.
   * @param {Array} xs The collection to iterate over.
   * @return {Array} A new array.
   * @see R.takeWhile, R.transduce, R.addIndex
   * @example
   *
   *      const lteTwo = x => x <= 2;
   *
   *      R.dropWhile(lteTwo, [1, 2, 3, 4, 3, 2, 1]); //=> [3, 4, 3, 2, 1]
   *
   *      R.dropWhile(x => x !== 'd' , 'Ramda'); //=> 'da'
   */

  var dropWhile =
  /*#__PURE__*/
  _curry2(
  /*#__PURE__*/
  _dispatchable(['dropWhile'], _xdropWhile$1, function dropWhile(pred, xs) {
    var idx = 0;
    var len = xs.length;

    while (idx < len && pred(xs[idx])) {
      idx += 1;
    }

    return slice$3(idx, Infinity, xs);
  }));

  var dropWhile$1 = dropWhile;

  /**
   * Returns `true` if one or both of its arguments are `true`. Returns `false`
   * if both arguments are `false`.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category Logic
   * @sig a -> b -> a | b
   * @param {Any} a
   * @param {Any} b
   * @return {Any} the first argument if truthy, otherwise the second argument.
   * @see R.either, R.xor
   * @example
   *
   *      R.or(true, true); //=> true
   *      R.or(true, false); //=> true
   *      R.or(false, true); //=> true
   *      R.or(false, false); //=> false
   */

  var or =
  /*#__PURE__*/
  _curry2(function or(a, b) {
    return a || b;
  });

  var or$1 = or;

  /**
   * A function wrapping calls to the two functions in an `||` operation,
   * returning the result of the first function if it is truth-y and the result
   * of the second function otherwise. Note that this is short-circuited,
   * meaning that the second function will not be invoked if the first returns a
   * truth-y value.
   *
   * In addition to functions, `R.either` also accepts any fantasy-land compatible
   * applicative functor.
   *
   * @func
   * @memberOf R
   * @since v0.12.0
   * @category Logic
   * @sig (*... -> Boolean) -> (*... -> Boolean) -> (*... -> Boolean)
   * @param {Function} f a predicate
   * @param {Function} g another predicate
   * @return {Function} a function that applies its arguments to `f` and `g` and `||`s their outputs together.
   * @see R.or
   * @example
   *
   *      const gt10 = x => x > 10;
   *      const even = x => x % 2 === 0;
   *      const f = R.either(gt10, even);
   *      f(101); //=> true
   *      f(8); //=> true
   *
   *      R.either(Maybe.Just(false), Maybe.Just(55)); // => Maybe.Just(55)
   *      R.either([false, false, 'a'], [11]) // => [11, 11, "a"]
   */

  var either =
  /*#__PURE__*/
  _curry2(function either(f, g) {
    return _isFunction(f) ? function _either() {
      return f.apply(this, arguments) || g.apply(this, arguments);
    } : lift$1(or$1)(f, g);
  });

  var either$1 = either;

  /**
   * Returns the empty value of its argument's type. Ramda defines the empty
   * value of Array (`[]`), Object (`{}`), String (`''`), and Arguments. Other
   * types are supported if they define `<Type>.empty`,
   * `<Type>.prototype.empty` or implement the
   * [FantasyLand Monoid spec](https://github.com/fantasyland/fantasy-land#monoid).
   *
   * Dispatches to the `empty` method of the first argument, if present.
   *
   * @func
   * @memberOf R
   * @since v0.3.0
   * @category Function
   * @sig a -> a
   * @param {*} x
   * @return {*}
   * @example
   *
   *      R.empty(Just(42));      //=> Nothing()
   *      R.empty([1, 2, 3]);     //=> []
   *      R.empty('unicorns');    //=> ''
   *      R.empty({x: 1, y: 2});  //=> {}
   */

  var empty =
  /*#__PURE__*/
  _curry1(function empty(x) {
    return x != null && typeof x['fantasy-land/empty'] === 'function' ? x['fantasy-land/empty']() : x != null && x.constructor != null && typeof x.constructor['fantasy-land/empty'] === 'function' ? x.constructor['fantasy-land/empty']() : x != null && typeof x.empty === 'function' ? x.empty() : x != null && x.constructor != null && typeof x.constructor.empty === 'function' ? x.constructor.empty() : _isArray(x) ? [] : _isString(x) ? '' : _isObject(x) ? {} : _isArguments$1(x) ? function () {
      return arguments;
    }() : void 0 // else
    ;
  });

  var empty$1 = empty;

  /**
   * Returns a new list containing the last `n` elements of the given list.
   * If `n > list.length`, returns a list of `list.length` elements.
   *
   * @func
   * @memberOf R
   * @since v0.16.0
   * @category List
   * @sig Number -> [a] -> [a]
   * @sig Number -> String -> String
   * @param {Number} n The number of elements to return.
   * @param {Array} xs The collection to consider.
   * @return {Array}
   * @see R.dropLast
   * @example
   *
   *      R.takeLast(1, ['foo', 'bar', 'baz']); //=> ['baz']
   *      R.takeLast(2, ['foo', 'bar', 'baz']); //=> ['bar', 'baz']
   *      R.takeLast(3, ['foo', 'bar', 'baz']); //=> ['foo', 'bar', 'baz']
   *      R.takeLast(4, ['foo', 'bar', 'baz']); //=> ['foo', 'bar', 'baz']
   *      R.takeLast(3, 'ramda');               //=> 'mda'
   */

  var takeLast$1 =
  /*#__PURE__*/
  _curry2(function takeLast(n, xs) {
    return drop$1(n >= 0 ? xs.length - n : 0, xs);
  });

  var takeLast$2 = takeLast$1;

  /**
   * Checks if a list ends with the provided sublist.
   *
   * Similarly, checks if a string ends with the provided substring.
   *
   * @func
   * @memberOf R
   * @since v0.24.0
   * @category List
   * @sig [a] -> [a] -> Boolean
   * @sig String -> String -> Boolean
   * @param {*} suffix
   * @param {*} list
   * @return {Boolean}
   * @see R.startsWith
   * @example
   *
   *      R.endsWith('c', 'abc')                //=> true
   *      R.endsWith('b', 'abc')                //=> false
   *      R.endsWith(['c'], ['a', 'b', 'c'])    //=> true
   *      R.endsWith(['b'], ['a', 'b', 'c'])    //=> false
   */

  var endsWith =
  /*#__PURE__*/
  _curry2(function (suffix, list) {
    return equals$1(takeLast$2(suffix.length, list), suffix);
  });

  var endsWith$1 = endsWith;

  /**
   * Takes a function and two values in its domain and returns `true` if the
   * values map to the same value in the codomain; `false` otherwise.
   *
   * @func
   * @memberOf R
   * @since v0.18.0
   * @category Relation
   * @sig (a -> b) -> a -> a -> Boolean
   * @param {Function} f
   * @param {*} x
   * @param {*} y
   * @return {Boolean}
   * @example
   *
   *      R.eqBy(Math.abs, 5, -5); //=> true
   */

  var eqBy =
  /*#__PURE__*/
  _curry3(function eqBy(f, x, y) {
    return equals$1(f(x), f(y));
  });

  var eqBy$1 = eqBy;

  /**
   * Reports whether two objects have the same value, in [`R.equals`](#equals)
   * terms, for the specified property. Useful as a curried predicate.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category Object
   * @sig k -> {k: v} -> {k: v} -> Boolean
   * @param {String} prop The name of the property to compare
   * @param {Object} obj1
   * @param {Object} obj2
   * @return {Boolean}
   *
   * @example
   *
   *      const o1 = { a: 1, b: 2, c: 3, d: 4 };
   *      const o2 = { a: 10, b: 20, c: 3, d: 40 };
   *      R.eqProps('a', o1, o2); //=> false
   *      R.eqProps('c', o1, o2); //=> true
   */

  var eqProps =
  /*#__PURE__*/
  _curry3(function eqProps(prop, obj1, obj2) {
    return equals$1(obj1[prop], obj2[prop]);
  });

  var eqProps$1 = eqProps;

  /**
   * Creates a new object by recursively evolving a shallow copy of `object`,
   * according to the `transformation` functions. All non-primitive properties
   * are copied by reference.
   *
   * A `transformation` function will not be invoked if its corresponding key
   * does not exist in the evolved object.
   *
   * @func
   * @memberOf R
   * @since v0.9.0
   * @category Object
   * @sig {k: (v -> v)} -> {k: v} -> {k: v}
   * @param {Object} transformations The object specifying transformation functions to apply
   *        to the object.
   * @param {Object} object The object to be transformed.
   * @return {Object} The transformed object.
   * @example
   *
   *      const tomato = {firstName: '  Tomato ', data: {elapsed: 100, remaining: 1400}, id:123};
   *      const transformations = {
   *        firstName: R.trim,
   *        lastName: R.trim, // Will not get invoked.
   *        data: {elapsed: R.add(1), remaining: R.add(-1)}
   *      };
   *      R.evolve(transformations, tomato); //=> {firstName: 'Tomato', data: {elapsed: 101, remaining: 1399}, id:123}
   */

  var evolve =
  /*#__PURE__*/
  _curry2(function evolve(transformations, object) {
    var result = object instanceof Array ? [] : {};
    var transformation, key, type;

    for (key in object) {
      transformation = transformations[key];
      type = typeof transformation;
      result[key] = type === 'function' ? transformation(object[key]) : transformation && type === 'object' ? evolve(transformation, object[key]) : object[key];
    }

    return result;
  });

  var evolve$1 = evolve;

  var XFind =
  /*#__PURE__*/
  function () {
    function XFind(f, xf) {
      this.xf = xf;
      this.f = f;
      this.found = false;
    }

    XFind.prototype['@@transducer/init'] = _xfBase.init;

    XFind.prototype['@@transducer/result'] = function (result) {
      if (!this.found) {
        result = this.xf['@@transducer/step'](result, void 0);
      }

      return this.xf['@@transducer/result'](result);
    };

    XFind.prototype['@@transducer/step'] = function (result, input) {
      if (this.f(input)) {
        this.found = true;
        result = _reduced(this.xf['@@transducer/step'](result, input));
      }

      return result;
    };

    return XFind;
  }();

  var _xfind =
  /*#__PURE__*/
  _curry2(function _xfind(f, xf) {
    return new XFind(f, xf);
  });

  var _xfind$1 = _xfind;

  /**
   * Returns the first element of the list which matches the predicate, or
   * `undefined` if no element matches.
   *
   * Dispatches to the `find` method of the second argument, if present.
   *
   * Acts as a transducer if a transformer is given in list position.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category List
   * @sig (a -> Boolean) -> [a] -> a | undefined
   * @param {Function} fn The predicate function used to determine if the element is the
   *        desired one.
   * @param {Array} list The array to consider.
   * @return {Object} The element found, or `undefined`.
   * @see R.transduce
   * @example
   *
   *      const xs = [{a: 1}, {a: 2}, {a: 3}];
   *      R.find(R.propEq('a', 2))(xs); //=> {a: 2}
   *      R.find(R.propEq('a', 4))(xs); //=> undefined
   */

  var find =
  /*#__PURE__*/
  _curry2(
  /*#__PURE__*/
  _dispatchable(['find'], _xfind$1, function find(fn, list) {
    var idx = 0;
    var len = list.length;

    while (idx < len) {
      if (fn(list[idx])) {
        return list[idx];
      }

      idx += 1;
    }
  }));

  var find$1 = find;

  var XFindIndex =
  /*#__PURE__*/
  function () {
    function XFindIndex(f, xf) {
      this.xf = xf;
      this.f = f;
      this.idx = -1;
      this.found = false;
    }

    XFindIndex.prototype['@@transducer/init'] = _xfBase.init;

    XFindIndex.prototype['@@transducer/result'] = function (result) {
      if (!this.found) {
        result = this.xf['@@transducer/step'](result, -1);
      }

      return this.xf['@@transducer/result'](result);
    };

    XFindIndex.prototype['@@transducer/step'] = function (result, input) {
      this.idx += 1;

      if (this.f(input)) {
        this.found = true;
        result = _reduced(this.xf['@@transducer/step'](result, this.idx));
      }

      return result;
    };

    return XFindIndex;
  }();

  var _xfindIndex =
  /*#__PURE__*/
  _curry2(function _xfindIndex(f, xf) {
    return new XFindIndex(f, xf);
  });

  var _xfindIndex$1 = _xfindIndex;

  /**
   * Returns the index of the first element of the list which matches the
   * predicate, or `-1` if no element matches.
   *
   * Acts as a transducer if a transformer is given in list position.
   *
   * @func
   * @memberOf R
   * @since v0.1.1
   * @category List
   * @sig (a -> Boolean) -> [a] -> Number
   * @param {Function} fn The predicate function used to determine if the element is the
   * desired one.
   * @param {Array} list The array to consider.
   * @return {Number} The index of the element found, or `-1`.
   * @see R.transduce
   * @example
   *
   *      const xs = [{a: 1}, {a: 2}, {a: 3}];
   *      R.findIndex(R.propEq('a', 2))(xs); //=> 1
   *      R.findIndex(R.propEq('a', 4))(xs); //=> -1
   */

  var findIndex =
  /*#__PURE__*/
  _curry2(
  /*#__PURE__*/
  _dispatchable([], _xfindIndex$1, function findIndex(fn, list) {
    var idx = 0;
    var len = list.length;

    while (idx < len) {
      if (fn(list[idx])) {
        return idx;
      }

      idx += 1;
    }

    return -1;
  }));

  var findIndex$1 = findIndex;

  var XFindLast =
  /*#__PURE__*/
  function () {
    function XFindLast(f, xf) {
      this.xf = xf;
      this.f = f;
    }

    XFindLast.prototype['@@transducer/init'] = _xfBase.init;

    XFindLast.prototype['@@transducer/result'] = function (result) {
      return this.xf['@@transducer/result'](this.xf['@@transducer/step'](result, this.last));
    };

    XFindLast.prototype['@@transducer/step'] = function (result, input) {
      if (this.f(input)) {
        this.last = input;
      }

      return result;
    };

    return XFindLast;
  }();

  var _xfindLast =
  /*#__PURE__*/
  _curry2(function _xfindLast(f, xf) {
    return new XFindLast(f, xf);
  });

  var _xfindLast$1 = _xfindLast;

  /**
   * Returns the last element of the list which matches the predicate, or
   * `undefined` if no element matches.
   *
   * Acts as a transducer if a transformer is given in list position.
   *
   * @func
   * @memberOf R
   * @since v0.1.1
   * @category List
   * @sig (a -> Boolean) -> [a] -> a | undefined
   * @param {Function} fn The predicate function used to determine if the element is the
   * desired one.
   * @param {Array} list The array to consider.
   * @return {Object} The element found, or `undefined`.
   * @see R.transduce
   * @example
   *
   *      const xs = [{a: 1, b: 0}, {a:1, b: 1}];
   *      R.findLast(R.propEq('a', 1))(xs); //=> {a: 1, b: 1}
   *      R.findLast(R.propEq('a', 4))(xs); //=> undefined
   */

  var findLast =
  /*#__PURE__*/
  _curry2(
  /*#__PURE__*/
  _dispatchable([], _xfindLast$1, function findLast(fn, list) {
    var idx = list.length - 1;

    while (idx >= 0) {
      if (fn(list[idx])) {
        return list[idx];
      }

      idx -= 1;
    }
  }));

  var findLast$1 = findLast;

  var XFindLastIndex =
  /*#__PURE__*/
  function () {
    function XFindLastIndex(f, xf) {
      this.xf = xf;
      this.f = f;
      this.idx = -1;
      this.lastIdx = -1;
    }

    XFindLastIndex.prototype['@@transducer/init'] = _xfBase.init;

    XFindLastIndex.prototype['@@transducer/result'] = function (result) {
      return this.xf['@@transducer/result'](this.xf['@@transducer/step'](result, this.lastIdx));
    };

    XFindLastIndex.prototype['@@transducer/step'] = function (result, input) {
      this.idx += 1;

      if (this.f(input)) {
        this.lastIdx = this.idx;
      }

      return result;
    };

    return XFindLastIndex;
  }();

  var _xfindLastIndex =
  /*#__PURE__*/
  _curry2(function _xfindLastIndex(f, xf) {
    return new XFindLastIndex(f, xf);
  });

  var _xfindLastIndex$1 = _xfindLastIndex;

  /**
   * Returns the index of the last element of the list which matches the
   * predicate, or `-1` if no element matches.
   *
   * Acts as a transducer if a transformer is given in list position.
   *
   * @func
   * @memberOf R
   * @since v0.1.1
   * @category List
   * @sig (a -> Boolean) -> [a] -> Number
   * @param {Function} fn The predicate function used to determine if the element is the
   * desired one.
   * @param {Array} list The array to consider.
   * @return {Number} The index of the element found, or `-1`.
   * @see R.transduce
   * @example
   *
   *      const xs = [{a: 1, b: 0}, {a:1, b: 1}];
   *      R.findLastIndex(R.propEq('a', 1))(xs); //=> 1
   *      R.findLastIndex(R.propEq('a', 4))(xs); //=> -1
   */

  var findLastIndex =
  /*#__PURE__*/
  _curry2(
  /*#__PURE__*/
  _dispatchable([], _xfindLastIndex$1, function findLastIndex(fn, list) {
    var idx = list.length - 1;

    while (idx >= 0) {
      if (fn(list[idx])) {
        return idx;
      }

      idx -= 1;
    }

    return -1;
  }));

  var findLastIndex$1 = findLastIndex;

  /**
   * Returns a new list by pulling every item out of it (and all its sub-arrays)
   * and putting them in a new array, depth-first.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category List
   * @sig [a] -> [b]
   * @param {Array} list The array to consider.
   * @return {Array} The flattened list.
   * @see R.unnest
   * @example
   *
   *      R.flatten([1, 2, [3, 4], 5, [6, [7, 8, [9, [10, 11], 12]]]]);
   *      //=> [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
   */

  var flatten =
  /*#__PURE__*/
  _curry1(
  /*#__PURE__*/
  _makeFlat(true));

  var flatten$1 = flatten;

  /**
   * Returns a new function much like the supplied one, except that the first two
   * arguments' order is reversed.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category Function
   * @sig ((a, b, c, ...) -> z) -> (b -> a -> c -> ... -> z)
   * @param {Function} fn The function to invoke with its first two parameters reversed.
   * @return {*} The result of invoking `fn` with its first two parameters' order reversed.
   * @example
   *
   *      const mergeThree = (a, b, c) => [].concat(a, b, c);
   *
   *      mergeThree(1, 2, 3); //=> [1, 2, 3]
   *
   *      R.flip(mergeThree)(1, 2, 3); //=> [2, 1, 3]
   * @symb R.flip(f)(a, b, c) = f(b, a, c)
   */

  var flip$1 =
  /*#__PURE__*/
  _curry1(function flip(fn) {
    return curryN$1(fn.length, function (a, b) {
      var args = Array.prototype.slice.call(arguments, 0);
      args[0] = b;
      args[1] = a;
      return fn.apply(this, args);
    });
  });

  var flip$2 = flip$1;

  /**
   * Iterate over an input `list`, calling a provided function `fn` for each
   * element in the list.
   *
   * `fn` receives one argument: *(value)*.
   *
   * Note: `R.forEach` does not skip deleted or unassigned indices (sparse
   * arrays), unlike the native `Array.prototype.forEach` method. For more
   * details on this behavior, see:
   * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach#Description
   *
   * Also note that, unlike `Array.prototype.forEach`, Ramda's `forEach` returns
   * the original array. In some libraries this function is named `each`.
   *
   * Dispatches to the `forEach` method of the second argument, if present.
   *
   * @func
   * @memberOf R
   * @since v0.1.1
   * @category List
   * @sig (a -> *) -> [a] -> [a]
   * @param {Function} fn The function to invoke. Receives one argument, `value`.
   * @param {Array} list The list to iterate over.
   * @return {Array} The original list.
   * @see R.addIndex
   * @example
   *
   *      const printXPlusFive = x => console.log(x + 5);
   *      R.forEach(printXPlusFive, [1, 2, 3]); //=> [1, 2, 3]
   *      // logs 6
   *      // logs 7
   *      // logs 8
   * @symb R.forEach(f, [a, b, c]) = [a, b, c]
   */

  var forEach$1 =
  /*#__PURE__*/
  _curry2(
  /*#__PURE__*/
  _checkForMethod('forEach', function forEach(fn, list) {
    var len = list.length;
    var idx = 0;

    while (idx < len) {
      fn(list[idx]);
      idx += 1;
    }

    return list;
  }));

  var forEach$2 = forEach$1;

  /**
   * Iterate over an input `object`, calling a provided function `fn` for each
   * key and value in the object.
   *
   * `fn` receives three argument: *(value, key, obj)*.
   *
   * @func
   * @memberOf R
   * @since v0.23.0
   * @category Object
   * @sig ((a, String, StrMap a) -> Any) -> StrMap a -> StrMap a
   * @param {Function} fn The function to invoke. Receives three argument, `value`, `key`, `obj`.
   * @param {Object} obj The object to iterate over.
   * @return {Object} The original object.
   * @example
   *
   *      const printKeyConcatValue = (value, key) => console.log(key + ':' + value);
   *      R.forEachObjIndexed(printKeyConcatValue, {x: 1, y: 2}); //=> {x: 1, y: 2}
   *      // logs x:1
   *      // logs y:2
   * @symb R.forEachObjIndexed(f, {x: a, y: b}) = {x: a, y: b}
   */

  var forEachObjIndexed =
  /*#__PURE__*/
  _curry2(function forEachObjIndexed(fn, obj) {
    var keyList = keys$2(obj);
    var idx = 0;

    while (idx < keyList.length) {
      var key = keyList[idx];
      fn(obj[key], key, obj);
      idx += 1;
    }

    return obj;
  });

  var forEachObjIndexed$1 = forEachObjIndexed;

  /**
   * Creates a new object from a list key-value pairs. If a key appears in
   * multiple pairs, the rightmost pair is included in the object.
   *
   * @func
   * @memberOf R
   * @since v0.3.0
   * @category List
   * @sig [[k,v]] -> {k: v}
   * @param {Array} pairs An array of two-element arrays that will be the keys and values of the output object.
   * @return {Object} The object made by pairing up `keys` and `values`.
   * @see R.toPairs, R.pair
   * @example
   *
   *      R.fromPairs([['a', 1], ['b', 2], ['c', 3]]); //=> {a: 1, b: 2, c: 3}
   */

  var fromPairs =
  /*#__PURE__*/
  _curry1(function fromPairs(pairs) {
    var result = {};
    var idx = 0;

    while (idx < pairs.length) {
      result[pairs[idx][0]] = pairs[idx][1];
      idx += 1;
    }

    return result;
  });

  var fromPairs$1 = fromPairs;

  /**
   * Splits a list into sub-lists stored in an object, based on the result of
   * calling a String-returning function on each element, and grouping the
   * results according to values returned.
   *
   * Dispatches to the `groupBy` method of the second argument, if present.
   *
   * Acts as a transducer if a transformer is given in list position.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category List
   * @sig (a -> String) -> [a] -> {String: [a]}
   * @param {Function} fn Function :: a -> String
   * @param {Array} list The array to group
   * @return {Object} An object with the output of `fn` for keys, mapped to arrays of elements
   *         that produced that key when passed to `fn`.
   * @see R.reduceBy, R.transduce
   * @example
   *
   *      const byGrade = R.groupBy(function(student) {
   *        const score = student.score;
   *        return score < 65 ? 'F' :
   *               score < 70 ? 'D' :
   *               score < 80 ? 'C' :
   *               score < 90 ? 'B' : 'A';
   *      });
   *      const students = [{name: 'Abby', score: 84},
   *                      {name: 'Eddy', score: 58},
   *                      // ...
   *                      {name: 'Jack', score: 69}];
   *      byGrade(students);
   *      // {
   *      //   'A': [{name: 'Dianne', score: 99}],
   *      //   'B': [{name: 'Abby', score: 84}]
   *      //   // ...,
   *      //   'F': [{name: 'Eddy', score: 58}]
   *      // }
   */

  var groupBy =
  /*#__PURE__*/
  _curry2(
  /*#__PURE__*/
  _checkForMethod('groupBy',
  /*#__PURE__*/
  reduceBy$1(function (acc, item) {
    if (acc == null) {
      acc = [];
    }

    acc.push(item);
    return acc;
  }, null)));

  var groupBy$1 = groupBy;

  /**
   * Takes a list and returns a list of lists where each sublist's elements are
   * all satisfied pairwise comparison according to the provided function.
   * Only adjacent elements are passed to the comparison function.
   *
   * @func
   * @memberOf R
   * @since v0.21.0
   * @category List
   * @sig ((a, a) → Boolean) → [a] → [[a]]
   * @param {Function} fn Function for determining whether two given (adjacent)
   *        elements should be in the same group
   * @param {Array} list The array to group. Also accepts a string, which will be
   *        treated as a list of characters.
   * @return {List} A list that contains sublists of elements,
   *         whose concatenations are equal to the original list.
   * @example
   *
   * R.groupWith(R.equals, [0, 1, 1, 2, 3, 5, 8, 13, 21])
   * //=> [[0], [1, 1], [2], [3], [5], [8], [13], [21]]
   *
   * R.groupWith((a, b) => a + 1 === b, [0, 1, 1, 2, 3, 5, 8, 13, 21])
   * //=> [[0, 1], [1, 2, 3], [5], [8], [13], [21]]
   *
   * R.groupWith((a, b) => a % 2 === b % 2, [0, 1, 1, 2, 3, 5, 8, 13, 21])
   * //=> [[0], [1, 1], [2], [3, 5], [8], [13, 21]]
   *
   * R.groupWith(R.eqBy(isVowel), 'aestiou')
   * //=> ['ae', 'st', 'iou']
   */

  var groupWith =
  /*#__PURE__*/
  _curry2(function (fn, list) {
    var res = [];
    var idx = 0;
    var len = list.length;

    while (idx < len) {
      var nextidx = idx + 1;

      while (nextidx < len && fn(list[nextidx - 1], list[nextidx])) {
        nextidx += 1;
      }

      res.push(list.slice(idx, nextidx));
      idx = nextidx;
    }

    return res;
  });

  var groupWith$1 = groupWith;

  /**
   * Returns `true` if the first argument is greater than the second; `false`
   * otherwise.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category Relation
   * @sig Ord a => a -> a -> Boolean
   * @param {*} a
   * @param {*} b
   * @return {Boolean}
   * @see R.lt
   * @example
   *
   *      R.gt(2, 1); //=> true
   *      R.gt(2, 2); //=> false
   *      R.gt(2, 3); //=> false
   *      R.gt('a', 'z'); //=> false
   *      R.gt('z', 'a'); //=> true
   */

  var gt =
  /*#__PURE__*/
  _curry2(function gt(a, b) {
    return a > b;
  });

  var gt$1 = gt;

  /**
   * Returns `true` if the first argument is greater than or equal to the second;
   * `false` otherwise.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category Relation
   * @sig Ord a => a -> a -> Boolean
   * @param {Number} a
   * @param {Number} b
   * @return {Boolean}
   * @see R.lte
   * @example
   *
   *      R.gte(2, 1); //=> true
   *      R.gte(2, 2); //=> true
   *      R.gte(2, 3); //=> false
   *      R.gte('a', 'z'); //=> false
   *      R.gte('z', 'a'); //=> true
   */

  var gte =
  /*#__PURE__*/
  _curry2(function gte(a, b) {
    return a >= b;
  });

  var gte$1 = gte;

  /**
   * Returns whether or not a path exists in an object. Only the object's
   * own properties are checked.
   *
   * @func
   * @memberOf R
   * @since v0.26.0
   * @category Object
   * @typedefn Idx = String | Int
   * @sig [Idx] -> {a} -> Boolean
   * @param {Array} path The path to use.
   * @param {Object} obj The object to check the path in.
   * @return {Boolean} Whether the path exists.
   * @see R.has
   * @example
   *
   *      R.hasPath(['a', 'b'], {a: {b: 2}});         // => true
   *      R.hasPath(['a', 'b'], {a: {b: undefined}}); // => true
   *      R.hasPath(['a', 'b'], {a: {c: 2}});         // => false
   *      R.hasPath(['a', 'b'], {});                  // => false
   */

  var hasPath =
  /*#__PURE__*/
  _curry2(function hasPath(_path, obj) {
    if (_path.length === 0 || isNil$1(obj)) {
      return false;
    }

    var val = obj;
    var idx = 0;

    while (idx < _path.length) {
      if (!isNil$1(val) && _has(_path[idx], val)) {
        val = val[_path[idx]];
        idx += 1;
      } else {
        return false;
      }
    }

    return true;
  });

  var hasPath$1 = hasPath;

  /**
   * Returns whether or not an object has an own property with the specified name
   *
   * @func
   * @memberOf R
   * @since v0.7.0
   * @category Object
   * @sig s -> {s: x} -> Boolean
   * @param {String} prop The name of the property to check for.
   * @param {Object} obj The object to query.
   * @return {Boolean} Whether the property exists.
   * @example
   *
   *      const hasName = R.has('name');
   *      hasName({name: 'alice'});   //=> true
   *      hasName({name: 'bob'});     //=> true
   *      hasName({});                //=> false
   *
   *      const point = {x: 0, y: 0};
   *      const pointHas = R.has(R.__, point);
   *      pointHas('x');  //=> true
   *      pointHas('y');  //=> true
   *      pointHas('z');  //=> false
   */

  var has =
  /*#__PURE__*/
  _curry2(function has(prop, obj) {
    return hasPath$1([prop], obj);
  });

  var has$1 = has;

  /**
   * Returns whether or not an object or its prototype chain has a property with
   * the specified name
   *
   * @func
   * @memberOf R
   * @since v0.7.0
   * @category Object
   * @sig s -> {s: x} -> Boolean
   * @param {String} prop The name of the property to check for.
   * @param {Object} obj The object to query.
   * @return {Boolean} Whether the property exists.
   * @example
   *
   *      function Rectangle(width, height) {
   *        this.width = width;
   *        this.height = height;
   *      }
   *      Rectangle.prototype.area = function() {
   *        return this.width * this.height;
   *      };
   *
   *      const square = new Rectangle(2, 2);
   *      R.hasIn('width', square);  //=> true
   *      R.hasIn('area', square);  //=> true
   */

  var hasIn =
  /*#__PURE__*/
  _curry2(function hasIn(prop, obj) {
    return prop in obj;
  });

  var hasIn$1 = hasIn;

  /**
   * Returns true if its arguments are identical, false otherwise. Values are
   * identical if they reference the same memory. `NaN` is identical to `NaN`;
   * `0` and `-0` are not identical.
   *
   * Note this is merely a curried version of ES6 `Object.is`.
   *
   * @func
   * @memberOf R
   * @since v0.15.0
   * @category Relation
   * @sig a -> a -> Boolean
   * @param {*} a
   * @param {*} b
   * @return {Boolean}
   * @example
   *
   *      const o = {};
   *      R.identical(o, o); //=> true
   *      R.identical(1, 1); //=> true
   *      R.identical(1, '1'); //=> false
   *      R.identical([], []); //=> false
   *      R.identical(0, -0); //=> false
   *      R.identical(NaN, NaN); //=> true
   */

  var identical =
  /*#__PURE__*/
  _curry2(_objectIs$1);

  var identical$1 = identical;

  /**
   * Creates a function that will process either the `onTrue` or the `onFalse`
   * function depending upon the result of the `condition` predicate.
   *
   * @func
   * @memberOf R
   * @since v0.8.0
   * @category Logic
   * @sig (*... -> Boolean) -> (*... -> *) -> (*... -> *) -> (*... -> *)
   * @param {Function} condition A predicate function
   * @param {Function} onTrue A function to invoke when the `condition` evaluates to a truthy value.
   * @param {Function} onFalse A function to invoke when the `condition` evaluates to a falsy value.
   * @return {Function} A new function that will process either the `onTrue` or the `onFalse`
   *                    function depending upon the result of the `condition` predicate.
   * @see R.unless, R.when, R.cond
   * @example
   *
   *      const incCount = R.ifElse(
   *        R.has('count'),
   *        R.over(R.lensProp('count'), R.inc),
   *        R.assoc('count', 1)
   *      );
   *      incCount({});           //=> { count: 1 }
   *      incCount({ count: 1 }); //=> { count: 2 }
   */

  var ifElse =
  /*#__PURE__*/
  _curry3(function ifElse(condition, onTrue, onFalse) {
    return curryN$1(Math.max(condition.length, onTrue.length, onFalse.length), function _ifElse() {
      return condition.apply(this, arguments) ? onTrue.apply(this, arguments) : onFalse.apply(this, arguments);
    });
  });

  var ifElse$1 = ifElse;

  /**
   * Increments its argument.
   *
   * @func
   * @memberOf R
   * @since v0.9.0
   * @category Math
   * @sig Number -> Number
   * @param {Number} n
   * @return {Number} n + 1
   * @see R.dec
   * @example
   *
   *      R.inc(42); //=> 43
   */

  var inc =
  /*#__PURE__*/
  add$1(1);
  var inc$1 = inc;

  /**
   * Returns `true` if the specified value is equal, in [`R.equals`](#equals)
   * terms, to at least one element of the given list; `false` otherwise.
   * Works also with strings.
   *
   * @func
   * @memberOf R
   * @since v0.26.0
   * @category List
   * @sig a -> [a] -> Boolean
   * @param {Object} a The item to compare against.
   * @param {Array} list The array to consider.
   * @return {Boolean} `true` if an equivalent item is in the list, `false` otherwise.
   * @see R.any
   * @example
   *
   *      R.includes(3, [1, 2, 3]); //=> true
   *      R.includes(4, [1, 2, 3]); //=> false
   *      R.includes({ name: 'Fred' }, [{ name: 'Fred' }]); //=> true
   *      R.includes([42], [[42]]); //=> true
   *      R.includes('ba', 'banana'); //=>true
   */

  var includes =
  /*#__PURE__*/
  _curry2(_includes);

  var includes$1 = includes;

  /**
   * Given a function that generates a key, turns a list of objects into an
   * object indexing the objects by the given key. Note that if multiple
   * objects generate the same value for the indexing key only the last value
   * will be included in the generated object.
   *
   * Acts as a transducer if a transformer is given in list position.
   *
   * @func
   * @memberOf R
   * @since v0.19.0
   * @category List
   * @sig (a -> String) -> [{k: v}] -> {k: {k: v}}
   * @param {Function} fn Function :: a -> String
   * @param {Array} array The array of objects to index
   * @return {Object} An object indexing each array element by the given property.
   * @example
   *
   *      const list = [{id: 'xyz', title: 'A'}, {id: 'abc', title: 'B'}];
   *      R.indexBy(R.prop('id'), list);
   *      //=> {abc: {id: 'abc', title: 'B'}, xyz: {id: 'xyz', title: 'A'}}
   */

  var indexBy =
  /*#__PURE__*/
  reduceBy$1(function (acc, elem) {
    return elem;
  }, null);
  var indexBy$1 = indexBy;

  /**
   * Returns the position of the first occurrence of an item in an array, or -1
   * if the item is not included in the array. [`R.equals`](#equals) is used to
   * determine equality.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category List
   * @sig a -> [a] -> Number
   * @param {*} target The item to find.
   * @param {Array} xs The array to search in.
   * @return {Number} the index of the target, or -1 if the target is not found.
   * @see R.lastIndexOf
   * @example
   *
   *      R.indexOf(3, [1,2,3,4]); //=> 2
   *      R.indexOf(10, [1,2,3,4]); //=> -1
   */

  var indexOf$2 =
  /*#__PURE__*/
  _curry2(function indexOf(target, xs) {
    return typeof xs.indexOf === 'function' && !_isArray(xs) ? xs.indexOf(target) : _indexOf(xs, target, 0);
  });

  var indexOf$3 = indexOf$2;

  /**
   * Returns all but the last element of the given list or string.
   *
   * @func
   * @memberOf R
   * @since v0.9.0
   * @category List
   * @sig [a] -> [a]
   * @sig String -> String
   * @param {*} list
   * @return {*}
   * @see R.last, R.head, R.tail
   * @example
   *
   *      R.init([1, 2, 3]);  //=> [1, 2]
   *      R.init([1, 2]);     //=> [1]
   *      R.init([1]);        //=> []
   *      R.init([]);         //=> []
   *
   *      R.init('abc');  //=> 'ab'
   *      R.init('ab');   //=> 'a'
   *      R.init('a');    //=> ''
   *      R.init('');     //=> ''
   */

  var init$1 =
  /*#__PURE__*/
  slice$3(0, -1);
  var init$2 = init$1;

  /**
   * Takes a predicate `pred`, a list `xs`, and a list `ys`, and returns a list
   * `xs'` comprising each of the elements of `xs` which is equal to one or more
   * elements of `ys` according to `pred`.
   *
   * `pred` must be a binary function expecting an element from each list.
   *
   * `xs`, `ys`, and `xs'` are treated as sets, semantically, so ordering should
   * not be significant, but since `xs'` is ordered the implementation guarantees
   * that its values are in the same order as they appear in `xs`. Duplicates are
   * not removed, so `xs'` may contain duplicates if `xs` contains duplicates.
   *
   * @func
   * @memberOf R
   * @since v0.24.0
   * @category Relation
   * @sig ((a, b) -> Boolean) -> [a] -> [b] -> [a]
   * @param {Function} pred
   * @param {Array} xs
   * @param {Array} ys
   * @return {Array}
   * @see R.intersection
   * @example
   *
   *      R.innerJoin(
   *        (record, id) => record.id === id,
   *        [{id: 824, name: 'Richie Furay'},
   *         {id: 956, name: 'Dewey Martin'},
   *         {id: 313, name: 'Bruce Palmer'},
   *         {id: 456, name: 'Stephen Stills'},
   *         {id: 177, name: 'Neil Young'}],
   *        [177, 456, 999]
   *      );
   *      //=> [{id: 456, name: 'Stephen Stills'}, {id: 177, name: 'Neil Young'}]
   */

  var innerJoin =
  /*#__PURE__*/
  _curry3(function innerJoin(pred, xs, ys) {
    return _filter(function (x) {
      return _includesWith(pred, x, ys);
    }, xs);
  });

  var innerJoin$1 = innerJoin;

  /**
   * Inserts the supplied element into the list, at the specified `index`. _Note that

   * this is not destructive_: it returns a copy of the list with the changes.
   * <small>No lists have been harmed in the application of this function.</small>
   *
   * @func
   * @memberOf R
   * @since v0.2.2
   * @category List
   * @sig Number -> a -> [a] -> [a]
   * @param {Number} index The position to insert the element
   * @param {*} elt The element to insert into the Array
   * @param {Array} list The list to insert into
   * @return {Array} A new Array with `elt` inserted at `index`.
   * @example
   *
   *      R.insert(2, 'x', [1,2,3,4]); //=> [1,2,'x',3,4]
   */

  var insert =
  /*#__PURE__*/
  _curry3(function insert(idx, elt, list) {
    idx = idx < list.length && idx >= 0 ? idx : list.length;
    var result = Array.prototype.slice.call(list, 0);
    result.splice(idx, 0, elt);
    return result;
  });

  var insert$1 = insert;

  /**
   * Inserts the sub-list into the list, at the specified `index`. _Note that this is not
   * destructive_: it returns a copy of the list with the changes.
   * <small>No lists have been harmed in the application of this function.</small>
   *
   * @func
   * @memberOf R
   * @since v0.9.0
   * @category List
   * @sig Number -> [a] -> [a] -> [a]
   * @param {Number} index The position to insert the sub-list
   * @param {Array} elts The sub-list to insert into the Array
   * @param {Array} list The list to insert the sub-list into
   * @return {Array} A new Array with `elts` inserted starting at `index`.
   * @example
   *
   *      R.insertAll(2, ['x','y','z'], [1,2,3,4]); //=> [1,2,'x','y','z',3,4]
   */

  var insertAll =
  /*#__PURE__*/
  _curry3(function insertAll(idx, elts, list) {
    idx = idx < list.length && idx >= 0 ? idx : list.length;
    return [].concat(Array.prototype.slice.call(list, 0, idx), elts, Array.prototype.slice.call(list, idx));
  });

  var insertAll$1 = insertAll;

  /**
   * Returns a new list containing only one copy of each element in the original
   * list, based upon the value returned by applying the supplied function to
   * each list element. Prefers the first item if the supplied function produces
   * the same value on two items. [`R.equals`](#equals) is used for comparison.
   *
   * @func
   * @memberOf R
   * @since v0.16.0
   * @category List
   * @sig (a -> b) -> [a] -> [a]
   * @param {Function} fn A function used to produce a value to use during comparisons.
   * @param {Array} list The array to consider.
   * @return {Array} The list of unique items.
   * @example
   *
   *      R.uniqBy(Math.abs, [-1, -5, 2, 10, 1, 2]); //=> [-1, -5, 2, 10]
   */

  var uniqBy =
  /*#__PURE__*/
  _curry2(function uniqBy(fn, list) {
    var set = new _Set$1();
    var result = [];
    var idx = 0;
    var appliedItem, item;

    while (idx < list.length) {
      item = list[idx];
      appliedItem = fn(item);

      if (set.add(appliedItem)) {
        result.push(item);
      }

      idx += 1;
    }

    return result;
  });

  var uniqBy$1 = uniqBy;

  /**
   * Returns a new list containing only one copy of each element in the original
   * list. [`R.equals`](#equals) is used to determine equality.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category List
   * @sig [a] -> [a]
   * @param {Array} list The array to consider.
   * @return {Array} The list of unique items.
   * @example
   *
   *      R.uniq([1, 1, 2, 1]); //=> [1, 2]
   *      R.uniq([1, '1']);     //=> [1, '1']
   *      R.uniq([[42], [42]]); //=> [[42]]
   */

  var uniq =
  /*#__PURE__*/
  uniqBy$1(identity$1);
  var uniq$1 = uniq;

  /**
   * Combines two lists into a set (i.e. no duplicates) composed of those
   * elements common to both lists.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category Relation
   * @sig [*] -> [*] -> [*]
   * @param {Array} list1 The first list.
   * @param {Array} list2 The second list.
   * @return {Array} The list of elements found in both `list1` and `list2`.
   * @see R.innerJoin
   * @example
   *
   *      R.intersection([1,2,3,4], [7,6,5,4,3]); //=> [4, 3]
   */

  var intersection$1 =
  /*#__PURE__*/
  _curry2(function intersection(list1, list2) {
    var lookupList, filteredList;

    if (list1.length > list2.length) {
      lookupList = list1;
      filteredList = list2;
    } else {
      lookupList = list2;
      filteredList = list1;
    }

    return uniq$1(_filter(flip$2(_includes)(lookupList), filteredList));
  });

  var intersection$2 = intersection$1;

  /**
   * Creates a new list with the separator interposed between elements.
   *
   * Dispatches to the `intersperse` method of the second argument, if present.
   *
   * @func
   * @memberOf R
   * @since v0.14.0
   * @category List
   * @sig a -> [a] -> [a]
   * @param {*} separator The element to add to the list.
   * @param {Array} list The list to be interposed.
   * @return {Array} The new list.
   * @example
   *
   *      R.intersperse('a', ['b', 'n', 'n', 's']); //=> ['b', 'a', 'n', 'a', 'n', 'a', 's']
   */

  var intersperse =
  /*#__PURE__*/
  _curry2(
  /*#__PURE__*/
  _checkForMethod('intersperse', function intersperse(separator, list) {
    var out = [];
    var idx = 0;
    var length = list.length;

    while (idx < length) {
      if (idx === length - 1) {
        out.push(list[idx]);
      } else {
        out.push(list[idx], separator);
      }

      idx += 1;
    }

    return out;
  }));

  var intersperse$1 = intersperse;

  function _objectAssign(target) {
    if (target == null) {
      throw new TypeError('Cannot convert undefined or null to object');
    }

    var output = Object(target);
    var idx = 1;
    var length = arguments.length;

    while (idx < length) {
      var source = arguments[idx];

      if (source != null) {
        for (var nextKey in source) {
          if (_has(nextKey, source)) {
            output[nextKey] = source[nextKey];
          }
        }
      }

      idx += 1;
    }

    return output;
  }

  var _objectAssign$1 = typeof Object.assign === 'function' ? Object.assign : _objectAssign;

  /**
   * Creates an object containing a single key:value pair.
   *
   * @func
   * @memberOf R
   * @since v0.18.0
   * @category Object
   * @sig String -> a -> {String:a}
   * @param {String} key
   * @param {*} val
   * @return {Object}
   * @see R.pair
   * @example
   *
   *      const matchPhrases = R.compose(
   *        R.objOf('must'),
   *        R.map(R.objOf('match_phrase'))
   *      );
   *      matchPhrases(['foo', 'bar', 'baz']); //=> {must: [{match_phrase: 'foo'}, {match_phrase: 'bar'}, {match_phrase: 'baz'}]}
   */

  var objOf =
  /*#__PURE__*/
  _curry2(function objOf(key, val) {
    var obj = {};
    obj[key] = val;
    return obj;
  });

  var objOf$1 = objOf;

  var _stepCatArray = {
    '@@transducer/init': Array,
    '@@transducer/step': function (xs, x) {
      xs.push(x);
      return xs;
    },
    '@@transducer/result': _identity
  };
  var _stepCatString = {
    '@@transducer/init': String,
    '@@transducer/step': function (a, b) {
      return a + b;
    },
    '@@transducer/result': _identity
  };
  var _stepCatObject = {
    '@@transducer/init': Object,
    '@@transducer/step': function (result, input) {
      return _objectAssign$1(result, _isArrayLike$1(input) ? objOf$1(input[0], input[1]) : input);
    },
    '@@transducer/result': _identity
  };
  function _stepCat(obj) {
    if (_isTransformer(obj)) {
      return obj;
    }

    if (_isArrayLike$1(obj)) {
      return _stepCatArray;
    }

    if (typeof obj === 'string') {
      return _stepCatString;
    }

    if (typeof obj === 'object') {
      return _stepCatObject;
    }

    throw new Error('Cannot create transformer for ' + obj);
  }

  /**
   * Transforms the items of the list with the transducer and appends the
   * transformed items to the accumulator using an appropriate iterator function
   * based on the accumulator type.
   *
   * The accumulator can be an array, string, object or a transformer. Iterated
   * items will be appended to arrays and concatenated to strings. Objects will
   * be merged directly or 2-item arrays will be merged as key, value pairs.
   *
   * The accumulator can also be a transformer object that provides a 2-arity
   * reducing iterator function, step, 0-arity initial value function, init, and
   * 1-arity result extraction function result. The step function is used as the
   * iterator function in reduce. The result function is used to convert the
   * final accumulator into the return type and in most cases is R.identity. The
   * init function is used to provide the initial accumulator.
   *
   * The iteration is performed with [`R.reduce`](#reduce) after initializing the
   * transducer.
   *
   * @func
   * @memberOf R
   * @since v0.12.0
   * @category List
   * @sig a -> (b -> b) -> [c] -> a
   * @param {*} acc The initial accumulator value.
   * @param {Function} xf The transducer function. Receives a transformer and returns a transformer.
   * @param {Array} list The list to iterate over.
   * @return {*} The final, accumulated value.
   * @see R.transduce
   * @example
   *
   *      const numbers = [1, 2, 3, 4];
   *      const transducer = R.compose(R.map(R.add(1)), R.take(2));
   *
   *      R.into([], transducer, numbers); //=> [2, 3]
   *
   *      const intoArray = R.into([]);
   *      intoArray(transducer, numbers); //=> [2, 3]
   */

  var into =
  /*#__PURE__*/
  _curry3(function into(acc, xf, list) {
    return _isTransformer(acc) ? _reduce(xf(acc), acc['@@transducer/init'](), list) : _reduce(xf(_stepCat(acc)), _clone(acc, [], [], false), list);
  });

  var into$1 = into;

  /**
   * Same as [`R.invertObj`](#invertObj), however this accounts for objects with
   * duplicate values by putting the values into an array.
   *
   * @func
   * @memberOf R
   * @since v0.9.0
   * @category Object
   * @sig {s: x} -> {x: [ s, ... ]}
   * @param {Object} obj The object or array to invert
   * @return {Object} out A new object with keys in an array.
   * @see R.invertObj
   * @example
   *
   *      const raceResultsByFirstName = {
   *        first: 'alice',
   *        second: 'jake',
   *        third: 'alice',
   *      };
   *      R.invert(raceResultsByFirstName);
   *      //=> { 'alice': ['first', 'third'], 'jake':['second'] }
   */

  var invert =
  /*#__PURE__*/
  _curry1(function invert(obj) {
    var props = keys$2(obj);
    var len = props.length;
    var idx = 0;
    var out = {};

    while (idx < len) {
      var key = props[idx];
      var val = obj[key];
      var list = _has(val, out) ? out[val] : out[val] = [];
      list[list.length] = key;
      idx += 1;
    }

    return out;
  });

  var invert$1 = invert;

  /**
   * Returns a new object with the keys of the given object as values, and the
   * values of the given object, which are coerced to strings, as keys. Note
   * that the last key found is preferred when handling the same value.
   *
   * @func
   * @memberOf R
   * @since v0.9.0
   * @category Object
   * @sig {s: x} -> {x: s}
   * @param {Object} obj The object or array to invert
   * @return {Object} out A new object
   * @see R.invert
   * @example
   *
   *      const raceResults = {
   *        first: 'alice',
   *        second: 'jake'
   *      };
   *      R.invertObj(raceResults);
   *      //=> { 'alice': 'first', 'jake':'second' }
   *
   *      // Alternatively:
   *      const raceResults = ['alice', 'jake'];
   *      R.invertObj(raceResults);
   *      //=> { 'alice': '0', 'jake':'1' }
   */

  var invertObj =
  /*#__PURE__*/
  _curry1(function invertObj(obj) {
    var props = keys$2(obj);
    var len = props.length;
    var idx = 0;
    var out = {};

    while (idx < len) {
      var key = props[idx];
      out[obj[key]] = key;
      idx += 1;
    }

    return out;
  });

  var invertObj$1 = invertObj;

  /**
   * Turns a named method with a specified arity into a function that can be
   * called directly supplied with arguments and a target object.
   *
   * The returned function is curried and accepts `arity + 1` parameters where
   * the final parameter is the target object.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category Function
   * @sig Number -> String -> (a -> b -> ... -> n -> Object -> *)
   * @param {Number} arity Number of arguments the returned function should take
   *        before the target object.
   * @param {String} method Name of any of the target object's methods to call.
   * @return {Function} A new curried function.
   * @see R.construct
   * @example
   *
   *      const sliceFrom = R.invoker(1, 'slice');
   *      sliceFrom(6, 'abcdefghijklm'); //=> 'ghijklm'
   *      const sliceFrom6 = R.invoker(2, 'slice')(6);
   *      sliceFrom6(8, 'abcdefghijklm'); //=> 'gh'
   *
   *      const dog = {
   *        speak: async () => 'Woof!'
   *      };
   *      const speak = R.invoker(0, 'speak');
   *      speak(dog).then(console.log) //~> 'Woof!'
   *
   * @symb R.invoker(0, 'method')(o) = o['method']()
   * @symb R.invoker(1, 'method')(a, o) = o['method'](a)
   * @symb R.invoker(2, 'method')(a, b, o) = o['method'](a, b)
   */

  var invoker =
  /*#__PURE__*/
  _curry2(function invoker(arity, method) {
    return curryN$1(arity + 1, function () {
      var target = arguments[arity];

      if (target != null && _isFunction(target[method])) {
        return target[method].apply(target, Array.prototype.slice.call(arguments, 0, arity));
      }

      throw new TypeError(toString$2(target) + ' does not have a method named "' + method + '"');
    });
  });

  var invoker$1 = invoker;

  /**
   * See if an object (`val`) is an instance of the supplied constructor. This
   * function will check up the inheritance chain, if any.
   *
   * @func
   * @memberOf R
   * @since v0.3.0
   * @category Type
   * @sig (* -> {*}) -> a -> Boolean
   * @param {Object} ctor A constructor
   * @param {*} val The value to test
   * @return {Boolean}
   * @example
   *
   *      R.is(Object, {}); //=> true
   *      R.is(Number, 1); //=> true
   *      R.is(Object, 1); //=> false
   *      R.is(String, 's'); //=> true
   *      R.is(String, new String('')); //=> true
   *      R.is(Object, new String('')); //=> true
   *      R.is(Object, 's'); //=> false
   *      R.is(Number, {}); //=> false
   */

  var is =
  /*#__PURE__*/
  _curry2(function is(Ctor, val) {
    return val != null && val.constructor === Ctor || val instanceof Ctor;
  });

  var is$1 = is;

  /**
   * Returns `true` if the given value is its type's empty value; `false`
   * otherwise.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category Logic
   * @sig a -> Boolean
   * @param {*} x
   * @return {Boolean}
   * @see R.empty
   * @example
   *
   *      R.isEmpty([1, 2, 3]);   //=> false
   *      R.isEmpty([]);          //=> true
   *      R.isEmpty('');          //=> true
   *      R.isEmpty(null);        //=> false
   *      R.isEmpty({});          //=> true
   *      R.isEmpty({length: 0}); //=> false
   */

  var isEmpty$1 =
  /*#__PURE__*/
  _curry1(function isEmpty(x) {
    return x != null && equals$1(x, empty$1(x));
  });

  var isEmpty$2 = isEmpty$1;

  /**
   * Returns a string made by inserting the `separator` between each element and
   * concatenating all the elements into a single string.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category List
   * @sig String -> [a] -> String
   * @param {Number|String} separator The string used to separate the elements.
   * @param {Array} xs The elements to join into a string.
   * @return {String} str The string made by concatenating `xs` with `separator`.
   * @see R.split
   * @example
   *
   *      const spacer = R.join(' ');
   *      spacer(['a', 2, 3.4]);   //=> 'a 2 3.4'
   *      R.join('|', [1, 2, 3]);    //=> '1|2|3'
   */

  var join$2 =
  /*#__PURE__*/
  invoker$1(1, 'join');
  var join$3 = join$2;

  /**
   * juxt applies a list of functions to a list of values.
   *
   * @func
   * @memberOf R
   * @since v0.19.0
   * @category Function
   * @sig [(a, b, ..., m) -> n] -> ((a, b, ..., m) -> [n])
   * @param {Array} fns An array of functions
   * @return {Function} A function that returns a list of values after applying each of the original `fns` to its parameters.
   * @see R.applySpec
   * @example
   *
   *      const getRange = R.juxt([Math.min, Math.max]);
   *      getRange(3, 4, 9, -3); //=> [-3, 9]
   * @symb R.juxt([f, g, h])(a, b) = [f(a, b), g(a, b), h(a, b)]
   */

  var juxt =
  /*#__PURE__*/
  _curry1(function juxt(fns) {
    return converge$1(function () {
      return Array.prototype.slice.call(arguments, 0);
    }, fns);
  });

  var juxt$1 = juxt;

  /**
   * Returns a list containing the names of all the properties of the supplied
   * object, including prototype properties.
   * Note that the order of the output array is not guaranteed to be consistent
   * across different JS platforms.
   *
   * @func
   * @memberOf R
   * @since v0.2.0
   * @category Object
   * @sig {k: v} -> [k]
   * @param {Object} obj The object to extract properties from
   * @return {Array} An array of the object's own and prototype properties.
   * @see R.keys, R.valuesIn
   * @example
   *
   *      const F = function() { this.x = 'X'; };
   *      F.prototype.y = 'Y';
   *      const f = new F();
   *      R.keysIn(f); //=> ['x', 'y']
   */

  var keysIn =
  /*#__PURE__*/
  _curry1(function keysIn(obj) {
    var prop;
    var ks = [];

    for (prop in obj) {
      ks[ks.length] = prop;
    }

    return ks;
  });

  var keysIn$1 = keysIn;

  /**
   * Returns the position of the last occurrence of an item in an array, or -1 if
   * the item is not included in the array. [`R.equals`](#equals) is used to
   * determine equality.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category List
   * @sig a -> [a] -> Number
   * @param {*} target The item to find.
   * @param {Array} xs The array to search in.
   * @return {Number} the index of the target, or -1 if the target is not found.
   * @see R.indexOf
   * @example
   *
   *      R.lastIndexOf(3, [-1,3,3,0,1,2,3,4]); //=> 6
   *      R.lastIndexOf(10, [1,2,3,4]); //=> -1
   */

  var lastIndexOf =
  /*#__PURE__*/
  _curry2(function lastIndexOf(target, xs) {
    if (typeof xs.lastIndexOf === 'function' && !_isArray(xs)) {
      return xs.lastIndexOf(target);
    } else {
      var idx = xs.length - 1;

      while (idx >= 0) {
        if (equals$1(xs[idx], target)) {
          return idx;
        }

        idx -= 1;
      }

      return -1;
    }
  });

  var lastIndexOf$1 = lastIndexOf;

  function _isNumber(x) {
    return Object.prototype.toString.call(x) === '[object Number]';
  }

  /**
   * Returns the number of elements in the array by returning `list.length`.
   *
   * @func
   * @memberOf R
   * @since v0.3.0
   * @category List
   * @sig [a] -> Number
   * @param {Array} list The array to inspect.
   * @return {Number} The length of the array.
   * @example
   *
   *      R.length([]); //=> 0
   *      R.length([1, 2, 3]); //=> 3
   */

  var length =
  /*#__PURE__*/
  _curry1(function length(list) {
    return list != null && _isNumber(list.length) ? list.length : NaN;
  });

  var length$1 = length;

  /**
   * Returns a lens for the given getter and setter functions. The getter "gets"
   * the value of the focus; the setter "sets" the value of the focus. The setter
   * should not mutate the data structure.
   *
   * @func
   * @memberOf R
   * @since v0.8.0
   * @category Object
   * @typedefn Lens s a = Functor f => (a -> f a) -> s -> f s
   * @sig (s -> a) -> ((a, s) -> s) -> Lens s a
   * @param {Function} getter
   * @param {Function} setter
   * @return {Lens}
   * @see R.view, R.set, R.over, R.lensIndex, R.lensProp
   * @example
   *
   *      const xLens = R.lens(R.prop('x'), R.assoc('x'));
   *
   *      R.view(xLens, {x: 1, y: 2});            //=> 1
   *      R.set(xLens, 4, {x: 1, y: 2});          //=> {x: 4, y: 2}
   *      R.over(xLens, R.negate, {x: 1, y: 2});  //=> {x: -1, y: 2}
   */

  var lens =
  /*#__PURE__*/
  _curry2(function lens(getter, setter) {
    return function (toFunctorFn) {
      return function (target) {
        return map$3(function (focus) {
          return setter(focus, target);
        }, toFunctorFn(getter(target)));
      };
    };
  });

  var lens$1 = lens;

  /**
   * Returns a lens whose focus is the specified index.
   *
   * @func
   * @memberOf R
   * @since v0.14.0
   * @category Object
   * @typedefn Lens s a = Functor f => (a -> f a) -> s -> f s
   * @sig Number -> Lens s a
   * @param {Number} n
   * @return {Lens}
   * @see R.view, R.set, R.over, R.nth
   * @example
   *
   *      const headLens = R.lensIndex(0);
   *
   *      R.view(headLens, ['a', 'b', 'c']);            //=> 'a'
   *      R.set(headLens, 'x', ['a', 'b', 'c']);        //=> ['x', 'b', 'c']
   *      R.over(headLens, R.toUpper, ['a', 'b', 'c']); //=> ['A', 'b', 'c']
   */

  var lensIndex =
  /*#__PURE__*/
  _curry1(function lensIndex(n) {
    return lens$1(nth$1(n), update$1(n));
  });

  var lensIndex$1 = lensIndex;

  /**
   * Returns a lens whose focus is the specified path.
   *
   * @func
   * @memberOf R
   * @since v0.19.0
   * @category Object
   * @typedefn Idx = String | Int
   * @typedefn Lens s a = Functor f => (a -> f a) -> s -> f s
   * @sig [Idx] -> Lens s a
   * @param {Array} path The path to use.
   * @return {Lens}
   * @see R.view, R.set, R.over
   * @example
   *
   *      const xHeadYLens = R.lensPath(['x', 0, 'y']);
   *
   *      R.view(xHeadYLens, {x: [{y: 2, z: 3}, {y: 4, z: 5}]});
   *      //=> 2
   *      R.set(xHeadYLens, 1, {x: [{y: 2, z: 3}, {y: 4, z: 5}]});
   *      //=> {x: [{y: 1, z: 3}, {y: 4, z: 5}]}
   *      R.over(xHeadYLens, R.negate, {x: [{y: 2, z: 3}, {y: 4, z: 5}]});
   *      //=> {x: [{y: -2, z: 3}, {y: 4, z: 5}]}
   */

  var lensPath =
  /*#__PURE__*/
  _curry1(function lensPath(p) {
    return lens$1(path$1(p), assocPath$1(p));
  });

  var lensPath$1 = lensPath;

  /**
   * Returns a lens whose focus is the specified property.
   *
   * @func
   * @memberOf R
   * @since v0.14.0
   * @category Object
   * @typedefn Lens s a = Functor f => (a -> f a) -> s -> f s
   * @sig String -> Lens s a
   * @param {String} k
   * @return {Lens}
   * @see R.view, R.set, R.over
   * @example
   *
   *      const xLens = R.lensProp('x');
   *
   *      R.view(xLens, {x: 1, y: 2});            //=> 1
   *      R.set(xLens, 4, {x: 1, y: 2});          //=> {x: 4, y: 2}
   *      R.over(xLens, R.negate, {x: 1, y: 2});  //=> {x: -1, y: 2}
   */

  var lensProp =
  /*#__PURE__*/
  _curry1(function lensProp(k) {
    return lens$1(prop$1(k), assoc$1(k));
  });

  var lensProp$1 = lensProp;

  /**
   * Returns `true` if the first argument is less than the second; `false`
   * otherwise.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category Relation
   * @sig Ord a => a -> a -> Boolean
   * @param {*} a
   * @param {*} b
   * @return {Boolean}
   * @see R.gt
   * @example
   *
   *      R.lt(2, 1); //=> false
   *      R.lt(2, 2); //=> false
   *      R.lt(2, 3); //=> true
   *      R.lt('a', 'z'); //=> true
   *      R.lt('z', 'a'); //=> false
   */

  var lt =
  /*#__PURE__*/
  _curry2(function lt(a, b) {
    return a < b;
  });

  var lt$1 = lt;

  /**
   * Returns `true` if the first argument is less than or equal to the second;
   * `false` otherwise.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category Relation
   * @sig Ord a => a -> a -> Boolean
   * @param {Number} a
   * @param {Number} b
   * @return {Boolean}
   * @see R.gte
   * @example
   *
   *      R.lte(2, 1); //=> false
   *      R.lte(2, 2); //=> true
   *      R.lte(2, 3); //=> true
   *      R.lte('a', 'z'); //=> true
   *      R.lte('z', 'a'); //=> false
   */

  var lte =
  /*#__PURE__*/
  _curry2(function lte(a, b) {
    return a <= b;
  });

  var lte$1 = lte;

  /**
   * The `mapAccum` function behaves like a combination of map and reduce; it
   * applies a function to each element of a list, passing an accumulating
   * parameter from left to right, and returning a final value of this
   * accumulator together with the new list.
   *
   * The iterator function receives two arguments, *acc* and *value*, and should
   * return a tuple *[acc, value]*.
   *
   * @func
   * @memberOf R
   * @since v0.10.0
   * @category List
   * @sig ((acc, x) -> (acc, y)) -> acc -> [x] -> (acc, [y])
   * @param {Function} fn The function to be called on every element of the input `list`.
   * @param {*} acc The accumulator value.
   * @param {Array} list The list to iterate over.
   * @return {*} The final, accumulated value.
   * @see R.scan, R.addIndex, R.mapAccumRight
   * @example
   *
   *      const digits = ['1', '2', '3', '4'];
   *      const appender = (a, b) => [a + b, a + b];
   *
   *      R.mapAccum(appender, 0, digits); //=> ['01234', ['01', '012', '0123', '01234']]
   * @symb R.mapAccum(f, a, [b, c, d]) = [
   *   f(f(f(a, b)[0], c)[0], d)[0],
   *   [
   *     f(a, b)[1],
   *     f(f(a, b)[0], c)[1],
   *     f(f(f(a, b)[0], c)[0], d)[1]
   *   ]
   * ]
   */

  var mapAccum =
  /*#__PURE__*/
  _curry3(function mapAccum(fn, acc, list) {
    var idx = 0;
    var len = list.length;
    var result = [];
    var tuple = [acc];

    while (idx < len) {
      tuple = fn(tuple[0], list[idx]);
      result[idx] = tuple[1];
      idx += 1;
    }

    return [tuple[0], result];
  });

  var mapAccum$1 = mapAccum;

  /**
   * The `mapAccumRight` function behaves like a combination of map and reduce; it
   * applies a function to each element of a list, passing an accumulating
   * parameter from right to left, and returning a final value of this
   * accumulator together with the new list.
   *
   * Similar to [`mapAccum`](#mapAccum), except moves through the input list from
   * the right to the left.
   *
   * The iterator function receives two arguments, *acc* and *value*, and should
   * return a tuple *[acc, value]*.
   *
   * @func
   * @memberOf R
   * @since v0.10.0
   * @category List
   * @sig ((acc, x) -> (acc, y)) -> acc -> [x] -> (acc, [y])
   * @param {Function} fn The function to be called on every element of the input `list`.
   * @param {*} acc The accumulator value.
   * @param {Array} list The list to iterate over.
   * @return {*} The final, accumulated value.
   * @see R.addIndex, R.mapAccum
   * @example
   *
   *      const digits = ['1', '2', '3', '4'];
   *      const appender = (a, b) => [b + a, b + a];
   *
   *      R.mapAccumRight(appender, 5, digits); //=> ['12345', ['12345', '2345', '345', '45']]
   * @symb R.mapAccumRight(f, a, [b, c, d]) = [
   *   f(f(f(a, d)[0], c)[0], b)[0],
   *   [
   *     f(a, d)[1],
   *     f(f(a, d)[0], c)[1],
   *     f(f(f(a, d)[0], c)[0], b)[1]
   *   ]
   * ]
   */

  var mapAccumRight =
  /*#__PURE__*/
  _curry3(function mapAccumRight(fn, acc, list) {
    var idx = list.length - 1;
    var result = [];
    var tuple = [acc];

    while (idx >= 0) {
      tuple = fn(tuple[0], list[idx]);
      result[idx] = tuple[1];
      idx -= 1;
    }

    return [tuple[0], result];
  });

  var mapAccumRight$1 = mapAccumRight;

  /**
   * An Object-specific version of [`map`](#map). The function is applied to three
   * arguments: *(value, key, obj)*. If only the value is significant, use
   * [`map`](#map) instead.
   *
   * @func
   * @memberOf R
   * @since v0.9.0
   * @category Object
   * @sig ((*, String, Object) -> *) -> Object -> Object
   * @param {Function} fn
   * @param {Object} obj
   * @return {Object}
   * @see R.map
   * @example
   *
   *      const xyz = { x: 1, y: 2, z: 3 };
   *      const prependKeyAndDouble = (num, key, obj) => key + (num * 2);
   *
   *      R.mapObjIndexed(prependKeyAndDouble, xyz); //=> { x: 'x2', y: 'y4', z: 'z6' }
   */

  var mapObjIndexed =
  /*#__PURE__*/
  _curry2(function mapObjIndexed(fn, obj) {
    return _reduce(function (acc, key) {
      acc[key] = fn(obj[key], key, obj);
      return acc;
    }, {}, keys$2(obj));
  });

  var mapObjIndexed$1 = mapObjIndexed;

  /**
   * Tests a regular expression against a String. Note that this function will
   * return an empty array when there are no matches. This differs from
   * [`String.prototype.match`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/match)
   * which returns `null` when there are no matches.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category String
   * @sig RegExp -> String -> [String | Undefined]
   * @param {RegExp} rx A regular expression.
   * @param {String} str The string to match against
   * @return {Array} The list of matches or empty array.
   * @see R.test
   * @example
   *
   *      R.match(/([a-z]a)/g, 'bananas'); //=> ['ba', 'na', 'na']
   *      R.match(/a/, 'b'); //=> []
   *      R.match(/a/, null); //=> TypeError: null does not have a method named "match"
   */

  var match =
  /*#__PURE__*/
  _curry2(function match(rx, str) {
    return str.match(rx) || [];
  });

  var match$1 = match;

  /**
   * `mathMod` behaves like the modulo operator should mathematically, unlike the
   * `%` operator (and by extension, [`R.modulo`](#modulo)). So while
   * `-17 % 5` is `-2`, `mathMod(-17, 5)` is `3`. `mathMod` requires Integer
   * arguments, and returns NaN when the modulus is zero or negative.
   *
   * @func
   * @memberOf R
   * @since v0.3.0
   * @category Math
   * @sig Number -> Number -> Number
   * @param {Number} m The dividend.
   * @param {Number} p the modulus.
   * @return {Number} The result of `b mod a`.
   * @see R.modulo
   * @example
   *
   *      R.mathMod(-17, 5);  //=> 3
   *      R.mathMod(17, 5);   //=> 2
   *      R.mathMod(17, -5);  //=> NaN
   *      R.mathMod(17, 0);   //=> NaN
   *      R.mathMod(17.2, 5); //=> NaN
   *      R.mathMod(17, 5.3); //=> NaN
   *
   *      const clock = R.mathMod(R.__, 12);
   *      clock(15); //=> 3
   *      clock(24); //=> 0
   *
   *      const seventeenMod = R.mathMod(17);
   *      seventeenMod(3);  //=> 2
   *      seventeenMod(4);  //=> 1
   *      seventeenMod(10); //=> 7
   */

  var mathMod =
  /*#__PURE__*/
  _curry2(function mathMod(m, p) {
    if (!_isInteger(m)) {
      return NaN;
    }

    if (!_isInteger(p) || p < 1) {
      return NaN;
    }

    return (m % p + p) % p;
  });

  var mathMod$1 = mathMod;

  /**
   * Takes a function and two values, and returns whichever value produces the
   * larger result when passed to the provided function.
   *
   * @func
   * @memberOf R
   * @since v0.8.0
   * @category Relation
   * @sig Ord b => (a -> b) -> a -> a -> a
   * @param {Function} f
   * @param {*} a
   * @param {*} b
   * @return {*}
   * @see R.max, R.minBy
   * @example
   *
   *      //  square :: Number -> Number
   *      const square = n => n * n;
   *
   *      R.maxBy(square, -3, 2); //=> -3
   *
   *      R.reduce(R.maxBy(square), 0, [3, -5, 4, 1, -2]); //=> -5
   *      R.reduce(R.maxBy(square), 0, []); //=> 0
   */

  var maxBy =
  /*#__PURE__*/
  _curry3(function maxBy(f, a, b) {
    return f(b) > f(a) ? b : a;
  });

  var maxBy$1 = maxBy;

  /**
   * Adds together all the elements of a list.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category Math
   * @sig [Number] -> Number
   * @param {Array} list An array of numbers
   * @return {Number} The sum of all the numbers in the list.
   * @see R.reduce
   * @example
   *
   *      R.sum([2,4,6,8,100,1]); //=> 121
   */

  var sum =
  /*#__PURE__*/
  reduce$1(add$1, 0);
  var sum$1 = sum;

  /**
   * Returns the mean of the given list of numbers.
   *
   * @func
   * @memberOf R
   * @since v0.14.0
   * @category Math
   * @sig [Number] -> Number
   * @param {Array} list
   * @return {Number}
   * @see R.median
   * @example
   *
   *      R.mean([2, 7, 9]); //=> 6
   *      R.mean([]); //=> NaN
   */

  var mean =
  /*#__PURE__*/
  _curry1(function mean(list) {
    return sum$1(list) / list.length;
  });

  var mean$1 = mean;

  /**
   * Returns the median of the given list of numbers.
   *
   * @func
   * @memberOf R
   * @since v0.14.0
   * @category Math
   * @sig [Number] -> Number
   * @param {Array} list
   * @return {Number}
   * @see R.mean
   * @example
   *
   *      R.median([2, 9, 7]); //=> 7
   *      R.median([7, 2, 10, 9]); //=> 8
   *      R.median([]); //=> NaN
   */

  var median =
  /*#__PURE__*/
  _curry1(function median(list) {
    var len = list.length;

    if (len === 0) {
      return NaN;
    }

    var width = 2 - len % 2;
    var idx = (len - width) / 2;
    return mean$1(Array.prototype.slice.call(list, 0).sort(function (a, b) {
      return a < b ? -1 : a > b ? 1 : 0;
    }).slice(idx, idx + width));
  });

  var median$1 = median;

  /**
   * Creates a new function that, when invoked, caches the result of calling `fn`
   * for a given argument set and returns the result. Subsequent calls to the
   * memoized `fn` with the same argument set will not result in an additional
   * call to `fn`; instead, the cached result for that set of arguments will be
   * returned.
   *
   *
   * @func
   * @memberOf R
   * @since v0.24.0
   * @category Function
   * @sig (*... -> String) -> (*... -> a) -> (*... -> a)
   * @param {Function} fn The function to generate the cache key.
   * @param {Function} fn The function to memoize.
   * @return {Function} Memoized version of `fn`.
   * @example
   *
   *      let count = 0;
   *      const factorial = R.memoizeWith(R.identity, n => {
   *        count += 1;
   *        return R.product(R.range(1, n + 1));
   *      });
   *      factorial(5); //=> 120
   *      factorial(5); //=> 120
   *      factorial(5); //=> 120
   *      count; //=> 1
   */

  var memoizeWith =
  /*#__PURE__*/
  _curry2(function memoizeWith(mFn, fn) {
    var cache = {};
    return _arity(fn.length, function () {
      var key = mFn.apply(this, arguments);

      if (!_has(key, cache)) {
        cache[key] = fn.apply(this, arguments);
      }

      return cache[key];
    });
  });

  var memoizeWith$1 = memoizeWith;

  /**
   * Create a new object with the own properties of the first object merged with
   * the own properties of the second object. If a key exists in both objects,
   * the value from the second object will be used.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category Object
   * @sig {k: v} -> {k: v} -> {k: v}
   * @param {Object} l
   * @param {Object} r
   * @return {Object}
   * @see R.mergeRight, R.mergeDeepRight, R.mergeWith, R.mergeWithKey
   * @deprecated since v0.26.0
   * @example
   *
   *      R.merge({ 'name': 'fred', 'age': 10 }, { 'age': 40 });
   *      //=> { 'name': 'fred', 'age': 40 }
   *
   *      const withDefaults = R.merge({x: 0, y: 0});
   *      withDefaults({y: 2}); //=> {x: 0, y: 2}
   * @symb R.merge(a, b) = {...a, ...b}
   */

  var merge =
  /*#__PURE__*/
  _curry2(function merge(l, r) {
    return _objectAssign$1({}, l, r);
  });

  var merge$1 = merge;

  /**
   * Merges a list of objects together into one object.
   *
   * @func
   * @memberOf R
   * @since v0.10.0
   * @category List
   * @sig [{k: v}] -> {k: v}
   * @param {Array} list An array of objects
   * @return {Object} A merged object.
   * @see R.reduce
   * @example
   *
   *      R.mergeAll([{foo:1},{bar:2},{baz:3}]); //=> {foo:1,bar:2,baz:3}
   *      R.mergeAll([{foo:1},{foo:2},{bar:2}]); //=> {foo:2,bar:2}
   * @symb R.mergeAll([{ x: 1 }, { y: 2 }, { z: 3 }]) = { x: 1, y: 2, z: 3 }
   */

  var mergeAll =
  /*#__PURE__*/
  _curry1(function mergeAll(list) {
    return _objectAssign$1.apply(null, [{}].concat(list));
  });

  var mergeAll$1 = mergeAll;

  /**
   * Creates a new object with the own properties of the two provided objects. If
   * a key exists in both objects, the provided function is applied to the key
   * and the values associated with the key in each object, with the result being
   * used as the value associated with the key in the returned object.
   *
   * @func
   * @memberOf R
   * @since v0.19.0
   * @category Object
   * @sig ((String, a, a) -> a) -> {a} -> {a} -> {a}
   * @param {Function} fn
   * @param {Object} l
   * @param {Object} r
   * @return {Object}
   * @see R.mergeDeepWithKey, R.merge, R.mergeWith
   * @example
   *
   *      let concatValues = (k, l, r) => k == 'values' ? R.concat(l, r) : r
   *      R.mergeWithKey(concatValues,
   *                     { a: true, thing: 'foo', values: [10, 20] },
   *                     { b: true, thing: 'bar', values: [15, 35] });
   *      //=> { a: true, b: true, thing: 'bar', values: [10, 20, 15, 35] }
   * @symb R.mergeWithKey(f, { x: 1, y: 2 }, { y: 5, z: 3 }) = { x: 1, y: f('y', 2, 5), z: 3 }
   */

  var mergeWithKey =
  /*#__PURE__*/
  _curry3(function mergeWithKey(fn, l, r) {
    var result = {};
    var k;

    for (k in l) {
      if (_has(k, l)) {
        result[k] = _has(k, r) ? fn(k, l[k], r[k]) : l[k];
      }
    }

    for (k in r) {
      if (_has(k, r) && !_has(k, result)) {
        result[k] = r[k];
      }
    }

    return result;
  });

  var mergeWithKey$1 = mergeWithKey;

  /**
   * Creates a new object with the own properties of the two provided objects.
   * If a key exists in both objects:
   * - and both associated values are also objects then the values will be
   *   recursively merged.
   * - otherwise the provided function is applied to the key and associated values
   *   using the resulting value as the new value associated with the key.
   * If a key only exists in one object, the value will be associated with the key
   * of the resulting object.
   *
   * @func
   * @memberOf R
   * @since v0.24.0
   * @category Object
   * @sig ((String, a, a) -> a) -> {a} -> {a} -> {a}
   * @param {Function} fn
   * @param {Object} lObj
   * @param {Object} rObj
   * @return {Object}
   * @see R.mergeWithKey, R.mergeDeepWith
   * @example
   *
   *      let concatValues = (k, l, r) => k == 'values' ? R.concat(l, r) : r
   *      R.mergeDeepWithKey(concatValues,
   *                         { a: true, c: { thing: 'foo', values: [10, 20] }},
   *                         { b: true, c: { thing: 'bar', values: [15, 35] }});
   *      //=> { a: true, b: true, c: { thing: 'bar', values: [10, 20, 15, 35] }}
   */

  var mergeDeepWithKey =
  /*#__PURE__*/
  _curry3(function mergeDeepWithKey(fn, lObj, rObj) {
    return mergeWithKey$1(function (k, lVal, rVal) {
      if (_isObject(lVal) && _isObject(rVal)) {
        return mergeDeepWithKey(fn, lVal, rVal);
      } else {
        return fn(k, lVal, rVal);
      }
    }, lObj, rObj);
  });

  var mergeDeepWithKey$1 = mergeDeepWithKey;

  /**
   * Creates a new object with the own properties of the first object merged with
   * the own properties of the second object. If a key exists in both objects:
   * - and both values are objects, the two values will be recursively merged
   * - otherwise the value from the first object will be used.
   *
   * @func
   * @memberOf R
   * @since v0.24.0
   * @category Object
   * @sig {a} -> {a} -> {a}
   * @param {Object} lObj
   * @param {Object} rObj
   * @return {Object}
   * @see R.merge, R.mergeDeepRight, R.mergeDeepWith, R.mergeDeepWithKey
   * @example
   *
   *      R.mergeDeepLeft({ name: 'fred', age: 10, contact: { email: 'moo@example.com' }},
   *                      { age: 40, contact: { email: 'baa@example.com' }});
   *      //=> { name: 'fred', age: 10, contact: { email: 'moo@example.com' }}
   */

  var mergeDeepLeft =
  /*#__PURE__*/
  _curry2(function mergeDeepLeft(lObj, rObj) {
    return mergeDeepWithKey$1(function (k, lVal, rVal) {
      return lVal;
    }, lObj, rObj);
  });

  var mergeDeepLeft$1 = mergeDeepLeft;

  /**
   * Creates a new object with the own properties of the first object merged with
   * the own properties of the second object. If a key exists in both objects:
   * - and both values are objects, the two values will be recursively merged
   * - otherwise the value from the second object will be used.
   *
   * @func
   * @memberOf R
   * @since v0.24.0
   * @category Object
   * @sig {a} -> {a} -> {a}
   * @param {Object} lObj
   * @param {Object} rObj
   * @return {Object}
   * @see R.merge, R.mergeDeepLeft, R.mergeDeepWith, R.mergeDeepWithKey
   * @example
   *
   *      R.mergeDeepRight({ name: 'fred', age: 10, contact: { email: 'moo@example.com' }},
   *                       { age: 40, contact: { email: 'baa@example.com' }});
   *      //=> { name: 'fred', age: 40, contact: { email: 'baa@example.com' }}
   */

  var mergeDeepRight =
  /*#__PURE__*/
  _curry2(function mergeDeepRight(lObj, rObj) {
    return mergeDeepWithKey$1(function (k, lVal, rVal) {
      return rVal;
    }, lObj, rObj);
  });

  var mergeDeepRight$1 = mergeDeepRight;

  /**
   * Creates a new object with the own properties of the two provided objects.
   * If a key exists in both objects:
   * - and both associated values are also objects then the values will be
   *   recursively merged.
   * - otherwise the provided function is applied to associated values using the
   *   resulting value as the new value associated with the key.
   * If a key only exists in one object, the value will be associated with the key
   * of the resulting object.
   *
   * @func
   * @memberOf R
   * @since v0.24.0
   * @category Object
   * @sig ((a, a) -> a) -> {a} -> {a} -> {a}
   * @param {Function} fn
   * @param {Object} lObj
   * @param {Object} rObj
   * @return {Object}
   * @see R.mergeWith, R.mergeDeepWithKey
   * @example
   *
   *      R.mergeDeepWith(R.concat,
   *                      { a: true, c: { values: [10, 20] }},
   *                      { b: true, c: { values: [15, 35] }});
   *      //=> { a: true, b: true, c: { values: [10, 20, 15, 35] }}
   */

  var mergeDeepWith =
  /*#__PURE__*/
  _curry3(function mergeDeepWith(fn, lObj, rObj) {
    return mergeDeepWithKey$1(function (k, lVal, rVal) {
      return fn(lVal, rVal);
    }, lObj, rObj);
  });

  var mergeDeepWith$1 = mergeDeepWith;

  /**
   * Create a new object with the own properties of the first object merged with
   * the own properties of the second object. If a key exists in both objects,
   * the value from the first object will be used.
   *
   * @func
   * @memberOf R
   * @since v0.26.0
   * @category Object
   * @sig {k: v} -> {k: v} -> {k: v}
   * @param {Object} l
   * @param {Object} r
   * @return {Object}
   * @see R.mergeRight, R.mergeDeepLeft, R.mergeWith, R.mergeWithKey
   * @example
   *
   *      R.mergeLeft({ 'age': 40 }, { 'name': 'fred', 'age': 10 });
   *      //=> { 'name': 'fred', 'age': 40 }
   *
   *      const resetToDefault = R.mergeLeft({x: 0});
   *      resetToDefault({x: 5, y: 2}); //=> {x: 0, y: 2}
   * @symb R.mergeLeft(a, b) = {...b, ...a}
   */

  var mergeLeft =
  /*#__PURE__*/
  _curry2(function mergeLeft(l, r) {
    return _objectAssign$1({}, r, l);
  });

  var mergeLeft$1 = mergeLeft;

  /**
   * Create a new object with the own properties of the first object merged with
   * the own properties of the second object. If a key exists in both objects,
   * the value from the second object will be used.
   *
   * @func
   * @memberOf R
   * @since v0.26.0
   * @category Object
   * @sig {k: v} -> {k: v} -> {k: v}
   * @param {Object} l
   * @param {Object} r
   * @return {Object}
   * @see R.mergeLeft, R.mergeDeepRight, R.mergeWith, R.mergeWithKey
   * @example
   *
   *      R.mergeRight({ 'name': 'fred', 'age': 10 }, { 'age': 40 });
   *      //=> { 'name': 'fred', 'age': 40 }
   *
   *      const withDefaults = R.mergeRight({x: 0, y: 0});
   *      withDefaults({y: 2}); //=> {x: 0, y: 2}
   * @symb R.mergeRight(a, b) = {...a, ...b}
   */

  var mergeRight =
  /*#__PURE__*/
  _curry2(function mergeRight(l, r) {
    return _objectAssign$1({}, l, r);
  });

  var mergeRight$1 = mergeRight;

  /**
   * Creates a new object with the own properties of the two provided objects. If
   * a key exists in both objects, the provided function is applied to the values
   * associated with the key in each object, with the result being used as the
   * value associated with the key in the returned object.
   *
   * @func
   * @memberOf R
   * @since v0.19.0
   * @category Object
   * @sig ((a, a) -> a) -> {a} -> {a} -> {a}
   * @param {Function} fn
   * @param {Object} l
   * @param {Object} r
   * @return {Object}
   * @see R.mergeDeepWith, R.merge, R.mergeWithKey
   * @example
   *
   *      R.mergeWith(R.concat,
   *                  { a: true, values: [10, 20] },
   *                  { b: true, values: [15, 35] });
   *      //=> { a: true, b: true, values: [10, 20, 15, 35] }
   */

  var mergeWith =
  /*#__PURE__*/
  _curry3(function mergeWith(fn, l, r) {
    return mergeWithKey$1(function (_, _l, _r) {
      return fn(_l, _r);
    }, l, r);
  });

  var mergeWith$1 = mergeWith;

  /**
   * Returns the smaller of its two arguments.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category Relation
   * @sig Ord a => a -> a -> a
   * @param {*} a
   * @param {*} b
   * @return {*}
   * @see R.minBy, R.max
   * @example
   *
   *      R.min(789, 123); //=> 123
   *      R.min('a', 'b'); //=> 'a'
   */

  var min =
  /*#__PURE__*/
  _curry2(function min(a, b) {
    return b < a ? b : a;
  });

  var min$1 = min;

  /**
   * Takes a function and two values, and returns whichever value produces the
   * smaller result when passed to the provided function.
   *
   * @func
   * @memberOf R
   * @since v0.8.0
   * @category Relation
   * @sig Ord b => (a -> b) -> a -> a -> a
   * @param {Function} f
   * @param {*} a
   * @param {*} b
   * @return {*}
   * @see R.min, R.maxBy
   * @example
   *
   *      //  square :: Number -> Number
   *      const square = n => n * n;
   *
   *      R.minBy(square, -3, 2); //=> 2
   *
   *      R.reduce(R.minBy(square), Infinity, [3, -5, 4, 1, -2]); //=> 1
   *      R.reduce(R.minBy(square), Infinity, []); //=> Infinity
   */

  var minBy =
  /*#__PURE__*/
  _curry3(function minBy(f, a, b) {
    return f(b) < f(a) ? b : a;
  });

  var minBy$1 = minBy;

  /**
   * Divides the first parameter by the second and returns the remainder. Note
   * that this function preserves the JavaScript-style behavior for modulo. For
   * mathematical modulo see [`mathMod`](#mathMod).
   *
   * @func
   * @memberOf R
   * @since v0.1.1
   * @category Math
   * @sig Number -> Number -> Number
   * @param {Number} a The value to the divide.
   * @param {Number} b The pseudo-modulus
   * @return {Number} The result of `b % a`.
   * @see R.mathMod
   * @example
   *
   *      R.modulo(17, 3); //=> 2
   *      // JS behavior:
   *      R.modulo(-17, 3); //=> -2
   *      R.modulo(17, -3); //=> 2
   *
   *      const isOdd = R.modulo(R.__, 2);
   *      isOdd(42); //=> 0
   *      isOdd(21); //=> 1
   */

  var modulo =
  /*#__PURE__*/
  _curry2(function modulo(a, b) {
    return a % b;
  });

  var modulo$1 = modulo;

  /**
   * Move an item, at index `from`, to index `to`, in a list of elements.
   * A new list will be created containing the new elements order.
   *
   * @func
   * @memberOf R
   * @since v0.27.1
   * @category List
   * @sig Number -> Number -> [a] -> [a]
   * @param {Number} from The source index
   * @param {Number} to The destination index
   * @param {Array} list The list which will serve to realise the move
   * @return {Array} The new list reordered
   * @example
   *
   *      R.move(0, 2, ['a', 'b', 'c', 'd', 'e', 'f']); //=> ['b', 'c', 'a', 'd', 'e', 'f']
   *      R.move(-1, 0, ['a', 'b', 'c', 'd', 'e', 'f']); //=> ['f', 'a', 'b', 'c', 'd', 'e'] list rotation
   */

  var move =
  /*#__PURE__*/
  _curry3(function (from, to, list) {
    var length = list.length;
    var result = list.slice();
    var positiveFrom = from < 0 ? length + from : from;
    var positiveTo = to < 0 ? length + to : to;
    var item = result.splice(positiveFrom, 1);
    return positiveFrom < 0 || positiveFrom >= list.length || positiveTo < 0 || positiveTo >= list.length ? list : [].concat(result.slice(0, positiveTo)).concat(item).concat(result.slice(positiveTo, list.length));
  });

  var move$1 = move;

  /**
   * Multiplies two numbers. Equivalent to `a * b` but curried.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category Math
   * @sig Number -> Number -> Number
   * @param {Number} a The first value.
   * @param {Number} b The second value.
   * @return {Number} The result of `a * b`.
   * @see R.divide
   * @example
   *
   *      const double = R.multiply(2);
   *      const triple = R.multiply(3);
   *      double(3);       //=>  6
   *      triple(4);       //=> 12
   *      R.multiply(2, 5);  //=> 10
   */

  var multiply =
  /*#__PURE__*/
  _curry2(function multiply(a, b) {
    return a * b;
  });

  var multiply$1 = multiply;

  /**
   * Negates its argument.
   *
   * @func
   * @memberOf R
   * @since v0.9.0
   * @category Math
   * @sig Number -> Number
   * @param {Number} n
   * @return {Number}
   * @example
   *
   *      R.negate(42); //=> -42
   */

  var negate =
  /*#__PURE__*/
  _curry1(function negate(n) {
    return -n;
  });

  var negate$1 = negate;

  /**
   * Returns `true` if no elements of the list match the predicate, `false`
   * otherwise.
   *
   * Dispatches to the `all` method of the second argument, if present.
   *
   * Acts as a transducer if a transformer is given in list position.
   *
   * @func
   * @memberOf R
   * @since v0.12.0
   * @category List
   * @sig (a -> Boolean) -> [a] -> Boolean
   * @param {Function} fn The predicate function.
   * @param {Array} list The array to consider.
   * @return {Boolean} `true` if the predicate is not satisfied by every element, `false` otherwise.
   * @see R.all, R.any
   * @example
   *
   *      const isEven = n => n % 2 === 0;
   *      const isOdd = n => n % 2 === 1;
   *
   *      R.none(isEven, [1, 3, 5, 7, 9, 11]); //=> true
   *      R.none(isOdd, [1, 3, 5, 7, 8, 11]); //=> false
   */

  var none =
  /*#__PURE__*/
  _curry2(function none(fn, input) {
    return all$1(_complement(fn), input);
  });

  var none$1 = none;

  /**
   * Returns a function which returns its nth argument.
   *
   * @func
   * @memberOf R
   * @since v0.9.0
   * @category Function
   * @sig Number -> *... -> *
   * @param {Number} n
   * @return {Function}
   * @example
   *
   *      R.nthArg(1)('a', 'b', 'c'); //=> 'b'
   *      R.nthArg(-1)('a', 'b', 'c'); //=> 'c'
   * @symb R.nthArg(-1)(a, b, c) = c
   * @symb R.nthArg(0)(a, b, c) = a
   * @symb R.nthArg(1)(a, b, c) = b
   */

  var nthArg =
  /*#__PURE__*/
  _curry1(function nthArg(n) {
    var arity = n < 0 ? 1 : n + 1;
    return curryN$1(arity, function () {
      return nth$1(n, arguments);
    });
  });

  var nthArg$1 = nthArg;

  /**
   * `o` is a curried composition function that returns a unary function.
   * Like [`compose`](#compose), `o` performs right-to-left function composition.
   * Unlike [`compose`](#compose), the rightmost function passed to `o` will be
   * invoked with only one argument. Also, unlike [`compose`](#compose), `o` is
   * limited to accepting only 2 unary functions. The name o was chosen because
   * of its similarity to the mathematical composition operator ∘.
   *
   * @func
   * @memberOf R
   * @since v0.24.0
   * @category Function
   * @sig (b -> c) -> (a -> b) -> a -> c
   * @param {Function} f
   * @param {Function} g
   * @return {Function}
   * @see R.compose, R.pipe
   * @example
   *
   *      const classyGreeting = name => "The name's " + name.last + ", " + name.first + " " + name.last
   *      const yellGreeting = R.o(R.toUpper, classyGreeting);
   *      yellGreeting({first: 'James', last: 'Bond'}); //=> "THE NAME'S BOND, JAMES BOND"
   *
   *      R.o(R.multiply(10), R.add(10))(-4) //=> 60
   *
   * @symb R.o(f, g, x) = f(g(x))
   */

  var o =
  /*#__PURE__*/
  _curry3(function o(f, g, x) {
    return f(g(x));
  });

  var o$1 = o;

  function _of(x) {
    return [x];
  }

  /**
   * Returns a singleton array containing the value provided.
   *
   * Note this `of` is different from the ES6 `of`; See
   * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/of
   *
   * @func
   * @memberOf R
   * @since v0.3.0
   * @category Function
   * @sig a -> [a]
   * @param {*} x any value
   * @return {Array} An array wrapping `x`.
   * @example
   *
   *      R.of(null); //=> [null]
   *      R.of([42]); //=> [[42]]
   */

  var of =
  /*#__PURE__*/
  _curry1(_of);

  var of$1 = of;

  /**
   * Returns a partial copy of an object omitting the keys specified.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category Object
   * @sig [String] -> {String: *} -> {String: *}
   * @param {Array} names an array of String property names to omit from the new object
   * @param {Object} obj The object to copy from
   * @return {Object} A new object with properties from `names` not on it.
   * @see R.pick
   * @example
   *
   *      R.omit(['a', 'd'], {a: 1, b: 2, c: 3, d: 4}); //=> {b: 2, c: 3}
   */

  var omit =
  /*#__PURE__*/
  _curry2(function omit(names, obj) {
    var result = {};
    var index = {};
    var idx = 0;
    var len = names.length;

    while (idx < len) {
      index[names[idx]] = 1;
      idx += 1;
    }

    for (var prop in obj) {
      if (!index.hasOwnProperty(prop)) {
        result[prop] = obj[prop];
      }
    }

    return result;
  });

  var omit$1 = omit;

  /**
   * Accepts a function `fn` and returns a function that guards invocation of
   * `fn` such that `fn` can only ever be called once, no matter how many times
   * the returned function is invoked. The first value calculated is returned in
   * subsequent invocations.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category Function
   * @sig (a... -> b) -> (a... -> b)
   * @param {Function} fn The function to wrap in a call-only-once wrapper.
   * @return {Function} The wrapped function.
   * @example
   *
   *      const addOneOnce = R.once(x => x + 1);
   *      addOneOnce(10); //=> 11
   *      addOneOnce(addOneOnce(50)); //=> 11
   */

  var once$1 =
  /*#__PURE__*/
  _curry1(function once(fn) {
    var called = false;
    var result;
    return _arity(fn.length, function () {
      if (called) {
        return result;
      }

      called = true;
      result = fn.apply(this, arguments);
      return result;
    });
  });

  var once$2 = once$1;

  function _assertPromise(name, p) {
    if (p == null || !_isFunction(p.then)) {
      throw new TypeError('`' + name + '` expected a Promise, received ' + _toString(p, []));
    }
  }

  /**
   * Returns the result of applying the onFailure function to the value inside
   * a failed promise. This is useful for handling rejected promises
   * inside function compositions.
   *
   * @func
   * @memberOf R
   * @since v0.26.0
   * @category Function
   * @sig (e -> b) -> (Promise e a) -> (Promise e b)
   * @sig (e -> (Promise f b)) -> (Promise e a) -> (Promise f b)
   * @param {Function} onFailure The function to apply. Can return a value or a promise of a value.
   * @param {Promise} p
   * @return {Promise} The result of calling `p.then(null, onFailure)`
   * @see R.then
   * @example
   *
   *      var failedFetch = (id) => Promise.reject('bad ID');
   *      var useDefault = () => ({ firstName: 'Bob', lastName: 'Loblaw' })
   *
   *      //recoverFromFailure :: String -> Promise ({firstName, lastName})
   *      var recoverFromFailure = R.pipe(
   *        failedFetch,
   *        R.otherwise(useDefault),
   *        R.then(R.pick(['firstName', 'lastName'])),
   *      );
   *      recoverFromFailure(12345).then(console.log)
   */

  var otherwise =
  /*#__PURE__*/
  _curry2(function otherwise(f, p) {
    _assertPromise('otherwise', p);

    return p.then(null, f);
  });

  var otherwise$1 = otherwise;

  // transforms the held value with the provided function.

  var Identity = function (x) {
    return {
      value: x,
      map: function (f) {
        return Identity(f(x));
      }
    };
  };
  /**
   * Returns the result of "setting" the portion of the given data structure
   * focused by the given lens to the result of applying the given function to
   * the focused value.
   *
   * @func
   * @memberOf R
   * @since v0.16.0
   * @category Object
   * @typedefn Lens s a = Functor f => (a -> f a) -> s -> f s
   * @sig Lens s a -> (a -> a) -> s -> s
   * @param {Lens} lens
   * @param {*} v
   * @param {*} x
   * @return {*}
   * @see R.prop, R.lensIndex, R.lensProp
   * @example
   *
   *      const headLens = R.lensIndex(0);
   *
   *      R.over(headLens, R.toUpper, ['foo', 'bar', 'baz']); //=> ['FOO', 'bar', 'baz']
   */


  var over =
  /*#__PURE__*/
  _curry3(function over(lens, f, x) {
    // The value returned by the getter function is first transformed with `f`,
    // then set as the value of an `Identity`. This is then mapped over with the
    // setter function of the lens.
    return lens(function (y) {
      return Identity(f(y));
    })(x).value;
  });

  var over$1 = over;

  /**
   * Takes two arguments, `fst` and `snd`, and returns `[fst, snd]`.
   *
   * @func
   * @memberOf R
   * @since v0.18.0
   * @category List
   * @sig a -> b -> (a,b)
   * @param {*} fst
   * @param {*} snd
   * @return {Array}
   * @see R.objOf, R.of
   * @example
   *
   *      R.pair('foo', 'bar'); //=> ['foo', 'bar']
   */

  var pair =
  /*#__PURE__*/
  _curry2(function pair(fst, snd) {
    return [fst, snd];
  });

  var pair$1 = pair;

  function _createPartialApplicator(concat) {
    return _curry2(function (fn, args) {
      return _arity(Math.max(0, fn.length - args.length), function () {
        return fn.apply(this, concat(args, arguments));
      });
    });
  }

  /**
   * Takes a function `f` and a list of arguments, and returns a function `g`.
   * When applied, `g` returns the result of applying `f` to the arguments
   * provided initially followed by the arguments provided to `g`.
   *
   * @func
   * @memberOf R
   * @since v0.10.0
   * @category Function
   * @sig ((a, b, c, ..., n) -> x) -> [a, b, c, ...] -> ((d, e, f, ..., n) -> x)
   * @param {Function} f
   * @param {Array} args
   * @return {Function}
   * @see R.partialRight, R.curry
   * @example
   *
   *      const multiply2 = (a, b) => a * b;
   *      const double = R.partial(multiply2, [2]);
   *      double(2); //=> 4
   *
   *      const greet = (salutation, title, firstName, lastName) =>
   *        salutation + ', ' + title + ' ' + firstName + ' ' + lastName + '!';
   *
   *      const sayHello = R.partial(greet, ['Hello']);
   *      const sayHelloToMs = R.partial(sayHello, ['Ms.']);
   *      sayHelloToMs('Jane', 'Jones'); //=> 'Hello, Ms. Jane Jones!'
   * @symb R.partial(f, [a, b])(c, d) = f(a, b, c, d)
   */

  var partial =
  /*#__PURE__*/
  _createPartialApplicator(_concat);

  var partial$1 = partial;

  /**
   * Takes a function `f` and a list of arguments, and returns a function `g`.
   * When applied, `g` returns the result of applying `f` to the arguments
   * provided to `g` followed by the arguments provided initially.
   *
   * @func
   * @memberOf R
   * @since v0.10.0
   * @category Function
   * @sig ((a, b, c, ..., n) -> x) -> [d, e, f, ..., n] -> ((a, b, c, ...) -> x)
   * @param {Function} f
   * @param {Array} args
   * @return {Function}
   * @see R.partial
   * @example
   *
   *      const greet = (salutation, title, firstName, lastName) =>
   *        salutation + ', ' + title + ' ' + firstName + ' ' + lastName + '!';
   *
   *      const greetMsJaneJones = R.partialRight(greet, ['Ms.', 'Jane', 'Jones']);
   *
   *      greetMsJaneJones('Hello'); //=> 'Hello, Ms. Jane Jones!'
   * @symb R.partialRight(f, [a, b])(c, d) = f(c, d, a, b)
   */

  var partialRight =
  /*#__PURE__*/
  _createPartialApplicator(
  /*#__PURE__*/
  flip$2(_concat));

  var partialRight$1 = partialRight;

  /**
   * Takes a predicate and a list or other `Filterable` object and returns the
   * pair of filterable objects of the same type of elements which do and do not
   * satisfy, the predicate, respectively. Filterable objects include plain objects or any object
   * that has a filter method such as `Array`.
   *
   * @func
   * @memberOf R
   * @since v0.1.4
   * @category List
   * @sig Filterable f => (a -> Boolean) -> f a -> [f a, f a]
   * @param {Function} pred A predicate to determine which side the element belongs to.
   * @param {Array} filterable the list (or other filterable) to partition.
   * @return {Array} An array, containing first the subset of elements that satisfy the
   *         predicate, and second the subset of elements that do not satisfy.
   * @see R.filter, R.reject
   * @example
   *
   *      R.partition(R.includes('s'), ['sss', 'ttt', 'foo', 'bars']);
   *      // => [ [ 'sss', 'bars' ],  [ 'ttt', 'foo' ] ]
   *
   *      R.partition(R.includes('s'), { a: 'sss', b: 'ttt', foo: 'bars' });
   *      // => [ { a: 'sss', foo: 'bars' }, { b: 'ttt' }  ]
   */

  var partition =
  /*#__PURE__*/
  juxt$1([filter$1, reject$1]);
  var partition$1 = partition;

  /**
   * Determines whether a nested path on an object has a specific value, in
   * [`R.equals`](#equals) terms. Most likely used to filter a list.
   *
   * @func
   * @memberOf R
   * @since v0.7.0
   * @category Relation
   * @typedefn Idx = String | Int
   * @sig [Idx] -> a -> {a} -> Boolean
   * @param {Array} path The path of the nested property to use
   * @param {*} val The value to compare the nested property with
   * @param {Object} obj The object to check the nested property in
   * @return {Boolean} `true` if the value equals the nested object property,
   *         `false` otherwise.
   * @example
   *
   *      const user1 = { address: { zipCode: 90210 } };
   *      const user2 = { address: { zipCode: 55555 } };
   *      const user3 = { name: 'Bob' };
   *      const users = [ user1, user2, user3 ];
   *      const isFamous = R.pathEq(['address', 'zipCode'], 90210);
   *      R.filter(isFamous, users); //=> [ user1 ]
   */

  var pathEq =
  /*#__PURE__*/
  _curry3(function pathEq(_path, val, obj) {
    return equals$1(path$1(_path, obj), val);
  });

  var pathEq$1 = pathEq;

  /**
   * If the given, non-null object has a value at the given path, returns the
   * value at that path. Otherwise returns the provided default value.
   *
   * @func
   * @memberOf R
   * @since v0.18.0
   * @category Object
   * @typedefn Idx = String | Int
   * @sig a -> [Idx] -> {a} -> a
   * @param {*} d The default value.
   * @param {Array} p The path to use.
   * @param {Object} obj The object to retrieve the nested property from.
   * @return {*} The data at `path` of the supplied object or the default value.
   * @example
   *
   *      R.pathOr('N/A', ['a', 'b'], {a: {b: 2}}); //=> 2
   *      R.pathOr('N/A', ['a', 'b'], {c: {b: 2}}); //=> "N/A"
   */

  var pathOr =
  /*#__PURE__*/
  _curry3(function pathOr(d, p, obj) {
    return defaultTo$1(d, path$1(p, obj));
  });

  var pathOr$1 = pathOr;

  /**
   * Returns `true` if the specified object property at given path satisfies the
   * given predicate; `false` otherwise.
   *
   * @func
   * @memberOf R
   * @since v0.19.0
   * @category Logic
   * @typedefn Idx = String | Int
   * @sig (a -> Boolean) -> [Idx] -> {a} -> Boolean
   * @param {Function} pred
   * @param {Array} propPath
   * @param {*} obj
   * @return {Boolean}
   * @see R.propSatisfies, R.path
   * @example
   *
   *      R.pathSatisfies(y => y > 0, ['x', 'y'], {x: {y: 2}}); //=> true
   *      R.pathSatisfies(R.is(Object), [], {x: {y: 2}}); //=> true
   */

  var pathSatisfies =
  /*#__PURE__*/
  _curry3(function pathSatisfies(pred, propPath, obj) {
    return pred(path$1(propPath, obj));
  });

  var pathSatisfies$1 = pathSatisfies;

  /**
   * Returns a partial copy of an object containing only the keys specified. If
   * the key does not exist, the property is ignored.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category Object
   * @sig [k] -> {k: v} -> {k: v}
   * @param {Array} names an array of String property names to copy onto a new object
   * @param {Object} obj The object to copy from
   * @return {Object} A new object with only properties from `names` on it.
   * @see R.omit, R.props
   * @example
   *
   *      R.pick(['a', 'd'], {a: 1, b: 2, c: 3, d: 4}); //=> {a: 1, d: 4}
   *      R.pick(['a', 'e', 'f'], {a: 1, b: 2, c: 3, d: 4}); //=> {a: 1}
   */

  var pick =
  /*#__PURE__*/
  _curry2(function pick(names, obj) {
    var result = {};
    var idx = 0;

    while (idx < names.length) {
      if (names[idx] in obj) {
        result[names[idx]] = obj[names[idx]];
      }

      idx += 1;
    }

    return result;
  });

  var pick$1 = pick;

  /**
   * Similar to `pick` except that this one includes a `key: undefined` pair for
   * properties that don't exist.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category Object
   * @sig [k] -> {k: v} -> {k: v}
   * @param {Array} names an array of String property names to copy onto a new object
   * @param {Object} obj The object to copy from
   * @return {Object} A new object with only properties from `names` on it.
   * @see R.pick
   * @example
   *
   *      R.pickAll(['a', 'd'], {a: 1, b: 2, c: 3, d: 4}); //=> {a: 1, d: 4}
   *      R.pickAll(['a', 'e', 'f'], {a: 1, b: 2, c: 3, d: 4}); //=> {a: 1, e: undefined, f: undefined}
   */

  var pickAll =
  /*#__PURE__*/
  _curry2(function pickAll(names, obj) {
    var result = {};
    var idx = 0;
    var len = names.length;

    while (idx < len) {
      var name = names[idx];
      result[name] = obj[name];
      idx += 1;
    }

    return result;
  });

  var pickAll$1 = pickAll;

  /**
   * Returns a partial copy of an object containing only the keys that satisfy
   * the supplied predicate.
   *
   * @func
   * @memberOf R
   * @since v0.8.0
   * @category Object
   * @sig ((v, k) -> Boolean) -> {k: v} -> {k: v}
   * @param {Function} pred A predicate to determine whether or not a key
   *        should be included on the output object.
   * @param {Object} obj The object to copy from
   * @return {Object} A new object with only properties that satisfy `pred`
   *         on it.
   * @see R.pick, R.filter
   * @example
   *
   *      const isUpperCase = (val, key) => key.toUpperCase() === key;
   *      R.pickBy(isUpperCase, {a: 1, b: 2, A: 3, B: 4}); //=> {A: 3, B: 4}
   */

  var pickBy =
  /*#__PURE__*/
  _curry2(function pickBy(test, obj) {
    var result = {};

    for (var prop in obj) {
      if (test(obj[prop], prop, obj)) {
        result[prop] = obj[prop];
      }
    }

    return result;
  });

  var pickBy$1 = pickBy;

  /**
   * Returns the left-to-right Kleisli composition of the provided functions,
   * each of which must return a value of a type supported by [`chain`](#chain).
   *
   * `R.pipeK(f, g, h)` is equivalent to `R.pipe(f, R.chain(g), R.chain(h))`.
   *
   * @func
   * @memberOf R
   * @since v0.16.0
   * @category Function
   * @sig Chain m => ((a -> m b), (b -> m c), ..., (y -> m z)) -> (a -> m z)
   * @param {...Function}
   * @return {Function}
   * @see R.composeK
   * @deprecated since v0.26.0
   * @example
   *
   *      //  parseJson :: String -> Maybe *
   *      //  get :: String -> Object -> Maybe *
   *
   *      //  getStateCode :: Maybe String -> Maybe String
   *      const getStateCode = R.pipeK(
   *        parseJson,
   *        get('user'),
   *        get('address'),
   *        get('state'),
   *        R.compose(Maybe.of, R.toUpper)
   *      );
   *
   *      getStateCode('{"user":{"address":{"state":"ny"}}}');
   *      //=> Just('NY')
   *      getStateCode('[Invalid JSON]');
   *      //=> Nothing()
   * @symb R.pipeK(f, g, h)(a) = R.chain(h, R.chain(g, f(a)))
   */

  function pipeK() {
    if (arguments.length === 0) {
      throw new Error('pipeK requires at least one argument');
    }

    return composeK.apply(this, reverse$1(arguments));
  }

  /**
   * Returns a new list with the given element at the front, followed by the
   * contents of the list.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category List
   * @sig a -> [a] -> [a]
   * @param {*} el The item to add to the head of the output list.
   * @param {Array} list The array to add to the tail of the output list.
   * @return {Array} A new array.
   * @see R.append
   * @example
   *
   *      R.prepend('fee', ['fi', 'fo', 'fum']); //=> ['fee', 'fi', 'fo', 'fum']
   */

  var prepend =
  /*#__PURE__*/
  _curry2(function prepend(el, list) {
    return _concat([el], list);
  });

  var prepend$1 = prepend;

  /**
   * Multiplies together all the elements of a list.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category Math
   * @sig [Number] -> Number
   * @param {Array} list An array of numbers
   * @return {Number} The product of all the numbers in the list.
   * @see R.reduce
   * @example
   *
   *      R.product([2,4,6,8,100,1]); //=> 38400
   */

  var product =
  /*#__PURE__*/
  reduce$1(multiply$1, 1);
  var product$1 = product;

  /**
   * Accepts a function `fn` and a list of transformer functions and returns a
   * new curried function. When the new function is invoked, it calls the
   * function `fn` with parameters consisting of the result of calling each
   * supplied handler on successive arguments to the new function.
   *
   * If more arguments are passed to the returned function than transformer
   * functions, those arguments are passed directly to `fn` as additional
   * parameters. If you expect additional arguments that don't need to be
   * transformed, although you can ignore them, it's best to pass an identity
   * function so that the new function reports the correct arity.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category Function
   * @sig ((x1, x2, ...) -> z) -> [(a -> x1), (b -> x2), ...] -> (a -> b -> ... -> z)
   * @param {Function} fn The function to wrap.
   * @param {Array} transformers A list of transformer functions
   * @return {Function} The wrapped function.
   * @see R.converge
   * @example
   *
   *      R.useWith(Math.pow, [R.identity, R.identity])(3, 4); //=> 81
   *      R.useWith(Math.pow, [R.identity, R.identity])(3)(4); //=> 81
   *      R.useWith(Math.pow, [R.dec, R.inc])(3, 4); //=> 32
   *      R.useWith(Math.pow, [R.dec, R.inc])(3)(4); //=> 32
   * @symb R.useWith(f, [g, h])(a, b) = f(g(a), h(b))
   */

  var useWith =
  /*#__PURE__*/
  _curry2(function useWith(fn, transformers) {
    return curryN$1(transformers.length, function () {
      var args = [];
      var idx = 0;

      while (idx < transformers.length) {
        args.push(transformers[idx].call(this, arguments[idx]));
        idx += 1;
      }

      return fn.apply(this, args.concat(Array.prototype.slice.call(arguments, transformers.length)));
    });
  });

  var useWith$1 = useWith;

  /**
   * Reasonable analog to SQL `select` statement.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category Object
   * @category Relation
   * @sig [k] -> [{k: v}] -> [{k: v}]
   * @param {Array} props The property names to project
   * @param {Array} objs The objects to query
   * @return {Array} An array of objects with just the `props` properties.
   * @example
   *
   *      const abby = {name: 'Abby', age: 7, hair: 'blond', grade: 2};
   *      const fred = {name: 'Fred', age: 12, hair: 'brown', grade: 7};
   *      const kids = [abby, fred];
   *      R.project(['name', 'grade'], kids); //=> [{name: 'Abby', grade: 2}, {name: 'Fred', grade: 7}]
   */

  var project =
  /*#__PURE__*/
  useWith$1(_map, [pickAll$1, identity$1]); // passing `identity` gives correct arity

  var project$1 = project;

  /**
   * Returns `true` if the specified object property is equal, in
   * [`R.equals`](#equals) terms, to the given value; `false` otherwise.
   * You can test multiple properties with [`R.whereEq`](#whereEq).
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category Relation
   * @sig String -> a -> Object -> Boolean
   * @param {String} name
   * @param {*} val
   * @param {*} obj
   * @return {Boolean}
   * @see R.whereEq, R.propSatisfies, R.equals
   * @example
   *
   *      const abby = {name: 'Abby', age: 7, hair: 'blond'};
   *      const fred = {name: 'Fred', age: 12, hair: 'brown'};
   *      const rusty = {name: 'Rusty', age: 10, hair: 'brown'};
   *      const alois = {name: 'Alois', age: 15, disposition: 'surly'};
   *      const kids = [abby, fred, rusty, alois];
   *      const hasBrownHair = R.propEq('hair', 'brown');
   *      R.filter(hasBrownHair, kids); //=> [fred, rusty]
   */

  var propEq =
  /*#__PURE__*/
  _curry3(function propEq(name, val, obj) {
    return equals$1(val, obj[name]);
  });

  var propEq$1 = propEq;

  /**
   * Returns `true` if the specified object property is of the given type;
   * `false` otherwise.
   *
   * @func
   * @memberOf R
   * @since v0.16.0
   * @category Type
   * @sig Type -> String -> Object -> Boolean
   * @param {Function} type
   * @param {String} name
   * @param {*} obj
   * @return {Boolean}
   * @see R.is, R.propSatisfies
   * @example
   *
   *      R.propIs(Number, 'x', {x: 1, y: 2});  //=> true
   *      R.propIs(Number, 'x', {x: 'foo'});    //=> false
   *      R.propIs(Number, 'x', {});            //=> false
   */

  var propIs =
  /*#__PURE__*/
  _curry3(function propIs(type, name, obj) {
    return is$1(type, obj[name]);
  });

  var propIs$1 = propIs;

  /**
   * If the given, non-null object has an own property with the specified name,
   * returns the value of that property. Otherwise returns the provided default
   * value.
   *
   * @func
   * @memberOf R
   * @since v0.6.0
   * @category Object
   * @sig a -> String -> Object -> a
   * @param {*} val The default value.
   * @param {String} p The name of the property to return.
   * @param {Object} obj The object to query.
   * @return {*} The value of given property of the supplied object or the default value.
   * @example
   *
   *      const alice = {
   *        name: 'ALICE',
   *        age: 101
   *      };
   *      const favorite = R.prop('favoriteLibrary');
   *      const favoriteWithDefault = R.propOr('Ramda', 'favoriteLibrary');
   *
   *      favorite(alice);  //=> undefined
   *      favoriteWithDefault(alice);  //=> 'Ramda'
   */

  var propOr =
  /*#__PURE__*/
  _curry3(function propOr(val, p, obj) {
    return pathOr$1(val, [p], obj);
  });

  var propOr$1 = propOr;

  /**
   * Returns `true` if the specified object property satisfies the given
   * predicate; `false` otherwise. You can test multiple properties with
   * [`R.where`](#where).
   *
   * @func
   * @memberOf R
   * @since v0.16.0
   * @category Logic
   * @sig (a -> Boolean) -> String -> {String: a} -> Boolean
   * @param {Function} pred
   * @param {String} name
   * @param {*} obj
   * @return {Boolean}
   * @see R.where, R.propEq, R.propIs
   * @example
   *
   *      R.propSatisfies(x => x > 0, 'x', {x: 1, y: 2}); //=> true
   */

  var propSatisfies =
  /*#__PURE__*/
  _curry3(function propSatisfies(pred, name, obj) {
    return pred(obj[name]);
  });

  var propSatisfies$1 = propSatisfies;

  /**
   * Acts as multiple `prop`: array of keys in, array of values out. Preserves
   * order.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category Object
   * @sig [k] -> {k: v} -> [v]
   * @param {Array} ps The property names to fetch
   * @param {Object} obj The object to query
   * @return {Array} The corresponding values or partially applied function.
   * @example
   *
   *      R.props(['x', 'y'], {x: 1, y: 2}); //=> [1, 2]
   *      R.props(['c', 'a', 'b'], {b: 2, a: 1}); //=> [undefined, 1, 2]
   *
   *      const fullName = R.compose(R.join(' '), R.props(['first', 'last']));
   *      fullName({last: 'Bullet-Tooth', age: 33, first: 'Tony'}); //=> 'Tony Bullet-Tooth'
   */

  var props =
  /*#__PURE__*/
  _curry2(function props(ps, obj) {
    return ps.map(function (p) {
      return path$1([p], obj);
    });
  });

  var props$1 = props;

  /**
   * Returns a list of numbers from `from` (inclusive) to `to` (exclusive).
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category List
   * @sig Number -> Number -> [Number]
   * @param {Number} from The first number in the list.
   * @param {Number} to One more than the last number in the list.
   * @return {Array} The list of numbers in the set `[a, b)`.
   * @example
   *
   *      R.range(1, 5);    //=> [1, 2, 3, 4]
   *      R.range(50, 53);  //=> [50, 51, 52]
   */

  var range =
  /*#__PURE__*/
  _curry2(function range(from, to) {
    if (!(_isNumber(from) && _isNumber(to))) {
      throw new TypeError('Both arguments to range must be numbers');
    }

    var result = [];
    var n = from;

    while (n < to) {
      result.push(n);
      n += 1;
    }

    return result;
  });

  var range$1 = range;

  /**
   * Returns a single item by iterating through the list, successively calling
   * the iterator function and passing it an accumulator value and the current
   * value from the array, and then passing the result to the next call.
   *
   * Similar to [`reduce`](#reduce), except moves through the input list from the
   * right to the left.
   *
   * The iterator function receives two values: *(value, acc)*, while the arguments'
   * order of `reduce`'s iterator function is *(acc, value)*.
   *
   * Note: `R.reduceRight` does not skip deleted or unassigned indices (sparse
   * arrays), unlike the native `Array.prototype.reduceRight` method. For more details
   * on this behavior, see:
   * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduceRight#Description
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category List
   * @sig ((a, b) -> b) -> b -> [a] -> b
   * @param {Function} fn The iterator function. Receives two values, the current element from the array
   *        and the accumulator.
   * @param {*} acc The accumulator value.
   * @param {Array} list The list to iterate over.
   * @return {*} The final, accumulated value.
   * @see R.reduce, R.addIndex
   * @example
   *
   *      R.reduceRight(R.subtract, 0, [1, 2, 3, 4]) // => (1 - (2 - (3 - (4 - 0)))) = -2
   *      //    -               -2
   *      //   / \              / \
   *      //  1   -            1   3
   *      //     / \              / \
   *      //    2   -     ==>    2  -1
   *      //       / \              / \
   *      //      3   -            3   4
   *      //         / \              / \
   *      //        4   0            4   0
   *
   * @symb R.reduceRight(f, a, [b, c, d]) = f(b, f(c, f(d, a)))
   */

  var reduceRight =
  /*#__PURE__*/
  _curry3(function reduceRight(fn, acc, list) {
    var idx = list.length - 1;

    while (idx >= 0) {
      acc = fn(list[idx], acc);
      idx -= 1;
    }

    return acc;
  });

  var reduceRight$1 = reduceRight;

  /**
   * Like [`reduce`](#reduce), `reduceWhile` returns a single item by iterating
   * through the list, successively calling the iterator function. `reduceWhile`
   * also takes a predicate that is evaluated before each step. If the predicate
   * returns `false`, it "short-circuits" the iteration and returns the current
   * value of the accumulator.
   *
   * @func
   * @memberOf R
   * @since v0.22.0
   * @category List
   * @sig ((a, b) -> Boolean) -> ((a, b) -> a) -> a -> [b] -> a
   * @param {Function} pred The predicate. It is passed the accumulator and the
   *        current element.
   * @param {Function} fn The iterator function. Receives two values, the
   *        accumulator and the current element.
   * @param {*} a The accumulator value.
   * @param {Array} list The list to iterate over.
   * @return {*} The final, accumulated value.
   * @see R.reduce, R.reduced
   * @example
   *
   *      const isOdd = (acc, x) => x % 2 === 1;
   *      const xs = [1, 3, 5, 60, 777, 800];
   *      R.reduceWhile(isOdd, R.add, 0, xs); //=> 9
   *
   *      const ys = [2, 4, 6]
   *      R.reduceWhile(isOdd, R.add, 111, ys); //=> 111
   */

  var reduceWhile =
  /*#__PURE__*/
  _curryN(4, [], function _reduceWhile(pred, fn, a, list) {
    return _reduce(function (acc, x) {
      return pred(acc, x) ? fn(acc, x) : _reduced(acc);
    }, a, list);
  });

  var reduceWhile$1 = reduceWhile;

  /**
   * Returns a value wrapped to indicate that it is the final value of the reduce
   * and transduce functions. The returned value should be considered a black
   * box: the internal structure is not guaranteed to be stable.
   *
   * Note: this optimization is only available to the below functions:
   * - [`reduce`](#reduce)
   * - [`reduceWhile`](#reduceWhile)
   * - [`transduce`](#transduce)
   *
   * @func
   * @memberOf R
   * @since v0.15.0
   * @category List
   * @sig a -> *
   * @param {*} x The final value of the reduce.
   * @return {*} The wrapped value.
   * @see R.reduce, R.reduceWhile, R.transduce
   * @example
   *
   *     R.reduce(
   *       (acc, item) => item > 3 ? R.reduced(acc) : acc.concat(item),
   *       [],
   *       [1, 2, 3, 4, 5]) // [1, 2, 3]
   */

  var reduced =
  /*#__PURE__*/
  _curry1(_reduced);

  var reduced$1 = reduced;

  /**
   * Calls an input function `n` times, returning an array containing the results
   * of those function calls.
   *
   * `fn` is passed one argument: The current value of `n`, which begins at `0`
   * and is gradually incremented to `n - 1`.
   *
   * @func
   * @memberOf R
   * @since v0.2.3
   * @category List
   * @sig (Number -> a) -> Number -> [a]
   * @param {Function} fn The function to invoke. Passed one argument, the current value of `n`.
   * @param {Number} n A value between `0` and `n - 1`. Increments after each function call.
   * @return {Array} An array containing the return values of all calls to `fn`.
   * @see R.repeat
   * @example
   *
   *      R.times(R.identity, 5); //=> [0, 1, 2, 3, 4]
   * @symb R.times(f, 0) = []
   * @symb R.times(f, 1) = [f(0)]
   * @symb R.times(f, 2) = [f(0), f(1)]
   */

  var times =
  /*#__PURE__*/
  _curry2(function times(fn, n) {
    var len = Number(n);
    var idx = 0;
    var list;

    if (len < 0 || isNaN(len)) {
      throw new RangeError('n must be a non-negative number');
    }

    list = new Array(len);

    while (idx < len) {
      list[idx] = fn(idx);
      idx += 1;
    }

    return list;
  });

  var times$1 = times;

  /**
   * Returns a fixed list of size `n` containing a specified identical value.
   *
   * @func
   * @memberOf R
   * @since v0.1.1
   * @category List
   * @sig a -> n -> [a]
   * @param {*} value The value to repeat.
   * @param {Number} n The desired size of the output list.
   * @return {Array} A new array containing `n` `value`s.
   * @see R.times
   * @example
   *
   *      R.repeat('hi', 5); //=> ['hi', 'hi', 'hi', 'hi', 'hi']
   *
   *      const obj = {};
   *      const repeatedObjs = R.repeat(obj, 5); //=> [{}, {}, {}, {}, {}]
   *      repeatedObjs[0] === repeatedObjs[1]; //=> true
   * @symb R.repeat(a, 0) = []
   * @symb R.repeat(a, 1) = [a]
   * @symb R.repeat(a, 2) = [a, a]
   */

  var repeat =
  /*#__PURE__*/
  _curry2(function repeat(value, n) {
    return times$1(always$1(value), n);
  });

  var repeat$1 = repeat;

  /**
   * Replace a substring or regex match in a string with a replacement.
   *
   * The first two parameters correspond to the parameters of the
   * `String.prototype.replace()` function, so the second parameter can also be a
   * function.
   *
   * @func
   * @memberOf R
   * @since v0.7.0
   * @category String
   * @sig RegExp|String -> String -> String -> String
   * @param {RegExp|String} pattern A regular expression or a substring to match.
   * @param {String} replacement The string to replace the matches with.
   * @param {String} str The String to do the search and replacement in.
   * @return {String} The result.
   * @example
   *
   *      R.replace('foo', 'bar', 'foo foo foo'); //=> 'bar foo foo'
   *      R.replace(/foo/, 'bar', 'foo foo foo'); //=> 'bar foo foo'
   *
   *      // Use the "g" (global) flag to replace all occurrences:
   *      R.replace(/foo/g, 'bar', 'foo foo foo'); //=> 'bar bar bar'
   */

  var replace =
  /*#__PURE__*/
  _curry3(function replace(regex, replacement, str) {
    return str.replace(regex, replacement);
  });

  var replace$1 = replace;

  /**
   * Scan is similar to [`reduce`](#reduce), but returns a list of successively
   * reduced values from the left
   *
   * @func
   * @memberOf R
   * @since v0.10.0
   * @category List
   * @sig ((a, b) -> a) -> a -> [b] -> [a]
   * @param {Function} fn The iterator function. Receives two values, the accumulator and the
   *        current element from the array
   * @param {*} acc The accumulator value.
   * @param {Array} list The list to iterate over.
   * @return {Array} A list of all intermediately reduced values.
   * @see R.reduce, R.mapAccum
   * @example
   *
   *      const numbers = [1, 2, 3, 4];
   *      const factorials = R.scan(R.multiply, 1, numbers); //=> [1, 1, 2, 6, 24]
   * @symb R.scan(f, a, [b, c]) = [a, f(a, b), f(f(a, b), c)]
   */

  var scan =
  /*#__PURE__*/
  _curry3(function scan(fn, acc, list) {
    var idx = 0;
    var len = list.length;
    var result = [acc];

    while (idx < len) {
      acc = fn(acc, list[idx]);
      result[idx + 1] = acc;
      idx += 1;
    }

    return result;
  });

  var scan$1 = scan;

  /**
   * Transforms a [Traversable](https://github.com/fantasyland/fantasy-land#traversable)
   * of [Applicative](https://github.com/fantasyland/fantasy-land#applicative) into an
   * Applicative of Traversable.
   *
   * Dispatches to the `sequence` method of the second argument, if present.
   *
   * @func
   * @memberOf R
   * @since v0.19.0
   * @category List
   * @sig (Applicative f, Traversable t) => (a -> f a) -> t (f a) -> f (t a)
   * @param {Function} of
   * @param {*} traversable
   * @return {*}
   * @see R.traverse
   * @example
   *
   *      R.sequence(Maybe.of, [Just(1), Just(2), Just(3)]);   //=> Just([1, 2, 3])
   *      R.sequence(Maybe.of, [Just(1), Just(2), Nothing()]); //=> Nothing()
   *
   *      R.sequence(R.of, Just([1, 2, 3])); //=> [Just(1), Just(2), Just(3)]
   *      R.sequence(R.of, Nothing());       //=> [Nothing()]
   */

  var sequence =
  /*#__PURE__*/
  _curry2(function sequence(of, traversable) {
    return typeof traversable.sequence === 'function' ? traversable.sequence(of) : reduceRight$1(function (x, acc) {
      return ap$1(map$3(prepend$1, x), acc);
    }, of([]), traversable);
  });

  var sequence$1 = sequence;

  /**
   * Returns the result of "setting" the portion of the given data structure
   * focused by the given lens to the given value.
   *
   * @func
   * @memberOf R
   * @since v0.16.0
   * @category Object
   * @typedefn Lens s a = Functor f => (a -> f a) -> s -> f s
   * @sig Lens s a -> a -> s -> s
   * @param {Lens} lens
   * @param {*} v
   * @param {*} x
   * @return {*}
   * @see R.prop, R.lensIndex, R.lensProp
   * @example
   *
   *      const xLens = R.lensProp('x');
   *
   *      R.set(xLens, 4, {x: 1, y: 2});  //=> {x: 4, y: 2}
   *      R.set(xLens, 8, {x: 1, y: 2});  //=> {x: 8, y: 2}
   */

  var set =
  /*#__PURE__*/
  _curry3(function set(lens, v, x) {
    return over$1(lens, always$1(v), x);
  });

  var set$1 = set;

  /**
   * Returns a copy of the list, sorted according to the comparator function,
   * which should accept two values at a time and return a negative number if the
   * first value is smaller, a positive number if it's larger, and zero if they
   * are equal. Please note that this is a **copy** of the list. It does not
   * modify the original.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category List
   * @sig ((a, a) -> Number) -> [a] -> [a]
   * @param {Function} comparator A sorting function :: a -> b -> Int
   * @param {Array} list The list to sort
   * @return {Array} a new array with its elements sorted by the comparator function.
   * @example
   *
   *      const diff = function(a, b) { return a - b; };
   *      R.sort(diff, [4,2,7,5]); //=> [2, 4, 5, 7]
   */

  var sort$1 =
  /*#__PURE__*/
  _curry2(function sort(comparator, list) {
    return Array.prototype.slice.call(list, 0).sort(comparator);
  });

  var sort$2 = sort$1;

  /**
   * Sorts the list according to the supplied function.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category Relation
   * @sig Ord b => (a -> b) -> [a] -> [a]
   * @param {Function} fn
   * @param {Array} list The list to sort.
   * @return {Array} A new list sorted by the keys generated by `fn`.
   * @example
   *
   *      const sortByFirstItem = R.sortBy(R.prop(0));
   *      const pairs = [[-1, 1], [-2, 2], [-3, 3]];
   *      sortByFirstItem(pairs); //=> [[-3, 3], [-2, 2], [-1, 1]]
   *
   *      const sortByNameCaseInsensitive = R.sortBy(R.compose(R.toLower, R.prop('name')));
   *      const alice = {
   *        name: 'ALICE',
   *        age: 101
   *      };
   *      const bob = {
   *        name: 'Bob',
   *        age: -10
   *      };
   *      const clara = {
   *        name: 'clara',
   *        age: 314.159
   *      };
   *      const people = [clara, bob, alice];
   *      sortByNameCaseInsensitive(people); //=> [alice, bob, clara]
   */

  var sortBy =
  /*#__PURE__*/
  _curry2(function sortBy(fn, list) {
    return Array.prototype.slice.call(list, 0).sort(function (a, b) {
      var aa = fn(a);
      var bb = fn(b);
      return aa < bb ? -1 : aa > bb ? 1 : 0;
    });
  });

  var sortBy$1 = sortBy;

  /**
   * Sorts a list according to a list of comparators.
   *
   * @func
   * @memberOf R
   * @since v0.23.0
   * @category Relation
   * @sig [(a, a) -> Number] -> [a] -> [a]
   * @param {Array} functions A list of comparator functions.
   * @param {Array} list The list to sort.
   * @return {Array} A new list sorted according to the comarator functions.
   * @example
   *
   *      const alice = {
   *        name: 'alice',
   *        age: 40
   *      };
   *      const bob = {
   *        name: 'bob',
   *        age: 30
   *      };
   *      const clara = {
   *        name: 'clara',
   *        age: 40
   *      };
   *      const people = [clara, bob, alice];
   *      const ageNameSort = R.sortWith([
   *        R.descend(R.prop('age')),
   *        R.ascend(R.prop('name'))
   *      ]);
   *      ageNameSort(people); //=> [alice, clara, bob]
   */

  var sortWith =
  /*#__PURE__*/
  _curry2(function sortWith(fns, list) {
    return Array.prototype.slice.call(list, 0).sort(function (a, b) {
      var result = 0;
      var i = 0;

      while (result === 0 && i < fns.length) {
        result = fns[i](a, b);
        i += 1;
      }

      return result;
    });
  });

  var sortWith$1 = sortWith;

  /**
   * Splits a string into an array of strings based on the given
   * separator.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category String
   * @sig (String | RegExp) -> String -> [String]
   * @param {String|RegExp} sep The pattern.
   * @param {String} str The string to separate into an array.
   * @return {Array} The array of strings from `str` separated by `sep`.
   * @see R.join
   * @example
   *
   *      const pathComponents = R.split('/');
   *      R.tail(pathComponents('/usr/local/bin/node')); //=> ['usr', 'local', 'bin', 'node']
   *
   *      R.split('.', 'a.b.c.xyz.d'); //=> ['a', 'b', 'c', 'xyz', 'd']
   */

  var split$1 =
  /*#__PURE__*/
  invoker$1(1, 'split');
  var split$2 = split$1;

  /**
   * Splits a given list or string at a given index.
   *
   * @func
   * @memberOf R
   * @since v0.19.0
   * @category List
   * @sig Number -> [a] -> [[a], [a]]
   * @sig Number -> String -> [String, String]
   * @param {Number} index The index where the array/string is split.
   * @param {Array|String} array The array/string to be split.
   * @return {Array}
   * @example
   *
   *      R.splitAt(1, [1, 2, 3]);          //=> [[1], [2, 3]]
   *      R.splitAt(5, 'hello world');      //=> ['hello', ' world']
   *      R.splitAt(-1, 'foobar');          //=> ['fooba', 'r']
   */

  var splitAt =
  /*#__PURE__*/
  _curry2(function splitAt(index, array) {
    return [slice$3(0, index, array), slice$3(index, length$1(array), array)];
  });

  var splitAt$1 = splitAt;

  /**
   * Splits a collection into slices of the specified length.
   *
   * @func
   * @memberOf R
   * @since v0.16.0
   * @category List
   * @sig Number -> [a] -> [[a]]
   * @sig Number -> String -> [String]
   * @param {Number} n
   * @param {Array} list
   * @return {Array}
   * @example
   *
   *      R.splitEvery(3, [1, 2, 3, 4, 5, 6, 7]); //=> [[1, 2, 3], [4, 5, 6], [7]]
   *      R.splitEvery(3, 'foobarbaz'); //=> ['foo', 'bar', 'baz']
   */

  var splitEvery =
  /*#__PURE__*/
  _curry2(function splitEvery(n, list) {
    if (n <= 0) {
      throw new Error('First argument to splitEvery must be a positive integer');
    }

    var result = [];
    var idx = 0;

    while (idx < list.length) {
      result.push(slice$3(idx, idx += n, list));
    }

    return result;
  });

  var splitEvery$1 = splitEvery;

  /**
   * Takes a list and a predicate and returns a pair of lists with the following properties:
   *
   *  - the result of concatenating the two output lists is equivalent to the input list;
   *  - none of the elements of the first output list satisfies the predicate; and
   *  - if the second output list is non-empty, its first element satisfies the predicate.
   *
   * @func
   * @memberOf R
   * @since v0.19.0
   * @category List
   * @sig (a -> Boolean) -> [a] -> [[a], [a]]
   * @param {Function} pred The predicate that determines where the array is split.
   * @param {Array} list The array to be split.
   * @return {Array}
   * @example
   *
   *      R.splitWhen(R.equals(2), [1, 2, 3, 1, 2, 3]);   //=> [[1], [2, 3, 1, 2, 3]]
   */

  var splitWhen =
  /*#__PURE__*/
  _curry2(function splitWhen(pred, list) {
    var idx = 0;
    var len = list.length;
    var prefix = [];

    while (idx < len && !pred(list[idx])) {
      prefix.push(list[idx]);
      idx += 1;
    }

    return [prefix, Array.prototype.slice.call(list, idx)];
  });

  var splitWhen$1 = splitWhen;

  /**
   * Checks if a list starts with the provided sublist.
   *
   * Similarly, checks if a string starts with the provided substring.
   *
   * @func
   * @memberOf R
   * @since v0.24.0
   * @category List
   * @sig [a] -> [a] -> Boolean
   * @sig String -> String -> Boolean
   * @param {*} prefix
   * @param {*} list
   * @return {Boolean}
   * @see R.endsWith
   * @example
   *
   *      R.startsWith('a', 'abc')                //=> true
   *      R.startsWith('b', 'abc')                //=> false
   *      R.startsWith(['a'], ['a', 'b', 'c'])    //=> true
   *      R.startsWith(['b'], ['a', 'b', 'c'])    //=> false
   */

  var startsWith =
  /*#__PURE__*/
  _curry2(function (prefix, list) {
    return equals$1(take$1(prefix.length, list), prefix);
  });

  var startsWith$1 = startsWith;

  /**
   * Subtracts its second argument from its first argument.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category Math
   * @sig Number -> Number -> Number
   * @param {Number} a The first value.
   * @param {Number} b The second value.
   * @return {Number} The result of `a - b`.
   * @see R.add
   * @example
   *
   *      R.subtract(10, 8); //=> 2
   *
   *      const minus5 = R.subtract(R.__, 5);
   *      minus5(17); //=> 12
   *
   *      const complementaryAngle = R.subtract(90);
   *      complementaryAngle(30); //=> 60
   *      complementaryAngle(72); //=> 18
   */

  var subtract =
  /*#__PURE__*/
  _curry2(function subtract(a, b) {
    return Number(a) - Number(b);
  });

  var subtract$1 = subtract;

  /**
   * Finds the set (i.e. no duplicates) of all elements contained in the first or
   * second list, but not both.
   *
   * @func
   * @memberOf R
   * @since v0.19.0
   * @category Relation
   * @sig [*] -> [*] -> [*]
   * @param {Array} list1 The first list.
   * @param {Array} list2 The second list.
   * @return {Array} The elements in `list1` or `list2`, but not both.
   * @see R.symmetricDifferenceWith, R.difference, R.differenceWith
   * @example
   *
   *      R.symmetricDifference([1,2,3,4], [7,6,5,4,3]); //=> [1,2,7,6,5]
   *      R.symmetricDifference([7,6,5,4,3], [1,2,3,4]); //=> [7,6,5,1,2]
   */

  var symmetricDifference =
  /*#__PURE__*/
  _curry2(function symmetricDifference(list1, list2) {
    return concat$1(difference$2(list1, list2), difference$2(list2, list1));
  });

  var symmetricDifference$1 = symmetricDifference;

  /**
   * Finds the set (i.e. no duplicates) of all elements contained in the first or
   * second list, but not both. Duplication is determined according to the value
   * returned by applying the supplied predicate to two list elements.
   *
   * @func
   * @memberOf R
   * @since v0.19.0
   * @category Relation
   * @sig ((a, a) -> Boolean) -> [a] -> [a] -> [a]
   * @param {Function} pred A predicate used to test whether two items are equal.
   * @param {Array} list1 The first list.
   * @param {Array} list2 The second list.
   * @return {Array} The elements in `list1` or `list2`, but not both.
   * @see R.symmetricDifference, R.difference, R.differenceWith
   * @example
   *
   *      const eqA = R.eqBy(R.prop('a'));
   *      const l1 = [{a: 1}, {a: 2}, {a: 3}, {a: 4}];
   *      const l2 = [{a: 3}, {a: 4}, {a: 5}, {a: 6}];
   *      R.symmetricDifferenceWith(eqA, l1, l2); //=> [{a: 1}, {a: 2}, {a: 5}, {a: 6}]
   */

  var symmetricDifferenceWith =
  /*#__PURE__*/
  _curry3(function symmetricDifferenceWith(pred, list1, list2) {
    return concat$1(differenceWith$1(pred, list1, list2), differenceWith$1(pred, list2, list1));
  });

  var symmetricDifferenceWith$1 = symmetricDifferenceWith;

  /**
   * Returns a new list containing the last `n` elements of a given list, passing
   * each value to the supplied predicate function, and terminating when the
   * predicate function returns `false`. Excludes the element that caused the
   * predicate function to fail. The predicate function is passed one argument:
   * *(value)*.
   *
   * @func
   * @memberOf R
   * @since v0.16.0
   * @category List
   * @sig (a -> Boolean) -> [a] -> [a]
   * @sig (a -> Boolean) -> String -> String
   * @param {Function} fn The function called per iteration.
   * @param {Array} xs The collection to iterate over.
   * @return {Array} A new array.
   * @see R.dropLastWhile, R.addIndex
   * @example
   *
   *      const isNotOne = x => x !== 1;
   *
   *      R.takeLastWhile(isNotOne, [1, 2, 3, 4]); //=> [2, 3, 4]
   *
   *      R.takeLastWhile(x => x !== 'R' , 'Ramda'); //=> 'amda'
   */

  var takeLastWhile =
  /*#__PURE__*/
  _curry2(function takeLastWhile(fn, xs) {
    var idx = xs.length - 1;

    while (idx >= 0 && fn(xs[idx])) {
      idx -= 1;
    }

    return slice$3(idx + 1, Infinity, xs);
  });

  var takeLastWhile$1 = takeLastWhile;

  var XTakeWhile =
  /*#__PURE__*/
  function () {
    function XTakeWhile(f, xf) {
      this.xf = xf;
      this.f = f;
    }

    XTakeWhile.prototype['@@transducer/init'] = _xfBase.init;
    XTakeWhile.prototype['@@transducer/result'] = _xfBase.result;

    XTakeWhile.prototype['@@transducer/step'] = function (result, input) {
      return this.f(input) ? this.xf['@@transducer/step'](result, input) : _reduced(result);
    };

    return XTakeWhile;
  }();

  var _xtakeWhile =
  /*#__PURE__*/
  _curry2(function _xtakeWhile(f, xf) {
    return new XTakeWhile(f, xf);
  });

  var _xtakeWhile$1 = _xtakeWhile;

  /**
   * Returns a new list containing the first `n` elements of a given list,
   * passing each value to the supplied predicate function, and terminating when
   * the predicate function returns `false`. Excludes the element that caused the
   * predicate function to fail. The predicate function is passed one argument:
   * *(value)*.
   *
   * Dispatches to the `takeWhile` method of the second argument, if present.
   *
   * Acts as a transducer if a transformer is given in list position.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category List
   * @sig (a -> Boolean) -> [a] -> [a]
   * @sig (a -> Boolean) -> String -> String
   * @param {Function} fn The function called per iteration.
   * @param {Array} xs The collection to iterate over.
   * @return {Array} A new array.
   * @see R.dropWhile, R.transduce, R.addIndex
   * @example
   *
   *      const isNotFour = x => x !== 4;
   *
   *      R.takeWhile(isNotFour, [1, 2, 3, 4, 3, 2, 1]); //=> [1, 2, 3]
   *
   *      R.takeWhile(x => x !== 'd' , 'Ramda'); //=> 'Ram'
   */

  var takeWhile =
  /*#__PURE__*/
  _curry2(
  /*#__PURE__*/
  _dispatchable(['takeWhile'], _xtakeWhile$1, function takeWhile(fn, xs) {
    var idx = 0;
    var len = xs.length;

    while (idx < len && fn(xs[idx])) {
      idx += 1;
    }

    return slice$3(0, idx, xs);
  }));

  var takeWhile$1 = takeWhile;

  var XTap =
  /*#__PURE__*/
  function () {
    function XTap(f, xf) {
      this.xf = xf;
      this.f = f;
    }

    XTap.prototype['@@transducer/init'] = _xfBase.init;
    XTap.prototype['@@transducer/result'] = _xfBase.result;

    XTap.prototype['@@transducer/step'] = function (result, input) {
      this.f(input);
      return this.xf['@@transducer/step'](result, input);
    };

    return XTap;
  }();

  var _xtap =
  /*#__PURE__*/
  _curry2(function _xtap(f, xf) {
    return new XTap(f, xf);
  });

  var _xtap$1 = _xtap;

  /**
   * Runs the given function with the supplied object, then returns the object.
   *
   * Acts as a transducer if a transformer is given as second parameter.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category Function
   * @sig (a -> *) -> a -> a
   * @param {Function} fn The function to call with `x`. The return value of `fn` will be thrown away.
   * @param {*} x
   * @return {*} `x`.
   * @example
   *
   *      const sayX = x => console.log('x is ' + x);
   *      R.tap(sayX, 100); //=> 100
   *      // logs 'x is 100'
   * @symb R.tap(f, a) = a
   */

  var tap =
  /*#__PURE__*/
  _curry2(
  /*#__PURE__*/
  _dispatchable([], _xtap$1, function tap(fn, x) {
    fn(x);
    return x;
  }));

  var tap$1 = tap;

  function _isRegExp(x) {
    return Object.prototype.toString.call(x) === '[object RegExp]';
  }

  /**
   * Determines whether a given string matches a given regular expression.
   *
   * @func
   * @memberOf R
   * @since v0.12.0
   * @category String
   * @sig RegExp -> String -> Boolean
   * @param {RegExp} pattern
   * @param {String} str
   * @return {Boolean}
   * @see R.match
   * @example
   *
   *      R.test(/^x/, 'xyz'); //=> true
   *      R.test(/^y/, 'xyz'); //=> false
   */

  var test =
  /*#__PURE__*/
  _curry2(function test(pattern, str) {
    if (!_isRegExp(pattern)) {
      throw new TypeError('‘test’ requires a value of type RegExp as its first argument; received ' + toString$2(pattern));
    }

    return _cloneRegExp(pattern).test(str);
  });

  var test$1 = test;

  /**
   * Returns the result of applying the onSuccess function to the value inside
   * a successfully resolved promise. This is useful for working with promises
   * inside function compositions.
   *
   * @func
   * @memberOf R
   * @since v0.27.1
   * @category Function
   * @sig (a -> b) -> (Promise e a) -> (Promise e b)
   * @sig (a -> (Promise e b)) -> (Promise e a) -> (Promise e b)
   * @param {Function} onSuccess The function to apply. Can return a value or a promise of a value.
   * @param {Promise} p
   * @return {Promise} The result of calling `p.then(onSuccess)`
   * @see R.otherwise
   * @example
   *
   *      var makeQuery = (email) => ({ query: { email }});
   *
   *      //getMemberName :: String -> Promise ({firstName, lastName})
   *      var getMemberName = R.pipe(
   *        makeQuery,
   *        fetchMember,
   *        R.andThen(R.pick(['firstName', 'lastName']))
   *      );
   */

  var andThen =
  /*#__PURE__*/
  _curry2(function andThen(f, p) {
    _assertPromise('andThen', p);

    return p.then(f);
  });

  var andThen$1 = andThen;

  /**
   * The lower case version of a string.
   *
   * @func
   * @memberOf R
   * @since v0.9.0
   * @category String
   * @sig String -> String
   * @param {String} str The string to lower case.
   * @return {String} The lower case version of `str`.
   * @see R.toUpper
   * @example
   *
   *      R.toLower('XYZ'); //=> 'xyz'
   */

  var toLower =
  /*#__PURE__*/
  invoker$1(0, 'toLowerCase');
  var toLower$1 = toLower;

  /**
   * Converts an object into an array of key, value arrays. Only the object's
   * own properties are used.
   * Note that the order of the output array is not guaranteed to be consistent
   * across different JS platforms.
   *
   * @func
   * @memberOf R
   * @since v0.4.0
   * @category Object
   * @sig {String: *} -> [[String,*]]
   * @param {Object} obj The object to extract from
   * @return {Array} An array of key, value arrays from the object's own properties.
   * @see R.fromPairs
   * @example
   *
   *      R.toPairs({a: 1, b: 2, c: 3}); //=> [['a', 1], ['b', 2], ['c', 3]]
   */

  var toPairs =
  /*#__PURE__*/
  _curry1(function toPairs(obj) {
    var pairs = [];

    for (var prop in obj) {
      if (_has(prop, obj)) {
        pairs[pairs.length] = [prop, obj[prop]];
      }
    }

    return pairs;
  });

  var toPairs$1 = toPairs;

  /**
   * Converts an object into an array of key, value arrays. The object's own
   * properties and prototype properties are used. Note that the order of the
   * output array is not guaranteed to be consistent across different JS
   * platforms.
   *
   * @func
   * @memberOf R
   * @since v0.4.0
   * @category Object
   * @sig {String: *} -> [[String,*]]
   * @param {Object} obj The object to extract from
   * @return {Array} An array of key, value arrays from the object's own
   *         and prototype properties.
   * @example
   *
   *      const F = function() { this.x = 'X'; };
   *      F.prototype.y = 'Y';
   *      const f = new F();
   *      R.toPairsIn(f); //=> [['x','X'], ['y','Y']]
   */

  var toPairsIn =
  /*#__PURE__*/
  _curry1(function toPairsIn(obj) {
    var pairs = [];

    for (var prop in obj) {
      pairs[pairs.length] = [prop, obj[prop]];
    }

    return pairs;
  });

  var toPairsIn$1 = toPairsIn;

  /**
   * The upper case version of a string.
   *
   * @func
   * @memberOf R
   * @since v0.9.0
   * @category String
   * @sig String -> String
   * @param {String} str The string to upper case.
   * @return {String} The upper case version of `str`.
   * @see R.toLower
   * @example
   *
   *      R.toUpper('abc'); //=> 'ABC'
   */

  var toUpper =
  /*#__PURE__*/
  invoker$1(0, 'toUpperCase');
  var toUpper$1 = toUpper;

  /**
   * Initializes a transducer using supplied iterator function. Returns a single
   * item by iterating through the list, successively calling the transformed
   * iterator function and passing it an accumulator value and the current value
   * from the array, and then passing the result to the next call.
   *
   * The iterator function receives two values: *(acc, value)*. It will be
   * wrapped as a transformer to initialize the transducer. A transformer can be
   * passed directly in place of an iterator function. In both cases, iteration
   * may be stopped early with the [`R.reduced`](#reduced) function.
   *
   * A transducer is a function that accepts a transformer and returns a
   * transformer and can be composed directly.
   *
   * A transformer is an an object that provides a 2-arity reducing iterator
   * function, step, 0-arity initial value function, init, and 1-arity result
   * extraction function, result. The step function is used as the iterator
   * function in reduce. The result function is used to convert the final
   * accumulator into the return type and in most cases is
   * [`R.identity`](#identity). The init function can be used to provide an
   * initial accumulator, but is ignored by transduce.
   *
   * The iteration is performed with [`R.reduce`](#reduce) after initializing the transducer.
   *
   * @func
   * @memberOf R
   * @since v0.12.0
   * @category List
   * @sig (c -> c) -> ((a, b) -> a) -> a -> [b] -> a
   * @param {Function} xf The transducer function. Receives a transformer and returns a transformer.
   * @param {Function} fn The iterator function. Receives two values, the accumulator and the
   *        current element from the array. Wrapped as transformer, if necessary, and used to
   *        initialize the transducer
   * @param {*} acc The initial accumulator value.
   * @param {Array} list The list to iterate over.
   * @return {*} The final, accumulated value.
   * @see R.reduce, R.reduced, R.into
   * @example
   *
   *      const numbers = [1, 2, 3, 4];
   *      const transducer = R.compose(R.map(R.add(1)), R.take(2));
   *      R.transduce(transducer, R.flip(R.append), [], numbers); //=> [2, 3]
   *
   *      const isOdd = (x) => x % 2 === 1;
   *      const firstOddTransducer = R.compose(R.filter(isOdd), R.take(1));
   *      R.transduce(firstOddTransducer, R.flip(R.append), [], R.range(0, 100)); //=> [1]
   */

  var transduce =
  /*#__PURE__*/
  curryN$1(4, function transduce(xf, fn, acc, list) {
    return _reduce(xf(typeof fn === 'function' ? _xwrap(fn) : fn), acc, list);
  });
  var transduce$1 = transduce;

  /**
   * Transposes the rows and columns of a 2D list.
   * When passed a list of `n` lists of length `x`,
   * returns a list of `x` lists of length `n`.
   *
   *
   * @func
   * @memberOf R
   * @since v0.19.0
   * @category List
   * @sig [[a]] -> [[a]]
   * @param {Array} list A 2D list
   * @return {Array} A 2D list
   * @example
   *
   *      R.transpose([[1, 'a'], [2, 'b'], [3, 'c']]) //=> [[1, 2, 3], ['a', 'b', 'c']]
   *      R.transpose([[1, 2, 3], ['a', 'b', 'c']]) //=> [[1, 'a'], [2, 'b'], [3, 'c']]
   *
   *      // If some of the rows are shorter than the following rows, their elements are skipped:
   *      R.transpose([[10, 11], [20], [], [30, 31, 32]]) //=> [[10, 20, 30], [11, 31], [32]]
   * @symb R.transpose([[a], [b], [c]]) = [a, b, c]
   * @symb R.transpose([[a, b], [c, d]]) = [[a, c], [b, d]]
   * @symb R.transpose([[a, b], [c]]) = [[a, c], [b]]
   */

  var transpose =
  /*#__PURE__*/
  _curry1(function transpose(outerlist) {
    var i = 0;
    var result = [];

    while (i < outerlist.length) {
      var innerlist = outerlist[i];
      var j = 0;

      while (j < innerlist.length) {
        if (typeof result[j] === 'undefined') {
          result[j] = [];
        }

        result[j].push(innerlist[j]);
        j += 1;
      }

      i += 1;
    }

    return result;
  });

  var transpose$1 = transpose;

  /**
   * Maps an [Applicative](https://github.com/fantasyland/fantasy-land#applicative)-returning
   * function over a [Traversable](https://github.com/fantasyland/fantasy-land#traversable),
   * then uses [`sequence`](#sequence) to transform the resulting Traversable of Applicative
   * into an Applicative of Traversable.
   *
   * Dispatches to the `traverse` method of the third argument, if present.
   *
   * @func
   * @memberOf R
   * @since v0.19.0
   * @category List
   * @sig (Applicative f, Traversable t) => (a -> f a) -> (a -> f b) -> t a -> f (t b)
   * @param {Function} of
   * @param {Function} f
   * @param {*} traversable
   * @return {*}
   * @see R.sequence
   * @example
   *
   *      // Returns `Maybe.Nothing` if the given divisor is `0`
   *      const safeDiv = n => d => d === 0 ? Maybe.Nothing() : Maybe.Just(n / d)
   *
   *      R.traverse(Maybe.of, safeDiv(10), [2, 4, 5]); //=> Maybe.Just([5, 2.5, 2])
   *      R.traverse(Maybe.of, safeDiv(10), [2, 0, 5]); //=> Maybe.Nothing
   */

  var traverse =
  /*#__PURE__*/
  _curry3(function traverse(of, f, traversable) {
    return typeof traversable['fantasy-land/traverse'] === 'function' ? traversable['fantasy-land/traverse'](f, of) : sequence$1(of, map$3(f, traversable));
  });

  var traverse$1 = traverse;

  var ws = '\x09\x0A\x0B\x0C\x0D\x20\xA0\u1680\u2000\u2001\u2002\u2003' + '\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000\u2028' + '\u2029\uFEFF';
  var zeroWidth = '\u200b';
  var hasProtoTrim = typeof String.prototype.trim === 'function';
  /**
   * Removes (strips) whitespace from both ends of the string.
   *
   * @func
   * @memberOf R
   * @since v0.6.0
   * @category String
   * @sig String -> String
   * @param {String} str The string to trim.
   * @return {String} Trimmed version of `str`.
   * @example
   *
   *      R.trim('   xyz  '); //=> 'xyz'
   *      R.map(R.trim, R.split(',', 'x, y, z')); //=> ['x', 'y', 'z']
   */

  var trim = !hasProtoTrim ||
  /*#__PURE__*/
  ws.trim() || !
  /*#__PURE__*/
  zeroWidth.trim() ?
  /*#__PURE__*/
  _curry1(function trim(str) {
    var beginRx = new RegExp('^[' + ws + '][' + ws + ']*');
    var endRx = new RegExp('[' + ws + '][' + ws + ']*$');
    return str.replace(beginRx, '').replace(endRx, '');
  }) :
  /*#__PURE__*/
  _curry1(function trim(str) {
    return str.trim();
  });
  var trim$1 = trim;

  /**
   * `tryCatch` takes two functions, a `tryer` and a `catcher`. The returned
   * function evaluates the `tryer`; if it does not throw, it simply returns the
   * result. If the `tryer` *does* throw, the returned function evaluates the
   * `catcher` function and returns its result. Note that for effective
   * composition with this function, both the `tryer` and `catcher` functions
   * must return the same type of results.
   *
   * @func
   * @memberOf R
   * @since v0.20.0
   * @category Function
   * @sig (...x -> a) -> ((e, ...x) -> a) -> (...x -> a)
   * @param {Function} tryer The function that may throw.
   * @param {Function} catcher The function that will be evaluated if `tryer` throws.
   * @return {Function} A new function that will catch exceptions and send then to the catcher.
   * @example
   *
   *      R.tryCatch(R.prop('x'), R.F)({x: true}); //=> true
   *      R.tryCatch(() => { throw 'foo'}, R.always('catched'))('bar') // => 'catched'
   *      R.tryCatch(R.times(R.identity), R.always([]))('s') // => []
   *      R.tryCatch(() => { throw 'this is not a valid value'}, (err, value)=>({error : err,  value }))('bar') // => {'error': 'this is not a valid value', 'value': 'bar'}
   */

  var tryCatch =
  /*#__PURE__*/
  _curry2(function _tryCatch(tryer, catcher) {
    return _arity(tryer.length, function () {
      try {
        return tryer.apply(this, arguments);
      } catch (e) {
        return catcher.apply(this, _concat([e], arguments));
      }
    });
  });

  var tryCatch$1 = tryCatch;

  /**
   * Takes a function `fn`, which takes a single array argument, and returns a
   * function which:
   *
   *   - takes any number of positional arguments;
   *   - passes these arguments to `fn` as an array; and
   *   - returns the result.
   *
   * In other words, `R.unapply` derives a variadic function from a function which
   * takes an array. `R.unapply` is the inverse of [`R.apply`](#apply).
   *
   * @func
   * @memberOf R
   * @since v0.8.0
   * @category Function
   * @sig ([*...] -> a) -> (*... -> a)
   * @param {Function} fn
   * @return {Function}
   * @see R.apply
   * @example
   *
   *      R.unapply(JSON.stringify)(1, 2, 3); //=> '[1,2,3]'
   * @symb R.unapply(f)(a, b) = f([a, b])
   */

  var unapply =
  /*#__PURE__*/
  _curry1(function unapply(fn) {
    return function () {
      return fn(Array.prototype.slice.call(arguments, 0));
    };
  });

  var unapply$1 = unapply;

  /**
   * Wraps a function of any arity (including nullary) in a function that accepts
   * exactly 1 parameter. Any extraneous parameters will not be passed to the
   * supplied function.
   *
   * @func
   * @memberOf R
   * @since v0.2.0
   * @category Function
   * @sig (* -> b) -> (a -> b)
   * @param {Function} fn The function to wrap.
   * @return {Function} A new function wrapping `fn`. The new function is guaranteed to be of
   *         arity 1.
   * @see R.binary, R.nAry
   * @example
   *
   *      const takesTwoArgs = function(a, b) {
   *        return [a, b];
   *      };
   *      takesTwoArgs.length; //=> 2
   *      takesTwoArgs(1, 2); //=> [1, 2]
   *
   *      const takesOneArg = R.unary(takesTwoArgs);
   *      takesOneArg.length; //=> 1
   *      // Only 1 argument is passed to the wrapped function
   *      takesOneArg(1, 2); //=> [1, undefined]
   * @symb R.unary(f)(a, b, c) = f(a)
   */

  var unary =
  /*#__PURE__*/
  _curry1(function unary(fn) {
    return nAry$1(1, fn);
  });

  var unary$1 = unary;

  /**
   * Returns a function of arity `n` from a (manually) curried function.
   *
   * @func
   * @memberOf R
   * @since v0.14.0
   * @category Function
   * @sig Number -> (a -> b) -> (a -> c)
   * @param {Number} length The arity for the returned function.
   * @param {Function} fn The function to uncurry.
   * @return {Function} A new function.
   * @see R.curry
   * @example
   *
   *      const addFour = a => b => c => d => a + b + c + d;
   *
   *      const uncurriedAddFour = R.uncurryN(4, addFour);
   *      uncurriedAddFour(1, 2, 3, 4); //=> 10
   */

  var uncurryN =
  /*#__PURE__*/
  _curry2(function uncurryN(depth, fn) {
    return curryN$1(depth, function () {
      var currentDepth = 1;
      var value = fn;
      var idx = 0;
      var endIdx;

      while (currentDepth <= depth && typeof value === 'function') {
        endIdx = currentDepth === depth ? arguments.length : idx + value.length;
        value = value.apply(this, Array.prototype.slice.call(arguments, idx, endIdx));
        currentDepth += 1;
        idx = endIdx;
      }

      return value;
    });
  });

  var uncurryN$1 = uncurryN;

  /**
   * Builds a list from a seed value. Accepts an iterator function, which returns
   * either false to stop iteration or an array of length 2 containing the value
   * to add to the resulting list and the seed to be used in the next call to the
   * iterator function.
   *
   * The iterator function receives one argument: *(seed)*.
   *
   * @func
   * @memberOf R
   * @since v0.10.0
   * @category List
   * @sig (a -> [b]) -> * -> [b]
   * @param {Function} fn The iterator function. receives one argument, `seed`, and returns
   *        either false to quit iteration or an array of length two to proceed. The element
   *        at index 0 of this array will be added to the resulting array, and the element
   *        at index 1 will be passed to the next call to `fn`.
   * @param {*} seed The seed value.
   * @return {Array} The final list.
   * @example
   *
   *      const f = n => n > 50 ? false : [-n, n + 10];
   *      R.unfold(f, 10); //=> [-10, -20, -30, -40, -50]
   * @symb R.unfold(f, x) = [f(x)[0], f(f(x)[1])[0], f(f(f(x)[1])[1])[0], ...]
   */

  var unfold =
  /*#__PURE__*/
  _curry2(function unfold(fn, seed) {
    var pair = fn(seed);
    var result = [];

    while (pair && pair.length) {
      result[result.length] = pair[0];
      pair = fn(pair[1]);
    }

    return result;
  });

  var unfold$1 = unfold;

  /**
   * Combines two lists into a set (i.e. no duplicates) composed of the elements
   * of each list.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category Relation
   * @sig [*] -> [*] -> [*]
   * @param {Array} as The first list.
   * @param {Array} bs The second list.
   * @return {Array} The first and second lists concatenated, with
   *         duplicates removed.
   * @example
   *
   *      R.union([1, 2, 3], [2, 3, 4]); //=> [1, 2, 3, 4]
   */

  var union =
  /*#__PURE__*/
  _curry2(
  /*#__PURE__*/
  compose(uniq$1, _concat));

  var union$1 = union;

  /**
   * Returns a new list containing only one copy of each element in the original
   * list, based upon the value returned by applying the supplied predicate to
   * two list elements. Prefers the first item if two items compare equal based
   * on the predicate.
   *
   * @func
   * @memberOf R
   * @since v0.2.0
   * @category List
   * @sig ((a, a) -> Boolean) -> [a] -> [a]
   * @param {Function} pred A predicate used to test whether two items are equal.
   * @param {Array} list The array to consider.
   * @return {Array} The list of unique items.
   * @example
   *
   *      const strEq = R.eqBy(String);
   *      R.uniqWith(strEq)([1, '1', 2, 1]); //=> [1, 2]
   *      R.uniqWith(strEq)([{}, {}]);       //=> [{}]
   *      R.uniqWith(strEq)([1, '1', 1]);    //=> [1]
   *      R.uniqWith(strEq)(['1', 1, 1]);    //=> ['1']
   */

  var uniqWith =
  /*#__PURE__*/
  _curry2(function uniqWith(pred, list) {
    var idx = 0;
    var len = list.length;
    var result = [];
    var item;

    while (idx < len) {
      item = list[idx];

      if (!_includesWith(pred, item, result)) {
        result[result.length] = item;
      }

      idx += 1;
    }

    return result;
  });

  var uniqWith$1 = uniqWith;

  /**
   * Combines two lists into a set (i.e. no duplicates) composed of the elements
   * of each list. Duplication is determined according to the value returned by
   * applying the supplied predicate to two list elements.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category Relation
   * @sig ((a, a) -> Boolean) -> [*] -> [*] -> [*]
   * @param {Function} pred A predicate used to test whether two items are equal.
   * @param {Array} list1 The first list.
   * @param {Array} list2 The second list.
   * @return {Array} The first and second lists concatenated, with
   *         duplicates removed.
   * @see R.union
   * @example
   *
   *      const l1 = [{a: 1}, {a: 2}];
   *      const l2 = [{a: 1}, {a: 4}];
   *      R.unionWith(R.eqBy(R.prop('a')), l1, l2); //=> [{a: 1}, {a: 2}, {a: 4}]
   */

  var unionWith =
  /*#__PURE__*/
  _curry3(function unionWith(pred, list1, list2) {
    return uniqWith$1(pred, _concat(list1, list2));
  });

  var unionWith$1 = unionWith;

  /**
   * Tests the final argument by passing it to the given predicate function. If
   * the predicate is not satisfied, the function will return the result of
   * calling the `whenFalseFn` function with the same argument. If the predicate
   * is satisfied, the argument is returned as is.
   *
   * @func
   * @memberOf R
   * @since v0.18.0
   * @category Logic
   * @sig (a -> Boolean) -> (a -> a) -> a -> a
   * @param {Function} pred        A predicate function
   * @param {Function} whenFalseFn A function to invoke when the `pred` evaluates
   *                               to a falsy value.
   * @param {*}        x           An object to test with the `pred` function and
   *                               pass to `whenFalseFn` if necessary.
   * @return {*} Either `x` or the result of applying `x` to `whenFalseFn`.
   * @see R.ifElse, R.when, R.cond
   * @example
   *
   *      let safeInc = R.unless(R.isNil, R.inc);
   *      safeInc(null); //=> null
   *      safeInc(1); //=> 2
   */

  var unless =
  /*#__PURE__*/
  _curry3(function unless(pred, whenFalseFn, x) {
    return pred(x) ? x : whenFalseFn(x);
  });

  var unless$1 = unless;

  /**
   * Shorthand for `R.chain(R.identity)`, which removes one level of nesting from
   * any [Chain](https://github.com/fantasyland/fantasy-land#chain).
   *
   * @func
   * @memberOf R
   * @since v0.3.0
   * @category List
   * @sig Chain c => c (c a) -> c a
   * @param {*} list
   * @return {*}
   * @see R.flatten, R.chain
   * @example
   *
   *      R.unnest([1, [2], [[3]]]); //=> [1, 2, [3]]
   *      R.unnest([[1, 2], [3, 4], [5, 6]]); //=> [1, 2, 3, 4, 5, 6]
   */

  var unnest =
  /*#__PURE__*/
  chain$1(_identity);
  var unnest$1 = unnest;

  /**
   * Takes a predicate, a transformation function, and an initial value,
   * and returns a value of the same type as the initial value.
   * It does so by applying the transformation until the predicate is satisfied,
   * at which point it returns the satisfactory value.
   *
   * @func
   * @memberOf R
   * @since v0.20.0
   * @category Logic
   * @sig (a -> Boolean) -> (a -> a) -> a -> a
   * @param {Function} pred A predicate function
   * @param {Function} fn The iterator function
   * @param {*} init Initial value
   * @return {*} Final value that satisfies predicate
   * @example
   *
   *      R.until(R.gt(R.__, 100), R.multiply(2))(1) // => 128
   */

  var until =
  /*#__PURE__*/
  _curry3(function until(pred, fn, init) {
    var val = init;

    while (!pred(val)) {
      val = fn(val);
    }

    return val;
  });

  var until$1 = until;

  /**
   * Returns a list of all the properties, including prototype properties, of the
   * supplied object.
   * Note that the order of the output array is not guaranteed to be consistent
   * across different JS platforms.
   *
   * @func
   * @memberOf R
   * @since v0.2.0
   * @category Object
   * @sig {k: v} -> [v]
   * @param {Object} obj The object to extract values from
   * @return {Array} An array of the values of the object's own and prototype properties.
   * @see R.values, R.keysIn
   * @example
   *
   *      const F = function() { this.x = 'X'; };
   *      F.prototype.y = 'Y';
   *      const f = new F();
   *      R.valuesIn(f); //=> ['X', 'Y']
   */

  var valuesIn =
  /*#__PURE__*/
  _curry1(function valuesIn(obj) {
    var prop;
    var vs = [];

    for (prop in obj) {
      vs[vs.length] = obj[prop];
    }

    return vs;
  });

  var valuesIn$1 = valuesIn;

  var Const = function (x) {
    return {
      value: x,
      'fantasy-land/map': function () {
        return this;
      }
    };
  };
  /**
   * Returns a "view" of the given data structure, determined by the given lens.
   * The lens's focus determines which portion of the data structure is visible.
   *
   * @func
   * @memberOf R
   * @since v0.16.0
   * @category Object
   * @typedefn Lens s a = Functor f => (a -> f a) -> s -> f s
   * @sig Lens s a -> s -> a
   * @param {Lens} lens
   * @param {*} x
   * @return {*}
   * @see R.prop, R.lensIndex, R.lensProp
   * @example
   *
   *      const xLens = R.lensProp('x');
   *
   *      R.view(xLens, {x: 1, y: 2});  //=> 1
   *      R.view(xLens, {x: 4, y: 2});  //=> 4
   */


  var view =
  /*#__PURE__*/
  _curry2(function view(lens, x) {
    // Using `Const` effectively ignores the setter function of the `lens`,
    // leaving the value returned by the getter function unmodified.
    return lens(Const)(x).value;
  });

  var view$1 = view;

  /**
   * Tests the final argument by passing it to the given predicate function. If
   * the predicate is satisfied, the function will return the result of calling
   * the `whenTrueFn` function with the same argument. If the predicate is not
   * satisfied, the argument is returned as is.
   *
   * @func
   * @memberOf R
   * @since v0.18.0
   * @category Logic
   * @sig (a -> Boolean) -> (a -> a) -> a -> a
   * @param {Function} pred       A predicate function
   * @param {Function} whenTrueFn A function to invoke when the `condition`
   *                              evaluates to a truthy value.
   * @param {*}        x          An object to test with the `pred` function and
   *                              pass to `whenTrueFn` if necessary.
   * @return {*} Either `x` or the result of applying `x` to `whenTrueFn`.
   * @see R.ifElse, R.unless, R.cond
   * @example
   *
   *      // truncate :: String -> String
   *      const truncate = R.when(
   *        R.propSatisfies(R.gt(R.__, 10), 'length'),
   *        R.pipe(R.take(10), R.append('…'), R.join(''))
   *      );
   *      truncate('12345');         //=> '12345'
   *      truncate('0123456789ABC'); //=> '0123456789…'
   */

  var when =
  /*#__PURE__*/
  _curry3(function when(pred, whenTrueFn, x) {
    return pred(x) ? whenTrueFn(x) : x;
  });

  var when$1 = when;

  /**
   * Takes a spec object and a test object; returns true if the test satisfies
   * the spec. Each of the spec's own properties must be a predicate function.
   * Each predicate is applied to the value of the corresponding property of the
   * test object. `where` returns true if all the predicates return true, false
   * otherwise.
   *
   * `where` is well suited to declaratively expressing constraints for other
   * functions such as [`filter`](#filter) and [`find`](#find).
   *
   * @func
   * @memberOf R
   * @since v0.1.1
   * @category Object
   * @sig {String: (* -> Boolean)} -> {String: *} -> Boolean
   * @param {Object} spec
   * @param {Object} testObj
   * @return {Boolean}
   * @see R.propSatisfies, R.whereEq
   * @example
   *
   *      // pred :: Object -> Boolean
   *      const pred = R.where({
   *        a: R.equals('foo'),
   *        b: R.complement(R.equals('bar')),
   *        x: R.gt(R.__, 10),
   *        y: R.lt(R.__, 20)
   *      });
   *
   *      pred({a: 'foo', b: 'xxx', x: 11, y: 19}); //=> true
   *      pred({a: 'xxx', b: 'xxx', x: 11, y: 19}); //=> false
   *      pred({a: 'foo', b: 'bar', x: 11, y: 19}); //=> false
   *      pred({a: 'foo', b: 'xxx', x: 10, y: 19}); //=> false
   *      pred({a: 'foo', b: 'xxx', x: 11, y: 20}); //=> false
   */

  var where =
  /*#__PURE__*/
  _curry2(function where(spec, testObj) {
    for (var prop in spec) {
      if (_has(prop, spec) && !spec[prop](testObj[prop])) {
        return false;
      }
    }

    return true;
  });

  var where$1 = where;

  /**
   * Takes a spec object and a test object; returns true if the test satisfies
   * the spec, false otherwise. An object satisfies the spec if, for each of the
   * spec's own properties, accessing that property of the object gives the same
   * value (in [`R.equals`](#equals) terms) as accessing that property of the
   * spec.
   *
   * `whereEq` is a specialization of [`where`](#where).
   *
   * @func
   * @memberOf R
   * @since v0.14.0
   * @category Object
   * @sig {String: *} -> {String: *} -> Boolean
   * @param {Object} spec
   * @param {Object} testObj
   * @return {Boolean}
   * @see R.propEq, R.where
   * @example
   *
   *      // pred :: Object -> Boolean
   *      const pred = R.whereEq({a: 1, b: 2});
   *
   *      pred({a: 1});              //=> false
   *      pred({a: 1, b: 2});        //=> true
   *      pred({a: 1, b: 2, c: 3});  //=> true
   *      pred({a: 1, b: 1});        //=> false
   */

  var whereEq =
  /*#__PURE__*/
  _curry2(function whereEq(spec, testObj) {
    return where$1(map$3(equals$1, spec), testObj);
  });

  var whereEq$1 = whereEq;

  /**
   * Returns a new list without values in the first argument.
   * [`R.equals`](#equals) is used to determine equality.
   *
   * Acts as a transducer if a transformer is given in list position.
   *
   * @func
   * @memberOf R
   * @since v0.19.0
   * @category List
   * @sig [a] -> [a] -> [a]
   * @param {Array} list1 The values to be removed from `list2`.
   * @param {Array} list2 The array to remove values from.
   * @return {Array} The new array without values in `list1`.
   * @see R.transduce, R.difference, R.remove
   * @example
   *
   *      R.without([1, 2], [1, 2, 1, 3, 4]); //=> [3, 4]
   */

  var without =
  /*#__PURE__*/
  _curry2(function (xs, list) {
    return reject$1(flip$2(_includes)(xs), list);
  });

  var without$1 = without;

  /**
   * Exclusive disjunction logical operation.
   * Returns `true` if one of the arguments is truthy and the other is falsy.
   * Otherwise, it returns `false`.
   *
   * @func
   * @memberOf R
   * @since v0.27.1
   * @category Logic
   * @sig a -> b -> Boolean
   * @param {Any} a
   * @param {Any} b
   * @return {Boolean} true if one of the arguments is truthy and the other is falsy
   * @see R.or, R.and
   * @example
   *
   *      R.xor(true, true); //=> false
   *      R.xor(true, false); //=> true
   *      R.xor(false, true); //=> true
   *      R.xor(false, false); //=> false
   */

  var xor$5 =
  /*#__PURE__*/
  _curry2(function xor(a, b) {
    return Boolean(!a ^ !b);
  });

  var xor$6 = xor$5;

  /**
   * Creates a new list out of the two supplied by creating each possible pair
   * from the lists.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category List
   * @sig [a] -> [b] -> [[a,b]]
   * @param {Array} as The first list.
   * @param {Array} bs The second list.
   * @return {Array} The list made by combining each possible pair from
   *         `as` and `bs` into pairs (`[a, b]`).
   * @example
   *
   *      R.xprod([1, 2], ['a', 'b']); //=> [[1, 'a'], [1, 'b'], [2, 'a'], [2, 'b']]
   * @symb R.xprod([a, b], [c, d]) = [[a, c], [a, d], [b, c], [b, d]]
   */

  var xprod =
  /*#__PURE__*/
  _curry2(function xprod(a, b) {
    // = xprodWith(prepend); (takes about 3 times as long...)
    var idx = 0;
    var ilen = a.length;
    var j;
    var jlen = b.length;
    var result = [];

    while (idx < ilen) {
      j = 0;

      while (j < jlen) {
        result[result.length] = [a[idx], b[j]];
        j += 1;
      }

      idx += 1;
    }

    return result;
  });

  var xprod$1 = xprod;

  /**
   * Creates a new list out of the two supplied by pairing up equally-positioned
   * items from both lists. The returned list is truncated to the length of the
   * shorter of the two input lists.
   * Note: `zip` is equivalent to `zipWith(function(a, b) { return [a, b] })`.
   *
   * @func
   * @memberOf R
   * @since v0.1.0
   * @category List
   * @sig [a] -> [b] -> [[a,b]]
   * @param {Array} list1 The first array to consider.
   * @param {Array} list2 The second array to consider.
   * @return {Array} The list made by pairing up same-indexed elements of `list1` and `list2`.
   * @example
   *
   *      R.zip([1, 2, 3], ['a', 'b', 'c']); //=> [[1, 'a'], [2, 'b'], [3, 'c']]
   * @symb R.zip([a, b, c], [d, e, f]) = [[a, d], [b, e], [c, f]]
   */

  var zip =
  /*#__PURE__*/
  _curry2(function zip(a, b) {
    var rv = [];
    var idx = 0;
    var len = Math.min(a.length, b.length);

    while (idx < len) {
      rv[idx] = [a[idx], b[idx]];
      idx += 1;
    }

    return rv;
  });

  var zip$1 = zip;

  /**
   * Creates a new object out of a list of keys and a list of values.
   * Key/value pairing is truncated to the length of the shorter of the two lists.
   * Note: `zipObj` is equivalent to `pipe(zip, fromPairs)`.
   *
   * @func
   * @memberOf R
   * @since v0.3.0
   * @category List
   * @sig [String] -> [*] -> {String: *}
   * @param {Array} keys The array that will be properties on the output object.
   * @param {Array} values The list of values on the output object.
   * @return {Object} The object made by pairing up same-indexed elements of `keys` and `values`.
   * @example
   *
   *      R.zipObj(['a', 'b', 'c'], [1, 2, 3]); //=> {a: 1, b: 2, c: 3}
   */

  var zipObj =
  /*#__PURE__*/
  _curry2(function zipObj(keys, values) {
    var idx = 0;
    var len = Math.min(keys.length, values.length);
    var out = {};

    while (idx < len) {
      out[keys[idx]] = values[idx];
      idx += 1;
    }

    return out;
  });

  var zipObj$1 = zipObj;

  /**
   * Creates a new list out of the two supplied by applying the function to each
   * equally-positioned pair in the lists. The returned list is truncated to the
   * length of the shorter of the two input lists.
   *
   * @function
   * @memberOf R
   * @since v0.1.0
   * @category List
   * @sig ((a, b) -> c) -> [a] -> [b] -> [c]
   * @param {Function} fn The function used to combine the two elements into one value.
   * @param {Array} list1 The first array to consider.
   * @param {Array} list2 The second array to consider.
   * @return {Array} The list made by combining same-indexed elements of `list1` and `list2`
   *         using `fn`.
   * @example
   *
   *      const f = (x, y) => {
   *        // ...
   *      };
   *      R.zipWith(f, [1, 2, 3], ['a', 'b', 'c']);
   *      //=> [f(1, 'a'), f(2, 'b'), f(3, 'c')]
   * @symb R.zipWith(fn, [a, b, c], [d, e, f]) = [fn(a, d), fn(b, e), fn(c, f)]
   */

  var zipWith =
  /*#__PURE__*/
  _curry3(function zipWith(fn, a, b) {
    var rv = [];
    var idx = 0;
    var len = Math.min(a.length, b.length);

    while (idx < len) {
      rv[idx] = fn(a[idx], b[idx]);
      idx += 1;
    }

    return rv;
  });

  var zipWith$1 = zipWith;

  /**
   * Creates a thunk out of a function. A thunk delays a calculation until
   * its result is needed, providing lazy evaluation of arguments.
   *
   * @func
   * @memberOf R
   * @since v0.26.0
   * @category Function
   * @sig ((a, b, ..., j) -> k) -> (a, b, ..., j) -> (() -> k)
   * @param {Function} fn A function to wrap in a thunk
   * @return {Function} Expects arguments for `fn` and returns a new function
   *  that, when called, applies those arguments to `fn`.
   * @see R.partial, R.partialRight
   * @example
   *
   *      R.thunkify(R.identity)(42)(); //=> 42
   *      R.thunkify((a, b) => a + b)(25, 17)(); //=> 42
   */

  var thunkify =
  /*#__PURE__*/
  _curry1(function thunkify(fn) {
    return curryN$1(fn.length, function createThunk() {
      var fnArgs = arguments;
      return function invokeThunk() {
        return fn.apply(this, fnArgs);
      };
    });
  });

  var thunkify$1 = thunkify;

  var es = /*#__PURE__*/Object.freeze({
    __proto__: null,
    F: F$1,
    T: T$1,
    __: __$2,
    add: add$1,
    addIndex: addIndex$1,
    adjust: adjust$1,
    all: all$1,
    allPass: allPass$1,
    always: always$1,
    and: and$1,
    andThen: andThen$1,
    any: any$1,
    anyPass: anyPass$1,
    ap: ap$1,
    aperture: aperture$1,
    append: append$1,
    apply: apply$1,
    applySpec: applySpec$1,
    applyTo: applyTo$1,
    ascend: ascend$1,
    assoc: assoc$1,
    assocPath: assocPath$1,
    binary: binary$1,
    bind: bind$1,
    both: both$1,
    call: call$1,
    chain: chain$1,
    clamp: clamp$1,
    clone: clone$1,
    comparator: comparator$1,
    complement: complement$1,
    compose: compose,
    composeK: composeK,
    composeP: composeP,
    composeWith: composeWith$1,
    concat: concat$1,
    cond: cond$1,
    construct: construct$1,
    constructN: constructN$1,
    contains: contains$1,
    converge: converge$1,
    countBy: countBy$1,
    curry: curry$5,
    curryN: curryN$1,
    dec: dec$1,
    defaultTo: defaultTo$1,
    descend: descend$1,
    difference: difference$2,
    differenceWith: differenceWith$1,
    dissoc: dissoc$1,
    dissocPath: dissocPath$1,
    divide: divide$1,
    drop: drop$1,
    dropLast: dropLast$2,
    dropLastWhile: dropLastWhile$1,
    dropRepeats: dropRepeats$1,
    dropRepeatsWith: dropRepeatsWith$1,
    dropWhile: dropWhile$1,
    either: either$1,
    empty: empty$1,
    endsWith: endsWith$1,
    eqBy: eqBy$1,
    eqProps: eqProps$1,
    equals: equals$1,
    evolve: evolve$1,
    filter: filter$1,
    find: find$1,
    findIndex: findIndex$1,
    findLast: findLast$1,
    findLastIndex: findLastIndex$1,
    flatten: flatten$1,
    flip: flip$2,
    forEach: forEach$2,
    forEachObjIndexed: forEachObjIndexed$1,
    fromPairs: fromPairs$1,
    groupBy: groupBy$1,
    groupWith: groupWith$1,
    gt: gt$1,
    gte: gte$1,
    has: has$1,
    hasIn: hasIn$1,
    hasPath: hasPath$1,
    head: head$1,
    identical: identical$1,
    identity: identity$1,
    ifElse: ifElse$1,
    inc: inc$1,
    includes: includes$1,
    indexBy: indexBy$1,
    indexOf: indexOf$3,
    init: init$2,
    innerJoin: innerJoin$1,
    insert: insert$1,
    insertAll: insertAll$1,
    intersection: intersection$2,
    intersperse: intersperse$1,
    into: into$1,
    invert: invert$1,
    invertObj: invertObj$1,
    invoker: invoker$1,
    is: is$1,
    isEmpty: isEmpty$2,
    isNil: isNil$1,
    join: join$3,
    juxt: juxt$1,
    keys: keys$2,
    keysIn: keysIn$1,
    last: last$1,
    lastIndexOf: lastIndexOf$1,
    length: length$1,
    lens: lens$1,
    lensIndex: lensIndex$1,
    lensPath: lensPath$1,
    lensProp: lensProp$1,
    lift: lift$1,
    liftN: liftN$1,
    lt: lt$1,
    lte: lte$1,
    map: map$3,
    mapAccum: mapAccum$1,
    mapAccumRight: mapAccumRight$1,
    mapObjIndexed: mapObjIndexed$1,
    match: match$1,
    mathMod: mathMod$1,
    max: max$1,
    maxBy: maxBy$1,
    mean: mean$1,
    median: median$1,
    memoizeWith: memoizeWith$1,
    merge: merge$1,
    mergeAll: mergeAll$1,
    mergeDeepLeft: mergeDeepLeft$1,
    mergeDeepRight: mergeDeepRight$1,
    mergeDeepWith: mergeDeepWith$1,
    mergeDeepWithKey: mergeDeepWithKey$1,
    mergeLeft: mergeLeft$1,
    mergeRight: mergeRight$1,
    mergeWith: mergeWith$1,
    mergeWithKey: mergeWithKey$1,
    min: min$1,
    minBy: minBy$1,
    modulo: modulo$1,
    move: move$1,
    multiply: multiply$1,
    nAry: nAry$1,
    negate: negate$1,
    none: none$1,
    not: not$1,
    nth: nth$1,
    nthArg: nthArg$1,
    o: o$1,
    objOf: objOf$1,
    of: of$1,
    omit: omit$1,
    once: once$2,
    or: or$1,
    otherwise: otherwise$1,
    over: over$1,
    pair: pair$1,
    partial: partial$1,
    partialRight: partialRight$1,
    partition: partition$1,
    path: path$1,
    pathEq: pathEq$1,
    pathOr: pathOr$1,
    pathSatisfies: pathSatisfies$1,
    paths: paths$1,
    pick: pick$1,
    pickAll: pickAll$1,
    pickBy: pickBy$1,
    pipe: pipe$3,
    pipeK: pipeK,
    pipeP: pipeP,
    pipeWith: pipeWith$1,
    pluck: pluck$1,
    prepend: prepend$1,
    product: product$1,
    project: project$1,
    prop: prop$1,
    propEq: propEq$1,
    propIs: propIs$1,
    propOr: propOr$1,
    propSatisfies: propSatisfies$1,
    props: props$1,
    range: range$1,
    reduce: reduce$1,
    reduceBy: reduceBy$1,
    reduceRight: reduceRight$1,
    reduceWhile: reduceWhile$1,
    reduced: reduced$1,
    reject: reject$1,
    remove: remove$1,
    repeat: repeat$1,
    replace: replace$1,
    reverse: reverse$1,
    scan: scan$1,
    sequence: sequence$1,
    set: set$1,
    slice: slice$3,
    sort: sort$2,
    sortBy: sortBy$1,
    sortWith: sortWith$1,
    split: split$2,
    splitAt: splitAt$1,
    splitEvery: splitEvery$1,
    splitWhen: splitWhen$1,
    startsWith: startsWith$1,
    subtract: subtract$1,
    sum: sum$1,
    symmetricDifference: symmetricDifference$1,
    symmetricDifferenceWith: symmetricDifferenceWith$1,
    tail: tail$1,
    take: take$1,
    takeLast: takeLast$2,
    takeLastWhile: takeLastWhile$1,
    takeWhile: takeWhile$1,
    tap: tap$1,
    test: test$1,
    thunkify: thunkify$1,
    times: times$1,
    toLower: toLower$1,
    toPairs: toPairs$1,
    toPairsIn: toPairsIn$1,
    toString: toString$2,
    toUpper: toUpper$1,
    transduce: transduce$1,
    transpose: transpose$1,
    traverse: traverse$1,
    trim: trim$1,
    tryCatch: tryCatch$1,
    type: type$1,
    unapply: unapply$1,
    unary: unary$1,
    uncurryN: uncurryN$1,
    unfold: unfold$1,
    union: union$1,
    unionWith: unionWith$1,
    uniq: uniq$1,
    uniqBy: uniqBy$1,
    uniqWith: uniqWith$1,
    unless: unless$1,
    unnest: unnest$1,
    until: until$1,
    update: update$1,
    useWith: useWith$1,
    values: values$1,
    valuesIn: valuesIn$1,
    view: view$1,
    when: when$1,
    where: where$1,
    whereEq: whereEq$1,
    without: without$1,
    xor: xor$6,
    xprod: xprod$1,
    zip: zip$1,
    zipObj: zipObj$1,
    zipWith: zipWith$1
  });

  var require$$0$2 = /*@__PURE__*/getAugmentedNamespace(es);

  var browser$7 = {};

  var safeBuffer = {exports: {}};

  var global$1 = (typeof global !== "undefined" ? global :
              typeof self !== "undefined" ? self :
              typeof window !== "undefined" ? window : {});

  var lookup = [];
  var revLookup = [];
  var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array;
  var inited = false;
  function init () {
    inited = true;
    var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    for (var i = 0, len = code.length; i < len; ++i) {
      lookup[i] = code[i];
      revLookup[code.charCodeAt(i)] = i;
    }

    revLookup['-'.charCodeAt(0)] = 62;
    revLookup['_'.charCodeAt(0)] = 63;
  }

  function toByteArray (b64) {
    if (!inited) {
      init();
    }
    var i, j, l, tmp, placeHolders, arr;
    var len = b64.length;

    if (len % 4 > 0) {
      throw new Error('Invalid string. Length must be a multiple of 4')
    }

    // the number of equal signs (place holders)
    // if there are two placeholders, than the two characters before it
    // represent one byte
    // if there is only one, then the three characters before it represent 2 bytes
    // this is just a cheap hack to not do indexOf twice
    placeHolders = b64[len - 2] === '=' ? 2 : b64[len - 1] === '=' ? 1 : 0;

    // base64 is 4/3 + up to two characters of the original data
    arr = new Arr(len * 3 / 4 - placeHolders);

    // if there are placeholders, only get up to the last complete 4 chars
    l = placeHolders > 0 ? len - 4 : len;

    var L = 0;

    for (i = 0, j = 0; i < l; i += 4, j += 3) {
      tmp = (revLookup[b64.charCodeAt(i)] << 18) | (revLookup[b64.charCodeAt(i + 1)] << 12) | (revLookup[b64.charCodeAt(i + 2)] << 6) | revLookup[b64.charCodeAt(i + 3)];
      arr[L++] = (tmp >> 16) & 0xFF;
      arr[L++] = (tmp >> 8) & 0xFF;
      arr[L++] = tmp & 0xFF;
    }

    if (placeHolders === 2) {
      tmp = (revLookup[b64.charCodeAt(i)] << 2) | (revLookup[b64.charCodeAt(i + 1)] >> 4);
      arr[L++] = tmp & 0xFF;
    } else if (placeHolders === 1) {
      tmp = (revLookup[b64.charCodeAt(i)] << 10) | (revLookup[b64.charCodeAt(i + 1)] << 4) | (revLookup[b64.charCodeAt(i + 2)] >> 2);
      arr[L++] = (tmp >> 8) & 0xFF;
      arr[L++] = tmp & 0xFF;
    }

    return arr
  }

  function tripletToBase64 (num) {
    return lookup[num >> 18 & 0x3F] + lookup[num >> 12 & 0x3F] + lookup[num >> 6 & 0x3F] + lookup[num & 0x3F]
  }

  function encodeChunk (uint8, start, end) {
    var tmp;
    var output = [];
    for (var i = start; i < end; i += 3) {
      tmp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2]);
      output.push(tripletToBase64(tmp));
    }
    return output.join('')
  }

  function fromByteArray (uint8) {
    if (!inited) {
      init();
    }
    var tmp;
    var len = uint8.length;
    var extraBytes = len % 3; // if we have 1 byte left, pad 2 bytes
    var output = '';
    var parts = [];
    var maxChunkLength = 16383; // must be multiple of 3

    // go through the array every three bytes, we'll deal with trailing stuff later
    for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
      parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)));
    }

    // pad the end with zeros, but make sure to not forget the extra bytes
    if (extraBytes === 1) {
      tmp = uint8[len - 1];
      output += lookup[tmp >> 2];
      output += lookup[(tmp << 4) & 0x3F];
      output += '==';
    } else if (extraBytes === 2) {
      tmp = (uint8[len - 2] << 8) + (uint8[len - 1]);
      output += lookup[tmp >> 10];
      output += lookup[(tmp >> 4) & 0x3F];
      output += lookup[(tmp << 2) & 0x3F];
      output += '=';
    }

    parts.push(output);

    return parts.join('')
  }

  function read (buffer, offset, isLE, mLen, nBytes) {
    var e, m;
    var eLen = nBytes * 8 - mLen - 1;
    var eMax = (1 << eLen) - 1;
    var eBias = eMax >> 1;
    var nBits = -7;
    var i = isLE ? (nBytes - 1) : 0;
    var d = isLE ? -1 : 1;
    var s = buffer[offset + i];

    i += d;

    e = s & ((1 << (-nBits)) - 1);
    s >>= (-nBits);
    nBits += eLen;
    for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

    m = e & ((1 << (-nBits)) - 1);
    e >>= (-nBits);
    nBits += mLen;
    for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

    if (e === 0) {
      e = 1 - eBias;
    } else if (e === eMax) {
      return m ? NaN : ((s ? -1 : 1) * Infinity)
    } else {
      m = m + Math.pow(2, mLen);
      e = e - eBias;
    }
    return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
  }

  function write (buffer, value, offset, isLE, mLen, nBytes) {
    var e, m, c;
    var eLen = nBytes * 8 - mLen - 1;
    var eMax = (1 << eLen) - 1;
    var eBias = eMax >> 1;
    var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0);
    var i = isLE ? 0 : (nBytes - 1);
    var d = isLE ? 1 : -1;
    var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0;

    value = Math.abs(value);

    if (isNaN(value) || value === Infinity) {
      m = isNaN(value) ? 1 : 0;
      e = eMax;
    } else {
      e = Math.floor(Math.log(value) / Math.LN2);
      if (value * (c = Math.pow(2, -e)) < 1) {
        e--;
        c *= 2;
      }
      if (e + eBias >= 1) {
        value += rt / c;
      } else {
        value += rt * Math.pow(2, 1 - eBias);
      }
      if (value * c >= 2) {
        e++;
        c /= 2;
      }

      if (e + eBias >= eMax) {
        m = 0;
        e = eMax;
      } else if (e + eBias >= 1) {
        m = (value * c - 1) * Math.pow(2, mLen);
        e = e + eBias;
      } else {
        m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
        e = 0;
      }
    }

    for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

    e = (e << mLen) | m;
    eLen += mLen;
    for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

    buffer[offset + i - d] |= s * 128;
  }

  var toString = {}.toString;

  var isArray$1 = Array.isArray || function (arr) {
    return toString.call(arr) == '[object Array]';
  };

  var INSPECT_MAX_BYTES = 50;

  /**
   * If `Buffer.TYPED_ARRAY_SUPPORT`:
   *   === true    Use Uint8Array implementation (fastest)
   *   === false   Use Object implementation (most compatible, even IE6)
   *
   * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
   * Opera 11.6+, iOS 4.2+.
   *
   * Due to various browser bugs, sometimes the Object implementation will be used even
   * when the browser supports typed arrays.
   *
   * Note:
   *
   *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
   *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
   *
   *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
   *
   *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
   *     incorrect length in some situations.

   * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
   * get the Object implementation, which is slower but behaves correctly.
   */
  Buffer$u.TYPED_ARRAY_SUPPORT = global$1.TYPED_ARRAY_SUPPORT !== undefined
    ? global$1.TYPED_ARRAY_SUPPORT
    : true;

  /*
   * Export kMaxLength after typed array support is determined.
   */
  var _kMaxLength = kMaxLength();

  function kMaxLength () {
    return Buffer$u.TYPED_ARRAY_SUPPORT
      ? 0x7fffffff
      : 0x3fffffff
  }

  function createBuffer (that, length) {
    if (kMaxLength() < length) {
      throw new RangeError('Invalid typed array length')
    }
    if (Buffer$u.TYPED_ARRAY_SUPPORT) {
      // Return an augmented `Uint8Array` instance, for best performance
      that = new Uint8Array(length);
      that.__proto__ = Buffer$u.prototype;
    } else {
      // Fallback: Return an object instance of the Buffer class
      if (that === null) {
        that = new Buffer$u(length);
      }
      that.length = length;
    }

    return that
  }

  /**
   * The Buffer constructor returns instances of `Uint8Array` that have their
   * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
   * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
   * and the `Uint8Array` methods. Square bracket notation works as expected -- it
   * returns a single octet.
   *
   * The `Uint8Array` prototype remains unmodified.
   */

  function Buffer$u (arg, encodingOrOffset, length) {
    if (!Buffer$u.TYPED_ARRAY_SUPPORT && !(this instanceof Buffer$u)) {
      return new Buffer$u(arg, encodingOrOffset, length)
    }

    // Common case.
    if (typeof arg === 'number') {
      if (typeof encodingOrOffset === 'string') {
        throw new Error(
          'If encoding is specified then the first argument must be a string'
        )
      }
      return allocUnsafe(this, arg)
    }
    return from(this, arg, encodingOrOffset, length)
  }

  Buffer$u.poolSize = 8192; // not used by this implementation

  // TODO: Legacy, not needed anymore. Remove in next major version.
  Buffer$u._augment = function (arr) {
    arr.__proto__ = Buffer$u.prototype;
    return arr
  };

  function from (that, value, encodingOrOffset, length) {
    if (typeof value === 'number') {
      throw new TypeError('"value" argument must not be a number')
    }

    if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
      return fromArrayBuffer(that, value, encodingOrOffset, length)
    }

    if (typeof value === 'string') {
      return fromString(that, value, encodingOrOffset)
    }

    return fromObject(that, value)
  }

  /**
   * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
   * if value is a number.
   * Buffer.from(str[, encoding])
   * Buffer.from(array)
   * Buffer.from(buffer)
   * Buffer.from(arrayBuffer[, byteOffset[, length]])
   **/
  Buffer$u.from = function (value, encodingOrOffset, length) {
    return from(null, value, encodingOrOffset, length)
  };

  if (Buffer$u.TYPED_ARRAY_SUPPORT) {
    Buffer$u.prototype.__proto__ = Uint8Array.prototype;
    Buffer$u.__proto__ = Uint8Array;
    if (typeof Symbol !== 'undefined' && Symbol.species &&
        Buffer$u[Symbol.species] === Buffer$u) ;
  }

  function assertSize (size) {
    if (typeof size !== 'number') {
      throw new TypeError('"size" argument must be a number')
    } else if (size < 0) {
      throw new RangeError('"size" argument must not be negative')
    }
  }

  function alloc (that, size, fill, encoding) {
    assertSize(size);
    if (size <= 0) {
      return createBuffer(that, size)
    }
    if (fill !== undefined) {
      // Only pay attention to encoding if it's a string. This
      // prevents accidentally sending in a number that would
      // be interpretted as a start offset.
      return typeof encoding === 'string'
        ? createBuffer(that, size).fill(fill, encoding)
        : createBuffer(that, size).fill(fill)
    }
    return createBuffer(that, size)
  }

  /**
   * Creates a new filled Buffer instance.
   * alloc(size[, fill[, encoding]])
   **/
  Buffer$u.alloc = function (size, fill, encoding) {
    return alloc(null, size, fill, encoding)
  };

  function allocUnsafe (that, size) {
    assertSize(size);
    that = createBuffer(that, size < 0 ? 0 : checked(size) | 0);
    if (!Buffer$u.TYPED_ARRAY_SUPPORT) {
      for (var i = 0; i < size; ++i) {
        that[i] = 0;
      }
    }
    return that
  }

  /**
   * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
   * */
  Buffer$u.allocUnsafe = function (size) {
    return allocUnsafe(null, size)
  };
  /**
   * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
   */
  Buffer$u.allocUnsafeSlow = function (size) {
    return allocUnsafe(null, size)
  };

  function fromString (that, string, encoding) {
    if (typeof encoding !== 'string' || encoding === '') {
      encoding = 'utf8';
    }

    if (!Buffer$u.isEncoding(encoding)) {
      throw new TypeError('"encoding" must be a valid string encoding')
    }

    var length = byteLength(string, encoding) | 0;
    that = createBuffer(that, length);

    var actual = that.write(string, encoding);

    if (actual !== length) {
      // Writing a hex string, for example, that contains invalid characters will
      // cause everything after the first invalid character to be ignored. (e.g.
      // 'abxxcd' will be treated as 'ab')
      that = that.slice(0, actual);
    }

    return that
  }

  function fromArrayLike (that, array) {
    var length = array.length < 0 ? 0 : checked(array.length) | 0;
    that = createBuffer(that, length);
    for (var i = 0; i < length; i += 1) {
      that[i] = array[i] & 255;
    }
    return that
  }

  function fromArrayBuffer (that, array, byteOffset, length) {
    array.byteLength; // this throws if `array` is not a valid ArrayBuffer

    if (byteOffset < 0 || array.byteLength < byteOffset) {
      throw new RangeError('\'offset\' is out of bounds')
    }

    if (array.byteLength < byteOffset + (length || 0)) {
      throw new RangeError('\'length\' is out of bounds')
    }

    if (byteOffset === undefined && length === undefined) {
      array = new Uint8Array(array);
    } else if (length === undefined) {
      array = new Uint8Array(array, byteOffset);
    } else {
      array = new Uint8Array(array, byteOffset, length);
    }

    if (Buffer$u.TYPED_ARRAY_SUPPORT) {
      // Return an augmented `Uint8Array` instance, for best performance
      that = array;
      that.__proto__ = Buffer$u.prototype;
    } else {
      // Fallback: Return an object instance of the Buffer class
      that = fromArrayLike(that, array);
    }
    return that
  }

  function fromObject (that, obj) {
    if (internalIsBuffer(obj)) {
      var len = checked(obj.length) | 0;
      that = createBuffer(that, len);

      if (that.length === 0) {
        return that
      }

      obj.copy(that, 0, 0, len);
      return that
    }

    if (obj) {
      if ((typeof ArrayBuffer !== 'undefined' &&
          obj.buffer instanceof ArrayBuffer) || 'length' in obj) {
        if (typeof obj.length !== 'number' || isnan(obj.length)) {
          return createBuffer(that, 0)
        }
        return fromArrayLike(that, obj)
      }

      if (obj.type === 'Buffer' && isArray$1(obj.data)) {
        return fromArrayLike(that, obj.data)
      }
    }

    throw new TypeError('First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.')
  }

  function checked (length) {
    // Note: cannot use `length < kMaxLength()` here because that fails when
    // length is NaN (which is otherwise coerced to zero.)
    if (length >= kMaxLength()) {
      throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                           'size: 0x' + kMaxLength().toString(16) + ' bytes')
    }
    return length | 0
  }

  function SlowBuffer (length) {
    if (+length != length) { // eslint-disable-line eqeqeq
      length = 0;
    }
    return Buffer$u.alloc(+length)
  }
  Buffer$u.isBuffer = isBuffer$1;
  function internalIsBuffer (b) {
    return !!(b != null && b._isBuffer)
  }

  Buffer$u.compare = function compare (a, b) {
    if (!internalIsBuffer(a) || !internalIsBuffer(b)) {
      throw new TypeError('Arguments must be Buffers')
    }

    if (a === b) return 0

    var x = a.length;
    var y = b.length;

    for (var i = 0, len = Math.min(x, y); i < len; ++i) {
      if (a[i] !== b[i]) {
        x = a[i];
        y = b[i];
        break
      }
    }

    if (x < y) return -1
    if (y < x) return 1
    return 0
  };

  Buffer$u.isEncoding = function isEncoding (encoding) {
    switch (String(encoding).toLowerCase()) {
      case 'hex':
      case 'utf8':
      case 'utf-8':
      case 'ascii':
      case 'latin1':
      case 'binary':
      case 'base64':
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return true
      default:
        return false
    }
  };

  Buffer$u.concat = function concat (list, length) {
    if (!isArray$1(list)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }

    if (list.length === 0) {
      return Buffer$u.alloc(0)
    }

    var i;
    if (length === undefined) {
      length = 0;
      for (i = 0; i < list.length; ++i) {
        length += list[i].length;
      }
    }

    var buffer = Buffer$u.allocUnsafe(length);
    var pos = 0;
    for (i = 0; i < list.length; ++i) {
      var buf = list[i];
      if (!internalIsBuffer(buf)) {
        throw new TypeError('"list" argument must be an Array of Buffers')
      }
      buf.copy(buffer, pos);
      pos += buf.length;
    }
    return buffer
  };

  function byteLength (string, encoding) {
    if (internalIsBuffer(string)) {
      return string.length
    }
    if (typeof ArrayBuffer !== 'undefined' && typeof ArrayBuffer.isView === 'function' &&
        (ArrayBuffer.isView(string) || string instanceof ArrayBuffer)) {
      return string.byteLength
    }
    if (typeof string !== 'string') {
      string = '' + string;
    }

    var len = string.length;
    if (len === 0) return 0

    // Use a for loop to avoid recursion
    var loweredCase = false;
    for (;;) {
      switch (encoding) {
        case 'ascii':
        case 'latin1':
        case 'binary':
          return len
        case 'utf8':
        case 'utf-8':
        case undefined:
          return utf8ToBytes(string).length
        case 'ucs2':
        case 'ucs-2':
        case 'utf16le':
        case 'utf-16le':
          return len * 2
        case 'hex':
          return len >>> 1
        case 'base64':
          return base64ToBytes(string).length
        default:
          if (loweredCase) return utf8ToBytes(string).length // assume utf8
          encoding = ('' + encoding).toLowerCase();
          loweredCase = true;
      }
    }
  }
  Buffer$u.byteLength = byteLength;

  function slowToString (encoding, start, end) {
    var loweredCase = false;

    // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
    // property of a typed array.

    // This behaves neither like String nor Uint8Array in that we set start/end
    // to their upper/lower bounds if the value passed is out of range.
    // undefined is handled specially as per ECMA-262 6th Edition,
    // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
    if (start === undefined || start < 0) {
      start = 0;
    }
    // Return early if start > this.length. Done here to prevent potential uint32
    // coercion fail below.
    if (start > this.length) {
      return ''
    }

    if (end === undefined || end > this.length) {
      end = this.length;
    }

    if (end <= 0) {
      return ''
    }

    // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
    end >>>= 0;
    start >>>= 0;

    if (end <= start) {
      return ''
    }

    if (!encoding) encoding = 'utf8';

    while (true) {
      switch (encoding) {
        case 'hex':
          return hexSlice(this, start, end)

        case 'utf8':
        case 'utf-8':
          return utf8Slice(this, start, end)

        case 'ascii':
          return asciiSlice(this, start, end)

        case 'latin1':
        case 'binary':
          return latin1Slice(this, start, end)

        case 'base64':
          return base64Slice(this, start, end)

        case 'ucs2':
        case 'ucs-2':
        case 'utf16le':
        case 'utf-16le':
          return utf16leSlice(this, start, end)

        default:
          if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
          encoding = (encoding + '').toLowerCase();
          loweredCase = true;
      }
    }
  }

  // The property is used by `Buffer.isBuffer` and `is-buffer` (in Safari 5-7) to detect
  // Buffer instances.
  Buffer$u.prototype._isBuffer = true;

  function swap (b, n, m) {
    var i = b[n];
    b[n] = b[m];
    b[m] = i;
  }

  Buffer$u.prototype.swap16 = function swap16 () {
    var len = this.length;
    if (len % 2 !== 0) {
      throw new RangeError('Buffer size must be a multiple of 16-bits')
    }
    for (var i = 0; i < len; i += 2) {
      swap(this, i, i + 1);
    }
    return this
  };

  Buffer$u.prototype.swap32 = function swap32 () {
    var len = this.length;
    if (len % 4 !== 0) {
      throw new RangeError('Buffer size must be a multiple of 32-bits')
    }
    for (var i = 0; i < len; i += 4) {
      swap(this, i, i + 3);
      swap(this, i + 1, i + 2);
    }
    return this
  };

  Buffer$u.prototype.swap64 = function swap64 () {
    var len = this.length;
    if (len % 8 !== 0) {
      throw new RangeError('Buffer size must be a multiple of 64-bits')
    }
    for (var i = 0; i < len; i += 8) {
      swap(this, i, i + 7);
      swap(this, i + 1, i + 6);
      swap(this, i + 2, i + 5);
      swap(this, i + 3, i + 4);
    }
    return this
  };

  Buffer$u.prototype.toString = function toString () {
    var length = this.length | 0;
    if (length === 0) return ''
    if (arguments.length === 0) return utf8Slice(this, 0, length)
    return slowToString.apply(this, arguments)
  };

  Buffer$u.prototype.equals = function equals (b) {
    if (!internalIsBuffer(b)) throw new TypeError('Argument must be a Buffer')
    if (this === b) return true
    return Buffer$u.compare(this, b) === 0
  };

  Buffer$u.prototype.inspect = function inspect () {
    var str = '';
    var max = INSPECT_MAX_BYTES;
    if (this.length > 0) {
      str = this.toString('hex', 0, max).match(/.{2}/g).join(' ');
      if (this.length > max) str += ' ... ';
    }
    return '<Buffer ' + str + '>'
  };

  Buffer$u.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
    if (!internalIsBuffer(target)) {
      throw new TypeError('Argument must be a Buffer')
    }

    if (start === undefined) {
      start = 0;
    }
    if (end === undefined) {
      end = target ? target.length : 0;
    }
    if (thisStart === undefined) {
      thisStart = 0;
    }
    if (thisEnd === undefined) {
      thisEnd = this.length;
    }

    if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
      throw new RangeError('out of range index')
    }

    if (thisStart >= thisEnd && start >= end) {
      return 0
    }
    if (thisStart >= thisEnd) {
      return -1
    }
    if (start >= end) {
      return 1
    }

    start >>>= 0;
    end >>>= 0;
    thisStart >>>= 0;
    thisEnd >>>= 0;

    if (this === target) return 0

    var x = thisEnd - thisStart;
    var y = end - start;
    var len = Math.min(x, y);

    var thisCopy = this.slice(thisStart, thisEnd);
    var targetCopy = target.slice(start, end);

    for (var i = 0; i < len; ++i) {
      if (thisCopy[i] !== targetCopy[i]) {
        x = thisCopy[i];
        y = targetCopy[i];
        break
      }
    }

    if (x < y) return -1
    if (y < x) return 1
    return 0
  };

  // Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
  // OR the last index of `val` in `buffer` at offset <= `byteOffset`.
  //
  // Arguments:
  // - buffer - a Buffer to search
  // - val - a string, Buffer, or number
  // - byteOffset - an index into `buffer`; will be clamped to an int32
  // - encoding - an optional encoding, relevant is val is a string
  // - dir - true for indexOf, false for lastIndexOf
  function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
    // Empty buffer means no match
    if (buffer.length === 0) return -1

    // Normalize byteOffset
    if (typeof byteOffset === 'string') {
      encoding = byteOffset;
      byteOffset = 0;
    } else if (byteOffset > 0x7fffffff) {
      byteOffset = 0x7fffffff;
    } else if (byteOffset < -0x80000000) {
      byteOffset = -0x80000000;
    }
    byteOffset = +byteOffset;  // Coerce to Number.
    if (isNaN(byteOffset)) {
      // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
      byteOffset = dir ? 0 : (buffer.length - 1);
    }

    // Normalize byteOffset: negative offsets start from the end of the buffer
    if (byteOffset < 0) byteOffset = buffer.length + byteOffset;
    if (byteOffset >= buffer.length) {
      if (dir) return -1
      else byteOffset = buffer.length - 1;
    } else if (byteOffset < 0) {
      if (dir) byteOffset = 0;
      else return -1
    }

    // Normalize val
    if (typeof val === 'string') {
      val = Buffer$u.from(val, encoding);
    }

    // Finally, search either indexOf (if dir is true) or lastIndexOf
    if (internalIsBuffer(val)) {
      // Special case: looking for empty string/buffer always fails
      if (val.length === 0) {
        return -1
      }
      return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
    } else if (typeof val === 'number') {
      val = val & 0xFF; // Search for a byte value [0-255]
      if (Buffer$u.TYPED_ARRAY_SUPPORT &&
          typeof Uint8Array.prototype.indexOf === 'function') {
        if (dir) {
          return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
        } else {
          return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
        }
      }
      return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
    }

    throw new TypeError('val must be string, number or Buffer')
  }

  function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
    var indexSize = 1;
    var arrLength = arr.length;
    var valLength = val.length;

    if (encoding !== undefined) {
      encoding = String(encoding).toLowerCase();
      if (encoding === 'ucs2' || encoding === 'ucs-2' ||
          encoding === 'utf16le' || encoding === 'utf-16le') {
        if (arr.length < 2 || val.length < 2) {
          return -1
        }
        indexSize = 2;
        arrLength /= 2;
        valLength /= 2;
        byteOffset /= 2;
      }
    }

    function read (buf, i) {
      if (indexSize === 1) {
        return buf[i]
      } else {
        return buf.readUInt16BE(i * indexSize)
      }
    }

    var i;
    if (dir) {
      var foundIndex = -1;
      for (i = byteOffset; i < arrLength; i++) {
        if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
          if (foundIndex === -1) foundIndex = i;
          if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
        } else {
          if (foundIndex !== -1) i -= i - foundIndex;
          foundIndex = -1;
        }
      }
    } else {
      if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength;
      for (i = byteOffset; i >= 0; i--) {
        var found = true;
        for (var j = 0; j < valLength; j++) {
          if (read(arr, i + j) !== read(val, j)) {
            found = false;
            break
          }
        }
        if (found) return i
      }
    }

    return -1
  }

  Buffer$u.prototype.includes = function includes (val, byteOffset, encoding) {
    return this.indexOf(val, byteOffset, encoding) !== -1
  };

  Buffer$u.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
    return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
  };

  Buffer$u.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
    return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
  };

  function hexWrite (buf, string, offset, length) {
    offset = Number(offset) || 0;
    var remaining = buf.length - offset;
    if (!length) {
      length = remaining;
    } else {
      length = Number(length);
      if (length > remaining) {
        length = remaining;
      }
    }

    // must be an even number of digits
    var strLen = string.length;
    if (strLen % 2 !== 0) throw new TypeError('Invalid hex string')

    if (length > strLen / 2) {
      length = strLen / 2;
    }
    for (var i = 0; i < length; ++i) {
      var parsed = parseInt(string.substr(i * 2, 2), 16);
      if (isNaN(parsed)) return i
      buf[offset + i] = parsed;
    }
    return i
  }

  function utf8Write (buf, string, offset, length) {
    return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
  }

  function asciiWrite (buf, string, offset, length) {
    return blitBuffer(asciiToBytes(string), buf, offset, length)
  }

  function latin1Write (buf, string, offset, length) {
    return asciiWrite(buf, string, offset, length)
  }

  function base64Write (buf, string, offset, length) {
    return blitBuffer(base64ToBytes(string), buf, offset, length)
  }

  function ucs2Write (buf, string, offset, length) {
    return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
  }

  Buffer$u.prototype.write = function write (string, offset, length, encoding) {
    // Buffer#write(string)
    if (offset === undefined) {
      encoding = 'utf8';
      length = this.length;
      offset = 0;
    // Buffer#write(string, encoding)
    } else if (length === undefined && typeof offset === 'string') {
      encoding = offset;
      length = this.length;
      offset = 0;
    // Buffer#write(string, offset[, length][, encoding])
    } else if (isFinite(offset)) {
      offset = offset | 0;
      if (isFinite(length)) {
        length = length | 0;
        if (encoding === undefined) encoding = 'utf8';
      } else {
        encoding = length;
        length = undefined;
      }
    // legacy write(string, encoding, offset, length) - remove in v0.13
    } else {
      throw new Error(
        'Buffer.write(string, encoding, offset[, length]) is no longer supported'
      )
    }

    var remaining = this.length - offset;
    if (length === undefined || length > remaining) length = remaining;

    if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
      throw new RangeError('Attempt to write outside buffer bounds')
    }

    if (!encoding) encoding = 'utf8';

    var loweredCase = false;
    for (;;) {
      switch (encoding) {
        case 'hex':
          return hexWrite(this, string, offset, length)

        case 'utf8':
        case 'utf-8':
          return utf8Write(this, string, offset, length)

        case 'ascii':
          return asciiWrite(this, string, offset, length)

        case 'latin1':
        case 'binary':
          return latin1Write(this, string, offset, length)

        case 'base64':
          // Warning: maxLength not taken into account in base64Write
          return base64Write(this, string, offset, length)

        case 'ucs2':
        case 'ucs-2':
        case 'utf16le':
        case 'utf-16le':
          return ucs2Write(this, string, offset, length)

        default:
          if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
          encoding = ('' + encoding).toLowerCase();
          loweredCase = true;
      }
    }
  };

  Buffer$u.prototype.toJSON = function toJSON () {
    return {
      type: 'Buffer',
      data: Array.prototype.slice.call(this._arr || this, 0)
    }
  };

  function base64Slice (buf, start, end) {
    if (start === 0 && end === buf.length) {
      return fromByteArray(buf)
    } else {
      return fromByteArray(buf.slice(start, end))
    }
  }

  function utf8Slice (buf, start, end) {
    end = Math.min(buf.length, end);
    var res = [];

    var i = start;
    while (i < end) {
      var firstByte = buf[i];
      var codePoint = null;
      var bytesPerSequence = (firstByte > 0xEF) ? 4
        : (firstByte > 0xDF) ? 3
        : (firstByte > 0xBF) ? 2
        : 1;

      if (i + bytesPerSequence <= end) {
        var secondByte, thirdByte, fourthByte, tempCodePoint;

        switch (bytesPerSequence) {
          case 1:
            if (firstByte < 0x80) {
              codePoint = firstByte;
            }
            break
          case 2:
            secondByte = buf[i + 1];
            if ((secondByte & 0xC0) === 0x80) {
              tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F);
              if (tempCodePoint > 0x7F) {
                codePoint = tempCodePoint;
              }
            }
            break
          case 3:
            secondByte = buf[i + 1];
            thirdByte = buf[i + 2];
            if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
              tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F);
              if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
                codePoint = tempCodePoint;
              }
            }
            break
          case 4:
            secondByte = buf[i + 1];
            thirdByte = buf[i + 2];
            fourthByte = buf[i + 3];
            if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
              tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F);
              if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
                codePoint = tempCodePoint;
              }
            }
        }
      }

      if (codePoint === null) {
        // we did not generate a valid codePoint so insert a
        // replacement char (U+FFFD) and advance only 1 byte
        codePoint = 0xFFFD;
        bytesPerSequence = 1;
      } else if (codePoint > 0xFFFF) {
        // encode to utf16 (surrogate pair dance)
        codePoint -= 0x10000;
        res.push(codePoint >>> 10 & 0x3FF | 0xD800);
        codePoint = 0xDC00 | codePoint & 0x3FF;
      }

      res.push(codePoint);
      i += bytesPerSequence;
    }

    return decodeCodePointsArray(res)
  }

  // Based on http://stackoverflow.com/a/22747272/680742, the browser with
  // the lowest limit is Chrome, with 0x10000 args.
  // We go 1 magnitude less, for safety
  var MAX_ARGUMENTS_LENGTH = 0x1000;

  function decodeCodePointsArray (codePoints) {
    var len = codePoints.length;
    if (len <= MAX_ARGUMENTS_LENGTH) {
      return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
    }

    // Decode in chunks to avoid "call stack size exceeded".
    var res = '';
    var i = 0;
    while (i < len) {
      res += String.fromCharCode.apply(
        String,
        codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
      );
    }
    return res
  }

  function asciiSlice (buf, start, end) {
    var ret = '';
    end = Math.min(buf.length, end);

    for (var i = start; i < end; ++i) {
      ret += String.fromCharCode(buf[i] & 0x7F);
    }
    return ret
  }

  function latin1Slice (buf, start, end) {
    var ret = '';
    end = Math.min(buf.length, end);

    for (var i = start; i < end; ++i) {
      ret += String.fromCharCode(buf[i]);
    }
    return ret
  }

  function hexSlice (buf, start, end) {
    var len = buf.length;

    if (!start || start < 0) start = 0;
    if (!end || end < 0 || end > len) end = len;

    var out = '';
    for (var i = start; i < end; ++i) {
      out += toHex(buf[i]);
    }
    return out
  }

  function utf16leSlice (buf, start, end) {
    var bytes = buf.slice(start, end);
    var res = '';
    for (var i = 0; i < bytes.length; i += 2) {
      res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256);
    }
    return res
  }

  Buffer$u.prototype.slice = function slice (start, end) {
    var len = this.length;
    start = ~~start;
    end = end === undefined ? len : ~~end;

    if (start < 0) {
      start += len;
      if (start < 0) start = 0;
    } else if (start > len) {
      start = len;
    }

    if (end < 0) {
      end += len;
      if (end < 0) end = 0;
    } else if (end > len) {
      end = len;
    }

    if (end < start) end = start;

    var newBuf;
    if (Buffer$u.TYPED_ARRAY_SUPPORT) {
      newBuf = this.subarray(start, end);
      newBuf.__proto__ = Buffer$u.prototype;
    } else {
      var sliceLen = end - start;
      newBuf = new Buffer$u(sliceLen, undefined);
      for (var i = 0; i < sliceLen; ++i) {
        newBuf[i] = this[i + start];
      }
    }

    return newBuf
  };

  /*
   * Need to make sure that buffer isn't trying to write out of bounds.
   */
  function checkOffset (offset, ext, length) {
    if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
    if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
  }

  Buffer$u.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
    offset = offset | 0;
    byteLength = byteLength | 0;
    if (!noAssert) checkOffset(offset, byteLength, this.length);

    var val = this[offset];
    var mul = 1;
    var i = 0;
    while (++i < byteLength && (mul *= 0x100)) {
      val += this[offset + i] * mul;
    }

    return val
  };

  Buffer$u.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
    offset = offset | 0;
    byteLength = byteLength | 0;
    if (!noAssert) {
      checkOffset(offset, byteLength, this.length);
    }

    var val = this[offset + --byteLength];
    var mul = 1;
    while (byteLength > 0 && (mul *= 0x100)) {
      val += this[offset + --byteLength] * mul;
    }

    return val
  };

  Buffer$u.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 1, this.length);
    return this[offset]
  };

  Buffer$u.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 2, this.length);
    return this[offset] | (this[offset + 1] << 8)
  };

  Buffer$u.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 2, this.length);
    return (this[offset] << 8) | this[offset + 1]
  };

  Buffer$u.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 4, this.length);

    return ((this[offset]) |
        (this[offset + 1] << 8) |
        (this[offset + 2] << 16)) +
        (this[offset + 3] * 0x1000000)
  };

  Buffer$u.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 4, this.length);

    return (this[offset] * 0x1000000) +
      ((this[offset + 1] << 16) |
      (this[offset + 2] << 8) |
      this[offset + 3])
  };

  Buffer$u.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
    offset = offset | 0;
    byteLength = byteLength | 0;
    if (!noAssert) checkOffset(offset, byteLength, this.length);

    var val = this[offset];
    var mul = 1;
    var i = 0;
    while (++i < byteLength && (mul *= 0x100)) {
      val += this[offset + i] * mul;
    }
    mul *= 0x80;

    if (val >= mul) val -= Math.pow(2, 8 * byteLength);

    return val
  };

  Buffer$u.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
    offset = offset | 0;
    byteLength = byteLength | 0;
    if (!noAssert) checkOffset(offset, byteLength, this.length);

    var i = byteLength;
    var mul = 1;
    var val = this[offset + --i];
    while (i > 0 && (mul *= 0x100)) {
      val += this[offset + --i] * mul;
    }
    mul *= 0x80;

    if (val >= mul) val -= Math.pow(2, 8 * byteLength);

    return val
  };

  Buffer$u.prototype.readInt8 = function readInt8 (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 1, this.length);
    if (!(this[offset] & 0x80)) return (this[offset])
    return ((0xff - this[offset] + 1) * -1)
  };

  Buffer$u.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 2, this.length);
    var val = this[offset] | (this[offset + 1] << 8);
    return (val & 0x8000) ? val | 0xFFFF0000 : val
  };

  Buffer$u.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 2, this.length);
    var val = this[offset + 1] | (this[offset] << 8);
    return (val & 0x8000) ? val | 0xFFFF0000 : val
  };

  Buffer$u.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 4, this.length);

    return (this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16) |
      (this[offset + 3] << 24)
  };

  Buffer$u.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 4, this.length);

    return (this[offset] << 24) |
      (this[offset + 1] << 16) |
      (this[offset + 2] << 8) |
      (this[offset + 3])
  };

  Buffer$u.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 4, this.length);
    return read(this, offset, true, 23, 4)
  };

  Buffer$u.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 4, this.length);
    return read(this, offset, false, 23, 4)
  };

  Buffer$u.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 8, this.length);
    return read(this, offset, true, 52, 8)
  };

  Buffer$u.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 8, this.length);
    return read(this, offset, false, 52, 8)
  };

  function checkInt (buf, value, offset, ext, max, min) {
    if (!internalIsBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
    if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
    if (offset + ext > buf.length) throw new RangeError('Index out of range')
  }

  Buffer$u.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
    value = +value;
    offset = offset | 0;
    byteLength = byteLength | 0;
    if (!noAssert) {
      var maxBytes = Math.pow(2, 8 * byteLength) - 1;
      checkInt(this, value, offset, byteLength, maxBytes, 0);
    }

    var mul = 1;
    var i = 0;
    this[offset] = value & 0xFF;
    while (++i < byteLength && (mul *= 0x100)) {
      this[offset + i] = (value / mul) & 0xFF;
    }

    return offset + byteLength
  };

  Buffer$u.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
    value = +value;
    offset = offset | 0;
    byteLength = byteLength | 0;
    if (!noAssert) {
      var maxBytes = Math.pow(2, 8 * byteLength) - 1;
      checkInt(this, value, offset, byteLength, maxBytes, 0);
    }

    var i = byteLength - 1;
    var mul = 1;
    this[offset + i] = value & 0xFF;
    while (--i >= 0 && (mul *= 0x100)) {
      this[offset + i] = (value / mul) & 0xFF;
    }

    return offset + byteLength
  };

  Buffer$u.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
    value = +value;
    offset = offset | 0;
    if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0);
    if (!Buffer$u.TYPED_ARRAY_SUPPORT) value = Math.floor(value);
    this[offset] = (value & 0xff);
    return offset + 1
  };

  function objectWriteUInt16 (buf, value, offset, littleEndian) {
    if (value < 0) value = 0xffff + value + 1;
    for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; ++i) {
      buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
        (littleEndian ? i : 1 - i) * 8;
    }
  }

  Buffer$u.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
    value = +value;
    offset = offset | 0;
    if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0);
    if (Buffer$u.TYPED_ARRAY_SUPPORT) {
      this[offset] = (value & 0xff);
      this[offset + 1] = (value >>> 8);
    } else {
      objectWriteUInt16(this, value, offset, true);
    }
    return offset + 2
  };

  Buffer$u.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
    value = +value;
    offset = offset | 0;
    if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0);
    if (Buffer$u.TYPED_ARRAY_SUPPORT) {
      this[offset] = (value >>> 8);
      this[offset + 1] = (value & 0xff);
    } else {
      objectWriteUInt16(this, value, offset, false);
    }
    return offset + 2
  };

  function objectWriteUInt32 (buf, value, offset, littleEndian) {
    if (value < 0) value = 0xffffffff + value + 1;
    for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; ++i) {
      buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff;
    }
  }

  Buffer$u.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
    value = +value;
    offset = offset | 0;
    if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0);
    if (Buffer$u.TYPED_ARRAY_SUPPORT) {
      this[offset + 3] = (value >>> 24);
      this[offset + 2] = (value >>> 16);
      this[offset + 1] = (value >>> 8);
      this[offset] = (value & 0xff);
    } else {
      objectWriteUInt32(this, value, offset, true);
    }
    return offset + 4
  };

  Buffer$u.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
    value = +value;
    offset = offset | 0;
    if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0);
    if (Buffer$u.TYPED_ARRAY_SUPPORT) {
      this[offset] = (value >>> 24);
      this[offset + 1] = (value >>> 16);
      this[offset + 2] = (value >>> 8);
      this[offset + 3] = (value & 0xff);
    } else {
      objectWriteUInt32(this, value, offset, false);
    }
    return offset + 4
  };

  Buffer$u.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
    value = +value;
    offset = offset | 0;
    if (!noAssert) {
      var limit = Math.pow(2, 8 * byteLength - 1);

      checkInt(this, value, offset, byteLength, limit - 1, -limit);
    }

    var i = 0;
    var mul = 1;
    var sub = 0;
    this[offset] = value & 0xFF;
    while (++i < byteLength && (mul *= 0x100)) {
      if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
        sub = 1;
      }
      this[offset + i] = ((value / mul) >> 0) - sub & 0xFF;
    }

    return offset + byteLength
  };

  Buffer$u.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
    value = +value;
    offset = offset | 0;
    if (!noAssert) {
      var limit = Math.pow(2, 8 * byteLength - 1);

      checkInt(this, value, offset, byteLength, limit - 1, -limit);
    }

    var i = byteLength - 1;
    var mul = 1;
    var sub = 0;
    this[offset + i] = value & 0xFF;
    while (--i >= 0 && (mul *= 0x100)) {
      if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
        sub = 1;
      }
      this[offset + i] = ((value / mul) >> 0) - sub & 0xFF;
    }

    return offset + byteLength
  };

  Buffer$u.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
    value = +value;
    offset = offset | 0;
    if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80);
    if (!Buffer$u.TYPED_ARRAY_SUPPORT) value = Math.floor(value);
    if (value < 0) value = 0xff + value + 1;
    this[offset] = (value & 0xff);
    return offset + 1
  };

  Buffer$u.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
    value = +value;
    offset = offset | 0;
    if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000);
    if (Buffer$u.TYPED_ARRAY_SUPPORT) {
      this[offset] = (value & 0xff);
      this[offset + 1] = (value >>> 8);
    } else {
      objectWriteUInt16(this, value, offset, true);
    }
    return offset + 2
  };

  Buffer$u.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
    value = +value;
    offset = offset | 0;
    if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000);
    if (Buffer$u.TYPED_ARRAY_SUPPORT) {
      this[offset] = (value >>> 8);
      this[offset + 1] = (value & 0xff);
    } else {
      objectWriteUInt16(this, value, offset, false);
    }
    return offset + 2
  };

  Buffer$u.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
    value = +value;
    offset = offset | 0;
    if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000);
    if (Buffer$u.TYPED_ARRAY_SUPPORT) {
      this[offset] = (value & 0xff);
      this[offset + 1] = (value >>> 8);
      this[offset + 2] = (value >>> 16);
      this[offset + 3] = (value >>> 24);
    } else {
      objectWriteUInt32(this, value, offset, true);
    }
    return offset + 4
  };

  Buffer$u.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
    value = +value;
    offset = offset | 0;
    if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000);
    if (value < 0) value = 0xffffffff + value + 1;
    if (Buffer$u.TYPED_ARRAY_SUPPORT) {
      this[offset] = (value >>> 24);
      this[offset + 1] = (value >>> 16);
      this[offset + 2] = (value >>> 8);
      this[offset + 3] = (value & 0xff);
    } else {
      objectWriteUInt32(this, value, offset, false);
    }
    return offset + 4
  };

  function checkIEEE754 (buf, value, offset, ext, max, min) {
    if (offset + ext > buf.length) throw new RangeError('Index out of range')
    if (offset < 0) throw new RangeError('Index out of range')
  }

  function writeFloat (buf, value, offset, littleEndian, noAssert) {
    if (!noAssert) {
      checkIEEE754(buf, value, offset, 4);
    }
    write(buf, value, offset, littleEndian, 23, 4);
    return offset + 4
  }

  Buffer$u.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
    return writeFloat(this, value, offset, true, noAssert)
  };

  Buffer$u.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
    return writeFloat(this, value, offset, false, noAssert)
  };

  function writeDouble (buf, value, offset, littleEndian, noAssert) {
    if (!noAssert) {
      checkIEEE754(buf, value, offset, 8);
    }
    write(buf, value, offset, littleEndian, 52, 8);
    return offset + 8
  }

  Buffer$u.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
    return writeDouble(this, value, offset, true, noAssert)
  };

  Buffer$u.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
    return writeDouble(this, value, offset, false, noAssert)
  };

  // copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
  Buffer$u.prototype.copy = function copy (target, targetStart, start, end) {
    if (!start) start = 0;
    if (!end && end !== 0) end = this.length;
    if (targetStart >= target.length) targetStart = target.length;
    if (!targetStart) targetStart = 0;
    if (end > 0 && end < start) end = start;

    // Copy 0 bytes; we're done
    if (end === start) return 0
    if (target.length === 0 || this.length === 0) return 0

    // Fatal error conditions
    if (targetStart < 0) {
      throw new RangeError('targetStart out of bounds')
    }
    if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
    if (end < 0) throw new RangeError('sourceEnd out of bounds')

    // Are we oob?
    if (end > this.length) end = this.length;
    if (target.length - targetStart < end - start) {
      end = target.length - targetStart + start;
    }

    var len = end - start;
    var i;

    if (this === target && start < targetStart && targetStart < end) {
      // descending copy from end
      for (i = len - 1; i >= 0; --i) {
        target[i + targetStart] = this[i + start];
      }
    } else if (len < 1000 || !Buffer$u.TYPED_ARRAY_SUPPORT) {
      // ascending copy from start
      for (i = 0; i < len; ++i) {
        target[i + targetStart] = this[i + start];
      }
    } else {
      Uint8Array.prototype.set.call(
        target,
        this.subarray(start, start + len),
        targetStart
      );
    }

    return len
  };

  // Usage:
  //    buffer.fill(number[, offset[, end]])
  //    buffer.fill(buffer[, offset[, end]])
  //    buffer.fill(string[, offset[, end]][, encoding])
  Buffer$u.prototype.fill = function fill (val, start, end, encoding) {
    // Handle string cases:
    if (typeof val === 'string') {
      if (typeof start === 'string') {
        encoding = start;
        start = 0;
        end = this.length;
      } else if (typeof end === 'string') {
        encoding = end;
        end = this.length;
      }
      if (val.length === 1) {
        var code = val.charCodeAt(0);
        if (code < 256) {
          val = code;
        }
      }
      if (encoding !== undefined && typeof encoding !== 'string') {
        throw new TypeError('encoding must be a string')
      }
      if (typeof encoding === 'string' && !Buffer$u.isEncoding(encoding)) {
        throw new TypeError('Unknown encoding: ' + encoding)
      }
    } else if (typeof val === 'number') {
      val = val & 255;
    }

    // Invalid ranges are not set to a default, so can range check early.
    if (start < 0 || this.length < start || this.length < end) {
      throw new RangeError('Out of range index')
    }

    if (end <= start) {
      return this
    }

    start = start >>> 0;
    end = end === undefined ? this.length : end >>> 0;

    if (!val) val = 0;

    var i;
    if (typeof val === 'number') {
      for (i = start; i < end; ++i) {
        this[i] = val;
      }
    } else {
      var bytes = internalIsBuffer(val)
        ? val
        : utf8ToBytes(new Buffer$u(val, encoding).toString());
      var len = bytes.length;
      for (i = 0; i < end - start; ++i) {
        this[i + start] = bytes[i % len];
      }
    }

    return this
  };

  // HELPER FUNCTIONS
  // ================

  var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g;

  function base64clean (str) {
    // Node strips out invalid characters like \n and \t from the string, base64-js does not
    str = stringtrim(str).replace(INVALID_BASE64_RE, '');
    // Node converts strings with length < 2 to ''
    if (str.length < 2) return ''
    // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
    while (str.length % 4 !== 0) {
      str = str + '=';
    }
    return str
  }

  function stringtrim (str) {
    if (str.trim) return str.trim()
    return str.replace(/^\s+|\s+$/g, '')
  }

  function toHex (n) {
    if (n < 16) return '0' + n.toString(16)
    return n.toString(16)
  }

  function utf8ToBytes (string, units) {
    units = units || Infinity;
    var codePoint;
    var length = string.length;
    var leadSurrogate = null;
    var bytes = [];

    for (var i = 0; i < length; ++i) {
      codePoint = string.charCodeAt(i);

      // is surrogate component
      if (codePoint > 0xD7FF && codePoint < 0xE000) {
        // last char was a lead
        if (!leadSurrogate) {
          // no lead yet
          if (codePoint > 0xDBFF) {
            // unexpected trail
            if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
            continue
          } else if (i + 1 === length) {
            // unpaired lead
            if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
            continue
          }

          // valid lead
          leadSurrogate = codePoint;

          continue
        }

        // 2 leads in a row
        if (codePoint < 0xDC00) {
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
          leadSurrogate = codePoint;
          continue
        }

        // valid surrogate pair
        codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000;
      } else if (leadSurrogate) {
        // valid bmp char, but last char was a lead
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
      }

      leadSurrogate = null;

      // encode utf8
      if (codePoint < 0x80) {
        if ((units -= 1) < 0) break
        bytes.push(codePoint);
      } else if (codePoint < 0x800) {
        if ((units -= 2) < 0) break
        bytes.push(
          codePoint >> 0x6 | 0xC0,
          codePoint & 0x3F | 0x80
        );
      } else if (codePoint < 0x10000) {
        if ((units -= 3) < 0) break
        bytes.push(
          codePoint >> 0xC | 0xE0,
          codePoint >> 0x6 & 0x3F | 0x80,
          codePoint & 0x3F | 0x80
        );
      } else if (codePoint < 0x110000) {
        if ((units -= 4) < 0) break
        bytes.push(
          codePoint >> 0x12 | 0xF0,
          codePoint >> 0xC & 0x3F | 0x80,
          codePoint >> 0x6 & 0x3F | 0x80,
          codePoint & 0x3F | 0x80
        );
      } else {
        throw new Error('Invalid code point')
      }
    }

    return bytes
  }

  function asciiToBytes (str) {
    var byteArray = [];
    for (var i = 0; i < str.length; ++i) {
      // Node's code seems to be doing this and not & 0x7F..
      byteArray.push(str.charCodeAt(i) & 0xFF);
    }
    return byteArray
  }

  function utf16leToBytes (str, units) {
    var c, hi, lo;
    var byteArray = [];
    for (var i = 0; i < str.length; ++i) {
      if ((units -= 2) < 0) break

      c = str.charCodeAt(i);
      hi = c >> 8;
      lo = c % 256;
      byteArray.push(lo);
      byteArray.push(hi);
    }

    return byteArray
  }


  function base64ToBytes (str) {
    return toByteArray(base64clean(str))
  }

  function blitBuffer (src, dst, offset, length) {
    for (var i = 0; i < length; ++i) {
      if ((i + offset >= dst.length) || (i >= src.length)) break
      dst[i + offset] = src[i];
    }
    return i
  }

  function isnan (val) {
    return val !== val // eslint-disable-line no-self-compare
  }


  // the following is from is-buffer, also by Feross Aboukhadijeh and with same lisence
  // The _isBuffer check is for Safari 5-7 support, because it's missing
  // Object.prototype.constructor. Remove this eventually
  function isBuffer$1(obj) {
    return obj != null && (!!obj._isBuffer || isFastBuffer(obj) || isSlowBuffer(obj))
  }

  function isFastBuffer (obj) {
    return !!obj.constructor && typeof obj.constructor.isBuffer === 'function' && obj.constructor.isBuffer(obj)
  }

  // For Node v0.10 support. Remove this eventually.
  function isSlowBuffer (obj) {
    return typeof obj.readFloatLE === 'function' && typeof obj.slice === 'function' && isFastBuffer(obj.slice(0, 0))
  }

  var bufferEs6 = /*#__PURE__*/Object.freeze({
    __proto__: null,
    Buffer: Buffer$u,
    INSPECT_MAX_BYTES: INSPECT_MAX_BYTES,
    SlowBuffer: SlowBuffer,
    isBuffer: isBuffer$1,
    kMaxLength: _kMaxLength
  });

  var require$$0$1 = /*@__PURE__*/getAugmentedNamespace(bufferEs6);

  /*! safe-buffer. MIT License. Feross Aboukhadijeh <https://feross.org/opensource> */

  (function (module, exports) {
  	/* eslint-disable node/no-deprecated-api */
  	var buffer = require$$0$1;
  	var Buffer = buffer.Buffer;

  	// alternative to using Object.keys for old browsers
  	function copyProps (src, dst) {
  	  for (var key in src) {
  	    dst[key] = src[key];
  	  }
  	}
  	if (Buffer.from && Buffer.alloc && Buffer.allocUnsafe && Buffer.allocUnsafeSlow) {
  	  module.exports = buffer;
  	} else {
  	  // Copy properties from require('buffer')
  	  copyProps(buffer, exports);
  	  exports.Buffer = SafeBuffer;
  	}

  	function SafeBuffer (arg, encodingOrOffset, length) {
  	  return Buffer(arg, encodingOrOffset, length)
  	}

  	SafeBuffer.prototype = Object.create(Buffer.prototype);

  	// Copy static methods from Buffer
  	copyProps(Buffer, SafeBuffer);

  	SafeBuffer.from = function (arg, encodingOrOffset, length) {
  	  if (typeof arg === 'number') {
  	    throw new TypeError('Argument must not be a number')
  	  }
  	  return Buffer(arg, encodingOrOffset, length)
  	};

  	SafeBuffer.alloc = function (size, fill, encoding) {
  	  if (typeof size !== 'number') {
  	    throw new TypeError('Argument must be a number')
  	  }
  	  var buf = Buffer(size);
  	  if (fill !== undefined) {
  	    if (typeof encoding === 'string') {
  	      buf.fill(fill, encoding);
  	    } else {
  	      buf.fill(fill);
  	    }
  	  } else {
  	    buf.fill(0);
  	  }
  	  return buf
  	};

  	SafeBuffer.allocUnsafe = function (size) {
  	  if (typeof size !== 'number') {
  	    throw new TypeError('Argument must be a number')
  	  }
  	  return Buffer(size)
  	};

  	SafeBuffer.allocUnsafeSlow = function (size) {
  	  if (typeof size !== 'number') {
  	    throw new TypeError('Argument must be a number')
  	  }
  	  return buffer.SlowBuffer(size)
  	}; 
  } (safeBuffer, safeBuffer.exports));

  var safeBufferExports = safeBuffer.exports;

  var domain;

  // This constructor is used to store event handlers. Instantiating this is
  // faster than explicitly calling `Object.create(null)` to get a "clean" empty
  // object (tested with v8 v4.9).
  function EventHandlers() {}
  EventHandlers.prototype = Object.create(null);

  function EventEmitter() {
    EventEmitter.init.call(this);
  }

  // nodejs oddity
  // require('events') === require('events').EventEmitter
  EventEmitter.EventEmitter = EventEmitter;

  EventEmitter.usingDomains = false;

  EventEmitter.prototype.domain = undefined;
  EventEmitter.prototype._events = undefined;
  EventEmitter.prototype._maxListeners = undefined;

  // By default EventEmitters will print a warning if more than 10 listeners are
  // added to it. This is a useful default which helps finding memory leaks.
  EventEmitter.defaultMaxListeners = 10;

  EventEmitter.init = function() {
    this.domain = null;
    if (EventEmitter.usingDomains) {
      // if there is an active domain, then attach to it.
      if (domain.active ) ;
    }

    if (!this._events || this._events === Object.getPrototypeOf(this)._events) {
      this._events = new EventHandlers();
      this._eventsCount = 0;
    }

    this._maxListeners = this._maxListeners || undefined;
  };

  // Obviously not all Emitters should be limited to 10. This function allows
  // that to be increased. Set to zero for unlimited.
  EventEmitter.prototype.setMaxListeners = function setMaxListeners(n) {
    if (typeof n !== 'number' || n < 0 || isNaN(n))
      throw new TypeError('"n" argument must be a positive number');
    this._maxListeners = n;
    return this;
  };

  function $getMaxListeners(that) {
    if (that._maxListeners === undefined)
      return EventEmitter.defaultMaxListeners;
    return that._maxListeners;
  }

  EventEmitter.prototype.getMaxListeners = function getMaxListeners() {
    return $getMaxListeners(this);
  };

  // These standalone emit* functions are used to optimize calling of event
  // handlers for fast cases because emit() itself often has a variable number of
  // arguments and can be deoptimized because of that. These functions always have
  // the same number of arguments and thus do not get deoptimized, so the code
  // inside them can execute faster.
  function emitNone(handler, isFn, self) {
    if (isFn)
      handler.call(self);
    else {
      var len = handler.length;
      var listeners = arrayClone(handler, len);
      for (var i = 0; i < len; ++i)
        listeners[i].call(self);
    }
  }
  function emitOne(handler, isFn, self, arg1) {
    if (isFn)
      handler.call(self, arg1);
    else {
      var len = handler.length;
      var listeners = arrayClone(handler, len);
      for (var i = 0; i < len; ++i)
        listeners[i].call(self, arg1);
    }
  }
  function emitTwo(handler, isFn, self, arg1, arg2) {
    if (isFn)
      handler.call(self, arg1, arg2);
    else {
      var len = handler.length;
      var listeners = arrayClone(handler, len);
      for (var i = 0; i < len; ++i)
        listeners[i].call(self, arg1, arg2);
    }
  }
  function emitThree(handler, isFn, self, arg1, arg2, arg3) {
    if (isFn)
      handler.call(self, arg1, arg2, arg3);
    else {
      var len = handler.length;
      var listeners = arrayClone(handler, len);
      for (var i = 0; i < len; ++i)
        listeners[i].call(self, arg1, arg2, arg3);
    }
  }

  function emitMany(handler, isFn, self, args) {
    if (isFn)
      handler.apply(self, args);
    else {
      var len = handler.length;
      var listeners = arrayClone(handler, len);
      for (var i = 0; i < len; ++i)
        listeners[i].apply(self, args);
    }
  }

  EventEmitter.prototype.emit = function emit(type) {
    var er, handler, len, args, i, events, domain;
    var doError = (type === 'error');

    events = this._events;
    if (events)
      doError = (doError && events.error == null);
    else if (!doError)
      return false;

    domain = this.domain;

    // If there is no 'error' event listener then throw.
    if (doError) {
      er = arguments[1];
      if (domain) {
        if (!er)
          er = new Error('Uncaught, unspecified "error" event');
        er.domainEmitter = this;
        er.domain = domain;
        er.domainThrown = false;
        domain.emit('error', er);
      } else if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      } else {
        // At least give some kind of context to the user
        var err = new Error('Uncaught, unspecified "error" event. (' + er + ')');
        err.context = er;
        throw err;
      }
      return false;
    }

    handler = events[type];

    if (!handler)
      return false;

    var isFn = typeof handler === 'function';
    len = arguments.length;
    switch (len) {
      // fast cases
      case 1:
        emitNone(handler, isFn, this);
        break;
      case 2:
        emitOne(handler, isFn, this, arguments[1]);
        break;
      case 3:
        emitTwo(handler, isFn, this, arguments[1], arguments[2]);
        break;
      case 4:
        emitThree(handler, isFn, this, arguments[1], arguments[2], arguments[3]);
        break;
      // slower
      default:
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        emitMany(handler, isFn, this, args);
    }

    return true;
  };

  function _addListener(target, type, listener, prepend) {
    var m;
    var events;
    var existing;

    if (typeof listener !== 'function')
      throw new TypeError('"listener" argument must be a function');

    events = target._events;
    if (!events) {
      events = target._events = new EventHandlers();
      target._eventsCount = 0;
    } else {
      // To avoid recursion in the case that type === "newListener"! Before
      // adding it to the listeners, first emit "newListener".
      if (events.newListener) {
        target.emit('newListener', type,
                    listener.listener ? listener.listener : listener);

        // Re-assign `events` because a newListener handler could have caused the
        // this._events to be assigned to a new object
        events = target._events;
      }
      existing = events[type];
    }

    if (!existing) {
      // Optimize the case of one listener. Don't need the extra array object.
      existing = events[type] = listener;
      ++target._eventsCount;
    } else {
      if (typeof existing === 'function') {
        // Adding the second element, need to change to array.
        existing = events[type] = prepend ? [listener, existing] :
                                            [existing, listener];
      } else {
        // If we've already got an array, just append.
        if (prepend) {
          existing.unshift(listener);
        } else {
          existing.push(listener);
        }
      }

      // Check for listener leak
      if (!existing.warned) {
        m = $getMaxListeners(target);
        if (m && m > 0 && existing.length > m) {
          existing.warned = true;
          var w = new Error('Possible EventEmitter memory leak detected. ' +
                              existing.length + ' ' + type + ' listeners added. ' +
                              'Use emitter.setMaxListeners() to increase limit');
          w.name = 'MaxListenersExceededWarning';
          w.emitter = target;
          w.type = type;
          w.count = existing.length;
          emitWarning(w);
        }
      }
    }

    return target;
  }
  function emitWarning(e) {
    typeof console.warn === 'function' ? console.warn(e) : console.log(e);
  }
  EventEmitter.prototype.addListener = function addListener(type, listener) {
    return _addListener(this, type, listener, false);
  };

  EventEmitter.prototype.on = EventEmitter.prototype.addListener;

  EventEmitter.prototype.prependListener =
      function prependListener(type, listener) {
        return _addListener(this, type, listener, true);
      };

  function _onceWrap(target, type, listener) {
    var fired = false;
    function g() {
      target.removeListener(type, g);
      if (!fired) {
        fired = true;
        listener.apply(target, arguments);
      }
    }
    g.listener = listener;
    return g;
  }

  EventEmitter.prototype.once = function once(type, listener) {
    if (typeof listener !== 'function')
      throw new TypeError('"listener" argument must be a function');
    this.on(type, _onceWrap(this, type, listener));
    return this;
  };

  EventEmitter.prototype.prependOnceListener =
      function prependOnceListener(type, listener) {
        if (typeof listener !== 'function')
          throw new TypeError('"listener" argument must be a function');
        this.prependListener(type, _onceWrap(this, type, listener));
        return this;
      };

  // emits a 'removeListener' event iff the listener was removed
  EventEmitter.prototype.removeListener =
      function removeListener(type, listener) {
        var list, events, position, i, originalListener;

        if (typeof listener !== 'function')
          throw new TypeError('"listener" argument must be a function');

        events = this._events;
        if (!events)
          return this;

        list = events[type];
        if (!list)
          return this;

        if (list === listener || (list.listener && list.listener === listener)) {
          if (--this._eventsCount === 0)
            this._events = new EventHandlers();
          else {
            delete events[type];
            if (events.removeListener)
              this.emit('removeListener', type, list.listener || listener);
          }
        } else if (typeof list !== 'function') {
          position = -1;

          for (i = list.length; i-- > 0;) {
            if (list[i] === listener ||
                (list[i].listener && list[i].listener === listener)) {
              originalListener = list[i].listener;
              position = i;
              break;
            }
          }

          if (position < 0)
            return this;

          if (list.length === 1) {
            list[0] = undefined;
            if (--this._eventsCount === 0) {
              this._events = new EventHandlers();
              return this;
            } else {
              delete events[type];
            }
          } else {
            spliceOne(list, position);
          }

          if (events.removeListener)
            this.emit('removeListener', type, originalListener || listener);
        }

        return this;
      };

  EventEmitter.prototype.removeAllListeners =
      function removeAllListeners(type) {
        var listeners, events;

        events = this._events;
        if (!events)
          return this;

        // not listening for removeListener, no need to emit
        if (!events.removeListener) {
          if (arguments.length === 0) {
            this._events = new EventHandlers();
            this._eventsCount = 0;
          } else if (events[type]) {
            if (--this._eventsCount === 0)
              this._events = new EventHandlers();
            else
              delete events[type];
          }
          return this;
        }

        // emit removeListener for all listeners on all events
        if (arguments.length === 0) {
          var keys = Object.keys(events);
          for (var i = 0, key; i < keys.length; ++i) {
            key = keys[i];
            if (key === 'removeListener') continue;
            this.removeAllListeners(key);
          }
          this.removeAllListeners('removeListener');
          this._events = new EventHandlers();
          this._eventsCount = 0;
          return this;
        }

        listeners = events[type];

        if (typeof listeners === 'function') {
          this.removeListener(type, listeners);
        } else if (listeners) {
          // LIFO order
          do {
            this.removeListener(type, listeners[listeners.length - 1]);
          } while (listeners[0]);
        }

        return this;
      };

  EventEmitter.prototype.listeners = function listeners(type) {
    var evlistener;
    var ret;
    var events = this._events;

    if (!events)
      ret = [];
    else {
      evlistener = events[type];
      if (!evlistener)
        ret = [];
      else if (typeof evlistener === 'function')
        ret = [evlistener.listener || evlistener];
      else
        ret = unwrapListeners(evlistener);
    }

    return ret;
  };

  EventEmitter.listenerCount = function(emitter, type) {
    if (typeof emitter.listenerCount === 'function') {
      return emitter.listenerCount(type);
    } else {
      return listenerCount$1.call(emitter, type);
    }
  };

  EventEmitter.prototype.listenerCount = listenerCount$1;
  function listenerCount$1(type) {
    var events = this._events;

    if (events) {
      var evlistener = events[type];

      if (typeof evlistener === 'function') {
        return 1;
      } else if (evlistener) {
        return evlistener.length;
      }
    }

    return 0;
  }

  EventEmitter.prototype.eventNames = function eventNames() {
    return this._eventsCount > 0 ? Reflect.ownKeys(this._events) : [];
  };

  // About 1.5x faster than the two-arg version of Array#splice().
  function spliceOne(list, index) {
    for (var i = index, k = i + 1, n = list.length; k < n; i += 1, k += 1)
      list[i] = list[k];
    list.pop();
  }

  function arrayClone(arr, i) {
    var copy = new Array(i);
    while (i--)
      copy[i] = arr[i];
    return copy;
  }

  function unwrapListeners(arr) {
    var ret = new Array(arr.length);
    for (var i = 0; i < ret.length; ++i) {
      ret[i] = arr[i].listener || arr[i];
    }
    return ret;
  }

  var events = /*#__PURE__*/Object.freeze({
    __proto__: null,
    EventEmitter: EventEmitter,
    default: EventEmitter
  });

  // shim for using process in browser
  // based off https://github.com/defunctzombie/node-process/blob/master/browser.js

  function defaultSetTimout() {
      throw new Error('setTimeout has not been defined');
  }
  function defaultClearTimeout () {
      throw new Error('clearTimeout has not been defined');
  }
  var cachedSetTimeout = defaultSetTimout;
  var cachedClearTimeout = defaultClearTimeout;
  if (typeof global$1.setTimeout === 'function') {
      cachedSetTimeout = setTimeout;
  }
  if (typeof global$1.clearTimeout === 'function') {
      cachedClearTimeout = clearTimeout;
  }

  function runTimeout(fun) {
      if (cachedSetTimeout === setTimeout) {
          //normal enviroments in sane situations
          return setTimeout(fun, 0);
      }
      // if setTimeout wasn't available but was latter defined
      if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
          cachedSetTimeout = setTimeout;
          return setTimeout(fun, 0);
      }
      try {
          // when when somebody has screwed with setTimeout but no I.E. maddness
          return cachedSetTimeout(fun, 0);
      } catch(e){
          try {
              // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
              return cachedSetTimeout.call(null, fun, 0);
          } catch(e){
              // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
              return cachedSetTimeout.call(this, fun, 0);
          }
      }


  }
  function runClearTimeout(marker) {
      if (cachedClearTimeout === clearTimeout) {
          //normal enviroments in sane situations
          return clearTimeout(marker);
      }
      // if clearTimeout wasn't available but was latter defined
      if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
          cachedClearTimeout = clearTimeout;
          return clearTimeout(marker);
      }
      try {
          // when when somebody has screwed with setTimeout but no I.E. maddness
          return cachedClearTimeout(marker);
      } catch (e){
          try {
              // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
              return cachedClearTimeout.call(null, marker);
          } catch (e){
              // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
              // Some versions of I.E. have different rules for clearTimeout vs setTimeout
              return cachedClearTimeout.call(this, marker);
          }
      }



  }
  var queue = [];
  var draining = false;
  var currentQueue;
  var queueIndex = -1;

  function cleanUpNextTick() {
      if (!draining || !currentQueue) {
          return;
      }
      draining = false;
      if (currentQueue.length) {
          queue = currentQueue.concat(queue);
      } else {
          queueIndex = -1;
      }
      if (queue.length) {
          drainQueue();
      }
  }

  function drainQueue() {
      if (draining) {
          return;
      }
      var timeout = runTimeout(cleanUpNextTick);
      draining = true;

      var len = queue.length;
      while(len) {
          currentQueue = queue;
          queue = [];
          while (++queueIndex < len) {
              if (currentQueue) {
                  currentQueue[queueIndex].run();
              }
          }
          queueIndex = -1;
          len = queue.length;
      }
      currentQueue = null;
      draining = false;
      runClearTimeout(timeout);
  }
  function nextTick$1(fun) {
      var args = new Array(arguments.length - 1);
      if (arguments.length > 1) {
          for (var i = 1; i < arguments.length; i++) {
              args[i - 1] = arguments[i];
          }
      }
      queue.push(new Item(fun, args));
      if (queue.length === 1 && !draining) {
          runTimeout(drainQueue);
      }
  }
  // v8 likes predictible objects
  function Item(fun, array) {
      this.fun = fun;
      this.array = array;
  }
  Item.prototype.run = function () {
      this.fun.apply(null, this.array);
  };
  var title = 'browser';
  var platform = 'browser';
  var browser$6 = true;
  var env = {};
  var argv = [];
  var version = ''; // empty string to avoid regexp issues
  var versions = {};
  var release = {};
  var config = {};

  function noop() {}

  var on = noop;
  var addListener = noop;
  var once = noop;
  var off = noop;
  var removeListener = noop;
  var removeAllListeners = noop;
  var emit = noop;

  function binding(name) {
      throw new Error('process.binding is not supported');
  }

  function cwd () { return '/' }
  function chdir (dir) {
      throw new Error('process.chdir is not supported');
  }function umask() { return 0; }

  // from https://github.com/kumavis/browser-process-hrtime/blob/master/index.js
  var performance$1 = global$1.performance || {};
  var performanceNow =
    performance$1.now        ||
    performance$1.mozNow     ||
    performance$1.msNow      ||
    performance$1.oNow       ||
    performance$1.webkitNow  ||
    function(){ return (new Date()).getTime() };

  // generate timestamp or delta
  // see http://nodejs.org/api/process.html#process_process_hrtime
  function hrtime(previousTimestamp){
    var clocktime = performanceNow.call(performance$1)*1e-3;
    var seconds = Math.floor(clocktime);
    var nanoseconds = Math.floor((clocktime%1)*1e9);
    if (previousTimestamp) {
      seconds = seconds - previousTimestamp[0];
      nanoseconds = nanoseconds - previousTimestamp[1];
      if (nanoseconds<0) {
        seconds--;
        nanoseconds += 1e9;
      }
    }
    return [seconds,nanoseconds]
  }

  var startTime = new Date();
  function uptime() {
    var currentTime = new Date();
    var dif = currentTime - startTime;
    return dif / 1000;
  }

  var process = {
    nextTick: nextTick$1,
    title: title,
    browser: browser$6,
    env: env,
    argv: argv,
    version: version,
    versions: versions,
    on: on,
    addListener: addListener,
    once: once,
    off: off,
    removeListener: removeListener,
    removeAllListeners: removeAllListeners,
    emit: emit,
    binding: binding,
    cwd: cwd,
    chdir: chdir,
    umask: umask,
    hrtime: hrtime,
    platform: platform,
    release: release,
    config: config,
    uptime: uptime
  };

  var inherits$k;
  if (typeof Object.create === 'function'){
    inherits$k = function inherits(ctor, superCtor) {
      // implementation from standard node.js 'util' module
      ctor.super_ = superCtor;
      ctor.prototype = Object.create(superCtor.prototype, {
        constructor: {
          value: ctor,
          enumerable: false,
          writable: true,
          configurable: true
        }
      });
    };
  } else {
    inherits$k = function inherits(ctor, superCtor) {
      ctor.super_ = superCtor;
      var TempCtor = function () {};
      TempCtor.prototype = superCtor.prototype;
      ctor.prototype = new TempCtor();
      ctor.prototype.constructor = ctor;
    };
  }
  var inherits$l = inherits$k;

  var formatRegExp = /%[sdj%]/g;
  function format(f) {
    if (!isString(f)) {
      var objects = [];
      for (var i = 0; i < arguments.length; i++) {
        objects.push(inspect(arguments[i]));
      }
      return objects.join(' ');
    }

    var i = 1;
    var args = arguments;
    var len = args.length;
    var str = String(f).replace(formatRegExp, function(x) {
      if (x === '%%') return '%';
      if (i >= len) return x;
      switch (x) {
        case '%s': return String(args[i++]);
        case '%d': return Number(args[i++]);
        case '%j':
          try {
            return JSON.stringify(args[i++]);
          } catch (_) {
            return '[Circular]';
          }
        default:
          return x;
      }
    });
    for (var x = args[i]; i < len; x = args[++i]) {
      if (isNull(x) || !isObject(x)) {
        str += ' ' + x;
      } else {
        str += ' ' + inspect(x);
      }
    }
    return str;
  }

  // Mark that a method should not be used.
  // Returns a modified function which warns once by default.
  // If --no-deprecation is set, then it is a no-op.
  function deprecate(fn, msg) {
    // Allow for deprecating things in the process of starting up.
    if (isUndefined(global$1.process)) {
      return function() {
        return deprecate(fn, msg).apply(this, arguments);
      };
    }

    if (process.noDeprecation === true) {
      return fn;
    }

    var warned = false;
    function deprecated() {
      if (!warned) {
        if (process.throwDeprecation) {
          throw new Error(msg);
        } else if (process.traceDeprecation) {
          console.trace(msg);
        } else {
          console.error(msg);
        }
        warned = true;
      }
      return fn.apply(this, arguments);
    }

    return deprecated;
  }

  var debugs = {};
  var debugEnviron;
  function debuglog(set) {
    if (isUndefined(debugEnviron))
      debugEnviron = process.env.NODE_DEBUG || '';
    set = set.toUpperCase();
    if (!debugs[set]) {
      if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
        var pid = 0;
        debugs[set] = function() {
          var msg = format.apply(null, arguments);
          console.error('%s %d: %s', set, pid, msg);
        };
      } else {
        debugs[set] = function() {};
      }
    }
    return debugs[set];
  }

  /**
   * Echos the value of a value. Trys to print the value out
   * in the best way possible given the different types.
   *
   * @param {Object} obj The object to print out.
   * @param {Object} opts Optional options object that alters the output.
   */
  /* legacy: obj, showHidden, depth, colors*/
  function inspect(obj, opts) {
    // default options
    var ctx = {
      seen: [],
      stylize: stylizeNoColor
    };
    // legacy...
    if (arguments.length >= 3) ctx.depth = arguments[2];
    if (arguments.length >= 4) ctx.colors = arguments[3];
    if (isBoolean(opts)) {
      // legacy...
      ctx.showHidden = opts;
    } else if (opts) {
      // got an "options" object
      _extend(ctx, opts);
    }
    // set default options
    if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
    if (isUndefined(ctx.depth)) ctx.depth = 2;
    if (isUndefined(ctx.colors)) ctx.colors = false;
    if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
    if (ctx.colors) ctx.stylize = stylizeWithColor;
    return formatValue(ctx, obj, ctx.depth);
  }

  // http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
  inspect.colors = {
    'bold' : [1, 22],
    'italic' : [3, 23],
    'underline' : [4, 24],
    'inverse' : [7, 27],
    'white' : [37, 39],
    'grey' : [90, 39],
    'black' : [30, 39],
    'blue' : [34, 39],
    'cyan' : [36, 39],
    'green' : [32, 39],
    'magenta' : [35, 39],
    'red' : [31, 39],
    'yellow' : [33, 39]
  };

  // Don't use 'blue' not visible on cmd.exe
  inspect.styles = {
    'special': 'cyan',
    'number': 'yellow',
    'boolean': 'yellow',
    'undefined': 'grey',
    'null': 'bold',
    'string': 'green',
    'date': 'magenta',
    // "name": intentionally not styling
    'regexp': 'red'
  };


  function stylizeWithColor(str, styleType) {
    var style = inspect.styles[styleType];

    if (style) {
      return '\u001b[' + inspect.colors[style][0] + 'm' + str +
             '\u001b[' + inspect.colors[style][1] + 'm';
    } else {
      return str;
    }
  }


  function stylizeNoColor(str, styleType) {
    return str;
  }


  function arrayToHash(array) {
    var hash = {};

    array.forEach(function(val, idx) {
      hash[val] = true;
    });

    return hash;
  }


  function formatValue(ctx, value, recurseTimes) {
    // Provide a hook for user-specified inspect functions.
    // Check that value is an object with an inspect function on it
    if (ctx.customInspect &&
        value &&
        isFunction(value.inspect) &&
        // Filter out the util module, it's inspect function is special
        value.inspect !== inspect &&
        // Also filter out any prototype objects using the circular check.
        !(value.constructor && value.constructor.prototype === value)) {
      var ret = value.inspect(recurseTimes, ctx);
      if (!isString(ret)) {
        ret = formatValue(ctx, ret, recurseTimes);
      }
      return ret;
    }

    // Primitive types cannot have properties
    var primitive = formatPrimitive(ctx, value);
    if (primitive) {
      return primitive;
    }

    // Look up the keys of the object.
    var keys = Object.keys(value);
    var visibleKeys = arrayToHash(keys);

    if (ctx.showHidden) {
      keys = Object.getOwnPropertyNames(value);
    }

    // IE doesn't make error fields non-enumerable
    // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
    if (isError(value)
        && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
      return formatError(value);
    }

    // Some type of object without properties can be shortcutted.
    if (keys.length === 0) {
      if (isFunction(value)) {
        var name = value.name ? ': ' + value.name : '';
        return ctx.stylize('[Function' + name + ']', 'special');
      }
      if (isRegExp(value)) {
        return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
      }
      if (isDate(value)) {
        return ctx.stylize(Date.prototype.toString.call(value), 'date');
      }
      if (isError(value)) {
        return formatError(value);
      }
    }

    var base = '', array = false, braces = ['{', '}'];

    // Make Array say that they are Array
    if (isArray(value)) {
      array = true;
      braces = ['[', ']'];
    }

    // Make functions say that they are functions
    if (isFunction(value)) {
      var n = value.name ? ': ' + value.name : '';
      base = ' [Function' + n + ']';
    }

    // Make RegExps say that they are RegExps
    if (isRegExp(value)) {
      base = ' ' + RegExp.prototype.toString.call(value);
    }

    // Make dates with properties first say the date
    if (isDate(value)) {
      base = ' ' + Date.prototype.toUTCString.call(value);
    }

    // Make error with message first say the error
    if (isError(value)) {
      base = ' ' + formatError(value);
    }

    if (keys.length === 0 && (!array || value.length == 0)) {
      return braces[0] + base + braces[1];
    }

    if (recurseTimes < 0) {
      if (isRegExp(value)) {
        return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
      } else {
        return ctx.stylize('[Object]', 'special');
      }
    }

    ctx.seen.push(value);

    var output;
    if (array) {
      output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
    } else {
      output = keys.map(function(key) {
        return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
      });
    }

    ctx.seen.pop();

    return reduceToSingleString(output, base, braces);
  }


  function formatPrimitive(ctx, value) {
    if (isUndefined(value))
      return ctx.stylize('undefined', 'undefined');
    if (isString(value)) {
      var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                               .replace(/'/g, "\\'")
                                               .replace(/\\"/g, '"') + '\'';
      return ctx.stylize(simple, 'string');
    }
    if (isNumber(value))
      return ctx.stylize('' + value, 'number');
    if (isBoolean(value))
      return ctx.stylize('' + value, 'boolean');
    // For some reason typeof null is "object", so special case here.
    if (isNull(value))
      return ctx.stylize('null', 'null');
  }


  function formatError(value) {
    return '[' + Error.prototype.toString.call(value) + ']';
  }


  function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
    var output = [];
    for (var i = 0, l = value.length; i < l; ++i) {
      if (hasOwnProperty(value, String(i))) {
        output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
            String(i), true));
      } else {
        output.push('');
      }
    }
    keys.forEach(function(key) {
      if (!key.match(/^\d+$/)) {
        output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
            key, true));
      }
    });
    return output;
  }


  function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
    var name, str, desc;
    desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
    if (desc.get) {
      if (desc.set) {
        str = ctx.stylize('[Getter/Setter]', 'special');
      } else {
        str = ctx.stylize('[Getter]', 'special');
      }
    } else {
      if (desc.set) {
        str = ctx.stylize('[Setter]', 'special');
      }
    }
    if (!hasOwnProperty(visibleKeys, key)) {
      name = '[' + key + ']';
    }
    if (!str) {
      if (ctx.seen.indexOf(desc.value) < 0) {
        if (isNull(recurseTimes)) {
          str = formatValue(ctx, desc.value, null);
        } else {
          str = formatValue(ctx, desc.value, recurseTimes - 1);
        }
        if (str.indexOf('\n') > -1) {
          if (array) {
            str = str.split('\n').map(function(line) {
              return '  ' + line;
            }).join('\n').substr(2);
          } else {
            str = '\n' + str.split('\n').map(function(line) {
              return '   ' + line;
            }).join('\n');
          }
        }
      } else {
        str = ctx.stylize('[Circular]', 'special');
      }
    }
    if (isUndefined(name)) {
      if (array && key.match(/^\d+$/)) {
        return str;
      }
      name = JSON.stringify('' + key);
      if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
        name = name.substr(1, name.length - 2);
        name = ctx.stylize(name, 'name');
      } else {
        name = name.replace(/'/g, "\\'")
                   .replace(/\\"/g, '"')
                   .replace(/(^"|"$)/g, "'");
        name = ctx.stylize(name, 'string');
      }
    }

    return name + ': ' + str;
  }


  function reduceToSingleString(output, base, braces) {
    var length = output.reduce(function(prev, cur) {
      if (cur.indexOf('\n') >= 0) ;
      return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
    }, 0);

    if (length > 60) {
      return braces[0] +
             (base === '' ? '' : base + '\n ') +
             ' ' +
             output.join(',\n  ') +
             ' ' +
             braces[1];
    }

    return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
  }


  // NOTE: These type checking functions intentionally don't use `instanceof`
  // because it is fragile and can be easily faked with `Object.create()`.
  function isArray(ar) {
    return Array.isArray(ar);
  }

  function isBoolean(arg) {
    return typeof arg === 'boolean';
  }

  function isNull(arg) {
    return arg === null;
  }

  function isNullOrUndefined(arg) {
    return arg == null;
  }

  function isNumber(arg) {
    return typeof arg === 'number';
  }

  function isString(arg) {
    return typeof arg === 'string';
  }

  function isSymbol(arg) {
    return typeof arg === 'symbol';
  }

  function isUndefined(arg) {
    return arg === void 0;
  }

  function isRegExp(re) {
    return isObject(re) && objectToString(re) === '[object RegExp]';
  }

  function isObject(arg) {
    return typeof arg === 'object' && arg !== null;
  }

  function isDate(d) {
    return isObject(d) && objectToString(d) === '[object Date]';
  }

  function isError(e) {
    return isObject(e) &&
        (objectToString(e) === '[object Error]' || e instanceof Error);
  }

  function isFunction(arg) {
    return typeof arg === 'function';
  }

  function isPrimitive(arg) {
    return arg === null ||
           typeof arg === 'boolean' ||
           typeof arg === 'number' ||
           typeof arg === 'string' ||
           typeof arg === 'symbol' ||  // ES6 symbol
           typeof arg === 'undefined';
  }

  function isBuffer(maybeBuf) {
    return isBuffer$1(maybeBuf);
  }

  function objectToString(o) {
    return Object.prototype.toString.call(o);
  }


  function pad(n) {
    return n < 10 ? '0' + n.toString(10) : n.toString(10);
  }


  var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
                'Oct', 'Nov', 'Dec'];

  // 26 Feb 16:19:34
  function timestamp() {
    var d = new Date();
    var time = [pad(d.getHours()),
                pad(d.getMinutes()),
                pad(d.getSeconds())].join(':');
    return [d.getDate(), months[d.getMonth()], time].join(' ');
  }


  // log is just a thin wrapper to console.log that prepends a timestamp
  function log() {
    console.log('%s - %s', timestamp(), format.apply(null, arguments));
  }

  function _extend(origin, add) {
    // Don't do anything if add isn't an object
    if (!add || !isObject(add)) return origin;

    var keys = Object.keys(add);
    var i = keys.length;
    while (i--) {
      origin[keys[i]] = add[keys[i]];
    }
    return origin;
  }
  function hasOwnProperty(obj, prop) {
    return Object.prototype.hasOwnProperty.call(obj, prop);
  }

  var util$1 = {
    inherits: inherits$l,
    _extend: _extend,
    log: log,
    isBuffer: isBuffer,
    isPrimitive: isPrimitive,
    isFunction: isFunction,
    isError: isError,
    isDate: isDate,
    isObject: isObject,
    isRegExp: isRegExp,
    isUndefined: isUndefined,
    isSymbol: isSymbol,
    isString: isString,
    isNumber: isNumber,
    isNullOrUndefined: isNullOrUndefined,
    isNull: isNull,
    isBoolean: isBoolean,
    isArray: isArray,
    inspect: inspect,
    deprecate: deprecate,
    format: format,
    debuglog: debuglog
  };

  var util$2 = /*#__PURE__*/Object.freeze({
    __proto__: null,
    _extend: _extend,
    debuglog: debuglog,
    default: util$1,
    deprecate: deprecate,
    format: format,
    inherits: inherits$l,
    inspect: inspect,
    isArray: isArray,
    isBoolean: isBoolean,
    isBuffer: isBuffer,
    isDate: isDate,
    isError: isError,
    isFunction: isFunction,
    isNull: isNull,
    isNullOrUndefined: isNullOrUndefined,
    isNumber: isNumber,
    isObject: isObject,
    isPrimitive: isPrimitive,
    isRegExp: isRegExp,
    isString: isString,
    isSymbol: isSymbol,
    isUndefined: isUndefined,
    log: log
  });

  function BufferList() {
    this.head = null;
    this.tail = null;
    this.length = 0;
  }

  BufferList.prototype.push = function (v) {
    var entry = { data: v, next: null };
    if (this.length > 0) this.tail.next = entry;else this.head = entry;
    this.tail = entry;
    ++this.length;
  };

  BufferList.prototype.unshift = function (v) {
    var entry = { data: v, next: this.head };
    if (this.length === 0) this.tail = entry;
    this.head = entry;
    ++this.length;
  };

  BufferList.prototype.shift = function () {
    if (this.length === 0) return;
    var ret = this.head.data;
    if (this.length === 1) this.head = this.tail = null;else this.head = this.head.next;
    --this.length;
    return ret;
  };

  BufferList.prototype.clear = function () {
    this.head = this.tail = null;
    this.length = 0;
  };

  BufferList.prototype.join = function (s) {
    if (this.length === 0) return '';
    var p = this.head;
    var ret = '' + p.data;
    while (p = p.next) {
      ret += s + p.data;
    }return ret;
  };

  BufferList.prototype.concat = function (n) {
    if (this.length === 0) return Buffer$u.alloc(0);
    if (this.length === 1) return this.head.data;
    var ret = Buffer$u.allocUnsafe(n >>> 0);
    var p = this.head;
    var i = 0;
    while (p) {
      p.data.copy(ret, i);
      i += p.data.length;
      p = p.next;
    }
    return ret;
  };

  // Copyright Joyent, Inc. and other Node contributors.
  //
  // Permission is hereby granted, free of charge, to any person obtaining a
  // copy of this software and associated documentation files (the
  // "Software"), to deal in the Software without restriction, including
  // without limitation the rights to use, copy, modify, merge, publish,
  // distribute, sublicense, and/or sell copies of the Software, and to permit
  // persons to whom the Software is furnished to do so, subject to the
  // following conditions:
  //
  // The above copyright notice and this permission notice shall be included
  // in all copies or substantial portions of the Software.
  //
  // THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
  // OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
  // MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
  // NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
  // DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
  // OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
  // USE OR OTHER DEALINGS IN THE SOFTWARE.

  var isBufferEncoding = Buffer$u.isEncoding
    || function(encoding) {
         switch (encoding && encoding.toLowerCase()) {
           case 'hex': case 'utf8': case 'utf-8': case 'ascii': case 'binary': case 'base64': case 'ucs2': case 'ucs-2': case 'utf16le': case 'utf-16le': case 'raw': return true;
           default: return false;
         }
       };


  function assertEncoding(encoding) {
    if (encoding && !isBufferEncoding(encoding)) {
      throw new Error('Unknown encoding: ' + encoding);
    }
  }

  // StringDecoder provides an interface for efficiently splitting a series of
  // buffers into a series of JS strings without breaking apart multi-byte
  // characters. CESU-8 is handled as part of the UTF-8 encoding.
  //
  // @TODO Handling all encodings inside a single object makes it very difficult
  // to reason about this code, so it should be split up in the future.
  // @TODO There should be a utf8-strict encoding that rejects invalid UTF-8 code
  // points as used by CESU-8.
  function StringDecoder$1(encoding) {
    this.encoding = (encoding || 'utf8').toLowerCase().replace(/[-_]/, '');
    assertEncoding(encoding);
    switch (this.encoding) {
      case 'utf8':
        // CESU-8 represents each of Surrogate Pair by 3-bytes
        this.surrogateSize = 3;
        break;
      case 'ucs2':
      case 'utf16le':
        // UTF-16 represents each of Surrogate Pair by 2-bytes
        this.surrogateSize = 2;
        this.detectIncompleteChar = utf16DetectIncompleteChar;
        break;
      case 'base64':
        // Base-64 stores 3 bytes in 4 chars, and pads the remainder.
        this.surrogateSize = 3;
        this.detectIncompleteChar = base64DetectIncompleteChar;
        break;
      default:
        this.write = passThroughWrite;
        return;
    }

    // Enough space to store all bytes of a single character. UTF-8 needs 4
    // bytes, but CESU-8 may require up to 6 (3 bytes per surrogate).
    this.charBuffer = new Buffer$u(6);
    // Number of bytes received for the current incomplete multi-byte character.
    this.charReceived = 0;
    // Number of bytes expected for the current incomplete multi-byte character.
    this.charLength = 0;
  }

  // write decodes the given buffer and returns it as JS string that is
  // guaranteed to not contain any partial multi-byte characters. Any partial
  // character found at the end of the buffer is buffered up, and will be
  // returned when calling write again with the remaining bytes.
  //
  // Note: Converting a Buffer containing an orphan surrogate to a String
  // currently works, but converting a String to a Buffer (via `new Buffer`, or
  // Buffer#write) will replace incomplete surrogates with the unicode
  // replacement character. See https://codereview.chromium.org/121173009/ .
  StringDecoder$1.prototype.write = function(buffer) {
    var charStr = '';
    // if our last write ended with an incomplete multibyte character
    while (this.charLength) {
      // determine how many remaining bytes this buffer has to offer for this char
      var available = (buffer.length >= this.charLength - this.charReceived) ?
          this.charLength - this.charReceived :
          buffer.length;

      // add the new bytes to the char buffer
      buffer.copy(this.charBuffer, this.charReceived, 0, available);
      this.charReceived += available;

      if (this.charReceived < this.charLength) {
        // still not enough chars in this buffer? wait for more ...
        return '';
      }

      // remove bytes belonging to the current character from the buffer
      buffer = buffer.slice(available, buffer.length);

      // get the character that was split
      charStr = this.charBuffer.slice(0, this.charLength).toString(this.encoding);

      // CESU-8: lead surrogate (D800-DBFF) is also the incomplete character
      var charCode = charStr.charCodeAt(charStr.length - 1);
      if (charCode >= 0xD800 && charCode <= 0xDBFF) {
        this.charLength += this.surrogateSize;
        charStr = '';
        continue;
      }
      this.charReceived = this.charLength = 0;

      // if there are no more bytes in this buffer, just emit our char
      if (buffer.length === 0) {
        return charStr;
      }
      break;
    }

    // determine and set charLength / charReceived
    this.detectIncompleteChar(buffer);

    var end = buffer.length;
    if (this.charLength) {
      // buffer the incomplete character bytes we got
      buffer.copy(this.charBuffer, 0, buffer.length - this.charReceived, end);
      end -= this.charReceived;
    }

    charStr += buffer.toString(this.encoding, 0, end);

    var end = charStr.length - 1;
    var charCode = charStr.charCodeAt(end);
    // CESU-8: lead surrogate (D800-DBFF) is also the incomplete character
    if (charCode >= 0xD800 && charCode <= 0xDBFF) {
      var size = this.surrogateSize;
      this.charLength += size;
      this.charReceived += size;
      this.charBuffer.copy(this.charBuffer, size, 0, size);
      buffer.copy(this.charBuffer, 0, 0, size);
      return charStr.substring(0, end);
    }

    // or just emit the charStr
    return charStr;
  };

  // detectIncompleteChar determines if there is an incomplete UTF-8 character at
  // the end of the given buffer. If so, it sets this.charLength to the byte
  // length that character, and sets this.charReceived to the number of bytes
  // that are available for this character.
  StringDecoder$1.prototype.detectIncompleteChar = function(buffer) {
    // determine how many bytes we have to check at the end of this buffer
    var i = (buffer.length >= 3) ? 3 : buffer.length;

    // Figure out if one of the last i bytes of our buffer announces an
    // incomplete char.
    for (; i > 0; i--) {
      var c = buffer[buffer.length - i];

      // See http://en.wikipedia.org/wiki/UTF-8#Description

      // 110XXXXX
      if (i == 1 && c >> 5 == 0x06) {
        this.charLength = 2;
        break;
      }

      // 1110XXXX
      if (i <= 2 && c >> 4 == 0x0E) {
        this.charLength = 3;
        break;
      }

      // 11110XXX
      if (i <= 3 && c >> 3 == 0x1E) {
        this.charLength = 4;
        break;
      }
    }
    this.charReceived = i;
  };

  StringDecoder$1.prototype.end = function(buffer) {
    var res = '';
    if (buffer && buffer.length)
      res = this.write(buffer);

    if (this.charReceived) {
      var cr = this.charReceived;
      var buf = this.charBuffer;
      var enc = this.encoding;
      res += buf.slice(0, cr).toString(enc);
    }

    return res;
  };

  function passThroughWrite(buffer) {
    return buffer.toString(this.encoding);
  }

  function utf16DetectIncompleteChar(buffer) {
    this.charReceived = buffer.length % 2;
    this.charLength = this.charReceived ? 2 : 0;
  }

  function base64DetectIncompleteChar(buffer) {
    this.charReceived = buffer.length % 3;
    this.charLength = this.charReceived ? 3 : 0;
  }

  var stringDecoder = /*#__PURE__*/Object.freeze({
    __proto__: null,
    StringDecoder: StringDecoder$1
  });

  Readable.ReadableState = ReadableState;

  var debug = debuglog('stream');
  inherits$l(Readable, EventEmitter);

  function prependListener(emitter, event, fn) {
    // Sadly this is not cacheable as some libraries bundle their own
    // event emitter implementation with them.
    if (typeof emitter.prependListener === 'function') {
      return emitter.prependListener(event, fn);
    } else {
      // This is a hack to make sure that our error handler is attached before any
      // userland ones.  NEVER DO THIS. This is here only because this code needs
      // to continue to work with older versions of Node.js that do not include
      // the prependListener() method. The goal is to eventually remove this hack.
      if (!emitter._events || !emitter._events[event])
        emitter.on(event, fn);
      else if (Array.isArray(emitter._events[event]))
        emitter._events[event].unshift(fn);
      else
        emitter._events[event] = [fn, emitter._events[event]];
    }
  }
  function listenerCount (emitter, type) {
    return emitter.listeners(type).length;
  }
  function ReadableState(options, stream) {

    options = options || {};

    // object stream flag. Used to make read(n) ignore n and to
    // make all the buffer merging and length checks go away
    this.objectMode = !!options.objectMode;

    if (stream instanceof Duplex) this.objectMode = this.objectMode || !!options.readableObjectMode;

    // the point at which it stops calling _read() to fill the buffer
    // Note: 0 is a valid value, means "don't call _read preemptively ever"
    var hwm = options.highWaterMark;
    var defaultHwm = this.objectMode ? 16 : 16 * 1024;
    this.highWaterMark = hwm || hwm === 0 ? hwm : defaultHwm;

    // cast to ints.
    this.highWaterMark = ~ ~this.highWaterMark;

    // A linked list is used to store data chunks instead of an array because the
    // linked list can remove elements from the beginning faster than
    // array.shift()
    this.buffer = new BufferList();
    this.length = 0;
    this.pipes = null;
    this.pipesCount = 0;
    this.flowing = null;
    this.ended = false;
    this.endEmitted = false;
    this.reading = false;

    // a flag to be able to tell if the onwrite cb is called immediately,
    // or on a later tick.  We set this to true at first, because any
    // actions that shouldn't happen until "later" should generally also
    // not happen before the first write call.
    this.sync = true;

    // whenever we return null, then we set a flag to say
    // that we're awaiting a 'readable' event emission.
    this.needReadable = false;
    this.emittedReadable = false;
    this.readableListening = false;
    this.resumeScheduled = false;

    // Crypto is kind of old and crusty.  Historically, its default string
    // encoding is 'binary' so we have to make this configurable.
    // Everything else in the universe uses 'utf8', though.
    this.defaultEncoding = options.defaultEncoding || 'utf8';

    // when piping, we only care about 'readable' events that happen
    // after read()ing all the bytes and not getting any pushback.
    this.ranOut = false;

    // the number of writers that are awaiting a drain event in .pipe()s
    this.awaitDrain = 0;

    // if true, a maybeReadMore has been scheduled
    this.readingMore = false;

    this.decoder = null;
    this.encoding = null;
    if (options.encoding) {
      this.decoder = new StringDecoder$1(options.encoding);
      this.encoding = options.encoding;
    }
  }
  function Readable(options) {

    if (!(this instanceof Readable)) return new Readable(options);

    this._readableState = new ReadableState(options, this);

    // legacy
    this.readable = true;

    if (options && typeof options.read === 'function') this._read = options.read;

    EventEmitter.call(this);
  }

  // Manually shove something into the read() buffer.
  // This returns true if the highWaterMark has not been hit yet,
  // similar to how Writable.write() returns true if you should
  // write() some more.
  Readable.prototype.push = function (chunk, encoding) {
    var state = this._readableState;

    if (!state.objectMode && typeof chunk === 'string') {
      encoding = encoding || state.defaultEncoding;
      if (encoding !== state.encoding) {
        chunk = Buffer$u.from(chunk, encoding);
        encoding = '';
      }
    }

    return readableAddChunk(this, state, chunk, encoding, false);
  };

  // Unshift should *always* be something directly out of read()
  Readable.prototype.unshift = function (chunk) {
    var state = this._readableState;
    return readableAddChunk(this, state, chunk, '', true);
  };

  Readable.prototype.isPaused = function () {
    return this._readableState.flowing === false;
  };

  function readableAddChunk(stream, state, chunk, encoding, addToFront) {
    var er = chunkInvalid(state, chunk);
    if (er) {
      stream.emit('error', er);
    } else if (chunk === null) {
      state.reading = false;
      onEofChunk(stream, state);
    } else if (state.objectMode || chunk && chunk.length > 0) {
      if (state.ended && !addToFront) {
        var e = new Error('stream.push() after EOF');
        stream.emit('error', e);
      } else if (state.endEmitted && addToFront) {
        var _e = new Error('stream.unshift() after end event');
        stream.emit('error', _e);
      } else {
        var skipAdd;
        if (state.decoder && !addToFront && !encoding) {
          chunk = state.decoder.write(chunk);
          skipAdd = !state.objectMode && chunk.length === 0;
        }

        if (!addToFront) state.reading = false;

        // Don't add to the buffer if we've decoded to an empty string chunk and
        // we're not in object mode
        if (!skipAdd) {
          // if we want the data now, just emit it.
          if (state.flowing && state.length === 0 && !state.sync) {
            stream.emit('data', chunk);
            stream.read(0);
          } else {
            // update the buffer info.
            state.length += state.objectMode ? 1 : chunk.length;
            if (addToFront) state.buffer.unshift(chunk);else state.buffer.push(chunk);

            if (state.needReadable) emitReadable(stream);
          }
        }

        maybeReadMore(stream, state);
      }
    } else if (!addToFront) {
      state.reading = false;
    }

    return needMoreData(state);
  }

  // if it's past the high water mark, we can push in some more.
  // Also, if we have no data yet, we can stand some
  // more bytes.  This is to work around cases where hwm=0,
  // such as the repl.  Also, if the push() triggered a
  // readable event, and the user called read(largeNumber) such that
  // needReadable was set, then we ought to push more, so that another
  // 'readable' event will be triggered.
  function needMoreData(state) {
    return !state.ended && (state.needReadable || state.length < state.highWaterMark || state.length === 0);
  }

  // backwards compatibility.
  Readable.prototype.setEncoding = function (enc) {
    this._readableState.decoder = new StringDecoder$1(enc);
    this._readableState.encoding = enc;
    return this;
  };

  // Don't raise the hwm > 8MB
  var MAX_HWM = 0x800000;
  function computeNewHighWaterMark(n) {
    if (n >= MAX_HWM) {
      n = MAX_HWM;
    } else {
      // Get the next highest power of 2 to prevent increasing hwm excessively in
      // tiny amounts
      n--;
      n |= n >>> 1;
      n |= n >>> 2;
      n |= n >>> 4;
      n |= n >>> 8;
      n |= n >>> 16;
      n++;
    }
    return n;
  }

  // This function is designed to be inlinable, so please take care when making
  // changes to the function body.
  function howMuchToRead(n, state) {
    if (n <= 0 || state.length === 0 && state.ended) return 0;
    if (state.objectMode) return 1;
    if (n !== n) {
      // Only flow one buffer at a time
      if (state.flowing && state.length) return state.buffer.head.data.length;else return state.length;
    }
    // If we're asking for more than the current hwm, then raise the hwm.
    if (n > state.highWaterMark) state.highWaterMark = computeNewHighWaterMark(n);
    if (n <= state.length) return n;
    // Don't have enough
    if (!state.ended) {
      state.needReadable = true;
      return 0;
    }
    return state.length;
  }

  // you can override either this method, or the async _read(n) below.
  Readable.prototype.read = function (n) {
    debug('read', n);
    n = parseInt(n, 10);
    var state = this._readableState;
    var nOrig = n;

    if (n !== 0) state.emittedReadable = false;

    // if we're doing read(0) to trigger a readable event, but we
    // already have a bunch of data in the buffer, then just trigger
    // the 'readable' event and move on.
    if (n === 0 && state.needReadable && (state.length >= state.highWaterMark || state.ended)) {
      debug('read: emitReadable', state.length, state.ended);
      if (state.length === 0 && state.ended) endReadable(this);else emitReadable(this);
      return null;
    }

    n = howMuchToRead(n, state);

    // if we've ended, and we're now clear, then finish it up.
    if (n === 0 && state.ended) {
      if (state.length === 0) endReadable(this);
      return null;
    }

    // All the actual chunk generation logic needs to be
    // *below* the call to _read.  The reason is that in certain
    // synthetic stream cases, such as passthrough streams, _read
    // may be a completely synchronous operation which may change
    // the state of the read buffer, providing enough data when
    // before there was *not* enough.
    //
    // So, the steps are:
    // 1. Figure out what the state of things will be after we do
    // a read from the buffer.
    //
    // 2. If that resulting state will trigger a _read, then call _read.
    // Note that this may be asynchronous, or synchronous.  Yes, it is
    // deeply ugly to write APIs this way, but that still doesn't mean
    // that the Readable class should behave improperly, as streams are
    // designed to be sync/async agnostic.
    // Take note if the _read call is sync or async (ie, if the read call
    // has returned yet), so that we know whether or not it's safe to emit
    // 'readable' etc.
    //
    // 3. Actually pull the requested chunks out of the buffer and return.

    // if we need a readable event, then we need to do some reading.
    var doRead = state.needReadable;
    debug('need readable', doRead);

    // if we currently have less than the highWaterMark, then also read some
    if (state.length === 0 || state.length - n < state.highWaterMark) {
      doRead = true;
      debug('length less than watermark', doRead);
    }

    // however, if we've ended, then there's no point, and if we're already
    // reading, then it's unnecessary.
    if (state.ended || state.reading) {
      doRead = false;
      debug('reading or ended', doRead);
    } else if (doRead) {
      debug('do read');
      state.reading = true;
      state.sync = true;
      // if the length is currently zero, then we *need* a readable event.
      if (state.length === 0) state.needReadable = true;
      // call internal read method
      this._read(state.highWaterMark);
      state.sync = false;
      // If _read pushed data synchronously, then `reading` will be false,
      // and we need to re-evaluate how much data we can return to the user.
      if (!state.reading) n = howMuchToRead(nOrig, state);
    }

    var ret;
    if (n > 0) ret = fromList(n, state);else ret = null;

    if (ret === null) {
      state.needReadable = true;
      n = 0;
    } else {
      state.length -= n;
    }

    if (state.length === 0) {
      // If we have nothing in the buffer, then we want to know
      // as soon as we *do* get something into the buffer.
      if (!state.ended) state.needReadable = true;

      // If we tried to read() past the EOF, then emit end on the next tick.
      if (nOrig !== n && state.ended) endReadable(this);
    }

    if (ret !== null) this.emit('data', ret);

    return ret;
  };

  function chunkInvalid(state, chunk) {
    var er = null;
    if (!isBuffer$1(chunk) && typeof chunk !== 'string' && chunk !== null && chunk !== undefined && !state.objectMode) {
      er = new TypeError('Invalid non-string/buffer chunk');
    }
    return er;
  }

  function onEofChunk(stream, state) {
    if (state.ended) return;
    if (state.decoder) {
      var chunk = state.decoder.end();
      if (chunk && chunk.length) {
        state.buffer.push(chunk);
        state.length += state.objectMode ? 1 : chunk.length;
      }
    }
    state.ended = true;

    // emit 'readable' now to make sure it gets picked up.
    emitReadable(stream);
  }

  // Don't emit readable right away in sync mode, because this can trigger
  // another read() call => stack overflow.  This way, it might trigger
  // a nextTick recursion warning, but that's not so bad.
  function emitReadable(stream) {
    var state = stream._readableState;
    state.needReadable = false;
    if (!state.emittedReadable) {
      debug('emitReadable', state.flowing);
      state.emittedReadable = true;
      if (state.sync) nextTick$1(emitReadable_, stream);else emitReadable_(stream);
    }
  }

  function emitReadable_(stream) {
    debug('emit readable');
    stream.emit('readable');
    flow(stream);
  }

  // at this point, the user has presumably seen the 'readable' event,
  // and called read() to consume some data.  that may have triggered
  // in turn another _read(n) call, in which case reading = true if
  // it's in progress.
  // However, if we're not ended, or reading, and the length < hwm,
  // then go ahead and try to read some more preemptively.
  function maybeReadMore(stream, state) {
    if (!state.readingMore) {
      state.readingMore = true;
      nextTick$1(maybeReadMore_, stream, state);
    }
  }

  function maybeReadMore_(stream, state) {
    var len = state.length;
    while (!state.reading && !state.flowing && !state.ended && state.length < state.highWaterMark) {
      debug('maybeReadMore read 0');
      stream.read(0);
      if (len === state.length)
        // didn't get any data, stop spinning.
        break;else len = state.length;
    }
    state.readingMore = false;
  }

  // abstract method.  to be overridden in specific implementation classes.
  // call cb(er, data) where data is <= n in length.
  // for virtual (non-string, non-buffer) streams, "length" is somewhat
  // arbitrary, and perhaps not very meaningful.
  Readable.prototype._read = function (n) {
    this.emit('error', new Error('not implemented'));
  };

  Readable.prototype.pipe = function (dest, pipeOpts) {
    var src = this;
    var state = this._readableState;

    switch (state.pipesCount) {
      case 0:
        state.pipes = dest;
        break;
      case 1:
        state.pipes = [state.pipes, dest];
        break;
      default:
        state.pipes.push(dest);
        break;
    }
    state.pipesCount += 1;
    debug('pipe count=%d opts=%j', state.pipesCount, pipeOpts);

    var doEnd = (!pipeOpts || pipeOpts.end !== false);

    var endFn = doEnd ? onend : cleanup;
    if (state.endEmitted) nextTick$1(endFn);else src.once('end', endFn);

    dest.on('unpipe', onunpipe);
    function onunpipe(readable) {
      debug('onunpipe');
      if (readable === src) {
        cleanup();
      }
    }

    function onend() {
      debug('onend');
      dest.end();
    }

    // when the dest drains, it reduces the awaitDrain counter
    // on the source.  This would be more elegant with a .once()
    // handler in flow(), but adding and removing repeatedly is
    // too slow.
    var ondrain = pipeOnDrain(src);
    dest.on('drain', ondrain);

    var cleanedUp = false;
    function cleanup() {
      debug('cleanup');
      // cleanup event handlers once the pipe is broken
      dest.removeListener('close', onclose);
      dest.removeListener('finish', onfinish);
      dest.removeListener('drain', ondrain);
      dest.removeListener('error', onerror);
      dest.removeListener('unpipe', onunpipe);
      src.removeListener('end', onend);
      src.removeListener('end', cleanup);
      src.removeListener('data', ondata);

      cleanedUp = true;

      // if the reader is waiting for a drain event from this
      // specific writer, then it would cause it to never start
      // flowing again.
      // So, if this is awaiting a drain, then we just call it now.
      // If we don't know, then assume that we are waiting for one.
      if (state.awaitDrain && (!dest._writableState || dest._writableState.needDrain)) ondrain();
    }

    // If the user pushes more data while we're writing to dest then we'll end up
    // in ondata again. However, we only want to increase awaitDrain once because
    // dest will only emit one 'drain' event for the multiple writes.
    // => Introduce a guard on increasing awaitDrain.
    var increasedAwaitDrain = false;
    src.on('data', ondata);
    function ondata(chunk) {
      debug('ondata');
      increasedAwaitDrain = false;
      var ret = dest.write(chunk);
      if (false === ret && !increasedAwaitDrain) {
        // If the user unpiped during `dest.write()`, it is possible
        // to get stuck in a permanently paused state if that write
        // also returned false.
        // => Check whether `dest` is still a piping destination.
        if ((state.pipesCount === 1 && state.pipes === dest || state.pipesCount > 1 && indexOf$1(state.pipes, dest) !== -1) && !cleanedUp) {
          debug('false write response, pause', src._readableState.awaitDrain);
          src._readableState.awaitDrain++;
          increasedAwaitDrain = true;
        }
        src.pause();
      }
    }

    // if the dest has an error, then stop piping into it.
    // however, don't suppress the throwing behavior for this.
    function onerror(er) {
      debug('onerror', er);
      unpipe();
      dest.removeListener('error', onerror);
      if (listenerCount(dest, 'error') === 0) dest.emit('error', er);
    }

    // Make sure our error handler is attached before userland ones.
    prependListener(dest, 'error', onerror);

    // Both close and finish should trigger unpipe, but only once.
    function onclose() {
      dest.removeListener('finish', onfinish);
      unpipe();
    }
    dest.once('close', onclose);
    function onfinish() {
      debug('onfinish');
      dest.removeListener('close', onclose);
      unpipe();
    }
    dest.once('finish', onfinish);

    function unpipe() {
      debug('unpipe');
      src.unpipe(dest);
    }

    // tell the dest that it's being piped to
    dest.emit('pipe', src);

    // start the flow if it hasn't been started already.
    if (!state.flowing) {
      debug('pipe resume');
      src.resume();
    }

    return dest;
  };

  function pipeOnDrain(src) {
    return function () {
      var state = src._readableState;
      debug('pipeOnDrain', state.awaitDrain);
      if (state.awaitDrain) state.awaitDrain--;
      if (state.awaitDrain === 0 && src.listeners('data').length) {
        state.flowing = true;
        flow(src);
      }
    };
  }

  Readable.prototype.unpipe = function (dest) {
    var state = this._readableState;

    // if we're not piping anywhere, then do nothing.
    if (state.pipesCount === 0) return this;

    // just one destination.  most common case.
    if (state.pipesCount === 1) {
      // passed in one, but it's not the right one.
      if (dest && dest !== state.pipes) return this;

      if (!dest) dest = state.pipes;

      // got a match.
      state.pipes = null;
      state.pipesCount = 0;
      state.flowing = false;
      if (dest) dest.emit('unpipe', this);
      return this;
    }

    // slow case. multiple pipe destinations.

    if (!dest) {
      // remove all.
      var dests = state.pipes;
      var len = state.pipesCount;
      state.pipes = null;
      state.pipesCount = 0;
      state.flowing = false;

      for (var _i = 0; _i < len; _i++) {
        dests[_i].emit('unpipe', this);
      }return this;
    }

    // try to find the right one.
    var i = indexOf$1(state.pipes, dest);
    if (i === -1) return this;

    state.pipes.splice(i, 1);
    state.pipesCount -= 1;
    if (state.pipesCount === 1) state.pipes = state.pipes[0];

    dest.emit('unpipe', this);

    return this;
  };

  // set up data events if they are asked for
  // Ensure readable listeners eventually get something
  Readable.prototype.on = function (ev, fn) {
    var res = EventEmitter.prototype.on.call(this, ev, fn);

    if (ev === 'data') {
      // Start flowing on next tick if stream isn't explicitly paused
      if (this._readableState.flowing !== false) this.resume();
    } else if (ev === 'readable') {
      var state = this._readableState;
      if (!state.endEmitted && !state.readableListening) {
        state.readableListening = state.needReadable = true;
        state.emittedReadable = false;
        if (!state.reading) {
          nextTick$1(nReadingNextTick, this);
        } else if (state.length) {
          emitReadable(this);
        }
      }
    }

    return res;
  };
  Readable.prototype.addListener = Readable.prototype.on;

  function nReadingNextTick(self) {
    debug('readable nexttick read 0');
    self.read(0);
  }

  // pause() and resume() are remnants of the legacy readable stream API
  // If the user uses them, then switch into old mode.
  Readable.prototype.resume = function () {
    var state = this._readableState;
    if (!state.flowing) {
      debug('resume');
      state.flowing = true;
      resume(this, state);
    }
    return this;
  };

  function resume(stream, state) {
    if (!state.resumeScheduled) {
      state.resumeScheduled = true;
      nextTick$1(resume_, stream, state);
    }
  }

  function resume_(stream, state) {
    if (!state.reading) {
      debug('resume read 0');
      stream.read(0);
    }

    state.resumeScheduled = false;
    state.awaitDrain = 0;
    stream.emit('resume');
    flow(stream);
    if (state.flowing && !state.reading) stream.read(0);
  }

  Readable.prototype.pause = function () {
    debug('call pause flowing=%j', this._readableState.flowing);
    if (false !== this._readableState.flowing) {
      debug('pause');
      this._readableState.flowing = false;
      this.emit('pause');
    }
    return this;
  };

  function flow(stream) {
    var state = stream._readableState;
    debug('flow', state.flowing);
    while (state.flowing && stream.read() !== null) {}
  }

  // wrap an old-style stream as the async data source.
  // This is *not* part of the readable stream interface.
  // It is an ugly unfortunate mess of history.
  Readable.prototype.wrap = function (stream) {
    var state = this._readableState;
    var paused = false;

    var self = this;
    stream.on('end', function () {
      debug('wrapped end');
      if (state.decoder && !state.ended) {
        var chunk = state.decoder.end();
        if (chunk && chunk.length) self.push(chunk);
      }

      self.push(null);
    });

    stream.on('data', function (chunk) {
      debug('wrapped data');
      if (state.decoder) chunk = state.decoder.write(chunk);

      // don't skip over falsy values in objectMode
      if (state.objectMode && (chunk === null || chunk === undefined)) return;else if (!state.objectMode && (!chunk || !chunk.length)) return;

      var ret = self.push(chunk);
      if (!ret) {
        paused = true;
        stream.pause();
      }
    });

    // proxy all the other methods.
    // important when wrapping filters and duplexes.
    for (var i in stream) {
      if (this[i] === undefined && typeof stream[i] === 'function') {
        this[i] = function (method) {
          return function () {
            return stream[method].apply(stream, arguments);
          };
        }(i);
      }
    }

    // proxy certain important events.
    var events = ['error', 'close', 'destroy', 'pause', 'resume'];
    forEach(events, function (ev) {
      stream.on(ev, self.emit.bind(self, ev));
    });

    // when we try to consume some more bytes, simply unpause the
    // underlying stream.
    self._read = function (n) {
      debug('wrapped _read', n);
      if (paused) {
        paused = false;
        stream.resume();
      }
    };

    return self;
  };

  // exposed for testing purposes only.
  Readable._fromList = fromList;

  // Pluck off n bytes from an array of buffers.
  // Length is the combined lengths of all the buffers in the list.
  // This function is designed to be inlinable, so please take care when making
  // changes to the function body.
  function fromList(n, state) {
    // nothing buffered
    if (state.length === 0) return null;

    var ret;
    if (state.objectMode) ret = state.buffer.shift();else if (!n || n >= state.length) {
      // read it all, truncate the list
      if (state.decoder) ret = state.buffer.join('');else if (state.buffer.length === 1) ret = state.buffer.head.data;else ret = state.buffer.concat(state.length);
      state.buffer.clear();
    } else {
      // read part of list
      ret = fromListPartial(n, state.buffer, state.decoder);
    }

    return ret;
  }

  // Extracts only enough buffered data to satisfy the amount requested.
  // This function is designed to be inlinable, so please take care when making
  // changes to the function body.
  function fromListPartial(n, list, hasStrings) {
    var ret;
    if (n < list.head.data.length) {
      // slice is the same for buffers and strings
      ret = list.head.data.slice(0, n);
      list.head.data = list.head.data.slice(n);
    } else if (n === list.head.data.length) {
      // first chunk is a perfect match
      ret = list.shift();
    } else {
      // result spans more than one buffer
      ret = hasStrings ? copyFromBufferString(n, list) : copyFromBuffer(n, list);
    }
    return ret;
  }

  // Copies a specified amount of characters from the list of buffered data
  // chunks.
  // This function is designed to be inlinable, so please take care when making
  // changes to the function body.
  function copyFromBufferString(n, list) {
    var p = list.head;
    var c = 1;
    var ret = p.data;
    n -= ret.length;
    while (p = p.next) {
      var str = p.data;
      var nb = n > str.length ? str.length : n;
      if (nb === str.length) ret += str;else ret += str.slice(0, n);
      n -= nb;
      if (n === 0) {
        if (nb === str.length) {
          ++c;
          if (p.next) list.head = p.next;else list.head = list.tail = null;
        } else {
          list.head = p;
          p.data = str.slice(nb);
        }
        break;
      }
      ++c;
    }
    list.length -= c;
    return ret;
  }

  // Copies a specified amount of bytes from the list of buffered data chunks.
  // This function is designed to be inlinable, so please take care when making
  // changes to the function body.
  function copyFromBuffer(n, list) {
    var ret = Buffer$u.allocUnsafe(n);
    var p = list.head;
    var c = 1;
    p.data.copy(ret);
    n -= p.data.length;
    while (p = p.next) {
      var buf = p.data;
      var nb = n > buf.length ? buf.length : n;
      buf.copy(ret, ret.length - n, 0, nb);
      n -= nb;
      if (n === 0) {
        if (nb === buf.length) {
          ++c;
          if (p.next) list.head = p.next;else list.head = list.tail = null;
        } else {
          list.head = p;
          p.data = buf.slice(nb);
        }
        break;
      }
      ++c;
    }
    list.length -= c;
    return ret;
  }

  function endReadable(stream) {
    var state = stream._readableState;

    // If we get here before consuming all the bytes, then that is a
    // bug in node.  Should never happen.
    if (state.length > 0) throw new Error('"endReadable()" called on non-empty stream');

    if (!state.endEmitted) {
      state.ended = true;
      nextTick$1(endReadableNT, state, stream);
    }
  }

  function endReadableNT(state, stream) {
    // Check that we didn't get one last unshift.
    if (!state.endEmitted && state.length === 0) {
      state.endEmitted = true;
      stream.readable = false;
      stream.emit('end');
    }
  }

  function forEach(xs, f) {
    for (var i = 0, l = xs.length; i < l; i++) {
      f(xs[i], i);
    }
  }

  function indexOf$1(xs, x) {
    for (var i = 0, l = xs.length; i < l; i++) {
      if (xs[i] === x) return i;
    }
    return -1;
  }

  // A bit simpler than readable streams.
  // Implement an async ._write(chunk, encoding, cb), and it'll handle all
  // the drain event emission and buffering.

  Writable.WritableState = WritableState;
  inherits$l(Writable, EventEmitter);

  function nop() {}

  function WriteReq(chunk, encoding, cb) {
    this.chunk = chunk;
    this.encoding = encoding;
    this.callback = cb;
    this.next = null;
  }

  function WritableState(options, stream) {
    Object.defineProperty(this, 'buffer', {
      get: deprecate(function () {
        return this.getBuffer();
      }, '_writableState.buffer is deprecated. Use _writableState.getBuffer ' + 'instead.')
    });
    options = options || {};

    // object stream flag to indicate whether or not this stream
    // contains buffers or objects.
    this.objectMode = !!options.objectMode;

    if (stream instanceof Duplex) this.objectMode = this.objectMode || !!options.writableObjectMode;

    // the point at which write() starts returning false
    // Note: 0 is a valid value, means that we always return false if
    // the entire buffer is not flushed immediately on write()
    var hwm = options.highWaterMark;
    var defaultHwm = this.objectMode ? 16 : 16 * 1024;
    this.highWaterMark = hwm || hwm === 0 ? hwm : defaultHwm;

    // cast to ints.
    this.highWaterMark = ~ ~this.highWaterMark;

    this.needDrain = false;
    // at the start of calling end()
    this.ending = false;
    // when end() has been called, and returned
    this.ended = false;
    // when 'finish' is emitted
    this.finished = false;

    // should we decode strings into buffers before passing to _write?
    // this is here so that some node-core streams can optimize string
    // handling at a lower level.
    var noDecode = options.decodeStrings === false;
    this.decodeStrings = !noDecode;

    // Crypto is kind of old and crusty.  Historically, its default string
    // encoding is 'binary' so we have to make this configurable.
    // Everything else in the universe uses 'utf8', though.
    this.defaultEncoding = options.defaultEncoding || 'utf8';

    // not an actual buffer we keep track of, but a measurement
    // of how much we're waiting to get pushed to some underlying
    // socket or file.
    this.length = 0;

    // a flag to see when we're in the middle of a write.
    this.writing = false;

    // when true all writes will be buffered until .uncork() call
    this.corked = 0;

    // a flag to be able to tell if the onwrite cb is called immediately,
    // or on a later tick.  We set this to true at first, because any
    // actions that shouldn't happen until "later" should generally also
    // not happen before the first write call.
    this.sync = true;

    // a flag to know if we're processing previously buffered items, which
    // may call the _write() callback in the same tick, so that we don't
    // end up in an overlapped onwrite situation.
    this.bufferProcessing = false;

    // the callback that's passed to _write(chunk,cb)
    this.onwrite = function (er) {
      onwrite(stream, er);
    };

    // the callback that the user supplies to write(chunk,encoding,cb)
    this.writecb = null;

    // the amount that is being written when _write is called.
    this.writelen = 0;

    this.bufferedRequest = null;
    this.lastBufferedRequest = null;

    // number of pending user-supplied write callbacks
    // this must be 0 before 'finish' can be emitted
    this.pendingcb = 0;

    // emit prefinish if the only thing we're waiting for is _write cbs
    // This is relevant for synchronous Transform streams
    this.prefinished = false;

    // True if the error was already emitted and should not be thrown again
    this.errorEmitted = false;

    // count buffered requests
    this.bufferedRequestCount = 0;

    // allocate the first CorkedRequest, there is always
    // one allocated and free to use, and we maintain at most two
    this.corkedRequestsFree = new CorkedRequest(this);
  }

  WritableState.prototype.getBuffer = function writableStateGetBuffer() {
    var current = this.bufferedRequest;
    var out = [];
    while (current) {
      out.push(current);
      current = current.next;
    }
    return out;
  };
  function Writable(options) {

    // Writable ctor is applied to Duplexes, though they're not
    // instanceof Writable, they're instanceof Readable.
    if (!(this instanceof Writable) && !(this instanceof Duplex)) return new Writable(options);

    this._writableState = new WritableState(options, this);

    // legacy.
    this.writable = true;

    if (options) {
      if (typeof options.write === 'function') this._write = options.write;

      if (typeof options.writev === 'function') this._writev = options.writev;
    }

    EventEmitter.call(this);
  }

  // Otherwise people can pipe Writable streams, which is just wrong.
  Writable.prototype.pipe = function () {
    this.emit('error', new Error('Cannot pipe, not readable'));
  };

  function writeAfterEnd(stream, cb) {
    var er = new Error('write after end');
    // TODO: defer error events consistently everywhere, not just the cb
    stream.emit('error', er);
    nextTick$1(cb, er);
  }

  // If we get something that is not a buffer, string, null, or undefined,
  // and we're not in objectMode, then that's an error.
  // Otherwise stream chunks are all considered to be of length=1, and the
  // watermarks determine how many objects to keep in the buffer, rather than
  // how many bytes or characters.
  function validChunk(stream, state, chunk, cb) {
    var valid = true;
    var er = false;
    // Always throw error if a null is written
    // if we are not in object mode then throw
    // if it is not a buffer, string, or undefined.
    if (chunk === null) {
      er = new TypeError('May not write null values to stream');
    } else if (!Buffer$u.isBuffer(chunk) && typeof chunk !== 'string' && chunk !== undefined && !state.objectMode) {
      er = new TypeError('Invalid non-string/buffer chunk');
    }
    if (er) {
      stream.emit('error', er);
      nextTick$1(cb, er);
      valid = false;
    }
    return valid;
  }

  Writable.prototype.write = function (chunk, encoding, cb) {
    var state = this._writableState;
    var ret = false;

    if (typeof encoding === 'function') {
      cb = encoding;
      encoding = null;
    }

    if (Buffer$u.isBuffer(chunk)) encoding = 'buffer';else if (!encoding) encoding = state.defaultEncoding;

    if (typeof cb !== 'function') cb = nop;

    if (state.ended) writeAfterEnd(this, cb);else if (validChunk(this, state, chunk, cb)) {
      state.pendingcb++;
      ret = writeOrBuffer(this, state, chunk, encoding, cb);
    }

    return ret;
  };

  Writable.prototype.cork = function () {
    var state = this._writableState;

    state.corked++;
  };

  Writable.prototype.uncork = function () {
    var state = this._writableState;

    if (state.corked) {
      state.corked--;

      if (!state.writing && !state.corked && !state.finished && !state.bufferProcessing && state.bufferedRequest) clearBuffer(this, state);
    }
  };

  Writable.prototype.setDefaultEncoding = function setDefaultEncoding(encoding) {
    // node::ParseEncoding() requires lower case.
    if (typeof encoding === 'string') encoding = encoding.toLowerCase();
    if (!(['hex', 'utf8', 'utf-8', 'ascii', 'binary', 'base64', 'ucs2', 'ucs-2', 'utf16le', 'utf-16le', 'raw'].indexOf((encoding + '').toLowerCase()) > -1)) throw new TypeError('Unknown encoding: ' + encoding);
    this._writableState.defaultEncoding = encoding;
    return this;
  };

  function decodeChunk(state, chunk, encoding) {
    if (!state.objectMode && state.decodeStrings !== false && typeof chunk === 'string') {
      chunk = Buffer$u.from(chunk, encoding);
    }
    return chunk;
  }

  // if we're already writing something, then just put this
  // in the queue, and wait our turn.  Otherwise, call _write
  // If we return false, then we need a drain event, so set that flag.
  function writeOrBuffer(stream, state, chunk, encoding, cb) {
    chunk = decodeChunk(state, chunk, encoding);

    if (Buffer$u.isBuffer(chunk)) encoding = 'buffer';
    var len = state.objectMode ? 1 : chunk.length;

    state.length += len;

    var ret = state.length < state.highWaterMark;
    // we must ensure that previous needDrain will not be reset to false.
    if (!ret) state.needDrain = true;

    if (state.writing || state.corked) {
      var last = state.lastBufferedRequest;
      state.lastBufferedRequest = new WriteReq(chunk, encoding, cb);
      if (last) {
        last.next = state.lastBufferedRequest;
      } else {
        state.bufferedRequest = state.lastBufferedRequest;
      }
      state.bufferedRequestCount += 1;
    } else {
      doWrite(stream, state, false, len, chunk, encoding, cb);
    }

    return ret;
  }

  function doWrite(stream, state, writev, len, chunk, encoding, cb) {
    state.writelen = len;
    state.writecb = cb;
    state.writing = true;
    state.sync = true;
    if (writev) stream._writev(chunk, state.onwrite);else stream._write(chunk, encoding, state.onwrite);
    state.sync = false;
  }

  function onwriteError(stream, state, sync, er, cb) {
    --state.pendingcb;
    if (sync) nextTick$1(cb, er);else cb(er);

    stream._writableState.errorEmitted = true;
    stream.emit('error', er);
  }

  function onwriteStateUpdate(state) {
    state.writing = false;
    state.writecb = null;
    state.length -= state.writelen;
    state.writelen = 0;
  }

  function onwrite(stream, er) {
    var state = stream._writableState;
    var sync = state.sync;
    var cb = state.writecb;

    onwriteStateUpdate(state);

    if (er) onwriteError(stream, state, sync, er, cb);else {
      // Check if we're actually ready to finish, but don't emit yet
      var finished = needFinish(state);

      if (!finished && !state.corked && !state.bufferProcessing && state.bufferedRequest) {
        clearBuffer(stream, state);
      }

      if (sync) {
        /*<replacement>*/
          nextTick$1(afterWrite, stream, state, finished, cb);
        /*</replacement>*/
      } else {
          afterWrite(stream, state, finished, cb);
        }
    }
  }

  function afterWrite(stream, state, finished, cb) {
    if (!finished) onwriteDrain(stream, state);
    state.pendingcb--;
    cb();
    finishMaybe(stream, state);
  }

  // Must force callback to be called on nextTick, so that we don't
  // emit 'drain' before the write() consumer gets the 'false' return
  // value, and has a chance to attach a 'drain' listener.
  function onwriteDrain(stream, state) {
    if (state.length === 0 && state.needDrain) {
      state.needDrain = false;
      stream.emit('drain');
    }
  }

  // if there's something in the buffer waiting, then process it
  function clearBuffer(stream, state) {
    state.bufferProcessing = true;
    var entry = state.bufferedRequest;

    if (stream._writev && entry && entry.next) {
      // Fast case, write everything using _writev()
      var l = state.bufferedRequestCount;
      var buffer = new Array(l);
      var holder = state.corkedRequestsFree;
      holder.entry = entry;

      var count = 0;
      while (entry) {
        buffer[count] = entry;
        entry = entry.next;
        count += 1;
      }

      doWrite(stream, state, true, state.length, buffer, '', holder.finish);

      // doWrite is almost always async, defer these to save a bit of time
      // as the hot path ends with doWrite
      state.pendingcb++;
      state.lastBufferedRequest = null;
      if (holder.next) {
        state.corkedRequestsFree = holder.next;
        holder.next = null;
      } else {
        state.corkedRequestsFree = new CorkedRequest(state);
      }
    } else {
      // Slow case, write chunks one-by-one
      while (entry) {
        var chunk = entry.chunk;
        var encoding = entry.encoding;
        var cb = entry.callback;
        var len = state.objectMode ? 1 : chunk.length;

        doWrite(stream, state, false, len, chunk, encoding, cb);
        entry = entry.next;
        // if we didn't call the onwrite immediately, then
        // it means that we need to wait until it does.
        // also, that means that the chunk and cb are currently
        // being processed, so move the buffer counter past them.
        if (state.writing) {
          break;
        }
      }

      if (entry === null) state.lastBufferedRequest = null;
    }

    state.bufferedRequestCount = 0;
    state.bufferedRequest = entry;
    state.bufferProcessing = false;
  }

  Writable.prototype._write = function (chunk, encoding, cb) {
    cb(new Error('not implemented'));
  };

  Writable.prototype._writev = null;

  Writable.prototype.end = function (chunk, encoding, cb) {
    var state = this._writableState;

    if (typeof chunk === 'function') {
      cb = chunk;
      chunk = null;
      encoding = null;
    } else if (typeof encoding === 'function') {
      cb = encoding;
      encoding = null;
    }

    if (chunk !== null && chunk !== undefined) this.write(chunk, encoding);

    // .end() fully uncorks
    if (state.corked) {
      state.corked = 1;
      this.uncork();
    }

    // ignore unnecessary end() calls.
    if (!state.ending && !state.finished) endWritable(this, state, cb);
  };

  function needFinish(state) {
    return state.ending && state.length === 0 && state.bufferedRequest === null && !state.finished && !state.writing;
  }

  function prefinish(stream, state) {
    if (!state.prefinished) {
      state.prefinished = true;
      stream.emit('prefinish');
    }
  }

  function finishMaybe(stream, state) {
    var need = needFinish(state);
    if (need) {
      if (state.pendingcb === 0) {
        prefinish(stream, state);
        state.finished = true;
        stream.emit('finish');
      } else {
        prefinish(stream, state);
      }
    }
    return need;
  }

  function endWritable(stream, state, cb) {
    state.ending = true;
    finishMaybe(stream, state);
    if (cb) {
      if (state.finished) nextTick$1(cb);else stream.once('finish', cb);
    }
    state.ended = true;
    stream.writable = false;
  }

  // It seems a linked list but it is not
  // there will be only 2 of these for each stream
  function CorkedRequest(state) {
    var _this = this;

    this.next = null;
    this.entry = null;

    this.finish = function (err) {
      var entry = _this.entry;
      _this.entry = null;
      while (entry) {
        var cb = entry.callback;
        state.pendingcb--;
        cb(err);
        entry = entry.next;
      }
      if (state.corkedRequestsFree) {
        state.corkedRequestsFree.next = _this;
      } else {
        state.corkedRequestsFree = _this;
      }
    };
  }

  inherits$l(Duplex, Readable);

  var keys = Object.keys(Writable.prototype);
  for (var v = 0; v < keys.length; v++) {
    var method = keys[v];
    if (!Duplex.prototype[method]) Duplex.prototype[method] = Writable.prototype[method];
  }
  function Duplex(options) {
    if (!(this instanceof Duplex)) return new Duplex(options);

    Readable.call(this, options);
    Writable.call(this, options);

    if (options && options.readable === false) this.readable = false;

    if (options && options.writable === false) this.writable = false;

    this.allowHalfOpen = true;
    if (options && options.allowHalfOpen === false) this.allowHalfOpen = false;

    this.once('end', onend);
  }

  // the no-half-open enforcer
  function onend() {
    // if we allow half-open state, or if the writable side ended,
    // then we're ok.
    if (this.allowHalfOpen || this._writableState.ended) return;

    // no more data can be written.
    // But allow more writes to happen in this tick.
    nextTick$1(onEndNT, this);
  }

  function onEndNT(self) {
    self.end();
  }

  // a transform stream is a readable/writable stream where you do
  // something with the data.  Sometimes it's called a "filter",
  // but that's not a great name for it, since that implies a thing where
  // some bits pass through, and others are simply ignored.  (That would
  // be a valid example of a transform, of course.)
  //
  // While the output is causally related to the input, it's not a
  // necessarily symmetric or synchronous transformation.  For example,
  // a zlib stream might take multiple plain-text writes(), and then
  // emit a single compressed chunk some time in the future.
  //
  // Here's how this works:
  //
  // The Transform stream has all the aspects of the readable and writable
  // stream classes.  When you write(chunk), that calls _write(chunk,cb)
  // internally, and returns false if there's a lot of pending writes
  // buffered up.  When you call read(), that calls _read(n) until
  // there's enough pending readable data buffered up.
  //
  // In a transform stream, the written data is placed in a buffer.  When
  // _read(n) is called, it transforms the queued up data, calling the
  // buffered _write cb's as it consumes chunks.  If consuming a single
  // written chunk would result in multiple output chunks, then the first
  // outputted bit calls the readcb, and subsequent chunks just go into
  // the read buffer, and will cause it to emit 'readable' if necessary.
  //
  // This way, back-pressure is actually determined by the reading side,
  // since _read has to be called to start processing a new chunk.  However,
  // a pathological inflate type of transform can cause excessive buffering
  // here.  For example, imagine a stream where every byte of input is
  // interpreted as an integer from 0-255, and then results in that many
  // bytes of output.  Writing the 4 bytes {ff,ff,ff,ff} would result in
  // 1kb of data being output.  In this case, you could write a very small
  // amount of input, and end up with a very large amount of output.  In
  // such a pathological inflating mechanism, there'd be no way to tell
  // the system to stop doing the transform.  A single 4MB write could
  // cause the system to run out of memory.
  //
  // However, even in such a pathological case, only a single written chunk
  // would be consumed, and then the rest would wait (un-transformed) until
  // the results of the previous transformed chunk were consumed.

  inherits$l(Transform$6, Duplex);

  function TransformState(stream) {
    this.afterTransform = function (er, data) {
      return afterTransform(stream, er, data);
    };

    this.needTransform = false;
    this.transforming = false;
    this.writecb = null;
    this.writechunk = null;
    this.writeencoding = null;
  }

  function afterTransform(stream, er, data) {
    var ts = stream._transformState;
    ts.transforming = false;

    var cb = ts.writecb;

    if (!cb) return stream.emit('error', new Error('no writecb in Transform class'));

    ts.writechunk = null;
    ts.writecb = null;

    if (data !== null && data !== undefined) stream.push(data);

    cb(er);

    var rs = stream._readableState;
    rs.reading = false;
    if (rs.needReadable || rs.length < rs.highWaterMark) {
      stream._read(rs.highWaterMark);
    }
  }
  function Transform$6(options) {
    if (!(this instanceof Transform$6)) return new Transform$6(options);

    Duplex.call(this, options);

    this._transformState = new TransformState(this);

    // when the writable side finishes, then flush out anything remaining.
    var stream = this;

    // start out asking for a readable event once data is transformed.
    this._readableState.needReadable = true;

    // we have implemented the _read method, and done the other things
    // that Readable wants before the first _read call, so unset the
    // sync guard flag.
    this._readableState.sync = false;

    if (options) {
      if (typeof options.transform === 'function') this._transform = options.transform;

      if (typeof options.flush === 'function') this._flush = options.flush;
    }

    this.once('prefinish', function () {
      if (typeof this._flush === 'function') this._flush(function (er) {
        done(stream, er);
      });else done(stream);
    });
  }

  Transform$6.prototype.push = function (chunk, encoding) {
    this._transformState.needTransform = false;
    return Duplex.prototype.push.call(this, chunk, encoding);
  };

  // This is the part where you do stuff!
  // override this function in implementation classes.
  // 'chunk' is an input chunk.
  //
  // Call `push(newChunk)` to pass along transformed output
  // to the readable side.  You may call 'push' zero or more times.
  //
  // Call `cb(err)` when you are done with this chunk.  If you pass
  // an error, then that'll put the hurt on the whole operation.  If you
  // never call cb(), then you'll never get another chunk.
  Transform$6.prototype._transform = function (chunk, encoding, cb) {
    throw new Error('Not implemented');
  };

  Transform$6.prototype._write = function (chunk, encoding, cb) {
    var ts = this._transformState;
    ts.writecb = cb;
    ts.writechunk = chunk;
    ts.writeencoding = encoding;
    if (!ts.transforming) {
      var rs = this._readableState;
      if (ts.needTransform || rs.needReadable || rs.length < rs.highWaterMark) this._read(rs.highWaterMark);
    }
  };

  // Doesn't matter what the args are here.
  // _transform does all the work.
  // That we got here means that the readable side wants more data.
  Transform$6.prototype._read = function (n) {
    var ts = this._transformState;

    if (ts.writechunk !== null && ts.writecb && !ts.transforming) {
      ts.transforming = true;
      this._transform(ts.writechunk, ts.writeencoding, ts.afterTransform);
    } else {
      // mark that we need a transform, so that any data that comes in
      // will get processed, now that we've asked for it.
      ts.needTransform = true;
    }
  };

  function done(stream, er) {
    if (er) return stream.emit('error', er);

    // if there's nothing in the write buffer, then that means
    // that nothing more will ever be provided
    var ws = stream._writableState;
    var ts = stream._transformState;

    if (ws.length) throw new Error('Calling transform done when ws.length != 0');

    if (ts.transforming) throw new Error('Calling transform done when still transforming');

    return stream.push(null);
  }

  inherits$l(PassThrough, Transform$6);
  function PassThrough(options) {
    if (!(this instanceof PassThrough)) return new PassThrough(options);

    Transform$6.call(this, options);
  }

  PassThrough.prototype._transform = function (chunk, encoding, cb) {
    cb(null, chunk);
  };

  inherits$l(Stream, EventEmitter);
  Stream.Readable = Readable;
  Stream.Writable = Writable;
  Stream.Duplex = Duplex;
  Stream.Transform = Transform$6;
  Stream.PassThrough = PassThrough;

  // Backwards-compat with node 0.4.x
  Stream.Stream = Stream;

  // old-style streams.  Note that the pipe method (the only relevant
  // part of this class) is overridden in the Readable class.

  function Stream() {
    EventEmitter.call(this);
  }

  Stream.prototype.pipe = function(dest, options) {
    var source = this;

    function ondata(chunk) {
      if (dest.writable) {
        if (false === dest.write(chunk) && source.pause) {
          source.pause();
        }
      }
    }

    source.on('data', ondata);

    function ondrain() {
      if (source.readable && source.resume) {
        source.resume();
      }
    }

    dest.on('drain', ondrain);

    // If the 'end' option is not supplied, dest.end() will be called when
    // source gets the 'end' or 'close' events.  Only dest.end() once.
    if (!dest._isStdio && (!options || options.end !== false)) {
      source.on('end', onend);
      source.on('close', onclose);
    }

    var didOnEnd = false;
    function onend() {
      if (didOnEnd) return;
      didOnEnd = true;

      dest.end();
    }


    function onclose() {
      if (didOnEnd) return;
      didOnEnd = true;

      if (typeof dest.destroy === 'function') dest.destroy();
    }

    // don't leave dangling pipes when there are errors.
    function onerror(er) {
      cleanup();
      if (EventEmitter.listenerCount(this, 'error') === 0) {
        throw er; // Unhandled stream error in pipe.
      }
    }

    source.on('error', onerror);
    dest.on('error', onerror);

    // remove all the event listeners that were added.
    function cleanup() {
      source.removeListener('data', ondata);
      dest.removeListener('drain', ondrain);

      source.removeListener('end', onend);
      source.removeListener('close', onclose);

      source.removeListener('error', onerror);
      dest.removeListener('error', onerror);

      source.removeListener('end', cleanup);
      source.removeListener('close', cleanup);

      dest.removeListener('close', cleanup);
    }

    source.on('end', cleanup);
    source.on('close', cleanup);

    dest.on('close', cleanup);

    dest.emit('pipe', source);

    // Allow for unix-like usage: A.pipe(B).pipe(C)
    return dest;
  };

  var stream = /*#__PURE__*/Object.freeze({
    __proto__: null,
    Duplex: Duplex,
    PassThrough: PassThrough,
    Readable: Readable,
    Stream: Stream,
    Transform: Transform$6,
    Writable: Writable,
    default: Stream
  });

  var require$$1 = /*@__PURE__*/getAugmentedNamespace(stream);

  var require$$2$1 = /*@__PURE__*/getAugmentedNamespace(stringDecoder);

  var inherits_browser = {exports: {}};

  if (typeof Object.create === 'function') {
    // implementation from standard node.js 'util' module
    inherits_browser.exports = function inherits(ctor, superCtor) {
      if (superCtor) {
        ctor.super_ = superCtor;
        ctor.prototype = Object.create(superCtor.prototype, {
          constructor: {
            value: ctor,
            enumerable: false,
            writable: true,
            configurable: true
          }
        });
      }
    };
  } else {
    // old school shim for old browsers
    inherits_browser.exports = function inherits(ctor, superCtor) {
      if (superCtor) {
        ctor.super_ = superCtor;
        var TempCtor = function () {};
        TempCtor.prototype = superCtor.prototype;
        ctor.prototype = new TempCtor();
        ctor.prototype.constructor = ctor;
      }
    };
  }

  var inherits_browserExports = inherits_browser.exports;

  var Buffer$t = safeBufferExports.Buffer;
  var Transform$5 = require$$1.Transform;
  var StringDecoder = require$$2$1.StringDecoder;
  var inherits$j = inherits_browserExports;

  function CipherBase$1 (hashMode) {
    Transform$5.call(this);
    this.hashMode = typeof hashMode === 'string';
    if (this.hashMode) {
      this[hashMode] = this._finalOrDigest;
    } else {
      this.final = this._finalOrDigest;
    }
    if (this._final) {
      this.__final = this._final;
      this._final = null;
    }
    this._decoder = null;
    this._encoding = null;
  }
  inherits$j(CipherBase$1, Transform$5);

  CipherBase$1.prototype.update = function (data, inputEnc, outputEnc) {
    if (typeof data === 'string') {
      data = Buffer$t.from(data, inputEnc);
    }

    var outData = this._update(data);
    if (this.hashMode) return this

    if (outputEnc) {
      outData = this._toString(outData, outputEnc);
    }

    return outData
  };

  CipherBase$1.prototype.setAutoPadding = function () {};
  CipherBase$1.prototype.getAuthTag = function () {
    throw new Error('trying to get auth tag in unsupported state')
  };

  CipherBase$1.prototype.setAuthTag = function () {
    throw new Error('trying to set auth tag in unsupported state')
  };

  CipherBase$1.prototype.setAAD = function () {
    throw new Error('trying to set aad in unsupported state')
  };

  CipherBase$1.prototype._transform = function (data, _, next) {
    var err;
    try {
      if (this.hashMode) {
        this._update(data);
      } else {
        this.push(this._update(data));
      }
    } catch (e) {
      err = e;
    } finally {
      next(err);
    }
  };
  CipherBase$1.prototype._flush = function (done) {
    var err;
    try {
      this.push(this.__final());
    } catch (e) {
      err = e;
    }

    done(err);
  };
  CipherBase$1.prototype._finalOrDigest = function (outputEnc) {
    var outData = this.__final() || Buffer$t.alloc(0);
    if (outputEnc) {
      outData = this._toString(outData, outputEnc, true);
    }
    return outData
  };

  CipherBase$1.prototype._toString = function (value, enc, fin) {
    if (!this._decoder) {
      this._decoder = new StringDecoder(enc);
      this._encoding = enc;
    }

    if (this._encoding !== enc) throw new Error('can\'t switch encodings')

    var out = this._decoder.write(value);
    if (fin) {
      out += this._decoder.end();
    }

    return out
  };

  var cipherBase = CipherBase$1;

  var des$2 = {};

  var utils$1 = {};

  utils$1.readUInt32BE = function readUInt32BE(bytes, off) {
    var res =  (bytes[0 + off] << 24) |
               (bytes[1 + off] << 16) |
               (bytes[2 + off] << 8) |
               bytes[3 + off];
    return res >>> 0;
  };

  utils$1.writeUInt32BE = function writeUInt32BE(bytes, value, off) {
    bytes[0 + off] = value >>> 24;
    bytes[1 + off] = (value >>> 16) & 0xff;
    bytes[2 + off] = (value >>> 8) & 0xff;
    bytes[3 + off] = value & 0xff;
  };

  utils$1.ip = function ip(inL, inR, out, off) {
    var outL = 0;
    var outR = 0;

    for (var i = 6; i >= 0; i -= 2) {
      for (var j = 0; j <= 24; j += 8) {
        outL <<= 1;
        outL |= (inR >>> (j + i)) & 1;
      }
      for (var j = 0; j <= 24; j += 8) {
        outL <<= 1;
        outL |= (inL >>> (j + i)) & 1;
      }
    }

    for (var i = 6; i >= 0; i -= 2) {
      for (var j = 1; j <= 25; j += 8) {
        outR <<= 1;
        outR |= (inR >>> (j + i)) & 1;
      }
      for (var j = 1; j <= 25; j += 8) {
        outR <<= 1;
        outR |= (inL >>> (j + i)) & 1;
      }
    }

    out[off + 0] = outL >>> 0;
    out[off + 1] = outR >>> 0;
  };

  utils$1.rip = function rip(inL, inR, out, off) {
    var outL = 0;
    var outR = 0;

    for (var i = 0; i < 4; i++) {
      for (var j = 24; j >= 0; j -= 8) {
        outL <<= 1;
        outL |= (inR >>> (j + i)) & 1;
        outL <<= 1;
        outL |= (inL >>> (j + i)) & 1;
      }
    }
    for (var i = 4; i < 8; i++) {
      for (var j = 24; j >= 0; j -= 8) {
        outR <<= 1;
        outR |= (inR >>> (j + i)) & 1;
        outR <<= 1;
        outR |= (inL >>> (j + i)) & 1;
      }
    }

    out[off + 0] = outL >>> 0;
    out[off + 1] = outR >>> 0;
  };

  utils$1.pc1 = function pc1(inL, inR, out, off) {
    var outL = 0;
    var outR = 0;

    // 7, 15, 23, 31, 39, 47, 55, 63
    // 6, 14, 22, 30, 39, 47, 55, 63
    // 5, 13, 21, 29, 39, 47, 55, 63
    // 4, 12, 20, 28
    for (var i = 7; i >= 5; i--) {
      for (var j = 0; j <= 24; j += 8) {
        outL <<= 1;
        outL |= (inR >> (j + i)) & 1;
      }
      for (var j = 0; j <= 24; j += 8) {
        outL <<= 1;
        outL |= (inL >> (j + i)) & 1;
      }
    }
    for (var j = 0; j <= 24; j += 8) {
      outL <<= 1;
      outL |= (inR >> (j + i)) & 1;
    }

    // 1, 9, 17, 25, 33, 41, 49, 57
    // 2, 10, 18, 26, 34, 42, 50, 58
    // 3, 11, 19, 27, 35, 43, 51, 59
    // 36, 44, 52, 60
    for (var i = 1; i <= 3; i++) {
      for (var j = 0; j <= 24; j += 8) {
        outR <<= 1;
        outR |= (inR >> (j + i)) & 1;
      }
      for (var j = 0; j <= 24; j += 8) {
        outR <<= 1;
        outR |= (inL >> (j + i)) & 1;
      }
    }
    for (var j = 0; j <= 24; j += 8) {
      outR <<= 1;
      outR |= (inL >> (j + i)) & 1;
    }

    out[off + 0] = outL >>> 0;
    out[off + 1] = outR >>> 0;
  };

  utils$1.r28shl = function r28shl(num, shift) {
    return ((num << shift) & 0xfffffff) | (num >>> (28 - shift));
  };

  var pc2table = [
    // inL => outL
    14, 11, 17, 4, 27, 23, 25, 0,
    13, 22, 7, 18, 5, 9, 16, 24,
    2, 20, 12, 21, 1, 8, 15, 26,

    // inR => outR
    15, 4, 25, 19, 9, 1, 26, 16,
    5, 11, 23, 8, 12, 7, 17, 0,
    22, 3, 10, 14, 6, 20, 27, 24
  ];

  utils$1.pc2 = function pc2(inL, inR, out, off) {
    var outL = 0;
    var outR = 0;

    var len = pc2table.length >>> 1;
    for (var i = 0; i < len; i++) {
      outL <<= 1;
      outL |= (inL >>> pc2table[i]) & 0x1;
    }
    for (var i = len; i < pc2table.length; i++) {
      outR <<= 1;
      outR |= (inR >>> pc2table[i]) & 0x1;
    }

    out[off + 0] = outL >>> 0;
    out[off + 1] = outR >>> 0;
  };

  utils$1.expand = function expand(r, out, off) {
    var outL = 0;
    var outR = 0;

    outL = ((r & 1) << 5) | (r >>> 27);
    for (var i = 23; i >= 15; i -= 4) {
      outL <<= 6;
      outL |= (r >>> i) & 0x3f;
    }
    for (var i = 11; i >= 3; i -= 4) {
      outR |= (r >>> i) & 0x3f;
      outR <<= 6;
    }
    outR |= ((r & 0x1f) << 1) | (r >>> 31);

    out[off + 0] = outL >>> 0;
    out[off + 1] = outR >>> 0;
  };

  var sTable = [
    14, 0, 4, 15, 13, 7, 1, 4, 2, 14, 15, 2, 11, 13, 8, 1,
    3, 10, 10, 6, 6, 12, 12, 11, 5, 9, 9, 5, 0, 3, 7, 8,
    4, 15, 1, 12, 14, 8, 8, 2, 13, 4, 6, 9, 2, 1, 11, 7,
    15, 5, 12, 11, 9, 3, 7, 14, 3, 10, 10, 0, 5, 6, 0, 13,

    15, 3, 1, 13, 8, 4, 14, 7, 6, 15, 11, 2, 3, 8, 4, 14,
    9, 12, 7, 0, 2, 1, 13, 10, 12, 6, 0, 9, 5, 11, 10, 5,
    0, 13, 14, 8, 7, 10, 11, 1, 10, 3, 4, 15, 13, 4, 1, 2,
    5, 11, 8, 6, 12, 7, 6, 12, 9, 0, 3, 5, 2, 14, 15, 9,

    10, 13, 0, 7, 9, 0, 14, 9, 6, 3, 3, 4, 15, 6, 5, 10,
    1, 2, 13, 8, 12, 5, 7, 14, 11, 12, 4, 11, 2, 15, 8, 1,
    13, 1, 6, 10, 4, 13, 9, 0, 8, 6, 15, 9, 3, 8, 0, 7,
    11, 4, 1, 15, 2, 14, 12, 3, 5, 11, 10, 5, 14, 2, 7, 12,

    7, 13, 13, 8, 14, 11, 3, 5, 0, 6, 6, 15, 9, 0, 10, 3,
    1, 4, 2, 7, 8, 2, 5, 12, 11, 1, 12, 10, 4, 14, 15, 9,
    10, 3, 6, 15, 9, 0, 0, 6, 12, 10, 11, 1, 7, 13, 13, 8,
    15, 9, 1, 4, 3, 5, 14, 11, 5, 12, 2, 7, 8, 2, 4, 14,

    2, 14, 12, 11, 4, 2, 1, 12, 7, 4, 10, 7, 11, 13, 6, 1,
    8, 5, 5, 0, 3, 15, 15, 10, 13, 3, 0, 9, 14, 8, 9, 6,
    4, 11, 2, 8, 1, 12, 11, 7, 10, 1, 13, 14, 7, 2, 8, 13,
    15, 6, 9, 15, 12, 0, 5, 9, 6, 10, 3, 4, 0, 5, 14, 3,

    12, 10, 1, 15, 10, 4, 15, 2, 9, 7, 2, 12, 6, 9, 8, 5,
    0, 6, 13, 1, 3, 13, 4, 14, 14, 0, 7, 11, 5, 3, 11, 8,
    9, 4, 14, 3, 15, 2, 5, 12, 2, 9, 8, 5, 12, 15, 3, 10,
    7, 11, 0, 14, 4, 1, 10, 7, 1, 6, 13, 0, 11, 8, 6, 13,

    4, 13, 11, 0, 2, 11, 14, 7, 15, 4, 0, 9, 8, 1, 13, 10,
    3, 14, 12, 3, 9, 5, 7, 12, 5, 2, 10, 15, 6, 8, 1, 6,
    1, 6, 4, 11, 11, 13, 13, 8, 12, 1, 3, 4, 7, 10, 14, 7,
    10, 9, 15, 5, 6, 0, 8, 15, 0, 14, 5, 2, 9, 3, 2, 12,

    13, 1, 2, 15, 8, 13, 4, 8, 6, 10, 15, 3, 11, 7, 1, 4,
    10, 12, 9, 5, 3, 6, 14, 11, 5, 0, 0, 14, 12, 9, 7, 2,
    7, 2, 11, 1, 4, 14, 1, 7, 9, 4, 12, 10, 14, 8, 2, 13,
    0, 15, 6, 12, 10, 9, 13, 0, 15, 3, 3, 5, 5, 6, 8, 11
  ];

  utils$1.substitute = function substitute(inL, inR) {
    var out = 0;
    for (var i = 0; i < 4; i++) {
      var b = (inL >>> (18 - i * 6)) & 0x3f;
      var sb = sTable[i * 0x40 + b];

      out <<= 4;
      out |= sb;
    }
    for (var i = 0; i < 4; i++) {
      var b = (inR >>> (18 - i * 6)) & 0x3f;
      var sb = sTable[4 * 0x40 + i * 0x40 + b];

      out <<= 4;
      out |= sb;
    }
    return out >>> 0;
  };

  var permuteTable = [
    16, 25, 12, 11, 3, 20, 4, 15, 31, 17, 9, 6, 27, 14, 1, 22,
    30, 24, 8, 18, 0, 5, 29, 23, 13, 19, 2, 26, 10, 21, 28, 7
  ];

  utils$1.permute = function permute(num) {
    var out = 0;
    for (var i = 0; i < permuteTable.length; i++) {
      out <<= 1;
      out |= (num >>> permuteTable[i]) & 0x1;
    }
    return out >>> 0;
  };

  utils$1.padSplit = function padSplit(num, size, group) {
    var str = num.toString(2);
    while (str.length < size)
      str = '0' + str;

    var out = [];
    for (var i = 0; i < size; i += group)
      out.push(str.slice(i, i + group));
    return out.join(' ');
  };

  var minimalisticAssert = assert$4;

  function assert$4(val, msg) {
    if (!val)
      throw new Error(msg || 'Assertion failed');
  }

  assert$4.equal = function assertEqual(l, r, msg) {
    if (l != r)
      throw new Error(msg || ('Assertion failed: ' + l + ' != ' + r));
  };

  var assert$3 = minimalisticAssert;

  function Cipher$3(options) {
    this.options = options;

    this.type = this.options.type;
    this.blockSize = 8;
    this._init();

    this.buffer = new Array(this.blockSize);
    this.bufferOff = 0;
    this.padding = options.padding !== false;
  }
  var cipher = Cipher$3;

  Cipher$3.prototype._init = function _init() {
    // Might be overrided
  };

  Cipher$3.prototype.update = function update(data) {
    if (data.length === 0)
      return [];

    if (this.type === 'decrypt')
      return this._updateDecrypt(data);
    else
      return this._updateEncrypt(data);
  };

  Cipher$3.prototype._buffer = function _buffer(data, off) {
    // Append data to buffer
    var min = Math.min(this.buffer.length - this.bufferOff, data.length - off);
    for (var i = 0; i < min; i++)
      this.buffer[this.bufferOff + i] = data[off + i];
    this.bufferOff += min;

    // Shift next
    return min;
  };

  Cipher$3.prototype._flushBuffer = function _flushBuffer(out, off) {
    this._update(this.buffer, 0, out, off);
    this.bufferOff = 0;
    return this.blockSize;
  };

  Cipher$3.prototype._updateEncrypt = function _updateEncrypt(data) {
    var inputOff = 0;
    var outputOff = 0;

    var count = ((this.bufferOff + data.length) / this.blockSize) | 0;
    var out = new Array(count * this.blockSize);

    if (this.bufferOff !== 0) {
      inputOff += this._buffer(data, inputOff);

      if (this.bufferOff === this.buffer.length)
        outputOff += this._flushBuffer(out, outputOff);
    }

    // Write blocks
    var max = data.length - ((data.length - inputOff) % this.blockSize);
    for (; inputOff < max; inputOff += this.blockSize) {
      this._update(data, inputOff, out, outputOff);
      outputOff += this.blockSize;
    }

    // Queue rest
    for (; inputOff < data.length; inputOff++, this.bufferOff++)
      this.buffer[this.bufferOff] = data[inputOff];

    return out;
  };

  Cipher$3.prototype._updateDecrypt = function _updateDecrypt(data) {
    var inputOff = 0;
    var outputOff = 0;

    var count = Math.ceil((this.bufferOff + data.length) / this.blockSize) - 1;
    var out = new Array(count * this.blockSize);

    // TODO(indutny): optimize it, this is far from optimal
    for (; count > 0; count--) {
      inputOff += this._buffer(data, inputOff);
      outputOff += this._flushBuffer(out, outputOff);
    }

    // Buffer rest of the input
    inputOff += this._buffer(data, inputOff);

    return out;
  };

  Cipher$3.prototype.final = function final(buffer) {
    var first;
    if (buffer)
      first = this.update(buffer);

    var last;
    if (this.type === 'encrypt')
      last = this._finalEncrypt();
    else
      last = this._finalDecrypt();

    if (first)
      return first.concat(last);
    else
      return last;
  };

  Cipher$3.prototype._pad = function _pad(buffer, off) {
    if (off === 0)
      return false;

    while (off < buffer.length)
      buffer[off++] = 0;

    return true;
  };

  Cipher$3.prototype._finalEncrypt = function _finalEncrypt() {
    if (!this._pad(this.buffer, this.bufferOff))
      return [];

    var out = new Array(this.blockSize);
    this._update(this.buffer, 0, out, 0);
    return out;
  };

  Cipher$3.prototype._unpad = function _unpad(buffer) {
    return buffer;
  };

  Cipher$3.prototype._finalDecrypt = function _finalDecrypt() {
    assert$3.equal(this.bufferOff, this.blockSize, 'Not enough data to decrypt');
    var out = new Array(this.blockSize);
    this._flushBuffer(out, 0);

    return this._unpad(out);
  };

  var assert$2 = minimalisticAssert;
  var inherits$i = inherits_browserExports;

  var utils = utils$1;
  var Cipher$2 = cipher;

  function DESState() {
    this.tmp = new Array(2);
    this.keys = null;
  }

  function DES$3(options) {
    Cipher$2.call(this, options);

    var state = new DESState();
    this._desState = state;

    this.deriveKeys(state, options.key);
  }
  inherits$i(DES$3, Cipher$2);
  var des$1 = DES$3;

  DES$3.create = function create(options) {
    return new DES$3(options);
  };

  var shiftTable = [
    1, 1, 2, 2, 2, 2, 2, 2,
    1, 2, 2, 2, 2, 2, 2, 1
  ];

  DES$3.prototype.deriveKeys = function deriveKeys(state, key) {
    state.keys = new Array(16 * 2);

    assert$2.equal(key.length, this.blockSize, 'Invalid key length');

    var kL = utils.readUInt32BE(key, 0);
    var kR = utils.readUInt32BE(key, 4);

    utils.pc1(kL, kR, state.tmp, 0);
    kL = state.tmp[0];
    kR = state.tmp[1];
    for (var i = 0; i < state.keys.length; i += 2) {
      var shift = shiftTable[i >>> 1];
      kL = utils.r28shl(kL, shift);
      kR = utils.r28shl(kR, shift);
      utils.pc2(kL, kR, state.keys, i);
    }
  };

  DES$3.prototype._update = function _update(inp, inOff, out, outOff) {
    var state = this._desState;

    var l = utils.readUInt32BE(inp, inOff);
    var r = utils.readUInt32BE(inp, inOff + 4);

    // Initial Permutation
    utils.ip(l, r, state.tmp, 0);
    l = state.tmp[0];
    r = state.tmp[1];

    if (this.type === 'encrypt')
      this._encrypt(state, l, r, state.tmp, 0);
    else
      this._decrypt(state, l, r, state.tmp, 0);

    l = state.tmp[0];
    r = state.tmp[1];

    utils.writeUInt32BE(out, l, outOff);
    utils.writeUInt32BE(out, r, outOff + 4);
  };

  DES$3.prototype._pad = function _pad(buffer, off) {
    if (this.padding === false) {
      return false;
    }

    var value = buffer.length - off;
    for (var i = off; i < buffer.length; i++)
      buffer[i] = value;

    return true;
  };

  DES$3.prototype._unpad = function _unpad(buffer) {
    if (this.padding === false) {
      return buffer;
    }

    var pad = buffer[buffer.length - 1];
    for (var i = buffer.length - pad; i < buffer.length; i++)
      assert$2.equal(buffer[i], pad);

    return buffer.slice(0, buffer.length - pad);
  };

  DES$3.prototype._encrypt = function _encrypt(state, lStart, rStart, out, off) {
    var l = lStart;
    var r = rStart;

    // Apply f() x16 times
    for (var i = 0; i < state.keys.length; i += 2) {
      var keyL = state.keys[i];
      var keyR = state.keys[i + 1];

      // f(r, k)
      utils.expand(r, state.tmp, 0);

      keyL ^= state.tmp[0];
      keyR ^= state.tmp[1];
      var s = utils.substitute(keyL, keyR);
      var f = utils.permute(s);

      var t = r;
      r = (l ^ f) >>> 0;
      l = t;
    }

    // Reverse Initial Permutation
    utils.rip(r, l, out, off);
  };

  DES$3.prototype._decrypt = function _decrypt(state, lStart, rStart, out, off) {
    var l = rStart;
    var r = lStart;

    // Apply f() x16 times
    for (var i = state.keys.length - 2; i >= 0; i -= 2) {
      var keyL = state.keys[i];
      var keyR = state.keys[i + 1];

      // f(r, k)
      utils.expand(l, state.tmp, 0);

      keyL ^= state.tmp[0];
      keyR ^= state.tmp[1];
      var s = utils.substitute(keyL, keyR);
      var f = utils.permute(s);

      var t = l;
      l = (r ^ f) >>> 0;
      r = t;
    }

    // Reverse Initial Permutation
    utils.rip(l, r, out, off);
  };

  var cbc$1 = {};

  var assert$1 = minimalisticAssert;
  var inherits$h = inherits_browserExports;

  var proto = {};

  function CBCState(iv) {
    assert$1.equal(iv.length, 8, 'Invalid IV length');

    this.iv = new Array(8);
    for (var i = 0; i < this.iv.length; i++)
      this.iv[i] = iv[i];
  }

  function instantiate(Base) {
    function CBC(options) {
      Base.call(this, options);
      this._cbcInit();
    }
    inherits$h(CBC, Base);

    var keys = Object.keys(proto);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      CBC.prototype[key] = proto[key];
    }

    CBC.create = function create(options) {
      return new CBC(options);
    };

    return CBC;
  }

  cbc$1.instantiate = instantiate;

  proto._cbcInit = function _cbcInit() {
    var state = new CBCState(this.options.iv);
    this._cbcState = state;
  };

  proto._update = function _update(inp, inOff, out, outOff) {
    var state = this._cbcState;
    var superProto = this.constructor.super_.prototype;

    var iv = state.iv;
    if (this.type === 'encrypt') {
      for (var i = 0; i < this.blockSize; i++)
        iv[i] ^= inp[inOff + i];

      superProto._update.call(this, iv, 0, out, outOff);

      for (var i = 0; i < this.blockSize; i++)
        iv[i] = out[outOff + i];
    } else {
      superProto._update.call(this, inp, inOff, out, outOff);

      for (var i = 0; i < this.blockSize; i++)
        out[outOff + i] ^= iv[i];

      for (var i = 0; i < this.blockSize; i++)
        iv[i] = inp[inOff + i];
    }
  };

  var assert = minimalisticAssert;
  var inherits$g = inherits_browserExports;

  var Cipher$1 = cipher;
  var DES$2 = des$1;

  function EDEState(type, key) {
    assert.equal(key.length, 24, 'Invalid key length');

    var k1 = key.slice(0, 8);
    var k2 = key.slice(8, 16);
    var k3 = key.slice(16, 24);

    if (type === 'encrypt') {
      this.ciphers = [
        DES$2.create({ type: 'encrypt', key: k1 }),
        DES$2.create({ type: 'decrypt', key: k2 }),
        DES$2.create({ type: 'encrypt', key: k3 })
      ];
    } else {
      this.ciphers = [
        DES$2.create({ type: 'decrypt', key: k3 }),
        DES$2.create({ type: 'encrypt', key: k2 }),
        DES$2.create({ type: 'decrypt', key: k1 })
      ];
    }
  }

  function EDE(options) {
    Cipher$1.call(this, options);

    var state = new EDEState(this.type, this.options.key);
    this._edeState = state;
  }
  inherits$g(EDE, Cipher$1);

  var ede = EDE;

  EDE.create = function create(options) {
    return new EDE(options);
  };

  EDE.prototype._update = function _update(inp, inOff, out, outOff) {
    var state = this._edeState;

    state.ciphers[0]._update(inp, inOff, out, outOff);
    state.ciphers[1]._update(out, outOff, out, outOff);
    state.ciphers[2]._update(out, outOff, out, outOff);
  };

  EDE.prototype._pad = DES$2.prototype._pad;
  EDE.prototype._unpad = DES$2.prototype._unpad;

  des$2.utils = utils$1;
  des$2.Cipher = cipher;
  des$2.DES = des$1;
  des$2.CBC = cbc$1;
  des$2.EDE = ede;

  var CipherBase = cipherBase;
  var des = des$2;
  var inherits$f = inherits_browserExports;
  var Buffer$s = safeBufferExports.Buffer;

  var modes$3 = {
    'des-ede3-cbc': des.CBC.instantiate(des.EDE),
    'des-ede3': des.EDE,
    'des-ede-cbc': des.CBC.instantiate(des.EDE),
    'des-ede': des.EDE,
    'des-cbc': des.CBC.instantiate(des.DES),
    'des-ecb': des.DES
  };
  modes$3.des = modes$3['des-cbc'];
  modes$3.des3 = modes$3['des-ede3-cbc'];
  var browserifyDes = DES$1;
  inherits$f(DES$1, CipherBase);
  function DES$1 (opts) {
    CipherBase.call(this);
    var modeName = opts.mode.toLowerCase();
    var mode = modes$3[modeName];
    var type;
    if (opts.decrypt) {
      type = 'decrypt';
    } else {
      type = 'encrypt';
    }
    var key = opts.key;
    if (!Buffer$s.isBuffer(key)) {
      key = Buffer$s.from(key);
    }
    if (modeName === 'des-ede' || modeName === 'des-ede-cbc') {
      key = Buffer$s.concat([key, key.slice(0, 8)]);
    }
    var iv = opts.iv;
    if (!Buffer$s.isBuffer(iv)) {
      iv = Buffer$s.from(iv);
    }
    this._des = mode.create({
      key: key,
      iv: iv,
      type: type
    });
  }
  DES$1.prototype._update = function (data) {
    return Buffer$s.from(this._des.update(data))
  };
  DES$1.prototype._final = function () {
    return Buffer$s.from(this._des.final())
  };

  var browser$5 = {};

  var encrypter = {};

  var ecb = {};

  ecb.encrypt = function (self, block) {
    return self._cipher.encryptBlock(block)
  };

  ecb.decrypt = function (self, block) {
    return self._cipher.decryptBlock(block)
  };

  var cbc = {};

  var bufferXor = function xor (a, b) {
    var length = Math.min(a.length, b.length);
    var buffer = new Buffer$u(length);

    for (var i = 0; i < length; ++i) {
      buffer[i] = a[i] ^ b[i];
    }

    return buffer
  };

  var xor$4 = bufferXor;

  cbc.encrypt = function (self, block) {
    var data = xor$4(block, self._prev);

    self._prev = self._cipher.encryptBlock(data);
    return self._prev
  };

  cbc.decrypt = function (self, block) {
    var pad = self._prev;

    self._prev = block;
    var out = self._cipher.decryptBlock(block);

    return xor$4(out, pad)
  };

  var cfb = {};

  var Buffer$r = safeBufferExports.Buffer;
  var xor$3 = bufferXor;

  function encryptStart (self, data, decrypt) {
    var len = data.length;
    var out = xor$3(data, self._cache);
    self._cache = self._cache.slice(len);
    self._prev = Buffer$r.concat([self._prev, decrypt ? data : out]);
    return out
  }

  cfb.encrypt = function (self, data, decrypt) {
    var out = Buffer$r.allocUnsafe(0);
    var len;

    while (data.length) {
      if (self._cache.length === 0) {
        self._cache = self._cipher.encryptBlock(self._prev);
        self._prev = Buffer$r.allocUnsafe(0);
      }

      if (self._cache.length <= data.length) {
        len = self._cache.length;
        out = Buffer$r.concat([out, encryptStart(self, data.slice(0, len), decrypt)]);
        data = data.slice(len);
      } else {
        out = Buffer$r.concat([out, encryptStart(self, data, decrypt)]);
        break
      }
    }

    return out
  };

  var cfb8 = {};

  var Buffer$q = safeBufferExports.Buffer;

  function encryptByte$1 (self, byteParam, decrypt) {
    var pad = self._cipher.encryptBlock(self._prev);
    var out = pad[0] ^ byteParam;

    self._prev = Buffer$q.concat([
      self._prev.slice(1),
      Buffer$q.from([decrypt ? byteParam : out])
    ]);

    return out
  }

  cfb8.encrypt = function (self, chunk, decrypt) {
    var len = chunk.length;
    var out = Buffer$q.allocUnsafe(len);
    var i = -1;

    while (++i < len) {
      out[i] = encryptByte$1(self, chunk[i], decrypt);
    }

    return out
  };

  var cfb1 = {};

  var Buffer$p = safeBufferExports.Buffer;

  function encryptByte (self, byteParam, decrypt) {
    var pad;
    var i = -1;
    var len = 8;
    var out = 0;
    var bit, value;
    while (++i < len) {
      pad = self._cipher.encryptBlock(self._prev);
      bit = (byteParam & (1 << (7 - i))) ? 0x80 : 0;
      value = pad[0] ^ bit;
      out += ((value & 0x80) >> (i % 8));
      self._prev = shiftIn(self._prev, decrypt ? bit : value);
    }
    return out
  }

  function shiftIn (buffer, value) {
    var len = buffer.length;
    var i = -1;
    var out = Buffer$p.allocUnsafe(buffer.length);
    buffer = Buffer$p.concat([buffer, Buffer$p.from([value])]);

    while (++i < len) {
      out[i] = buffer[i] << 1 | buffer[i + 1] >> (7);
    }

    return out
  }

  cfb1.encrypt = function (self, chunk, decrypt) {
    var len = chunk.length;
    var out = Buffer$p.allocUnsafe(len);
    var i = -1;

    while (++i < len) {
      out[i] = encryptByte(self, chunk[i], decrypt);
    }

    return out
  };

  var ofb = {};

  var xor$2 = bufferXor;

  function getBlock$1 (self) {
    self._prev = self._cipher.encryptBlock(self._prev);
    return self._prev
  }

  ofb.encrypt = function (self, chunk) {
    while (self._cache.length < chunk.length) {
      self._cache = Buffer$u.concat([self._cache, getBlock$1(self)]);
    }

    var pad = self._cache.slice(0, chunk.length);
    self._cache = self._cache.slice(chunk.length);
    return xor$2(chunk, pad)
  };

  var ctr = {};

  function incr32$2 (iv) {
    var len = iv.length;
    var item;
    while (len--) {
      item = iv.readUInt8(len);
      if (item === 255) {
        iv.writeUInt8(0, len);
      } else {
        item++;
        iv.writeUInt8(item, len);
        break
      }
    }
  }
  var incr32_1 = incr32$2;

  var xor$1 = bufferXor;
  var Buffer$o = safeBufferExports.Buffer;
  var incr32$1 = incr32_1;

  function getBlock (self) {
    var out = self._cipher.encryptBlockRaw(self._prev);
    incr32$1(self._prev);
    return out
  }

  var blockSize = 16;
  ctr.encrypt = function (self, chunk) {
    var chunkNum = Math.ceil(chunk.length / blockSize);
    var start = self._cache.length;
    self._cache = Buffer$o.concat([
      self._cache,
      Buffer$o.allocUnsafe(chunkNum * blockSize)
    ]);
    for (var i = 0; i < chunkNum; i++) {
      var out = getBlock(self);
      var offset = start + i * blockSize;
      self._cache.writeUInt32BE(out[0], offset + 0);
      self._cache.writeUInt32BE(out[1], offset + 4);
      self._cache.writeUInt32BE(out[2], offset + 8);
      self._cache.writeUInt32BE(out[3], offset + 12);
    }
    var pad = self._cache.slice(0, chunk.length);
    self._cache = self._cache.slice(chunk.length);
    return xor$1(chunk, pad)
  };

  var aes128 = {
  	cipher: "AES",
  	key: 128,
  	iv: 16,
  	mode: "CBC",
  	type: "block"
  };
  var aes192 = {
  	cipher: "AES",
  	key: 192,
  	iv: 16,
  	mode: "CBC",
  	type: "block"
  };
  var aes256 = {
  	cipher: "AES",
  	key: 256,
  	iv: 16,
  	mode: "CBC",
  	type: "block"
  };
  var require$$2 = {
  	"aes-128-ecb": {
  	cipher: "AES",
  	key: 128,
  	iv: 0,
  	mode: "ECB",
  	type: "block"
  },
  	"aes-192-ecb": {
  	cipher: "AES",
  	key: 192,
  	iv: 0,
  	mode: "ECB",
  	type: "block"
  },
  	"aes-256-ecb": {
  	cipher: "AES",
  	key: 256,
  	iv: 0,
  	mode: "ECB",
  	type: "block"
  },
  	"aes-128-cbc": {
  	cipher: "AES",
  	key: 128,
  	iv: 16,
  	mode: "CBC",
  	type: "block"
  },
  	"aes-192-cbc": {
  	cipher: "AES",
  	key: 192,
  	iv: 16,
  	mode: "CBC",
  	type: "block"
  },
  	"aes-256-cbc": {
  	cipher: "AES",
  	key: 256,
  	iv: 16,
  	mode: "CBC",
  	type: "block"
  },
  	aes128: aes128,
  	aes192: aes192,
  	aes256: aes256,
  	"aes-128-cfb": {
  	cipher: "AES",
  	key: 128,
  	iv: 16,
  	mode: "CFB",
  	type: "stream"
  },
  	"aes-192-cfb": {
  	cipher: "AES",
  	key: 192,
  	iv: 16,
  	mode: "CFB",
  	type: "stream"
  },
  	"aes-256-cfb": {
  	cipher: "AES",
  	key: 256,
  	iv: 16,
  	mode: "CFB",
  	type: "stream"
  },
  	"aes-128-cfb8": {
  	cipher: "AES",
  	key: 128,
  	iv: 16,
  	mode: "CFB8",
  	type: "stream"
  },
  	"aes-192-cfb8": {
  	cipher: "AES",
  	key: 192,
  	iv: 16,
  	mode: "CFB8",
  	type: "stream"
  },
  	"aes-256-cfb8": {
  	cipher: "AES",
  	key: 256,
  	iv: 16,
  	mode: "CFB8",
  	type: "stream"
  },
  	"aes-128-cfb1": {
  	cipher: "AES",
  	key: 128,
  	iv: 16,
  	mode: "CFB1",
  	type: "stream"
  },
  	"aes-192-cfb1": {
  	cipher: "AES",
  	key: 192,
  	iv: 16,
  	mode: "CFB1",
  	type: "stream"
  },
  	"aes-256-cfb1": {
  	cipher: "AES",
  	key: 256,
  	iv: 16,
  	mode: "CFB1",
  	type: "stream"
  },
  	"aes-128-ofb": {
  	cipher: "AES",
  	key: 128,
  	iv: 16,
  	mode: "OFB",
  	type: "stream"
  },
  	"aes-192-ofb": {
  	cipher: "AES",
  	key: 192,
  	iv: 16,
  	mode: "OFB",
  	type: "stream"
  },
  	"aes-256-ofb": {
  	cipher: "AES",
  	key: 256,
  	iv: 16,
  	mode: "OFB",
  	type: "stream"
  },
  	"aes-128-ctr": {
  	cipher: "AES",
  	key: 128,
  	iv: 16,
  	mode: "CTR",
  	type: "stream"
  },
  	"aes-192-ctr": {
  	cipher: "AES",
  	key: 192,
  	iv: 16,
  	mode: "CTR",
  	type: "stream"
  },
  	"aes-256-ctr": {
  	cipher: "AES",
  	key: 256,
  	iv: 16,
  	mode: "CTR",
  	type: "stream"
  },
  	"aes-128-gcm": {
  	cipher: "AES",
  	key: 128,
  	iv: 12,
  	mode: "GCM",
  	type: "auth"
  },
  	"aes-192-gcm": {
  	cipher: "AES",
  	key: 192,
  	iv: 12,
  	mode: "GCM",
  	type: "auth"
  },
  	"aes-256-gcm": {
  	cipher: "AES",
  	key: 256,
  	iv: 12,
  	mode: "GCM",
  	type: "auth"
  }
  };

  var modeModules = {
    ECB: ecb,
    CBC: cbc,
    CFB: cfb,
    CFB8: cfb8,
    CFB1: cfb1,
    OFB: ofb,
    CTR: ctr,
    GCM: ctr
  };

  var modes$2 = require$$2;

  for (var key in modes$2) {
    modes$2[key].module = modeModules[modes$2[key].mode];
  }

  var modes_1 = modes$2;

  var aes$6 = {};

  // based on the aes implimentation in triple sec
  // https://github.com/keybase/triplesec
  // which is in turn based on the one from crypto-js
  // https://code.google.com/p/crypto-js/

  var Buffer$n = safeBufferExports.Buffer;

  function asUInt32Array (buf) {
    if (!Buffer$n.isBuffer(buf)) buf = Buffer$n.from(buf);

    var len = (buf.length / 4) | 0;
    var out = new Array(len);

    for (var i = 0; i < len; i++) {
      out[i] = buf.readUInt32BE(i * 4);
    }

    return out
  }

  function scrubVec (v) {
    for (var i = 0; i < v.length; v++) {
      v[i] = 0;
    }
  }

  function cryptBlock (M, keySchedule, SUB_MIX, SBOX, nRounds) {
    var SUB_MIX0 = SUB_MIX[0];
    var SUB_MIX1 = SUB_MIX[1];
    var SUB_MIX2 = SUB_MIX[2];
    var SUB_MIX3 = SUB_MIX[3];

    var s0 = M[0] ^ keySchedule[0];
    var s1 = M[1] ^ keySchedule[1];
    var s2 = M[2] ^ keySchedule[2];
    var s3 = M[3] ^ keySchedule[3];
    var t0, t1, t2, t3;
    var ksRow = 4;

    for (var round = 1; round < nRounds; round++) {
      t0 = SUB_MIX0[s0 >>> 24] ^ SUB_MIX1[(s1 >>> 16) & 0xff] ^ SUB_MIX2[(s2 >>> 8) & 0xff] ^ SUB_MIX3[s3 & 0xff] ^ keySchedule[ksRow++];
      t1 = SUB_MIX0[s1 >>> 24] ^ SUB_MIX1[(s2 >>> 16) & 0xff] ^ SUB_MIX2[(s3 >>> 8) & 0xff] ^ SUB_MIX3[s0 & 0xff] ^ keySchedule[ksRow++];
      t2 = SUB_MIX0[s2 >>> 24] ^ SUB_MIX1[(s3 >>> 16) & 0xff] ^ SUB_MIX2[(s0 >>> 8) & 0xff] ^ SUB_MIX3[s1 & 0xff] ^ keySchedule[ksRow++];
      t3 = SUB_MIX0[s3 >>> 24] ^ SUB_MIX1[(s0 >>> 16) & 0xff] ^ SUB_MIX2[(s1 >>> 8) & 0xff] ^ SUB_MIX3[s2 & 0xff] ^ keySchedule[ksRow++];
      s0 = t0;
      s1 = t1;
      s2 = t2;
      s3 = t3;
    }

    t0 = ((SBOX[s0 >>> 24] << 24) | (SBOX[(s1 >>> 16) & 0xff] << 16) | (SBOX[(s2 >>> 8) & 0xff] << 8) | SBOX[s3 & 0xff]) ^ keySchedule[ksRow++];
    t1 = ((SBOX[s1 >>> 24] << 24) | (SBOX[(s2 >>> 16) & 0xff] << 16) | (SBOX[(s3 >>> 8) & 0xff] << 8) | SBOX[s0 & 0xff]) ^ keySchedule[ksRow++];
    t2 = ((SBOX[s2 >>> 24] << 24) | (SBOX[(s3 >>> 16) & 0xff] << 16) | (SBOX[(s0 >>> 8) & 0xff] << 8) | SBOX[s1 & 0xff]) ^ keySchedule[ksRow++];
    t3 = ((SBOX[s3 >>> 24] << 24) | (SBOX[(s0 >>> 16) & 0xff] << 16) | (SBOX[(s1 >>> 8) & 0xff] << 8) | SBOX[s2 & 0xff]) ^ keySchedule[ksRow++];
    t0 = t0 >>> 0;
    t1 = t1 >>> 0;
    t2 = t2 >>> 0;
    t3 = t3 >>> 0;

    return [t0, t1, t2, t3]
  }

  // AES constants
  var RCON = [0x00, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];
  var G = (function () {
    // Compute double table
    var d = new Array(256);
    for (var j = 0; j < 256; j++) {
      if (j < 128) {
        d[j] = j << 1;
      } else {
        d[j] = (j << 1) ^ 0x11b;
      }
    }

    var SBOX = [];
    var INV_SBOX = [];
    var SUB_MIX = [[], [], [], []];
    var INV_SUB_MIX = [[], [], [], []];

    // Walk GF(2^8)
    var x = 0;
    var xi = 0;
    for (var i = 0; i < 256; ++i) {
      // Compute sbox
      var sx = xi ^ (xi << 1) ^ (xi << 2) ^ (xi << 3) ^ (xi << 4);
      sx = (sx >>> 8) ^ (sx & 0xff) ^ 0x63;
      SBOX[x] = sx;
      INV_SBOX[sx] = x;

      // Compute multiplication
      var x2 = d[x];
      var x4 = d[x2];
      var x8 = d[x4];

      // Compute sub bytes, mix columns tables
      var t = (d[sx] * 0x101) ^ (sx * 0x1010100);
      SUB_MIX[0][x] = (t << 24) | (t >>> 8);
      SUB_MIX[1][x] = (t << 16) | (t >>> 16);
      SUB_MIX[2][x] = (t << 8) | (t >>> 24);
      SUB_MIX[3][x] = t;

      // Compute inv sub bytes, inv mix columns tables
      t = (x8 * 0x1010101) ^ (x4 * 0x10001) ^ (x2 * 0x101) ^ (x * 0x1010100);
      INV_SUB_MIX[0][sx] = (t << 24) | (t >>> 8);
      INV_SUB_MIX[1][sx] = (t << 16) | (t >>> 16);
      INV_SUB_MIX[2][sx] = (t << 8) | (t >>> 24);
      INV_SUB_MIX[3][sx] = t;

      if (x === 0) {
        x = xi = 1;
      } else {
        x = x2 ^ d[d[d[x8 ^ x2]]];
        xi ^= d[d[xi]];
      }
    }

    return {
      SBOX: SBOX,
      INV_SBOX: INV_SBOX,
      SUB_MIX: SUB_MIX,
      INV_SUB_MIX: INV_SUB_MIX
    }
  })();

  function AES (key) {
    this._key = asUInt32Array(key);
    this._reset();
  }

  AES.blockSize = 4 * 4;
  AES.keySize = 256 / 8;
  AES.prototype.blockSize = AES.blockSize;
  AES.prototype.keySize = AES.keySize;
  AES.prototype._reset = function () {
    var keyWords = this._key;
    var keySize = keyWords.length;
    var nRounds = keySize + 6;
    var ksRows = (nRounds + 1) * 4;

    var keySchedule = [];
    for (var k = 0; k < keySize; k++) {
      keySchedule[k] = keyWords[k];
    }

    for (k = keySize; k < ksRows; k++) {
      var t = keySchedule[k - 1];

      if (k % keySize === 0) {
        t = (t << 8) | (t >>> 24);
        t =
          (G.SBOX[t >>> 24] << 24) |
          (G.SBOX[(t >>> 16) & 0xff] << 16) |
          (G.SBOX[(t >>> 8) & 0xff] << 8) |
          (G.SBOX[t & 0xff]);

        t ^= RCON[(k / keySize) | 0] << 24;
      } else if (keySize > 6 && k % keySize === 4) {
        t =
          (G.SBOX[t >>> 24] << 24) |
          (G.SBOX[(t >>> 16) & 0xff] << 16) |
          (G.SBOX[(t >>> 8) & 0xff] << 8) |
          (G.SBOX[t & 0xff]);
      }

      keySchedule[k] = keySchedule[k - keySize] ^ t;
    }

    var invKeySchedule = [];
    for (var ik = 0; ik < ksRows; ik++) {
      var ksR = ksRows - ik;
      var tt = keySchedule[ksR - (ik % 4 ? 0 : 4)];

      if (ik < 4 || ksR <= 4) {
        invKeySchedule[ik] = tt;
      } else {
        invKeySchedule[ik] =
          G.INV_SUB_MIX[0][G.SBOX[tt >>> 24]] ^
          G.INV_SUB_MIX[1][G.SBOX[(tt >>> 16) & 0xff]] ^
          G.INV_SUB_MIX[2][G.SBOX[(tt >>> 8) & 0xff]] ^
          G.INV_SUB_MIX[3][G.SBOX[tt & 0xff]];
      }
    }

    this._nRounds = nRounds;
    this._keySchedule = keySchedule;
    this._invKeySchedule = invKeySchedule;
  };

  AES.prototype.encryptBlockRaw = function (M) {
    M = asUInt32Array(M);
    return cryptBlock(M, this._keySchedule, G.SUB_MIX, G.SBOX, this._nRounds)
  };

  AES.prototype.encryptBlock = function (M) {
    var out = this.encryptBlockRaw(M);
    var buf = Buffer$n.allocUnsafe(16);
    buf.writeUInt32BE(out[0], 0);
    buf.writeUInt32BE(out[1], 4);
    buf.writeUInt32BE(out[2], 8);
    buf.writeUInt32BE(out[3], 12);
    return buf
  };

  AES.prototype.decryptBlock = function (M) {
    M = asUInt32Array(M);

    // swap
    var m1 = M[1];
    M[1] = M[3];
    M[3] = m1;

    var out = cryptBlock(M, this._invKeySchedule, G.INV_SUB_MIX, G.INV_SBOX, this._nRounds);
    var buf = Buffer$n.allocUnsafe(16);
    buf.writeUInt32BE(out[0], 0);
    buf.writeUInt32BE(out[3], 4);
    buf.writeUInt32BE(out[2], 8);
    buf.writeUInt32BE(out[1], 12);
    return buf
  };

  AES.prototype.scrub = function () {
    scrubVec(this._keySchedule);
    scrubVec(this._invKeySchedule);
    scrubVec(this._key);
  };

  aes$6.AES = AES;

  var Buffer$m = safeBufferExports.Buffer;
  var ZEROES = Buffer$m.alloc(16, 0);

  function toArray (buf) {
    return [
      buf.readUInt32BE(0),
      buf.readUInt32BE(4),
      buf.readUInt32BE(8),
      buf.readUInt32BE(12)
    ]
  }

  function fromArray (out) {
    var buf = Buffer$m.allocUnsafe(16);
    buf.writeUInt32BE(out[0] >>> 0, 0);
    buf.writeUInt32BE(out[1] >>> 0, 4);
    buf.writeUInt32BE(out[2] >>> 0, 8);
    buf.writeUInt32BE(out[3] >>> 0, 12);
    return buf
  }

  function GHASH$1 (key) {
    this.h = key;
    this.state = Buffer$m.alloc(16, 0);
    this.cache = Buffer$m.allocUnsafe(0);
  }

  // from http://bitwiseshiftleft.github.io/sjcl/doc/symbols/src/core_gcm.js.html
  // by Juho Vähä-Herttua
  GHASH$1.prototype.ghash = function (block) {
    var i = -1;
    while (++i < block.length) {
      this.state[i] ^= block[i];
    }
    this._multiply();
  };

  GHASH$1.prototype._multiply = function () {
    var Vi = toArray(this.h);
    var Zi = [0, 0, 0, 0];
    var j, xi, lsbVi;
    var i = -1;
    while (++i < 128) {
      xi = (this.state[~~(i / 8)] & (1 << (7 - (i % 8)))) !== 0;
      if (xi) {
        // Z_i+1 = Z_i ^ V_i
        Zi[0] ^= Vi[0];
        Zi[1] ^= Vi[1];
        Zi[2] ^= Vi[2];
        Zi[3] ^= Vi[3];
      }

      // Store the value of LSB(V_i)
      lsbVi = (Vi[3] & 1) !== 0;

      // V_i+1 = V_i >> 1
      for (j = 3; j > 0; j--) {
        Vi[j] = (Vi[j] >>> 1) | ((Vi[j - 1] & 1) << 31);
      }
      Vi[0] = Vi[0] >>> 1;

      // If LSB(V_i) is 1, V_i+1 = (V_i >> 1) ^ R
      if (lsbVi) {
        Vi[0] = Vi[0] ^ (0xe1 << 24);
      }
    }
    this.state = fromArray(Zi);
  };

  GHASH$1.prototype.update = function (buf) {
    this.cache = Buffer$m.concat([this.cache, buf]);
    var chunk;
    while (this.cache.length >= 16) {
      chunk = this.cache.slice(0, 16);
      this.cache = this.cache.slice(16);
      this.ghash(chunk);
    }
  };

  GHASH$1.prototype.final = function (abl, bl) {
    if (this.cache.length) {
      this.ghash(Buffer$m.concat([this.cache, ZEROES], 16));
    }

    this.ghash(fromArray([0, abl, 0, bl]));
    return this.state
  };

  var ghash = GHASH$1;

  var aes$5 = aes$6;
  var Buffer$l = safeBufferExports.Buffer;
  var Transform$4 = cipherBase;
  var inherits$e = inherits_browserExports;
  var GHASH = ghash;
  var xor = bufferXor;
  var incr32 = incr32_1;

  function xorTest (a, b) {
    var out = 0;
    if (a.length !== b.length) out++;

    var len = Math.min(a.length, b.length);
    for (var i = 0; i < len; ++i) {
      out += (a[i] ^ b[i]);
    }

    return out
  }

  function calcIv (self, iv, ck) {
    if (iv.length === 12) {
      self._finID = Buffer$l.concat([iv, Buffer$l.from([0, 0, 0, 1])]);
      return Buffer$l.concat([iv, Buffer$l.from([0, 0, 0, 2])])
    }
    var ghash = new GHASH(ck);
    var len = iv.length;
    var toPad = len % 16;
    ghash.update(iv);
    if (toPad) {
      toPad = 16 - toPad;
      ghash.update(Buffer$l.alloc(toPad, 0));
    }
    ghash.update(Buffer$l.alloc(8, 0));
    var ivBits = len * 8;
    var tail = Buffer$l.alloc(8);
    tail.writeUIntBE(ivBits, 0, 8);
    ghash.update(tail);
    self._finID = ghash.state;
    var out = Buffer$l.from(self._finID);
    incr32(out);
    return out
  }
  function StreamCipher$3 (mode, key, iv, decrypt) {
    Transform$4.call(this);

    var h = Buffer$l.alloc(4, 0);

    this._cipher = new aes$5.AES(key);
    var ck = this._cipher.encryptBlock(h);
    this._ghash = new GHASH(ck);
    iv = calcIv(this, iv, ck);

    this._prev = Buffer$l.from(iv);
    this._cache = Buffer$l.allocUnsafe(0);
    this._secCache = Buffer$l.allocUnsafe(0);
    this._decrypt = decrypt;
    this._alen = 0;
    this._len = 0;
    this._mode = mode;

    this._authTag = null;
    this._called = false;
  }

  inherits$e(StreamCipher$3, Transform$4);

  StreamCipher$3.prototype._update = function (chunk) {
    if (!this._called && this._alen) {
      var rump = 16 - (this._alen % 16);
      if (rump < 16) {
        rump = Buffer$l.alloc(rump, 0);
        this._ghash.update(rump);
      }
    }

    this._called = true;
    var out = this._mode.encrypt(this, chunk);
    if (this._decrypt) {
      this._ghash.update(chunk);
    } else {
      this._ghash.update(out);
    }
    this._len += chunk.length;
    return out
  };

  StreamCipher$3.prototype._final = function () {
    if (this._decrypt && !this._authTag) throw new Error('Unsupported state or unable to authenticate data')

    var tag = xor(this._ghash.final(this._alen * 8, this._len * 8), this._cipher.encryptBlock(this._finID));
    if (this._decrypt && xorTest(tag, this._authTag)) throw new Error('Unsupported state or unable to authenticate data')

    this._authTag = tag;
    this._cipher.scrub();
  };

  StreamCipher$3.prototype.getAuthTag = function getAuthTag () {
    if (this._decrypt || !Buffer$l.isBuffer(this._authTag)) throw new Error('Attempting to get auth tag in unsupported state')

    return this._authTag
  };

  StreamCipher$3.prototype.setAuthTag = function setAuthTag (tag) {
    if (!this._decrypt) throw new Error('Attempting to set auth tag in unsupported state')

    this._authTag = tag;
  };

  StreamCipher$3.prototype.setAAD = function setAAD (buf) {
    if (this._called) throw new Error('Attempting to set AAD in unsupported state')

    this._ghash.update(buf);
    this._alen += buf.length;
  };

  var authCipher = StreamCipher$3;

  var aes$4 = aes$6;
  var Buffer$k = safeBufferExports.Buffer;
  var Transform$3 = cipherBase;
  var inherits$d = inherits_browserExports;

  function StreamCipher$2 (mode, key, iv, decrypt) {
    Transform$3.call(this);

    this._cipher = new aes$4.AES(key);
    this._prev = Buffer$k.from(iv);
    this._cache = Buffer$k.allocUnsafe(0);
    this._secCache = Buffer$k.allocUnsafe(0);
    this._decrypt = decrypt;
    this._mode = mode;
  }

  inherits$d(StreamCipher$2, Transform$3);

  StreamCipher$2.prototype._update = function (chunk) {
    return this._mode.encrypt(this, chunk, this._decrypt)
  };

  StreamCipher$2.prototype._final = function () {
    this._cipher.scrub();
  };

  var streamCipher = StreamCipher$2;

  var readableBrowser = {exports: {}};

  var require$$0 = /*@__PURE__*/getAugmentedNamespace(events);

  var streamBrowser;
  var hasRequiredStreamBrowser;

  function requireStreamBrowser () {
  	if (hasRequiredStreamBrowser) return streamBrowser;
  	hasRequiredStreamBrowser = 1;
  	streamBrowser = require$$0.EventEmitter;
  	return streamBrowser;
  }

  var require$$3 = /*@__PURE__*/getAugmentedNamespace(util$2);

  var buffer_list;
  var hasRequiredBuffer_list;

  function requireBuffer_list () {
  	if (hasRequiredBuffer_list) return buffer_list;
  	hasRequiredBuffer_list = 1;

  	function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
  	function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
  	function _defineProperty(obj, key, value) { key = _toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
  	function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
  	function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, _toPropertyKey(descriptor.key), descriptor); } }
  	function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); Object.defineProperty(Constructor, "prototype", { writable: false }); return Constructor; }
  	function _toPropertyKey(arg) { var key = _toPrimitive(arg, "string"); return typeof key === "symbol" ? key : String(key); }
  	function _toPrimitive(input, hint) { if (typeof input !== "object" || input === null) return input; var prim = input[Symbol.toPrimitive]; if (prim !== undefined) { var res = prim.call(input, hint || "default"); if (typeof res !== "object") return res; throw new TypeError("@@toPrimitive must return a primitive value."); } return (hint === "string" ? String : Number)(input); }
  	var _require = require$$0$1,
  	  Buffer = _require.Buffer;
  	var _require2 = require$$3,
  	  inspect = _require2.inspect;
  	var custom = inspect && inspect.custom || 'inspect';
  	function copyBuffer(src, target, offset) {
  	  Buffer.prototype.copy.call(src, target, offset);
  	}
  	buffer_list = /*#__PURE__*/function () {
  	  function BufferList() {
  	    _classCallCheck(this, BufferList);
  	    this.head = null;
  	    this.tail = null;
  	    this.length = 0;
  	  }
  	  _createClass(BufferList, [{
  	    key: "push",
  	    value: function push(v) {
  	      var entry = {
  	        data: v,
  	        next: null
  	      };
  	      if (this.length > 0) this.tail.next = entry;else this.head = entry;
  	      this.tail = entry;
  	      ++this.length;
  	    }
  	  }, {
  	    key: "unshift",
  	    value: function unshift(v) {
  	      var entry = {
  	        data: v,
  	        next: this.head
  	      };
  	      if (this.length === 0) this.tail = entry;
  	      this.head = entry;
  	      ++this.length;
  	    }
  	  }, {
  	    key: "shift",
  	    value: function shift() {
  	      if (this.length === 0) return;
  	      var ret = this.head.data;
  	      if (this.length === 1) this.head = this.tail = null;else this.head = this.head.next;
  	      --this.length;
  	      return ret;
  	    }
  	  }, {
  	    key: "clear",
  	    value: function clear() {
  	      this.head = this.tail = null;
  	      this.length = 0;
  	    }
  	  }, {
  	    key: "join",
  	    value: function join(s) {
  	      if (this.length === 0) return '';
  	      var p = this.head;
  	      var ret = '' + p.data;
  	      while (p = p.next) ret += s + p.data;
  	      return ret;
  	    }
  	  }, {
  	    key: "concat",
  	    value: function concat(n) {
  	      if (this.length === 0) return Buffer.alloc(0);
  	      var ret = Buffer.allocUnsafe(n >>> 0);
  	      var p = this.head;
  	      var i = 0;
  	      while (p) {
  	        copyBuffer(p.data, ret, i);
  	        i += p.data.length;
  	        p = p.next;
  	      }
  	      return ret;
  	    }

  	    // Consumes a specified amount of bytes or characters from the buffered data.
  	  }, {
  	    key: "consume",
  	    value: function consume(n, hasStrings) {
  	      var ret;
  	      if (n < this.head.data.length) {
  	        // `slice` is the same for buffers and strings.
  	        ret = this.head.data.slice(0, n);
  	        this.head.data = this.head.data.slice(n);
  	      } else if (n === this.head.data.length) {
  	        // First chunk is a perfect match.
  	        ret = this.shift();
  	      } else {
  	        // Result spans more than one buffer.
  	        ret = hasStrings ? this._getString(n) : this._getBuffer(n);
  	      }
  	      return ret;
  	    }
  	  }, {
  	    key: "first",
  	    value: function first() {
  	      return this.head.data;
  	    }

  	    // Consumes a specified amount of characters from the buffered data.
  	  }, {
  	    key: "_getString",
  	    value: function _getString(n) {
  	      var p = this.head;
  	      var c = 1;
  	      var ret = p.data;
  	      n -= ret.length;
  	      while (p = p.next) {
  	        var str = p.data;
  	        var nb = n > str.length ? str.length : n;
  	        if (nb === str.length) ret += str;else ret += str.slice(0, n);
  	        n -= nb;
  	        if (n === 0) {
  	          if (nb === str.length) {
  	            ++c;
  	            if (p.next) this.head = p.next;else this.head = this.tail = null;
  	          } else {
  	            this.head = p;
  	            p.data = str.slice(nb);
  	          }
  	          break;
  	        }
  	        ++c;
  	      }
  	      this.length -= c;
  	      return ret;
  	    }

  	    // Consumes a specified amount of bytes from the buffered data.
  	  }, {
  	    key: "_getBuffer",
  	    value: function _getBuffer(n) {
  	      var ret = Buffer.allocUnsafe(n);
  	      var p = this.head;
  	      var c = 1;
  	      p.data.copy(ret);
  	      n -= p.data.length;
  	      while (p = p.next) {
  	        var buf = p.data;
  	        var nb = n > buf.length ? buf.length : n;
  	        buf.copy(ret, ret.length - n, 0, nb);
  	        n -= nb;
  	        if (n === 0) {
  	          if (nb === buf.length) {
  	            ++c;
  	            if (p.next) this.head = p.next;else this.head = this.tail = null;
  	          } else {
  	            this.head = p;
  	            p.data = buf.slice(nb);
  	          }
  	          break;
  	        }
  	        ++c;
  	      }
  	      this.length -= c;
  	      return ret;
  	    }

  	    // Make sure the linked list only shows the minimal necessary information.
  	  }, {
  	    key: custom,
  	    value: function value(_, options) {
  	      return inspect(this, _objectSpread(_objectSpread({}, options), {}, {
  	        // Only inspect one level.
  	        depth: 0,
  	        // It should not recurse.
  	        customInspect: false
  	      }));
  	    }
  	  }]);
  	  return BufferList;
  	}();
  	return buffer_list;
  }

  var destroy_1;
  var hasRequiredDestroy;

  function requireDestroy () {
  	if (hasRequiredDestroy) return destroy_1;
  	hasRequiredDestroy = 1;

  	// undocumented cb() API, needed for core, not for public API
  	function destroy(err, cb) {
  	  var _this = this;
  	  var readableDestroyed = this._readableState && this._readableState.destroyed;
  	  var writableDestroyed = this._writableState && this._writableState.destroyed;
  	  if (readableDestroyed || writableDestroyed) {
  	    if (cb) {
  	      cb(err);
  	    } else if (err) {
  	      if (!this._writableState) {
  	        nextTick$1(emitErrorNT, this, err);
  	      } else if (!this._writableState.errorEmitted) {
  	        this._writableState.errorEmitted = true;
  	        nextTick$1(emitErrorNT, this, err);
  	      }
  	    }
  	    return this;
  	  }

  	  // we set destroyed to true before firing error callbacks in order
  	  // to make it re-entrance safe in case destroy() is called within callbacks

  	  if (this._readableState) {
  	    this._readableState.destroyed = true;
  	  }

  	  // if this is a duplex stream mark the writable part as destroyed as well
  	  if (this._writableState) {
  	    this._writableState.destroyed = true;
  	  }
  	  this._destroy(err || null, function (err) {
  	    if (!cb && err) {
  	      if (!_this._writableState) {
  	        nextTick$1(emitErrorAndCloseNT, _this, err);
  	      } else if (!_this._writableState.errorEmitted) {
  	        _this._writableState.errorEmitted = true;
  	        nextTick$1(emitErrorAndCloseNT, _this, err);
  	      } else {
  	        nextTick$1(emitCloseNT, _this);
  	      }
  	    } else if (cb) {
  	      nextTick$1(emitCloseNT, _this);
  	      cb(err);
  	    } else {
  	      nextTick$1(emitCloseNT, _this);
  	    }
  	  });
  	  return this;
  	}
  	function emitErrorAndCloseNT(self, err) {
  	  emitErrorNT(self, err);
  	  emitCloseNT(self);
  	}
  	function emitCloseNT(self) {
  	  if (self._writableState && !self._writableState.emitClose) return;
  	  if (self._readableState && !self._readableState.emitClose) return;
  	  self.emit('close');
  	}
  	function undestroy() {
  	  if (this._readableState) {
  	    this._readableState.destroyed = false;
  	    this._readableState.reading = false;
  	    this._readableState.ended = false;
  	    this._readableState.endEmitted = false;
  	  }
  	  if (this._writableState) {
  	    this._writableState.destroyed = false;
  	    this._writableState.ended = false;
  	    this._writableState.ending = false;
  	    this._writableState.finalCalled = false;
  	    this._writableState.prefinished = false;
  	    this._writableState.finished = false;
  	    this._writableState.errorEmitted = false;
  	  }
  	}
  	function emitErrorNT(self, err) {
  	  self.emit('error', err);
  	}
  	function errorOrDestroy(stream, err) {
  	  // We have tests that rely on errors being emitted
  	  // in the same tick, so changing this is semver major.
  	  // For now when you opt-in to autoDestroy we allow
  	  // the error to be emitted nextTick. In a future
  	  // semver major update we should change the default to this.

  	  var rState = stream._readableState;
  	  var wState = stream._writableState;
  	  if (rState && rState.autoDestroy || wState && wState.autoDestroy) stream.destroy(err);else stream.emit('error', err);
  	}
  	destroy_1 = {
  	  destroy: destroy,
  	  undestroy: undestroy,
  	  errorOrDestroy: errorOrDestroy
  	};
  	return destroy_1;
  }

  var errorsBrowser = {};

  var hasRequiredErrorsBrowser;

  function requireErrorsBrowser () {
  	if (hasRequiredErrorsBrowser) return errorsBrowser;
  	hasRequiredErrorsBrowser = 1;

  	function _inheritsLoose(subClass, superClass) { subClass.prototype = Object.create(superClass.prototype); subClass.prototype.constructor = subClass; subClass.__proto__ = superClass; }

  	var codes = {};

  	function createErrorType(code, message, Base) {
  	  if (!Base) {
  	    Base = Error;
  	  }

  	  function getMessage(arg1, arg2, arg3) {
  	    if (typeof message === 'string') {
  	      return message;
  	    } else {
  	      return message(arg1, arg2, arg3);
  	    }
  	  }

  	  var NodeError =
  	  /*#__PURE__*/
  	  function (_Base) {
  	    _inheritsLoose(NodeError, _Base);

  	    function NodeError(arg1, arg2, arg3) {
  	      return _Base.call(this, getMessage(arg1, arg2, arg3)) || this;
  	    }

  	    return NodeError;
  	  }(Base);

  	  NodeError.prototype.name = Base.name;
  	  NodeError.prototype.code = code;
  	  codes[code] = NodeError;
  	} // https://github.com/nodejs/node/blob/v10.8.0/lib/internal/errors.js


  	function oneOf(expected, thing) {
  	  if (Array.isArray(expected)) {
  	    var len = expected.length;
  	    expected = expected.map(function (i) {
  	      return String(i);
  	    });

  	    if (len > 2) {
  	      return "one of ".concat(thing, " ").concat(expected.slice(0, len - 1).join(', '), ", or ") + expected[len - 1];
  	    } else if (len === 2) {
  	      return "one of ".concat(thing, " ").concat(expected[0], " or ").concat(expected[1]);
  	    } else {
  	      return "of ".concat(thing, " ").concat(expected[0]);
  	    }
  	  } else {
  	    return "of ".concat(thing, " ").concat(String(expected));
  	  }
  	} // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/startsWith


  	function startsWith(str, search, pos) {
  	  return str.substr(!pos || pos < 0 ? 0 : +pos, search.length) === search;
  	} // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/endsWith


  	function endsWith(str, search, this_len) {
  	  if (this_len === undefined || this_len > str.length) {
  	    this_len = str.length;
  	  }

  	  return str.substring(this_len - search.length, this_len) === search;
  	} // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/includes


  	function includes(str, search, start) {
  	  if (typeof start !== 'number') {
  	    start = 0;
  	  }

  	  if (start + search.length > str.length) {
  	    return false;
  	  } else {
  	    return str.indexOf(search, start) !== -1;
  	  }
  	}

  	createErrorType('ERR_INVALID_OPT_VALUE', function (name, value) {
  	  return 'The value "' + value + '" is invalid for option "' + name + '"';
  	}, TypeError);
  	createErrorType('ERR_INVALID_ARG_TYPE', function (name, expected, actual) {
  	  // determiner: 'must be' or 'must not be'
  	  var determiner;

  	  if (typeof expected === 'string' && startsWith(expected, 'not ')) {
  	    determiner = 'must not be';
  	    expected = expected.replace(/^not /, '');
  	  } else {
  	    determiner = 'must be';
  	  }

  	  var msg;

  	  if (endsWith(name, ' argument')) {
  	    // For cases like 'first argument'
  	    msg = "The ".concat(name, " ").concat(determiner, " ").concat(oneOf(expected, 'type'));
  	  } else {
  	    var type = includes(name, '.') ? 'property' : 'argument';
  	    msg = "The \"".concat(name, "\" ").concat(type, " ").concat(determiner, " ").concat(oneOf(expected, 'type'));
  	  }

  	  msg += ". Received type ".concat(typeof actual);
  	  return msg;
  	}, TypeError);
  	createErrorType('ERR_STREAM_PUSH_AFTER_EOF', 'stream.push() after EOF');
  	createErrorType('ERR_METHOD_NOT_IMPLEMENTED', function (name) {
  	  return 'The ' + name + ' method is not implemented';
  	});
  	createErrorType('ERR_STREAM_PREMATURE_CLOSE', 'Premature close');
  	createErrorType('ERR_STREAM_DESTROYED', function (name) {
  	  return 'Cannot call ' + name + ' after a stream was destroyed';
  	});
  	createErrorType('ERR_MULTIPLE_CALLBACK', 'Callback called multiple times');
  	createErrorType('ERR_STREAM_CANNOT_PIPE', 'Cannot pipe, not readable');
  	createErrorType('ERR_STREAM_WRITE_AFTER_END', 'write after end');
  	createErrorType('ERR_STREAM_NULL_VALUES', 'May not write null values to stream', TypeError);
  	createErrorType('ERR_UNKNOWN_ENCODING', function (arg) {
  	  return 'Unknown encoding: ' + arg;
  	}, TypeError);
  	createErrorType('ERR_STREAM_UNSHIFT_AFTER_END_EVENT', 'stream.unshift() after end event');
  	errorsBrowser.codes = codes;
  	return errorsBrowser;
  }

  var state;
  var hasRequiredState;

  function requireState () {
  	if (hasRequiredState) return state;
  	hasRequiredState = 1;

  	var ERR_INVALID_OPT_VALUE = requireErrorsBrowser().codes.ERR_INVALID_OPT_VALUE;
  	function highWaterMarkFrom(options, isDuplex, duplexKey) {
  	  return options.highWaterMark != null ? options.highWaterMark : isDuplex ? options[duplexKey] : null;
  	}
  	function getHighWaterMark(state, options, duplexKey, isDuplex) {
  	  var hwm = highWaterMarkFrom(options, isDuplex, duplexKey);
  	  if (hwm != null) {
  	    if (!(isFinite(hwm) && Math.floor(hwm) === hwm) || hwm < 0) {
  	      var name = isDuplex ? duplexKey : 'highWaterMark';
  	      throw new ERR_INVALID_OPT_VALUE(name, hwm);
  	    }
  	    return Math.floor(hwm);
  	  }

  	  // Default value
  	  return state.objectMode ? 16 : 16 * 1024;
  	}
  	state = {
  	  getHighWaterMark: getHighWaterMark
  	};
  	return state;
  }

  var browser$4;
  var hasRequiredBrowser;

  function requireBrowser () {
  	if (hasRequiredBrowser) return browser$4;
  	hasRequiredBrowser = 1;
  	/**
  	 * Module exports.
  	 */

  	browser$4 = deprecate;

  	/**
  	 * Mark that a method should not be used.
  	 * Returns a modified function which warns once by default.
  	 *
  	 * If `localStorage.noDeprecation = true` is set, then it is a no-op.
  	 *
  	 * If `localStorage.throwDeprecation = true` is set, then deprecated functions
  	 * will throw an Error when invoked.
  	 *
  	 * If `localStorage.traceDeprecation = true` is set, then deprecated functions
  	 * will invoke `console.trace()` instead of `console.error()`.
  	 *
  	 * @param {Function} fn - the function to deprecate
  	 * @param {String} msg - the string to print to the console when `fn` is invoked
  	 * @returns {Function} a new "deprecated" version of `fn`
  	 * @api public
  	 */

  	function deprecate (fn, msg) {
  	  if (config('noDeprecation')) {
  	    return fn;
  	  }

  	  var warned = false;
  	  function deprecated() {
  	    if (!warned) {
  	      if (config('throwDeprecation')) {
  	        throw new Error(msg);
  	      } else if (config('traceDeprecation')) {
  	        console.trace(msg);
  	      } else {
  	        console.warn(msg);
  	      }
  	      warned = true;
  	    }
  	    return fn.apply(this, arguments);
  	  }

  	  return deprecated;
  	}

  	/**
  	 * Checks `localStorage` for boolean values for the given `name`.
  	 *
  	 * @param {String} name
  	 * @returns {Boolean}
  	 * @api private
  	 */

  	function config (name) {
  	  // accessing global.localStorage can trigger a DOMException in sandboxed iframes
  	  try {
  	    if (!commonjsGlobal.localStorage) return false;
  	  } catch (_) {
  	    return false;
  	  }
  	  var val = commonjsGlobal.localStorage[name];
  	  if (null == val) return false;
  	  return String(val).toLowerCase() === 'true';
  	}
  	return browser$4;
  }

  var _stream_writable;
  var hasRequired_stream_writable;

  function require_stream_writable () {
  	if (hasRequired_stream_writable) return _stream_writable;
  	hasRequired_stream_writable = 1;

  	_stream_writable = Writable;

  	// It seems a linked list but it is not
  	// there will be only 2 of these for each stream
  	function CorkedRequest(state) {
  	  var _this = this;
  	  this.next = null;
  	  this.entry = null;
  	  this.finish = function () {
  	    onCorkedFinish(_this, state);
  	  };
  	}
  	/* </replacement> */

  	/*<replacement>*/
  	var Duplex;
  	/*</replacement>*/

  	Writable.WritableState = WritableState;

  	/*<replacement>*/
  	var internalUtil = {
  	  deprecate: requireBrowser()
  	};
  	/*</replacement>*/

  	/*<replacement>*/
  	var Stream = requireStreamBrowser();
  	/*</replacement>*/

  	var Buffer = require$$0$1.Buffer;
  	var OurUint8Array = (typeof commonjsGlobal !== 'undefined' ? commonjsGlobal : typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : {}).Uint8Array || function () {};
  	function _uint8ArrayToBuffer(chunk) {
  	  return Buffer.from(chunk);
  	}
  	function _isUint8Array(obj) {
  	  return Buffer.isBuffer(obj) || obj instanceof OurUint8Array;
  	}
  	var destroyImpl = requireDestroy();
  	var _require = requireState(),
  	  getHighWaterMark = _require.getHighWaterMark;
  	var _require$codes = requireErrorsBrowser().codes,
  	  ERR_INVALID_ARG_TYPE = _require$codes.ERR_INVALID_ARG_TYPE,
  	  ERR_METHOD_NOT_IMPLEMENTED = _require$codes.ERR_METHOD_NOT_IMPLEMENTED,
  	  ERR_MULTIPLE_CALLBACK = _require$codes.ERR_MULTIPLE_CALLBACK,
  	  ERR_STREAM_CANNOT_PIPE = _require$codes.ERR_STREAM_CANNOT_PIPE,
  	  ERR_STREAM_DESTROYED = _require$codes.ERR_STREAM_DESTROYED,
  	  ERR_STREAM_NULL_VALUES = _require$codes.ERR_STREAM_NULL_VALUES,
  	  ERR_STREAM_WRITE_AFTER_END = _require$codes.ERR_STREAM_WRITE_AFTER_END,
  	  ERR_UNKNOWN_ENCODING = _require$codes.ERR_UNKNOWN_ENCODING;
  	var errorOrDestroy = destroyImpl.errorOrDestroy;
  	inherits_browserExports(Writable, Stream);
  	function nop() {}
  	function WritableState(options, stream, isDuplex) {
  	  Duplex = Duplex || require_stream_duplex();
  	  options = options || {};

  	  // Duplex streams are both readable and writable, but share
  	  // the same options object.
  	  // However, some cases require setting options to different
  	  // values for the readable and the writable sides of the duplex stream,
  	  // e.g. options.readableObjectMode vs. options.writableObjectMode, etc.
  	  if (typeof isDuplex !== 'boolean') isDuplex = stream instanceof Duplex;

  	  // object stream flag to indicate whether or not this stream
  	  // contains buffers or objects.
  	  this.objectMode = !!options.objectMode;
  	  if (isDuplex) this.objectMode = this.objectMode || !!options.writableObjectMode;

  	  // the point at which write() starts returning false
  	  // Note: 0 is a valid value, means that we always return false if
  	  // the entire buffer is not flushed immediately on write()
  	  this.highWaterMark = getHighWaterMark(this, options, 'writableHighWaterMark', isDuplex);

  	  // if _final has been called
  	  this.finalCalled = false;

  	  // drain event flag.
  	  this.needDrain = false;
  	  // at the start of calling end()
  	  this.ending = false;
  	  // when end() has been called, and returned
  	  this.ended = false;
  	  // when 'finish' is emitted
  	  this.finished = false;

  	  // has it been destroyed
  	  this.destroyed = false;

  	  // should we decode strings into buffers before passing to _write?
  	  // this is here so that some node-core streams can optimize string
  	  // handling at a lower level.
  	  var noDecode = options.decodeStrings === false;
  	  this.decodeStrings = !noDecode;

  	  // Crypto is kind of old and crusty.  Historically, its default string
  	  // encoding is 'binary' so we have to make this configurable.
  	  // Everything else in the universe uses 'utf8', though.
  	  this.defaultEncoding = options.defaultEncoding || 'utf8';

  	  // not an actual buffer we keep track of, but a measurement
  	  // of how much we're waiting to get pushed to some underlying
  	  // socket or file.
  	  this.length = 0;

  	  // a flag to see when we're in the middle of a write.
  	  this.writing = false;

  	  // when true all writes will be buffered until .uncork() call
  	  this.corked = 0;

  	  // a flag to be able to tell if the onwrite cb is called immediately,
  	  // or on a later tick.  We set this to true at first, because any
  	  // actions that shouldn't happen until "later" should generally also
  	  // not happen before the first write call.
  	  this.sync = true;

  	  // a flag to know if we're processing previously buffered items, which
  	  // may call the _write() callback in the same tick, so that we don't
  	  // end up in an overlapped onwrite situation.
  	  this.bufferProcessing = false;

  	  // the callback that's passed to _write(chunk,cb)
  	  this.onwrite = function (er) {
  	    onwrite(stream, er);
  	  };

  	  // the callback that the user supplies to write(chunk,encoding,cb)
  	  this.writecb = null;

  	  // the amount that is being written when _write is called.
  	  this.writelen = 0;
  	  this.bufferedRequest = null;
  	  this.lastBufferedRequest = null;

  	  // number of pending user-supplied write callbacks
  	  // this must be 0 before 'finish' can be emitted
  	  this.pendingcb = 0;

  	  // emit prefinish if the only thing we're waiting for is _write cbs
  	  // This is relevant for synchronous Transform streams
  	  this.prefinished = false;

  	  // True if the error was already emitted and should not be thrown again
  	  this.errorEmitted = false;

  	  // Should close be emitted on destroy. Defaults to true.
  	  this.emitClose = options.emitClose !== false;

  	  // Should .destroy() be called after 'finish' (and potentially 'end')
  	  this.autoDestroy = !!options.autoDestroy;

  	  // count buffered requests
  	  this.bufferedRequestCount = 0;

  	  // allocate the first CorkedRequest, there is always
  	  // one allocated and free to use, and we maintain at most two
  	  this.corkedRequestsFree = new CorkedRequest(this);
  	}
  	WritableState.prototype.getBuffer = function getBuffer() {
  	  var current = this.bufferedRequest;
  	  var out = [];
  	  while (current) {
  	    out.push(current);
  	    current = current.next;
  	  }
  	  return out;
  	};
  	(function () {
  	  try {
  	    Object.defineProperty(WritableState.prototype, 'buffer', {
  	      get: internalUtil.deprecate(function writableStateBufferGetter() {
  	        return this.getBuffer();
  	      }, '_writableState.buffer is deprecated. Use _writableState.getBuffer ' + 'instead.', 'DEP0003')
  	    });
  	  } catch (_) {}
  	})();

  	// Test _writableState for inheritance to account for Duplex streams,
  	// whose prototype chain only points to Readable.
  	var realHasInstance;
  	if (typeof Symbol === 'function' && Symbol.hasInstance && typeof Function.prototype[Symbol.hasInstance] === 'function') {
  	  realHasInstance = Function.prototype[Symbol.hasInstance];
  	  Object.defineProperty(Writable, Symbol.hasInstance, {
  	    value: function value(object) {
  	      if (realHasInstance.call(this, object)) return true;
  	      if (this !== Writable) return false;
  	      return object && object._writableState instanceof WritableState;
  	    }
  	  });
  	} else {
  	  realHasInstance = function realHasInstance(object) {
  	    return object instanceof this;
  	  };
  	}
  	function Writable(options) {
  	  Duplex = Duplex || require_stream_duplex();

  	  // Writable ctor is applied to Duplexes, too.
  	  // `realHasInstance` is necessary because using plain `instanceof`
  	  // would return false, as no `_writableState` property is attached.

  	  // Trying to use the custom `instanceof` for Writable here will also break the
  	  // Node.js LazyTransform implementation, which has a non-trivial getter for
  	  // `_writableState` that would lead to infinite recursion.

  	  // Checking for a Stream.Duplex instance is faster here instead of inside
  	  // the WritableState constructor, at least with V8 6.5
  	  var isDuplex = this instanceof Duplex;
  	  if (!isDuplex && !realHasInstance.call(Writable, this)) return new Writable(options);
  	  this._writableState = new WritableState(options, this, isDuplex);

  	  // legacy.
  	  this.writable = true;
  	  if (options) {
  	    if (typeof options.write === 'function') this._write = options.write;
  	    if (typeof options.writev === 'function') this._writev = options.writev;
  	    if (typeof options.destroy === 'function') this._destroy = options.destroy;
  	    if (typeof options.final === 'function') this._final = options.final;
  	  }
  	  Stream.call(this);
  	}

  	// Otherwise people can pipe Writable streams, which is just wrong.
  	Writable.prototype.pipe = function () {
  	  errorOrDestroy(this, new ERR_STREAM_CANNOT_PIPE());
  	};
  	function writeAfterEnd(stream, cb) {
  	  var er = new ERR_STREAM_WRITE_AFTER_END();
  	  // TODO: defer error events consistently everywhere, not just the cb
  	  errorOrDestroy(stream, er);
  	  nextTick$1(cb, er);
  	}

  	// Checks that a user-supplied chunk is valid, especially for the particular
  	// mode the stream is in. Currently this means that `null` is never accepted
  	// and undefined/non-string values are only allowed in object mode.
  	function validChunk(stream, state, chunk, cb) {
  	  var er;
  	  if (chunk === null) {
  	    er = new ERR_STREAM_NULL_VALUES();
  	  } else if (typeof chunk !== 'string' && !state.objectMode) {
  	    er = new ERR_INVALID_ARG_TYPE('chunk', ['string', 'Buffer'], chunk);
  	  }
  	  if (er) {
  	    errorOrDestroy(stream, er);
  	    nextTick$1(cb, er);
  	    return false;
  	  }
  	  return true;
  	}
  	Writable.prototype.write = function (chunk, encoding, cb) {
  	  var state = this._writableState;
  	  var ret = false;
  	  var isBuf = !state.objectMode && _isUint8Array(chunk);
  	  if (isBuf && !Buffer.isBuffer(chunk)) {
  	    chunk = _uint8ArrayToBuffer(chunk);
  	  }
  	  if (typeof encoding === 'function') {
  	    cb = encoding;
  	    encoding = null;
  	  }
  	  if (isBuf) encoding = 'buffer';else if (!encoding) encoding = state.defaultEncoding;
  	  if (typeof cb !== 'function') cb = nop;
  	  if (state.ending) writeAfterEnd(this, cb);else if (isBuf || validChunk(this, state, chunk, cb)) {
  	    state.pendingcb++;
  	    ret = writeOrBuffer(this, state, isBuf, chunk, encoding, cb);
  	  }
  	  return ret;
  	};
  	Writable.prototype.cork = function () {
  	  this._writableState.corked++;
  	};
  	Writable.prototype.uncork = function () {
  	  var state = this._writableState;
  	  if (state.corked) {
  	    state.corked--;
  	    if (!state.writing && !state.corked && !state.bufferProcessing && state.bufferedRequest) clearBuffer(this, state);
  	  }
  	};
  	Writable.prototype.setDefaultEncoding = function setDefaultEncoding(encoding) {
  	  // node::ParseEncoding() requires lower case.
  	  if (typeof encoding === 'string') encoding = encoding.toLowerCase();
  	  if (!(['hex', 'utf8', 'utf-8', 'ascii', 'binary', 'base64', 'ucs2', 'ucs-2', 'utf16le', 'utf-16le', 'raw'].indexOf((encoding + '').toLowerCase()) > -1)) throw new ERR_UNKNOWN_ENCODING(encoding);
  	  this._writableState.defaultEncoding = encoding;
  	  return this;
  	};
  	Object.defineProperty(Writable.prototype, 'writableBuffer', {
  	  // making it explicit this property is not enumerable
  	  // because otherwise some prototype manipulation in
  	  // userland will fail
  	  enumerable: false,
  	  get: function get() {
  	    return this._writableState && this._writableState.getBuffer();
  	  }
  	});
  	function decodeChunk(state, chunk, encoding) {
  	  if (!state.objectMode && state.decodeStrings !== false && typeof chunk === 'string') {
  	    chunk = Buffer.from(chunk, encoding);
  	  }
  	  return chunk;
  	}
  	Object.defineProperty(Writable.prototype, 'writableHighWaterMark', {
  	  // making it explicit this property is not enumerable
  	  // because otherwise some prototype manipulation in
  	  // userland will fail
  	  enumerable: false,
  	  get: function get() {
  	    return this._writableState.highWaterMark;
  	  }
  	});

  	// if we're already writing something, then just put this
  	// in the queue, and wait our turn.  Otherwise, call _write
  	// If we return false, then we need a drain event, so set that flag.
  	function writeOrBuffer(stream, state, isBuf, chunk, encoding, cb) {
  	  if (!isBuf) {
  	    var newChunk = decodeChunk(state, chunk, encoding);
  	    if (chunk !== newChunk) {
  	      isBuf = true;
  	      encoding = 'buffer';
  	      chunk = newChunk;
  	    }
  	  }
  	  var len = state.objectMode ? 1 : chunk.length;
  	  state.length += len;
  	  var ret = state.length < state.highWaterMark;
  	  // we must ensure that previous needDrain will not be reset to false.
  	  if (!ret) state.needDrain = true;
  	  if (state.writing || state.corked) {
  	    var last = state.lastBufferedRequest;
  	    state.lastBufferedRequest = {
  	      chunk: chunk,
  	      encoding: encoding,
  	      isBuf: isBuf,
  	      callback: cb,
  	      next: null
  	    };
  	    if (last) {
  	      last.next = state.lastBufferedRequest;
  	    } else {
  	      state.bufferedRequest = state.lastBufferedRequest;
  	    }
  	    state.bufferedRequestCount += 1;
  	  } else {
  	    doWrite(stream, state, false, len, chunk, encoding, cb);
  	  }
  	  return ret;
  	}
  	function doWrite(stream, state, writev, len, chunk, encoding, cb) {
  	  state.writelen = len;
  	  state.writecb = cb;
  	  state.writing = true;
  	  state.sync = true;
  	  if (state.destroyed) state.onwrite(new ERR_STREAM_DESTROYED('write'));else if (writev) stream._writev(chunk, state.onwrite);else stream._write(chunk, encoding, state.onwrite);
  	  state.sync = false;
  	}
  	function onwriteError(stream, state, sync, er, cb) {
  	  --state.pendingcb;
  	  if (sync) {
  	    // defer the callback if we are being called synchronously
  	    // to avoid piling up things on the stack
  	    nextTick$1(cb, er);
  	    // this can emit finish, and it will always happen
  	    // after error
  	    nextTick$1(finishMaybe, stream, state);
  	    stream._writableState.errorEmitted = true;
  	    errorOrDestroy(stream, er);
  	  } else {
  	    // the caller expect this to happen before if
  	    // it is async
  	    cb(er);
  	    stream._writableState.errorEmitted = true;
  	    errorOrDestroy(stream, er);
  	    // this can emit finish, but finish must
  	    // always follow error
  	    finishMaybe(stream, state);
  	  }
  	}
  	function onwriteStateUpdate(state) {
  	  state.writing = false;
  	  state.writecb = null;
  	  state.length -= state.writelen;
  	  state.writelen = 0;
  	}
  	function onwrite(stream, er) {
  	  var state = stream._writableState;
  	  var sync = state.sync;
  	  var cb = state.writecb;
  	  if (typeof cb !== 'function') throw new ERR_MULTIPLE_CALLBACK();
  	  onwriteStateUpdate(state);
  	  if (er) onwriteError(stream, state, sync, er, cb);else {
  	    // Check if we're actually ready to finish, but don't emit yet
  	    var finished = needFinish(state) || stream.destroyed;
  	    if (!finished && !state.corked && !state.bufferProcessing && state.bufferedRequest) {
  	      clearBuffer(stream, state);
  	    }
  	    if (sync) {
  	      nextTick$1(afterWrite, stream, state, finished, cb);
  	    } else {
  	      afterWrite(stream, state, finished, cb);
  	    }
  	  }
  	}
  	function afterWrite(stream, state, finished, cb) {
  	  if (!finished) onwriteDrain(stream, state);
  	  state.pendingcb--;
  	  cb();
  	  finishMaybe(stream, state);
  	}

  	// Must force callback to be called on nextTick, so that we don't
  	// emit 'drain' before the write() consumer gets the 'false' return
  	// value, and has a chance to attach a 'drain' listener.
  	function onwriteDrain(stream, state) {
  	  if (state.length === 0 && state.needDrain) {
  	    state.needDrain = false;
  	    stream.emit('drain');
  	  }
  	}

  	// if there's something in the buffer waiting, then process it
  	function clearBuffer(stream, state) {
  	  state.bufferProcessing = true;
  	  var entry = state.bufferedRequest;
  	  if (stream._writev && entry && entry.next) {
  	    // Fast case, write everything using _writev()
  	    var l = state.bufferedRequestCount;
  	    var buffer = new Array(l);
  	    var holder = state.corkedRequestsFree;
  	    holder.entry = entry;
  	    var count = 0;
  	    var allBuffers = true;
  	    while (entry) {
  	      buffer[count] = entry;
  	      if (!entry.isBuf) allBuffers = false;
  	      entry = entry.next;
  	      count += 1;
  	    }
  	    buffer.allBuffers = allBuffers;
  	    doWrite(stream, state, true, state.length, buffer, '', holder.finish);

  	    // doWrite is almost always async, defer these to save a bit of time
  	    // as the hot path ends with doWrite
  	    state.pendingcb++;
  	    state.lastBufferedRequest = null;
  	    if (holder.next) {
  	      state.corkedRequestsFree = holder.next;
  	      holder.next = null;
  	    } else {
  	      state.corkedRequestsFree = new CorkedRequest(state);
  	    }
  	    state.bufferedRequestCount = 0;
  	  } else {
  	    // Slow case, write chunks one-by-one
  	    while (entry) {
  	      var chunk = entry.chunk;
  	      var encoding = entry.encoding;
  	      var cb = entry.callback;
  	      var len = state.objectMode ? 1 : chunk.length;
  	      doWrite(stream, state, false, len, chunk, encoding, cb);
  	      entry = entry.next;
  	      state.bufferedRequestCount--;
  	      // if we didn't call the onwrite immediately, then
  	      // it means that we need to wait until it does.
  	      // also, that means that the chunk and cb are currently
  	      // being processed, so move the buffer counter past them.
  	      if (state.writing) {
  	        break;
  	      }
  	    }
  	    if (entry === null) state.lastBufferedRequest = null;
  	  }
  	  state.bufferedRequest = entry;
  	  state.bufferProcessing = false;
  	}
  	Writable.prototype._write = function (chunk, encoding, cb) {
  	  cb(new ERR_METHOD_NOT_IMPLEMENTED('_write()'));
  	};
  	Writable.prototype._writev = null;
  	Writable.prototype.end = function (chunk, encoding, cb) {
  	  var state = this._writableState;
  	  if (typeof chunk === 'function') {
  	    cb = chunk;
  	    chunk = null;
  	    encoding = null;
  	  } else if (typeof encoding === 'function') {
  	    cb = encoding;
  	    encoding = null;
  	  }
  	  if (chunk !== null && chunk !== undefined) this.write(chunk, encoding);

  	  // .end() fully uncorks
  	  if (state.corked) {
  	    state.corked = 1;
  	    this.uncork();
  	  }

  	  // ignore unnecessary end() calls.
  	  if (!state.ending) endWritable(this, state, cb);
  	  return this;
  	};
  	Object.defineProperty(Writable.prototype, 'writableLength', {
  	  // making it explicit this property is not enumerable
  	  // because otherwise some prototype manipulation in
  	  // userland will fail
  	  enumerable: false,
  	  get: function get() {
  	    return this._writableState.length;
  	  }
  	});
  	function needFinish(state) {
  	  return state.ending && state.length === 0 && state.bufferedRequest === null && !state.finished && !state.writing;
  	}
  	function callFinal(stream, state) {
  	  stream._final(function (err) {
  	    state.pendingcb--;
  	    if (err) {
  	      errorOrDestroy(stream, err);
  	    }
  	    state.prefinished = true;
  	    stream.emit('prefinish');
  	    finishMaybe(stream, state);
  	  });
  	}
  	function prefinish(stream, state) {
  	  if (!state.prefinished && !state.finalCalled) {
  	    if (typeof stream._final === 'function' && !state.destroyed) {
  	      state.pendingcb++;
  	      state.finalCalled = true;
  	      nextTick$1(callFinal, stream, state);
  	    } else {
  	      state.prefinished = true;
  	      stream.emit('prefinish');
  	    }
  	  }
  	}
  	function finishMaybe(stream, state) {
  	  var need = needFinish(state);
  	  if (need) {
  	    prefinish(stream, state);
  	    if (state.pendingcb === 0) {
  	      state.finished = true;
  	      stream.emit('finish');
  	      if (state.autoDestroy) {
  	        // In case of duplex streams we need a way to detect
  	        // if the readable side is ready for autoDestroy as well
  	        var rState = stream._readableState;
  	        if (!rState || rState.autoDestroy && rState.endEmitted) {
  	          stream.destroy();
  	        }
  	      }
  	    }
  	  }
  	  return need;
  	}
  	function endWritable(stream, state, cb) {
  	  state.ending = true;
  	  finishMaybe(stream, state);
  	  if (cb) {
  	    if (state.finished) nextTick$1(cb);else stream.once('finish', cb);
  	  }
  	  state.ended = true;
  	  stream.writable = false;
  	}
  	function onCorkedFinish(corkReq, state, err) {
  	  var entry = corkReq.entry;
  	  corkReq.entry = null;
  	  while (entry) {
  	    var cb = entry.callback;
  	    state.pendingcb--;
  	    cb(err);
  	    entry = entry.next;
  	  }

  	  // reuse the free corkReq.
  	  state.corkedRequestsFree.next = corkReq;
  	}
  	Object.defineProperty(Writable.prototype, 'destroyed', {
  	  // making it explicit this property is not enumerable
  	  // because otherwise some prototype manipulation in
  	  // userland will fail
  	  enumerable: false,
  	  get: function get() {
  	    if (this._writableState === undefined) {
  	      return false;
  	    }
  	    return this._writableState.destroyed;
  	  },
  	  set: function set(value) {
  	    // we ignore the value if the stream
  	    // has not been initialized yet
  	    if (!this._writableState) {
  	      return;
  	    }

  	    // backward compatibility, the user is explicitly
  	    // managing destroyed
  	    this._writableState.destroyed = value;
  	  }
  	});
  	Writable.prototype.destroy = destroyImpl.destroy;
  	Writable.prototype._undestroy = destroyImpl.undestroy;
  	Writable.prototype._destroy = function (err, cb) {
  	  cb(err);
  	};
  	return _stream_writable;
  }

  var _stream_duplex;
  var hasRequired_stream_duplex;

  function require_stream_duplex () {
  	if (hasRequired_stream_duplex) return _stream_duplex;
  	hasRequired_stream_duplex = 1;

  	/*<replacement>*/
  	var objectKeys = Object.keys || function (obj) {
  	  var keys = [];
  	  for (var key in obj) keys.push(key);
  	  return keys;
  	};
  	/*</replacement>*/

  	_stream_duplex = Duplex;
  	var Readable = require_stream_readable();
  	var Writable = require_stream_writable();
  	inherits_browserExports(Duplex, Readable);
  	{
  	  // Allow the keys array to be GC'ed.
  	  var keys = objectKeys(Writable.prototype);
  	  for (var v = 0; v < keys.length; v++) {
  	    var method = keys[v];
  	    if (!Duplex.prototype[method]) Duplex.prototype[method] = Writable.prototype[method];
  	  }
  	}
  	function Duplex(options) {
  	  if (!(this instanceof Duplex)) return new Duplex(options);
  	  Readable.call(this, options);
  	  Writable.call(this, options);
  	  this.allowHalfOpen = true;
  	  if (options) {
  	    if (options.readable === false) this.readable = false;
  	    if (options.writable === false) this.writable = false;
  	    if (options.allowHalfOpen === false) {
  	      this.allowHalfOpen = false;
  	      this.once('end', onend);
  	    }
  	  }
  	}
  	Object.defineProperty(Duplex.prototype, 'writableHighWaterMark', {
  	  // making it explicit this property is not enumerable
  	  // because otherwise some prototype manipulation in
  	  // userland will fail
  	  enumerable: false,
  	  get: function get() {
  	    return this._writableState.highWaterMark;
  	  }
  	});
  	Object.defineProperty(Duplex.prototype, 'writableBuffer', {
  	  // making it explicit this property is not enumerable
  	  // because otherwise some prototype manipulation in
  	  // userland will fail
  	  enumerable: false,
  	  get: function get() {
  	    return this._writableState && this._writableState.getBuffer();
  	  }
  	});
  	Object.defineProperty(Duplex.prototype, 'writableLength', {
  	  // making it explicit this property is not enumerable
  	  // because otherwise some prototype manipulation in
  	  // userland will fail
  	  enumerable: false,
  	  get: function get() {
  	    return this._writableState.length;
  	  }
  	});

  	// the no-half-open enforcer
  	function onend() {
  	  // If the writable side ended, then we're ok.
  	  if (this._writableState.ended) return;

  	  // no more data can be written.
  	  // But allow more writes to happen in this tick.
  	  nextTick$1(onEndNT, this);
  	}
  	function onEndNT(self) {
  	  self.end();
  	}
  	Object.defineProperty(Duplex.prototype, 'destroyed', {
  	  // making it explicit this property is not enumerable
  	  // because otherwise some prototype manipulation in
  	  // userland will fail
  	  enumerable: false,
  	  get: function get() {
  	    if (this._readableState === undefined || this._writableState === undefined) {
  	      return false;
  	    }
  	    return this._readableState.destroyed && this._writableState.destroyed;
  	  },
  	  set: function set(value) {
  	    // we ignore the value if the stream
  	    // has not been initialized yet
  	    if (this._readableState === undefined || this._writableState === undefined) {
  	      return;
  	    }

  	    // backward compatibility, the user is explicitly
  	    // managing destroyed
  	    this._readableState.destroyed = value;
  	    this._writableState.destroyed = value;
  	  }
  	});
  	return _stream_duplex;
  }

  var string_decoder = {};

  var hasRequiredString_decoder;

  function requireString_decoder () {
  	if (hasRequiredString_decoder) return string_decoder;
  	hasRequiredString_decoder = 1;

  	/*<replacement>*/

  	var Buffer = safeBufferExports.Buffer;
  	/*</replacement>*/

  	var isEncoding = Buffer.isEncoding || function (encoding) {
  	  encoding = '' + encoding;
  	  switch (encoding && encoding.toLowerCase()) {
  	    case 'hex':case 'utf8':case 'utf-8':case 'ascii':case 'binary':case 'base64':case 'ucs2':case 'ucs-2':case 'utf16le':case 'utf-16le':case 'raw':
  	      return true;
  	    default:
  	      return false;
  	  }
  	};

  	function _normalizeEncoding(enc) {
  	  if (!enc) return 'utf8';
  	  var retried;
  	  while (true) {
  	    switch (enc) {
  	      case 'utf8':
  	      case 'utf-8':
  	        return 'utf8';
  	      case 'ucs2':
  	      case 'ucs-2':
  	      case 'utf16le':
  	      case 'utf-16le':
  	        return 'utf16le';
  	      case 'latin1':
  	      case 'binary':
  	        return 'latin1';
  	      case 'base64':
  	      case 'ascii':
  	      case 'hex':
  	        return enc;
  	      default:
  	        if (retried) return; // undefined
  	        enc = ('' + enc).toLowerCase();
  	        retried = true;
  	    }
  	  }
  	}
  	// Do not cache `Buffer.isEncoding` when checking encoding names as some
  	// modules monkey-patch it to support additional encodings
  	function normalizeEncoding(enc) {
  	  var nenc = _normalizeEncoding(enc);
  	  if (typeof nenc !== 'string' && (Buffer.isEncoding === isEncoding || !isEncoding(enc))) throw new Error('Unknown encoding: ' + enc);
  	  return nenc || enc;
  	}

  	// StringDecoder provides an interface for efficiently splitting a series of
  	// buffers into a series of JS strings without breaking apart multi-byte
  	// characters.
  	string_decoder.StringDecoder = StringDecoder;
  	function StringDecoder(encoding) {
  	  this.encoding = normalizeEncoding(encoding);
  	  var nb;
  	  switch (this.encoding) {
  	    case 'utf16le':
  	      this.text = utf16Text;
  	      this.end = utf16End;
  	      nb = 4;
  	      break;
  	    case 'utf8':
  	      this.fillLast = utf8FillLast;
  	      nb = 4;
  	      break;
  	    case 'base64':
  	      this.text = base64Text;
  	      this.end = base64End;
  	      nb = 3;
  	      break;
  	    default:
  	      this.write = simpleWrite;
  	      this.end = simpleEnd;
  	      return;
  	  }
  	  this.lastNeed = 0;
  	  this.lastTotal = 0;
  	  this.lastChar = Buffer.allocUnsafe(nb);
  	}

  	StringDecoder.prototype.write = function (buf) {
  	  if (buf.length === 0) return '';
  	  var r;
  	  var i;
  	  if (this.lastNeed) {
  	    r = this.fillLast(buf);
  	    if (r === undefined) return '';
  	    i = this.lastNeed;
  	    this.lastNeed = 0;
  	  } else {
  	    i = 0;
  	  }
  	  if (i < buf.length) return r ? r + this.text(buf, i) : this.text(buf, i);
  	  return r || '';
  	};

  	StringDecoder.prototype.end = utf8End;

  	// Returns only complete characters in a Buffer
  	StringDecoder.prototype.text = utf8Text;

  	// Attempts to complete a partial non-UTF-8 character using bytes from a Buffer
  	StringDecoder.prototype.fillLast = function (buf) {
  	  if (this.lastNeed <= buf.length) {
  	    buf.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, this.lastNeed);
  	    return this.lastChar.toString(this.encoding, 0, this.lastTotal);
  	  }
  	  buf.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, buf.length);
  	  this.lastNeed -= buf.length;
  	};

  	// Checks the type of a UTF-8 byte, whether it's ASCII, a leading byte, or a
  	// continuation byte. If an invalid byte is detected, -2 is returned.
  	function utf8CheckByte(byte) {
  	  if (byte <= 0x7F) return 0;else if (byte >> 5 === 0x06) return 2;else if (byte >> 4 === 0x0E) return 3;else if (byte >> 3 === 0x1E) return 4;
  	  return byte >> 6 === 0x02 ? -1 : -2;
  	}

  	// Checks at most 3 bytes at the end of a Buffer in order to detect an
  	// incomplete multi-byte UTF-8 character. The total number of bytes (2, 3, or 4)
  	// needed to complete the UTF-8 character (if applicable) are returned.
  	function utf8CheckIncomplete(self, buf, i) {
  	  var j = buf.length - 1;
  	  if (j < i) return 0;
  	  var nb = utf8CheckByte(buf[j]);
  	  if (nb >= 0) {
  	    if (nb > 0) self.lastNeed = nb - 1;
  	    return nb;
  	  }
  	  if (--j < i || nb === -2) return 0;
  	  nb = utf8CheckByte(buf[j]);
  	  if (nb >= 0) {
  	    if (nb > 0) self.lastNeed = nb - 2;
  	    return nb;
  	  }
  	  if (--j < i || nb === -2) return 0;
  	  nb = utf8CheckByte(buf[j]);
  	  if (nb >= 0) {
  	    if (nb > 0) {
  	      if (nb === 2) nb = 0;else self.lastNeed = nb - 3;
  	    }
  	    return nb;
  	  }
  	  return 0;
  	}

  	// Validates as many continuation bytes for a multi-byte UTF-8 character as
  	// needed or are available. If we see a non-continuation byte where we expect
  	// one, we "replace" the validated continuation bytes we've seen so far with
  	// a single UTF-8 replacement character ('\ufffd'), to match v8's UTF-8 decoding
  	// behavior. The continuation byte check is included three times in the case
  	// where all of the continuation bytes for a character exist in the same buffer.
  	// It is also done this way as a slight performance increase instead of using a
  	// loop.
  	function utf8CheckExtraBytes(self, buf, p) {
  	  if ((buf[0] & 0xC0) !== 0x80) {
  	    self.lastNeed = 0;
  	    return '\ufffd';
  	  }
  	  if (self.lastNeed > 1 && buf.length > 1) {
  	    if ((buf[1] & 0xC0) !== 0x80) {
  	      self.lastNeed = 1;
  	      return '\ufffd';
  	    }
  	    if (self.lastNeed > 2 && buf.length > 2) {
  	      if ((buf[2] & 0xC0) !== 0x80) {
  	        self.lastNeed = 2;
  	        return '\ufffd';
  	      }
  	    }
  	  }
  	}

  	// Attempts to complete a multi-byte UTF-8 character using bytes from a Buffer.
  	function utf8FillLast(buf) {
  	  var p = this.lastTotal - this.lastNeed;
  	  var r = utf8CheckExtraBytes(this, buf);
  	  if (r !== undefined) return r;
  	  if (this.lastNeed <= buf.length) {
  	    buf.copy(this.lastChar, p, 0, this.lastNeed);
  	    return this.lastChar.toString(this.encoding, 0, this.lastTotal);
  	  }
  	  buf.copy(this.lastChar, p, 0, buf.length);
  	  this.lastNeed -= buf.length;
  	}

  	// Returns all complete UTF-8 characters in a Buffer. If the Buffer ended on a
  	// partial character, the character's bytes are buffered until the required
  	// number of bytes are available.
  	function utf8Text(buf, i) {
  	  var total = utf8CheckIncomplete(this, buf, i);
  	  if (!this.lastNeed) return buf.toString('utf8', i);
  	  this.lastTotal = total;
  	  var end = buf.length - (total - this.lastNeed);
  	  buf.copy(this.lastChar, 0, end);
  	  return buf.toString('utf8', i, end);
  	}

  	// For UTF-8, a replacement character is added when ending on a partial
  	// character.
  	function utf8End(buf) {
  	  var r = buf && buf.length ? this.write(buf) : '';
  	  if (this.lastNeed) return r + '\ufffd';
  	  return r;
  	}

  	// UTF-16LE typically needs two bytes per character, but even if we have an even
  	// number of bytes available, we need to check if we end on a leading/high
  	// surrogate. In that case, we need to wait for the next two bytes in order to
  	// decode the last character properly.
  	function utf16Text(buf, i) {
  	  if ((buf.length - i) % 2 === 0) {
  	    var r = buf.toString('utf16le', i);
  	    if (r) {
  	      var c = r.charCodeAt(r.length - 1);
  	      if (c >= 0xD800 && c <= 0xDBFF) {
  	        this.lastNeed = 2;
  	        this.lastTotal = 4;
  	        this.lastChar[0] = buf[buf.length - 2];
  	        this.lastChar[1] = buf[buf.length - 1];
  	        return r.slice(0, -1);
  	      }
  	    }
  	    return r;
  	  }
  	  this.lastNeed = 1;
  	  this.lastTotal = 2;
  	  this.lastChar[0] = buf[buf.length - 1];
  	  return buf.toString('utf16le', i, buf.length - 1);
  	}

  	// For UTF-16LE we do not explicitly append special replacement characters if we
  	// end on a partial character, we simply let v8 handle that.
  	function utf16End(buf) {
  	  var r = buf && buf.length ? this.write(buf) : '';
  	  if (this.lastNeed) {
  	    var end = this.lastTotal - this.lastNeed;
  	    return r + this.lastChar.toString('utf16le', 0, end);
  	  }
  	  return r;
  	}

  	function base64Text(buf, i) {
  	  var n = (buf.length - i) % 3;
  	  if (n === 0) return buf.toString('base64', i);
  	  this.lastNeed = 3 - n;
  	  this.lastTotal = 3;
  	  if (n === 1) {
  	    this.lastChar[0] = buf[buf.length - 1];
  	  } else {
  	    this.lastChar[0] = buf[buf.length - 2];
  	    this.lastChar[1] = buf[buf.length - 1];
  	  }
  	  return buf.toString('base64', i, buf.length - n);
  	}

  	function base64End(buf) {
  	  var r = buf && buf.length ? this.write(buf) : '';
  	  if (this.lastNeed) return r + this.lastChar.toString('base64', 0, 3 - this.lastNeed);
  	  return r;
  	}

  	// Pass bytes on through for single-byte encodings (e.g. ascii, latin1, hex)
  	function simpleWrite(buf) {
  	  return buf.toString(this.encoding);
  	}

  	function simpleEnd(buf) {
  	  return buf && buf.length ? this.write(buf) : '';
  	}
  	return string_decoder;
  }

  var endOfStream;
  var hasRequiredEndOfStream;

  function requireEndOfStream () {
  	if (hasRequiredEndOfStream) return endOfStream;
  	hasRequiredEndOfStream = 1;

  	var ERR_STREAM_PREMATURE_CLOSE = requireErrorsBrowser().codes.ERR_STREAM_PREMATURE_CLOSE;
  	function once(callback) {
  	  var called = false;
  	  return function () {
  	    if (called) return;
  	    called = true;
  	    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
  	      args[_key] = arguments[_key];
  	    }
  	    callback.apply(this, args);
  	  };
  	}
  	function noop() {}
  	function isRequest(stream) {
  	  return stream.setHeader && typeof stream.abort === 'function';
  	}
  	function eos(stream, opts, callback) {
  	  if (typeof opts === 'function') return eos(stream, null, opts);
  	  if (!opts) opts = {};
  	  callback = once(callback || noop);
  	  var readable = opts.readable || opts.readable !== false && stream.readable;
  	  var writable = opts.writable || opts.writable !== false && stream.writable;
  	  var onlegacyfinish = function onlegacyfinish() {
  	    if (!stream.writable) onfinish();
  	  };
  	  var writableEnded = stream._writableState && stream._writableState.finished;
  	  var onfinish = function onfinish() {
  	    writable = false;
  	    writableEnded = true;
  	    if (!readable) callback.call(stream);
  	  };
  	  var readableEnded = stream._readableState && stream._readableState.endEmitted;
  	  var onend = function onend() {
  	    readable = false;
  	    readableEnded = true;
  	    if (!writable) callback.call(stream);
  	  };
  	  var onerror = function onerror(err) {
  	    callback.call(stream, err);
  	  };
  	  var onclose = function onclose() {
  	    var err;
  	    if (readable && !readableEnded) {
  	      if (!stream._readableState || !stream._readableState.ended) err = new ERR_STREAM_PREMATURE_CLOSE();
  	      return callback.call(stream, err);
  	    }
  	    if (writable && !writableEnded) {
  	      if (!stream._writableState || !stream._writableState.ended) err = new ERR_STREAM_PREMATURE_CLOSE();
  	      return callback.call(stream, err);
  	    }
  	  };
  	  var onrequest = function onrequest() {
  	    stream.req.on('finish', onfinish);
  	  };
  	  if (isRequest(stream)) {
  	    stream.on('complete', onfinish);
  	    stream.on('abort', onclose);
  	    if (stream.req) onrequest();else stream.on('request', onrequest);
  	  } else if (writable && !stream._writableState) {
  	    // legacy streams
  	    stream.on('end', onlegacyfinish);
  	    stream.on('close', onlegacyfinish);
  	  }
  	  stream.on('end', onend);
  	  stream.on('finish', onfinish);
  	  if (opts.error !== false) stream.on('error', onerror);
  	  stream.on('close', onclose);
  	  return function () {
  	    stream.removeListener('complete', onfinish);
  	    stream.removeListener('abort', onclose);
  	    stream.removeListener('request', onrequest);
  	    if (stream.req) stream.req.removeListener('finish', onfinish);
  	    stream.removeListener('end', onlegacyfinish);
  	    stream.removeListener('close', onlegacyfinish);
  	    stream.removeListener('finish', onfinish);
  	    stream.removeListener('end', onend);
  	    stream.removeListener('error', onerror);
  	    stream.removeListener('close', onclose);
  	  };
  	}
  	endOfStream = eos;
  	return endOfStream;
  }

  var async_iterator;
  var hasRequiredAsync_iterator;

  function requireAsync_iterator () {
  	if (hasRequiredAsync_iterator) return async_iterator;
  	hasRequiredAsync_iterator = 1;

  	var _Object$setPrototypeO;
  	function _defineProperty(obj, key, value) { key = _toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
  	function _toPropertyKey(arg) { var key = _toPrimitive(arg, "string"); return typeof key === "symbol" ? key : String(key); }
  	function _toPrimitive(input, hint) { if (typeof input !== "object" || input === null) return input; var prim = input[Symbol.toPrimitive]; if (prim !== undefined) { var res = prim.call(input, hint || "default"); if (typeof res !== "object") return res; throw new TypeError("@@toPrimitive must return a primitive value."); } return (hint === "string" ? String : Number)(input); }
  	var finished = requireEndOfStream();
  	var kLastResolve = Symbol('lastResolve');
  	var kLastReject = Symbol('lastReject');
  	var kError = Symbol('error');
  	var kEnded = Symbol('ended');
  	var kLastPromise = Symbol('lastPromise');
  	var kHandlePromise = Symbol('handlePromise');
  	var kStream = Symbol('stream');
  	function createIterResult(value, done) {
  	  return {
  	    value: value,
  	    done: done
  	  };
  	}
  	function readAndResolve(iter) {
  	  var resolve = iter[kLastResolve];
  	  if (resolve !== null) {
  	    var data = iter[kStream].read();
  	    // we defer if data is null
  	    // we can be expecting either 'end' or
  	    // 'error'
  	    if (data !== null) {
  	      iter[kLastPromise] = null;
  	      iter[kLastResolve] = null;
  	      iter[kLastReject] = null;
  	      resolve(createIterResult(data, false));
  	    }
  	  }
  	}
  	function onReadable(iter) {
  	  // we wait for the next tick, because it might
  	  // emit an error with process.nextTick
  	  nextTick$1(readAndResolve, iter);
  	}
  	function wrapForNext(lastPromise, iter) {
  	  return function (resolve, reject) {
  	    lastPromise.then(function () {
  	      if (iter[kEnded]) {
  	        resolve(createIterResult(undefined, true));
  	        return;
  	      }
  	      iter[kHandlePromise](resolve, reject);
  	    }, reject);
  	  };
  	}
  	var AsyncIteratorPrototype = Object.getPrototypeOf(function () {});
  	var ReadableStreamAsyncIteratorPrototype = Object.setPrototypeOf((_Object$setPrototypeO = {
  	  get stream() {
  	    return this[kStream];
  	  },
  	  next: function next() {
  	    var _this = this;
  	    // if we have detected an error in the meanwhile
  	    // reject straight away
  	    var error = this[kError];
  	    if (error !== null) {
  	      return Promise.reject(error);
  	    }
  	    if (this[kEnded]) {
  	      return Promise.resolve(createIterResult(undefined, true));
  	    }
  	    if (this[kStream].destroyed) {
  	      // We need to defer via nextTick because if .destroy(err) is
  	      // called, the error will be emitted via nextTick, and
  	      // we cannot guarantee that there is no error lingering around
  	      // waiting to be emitted.
  	      return new Promise(function (resolve, reject) {
  	        nextTick$1(function () {
  	          if (_this[kError]) {
  	            reject(_this[kError]);
  	          } else {
  	            resolve(createIterResult(undefined, true));
  	          }
  	        });
  	      });
  	    }

  	    // if we have multiple next() calls
  	    // we will wait for the previous Promise to finish
  	    // this logic is optimized to support for await loops,
  	    // where next() is only called once at a time
  	    var lastPromise = this[kLastPromise];
  	    var promise;
  	    if (lastPromise) {
  	      promise = new Promise(wrapForNext(lastPromise, this));
  	    } else {
  	      // fast path needed to support multiple this.push()
  	      // without triggering the next() queue
  	      var data = this[kStream].read();
  	      if (data !== null) {
  	        return Promise.resolve(createIterResult(data, false));
  	      }
  	      promise = new Promise(this[kHandlePromise]);
  	    }
  	    this[kLastPromise] = promise;
  	    return promise;
  	  }
  	}, _defineProperty(_Object$setPrototypeO, Symbol.asyncIterator, function () {
  	  return this;
  	}), _defineProperty(_Object$setPrototypeO, "return", function _return() {
  	  var _this2 = this;
  	  // destroy(err, cb) is a private API
  	  // we can guarantee we have that here, because we control the
  	  // Readable class this is attached to
  	  return new Promise(function (resolve, reject) {
  	    _this2[kStream].destroy(null, function (err) {
  	      if (err) {
  	        reject(err);
  	        return;
  	      }
  	      resolve(createIterResult(undefined, true));
  	    });
  	  });
  	}), _Object$setPrototypeO), AsyncIteratorPrototype);
  	var createReadableStreamAsyncIterator = function createReadableStreamAsyncIterator(stream) {
  	  var _Object$create;
  	  var iterator = Object.create(ReadableStreamAsyncIteratorPrototype, (_Object$create = {}, _defineProperty(_Object$create, kStream, {
  	    value: stream,
  	    writable: true
  	  }), _defineProperty(_Object$create, kLastResolve, {
  	    value: null,
  	    writable: true
  	  }), _defineProperty(_Object$create, kLastReject, {
  	    value: null,
  	    writable: true
  	  }), _defineProperty(_Object$create, kError, {
  	    value: null,
  	    writable: true
  	  }), _defineProperty(_Object$create, kEnded, {
  	    value: stream._readableState.endEmitted,
  	    writable: true
  	  }), _defineProperty(_Object$create, kHandlePromise, {
  	    value: function value(resolve, reject) {
  	      var data = iterator[kStream].read();
  	      if (data) {
  	        iterator[kLastPromise] = null;
  	        iterator[kLastResolve] = null;
  	        iterator[kLastReject] = null;
  	        resolve(createIterResult(data, false));
  	      } else {
  	        iterator[kLastResolve] = resolve;
  	        iterator[kLastReject] = reject;
  	      }
  	    },
  	    writable: true
  	  }), _Object$create));
  	  iterator[kLastPromise] = null;
  	  finished(stream, function (err) {
  	    if (err && err.code !== 'ERR_STREAM_PREMATURE_CLOSE') {
  	      var reject = iterator[kLastReject];
  	      // reject if we are waiting for data in the Promise
  	      // returned by next() and store the error
  	      if (reject !== null) {
  	        iterator[kLastPromise] = null;
  	        iterator[kLastResolve] = null;
  	        iterator[kLastReject] = null;
  	        reject(err);
  	      }
  	      iterator[kError] = err;
  	      return;
  	    }
  	    var resolve = iterator[kLastResolve];
  	    if (resolve !== null) {
  	      iterator[kLastPromise] = null;
  	      iterator[kLastResolve] = null;
  	      iterator[kLastReject] = null;
  	      resolve(createIterResult(undefined, true));
  	    }
  	    iterator[kEnded] = true;
  	  });
  	  stream.on('readable', onReadable.bind(null, iterator));
  	  return iterator;
  	};
  	async_iterator = createReadableStreamAsyncIterator;
  	return async_iterator;
  }

  var fromBrowser;
  var hasRequiredFromBrowser;

  function requireFromBrowser () {
  	if (hasRequiredFromBrowser) return fromBrowser;
  	hasRequiredFromBrowser = 1;
  	fromBrowser = function () {
  	  throw new Error('Readable.from is not available in the browser')
  	};
  	return fromBrowser;
  }

  var _stream_readable;
  var hasRequired_stream_readable;

  function require_stream_readable () {
  	if (hasRequired_stream_readable) return _stream_readable;
  	hasRequired_stream_readable = 1;

  	_stream_readable = Readable;

  	/*<replacement>*/
  	var Duplex;
  	/*</replacement>*/

  	Readable.ReadableState = ReadableState;

  	/*<replacement>*/
  	require$$0.EventEmitter;
  	var EElistenerCount = function EElistenerCount(emitter, type) {
  	  return emitter.listeners(type).length;
  	};
  	/*</replacement>*/

  	/*<replacement>*/
  	var Stream = requireStreamBrowser();
  	/*</replacement>*/

  	var Buffer = require$$0$1.Buffer;
  	var OurUint8Array = (typeof commonjsGlobal !== 'undefined' ? commonjsGlobal : typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : {}).Uint8Array || function () {};
  	function _uint8ArrayToBuffer(chunk) {
  	  return Buffer.from(chunk);
  	}
  	function _isUint8Array(obj) {
  	  return Buffer.isBuffer(obj) || obj instanceof OurUint8Array;
  	}

  	/*<replacement>*/
  	var debugUtil = require$$3;
  	var debug;
  	if (debugUtil && debugUtil.debuglog) {
  	  debug = debugUtil.debuglog('stream');
  	} else {
  	  debug = function debug() {};
  	}
  	/*</replacement>*/

  	var BufferList = requireBuffer_list();
  	var destroyImpl = requireDestroy();
  	var _require = requireState(),
  	  getHighWaterMark = _require.getHighWaterMark;
  	var _require$codes = requireErrorsBrowser().codes,
  	  ERR_INVALID_ARG_TYPE = _require$codes.ERR_INVALID_ARG_TYPE,
  	  ERR_STREAM_PUSH_AFTER_EOF = _require$codes.ERR_STREAM_PUSH_AFTER_EOF,
  	  ERR_METHOD_NOT_IMPLEMENTED = _require$codes.ERR_METHOD_NOT_IMPLEMENTED,
  	  ERR_STREAM_UNSHIFT_AFTER_END_EVENT = _require$codes.ERR_STREAM_UNSHIFT_AFTER_END_EVENT;

  	// Lazy loaded to improve the startup performance.
  	var StringDecoder;
  	var createReadableStreamAsyncIterator;
  	var from;
  	inherits_browserExports(Readable, Stream);
  	var errorOrDestroy = destroyImpl.errorOrDestroy;
  	var kProxyEvents = ['error', 'close', 'destroy', 'pause', 'resume'];
  	function prependListener(emitter, event, fn) {
  	  // Sadly this is not cacheable as some libraries bundle their own
  	  // event emitter implementation with them.
  	  if (typeof emitter.prependListener === 'function') return emitter.prependListener(event, fn);

  	  // This is a hack to make sure that our error handler is attached before any
  	  // userland ones.  NEVER DO THIS. This is here only because this code needs
  	  // to continue to work with older versions of Node.js that do not include
  	  // the prependListener() method. The goal is to eventually remove this hack.
  	  if (!emitter._events || !emitter._events[event]) emitter.on(event, fn);else if (Array.isArray(emitter._events[event])) emitter._events[event].unshift(fn);else emitter._events[event] = [fn, emitter._events[event]];
  	}
  	function ReadableState(options, stream, isDuplex) {
  	  Duplex = Duplex || require_stream_duplex();
  	  options = options || {};

  	  // Duplex streams are both readable and writable, but share
  	  // the same options object.
  	  // However, some cases require setting options to different
  	  // values for the readable and the writable sides of the duplex stream.
  	  // These options can be provided separately as readableXXX and writableXXX.
  	  if (typeof isDuplex !== 'boolean') isDuplex = stream instanceof Duplex;

  	  // object stream flag. Used to make read(n) ignore n and to
  	  // make all the buffer merging and length checks go away
  	  this.objectMode = !!options.objectMode;
  	  if (isDuplex) this.objectMode = this.objectMode || !!options.readableObjectMode;

  	  // the point at which it stops calling _read() to fill the buffer
  	  // Note: 0 is a valid value, means "don't call _read preemptively ever"
  	  this.highWaterMark = getHighWaterMark(this, options, 'readableHighWaterMark', isDuplex);

  	  // A linked list is used to store data chunks instead of an array because the
  	  // linked list can remove elements from the beginning faster than
  	  // array.shift()
  	  this.buffer = new BufferList();
  	  this.length = 0;
  	  this.pipes = null;
  	  this.pipesCount = 0;
  	  this.flowing = null;
  	  this.ended = false;
  	  this.endEmitted = false;
  	  this.reading = false;

  	  // a flag to be able to tell if the event 'readable'/'data' is emitted
  	  // immediately, or on a later tick.  We set this to true at first, because
  	  // any actions that shouldn't happen until "later" should generally also
  	  // not happen before the first read call.
  	  this.sync = true;

  	  // whenever we return null, then we set a flag to say
  	  // that we're awaiting a 'readable' event emission.
  	  this.needReadable = false;
  	  this.emittedReadable = false;
  	  this.readableListening = false;
  	  this.resumeScheduled = false;
  	  this.paused = true;

  	  // Should close be emitted on destroy. Defaults to true.
  	  this.emitClose = options.emitClose !== false;

  	  // Should .destroy() be called after 'end' (and potentially 'finish')
  	  this.autoDestroy = !!options.autoDestroy;

  	  // has it been destroyed
  	  this.destroyed = false;

  	  // Crypto is kind of old and crusty.  Historically, its default string
  	  // encoding is 'binary' so we have to make this configurable.
  	  // Everything else in the universe uses 'utf8', though.
  	  this.defaultEncoding = options.defaultEncoding || 'utf8';

  	  // the number of writers that are awaiting a drain event in .pipe()s
  	  this.awaitDrain = 0;

  	  // if true, a maybeReadMore has been scheduled
  	  this.readingMore = false;
  	  this.decoder = null;
  	  this.encoding = null;
  	  if (options.encoding) {
  	    if (!StringDecoder) StringDecoder = requireString_decoder().StringDecoder;
  	    this.decoder = new StringDecoder(options.encoding);
  	    this.encoding = options.encoding;
  	  }
  	}
  	function Readable(options) {
  	  Duplex = Duplex || require_stream_duplex();
  	  if (!(this instanceof Readable)) return new Readable(options);

  	  // Checking for a Stream.Duplex instance is faster here instead of inside
  	  // the ReadableState constructor, at least with V8 6.5
  	  var isDuplex = this instanceof Duplex;
  	  this._readableState = new ReadableState(options, this, isDuplex);

  	  // legacy
  	  this.readable = true;
  	  if (options) {
  	    if (typeof options.read === 'function') this._read = options.read;
  	    if (typeof options.destroy === 'function') this._destroy = options.destroy;
  	  }
  	  Stream.call(this);
  	}
  	Object.defineProperty(Readable.prototype, 'destroyed', {
  	  // making it explicit this property is not enumerable
  	  // because otherwise some prototype manipulation in
  	  // userland will fail
  	  enumerable: false,
  	  get: function get() {
  	    if (this._readableState === undefined) {
  	      return false;
  	    }
  	    return this._readableState.destroyed;
  	  },
  	  set: function set(value) {
  	    // we ignore the value if the stream
  	    // has not been initialized yet
  	    if (!this._readableState) {
  	      return;
  	    }

  	    // backward compatibility, the user is explicitly
  	    // managing destroyed
  	    this._readableState.destroyed = value;
  	  }
  	});
  	Readable.prototype.destroy = destroyImpl.destroy;
  	Readable.prototype._undestroy = destroyImpl.undestroy;
  	Readable.prototype._destroy = function (err, cb) {
  	  cb(err);
  	};

  	// Manually shove something into the read() buffer.
  	// This returns true if the highWaterMark has not been hit yet,
  	// similar to how Writable.write() returns true if you should
  	// write() some more.
  	Readable.prototype.push = function (chunk, encoding) {
  	  var state = this._readableState;
  	  var skipChunkCheck;
  	  if (!state.objectMode) {
  	    if (typeof chunk === 'string') {
  	      encoding = encoding || state.defaultEncoding;
  	      if (encoding !== state.encoding) {
  	        chunk = Buffer.from(chunk, encoding);
  	        encoding = '';
  	      }
  	      skipChunkCheck = true;
  	    }
  	  } else {
  	    skipChunkCheck = true;
  	  }
  	  return readableAddChunk(this, chunk, encoding, false, skipChunkCheck);
  	};

  	// Unshift should *always* be something directly out of read()
  	Readable.prototype.unshift = function (chunk) {
  	  return readableAddChunk(this, chunk, null, true, false);
  	};
  	function readableAddChunk(stream, chunk, encoding, addToFront, skipChunkCheck) {
  	  debug('readableAddChunk', chunk);
  	  var state = stream._readableState;
  	  if (chunk === null) {
  	    state.reading = false;
  	    onEofChunk(stream, state);
  	  } else {
  	    var er;
  	    if (!skipChunkCheck) er = chunkInvalid(state, chunk);
  	    if (er) {
  	      errorOrDestroy(stream, er);
  	    } else if (state.objectMode || chunk && chunk.length > 0) {
  	      if (typeof chunk !== 'string' && !state.objectMode && Object.getPrototypeOf(chunk) !== Buffer.prototype) {
  	        chunk = _uint8ArrayToBuffer(chunk);
  	      }
  	      if (addToFront) {
  	        if (state.endEmitted) errorOrDestroy(stream, new ERR_STREAM_UNSHIFT_AFTER_END_EVENT());else addChunk(stream, state, chunk, true);
  	      } else if (state.ended) {
  	        errorOrDestroy(stream, new ERR_STREAM_PUSH_AFTER_EOF());
  	      } else if (state.destroyed) {
  	        return false;
  	      } else {
  	        state.reading = false;
  	        if (state.decoder && !encoding) {
  	          chunk = state.decoder.write(chunk);
  	          if (state.objectMode || chunk.length !== 0) addChunk(stream, state, chunk, false);else maybeReadMore(stream, state);
  	        } else {
  	          addChunk(stream, state, chunk, false);
  	        }
  	      }
  	    } else if (!addToFront) {
  	      state.reading = false;
  	      maybeReadMore(stream, state);
  	    }
  	  }

  	  // We can push more data if we are below the highWaterMark.
  	  // Also, if we have no data yet, we can stand some more bytes.
  	  // This is to work around cases where hwm=0, such as the repl.
  	  return !state.ended && (state.length < state.highWaterMark || state.length === 0);
  	}
  	function addChunk(stream, state, chunk, addToFront) {
  	  if (state.flowing && state.length === 0 && !state.sync) {
  	    state.awaitDrain = 0;
  	    stream.emit('data', chunk);
  	  } else {
  	    // update the buffer info.
  	    state.length += state.objectMode ? 1 : chunk.length;
  	    if (addToFront) state.buffer.unshift(chunk);else state.buffer.push(chunk);
  	    if (state.needReadable) emitReadable(stream);
  	  }
  	  maybeReadMore(stream, state);
  	}
  	function chunkInvalid(state, chunk) {
  	  var er;
  	  if (!_isUint8Array(chunk) && typeof chunk !== 'string' && chunk !== undefined && !state.objectMode) {
  	    er = new ERR_INVALID_ARG_TYPE('chunk', ['string', 'Buffer', 'Uint8Array'], chunk);
  	  }
  	  return er;
  	}
  	Readable.prototype.isPaused = function () {
  	  return this._readableState.flowing === false;
  	};

  	// backwards compatibility.
  	Readable.prototype.setEncoding = function (enc) {
  	  if (!StringDecoder) StringDecoder = requireString_decoder().StringDecoder;
  	  var decoder = new StringDecoder(enc);
  	  this._readableState.decoder = decoder;
  	  // If setEncoding(null), decoder.encoding equals utf8
  	  this._readableState.encoding = this._readableState.decoder.encoding;

  	  // Iterate over current buffer to convert already stored Buffers:
  	  var p = this._readableState.buffer.head;
  	  var content = '';
  	  while (p !== null) {
  	    content += decoder.write(p.data);
  	    p = p.next;
  	  }
  	  this._readableState.buffer.clear();
  	  if (content !== '') this._readableState.buffer.push(content);
  	  this._readableState.length = content.length;
  	  return this;
  	};

  	// Don't raise the hwm > 1GB
  	var MAX_HWM = 0x40000000;
  	function computeNewHighWaterMark(n) {
  	  if (n >= MAX_HWM) {
  	    // TODO(ronag): Throw ERR_VALUE_OUT_OF_RANGE.
  	    n = MAX_HWM;
  	  } else {
  	    // Get the next highest power of 2 to prevent increasing hwm excessively in
  	    // tiny amounts
  	    n--;
  	    n |= n >>> 1;
  	    n |= n >>> 2;
  	    n |= n >>> 4;
  	    n |= n >>> 8;
  	    n |= n >>> 16;
  	    n++;
  	  }
  	  return n;
  	}

  	// This function is designed to be inlinable, so please take care when making
  	// changes to the function body.
  	function howMuchToRead(n, state) {
  	  if (n <= 0 || state.length === 0 && state.ended) return 0;
  	  if (state.objectMode) return 1;
  	  if (n !== n) {
  	    // Only flow one buffer at a time
  	    if (state.flowing && state.length) return state.buffer.head.data.length;else return state.length;
  	  }
  	  // If we're asking for more than the current hwm, then raise the hwm.
  	  if (n > state.highWaterMark) state.highWaterMark = computeNewHighWaterMark(n);
  	  if (n <= state.length) return n;
  	  // Don't have enough
  	  if (!state.ended) {
  	    state.needReadable = true;
  	    return 0;
  	  }
  	  return state.length;
  	}

  	// you can override either this method, or the async _read(n) below.
  	Readable.prototype.read = function (n) {
  	  debug('read', n);
  	  n = parseInt(n, 10);
  	  var state = this._readableState;
  	  var nOrig = n;
  	  if (n !== 0) state.emittedReadable = false;

  	  // if we're doing read(0) to trigger a readable event, but we
  	  // already have a bunch of data in the buffer, then just trigger
  	  // the 'readable' event and move on.
  	  if (n === 0 && state.needReadable && ((state.highWaterMark !== 0 ? state.length >= state.highWaterMark : state.length > 0) || state.ended)) {
  	    debug('read: emitReadable', state.length, state.ended);
  	    if (state.length === 0 && state.ended) endReadable(this);else emitReadable(this);
  	    return null;
  	  }
  	  n = howMuchToRead(n, state);

  	  // if we've ended, and we're now clear, then finish it up.
  	  if (n === 0 && state.ended) {
  	    if (state.length === 0) endReadable(this);
  	    return null;
  	  }

  	  // All the actual chunk generation logic needs to be
  	  // *below* the call to _read.  The reason is that in certain
  	  // synthetic stream cases, such as passthrough streams, _read
  	  // may be a completely synchronous operation which may change
  	  // the state of the read buffer, providing enough data when
  	  // before there was *not* enough.
  	  //
  	  // So, the steps are:
  	  // 1. Figure out what the state of things will be after we do
  	  // a read from the buffer.
  	  //
  	  // 2. If that resulting state will trigger a _read, then call _read.
  	  // Note that this may be asynchronous, or synchronous.  Yes, it is
  	  // deeply ugly to write APIs this way, but that still doesn't mean
  	  // that the Readable class should behave improperly, as streams are
  	  // designed to be sync/async agnostic.
  	  // Take note if the _read call is sync or async (ie, if the read call
  	  // has returned yet), so that we know whether or not it's safe to emit
  	  // 'readable' etc.
  	  //
  	  // 3. Actually pull the requested chunks out of the buffer and return.

  	  // if we need a readable event, then we need to do some reading.
  	  var doRead = state.needReadable;
  	  debug('need readable', doRead);

  	  // if we currently have less than the highWaterMark, then also read some
  	  if (state.length === 0 || state.length - n < state.highWaterMark) {
  	    doRead = true;
  	    debug('length less than watermark', doRead);
  	  }

  	  // however, if we've ended, then there's no point, and if we're already
  	  // reading, then it's unnecessary.
  	  if (state.ended || state.reading) {
  	    doRead = false;
  	    debug('reading or ended', doRead);
  	  } else if (doRead) {
  	    debug('do read');
  	    state.reading = true;
  	    state.sync = true;
  	    // if the length is currently zero, then we *need* a readable event.
  	    if (state.length === 0) state.needReadable = true;
  	    // call internal read method
  	    this._read(state.highWaterMark);
  	    state.sync = false;
  	    // If _read pushed data synchronously, then `reading` will be false,
  	    // and we need to re-evaluate how much data we can return to the user.
  	    if (!state.reading) n = howMuchToRead(nOrig, state);
  	  }
  	  var ret;
  	  if (n > 0) ret = fromList(n, state);else ret = null;
  	  if (ret === null) {
  	    state.needReadable = state.length <= state.highWaterMark;
  	    n = 0;
  	  } else {
  	    state.length -= n;
  	    state.awaitDrain = 0;
  	  }
  	  if (state.length === 0) {
  	    // If we have nothing in the buffer, then we want to know
  	    // as soon as we *do* get something into the buffer.
  	    if (!state.ended) state.needReadable = true;

  	    // If we tried to read() past the EOF, then emit end on the next tick.
  	    if (nOrig !== n && state.ended) endReadable(this);
  	  }
  	  if (ret !== null) this.emit('data', ret);
  	  return ret;
  	};
  	function onEofChunk(stream, state) {
  	  debug('onEofChunk');
  	  if (state.ended) return;
  	  if (state.decoder) {
  	    var chunk = state.decoder.end();
  	    if (chunk && chunk.length) {
  	      state.buffer.push(chunk);
  	      state.length += state.objectMode ? 1 : chunk.length;
  	    }
  	  }
  	  state.ended = true;
  	  if (state.sync) {
  	    // if we are sync, wait until next tick to emit the data.
  	    // Otherwise we risk emitting data in the flow()
  	    // the readable code triggers during a read() call
  	    emitReadable(stream);
  	  } else {
  	    // emit 'readable' now to make sure it gets picked up.
  	    state.needReadable = false;
  	    if (!state.emittedReadable) {
  	      state.emittedReadable = true;
  	      emitReadable_(stream);
  	    }
  	  }
  	}

  	// Don't emit readable right away in sync mode, because this can trigger
  	// another read() call => stack overflow.  This way, it might trigger
  	// a nextTick recursion warning, but that's not so bad.
  	function emitReadable(stream) {
  	  var state = stream._readableState;
  	  debug('emitReadable', state.needReadable, state.emittedReadable);
  	  state.needReadable = false;
  	  if (!state.emittedReadable) {
  	    debug('emitReadable', state.flowing);
  	    state.emittedReadable = true;
  	    nextTick$1(emitReadable_, stream);
  	  }
  	}
  	function emitReadable_(stream) {
  	  var state = stream._readableState;
  	  debug('emitReadable_', state.destroyed, state.length, state.ended);
  	  if (!state.destroyed && (state.length || state.ended)) {
  	    stream.emit('readable');
  	    state.emittedReadable = false;
  	  }

  	  // The stream needs another readable event if
  	  // 1. It is not flowing, as the flow mechanism will take
  	  //    care of it.
  	  // 2. It is not ended.
  	  // 3. It is below the highWaterMark, so we can schedule
  	  //    another readable later.
  	  state.needReadable = !state.flowing && !state.ended && state.length <= state.highWaterMark;
  	  flow(stream);
  	}

  	// at this point, the user has presumably seen the 'readable' event,
  	// and called read() to consume some data.  that may have triggered
  	// in turn another _read(n) call, in which case reading = true if
  	// it's in progress.
  	// However, if we're not ended, or reading, and the length < hwm,
  	// then go ahead and try to read some more preemptively.
  	function maybeReadMore(stream, state) {
  	  if (!state.readingMore) {
  	    state.readingMore = true;
  	    nextTick$1(maybeReadMore_, stream, state);
  	  }
  	}
  	function maybeReadMore_(stream, state) {
  	  // Attempt to read more data if we should.
  	  //
  	  // The conditions for reading more data are (one of):
  	  // - Not enough data buffered (state.length < state.highWaterMark). The loop
  	  //   is responsible for filling the buffer with enough data if such data
  	  //   is available. If highWaterMark is 0 and we are not in the flowing mode
  	  //   we should _not_ attempt to buffer any extra data. We'll get more data
  	  //   when the stream consumer calls read() instead.
  	  // - No data in the buffer, and the stream is in flowing mode. In this mode
  	  //   the loop below is responsible for ensuring read() is called. Failing to
  	  //   call read here would abort the flow and there's no other mechanism for
  	  //   continuing the flow if the stream consumer has just subscribed to the
  	  //   'data' event.
  	  //
  	  // In addition to the above conditions to keep reading data, the following
  	  // conditions prevent the data from being read:
  	  // - The stream has ended (state.ended).
  	  // - There is already a pending 'read' operation (state.reading). This is a
  	  //   case where the the stream has called the implementation defined _read()
  	  //   method, but they are processing the call asynchronously and have _not_
  	  //   called push() with new data. In this case we skip performing more
  	  //   read()s. The execution ends in this method again after the _read() ends
  	  //   up calling push() with more data.
  	  while (!state.reading && !state.ended && (state.length < state.highWaterMark || state.flowing && state.length === 0)) {
  	    var len = state.length;
  	    debug('maybeReadMore read 0');
  	    stream.read(0);
  	    if (len === state.length)
  	      // didn't get any data, stop spinning.
  	      break;
  	  }
  	  state.readingMore = false;
  	}

  	// abstract method.  to be overridden in specific implementation classes.
  	// call cb(er, data) where data is <= n in length.
  	// for virtual (non-string, non-buffer) streams, "length" is somewhat
  	// arbitrary, and perhaps not very meaningful.
  	Readable.prototype._read = function (n) {
  	  errorOrDestroy(this, new ERR_METHOD_NOT_IMPLEMENTED('_read()'));
  	};
  	Readable.prototype.pipe = function (dest, pipeOpts) {
  	  var src = this;
  	  var state = this._readableState;
  	  switch (state.pipesCount) {
  	    case 0:
  	      state.pipes = dest;
  	      break;
  	    case 1:
  	      state.pipes = [state.pipes, dest];
  	      break;
  	    default:
  	      state.pipes.push(dest);
  	      break;
  	  }
  	  state.pipesCount += 1;
  	  debug('pipe count=%d opts=%j', state.pipesCount, pipeOpts);
  	  var doEnd = (!pipeOpts || pipeOpts.end !== false) && dest !== process.stdout && dest !== process.stderr;
  	  var endFn = doEnd ? onend : unpipe;
  	  if (state.endEmitted) nextTick$1(endFn);else src.once('end', endFn);
  	  dest.on('unpipe', onunpipe);
  	  function onunpipe(readable, unpipeInfo) {
  	    debug('onunpipe');
  	    if (readable === src) {
  	      if (unpipeInfo && unpipeInfo.hasUnpiped === false) {
  	        unpipeInfo.hasUnpiped = true;
  	        cleanup();
  	      }
  	    }
  	  }
  	  function onend() {
  	    debug('onend');
  	    dest.end();
  	  }

  	  // when the dest drains, it reduces the awaitDrain counter
  	  // on the source.  This would be more elegant with a .once()
  	  // handler in flow(), but adding and removing repeatedly is
  	  // too slow.
  	  var ondrain = pipeOnDrain(src);
  	  dest.on('drain', ondrain);
  	  var cleanedUp = false;
  	  function cleanup() {
  	    debug('cleanup');
  	    // cleanup event handlers once the pipe is broken
  	    dest.removeListener('close', onclose);
  	    dest.removeListener('finish', onfinish);
  	    dest.removeListener('drain', ondrain);
  	    dest.removeListener('error', onerror);
  	    dest.removeListener('unpipe', onunpipe);
  	    src.removeListener('end', onend);
  	    src.removeListener('end', unpipe);
  	    src.removeListener('data', ondata);
  	    cleanedUp = true;

  	    // if the reader is waiting for a drain event from this
  	    // specific writer, then it would cause it to never start
  	    // flowing again.
  	    // So, if this is awaiting a drain, then we just call it now.
  	    // If we don't know, then assume that we are waiting for one.
  	    if (state.awaitDrain && (!dest._writableState || dest._writableState.needDrain)) ondrain();
  	  }
  	  src.on('data', ondata);
  	  function ondata(chunk) {
  	    debug('ondata');
  	    var ret = dest.write(chunk);
  	    debug('dest.write', ret);
  	    if (ret === false) {
  	      // If the user unpiped during `dest.write()`, it is possible
  	      // to get stuck in a permanently paused state if that write
  	      // also returned false.
  	      // => Check whether `dest` is still a piping destination.
  	      if ((state.pipesCount === 1 && state.pipes === dest || state.pipesCount > 1 && indexOf(state.pipes, dest) !== -1) && !cleanedUp) {
  	        debug('false write response, pause', state.awaitDrain);
  	        state.awaitDrain++;
  	      }
  	      src.pause();
  	    }
  	  }

  	  // if the dest has an error, then stop piping into it.
  	  // however, don't suppress the throwing behavior for this.
  	  function onerror(er) {
  	    debug('onerror', er);
  	    unpipe();
  	    dest.removeListener('error', onerror);
  	    if (EElistenerCount(dest, 'error') === 0) errorOrDestroy(dest, er);
  	  }

  	  // Make sure our error handler is attached before userland ones.
  	  prependListener(dest, 'error', onerror);

  	  // Both close and finish should trigger unpipe, but only once.
  	  function onclose() {
  	    dest.removeListener('finish', onfinish);
  	    unpipe();
  	  }
  	  dest.once('close', onclose);
  	  function onfinish() {
  	    debug('onfinish');
  	    dest.removeListener('close', onclose);
  	    unpipe();
  	  }
  	  dest.once('finish', onfinish);
  	  function unpipe() {
  	    debug('unpipe');
  	    src.unpipe(dest);
  	  }

  	  // tell the dest that it's being piped to
  	  dest.emit('pipe', src);

  	  // start the flow if it hasn't been started already.
  	  if (!state.flowing) {
  	    debug('pipe resume');
  	    src.resume();
  	  }
  	  return dest;
  	};
  	function pipeOnDrain(src) {
  	  return function pipeOnDrainFunctionResult() {
  	    var state = src._readableState;
  	    debug('pipeOnDrain', state.awaitDrain);
  	    if (state.awaitDrain) state.awaitDrain--;
  	    if (state.awaitDrain === 0 && EElistenerCount(src, 'data')) {
  	      state.flowing = true;
  	      flow(src);
  	    }
  	  };
  	}
  	Readable.prototype.unpipe = function (dest) {
  	  var state = this._readableState;
  	  var unpipeInfo = {
  	    hasUnpiped: false
  	  };

  	  // if we're not piping anywhere, then do nothing.
  	  if (state.pipesCount === 0) return this;

  	  // just one destination.  most common case.
  	  if (state.pipesCount === 1) {
  	    // passed in one, but it's not the right one.
  	    if (dest && dest !== state.pipes) return this;
  	    if (!dest) dest = state.pipes;

  	    // got a match.
  	    state.pipes = null;
  	    state.pipesCount = 0;
  	    state.flowing = false;
  	    if (dest) dest.emit('unpipe', this, unpipeInfo);
  	    return this;
  	  }

  	  // slow case. multiple pipe destinations.

  	  if (!dest) {
  	    // remove all.
  	    var dests = state.pipes;
  	    var len = state.pipesCount;
  	    state.pipes = null;
  	    state.pipesCount = 0;
  	    state.flowing = false;
  	    for (var i = 0; i < len; i++) dests[i].emit('unpipe', this, {
  	      hasUnpiped: false
  	    });
  	    return this;
  	  }

  	  // try to find the right one.
  	  var index = indexOf(state.pipes, dest);
  	  if (index === -1) return this;
  	  state.pipes.splice(index, 1);
  	  state.pipesCount -= 1;
  	  if (state.pipesCount === 1) state.pipes = state.pipes[0];
  	  dest.emit('unpipe', this, unpipeInfo);
  	  return this;
  	};

  	// set up data events if they are asked for
  	// Ensure readable listeners eventually get something
  	Readable.prototype.on = function (ev, fn) {
  	  var res = Stream.prototype.on.call(this, ev, fn);
  	  var state = this._readableState;
  	  if (ev === 'data') {
  	    // update readableListening so that resume() may be a no-op
  	    // a few lines down. This is needed to support once('readable').
  	    state.readableListening = this.listenerCount('readable') > 0;

  	    // Try start flowing on next tick if stream isn't explicitly paused
  	    if (state.flowing !== false) this.resume();
  	  } else if (ev === 'readable') {
  	    if (!state.endEmitted && !state.readableListening) {
  	      state.readableListening = state.needReadable = true;
  	      state.flowing = false;
  	      state.emittedReadable = false;
  	      debug('on readable', state.length, state.reading);
  	      if (state.length) {
  	        emitReadable(this);
  	      } else if (!state.reading) {
  	        nextTick$1(nReadingNextTick, this);
  	      }
  	    }
  	  }
  	  return res;
  	};
  	Readable.prototype.addListener = Readable.prototype.on;
  	Readable.prototype.removeListener = function (ev, fn) {
  	  var res = Stream.prototype.removeListener.call(this, ev, fn);
  	  if (ev === 'readable') {
  	    // We need to check if there is someone still listening to
  	    // readable and reset the state. However this needs to happen
  	    // after readable has been emitted but before I/O (nextTick) to
  	    // support once('readable', fn) cycles. This means that calling
  	    // resume within the same tick will have no
  	    // effect.
  	    nextTick$1(updateReadableListening, this);
  	  }
  	  return res;
  	};
  	Readable.prototype.removeAllListeners = function (ev) {
  	  var res = Stream.prototype.removeAllListeners.apply(this, arguments);
  	  if (ev === 'readable' || ev === undefined) {
  	    // We need to check if there is someone still listening to
  	    // readable and reset the state. However this needs to happen
  	    // after readable has been emitted but before I/O (nextTick) to
  	    // support once('readable', fn) cycles. This means that calling
  	    // resume within the same tick will have no
  	    // effect.
  	    nextTick$1(updateReadableListening, this);
  	  }
  	  return res;
  	};
  	function updateReadableListening(self) {
  	  var state = self._readableState;
  	  state.readableListening = self.listenerCount('readable') > 0;
  	  if (state.resumeScheduled && !state.paused) {
  	    // flowing needs to be set to true now, otherwise
  	    // the upcoming resume will not flow.
  	    state.flowing = true;

  	    // crude way to check if we should resume
  	  } else if (self.listenerCount('data') > 0) {
  	    self.resume();
  	  }
  	}
  	function nReadingNextTick(self) {
  	  debug('readable nexttick read 0');
  	  self.read(0);
  	}

  	// pause() and resume() are remnants of the legacy readable stream API
  	// If the user uses them, then switch into old mode.
  	Readable.prototype.resume = function () {
  	  var state = this._readableState;
  	  if (!state.flowing) {
  	    debug('resume');
  	    // we flow only if there is no one listening
  	    // for readable, but we still have to call
  	    // resume()
  	    state.flowing = !state.readableListening;
  	    resume(this, state);
  	  }
  	  state.paused = false;
  	  return this;
  	};
  	function resume(stream, state) {
  	  if (!state.resumeScheduled) {
  	    state.resumeScheduled = true;
  	    nextTick$1(resume_, stream, state);
  	  }
  	}
  	function resume_(stream, state) {
  	  debug('resume', state.reading);
  	  if (!state.reading) {
  	    stream.read(0);
  	  }
  	  state.resumeScheduled = false;
  	  stream.emit('resume');
  	  flow(stream);
  	  if (state.flowing && !state.reading) stream.read(0);
  	}
  	Readable.prototype.pause = function () {
  	  debug('call pause flowing=%j', this._readableState.flowing);
  	  if (this._readableState.flowing !== false) {
  	    debug('pause');
  	    this._readableState.flowing = false;
  	    this.emit('pause');
  	  }
  	  this._readableState.paused = true;
  	  return this;
  	};
  	function flow(stream) {
  	  var state = stream._readableState;
  	  debug('flow', state.flowing);
  	  while (state.flowing && stream.read() !== null);
  	}

  	// wrap an old-style stream as the async data source.
  	// This is *not* part of the readable stream interface.
  	// It is an ugly unfortunate mess of history.
  	Readable.prototype.wrap = function (stream) {
  	  var _this = this;
  	  var state = this._readableState;
  	  var paused = false;
  	  stream.on('end', function () {
  	    debug('wrapped end');
  	    if (state.decoder && !state.ended) {
  	      var chunk = state.decoder.end();
  	      if (chunk && chunk.length) _this.push(chunk);
  	    }
  	    _this.push(null);
  	  });
  	  stream.on('data', function (chunk) {
  	    debug('wrapped data');
  	    if (state.decoder) chunk = state.decoder.write(chunk);

  	    // don't skip over falsy values in objectMode
  	    if (state.objectMode && (chunk === null || chunk === undefined)) return;else if (!state.objectMode && (!chunk || !chunk.length)) return;
  	    var ret = _this.push(chunk);
  	    if (!ret) {
  	      paused = true;
  	      stream.pause();
  	    }
  	  });

  	  // proxy all the other methods.
  	  // important when wrapping filters and duplexes.
  	  for (var i in stream) {
  	    if (this[i] === undefined && typeof stream[i] === 'function') {
  	      this[i] = function methodWrap(method) {
  	        return function methodWrapReturnFunction() {
  	          return stream[method].apply(stream, arguments);
  	        };
  	      }(i);
  	    }
  	  }

  	  // proxy certain important events.
  	  for (var n = 0; n < kProxyEvents.length; n++) {
  	    stream.on(kProxyEvents[n], this.emit.bind(this, kProxyEvents[n]));
  	  }

  	  // when we try to consume some more bytes, simply unpause the
  	  // underlying stream.
  	  this._read = function (n) {
  	    debug('wrapped _read', n);
  	    if (paused) {
  	      paused = false;
  	      stream.resume();
  	    }
  	  };
  	  return this;
  	};
  	if (typeof Symbol === 'function') {
  	  Readable.prototype[Symbol.asyncIterator] = function () {
  	    if (createReadableStreamAsyncIterator === undefined) {
  	      createReadableStreamAsyncIterator = requireAsync_iterator();
  	    }
  	    return createReadableStreamAsyncIterator(this);
  	  };
  	}
  	Object.defineProperty(Readable.prototype, 'readableHighWaterMark', {
  	  // making it explicit this property is not enumerable
  	  // because otherwise some prototype manipulation in
  	  // userland will fail
  	  enumerable: false,
  	  get: function get() {
  	    return this._readableState.highWaterMark;
  	  }
  	});
  	Object.defineProperty(Readable.prototype, 'readableBuffer', {
  	  // making it explicit this property is not enumerable
  	  // because otherwise some prototype manipulation in
  	  // userland will fail
  	  enumerable: false,
  	  get: function get() {
  	    return this._readableState && this._readableState.buffer;
  	  }
  	});
  	Object.defineProperty(Readable.prototype, 'readableFlowing', {
  	  // making it explicit this property is not enumerable
  	  // because otherwise some prototype manipulation in
  	  // userland will fail
  	  enumerable: false,
  	  get: function get() {
  	    return this._readableState.flowing;
  	  },
  	  set: function set(state) {
  	    if (this._readableState) {
  	      this._readableState.flowing = state;
  	    }
  	  }
  	});

  	// exposed for testing purposes only.
  	Readable._fromList = fromList;
  	Object.defineProperty(Readable.prototype, 'readableLength', {
  	  // making it explicit this property is not enumerable
  	  // because otherwise some prototype manipulation in
  	  // userland will fail
  	  enumerable: false,
  	  get: function get() {
  	    return this._readableState.length;
  	  }
  	});

  	// Pluck off n bytes from an array of buffers.
  	// Length is the combined lengths of all the buffers in the list.
  	// This function is designed to be inlinable, so please take care when making
  	// changes to the function body.
  	function fromList(n, state) {
  	  // nothing buffered
  	  if (state.length === 0) return null;
  	  var ret;
  	  if (state.objectMode) ret = state.buffer.shift();else if (!n || n >= state.length) {
  	    // read it all, truncate the list
  	    if (state.decoder) ret = state.buffer.join('');else if (state.buffer.length === 1) ret = state.buffer.first();else ret = state.buffer.concat(state.length);
  	    state.buffer.clear();
  	  } else {
  	    // read part of list
  	    ret = state.buffer.consume(n, state.decoder);
  	  }
  	  return ret;
  	}
  	function endReadable(stream) {
  	  var state = stream._readableState;
  	  debug('endReadable', state.endEmitted);
  	  if (!state.endEmitted) {
  	    state.ended = true;
  	    nextTick$1(endReadableNT, state, stream);
  	  }
  	}
  	function endReadableNT(state, stream) {
  	  debug('endReadableNT', state.endEmitted, state.length);

  	  // Check that we didn't get one last unshift.
  	  if (!state.endEmitted && state.length === 0) {
  	    state.endEmitted = true;
  	    stream.readable = false;
  	    stream.emit('end');
  	    if (state.autoDestroy) {
  	      // In case of duplex streams we need a way to detect
  	      // if the writable side is ready for autoDestroy as well
  	      var wState = stream._writableState;
  	      if (!wState || wState.autoDestroy && wState.finished) {
  	        stream.destroy();
  	      }
  	    }
  	  }
  	}
  	if (typeof Symbol === 'function') {
  	  Readable.from = function (iterable, opts) {
  	    if (from === undefined) {
  	      from = requireFromBrowser();
  	    }
  	    return from(Readable, iterable, opts);
  	  };
  	}
  	function indexOf(xs, x) {
  	  for (var i = 0, l = xs.length; i < l; i++) {
  	    if (xs[i] === x) return i;
  	  }
  	  return -1;
  	}
  	return _stream_readable;
  }

  var _stream_transform;
  var hasRequired_stream_transform;

  function require_stream_transform () {
  	if (hasRequired_stream_transform) return _stream_transform;
  	hasRequired_stream_transform = 1;

  	_stream_transform = Transform;
  	var _require$codes = requireErrorsBrowser().codes,
  	  ERR_METHOD_NOT_IMPLEMENTED = _require$codes.ERR_METHOD_NOT_IMPLEMENTED,
  	  ERR_MULTIPLE_CALLBACK = _require$codes.ERR_MULTIPLE_CALLBACK,
  	  ERR_TRANSFORM_ALREADY_TRANSFORMING = _require$codes.ERR_TRANSFORM_ALREADY_TRANSFORMING,
  	  ERR_TRANSFORM_WITH_LENGTH_0 = _require$codes.ERR_TRANSFORM_WITH_LENGTH_0;
  	var Duplex = require_stream_duplex();
  	inherits_browserExports(Transform, Duplex);
  	function afterTransform(er, data) {
  	  var ts = this._transformState;
  	  ts.transforming = false;
  	  var cb = ts.writecb;
  	  if (cb === null) {
  	    return this.emit('error', new ERR_MULTIPLE_CALLBACK());
  	  }
  	  ts.writechunk = null;
  	  ts.writecb = null;
  	  if (data != null)
  	    // single equals check for both `null` and `undefined`
  	    this.push(data);
  	  cb(er);
  	  var rs = this._readableState;
  	  rs.reading = false;
  	  if (rs.needReadable || rs.length < rs.highWaterMark) {
  	    this._read(rs.highWaterMark);
  	  }
  	}
  	function Transform(options) {
  	  if (!(this instanceof Transform)) return new Transform(options);
  	  Duplex.call(this, options);
  	  this._transformState = {
  	    afterTransform: afterTransform.bind(this),
  	    needTransform: false,
  	    transforming: false,
  	    writecb: null,
  	    writechunk: null,
  	    writeencoding: null
  	  };

  	  // start out asking for a readable event once data is transformed.
  	  this._readableState.needReadable = true;

  	  // we have implemented the _read method, and done the other things
  	  // that Readable wants before the first _read call, so unset the
  	  // sync guard flag.
  	  this._readableState.sync = false;
  	  if (options) {
  	    if (typeof options.transform === 'function') this._transform = options.transform;
  	    if (typeof options.flush === 'function') this._flush = options.flush;
  	  }

  	  // When the writable side finishes, then flush out anything remaining.
  	  this.on('prefinish', prefinish);
  	}
  	function prefinish() {
  	  var _this = this;
  	  if (typeof this._flush === 'function' && !this._readableState.destroyed) {
  	    this._flush(function (er, data) {
  	      done(_this, er, data);
  	    });
  	  } else {
  	    done(this, null, null);
  	  }
  	}
  	Transform.prototype.push = function (chunk, encoding) {
  	  this._transformState.needTransform = false;
  	  return Duplex.prototype.push.call(this, chunk, encoding);
  	};

  	// This is the part where you do stuff!
  	// override this function in implementation classes.
  	// 'chunk' is an input chunk.
  	//
  	// Call `push(newChunk)` to pass along transformed output
  	// to the readable side.  You may call 'push' zero or more times.
  	//
  	// Call `cb(err)` when you are done with this chunk.  If you pass
  	// an error, then that'll put the hurt on the whole operation.  If you
  	// never call cb(), then you'll never get another chunk.
  	Transform.prototype._transform = function (chunk, encoding, cb) {
  	  cb(new ERR_METHOD_NOT_IMPLEMENTED('_transform()'));
  	};
  	Transform.prototype._write = function (chunk, encoding, cb) {
  	  var ts = this._transformState;
  	  ts.writecb = cb;
  	  ts.writechunk = chunk;
  	  ts.writeencoding = encoding;
  	  if (!ts.transforming) {
  	    var rs = this._readableState;
  	    if (ts.needTransform || rs.needReadable || rs.length < rs.highWaterMark) this._read(rs.highWaterMark);
  	  }
  	};

  	// Doesn't matter what the args are here.
  	// _transform does all the work.
  	// That we got here means that the readable side wants more data.
  	Transform.prototype._read = function (n) {
  	  var ts = this._transformState;
  	  if (ts.writechunk !== null && !ts.transforming) {
  	    ts.transforming = true;
  	    this._transform(ts.writechunk, ts.writeencoding, ts.afterTransform);
  	  } else {
  	    // mark that we need a transform, so that any data that comes in
  	    // will get processed, now that we've asked for it.
  	    ts.needTransform = true;
  	  }
  	};
  	Transform.prototype._destroy = function (err, cb) {
  	  Duplex.prototype._destroy.call(this, err, function (err2) {
  	    cb(err2);
  	  });
  	};
  	function done(stream, er, data) {
  	  if (er) return stream.emit('error', er);
  	  if (data != null)
  	    // single equals check for both `null` and `undefined`
  	    stream.push(data);

  	  // TODO(BridgeAR): Write a test for these two error cases
  	  // if there's nothing in the write buffer, then that means
  	  // that nothing more will ever be provided
  	  if (stream._writableState.length) throw new ERR_TRANSFORM_WITH_LENGTH_0();
  	  if (stream._transformState.transforming) throw new ERR_TRANSFORM_ALREADY_TRANSFORMING();
  	  return stream.push(null);
  	}
  	return _stream_transform;
  }

  var _stream_passthrough;
  var hasRequired_stream_passthrough;

  function require_stream_passthrough () {
  	if (hasRequired_stream_passthrough) return _stream_passthrough;
  	hasRequired_stream_passthrough = 1;

  	_stream_passthrough = PassThrough;
  	var Transform = require_stream_transform();
  	inherits_browserExports(PassThrough, Transform);
  	function PassThrough(options) {
  	  if (!(this instanceof PassThrough)) return new PassThrough(options);
  	  Transform.call(this, options);
  	}
  	PassThrough.prototype._transform = function (chunk, encoding, cb) {
  	  cb(null, chunk);
  	};
  	return _stream_passthrough;
  }

  var pipeline_1;
  var hasRequiredPipeline;

  function requirePipeline () {
  	if (hasRequiredPipeline) return pipeline_1;
  	hasRequiredPipeline = 1;

  	var eos;
  	function once(callback) {
  	  var called = false;
  	  return function () {
  	    if (called) return;
  	    called = true;
  	    callback.apply(void 0, arguments);
  	  };
  	}
  	var _require$codes = requireErrorsBrowser().codes,
  	  ERR_MISSING_ARGS = _require$codes.ERR_MISSING_ARGS,
  	  ERR_STREAM_DESTROYED = _require$codes.ERR_STREAM_DESTROYED;
  	function noop(err) {
  	  // Rethrow the error if it exists to avoid swallowing it
  	  if (err) throw err;
  	}
  	function isRequest(stream) {
  	  return stream.setHeader && typeof stream.abort === 'function';
  	}
  	function destroyer(stream, reading, writing, callback) {
  	  callback = once(callback);
  	  var closed = false;
  	  stream.on('close', function () {
  	    closed = true;
  	  });
  	  if (eos === undefined) eos = requireEndOfStream();
  	  eos(stream, {
  	    readable: reading,
  	    writable: writing
  	  }, function (err) {
  	    if (err) return callback(err);
  	    closed = true;
  	    callback();
  	  });
  	  var destroyed = false;
  	  return function (err) {
  	    if (closed) return;
  	    if (destroyed) return;
  	    destroyed = true;

  	    // request.destroy just do .end - .abort is what we want
  	    if (isRequest(stream)) return stream.abort();
  	    if (typeof stream.destroy === 'function') return stream.destroy();
  	    callback(err || new ERR_STREAM_DESTROYED('pipe'));
  	  };
  	}
  	function call(fn) {
  	  fn();
  	}
  	function pipe(from, to) {
  	  return from.pipe(to);
  	}
  	function popCallback(streams) {
  	  if (!streams.length) return noop;
  	  if (typeof streams[streams.length - 1] !== 'function') return noop;
  	  return streams.pop();
  	}
  	function pipeline() {
  	  for (var _len = arguments.length, streams = new Array(_len), _key = 0; _key < _len; _key++) {
  	    streams[_key] = arguments[_key];
  	  }
  	  var callback = popCallback(streams);
  	  if (Array.isArray(streams[0])) streams = streams[0];
  	  if (streams.length < 2) {
  	    throw new ERR_MISSING_ARGS('streams');
  	  }
  	  var error;
  	  var destroys = streams.map(function (stream, i) {
  	    var reading = i < streams.length - 1;
  	    var writing = i > 0;
  	    return destroyer(stream, reading, writing, function (err) {
  	      if (!error) error = err;
  	      if (err) destroys.forEach(call);
  	      if (reading) return;
  	      destroys.forEach(call);
  	      callback(error);
  	    });
  	  });
  	  return streams.reduce(pipe);
  	}
  	pipeline_1 = pipeline;
  	return pipeline_1;
  }

  var hasRequiredReadableBrowser;

  function requireReadableBrowser () {
  	if (hasRequiredReadableBrowser) return readableBrowser.exports;
  	hasRequiredReadableBrowser = 1;
  	(function (module, exports) {
  		exports = module.exports = require_stream_readable();
  		exports.Stream = exports;
  		exports.Readable = exports;
  		exports.Writable = require_stream_writable();
  		exports.Duplex = require_stream_duplex();
  		exports.Transform = require_stream_transform();
  		exports.PassThrough = require_stream_passthrough();
  		exports.finished = requireEndOfStream();
  		exports.pipeline = requirePipeline(); 
  	} (readableBrowser, readableBrowser.exports));
  	return readableBrowser.exports;
  }

  var Buffer$j = safeBufferExports.Buffer;
  var Transform$2 = requireReadableBrowser().Transform;
  var inherits$c = inherits_browserExports;

  function throwIfNotStringOrBuffer (val, prefix) {
    if (!Buffer$j.isBuffer(val) && typeof val !== 'string') {
      throw new TypeError(prefix + ' must be a string or a buffer')
    }
  }

  function HashBase$2 (blockSize) {
    Transform$2.call(this);

    this._block = Buffer$j.allocUnsafe(blockSize);
    this._blockSize = blockSize;
    this._blockOffset = 0;
    this._length = [0, 0, 0, 0];

    this._finalized = false;
  }

  inherits$c(HashBase$2, Transform$2);

  HashBase$2.prototype._transform = function (chunk, encoding, callback) {
    var error = null;
    try {
      this.update(chunk, encoding);
    } catch (err) {
      error = err;
    }

    callback(error);
  };

  HashBase$2.prototype._flush = function (callback) {
    var error = null;
    try {
      this.push(this.digest());
    } catch (err) {
      error = err;
    }

    callback(error);
  };

  HashBase$2.prototype.update = function (data, encoding) {
    throwIfNotStringOrBuffer(data, 'Data');
    if (this._finalized) throw new Error('Digest already called')
    if (!Buffer$j.isBuffer(data)) data = Buffer$j.from(data, encoding);

    // consume data
    var block = this._block;
    var offset = 0;
    while (this._blockOffset + data.length - offset >= this._blockSize) {
      for (var i = this._blockOffset; i < this._blockSize;) block[i++] = data[offset++];
      this._update();
      this._blockOffset = 0;
    }
    while (offset < data.length) block[this._blockOffset++] = data[offset++];

    // update length
    for (var j = 0, carry = data.length * 8; carry > 0; ++j) {
      this._length[j] += carry;
      carry = (this._length[j] / 0x0100000000) | 0;
      if (carry > 0) this._length[j] -= 0x0100000000 * carry;
    }

    return this
  };

  HashBase$2.prototype._update = function () {
    throw new Error('_update is not implemented')
  };

  HashBase$2.prototype.digest = function (encoding) {
    if (this._finalized) throw new Error('Digest already called')
    this._finalized = true;

    var digest = this._digest();
    if (encoding !== undefined) digest = digest.toString(encoding);

    // reset state
    this._block.fill(0);
    this._blockOffset = 0;
    for (var i = 0; i < 4; ++i) this._length[i] = 0;

    return digest
  };

  HashBase$2.prototype._digest = function () {
    throw new Error('_digest is not implemented')
  };

  var hashBase = HashBase$2;

  var inherits$b = inherits_browserExports;
  var HashBase$1 = hashBase;
  var Buffer$i = safeBufferExports.Buffer;

  var ARRAY16$1 = new Array(16);

  function MD5$2 () {
    HashBase$1.call(this, 64);

    // state
    this._a = 0x67452301;
    this._b = 0xefcdab89;
    this._c = 0x98badcfe;
    this._d = 0x10325476;
  }

  inherits$b(MD5$2, HashBase$1);

  MD5$2.prototype._update = function () {
    var M = ARRAY16$1;
    for (var i = 0; i < 16; ++i) M[i] = this._block.readInt32LE(i * 4);

    var a = this._a;
    var b = this._b;
    var c = this._c;
    var d = this._d;

    a = fnF(a, b, c, d, M[0], 0xd76aa478, 7);
    d = fnF(d, a, b, c, M[1], 0xe8c7b756, 12);
    c = fnF(c, d, a, b, M[2], 0x242070db, 17);
    b = fnF(b, c, d, a, M[3], 0xc1bdceee, 22);
    a = fnF(a, b, c, d, M[4], 0xf57c0faf, 7);
    d = fnF(d, a, b, c, M[5], 0x4787c62a, 12);
    c = fnF(c, d, a, b, M[6], 0xa8304613, 17);
    b = fnF(b, c, d, a, M[7], 0xfd469501, 22);
    a = fnF(a, b, c, d, M[8], 0x698098d8, 7);
    d = fnF(d, a, b, c, M[9], 0x8b44f7af, 12);
    c = fnF(c, d, a, b, M[10], 0xffff5bb1, 17);
    b = fnF(b, c, d, a, M[11], 0x895cd7be, 22);
    a = fnF(a, b, c, d, M[12], 0x6b901122, 7);
    d = fnF(d, a, b, c, M[13], 0xfd987193, 12);
    c = fnF(c, d, a, b, M[14], 0xa679438e, 17);
    b = fnF(b, c, d, a, M[15], 0x49b40821, 22);

    a = fnG(a, b, c, d, M[1], 0xf61e2562, 5);
    d = fnG(d, a, b, c, M[6], 0xc040b340, 9);
    c = fnG(c, d, a, b, M[11], 0x265e5a51, 14);
    b = fnG(b, c, d, a, M[0], 0xe9b6c7aa, 20);
    a = fnG(a, b, c, d, M[5], 0xd62f105d, 5);
    d = fnG(d, a, b, c, M[10], 0x02441453, 9);
    c = fnG(c, d, a, b, M[15], 0xd8a1e681, 14);
    b = fnG(b, c, d, a, M[4], 0xe7d3fbc8, 20);
    a = fnG(a, b, c, d, M[9], 0x21e1cde6, 5);
    d = fnG(d, a, b, c, M[14], 0xc33707d6, 9);
    c = fnG(c, d, a, b, M[3], 0xf4d50d87, 14);
    b = fnG(b, c, d, a, M[8], 0x455a14ed, 20);
    a = fnG(a, b, c, d, M[13], 0xa9e3e905, 5);
    d = fnG(d, a, b, c, M[2], 0xfcefa3f8, 9);
    c = fnG(c, d, a, b, M[7], 0x676f02d9, 14);
    b = fnG(b, c, d, a, M[12], 0x8d2a4c8a, 20);

    a = fnH(a, b, c, d, M[5], 0xfffa3942, 4);
    d = fnH(d, a, b, c, M[8], 0x8771f681, 11);
    c = fnH(c, d, a, b, M[11], 0x6d9d6122, 16);
    b = fnH(b, c, d, a, M[14], 0xfde5380c, 23);
    a = fnH(a, b, c, d, M[1], 0xa4beea44, 4);
    d = fnH(d, a, b, c, M[4], 0x4bdecfa9, 11);
    c = fnH(c, d, a, b, M[7], 0xf6bb4b60, 16);
    b = fnH(b, c, d, a, M[10], 0xbebfbc70, 23);
    a = fnH(a, b, c, d, M[13], 0x289b7ec6, 4);
    d = fnH(d, a, b, c, M[0], 0xeaa127fa, 11);
    c = fnH(c, d, a, b, M[3], 0xd4ef3085, 16);
    b = fnH(b, c, d, a, M[6], 0x04881d05, 23);
    a = fnH(a, b, c, d, M[9], 0xd9d4d039, 4);
    d = fnH(d, a, b, c, M[12], 0xe6db99e5, 11);
    c = fnH(c, d, a, b, M[15], 0x1fa27cf8, 16);
    b = fnH(b, c, d, a, M[2], 0xc4ac5665, 23);

    a = fnI(a, b, c, d, M[0], 0xf4292244, 6);
    d = fnI(d, a, b, c, M[7], 0x432aff97, 10);
    c = fnI(c, d, a, b, M[14], 0xab9423a7, 15);
    b = fnI(b, c, d, a, M[5], 0xfc93a039, 21);
    a = fnI(a, b, c, d, M[12], 0x655b59c3, 6);
    d = fnI(d, a, b, c, M[3], 0x8f0ccc92, 10);
    c = fnI(c, d, a, b, M[10], 0xffeff47d, 15);
    b = fnI(b, c, d, a, M[1], 0x85845dd1, 21);
    a = fnI(a, b, c, d, M[8], 0x6fa87e4f, 6);
    d = fnI(d, a, b, c, M[15], 0xfe2ce6e0, 10);
    c = fnI(c, d, a, b, M[6], 0xa3014314, 15);
    b = fnI(b, c, d, a, M[13], 0x4e0811a1, 21);
    a = fnI(a, b, c, d, M[4], 0xf7537e82, 6);
    d = fnI(d, a, b, c, M[11], 0xbd3af235, 10);
    c = fnI(c, d, a, b, M[2], 0x2ad7d2bb, 15);
    b = fnI(b, c, d, a, M[9], 0xeb86d391, 21);

    this._a = (this._a + a) | 0;
    this._b = (this._b + b) | 0;
    this._c = (this._c + c) | 0;
    this._d = (this._d + d) | 0;
  };

  MD5$2.prototype._digest = function () {
    // create padding and handle blocks
    this._block[this._blockOffset++] = 0x80;
    if (this._blockOffset > 56) {
      this._block.fill(0, this._blockOffset, 64);
      this._update();
      this._blockOffset = 0;
    }

    this._block.fill(0, this._blockOffset, 56);
    this._block.writeUInt32LE(this._length[0], 56);
    this._block.writeUInt32LE(this._length[1], 60);
    this._update();

    // produce result
    var buffer = Buffer$i.allocUnsafe(16);
    buffer.writeInt32LE(this._a, 0);
    buffer.writeInt32LE(this._b, 4);
    buffer.writeInt32LE(this._c, 8);
    buffer.writeInt32LE(this._d, 12);
    return buffer
  };

  function rotl$1 (x, n) {
    return (x << n) | (x >>> (32 - n))
  }

  function fnF (a, b, c, d, m, k, s) {
    return (rotl$1((a + ((b & c) | ((~b) & d)) + m + k) | 0, s) + b) | 0
  }

  function fnG (a, b, c, d, m, k, s) {
    return (rotl$1((a + ((b & d) | (c & (~d))) + m + k) | 0, s) + b) | 0
  }

  function fnH (a, b, c, d, m, k, s) {
    return (rotl$1((a + (b ^ c ^ d) + m + k) | 0, s) + b) | 0
  }

  function fnI (a, b, c, d, m, k, s) {
    return (rotl$1((a + ((c ^ (b | (~d)))) + m + k) | 0, s) + b) | 0
  }

  var md5_js = MD5$2;

  var Buffer$h = safeBufferExports.Buffer;
  var MD5$1 = md5_js;

  /* eslint-disable camelcase */
  function EVP_BytesToKey (password, salt, keyBits, ivLen) {
    if (!Buffer$h.isBuffer(password)) password = Buffer$h.from(password, 'binary');
    if (salt) {
      if (!Buffer$h.isBuffer(salt)) salt = Buffer$h.from(salt, 'binary');
      if (salt.length !== 8) throw new RangeError('salt should be Buffer with 8 byte length')
    }

    var keyLen = keyBits / 8;
    var key = Buffer$h.alloc(keyLen);
    var iv = Buffer$h.alloc(ivLen || 0);
    var tmp = Buffer$h.alloc(0);

    while (keyLen > 0 || ivLen > 0) {
      var hash = new MD5$1();
      hash.update(tmp);
      hash.update(password);
      if (salt) hash.update(salt);
      tmp = hash.digest();

      var used = 0;

      if (keyLen > 0) {
        var keyStart = key.length - keyLen;
        used = Math.min(keyLen, tmp.length);
        tmp.copy(key, keyStart, 0, used);
        keyLen -= used;
      }

      if (used < tmp.length && ivLen > 0) {
        var ivStart = iv.length - ivLen;
        var length = Math.min(ivLen, tmp.length - used);
        tmp.copy(iv, ivStart, used, used + length);
        ivLen -= length;
      }
    }

    tmp.fill(0);
    return { key: key, iv: iv }
  }

  var evp_bytestokey = EVP_BytesToKey;

  var MODES$1 = modes_1;
  var AuthCipher$1 = authCipher;
  var Buffer$g = safeBufferExports.Buffer;
  var StreamCipher$1 = streamCipher;
  var Transform$1 = cipherBase;
  var aes$3 = aes$6;
  var ebtk$2 = evp_bytestokey;
  var inherits$a = inherits_browserExports;

  function Cipher (mode, key, iv) {
    Transform$1.call(this);

    this._cache = new Splitter$1();
    this._cipher = new aes$3.AES(key);
    this._prev = Buffer$g.from(iv);
    this._mode = mode;
    this._autopadding = true;
  }

  inherits$a(Cipher, Transform$1);

  Cipher.prototype._update = function (data) {
    this._cache.add(data);
    var chunk;
    var thing;
    var out = [];

    while ((chunk = this._cache.get())) {
      thing = this._mode.encrypt(this, chunk);
      out.push(thing);
    }

    return Buffer$g.concat(out)
  };

  var PADDING = Buffer$g.alloc(16, 0x10);

  Cipher.prototype._final = function () {
    var chunk = this._cache.flush();
    if (this._autopadding) {
      chunk = this._mode.encrypt(this, chunk);
      this._cipher.scrub();
      return chunk
    }

    if (!chunk.equals(PADDING)) {
      this._cipher.scrub();
      throw new Error('data not multiple of block length')
    }
  };

  Cipher.prototype.setAutoPadding = function (setTo) {
    this._autopadding = !!setTo;
    return this
  };

  function Splitter$1 () {
    this.cache = Buffer$g.allocUnsafe(0);
  }

  Splitter$1.prototype.add = function (data) {
    this.cache = Buffer$g.concat([this.cache, data]);
  };

  Splitter$1.prototype.get = function () {
    if (this.cache.length > 15) {
      var out = this.cache.slice(0, 16);
      this.cache = this.cache.slice(16);
      return out
    }
    return null
  };

  Splitter$1.prototype.flush = function () {
    var len = 16 - this.cache.length;
    var padBuff = Buffer$g.allocUnsafe(len);

    var i = -1;
    while (++i < len) {
      padBuff.writeUInt8(len, i);
    }

    return Buffer$g.concat([this.cache, padBuff])
  };

  function createCipheriv$2 (suite, password, iv) {
    var config = MODES$1[suite.toLowerCase()];
    if (!config) throw new TypeError('invalid suite type')

    if (typeof password === 'string') password = Buffer$g.from(password);
    if (password.length !== config.key / 8) throw new TypeError('invalid key length ' + password.length)

    if (typeof iv === 'string') iv = Buffer$g.from(iv);
    if (config.mode !== 'GCM' && iv.length !== config.iv) throw new TypeError('invalid iv length ' + iv.length)

    if (config.type === 'stream') {
      return new StreamCipher$1(config.module, password, iv)
    } else if (config.type === 'auth') {
      return new AuthCipher$1(config.module, password, iv)
    }

    return new Cipher(config.module, password, iv)
  }

  function createCipher$1 (suite, password) {
    var config = MODES$1[suite.toLowerCase()];
    if (!config) throw new TypeError('invalid suite type')

    var keys = ebtk$2(password, false, config.key, config.iv);
    return createCipheriv$2(suite, keys.key, keys.iv)
  }

  encrypter.createCipheriv = createCipheriv$2;
  encrypter.createCipher = createCipher$1;

  var decrypter = {};

  var AuthCipher = authCipher;
  var Buffer$f = safeBufferExports.Buffer;
  var MODES = modes_1;
  var StreamCipher = streamCipher;
  var Transform = cipherBase;
  var aes$2 = aes$6;
  var ebtk$1 = evp_bytestokey;
  var inherits$9 = inherits_browserExports;

  function Decipher (mode, key, iv) {
    Transform.call(this);

    this._cache = new Splitter();
    this._last = void 0;
    this._cipher = new aes$2.AES(key);
    this._prev = Buffer$f.from(iv);
    this._mode = mode;
    this._autopadding = true;
  }

  inherits$9(Decipher, Transform);

  Decipher.prototype._update = function (data) {
    this._cache.add(data);
    var chunk;
    var thing;
    var out = [];
    while ((chunk = this._cache.get(this._autopadding))) {
      thing = this._mode.decrypt(this, chunk);
      out.push(thing);
    }
    return Buffer$f.concat(out)
  };

  Decipher.prototype._final = function () {
    var chunk = this._cache.flush();
    if (this._autopadding) {
      return unpad(this._mode.decrypt(this, chunk))
    } else if (chunk) {
      throw new Error('data not multiple of block length')
    }
  };

  Decipher.prototype.setAutoPadding = function (setTo) {
    this._autopadding = !!setTo;
    return this
  };

  function Splitter () {
    this.cache = Buffer$f.allocUnsafe(0);
  }

  Splitter.prototype.add = function (data) {
    this.cache = Buffer$f.concat([this.cache, data]);
  };

  Splitter.prototype.get = function (autoPadding) {
    var out;
    if (autoPadding) {
      if (this.cache.length > 16) {
        out = this.cache.slice(0, 16);
        this.cache = this.cache.slice(16);
        return out
      }
    } else {
      if (this.cache.length >= 16) {
        out = this.cache.slice(0, 16);
        this.cache = this.cache.slice(16);
        return out
      }
    }

    return null
  };

  Splitter.prototype.flush = function () {
    if (this.cache.length) return this.cache
  };

  function unpad (last) {
    var padded = last[15];
    if (padded < 1 || padded > 16) {
      throw new Error('unable to decrypt data')
    }
    var i = -1;
    while (++i < padded) {
      if (last[(i + (16 - padded))] !== padded) {
        throw new Error('unable to decrypt data')
      }
    }
    if (padded === 16) return

    return last.slice(0, 16 - padded)
  }

  function createDecipheriv$2 (suite, password, iv) {
    var config = MODES[suite.toLowerCase()];
    if (!config) throw new TypeError('invalid suite type')

    if (typeof iv === 'string') iv = Buffer$f.from(iv);
    if (config.mode !== 'GCM' && iv.length !== config.iv) throw new TypeError('invalid iv length ' + iv.length)

    if (typeof password === 'string') password = Buffer$f.from(password);
    if (password.length !== config.key / 8) throw new TypeError('invalid key length ' + password.length)

    if (config.type === 'stream') {
      return new StreamCipher(config.module, password, iv, true)
    } else if (config.type === 'auth') {
      return new AuthCipher(config.module, password, iv, true)
    }

    return new Decipher(config.module, password, iv)
  }

  function createDecipher$1 (suite, password) {
    var config = MODES[suite.toLowerCase()];
    if (!config) throw new TypeError('invalid suite type')

    var keys = ebtk$1(password, false, config.key, config.iv);
    return createDecipheriv$2(suite, keys.key, keys.iv)
  }

  decrypter.createDecipher = createDecipher$1;
  decrypter.createDecipheriv = createDecipheriv$2;

  var ciphers = encrypter;
  var deciphers = decrypter;
  var modes$1 = require$$2;

  function getCiphers$1 () {
    return Object.keys(modes$1)
  }

  browser$5.createCipher = browser$5.Cipher = ciphers.createCipher;
  browser$5.createCipheriv = browser$5.Cipheriv = ciphers.createCipheriv;
  browser$5.createDecipher = browser$5.Decipher = deciphers.createDecipher;
  browser$5.createDecipheriv = browser$5.Decipheriv = deciphers.createDecipheriv;
  browser$5.listCiphers = browser$5.getCiphers = getCiphers$1;

  var modes = {};

  (function (exports) {
  	exports['des-ecb'] = {
  	  key: 8,
  	  iv: 0
  	};
  	exports['des-cbc'] = exports.des = {
  	  key: 8,
  	  iv: 8
  	};
  	exports['des-ede3-cbc'] = exports.des3 = {
  	  key: 24,
  	  iv: 8
  	};
  	exports['des-ede3'] = {
  	  key: 24,
  	  iv: 0
  	};
  	exports['des-ede-cbc'] = {
  	  key: 16,
  	  iv: 8
  	};
  	exports['des-ede'] = {
  	  key: 16,
  	  iv: 0
  	}; 
  } (modes));

  var DES = browserifyDes;
  var aes$1 = browser$5;
  var aesModes = modes_1;
  var desModes = modes;
  var ebtk = evp_bytestokey;

  function createCipher (suite, password) {
    suite = suite.toLowerCase();

    var keyLen, ivLen;
    if (aesModes[suite]) {
      keyLen = aesModes[suite].key;
      ivLen = aesModes[suite].iv;
    } else if (desModes[suite]) {
      keyLen = desModes[suite].key * 8;
      ivLen = desModes[suite].iv;
    } else {
      throw new TypeError('invalid suite type')
    }

    var keys = ebtk(password, false, keyLen, ivLen);
    return createCipheriv$1(suite, keys.key, keys.iv)
  }

  function createDecipher (suite, password) {
    suite = suite.toLowerCase();

    var keyLen, ivLen;
    if (aesModes[suite]) {
      keyLen = aesModes[suite].key;
      ivLen = aesModes[suite].iv;
    } else if (desModes[suite]) {
      keyLen = desModes[suite].key * 8;
      ivLen = desModes[suite].iv;
    } else {
      throw new TypeError('invalid suite type')
    }

    var keys = ebtk(password, false, keyLen, ivLen);
    return createDecipheriv$1(suite, keys.key, keys.iv)
  }

  function createCipheriv$1 (suite, key, iv) {
    suite = suite.toLowerCase();
    if (aesModes[suite]) return aes$1.createCipheriv(suite, key, iv)
    if (desModes[suite]) return new DES({ key: key, iv: iv, mode: suite })

    throw new TypeError('invalid suite type')
  }

  function createDecipheriv$1 (suite, key, iv) {
    suite = suite.toLowerCase();
    if (aesModes[suite]) return aes$1.createDecipheriv(suite, key, iv)
    if (desModes[suite]) return new DES({ key: key, iv: iv, mode: suite, decrypt: true })

    throw new TypeError('invalid suite type')
  }

  function getCiphers () {
    return Object.keys(desModes).concat(aes$1.getCiphers())
  }

  browser$7.createCipher = browser$7.Cipher = createCipher;
  browser$7.createCipheriv = browser$7.Cipheriv = createCipheriv$1;
  browser$7.createDecipher = browser$7.Decipher = createDecipher;
  browser$7.createDecipheriv = browser$7.Decipheriv = createDecipheriv$1;
  browser$7.listCiphers = browser$7.getCiphers = getCiphers;

  var browser$3 = {exports: {}};

  // limit of Crypto.getRandomValues()
  // https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues
  var MAX_BYTES = 65536;

  // Node supports requesting up to this number of bytes
  // https://github.com/nodejs/node/blob/master/lib/internal/crypto/random.js#L48
  var MAX_UINT32 = 4294967295;

  function oldBrowser () {
    throw new Error('Secure random number generation is not supported by this browser.\nUse Chrome, Firefox or Internet Explorer 11')
  }

  var Buffer$e = safeBufferExports.Buffer;
  var crypto = commonjsGlobal.crypto || commonjsGlobal.msCrypto;

  if (crypto && crypto.getRandomValues) {
    browser$3.exports = randomBytes$1;
  } else {
    browser$3.exports = oldBrowser;
  }

  function randomBytes$1 (size, cb) {
    // phantomjs needs to throw
    if (size > MAX_UINT32) throw new RangeError('requested too many random bytes')

    var bytes = Buffer$e.allocUnsafe(size);

    if (size > 0) {  // getRandomValues fails on IE if size == 0
      if (size > MAX_BYTES) { // this is the max bytes crypto.getRandomValues
        // can do at once see https://developer.mozilla.org/en-US/docs/Web/API/window.crypto.getRandomValues
        for (var generated = 0; generated < size; generated += MAX_BYTES) {
          // buffer.slice automatically checks if the end is past the end of
          // the buffer so we don't have to here
          crypto.getRandomValues(bytes.slice(generated, generated + MAX_BYTES));
        }
      } else {
        crypto.getRandomValues(bytes);
      }
    }

    if (typeof cb === 'function') {
      return nextTick$1(function () {
        cb(null, bytes);
      })
    }

    return bytes
  }

  var browserExports = browser$3.exports;

  var browser$2 = {};

  var MAX_ALLOC = Math.pow(2, 30) - 1; // default in iojs

  var precondition = function (iterations, keylen) {
    if (typeof iterations !== 'number') {
      throw new TypeError('Iterations not a number')
    }

    if (iterations < 0) {
      throw new TypeError('Bad iterations')
    }

    if (typeof keylen !== 'number') {
      throw new TypeError('Key length not a number')
    }

    if (keylen < 0 || keylen > MAX_ALLOC || keylen !== keylen) { /* eslint no-self-compare: 0 */
      throw new TypeError('Bad key length')
    }
  };

  var defaultEncoding$2;
  /* istanbul ignore next */
  if (commonjsGlobal.process && commonjsGlobal.process.browser) {
    defaultEncoding$2 = 'utf-8';
  } else if (commonjsGlobal.process && commonjsGlobal.process.version) {
    var pVersionMajor = parseInt(process.version.split('.')[0].slice(1), 10);

    defaultEncoding$2 = pVersionMajor >= 6 ? 'utf-8' : 'binary';
  } else {
    defaultEncoding$2 = 'utf-8';
  }
  var defaultEncoding_1 = defaultEncoding$2;

  var MD5 = md5_js;

  var md5$2 = function (buffer) {
    return new MD5().update(buffer).digest()
  };

  var Buffer$d = require$$0$1.Buffer;
  var inherits$8 = inherits_browserExports;
  var HashBase = hashBase;

  var ARRAY16 = new Array(16);

  var zl = [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
    7, 4, 13, 1, 10, 6, 15, 3, 12, 0, 9, 5, 2, 14, 11, 8,
    3, 10, 14, 4, 9, 15, 8, 1, 2, 7, 0, 6, 13, 11, 5, 12,
    1, 9, 11, 10, 0, 8, 12, 4, 13, 3, 7, 15, 14, 5, 6, 2,
    4, 0, 5, 9, 7, 12, 2, 10, 14, 1, 3, 8, 11, 6, 15, 13
  ];

  var zr = [
    5, 14, 7, 0, 9, 2, 11, 4, 13, 6, 15, 8, 1, 10, 3, 12,
    6, 11, 3, 7, 0, 13, 5, 10, 14, 15, 8, 12, 4, 9, 1, 2,
    15, 5, 1, 3, 7, 14, 6, 9, 11, 8, 12, 2, 10, 0, 4, 13,
    8, 6, 4, 1, 3, 11, 15, 0, 5, 12, 2, 13, 9, 7, 10, 14,
    12, 15, 10, 4, 1, 5, 8, 7, 6, 2, 13, 14, 0, 3, 9, 11
  ];

  var sl = [
    11, 14, 15, 12, 5, 8, 7, 9, 11, 13, 14, 15, 6, 7, 9, 8,
    7, 6, 8, 13, 11, 9, 7, 15, 7, 12, 15, 9, 11, 7, 13, 12,
    11, 13, 6, 7, 14, 9, 13, 15, 14, 8, 13, 6, 5, 12, 7, 5,
    11, 12, 14, 15, 14, 15, 9, 8, 9, 14, 5, 6, 8, 6, 5, 12,
    9, 15, 5, 11, 6, 8, 13, 12, 5, 12, 13, 14, 11, 8, 5, 6
  ];

  var sr = [
    8, 9, 9, 11, 13, 15, 15, 5, 7, 7, 8, 11, 14, 14, 12, 6,
    9, 13, 15, 7, 12, 8, 9, 11, 7, 7, 12, 7, 6, 15, 13, 11,
    9, 7, 15, 11, 8, 6, 6, 14, 12, 13, 5, 14, 13, 13, 7, 5,
    15, 5, 8, 11, 14, 14, 6, 14, 6, 9, 12, 9, 12, 5, 15, 8,
    8, 5, 12, 9, 12, 5, 14, 6, 8, 13, 6, 5, 15, 13, 11, 11
  ];

  var hl = [0x00000000, 0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xa953fd4e];
  var hr = [0x50a28be6, 0x5c4dd124, 0x6d703ef3, 0x7a6d76e9, 0x00000000];

  function RIPEMD160$2 () {
    HashBase.call(this, 64);

    // state
    this._a = 0x67452301;
    this._b = 0xefcdab89;
    this._c = 0x98badcfe;
    this._d = 0x10325476;
    this._e = 0xc3d2e1f0;
  }

  inherits$8(RIPEMD160$2, HashBase);

  RIPEMD160$2.prototype._update = function () {
    var words = ARRAY16;
    for (var j = 0; j < 16; ++j) words[j] = this._block.readInt32LE(j * 4);

    var al = this._a | 0;
    var bl = this._b | 0;
    var cl = this._c | 0;
    var dl = this._d | 0;
    var el = this._e | 0;

    var ar = this._a | 0;
    var br = this._b | 0;
    var cr = this._c | 0;
    var dr = this._d | 0;
    var er = this._e | 0;

    // computation
    for (var i = 0; i < 80; i += 1) {
      var tl;
      var tr;
      if (i < 16) {
        tl = fn1(al, bl, cl, dl, el, words[zl[i]], hl[0], sl[i]);
        tr = fn5(ar, br, cr, dr, er, words[zr[i]], hr[0], sr[i]);
      } else if (i < 32) {
        tl = fn2(al, bl, cl, dl, el, words[zl[i]], hl[1], sl[i]);
        tr = fn4(ar, br, cr, dr, er, words[zr[i]], hr[1], sr[i]);
      } else if (i < 48) {
        tl = fn3(al, bl, cl, dl, el, words[zl[i]], hl[2], sl[i]);
        tr = fn3(ar, br, cr, dr, er, words[zr[i]], hr[2], sr[i]);
      } else if (i < 64) {
        tl = fn4(al, bl, cl, dl, el, words[zl[i]], hl[3], sl[i]);
        tr = fn2(ar, br, cr, dr, er, words[zr[i]], hr[3], sr[i]);
      } else { // if (i<80) {
        tl = fn5(al, bl, cl, dl, el, words[zl[i]], hl[4], sl[i]);
        tr = fn1(ar, br, cr, dr, er, words[zr[i]], hr[4], sr[i]);
      }

      al = el;
      el = dl;
      dl = rotl(cl, 10);
      cl = bl;
      bl = tl;

      ar = er;
      er = dr;
      dr = rotl(cr, 10);
      cr = br;
      br = tr;
    }

    // update state
    var t = (this._b + cl + dr) | 0;
    this._b = (this._c + dl + er) | 0;
    this._c = (this._d + el + ar) | 0;
    this._d = (this._e + al + br) | 0;
    this._e = (this._a + bl + cr) | 0;
    this._a = t;
  };

  RIPEMD160$2.prototype._digest = function () {
    // create padding and handle blocks
    this._block[this._blockOffset++] = 0x80;
    if (this._blockOffset > 56) {
      this._block.fill(0, this._blockOffset, 64);
      this._update();
      this._blockOffset = 0;
    }

    this._block.fill(0, this._blockOffset, 56);
    this._block.writeUInt32LE(this._length[0], 56);
    this._block.writeUInt32LE(this._length[1], 60);
    this._update();

    // produce result
    var buffer = Buffer$d.alloc ? Buffer$d.alloc(20) : new Buffer$d(20);
    buffer.writeInt32LE(this._a, 0);
    buffer.writeInt32LE(this._b, 4);
    buffer.writeInt32LE(this._c, 8);
    buffer.writeInt32LE(this._d, 12);
    buffer.writeInt32LE(this._e, 16);
    return buffer
  };

  function rotl (x, n) {
    return (x << n) | (x >>> (32 - n))
  }

  function fn1 (a, b, c, d, e, m, k, s) {
    return (rotl((a + (b ^ c ^ d) + m + k) | 0, s) + e) | 0
  }

  function fn2 (a, b, c, d, e, m, k, s) {
    return (rotl((a + ((b & c) | ((~b) & d)) + m + k) | 0, s) + e) | 0
  }

  function fn3 (a, b, c, d, e, m, k, s) {
    return (rotl((a + ((b | (~c)) ^ d) + m + k) | 0, s) + e) | 0
  }

  function fn4 (a, b, c, d, e, m, k, s) {
    return (rotl((a + ((b & d) | (c & (~d))) + m + k) | 0, s) + e) | 0
  }

  function fn5 (a, b, c, d, e, m, k, s) {
    return (rotl((a + (b ^ (c | (~d))) + m + k) | 0, s) + e) | 0
  }

  var ripemd160 = RIPEMD160$2;

  var sha_js = {exports: {}};

  var Buffer$c = safeBufferExports.Buffer;

  // prototype class for hash functions
  function Hash$6 (blockSize, finalSize) {
    this._block = Buffer$c.alloc(blockSize);
    this._finalSize = finalSize;
    this._blockSize = blockSize;
    this._len = 0;
  }

  Hash$6.prototype.update = function (data, enc) {
    if (typeof data === 'string') {
      enc = enc || 'utf8';
      data = Buffer$c.from(data, enc);
    }

    var block = this._block;
    var blockSize = this._blockSize;
    var length = data.length;
    var accum = this._len;

    for (var offset = 0; offset < length;) {
      var assigned = accum % blockSize;
      var remainder = Math.min(length - offset, blockSize - assigned);

      for (var i = 0; i < remainder; i++) {
        block[assigned + i] = data[offset + i];
      }

      accum += remainder;
      offset += remainder;

      if ((accum % blockSize) === 0) {
        this._update(block);
      }
    }

    this._len += length;
    return this
  };

  Hash$6.prototype.digest = function (enc) {
    var rem = this._len % this._blockSize;

    this._block[rem] = 0x80;

    // zero (rem + 1) trailing bits, where (rem + 1) is the smallest
    // non-negative solution to the equation (length + 1 + (rem + 1)) === finalSize mod blockSize
    this._block.fill(0, rem + 1);

    if (rem >= this._finalSize) {
      this._update(this._block);
      this._block.fill(0);
    }

    var bits = this._len * 8;

    // uint32
    if (bits <= 0xffffffff) {
      this._block.writeUInt32BE(bits, this._blockSize - 4);

    // uint64
    } else {
      var lowBits = (bits & 0xffffffff) >>> 0;
      var highBits = (bits - lowBits) / 0x100000000;

      this._block.writeUInt32BE(highBits, this._blockSize - 8);
      this._block.writeUInt32BE(lowBits, this._blockSize - 4);
    }

    this._update(this._block);
    var hash = this._hash();

    return enc ? hash.toString(enc) : hash
  };

  Hash$6.prototype._update = function () {
    throw new Error('_update must be implemented by subclass')
  };

  var hash = Hash$6;

  /*
   * A JavaScript implementation of the Secure Hash Algorithm, SHA-0, as defined
   * in FIPS PUB 180-1
   * This source code is derived from sha1.js of the same repository.
   * The difference between SHA-0 and SHA-1 is just a bitwise rotate left
   * operation was added.
   */

  var inherits$7 = inherits_browserExports;
  var Hash$5 = hash;
  var Buffer$b = safeBufferExports.Buffer;

  var K$3 = [
    0x5a827999, 0x6ed9eba1, 0x8f1bbcdc | 0, 0xca62c1d6 | 0
  ];

  var W$5 = new Array(80);

  function Sha () {
    this.init();
    this._w = W$5;

    Hash$5.call(this, 64, 56);
  }

  inherits$7(Sha, Hash$5);

  Sha.prototype.init = function () {
    this._a = 0x67452301;
    this._b = 0xefcdab89;
    this._c = 0x98badcfe;
    this._d = 0x10325476;
    this._e = 0xc3d2e1f0;

    return this
  };

  function rotl5$1 (num) {
    return (num << 5) | (num >>> 27)
  }

  function rotl30$1 (num) {
    return (num << 30) | (num >>> 2)
  }

  function ft$1 (s, b, c, d) {
    if (s === 0) return (b & c) | ((~b) & d)
    if (s === 2) return (b & c) | (b & d) | (c & d)
    return b ^ c ^ d
  }

  Sha.prototype._update = function (M) {
    var W = this._w;

    var a = this._a | 0;
    var b = this._b | 0;
    var c = this._c | 0;
    var d = this._d | 0;
    var e = this._e | 0;

    for (var i = 0; i < 16; ++i) W[i] = M.readInt32BE(i * 4);
    for (; i < 80; ++i) W[i] = W[i - 3] ^ W[i - 8] ^ W[i - 14] ^ W[i - 16];

    for (var j = 0; j < 80; ++j) {
      var s = ~~(j / 20);
      var t = (rotl5$1(a) + ft$1(s, b, c, d) + e + W[j] + K$3[s]) | 0;

      e = d;
      d = c;
      c = rotl30$1(b);
      b = a;
      a = t;
    }

    this._a = (a + this._a) | 0;
    this._b = (b + this._b) | 0;
    this._c = (c + this._c) | 0;
    this._d = (d + this._d) | 0;
    this._e = (e + this._e) | 0;
  };

  Sha.prototype._hash = function () {
    var H = Buffer$b.allocUnsafe(20);

    H.writeInt32BE(this._a | 0, 0);
    H.writeInt32BE(this._b | 0, 4);
    H.writeInt32BE(this._c | 0, 8);
    H.writeInt32BE(this._d | 0, 12);
    H.writeInt32BE(this._e | 0, 16);

    return H
  };

  var sha$2 = Sha;

  /*
   * A JavaScript implementation of the Secure Hash Algorithm, SHA-1, as defined
   * in FIPS PUB 180-1
   * Version 2.1a Copyright Paul Johnston 2000 - 2002.
   * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
   * Distributed under the BSD License
   * See http://pajhome.org.uk/crypt/md5 for details.
   */

  var inherits$6 = inherits_browserExports;
  var Hash$4 = hash;
  var Buffer$a = safeBufferExports.Buffer;

  var K$2 = [
    0x5a827999, 0x6ed9eba1, 0x8f1bbcdc | 0, 0xca62c1d6 | 0
  ];

  var W$4 = new Array(80);

  function Sha1 () {
    this.init();
    this._w = W$4;

    Hash$4.call(this, 64, 56);
  }

  inherits$6(Sha1, Hash$4);

  Sha1.prototype.init = function () {
    this._a = 0x67452301;
    this._b = 0xefcdab89;
    this._c = 0x98badcfe;
    this._d = 0x10325476;
    this._e = 0xc3d2e1f0;

    return this
  };

  function rotl1 (num) {
    return (num << 1) | (num >>> 31)
  }

  function rotl5 (num) {
    return (num << 5) | (num >>> 27)
  }

  function rotl30 (num) {
    return (num << 30) | (num >>> 2)
  }

  function ft (s, b, c, d) {
    if (s === 0) return (b & c) | ((~b) & d)
    if (s === 2) return (b & c) | (b & d) | (c & d)
    return b ^ c ^ d
  }

  Sha1.prototype._update = function (M) {
    var W = this._w;

    var a = this._a | 0;
    var b = this._b | 0;
    var c = this._c | 0;
    var d = this._d | 0;
    var e = this._e | 0;

    for (var i = 0; i < 16; ++i) W[i] = M.readInt32BE(i * 4);
    for (; i < 80; ++i) W[i] = rotl1(W[i - 3] ^ W[i - 8] ^ W[i - 14] ^ W[i - 16]);

    for (var j = 0; j < 80; ++j) {
      var s = ~~(j / 20);
      var t = (rotl5(a) + ft(s, b, c, d) + e + W[j] + K$2[s]) | 0;

      e = d;
      d = c;
      c = rotl30(b);
      b = a;
      a = t;
    }

    this._a = (a + this._a) | 0;
    this._b = (b + this._b) | 0;
    this._c = (c + this._c) | 0;
    this._d = (d + this._d) | 0;
    this._e = (e + this._e) | 0;
  };

  Sha1.prototype._hash = function () {
    var H = Buffer$a.allocUnsafe(20);

    H.writeInt32BE(this._a | 0, 0);
    H.writeInt32BE(this._b | 0, 4);
    H.writeInt32BE(this._c | 0, 8);
    H.writeInt32BE(this._d | 0, 12);
    H.writeInt32BE(this._e | 0, 16);

    return H
  };

  var sha1 = Sha1;

  /**
   * A JavaScript implementation of the Secure Hash Algorithm, SHA-256, as defined
   * in FIPS 180-2
   * Version 2.2-beta Copyright Angel Marin, Paul Johnston 2000 - 2009.
   * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
   *
   */

  var inherits$5 = inherits_browserExports;
  var Hash$3 = hash;
  var Buffer$9 = safeBufferExports.Buffer;

  var K$1 = [
    0x428A2F98, 0x71374491, 0xB5C0FBCF, 0xE9B5DBA5,
    0x3956C25B, 0x59F111F1, 0x923F82A4, 0xAB1C5ED5,
    0xD807AA98, 0x12835B01, 0x243185BE, 0x550C7DC3,
    0x72BE5D74, 0x80DEB1FE, 0x9BDC06A7, 0xC19BF174,
    0xE49B69C1, 0xEFBE4786, 0x0FC19DC6, 0x240CA1CC,
    0x2DE92C6F, 0x4A7484AA, 0x5CB0A9DC, 0x76F988DA,
    0x983E5152, 0xA831C66D, 0xB00327C8, 0xBF597FC7,
    0xC6E00BF3, 0xD5A79147, 0x06CA6351, 0x14292967,
    0x27B70A85, 0x2E1B2138, 0x4D2C6DFC, 0x53380D13,
    0x650A7354, 0x766A0ABB, 0x81C2C92E, 0x92722C85,
    0xA2BFE8A1, 0xA81A664B, 0xC24B8B70, 0xC76C51A3,
    0xD192E819, 0xD6990624, 0xF40E3585, 0x106AA070,
    0x19A4C116, 0x1E376C08, 0x2748774C, 0x34B0BCB5,
    0x391C0CB3, 0x4ED8AA4A, 0x5B9CCA4F, 0x682E6FF3,
    0x748F82EE, 0x78A5636F, 0x84C87814, 0x8CC70208,
    0x90BEFFFA, 0xA4506CEB, 0xBEF9A3F7, 0xC67178F2
  ];

  var W$3 = new Array(64);

  function Sha256$1 () {
    this.init();

    this._w = W$3; // new Array(64)

    Hash$3.call(this, 64, 56);
  }

  inherits$5(Sha256$1, Hash$3);

  Sha256$1.prototype.init = function () {
    this._a = 0x6a09e667;
    this._b = 0xbb67ae85;
    this._c = 0x3c6ef372;
    this._d = 0xa54ff53a;
    this._e = 0x510e527f;
    this._f = 0x9b05688c;
    this._g = 0x1f83d9ab;
    this._h = 0x5be0cd19;

    return this
  };

  function ch (x, y, z) {
    return z ^ (x & (y ^ z))
  }

  function maj$1 (x, y, z) {
    return (x & y) | (z & (x | y))
  }

  function sigma0$1 (x) {
    return (x >>> 2 | x << 30) ^ (x >>> 13 | x << 19) ^ (x >>> 22 | x << 10)
  }

  function sigma1$1 (x) {
    return (x >>> 6 | x << 26) ^ (x >>> 11 | x << 21) ^ (x >>> 25 | x << 7)
  }

  function gamma0 (x) {
    return (x >>> 7 | x << 25) ^ (x >>> 18 | x << 14) ^ (x >>> 3)
  }

  function gamma1 (x) {
    return (x >>> 17 | x << 15) ^ (x >>> 19 | x << 13) ^ (x >>> 10)
  }

  Sha256$1.prototype._update = function (M) {
    var W = this._w;

    var a = this._a | 0;
    var b = this._b | 0;
    var c = this._c | 0;
    var d = this._d | 0;
    var e = this._e | 0;
    var f = this._f | 0;
    var g = this._g | 0;
    var h = this._h | 0;

    for (var i = 0; i < 16; ++i) W[i] = M.readInt32BE(i * 4);
    for (; i < 64; ++i) W[i] = (gamma1(W[i - 2]) + W[i - 7] + gamma0(W[i - 15]) + W[i - 16]) | 0;

    for (var j = 0; j < 64; ++j) {
      var T1 = (h + sigma1$1(e) + ch(e, f, g) + K$1[j] + W[j]) | 0;
      var T2 = (sigma0$1(a) + maj$1(a, b, c)) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + T1) | 0;
      d = c;
      c = b;
      b = a;
      a = (T1 + T2) | 0;
    }

    this._a = (a + this._a) | 0;
    this._b = (b + this._b) | 0;
    this._c = (c + this._c) | 0;
    this._d = (d + this._d) | 0;
    this._e = (e + this._e) | 0;
    this._f = (f + this._f) | 0;
    this._g = (g + this._g) | 0;
    this._h = (h + this._h) | 0;
  };

  Sha256$1.prototype._hash = function () {
    var H = Buffer$9.allocUnsafe(32);

    H.writeInt32BE(this._a, 0);
    H.writeInt32BE(this._b, 4);
    H.writeInt32BE(this._c, 8);
    H.writeInt32BE(this._d, 12);
    H.writeInt32BE(this._e, 16);
    H.writeInt32BE(this._f, 20);
    H.writeInt32BE(this._g, 24);
    H.writeInt32BE(this._h, 28);

    return H
  };

  var sha256 = Sha256$1;

  /**
   * A JavaScript implementation of the Secure Hash Algorithm, SHA-256, as defined
   * in FIPS 180-2
   * Version 2.2-beta Copyright Angel Marin, Paul Johnston 2000 - 2009.
   * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
   *
   */

  var inherits$4 = inherits_browserExports;
  var Sha256 = sha256;
  var Hash$2 = hash;
  var Buffer$8 = safeBufferExports.Buffer;

  var W$2 = new Array(64);

  function Sha224 () {
    this.init();

    this._w = W$2; // new Array(64)

    Hash$2.call(this, 64, 56);
  }

  inherits$4(Sha224, Sha256);

  Sha224.prototype.init = function () {
    this._a = 0xc1059ed8;
    this._b = 0x367cd507;
    this._c = 0x3070dd17;
    this._d = 0xf70e5939;
    this._e = 0xffc00b31;
    this._f = 0x68581511;
    this._g = 0x64f98fa7;
    this._h = 0xbefa4fa4;

    return this
  };

  Sha224.prototype._hash = function () {
    var H = Buffer$8.allocUnsafe(28);

    H.writeInt32BE(this._a, 0);
    H.writeInt32BE(this._b, 4);
    H.writeInt32BE(this._c, 8);
    H.writeInt32BE(this._d, 12);
    H.writeInt32BE(this._e, 16);
    H.writeInt32BE(this._f, 20);
    H.writeInt32BE(this._g, 24);

    return H
  };

  var sha224 = Sha224;

  var inherits$3 = inherits_browserExports;
  var Hash$1 = hash;
  var Buffer$7 = safeBufferExports.Buffer;

  var K = [
    0x428a2f98, 0xd728ae22, 0x71374491, 0x23ef65cd,
    0xb5c0fbcf, 0xec4d3b2f, 0xe9b5dba5, 0x8189dbbc,
    0x3956c25b, 0xf348b538, 0x59f111f1, 0xb605d019,
    0x923f82a4, 0xaf194f9b, 0xab1c5ed5, 0xda6d8118,
    0xd807aa98, 0xa3030242, 0x12835b01, 0x45706fbe,
    0x243185be, 0x4ee4b28c, 0x550c7dc3, 0xd5ffb4e2,
    0x72be5d74, 0xf27b896f, 0x80deb1fe, 0x3b1696b1,
    0x9bdc06a7, 0x25c71235, 0xc19bf174, 0xcf692694,
    0xe49b69c1, 0x9ef14ad2, 0xefbe4786, 0x384f25e3,
    0x0fc19dc6, 0x8b8cd5b5, 0x240ca1cc, 0x77ac9c65,
    0x2de92c6f, 0x592b0275, 0x4a7484aa, 0x6ea6e483,
    0x5cb0a9dc, 0xbd41fbd4, 0x76f988da, 0x831153b5,
    0x983e5152, 0xee66dfab, 0xa831c66d, 0x2db43210,
    0xb00327c8, 0x98fb213f, 0xbf597fc7, 0xbeef0ee4,
    0xc6e00bf3, 0x3da88fc2, 0xd5a79147, 0x930aa725,
    0x06ca6351, 0xe003826f, 0x14292967, 0x0a0e6e70,
    0x27b70a85, 0x46d22ffc, 0x2e1b2138, 0x5c26c926,
    0x4d2c6dfc, 0x5ac42aed, 0x53380d13, 0x9d95b3df,
    0x650a7354, 0x8baf63de, 0x766a0abb, 0x3c77b2a8,
    0x81c2c92e, 0x47edaee6, 0x92722c85, 0x1482353b,
    0xa2bfe8a1, 0x4cf10364, 0xa81a664b, 0xbc423001,
    0xc24b8b70, 0xd0f89791, 0xc76c51a3, 0x0654be30,
    0xd192e819, 0xd6ef5218, 0xd6990624, 0x5565a910,
    0xf40e3585, 0x5771202a, 0x106aa070, 0x32bbd1b8,
    0x19a4c116, 0xb8d2d0c8, 0x1e376c08, 0x5141ab53,
    0x2748774c, 0xdf8eeb99, 0x34b0bcb5, 0xe19b48a8,
    0x391c0cb3, 0xc5c95a63, 0x4ed8aa4a, 0xe3418acb,
    0x5b9cca4f, 0x7763e373, 0x682e6ff3, 0xd6b2b8a3,
    0x748f82ee, 0x5defb2fc, 0x78a5636f, 0x43172f60,
    0x84c87814, 0xa1f0ab72, 0x8cc70208, 0x1a6439ec,
    0x90befffa, 0x23631e28, 0xa4506ceb, 0xde82bde9,
    0xbef9a3f7, 0xb2c67915, 0xc67178f2, 0xe372532b,
    0xca273ece, 0xea26619c, 0xd186b8c7, 0x21c0c207,
    0xeada7dd6, 0xcde0eb1e, 0xf57d4f7f, 0xee6ed178,
    0x06f067aa, 0x72176fba, 0x0a637dc5, 0xa2c898a6,
    0x113f9804, 0xbef90dae, 0x1b710b35, 0x131c471b,
    0x28db77f5, 0x23047d84, 0x32caab7b, 0x40c72493,
    0x3c9ebe0a, 0x15c9bebc, 0x431d67c4, 0x9c100d4c,
    0x4cc5d4be, 0xcb3e42b6, 0x597f299c, 0xfc657e2a,
    0x5fcb6fab, 0x3ad6faec, 0x6c44198c, 0x4a475817
  ];

  var W$1 = new Array(160);

  function Sha512 () {
    this.init();
    this._w = W$1;

    Hash$1.call(this, 128, 112);
  }

  inherits$3(Sha512, Hash$1);

  Sha512.prototype.init = function () {
    this._ah = 0x6a09e667;
    this._bh = 0xbb67ae85;
    this._ch = 0x3c6ef372;
    this._dh = 0xa54ff53a;
    this._eh = 0x510e527f;
    this._fh = 0x9b05688c;
    this._gh = 0x1f83d9ab;
    this._hh = 0x5be0cd19;

    this._al = 0xf3bcc908;
    this._bl = 0x84caa73b;
    this._cl = 0xfe94f82b;
    this._dl = 0x5f1d36f1;
    this._el = 0xade682d1;
    this._fl = 0x2b3e6c1f;
    this._gl = 0xfb41bd6b;
    this._hl = 0x137e2179;

    return this
  };

  function Ch (x, y, z) {
    return z ^ (x & (y ^ z))
  }

  function maj (x, y, z) {
    return (x & y) | (z & (x | y))
  }

  function sigma0 (x, xl) {
    return (x >>> 28 | xl << 4) ^ (xl >>> 2 | x << 30) ^ (xl >>> 7 | x << 25)
  }

  function sigma1 (x, xl) {
    return (x >>> 14 | xl << 18) ^ (x >>> 18 | xl << 14) ^ (xl >>> 9 | x << 23)
  }

  function Gamma0 (x, xl) {
    return (x >>> 1 | xl << 31) ^ (x >>> 8 | xl << 24) ^ (x >>> 7)
  }

  function Gamma0l (x, xl) {
    return (x >>> 1 | xl << 31) ^ (x >>> 8 | xl << 24) ^ (x >>> 7 | xl << 25)
  }

  function Gamma1 (x, xl) {
    return (x >>> 19 | xl << 13) ^ (xl >>> 29 | x << 3) ^ (x >>> 6)
  }

  function Gamma1l (x, xl) {
    return (x >>> 19 | xl << 13) ^ (xl >>> 29 | x << 3) ^ (x >>> 6 | xl << 26)
  }

  function getCarry (a, b) {
    return (a >>> 0) < (b >>> 0) ? 1 : 0
  }

  Sha512.prototype._update = function (M) {
    var W = this._w;

    var ah = this._ah | 0;
    var bh = this._bh | 0;
    var ch = this._ch | 0;
    var dh = this._dh | 0;
    var eh = this._eh | 0;
    var fh = this._fh | 0;
    var gh = this._gh | 0;
    var hh = this._hh | 0;

    var al = this._al | 0;
    var bl = this._bl | 0;
    var cl = this._cl | 0;
    var dl = this._dl | 0;
    var el = this._el | 0;
    var fl = this._fl | 0;
    var gl = this._gl | 0;
    var hl = this._hl | 0;

    for (var i = 0; i < 32; i += 2) {
      W[i] = M.readInt32BE(i * 4);
      W[i + 1] = M.readInt32BE(i * 4 + 4);
    }
    for (; i < 160; i += 2) {
      var xh = W[i - 15 * 2];
      var xl = W[i - 15 * 2 + 1];
      var gamma0 = Gamma0(xh, xl);
      var gamma0l = Gamma0l(xl, xh);

      xh = W[i - 2 * 2];
      xl = W[i - 2 * 2 + 1];
      var gamma1 = Gamma1(xh, xl);
      var gamma1l = Gamma1l(xl, xh);

      // W[i] = gamma0 + W[i - 7] + gamma1 + W[i - 16]
      var Wi7h = W[i - 7 * 2];
      var Wi7l = W[i - 7 * 2 + 1];

      var Wi16h = W[i - 16 * 2];
      var Wi16l = W[i - 16 * 2 + 1];

      var Wil = (gamma0l + Wi7l) | 0;
      var Wih = (gamma0 + Wi7h + getCarry(Wil, gamma0l)) | 0;
      Wil = (Wil + gamma1l) | 0;
      Wih = (Wih + gamma1 + getCarry(Wil, gamma1l)) | 0;
      Wil = (Wil + Wi16l) | 0;
      Wih = (Wih + Wi16h + getCarry(Wil, Wi16l)) | 0;

      W[i] = Wih;
      W[i + 1] = Wil;
    }

    for (var j = 0; j < 160; j += 2) {
      Wih = W[j];
      Wil = W[j + 1];

      var majh = maj(ah, bh, ch);
      var majl = maj(al, bl, cl);

      var sigma0h = sigma0(ah, al);
      var sigma0l = sigma0(al, ah);
      var sigma1h = sigma1(eh, el);
      var sigma1l = sigma1(el, eh);

      // t1 = h + sigma1 + ch + K[j] + W[j]
      var Kih = K[j];
      var Kil = K[j + 1];

      var chh = Ch(eh, fh, gh);
      var chl = Ch(el, fl, gl);

      var t1l = (hl + sigma1l) | 0;
      var t1h = (hh + sigma1h + getCarry(t1l, hl)) | 0;
      t1l = (t1l + chl) | 0;
      t1h = (t1h + chh + getCarry(t1l, chl)) | 0;
      t1l = (t1l + Kil) | 0;
      t1h = (t1h + Kih + getCarry(t1l, Kil)) | 0;
      t1l = (t1l + Wil) | 0;
      t1h = (t1h + Wih + getCarry(t1l, Wil)) | 0;

      // t2 = sigma0 + maj
      var t2l = (sigma0l + majl) | 0;
      var t2h = (sigma0h + majh + getCarry(t2l, sigma0l)) | 0;

      hh = gh;
      hl = gl;
      gh = fh;
      gl = fl;
      fh = eh;
      fl = el;
      el = (dl + t1l) | 0;
      eh = (dh + t1h + getCarry(el, dl)) | 0;
      dh = ch;
      dl = cl;
      ch = bh;
      cl = bl;
      bh = ah;
      bl = al;
      al = (t1l + t2l) | 0;
      ah = (t1h + t2h + getCarry(al, t1l)) | 0;
    }

    this._al = (this._al + al) | 0;
    this._bl = (this._bl + bl) | 0;
    this._cl = (this._cl + cl) | 0;
    this._dl = (this._dl + dl) | 0;
    this._el = (this._el + el) | 0;
    this._fl = (this._fl + fl) | 0;
    this._gl = (this._gl + gl) | 0;
    this._hl = (this._hl + hl) | 0;

    this._ah = (this._ah + ah + getCarry(this._al, al)) | 0;
    this._bh = (this._bh + bh + getCarry(this._bl, bl)) | 0;
    this._ch = (this._ch + ch + getCarry(this._cl, cl)) | 0;
    this._dh = (this._dh + dh + getCarry(this._dl, dl)) | 0;
    this._eh = (this._eh + eh + getCarry(this._el, el)) | 0;
    this._fh = (this._fh + fh + getCarry(this._fl, fl)) | 0;
    this._gh = (this._gh + gh + getCarry(this._gl, gl)) | 0;
    this._hh = (this._hh + hh + getCarry(this._hl, hl)) | 0;
  };

  Sha512.prototype._hash = function () {
    var H = Buffer$7.allocUnsafe(64);

    function writeInt64BE (h, l, offset) {
      H.writeInt32BE(h, offset);
      H.writeInt32BE(l, offset + 4);
    }

    writeInt64BE(this._ah, this._al, 0);
    writeInt64BE(this._bh, this._bl, 8);
    writeInt64BE(this._ch, this._cl, 16);
    writeInt64BE(this._dh, this._dl, 24);
    writeInt64BE(this._eh, this._el, 32);
    writeInt64BE(this._fh, this._fl, 40);
    writeInt64BE(this._gh, this._gl, 48);
    writeInt64BE(this._hh, this._hl, 56);

    return H
  };

  var sha512 = Sha512;

  var inherits$2 = inherits_browserExports;
  var SHA512 = sha512;
  var Hash = hash;
  var Buffer$6 = safeBufferExports.Buffer;

  var W = new Array(160);

  function Sha384 () {
    this.init();
    this._w = W;

    Hash.call(this, 128, 112);
  }

  inherits$2(Sha384, SHA512);

  Sha384.prototype.init = function () {
    this._ah = 0xcbbb9d5d;
    this._bh = 0x629a292a;
    this._ch = 0x9159015a;
    this._dh = 0x152fecd8;
    this._eh = 0x67332667;
    this._fh = 0x8eb44a87;
    this._gh = 0xdb0c2e0d;
    this._hh = 0x47b5481d;

    this._al = 0xc1059ed8;
    this._bl = 0x367cd507;
    this._cl = 0x3070dd17;
    this._dl = 0xf70e5939;
    this._el = 0xffc00b31;
    this._fl = 0x68581511;
    this._gl = 0x64f98fa7;
    this._hl = 0xbefa4fa4;

    return this
  };

  Sha384.prototype._hash = function () {
    var H = Buffer$6.allocUnsafe(48);

    function writeInt64BE (h, l, offset) {
      H.writeInt32BE(h, offset);
      H.writeInt32BE(l, offset + 4);
    }

    writeInt64BE(this._ah, this._al, 0);
    writeInt64BE(this._bh, this._bl, 8);
    writeInt64BE(this._ch, this._cl, 16);
    writeInt64BE(this._dh, this._dl, 24);
    writeInt64BE(this._eh, this._el, 32);
    writeInt64BE(this._fh, this._fl, 40);

    return H
  };

  var sha384 = Sha384;

  var exports$1 = sha_js.exports = function SHA (algorithm) {
    algorithm = algorithm.toLowerCase();

    var Algorithm = exports$1[algorithm];
    if (!Algorithm) throw new Error(algorithm + ' is not supported (we accept pull requests)')

    return new Algorithm()
  };

  exports$1.sha = sha$2;
  exports$1.sha1 = sha1;
  exports$1.sha224 = sha224;
  exports$1.sha256 = sha256;
  exports$1.sha384 = sha384;
  exports$1.sha512 = sha512;

  var sha_jsExports = sha_js.exports;

  var Buffer$5 = safeBufferExports.Buffer;

  var toBuffer$4 = function (thing, encoding, name) {
    if (Buffer$5.isBuffer(thing)) {
      return thing
    } else if (typeof thing === 'string') {
      return Buffer$5.from(thing, encoding)
    } else if (ArrayBuffer.isView(thing)) {
      return Buffer$5.from(thing.buffer)
    } else {
      throw new TypeError(name + ' must be a string, a Buffer, a typed array or a DataView')
    }
  };

  var md5$1 = md5$2;
  var RIPEMD160$1 = ripemd160;
  var sha$1 = sha_jsExports;
  var Buffer$4 = safeBufferExports.Buffer;

  var checkParameters$1 = precondition;
  var defaultEncoding$1 = defaultEncoding_1;
  var toBuffer$3 = toBuffer$4;

  var ZEROS$2 = Buffer$4.alloc(128);
  var sizes = {
    md5: 16,
    sha1: 20,
    sha224: 28,
    sha256: 32,
    sha384: 48,
    sha512: 64,
    rmd160: 20,
    ripemd160: 20
  };

  function Hmac$2 (alg, key, saltLen) {
    var hash = getDigest(alg);
    var blocksize = (alg === 'sha512' || alg === 'sha384') ? 128 : 64;

    if (key.length > blocksize) {
      key = hash(key);
    } else if (key.length < blocksize) {
      key = Buffer$4.concat([key, ZEROS$2], blocksize);
    }

    var ipad = Buffer$4.allocUnsafe(blocksize + sizes[alg]);
    var opad = Buffer$4.allocUnsafe(blocksize + sizes[alg]);
    for (var i = 0; i < blocksize; i++) {
      ipad[i] = key[i] ^ 0x36;
      opad[i] = key[i] ^ 0x5C;
    }

    var ipad1 = Buffer$4.allocUnsafe(blocksize + saltLen + 4);
    ipad.copy(ipad1, 0, 0, blocksize);
    this.ipad1 = ipad1;
    this.ipad2 = ipad;
    this.opad = opad;
    this.alg = alg;
    this.blocksize = blocksize;
    this.hash = hash;
    this.size = sizes[alg];
  }

  Hmac$2.prototype.run = function (data, ipad) {
    data.copy(ipad, this.blocksize);
    var h = this.hash(ipad);
    h.copy(this.opad, this.blocksize);
    return this.hash(this.opad)
  };

  function getDigest (alg) {
    function shaFunc (data) {
      return sha$1(alg).update(data).digest()
    }
    function rmd160Func (data) {
      return new RIPEMD160$1().update(data).digest()
    }

    if (alg === 'rmd160' || alg === 'ripemd160') return rmd160Func
    if (alg === 'md5') return md5$1
    return shaFunc
  }

  function pbkdf2 (password, salt, iterations, keylen, digest) {
    checkParameters$1(iterations, keylen);
    password = toBuffer$3(password, defaultEncoding$1, 'Password');
    salt = toBuffer$3(salt, defaultEncoding$1, 'Salt');

    digest = digest || 'sha1';

    var hmac = new Hmac$2(digest, password, salt.length);

    var DK = Buffer$4.allocUnsafe(keylen);
    var block1 = Buffer$4.allocUnsafe(salt.length + 4);
    salt.copy(block1, 0, 0, salt.length);

    var destPos = 0;
    var hLen = sizes[digest];
    var l = Math.ceil(keylen / hLen);

    for (var i = 1; i <= l; i++) {
      block1.writeUInt32BE(i, salt.length);

      var T = hmac.run(block1, hmac.ipad1);
      var U = T;

      for (var j = 1; j < iterations; j++) {
        U = hmac.run(U, hmac.ipad2);
        for (var k = 0; k < hLen; k++) T[k] ^= U[k];
      }

      T.copy(DK, destPos);
      destPos += hLen;
    }

    return DK
  }

  var syncBrowser = pbkdf2;

  var Buffer$3 = safeBufferExports.Buffer;

  var checkParameters = precondition;
  var defaultEncoding = defaultEncoding_1;
  var sync = syncBrowser;
  var toBuffer$2 = toBuffer$4;

  var ZERO_BUF;
  var subtle = commonjsGlobal.crypto && commonjsGlobal.crypto.subtle;
  var toBrowser = {
    sha: 'SHA-1',
    'sha-1': 'SHA-1',
    sha1: 'SHA-1',
    sha256: 'SHA-256',
    'sha-256': 'SHA-256',
    sha384: 'SHA-384',
    'sha-384': 'SHA-384',
    'sha-512': 'SHA-512',
    sha512: 'SHA-512'
  };
  var checks = [];
  function checkNative (algo) {
    if (commonjsGlobal.process && !commonjsGlobal.process.browser) {
      return Promise.resolve(false)
    }
    if (!subtle || !subtle.importKey || !subtle.deriveBits) {
      return Promise.resolve(false)
    }
    if (checks[algo] !== undefined) {
      return checks[algo]
    }
    ZERO_BUF = ZERO_BUF || Buffer$3.alloc(8);
    var prom = browserPbkdf2(ZERO_BUF, ZERO_BUF, 10, 128, algo)
      .then(function () {
        return true
      }).catch(function () {
        return false
      });
    checks[algo] = prom;
    return prom
  }
  var nextTick;
  function getNextTick () {
    if (nextTick) {
      return nextTick
    }
    if (commonjsGlobal.process && commonjsGlobal.process.nextTick) {
      nextTick = commonjsGlobal.process.nextTick;
    } else if (commonjsGlobal.queueMicrotask) {
      nextTick = commonjsGlobal.queueMicrotask;
    } else if (commonjsGlobal.setImmediate) {
      nextTick = commonjsGlobal.setImmediate;
    } else {
      nextTick = commonjsGlobal.setTimeout;
    }
    return nextTick
  }
  function browserPbkdf2 (password, salt, iterations, length, algo) {
    return subtle.importKey(
      'raw', password, { name: 'PBKDF2' }, false, ['deriveBits']
    ).then(function (key) {
      return subtle.deriveBits({
        name: 'PBKDF2',
        salt: salt,
        iterations: iterations,
        hash: {
          name: algo
        }
      }, key, length << 3)
    }).then(function (res) {
      return Buffer$3.from(res)
    })
  }

  function resolvePromise (promise, callback) {
    promise.then(function (out) {
      getNextTick()(function () {
        callback(null, out);
      });
    }, function (e) {
      getNextTick()(function () {
        callback(e);
      });
    });
  }
  var async = function (password, salt, iterations, keylen, digest, callback) {
    if (typeof digest === 'function') {
      callback = digest;
      digest = undefined;
    }

    digest = digest || 'sha1';
    var algo = toBrowser[digest.toLowerCase()];

    if (!algo || typeof commonjsGlobal.Promise !== 'function') {
      getNextTick()(function () {
        var out;
        try {
          out = sync(password, salt, iterations, keylen, digest);
        } catch (e) {
          return callback(e)
        }
        callback(null, out);
      });
      return
    }

    checkParameters(iterations, keylen);
    password = toBuffer$2(password, defaultEncoding, 'Password');
    salt = toBuffer$2(salt, defaultEncoding, 'Salt');
    if (typeof callback !== 'function') throw new Error('No callback provided to pbkdf2')

    resolvePromise(checkNative(algo).then(function (resp) {
      if (resp) return browserPbkdf2(password, salt, iterations, keylen, algo)

      return sync(password, salt, iterations, keylen, digest)
    }), callback);
  };

  browser$2.pbkdf2 = async;
  browser$2.pbkdf2Sync = syncBrowser;

  var inherits$1 = inherits_browserExports;
  var Buffer$2 = safeBufferExports.Buffer;

  var Base$1 = cipherBase;

  var ZEROS$1 = Buffer$2.alloc(128);
  var blocksize = 64;

  function Hmac$1 (alg, key) {
    Base$1.call(this, 'digest');
    if (typeof key === 'string') {
      key = Buffer$2.from(key);
    }

    this._alg = alg;
    this._key = key;

    if (key.length > blocksize) {
      key = alg(key);
    } else if (key.length < blocksize) {
      key = Buffer$2.concat([key, ZEROS$1], blocksize);
    }

    var ipad = this._ipad = Buffer$2.allocUnsafe(blocksize);
    var opad = this._opad = Buffer$2.allocUnsafe(blocksize);

    for (var i = 0; i < blocksize; i++) {
      ipad[i] = key[i] ^ 0x36;
      opad[i] = key[i] ^ 0x5C;
    }

    this._hash = [ipad];
  }

  inherits$1(Hmac$1, Base$1);

  Hmac$1.prototype._update = function (data) {
    this._hash.push(data);
  };

  Hmac$1.prototype._final = function () {
    var h = this._alg(Buffer$2.concat(this._hash));
    return this._alg(Buffer$2.concat([this._opad, h]))
  };
  var legacy = Hmac$1;

  var inherits = inherits_browserExports;
  var Legacy = legacy;
  var Base = cipherBase;
  var Buffer$1 = safeBufferExports.Buffer;
  var md5 = md5$2;
  var RIPEMD160 = ripemd160;

  var sha = sha_jsExports;

  var ZEROS = Buffer$1.alloc(128);

  function Hmac (alg, key) {
    Base.call(this, 'digest');
    if (typeof key === 'string') {
      key = Buffer$1.from(key);
    }

    var blocksize = (alg === 'sha512' || alg === 'sha384') ? 128 : 64;

    this._alg = alg;
    this._key = key;
    if (key.length > blocksize) {
      var hash = alg === 'rmd160' ? new RIPEMD160() : sha(alg);
      key = hash.update(key).digest();
    } else if (key.length < blocksize) {
      key = Buffer$1.concat([key, ZEROS], blocksize);
    }

    var ipad = this._ipad = Buffer$1.allocUnsafe(blocksize);
    var opad = this._opad = Buffer$1.allocUnsafe(blocksize);

    for (var i = 0; i < blocksize; i++) {
      ipad[i] = key[i] ^ 0x36;
      opad[i] = key[i] ^ 0x5C;
    }
    this._hash = alg === 'rmd160' ? new RIPEMD160() : sha(alg);
    this._hash.update(ipad);
  }

  inherits(Hmac, Base);

  Hmac.prototype._update = function (data) {
    this._hash.update(data);
  };

  Hmac.prototype._final = function () {
    var h = this._hash.digest();
    var hash = this._alg === 'rmd160' ? new RIPEMD160() : sha(this._alg);
    return hash.update(this._opad).update(h).digest()
  };

  var browser$1 = function createHmac (alg, key) {
    alg = alg.toLowerCase();
    if (alg === 'rmd160' || alg === 'ripemd160') {
      return new Hmac('rmd160', key)
    }
    if (alg === 'md5') {
      return new Legacy(md5, key)
    }
    return new Hmac(alg, key)
  };

  var browser = timingSafeEqual;

  function timingSafeEqual(a, b) {
    if (!isBuffer$1(a)) {
      throw new TypeError('First argument must be a buffer')
    }
    if (!isBuffer$1(b)) {
      throw new TypeError('Second argument must be a buffer')
    }
    if (a.length !== b.length) {
      throw new TypeError('Input buffers must have the same length')
    }
    var len = a.length;
    var out = 0;
    var i = -1;
    while (++i < len) {
      out |= a[i] ^ b[i];
    }
    return out === 0
  }

  const Buffer = safeBufferExports.Buffer;

  const {
    map: map$1,
    join: join$1,
    pipe: pipe$2,
    slice: slice$1,
    curry: curry$3,
    flip,
    dropLast,
    isEmpty,
    takeLast,
  } = require$$0$2;

  // Compliment an array
  const _not = (x) => ~x;

  // Slice a buffer
  const buffSlice$1 = (x, y, z = x.length) => pipe$2(byarr, slice$1(y, z), toBuffer$1)(x);

  // Concatenate buffers
  const concatBuff$1 = Buffer.concat;

  // convert byte array to buffer
  const toBuffer$1 = Buffer.from;

  // convert buffer to byte array
  const byarr = (x) => Uint8Array.from(x); // Cannot be point-free since Uint8Array.from() needs to be bound to its prototype

  // Number to Binary String conversion
  const nTobin$1 = (x) => x.toString(2);

  // Convert to byte array and apply complement

  const compliment$1 = pipe$2(byarr, map$1(_not));

  // Map in steps 
  const stepMap$1 = curry$3((callback, step, array) => {
    return array
      .map((d, i, array) => {
        if (i % step === 0) {
          return callback(d, i, array);
        }
      })
      .filter((d, i) => i % step === 0);
  });

  // Pure recursive regular expression replace

  const recursiveReplace$1 = (data, patternArray, replaceArray) => {
    if (isEmpty(patternArray) && isEmpty(replaceArray)) {
      return data;
    }
    const [pattern] = takeLast(1, patternArray);
    const [replaceTo] = takeLast(1, replaceArray);
    data = data.replace(new RegExp(pattern, "g"), replaceTo);
    return recursiveReplace$1(
      data,
      dropLast(1, patternArray),
      dropLast(1, replaceArray)
    );
  };

  // Pad with zeroes to get required length
  const zeroPad$1 = curry$3((x, num) => {
    var zero = "";
    for (let i = 0; i < x; i++) {
      zero += "0";
    }
    return zero.slice(String(num).length) + num;
  });

  // Byte array to Binary String conversion
  const byteToBin$1 = pipe$2(Array.from, map$1(nTobin$1), map$1(zeroPad$1(8)), join$1(""));

  // Binary String to Byte Array conversion
  const binToByte$1 = (str) => {
    var arr = [];
    for (let i = 0; i < str.length; i += 8) {
      arr.push(pipe$2(slice$1(i, i + 8), flip(parseInt)(2))(str));
    }
    return new Uint8Array(arr);
  };

  var util = {
    toBuffer: toBuffer$1,
    byarr,
    compliment: compliment$1,
    byteToBin: byteToBin$1,
    nTobin: nTobin$1,
    zeroPad: zeroPad$1,
    binToByte: binToByte$1,
    concatBuff: concatBuff$1,
    buffSlice: buffSlice$1,
    stepMap: stepMap$1,
    recursiveReplace: recursiveReplace$1,
  };

  const aes = browser$7;
  const { createCipheriv, createDecipheriv } = aes;
  const randomBytes = browserExports;
  const pbkdf2Sync = browser$2.pbkdf2Sync;
  const createHmac = browser$1;
  const { curry: curry$2 } = require$$0$2;
  const timeSafeCheck = browser;
  const { toBuffer, concatBuff, buffSlice } = util;

  // Key generation from a password

  const _genKey = (password, salt) =>
    pbkdf2Sync(password, salt, 10000, 48, "sha512");

  // Aes stream cipher with random salt and iv -> encrypt an array -- input {password,data,integrity:bool}

  const encrypt$1 = (config) => {
    // Impure function Side-effects!
    const salt = randomBytes(8);
    const { iv, key, secret } = _bootEncrypt(config, salt);
    const cipher = createCipheriv("aes-256-ctr", key, iv);
    const payload = concatBuff([cipher.update(secret, "utf8"), cipher.final()]);
    if (config.integrity) {
      const hmac = createHmac("sha256", key).update(secret).digest();
      return concatBuff([salt, hmac, payload]);
    }
    return concatBuff([salt, payload]);
  };

  const decrypt$1 = (config) => {
    const { iv, key, secret, hmacData } = _bootDecrypt(config, null);
    const decipher = createDecipheriv("aes-256-ctr", key, iv);
    const decrypted = concatBuff([
      decipher.update(secret, "utf8"),
      decipher.final(),
    ]);
    if (config.integrity) {
      const vHmac = createHmac("sha256", key).update(decrypted).digest();
      if (!timeSafeCheck(hmacData, vHmac)) {
        throw new Error(
          "Wrong password or Wrong payload (Hmac Integrity failure) "
        );
      }
    }
    return decrypted;
  };

  // Extracting parameters for encrypt/decrypt from provided input

  const _extract = (mode, config, salt) => {
    const data = toBuffer(config.data);
    const output = {};
    if (mode === "encrypt") {
      output.secret = data;
    } else if (mode === "decrypt") {
      salt = buffSlice(data, 0, 8);
      if (config.integrity) {
        output.hmacData = buffSlice(data, 8, 40);
        output.secret = buffSlice(data, 40);
      } else {
        output.secret = buffSlice(data, 8);
      }
    }

    const ivKey = _genKey(config.password, salt);
    output.iv = buffSlice(ivKey, 0, 16);
    output.key = buffSlice(ivKey, 16);
    return output;
  };

  // Encryption/Decryption curried functions

  const _bootEncrypt = curry$2(_extract)("encrypt");

  const _bootDecrypt = curry$2(_extract)("decrypt");

  var encrypt_1 = {
    encrypt: encrypt$1,
    decrypt: decrypt$1,
  };

  var lzutf8$1 = {exports: {}};

  lzutf8$1.exports;

  (function (module) {
  	var LZUTF8;
  	(function (LZUTF8) {
  	    LZUTF8.runningInNodeJS = function () {
  	        return ((typeof process === "object") && (typeof process.versions === "object") && (typeof process.versions.node === "string"));
  	    };
  	    LZUTF8.runningInMainNodeJSModule = function () {
  	        return LZUTF8.runningInNodeJS() && require.main === module;
  	    };
  	    LZUTF8.commonJSAvailable = function () {
  	        return 'object' === "object";
  	    };
  	    LZUTF8.runningInWebWorker = function () {
  	        return typeof window === "undefined" && typeof self === "object" && typeof self.addEventListener === "function" && typeof self.close === "function";
  	    };
  	    LZUTF8.runningInNodeChildProcess = function () {
  	        return LZUTF8.runningInNodeJS() && typeof process.send === "function";
  	    };
  	    LZUTF8.runningInNullOrigin = function () {
  	        if (typeof window !== "object" || typeof window.location !== "object" || typeof document !== "object")
  	            return false;
  	        return document.location.protocol !== 'http:' && document.location.protocol !== 'https:';
  	    };
  	    LZUTF8.webWorkersAvailable = function () {
  	        if (typeof Worker !== "function" || LZUTF8.runningInNullOrigin())
  	            return false;
  	        if (LZUTF8.runningInNodeJS())
  	            return false;
  	        if (navigator && navigator.userAgent && navigator.userAgent.indexOf("Android 4.3") >= 0)
  	            return false;
  	        return true;
  	    };
  	    LZUTF8.log = function (message, appendToDocument) {
  	        if (appendToDocument === void 0) { appendToDocument = false; }
  	        if (typeof console !== "object")
  	            return;
  	        console.log(message);
  	        if (appendToDocument && typeof document == "object")
  	            document.body.innerHTML += message + "<br/>";
  	    };
  	    LZUTF8.createErrorMessage = function (exception, title) {
  	        if (title === void 0) { title = "Unhandled exception"; }
  	        if (exception == null)
  	            return title;
  	        title += ": ";
  	        if (typeof exception.content === "object") {
  	            if (LZUTF8.runningInNodeJS()) {
  	                return title + exception.content.stack;
  	            }
  	            else {
  	                var exceptionJSON = JSON.stringify(exception.content);
  	                if (exceptionJSON !== "{}")
  	                    return title + exceptionJSON;
  	                else
  	                    return title + exception.content;
  	            }
  	        }
  	        else if (typeof exception.content === "string") {
  	            return title + exception.content;
  	        }
  	        else {
  	            return title + exception;
  	        }
  	    };
  	    LZUTF8.printExceptionAndStackTraceToConsole = function (exception, title) {
  	        if (title === void 0) { title = "Unhandled exception"; }
  	        LZUTF8.log(LZUTF8.createErrorMessage(exception, title));
  	    };
  	    LZUTF8.getGlobalObject = function () {
  	        if (typeof commonjsGlobal === "object")
  	            return commonjsGlobal;
  	        else if (typeof window === "object")
  	            return window;
  	        else if (typeof self === "object")
  	            return self;
  	        else
  	            return {};
  	    };
  	    LZUTF8.toString = Object.prototype.toString;
  	    if (LZUTF8.commonJSAvailable())
  	        module.exports = LZUTF8;
  	})(LZUTF8 || (LZUTF8 = {}));
  	(function (IE10SubarrayBugPatcher) {
  	    if (typeof Uint8Array === "function" && new Uint8Array(1).subarray(1).byteLength !== 0) {
  	        var subarray = function (start, end) {
  	            var clamp = function (v, min, max) { return v < min ? min : v > max ? max : v; };
  	            start = start | 0;
  	            end = end | 0;
  	            if (arguments.length < 1)
  	                start = 0;
  	            if (arguments.length < 2)
  	                end = this.length;
  	            if (start < 0)
  	                start = this.length + start;
  	            if (end < 0)
  	                end = this.length + end;
  	            start = clamp(start, 0, this.length);
  	            end = clamp(end, 0, this.length);
  	            var len = end - start;
  	            if (len < 0)
  	                len = 0;
  	            return new this.constructor(this.buffer, this.byteOffset + start * this.BYTES_PER_ELEMENT, len);
  	        };
  	        var types = ['Int8Array', 'Uint8Array', 'Uint8ClampedArray', 'Int16Array', 'Uint16Array', 'Int32Array', 'Uint32Array', 'Float32Array', 'Float64Array'];
  	        var globalObject = void 0;
  	        if (typeof window === "object")
  	            globalObject = window;
  	        else if (typeof self === "object")
  	            globalObject = self;
  	        if (globalObject !== undefined) {
  	            for (var i = 0; i < types.length; i++) {
  	                if (globalObject[types[i]])
  	                    globalObject[types[i]].prototype.subarray = subarray;
  	            }
  	        }
  	    }
  	})();
  	var LZUTF8;
  	(function (LZUTF8) {
  	    var AsyncCompressor = (function () {
  	        function AsyncCompressor() {
  	        }
  	        AsyncCompressor.compressAsync = function (input, options, callback) {
  	            var timer = new LZUTF8.Timer();
  	            var compressor = new LZUTF8.Compressor();
  	            if (!callback)
  	                throw new TypeError("compressAsync: No callback argument given");
  	            if (typeof input === "string") {
  	                input = LZUTF8.encodeUTF8(input);
  	            }
  	            else if (input == null || !(input instanceof Uint8Array)) {
  	                callback(undefined, new TypeError("compressAsync: Invalid input argument, only 'string' and 'Uint8Array' are supported"));
  	                return;
  	            }
  	            var sourceBlocks = LZUTF8.ArrayTools.splitByteArray(input, options.blockSize);
  	            var compressedBlocks = [];
  	            var compressBlocksStartingAt = function (index) {
  	                if (index < sourceBlocks.length) {
  	                    var compressedBlock = void 0;
  	                    try {
  	                        compressedBlock = compressor.compressBlock(sourceBlocks[index]);
  	                    }
  	                    catch (e) {
  	                        callback(undefined, e);
  	                        return;
  	                    }
  	                    compressedBlocks.push(compressedBlock);
  	                    if (timer.getElapsedTime() <= 20) {
  	                        compressBlocksStartingAt(index + 1);
  	                    }
  	                    else {
  	                        LZUTF8.enqueueImmediate(function () { return compressBlocksStartingAt(index + 1); });
  	                        timer.restart();
  	                    }
  	                }
  	                else {
  	                    var joinedCompressedBlocks_1 = LZUTF8.ArrayTools.concatUint8Arrays(compressedBlocks);
  	                    LZUTF8.enqueueImmediate(function () {
  	                        var result;
  	                        try {
  	                            result = LZUTF8.CompressionCommon.encodeCompressedBytes(joinedCompressedBlocks_1, options.outputEncoding);
  	                        }
  	                        catch (e) {
  	                            callback(undefined, e);
  	                            return;
  	                        }
  	                        LZUTF8.enqueueImmediate(function () { return callback(result); });
  	                    });
  	                }
  	            };
  	            LZUTF8.enqueueImmediate(function () { return compressBlocksStartingAt(0); });
  	        };
  	        AsyncCompressor.createCompressionStream = function () {
  	            var compressor = new LZUTF8.Compressor();
  	            var NodeStream = requireReadableBrowser();
  	            var compressionStream = new NodeStream.Transform({ decodeStrings: true, highWaterMark: 65536 });
  	            compressionStream._transform = function (data, encoding, done) {
  	                var buffer;
  	                try {
  	                    buffer = LZUTF8.BufferTools.uint8ArrayToBuffer(compressor.compressBlock(LZUTF8.BufferTools.bufferToUint8Array(data)));
  	                }
  	                catch (e) {
  	                    compressionStream.emit("error", e);
  	                    return;
  	                }
  	                compressionStream.push(buffer);
  	                done();
  	            };
  	            return compressionStream;
  	        };
  	        return AsyncCompressor;
  	    }());
  	    LZUTF8.AsyncCompressor = AsyncCompressor;
  	})(LZUTF8 || (LZUTF8 = {}));
  	var LZUTF8;
  	(function (LZUTF8) {
  	    var AsyncDecompressor = (function () {
  	        function AsyncDecompressor() {
  	        }
  	        AsyncDecompressor.decompressAsync = function (input, options, callback) {
  	            if (!callback)
  	                throw new TypeError("decompressAsync: No callback argument given");
  	            var timer = new LZUTF8.Timer();
  	            try {
  	                input = LZUTF8.CompressionCommon.decodeCompressedBytes(input, options.inputEncoding);
  	            }
  	            catch (e) {
  	                callback(undefined, e);
  	                return;
  	            }
  	            var decompressor = new LZUTF8.Decompressor();
  	            var sourceBlocks = LZUTF8.ArrayTools.splitByteArray(input, options.blockSize);
  	            var decompressedBlocks = [];
  	            var decompressBlocksStartingAt = function (index) {
  	                if (index < sourceBlocks.length) {
  	                    var decompressedBlock = void 0;
  	                    try {
  	                        decompressedBlock = decompressor.decompressBlock(sourceBlocks[index]);
  	                    }
  	                    catch (e) {
  	                        callback(undefined, e);
  	                        return;
  	                    }
  	                    decompressedBlocks.push(decompressedBlock);
  	                    if (timer.getElapsedTime() <= 20) {
  	                        decompressBlocksStartingAt(index + 1);
  	                    }
  	                    else {
  	                        LZUTF8.enqueueImmediate(function () { return decompressBlocksStartingAt(index + 1); });
  	                        timer.restart();
  	                    }
  	                }
  	                else {
  	                    var joinedDecompressedBlocks_1 = LZUTF8.ArrayTools.concatUint8Arrays(decompressedBlocks);
  	                    LZUTF8.enqueueImmediate(function () {
  	                        var result;
  	                        try {
  	                            result = LZUTF8.CompressionCommon.encodeDecompressedBytes(joinedDecompressedBlocks_1, options.outputEncoding);
  	                        }
  	                        catch (e) {
  	                            callback(undefined, e);
  	                            return;
  	                        }
  	                        LZUTF8.enqueueImmediate(function () { return callback(result); });
  	                    });
  	                }
  	            };
  	            LZUTF8.enqueueImmediate(function () { return decompressBlocksStartingAt(0); });
  	        };
  	        AsyncDecompressor.createDecompressionStream = function () {
  	            var decompressor = new LZUTF8.Decompressor();
  	            var NodeStream = requireReadableBrowser();
  	            var decompressionStream = new NodeStream.Transform({ decodeStrings: true, highWaterMark: 65536 });
  	            decompressionStream._transform = function (data, encoding, done) {
  	                var buffer;
  	                try {
  	                    buffer = LZUTF8.BufferTools.uint8ArrayToBuffer(decompressor.decompressBlock(LZUTF8.BufferTools.bufferToUint8Array(data)));
  	                }
  	                catch (e) {
  	                    decompressionStream.emit("error", e);
  	                    return;
  	                }
  	                decompressionStream.push(buffer);
  	                done();
  	            };
  	            return decompressionStream;
  	        };
  	        return AsyncDecompressor;
  	    }());
  	    LZUTF8.AsyncDecompressor = AsyncDecompressor;
  	})(LZUTF8 || (LZUTF8 = {}));
  	var LZUTF8;
  	(function (LZUTF8) {
  	    var WebWorker;
  	    (function (WebWorker) {
  	        WebWorker.compressAsync = function (input, options, callback) {
  	            if (options.inputEncoding == "ByteArray") {
  	                if (!(input instanceof Uint8Array)) {
  	                    callback(undefined, new TypeError("compressAsync: input is not a Uint8Array"));
  	                    return;
  	                }
  	            }
  	            var request = {
  	                token: Math.random().toString(),
  	                type: "compress",
  	                data: input,
  	                inputEncoding: options.inputEncoding,
  	                outputEncoding: options.outputEncoding
  	            };
  	            var responseListener = function (e) {
  	                var response = e.data;
  	                if (!response || response.token != request.token)
  	                    return;
  	                WebWorker.globalWorker.removeEventListener("message", responseListener);
  	                if (response.type == "error")
  	                    callback(undefined, new Error(response.error));
  	                else
  	                    callback(response.data);
  	            };
  	            WebWorker.globalWorker.addEventListener("message", responseListener);
  	            WebWorker.globalWorker.postMessage(request, []);
  	        };
  	        WebWorker.decompressAsync = function (input, options, callback) {
  	            var request = {
  	                token: Math.random().toString(),
  	                type: "decompress",
  	                data: input,
  	                inputEncoding: options.inputEncoding,
  	                outputEncoding: options.outputEncoding
  	            };
  	            var responseListener = function (e) {
  	                var response = e.data;
  	                if (!response || response.token != request.token)
  	                    return;
  	                WebWorker.globalWorker.removeEventListener("message", responseListener);
  	                if (response.type == "error")
  	                    callback(undefined, new Error(response.error));
  	                else
  	                    callback(response.data);
  	            };
  	            WebWorker.globalWorker.addEventListener("message", responseListener);
  	            WebWorker.globalWorker.postMessage(request, []);
  	        };
  	        WebWorker.installWebWorkerIfNeeded = function () {
  	            if (typeof self == "object" && self.document === undefined && self.addEventListener != undefined) {
  	                self.addEventListener("message", function (e) {
  	                    var request = e.data;
  	                    if (request.type == "compress") {
  	                        var compressedData = void 0;
  	                        try {
  	                            compressedData = LZUTF8.compress(request.data, { outputEncoding: request.outputEncoding });
  	                        }
  	                        catch (e) {
  	                            self.postMessage({ token: request.token, type: "error", error: LZUTF8.createErrorMessage(e) }, []);
  	                            return;
  	                        }
  	                        var response = {
  	                            token: request.token,
  	                            type: "compressionResult",
  	                            data: compressedData,
  	                            encoding: request.outputEncoding,
  	                        };
  	                        if (response.data instanceof Uint8Array && navigator.appVersion.indexOf("MSIE 10") === -1)
  	                            self.postMessage(response, [response.data.buffer]);
  	                        else
  	                            self.postMessage(response, []);
  	                    }
  	                    else if (request.type == "decompress") {
  	                        var decompressedData = void 0;
  	                        try {
  	                            decompressedData = LZUTF8.decompress(request.data, { inputEncoding: request.inputEncoding, outputEncoding: request.outputEncoding });
  	                        }
  	                        catch (e) {
  	                            self.postMessage({ token: request.token, type: "error", error: LZUTF8.createErrorMessage(e) }, []);
  	                            return;
  	                        }
  	                        var response = {
  	                            token: request.token,
  	                            type: "decompressionResult",
  	                            data: decompressedData,
  	                            encoding: request.outputEncoding,
  	                        };
  	                        if (response.data instanceof Uint8Array && navigator.appVersion.indexOf("MSIE 10") === -1)
  	                            self.postMessage(response, [response.data.buffer]);
  	                        else
  	                            self.postMessage(response, []);
  	                    }
  	                });
  	                self.addEventListener("error", function (e) {
  	                    LZUTF8.log(LZUTF8.createErrorMessage(e.error, "Unexpected LZUTF8 WebWorker exception"));
  	                });
  	            }
  	        };
  	        WebWorker.createGlobalWorkerIfNeeded = function () {
  	            if (WebWorker.globalWorker)
  	                return true;
  	            if (!LZUTF8.webWorkersAvailable())
  	                return false;
  	            if (!WebWorker.scriptURI && typeof document === "object") {
  	                var scriptElement = document.getElementById("lzutf8");
  	                if (scriptElement != null)
  	                    WebWorker.scriptURI = scriptElement.getAttribute("src") || undefined;
  	            }
  	            if (WebWorker.scriptURI) {
  	                WebWorker.globalWorker = new Worker(WebWorker.scriptURI);
  	                return true;
  	            }
  	            else {
  	                return false;
  	            }
  	        };
  	        WebWorker.terminate = function () {
  	            if (WebWorker.globalWorker) {
  	                WebWorker.globalWorker.terminate();
  	                WebWorker.globalWorker = undefined;
  	            }
  	        };
  	    })(WebWorker = LZUTF8.WebWorker || (LZUTF8.WebWorker = {}));
  	    WebWorker.installWebWorkerIfNeeded();
  	})(LZUTF8 || (LZUTF8 = {}));
  	var LZUTF8;
  	(function (LZUTF8) {
  	    var ArraySegment = (function () {
  	        function ArraySegment(container, startPosition, length) {
  	            this.container = container;
  	            this.startPosition = startPosition;
  	            this.length = length;
  	        }
  	        ArraySegment.prototype.get = function (index) {
  	            return this.container[this.startPosition + index];
  	        };
  	        ArraySegment.prototype.getInReversedOrder = function (reverseIndex) {
  	            return this.container[this.startPosition + this.length - 1 - reverseIndex];
  	        };
  	        ArraySegment.prototype.set = function (index, value) {
  	            this.container[this.startPosition + index] = value;
  	        };
  	        return ArraySegment;
  	    }());
  	    LZUTF8.ArraySegment = ArraySegment;
  	})(LZUTF8 || (LZUTF8 = {}));
  	var LZUTF8;
  	(function (LZUTF8) {
  	    (function (ArrayTools) {
  	        ArrayTools.copyElements = function (source, sourceIndex, destination, destinationIndex, count) {
  	            while (count--)
  	                destination[destinationIndex++] = source[sourceIndex++];
  	        };
  	        ArrayTools.zeroElements = function (collection, index, count) {
  	            while (count--)
  	                collection[index++] = 0;
  	        };
  	        ArrayTools.countNonzeroValuesInArray = function (array) {
  	            var result = 0;
  	            for (var i = 0; i < array.length; i++)
  	                if (array[i])
  	                    result++;
  	            return result;
  	        };
  	        ArrayTools.truncateStartingElements = function (array, truncatedLength) {
  	            if (array.length <= truncatedLength)
  	                throw new RangeError("truncateStartingElements: Requested length should be smaller than array length");
  	            var sourcePosition = array.length - truncatedLength;
  	            for (var i = 0; i < truncatedLength; i++)
  	                array[i] = array[sourcePosition + i];
  	            array.length = truncatedLength;
  	        };
  	        ArrayTools.doubleByteArrayCapacity = function (array) {
  	            var newArray = new Uint8Array(array.length * 2);
  	            newArray.set(array);
  	            return newArray;
  	        };
  	        ArrayTools.concatUint8Arrays = function (arrays) {
  	            var totalLength = 0;
  	            for (var _i = 0, arrays_1 = arrays; _i < arrays_1.length; _i++) {
  	                var array = arrays_1[_i];
  	                totalLength += array.length;
  	            }
  	            var result = new Uint8Array(totalLength);
  	            var offset = 0;
  	            for (var _a = 0, arrays_2 = arrays; _a < arrays_2.length; _a++) {
  	                var array = arrays_2[_a];
  	                result.set(array, offset);
  	                offset += array.length;
  	            }
  	            return result;
  	        };
  	        ArrayTools.splitByteArray = function (byteArray, maxPartLength) {
  	            var result = [];
  	            for (var offset = 0; offset < byteArray.length;) {
  	                var blockLength = Math.min(maxPartLength, byteArray.length - offset);
  	                result.push(byteArray.subarray(offset, offset + blockLength));
  	                offset += blockLength;
  	            }
  	            return result;
  	        };
  	    })(LZUTF8.ArrayTools || (LZUTF8.ArrayTools = {}));
  	})(LZUTF8 || (LZUTF8 = {}));
  	var LZUTF8;
  	(function (LZUTF8) {
  	    (function (BufferTools) {
  	        BufferTools.convertToUint8ArrayIfNeeded = function (input) {
  	            if (typeof Buffer$u === "function" && isBuffer$1(input))
  	                return BufferTools.bufferToUint8Array(input);
  	            else
  	                return input;
  	        };
  	        BufferTools.uint8ArrayToBuffer = function (arr) {
  	            if (Buffer$u.prototype instanceof Uint8Array) {
  	                var arrClone = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
  	                Object["setPrototypeOf"](arrClone, Buffer$u.prototype);
  	                return arrClone;
  	            }
  	            else {
  	                var len = arr.length;
  	                var buf = new Buffer$u(len);
  	                for (var i = 0; i < len; i++)
  	                    buf[i] = arr[i];
  	                return buf;
  	            }
  	        };
  	        BufferTools.bufferToUint8Array = function (buf) {
  	            if (Buffer$u.prototype instanceof Uint8Array) {
  	                return new Uint8Array(buf["buffer"], buf["byteOffset"], buf["byteLength"]);
  	            }
  	            else {
  	                var len = buf.length;
  	                var arr = new Uint8Array(len);
  	                for (var i = 0; i < len; i++)
  	                    arr[i] = buf[i];
  	                return arr;
  	            }
  	        };
  	    })(LZUTF8.BufferTools || (LZUTF8.BufferTools = {}));
  	})(LZUTF8 || (LZUTF8 = {}));
  	var LZUTF8;
  	(function (LZUTF8) {
  	    (function (CompressionCommon) {
  	        CompressionCommon.getCroppedBuffer = function (buffer, cropStartOffset, cropLength, additionalCapacity) {
  	            if (additionalCapacity === void 0) { additionalCapacity = 0; }
  	            var croppedBuffer = new Uint8Array(cropLength + additionalCapacity);
  	            croppedBuffer.set(buffer.subarray(cropStartOffset, cropStartOffset + cropLength));
  	            return croppedBuffer;
  	        };
  	        CompressionCommon.getCroppedAndAppendedByteArray = function (bytes, cropStartOffset, cropLength, byteArrayToAppend) {
  	            return LZUTF8.ArrayTools.concatUint8Arrays([bytes.subarray(cropStartOffset, cropStartOffset + cropLength), byteArrayToAppend]);
  	        };
  	        CompressionCommon.detectCompressionSourceEncoding = function (input) {
  	            if (input == null)
  	                throw new TypeError("detectCompressionSourceEncoding: input is null or undefined");
  	            if (typeof input === "string")
  	                return "String";
  	            else if (input instanceof Uint8Array || (typeof Buffer$u === "function" && isBuffer$1(input)))
  	                return "ByteArray";
  	            else
  	                throw new TypeError("detectCompressionSourceEncoding: input must be of type 'string', 'Uint8Array' or 'Buffer'");
  	        };
  	        CompressionCommon.encodeCompressedBytes = function (compressedBytes, outputEncoding) {
  	            switch (outputEncoding) {
  	                case "ByteArray":
  	                    return compressedBytes;
  	                case "Buffer":
  	                    return LZUTF8.BufferTools.uint8ArrayToBuffer(compressedBytes);
  	                case "Base64":
  	                    return LZUTF8.encodeBase64(compressedBytes);
  	                case "BinaryString":
  	                    return LZUTF8.encodeBinaryString(compressedBytes);
  	                case "StorageBinaryString":
  	                    return LZUTF8.encodeStorageBinaryString(compressedBytes);
  	                default:
  	                    throw new TypeError("encodeCompressedBytes: invalid output encoding requested");
  	            }
  	        };
  	        CompressionCommon.decodeCompressedBytes = function (compressedData, inputEncoding) {
  	            if (inputEncoding == null)
  	                throw new TypeError("decodeCompressedData: Input is null or undefined");
  	            switch (inputEncoding) {
  	                case "ByteArray":
  	                case "Buffer":
  	                    var normalizedBytes = LZUTF8.BufferTools.convertToUint8ArrayIfNeeded(compressedData);
  	                    if (!(normalizedBytes instanceof Uint8Array))
  	                        throw new TypeError("decodeCompressedData: 'ByteArray' or 'Buffer' input type was specified but input is not a Uint8Array or Buffer");
  	                    return normalizedBytes;
  	                case "Base64":
  	                    if (typeof compressedData !== "string")
  	                        throw new TypeError("decodeCompressedData: 'Base64' input type was specified but input is not a string");
  	                    return LZUTF8.decodeBase64(compressedData);
  	                case "BinaryString":
  	                    if (typeof compressedData !== "string")
  	                        throw new TypeError("decodeCompressedData: 'BinaryString' input type was specified but input is not a string");
  	                    return LZUTF8.decodeBinaryString(compressedData);
  	                case "StorageBinaryString":
  	                    if (typeof compressedData !== "string")
  	                        throw new TypeError("decodeCompressedData: 'StorageBinaryString' input type was specified but input is not a string");
  	                    return LZUTF8.decodeStorageBinaryString(compressedData);
  	                default:
  	                    throw new TypeError("decodeCompressedData: invalid input encoding requested: '" + inputEncoding + "'");
  	            }
  	        };
  	        CompressionCommon.encodeDecompressedBytes = function (decompressedBytes, outputEncoding) {
  	            switch (outputEncoding) {
  	                case "String":
  	                    return LZUTF8.decodeUTF8(decompressedBytes);
  	                case "ByteArray":
  	                    return decompressedBytes;
  	                case "Buffer":
  	                    if (typeof Buffer$u !== "function")
  	                        throw new TypeError("encodeDecompressedBytes: a 'Buffer' type was specified but is not supported at the current envirnment");
  	                    return LZUTF8.BufferTools.uint8ArrayToBuffer(decompressedBytes);
  	                default:
  	                    throw new TypeError("encodeDecompressedBytes: invalid output encoding requested");
  	            }
  	        };
  	    })(LZUTF8.CompressionCommon || (LZUTF8.CompressionCommon = {}));
  	})(LZUTF8 || (LZUTF8 = {}));
  	var LZUTF8;
  	(function (LZUTF8) {
  	    var EventLoop;
  	    (function (EventLoop) {
  	        var queuedFunctions = [];
  	        var asyncFlushFunc;
  	        EventLoop.enqueueImmediate = function (func) {
  	            queuedFunctions.push(func);
  	            if (queuedFunctions.length === 1)
  	                asyncFlushFunc();
  	        };
  	        EventLoop.initializeScheduler = function () {
  	            var flush = function () {
  	                for (var _i = 0, queuedFunctions_1 = queuedFunctions; _i < queuedFunctions_1.length; _i++) {
  	                    var func = queuedFunctions_1[_i];
  	                    try {
  	                        func.call(undefined);
  	                    }
  	                    catch (exception) {
  	                        LZUTF8.printExceptionAndStackTraceToConsole(exception, "enqueueImmediate exception");
  	                    }
  	                }
  	                queuedFunctions.length = 0;
  	            };
  	            if (LZUTF8.runningInNodeJS()) {
  	                asyncFlushFunc = function () { return setImmediate(function () { return flush(); }); };
  	            }
  	            if (typeof window === "object" && typeof window.addEventListener === "function" && typeof window.postMessage === "function") {
  	                var token_1 = "enqueueImmediate-" + Math.random().toString();
  	                window.addEventListener("message", function (event) {
  	                    if (event.data === token_1)
  	                        flush();
  	                });
  	                var targetOrigin_1;
  	                if (LZUTF8.runningInNullOrigin())
  	                    targetOrigin_1 = '*';
  	                else
  	                    targetOrigin_1 = window.location.href;
  	                asyncFlushFunc = function () { return window.postMessage(token_1, targetOrigin_1); };
  	            }
  	            else if (typeof MessageChannel === "function" && typeof MessagePort === "function") {
  	                var channel_1 = new MessageChannel();
  	                channel_1.port1.onmessage = function () { return flush(); };
  	                asyncFlushFunc = function () { return channel_1.port2.postMessage(0); };
  	            }
  	            else {
  	                asyncFlushFunc = function () { return setTimeout(function () { return flush(); }, 0); };
  	            }
  	        };
  	        EventLoop.initializeScheduler();
  	    })(EventLoop = LZUTF8.EventLoop || (LZUTF8.EventLoop = {}));
  	    LZUTF8.enqueueImmediate = function (func) { return EventLoop.enqueueImmediate(func); };
  	})(LZUTF8 || (LZUTF8 = {}));
  	var LZUTF8;
  	(function (LZUTF8) {
  	    (function (ObjectTools) {
  	        ObjectTools.override = function (obj, newPropertyValues) {
  	            return ObjectTools.extend(obj, newPropertyValues);
  	        };
  	        ObjectTools.extend = function (obj, newProperties) {
  	            if (obj == null)
  	                throw new TypeError("obj is null or undefined");
  	            if (typeof obj !== "object")
  	                throw new TypeError("obj is not an object");
  	            if (newProperties == null)
  	                newProperties = {};
  	            if (typeof newProperties !== "object")
  	                throw new TypeError("newProperties is not an object");
  	            if (newProperties != null) {
  	                for (var property in newProperties)
  	                    obj[property] = newProperties[property];
  	            }
  	            return obj;
  	        };
  	    })(LZUTF8.ObjectTools || (LZUTF8.ObjectTools = {}));
  	})(LZUTF8 || (LZUTF8 = {}));
  	var LZUTF8;
  	(function (LZUTF8) {
  	    LZUTF8.getRandomIntegerInRange = function (low, high) {
  	        return low + Math.floor(Math.random() * (high - low));
  	    };
  	    LZUTF8.getRandomUTF16StringOfLength = function (length) {
  	        var randomString = "";
  	        for (var i = 0; i < length; i++) {
  	            var randomCodePoint = void 0;
  	            do {
  	                randomCodePoint = LZUTF8.getRandomIntegerInRange(0, 0x10FFFF + 1);
  	            } while (randomCodePoint >= 0xD800 && randomCodePoint <= 0xDFFF);
  	            randomString += LZUTF8.Encoding.CodePoint.decodeToString(randomCodePoint);
  	        }
  	        return randomString;
  	    };
  	})(LZUTF8 || (LZUTF8 = {}));
  	var LZUTF8;
  	(function (LZUTF8) {
  	    var StringBuilder = (function () {
  	        function StringBuilder(outputBufferCapacity) {
  	            if (outputBufferCapacity === void 0) { outputBufferCapacity = 1024; }
  	            this.outputBufferCapacity = outputBufferCapacity;
  	            this.outputPosition = 0;
  	            this.outputString = "";
  	            this.outputBuffer = new Uint16Array(this.outputBufferCapacity);
  	        }
  	        StringBuilder.prototype.appendCharCode = function (charCode) {
  	            this.outputBuffer[this.outputPosition++] = charCode;
  	            if (this.outputPosition === this.outputBufferCapacity)
  	                this.flushBufferToOutputString();
  	        };
  	        StringBuilder.prototype.appendCharCodes = function (charCodes) {
  	            for (var i = 0, length_1 = charCodes.length; i < length_1; i++)
  	                this.appendCharCode(charCodes[i]);
  	        };
  	        StringBuilder.prototype.appendString = function (str) {
  	            for (var i = 0, length_2 = str.length; i < length_2; i++)
  	                this.appendCharCode(str.charCodeAt(i));
  	        };
  	        StringBuilder.prototype.appendCodePoint = function (codePoint) {
  	            if (codePoint <= 0xFFFF) {
  	                this.appendCharCode(codePoint);
  	            }
  	            else if (codePoint <= 0x10FFFF) {
  	                this.appendCharCode(0xD800 + ((codePoint - 0x10000) >>> 10));
  	                this.appendCharCode(0xDC00 + ((codePoint - 0x10000) & 1023));
  	            }
  	            else
  	                throw new Error("appendCodePoint: A code point of " + codePoint + " cannot be encoded in UTF-16");
  	        };
  	        StringBuilder.prototype.getOutputString = function () {
  	            this.flushBufferToOutputString();
  	            return this.outputString;
  	        };
  	        StringBuilder.prototype.flushBufferToOutputString = function () {
  	            if (this.outputPosition === this.outputBufferCapacity)
  	                this.outputString += String.fromCharCode.apply(null, this.outputBuffer);
  	            else
  	                this.outputString += String.fromCharCode.apply(null, this.outputBuffer.subarray(0, this.outputPosition));
  	            this.outputPosition = 0;
  	        };
  	        return StringBuilder;
  	    }());
  	    LZUTF8.StringBuilder = StringBuilder;
  	})(LZUTF8 || (LZUTF8 = {}));
  	var LZUTF8;
  	(function (LZUTF8) {
  	    var Timer = (function () {
  	        function Timer() {
  	            this.restart();
  	        }
  	        Timer.prototype.restart = function () {
  	            this.startTime = Timer.getTimestamp();
  	        };
  	        Timer.prototype.getElapsedTime = function () {
  	            return Timer.getTimestamp() - this.startTime;
  	        };
  	        Timer.prototype.getElapsedTimeAndRestart = function () {
  	            var elapsedTime = this.getElapsedTime();
  	            this.restart();
  	            return elapsedTime;
  	        };
  	        Timer.prototype.logAndRestart = function (title, logToDocument) {
  	            if (logToDocument === void 0) { logToDocument = true; }
  	            var elapsedTime = this.getElapsedTime();
  	            var message = title + ": " + elapsedTime.toFixed(3) + "ms";
  	            LZUTF8.log(message, logToDocument);
  	            this.restart();
  	            return elapsedTime;
  	        };
  	        Timer.getTimestamp = function () {
  	            if (!this.timestampFunc)
  	                this.createGlobalTimestampFunction();
  	            return this.timestampFunc();
  	        };
  	        Timer.getMicrosecondTimestamp = function () {
  	            return Math.floor(Timer.getTimestamp() * 1000);
  	        };
  	        Timer.createGlobalTimestampFunction = function () {
  	            if (typeof process === "object" && typeof process.hrtime === "function") {
  	                var baseTimestamp_1 = 0;
  	                this.timestampFunc = function () {
  	                    var nodeTimeStamp = process.hrtime();
  	                    var millisecondTime = (nodeTimeStamp[0] * 1000) + (nodeTimeStamp[1] / 1000000);
  	                    return baseTimestamp_1 + millisecondTime;
  	                };
  	                baseTimestamp_1 = Date.now() - this.timestampFunc();
  	            }
  	            else if (typeof chrome === "object" && chrome.Interval) {
  	                var baseTimestamp_2 = Date.now();
  	                var chromeIntervalObject_1 = new chrome.Interval();
  	                chromeIntervalObject_1.start();
  	                this.timestampFunc = function () { return baseTimestamp_2 + chromeIntervalObject_1.microseconds() / 1000; };
  	            }
  	            else if (typeof performance === "object" && performance.now) {
  	                var baseTimestamp_3 = Date.now() - performance.now();
  	                this.timestampFunc = function () { return baseTimestamp_3 + performance.now(); };
  	            }
  	            else if (Date.now) {
  	                this.timestampFunc = function () { return Date.now(); };
  	            }
  	            else {
  	                this.timestampFunc = function () { return (new Date()).getTime(); };
  	            }
  	        };
  	        return Timer;
  	    }());
  	    LZUTF8.Timer = Timer;
  	})(LZUTF8 || (LZUTF8 = {}));
  	var LZUTF8;
  	(function (LZUTF8) {
  	    var Compressor = (function () {
  	        function Compressor(useCustomHashTable) {
  	            if (useCustomHashTable === void 0) { useCustomHashTable = true; }
  	            this.MinimumSequenceLength = 4;
  	            this.MaximumSequenceLength = 31;
  	            this.MaximumMatchDistance = 32767;
  	            this.PrefixHashTableSize = 65537;
  	            this.inputBufferStreamOffset = 1;
  	            if (useCustomHashTable && typeof Uint32Array == "function")
  	                this.prefixHashTable = new LZUTF8.CompressorCustomHashTable(this.PrefixHashTableSize);
  	            else
  	                this.prefixHashTable = new LZUTF8.CompressorSimpleHashTable(this.PrefixHashTableSize);
  	        }
  	        Compressor.prototype.compressBlock = function (input) {
  	            if (input === undefined || input === null)
  	                throw new TypeError("compressBlock: undefined or null input received");
  	            if (typeof input == "string")
  	                input = LZUTF8.encodeUTF8(input);
  	            input = LZUTF8.BufferTools.convertToUint8ArrayIfNeeded(input);
  	            return this.compressUtf8Block(input);
  	        };
  	        Compressor.prototype.compressUtf8Block = function (utf8Bytes) {
  	            if (!utf8Bytes || utf8Bytes.length == 0)
  	                return new Uint8Array(0);
  	            var bufferStartingReadOffset = this.cropAndAddNewBytesToInputBuffer(utf8Bytes);
  	            var inputBuffer = this.inputBuffer;
  	            var inputBufferLength = this.inputBuffer.length;
  	            this.outputBuffer = new Uint8Array(utf8Bytes.length);
  	            this.outputBufferPosition = 0;
  	            var latestMatchEndPosition = 0;
  	            for (var readPosition = bufferStartingReadOffset; readPosition < inputBufferLength; readPosition++) {
  	                var inputValue = inputBuffer[readPosition];
  	                var withinAMatchedRange = readPosition < latestMatchEndPosition;
  	                if (readPosition > inputBufferLength - this.MinimumSequenceLength) {
  	                    if (!withinAMatchedRange)
  	                        this.outputRawByte(inputValue);
  	                    continue;
  	                }
  	                var targetBucketIndex = this.getBucketIndexForPrefix(readPosition);
  	                if (!withinAMatchedRange) {
  	                    var matchLocator = this.findLongestMatch(readPosition, targetBucketIndex);
  	                    if (matchLocator != null) {
  	                        this.outputPointerBytes(matchLocator.length, matchLocator.distance);
  	                        latestMatchEndPosition = readPosition + matchLocator.length;
  	                        withinAMatchedRange = true;
  	                    }
  	                }
  	                if (!withinAMatchedRange)
  	                    this.outputRawByte(inputValue);
  	                var inputStreamPosition = this.inputBufferStreamOffset + readPosition;
  	                this.prefixHashTable.addValueToBucket(targetBucketIndex, inputStreamPosition);
  	            }
  	            return this.outputBuffer.subarray(0, this.outputBufferPosition);
  	        };
  	        Compressor.prototype.findLongestMatch = function (matchedSequencePosition, bucketIndex) {
  	            var bucket = this.prefixHashTable.getArraySegmentForBucketIndex(bucketIndex, this.reusableArraySegmentObject);
  	            if (bucket == null)
  	                return null;
  	            var input = this.inputBuffer;
  	            var longestMatchDistance;
  	            var longestMatchLength = 0;
  	            for (var i = 0; i < bucket.length; i++) {
  	                var testedSequencePosition = bucket.getInReversedOrder(i) - this.inputBufferStreamOffset;
  	                var testedSequenceDistance = matchedSequencePosition - testedSequencePosition;
  	                var lengthToSurpass = void 0;
  	                if (longestMatchDistance === undefined)
  	                    lengthToSurpass = this.MinimumSequenceLength - 1;
  	                else if (longestMatchDistance < 128 && testedSequenceDistance >= 128)
  	                    lengthToSurpass = longestMatchLength + (longestMatchLength >>> 1);
  	                else
  	                    lengthToSurpass = longestMatchLength;
  	                if (testedSequenceDistance > this.MaximumMatchDistance ||
  	                    lengthToSurpass >= this.MaximumSequenceLength ||
  	                    matchedSequencePosition + lengthToSurpass >= input.length)
  	                    break;
  	                if (input[testedSequencePosition + lengthToSurpass] !== input[matchedSequencePosition + lengthToSurpass])
  	                    continue;
  	                for (var offset = 0;; offset++) {
  	                    if (matchedSequencePosition + offset === input.length ||
  	                        input[testedSequencePosition + offset] !== input[matchedSequencePosition + offset]) {
  	                        if (offset > lengthToSurpass) {
  	                            longestMatchDistance = testedSequenceDistance;
  	                            longestMatchLength = offset;
  	                        }
  	                        break;
  	                    }
  	                    else if (offset === this.MaximumSequenceLength)
  	                        return { distance: testedSequenceDistance, length: this.MaximumSequenceLength };
  	                }
  	            }
  	            if (longestMatchDistance !== undefined)
  	                return { distance: longestMatchDistance, length: longestMatchLength };
  	            else
  	                return null;
  	        };
  	        Compressor.prototype.getBucketIndexForPrefix = function (startPosition) {
  	            return (this.inputBuffer[startPosition] * 7880599 +
  	                this.inputBuffer[startPosition + 1] * 39601 +
  	                this.inputBuffer[startPosition + 2] * 199 +
  	                this.inputBuffer[startPosition + 3]) % this.PrefixHashTableSize;
  	        };
  	        Compressor.prototype.outputPointerBytes = function (length, distance) {
  	            if (distance < 128) {
  	                this.outputRawByte(192 | length);
  	                this.outputRawByte(distance);
  	            }
  	            else {
  	                this.outputRawByte(224 | length);
  	                this.outputRawByte(distance >>> 8);
  	                this.outputRawByte(distance & 255);
  	            }
  	        };
  	        Compressor.prototype.outputRawByte = function (value) {
  	            this.outputBuffer[this.outputBufferPosition++] = value;
  	        };
  	        Compressor.prototype.cropAndAddNewBytesToInputBuffer = function (newInput) {
  	            if (this.inputBuffer === undefined) {
  	                this.inputBuffer = newInput;
  	                return 0;
  	            }
  	            else {
  	                var cropLength = Math.min(this.inputBuffer.length, this.MaximumMatchDistance);
  	                var cropStartOffset = this.inputBuffer.length - cropLength;
  	                this.inputBuffer = LZUTF8.CompressionCommon.getCroppedAndAppendedByteArray(this.inputBuffer, cropStartOffset, cropLength, newInput);
  	                this.inputBufferStreamOffset += cropStartOffset;
  	                return cropLength;
  	            }
  	        };
  	        return Compressor;
  	    }());
  	    LZUTF8.Compressor = Compressor;
  	})(LZUTF8 || (LZUTF8 = {}));
  	var LZUTF8;
  	(function (LZUTF8) {
  	    var CompressorCustomHashTable = (function () {
  	        function CompressorCustomHashTable(bucketCount) {
  	            this.minimumBucketCapacity = 4;
  	            this.maximumBucketCapacity = 64;
  	            this.bucketLocators = new Uint32Array(bucketCount * 2);
  	            this.storage = new Uint32Array(bucketCount * 2);
  	            this.storageIndex = 1;
  	        }
  	        CompressorCustomHashTable.prototype.addValueToBucket = function (bucketIndex, valueToAdd) {
  	            bucketIndex <<= 1;
  	            if (this.storageIndex >= (this.storage.length >>> 1))
  	                this.compact();
  	            var startPosition = this.bucketLocators[bucketIndex];
  	            var length;
  	            if (startPosition === 0) {
  	                startPosition = this.storageIndex;
  	                length = 1;
  	                this.storage[this.storageIndex] = valueToAdd;
  	                this.storageIndex += this.minimumBucketCapacity;
  	            }
  	            else {
  	                length = this.bucketLocators[bucketIndex + 1];
  	                if (length === this.maximumBucketCapacity - 1)
  	                    length = this.truncateBucketToNewerElements(startPosition, length, this.maximumBucketCapacity / 2);
  	                var endPosition = startPosition + length;
  	                if (this.storage[endPosition] === 0) {
  	                    this.storage[endPosition] = valueToAdd;
  	                    if (endPosition === this.storageIndex)
  	                        this.storageIndex += length;
  	                }
  	                else {
  	                    LZUTF8.ArrayTools.copyElements(this.storage, startPosition, this.storage, this.storageIndex, length);
  	                    startPosition = this.storageIndex;
  	                    this.storageIndex += length;
  	                    this.storage[this.storageIndex++] = valueToAdd;
  	                    this.storageIndex += length;
  	                }
  	                length++;
  	            }
  	            this.bucketLocators[bucketIndex] = startPosition;
  	            this.bucketLocators[bucketIndex + 1] = length;
  	        };
  	        CompressorCustomHashTable.prototype.truncateBucketToNewerElements = function (startPosition, bucketLength, truncatedBucketLength) {
  	            var sourcePosition = startPosition + bucketLength - truncatedBucketLength;
  	            LZUTF8.ArrayTools.copyElements(this.storage, sourcePosition, this.storage, startPosition, truncatedBucketLength);
  	            LZUTF8.ArrayTools.zeroElements(this.storage, startPosition + truncatedBucketLength, bucketLength - truncatedBucketLength);
  	            return truncatedBucketLength;
  	        };
  	        CompressorCustomHashTable.prototype.compact = function () {
  	            var oldBucketLocators = this.bucketLocators;
  	            var oldStorage = this.storage;
  	            this.bucketLocators = new Uint32Array(this.bucketLocators.length);
  	            this.storageIndex = 1;
  	            for (var bucketIndex = 0; bucketIndex < oldBucketLocators.length; bucketIndex += 2) {
  	                var length_3 = oldBucketLocators[bucketIndex + 1];
  	                if (length_3 === 0)
  	                    continue;
  	                this.bucketLocators[bucketIndex] = this.storageIndex;
  	                this.bucketLocators[bucketIndex + 1] = length_3;
  	                this.storageIndex += Math.max(Math.min(length_3 * 2, this.maximumBucketCapacity), this.minimumBucketCapacity);
  	            }
  	            this.storage = new Uint32Array(this.storageIndex * 8);
  	            for (var bucketIndex = 0; bucketIndex < oldBucketLocators.length; bucketIndex += 2) {
  	                var sourcePosition = oldBucketLocators[bucketIndex];
  	                if (sourcePosition === 0)
  	                    continue;
  	                var destPosition = this.bucketLocators[bucketIndex];
  	                var length_4 = this.bucketLocators[bucketIndex + 1];
  	                LZUTF8.ArrayTools.copyElements(oldStorage, sourcePosition, this.storage, destPosition, length_4);
  	            }
  	        };
  	        CompressorCustomHashTable.prototype.getArraySegmentForBucketIndex = function (bucketIndex, outputObject) {
  	            bucketIndex <<= 1;
  	            var startPosition = this.bucketLocators[bucketIndex];
  	            if (startPosition === 0)
  	                return null;
  	            if (outputObject === undefined)
  	                outputObject = new LZUTF8.ArraySegment(this.storage, startPosition, this.bucketLocators[bucketIndex + 1]);
  	            return outputObject;
  	        };
  	        CompressorCustomHashTable.prototype.getUsedBucketCount = function () {
  	            return Math.floor(LZUTF8.ArrayTools.countNonzeroValuesInArray(this.bucketLocators) / 2);
  	        };
  	        CompressorCustomHashTable.prototype.getTotalElementCount = function () {
  	            var result = 0;
  	            for (var i = 0; i < this.bucketLocators.length; i += 2)
  	                result += this.bucketLocators[i + 1];
  	            return result;
  	        };
  	        return CompressorCustomHashTable;
  	    }());
  	    LZUTF8.CompressorCustomHashTable = CompressorCustomHashTable;
  	})(LZUTF8 || (LZUTF8 = {}));
  	var LZUTF8;
  	(function (LZUTF8) {
  	    var CompressorSimpleHashTable = (function () {
  	        function CompressorSimpleHashTable(size) {
  	            this.maximumBucketCapacity = 64;
  	            this.buckets = new Array(size);
  	        }
  	        CompressorSimpleHashTable.prototype.addValueToBucket = function (bucketIndex, valueToAdd) {
  	            var bucket = this.buckets[bucketIndex];
  	            if (bucket === undefined) {
  	                this.buckets[bucketIndex] = [valueToAdd];
  	            }
  	            else {
  	                if (bucket.length === this.maximumBucketCapacity - 1)
  	                    LZUTF8.ArrayTools.truncateStartingElements(bucket, this.maximumBucketCapacity / 2);
  	                bucket.push(valueToAdd);
  	            }
  	        };
  	        CompressorSimpleHashTable.prototype.getArraySegmentForBucketIndex = function (bucketIndex, outputObject) {
  	            var bucket = this.buckets[bucketIndex];
  	            if (bucket === undefined)
  	                return null;
  	            if (outputObject === undefined)
  	                outputObject = new LZUTF8.ArraySegment(bucket, 0, bucket.length);
  	            return outputObject;
  	        };
  	        CompressorSimpleHashTable.prototype.getUsedBucketCount = function () {
  	            return LZUTF8.ArrayTools.countNonzeroValuesInArray(this.buckets);
  	        };
  	        CompressorSimpleHashTable.prototype.getTotalElementCount = function () {
  	            var currentSum = 0;
  	            for (var i = 0; i < this.buckets.length; i++) {
  	                if (this.buckets[i] !== undefined)
  	                    currentSum += this.buckets[i].length;
  	            }
  	            return currentSum;
  	        };
  	        return CompressorSimpleHashTable;
  	    }());
  	    LZUTF8.CompressorSimpleHashTable = CompressorSimpleHashTable;
  	})(LZUTF8 || (LZUTF8 = {}));
  	var LZUTF8;
  	(function (LZUTF8) {
  	    var Decompressor = (function () {
  	        function Decompressor() {
  	            this.MaximumMatchDistance = 32767;
  	            this.outputPosition = 0;
  	        }
  	        Decompressor.prototype.decompressBlockToString = function (input) {
  	            input = LZUTF8.BufferTools.convertToUint8ArrayIfNeeded(input);
  	            return LZUTF8.decodeUTF8(this.decompressBlock(input));
  	        };
  	        Decompressor.prototype.decompressBlock = function (input) {
  	            if (this.inputBufferRemainder) {
  	                input = LZUTF8.ArrayTools.concatUint8Arrays([this.inputBufferRemainder, input]);
  	                this.inputBufferRemainder = undefined;
  	            }
  	            var outputStartPosition = this.cropOutputBufferToWindowAndInitialize(Math.max(input.length * 4, 1024));
  	            for (var readPosition = 0, inputLength = input.length; readPosition < inputLength; readPosition++) {
  	                var inputValue = input[readPosition];
  	                if (inputValue >>> 6 != 3) {
  	                    this.outputByte(inputValue);
  	                    continue;
  	                }
  	                var sequenceLengthIdentifier = inputValue >>> 5;
  	                if (readPosition == inputLength - 1 ||
  	                    (readPosition == inputLength - 2 && sequenceLengthIdentifier == 7)) {
  	                    this.inputBufferRemainder = input.subarray(readPosition);
  	                    break;
  	                }
  	                if (input[readPosition + 1] >>> 7 === 1) {
  	                    this.outputByte(inputValue);
  	                }
  	                else {
  	                    var matchLength = inputValue & 31;
  	                    var matchDistance = void 0;
  	                    if (sequenceLengthIdentifier == 6) {
  	                        matchDistance = input[readPosition + 1];
  	                        readPosition += 1;
  	                    }
  	                    else {
  	                        matchDistance = (input[readPosition + 1] << 8) | (input[readPosition + 2]);
  	                        readPosition += 2;
  	                    }
  	                    var matchPosition = this.outputPosition - matchDistance;
  	                    for (var offset = 0; offset < matchLength; offset++)
  	                        this.outputByte(this.outputBuffer[matchPosition + offset]);
  	                }
  	            }
  	            this.rollBackIfOutputBufferEndsWithATruncatedMultibyteSequence();
  	            return LZUTF8.CompressionCommon.getCroppedBuffer(this.outputBuffer, outputStartPosition, this.outputPosition - outputStartPosition);
  	        };
  	        Decompressor.prototype.outputByte = function (value) {
  	            if (this.outputPosition === this.outputBuffer.length)
  	                this.outputBuffer = LZUTF8.ArrayTools.doubleByteArrayCapacity(this.outputBuffer);
  	            this.outputBuffer[this.outputPosition++] = value;
  	        };
  	        Decompressor.prototype.cropOutputBufferToWindowAndInitialize = function (initialCapacity) {
  	            if (!this.outputBuffer) {
  	                this.outputBuffer = new Uint8Array(initialCapacity);
  	                return 0;
  	            }
  	            var cropLength = Math.min(this.outputPosition, this.MaximumMatchDistance);
  	            this.outputBuffer = LZUTF8.CompressionCommon.getCroppedBuffer(this.outputBuffer, this.outputPosition - cropLength, cropLength, initialCapacity);
  	            this.outputPosition = cropLength;
  	            if (this.outputBufferRemainder) {
  	                for (var i = 0; i < this.outputBufferRemainder.length; i++)
  	                    this.outputByte(this.outputBufferRemainder[i]);
  	                this.outputBufferRemainder = undefined;
  	            }
  	            return cropLength;
  	        };
  	        Decompressor.prototype.rollBackIfOutputBufferEndsWithATruncatedMultibyteSequence = function () {
  	            for (var offset = 1; offset <= 4 && this.outputPosition - offset >= 0; offset++) {
  	                var value = this.outputBuffer[this.outputPosition - offset];
  	                if ((offset < 4 && (value >>> 3) === 30) ||
  	                    (offset < 3 && (value >>> 4) === 14) ||
  	                    (offset < 2 && (value >>> 5) === 6)) {
  	                    this.outputBufferRemainder = this.outputBuffer.subarray(this.outputPosition - offset, this.outputPosition);
  	                    this.outputPosition -= offset;
  	                    return;
  	                }
  	            }
  	        };
  	        return Decompressor;
  	    }());
  	    LZUTF8.Decompressor = Decompressor;
  	})(LZUTF8 || (LZUTF8 = {}));
  	var LZUTF8;
  	(function (LZUTF8) {
  	    (function (Encoding) {
  	        (function (Base64) {
  	            var charCodeMap = new Uint8Array([65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 43, 47]);
  	            var reverseCharCodeMap = new Uint8Array([255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 62, 255, 255, 255, 63, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 255, 255, 255, 0, 255, 255, 255, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 255, 255, 255, 255, 255, 255, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 255, 255, 255, 255]);
  	            var paddingCharacter = "=";
  	            var paddingCharCode = 61;
  	            Base64.encode = function (inputBytes) {
  	                if (!inputBytes || inputBytes.length == 0)
  	                    return "";
  	                if (LZUTF8.runningInNodeJS()) {
  	                    return (LZUTF8.BufferTools.uint8ArrayToBuffer(inputBytes)).toString("base64");
  	                }
  	                else {
  	                    return Base64.encodeWithJS(inputBytes);
  	                }
  	            };
  	            Base64.decode = function (base64String) {
  	                if (!base64String)
  	                    return new Uint8Array(0);
  	                if (LZUTF8.runningInNodeJS()) {
  	                    return LZUTF8.BufferTools.bufferToUint8Array(Buffer$u.from(base64String, "base64"));
  	                }
  	                else {
  	                    return Base64.decodeWithJS(base64String);
  	                }
  	            };
  	            Base64.encodeWithJS = function (inputBytes, addPadding) {
  	                if (addPadding === void 0) { addPadding = true; }
  	                if (!inputBytes || inputBytes.length == 0)
  	                    return "";
  	                var map = charCodeMap;
  	                var output = new LZUTF8.StringBuilder();
  	                var uint24;
  	                for (var readPosition = 0, length_5 = inputBytes.length; readPosition < length_5; readPosition += 3) {
  	                    if (readPosition <= length_5 - 3) {
  	                        uint24 = inputBytes[readPosition] << 16 | inputBytes[readPosition + 1] << 8 | inputBytes[readPosition + 2];
  	                        output.appendCharCode(map[(uint24 >>> 18) & 63]);
  	                        output.appendCharCode(map[(uint24 >>> 12) & 63]);
  	                        output.appendCharCode(map[(uint24 >>> 6) & 63]);
  	                        output.appendCharCode(map[(uint24) & 63]);
  	                        uint24 = 0;
  	                    }
  	                    else if (readPosition === length_5 - 2) {
  	                        uint24 = inputBytes[readPosition] << 16 | inputBytes[readPosition + 1] << 8;
  	                        output.appendCharCode(map[(uint24 >>> 18) & 63]);
  	                        output.appendCharCode(map[(uint24 >>> 12) & 63]);
  	                        output.appendCharCode(map[(uint24 >>> 6) & 63]);
  	                        if (addPadding)
  	                            output.appendCharCode(paddingCharCode);
  	                    }
  	                    else if (readPosition === length_5 - 1) {
  	                        uint24 = inputBytes[readPosition] << 16;
  	                        output.appendCharCode(map[(uint24 >>> 18) & 63]);
  	                        output.appendCharCode(map[(uint24 >>> 12) & 63]);
  	                        if (addPadding) {
  	                            output.appendCharCode(paddingCharCode);
  	                            output.appendCharCode(paddingCharCode);
  	                        }
  	                    }
  	                }
  	                return output.getOutputString();
  	            };
  	            Base64.decodeWithJS = function (base64String, outputBuffer) {
  	                if (!base64String || base64String.length == 0)
  	                    return new Uint8Array(0);
  	                var lengthModulo4 = base64String.length % 4;
  	                if (lengthModulo4 === 1)
  	                    throw new Error("Invalid Base64 string: length % 4 == 1");
  	                else if (lengthModulo4 === 2)
  	                    base64String += paddingCharacter + paddingCharacter;
  	                else if (lengthModulo4 === 3)
  	                    base64String += paddingCharacter;
  	                if (!outputBuffer)
  	                    outputBuffer = new Uint8Array(base64String.length);
  	                var outputPosition = 0;
  	                var length = base64String.length;
  	                for (var i = 0; i < length; i += 4) {
  	                    var uint24 = (reverseCharCodeMap[base64String.charCodeAt(i)] << 18) |
  	                        (reverseCharCodeMap[base64String.charCodeAt(i + 1)] << 12) |
  	                        (reverseCharCodeMap[base64String.charCodeAt(i + 2)] << 6) |
  	                        (reverseCharCodeMap[base64String.charCodeAt(i + 3)]);
  	                    outputBuffer[outputPosition++] = (uint24 >>> 16) & 255;
  	                    outputBuffer[outputPosition++] = (uint24 >>> 8) & 255;
  	                    outputBuffer[outputPosition++] = (uint24) & 255;
  	                }
  	                if (base64String.charCodeAt(length - 1) == paddingCharCode)
  	                    outputPosition--;
  	                if (base64String.charCodeAt(length - 2) == paddingCharCode)
  	                    outputPosition--;
  	                return outputBuffer.subarray(0, outputPosition);
  	            };
  	        })(Encoding.Base64 || (Encoding.Base64 = {}));
  	    })(LZUTF8.Encoding || (LZUTF8.Encoding = {}));
  	})(LZUTF8 || (LZUTF8 = {}));
  	var LZUTF8;
  	(function (LZUTF8) {
  	    (function (Encoding) {
  	        (function (BinaryString) {
  	            BinaryString.encode = function (input) {
  	                if (input == null)
  	                    throw new TypeError("BinaryString.encode: undefined or null input received");
  	                if (input.length === 0)
  	                    return "";
  	                var inputLength = input.length;
  	                var outputStringBuilder = new LZUTF8.StringBuilder();
  	                var remainder = 0;
  	                var state = 1;
  	                for (var i = 0; i < inputLength; i += 2) {
  	                    var value = void 0;
  	                    if (i == inputLength - 1)
  	                        value = (input[i] << 8);
  	                    else
  	                        value = (input[i] << 8) | input[i + 1];
  	                    outputStringBuilder.appendCharCode((remainder << (16 - state)) | value >>> state);
  	                    remainder = value & ((1 << state) - 1);
  	                    if (state === 15) {
  	                        outputStringBuilder.appendCharCode(remainder);
  	                        remainder = 0;
  	                        state = 1;
  	                    }
  	                    else {
  	                        state += 1;
  	                    }
  	                    if (i >= inputLength - 2)
  	                        outputStringBuilder.appendCharCode(remainder << (16 - state));
  	                }
  	                outputStringBuilder.appendCharCode(32768 | (inputLength % 2));
  	                return outputStringBuilder.getOutputString();
  	            };
  	            BinaryString.decode = function (input) {
  	                if (typeof input !== "string")
  	                    throw new TypeError("BinaryString.decode: invalid input type");
  	                if (input == "")
  	                    return new Uint8Array(0);
  	                var output = new Uint8Array(input.length * 3);
  	                var outputPosition = 0;
  	                var appendToOutput = function (value) {
  	                    output[outputPosition++] = value >>> 8;
  	                    output[outputPosition++] = value & 255;
  	                };
  	                var remainder = 0;
  	                var state = 0;
  	                for (var i = 0; i < input.length; i++) {
  	                    var value = input.charCodeAt(i);
  	                    if (value >= 32768) {
  	                        if (value == (32768 | 1))
  	                            outputPosition--;
  	                        state = 0;
  	                        continue;
  	                    }
  	                    if (state == 0) {
  	                        remainder = value;
  	                    }
  	                    else {
  	                        appendToOutput((remainder << state) | (value >>> (15 - state)));
  	                        remainder = value & ((1 << (15 - state)) - 1);
  	                    }
  	                    if (state == 15)
  	                        state = 0;
  	                    else
  	                        state += 1;
  	                }
  	                return output.subarray(0, outputPosition);
  	            };
  	        })(Encoding.BinaryString || (Encoding.BinaryString = {}));
  	    })(LZUTF8.Encoding || (LZUTF8.Encoding = {}));
  	})(LZUTF8 || (LZUTF8 = {}));
  	var LZUTF8;
  	(function (LZUTF8) {
  	    (function (Encoding) {
  	        (function (CodePoint) {
  	            CodePoint.encodeFromString = function (str, position) {
  	                var charCode = str.charCodeAt(position);
  	                if (charCode < 0xD800 || charCode > 0xDBFF)
  	                    return charCode;
  	                else {
  	                    var nextCharCode = str.charCodeAt(position + 1);
  	                    if (nextCharCode >= 0xDC00 && nextCharCode <= 0xDFFF)
  	                        return 0x10000 + (((charCode - 0xD800) << 10) + (nextCharCode - 0xDC00));
  	                    else
  	                        throw new Error("getUnicodeCodePoint: Received a lead surrogate character, char code " + charCode + ", followed by " + nextCharCode + ", which is not a trailing surrogate character code.");
  	                }
  	            };
  	            CodePoint.decodeToString = function (codePoint) {
  	                if (codePoint <= 0xFFFF)
  	                    return String.fromCharCode(codePoint);
  	                else if (codePoint <= 0x10FFFF)
  	                    return String.fromCharCode(0xD800 + ((codePoint - 0x10000) >>> 10), 0xDC00 + ((codePoint - 0x10000) & 1023));
  	                else
  	                    throw new Error("getStringFromUnicodeCodePoint: A code point of " + codePoint + " cannot be encoded in UTF-16");
  	            };
  	        })(Encoding.CodePoint || (Encoding.CodePoint = {}));
  	    })(LZUTF8.Encoding || (LZUTF8.Encoding = {}));
  	})(LZUTF8 || (LZUTF8 = {}));
  	var LZUTF8;
  	(function (LZUTF8) {
  	    (function (Encoding) {
  	        (function (DecimalString) {
  	            var lookupTable = ["000", "001", "002", "003", "004", "005", "006", "007", "008", "009", "010", "011", "012", "013", "014", "015", "016", "017", "018", "019", "020", "021", "022", "023", "024", "025", "026", "027", "028", "029", "030", "031", "032", "033", "034", "035", "036", "037", "038", "039", "040", "041", "042", "043", "044", "045", "046", "047", "048", "049", "050", "051", "052", "053", "054", "055", "056", "057", "058", "059", "060", "061", "062", "063", "064", "065", "066", "067", "068", "069", "070", "071", "072", "073", "074", "075", "076", "077", "078", "079", "080", "081", "082", "083", "084", "085", "086", "087", "088", "089", "090", "091", "092", "093", "094", "095", "096", "097", "098", "099", "100", "101", "102", "103", "104", "105", "106", "107", "108", "109", "110", "111", "112", "113", "114", "115", "116", "117", "118", "119", "120", "121", "122", "123", "124", "125", "126", "127", "128", "129", "130", "131", "132", "133", "134", "135", "136", "137", "138", "139", "140", "141", "142", "143", "144", "145", "146", "147", "148", "149", "150", "151", "152", "153", "154", "155", "156", "157", "158", "159", "160", "161", "162", "163", "164", "165", "166", "167", "168", "169", "170", "171", "172", "173", "174", "175", "176", "177", "178", "179", "180", "181", "182", "183", "184", "185", "186", "187", "188", "189", "190", "191", "192", "193", "194", "195", "196", "197", "198", "199", "200", "201", "202", "203", "204", "205", "206", "207", "208", "209", "210", "211", "212", "213", "214", "215", "216", "217", "218", "219", "220", "221", "222", "223", "224", "225", "226", "227", "228", "229", "230", "231", "232", "233", "234", "235", "236", "237", "238", "239", "240", "241", "242", "243", "244", "245", "246", "247", "248", "249", "250", "251", "252", "253", "254", "255"];
  	            DecimalString.encode = function (binaryBytes) {
  	                var resultArray = [];
  	                for (var i = 0; i < binaryBytes.length; i++)
  	                    resultArray.push(lookupTable[binaryBytes[i]]);
  	                return resultArray.join(" ");
  	            };
  	        })(Encoding.DecimalString || (Encoding.DecimalString = {}));
  	    })(LZUTF8.Encoding || (LZUTF8.Encoding = {}));
  	})(LZUTF8 || (LZUTF8 = {}));
  	var LZUTF8;
  	(function (LZUTF8) {
  	    (function (Encoding) {
  	        (function (StorageBinaryString) {
  	            StorageBinaryString.encode = function (input) {
  	                return Encoding.BinaryString.encode(input).replace(/\0/g, '\u8002');
  	            };
  	            StorageBinaryString.decode = function (input) {
  	                return Encoding.BinaryString.decode(input.replace(/\u8002/g, '\0'));
  	            };
  	        })(Encoding.StorageBinaryString || (Encoding.StorageBinaryString = {}));
  	    })(LZUTF8.Encoding || (LZUTF8.Encoding = {}));
  	})(LZUTF8 || (LZUTF8 = {}));
  	var LZUTF8;
  	(function (LZUTF8) {
  	    (function (Encoding) {
  	        (function (UTF8) {
  	            var nativeTextEncoder;
  	            var nativeTextDecoder;
  	            UTF8.encode = function (str) {
  	                if (!str || str.length == 0)
  	                    return new Uint8Array(0);
  	                if (LZUTF8.runningInNodeJS()) {
  	                    return LZUTF8.BufferTools.bufferToUint8Array(Buffer$u.from(str, "utf8"));
  	                }
  	                else if (UTF8.createNativeTextEncoderAndDecoderIfAvailable()) {
  	                    return nativeTextEncoder.encode(str);
  	                }
  	                else {
  	                    return UTF8.encodeWithJS(str);
  	                }
  	            };
  	            UTF8.decode = function (utf8Bytes) {
  	                if (!utf8Bytes || utf8Bytes.length == 0)
  	                    return "";
  	                if (LZUTF8.runningInNodeJS()) {
  	                    return LZUTF8.BufferTools.uint8ArrayToBuffer(utf8Bytes).toString("utf8");
  	                }
  	                else if (UTF8.createNativeTextEncoderAndDecoderIfAvailable()) {
  	                    return nativeTextDecoder.decode(utf8Bytes);
  	                }
  	                else {
  	                    return UTF8.decodeWithJS(utf8Bytes);
  	                }
  	            };
  	            UTF8.encodeWithJS = function (str, outputArray) {
  	                if (!str || str.length == 0)
  	                    return new Uint8Array(0);
  	                if (!outputArray)
  	                    outputArray = new Uint8Array(str.length * 4);
  	                var writeIndex = 0;
  	                for (var readIndex = 0; readIndex < str.length; readIndex++) {
  	                    var charCode = Encoding.CodePoint.encodeFromString(str, readIndex);
  	                    if (charCode <= 0x7F) {
  	                        outputArray[writeIndex++] = charCode;
  	                    }
  	                    else if (charCode <= 0x7FF) {
  	                        outputArray[writeIndex++] = 0xC0 | (charCode >>> 6);
  	                        outputArray[writeIndex++] = 0x80 | (charCode & 63);
  	                    }
  	                    else if (charCode <= 0xFFFF) {
  	                        outputArray[writeIndex++] = 0xE0 | (charCode >>> 12);
  	                        outputArray[writeIndex++] = 0x80 | ((charCode >>> 6) & 63);
  	                        outputArray[writeIndex++] = 0x80 | (charCode & 63);
  	                    }
  	                    else if (charCode <= 0x10FFFF) {
  	                        outputArray[writeIndex++] = 0xF0 | (charCode >>> 18);
  	                        outputArray[writeIndex++] = 0x80 | ((charCode >>> 12) & 63);
  	                        outputArray[writeIndex++] = 0x80 | ((charCode >>> 6) & 63);
  	                        outputArray[writeIndex++] = 0x80 | (charCode & 63);
  	                        readIndex++;
  	                    }
  	                    else
  	                        throw new Error("Invalid UTF-16 string: Encountered a character unsupported by UTF-8/16 (RFC 3629)");
  	                }
  	                return outputArray.subarray(0, writeIndex);
  	            };
  	            UTF8.decodeWithJS = function (utf8Bytes, startOffset, endOffset) {
  	                if (startOffset === void 0) { startOffset = 0; }
  	                if (!utf8Bytes || utf8Bytes.length == 0)
  	                    return "";
  	                if (endOffset === undefined)
  	                    endOffset = utf8Bytes.length;
  	                var output = new LZUTF8.StringBuilder();
  	                var outputCodePoint;
  	                var leadByte;
  	                for (var readIndex = startOffset, length_6 = endOffset; readIndex < length_6;) {
  	                    leadByte = utf8Bytes[readIndex];
  	                    if ((leadByte >>> 7) === 0) {
  	                        outputCodePoint = leadByte;
  	                        readIndex += 1;
  	                    }
  	                    else if ((leadByte >>> 5) === 6) {
  	                        if (readIndex + 1 >= endOffset)
  	                            throw new Error("Invalid UTF-8 stream: Truncated codepoint sequence encountered at position " + readIndex);
  	                        outputCodePoint = ((leadByte & 31) << 6) | (utf8Bytes[readIndex + 1] & 63);
  	                        readIndex += 2;
  	                    }
  	                    else if ((leadByte >>> 4) === 14) {
  	                        if (readIndex + 2 >= endOffset)
  	                            throw new Error("Invalid UTF-8 stream: Truncated codepoint sequence encountered at position " + readIndex);
  	                        outputCodePoint = ((leadByte & 15) << 12) | ((utf8Bytes[readIndex + 1] & 63) << 6) | (utf8Bytes[readIndex + 2] & 63);
  	                        readIndex += 3;
  	                    }
  	                    else if ((leadByte >>> 3) === 30) {
  	                        if (readIndex + 3 >= endOffset)
  	                            throw new Error("Invalid UTF-8 stream: Truncated codepoint sequence encountered at position " + readIndex);
  	                        outputCodePoint = ((leadByte & 7) << 18) | ((utf8Bytes[readIndex + 1] & 63) << 12) | ((utf8Bytes[readIndex + 2] & 63) << 6) | (utf8Bytes[readIndex + 3] & 63);
  	                        readIndex += 4;
  	                    }
  	                    else
  	                        throw new Error("Invalid UTF-8 stream: An invalid lead byte value encountered at position " + readIndex);
  	                    output.appendCodePoint(outputCodePoint);
  	                }
  	                return output.getOutputString();
  	            };
  	            UTF8.createNativeTextEncoderAndDecoderIfAvailable = function () {
  	                if (nativeTextEncoder)
  	                    return true;
  	                if (typeof TextEncoder == "function") {
  	                    nativeTextEncoder = new TextEncoder("utf-8");
  	                    nativeTextDecoder = new TextDecoder("utf-8");
  	                    return true;
  	                }
  	                else
  	                    return false;
  	            };
  	        })(Encoding.UTF8 || (Encoding.UTF8 = {}));
  	    })(LZUTF8.Encoding || (LZUTF8.Encoding = {}));
  	})(LZUTF8 || (LZUTF8 = {}));
  	var LZUTF8;
  	(function (LZUTF8) {
  	    function compress(input, options) {
  	        if (options === void 0) { options = {}; }
  	        if (input == null)
  	            throw new TypeError("compress: undefined or null input received");
  	        var inputEncoding = LZUTF8.CompressionCommon.detectCompressionSourceEncoding(input);
  	        options = LZUTF8.ObjectTools.override({ inputEncoding: inputEncoding, outputEncoding: "ByteArray" }, options);
  	        var compressor = new LZUTF8.Compressor();
  	        var compressedBytes = compressor.compressBlock(input);
  	        return LZUTF8.CompressionCommon.encodeCompressedBytes(compressedBytes, options.outputEncoding);
  	    }
  	    LZUTF8.compress = compress;
  	    function decompress(input, options) {
  	        if (options === void 0) { options = {}; }
  	        if (input == null)
  	            throw new TypeError("decompress: undefined or null input received");
  	        options = LZUTF8.ObjectTools.override({ inputEncoding: "ByteArray", outputEncoding: "String" }, options);
  	        var inputBytes = LZUTF8.CompressionCommon.decodeCompressedBytes(input, options.inputEncoding);
  	        var decompressor = new LZUTF8.Decompressor();
  	        var decompressedBytes = decompressor.decompressBlock(inputBytes);
  	        return LZUTF8.CompressionCommon.encodeDecompressedBytes(decompressedBytes, options.outputEncoding);
  	    }
  	    LZUTF8.decompress = decompress;
  	    function compressAsync(input, options, callback) {
  	        if (callback == null)
  	            callback = function () { };
  	        var inputEncoding;
  	        try {
  	            inputEncoding = LZUTF8.CompressionCommon.detectCompressionSourceEncoding(input);
  	        }
  	        catch (e) {
  	            callback(undefined, e);
  	            return;
  	        }
  	        options = LZUTF8.ObjectTools.override({
  	            inputEncoding: inputEncoding,
  	            outputEncoding: "ByteArray",
  	            useWebWorker: true,
  	            blockSize: 65536
  	        }, options);
  	        LZUTF8.enqueueImmediate(function () {
  	            if (options.useWebWorker && LZUTF8.WebWorker.createGlobalWorkerIfNeeded()) {
  	                LZUTF8.WebWorker.compressAsync(input, options, callback);
  	            }
  	            else {
  	                LZUTF8.AsyncCompressor.compressAsync(input, options, callback);
  	            }
  	        });
  	    }
  	    LZUTF8.compressAsync = compressAsync;
  	    function decompressAsync(input, options, callback) {
  	        if (callback == null)
  	            callback = function () { };
  	        if (input == null) {
  	            callback(undefined, new TypeError("decompressAsync: undefined or null input received"));
  	            return;
  	        }
  	        options = LZUTF8.ObjectTools.override({
  	            inputEncoding: "ByteArray",
  	            outputEncoding: "String",
  	            useWebWorker: true,
  	            blockSize: 65536
  	        }, options);
  	        var normalizedInput = LZUTF8.BufferTools.convertToUint8ArrayIfNeeded(input);
  	        LZUTF8.EventLoop.enqueueImmediate(function () {
  	            if (options.useWebWorker && LZUTF8.WebWorker.createGlobalWorkerIfNeeded()) {
  	                LZUTF8.WebWorker.decompressAsync(normalizedInput, options, callback);
  	            }
  	            else {
  	                LZUTF8.AsyncDecompressor.decompressAsync(input, options, callback);
  	            }
  	        });
  	    }
  	    LZUTF8.decompressAsync = decompressAsync;
  	    function createCompressionStream() {
  	        return LZUTF8.AsyncCompressor.createCompressionStream();
  	    }
  	    LZUTF8.createCompressionStream = createCompressionStream;
  	    function createDecompressionStream() {
  	        return LZUTF8.AsyncDecompressor.createDecompressionStream();
  	    }
  	    LZUTF8.createDecompressionStream = createDecompressionStream;
  	    function encodeUTF8(str) {
  	        return LZUTF8.Encoding.UTF8.encode(str);
  	    }
  	    LZUTF8.encodeUTF8 = encodeUTF8;
  	    function decodeUTF8(input) {
  	        return LZUTF8.Encoding.UTF8.decode(input);
  	    }
  	    LZUTF8.decodeUTF8 = decodeUTF8;
  	    function encodeBase64(input) {
  	        return LZUTF8.Encoding.Base64.encode(input);
  	    }
  	    LZUTF8.encodeBase64 = encodeBase64;
  	    function decodeBase64(str) {
  	        return LZUTF8.Encoding.Base64.decode(str);
  	    }
  	    LZUTF8.decodeBase64 = decodeBase64;
  	    function encodeBinaryString(input) {
  	        return LZUTF8.Encoding.BinaryString.encode(input);
  	    }
  	    LZUTF8.encodeBinaryString = encodeBinaryString;
  	    function decodeBinaryString(str) {
  	        return LZUTF8.Encoding.BinaryString.decode(str);
  	    }
  	    LZUTF8.decodeBinaryString = decodeBinaryString;
  	    function encodeStorageBinaryString(input) {
  	        return LZUTF8.Encoding.StorageBinaryString.encode(input);
  	    }
  	    LZUTF8.encodeStorageBinaryString = encodeStorageBinaryString;
  	    function decodeStorageBinaryString(str) {
  	        return LZUTF8.Encoding.StorageBinaryString.decode(str);
  	    }
  	    LZUTF8.decodeStorageBinaryString = decodeStorageBinaryString;
  	})(LZUTF8 || (LZUTF8 = {})); 
  } (lzutf8$1));

  var lzutf8Exports = lzutf8$1.exports;

  const { pipe: pipe$1, curry: curry$1, sort, difference, __: __$1 } = require$$0$2;

  const { recursiveReplace } = util;

  const lzutf8 = lzutf8Exports;

  const compress$1 = (x) =>
    lzutf8.compress(x, {
      outputEncoding: "Buffer",
    });

  // Curried decompress

  const _lzutf8Decompress = curry$1(lzutf8.decompress)(__$1, {
    inputEncoding: "Buffer",
    outputEncoding: "String",
  });

  // Decompress a buffer using LZ decompression
  const decompress$1 = pipe$1(Buffer$u.from, _lzutf8Decompress);

  // Builds a ranking table and filters the two characters that can be compressed that yield good results

  const findOptimal = (secret, characters) => {
    const dict = characters.reduce((acc, data) => {
      acc[data] = {};
      return acc;
    }, {});
    const size = secret.length;
    for (let j = 0; j < size; j++) {
      let count = 1;
      while (j < size && secret[j] === secret[j + 1]) {
        count++;
        j++;
      }
      if (count >= 2) {
        let itr = count;
        while (itr >= 2) {
          dict[secret[j]][itr] =
            (dict[secret[j]][itr] || 0) + Math.floor(count / itr) * (itr - 1);
          itr--;
        }
      }
    }
    const getOptimal = [];
    for (const key in dict) {
      for (const count in dict[key]) {
        getOptimal.push([key + count, dict[key][count]]);
      }
    }
    const rankedTable = sort((a, b) => b[1] - a[1], getOptimal);

    let reqZwc = rankedTable
      .filter((val) => val[0][1] === "2")
      .slice(0, 2)
      .map((chars) => chars[0][0]);

    if (reqZwc.length !== 2) {
      reqZwc = reqZwc.concat(
        difference(characters, reqZwc).slice(0, 2 - reqZwc.length)
      );
    }

    return reqZwc.slice().sort();
  };

  const zwcHuffMan$1 = (zwc) => {
    const tableMap = [
      zwc[0] + zwc[1],
      zwc[0] + zwc[2],
      zwc[0] + zwc[3],
      zwc[1] + zwc[2],
      zwc[1] + zwc[3],
      zwc[2] + zwc[3],
    ];

    const _getCompressFlag = (zwc1, zwc2) =>
      zwc[tableMap.indexOf(zwc1 + zwc2)]; // zwA,zwB => zwD

    const _extractCompressFlag = (zwc1) => tableMap[zwc.indexOf(zwc1)].split(""); // zwcD => zwA,zwcB

    const shrink = (secret) => {
      const repeatChars = findOptimal(secret, zwc.slice(0, 4));
      return (
        _getCompressFlag(...repeatChars) +
        recursiveReplace(
          secret,
          repeatChars.map((x) => x + x),
          [zwc[4], zwc[5]]
        )
      );
    };

    const expand = (secret) => {
      const flag = secret[0];
      const invisibleStream = secret.slice(1);
      const repeatChars = _extractCompressFlag(flag);
      return recursiveReplace(
        invisibleStream,
        [zwc[4], zwc[5]],
        repeatChars.map((x) => x + x)
      );
    };

    return {
      shrink,
      expand,
    };
  };

  var compact = {
    compress: compress$1,
    decompress: decompress$1,
    zwcHuffMan: zwcHuffMan$1,
  };

  const {
    pipe,
    intersection,
    indexOf,
    curry,
    __,
    slice,
    split,
    join,
    map,
  } = require$$0$2;

  const { zeroPad, nTobin, stepMap, binToByte } = util;

  const zwcOperations$1 = (zwc) => {
    // Map binary to ZWC

    const _binToZWC = (str) => zwc[parseInt(str, 2)];

    // Map ZWC to binary
    const _ZWCTobin = pipe(indexOf(__, zwc), nTobin, zeroPad(2));

    // Data to ZWC hidden string

    const _dataToZWC = (integrity, crypt, str) => {
      const flag = integrity && crypt ? zwc[0] : crypt ? zwc[1] : zwc[2];
      return (
        flag +
        stepMap((x, i) => _binToZWC(str[i] + str[i + 1]))(
          2,
          new Array(str.length).fill()
        ).join("")
      ); // Binary to zwc conversion)
    };

    // Check if encryption or hmac integrity check was performed during encryption

    const flagDetector = (x) => {
      const i = zwc.indexOf(x[0]);
      if (i === 0) {
        return {
          encrypt: true,
          integrity: true,
        };
      } else if (i === 1) {
        return {
          encrypt: true,
          integrity: false,
        };
      } else if (i === 2) {
        return {
          encrypt: false,
          integrity: false,
        };
      }
    };

    // Message curried functions

    const toConcealHmac = curry(_dataToZWC)(true)(true);

    const toConceal = curry(_dataToZWC)(false)(true);

    const noCrypt = curry(_dataToZWC)(false)(false);

    // ZWC string to data
    const concealToData = (str) => {
      const { encrypt, integrity } = flagDetector(str);
      return {
        encrypt,
        integrity,
        data: pipe(
          slice(1, Infinity),
          split(""),
          map(_ZWCTobin),
          join(""),
          binToByte
        )(str),
      };
    };

    const detach = (str) => {
      const eachWords = str.split(" ");
      const detached = eachWords.reduce((acc, word) => {
        const zwcBound = word.split("");
        const intersected = intersection(zwc, zwcBound);
        if (intersected.length !== 0) {
          const limit = zwcBound.findIndex((x, i) => !~zwc.indexOf(x));
          return word.slice(0, limit);
        }
        return acc;
      }, '');
      if (!detached) {
        throw new Error(
          "Invisible stream not detected! Please copy and paste the StegCloak text sent by the sender."
        );
      }
      return detached;
    };

    return {
      detach,
      concealToData,
      toConcealHmac,
      toConceal,
      noCrypt,
    };
  };

  // Embed invisble stream to cover text

  const embed$1 = (cover, secret) => {
    const arr = cover.split(" ");
    const targetIndex = Math.floor(Math.random() * Math.floor(arr.length/2));
    return arr.slice(0, targetIndex+1)
      .concat([secret + arr[targetIndex+1]])
      .concat(arr.slice(targetIndex+2, arr.length))
      .join(" ");
  };

  var message = {
    zwcOperations: zwcOperations$1,
    embed: embed$1,
  };

  const R = require$$0$2;

  const {
    encrypt,
    decrypt
  } = encrypt_1;

  const {
    compress,
    decompress,
    zwcHuffMan
  } = compact;

  const {
    zwcOperations,
    embed
  } = message;

  const zwc = ["‌", "‍", "⁡", "⁢", "⁣", "⁤"]; // 200c,200d,2061,2062,2063,2064 Where the magic happens !

  const {
    toConceal,
    toConcealHmac,
    concealToData,
    noCrypt,
    detach,
  } = zwcOperations(zwc);

  const {
    shrink,
    expand
  } = zwcHuffMan(zwc);

  const {
    byteToBin,
    compliment
  } = util;

  class StegCloak {
    constructor(_encrypt = true, _integrity = false) {
      this.encrypt = _encrypt;

      this.integrity = _integrity;
    }

    static get zwc() {
      return zwc;
    }

    hide(message, password, cover = "This is a confidential text") {
      if (cover.split(" ").length === 1) {
        throw new Error("Minimum two words required");
      }

      const integrity = this.integrity;

      const crypt = this.encrypt;

      const secret = R.pipe(compress, compliment)(message); // Compress and compliment to prepare the secret

      const payload = crypt ?
        encrypt({
          password: password,
          data: secret,
          integrity,
        }) :
        secret; // Encrypt if needed or proxy secret

      const invisibleStream = R.pipe(
        byteToBin,
        integrity && crypt ? toConcealHmac : crypt ? toConceal : noCrypt,
        shrink
      )(payload); // Create an optimal invisible stream of secret

      return embed(cover, invisibleStream); // Embed stream  with cover text
    }

    reveal(secret, password) {
      // Detach invisible characters and convert back to visible characters and also returns analysis of if encryption or integrity check was done

      const {
        data,
        integrity,
        encrypt
      } = R.pipe(
        detach,
        expand,
        concealToData
      )(secret);

      const decryptStream = encrypt ?
        decrypt({
          password,
          data,
          integrity,
        }) :
        data; // Decrypt if needed or proxy secret

      return R.pipe(compliment, decompress)(decryptStream); // Receive the secret
    }
  }

  var stegcloak = StegCloak;

  var StegCloak$1 = /*@__PURE__*/getDefaultExportFromCjs(stegcloak);

  class GimkitRoom {
      constructor(roomId) {
          this.roomId = roomId;
          this.roomInfoReady = new Promise((resolve, reject) => {
              this.resolveRoomInfo = resolve;
          });
          // get info about the room
          this.getRoomInfo();
      }
      getRoomInfo() {
          var _a;
          return __awaiter(this, void 0, void 0, function* () {
              let infoRes = yield fetch('https://www.gimkit.com/api/matchmaker/find-info-from-code', {
                  method: 'POST',
                  body: JSON.stringify({ code: this.roomId }),
                  headers: {
                      'Content-Type': 'application/json'
                  }
              });
              let info = yield infoRes.json();
              if (info.code === 404)
                  throw new Error('Game not found');
              this.roomInfo = info;
              (_a = this.resolveRoomInfo) === null || _a === void 0 ? void 0 : _a.call(this);
          });
      }
      spawn(name = Math.random().toString(36).substring(7)) {
          return __awaiter(this, void 0, void 0, function* () {
              // wait until we have the room info
              yield this.roomInfoReady;
              // load the page
              let pageRes = yield fetch('https://www.gimkit.com/join');
              let page = yield pageRes.text();
              // extract the jid
              const parser = new DOMParser();
              const root = parser.parseFromString(page, "text/html");
              const jid = root.querySelector("meta[property='int:jid']").getAttribute("content").split("").reverse().join("");
              // let clientType = "Gimkit Web Client V3.1"
              let clientType = new StegCloak$1(true, false).hide(jid, "BSKA", "Gimkit Web Client V3.1");
              // join the game
              let joinRes = yield fetch("https://www.gimkit.com/api/matchmaker/join", {
                  headers: {
                      'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                      clientType: clientType,
                      name: name,
                      roomId: this.roomInfo.roomId
                  }),
                  method: "POST"
              });
              let join = yield joinRes.json();
              if (join.source == 'original') {
                  // we are connecting using blueboat
                  const wsUrl = `wss${join.serverUrl.substr(5)}/blueboat/?id=&EIO=3&transport=websocket`;
                  let ws = new WebSocket(wsUrl);
                  ws.addEventListener('open', () => {
                      // send a join packet
                      let packet = blueboat.encode(['blueboat_JOIN_ROOM', {
                              roomId: join.roomId,
                              options: { intent: join.intentId }
                          }]);
                      ws.send(packet);
                      // periodically send a heartbeat packet
                      let heartbeat = setInterval(() => {
                          ws.send('2');
                      }, 25000);
                      // stop the heartbeat when the connection closes
                      ws.addEventListener('close', () => {
                          clearInterval(heartbeat);
                      });
                  });
                  return ws;
              }
              const joinIdUrl = `${join.serverUrl}/matchmake/joinById/${join.roomId}`;
              let roomRes = yield fetch(joinIdUrl, {
                  headers: {
                      'Content-Type': 'application/json'
                  },
                  method: "POST",
                  body: JSON.stringify({
                      intentId: join.intentId
                  })
              });
              let room = yield roomRes.json();
              const wsUrl = `wss${join.serverUrl.substr(5)}/${room.room.processId}/${room.room.roomId}?sessionId=${room.sessionId}`;
              return new WebSocket(wsUrl);
          });
      }
  }
  const hudAddition$1 = {
      menus: [
          {
              name: "General Cheats",
              groups: [
                  {
                      name: "Account Spawner (beta)",
                      elements: [
                          {
                              type: "text",
                              options: {
                                  text: "Spawn an account in your game with any name."
                              }
                          },
                          {
                              type: "button",
                              options: {
                                  text: "Disconnect All",
                                  runFunction: "disconnect"
                              }
                          }
                      ]
                  }
              ]
          }
      ]
  };
  class SpawnerClass {
      constructor() {
          this.name = "Account Spawner";
          this.hudAddition = hudAddition$1;
          this.accountName = "My Epic Bot";
          this.funcs = new Map([
              ["disconnect", () => {
                      this.removeAll();
                  }]
          ]);
          this.connections = [];
      }
      init(cheat) {
          var _a, _b, _c, _d;
          this.cheat = cheat;
          let accountNameInput = (_b = (_a = cheat.hud.menu("General Cheats")) === null || _a === void 0 ? void 0 : _a.group("Account Spawner (beta)")) === null || _b === void 0 ? void 0 : _b.addElement("textinput", {
              text: "Account Name"
          });
          accountNameInput === null || accountNameInput === void 0 ? void 0 : accountNameInput.addEventListener("input", (e) => {
              this.accountName = e.detail;
          });
          let applyButton = (_d = (_c = cheat.hud.menu("General Cheats")) === null || _c === void 0 ? void 0 : _c.group("Account Spawner (beta)")) === null || _d === void 0 ? void 0 : _d.addElement("button", {
              text: "Spawn Account"
          });
          applyButton === null || applyButton === void 0 ? void 0 : applyButton.addEventListener("click", () => {
              this.spawnAccount();
          });
      }
      spawnAccount() {
          return __awaiter(this, void 0, void 0, function* () {
              if (!this.cheat.gameId)
                  return;
              if (!this.room)
                  this.room = new GimkitRoom(this.cheat.gameId);
              this.connections.push(yield this.room.spawn(this.accountName));
          });
      }
      removeAll() {
          for (let connection of this.connections) {
              connection.close();
          }
          this.connections = [];
      }
  }
  function Spawner() {
      return new SpawnerClass();
  }

  const hudAddition = {
      menus: [
          {
              name: "Cheats for gamemodes",
              groups: [
                  {
                      name: "The Floor is Lava",
                      elements: [
                          {
                              type: "toggle",
                              options: {
                                  textEnabled: "Stop Auto Building",
                                  textDisabled: "Start Auto Building",
                                  default: false,
                                  runFunction: "setAutoBuilding",
                                  keybind: true,
                                  keybindId: "autoBuilding"
                              }
                          },
                          {
                              type: "toggle",
                              options: {
                                  textEnabled: "Stop Hiding Popups",
                                  textDisabled: "Start Hiding Popups",
                                  default: false,
                                  runFunction: "setHidingPopups",
                                  keybind: true,
                                  keybindId: "hidingPopups"
                              }
                          }
                      ]
                  }
              ]
          }
      ]
  };
  class LavaClass {
      constructor() {
          this.name = "Floor is Lava";
          this.hudAddition = hudAddition;
          this.money = 0;
          this.autoPurchasing = false;
          this.hidingPopups = false;
          this.funcs = new Map([
              ["setAutoBuilding", (enabled) => {
                      this.autoPurchasing = enabled;
                      if (this.autoPurchasing)
                          this.checkAutoBuy();
                  }], ["setHidingPopups", (enabled) => {
                      this.hidingPopups = enabled;
                      if (enabled)
                          document.querySelectorAll(".Toastify__toast").forEach((e) => e.remove());
                  }]
          ]);
          this.structures = [
              ["spaceElevator", 5e7],
              ["mountain", 5e6],
              ["skyscaper", 5e5],
              ["shoppingMall", 5e4],
              ["house", 5e3],
              ["wall", 5e2],
              ["brick", 50],
              ["plank", 5]
          ];
      }
      init(cheat) {
          this.cheat = cheat;
          // get the amount of money
          this.cheat.socketHandler.addEventListener("recieveMessage", (e) => {
              var _a;
              if (this.cheat.socketHandler.transportType != "blueboat")
                  return;
              if (((_a = e.detail.data) === null || _a === void 0 ? void 0 : _a.type) == "BALANCE") {
                  this.money = e.detail.data.value;
                  this.checkAutoBuy();
              }
          });
          let observer = new MutationObserver((mutations) => {
              if (!this.hidingPopups)
                  return;
              for (let mutation of mutations) {
                  for (let node of mutation.addedNodes) {
                      if (!(node instanceof HTMLElement))
                          continue;
                      if (node.matches(".Toastify__toast"))
                          node.remove();
                  }
              }
          });
          window.addEventListener("load", () => {
              observer.observe(document.body, {
                  childList: true,
                  subtree: true
              });
          });
      }
      checkAutoBuy() {
          if (!this.autoPurchasing)
              return;
          for (let structure of this.structures) {
              if (this.money >= structure[1]) {
                  this.buyStructure(structure[0]);
                  break;
              }
          }
      }
      buyStructure(type) {
          this.cheat.socketHandler.sendData("LAVA_PURCHASE_PIECE", {
              type
          });
      }
  }
  function Lava() {
      return new LavaClass();
  }

  // import { BotCreator } from './scripts/general/botcreator';
  class Cheat extends EventTarget {
      constructor() {
          super();
          this.keybindManager = new KeybindManager();
          this.funcs = new Map();
          this.scripts = [];
          this.gameId = "";
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
              HideEnergy(),
              Spawner(),
              Classic(),
              RichMode(),
              TrustNoOne(),
              Farmchain(),
              Instapurchasers(),
              Lava()
              // BotCreator()
          ];
          this.initScripts();
          this.setupCodeExtraction();
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
      setupCodeExtraction() {
          let nativeSend = XMLHttpRequest.prototype.send;
          let cheat = this;
          XMLHttpRequest.prototype.send = function (...params) {
              this.addEventListener("load", () => {
                  if (this.responseURL.endsWith('/find-info-from-code')) {
                      cheat.gameId = JSON.parse(params[0]).code;
                      cheat.log("Game ID:", cheat.gameId);
                  }
              }, { once: true });
              // @ts-ignore can't be bothered to fix this
              nativeSend.apply(this, params);
          };
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

  cheat.log("Loaded Gimkit Cheat version: " + version$1);
  cheat.antifreeze();
  // make sure the cheat is running
  if (Object.isFrozen(WebSocket)) {
      alert("WebSocket object is still frozen. Please try refreshing the page. If this persists, open an issue on GitHub.");
  }

})();
