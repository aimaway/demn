# Migration navigation — Refonte UX (taxonomie A-F)

## Nouveau menu Client Admin
- Dashboard : Executive Dashboard (fusion Overview + Value & Loyalty, widgets ROI integres)
- SOC : Active Incidents, Performance Metrics, Notifications, dropdown "Incidents & Statistics"
  (Security History, Statistics, Devices, Network Statistics, System Performance, Compliance)
- Infrastructure : Infrastructure Map (Topology Visualizer)
- Automation (dropdown) : Playbooks, Scripts (AI generator), Runbooks (project procedures)
- Delivery : Service Desk, Projects, Advanced Reporting
- Administration : Subscription & Billing, Asset Inventory, Team & Roles, My Services, Platform Configuration

Renommages : Operations -> Dashboard ; Notification Engine -> Notifications ; Custom Playbooks -> Playbooks.

## Redirects anciennes routes (remplace)
/client-admin/tickets -> /client-admin/advanced-tickets
/client-admin/device-statistics -> /client-admin/statistics/devices
/client-admin/network-statistics -> /client-admin/statistics/network
/client-admin/performance -> /client-admin/statistics/performance
/client-admin/notification-engine -> /client-admin/notifications
/client-admin/custom-playbooks -> /client-admin/playbooks
/client-admin/value-and-loyalty -> /client-admin/dashboard
/client-admin/overview -> /client-admin/dashboard

## Command palette
Ctrl/Cmd+K partout. Indexe nouveaux noms ET alias historiques ("tickets" -> Service Desk...).

## Architecture & Integration : masquee
Route /client-admin/architecture toujours active, entree menu retiree.
Remise en ligne = 1 ligne : voir INTEGRATION-HIDDEN.md.

## Verification
tsc --noEmit : 0 erreur ; npm run build : OK (~1,45 Mo).
