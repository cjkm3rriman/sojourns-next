import Image from 'next/image';
import {
  ArrowUpCircle,
  ArrowDownCircle,
  Award,
  Users,
  Phone,
  Hash,
  FileText,
} from 'react-feather';

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
  flightsPhoneNumber?: string;
}

interface FlightItemProps {
  item: TripItem;
  trip?: Trip;
}

export default function FlightItem({ item, trip }: FlightItemProps) {
  let carrierCode = '';
  let flightNumber = '';
  let flightClass = '';
  let hasFlightData = false;
  let hasClassData = false;

  if (item.data) {
    try {
      const parsedData = JSON.parse(item.data);
      carrierCode = parsedData.carrierCode;
      flightNumber = parsedData.flightNumber;
      flightClass = parsedData.class;
      hasFlightData = !!(carrierCode && flightNumber);
      hasClassData = !!flightClass;
    } catch (e) {
      // Keep default fallback
    }
  }

  const displayFlightNumber = hasFlightData
    ? `${carrierCode} ${flightNumber}`
    : '-';

  return (
    <>
      <div className="item-sidebar">
        <div className="item-icon">
          <Image
            src="/images/icons/items/flights.png?v=1"
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

        {/* Flight Details - Flight Number */}
        <div className="item-number">
          {hasFlightData && carrierCode && (
            <Image
              src={`https://airlabs.co/img/airline/m/${carrierCode}.png`}
              alt="Airline logo"
              width={24}
              height={24}
              style={{ objectFit: 'contain' }}
            />
          )}
          <span style={{ opacity: hasFlightData ? 1 : 0.4 }}>
            {displayFlightNumber}
          </span>
        </div>

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
              <span>{item.originPlaceShortName || 'DEP'}</span>{' '}
              <span>{item.originLocationSpecific || ''}</span>{' '}
              {item.startDate
                ? new Date(item.startDate)
                    .toISOString()
                    .slice(11, 16)
                    .replace(/(\d{2}):(\d{2})/, (_, h, m) => {
                      const hour12 =
                        parseInt(h) === 0
                          ? 12
                          : parseInt(h) > 12
                            ? parseInt(h) - 12
                            : parseInt(h);
                      const ampm = parseInt(h) >= 12 ? 'PM' : 'AM';
                      return `${hour12}:${m}${ampm}`;
                    })
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
              <span>{item.destinationPlaceShortName || 'ARR'}</span>{' '}
              <span>{item.destinationLocationSpecific || ''}</span>{' '}
              {item.endDate
                ? new Date(item.endDate)
                    .toISOString()
                    .slice(11, 16)
                    .replace(/(\d{2}):(\d{2})/, (_, h, m) => {
                      const hour12 =
                        parseInt(h) === 0
                          ? 12
                          : parseInt(h) > 12
                            ? parseInt(h) - 12
                            : parseInt(h);
                      const ampm = parseInt(h) >= 12 ? 'PM' : 'AM';
                      return `${hour12}:${m}${ampm}`;
                    })
                : '12:15PM'}
            </span>
          </div>
        </div>

        {/* Additional Flight Details */}
        <div className="item-details">
          <div className="item-service-info">
            <div className="item-class">
              <Award size={16} />{' '}
              <span
                style={{
                  opacity: hasClassData ? 1 : 0.4,
                }}
              >
                {flightClass || '-'}
              </span>
            </div>
            <div className="item-passengers">
              <Users size={16} />{' '}
              <span
                style={{
                  opacity: trip?.groupSize ? 0.7 : 0.4,
                }}
              >
                {trip?.groupSize || '-'}
              </span>
            </div>
          </div>
          <div className="item-contact">
            <Phone size={16} />{' '}
            <span
              className="monospace"
              style={{
                opacity: trip?.flightsPhoneNumber ? undefined : 0.4,
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
                opacity: item.confirmationNumber ? undefined : 0.4,
              }}
            >
              {item.confirmationNumber || '-'}
            </span>
          </div>
        </div>

        <div className="secondary">
          <div className="item-notes">
            <FileText size={16} />{' '}
            <span style={{ opacity: item.notes ? 1 : 0.4 }}>
              {item.notes || '-'}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
