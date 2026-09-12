import React, { useState, useEffect } from 'react';
import { getNotifications, sendTestSms } from '../services/api';

const SmsDrawer = ({ isOpen, onClose }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchNotifs = async () => {
    setLoading(true);
    try {
      const data = await getNotifications(50);
      if (data && data.notifications) {
        setNotifications(data.notifications);
      }
    } catch (e) {
      console.warn("Failed to fetch notifications", e);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      fetchNotifs();
    }
  }, [isOpen]);

  // Live real-time update whenever SMS is generated
  useEffect(() => {
    const handleSmsUpdate = (e) => {
      if (e && e.detail) {
        setNotifications(e.detail);
      } else {
        fetchNotifs();
      }
    };
    window.addEventListener("mandiq_sms_updated", handleSmsUpdate);
    return () => window.removeEventListener("mandiq_sms_updated", handleSmsUpdate);
  }, []);

  const handleTestDispatch = () => {
    sendTestSms("Ramesh Singh (Live)", "9876511001", "Wheat");
    fetchNotifs();
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          onClick={onClose}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 998
          }}
        />
      )}

      {/* Slide-out Drawer */}
      <div 
        style={{
          position: 'fixed', top: 0, right: isOpen ? 0 : '-460px',
          width: '420px', height: '100vh', backgroundColor: 'var(--bg-secondary)',
          borderLeft: '1px solid var(--border-subtle)', boxShadow: '-4px 0 24px rgba(0,0,0,0.4)',
          transition: 'right 0.3s cubic-bezier(0.4, 0, 0.2, 1)', zIndex: 999,
          display: 'flex', flexDirection: 'column', overflow: 'hidden'
        }}
      >
        {/* Drawer Header */}
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
              TRAI DLT Gateway Audit • Farmer 2G Deliveries
            </div>
          </div>
          <button 
            onClick={onClose} 
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '1.5rem', cursor: 'pointer', padding: '0 0.5rem' }}
          >
            ×
          </button>
        </div>

        {/* Carrier Status Badge */}
        <div style={{
          padding: '0.6rem 1rem',
          background: 'rgba(16, 185, 129, 0.08)',
          borderBottom: '1px solid rgba(16, 185, 129, 0.2)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.75rem',
          color: 'var(--accent-green)'
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-green)', display: 'inline-block' }}></span>
            Telecom Gateway Online
          </span>
          <span style={{ color: 'var(--text-muted)' }}>Avg Delivery: 1.1s</span>
        </div>

        {/* Action Controls */}
        <div style={{ padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-primary)' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              onClick={handleTestDispatch}
              className='action-btn'
              style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', background: 'var(--accent-blue)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              + Send Demo SMS
            </button>
            <button 
              onClick={fetchNotifs} 
              className='action-btn' 
              style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '4px', cursor: 'pointer' }}
            >
              🔄 Refresh
            </button>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {notifications.length} Messages
          </span>
        </div>

        {/* Notification List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {loading && <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Loading dispatches...</div>}
          
          {!loading && notifications.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)' }}>
              <div>No SMS dispatches yet.</div>
              <button onClick={handleTestDispatch} style={{ marginTop: '0.75rem', padding: '0.4rem 0.8rem', background: 'var(--accent-blue)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                Trigger First SMS
              </button>
            </div>
          )}

          {!loading && notifications.map((notif, idx) => (
            <div key={notif.id || idx} style={{ 
              background: 'var(--bg-card)', 
              border: '1px solid var(--border-subtle)', 
              borderRadius: 'var(--radius-md)', 
              padding: '0.85rem',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', alignItems: 'center' }}>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                  📲 {notif.phone_number} <span style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}>({notif.farmer_name})</span>
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {notif.created_at ? new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Just now'}
                </div>
              </div>
              
              <div style={{ 
                background: 'rgba(0,0,0,0.3)', 
                padding: '0.75rem', 
                borderRadius: 'var(--radius-sm)', 
                fontSize: '0.82rem', 
                color: '#e2e8f0', 
                lineHeight: '1.45', 
                borderLeft: '3px solid var(--accent-blue)',
                wordBreak: 'break-word'
              }}>
                {notif.message}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                  Route: PRI-DLT-BULK
                </span>
                <span style={{ 
                  fontSize: '0.7rem', 
                  padding: '0.15rem 0.5rem', 
                  background: notif.status === 'sent' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)', 
                  color: notif.status === 'sent' ? 'var(--accent-green)' : 'var(--accent-amber)', 
                  borderRadius: '10px', 
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem'
                }}>
                  {notif.status === 'sent' ? '✓ Delivered to Carrier' : '⌛ Queued in Gateway'}
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

