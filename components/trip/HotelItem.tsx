import Image from 'next/image';
import { Award, Users, Phone, Hash, FileText, Moon } from 'react-feather';

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

interface HotelItemProps {
  item: TripItem;
  trip?: Trip;
}

export default function HotelItem({ item, trip }: HotelItemProps) {
  const data = item.data ? JSON.parse(item.data) : {};

  const calculateNights = () => {
    if (item.startDate && item.endDate) {
      const start = new Date(item.startDate);
      const end = new Date(item.endDate);
      const nights = Math.ceil(
        (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
      );
      return `${nights} night${nights !== 1 ? 's' : ''}`;
    }
    return 'TBD nights';
  };

  return (
    <>
      <div className="item-sidebar">
        <div className="item-icon">
          <Image
            src="/images/icons/items/hotel.png?v=1"
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
          {data.hotelName || item.title || 'Hotel Stay'}
        </h3>

        {/* Check-in Date and Time Info */}
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
              : 'TBD Check In Date'}
          </div>
        </div>

        {/* Hotel Details */}
        <div className="item-details">
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
              <span>{calculateNights()}</span>
            </div>
            {data.perks && data.perks.length > 0 && (
              <div className="item-perks">
                <Award size={16} />
                <span>
                  {data.perks.length} perk
                  {data.perks.length !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
          <div className="item-contact">
            <Phone size={16} />
            <span
              style={{
                opacity: item.phoneNumber ? undefined : 0.4,
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
                opacity: item.confirmationNumber ? undefined : 0.4,
              }}
            >
              {item.confirmationNumber || '-'}
            </span>
          </div>
          <div className="item-notes">
            <FileText size={16} />
            <span style={{ opacity: item.notes ? 1 : 0.4 }}>
              {item.notes || '-'}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
