import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Users, DollarSign, TrendingUp, AlertTriangle, CheckCircle2, Activity, Shield, Settings as SettingsIcon, Inbox, Radio, Wand2, Loader2 } from 'lucide-react';
import { demoOrganizations, demoUsers, demoAuditLog, serviceCatalog } from '../../data/mockData';
import { settingsApi, pushDemoEvents } from '../../services/api';

function SetupPanel() {
  const [busy, setBusy] = useState<'seed' | 'demo' | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const seed = async () => {
    setBusy('seed'); setErr(null); setMsg(null);
    try {
      const res = await settingsApi.seedDemoTenant();
      setMsg(`Tenant créé : ${res?.organization?.name ?? 'Damanecash'} — compte client : admin@damanecash.ma / Client#2026`);
    } catch (e: any) {
      setErr(e?.message?.includes('409') ? 'Le tenant de démo existe déjà.' : (e?.message || 'Échec du seed.'));
    } finally { setBusy(null); }
  };

  const demo = async () => {
    setBusy('demo'); setErr(null); setMsg(null);
    try {
      let orgId: number | undefined;
      try {
        const ov = await settingsApi.overview();
        orgId = (ov as any)?.organizations?.[0]?.id ?? (ov as any)?.tenants?.[0]?.id;
      } catch { /* ignore */ }
      const res = await pushDemoEvents(orgId);
      setMsg(`${res.alerts} alertes injectées dans le vrai pipeline → ${res.tickets.length} ticket(s) auto-créé(s)${res.tickets.length ? ' : ' + res.tickets.join(', ') : ''}`);
    } catch (e: any) {
      setErr(e?.message || 'Échec de l\'injection des événements de démo.');
    } finally { setBusy(null); }
  };

  return (
    <div className="bg-slate-900/50 border border-purple-800/40 rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Wand2 className="w-5 h-5 text-purple-400" />
        <h2 className="text-lg font-semibold text-white">Setup &amp; Démo rapide</h2>
      </div>
      <p className="text-sm text-slate-400">
        1️⃣ Créez un tenant client (admin + règles d'auto-ticketing), 2️⃣ injectez des alertes d'exemple
        dans le vrai backend — corrélation, notifications et tickets sont générés pour de vrai.
      </p>
      <div className="flex flex-wrap gap-3">
        <button onClick={seed} disabled={busy !== null}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium disabled:opacity-50">
          {busy === 'seed' && <Loader2 className="w-4 h-4 animate-spin" />} Seed demo tenant
        </button>
        <button onClick={demo} disabled={busy !== null}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium disabled:opacity-50">
          {busy === 'demo' && <Loader2 className="w-4 h-4 animate-spin" />} Push demo alerts
        </button>
        <Link to="/settings" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium">
          <SettingsIcon className="w-4 h-4" /> Settings complets
        </Link>
        <Link to="/client-admin/advanced-tickets" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium">
          <Inbox className="w-4 h-4" /> Advanced Ticketing
        </Link>
        <Link to="/client-admin/notifications" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium">
          <Radio className="w-4 h-4" /> Notification Engine
        </Link>
      </div>
      {msg && <p className="text-sm text-emerald-400 bg-emerald-950/40 border border-emerald-900/50 rounded-lg px-3 py-2">{msg}</p>}
      {err && <p className="text-sm text-rose-400 bg-rose-950/40 border border-rose-900/50 rounded-lg px-3 py-2">{err}</p>}
    </div>
  );
}

export default function PlatformDashboardPage() {
  const totalRevenue = demoOrganizations.reduce((sum, org) => sum + org.monthlyRevenue, 0);
  const activeClients = demoOrganizations.filter(org => org.status === 'active').length;
  const totalUsers = demoUsers.filter(u => u.role !== 'platform_admin').length;
  const totalServices = serviceCatalog.length;
  const blockedAttempts = demoAuditLog.filter(e => e.outcome === 'blocked').length;

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Platform Administration</h1>
        <p className="text-slate-500 text-sm mt-1">Infracentra platform overview — clients, revenue, and system health</p>
      </div>

      {/* Quick setup: seed tenant + demo alerts (real backend pipeline) */}
      <SetupPanel />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="w-4 h-4 text-cyan-400" />
            <span className="text-xs text-slate-500">Total Clients</span>
          </div>
          <p className="text-2xl font-bold text-white">{demoOrganizations.length}</p>
          <p className="text-xs text-cyber-green mt-1">{activeClients} active</p>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-green-400" />
            <span className="text-xs text-slate-500">MRR</span>
          </div>
          <p className="text-2xl font-bold text-white">${totalRevenue.toLocaleString()}</p>
          <p className="text-xs text-cyber-green mt-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> +12%
          </p>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-purple-400" />
            <span className="text-xs text-slate-500">Total Users</span>
          </div>
          <p className="text-2xl font-bold text-white">{totalUsers}</p>
          <p className="text-xs text-slate-500 mt-1">Across all orgs</p>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-cyan-400" />
            <span className="text-xs text-slate-500">Services</span>
          </div>
          <p className="text-2xl font-bold text-white">{totalServices}</p>
          <p className="text-xs text-slate-500 mt-1">Available</p>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-xs text-slate-500">Blocked</span>
          </div>
          <p className="text-2xl font-bold text-cyber-red">{blockedAttempts}</p>
          <p className="text-xs text-slate-500 mt-1">Access attempts</p>
        </div>
      </div>

      {/* Client Overview */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">Client Portfolio</h3>
        <div className="space-y-3">
          {demoOrganizations.map(org => (
            <div key={org.id} className="flex items-center justify-between p-4 rounded-xl bg-slate-800/30 border border-slate-700/30">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  org.tier === 'enterprise' ? 'bg-amber-500/10 text-amber-400' :
                  org.tier === 'mid-market' ? 'bg-purple-500/10 text-purple-400' :
                  'bg-blue-500/10 text-blue-400'
                }`}>
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-200">{org.name}</p>
                  <p className="text-xs text-slate-500">{org.tier.toUpperCase()} • {org.memberCount} members • {org.assetCount} assets</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm font-bold text-cyber-green">${org.monthlyRevenue.toLocaleString()}/mo</p>
                  <p className="text-xs text-slate-500">Risk: {org.riskScore} • Compliance: {org.complianceScore}%</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium uppercase ${
                  org.status === 'active' ? 'bg-green-500/10 text-green-400' :
                  org.status === 'suspended' ? 'bg-red-500/10 text-red-400' :
                  'bg-yellow-500/10 text-yellow-400'
                }`}>
                  {org.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Audit */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">Recent Activity</h3>
        <div className="space-y-2">
          {demoAuditLog.slice(0, 6).map(entry => (
            <div key={entry.id} className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/20">
              <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                entry.outcome === 'success' ? 'bg-cyber-green' :
                entry.outcome === 'blocked' ? 'bg-cyber-red' : 'bg-cyber-yellow'
              }`} />
              <div className="flex-1">
                <p className="text-sm text-slate-300">{entry.details}</p>
                <p className="text-xs text-slate-500 mt-1">{entry.actorName} • {new Date(entry.timestamp).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
