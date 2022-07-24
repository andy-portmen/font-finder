{
  const s = window.getSelection();
  const r = s.getRangeAt(0);
  let aElement = r.commonAncestorContainer;
  if (aElement.nodeType !== Element.ELEMENT_NODE) {
    aElement = aElement.parentElement;
  }
  if (aElement) {
    const o = window.getComputedStyle(aElement);
    const msg = `Font Details:

font-family: ${o.getPropertyValue('font-family')}
font-size: ${o.getPropertyValue('font-size')}
font-style: ${o.getPropertyValue('font-style')}
font-variant-caps: ${o.getPropertyValue('font-variant-caps')}
font-variant-east-asian: ${o.getPropertyValue('font-variant-caps')}
font-variant-ligatures: ${o.getPropertyValue('font-variant-ligatures')}
font-variant-numeric: ${o.getPropertyValue('font-variant-numeric')}
font-weight: ${o.getPropertyValue('font-weight')}
`;
    navigator.clipboard.writeText(msg).catch(e => alert('Error: ' + e.message + '\n\n--\n\n' + msg));
  }
  else {
    alert('Please refresh this tab and retry');
  }
}
