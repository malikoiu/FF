# Analytics Dashboard

An interactive iPhone dashboard for importing and analyzing Excel and CSV files locally. The app uses a polished dark interface with KPIs, interactive charts, filters, and previous-period comparisons.

## Run the project

```bash
npm install
npx expo start
```

Open the QR code using Expo Go for SDK 57, or run the web version:

```bash
npx expo start --web
```

## Data format

The app reads the first worksheet in an Excel file and recognizes these columns:

- Date
- Category
- Region
- Channel
- Product
- Representative
- Sales or Revenue
- Orders
- Returns
- Cost
- Quantity
- Price

If a Sales column is unavailable, the app calculates sales as `Price × Quantity`. A ready-to-use example is included in `sample-data.csv`.

## IPA

The GitHub Actions workflow builds an unsigned IPA on macOS. Sign the IPA with your Apple Developer certificate and provisioning profile before installing it on an iPhone.

Change `ios.bundleIdentifier` in `app.json` before signing if the identifier is already registered to another Apple Developer account.

