# BrewBar POS — Architecture

## System Overview

```
                         Internet
                            |
                    +-------+--------+
                    |  Cloud Server  |
                    |  (VPS/Docker)  |
                    +-------+--------+
                            |
              +-------------+-------------+
              |             |             |
     ASP.NET Core API     MySQL        Redis
     (BrewBar.API)       (primary)    (cache)
              |
              +-------- HTTPS ---------+
              |                        |
     Angular Admin App          Angular POS App
     (browser, any device)      (Chrome kiosk, tablet)
                                       |
                                 WebUSB / HTTP
                                       |
                                 Thermal Printer
                                 + Cash Drawer
```

## Bounded Contexts

| Context     | Purpose                   | Key Entities                                            |
|-------------|---------------------------|---------------------------------------------------------|
| Catalog     | Menu management           | Category, Product, ProductVariant, Modifier, ModifierOption |
| Orders      | Order lifecycle           | Order, OrderLineItem, OrderModifierItem                 |
| Payments    | Transaction recording     | Payment                                                 |
| Users/Auth  | Authentication & roles    | AppUser (Admin, Manager, Cashier), Terminal              |
| Reporting   | Sales analytics           | (read-only queries)                                     |
| Sync        | Offline-first sync        | SyncOutboxEntry, SyncConflictLog                        |
| Printing    | Receipt/ticket printing   | (service layer only)                                    |

## Offline-First Sync

- POS writes orders to IndexedDB (Dexie.js) first
- Outbox queue syncs to backend when online
- Catalog syncs down from server using delta timestamps
- Idempotency via LocalId (GUID) on each order

## Hardware Integration

- **Receipt Printer:** WebUSB API (Chrome) for USB thermal printers, ESC/POS protocol
- **Cash Drawer:** ESC/POS kick-pulse command through printer
- **Fallback:** Local Node.js print agent on localhost:9100
- **Kitchen Printer:** Backend TCP relay to network printer (Phase 2)
