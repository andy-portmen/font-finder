'use strict';

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
  div.dataset.iframe = target.localName === 'iframe';
  div.dataset.type = target.localName;
}
function onclick(e) {
  if (e.button === 0) {
    e.preventDefault();
    e.stopPropagation();
    window.aElement = e.target;
    chrome.runtime.sendMessage({
      cmd: 'analyze'
    });
  }
  chrome.runtime.sendMessage({
    cmd: 'release'
  });
}
function onkeyup(e) {
  if (e.keyCode === 27) {
    chrome.runtime.sendMessage({
      cmd: 'release'
    });
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
