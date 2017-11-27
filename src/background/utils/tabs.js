const openers = {};

browser.tabs.onRemoved.addListener(id => {
  const openerSrcId = openers[id];
  if (openerSrcId) {
    browser.__send(openerSrcId, {
      cmd: 'TabClosed',
      data: id,
    });
    delete openers[id];
  }
});

export function tabOpen(data, src) {
  const { url, active } = data;
  return browser.tabs.create({
    url,
    active,
  })
  .then(tab => {
    const { id } = tab;
    openers[id] = src.id;
    return { id };
  });
}

// REQUIRE tabId
export function tabClose(data, src) {
  const tabId = (data && data.id) || (src.tab && src.tab.id);
  if (tabId) browser.tabs.remove(tabId);
}
