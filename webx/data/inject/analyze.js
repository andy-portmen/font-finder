'use strict';

function getFont(fonts) {
  fonts = fonts.replace(';', '').split(/\s*,\s*/);

  const node = document.createElement('span');
  node.textContent = 'QQwWeErRtTyYuUiIoOpP1!2@3#4$5%6^7&8*9(0)<>.-_';
  node.style.fontFamily = fonts;
  document.body.appendChild(node);
  const ref = node.getBoundingClientRect();
  const rtn = fonts.filter(font => {
    node.style.fontFamily = font;
    const rect = node.getBoundingClientRect();
    return rect.width === ref.width && rect.height === ref.height;
  });
  document.body.removeChild(node);
  return rtn.shift() || 'System Default' ;
}

var style = window.getComputedStyle(window.aElement);

if (window.aElement) {
  chrome.runtime.sendMessage({
    cmd: 'analyzed',
    url: document.location.href,
    getComputedStyle: {
      'color': style.color,
      'background-color': style['background-color'],
      'font-family': style['font-family'],
      'font-family-rendered': getFont(style['font-family']),
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
    }
  });
}
