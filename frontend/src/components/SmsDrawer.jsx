import React, { useState, useEffect } from 'react';
import { getNotifications } from '../services/api';

const SmsDrawer = ({ isOpen, onClose }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchNotifs();
    }
  }, [isOpen]);

  const fetchNotifs = async () => {
    setLoading(true);
    const data = await getNotifications(50);
    if (data && data.notifications) {
      setNotifications(data.notifications);
    }
    setLoading(false);
  };

  return (
    <>
      {isOpen && (
        <div 
          onClick={onClose}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 998
          }}
        />
      )}

      <div 
        style={{
          position: 'fixed', top: 0, right: isOpen ? 0 : '-450px',
          width: '400px', height: '100vh', backgroundColor: 'var(--bg-secondary)',
          borderLeft: '1px solid var(--border-subtle)', boxShadow: '-4px 0 24px rgba(0,0,0,0.4)',
          transition: 'right 0.3s cubic-bezier(0.4, 0, 0.2, 1)', zIndex: 999,
          display: 'flex', flexDirection: 'column', overflow: 'hidden'
        }}
      >
        <div style={{
          padding: '1.25rem', borderBottom: '1px solid var(--border-subtle)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          backgroundColor: 'rgba(255,255,255,0.02)'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              📩 Live SMS Dispatch Log
            </h3>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Telecom Gateway Delivery Audit
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={fetchNotifs} className='action-btn served' style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem' }}>🔄 Refresh</button>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Showing last {notifications.length} SMS</span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 1.25rem 1.25rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {loading && <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Loading dispatches...</div>}
          {!loading && notifications.length === 0 && <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)', background: 'var(--bg-card)' }}>No SMS notifications found.</div>}
          {!loading && notifications.map((notif, idx) => (
            <div key={notif.id || idx} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', alignItems: 'center' }}>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>To: {notif.phone_number} <span style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}>({notif.farmer_name})</span></div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{notif.created_at ? new Date(notif.created_at).toLocaleTimeString() : 'Just now'}</div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', color: '#e2e8f0', lineHeight: '1.4', borderLeft: '3px solid var(--accent-blue)' }}>{notif.message}</div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', background: notif.status === 'sent' ? 'var(--accent-green-glow)' : 'var(--accent-amber-glow)', color: notif.status === 'sent' ? 'var(--accent-green)' : 'var(--accent-amber)', borderRadius: '10px', fontWeight: 500 }}>
                  {notif.status === 'sent' ? '✓ Delivered to Carrier' : '⌛ Queued'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};
export default SmsDrawer;

