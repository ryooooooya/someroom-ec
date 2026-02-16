/**
 * SomeRoom 注文管理 GAS メインスクリプト
 * クリックポスト連携 + 注文管理
 */

// 設定値（スクリプトプロパティから取得）
function getConfig() {
  const props = PropertiesService.getScriptProperties();
  return {
    CLICKPOST_API_KEY: props.getProperty('CLICKPOST_API_KEY') || '',
    CLICKPOST_LOGIN_ID: props.getProperty('CLICKPOST_LOGIN_ID') || '',
    CLICKPOST_PASSWORD: props.getProperty('CLICKPOST_PASSWORD') || '',
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
    .addItem('選択行のクリックポストラベル作成', 'createClickPostLabelsForSelected')
    .addItem('未発送の注文を確認', 'checkUnshippedOrders')
    .addSeparator()
    .addItem('発送完了通知を送信', 'sendShippingNotifications')
    .addToUi();
}

/**
 * 選択行のクリックポストラベルを作成
 */
function createClickPostLabelsForSelected() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const selection = sheet.getActiveRange();

  if (!selection) {
    SpreadsheetApp.getUi().alert('行を選択してください。');
    return;
  }

  const startRow = selection.getRow();
  const numRows = selection.getNumRows();
  const config = getConfig();
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < numRows; i++) {
    const row = startRow + i;
    const orderId = sheet.getRange(row, 1).getValue();
    const customerName = sheet.getRange(row, 4).getValue();
    const shippingAddress = sheet.getRange(row, 5).getValue();

    if (!orderId || !customerName || !shippingAddress) {
      errorCount++;
      continue;
    }

    try {
      const result = ClickPostAPI.createLabel({
        orderId: orderId,
        recipientName: customerName,
        address: shippingAddress,
      });

      if (result.trackingNumber) {
        // 発送管理シートに記録
        SheetHelper.addShippingRecord(orderId, result.trackingNumber, result.labelUrl);
        successCount++;
      } else {
        errorCount++;
      }
    } catch (e) {
      Logger.log('ClickPost label creation error: ' + e.message);
      errorCount++;
    }
  }

  SpreadsheetApp.getUi().alert(
    `処理完了\n成功: ${successCount}件\nエラー: ${errorCount}件`
  );
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
