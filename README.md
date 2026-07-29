# Humanitarian Aid Dashboard

An interactive iPhone dashboard for monitoring humanitarian assistance from Excel and CSV files. All files, insights, and recommendations are processed locally on the device.

## Dashboard capabilities

- People reached and households assisted
- Aid amount and aid per beneficiary
- Target coverage, urgent cases, and pending caseload
- Reach by aid type, month, region, and vulnerability
- Automatically generated operational insights
- Rule-based recommendations for coverage gaps, urgent needs, pending cases, and allocation review
- Filters for period, region, aid type, and program status

## Run the project

```bash
npm install
npx expo start
```

## Supported file columns

- Date
- Region
- Aid Type
- Program
- Partner
- Status
- Beneficiaries
- Households
- Aid Amount
- Target Beneficiaries
- Urgent Cases
- Delivered Cases
- Pending Cases
- Vulnerability Score

The first worksheet in an Excel file is used. A ready-to-import example is included in `sample-data.csv`.

## IPA

GitHub Actions builds an unsigned IPA on macOS. Sign it with an Apple Developer certificate and provisioning profile before installing it on an iPhone.

