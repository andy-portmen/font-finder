'use strict';

{
  const bio = new Map();
  // a src may list several sources; url() ones are downloadable, local() ones are not
  const urlPattern = /url\(\s*(['"]?)(.*?)\1\s*\)/gi;

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
        // every fetch; only attach metadata to URLs the page actually loaded
        if (fontUrl && (knownOnly === false || bio.has(fontUrl))) {
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
  for (const stylesheet of document.styleSheets) {
    try {
      walk(stylesheet.cssRules, stylesheet.href || location.href, false);
    }
    catch (e) {
      if (stylesheet.href) {
        unreadable.push(stylesheet.href);
      }
      else {
        console.error(e, stylesheet);
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
  for (const e of performance.getEntriesByType('resource')) {
    if (e.initiatorType === 'font' || /\.(woff2?|eot|ttf|ttc|otf|pfb|pfm)(\?|$)/i.test(e.name)) {
      if (bio.has(e.name) === false) {
        bio.set(e.name, {
          initiator: e.initiatorType
        });
      }
    }
  }

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
    ],
    // Fonts commonly faked by Windows browsers (e.g. Helvetica -> Helvetica, Times -> Times New Roman)
    pretendedFonts: [
      'Arial', 'Times New Roman', 'Courier New', 'Tahoma', 'Lucida Sans Unicode', 'Segoe UI'
    ]
  }, prefs => {
    // split the original string into Unicode segments then evaluate the font-family for each segment
    const ranges = [['0020', '007F'], ['2580', '259F'], ['00A0', '00FF'], ['25A0', '25FF'], ['0100', '017F'], ['2600', '26FF'], ['0180', '024F'], ['2700', '27BF'], ['0250', '02AF'], ['27C0', '27EF'], ['02B0', '02FF'], ['27F0', '27FF'], ['0300', '036F'], ['2800', '28FF'], ['0370', '03FF'], ['2900', '297F'], ['0400', '04FF'], ['2980', '29FF'], ['0500', '052F'], ['2A00', '2AFF'], ['0530', '058F'], ['2B00', '2BFF'], ['0590', '05FF'], ['2E80', '2EFF'], ['0600', '06FF'], ['2F00', '2FDF'], ['0700', '074F'], ['2FF0', '2FFF'], ['0780', '07BF'], ['3000', '303F'], ['0900', '097F'], ['3040', '309F'], ['0980', '09FF'], ['30A0', '30FF'], ['0A00', '0A7F'], ['3100', '312F'], ['0A80', '0AFF'], ['3130', '318F'], ['0B00', '0B7F'], ['3190', '319F'], ['0B80', '0BFF'], ['31A0', '31BF'], ['0C00', '0C7F'], ['31F0', '31FF'], ['0C80', '0CFF'], ['3200', '32FF'], ['0D00', '0D7F'], ['3300', '33FF'], ['0D80', '0DFF'], ['3400', '4DBF'], ['0E00', '0E7F'], ['4DC0', '4DFF'], ['0E80', '0EFF'], ['4E00', '9FFF'], ['0F00', '0FFF'], ['A000', 'A48F'], ['1000', '109F'], ['A490', 'A4CF'], ['10A0', '10FF'], ['AC00', 'D7AF'], ['1100', '11FF'], ['D800', 'DB7F'], ['1200', '137F'], ['DB80', 'DBFF'], ['13A0', '13FF'], ['DC00', 'DFFF'], ['1400', '167F'], ['E000', 'F8FF'], ['1680', '169F'], ['F900', 'FAFF'], ['16A0', '16FF'], ['FB00', 'FB4F'], ['1700', '171F'], ['FB50', 'FDFF'], ['1720', '173F'], ['FE00', 'FE0F'], ['1740', '175F'], ['FE20', 'FE2F'], ['1760', '177F'], ['FE30', 'FE4F'], ['1780', '17FF'], ['FE50', 'FE6F'], ['1800', '18AF'], ['FE70', 'FEFF'], ['1900', '194F'], ['FF00', 'FFEF'], ['1950', '197F'], ['FFF0', 'FFFF'], ['19E0', '19FF'], ['10000', '1007F'], ['1D00', '1D7F'], ['10080', '100FF'], ['1E00', '1EFF'], ['10100', '1013F'], ['1F00', '1FFF'], ['10300', '1032F'], ['2000', '206F'], ['10330', '1034F'], ['2070', '209F'], ['10380', '1039F'], ['20A0', '20CF'], ['10400', '1044F'], ['20D0', '20FF'], ['10450', '1047F'], ['2100', '214F'], ['10480', '104AF'], ['2150', '218F'], ['10800', '1083F'], ['2190', '21FF'], ['1D000', '1D0FF'], ['2200', '22FF'], ['1D100', '1D1FF'], ['2300', '23FF'], ['1D300', '1D35F'], ['2400', '243F'], ['1D400', '1D7FF'], ['2440', '245F'], ['20000', '2A6DF'], ['2460', '24FF'], ['2F800', '2FA1F'], ['2500', '257F'], ['E0000', 'E007F']];
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

    // generate a unique key for each font-family
    const key = (str, size, fonts, lang) => {
      canvas.lang = lang;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const font = (fontPrefix ? fontPrefix + ' ' : '') + size + ' ' + fonts;
      ctx.font = '10px sans-serif';
      ctx.font = font;

      if (ctx.font === '10px sans-serif' && font !== '10px sans-serif') {
        // the shorthand got rejected, retry without the prefix
        ctx.font = size + ' ' + fonts;
      }
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
        const fallback = key(str, size, 'notdef', lang);

        const list = [...fontStack, ...prefs.userFonts, ...prefs.baseFonts]
          .filter((s, i, l) => s && l.indexOf(s) === i);
        const ref = key(str, size, style['font-family'], lang);

        for (const font of list) {
          if (key(str, size, font, lang) === ref && // font is equal to the referenced font
            key(str, size, `"${font}",notdef`, lang) !== fallback /* is a known font */) {
            const fonts = [font];

            // What if the font is a pretended font
            for (const p of prefs.pretendedFonts) {
              if (p !== font && key(str, size, p, lang) === ref) {
                fonts.push(p);
              }
            }

            return fonts;
          }
        }
        return ['System Default'];
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

        // split text into segments
        const segments = [];
        for (const [begin, end] of ranges) {
          const s = new RegExp(`[^\\u${begin}-\\u${end}]`, 'g');
          const val = text.replace(s, '');
          if (val) {
            segments.push(val);
            text = text.replace(new RegExp(`[\\u${begin}-\\u${end}]`, 'g'), '');
            if (text === '') {
              break;
            }
          }
        }
        // detect
        const obj = {};
        const tot = segments.reduce((p, c) => p + c.length, 0);
        for (const str of segments) {
          const e = aElement.closest('[lang]'); // do we have a lang attribute
          const [font, ...pretends] = detect(str, style['font-size'], e ? e.lang : '');
          obj[font] = obj[font] || {
            percent: 0,
            remote: false,
            info: ''
          };
          obj[font].percent += str.length / tot * 100;
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
        ranges.length = 0;

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
