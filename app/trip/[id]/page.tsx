'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import {
  Navigation,
  MapPin,
  Clock,
  Phone,
  Hash,
  Users,
  User,
  Calendar,
  DollarSign,
  Home,
  Navigation2,
  Coffee,
  Zap,
  ArrowUpCircle,
  ArrowDownCircle,
  FileText,
  Award,
  X,
} from 'react-feather';

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

interface TripItem {
  id: string;
  type: string;
  title: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  originLocationSpecific?: string;
  destinationLocationSpecific?: string;
  cost?: string;
  status: string;
  sortOrder: number;
  createdAt: string;
  placeName?: string;
  placeType?: string;
  placeAddress?: string;
  originPlaceName?: string;
  originPlaceShortName?: string;
  originPlaceAddress?: string;
  originPlaceCity?: string;
  destinationPlaceName?: string;
  destinationPlaceShortName?: string;
  destinationPlaceAddress?: string;
  destinationPlaceCity?: string;
  phoneNumber?: string;
  confirmationNumber?: string;
  notes?: string;
  data?: string;
}

export default function TripDetailPage() {
  const params = useParams();
  const tripId = params.id as string;
  const [trip, setTrip] = useState<Trip | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [items, setItems] = useState<TripItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [togglingIgnore, setTogglingIgnore] = useState<string | null>(null);
  const [viewingPdf, setViewingPdf] = useState<Document | null>(null);
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

    async function fetchItems() {
      try {
        const response = await fetch(`/api/trips/${tripId}/items`);
        if (response.ok) {
          const data = await response.json();
          setItems(data.items || []);
        }
      } catch (err) {
        console.error('Error fetching items:', err);
      } finally {
        setItemsLoading(false);
      }
    }

    if (tripId) {
      fetchTrip();
      fetchDocuments();
      fetchItems();
    }
  }, [tripId]);

  const toggleIgnoreDocument = async (
    docId: string,
    currentlyIgnored: boolean,
  ) => {
    setTogglingIgnore(docId);
    try {
      const response = await fetch(
        `/api/trips/${tripId}/documents/${docId}/ignore`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ignored: !currentlyIgnored }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update document');
      }

      const data = await response.json();

      // Update the documents state
      setDocuments((prev) =>
        prev.map((doc) =>
          doc.id === docId ? { ...doc, status: data.document.status } : doc,
        ),
      );
    } catch (error) {
      console.error('Error toggling ignore status:', error);
      alert(
        error instanceof Error
          ? `Failed to ${currentlyIgnored ? 'unignore' : 'ignore'} document: ${error.message}`
          : 'Failed to update document',
      );
    } finally {
      setTogglingIgnore(null);
    }
  };

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
          maxWidth: '1200px',
          width: '100%',
          boxSizing: 'border-box',
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
            gridTemplateColumns: '1fr 500px',
            gap: '1.5rem',
            flex: 1,
          }}
        >
          <div>
            {viewingPdf ? (
              // PDF Viewer
              <div
                className="dashboard-card"
                style={{ padding: '1rem', height: 'calc(100vh - 140px)' }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '1rem',
                    paddingBottom: '0.5rem',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: '1rem' }}>
                    {viewingPdf.originalName}
                  </h3>
                  <button
                    onClick={() => setViewingPdf(null)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'rgba(255, 255, 255, 0.7)',
                      cursor: 'pointer',
                      padding: '0.25rem',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <X size={20} />
                  </button>
                </div>
                <iframe
                  src={`/api/trips/${tripId}/documents/${viewingPdf.id}/view`}
                  style={{
                    width: '100%',
                    height: 'calc(100% - 60px)',
                    border: 'none',
                    borderRadius: '4px',
                  }}
                  title={viewingPdf.originalName}
                />
              </div>
            ) : (
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
                            backgroundColor:
                              doc.status === 'ignored'
                                ? 'rgba(128, 128, 128, 0.05)'
                                : 'rgba(255, 255, 255, 0.02)',
                            fontSize: '0.85rem',
                            opacity: doc.status === 'ignored' ? 0.7 : 1,
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              flex: 1,
                            }}
                          >
                            <span
                              style={{
                                textDecoration:
                                  doc.status === 'ignored'
                                    ? 'line-through'
                                    : 'none',
                                cursor:
                                  doc.mimeType === 'application/pdf'
                                    ? 'pointer'
                                    : 'default',
                                color:
                                  doc.mimeType === 'application/pdf'
                                    ? 'rgba(255, 255, 255, 0.9)'
                                    : 'inherit',
                              }}
                              onClick={() => {
                                if (doc.mimeType === 'application/pdf') {
                                  setViewingPdf(doc);
                                }
                              }}
                            >
                              {doc.originalName}
                            </span>
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
                                        : doc.status === 'ignored'
                                          ? 'rgba(128, 128, 128, 0.2)'
                                          : 'rgba(255, 0, 0, 0.2)',
                                textTransform: 'capitalize',
                              }}
                            >
                              {doc.status === 'ignored'
                                ? '🚫 ignored'
                                : doc.status}
                            </span>
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.75rem',
                            }}
                          >
                            <button
                              style={{
                                fontSize: '0.7rem',
                                padding: '0.25rem 0.5rem',
                                border: 'none',
                                borderRadius: '4px',
                                backgroundColor:
                                  doc.status === 'ignored'
                                    ? 'rgba(0, 150, 0, 0.2)'
                                    : 'rgba(200, 100, 100, 0.2)',
                                color: 'rgba(255, 255, 255, 0.8)',
                                cursor:
                                  togglingIgnore === doc.id
                                    ? 'not-allowed'
                                    : 'pointer',
                                opacity: togglingIgnore === doc.id ? 0.5 : 1,
                              }}
                              disabled={togglingIgnore === doc.id}
                              onClick={() =>
                                toggleIgnoreDocument(
                                  doc.id,
                                  doc.status === 'ignored',
                                )
                              }
                            >
                              {togglingIgnore === doc.id
                                ? '...'
                                : doc.status === 'ignored'
                                  ? '↩️ Include'
                                  : '🚫 Ignore'}
                            </button>
                            <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                              {new Date(doc.createdAt).toLocaleDateString()}
                            </span>
                          </div>
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

                {/* Analyze Documents Button */}
                {documents.some(
                  (doc) => doc.mimeType === 'application/pdf',
                ) && (
                  <div style={{ marginBottom: '2rem' }}>
                    <button
                      className="btn btn-golden btn-auto"
                      type="button"
                      disabled={analyzing}
                      onClick={async () => {
                        setAnalyzing(true);
                        try {
                          const response = await fetch(
                            `/api/trips/${tripId}/analyze`,
                            {
                              method: 'POST',
                            },
                          );

                          if (!response.ok) {
                            const errorData = await response.json();
                            const userMessage =
                              errorData.userMessage ||
                              errorData.details ||
                              errorData.error ||
                              'Analysis failed';
                            throw new Error(userMessage);
                          }

                          const data = await response.json();
                          console.log('Analysis successful:', data);

                          // Show success message
                          alert(
                            `Analysis complete! Created ${data.createdItems} items and ${data.createdPlaces} places from ${data.analyzedDocuments.length} documents.`,
                          );

                          // Optionally refresh the page to show new items
                          // window.location.reload();
                        } catch (error) {
                          console.error('Analysis error:', error);

                          const errorMessage =
                            error instanceof Error
                              ? error.message
                              : 'Analysis failed';

                          // Show more helpful error messages
                          if (
                            errorMessage.includes('quota exceeded') ||
                            errorMessage.includes('credits') ||
                            errorMessage.includes('Sojourns forgot')
                          ) {
                            alert(
                              '🤖💳 Whoops!\n\n' +
                                'Looks like Sojourns forgot to top up their AI credits. Hold tight while we sort this out!\n\n' +
                                'Our travel planning bot will be back to analyzing your documents soon! ✈️',
                            );
                          } else {
                            alert(`Analysis failed: ${errorMessage}`);
                          }
                        } finally {
                          setAnalyzing(false);
                        }
                      }}
                    >
                      {analyzing
                        ? 'Analyzing PDFs...'
                        : '🤖 Analyze PDFs with AI'}
                    </button>
                  </div>
                )}

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
            )}
          </div>

          {/* Right Column - Trip Items */}
          <div style={{ marginLeft: '2rem' }}>
            {itemsLoading ? (
              <div
                className="dashboard-card"
                style={{ padding: '2rem', textAlign: 'center' }}
              >
                Loading items...
              </div>
            ) : (
              <div>
                <h2 style={{ marginBottom: '1.5rem', fontSize: '1.4rem' }}>
                  Trip Itinerary
                </h2>

                {items.length === 0 ? (
                  <div
                    className="dashboard-card"
                    style={{
                      padding: '2rem',
                      textAlign: 'center',
                      opacity: 0.7,
                    }}
                  >
                    <p>No items yet</p>
                    <p style={{ fontSize: '0.9rem', opacity: 0.7 }}>
                      Upload and analyze documents to build your itinerary
                    </p>
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1rem',
                    }}
                  >
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className={
                          item.type === 'flight'
                            ? 'flight-item-card'
                            : 'item-card'
                        }
                      >
                        {item.type === 'flight' ? (
                          // Custom Flight Layout
                          <>
                            <div className="flight-sidebar">
                              <div className="flight-icon">
                                <Image
                                  src="/images/icons/flights.png"
                                  alt="Flight icon"
                                  width={40}
                                  height={40}
                                  style={{ objectFit: 'contain' }}
                                />
                              </div>
                              <div className="flight-timeline"></div>
                            </div>
                            <div className="flight-content">
                              {/* Flight Title */}
                              <h3 className="flight-title">
                                {item.destinationPlaceCity
                                  ? `Flight to ${item.destinationPlaceCity}`
                                  : 'Flight'}
                              </h3>

                              {/* Date and Time Info */}
                              <div className="flight-date">
                                <div>
                                  {item.startDate
                                    ? new Date(
                                        item.startDate,
                                      ).toLocaleDateString('en-US', {
                                        weekday: 'short',
                                        month: 'short',
                                        day: 'numeric',
                                      }) +
                                      ' at ' +
                                      new Date(item.startDate)
                                        .toISOString()
                                        .slice(11, 16)
                                        .replace(
                                          /(\d{2}):(\d{2})/,
                                          (_, h, m) => {
                                            const hour12 =
                                              parseInt(h) === 0
                                                ? 12
                                                : parseInt(h) > 12
                                                  ? parseInt(h) - 12
                                                  : parseInt(h);
                                            const ampm =
                                              parseInt(h) >= 12 ? 'pm' : 'am';
                                            return `${hour12}:${m}${ampm}`;
                                          },
                                        )
                                    : 'Date TBD'}
                                </div>
                              </div>

                              {/* Flight Details - Flight Number */}
                              {(() => {
                                let carrierCode = '';
                                let flightNumber = '';
                                let hasData = false;
                                if (item.data) {
                                  try {
                                    const parsedData = JSON.parse(item.data);
                                    carrierCode = parsedData.carrierCode;
                                    flightNumber = parsedData.flightNumber;
                                    hasData = !!(carrierCode && flightNumber);
                                  } catch (e) {
                                    // Keep default fallback
                                  }
                                }

                                const displayFlightNumber = hasData
                                  ? `${carrierCode} ${flightNumber}`
                                  : '-';

                                return (
                                  <div className="flight-number">
                                    <Image
                                      src="/images/airlines/ice.png?v=5"
                                      alt="Airline logo"
                                      width={24}
                                      height={18}
                                      style={{ objectFit: 'contain' }}
                                    />
                                    <span
                                      style={{ opacity: hasData ? 1 : 0.4 }}
                                    >
                                      {displayFlightNumber}
                                    </span>
                                  </div>
                                );
                              })()}

                              {/* Route */}
                              <div className="flight-route">
                                {item.originPlaceCity || 'Origin'} →{' '}
                                {item.destinationPlaceCity || 'Destination'}
                              </div>

                              {/* Departure and Arrival Times */}
                              <div className="flight-times">
                                <div className="flight-departure">
                                  <ArrowUpCircle
                                    size={16}
                                    style={{
                                      transform: 'rotate(45deg)',
                                    }}
                                  />
                                  <span>
                                    {item.originPlaceShortName || 'DEP'}{' '}
                                    {item.originLocationSpecific || ''}{' '}
                                    {item.startDate
                                      ? new Date(item.startDate)
                                          .toISOString()
                                          .slice(11, 16)
                                          .replace(
                                            /(\d{2}):(\d{2})/,
                                            (_, h, m) => {
                                              const hour12 =
                                                parseInt(h) === 0
                                                  ? 12
                                                  : parseInt(h) > 12
                                                    ? parseInt(h) - 12
                                                    : parseInt(h);
                                              const ampm =
                                                parseInt(h) >= 12 ? 'PM' : 'AM';
                                              return `${hour12}:${m}${ampm}`;
                                            },
                                          )
                                      : '10:30AM'}
                                  </span>
                                </div>
                                <div className="flight-arrival">
                                  <ArrowDownCircle
                                    size={16}
                                    style={{
                                      transform: 'rotate(-45deg)',
                                    }}
                                  />
                                  <span>
                                    {item.destinationPlaceShortName || 'ARR'}{' '}
                                    {item.destinationLocationSpecific || ''}{' '}
                                    {item.endDate
                                      ? new Date(item.endDate)
                                          .toISOString()
                                          .slice(11, 16)
                                          .replace(
                                            /(\d{2}):(\d{2})/,
                                            (_, h, m) => {
                                              const hour12 =
                                                parseInt(h) === 0
                                                  ? 12
                                                  : parseInt(h) > 12
                                                    ? parseInt(h) - 12
                                                    : parseInt(h);
                                              const ampm =
                                                parseInt(h) >= 12 ? 'PM' : 'AM';
                                              return `${hour12}:${m}${ampm}`;
                                            },
                                          )
                                      : '12:15PM'}
                                  </span>
                                </div>
                              </div>

                              {/* Additional Flight Details */}
                              <div className="flight-details">
                                <div className="flight-service-info">
                                  <div className="flight-class">
                                    <Award size={14} />{' '}
                                    {(() => {
                                      let flightClass = '';
                                      let hasData = false;
                                      if (item.data) {
                                        try {
                                          const parsedData = JSON.parse(
                                            item.data,
                                          );
                                          flightClass = parsedData.class;
                                          hasData = !!flightClass;
                                        } catch (e) {
                                          // Keep default fallback
                                        }
                                      }
                                      return (
                                        <span
                                          style={{ opacity: hasData ? 1 : 0.4 }}
                                        >
                                          {flightClass || '-'}
                                        </span>
                                      );
                                    })()}
                                  </div>
                                  <div className="flight-passengers">
                                    <Users size={14} />{' '}
                                    {(() => {
                                      let passengers = '';
                                      let hasData = false;
                                      if (item.data) {
                                        try {
                                          const parsedData = JSON.parse(
                                            item.data,
                                          );
                                          passengers = parsedData.passengers;
                                          hasData = !!passengers;
                                        } catch (e) {
                                          // Keep default fallback
                                        }
                                      }
                                      return (
                                        <span
                                          style={{ opacity: hasData ? 1 : 0.4 }}
                                        >
                                          {passengers || '-'}
                                        </span>
                                      );
                                    })()}
                                  </div>
                                </div>
                                <div className="flight-contact">
                                  <Phone size={14} />{' '}
                                  <span
                                    className="monospace"
                                    style={{
                                      opacity: item.phoneNumber ? 1 : 0.4,
                                    }}
                                  >
                                    {item.phoneNumber || '-'}
                                  </span>
                                </div>
                                <div className="flight-confirmation">
                                  <Hash size={14} />{' '}
                                  <span
                                    className="monospace"
                                    style={{
                                      opacity: item.confirmationNumber
                                        ? 1
                                        : 0.4,
                                    }}
                                  >
                                    {item.confirmationNumber || '-'}
                                  </span>
                                </div>
                              </div>

                              <div className="flight-notes">
                                <FileText size={14} />{' '}
                                <span style={{ opacity: item.notes ? 1 : 0.4 }}>
                                  {item.notes || '-'}
                                </span>
                              </div>
                            </div>
                          </>
                        ) : (
                          // Default Layout for Non-Flight Items
                          <>
                            {/* Item Type Icon and Title */}
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                marginBottom: '0.75rem',
                              }}
                            >
                              <span
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                }}
                              >
                                {item.type === 'hotel' ? (
                                  <Home size={20} />
                                ) : item.type === 'restaurant' ? (
                                  <Coffee size={20} />
                                ) : item.type === 'transfer' ? (
                                  <Navigation2 size={20} />
                                ) : (
                                  <Zap size={20} />
                                )}
                              </span>
                              <h3
                                style={{
                                  margin: 0,
                                  fontSize: '1.1rem',
                                  fontWeight: '600',
                                }}
                              >
                                {item.title}
                              </h3>
                            </div>

                            {/* Item Details */}
                            <div
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.5rem',
                              }}
                            >
                              {item.description && (
                                <p
                                  style={{
                                    margin: 0,
                                    fontSize: '0.9rem',
                                    opacity: 0.8,
                                    lineHeight: '1.4',
                                  }}
                                >
                                  {item.description}
                                </p>
                              )}

                              {/* Show origin/destination for transfer items */}
                              {item.type === 'transfer' &&
                              (item.originPlaceName ||
                                item.destinationPlaceName) ? (
                                <div
                                  style={{
                                    fontSize: '0.85rem',
                                    opacity: 0.7,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.3rem',
                                  }}
                                >
                                  <MapPin size={14} />
                                  {item.originPlaceName || '?'}
                                  {item.originLocationSpecific &&
                                    ` (${item.originLocationSpecific})`}{' '}
                                  → {item.destinationPlaceName || '?'}
                                  {item.destinationLocationSpecific &&
                                    ` (${item.destinationLocationSpecific})`}
                                </div>
                              ) : (
                                item.placeName && (
                                  <div
                                    style={{
                                      fontSize: '0.85rem',
                                      opacity: 0.7,
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '0.3rem',
                                    }}
                                  >
                                    <MapPin size={14} /> {item.placeName}
                                  </div>
                                )
                              )}

                              {(item.startDate || item.endDate) && (
                                <div
                                  style={{
                                    fontSize: '0.85rem',
                                    opacity: 0.7,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.3rem',
                                  }}
                                >
                                  <Clock size={14} />
                                  {item.startDate
                                    ? new Date(item.startDate).toLocaleString()
                                    : 'TBD'}
                                  {item.endDate &&
                                    item.startDate !== item.endDate &&
                                    ` - ${new Date(item.endDate).toLocaleString()}`}
                                </div>
                              )}

                              {item.cost && (
                                <div
                                  style={{
                                    fontSize: '0.85rem',
                                    opacity: 0.7,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.3rem',
                                  }}
                                >
                                  <DollarSign size={14} /> {item.cost}
                                </div>
                              )}

                              {item.placeName && (
                                <div
                                  style={{
                                    fontSize: '0.85rem',
                                    opacity: 0.7,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.3rem',
                                  }}
                                >
                                  <Home size={14} /> {item.placeName}
                                  {item.placeAddress &&
                                    ` - ${item.placeAddress}`}
                                </div>
                              )}

                              {item.phoneNumber && (
                                <div
                                  style={{
                                    fontSize: '0.85rem',
                                    opacity: 0.7,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.3rem',
                                  }}
                                >
                                  <Phone size={14} />{' '}
                                  <span className="monospace">
                                    {item.phoneNumber}
                                  </span>
                                </div>
                              )}

                              {item.confirmationNumber && (
                                <div
                                  style={{
                                    fontSize: '0.85rem',
                                    opacity: 0.7,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.3rem',
                                  }}
                                >
                                  <Hash size={14} />{' '}
                                  <span className="monospace">
                                    {item.confirmationNumber}
                                  </span>
                                </div>
                              )}

                              {item.notes && (
                                <div
                                  style={{
                                    fontSize: '0.85rem',
                                    opacity: 0.8,
                                    fontStyle: 'italic',
                                    marginTop: '0.5rem',
                                    padding: '0.5rem',
                                    backgroundColor:
                                      'rgba(255, 255, 255, 0.05)',
                                    borderRadius: '4px',
                                  }}
                                >
                                  Agent Notes: {item.notes}
                                </div>
                              )}
                            </div>

                            {/* Status Badge */}
                            <div style={{ marginTop: '0.75rem' }}>
                              <span
                                style={{
                                  fontSize: '0.75rem',
                                  padding: '0.25rem 0.5rem',
                                  borderRadius: '12px',
                                  backgroundColor:
                                    item.status === 'confirmed'
                                      ? 'rgba(0, 255, 0, 0.2)'
                                      : 'rgba(255, 165, 0, 0.2)',
                                  textTransform: 'capitalize',
                                }}
                              >
                                {item.status}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
