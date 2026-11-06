/**
 * Utilidades para manejo de fecha y hora estándar de Argentina (GMT-3, reloj de 24hs)
 */

export function getArgentinaNowString() {
  const now = new Date();
  // Formatear en zona horaria de Buenos Aires (GMT-3)
  const formatter = new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(now);
  const getPart = (type) => parts.find((p) => p.type === type)?.value || '00';

  const year = getPart('year');
  const month = getPart('month');
  const day = getPart('day');
  const hour = getPart('hour');
  const minute = getPart('minute');
  const second = getPart('second');

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

export function formatArgentinaDisplay(dateStr) {
  if (!dateStr) return '-';
  // Si ya viene formateado YYYY-MM-DD HH:MM:SS
  return dateStr;
}
