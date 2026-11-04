'use strict';

{
  const bio = new Map();
  // faces with no recoverable URL are stored under FACE_KEY + family KEY_SEP weight KEY_SEP style;
  // KEY_SEP must stay in sync with data/window/index.js which parses these keys
  const FACE_KEY = 'face:';
  const KEY_SEP = '\u0000';
  // a src may list several sources; url() ones are downloadable, local() ones are not
  const urlPattern = /url\(\s*(['"]?)(.*?)\1\s*\)/gi;

  // families document.fonts proves are loaded; JS-constructed faces (like
  // Google's gf_ scheme) expose their family but never their URL
  const loadedFamilies = new Set();
  for (const face of document.fonts) {
    const name = face.family.replace(/['"]/g, '').trim().toLowerCase();
    loadedFamilies.add(name);
    // 'gf_Redaction_10 variant0' -> 'redaction 10'
    const m = /^gf_(.+?)(?: variant\d+)?$/.exec(name);
    if (m) {
      loadedFamilies.add(m[1].replace(/_/g, ' ').trim());
    }
  }

  // keep late font loads in the resource timing buffer for the async phases
  try {
    performance.setResourceTimingBufferSize(10000);
  }
  catch (e) {}

  const addFace = (rule, base, knownOnly) => {
    const s = rule.style;
    const fontFamily = s.getPropertyValue('font-family').replace(/['"]/g, '').trim();
    if (fontFamily === '') {
      return;
    }
    let m;
    while (m = urlPattern.exec(s.getPropertyValue('src'))) {
      let fontUrl = m[2].trim();
      if (fontUrl) {
        // full absolute URL, relative to the stylesheet, not the document
        try {
          fontUrl = new URL(fontUrl, base).href;
        }
        catch (e) {}

        // knownOnly: dynamic font CSS (like Google's) may return different URLs on
        // every fetch; only attach metadata to URLs the page actually loaded,
        // unless the family is one document.fonts proves is loaded
        if (fontUrl && (knownOnly === false || bio.has(fontUrl) || loadedFamilies.has(fontFamily.toLowerCase()))) {
          if (bio.has(fontUrl) === false || bio.get(fontUrl).fontFamily === undefined) {
            // resource-only entries (no fontFamily) get replaced by the @font-face info
            bio.set(fontUrl, {
              fontFamily,
              weight: s.getPropertyValue('font-weight'),
              style: s.getPropertyValue('font-style'),
              stretch: s.getPropertyValue('font-stretch'),
              display: s.getPropertyValue('font-display'),
              'unicode-range': s.getPropertyValue('unicode-range')
            });
          }
        }
      }
    }
  };

  // @font-face may be nested inside @media, @supports, @layer, ...
  const walk = (rules, base, knownOnly) => {
    for (const rule of rules) {
      if (rule instanceof CSSFontFaceRule) {
        addFace(rule, base, knownOnly);
      }
      else if (rule.cssRules) {
        walk(rule.cssRules, base, knownOnly);
      }
    }
  };

  // cross-origin stylesheets block cssRules access; their text is fetched later
  const unreadable = [];
  const walkSheet = (sheet, base) => {
    try {
      walk(sheet.cssRules, base, false);
    }
    catch (e) {
      if (sheet.href) {
        unreadable.push(sheet.href);
      }
      else {
        console.error(e, sheet);
      }
    }
  };
  for (const stylesheet of document.styleSheets) {
    walkSheet(stylesheet, stylesheet.href || location.href);
  }
  // constructable stylesheets are not part of document.styleSheets
  for (const sheet of document.adoptedStyleSheets || []) {
    walkSheet(sheet, location.href);
  }
  // nor are the styles of shadow roots
  for (const el of document.querySelectorAll('*')) {
    const root = el.shadowRoot;
    if (root) {
      for (const sheet of root.styleSheets) {
        walkSheet(sheet, sheet.href || location.href);
      }
      for (const sheet of root.adoptedStyleSheets || []) {
        walkSheet(sheet, location.href);
      }
    }
  }

  // font-serving CDNs serve their CSS with CORS, so the blocked rules can be
  // recovered by fetching the stylesheet and parsing it with the CSSOM
  const enrich = async () => {
    for (const href of unreadable) {
      try {
        const response = await fetch(href, {credentials: 'omit'});
        if (response.ok === false) {
          continue;
        }
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(await response.text());
        walk(sheet.cssRules, href, true);
      }
      catch (e) {}
    }
  };

  // font URLs the page actually fetched
  const addResource = e => {
    if (e.initiatorType === 'font' || /\.(woff2?|eot|ttf|ttc|otf|pfb|pfm)(\?|$)/i.test(e.name)) {
      if (bio.has(e.name) === false) {
        bio.set(e.name, {
          initiator: e.initiatorType
        });
      }
    }
  };
  const scanPerformance = () => {
    for (const e of performance.getEntriesByType('resource')) {
      addResource(e);
    }
  };
  scanPerformance();
  // the timing buffer drops entries on heavy pages and fonts may (re)load at
  // any time; the observer delivers every font load from here on
  try {
    new PerformanceObserver(list => {
      for (const e of list.getEntries()) {
        addResource(e);
      }
      sendBioUpdate();
    }).observe({
      type: 'resource',
      buffered: true
    });
  }
  catch (e) {}

  // JS-constructed faces whose family has no bio coverage (no @font-face
  // rule, no resource entry) still name the family they expose; their URL
  // is not recoverable from the API
  const scanFaces = () => {
    for (const face of document.fonts) {
      const family = face.family.replace(/['"]/g, '').trim();
      if (family === '' || family === 'notdef' || [...bio.values()].some(o => o.fontFamily === family)) {
        continue;
      }
      bio.set(FACE_KEY + [family, face.weight, face.style].join(KEY_SEP), {
        fontFamily: family,
        weight: face.weight,
        style: face.style,
        display: face.display
      });
    }
  };
  scanFaces();
  // late-constructed JS faces (dynamic pages) surface here
  document.fonts.addEventListener('loadingdone', () => {
    scanFaces();
    sendBioUpdate();
  });

  // the report is sent before the slow phases run; their gains are pushed later
  const initial = new Map(bio);
  const sendBioUpdate = () => {
    const entries = [];
    for (const [fontUrl, o] of bio.entries()) {
      const before = initial.get(fontUrl);
      if (before === undefined || (before.fontFamily === undefined && o.fontFamily !== undefined)) {
        entries.push({
          fontUrl,
          ...o
        });
      }
    }
    if (entries.length) {
      chrome.runtime.sendMessage({
        cmd: 'bio',
        entries
      }, () => chrome.runtime.lastError);
    }
  };
  const runAsync = async () => {
    // late loads (dynamic pages re-fetch fonts as you scroll or type) are
    // caught by re-scanning; the gains are pushed to the inspector
    scanPerformance();
    scanFaces();
    sendBioUpdate();
    await enrich();
    sendBioUpdate();
    await attribute();
    sendBioUpdate();
  };

  // JS-constructed FontFaces (like the gf_ scheme) expose their family but never
  // their URL, so unclaimed URLs are attributed by rendering: a probe face loaded
  // from the URL must draw the same glyphs as the family's faces do
  const attribute = async () => {
    const candidates = [];
    for (const face of document.fonts) {
      if (face.family !== 'notdef' && candidates.includes(face.family) === false) {
        candidates.push(face.family);
      }
    }
    const unclaimed = [];
    for (const [fontUrl, o] of bio.entries()) {
      if (o.fontFamily === undefined) {
        unclaimed.push(fontUrl);
      }
    }
    if (candidates.length === 0 || unclaimed.length === 0) {
      return;
    }
    // stack families first; ties resolve to the name shown in the stack
    const stack = (() => {
      let element = window.aElement;
      if (!element || element === document.body) {
        try {
          const range = window.getSelection().getRangeAt(0);
          element = range.commonAncestorContainer;
          if (element.nodeType !== Element.ELEMENT_NODE) {
            element = element.parentElement;
          }
        }
        catch (e) {}
      }
      const families = [];
      for (let e = element; e && e !== document; e = e.parentNode) {
        families.push(...window.getComputedStyle(e)['font-family'].replace(/[;'"]/g, '').split(/\s*,\s*/));
      }
      return families;
    })();
    const pos = family => {
      const i = stack.indexOf(family);
      return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    };
    candidates.sort((a, b) => pos(a) - pos(b));

    const chars = ['A', 'g', 'M', 'W', '1', '?', '!', '日', '本', '語', '한', 'α', 'Ω', 'ا', 'а', '中'];
    const canvas = Object.assign(document.createElement('canvas'), {
      width: 60,
      height: 44,
      style: 'position: absolute; visibility: hidden; top: 0;'
    });
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const draw = (c, fonts) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = '32px ' + fonts;
      ctx.fillText(c, 5, 34);
      return canvas.toDataURL();
    };
    // what a missing glyph looks like; those chars carry no signal
    const fallbacks = {};
    for (const c of chars) {
      fallbacks[c] = draw(c, '__ff_none__');
    }
    const familyBitmaps = {};
    for (const family of candidates) {
      for (const c of chars) {
        familyBitmaps[family + '\u0000' + c] = draw(c, `"${family}"`);
      }
    }
    for (const fontUrl of unclaimed) {
      const probe = new FontFace('ff_probe', `url(${fontUrl})`);
      try {
        document.fonts.add(probe);
        await probe.load();
        const scores = new Map();
        for (const c of chars) {
          const bitmap = draw(c, '"ff_probe"');
          if (bitmap === fallbacks[c]) {
            continue;   // the file does not cover this char
          }
          for (const family of candidates) {
            if (familyBitmaps[family + '\u0000' + c] === bitmap) {
              scores.set(family, (scores.get(family) || 0) + 1);
            }
          }
        }
        let best = null;
        let bestScore = 1;
        for (const [family, score] of scores) {
          if (score > bestScore) {
            bestScore = score;
            best = family;
          }
        }
        if (best !== null) {
          const matched = [...document.fonts].find(f => f.family === best);
          // no unicode-range here: per-file coverage comes from the file's own
          // cmap when the inspector resolves it
          bio.set(fontUrl, {
            fontFamily: best,
            weight: matched ? matched.weight : '400',
            style: matched ? matched.style : 'normal',
            stretch: matched ? matched.stretch : 'normal',
            display: matched ? matched.display : 'auto'
          });
        }
      }
      catch (e) {}
      document.fonts.delete(probe);
    }
    canvas.remove();
  };

  chrome.storage.local.get({
    userFonts: [],
    baseFonts: [
      'Helvetica', 'Times New Roman', 'Times', 'Microsoft YaHei', 'Microsoft YaHei UI', 'monospace', 'Sans Serif',
      'Serif', 'Helvetica Neue', 'Helvetica CY', 'Songti SC', 'Zapfino', 'Zapf Dingbats', 'Zapf Chancery', 'Verdana',
      'Trebuchet MS', 'Times CY', 'Thonburi', 'Textile', 'Techno', 'Taipei', 'Tahoma', 'Tae Graphic', 'Symbol',
      'ST Song', 'ST Kaiti', 'ST Heiti', 'ST FangSong', 'Song', 'Skia', 'Silom', 'Shin Myungjo Neue', 'Seoul', 'Sathu',
      'Sand', 'Raanana', 'Plantagenet Cherokee', 'Pilgiche', 'PC Myungjo', 'Papyrus', 'Palatino', 'Osaka', 'Optima',
      'NISC GB18030', 'New York', 'New Peninim', 'Nadeem', 'Mshtakan', 'Monaco CY', 'Monaco', 'Menlo', 'Marker Felt',
      'Lucida Grande', 'LiSong Pro', 'LiHei Pro', 'LastResort', 'KufiStandard GK', 'Krungthep', 'Keyboard', 'Kai',
      'Jung Gothic', 'Inai Mathi', 'Impact', 'Hoefler Text', 'Hiragino Mincho ProN', 'Hiragino Mincho Pro',
      'Hiragino Maru Gothic ProN', 'Hiragino Maru Gothic Pro', 'Hiragino Kaku Gothic StdN', 'Hiragino Kaku Gothic Std',
      'Hiragino Kaku Gothic ProN', 'Hiragino Kaku Gothic Pro', 'Herculanum', 'Hei', 'HeadlineA', 'Hangangche', 'Gurmukhi',
      'Gung Seoche', 'Gujarati', 'Gill Sans', 'Georgia', 'Geneva CY', 'Geneva', 'Geezah', 'Geeza Pro', 'Gadget', 'Futura',
      'Euphemia UCAS', 'Didot', 'Devanagari', 'DecoType Naskh', 'Courier New', 'Courier', 'Corsiva Hebrew', 'Copperplate',
      'Cooper', 'Comic Sans', 'Cochin', 'Chicago', 'Charcoal CY', 'Charcoal', 'Chalkduster', 'Chalkboard', 'Brush Script',
      'Big Caslon', 'BiauKai', 'Beijing', 'Baskerville', 'Baghdad', 'Ayuthaya', 'Arial Hebrew', 'Arial', 'Apple Symbols',
      'Apple Myungjo', 'Apple LiSung', 'Apple LiGothic', 'Apple Gothic', 'Apple Garamond', 'Apple Chancery', 'Apple Casual',
      'Andalé Mono', 'American Typewriter', 'Al Bayan', '.AquaKana', 'Abadi MT Condensed Light', 'Aharoni', 'Aldhabi',
      'Andalus', 'Angsana New', 'AngsanaUPC', 'Aparajita', 'Arabic Typesetting', 'Arial Black', 'Arial Nova',
      'Bahnschrift', 'Batang', 'BatangChe', 'Book Antiqua', 'Browallia New', 'BrowalliaUPC', 'Calibri', 'Calibri Light',
      'Calisto MT', 'Cambria', 'Cambria Math', 'Candara', 'Century Gothic', 'Comic Sans MS', 'Consolas', 'Constantia',
      'Copperplate Gothic Bold', 'Copperplate Gothic Light', 'Corbel', 'Cordia New', 'CordiaUPC', 'DaunPenh', 'David',
      'Dengxian', 'DFKai-SB', 'DilleniaUPC', 'DokChampa', 'Dotum', 'DotumChe', 'Ebrima', 'Estrangelo Edessa',
      'EucrosiaUPC', 'Euphemia', 'FangSong', 'Franklin Gothic Medium', 'FrankRuehl', 'FreesiaUPC', 'Gabriola', 'Gadugi',
      'Gautami', 'Georgia Pro', 'Gill Sans Nova', 'Gisha', 'Gulim', 'GulimChe', 'Gungsuh', 'GungsuhChe', 'IrisUPC',
      'Iskoola Pota', 'JasmineUPC', 'Javanese Text', 'KaiTi', 'Kalinga', 'Kartika', 'Khmer UI', 'KodchiangUPC', 'Kokila',
      'Lao UI', 'Latha', 'Leelawadee', 'Leelawadee UI', 'Levenim MT', 'LilyUPC', 'Lucida Console', 'Lucida Handwriting',
      'Lucida Sans Unicode', 'Malgun Gothic', 'Mangal', 'Marlett', 'Meiryo', 'Meiryo UI', 'Microsoft Himalaya',
      'Microsoft JhengHei', 'Microsoft JhengHei UI', 'Microsoft New Tai Lue', 'Microsoft PhagsPa', 'Microsoft Sans Serif',
      'Microsoft Tai Le', 'Microsoft Uighur', 'Microsoft Yi Baiti', 'MingLiU, PMingLiU', 'MingLiU-ExtB, PMingLiU-ExtB',
      'MingLiU_HKSCS', 'MingLiU_HKSCS-ExtB', 'Miriam, Miriam Fixed', 'Mongolian Baiti', 'MoolBoran',
      'MS Gothic, MS PGothic', 'MS Mincho, MS PMincho', 'MS UI Gothic', 'MV Boli', 'Myanmar Text', 'Narkisim',
      'Neue Haas Grotesk Text Pro', 'News Gothic MT', 'Nirmala UI', 'NSimSun', 'Nyala', 'Palatino Linotype', 'Raavi',
      'Rockwell Nova', 'Rod', 'Sakkal Majalla', 'Sanskrit Text', 'Segoe MDL2 Assets', 'Segoe Print', 'Segoe Script',
      'Segoe UI', 'Segoe UI Emoji', 'Segoe UI Historic', 'Segoe UI Symbol', 'Shonar Bangla', 'Shruti', 'SimHei', 'SimKai',
      'Simplified Arabic', 'SimSun', 'SimSun-ExtB', 'Sitka Banner', 'Sitka Display', 'Sitka Heading', 'Sitka Small',
      'Sitka Subheading', 'Sitka Text', 'Sylfaen', 'Traditional Arabic', 'Tunga', 'UD Digi KyoKasho N-R',
      'UD Digi KyoKasho NK-R', 'UD Digi KyoKasho NP-R', 'Urdu Typesetting', 'Utsaah', 'Vani', 'Verdana Pro', 'Vijaya',
      'Vrinda', 'Webdings', 'Westminster', 'Wingdings', 'Yu Gothic', 'Yu Gothic UI', 'Yu Mincho', 'Andale Mono',
      'BlinkMacSystemFont', 'cursive', 'fantasy', 'DejaVu Serif', 'DejaVu Sans Mono', 'DejaVu Sans', 'Ubuntu Mono',
      'WenQuanYi Micro Hei', 'Gentium Book Basic', 'Gentium Basic', 'Ubuntu', 'Ubuntu Condensed', 'OpenSymbol',
      'WenQuanYi Micro Hei Mono'
    ]
  }, prefs => {
    // split the text into Unicode block segments then evaluate the font-family for each
    // Unicode block coverage the text is bucketed into by split(); sorted by
    // start so lookup can binary-search. Code points outside the table (and
    // surrogate code units, which are kept whole by the code-point iteration)
    // go into the remainder bucket added at the end of the segments.
    const ranges = [
      [0x0020, 0x007F], [0x00A0, 0x00FF], [0x0100, 0x017F], [0x0180, 0x024F],
      [0x0250, 0x02AF], [0x02B0, 0x02FF], [0x0300, 0x036F], [0x0370, 0x03FF],
      [0x0400, 0x04FF], [0x0500, 0x052F], [0x0530, 0x058F], [0x0590, 0x05FF],
      [0x0600, 0x06FF], [0x0700, 0x074F], [0x0780, 0x07BF], [0x0900, 0x097F],
      [0x0980, 0x09FF], [0x0A00, 0x0A7F], [0x0A80, 0x0AFF], [0x0B00, 0x0B7F],
      [0x0B80, 0x0BFF], [0x0C00, 0x0C7F], [0x0C80, 0x0CFF], [0x0D00, 0x0D7F],
      [0x0D80, 0x0DFF], [0x0E00, 0x0E7F], [0x0E80, 0x0EFF], [0x0F00, 0x0FFF],
      [0x1000, 0x109F], [0x10A0, 0x10FF], [0x1100, 0x11FF], [0x1200, 0x137F],
      [0x13A0, 0x13FF], [0x1400, 0x167F], [0x1680, 0x169F], [0x16A0, 0x16FF],
      [0x1700, 0x171F], [0x1720, 0x173F], [0x1740, 0x175F], [0x1760, 0x177F],
      [0x1780, 0x17FF], [0x1800, 0x18AF], [0x1900, 0x194F], [0x1950, 0x197F],
      [0x19E0, 0x19FF], [0x1D00, 0x1D7F], [0x1E00, 0x1EFF], [0x1F00, 0x1FFF],
      [0x2000, 0x206F], [0x2070, 0x209F], [0x20A0, 0x20CF], [0x20D0, 0x20FF],
      [0x2100, 0x214F], [0x2150, 0x218F], [0x2190, 0x21FF], [0x2200, 0x22FF],
      [0x2300, 0x23FF], [0x2400, 0x243F], [0x2440, 0x245F], [0x2460, 0x24FF],
      [0x2500, 0x257F], [0x2580, 0x259F], [0x25A0, 0x25FF], [0x2600, 0x26FF],
      [0x2700, 0x27BF], [0x27C0, 0x27EF], [0x27F0, 0x27FF], [0x2800, 0x28FF],
      [0x2900, 0x297F], [0x2980, 0x29FF], [0x2A00, 0x2AFF], [0x2B00, 0x2BFF],
      [0x2E80, 0x2EFF], [0x2F00, 0x2FDF], [0x2FF0, 0x2FFF], [0x3000, 0x303F],
      [0x3040, 0x309F], [0x30A0, 0x30FF], [0x3100, 0x312F], [0x3130, 0x318F],
      [0x3190, 0x319F], [0x31A0, 0x31BF], [0x31F0, 0x31FF], [0x3200, 0x32FF],
      [0x3300, 0x33FF], [0x3400, 0x4DBF], [0x4DC0, 0x4DFF], [0x4E00, 0x9FFF],
      [0xA000, 0xA48F], [0xA490, 0xA4CF], [0xAC00, 0xD7AF], [0xE000, 0xF8FF],
      [0xF900, 0xFAFF], [0xFB00, 0xFB4F], [0xFB50, 0xFDFF], [0xFE00, 0xFE0F],
      [0xFE20, 0xFE2F], [0xFE30, 0xFE4F], [0xFE50, 0xFE6F], [0xFE70, 0xFEFF],
      [0xFF00, 0xFFEF], [0xFFF0, 0xFFFF], [0x10000, 0x1007F], [0x10080, 0x100FF],
      [0x10100, 0x1013F], [0x10300, 0x1032F], [0x10330, 0x1034F], [0x10380, 0x1039F],
      [0x10400, 0x1044F], [0x10450, 0x1047F], [0x10480, 0x104AF], [0x10800, 0x1083F],
      [0x1D000, 0x1D0FF], [0x1D100, 0x1D1FF], [0x1D300, 0x1D35F], [0x1D400, 0x1D7FF],
      // symbol and emoji plane: previously missing, e.g. U+1F300+
      [0x1F000, 0x1F0FF], [0x1F100, 0x1F1FF], [0x1F200, 0x1F2FF], [0x1F300, 0x1F5FF],
      [0x1F600, 0x1F64F], [0x1F650, 0x1F67F], [0x1F680, 0x1F6FF], [0x1F700, 0x1F77F],
      [0x1F780, 0x1F7FF], [0x1F800, 0x1F8FF], [0x1F900, 0x1F9FF], [0x1FA00, 0x1FA6F],
      [0x1FA70, 0x1FAFF], [0x20000, 0x2A6DF], [0x2F800, 0x2FA1F], [0xE0000, 0xE007F]
    ];
    // a font that supports all ranges
    let notdef;
    // to get no effect from other styles and to generate a unique key
    const canvas = Object.assign(document.createElement('canvas'), {
      width: 500,
      height: 128,
      style: 'position: absolute; visibility: hidden; top: 0;'
    });
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    // get the active element
    let aElement = window.aElement;
    if (!aElement || aElement === document.body) {
      const s = window.getSelection();
      const r = s.getRangeAt(0);
      aElement = r.commonAncestorContainer;
      if (aElement.nodeType !== Element.ELEMENT_NODE) {
        aElement = aElement.parentElement;
      }
    }
    else {
      // remove old inspect
      delete window.aElement;
    }
    console.info('Selected Node', aElement);

    // canvas font shorthand prefix; honors the actual font-style, font-weight and font-stretch of the element
    let fontPrefix = '';

    // set ctx.font out of the font-family; honors the element's fontPrefix and
    // retries without it when the shorthand gets rejected
    const applyFont = (fonts, size) => {
      const font = (fontPrefix ? fontPrefix + ' ' : '') + size + ' ' + fonts;
      ctx.font = '10px sans-serif';
      ctx.font = font;

      if (ctx.font === '10px sans-serif' && font !== '10px sans-serif') {
        ctx.font = size + ' ' + fonts;
      }
    };

    // generate a unique key for each font-family
    const key = (str, size, fonts, lang) => {
      canvas.lang = lang;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      applyFont(fonts, size);
      ctx.fillText(str, 0, 128);
      return canvas.toDataURL();
    };

    if (aElement) {
      const style = window.getComputedStyle(aElement);

      // build the canvas font shorthand prefix out of the element's computed font-style, font-weight and font-stretch
      fontPrefix = (() => {
        const parts = [];
        // font-style; drop the angle from 'oblique 10deg' to keep the shorthand parseable
        const fontStyle = style['font-style'].replace(/\s+-?[\d.]+deg$/, '');
        if (fontStyle !== 'normal') {
          parts.push(fontStyle);
        }
        // font-weight; the computed value is numeric (possibly fractional for variable fonts)
        const fontWeight = style['font-weight'];
        if (fontWeight !== 'normal' && fontWeight !== '400') {
          parts.push(fontWeight);
        }
        // font-stretch; snap a computed percentage to the closest CSS keyword
        let stretch = style['font-stretch'];
        if (stretch.endsWith('%')) {
          const value = parseFloat(stretch);
          const keywords = [
            [50, 'ultra-condensed'], [62.5, 'extra-condensed'], [75, 'condensed'], [87.5, 'semi-condensed'],
            [112.5, 'semi-expanded'], [125, 'expanded'], [150, 'extra-expanded'], [200, 'ultra-expanded']
          ];
          stretch = value === 100 ? 'normal' : keywords.reduce((p, c) =>
            Math.abs(c[0] - value) < Math.abs(p[0] - value) ? c : p
          )[1];
        }
        if (stretch !== 'normal' && stretch !== '100%') {
          parts.push(stretch);
        }
        return parts.join(' ');
      })();

      // get the list of all font-families (up to window object)
      const fontStack = (() => {
        const aFonts = [];
        for (let e = aElement; e && e !== document; e = e.parentNode) {
          aFonts.push(window.getComputedStyle(e)['font-family']);
        }
        return [].concat([], ...aFonts.map(fs => fs.replace(/[;'"]/g, '').split(/\s*,\s*/)));
      })();
      // report
      const report = obj => chrome.runtime.sendMessage({
        cmd: 'analyzed',
        url: document.location.href,
        getComputedStyle: {
          'color': style.color,
          'background-color': style['background-color'],
          'font-family': style['font-family'],
          'font-family-rendered': obj,
          'font-size': style['font-size'],
          'font-weight': style['font-weight'],
          'font-style': style['font-style'],
          'font-variant': style['font-variant'],
          'font-kerning': style['font-kerning'],
          'font-optical-sizing': style['font-optical-sizing'],
          'font-stretch': style['font-stretch'],
          'font-variation-settings': style['font-variation-settings'],
          'font-feature-settings': style['font-feature-settings'],
          'line-height': style['line-height'],
          'vertical-align': style['vertical-align'],
          'letter-spacing': style['letter-spacing'],
          'word-spacing': style['word-spacing'],
          'text-transform': style['text-transform'],
          'text-decoration': style['text-decoration'],
          'text-align': style['text-align'],
          'text-indent': style['text-indent'],
          'element-type': aElement.localName,
          'element-id': aElement.id || 'Not Applicable',
          'element-class': [...aElement.classList].join(', '),
          'margin': style['margin'],
          'padding': style['padding']
        },
        complex: aElement.children.length !== 0,
        bio: Array.from(bio.entries()).map(([fontUrl, o]) => ({
          fontUrl,
          ...o
        }))
      }, () => chrome.runtime.lastError);

      // detect the font-family
      const detect = (str, size, lang = '') => {
        canvas.lang = lang;
        const fallback = key(str, size, 'notdef', lang);

        const list = [...fontStack, ...prefs.userFonts, ...prefs.baseFonts]
          .filter((s, i, l) => s && l.indexOf(s) === i);
        const ref = key(str, size, style['font-family'], lang);
        // what the canvas draws when no family exists; the pure system fallback
        // for this exact string, size, lang, weight and stretch
        const pure = key(str, size, '__ff_none__', lang);

        // ink-extent snapshots per font-family, cached for the scan; identical
        // pixels imply identical ink, so differing metrics rule a family out
        // before anything gets rasterized
        const snap = new Map();
        const ink = fonts => {
          if (snap.has(fonts) === false) {
            applyFont(fonts, size);
            const m = ctx.measureText(str);
            snap.set(fonts, [
              m.actualBoundingBoxLeft, m.actualBoundingBoxRight,
              m.actualBoundingBoxAscent, m.actualBoundingBoxDescent
            ]);
          }
          return snap.get(fonts);
        };
        const sameInk = (a, b) => a.every((v, i) => v === b[i]);
        const refInk = ink(style['font-family']);
        // cheap prefilter: the family cannot possibly render like the reference
        const maybe = fonts => sameInk(ink(fonts), refInk);
        // is a known font: renders differently from the notdef-only fallback
        const known = fonts => sameInk(ink(`"${fonts}",notdef`), ink('notdef')) === false ||
          key(str, size, `"${fonts}",notdef`, lang) !== fallback;

        // the first matching family is the reported one; every other family that
        // renders identically is one the browser may be pretending with
        const matches = [];
        for (const font of list) {
          const draw = key(str, size, font, lang);
          // own glyphs: a draw identical to the fallback-of-nothing means the
          // family rendered nothing itself; the bitmap came from the shared
          // fallback, so it is neither a match nor a pretender
          if (maybe(font) &&
            draw === ref &&
            draw !== pure &&
            known(font)) {
            matches.push(font);
          }
        }
        return matches.length ? matches : ['System Default'];
      };
      // split into segments
      const split = async () => {
        const textContent = node => {
          let content = '';
          const nodes = [];
          if (node.nodeType === Node.TEXT_NODE) {
            nodes.unshift(node);
            content += node.nodeValue;
          }
          else {
            const iterator = document.createNodeIterator(node, NodeFilter.SHOW_TEXT);
            let c;
            while (c = iterator.nextNode()) {
              content += c.nodeValue;
            }
          }
          return content;
        };

        let text = (
          window.getSelection().toString() || textContent(aElement) || aElement.value || 'q!@#$%^&*()/;'
        ).replace(/[\s\t\n\r]/g, '');

        // split text into code-point segments by Unicode block; the table is
        // sorted so lookups can binary-search, and code points outside the
        // table land in a trailing remainder segment, keeping every character
        // (astral emoji included) analyzed and the percents summing to 100
        const segments = [];
        const parts = new Array(ranges.length).fill('');
        let other = '';
        const block = cp => {
          let lo = 0, hi = ranges.length - 1;
          while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            if (cp < ranges[mid][0]) {
              hi = mid - 1;
            }
            else if (cp > ranges[mid][1]) {
              lo = mid + 1;
            }
            else {
              return mid;
            }
          }
          return -1;
        };
        // iterating the string yields code points, so surrogate pairs (emoji
        // and friends) survive as whole characters, not junk halves
        for (const c of text) {
          const i = block(c.codePointAt(0));
          if (i === -1) {
            other += c;
          }
          else {
            parts[i] += c;
          }
        }
        for (const str of parts) {
          if (str) {
            segments.push(str);
          }
        }
        if (other) {
          segments.push(other);
        }
        // detect
        const obj = {};
        // code-point counts; surrogate pairs must not be double-counted
        const tot = segments.reduce((p, c) => p + [...c].length, 0);
        for (const str of segments) {
          const e = aElement.closest('[lang]'); // do we have a lang attribute
          const [font, ...pretends] = detect(str, style['font-size'], e ? e.lang : '');
          obj[font] = obj[font] || {
            percent: 0,
            remote: false,
            info: ''
          };
          obj[font].percent += [...str].length / tot * 100;
          obj[font].pretends = pretends;
        }
        // clean up
        document.fonts.delete(notdef);
        // remote fonts
        for (const name of Object.keys(obj)) {
          const f = (fontPrefix ? fontPrefix + ' ' : '') + style['font-size'] + ' "' + name + '"';
          // possible remote font
          try {
            const fontFace = (await document.fonts.load(f))[0];
            if (fontFace) {
              obj[name].remote = true;
              obj[name].info = `FontFace Details:

  display: ${fontFace['display']}
  family: ${fontFace['family']}
  stretch: ${fontFace['stretch']}
  style: ${fontFace['style']}
  unicodeRange: ${fontFace['unicodeRange']}
  sizeAdjust: ${fontFace['sizeAdjust']}
  variant: ${fontFace['variant']}
  weight: ${fontFace['weight']}`;
            }
          }
          catch (e) {
            console.error('Failed to get font details', f, e);
            // If the font fails to load, it's not local
            obj[name].remote = true;
            obj[name].info = 'FontFace details not available: ' + e.message;
          }
        }
        canvas.remove();

        report(obj);
        // the slow phases run in the background and push their gains
        runAsync();
      };

      // loading our own font-family
      notdef = new FontFace(
        'notdef',
        `url(${chrome.runtime.getURL('/data/inject/AND-Regular.otf')})`
      );
      document.fonts.add(notdef);
      notdef.load().then(split);
    }
  });
}
