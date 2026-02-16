/**
 * クリックポストAPI連携
 */
var ClickPostAPI = (function() {

  /**
   * クリックポストAPIでラベルを作成
   * @param {Object} params - ラベル作成パラメータ
   * @param {string} params.orderId - 注文ID
   * @param {string} params.recipientName - 受取人名
   * @param {string} params.address - 配送先住所
   * @returns {Object} - { trackingNumber, labelUrl }
   */
  function createLabel(params) {
    var config = getConfig();

    // クリックポストAPIリクエスト
    // 注意: クリックポストはWeb UIベースのサービスのため、
    // 実際のAPI連携にはスクレイピングまたはCSVアップロードが必要です。
    // ここではCSVアップロード方式のためのデータ準備を行います。

    var addressParts = parseAddress(params.address);

    return {
      orderId: params.orderId,
      recipientName: params.recipientName,
      postalCode: addressParts.postalCode,
      prefecture: addressParts.prefecture,
      city: addressParts.city,
      address: addressParts.address,
      trackingNumber: '', // CSVアップロード後に手動入力
      labelUrl: '',
    };
  }

  /**
   * クリックポスト用CSVを生成
   * @param {Array} orders - 注文データの配列
   * @returns {string} - CSV文字列
   */
  function generateCSV(orders) {
    var header = [
      'お届け先郵便番号',
      'お届け先氏名',
      'お届け先敬称',
      'お届け先住所1行目',
      'お届け先住所2行目',
      'お届け先住所3行目',
      'お届け先住所4行目',
      '内容品',
    ].join(',');

    var rows = orders.map(function(order) {
      var addressParts = parseAddress(order.shippingAddress);
      return [
        addressParts.postalCode,
        order.customerName,
        '様',
        addressParts.prefecture + addressParts.city,
        addressParts.address,
        '',
        '',
        'デザイン商品',
      ].join(',');
    });

    return header + '\n' + rows.join('\n');
  }

  /**
   * 住所を分解
   * @param {string} address - "〒XXX-XXXX 都道府県市区町村..." 形式
   * @returns {Object}
   */
  function parseAddress(address) {
    var result = {
      postalCode: '',
      prefecture: '',
      city: '',
      address: '',
    };

    if (!address) return result;

    // 郵便番号を抽出
    var postalMatch = address.match(/〒?(\d{3}-?\d{4})/);
    if (postalMatch) {
      result.postalCode = postalMatch[1].replace('-', '');
      address = address.replace(postalMatch[0], '').trim();
    }

    // 都道府県を抽出
    var prefMatch = address.match(/^(北海道|東京都|京都府|大阪府|.{2,3}県)/);
    if (prefMatch) {
      result.prefecture = prefMatch[1];
      address = address.replace(prefMatch[0], '');
    }

    // 市区町村と残りの住所
    var cityMatch = address.match(/^(.+?[市区町村郡])/);
    if (cityMatch) {
      result.city = cityMatch[1];
      result.address = address.replace(cityMatch[0], '');
    } else {
      result.address = address;
    }

    return result;
  }

  return {
    createLabel: createLabel,
    generateCSV: generateCSV,
    parseAddress: parseAddress,
  };
})();
