'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ChevronDown, Compass, Users } from 'react-feather';

const pages = [
  { label: 'Trips', href: '/trips', icon: Compass },
  { label: 'Clients', href: '/clients', icon: Users },
];

export default function PageSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = pages.find((p) => pathname.startsWith(p.href)) ?? pages[0];

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative', marginRight: '1.5rem' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="btn btn-golden btn-menu input-rounded"
        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap' }}
      >
        <current.icon size={15} />
        {current.label}
        <ChevronDown
          size={14}
          style={{
            transition: 'transform 0.2s',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 0.4rem)',
            left: 0,
            backgroundColor: 'rgba(20, 20, 20, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '12px',
            padding: '0.4rem',
            minWidth: '140px',
            zIndex: 1000,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
          }}
        >
          {pages.map((page) => (
            <button
              key={page.href}
              onClick={() => {
                router.push(page.href);
                setOpen(false);
              }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '0.55rem 0.85rem',
                background:
                  page.href === current.href
                    ? 'rgba(255, 255, 255, 0.08)'
                    : 'transparent',
                border: 'none',
                borderRadius: '8px',
                color: 'inherit',
                fontSize: '0.9rem',
                fontWeight: page.href === current.href ? 600 : 400,
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => {
                if (page.href !== current.href)
                  e.currentTarget.style.background =
                    'rgba(255, 255, 255, 0.05)';
              }}
              onMouseLeave={(e) => {
                if (page.href !== current.href)
                  e.currentTarget.style.background = 'transparent';
              }}
            >
              <page.icon size={14} style={{ marginRight: '0.5rem', verticalAlign: 'middle', opacity: 0.8 }} />
              {page.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
