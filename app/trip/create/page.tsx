'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

export default function CreateTripPage() {
  const router = useRouter();
  const [clientName, setClientName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentDestinationIndex, setCurrentDestinationIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const milesSrc = '/images/miles.png?v=7';

  const destinations = [
    'Rome',
    'Africa',
    'Turks & Caicos',
    'London',
    'Asia',
    'Four Seasons Nevis',
    'Aspen',
    'Paris',
    'Jumby Bay',
    'Sri Lanka',
    'Mexico City',
    'Galapagos',
  ];

  // Rotate through destinations with fade transition
  useEffect(() => {
    const interval = setInterval(() => {
      setIsTransitioning(true);

      setTimeout(() => {
        setCurrentDestinationIndex((prev) => (prev + 1) % destinations.length);

        setTimeout(() => {
          setIsTransitioning(false);
        }, 50); // Small delay so new word fades in after old word is gone
      }, 600); // Wait for full fade out before changing text
    }, 2200); // Quicker cycle through destinations

    return () => clearInterval(interval);
  }, [destinations.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!clientName.trim()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/trips', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientName: clientName.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create trip');
      }

      const data = await response.json();
      console.log('Trip created successfully:', data.trip);

      // Redirect to the newly created trip
      router.push(`/trip/${data.trip.id}`);
    } catch (error) {
      console.error('Error creating trip:', error);
      alert(
        error instanceof Error
          ? error.message
          : 'Failed to create trip. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        width: '100%',
        height: '100vh',
        boxSizing: 'border-box',
      }}
    >
      <main
        style={{
          display: 'flex',
          flexDirection: 'column',
          padding: '3rem 2rem 2rem 2rem',
          height: '100vh',
          maxWidth: '1200px',
          width: '100%',
          boxSizing: 'border-box',
          overflow: 'auto',
        }}
      >
        <div style={{ marginBottom: '1.5rem' }}>
          <Link
            href="/trips"
            style={{
              color: 'rgba(255, 255, 255, 0.7)',
              textDecoration: 'none',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1rem',
            }}
          >
            ← Back to Trips
          </Link>
          <h1 style={{ textAlign: 'left', marginBottom: '0' }}>
            Create New Trip
          </h1>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(300px, 500px) 1fr',
            gap: '1.5rem',
            flex: 1,
          }}
        >
          <div>
            {/* Form Card */}
            <div className="dashboard-card" style={{ padding: '2rem' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1.5rem',
                  marginBottom: '2rem',
                  flexWrap: 'nowrap',
                }}
              >
                <div
                  className="avatar-glow"
                  style={{
                    width: '72px',
                    height: '72px',
                    backgroundColor: '#2a2a2a',
                    borderRadius: '50%',
                    border: '1px solid rgba(0, 0, 0, 0.6)',
                    position: 'relative',
                    overflow: 'visible',
                    flexShrink: 0,
                  }}
                >
                  <Image
                    src={milesSrc}
                    alt="Miles AI Assistant"
                    fill
                    sizes="72px"
                    style={{
                      objectFit: 'cover',
                      zIndex: 2,
                      borderRadius: '50%',
                    }}
                    priority
                  />
                  {/* Inner highlight ring */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: '1px',
                      borderRadius: '50%',
                      border: '1px solid rgba(255, 255, 255, 0.04)',
                      pointerEvents: 'none',
                      zIndex: 3,
                    }}
                  />
                </div>
                <p
                  style={{
                    lineHeight: '1.4',
                    opacity: 0.8,
                    margin: 0,
                  }}
                >
                  Enter your client name, and create the trip trip. Next{' '}
                  <span className="sojourn-text">Miles</span> our well-travelled
                  AI assistant will help you quickly build out the trip
                  itinerary.
                </p>
              </div>

              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: '2rem' }}>
                  <label
                    htmlFor="clientName"
                    style={{
                      display: 'block',
                      fontSize: '0.9rem',
                      fontWeight: '500',
                      marginBottom: '0.75rem',
                      color: 'rgba(255, 255, 255, 0.9)',
                    }}
                  >
                    Client Name
                  </label>
                  <input
                    id="clientName"
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="e.g. Merriman Family"
                    required
                    style={{
                      width: '100%',
                      padding: '0.875rem 1rem',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      color: 'white',
                      fontSize: '1rem',
                      boxSizing: 'border-box',
                      transition: 'all 0.2s ease',
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = 'rgba(255, 255, 255, 0.4)';
                      e.target.style.backgroundColor =
                        'rgba(255, 255, 255, 0.08)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                      e.target.style.backgroundColor =
                        'rgba(255, 255, 255, 0.05)';
                    }}
                  />

                  <div
                    style={{
                      marginTop: '0.75rem',
                      marginLeft: '0.5rem',
                      textAlign: 'left',
                      fontSize: '0.8rem',
                      color: 'rgba(255, 255, 255, 0.6)',
                    }}
                  >
                    e.g. {clientName.trim() || 'Merriman Family'}
                    &apos;s Trip to{' '}
                    <span
                      style={{
                        transition: 'opacity 2s ease-in-out',
                        display: 'inline-block',
                        minWidth: '80px',
                        opacity: isTransitioning ? 0 : 1,
                      }}
                    >
                      {destinations[currentDestinationIndex]}
                    </span>
                  </div>
                </div>
              </form>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                marginTop: '1.5rem',
              }}
            >
              <button
                onClick={handleSubmit}
                className="btn btn-golden btn-auto"
                disabled={!clientName.trim() || isSubmitting}
                style={{
                  opacity: !clientName.trim() || isSubmitting ? 0.5 : 1,
                  cursor:
                    !clientName.trim() || isSubmitting
                      ? 'not-allowed'
                      : 'pointer',
                }}
              >
                {isSubmitting ? (
                  <>
                    <span style={{ opacity: 0.7 }}>Creating...</span>
                  </>
                ) : (
                  <>Create Trip →</>
                )}
              </button>
            </div>
          </div>

          <div></div>
        </div>
      </main>
    </div>
  );
}
