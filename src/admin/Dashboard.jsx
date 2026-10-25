import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { useFeedback } from '../lib/feedback';
import { supabase } from '../lib/supabase';
import { listAssessments, fail } from '../lib/data';
import { greeting, todayLong, firstName } from '../lib/format';
import { Icon } from '../components/Icon';
import { TrendChart } from '../components/TrendChart';

export function Dashboard({ go }) {
  const { profile } = useAuth();
  const { toast } = useFeedback();
  const [d, setD] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [users, list, scores, recent] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'USER'),
          listAssessments(),
          supabase.from('scores').select('id', { count: 'exact', head: true }),
          supabase.from('profiles').select('name,email,role').order('created_at', { ascending: false }).limit(5),
        ]);
        if (users.error) fail(users.error);
        if (scores.error) fail(scores.error);
        if (recent.error) fail(recent.error);
        setD({
          totalUsers: users.count || 0, totalAssess: list.length, totalPublished: list.filter((a) => a.published).length,
          totalScores: scores.count || 0, recentUsers: recent.data, recentAssess: list.slice(0, 5),
          trend: [...list].reverse().filter((a) => a.avg_score != null).slice(-12).map((a) => ({ label: a.name, a: a.avg_score })),
        });
      } catch (e) {
        toast(e.message, 'error');
      }
    })();
  }, [toast]);

  const stat = (icon, num, label) => (
    <div className="card stat-card"><div className="stat-ico"><Icon name={icon} /></div><div className="num">{num}</div><div className="label">{label}</div></div>
  );
  const empty = (n) => <tr><td colSpan={n} style={{ color: 'var(--text-muted)' }}>Belum ada data</td></tr>;

  return (
    <div>
      <div className="hero">
        <div>
          <div className="hero-date">{todayLong()}</div>
          <h2>{greeting()}{firstName(profile.name) ? `, ${firstName(profile.name)}` : ''}</h2>
          <p>Ringkasan data nilai, peserta, dan ujian yang sudah terbit.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => go('scores', 'upload')}><Icon name="upload" /> Unggah nilai</button>
          <button className="btn secondary" onClick={() => go('analysis')}><Icon name="chart" /> Buka analisis</button>
        </div>
      </div>
      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        {stat('users', d?.totalUsers ?? 0, 'Total user')}
        {stat('file', d?.totalAssess ?? 0, 'Total ujian')}
        {stat('check', d?.totalPublished ?? 0, 'Sudah terbit')}
        {stat('chart', d?.totalScores ?? 0, 'Data nilai')}
      </div>
      {d?.trend.length ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <h4>Rata-rata nilai per ujian</h4>
          <TrendChart points={d.trend} aName="Rata-rata peserta" />
        </div>
      ) : null}
      <div className="grid cols-2">
        <div className="card">
          <h4>User terbaru</h4>
          <div className="table-wrap"><table>
            <thead><tr><th>Nama</th><th>Email</th><th>Role</th></tr></thead>
            <tbody>
              {d?.recentUsers.map((u) => <tr key={u.email}><td>{u.name}</td><td>{u.email}</td><td><span className={`badge ${u.role}`}>{u.role}</span></td></tr>)}
              {d && !d.recentUsers.length ? empty(3) : null}
            </tbody>
          </table></div>
        </div>
        <div className="card">
          <h4>Ujian terbaru</h4>
          <div className="table-wrap"><table>
            <thead><tr><th>Ujian</th><th>Status</th><th>Peserta</th></tr></thead>
            <tbody>
              {d?.recentAssess.map((a) => <tr key={a.id}><td>{a.name}</td><td>{a.published ? 'Terbit' : 'Draf'}</td><td>{a.participants}</td></tr>)}
              {d && !d.recentAssess.length ? empty(3) : null}
            </tbody>
          </table></div>
        </div>
      </div>
    </div>
  );
}
