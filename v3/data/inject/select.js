'use strict';

// hide the embedded div
[...document.querySelectorAll('#font-finder-embedded-div')].forEach(d => d.remove());

var div = document.createElement('div');
div.setAttribute('class', 'iffselector');
document.body.appendChild(div);
window.div = div;

function mouseover(e) {
  const target = e.target;
  const rect = target.getBoundingClientRect();
  div.style.left = rect.left + 'px';
  div.style.top = rect.top + 'px';
  div.style.width = rect.width + 'px';
  div.style.height = rect.height + 'px';
  div.style.display = 'block';
  div.dataset.type = target.localName;
  if (target.tagName === 'IFRAME') {
    div.dataset.iframe = true;
    try {
      target.contentWindow;
    }
    catch (e) {
      div.dataset.type += ' (remote frame)';
    }
  }
}
function onclick(e) {
  if (e.button === 0) {
    e.preventDefault();
    e.stopPropagation();
    window.aElement = e.target;
    chrome.runtime.sendMessage({
      cmd: 'analyze'
    }, () => chrome.runtime.lastError);
  }
  chrome.runtime.sendMessage({
    cmd: 'release'
  }, () => chrome.runtime.lastError);
}
function onkeyup(e) {
  if (e.keyCode === 27) {
    chrome.runtime.sendMessage({
      cmd: 'release'
    }, () => chrome.runtime.lastError);
  }
}
function onMessage(request) {
  if (request === 'release') {
    document.removeEventListener('mouseover', mouseover);
    document.removeEventListener('click', onclick, true);
    document.removeEventListener('keyup', onkeyup);
    chrome.runtime.onMessage.removeListener(onMessage);
    try {
      document.body.removeChild(div);
    }
    catch (e) {}
    window.div = undefined;
  }
}
document.addEventListener('mouseover', mouseover);
document.addEventListener('click', onclick, true);
document.addEventListener('keyup', onkeyup);
chrome.runtime.onMessage.addListener(onMessage);
