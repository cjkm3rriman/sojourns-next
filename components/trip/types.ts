export interface TripItem {
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

export interface Trip {
  groupSize?: number;
  flightsPhoneNumber?: string;
}
