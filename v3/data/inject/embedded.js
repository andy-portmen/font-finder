[...document.querySelectorAll('#font-finder-embedded-div')].forEach(d => d.remove());

{
  const div = document.createElement('div');
  div.id = 'font-finder-embedded-div';
  div.style = `
    all: initial;
    position: fixed;
    left: 0;
    top: 0;
    width: calc(100vw - 22px);
    height: 100vh;
    background-color: transparent;
    z-index: 2147483647;
    display: flex;
    align-items: end;
    justify-content: end;
  `;

  const iframe = document.createElement('iframe');
  iframe.src = chrome.runtime.getURL('data/window/index.html?mode=embed&id=' + self.id);
  iframe.style = `
    width: min(600px, calc(100vw - 50px));
    height: min(700px, calc(100vh - 50px));
    border: none;
    background-color: #fff;
  `;
  div.appendChild(iframe);

  div.addEventListener('click', () => div.remove());

  document.documentElement.appendChild(div);
}
