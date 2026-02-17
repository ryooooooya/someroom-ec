/**
 * スプレッドシート操作ヘルパー
 */
var SheetHelper = (function() {
  var config = getConfig();

  function getOrderSheet() {
    return SpreadsheetApp.getActiveSpreadsheet()
      .getSheetByName(config.SHEET_NAME_ORDERS);
  }

  function getShippingSheet() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(config.SHEET_NAME_SHIPPING);
    if (!sheet) {
      sheet = ss.insertSheet(config.SHEET_NAME_SHIPPING);
      sheet.getRange(1, 1, 1, 6).setValues([[
        '注文ID', '追跡番号', 'ラベルURL', '発送日', '通知済み', '備考'
      ]]);
    }
    return sheet;
  }

  /**
   * 発送記録を追加
   */
  function addShippingRecord(orderId, trackingNumber, labelUrl) {
    var sheet = getShippingSheet();
    sheet.appendRow([
      orderId,
      trackingNumber,
      labelUrl || '',
      new Date().toISOString(),
      'FALSE',
      '',
    ]);
  }

  /**
   * 未発送の注文を取得
   */
  function getUnshippedOrders() {
    var orderSheet = getOrderSheet();
    var shippingSheet = getShippingSheet();

    if (!orderSheet) return [];

    var orderData = orderSheet.getDataRange().getValues();
    var shippingData = shippingSheet.getDataRange().getValues();

    // 発送済み注文IDのセット
    var shippedIds = {};
    for (var i = 1; i < shippingData.length; i++) {
      shippedIds[shippingData[i][0]] = true;
    }

    var unshipped = [];
    for (var j = 1; j < orderData.length; j++) {
      var orderId = orderData[j][0];
      if (orderId && !shippedIds[orderId]) {
        unshipped.push({
          orderId: orderId,
          customerName: orderData[j][9],   // J列: 氏名
          postalCode: orderData[j][7],     // H列: 郵便番号
          shippingAddress: orderData[j][8], // I列: 住所
          items: orderData[j][2],          // C列: 商品名
          createdAt: orderData[j][1],      // B列: 注文日時
          row: j + 1,
        });
      }
    }

    return unshipped;
  }

  /**
   * 通知待ちの発送を取得
   */
  function getPendingShippingNotifications() {
    var sheet = getShippingSheet();
    var data = sheet.getDataRange().getValues();
    var pending = [];

    for (var i = 1; i < data.length; i++) {
      if (data[i][1] && data[i][4] !== true && data[i][4] !== 'TRUE') {
        pending.push({
          orderId: data[i][0],
          trackingNumber: data[i][1],
          shippedAt: data[i][3],
          row: i + 1,
        });
      }
    }

    return pending;
  }

  /**
   * 通知済みフラグを立てる
   */
  function markNotificationSent(row) {
    var sheet = getShippingSheet();
    sheet.getRange(row, 5).setValue('TRUE');
  }

  return {
    addShippingRecord: addShippingRecord,
    getUnshippedOrders: getUnshippedOrders,
    getPendingShippingNotifications: getPendingShippingNotifications,
    markNotificationSent: markNotificationSent,
  };
})();
