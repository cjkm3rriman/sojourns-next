import Image from 'next/image';
import {
  ArrowUpCircle,
  Clock,
  Award,
  Users,
  MapPin,
  Phone,
  Hash,
  FileText,
  Tag,
} from 'react-feather';
import { TripItem, Trip } from './types';

interface TransferItemProps {
  item: TripItem;
  trip?: Trip;
}

export default function TransferItem({ item, trip }: TransferItemProps) {
  const data = item.data ? JSON.parse(item.data) : {};

  const getDestinationName = () => {
    let destinationName =
      item.destinationPlaceName || item.destinationPlaceCity;

    if (!destinationName && data.dropoffLocation) {
      destinationName = data.dropoffLocation;
    }

    if (!destinationName) {
      return 'Transfer';
    }

    return `Transfer to ${destinationName}`;
  };

  const getRoute = () => {
    let originName = item.originPlaceName || item.originPlaceCity;
    let destinationName =
      item.destinationPlaceName || item.destinationPlaceCity;

    if (!originName && data.pickupLocation) {
      originName = data.pickupLocation;
    }
    if (!destinationName && data.dropoffLocation) {
      destinationName = data.dropoffLocation;
    }

    if (!originName) originName = 'Pickup';
    if (!destinationName) destinationName = 'Dropoff';

    return `${originName} → ${destinationName}`;
  };

  const calculateDuration = () => {
    if (!item.startDate || !item.endDate) {
      return '-';
    }

    const startTime = new Date(item.startDate);
    const endTime = new Date(item.endDate);
    const durationMs = endTime.getTime() - startTime.getTime();

    if (durationMs <= 0) {
      return '-';
    }

    const minutes = Math.round(durationMs / (1000 * 60));

    if (minutes < 60) {
      return `${minutes}m`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      if (remainingMinutes === 0) {
        return `${hours}h`;
      } else {
        return `${hours}h ${remainingMinutes}m`;
      }
    }
  };

  return (
    <>
      <div className="item-sidebar">
        <div className="item-icon">
          <Image
            src="/images/icons/items/transfer.png?v=1"
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
        <h3 className="item-title">{getDestinationName()}</h3>

        {/* Pickup Date and Time Info */}
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
                  .replace(/^(\d{2}):(\d{2})$/, (_, h, m) => {
                    const hour = parseInt(h);
                    const period = hour >= 12 ? 'PM' : 'AM';
                    const displayHour =
                      hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                    return `${displayHour}:${m}${period}`;
                  })
              : 'Date TBD'}
          </div>
        </div>

        {/* Route */}
        <div className="item-route">{getRoute()}</div>

        {/* Departure and Arrival Times */}
        <div className="item-times">
          <div className="item-departure">
            <ArrowUpCircle size={16} />
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
                : 'TBD'}
            </span>
          </div>
          <div className="item-arrival">
            <Clock size={16} />
            <span>{calculateDuration()}</span>
          </div>
        </div>

        {/* Transfer Details */}
        <div className="item-details">
          <div
            style={{
              display: 'flex',
              gap: '1rem',
            }}
          >
            <div className="item-class">
              <Award size={16} />
              <span>{data.service || '-'}</span>
            </div>
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
              }}
            >
              <div className="item-vehicle">
                <Tag size={16} />
                <span>{data.vehicleInfo}</span>
              </div>
            </div>
          )}
          <div className="item-places">
            <MapPin size={16} />
            <span
              style={{
                opacity: item.originLocationSpecific ? 1 : 0.4,
              }}
            >
              {item.originLocationSpecific || '-'}
            </span>
          </div>
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
                opacity: item.confirmationNumber ? 1 : 0.4,
              }}
            >
              {item.confirmationNumber || '-'}
            </span>
          </div>
          <div className="item-notes">
            <FileText size={16} />
            <span style={{ opacity: item.notes ? 1 : 0.4 }}>
              {item.notes || 'No notes'}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
