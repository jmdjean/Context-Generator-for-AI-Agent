import { formatDate, slugify } from '../../libs/shared/src/index';

export function renderPage(title: string): string {
  const date = formatDate(new Date());
  const slug = slugify(title);
  return `<html><body><h1>${title}</h1><p>${date}</p><p>${slug}</p></body></html>`;
}
