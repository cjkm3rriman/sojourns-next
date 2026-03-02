import Image from 'next/image';
import { Clock, Users, MapPin, Phone, Hash, FileText } from 'react-feather';

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
  originPlacePhone?: string;
  originPlacePhotos?: string;
  destinationPlaceName?: string;
  destinationPlaceShortName?: string;
  destinationPlaceAddress?: string;
  destinationPlaceCity?: string;
  phoneNumber?: string;
  confirmationNumber?: string;
  notes?: string;
  data?: string;
}

interface Trip {
  groupSize?: number;
}

interface RestaurantItemProps {
  item: TripItem;
  trip?: Trip;
}

export default function RestaurantItem({ item, trip }: RestaurantItemProps) {
  const data = item.data ? JSON.parse(item.data) : {};

  // Parse photos from JSON string
  const photos = item.originPlacePhotos
    ? JSON.parse(item.originPlacePhotos)
    : [];

  return (
    <>
      <div className="item-sidebar">
        <div className="item-icon">
          <Image
            src="/images/icons/items/restaurant.png?v=1"
            alt="Restaurant icon"
            width={40}
            height={40}
            className="item-icon-image"
          />
        </div>
        <div className="item-timeline"></div>
      </div>
      <div className="item-content">
        {/* Restaurant Title */}
        <h3 className="item-title">{item.title || 'Restaurant'}</h3>

        {/* Date and Time Info */}
        <div className="item-date">
          <div>
            {item.startDate
              ? new Date(item.startDate).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                }) +
                ' at ' +
                new Date(item.startDate)
                  .toISOString()
                  .slice(11, 16)
                  .replace(/(\d{2}):(\d{2})/, (_, h, m) => {
                    const hour12 =
                      parseInt(h) === 0
                        ? 12
                        : parseInt(h) > 12
                          ? parseInt(h) - 12
                          : parseInt(h);
                    const ampm = parseInt(h) >= 12 ? 'pm' : 'am';
                    return `${hour12}:${m}${ampm}`;
                  })
              : 'Date TBD'}
          </div>
        </div>

        {/* Restaurant Photos */}
        {photos.length > 0 && (
          <div
            style={{
              display: 'flex',
              gap: '0.75rem',
              marginTop: '1rem',
              marginBottom: '1rem',
              overflowX: 'auto',
            }}
          >
            {photos.slice(0, 3).map((photoUrl: string, index: number) => (
              <img
                key={index}
                src={photoUrl}
                alt={`${item.title || 'Restaurant'} photo ${index + 1}`}
                style={{
                  width: '160px',
                  height: '120px',
                  objectFit: 'cover',
                  borderRadius: '8px',
                  flexShrink: 0,
                }}
              />
            ))}
          </div>
        )}

        {/* Restaurant Details */}
        <div className="item-details">
          <div
            style={{
              display: 'flex',
              gap: '1rem',
            }}
          >
            <div className="item-class">
              <Clock size={16} />
              <span>
                {item.startDate
                  ? new Date(item.startDate)
                      .toISOString()
                      .slice(11, 16)
                      .replace(/^(\d{2}):(\d{2})$/, (_, h, m) => {
                        const hour = parseInt(h);
                        const period = hour >= 12 ? 'PM' : 'AM';
                        const displayHour =
                          hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                        return `${displayHour}:${m}${period}`;
                      })
                  : '-'}
              </span>
            </div>
            <div className="item-passengers">
              <Users size={16} />
              <span>{data.partySize || trip?.groupSize || 1}</span>
            </div>
          </div>
          <div className="item-places">
            <MapPin size={16} />
            <span
              style={{
                opacity: item.originPlaceCity ? 1 : 0.4,
              }}
            >
              {item.originPlaceCity || '-'}
            </span>
          </div>
          <div className="item-contact">
            <Phone size={16} />
            <span
              style={{
                opacity: item.originPlacePhone ? 1 : 0.4,
              }}
            >
              {item.originPlacePhone || '-'}
            </span>
          </div>
          <div className="item-confirmation">
            <Hash size={16} />
            <span
              className="monospace"
              style={{
                opacity: item.confirmationNumber ? 1 : 0.4,
              }}
            >
              {item.confirmationNumber || '-'}
            </span>
          </div>
        </div>

        {/* Restaurant-specific info */}
        <div className="secondary">
          <div className="item-notes">
            <FileText size={16} />
            <span
              style={{
                opacity: data.dietaryRequests ? 1 : 0.4,
              }}
            >
              {data.dietaryRequests || '-'}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
