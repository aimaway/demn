// ---------------------------------------------------------------------------
// Platform Admin — Partner Program (MSP) management page.
// Lives ONLY in the platform-admin navigation: client admins never see it.
// Shows partners, licensing (seats/devices/plans), white-label status
// (brand, custom domain, CNAME verification) and each partner's end-clients.
// Data comes from /partners via partnersApi → demoStore in Demo Mode, real
// backend when deployed. Same shapes either way.
// ---------------------------------------------------------------------------
import React, { useEffect, useState } from 'react';
import { Users2, Building, Server, Percent, Palette, Globe, CheckCircle2, Clock, XCircle, Loader2, RefreshCw, GraduationCap, Headphones } from 'lucide-react';
import { partnersApi, type PartnerProgramStats } from '../../services/partnersApi';
import type { Partner } from '../../data/partnerWorld';

const fmtEur = (n: number) => `${n.toLocaleString('fr-FR')} €`;

const dnsBadge = (s: string) =>
  s === 'verified'
    ? <span className="inline-flex items-center gap-1 text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" /> Vérifié</span>
    : s === 'pending_verification'
      ? <span className="inline-flex items-center gap-1 text-amber-400"><Clock className="w-3.5 h-3.5" /> En attente DNS</span>
      : <span className="inline-flex items-center gap-1 text-slate-500"><XCircle className="w-3.5 h-3.5" /> Non configuré</span>;

const statusBadge: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  trial: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  prospect: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
  suspended: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
};

export default function PlatformPartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [stats, setStats] = useState<PartnerProgramStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const [ps, st] = await Promise.all([partnersApi.list(), partnersApi.stats()]);
      setPartners(ps); setStats(st);
    } catch (e: any) {
      setError(e?.message ?? 'Impossible de charger le programme partenaires.');
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  if (loading) return <div className="flex items-center gap-3 text-slate-400 p-8"><Loader2 className="w-5 h-5 animate-spin" /> Chargement du programme partenaires…</div>;
  if (error) return <div className="p-8"><div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl p-4 flex items-center justify-between">{error}<button onClick={load} className="inline-flex items-center gap-1 text-sm border border-rose-500/40 rounded-lg px-3 py-1 hover:bg-rose-500/20"><RefreshCw className="w-3.5 h-3.5" /> Réessayer</button></div></div>;

  const kpis = stats ? [
    { icon: Users2, label: 'Partenaires', value: `${stats.partners_active} actifs · ${stats.trials} essai`, color: 'text-purple-400' },
    { icon: Building, label: 'Clients finaux gérés', value: String(stats.end_clients), color: 'text-cyan-400' },
    { icon: Server, label: 'Devices supervisés (canal)', value: stats.devices_managed.toLocaleString('fr-FR'), color: 'text-blue-400' },
    { icon: Percent, label: 'Marge canal', value: `${stats.channel_margin_pct} %`, color: 'text-emerald-400' },
    { icon: Palette, label: 'White-labels actifs', value: `${stats.white_labels_live} / ${stats.partners_total}`, color: 'text-amber-400' },
    { icon: Globe, label: 'Domaines en attente DNS', value: String(stats.dns_pending), color: stats.dns_pending ? 'text-rose-400' : 'text-emerald-400' },
  ] : [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Users2 className="w-6 h-6 text-purple-400" /> Programme Partenaires (MSP)</h1>
          <p className="text-slate-400 text-sm mt-1">Les partenaires revendent la plateforme sous leur propre marque. Infracentra assure la maintenance et la formation de leurs équipes.</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-300 hover:border-purple-500"><RefreshCw className="w-4 h-4" /> Actualiser</button>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpis.map(k => (
          <div key={k.label} className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <k.icon className={`w-5 h-5 ${k.color}`} />
            <div className="text-lg font-bold text-white mt-2">{k.value}</div>
            <div className="text-xs text-slate-400">{k.label}</div>
          </div>
        ))}
      </div>

      {stats && (
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 text-sm text-slate-300 flex flex-wrap gap-x-8 gap-y-1">
          <span>Revenu wholesale (Infracentra) : <b className="text-white">{fmtEur(stats.wholesale_mrr_eur)} /mois</b></span>
          <span>Revenu retail canal : <b className="text-white">{fmtEur(stats.retail_mrr_eur)} /mois</b></span>
          <span className="text-slate-500">Le partenaire facture ses clients finaux ; Infracentra ne facture que les licences partenaires.</span>
        </div>
      )}

      {/* Partner cards */}
      <div className="space-y-3">
        {partners.map(p => {
          const lic = p.license;
          const seatsPct = Math.round((lic.client_seats_used / lic.client_seats) * 100);
          const devPct = Math.round((lic.devices_used / lic.device_allowance) * 100);
          const open = openId === p.id;
          return (
            <div key={p.id} className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
              <button onClick={() => setOpenId(open ? null : p.id)} className="w-full text-left p-4 flex flex-wrap items-center gap-x-6 gap-y-2 hover:bg-slate-800/40">
                <span className="font-semibold text-white">{p.company}</span>
                <span className="text-xs text-slate-500">{p.code} · {p.country} · {p.tier}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${statusBadge[p.status]}`}>{p.status}</span>
                <span className="ml-auto inline-flex items-center gap-1 text-xs" style={{ color: p.branding.primary_color }}>
                  <Palette className="w-3.5 h-3.5" /> {p.branding.brand_name} {dnsBadge(p.branding.dns_status)}
                </span>
                <span className="text-xs text-slate-400 w-40 text-right">{lic.plan} · {fmtEur(lic.price_month_eur)}/mois</span>
                <span className="text-xs text-slate-500">{open ? '▲' : '▼'}</span>
              </button>

              {open && (
                <div className="border-t border-slate-800 p-4 grid lg:grid-cols-3 gap-4">
                  {/* Licensing */}
                  <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-4 space-y-3">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Server className="w-4 h-4 text-cyan-400" /> Licence & quotas</h3>
                    {[['Sièges clients', lic.client_seats_used, lic.client_seats, seatsPct], ['Devices supervisés', lic.devices_used, lic.device_allowance, devPct]].map(([label, used, max, pct]: any) => (
                      <div key={label}>
                        <div className="flex justify-between text-xs text-slate-400"><span>{label}</span><span>{used} / {max}</span></div>
                        <div className="h-2 bg-slate-800 rounded-full mt-1"><div className={`h-2 rounded-full ${pct > 85 ? 'bg-rose-500' : pct > 65 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(pct, 100)}%` }} /></div>
                      </div>
                    ))}
                    <div className="text-xs text-slate-400">Ticketing avancé : {lic.ticketing ? <span className="text-emerald-400">inclus</span> : <span className="text-slate-500">non inclus</span>}</div>
                    <div className="text-xs text-slate-400">Services concédés : {lic.services_included.includes('all') ? 'les 16 services' : `${lic.services_included.length} services`}</div>
                    <div className="text-xs text-slate-400">Renouvellement : <span className="text-white">{lic.renews_on}</span> · Marge partenaire : <span className="text-emerald-400">{lic.margin_pct} %</span></div>
                  </div>

                  {/* White-label */}
                  <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-4 space-y-2">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Globe className="w-4 h-4 text-purple-400" /> Marque blanche</h3>
                    <dl className="text-xs space-y-1.5">
                      <div className="flex justify-between"><dt className="text-slate-500">Nom de marque</dt><dd className="text-white font-medium" style={{ color: p.branding.primary_color }}>{p.branding.brand_name}</dd></div>
                      <div className="flex justify-between"><dt className="text-slate-500">Domaine client</dt><dd className="text-white font-mono">{p.branding.custom_domain || '—'}</dd></div>
                      <div className="flex justify-between"><dt className="text-slate-500">Enregistrement CNAME</dt><dd className="text-white font-mono">{p.branding.cname_target}</dd></div>
                      <div className="flex justify-between"><dt className="text-slate-500">Expéditeur e-mails</dt><dd className="text-white font-mono">{p.branding.email_sender || '—'}</dd></div>
                      <div className="flex justify-between"><dt className="text-slate-500">Masquage Infracentra</dt><dd>{p.branding.hide_infracentra ? <span className="text-emerald-400">activé (white-label total)</span> : <span className="text-amber-400">partiel</span>}</dd></div>
                      <div className="flex justify-between"><dt className="text-slate-500">Statut DNS</dt><dd>{dnsBadge(p.branding.dns_status)}</dd></div>
                    </dl>
                    <p className="text-[11px] text-slate-500 leading-relaxed">Le partenaire crée un CNAME <span className="font-mono text-slate-400">{p.branding.custom_domain.split('.')[0]} → {p.branding.cname_target}</span> dans sa zone DNS ; nos certificats TLS sont émis automatiquement après vérification.</p>
                  </div>

                  {/* Support + training + end clients */}
                  <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-4 space-y-2">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Headphones className="w-4 h-4 text-emerald-400" /> Notre engagement</h3>
                    <div className="text-xs text-slate-300">{p.support_sla}</div>
                    <div className="text-xs text-slate-400 flex items-center gap-1 pt-1"><GraduationCap className="w-3.5 h-3.5 text-cyan-400" /> Formations :</div>
                    <ul className="text-xs space-y-0.5">
                      {p.training.completed.map(t => <li key={t} className="text-emerald-400">✓ {t}</li>)}
                      {p.training.pending.map(t => <li key={t} className="text-slate-500">○ {t}</li>)}
                    </ul>
                    <div className="pt-2 text-xs text-slate-500">Contact : {p.contact_name} · <span className="font-mono">{p.contact_email}</span></div>
                  </div>

                  {/* End clients table full width */}
                  <div className="lg:col-span-3">
                    <h3 className="text-sm font-semibold text-white mb-2">Clients finaux du partenaire ({p.end_clients.length})</h3>
                    <div className="overflow-x-auto border border-slate-800 rounded-lg">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-900 text-slate-400">
                          <tr>{['Client', 'Ville', 'Secteur', 'Devices', 'Utilisateurs', 'Plan vendu', 'ARR estimé', 'Statut'].map(h => <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>)}</tr>
                        </thead>
                        <tbody>
                          {p.end_clients.map(c => (
                            <tr key={c.id} className="border-t border-slate-800/70 hover:bg-slate-800/30">
                              <td className="px-3 py-2 text-white">{c.name}</td>
                              <td className="px-3 py-2 text-slate-400">{c.city}</td>
                              <td className="px-3 py-2 text-slate-400">{c.industry}</td>
                              <td className="px-3 py-2 text-slate-300">{c.devices}</td>
                              <td className="px-3 py-2 text-slate-300">{c.users}</td>
                              <td className="px-3 py-2 text-slate-300">{c.plan}</td>
                              <td className="px-3 py-2 text-emerald-400">{fmtEur(c.monthly_mrr_eur * 12)}</td>
                              <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full border text-[11px] ${statusBadge[c.status === 'active' ? 'active' : c.status === 'onboarding' ? 'trial' : 'suspended']}`}>{c.status}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
