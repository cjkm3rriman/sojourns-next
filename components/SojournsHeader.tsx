export default function SojournsHeader() {
  return (
    <header
      style={{
        position: 'fixed',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%) translateZ(0)',
        WebkitTransform: 'translateX(-50%) translateZ(0)',
        zIndex: 1000,
        display: 'inline-block',
        borderRadius: '40px',
        overflow: 'hidden',
      }}
    >
      {/* Light blur layer - covers full header */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          pointerEvents: 'none',
        }}
      />
      {/* Medium blur layer - fades from top to middle */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backdropFilter: 'blur(15px)',
          WebkitBackdropFilter: 'blur(15px)',
          mask: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.7) 40%, rgba(0,0,0,0) 70%)',
          WebkitMask:
            'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.7) 40%, rgba(0,0,0,0) 70%)',
          pointerEvents: 'none',
        }}
      />
      {/* Heavy blur layer - strongest at top */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backdropFilter: 'blur(25px)',
          WebkitBackdropFilter: 'blur(25px)',
          mask: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.5) 25%, rgba(0,0,0,0) 50%)',
          WebkitMask:
            'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.5) 25%, rgba(0,0,0,0) 50%)',
          pointerEvents: 'none',
        }}
      />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <h1
          style={{
            fontFamily: 'var(--font-sojourns), serif',
            fontWeight: 400,
            fontSize: '1.8rem',
            margin: 0,
            padding: '0.8rem 0.8rem 0.5rem 0.8rem',
            display: 'block',
            textTransform: 'uppercase',
            textShadow: [
              '0 2px 4px rgba(0, 0, 0, 0.3)',
              '0 0 10px rgba(255, 255, 255, 0.037)',
              '0 0 20px rgba(255, 255, 255, 0.025)',
              '0 0 30px rgba(255, 255, 255, 0.012)',
            ].join(', '),
          }}
        >
          Sojourns
        </h1>
      </div>
    </header>
  );
}
