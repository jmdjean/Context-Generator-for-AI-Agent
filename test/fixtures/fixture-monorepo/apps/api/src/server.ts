import { formatDate } from '../../libs/shared/src/index';

export function getHealthResponse(): object {
  return {
    status: 'ok',
    timestamp: formatDate(new Date()),
  };
}
