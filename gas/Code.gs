/**
 * SomeRoom 注文管理 GAS メインスクリプト
 * クリックポスト連携 + 注文管理
 */

// 設定値（スクリプトプロパティから取得）
function getConfig() {
  const props = PropertiesService.getScriptProperties();
  return {
    SLACK_WEBHOOK_URL: props.getProperty('SLACK_WEBHOOK_URL') || '',
    SHEET_NAME_ORDERS: '注文一覧',
    SHEET_NAME_SHIPPING: '発送管理',
  };
}

/**
 * カスタムメニューを追加
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('SomeRoom')
    .addItem('選択行のクリックポストCSV作成', 'createClickPostCSVForSelected')
    .addItem('未発送の注文を確認', 'checkUnshippedOrders')
    .addSeparator()
    .addItem('発送完了通知を送信', 'sendShippingNotifications')
    .addToUi();
}

/**
 * 選択行のクリックポスト用CSVを生成してGoogleドライブに保存
 */
function createClickPostCSVForSelected() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const selection = sheet.getActiveRange();

  if (!selection) {
    SpreadsheetApp.getUi().alert('行を選択してください。');
    return;
  }

  const startRow = selection.getRow();
  const numRows = selection.getNumRows();
  const orders = [];

  for (let i = 0; i < numRows; i++) {
    const row = startRow + i;
    const orderId = sheet.getRange(row, 1).getValue();
    const customerName = sheet.getRange(row, 4).getValue();
    const shippingAddress = sheet.getRange(row, 5).getValue();
    const items = sheet.getRange(row, 6).getValue();

    if (!orderId || !customerName || !shippingAddress) {
      continue;
    }

    orders.push({
      orderId: orderId,
      customerName: customerName,
      shippingAddress: shippingAddress,
      items: items || 'デザイン商品',
    });
  }

  if (orders.length === 0) {
    SpreadsheetApp.getUi().alert('有効な注文データがありません。\n注文ID（A列）、お客様名（D列）、配送先住所（E列）が必要です。');
    return;
  }

  const csv = ClickPostAPI.generateCSV(orders);

  // Shift-JISに変換してGoogleドライブに保存
  var sjisBlob = Utilities.newBlob([]).setDataFromString(csv, 'Shift_JIS').setContentType('text/csv');
  var fileName = 'clickpost_' + Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMdd_HHmmss') + '.csv';
  sjisBlob.setName(fileName);

  var file = DriveApp.createFile(sjisBlob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  var downloadUrl = 'https://drive.google.com/uc?export=download&id=' + file.getId();

  var html = HtmlService.createHtmlOutput(
    '<p>' + orders.length + '件のCSVを作成しました。</p>' +
    '<p><a href="' + downloadUrl + '" target="_blank" style="font-size:16px;font-weight:bold;">CSVをダウンロード</a></p>' +
    '<p style="margin-top:16px;"><a href="https://clickpost.jp" target="_blank">クリックポストを開く</a></p>' +
    '<p style="color:#888;font-size:11px;">ファイルはGoogleドライブに保存されました: ' + fileName + '</p>'
  ).setWidth(400).setHeight(200);

  SpreadsheetApp.getUi().showModalDialog(html, 'クリックポストCSV');
}

/**
 * 未発送の注文を確認
 */
function checkUnshippedOrders() {
  const orders = SheetHelper.getUnshippedOrders();

  if (orders.length === 0) {
    SpreadsheetApp.getUi().alert('未発送の注文はありません。');
    return;
  }

  const message = orders.map(function(order) {
    return order.orderId + ' - ' + order.customerName + ' (' + order.createdAt + ')';
  }).join('\n');

  SpreadsheetApp.getUi().alert('未発送の注文: ' + orders.length + '件\n\n' + message);
}

/**
 * 発送完了通知を送信
 */
function sendShippingNotifications() {
  const config = getConfig();
  const pendingNotifications = SheetHelper.getPendingShippingNotifications();

  if (pendingNotifications.length === 0) {
    SpreadsheetApp.getUi().alert('通知待ちの発送はありません。');
    return;
  }

  let sentCount = 0;
  for (var i = 0; i < pendingNotifications.length; i++) {
    var notification = pendingNotifications[i];
    try {
      SlackNotifier.sendShippingNotification(notification);
      SheetHelper.markNotificationSent(notification.row);
      sentCount++;
    } catch (e) {
      Logger.log('Notification error: ' + e.message);
    }
  }

  SpreadsheetApp.getUi().alert('発送通知を' + sentCount + '件送信しました。');
}
