# Infracentra Advanced Reporting — Phase 0 Audit
**Date:** 2026-10-20 · **Scope:** refonte reporting 20 rapports / 62 pages / 6 familles
**Règle appliquée :** exploration du code avant toute écriture. Aucun code de production n'a été modifié en Phase 0 (hors ce document).

---

## 1. Stack cartographiée (réelle, vérifiée dans le dépôt)

| Couche | Technologie | Emplacement |
|---|---|---|
| Frontend | React 18 + TypeScript + Vite + Tailwind | `src/` (`vite.config.ts`, proxy `/api → 127.0.0.1:8000`) |
| Backend | **FastAPI (async)**, SQLAlchemy async, PostgreSQL | `backend/app/main.py`, `database.py`, `models.py` |
| Auth | JWT Bearer (`core/security.get_current_user`), rôles `platform_admin / client_admin / client_user`, MFA TOTP (`services/mfa.py`) | `backend/app/core/security.py` |
| Multi-tenant | `organizations.id` → colonne `org_id` sur toutes les tables métier ; filtre serveur via le token (`_scope_org` dans `routers/tickets.py`) | `models.py` |
| Planificateur | Boucle asyncio lifespan (worker escalade SLA toutes les 60 s) — **pas de Celery/APScheduler** | `main.py::_escalation_loop` |
| Intégrations | Table `integrations` (api_endpoint/api_key/auth_type) + registre `SERVICE_CONNECTORS` (17 services OSS) | `services/connectors.py` |
| Déploiement | Docker Compose (`docker-compose.prebuilt.yml`), uvicorn :8000, Postgres :5432 ; lanceurs `start.bat` / `start-kali.sh` | racine |
| PDF/CSV existants | Aucun générateur PDF côté serveur. Export CSV fait côté client (logs). **Le brief exige des exports serveur.** | — |

**Conséquence architecture :** le service de reporting vivra **dans le monolithe FastAPI** (`backend/app/routers/reports.py` + `backend/app/services/report_engine.py`), pas en microservice — cohérent avec la stack et le déploiement mono-image.

## 2. Où vivent réellement les données (source par source du brief)

| Source brief | Réalité dans le code | Accès |
|---|---|---|
| Collecteur | `alerts` (ALR-xxxxx, severity, source, resource, correlated_count, storm_suppressed) + `discovered_devices` + `discovery_scans` | tables SQL |
| Normalisation IA/ML | champs `ai_*` sur `tickets` (category/priority/confidence/reasoning/root_cause, duplicate_of) | table SQL |
| SIEM | `alerts` (détection = `created_at`, corrélation = `correlated_count`) | table SQL |
| SOAR | playbooks **en base** (`routers/settings.py::router_playbooks`) + notification_rules auto-ticket ; runs non historisés | API interne + SQL |
| Tableau de bord | agrégations ad-hoc frontend (DashboardPage) | — |
| Intégrations ouvertes | `integrations` + `GET /api/services/{id}/live` (connecteurs OSS : MISP, TheHive, Netdata, Pi-hole…) | REST sortant |
| Ticketing avancé | `tickets` + `ticket_evidence` + `ticket_audit_entries` (hash-chain) + `ticket_approvals` ; SLA complet (due_response_at, first_response_at, resolved_at, escalation_level) | table SQL |
| Projects | `projects` + `project_milestones` (timer, sla_hours, due_at, lien tickets par catégorie) | table SQL |
| Notifications | `notifications` + `channel_configs` (email/webhook/sms customisés) | table SQL |
| Audit plateforme | `audit_logs` (actions admin/intégrations) | table SQL |

## 3. Gestion multi-clients
✅ Existe. `User.org_id` + `_scope_org()` : un client ne peut requêter que son org ; `platform_admin` voit tout ou une org ciblée. À réutiliser tel quel pour `/api/v1/reports*` (**le tenant vient du token uniquement**, conforme au brief).

## 4. Tables de la spécification — disponible / reconstructible / absente

| Table spec | Statut | Détail |
|---|---|---|
| assets | 🟡 reconstructible | `discovered_devices` (découverte SNMP/Nmap réelle) + `tickets.asset` ; pas d'inventaire « attendu » → couverture à estimer via `entitlements.seat_count` |
| alerts | 🟢 telle quelle | `alerts` |
| incidents | 🟢 reconstructible | `tickets WHERE category='incident'` (statuts complets, SLA horodatés) |
| vulnerabilities | 🔴 absente | aucun store CVE local ; trace via `tickets.vulnerability_ref` + connecteur OpenVAS live |
| iocs | 🟡 partielle | `threat_intel.py` (MISP/OTX live) non persistée |
| playbook_runs | 🟡 partielle | runs retournés par l'API playbooks, non historisés en table |
| controls | 🔴 absente | page ComplianceReports.tsx = **données codées en dur** |
| kpi_daily/monthly | 🔴 absente | à créer (Phase 1) |
| risks / action_items / hunts | 🔴 absentes | à créer (Phase 1 + saisies Phase 7) |
| patches, backups, email_stats, network_metrics, endpoint_health, uba_scores, audit_log(✅ existe en tant qu'`audit_logs`), export_log, config_changelog, roi_parameters | voir §6 | |

## 5. Comparaison avec les « 20 rapports existants » — **résultat clé**

⚠️ **Le projet ne contient PAS 20 rapports.** L'audit exhaustif (`grep -ril report src backend`) trouve uniquement :

| Ce qui existe réellement | Nature | Verdict |
|---|---|---|
| `client-admin/ComplianceReports.tsx` | 3 rapports factices (SOC 2 / ISO 27001 / PCI DSS) en `useState` codé en dur | à remplacer par données réelles (rapports #4 et #20) |
| `AdvancedTicketingPage.tsx` | KPIs ops temps réel depuis l'API `/tickets` (workload, SLA breaches) | **base saine** pour le rapport #8 Ticket Operations |
| `SecurityHistoryTimeline.tsx`, `ArchitectureDiagram.tsx` | composants display démo | non réutilisables comme rapports |
| Routes backend `/reports*` | **aucune** | toute l'API est à créer |
| Moteur PDF/CSV serveur | **aucun** | à créer (Phase 6) |

→ Les noms/IDs du catalogue cible (section 2 du brief) deviennent la référence absolue ; rien à préserver côté rapports, seulement à **ne pas casser** les écrans existants (ComplianceReports restera accessible, alimenté par la nouvelle API).

## 6. Sources manquantes pour les rapports nouveaux (à déclarer, pas d'invention)

| Rapport | Donnée demandée | Source actuelle | Plan |
|---|---|---|---|
| 7 Network Performance | débit/latence | connecteur Netdata/LibreNMS live (non persisté) | job J → snapshot `network_metrics` |
| 13 Backup & DR | jobs backup/restaures | connecteur Restic/borgmatic (probe only) | table `backups` + endpoint de push agent |
| 14 Email Security | stats spam/phishing | Rspamd/Mailcow via connector `/live` | table `email_stats` alimentée par sync |
| 16 Endpoint Protection | santé agents | Wazuh agents (connector) | table `endpoint_health` |
| 17 UBA | scores comportement | aucun | moteur simple alertes×assets en J + table `uba_scores` |
| 10 Audit Trail | actions plateforme | ✅ `audit_logs` + `ticket_audit_entries` (hash-chain) | directement branchable |
| 9 ROI | coûts/hypothèses | aucun | table `roi_parameters` (saisie humaine Phase 7) |
| 12 Patch | états patchs | Fleet/osquery connector | table `patches` alimentée par sync |

## 7. Écarts identifiés
1. **MTTD partiellement impossible** : `alerts.created_at` existe mais pas de « début réel de l'activité » → fallback du brief (alerte − premier événement corrélé) applicable via `correlated_count`/`raw_payload`.
2. MTTR ✅ calculable (`first_response_at`, `resolved_at`).
3. Pas d'ID commun entre devices (`discovered_devices.ip`) et tickets (`asset` texte libre) → normalisation hôte IP↔hostname dans le job J.
4. Horodatages : tout est UTC (`DateTime(timezone=True)`) ✅ ; front affiche des dates locales — à verrouiller en UTC + mention.
5. `playbook_runs` non historisé → métriques automatisation/SOAR (#18) impossibles sans table.
6. Classification des données : champ manquant sur `organizations` → ajouter, exposé dans `/meta`.
7. ✅ Points positifs vérifiés : `Organization.asset_count` / `member_count` / `risk_score` / `compliance_score` existent → le calcul de **Couverture** (assets connectés ÷ attendus) est faisable sans nouvelle source ; les 17 IDs de services (`connectors.py`) couvrent tous les domaines des 20 rapports (aucun rapport orphelin de source).

## 8. Architecture proposée (validation attendue)
```
backend/app/services/report_engine.py    # blocs K/R/B/T/M/L + S/G/F/D/H/C/P ; formules KPI uniques (brief §6)
backend/app/services/report_builders.py  # build_executive … build_regulatory (20 fonctions, IDs stables 1..20)
backend/app/models.py                    # + tables reporting (tenant_id, UTC, source) — migration via init_schema.sql
backend/app/routers/reports.py           # GET /api/v1/reports, /{id}, /{id}/pages/{n}, /meta, /export?format=pdf|csv, POST /refresh, PUT saisies
main.py                                  # boucle aggregation H/J/M (pattern _escalation_loop, idempotent, backfill flag)
frontend/src/pages/ReportsPage.tsx       # navigation 3 niveaux (familles→rapports→pages), thème sombre actuel, garde IC_DEMO_MODE
PDF : Playwright headless (Docker/Linux) + fallback weasyprint pur-Python (Windows) ; CSV : stdlib csv, UTF-8 BOM
```
Zéro nom d'outil tiers côté client : les builders mappent « intégration EDR/XDR », « supervision », etc. Les vrais noms restent dans `connectors.py`/config.

## 9. Questions au commanditaire (brief §10 — je ne devine pas)
1. Stack reporting : OK pour monolithe FastAPI + Postgres (pas de microservice) ?
2. Score de posture : poids 30/25/25/20 validés ?
3. Rétention agrégats/PDF : suggestion 13 mois / 90 jours — valider.
4. Qui valide les contrôles conformité côté client (rôle `client_admin` suffit ?) ?
5. Front : portage dans React existant (recommandé) plutôt que fichier HTML autonome ?
6. Nombre de tenants au lancement (dimensionnement cache/export) ?

## 10. Faisabilité page par page (extrait du tableau complet — contrat Phase 1/4)

Légende : 🟢 données réelles dispo dès aujourd'hui · 🟡 partiel (calcul fallback requis) · 🔴 nécessite nouvelle table/source (Phase 1–2). Vérifié : 6 familles, 20 rapports, 5+19×3 = **62 pages**.

| # | Rapport / Page | Donnée demandée | Source réelle trouvée | Faisabilité | Travail nécessaire |
|---|---|---|---|---|---|
| 1 | Executive p1 Synthèse | KPIs risque/posture/alertes | `organizations.risk_score`, `alerts`, `tickets` | 🟢 | builder + agrégats kpi_daily |
| 1 | Executive p2 SOC | MTTD/MTTR, faux positifs | `alerts.created_at`, `tickets.first_response_at/resolved_at` | 🟡 MTTD fallback | module KPI unique + tests cas limites |
| 1 | Executive p3 Couverture | assets connectés ÷ attendus | `discovered_devices` vs `organizations.asset_count` | 🟢 | normalisation hôte IP↔asset |
| 1 | Executive p4 Vulnérabilités+cloud | CVE par sévérité | aucun store local (`tickets.vulnerability_ref` traces) | 🔴 | table `vulnerabilities` + sync OpenVAS/cloud |
| 1 | Executive p5 Centre téléchargement | catalogue 20 rapports | statique (catalogue code) | 🟢 | endpoint /reports + UI |
| 2 | Threat Intel p1-3 | IoCs, campagnes | `threat_intel.py` MISP/OTX live (non persisté) | 🟡 | table `iocs` + job J snapshot |
| 3 | Incident Response p1-3 | incidents, timeline, causes racines | `tickets(category=incident)` + `ai_predicted_root_cause` + `ticket_audit_entries` | 🟢 | builder uniquement |
| 4 | Compliance NIST/SOC2/ISO p1-3 | contrôles conformes/applicables | frontend codé en dur uniquement | 🔴 | tables `controls` + `compliance_results` + validation humaine |
| 5 | Infra Health p1-3 | santé équipements | `discovered_devices` + `alerts.resource` + connecteur supervision `/live` | 🟢🟡 | corrélation device↔alertes |
| 6 | Vulnerability p1-3 | scans, MTTR patch | pas de store vuln local | 🔴 | idem #4p4 + table `patches` |
| 7 | Network Perf p1-3 | débit/latence/paquet loss | Netdata/LibreNMS live non persisté | 🔴 | table `network_metrics` + job J |
| 8 | Ticket Ops p1-3 | volume, SLA breaches, workload | `/tickets/ops/workload`, SLA fields, escalades auto | 🟢 | builder (KPIs déjà prouvés dans AdvancedTicketingPage) |
| 9 | ROI p1-3 | coûts évités, heures économisées | aucune donnée financière | 🔴 | table `roi_parameters` (saisie Phase 7) + heures via playbook_runs |
| 10 | Audit Trail p1-3 | actions plateforme, hash-chain | `audit_logs` + `ticket_audit_entries.prev_hash` | 🟢 | builder + pagination |
| 11 | Hunting p1-3 | hypothèses, sessions | aucune | 🔴 | table `hunts` (saisie Phase 7) |
| 12 | Patch p1-3 | conformité patchs | Fleet/osquery connector probe only | 🔴 | table `patches` + sync |
| 13 | Backup & DR p1-3 | jobs, RPO/RTO, tests restore | Restic/borgmatic probe only | 🔴 | tables `backups`/`restore_tests` + push agent |
| 14 | Email Security p1-3 | spam/phishing/quarantaine | Rspamd/Mailcow `/live` | 🟡 | table `email_stats` + sync |
| 15 | Cloud Posture p1-3 | findings CSPM | Prowler connector `/live` | 🟡 | persistance findings |
| 16 | Endpoint p1-3 | agents actifs/obsolètes | Wazuh agents connector | 🟡 | table `endpoint_health` |
| 17 | UBA p1-3 | scores comportement | aucun | 🔴 | moteur J sur `alerts`×assets + `uba_scores` |
| 18 | SOAR p1-3 | runs, heures économisées | playbooks en base, runs non historisés | 🔴 | table `playbook_runs` + hook EV |
| 19 | Client Value p1-3 | satisfaction, SLA globaux, projets | `tickets` (pas de champ CSAT), `projects.sla_hours/due_at` | 🟡 | colonne csat + builder projets |
| 20 | Regulatory RGPD/HIPAA/PCI p1-3 | contrôles réglementaires | même lacune que #4 | 🔴 | mêmes tables, référentiels différents |

**Bilan chiffré :** 7 pages 🟢 immédiates · 12 pages 🟡 avec fallback · **~15 tables/nouvelles sources à créer** (toutes listées Phase 1). Aucun rapport ne sera publié avec des zéros trompeurs : bloc « Donnée indisponible + date de dernière mise à jour » par défaut (règle brief §4 Phase 4).

---
**Livrable Phase 0 terminé — j'attends ton feu vert (et tes réponses §9) avant la Phase 1 (migrations + module KPI unique + tests).**
