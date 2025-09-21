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
  MinusCircle,
  PlusCircle,
  Trash2,
  Eye,
  EyeOff,
  UploadCloud,
  Cpu,
  ArrowUp,
  Briefcase,
  CheckCircle,
  XCircle,
  ArrowLeft,
  Moon,
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
  groupSize?: number;
  flightsPhoneNumber?: string;
  notes?: string;
  shareToken?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  agentName?: string;
  organizationName?: string;
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
  const [deletingDoc, setDeletingDoc] = useState<string | null>(null);
  const [viewingPdf, setViewingPdf] = useState<Document | null>(null);
  const [iconExists, setIconExists] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const milesSrc = '/images/miles.png?v=7';

  const shortenFilename = (
    filename: string,
    maxLength: number = 40,
  ): string => {
    if (filename.length <= maxLength) return filename;

    // Find the last dot to separate name and extension
    const lastDotIndex = filename.lastIndexOf('.');
    const extension =
      lastDotIndex !== -1 ? filename.substring(lastDotIndex) : '';
    const nameWithoutExtension =
      lastDotIndex !== -1 ? filename.substring(0, lastDotIndex) : filename;

    // Calculate available space for the name part (minus ellipsis and extension)
    const availableSpace = maxLength - 3 - extension.length; // 3 for "..."

    if (availableSpace <= 0) {
      // If extension is too long, just truncate everything
      return filename.substring(0, maxLength - 3) + '...';
    }

    // Split available space between start and end of filename
    const startLength = Math.ceil(availableSpace / 2);
    const endLength = Math.floor(availableSpace / 2);

    const start = nameWithoutExtension.substring(0, startLength);
    const end = nameWithoutExtension.substring(
      nameWithoutExtension.length - endLength,
    );

    return start + '...' + end + extension;
  };

  const getRelativeTime = (date: string | Date): string => {
    const now = new Date();
    const past = new Date(date);
    const diffMs = now.getTime() - past.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);

    if (diffMinutes < 1) return 'just now';
    if (diffMinutes < 60)
      return `${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`;
    if (diffHours < 24)
      return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    if (diffDays < 7)
      return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
    if (diffWeeks < 4)
      return `${diffWeeks} ${diffWeeks === 1 ? 'week' : 'weeks'} ago`;
    if (diffMonths < 12)
      return `${diffMonths} ${diffMonths === 1 ? 'month' : 'months'} ago`;

    const diffYears = Math.floor(diffMonths / 12);
    return `${diffYears} ${diffYears === 1 ? 'year' : 'years'} ago`;
  };

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

  // Check if trip icon exists
  useEffect(() => {
    if (trip?.icon) {
      const img = document.createElement('img');
      img.onload = () => setIconExists(true);
      img.onerror = () => setIconExists(false);
      img.src = `/images/icons/trip/${trip.icon}.png?v=1`;
    } else {
      setIconExists(false);
    }
  }, [trip?.icon]);

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

  const deleteDocument = async (docId: string) => {
    // Confirm deletion
    if (
      !confirm(
        'Are you sure you want to delete this document? This action cannot be undone.',
      )
    ) {
      return;
    }

    setDeletingDoc(docId);
    try {
      const response = await fetch(`/api/trips/${tripId}/documents/${docId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete document');
      }

      // Remove the document from the documents state
      setDocuments((prev) => prev.filter((doc) => doc.id !== docId));

      // If the deleted document was being viewed, close the viewer
      if (viewingPdf && viewingPdf.id === docId) {
        setViewingPdf(null);
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      alert(
        error instanceof Error
          ? `Failed to delete document: ${error.message}`
          : 'Failed to delete document',
      );
    } finally {
      setDeletingDoc(null);
    }
  };

  const publishTrip = async () => {
    setPublishing(true);
    try {
      const response = await fetch(`/api/trips/${tripId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'published' }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to publish trip');
      }

      const data = await response.json();

      // Update the trip state with new status
      setTrip((prev) =>
        prev
          ? { ...prev, status: 'published', updatedAt: data.trip.updatedAt }
          : null,
      );

      alert('Trip published successfully!');
    } catch (error) {
      console.error('Error publishing trip:', error);
      alert(
        error instanceof Error
          ? `Failed to publish trip: ${error.message}`
          : 'Failed to publish trip',
      );
    } finally {
      setPublishing(false);
    }
  };

  const unpublishTrip = async () => {
    setPublishing(true);
    try {
      const response = await fetch(`/api/trips/${tripId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'draft' }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to unpublish trip');
      }

      const data = await response.json();

      // Update the trip state with new status
      setTrip((prev) =>
        prev
          ? { ...prev, status: 'draft', updatedAt: data.trip.updatedAt }
          : null,
      );

      alert('Trip unpublished successfully!');
    } catch (error) {
      console.error('Error unpublishing trip:', error);
      alert(
        error instanceof Error
          ? `Failed to unpublish trip: ${error.message}`
          : 'Failed to unpublish trip',
      );
    } finally {
      setPublishing(false);
    }
  };

  const cancelTrip = async () => {
    // Confirm cancellation
    if (
      !confirm(
        'Are you sure you want to cancel this trip? This action cannot be undone.',
      )
    ) {
      return;
    }

    setPublishing(true);
    try {
      const response = await fetch(`/api/trips/${tripId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'cancelled' }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to cancel trip');
      }

      const data = await response.json();

      // Update the trip state with new status
      setTrip((prev) =>
        prev
          ? { ...prev, status: 'cancelled', updatedAt: data.trip.updatedAt }
          : null,
      );

      alert('Trip cancelled successfully!');
    } catch (error) {
      console.error('Error cancelling trip:', error);
      alert(
        error instanceof Error
          ? `Failed to cancel trip: ${error.message}`
          : 'Failed to cancel trip',
      );
    } finally {
      setPublishing(false);
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
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
        minHeight: '100vh',
        boxSizing: 'border-box',
      }}
    >
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
      <main
        style={{
          display: 'flex',
          flexDirection: 'column',
          padding: '5rem 2rem 2rem 2rem',
          maxWidth: '1200px',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 500px',
            gap: '1.5rem',
            flex: 1,
          }}
        >
          <div
            className="left-column"
            style={{
              position: 'fixed',
              top: '40px',
              left: '50%',
              transform: 'translateX(-600px)',
              width: 'calc((100vw - 1200px) / 2 + 1200px * 0.6)',
              maxWidth: '600px',
              zIndex: 1001,
              height: 'calc(100vh - 40px)',
              overflow: 'auto',
              padding: '1rem 2rem 2rem 2rem',
              boxSizing: 'border-box',
            }}
          >
            {/* Back to trips link at top of left column */}
            <div style={{ marginBottom: '1rem' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.9rem',
                  color: 'rgba(255, 255, 255, 0.7)',
                }}
              >
                <Link
                  href="/trips"
                  style={{
                    color: 'rgba(255, 255, 255, 0.7)',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <ArrowLeft size={16} />
                  Back to Trips
                </Link>
              </div>
            </div>

            {viewingPdf ? (
              // PDF Viewer
              <div
                className="simple-card"
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
                className="simple-card"
                style={{ padding: '2rem', marginBottom: '1.5rem' }}
              >
                {/* Documents List */}
                <div className="documents-section">
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
                    <div className="documents" style={{ marginBottom: '2rem' }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '0.75rem',
                        }}
                      >
                        <h3 style={{ margin: 0 }}>Documents</h3>
                        <div
                          className={`upload-section ${uploading ? 'disabled' : ''}`}
                          onClick={() => {
                            if (!uploading) {
                              document.getElementById('file-upload')?.click();
                            }
                          }}
                          title="Upload documents"
                        >
                          <UploadCloud size={18} />
                          <span>Upload</span>
                        </div>
                      </div>
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
                            className={`file ${doc.status === 'ignored' ? 'ignored' : ''}`}
                          >
                            <div className="file-content">
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '1rem',
                                }}
                              >
                                <FileText
                                  size={18}
                                  style={{
                                    opacity: 0.6,
                                    flexShrink: 0,
                                    strokeWidth: 2,
                                  }}
                                />
                                <div style={{ flex: 1 }}>
                                  <div
                                    className={`file-header ${doc.mimeType === 'application/pdf' ? 'clickable' : 'non-clickable'}`}
                                    onClick={() => {
                                      if (doc.mimeType === 'application/pdf') {
                                        setViewingPdf(doc);
                                      }
                                    }}
                                    title={doc.originalName}
                                  >
                                    <span
                                      className={`file-name ${doc.mimeType === 'application/pdf' ? 'pdf' : ''}`}
                                    >
                                      {shortenFilename(doc.originalName)}
                                    </span>
                                    <Eye
                                      size={16}
                                      className={`file-icon ${doc.mimeType === 'application/pdf' ? 'pdf' : ''}`}
                                    />
                                  </div>

                                  <div className="file-badges">
                                    <span
                                      className={`file-status-badge ${doc.status === 'uploaded' ? 'uploaded' : doc.status}`}
                                    >
                                      {doc.status === 'ignored'
                                        ? 'ignored'
                                        : doc.status === 'uploaded'
                                          ? 'not processed'
                                          : doc.status}
                                    </span>
                                    <span className="file-date-badge">
                                      {new Date(doc.createdAt)
                                        .toLocaleDateString('en-US', {
                                          month: 'short',
                                          day: 'numeric',
                                          year: 'numeric',
                                        })
                                        .replace(/(\d+),/, (match, day) => {
                                          const dayNum = parseInt(day);
                                          const suffix =
                                            dayNum % 10 === 1 && dayNum !== 11
                                              ? 'st'
                                              : dayNum % 10 === 2 &&
                                                  dayNum !== 12
                                                ? 'nd'
                                                : dayNum % 10 === 3 &&
                                                    dayNum !== 13
                                                  ? 'rd'
                                                  : 'th';
                                          return `${day}${suffix}`;
                                        })}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="file-actions">
                              <button
                                className={`file-action-btn ${doc.status === 'ignored' ? 'ignored' : 'included'}`}
                                disabled={togglingIgnore === doc.id}
                                title={
                                  doc.status === 'ignored'
                                    ? 'Excluded from AI analysis'
                                    : 'Included in AI analysis'
                                }
                                onClick={() =>
                                  toggleIgnoreDocument(
                                    doc.id,
                                    doc.status === 'ignored',
                                  )
                                }
                              >
                                {togglingIgnore === doc.id ? (
                                  '...'
                                ) : doc.status === 'ignored' ? (
                                  <XCircle />
                                ) : (
                                  <CheckCircle />
                                )}
                              </button>

                              <button
                                className="file-action-btn delete"
                                disabled={deletingDoc === doc.id}
                                onClick={() => deleteDocument(doc.id)}
                              >
                                {deletingDoc === doc.id ? '...' : <Trash2 />}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Analyze Documents Button */}
                      {documents.some(
                        (doc) => doc.mimeType === 'application/pdf',
                      ) && (
                        <button
                          className="btn btn-golden btn-auto"
                          type="button"
                          disabled={analyzing}
                          style={{ marginTop: '1rem' }}
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

                              // Refresh the items data to show new items
                              const itemsResponse = await fetch(
                                `/api/trips/${tripId}/items`,
                              );
                              if (itemsResponse.ok) {
                                const itemsData = await itemsResponse.json();
                                setItems(itemsData.items || []);
                              }

                              // Also refresh documents to update their status
                              const docsResponse = await fetch(
                                `/api/trips/${tripId}/documents`,
                              );
                              if (docsResponse.ok) {
                                const docsData = await docsResponse.json();
                                setDocuments(docsData.documents || []);
                              }
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
                          {analyzing ? (
                            <>
                              <Cpu size={16} />
                              Analyzing Documents...
                            </>
                          ) : (
                            <>
                              <Cpu size={16} />
                              Analyze & Add To Itinerary
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  ) : null}

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

                  {/* Add To Itinerary Section */}
                  <div className="add-to-itinerary">
                    <h3>Add To Itinerary</h3>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem',
                      }}
                    >
                      <textarea
                        placeholder="Outline a flight, hotel, transfer, restaurant booking, or activity to add to the itinerary"
                        style={{
                          width: '100%',
                          padding: '1rem',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          backgroundColor: 'rgba(255, 255, 255, 0.02)',
                          color: 'white',
                          fontSize: '0.9rem',
                          fontFamily: 'inherit',
                          resize: 'none',
                          height: '80px',
                          boxSizing: 'border-box',
                          transition: 'all 0.2s ease',
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor =
                            'rgba(255, 255, 255, 0.2)';
                          e.target.style.backgroundColor =
                            'rgba(255, 255, 255, 0.04)';
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor =
                            'rgba(255, 255, 255, 0.1)';
                          e.target.style.backgroundColor =
                            'rgba(255, 255, 255, 0.02)';
                        }}
                      />
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'flex-start',
                        }}
                      >
                        <button className="btn btn-golden btn-auto">
                          <ArrowUpCircle size={16} />
                          Add To Itinerary
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Publish Section - only show for draft trips */}
                {trip.status === 'draft' && (
                  <div
                    style={{
                      marginTop: '2rem',
                      paddingTop: '1.5rem',
                      borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                    }}
                  >
                    <button
                      className="btn btn-green btn-auto"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                      }}
                      onClick={publishTrip}
                      disabled={publishing}
                    >
                      <CheckCircle size={16} />
                      {publishing ? 'Publishing...' : 'Publish Trip'}
                    </button>
                  </div>
                )}

                {/* Published Trip Actions - only show for published trips */}
                {trip.status === 'published' && (
                  <div
                    style={{
                      marginTop: '2rem',
                      paddingTop: '1.5rem',
                      borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem',
                      }}
                    >
                      <button
                        className="btn btn-secondary btn-auto"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.5rem',
                        }}
                        onClick={unpublishTrip}
                        disabled={publishing}
                      >
                        <EyeOff size={16} />
                        {publishing ? 'Unpublishing...' : 'Unpublish Trip'}
                      </button>
                      <button
                        className="btn btn-yellow btn-auto"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.5rem',
                        }}
                        onClick={cancelTrip}
                        disabled={publishing}
                      >
                        <XCircle size={16} />
                        {publishing ? 'Cancelling...' : 'Cancel Trip'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column - Trip Items */}
          <div
            className="itinerary"
            style={{
              marginLeft: '600px',
              width: '500px',
            }}
          >
            {itemsLoading ? (
              <div
                className="simple-card"
                style={{ padding: '2rem', textAlign: 'center' }}
              >
                Loading items...
              </div>
            ) : (
              <div>
                {/* Trip title at top of right column */}
                <div
                  className="title"
                  style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}
                >
                  {iconExists && trip?.icon && (
                    <Image
                      src={`/images/icons/trip/${trip.icon}.png?v=1`}
                      alt="Trip icon"
                      width={72}
                      height={72}
                      style={{ objectFit: 'contain', flexShrink: 0 }}
                    />
                  )}
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem',
                        marginBottom: '0.25rem',
                      }}
                    >
                      <h1
                        style={{
                          margin: 0,
                          fontSize: '1.8rem',
                        }}
                      >
                        {trip.destination || 'Somewhere Delightful'}
                      </h1>
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
                    <span
                      style={{
                        fontSize: '1.1rem',
                        opacity: 0.8,
                        fontWeight: 'normal',
                      }}
                    >
                      {(() => {
                        if (!trip.startDate)
                          return 'Trip dates to be determined';

                        const startDate = new Date(trip.startDate);
                        const endDate = trip.endDate
                          ? new Date(trip.endDate)
                          : null;

                        const formatDate = (date: Date, includeDay = false) => {
                          const options: Intl.DateTimeFormatOptions = {
                            month: 'long',
                            day: 'numeric',
                          };
                          if (includeDay) {
                            options.weekday = 'short';
                          }

                          const formatted = date.toLocaleDateString(
                            'en-US',
                            options,
                          );
                          // Add ordinal suffix to day
                          return formatted.replace(/(\d+)/, (match, day) => {
                            const dayNum = parseInt(day);
                            const suffix =
                              dayNum % 10 === 1 && dayNum !== 11
                                ? 'st'
                                : dayNum % 10 === 2 && dayNum !== 12
                                  ? 'nd'
                                  : dayNum % 10 === 3 && dayNum !== 13
                                    ? 'rd'
                                    : 'th';
                            return `${day}${suffix}`;
                          });
                        };

                        const startFormatted = formatDate(startDate, false);

                        if (!endDate) return startFormatted;

                        // If same month, just show day for end date
                        const endFormatted =
                          startDate.getMonth() === endDate.getMonth()
                            ? formatDate(endDate).replace(/\w+ /, '') // Remove month
                            : formatDate(endDate);

                        return `${startFormatted} → ${endFormatted}`;
                      })()}
                    </span>
                  </div>
                </div>

                <h2>
                  {trip.clientName
                    ? `${trip.clientName} Itinerary`
                    : 'Itinerary'}
                </h2>

                <p className="itinerary-strap">
                  Brought to you by {trip.agentName || 'your agent'} at{' '}
                  {trip.organizationName || 'their organization'}
                </p>

                <p className="itinerary-updated">
                  Last updated {getRelativeTime(trip.updatedAt)}
                </p>

                {items.length === 0 ? (
                  <div
                    style={{
                      padding: '1rem 0',
                      textAlign: 'left',
                      opacity: 0.5,
                    }}
                  >
                    <p>
                      <strong>No items yet.</strong>
                      <br />
                      Upload confirmation documents to get started.
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
                    {items
                      .sort((a, b) => {
                        // Sort by start time, with items without start time at the end
                        if (!a.startDate && !b.startDate) return 0;
                        if (!a.startDate) return 1;
                        if (!b.startDate) return -1;
                        return (
                          new Date(a.startDate).getTime() -
                          new Date(b.startDate).getTime()
                        );
                      })
                      .map((item) => (
                        <div
                          key={item.id}
                          className={`item-card item-${item.type}`}
                        >
                          {item.type === 'flight' ? (
                            // Custom Flight Layout
                            <>
                              <div className="item-sidebar">
                                <div className="item-icon">
                                  <Image
                                    src="/images/icons/items/flights.png"
                                    alt="Flight icon"
                                    width={40}
                                    height={40}
                                    className="item-icon-image"
                                  />
                                </div>
                                <div className="item-timeline"></div>
                              </div>
                              <div className="item-content">
                                {/* Flight Title */}
                                <h3 className="item-title">
                                  {item.destinationPlaceCity
                                    ? `Flight to ${item.destinationPlaceCity}`
                                    : 'Flight'}
                                </h3>

                                {/* Date and Time Info */}
                                <div className="item-date">
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
                                    <div className="item-number">
                                      {hasData && carrierCode && (
                                        <Image
                                          src={`https://airlabs.co/img/airline/m/${carrierCode}.png`}
                                          alt="Airline logo"
                                          width={24}
                                          height={24}
                                          style={{ objectFit: 'contain' }}
                                        />
                                      )}
                                      <span
                                        style={{ opacity: hasData ? 1 : 0.4 }}
                                      >
                                        {displayFlightNumber}
                                      </span>
                                    </div>
                                  );
                                })()}

                                {/* Route */}
                                <div className="item-route">
                                  {item.originPlaceCity || 'Origin'} →{' '}
                                  {item.destinationPlaceCity || 'Destination'}
                                </div>

                                {/* Departure and Arrival Times */}
                                <div className="item-times">
                                  <div className="item-departure">
                                    <ArrowUpCircle
                                      size={16}
                                      style={{
                                        transform: 'rotate(45deg)',
                                      }}
                                    />
                                    <span>
                                      <span>
                                        {item.originPlaceShortName || 'DEP'}
                                      </span>{' '}
                                      <span>
                                        {item.originLocationSpecific || ''}
                                      </span>{' '}
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
                                                  parseInt(h) >= 12
                                                    ? 'PM'
                                                    : 'AM';
                                                return `${hour12}:${m}${ampm}`;
                                              },
                                            )
                                        : '10:30AM'}
                                    </span>
                                  </div>
                                  <div className="item-arrival">
                                    <ArrowDownCircle
                                      size={16}
                                      style={{
                                        transform: 'rotate(-45deg)',
                                      }}
                                    />
                                    <span>
                                      <span>
                                        {item.destinationPlaceShortName ||
                                          'ARR'}
                                      </span>{' '}
                                      <span>
                                        {item.destinationLocationSpecific || ''}
                                      </span>{' '}
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
                                                  parseInt(h) >= 12
                                                    ? 'PM'
                                                    : 'AM';
                                                return `${hour12}:${m}${ampm}`;
                                              },
                                            )
                                        : '12:15PM'}
                                    </span>
                                  </div>
                                </div>

                                {/* Additional Flight Details */}
                                <div className="item-details">
                                  <div className="item-service-info">
                                    <div className="item-class">
                                      <Award size={16} />{' '}
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
                                            style={{
                                              opacity: hasData ? 1 : 0.4,
                                            }}
                                          >
                                            {flightClass || '-'}
                                          </span>
                                        );
                                      })()}
                                    </div>
                                    <div className="item-passengers">
                                      <Users size={16} />{' '}
                                      {(() => {
                                        // Use trip group size or fallback to dash
                                        const displayText = trip?.groupSize
                                          ? `${trip.groupSize}`
                                          : '-';
                                        const opacity = trip?.groupSize
                                          ? 0.7
                                          : 0.4;

                                        return (
                                          <span style={{ opacity }}>
                                            {displayText}
                                          </span>
                                        );
                                      })()}
                                    </div>
                                  </div>
                                  <div className="item-contact">
                                    <Phone size={16} />{' '}
                                    <span
                                      className="monospace"
                                      style={{
                                        opacity: trip?.flightsPhoneNumber
                                          ? undefined
                                          : 0.4,
                                      }}
                                    >
                                      {trip?.flightsPhoneNumber || '-'}
                                    </span>
                                  </div>
                                  <div className="item-confirmation">
                                    <Hash size={16} />{' '}
                                    <span
                                      className="monospace"
                                      style={{
                                        opacity: item.confirmationNumber
                                          ? undefined
                                          : 0.4,
                                      }}
                                    >
                                      {item.confirmationNumber || '-'}
                                    </span>
                                  </div>
                                </div>

                                <div className="secondary">
                                  <div className="item-notes">
                                    <FileText size={16} />{' '}
                                    <span
                                      style={{ opacity: item.notes ? 1 : 0.4 }}
                                    >
                                      {item.notes || '-'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </>
                          ) : item.type === 'hotel' ? (
                            // Custom Hotel Layout
                            <>
                              <div className="item-sidebar">
                                <div className="item-icon">
                                  <Image
                                    src="/images/icons/items/hotel.png"
                                    alt="Hotel icon"
                                    width={40}
                                    height={40}
                                    className="item-icon-image"
                                  />
                                </div>
                                <div className="item-timeline"></div>
                              </div>
                              <div className="item-content">
                                {/* Hotel Title */}
                                <h3 className="item-title">
                                  {(() => {
                                    const data = item.data
                                      ? JSON.parse(item.data)
                                      : {};
                                    return (
                                      data.hotelName ||
                                      item.title ||
                                      'Hotel Stay'
                                    );
                                  })()}
                                </h3>

                                {/* Check-in Date and Time Info */}
                                <div className="item-date">
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
                                      : 'TBD Check In Date'}
                                  </div>
                                </div>

                                {/* Hotel Details */}
                                <div className="item-details">
                                  {(() => {
                                    const data = item.data
                                      ? JSON.parse(item.data)
                                      : {};
                                    return (
                                      <>
                                        <div
                                          style={{
                                            display: 'flex',
                                            gap: '1rem',
                                          }}
                                        >
                                          {data.roomCategory && (
                                            <div className="item-class">
                                              <Award size={16} />
                                              <span>{data.roomCategory}</span>
                                            </div>
                                          )}
                                          <div className="item-passengers">
                                            <Users size={16} />
                                            <span>{trip?.groupSize || 1}</span>
                                          </div>
                                        </div>
                                        <div
                                          style={{
                                            display: 'flex',
                                            gap: '1rem',
                                          }}
                                        >
                                          <div className="item-nights">
                                            <Moon size={16} />
                                            <span>
                                              {(() => {
                                                if (
                                                  item.startDate &&
                                                  item.endDate
                                                ) {
                                                  const start = new Date(
                                                    item.startDate,
                                                  );
                                                  const end = new Date(
                                                    item.endDate,
                                                  );
                                                  const nights = Math.ceil(
                                                    (end.getTime() -
                                                      start.getTime()) /
                                                      (1000 * 60 * 60 * 24),
                                                  );
                                                  return `${nights} night${nights !== 1 ? 's' : ''}`;
                                                }
                                                return 'TBD nights';
                                              })()}
                                            </span>
                                          </div>
                                          {data.perks &&
                                            data.perks.length > 0 && (
                                              <div className="item-perks">
                                                <Award size={16} />
                                                <span>
                                                  {data.perks.length} perk
                                                  {data.perks.length !== 1
                                                    ? 's'
                                                    : ''}
                                                </span>
                                              </div>
                                            )}
                                        </div>
                                      </>
                                    );
                                  })()}
                                  <div className="item-contact">
                                    <Phone size={16} />
                                    <span
                                      style={{
                                        opacity: item.phoneNumber
                                          ? undefined
                                          : 0.4,
                                      }}
                                    >
                                      {item.phoneNumber || '-'}
                                    </span>
                                  </div>
                                  <div className="item-confirmation">
                                    <Hash size={16} />
                                    <span
                                      className="monospace"
                                      style={{
                                        opacity: item.confirmationNumber
                                          ? undefined
                                          : 0.4,
                                      }}
                                    >
                                      {item.confirmationNumber || '-'}
                                    </span>
                                  </div>
                                  <div className="item-notes">
                                    <FileText size={16} />
                                    <span
                                      style={{ opacity: item.notes ? 1 : 0.4 }}
                                    >
                                      {item.notes || '-'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </>
                          ) : item.type === 'transfer' ? (
                            // Custom Transfer Layout
                            <>
                              <div className="item-sidebar">
                                <div className="item-icon">
                                  <Image
                                    src="/images/icons/items/transfer.png"
                                    alt="Transfer icon"
                                    width={40}
                                    height={40}
                                    className="item-icon-image"
                                  />
                                </div>
                                <div className="item-timeline"></div>
                              </div>
                              <div className="item-content">
                                {/* Transfer Title */}
                                <h3 className="item-title">
                                  {(() => {
                                    const data = item.data
                                      ? JSON.parse(item.data)
                                      : {};
                                    return (
                                      data.contactName || 'Transfer Service'
                                    );
                                  })()}
                                </h3>

                                {/* Pickup Date and Time Info */}
                                <div className="item-date">
                                  <div>
                                    {item.startDate
                                      ? new Date(
                                          item.startDate,
                                        ).toLocaleDateString('en-US', {
                                          weekday: 'short',
                                          month: 'long',
                                          day: 'numeric',
                                        })
                                      : 'Date TBD'}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: '0.85rem',
                                      opacity: 0.7,
                                      marginTop: '0.25rem',
                                    }}
                                  >
                                    {item.startDate
                                      ? new Date(
                                          item.startDate,
                                        ).toLocaleTimeString('en-US', {
                                          hour: 'numeric',
                                          minute: '2-digit',
                                          hour12: true,
                                        })
                                      : ''}
                                    {item.endDate &&
                                      ` → ${new Date(
                                        item.endDate,
                                      ).toLocaleTimeString('en-US', {
                                        hour: 'numeric',
                                        minute: '2-digit',
                                        hour12: true,
                                      })}`}
                                  </div>
                                </div>

                                {/* Transfer Details */}
                                <div className="item-details">
                                  {(() => {
                                    const data = item.data
                                      ? JSON.parse(item.data)
                                      : {};
                                    return (
                                      <>
                                        <div
                                          style={{
                                            display: 'flex',
                                            gap: '1rem',
                                            marginBottom: '0.75rem',
                                          }}
                                        >
                                          {data.transferType && (
                                            <div className="item-class">
                                              <Navigation2 size={16} />
                                              <span>{data.transferType}</span>
                                            </div>
                                          )}
                                          <div className="item-passengers">
                                            <Users size={16} />
                                            <span>{trip?.groupSize || 1}</span>
                                          </div>
                                        </div>
                                        {data.vehicleInfo && (
                                          <div
                                            style={{
                                              display: 'flex',
                                              gap: '1rem',
                                              marginBottom: '0.75rem',
                                            }}
                                          >
                                            <div className="item-vehicle">
                                              <Briefcase size={16} />
                                              <span>{data.vehicleInfo}</span>
                                            </div>
                                          </div>
                                        )}
                                      </>
                                    );
                                  })()}
                                  <div className="item-contact">
                                    <Phone size={16} />
                                    <span
                                      style={{
                                        opacity: item.phoneNumber ? 1 : 0.4,
                                      }}
                                      className="monospace"
                                    >
                                      {item.phoneNumber || '-'}
                                    </span>
                                  </div>
                                  <div className="item-confirmation">
                                    <Hash size={16} />
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
                                  <div className="item-notes">
                                    <FileText size={16} />
                                    <span
                                      style={{ opacity: item.notes ? 1 : 0.4 }}
                                    >
                                      {item.notes || 'No notes'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </>
                          ) : (
                            // Default Layout for Other Items
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
                                      ? new Date(
                                          item.startDate,
                                        ).toLocaleString()
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

                                {/* Show passenger count for hotels and transfers */}
                                {(item.type === 'hotel' ||
                                  item.type === 'transfer') &&
                                  trip?.groupSize && (
                                    <div
                                      style={{
                                        fontSize: '0.85rem',
                                        opacity: 0.7,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.3rem',
                                      }}
                                    >
                                      <Users size={14} /> {trip.groupSize}
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
                                    fontSize: '0.8rem',
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
