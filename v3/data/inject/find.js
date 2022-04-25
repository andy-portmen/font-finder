{
  const es = [...document.body.getElementsByTagName('*')];
  const names = es.map(e => window.getComputedStyle(e).getPropertyValue('font-family').split(',')
    .map(s => s.toLowerCase().replace(/^\\s+|\\s+$/g, '').replace(/['"]/g, ''))
  );
  alert([].concat(...names).filter((s, i, l) => l.indexOf(s) === i).join(', '));
}
