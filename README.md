# Global Net — Hotspot Management System

This version is dedicated to MikroTik Hotspot management. PPPoE is not exposed in the ISP interface.

## Main features
- Multi-tenant Super Admin with separate ISP accounts
- Hotspot users and subscriber management
- Hotspot packages: quota, speed, validity and price
- 6-digit numeric voucher cards
- Separate Card Design page
- A4 printing: 24 cards per page (4 × 6)
- Hotspot customer portal: package, used data, remaining data, speed and expiry
- MikroTik RouterOS API / API-SSL integration
- Easy MikroTik Connect wizard
- Live Hotspot session and traffic synchronization
- Hotspot usage/quota and payments

## Demo credentials
Super Admin: `admin` / `admin123`
ISP Admin: `demo` / `demo123`

## Installation
1. Create MySQL database `isp_global`.
2. Import `database/schema.sql`.
3. Edit database settings in `config/config.php`.
4. Open `auth/login.php` for Super Admin.
5. Create an ISP and ISP user.
6. Add a MikroTik router from **MikroTik → Easy Connect** or enter the API credentials manually.

## Important
This application manages Hotspot only. Do not use it as a PPPoE management panel. RouterOS Hotspot users should be created/synchronized through the Hotspot Users page or voucher workflow.
