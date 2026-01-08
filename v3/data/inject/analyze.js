'use strict';

{
  const bio = new Map();

  for (const stylesheet of document.styleSheets) {
    try {
      for (const rule of stylesheet.cssRules) {
        // Check if it's an @font-face rule
        if (rule instanceof CSSFontFaceRule) {
          // Extract the font URL and font name from the cssText
          const cssText = rule.cssText;
          const fontUrlMatches = cssText.match(/url\((.*?)\)/i);
          const fontFamilyMatches = cssText.match(/font-family:\s*(.*?);/i);

          if (fontUrlMatches && fontUrlMatches.length > 1 && fontFamilyMatches && fontFamilyMatches.length > 1) {
            let fontUrl = fontUrlMatches[1].replace(/['"]/g, '');

            if (fontUrl) {
              // full absolute URL
              try {
                fontUrl = new URL(fontUrl, location.href).href;
              }
              catch (e) {}

              if (bio.has(fontUrl) === false) {
                const fontFamily = fontFamilyMatches[1].replace(/['"]/g, '');
                bio.set(fontUrl, {
                  fontFamily
                });
              }
            }
          }
        }
      }
    }
    catch (e) {
      console.error(e, stylesheet, stylesheet.href);
    }
  }
  for (const e of performance.getEntriesByType('resource')) {
    if (e.initiatorType === 'font' || /\.(woff2?|eot|ttf|ttc|otf|pfb|pfm)(\?|$)/i.test(e.name)) {
      if (bio.has(e.name) === false) {
        bio.set(e.name, {
          initiator: e.initiatorType
        });
      }
    }
  }

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

    // generate a unique key for each font-family
    const key = (str, size, fonts, lang) => {
      canvas.lang = lang;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = size + ' ' + fonts;
      ctx.fillText(str, 0, 128);
      return canvas.toDataURL();
    };

    if (aElement) {
      const style = window.getComputedStyle(aElement);

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
          const f = style['font-size'] + ' "' + name + '"';
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
