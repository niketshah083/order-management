import { config } from 'dotenv';
config();

export class CommonConstants {
  static decimalToNumberTransformer() {
    return {
      to: (value: number) => value, // transform data before storing it
      from: (value: string) => parseFloat(value), // transform data after retrieving it
    };
  }

  static stringToJsonTransformer() {
    return {
      to: (value: Object) => (value ? JSON.stringify(value) : null), // transform data before storing it
      from: (value: string) => value, // transform data after retrieving it
    };
  }

  static ORDER_APPROVAL_TIMING = {
    MORNING: ['10:00 AM', '4:59 PM'],
    EVENING: ['5:00 PM', '11:00 PM'],
  };
}
