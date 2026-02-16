# GAS（Google Apps Script） - クリックポスト連携

SomeRoom 注文管理のための Google Apps Script です。
注文スプレッドシートと連携し、クリックポストのラベル作成・発送管理を行います。

## セットアップ手順

### 1. Google Spreadsheet の準備

1. Google Spreadsheet を新規作成
2. シート名を「注文一覧」に変更
3. ヘッダー行を追加:
   - A: 注文ID
   - B: セッションID
   - C: メールアドレス
   - D: お客様名
   - E: 配送先住所
   - F: 商品一覧
   - G: 合計金額
   - H: 通貨
   - I: ステータス
   - J: 注文日時

### 2. GAS スクリプトのデプロイ

1. Spreadsheet のメニューから「拡張機能 > Apps Script」を開く
2. 以下のファイルを作成してコードを貼り付け:
   - `Code.gs`
   - `ClickPostAPI.gs`
   - `SheetHelper.gs`
   - `SlackNotifier.gs`

### 3. スクリプトプロパティの設定

Apps Script エディタで「プロジェクトの設定 > スクリプトプロパティ」を開き、以下を設定:

| プロパティ名 | 説明 |
|---|---|
| `CLICKPOST_API_KEY` | クリックポストAPIキー |
| `CLICKPOST_LOGIN_ID` | クリックポストログインID |
| `CLICKPOST_PASSWORD` | クリックポストパスワード |
| `SLACK_WEBHOOK_URL` | Slack Incoming Webhook URL |

### 4. サービスアカウント認証の設定

Vercel の Webhook からスプレッドシートに書き込むために:

1. Google Cloud Console でサービスアカウントを作成
2. JSON キーをダウンロード
3. スプレッドシートをサービスアカウントのメールアドレスに共有（編集権限）
4. `.env` に以下を設定:
   - `GOOGLE_SPREADSHEET_ID`: スプレッドシートのID
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`: サービスアカウントのメールアドレス
   - `GOOGLE_PRIVATE_KEY`: JSON キーの `private_key` フィールド

## 使い方

Spreadsheet を開くとメニューバーに「SomeRoom」が表示されます:

- **選択行のクリックポストラベル作成**: 選択した注文行のクリックポスト用データを生成
- **未発送の注文を確認**: まだ発送されていない注文の一覧を表示
- **発送完了通知を送信**: 発送管理シートの未通知レコードに対してSlack通知を送信

## クリックポスト連携について

クリックポストはWeb UIベースのサービスのため、完全なAPI連携ではなくCSVアップロード方式を採用しています:

1. GAS メニューから注文データを選択
2. クリックポスト用CSVデータが生成される
3. クリックポストのWebサイトでCSVアップロード
4. 追跡番号を発送管理シートに記録
