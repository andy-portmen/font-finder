'use strict';

var baseFonts = ['Helvetica', 'Times New Roman', 'Times', 'Microsoft YaHei', 'Microsoft YaHei UI', 'monospace', 'Sans Serif', 'Serif', 'Helvetica Neue', 'Helvetica CY', 'Songti SC', 'Zapfino', 'Zapf Dingbats', 'Zapf Chancery', 'Verdana', 'Trebuchet MS', 'Times CY', 'Thonburi', 'Textile', 'Techno', 'Taipei', 'Tahoma', 'Tae Graphic', 'Symbol', 'ST Song', 'ST Kaiti', 'ST Heiti', 'ST FangSong', 'Song', 'Skia', 'Silom', 'Shin Myungjo Neue', 'Seoul', 'Sathu', 'Sand', 'Raanana', 'Plantagenet Cherokee', 'Pilgiche', 'PC Myungjo', 'Papyrus', 'Palatino', 'Osaka', 'Optima', 'NISC GB18030', 'New York', 'New Peninim', 'Nadeem', 'Mshtakan', 'Monaco CY', 'Monaco', 'Menlo', 'Marker Felt', 'Lucida Grande', 'LiSong Pro', 'LiHei Pro', 'LastResort', 'KufiStandard GK', 'Krungthep', 'Keyboard', 'Kai', 'Jung Gothic', 'Inai Mathi', 'Impact', 'Hoefler Text', 'Hiragino Mincho ProN', 'Hiragino Mincho Pro', 'Hiragino Maru Gothic ProN', 'Hiragino Maru Gothic Pro', 'Hiragino Kaku Gothic StdN', 'Hiragino Kaku Gothic Std', 'Hiragino Kaku Gothic ProN', 'Hiragino Kaku Gothic Pro', 'Herculanum', 'Hei', 'HeadlineA', 'Hangangche', 'Gurmukhi', 'Gung Seoche', 'Gujarati', 'Gill Sans', 'Georgia', 'Geneva CY', 'Geneva', 'Geezah', 'Geeza Pro', 'Gadget', 'Futura', 'Euphemia UCAS', 'Didot', 'Devanagari', 'DecoType Naskh', 'Courier New', 'Courier', 'Corsiva Hebrew', 'Copperplate', 'Cooper', 'Comic Sans', 'Cochin', 'Chicago', 'Charcoal CY', 'Charcoal', 'Chalkduster', 'Chalkboard', 'Brush Script', 'Big Caslon', 'BiauKai', 'Beijing', 'Baskerville', 'Baghdad', 'Ayuthaya', 'Arial Hebrew', 'Arial', 'Apple Symbols', 'Apple Myungjo', 'Apple LiSung', 'Apple LiGothic', 'Apple Gothic', 'Apple Garamond', 'Apple Chancery', 'Apple Casual', 'Andalé Mono', 'American Typewriter', 'Al Bayan', '.AquaKana', 'Abadi MT Condensed Light', 'Aharoni', 'Aldhabi', 'Andalus', 'Angsana New', 'AngsanaUPC', 'Aparajita', 'Arabic Typesetting', 'Arial Black', 'Arial Nova', 'Bahnschrift', 'Batang', 'BatangChe', 'Book Antiqua', 'Browallia New', 'BrowalliaUPC', 'Calibri', 'Calibri Light', 'Calisto MT', 'Cambria', 'Cambria Math', 'Candara', 'Century Gothic', 'Comic Sans MS', 'Consolas', 'Constantia', 'Copperplate Gothic Bold', 'Copperplate Gothic Light', 'Corbel', 'Cordia New', 'CordiaUPC', 'DaunPenh', 'David', 'Dengxian', 'DFKai-SB', 'DilleniaUPC', 'DokChampa', 'Dotum', 'DotumChe', 'Ebrima', 'Estrangelo Edessa', 'EucrosiaUPC', 'Euphemia', 'FangSong', 'Franklin Gothic Medium', 'FrankRuehl', 'FreesiaUPC', 'Gabriola', 'Gadugi', 'Gautami', 'Georgia Pro', 'Gill Sans Nova', 'Gisha', 'Gulim', 'GulimChe', 'Gungsuh', 'GungsuhChe', 'IrisUPC', 'Iskoola Pota', 'JasmineUPC', 'Javanese Text', 'KaiTi', 'Kalinga', 'Kartika', 'Khmer UI', 'KodchiangUPC', 'Kokila', 'Lao UI', 'Latha', 'Leelawadee', 'Leelawadee UI', 'Levenim MT', 'LilyUPC', 'Lucida Console', 'Lucida Handwriting', 'Lucida Sans Unicode', 'Malgun Gothic', 'Mangal', 'Marlett', 'Meiryo', 'Meiryo UI', 'Microsoft Himalaya', 'Microsoft JhengHei', 'Microsoft JhengHei UI', 'Microsoft New Tai Lue', 'Microsoft PhagsPa', 'Microsoft Sans Serif', 'Microsoft Tai Le', 'Microsoft Uighur', 'Microsoft Yi Baiti', 'MingLiU, PMingLiU', 'MingLiU-ExtB, PMingLiU-ExtB', 'MingLiU_HKSCS', 'MingLiU_HKSCS-ExtB', 'Miriam, Miriam Fixed', 'Mongolian Baiti', 'MoolBoran', 'MS Gothic, MS PGothic', 'MS Mincho, MS PMincho', 'MS UI Gothic', 'MV Boli', 'Myanmar Text', 'Narkisim', 'Neue Haas Grotesk Text Pro', 'News Gothic MT', 'Nirmala UI', 'NSimSun', 'Nyala', 'Palatino Linotype', 'Raavi', 'Rockwell Nova', 'Rod', 'Sakkal Majalla', 'Sanskrit Text', 'Segoe MDL2 Assets', 'Segoe Print', 'Segoe Script', 'Segoe UI', 'Segoe UI Emoji', 'Segoe UI Historic', 'Segoe UI Symbol', 'Shonar Bangla', 'Shruti', 'SimHei', 'SimKai', 'Simplified Arabic', 'SimSun', 'SimSun-ExtB', 'Sitka Banner', 'Sitka Display', 'Sitka Heading', 'Sitka Small', 'Sitka Subheading', 'Sitka Text', 'Sylfaen', 'Traditional Arabic', 'Tunga', 'UD Digi KyoKasho N-R', 'UD Digi KyoKasho NK-R', 'UD Digi KyoKasho NP-R', 'Urdu Typesetting', 'Utsaah', 'Vani', 'Verdana Pro', 'Vijaya', 'Vrinda', 'Webdings', 'Westminster', 'Wingdings', 'Yu Gothic', 'Yu Gothic UI', 'Yu Mincho', 'Andale Mono', 'BlinkMacSystemFont', 'cursive', 'fantasy'];
// Unicode range
// https://github.com/radiovisual/unicode-range-json/blob/master/unicode-ranges.json
// split the original string into Unicode segments then evaluate the font-family
var ranges = [{
  'category': 'CJK Unified Ideographs',
  'hexrange': ['4E00', '9FFF']
}, {
  'category': 'Arabic',
  'hexrange': ['0600', '06FF']
}, {
  'category': 'Basic Latin',
  'hexrange': ['0020', '007F']
}];
// add unifont font-face
var css = document.createElement('style');
css.textContent = `
@font-face {
  font-family: 'unifont';
  font-style: normal;
  font-weight: 400;
  src: url('${chrome.runtime.getURL('/data/inject/unifont.woff2')}') format('woff2');
}`;
document.body.appendChild(css);

// to get no effect from other styles and to generate a unique key
var canvas = document.createElement('canvas');
canvas.width = 500;
canvas.height = 128;
canvas.style = `
  position: absolute;
  top: 0;
  left: 0;
  visibility: hidden;
`;
document.body.appendChild(canvas);
var ctx = canvas.getContext('2d');

var wait = period => new Promise(resolve => window.setTimeout(resolve, period));
// get the active element
window.aElement = window.aElement || document.activeElement;
var text = (window.getSelection().toString() ||
  window.aElement.textContent).replace(/[\s\t]/g, '');
// generate a unique key for eeach font-family
var key = (str, fonts) => {
  // clear the canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // draw new text
  ctx.font = '128px ' + fonts;
  ctx.fillText(str, 0, 128);
  return canvas.toDataURL();
};

if (window.aElement) {
  const style = window.getComputedStyle(window.aElement);

  // get the list of all font-families (up to window object)
  const fonts = (() => {
    const aFonts = [style['font-family']];
    let p = window.aElement;
    while (p !== document) {
      aFonts.push(window.getComputedStyle(p)['font-family']);
      p = p.parentNode;
    }
    let fonts = [];

    aFonts.forEach(fs => {
      fs.replace(';', '').split(/\s*,\s*/).forEach(f => fonts.push(f));
    });

    return fonts;
  })();

  // detect the font-family
  const two = (unifont, str) => {
    const list = [...fonts, ...baseFonts]
      .filter((s, i, l) => l.indexOf(s) === i)
      .map(f => f.replace(/["']/g, ''));
    const ref = key(str, style['font-family']);

    for (const font of list) {
      const k = key(str, font);
      if (k === ref) {
        const ko = key(str, `"${font}",unifont`);
        if (ko !== unifont) {
          return font;
        }
      }
    }
    return '';
  };
  // wait for the unifont font to load
  const one = async str => {
    const monospace = key(str, 'monospace');
    let unifont;
    for (let i = 0; i < 10; i += 1) {
      unifont = key(str, `unifont,monospace`);
      if (unifont !== monospace) {
        return two(unifont, str);
      }
      console.log('attempt', i + 1);
      await wait(500);
    }
    throw Error('Cannot load the font');
  };
  // split text into segments
  const segments = ranges.map(({hexrange}) => {
    const s = new RegExp(`[^\\u${hexrange[0]}-\\u${hexrange[1]}]`, 'g');
    return text.replace(s, '');
  }).filter((s, i, l) => s && l.indexOf(s) === i);
  const tot = segments.reduce((p, c) => p + c.length, 0);

  (async() => {
    const arr = [];
    for (const str of segments) {
      const fonts = await one(str);
      arr.push([fonts, str.length / tot * 100]);
    }
    arr.sort((a, b) => b[1] - a[1]);

    // clean up
    canvas.remove();
    css.remove();
    baseFonts = null;
    ranges = null;
    // display the result
    chrome.runtime.sendMessage({
      cmd: 'analyzed',
      url: document.location.href,
      getComputedStyle: {
        'color': style.color,
        'background-color': style['background-color'],
        'font-family': style['font-family'],
        'font-family-rendered': arr,
        'font-size': style['font-size'],
        'line-height': style['line-height'],
        'vertical-align': style['vertical-align'],
        'letter-spacing': style['letter-spacing'],
        'word-spacing': style['word-spacing'],
        'font-weight': style['font-weight'],
        'font-style': style['font-style'],
        'font-variant': style['font-variant'],
        'text-transform': style['text-transform'],
        'text-decoration': style['text-decoration'],
        'text-align': style['text-align'],
        'text-indent': style['text-indent'],
        'element-type': window.aElement.localName,
        'element-id': window.aElement.id || 'Not Applicable',
        'element-class': Array.from(window.aElement.classList).join(', ')
      },
      complex: window.aElement.children.length !== 0
    });
  })();
}

