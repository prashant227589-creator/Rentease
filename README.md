# RentEase Pro 🏠

RentEase Pro is a premium, modern landlord portal designed to simplify property management. It provides a sleek interface for managing tenants, tracking rent payments, and handling maintenance requests with AI-powered document scanning features.

## ✨ Features

- **Dashboard Overview**: Visual summary of total revenue, security deposits, and portfolio health.
- **Tenant Management**: Onboard, edit, and manage active tenants. Support for "hiding" inactive tenants.
- **Rent Ledger**: Monthly payment tracking (Paid, Unpaid, Overdue) with year-end rollover support.
- **Maintenance AI**: Simulate scanning receipts and lease agreements to auto-populate data.
- **Google Sheets Backend**: All data is synced in real-time with a Google Sheet for reliability and easy export.

## 🚀 Tech Stack

- **Frontend**: HTML5, Tailwind CSS, React (via CDN), Framer Motion.
- **Backend**: Google Apps Script (GAS) acting as a serverless API.
- **Database**: Google Sheets.

## 🛠️ Setup

1.  Clone the repository.
2.  Open `index.html` in your browser.
3.  Ensure the Google Apps Script Web App URL is correctly configured in the `API_URL` constant within `index.html` to connect to your own sheet.

## 📄 License

This project is for educational and personal use.
