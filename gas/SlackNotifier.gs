/**
 * Slack通知ヘルパー
 */
var SlackNotifier = (function() {

  /**
   * Slack Webhookへメッセージ送信
   */
  function send(message) {
    var config = getConfig();
    var webhookUrl = config.SLACK_WEBHOOK_URL;

    if (!webhookUrl) {
      Logger.log('SLACK_WEBHOOK_URL is not configured');
      return;
    }

    var payload = {
      text: message,
    };

    var options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
    };

    try {
      UrlFetchApp.fetch(webhookUrl, options);
    } catch (e) {
      Logger.log('Slack notification error: ' + e.message);
    }
  }

  /**
   * 発送通知を送信
   */
  function sendShippingNotification(data) {
    var message = [
      '📦 発送完了',
      '',
      '注文ID: ' + data.orderId,
      '追跡番号: ' + data.trackingNumber,
      '発送日: ' + data.shippedAt,
    ].join('\n');

    send(message);
  }

  /**
   * エラー通知を送信
   */
  function sendError(context, error) {
    var message = [
      '⚠️ GASエラー',
      '',
      'コンテキスト: ' + context,
      'エラー: ' + error,
      '時刻: ' + new Date().toISOString(),
    ].join('\n');

    send(message);
  }

  return {
    send: send,
    sendShippingNotification: sendShippingNotification,
    sendError: sendError,
  };
})();
