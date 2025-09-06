'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function CreateTripPage() {
  const [clientName, setClientName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentDestinationIndex, setCurrentDestinationIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const milesSrc = '/images/miles.png?v=4';

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
      // TODO: Create trip API call
      console.log('Creating trip for client:', clientName);

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // TODO: Redirect to trip detail page or trips list
      alert(`Trip created for ${clientName}!`);
    } catch (error) {
      console.error('Error creating trip:', error);
      alert('Failed to create trip. Please try again.');
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
        minHeight: 'calc(100vh - 3rem)',
        padding: '2rem 1rem',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          maxWidth: '600px',
          width: '100%',
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
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
          <h1 style={{ textAlign: 'left', marginBottom: '0.5rem' }}>
            Create New Trip
          </h1>
          <p style={{ fontSize: '1.1rem', opacity: 0.8, margin: 0 }}>
            Turn your client&apos;s journey into their story
          </p>
        </div>

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
              style={{
                width: '100px',
                height: '100px',
                backgroundColor: '#E0A526',
                borderRadius: '8px',
                position: 'relative',
                overflow: 'hidden',
                flexShrink: 0,
              }}
            >
              <Image
                src={milesSrc}
                alt="Miles AI Assistant"
                fill
                sizes="100px"
                style={{ objectFit: 'cover' }}
                priority
              />
            </div>
            <p
              style={{
                fontSize: '1rem',
                lineHeight: '1.4',
                opacity: 0.8,
                margin: 0,
              }}
            >
              Enter your client&apos;s name to get started. After creating the
              trip, <span className="sojourn-text">Miles</span> your
              well-travelled AI assistant will help you quickly build out the
              trip details & itinerary.
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
                  e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                  e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
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
                Will be displayed as: {clientName.trim() || 'Merriman Family'}
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
            className="btn btn-primary btn-auto"
            disabled={!clientName.trim() || isSubmitting}
            style={{
              opacity: !clientName.trim() || isSubmitting ? 0.5 : 1,
              cursor:
                !clientName.trim() || isSubmitting ? 'not-allowed' : 'pointer',
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
    </div>
  );
}
