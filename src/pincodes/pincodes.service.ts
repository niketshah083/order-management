import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface LocationData {
  city: string;
  state: string;
  district?: string;
  region?: string;
  country: string;
}

@Injectable()
export class PincodesService {
  constructor(private httpService: HttpService) {}

  async getLocationByPincode(pincode: string): Promise<LocationData | null> {
    try {
      // Call external PostalPinCode API
      const url = `https://api.postalpincode.in/pincode/${pincode}`;
      const response = await firstValueFrom(this.httpService.get(url));

      if (response.data && Array.isArray(response.data) && response.data[0]) {
        const data = response.data[0];
        if (data.PostOffice && Array.isArray(data.PostOffice) && data.PostOffice.length > 0) {
          const office = data.PostOffice[0];
          return {
            city: office.Region || office.District || 'Unknown',
            state: office.State || 'Unknown',
            district: office.District,
            region: office.Region,
            country: office.Country || 'India',
          };
        }
      }
      return null;
    } catch (error) {
      console.error(`Error fetching pincode data for ${pincode}:`, error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  }
}
