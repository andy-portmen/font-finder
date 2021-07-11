[...document.querySelectorAll('#font-finder-embedded-div')].forEach(d => d.remove());

{
  const div = document.createElement('div');
  div.id = 'font-finder-embedded-div';
  div.style = `
    all: inherit;
    position: fixed;
    left: 0;
    top: 0;
    width: 100vw;
    height: 100vh;
    background-color: rgba(0, 0, 0, 0.3);
    z-index: 2147483647;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  const iframe = document.createElement('iframe');
  iframe.src = chrome.runtime.getURL('data/window/index.html?mode=embed');
  iframe.style = `
    width: 600px;
    height: 650px;
    border: none;
    background-color: #fff;
  `;
  div.appendChild(iframe);

  div.addEventListener('click', () => div.remove());

  document.documentElement.appendChild(div);
}
