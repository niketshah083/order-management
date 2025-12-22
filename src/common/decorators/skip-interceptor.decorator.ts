import { SetMetadata } from '@nestjs/common';

export const SkipTransform = () => SetMetadata('skipTransform', true);
