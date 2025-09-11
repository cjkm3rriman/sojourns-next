'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';

interface Trip {
  id: string;
  clientName: string;
  destination?: string;
  tripSummary?: string;
  icon?: string;
  status: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
  shareToken?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface Document {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  status: string;
  createdAt: string;
}

export default function TripDetailPage() {
  const params = useParams();
  const tripId = params.id as string;
  const [trip, setTrip] = useState<Trip | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const milesSrc = '/images/miles.png?v=7';

  useEffect(() => {
    async function fetchTrip() {
      try {
        const response = await fetch(`/api/trips/${tripId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch trip');
        }
        const data = await response.json();
        setTrip(data.trip);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    async function fetchDocuments() {
      try {
        const response = await fetch(`/api/trips/${tripId}/documents`);
        if (response.ok) {
          const data = await response.json();
          setDocuments(data.documents || []);
        }
      } catch (err) {
        console.error('Error fetching documents:', err);
      } finally {
        setDocumentsLoading(false);
      }
    }

    if (tripId) {
      fetchTrip();
      fetchDocuments();
    }
  }, [tripId]);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        Loading...
      </div>
    );
  }

  if (error || !trip) {
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
              Trip Not Found
            </h1>
          </div>
          <p>
            The trip you&apos;re looking for doesn&apos;t exist or you
            don&apos;t have permission to view it.
          </p>
        </main>
      </div>
    );
  }

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
          <h1
            style={{
              textAlign: 'left',
              marginBottom: '0',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            {trip.icon && (
              <span style={{ fontSize: '1.2em' }}>{trip.icon}</span>
            )}
            {trip.clientName}&apos;s Trip
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
            <div
              className="dashboard-card"
              style={{ padding: '2rem', marginBottom: '1.5rem' }}
            >
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
                  Upload any itineraries or confirmations and I&apos;ll build
                  out the trip for you.
                </p>
              </div>

              {/* Documents List */}
              {documentsLoading ? (
                <div
                  style={{
                    marginBottom: '2rem',
                    fontSize: '0.9rem',
                    opacity: 0.7,
                  }}
                >
                  Loading documents...
                </div>
              ) : documents.length > 0 ? (
                <div style={{ marginBottom: '2rem' }}>
                  <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>
                    Uploaded Documents
                  </h3>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                    }}
                  >
                    {documents.map((doc) => (
                      <div
                        key={doc.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.5rem 0.75rem',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '6px',
                          backgroundColor: 'rgba(255, 255, 255, 0.02)',
                          fontSize: '0.85rem',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                          }}
                        >
                          <span>{doc.originalName}</span>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              padding: '0.125rem 0.375rem',
                              borderRadius: '4px',
                              backgroundColor:
                                doc.status === 'uploaded'
                                  ? 'rgba(255, 255, 255, 0.1)'
                                  : doc.status === 'processing'
                                    ? 'rgba(255, 165, 0, 0.2)'
                                    : doc.status === 'processed'
                                      ? 'rgba(0, 255, 0, 0.2)'
                                      : 'rgba(255, 0, 0, 0.2)',
                              textTransform: 'capitalize',
                            }}
                          >
                            {doc.status}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                          {new Date(doc.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div style={{ marginBottom: '2rem' }}>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  style={{ display: 'none' }}
                  id="file-upload"
                  onChange={async (e) => {
                    const files = e.target.files;
                    if (!files || files.length === 0) return;

                    setUploading(true);
                    try {
                      const formData = new FormData();

                      // Add all selected files to form data
                      for (let i = 0; i < files.length; i++) {
                        formData.append('files', files[i]);
                      }

                      const response = await fetch(
                        `/api/trips/${tripId}/documents`,
                        {
                          method: 'POST',
                          body: formData,
                        },
                      );

                      if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || 'Upload failed');
                      }

                      const data = await response.json();
                      console.log('Upload successful:', data);

                      // Reset file input
                      e.target.value = '';

                      // Refresh documents list
                      setDocuments((prev) => [...prev, ...data.documents]);

                      // Show success message
                      alert(
                        `Successfully uploaded ${data.documents.length} file(s)!`,
                      );
                    } catch (error) {
                      console.error('Upload error:', error);
                      alert(
                        error instanceof Error
                          ? error.message
                          : 'Upload failed',
                      );
                    } finally {
                      setUploading(false);
                    }
                  }}
                />
                <label htmlFor="file-upload">
                  <button
                    className="btn btn-secondary btn-auto"
                    type="button"
                    disabled={uploading}
                    onClick={() =>
                      document.getElementById('file-upload')?.click()
                    }
                  >
                    {uploading ? 'Uploading...' : 'Upload Documents'}
                  </button>
                </label>
              </div>

              <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>
                Trip Details
              </h2>

              <div style={{ marginBottom: '1rem' }}>
                <strong>Client:</strong> {trip.clientName}
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <strong>Status:</strong>{' '}
                <span
                  style={{
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    fontSize: '0.85rem',
                    textTransform: 'capitalize',
                  }}
                >
                  {trip.status}
                </span>
              </div>

              {trip.destination && (
                <div style={{ marginBottom: '1rem' }}>
                  <strong>Destination:</strong> {trip.destination}
                </div>
              )}

              {trip.icon && (
                <div style={{ marginBottom: '1rem' }}>
                  <strong>Trip Type:</strong> {trip.icon}
                </div>
              )}

              {trip.tripSummary && (
                <div style={{ marginBottom: '1rem' }}>
                  <strong>Summary:</strong> {trip.tripSummary}
                </div>
              )}

              {trip.startDate && (
                <div style={{ marginBottom: '1rem' }}>
                  <strong>Start Date:</strong>{' '}
                  {new Date(trip.startDate).toLocaleDateString()}
                </div>
              )}

              {trip.endDate && (
                <div style={{ marginBottom: '1rem' }}>
                  <strong>End Date:</strong>{' '}
                  {new Date(trip.endDate).toLocaleDateString()}
                </div>
              )}

              {trip.notes && (
                <div style={{ marginBottom: '1rem' }}>
                  <strong>Notes:</strong> {trip.notes}
                </div>
              )}

              <div
                style={{
                  fontSize: '0.85rem',
                  opacity: 0.7,
                  marginTop: '1.5rem',
                }}
              >
                Created: {new Date(trip.createdAt).toLocaleString()}
                <br />
                Last updated: {new Date(trip.updatedAt).toLocaleString()}
                <br />
                Version: {trip.version}
              </div>
            </div>
          </div>

          <div></div>
        </div>
      </main>
    </div>
  );
}
