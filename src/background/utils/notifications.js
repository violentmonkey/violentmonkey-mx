import { i18n, defaultImage } from 'src/common';

const openers = {};

browser.notifications.onClicked.addListener(id => {
  const openerSrcId = openers[id];
  if (openerSrcId) {
    browser.__send(openerSrcId, {
      cmd: 'NotificationClick',
      data: id,
    });
  }
});

browser.notifications.onClosed.addListener(id => {
  const openerSrcId = openers[id];
  if (openerSrcId) {
    browser.__send(openerSrcId, {
      cmd: 'NotificationClose',
      data: id,
    });
    delete openers[id];
  }
});

export default function createNotification(data, src) {
  return browser.notifications.create({
    title: data.title || i18n('extName'),
    message: data.text,
    iconUrl: data.image || defaultImage,
  })
  .then(notificationId => {
    openers[notificationId] = src.id;
    return notificationId;
  });
}
