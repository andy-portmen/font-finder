'use strict';

var baseFonts = ['Andale Mono', 'Arial', 'Arial Black', 'Arnoldboecklin',
  'Bitstream Vera Sans Mono', 'BlinkMacSystemFont', 'Blippo', 'Book Antiqua',
  'Bookman', 'Brushstroke', 'Charcoal', 'Comic Sans', 'Comic Sans MS', 'Consolas',
  'Coronetscript', 'Courier', 'Courier New', 'DejaVu Sans Mono', 'Fixed',
  'Florence', 'Gadget', 'Geneva', 'Georgia', 'Gill Sans', 'Helvetica',
  'Helvetica Narrow', 'Helvetica Neue', 'Impact', 'Liberation Mono', 'Lucida',
  'Lucida Console', 'Lucida Grande', 'Lucida Sans Unicode', 'Lucidatypewriter',
  'Menlo', 'Monaco', 'New Century Schoolbook', 'Oldtown', 'Palatino',
  'Palatino Linotype', 'Parkavenue', 'Tahoma', 'Times', 'Times New Roman',
  'Trebuchet MS', 'Verdana', 'Zapf Chancery', 'cursive', 'fantasy', 'monospace',
  'sans-serif', 'serif', 'Times Roman'
];

function getFont(fonts, content = 'QQwWeErRtTyYuUiIoOpP1!2@3#4$5%6^7&8*9(0)<>.-_') {
  // this is the maximum length
  content = content.substr(0, 100).split('').filter(a => a.trim());
  const rtn = {};

  const node = document.createElement('span');
  document.body.appendChild(node);

  const detect = (ch, index) => {
    node.textContent = ch;
    node.style.fontFamily = fonts;
    const ref = node.getBoundingClientRect();

    chrome.runtime.sendMessage({
      cmd: 'percent',
      value: ((index + 1) / content.length * 100).toFixed(0) + '%',
      done: index + 1 === content.length
    });

    // check system fonts fists as if a font is not
    // available, a system font will be used to cover it
    for (const font of ['System Default', ...fonts]) {
      node.style.fontFamily = font;
      const rect = node.getBoundingClientRect();
      if (rect.width === ref.width && rect.height === ref.height) {
        rtn[index] = font;
        // if 'System Default' matches, it means the font stack is not being rendered, try the default fonts
        if (font === 'System Default') {
          for (const font of baseFonts) {
            if (rect.width === ref.width && rect.height === ref.height) {
              rtn[index] = font;
            }
          }
        }
        return;
      }
    }
    rtn[index] = 'none';
  };

  console.log(rtn);

  content.forEach(detect);
  document.body.removeChild(node);

  const percent = {};
  let tot = 0;
  Object.values(rtn).forEach(f => {
    const sf = f.replace(/['"]/g, '').toLowerCase();
    percent[sf] = percent[sf] || [f, 0];
    percent[sf][1] += 1;
    tot += 1;
  });

  return Object.keys(percent).map(f => [percent[f][0], (percent[f][1] / tot * 100).toFixed(1)]);
}

window.aElement = window.aElement || document.activeElement;

var style = window.getComputedStyle(window.aElement);

if (window.aElement) {
  const aFonts = [style['font-family']];
  // get fonts of all the parent elements
  let p = window.aElement;
  while (p !== document) {
    aFonts.push(window.getComputedStyle(p)['font-family']);
    p = p.parentNode;
  }

  let fonts = [];
  aFonts.forEach(fs => {
    fs.replace(';', '').split(/\s*,\s*/).forEach(f => fonts.push(f));
  });

  fonts = fonts.filter((s, i, l) => l.indexOf(s) === i);

  chrome.runtime.sendMessage({
    cmd: 'analyzed',
    url: document.location.href,
    getComputedStyle: {
      'color': style.color,
      'background-color': style['background-color'],
      'font-family': style['font-family'],
      'font-family-rendered': getFont(
        fonts,
        window.getSelection().toString() || window.aElement.textContent
      ),
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
}
