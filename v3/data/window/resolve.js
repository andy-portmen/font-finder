'use strict';

// resolve the real name of a web font by parsing the SFNT name table of the fetched file
const fontNameCache = new Map();

const parseNames = dv => {
  const count = dv.getUint16(2);
  const storage = dv.getUint16(4);
  const best = {};
  const decode = (platformID, offset, length) => {
    const bytes = new Uint8Array(dv.buffer, dv.byteOffset + offset, length);
    try {
      return new TextDecoder(platformID === 1 ? 'macintosh' : 'utf-16be').decode(bytes).trim();
    }
    catch (e) {
      return '';
    }
  };
  for (let i = 0; i < count; i += 1) {
    const p = 6 + i * 12;
    const nameID = dv.getUint16(p + 6);
    if (nameID !== 1 && nameID !== 2 && nameID !== 6 && nameID !== 16 && nameID !== 17) {
      continue;
    }
    const platformID = dv.getUint16(p);
    // prefer Windows(3)/Unicode(0) records over Macintosh(1), ignore the rest
    const score = platformID === 3 ? 2 : (platformID === 0 || platformID === 1) ? 1 : 0;
    if (score === 0 || (best[nameID]?.score || 0) >= score) {
      continue;
    }
    best[nameID] = {
      score,
      text: decode(platformID, storage + dv.getUint16(p + 10), dv.getUint16(p + 8))
    };
  }
  if (best[1] === undefined && best[16] === undefined) {
    throw Error('family name is missing');
  }
  return {
    family: (best[16] || best[1]).text,
    subfamily: (best[17] || best[2] || {}).text || '',
    postscript: (best[6] || {}).text || ''
  };
};

const sfntTables = (buffer, offset = 0) => {
  const dv = new DataView(buffer, offset);
  const numTables = dv.getUint16(4);
  const tables = {};
  for (let i = 0; i < numTables; i += 1) {
    const p = 12 + i * 16;
    tables[String.fromCharCode(
      dv.getUint8(p), dv.getUint8(p + 1), dv.getUint8(p + 2), dv.getUint8(p + 3)
    )] = {
      offset: offset + dv.getUint32(p + 8),
      length: dv.getUint32(p + 12)
    };
  }
  return tables;
};

const sfntInfo = (buffer, faceOffset = 0) => {
  const tables = sfntTables(buffer, faceOffset);
  if (tables.name === undefined) {
    throw Error('name table is missing');
  }
  const info = parseNames(new DataView(buffer, tables.name.offset, tables.name.length));
  if (tables.cmap !== undefined) {
    info.ranges = cmapRanges(new DataView(buffer, tables.cmap.offset, tables.cmap.length));
  }
  return info;
};

// compact the cmap coverage into U+XXXX(-YYYY) strings
const parseCmap = dv => {
  const numTables = dv.getUint16(2);
  // pick the best Unicode subtable that actually maps characters; (3, 10) and
  // the (0, 4+) ones cover beyond the BMP; format 14 (variation sequences) maps none
  let best = null;
  let bestScore = 0;
  for (let i = 0; i < numTables; i += 1) {
    const p = 4 + i * 8;
    const platformID = dv.getUint16(p);
    const encodingID = dv.getUint16(p + 2);
    const offset = dv.getUint32(p + 4);
    const format = dv.getUint16(offset);
    if (format !== 4 && format !== 12) {
      continue;
    }
    const score = platformID === 3 ? (encodingID === 10 ? 4 : encodingID === 1 ? 2 : 0) :
      platformID === 0 ? (encodingID >= 4 ? 4 : 2) : 0;
    if (score > bestScore) {
      bestScore = score;
      best = offset;
    }
  }
  if (best === null) {
    return '';
  }
  const set = new Set();
  const format = dv.getUint16(best);
  if (format === 12) {
    const nGroups = dv.getUint32(best + 12);
    for (let i = 0; i < nGroups; i += 1) {
      const p = best + 16 + i * 12;
      const s = dv.getUint32(p);
      const e = dv.getUint32(p + 4);
      for (let c = s; c <= e; c += 1) {
        set.add(c);
      }
    }
  }
  else if (format === 4) {
    const segCount = dv.getUint16(best + 6) / 2;
    const endCodes = best + 14;
    const startCodes = endCodes + segCount * 2 + 2;
    for (let i = 0; i < segCount; i += 1) {
      const end = dv.getUint16(endCodes + i * 2);
      for (let c = dv.getUint16(startCodes + i * 2); c <= end && c !== 0xffff; c += 1) {
        set.add(c);
      }
    }
  }
  else {
    return '';
  }
  // merge consecutive codepoints into ranges
  const codes = [...set].sort((a, b) => a - b);
  const ranges = [];
  let start = null;
  let prev = null;
  for (const c of codes) {
    if (start === null) {
      start = prev = c;
    }
    else if (c !== prev + 1) {
      ranges.push([start, prev]);
      start = prev = c;
    }
    else {
      prev = c;
    }
  }
  if (start !== null) {
    ranges.push([start, prev]);
  }
  return ranges.map(([s, e]) => 'U+' + s.toString(16).toUpperCase() +
    (s === e ? '' : '-' + e.toString(16).toUpperCase())).join(', ');
};

const cmapRanges = dv => {
  try {
    return parseCmap(dv);
  }
  catch (e) {
    return '';
  }
};

const woffTables = async (buffer, tags) => {
  const dv = new DataView(buffer);
  const numTables = dv.getUint16(12);
  const tables = {};
  for (let i = 0; i < numTables; i += 1) {
    const p = 44 + i * 20;
    const tag = String.fromCharCode(
      dv.getUint8(p), dv.getUint8(p + 1), dv.getUint8(p + 2), dv.getUint8(p + 3)
    );
    if (tags.includes(tag) === false) {
      continue;
    }
    const offset = dv.getUint32(p + 4);
    const compLength = dv.getUint32(p + 8);
    const origLength = dv.getUint32(p + 12);
    const chunk = new Uint8Array(buffer, offset, compLength);
    if (compLength === origLength) {
      tables[tag] = chunk;
      continue;
    }
    // each WOFF table is zlib-compressed on its own
    const stream = new Blob([chunk]).stream().pipeThrough(new DecompressionStream('deflate'));
    const bytes = await new Response(stream).arrayBuffer();
    if (bytes.byteLength !== origLength) {
      throw Error('deflated size mismatch');
    }
    tables[tag] = new Uint8Array(bytes);
  }
  return tables;
};

const base128 = (data, p) => {
  let value = 0;
  for (let i = 0; i < 5; i += 1) {
    const b = data[p.i];
    p.i += 1;
    if (i === 0 && b === 0x80) {
      throw Error('invalid base128 encoding');
    }
    value = value * 128 + (b & 0x7f);
    if ((b & 0x80) === 0) {
      return value;
    }
  }
  throw Error('invalid base128 encoding');
};

// the fixed 'Known Tags' table of the WOFF2 spec
const knownTags = [
  'cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep',
  'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE',
  'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt',
  'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar',
  'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill'
];

const brotliDecompress = async bytes => {
  try {
    // Firefox 147+ and Safari 18.4+
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('brotli'));
    return await new Response(stream).arrayBuffer();
  }
  catch (e) {
    // Chrome/Edge: the vendored wasm decoder (data/brotli), see brotli/README
    if (self.brotliDec === undefined) {
      await self.brotliReady;
    }
    const decoder = new self.brotliDec.DecompressStream();
    // result codes: 1 = ResultSuccess, 2 = NeedsMoreInput, 3 = NeedsMoreOutput
    const chunks = [];
    let offset = 0;
    while (true) {
      const r = decoder.decompress(bytes.slice(offset), 65536);
      if (r.buf.length) {
        chunks.push(r.buf);
      }
      // input_offset must always be honored, whatever the result code is
      offset += r.input_offset;
      if (r.code === 3) {       // NeedsMoreOutput: continue with the remaining input
        continue;
      }
      if (r.code === 2) {       // NeedsMoreInput
        if (offset >= bytes.length) {
          throw Error('brotli stream ended early');
        }
        continue;
      }
      if (r.code === 1) {       // ResultSuccess
        break;
      }
      throw Error('brotli decompression failed (code ' + r.code + ')');
    }
    const out = new Uint8Array(chunks.reduce((a, c) => a + c.length, 0));
    let i = 0;
    for (const c of chunks) {
      out.set(c, i);
      i += c.length;
    }
    return out.buffer;
  }
};

const woff2Names = async buffer => {
  const dv = new DataView(buffer);
  if (dv.getUint32(0) !== 0x774f4632 /* 'wOF2' */) {
    throw Error('not a WOFF2 file');
  }
  if (dv.getUint32(4) === 0x74746366 /* 'ttcf' */) {
    throw Error('woff2 collections are not supported');
  }
  const numTables = dv.getUint16(12);
  const totalCompressedSize = dv.getUint32(20);
  // the table directory is stored uncompressed, right after the header;
  // only the table streams that follow it are brotli-compressed
  const directory = new Uint8Array(buffer, 48);
  const p = {i: 0};
  const entries = [];
  for (let i = 0; i < numTables; i += 1) {
    const flags = directory[p.i];
    p.i += 1;
    const version = (flags & 0xc0) >>> 6;
    // bits 0-5: known table index; 63 = arbitrary tag follows
    const known = (flags & 0x3f) !== 0x3f;
    let tag = known ? knownTags[flags & 0x3f] : null;
    if (known === false) {
      tag = String.fromCharCode(
        directory[p.i], directory[p.i + 1], directory[p.i + 2], directory[p.i + 3]
      );
      p.i += 4;
    }
    const origLength = base128(directory, p);
    // a transformLength is present unless this is a null transform; the null
    // transform is version 3 for glyf/loca and version 0 for every other table
    const transformed = (tag === 'glyf' || tag === 'loca') ? version !== 3 : version !== 0;
    const length = transformed ? base128(directory, p) : origLength;
    entries.push({
      tag,
      length
    });
  }
  const data = new Uint8Array(await brotliDecompress(directory.subarray(p.i, p.i + totalCompressedSize)));
  // the streams follow the directory order
  const streams = {};
  let offset = 0;
  for (const e of entries) {
    if (e.tag === 'name' || e.tag === 'cmap') {
      streams[e.tag] = new DataView(data.buffer, data.byteOffset + offset, e.length);
    }
    offset += e.length;
  }
  if (streams.name === undefined) {
    throw Error('name table is missing');
  }
  const info = parseNames(streams.name);
  if (streams.cmap !== undefined) {
    info.ranges = cmapRanges(streams.cmap);
  }
  return info;
};

const resolveFont = async (fontUrl, signal) => {
  if (fontNameCache.has(fontUrl)) {
    return fontNameCache.get(fontUrl);
  }
  const promise = (async () => {
    const response = await fetch(fontUrl, {
      credentials: 'omit',
      cache: 'force-cache',
      signal
    });
    if (response.ok === false) {
      throw Error('HTTP ' + response.status);
    }
    const buffer = await response.arrayBuffer();
    const magic = new DataView(buffer).getUint32(0);
    if (magic === 0x00010000 || magic === 0x74727565 /* 'true' */ || magic === 0x4f54544f /* 'OTTO' */) {
      return sfntInfo(buffer, 0);
    }
    if (magic === 0x74746366 /* 'ttcf' */) {
      // the first face of the collection
      return sfntInfo(buffer, new DataView(buffer).getUint32(12));
    }
    if (magic === 0x774f4646 /* 'wOFF' */) {
      const tables = await woffTables(buffer, ['name', 'cmap']);
      if (tables.name === undefined) {
        throw Error('name table is missing');
      }
      const info = parseNames(new DataView(tables.name.buffer, tables.name.byteOffset, tables.name.byteLength));
      if (tables.cmap !== undefined) {
        info.ranges = cmapRanges(new DataView(tables.cmap.buffer, tables.cmap.byteOffset, tables.cmap.byteLength));
      }
      return info;
    }
    if (magic === 0x774f4632 /* 'wOF2' */) {
      return woff2Names(buffer);
    }
    throw Error('unsupported font format');
  })();
  fontNameCache.set(fontUrl, promise);
  // failed resolutions (network, abort) are retried on the next run
  promise.catch(() => fontNameCache.delete(fontUrl));
  return promise;
};

const displayName = ({family, subfamily}) => {
  if (subfamily && ['Regular', 'Normal'].includes(subfamily) === false &&
    family.toLowerCase().includes(subfamily.toLowerCase()) === false) {
    return family + ' ' + subfamily;
  }
  return family;
};
