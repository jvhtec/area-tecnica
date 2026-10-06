import { describe, expect, it } from 'vitest';
import { personnelPeriodRows, createPersonnelReport } from './personnelReport';
import { personnelLocalInstant, validatePersonnelPlan, type PersonnelPlan } from './personnelModel';
import type { FleetVehicle, MatrixDriver } from '../fleet/fleetModel';
const plan: PersonnelPlan = {
  id: 'e1000000-0000-0000-0000-000000000001', title: 'Equipo', job_id: null,
  people_count: 6, starts_at: '2026-09-30T12:00:00Z', ends_at: '2026-09-30T14:00:00Z',
  origin_location_id: 'origin', destination_location_id: 'destination', vehicle_id: null, driver_id: null,
  status: 'planned', hotel_needed: true, hotel_name: 'Hotel', hotel_address: null,
  hotel_check_in: '2026-09-30', hotel_check_out: '2026-10-03', single_rooms: 0, double_rooms: 3,
  hotel_status: 'confirmed', notes: null, updated_at: '2026-09-30T10:00:00Z',
};
describe('personnel reports and validation', () => {
  it('allows cancelling or completing an old booking after its vehicle is disabled', () => {
    const vehicle = { id: 'van', is_active: false, vehicle_type: 'furgoneta', passenger_seats: 4 } as FleetVehicle;
    const booking = { ...plan, vehicle_id: 'van', driver_id: 'old-driver' };
    expect(validatePersonnelPlan(booking, [vehicle], [])).toContain('activo');
    expect(validatePersonnelPlan({ ...booking, status: 'cancelled' }, [vehicle], [])).toBeNull();
    expect(validatePersonnelPlan({ ...booking, status: 'completed' }, [], [])).toBeNull();
  });
  it('opens with format 03 and keeps separate complete cards for multiple transfers', async () => {
    const second = { ...plan, id: 'e1000000-0000-0000-0000-000000000002', title: 'Segundo equipo', hotel_needed: false, notes: 'Instrucciones '.repeat(140) };
    const workbook = await createPersonnelReport([plan, second], '2026-09-01', '2026-09-30', [], [], { jobs: [], locations: [] });
    const sheet = workbook.worksheets[0];
    expect(sheet.name).toBe('Fichas de personal');
    expect(sheet.getCell('A2').value).toBe('Traslado de personal 1 · Equipo');
    expect(sheet.getCell('A5').value).toBe('Evento y personas');
    expect(sheet.getCell('F5').value).toBe('Vehículo y conductor');
    const titles: string[] = [];
    const noteParts: string[] = [];
    sheet.eachRow(row => {
      const title = row.getCell(1).value;
      if (typeof title === 'string' && title.startsWith('Traslado de personal')) titles.push(title);
      if (['Observaciones', 'Observaciones (continuación)'].includes(String(row.getCell(6).value)) && row.getCell(8).value) noteParts.push(String(row.getCell(8).value));
    });
    expect(titles).toEqual(['Traslado de personal 1 · Equipo', 'Traslado de personal 2 · Segundo equipo']);
    expect(noteParts.filter(part => part !== 'Sin registrar').join('')).toBe(second.notes);
  });
  it('shows an explicit empty report in format 03', async () => {
    const workbook = await createPersonnelReport([], '2026-09-01', '2026-09-30', [], [], { jobs: [], locations: [] });
    expect(workbook.worksheets[0].getCell('A2').value).toContain('No hay traslados');
  });
  it('exports all form details, addresses and linked resources in one sheet', async () => {
    const completePlan = { ...plan, job_id: 'job', vehicle_id: 'van', driver_id: 'driver', hotel_address: 'Calle Hotel 10', notes: 'Recoger en la puerta lateral' };
    const vehicle = { id: 'van', name: 'Furgoneta 1', license_plate: '1234 ABC', vehicle_type: 'furgoneta', passenger_seats: 8 } as FleetVehicle;
    const driver = { id: 'driver', first_name: 'Ana', last_name: 'García', phone: '600123456' } as MatrixDriver;
    const workbook = await createPersonnelReport([completePlan], '2026-09-01', '2026-09-30', [vehicle], [driver], {
      jobs: [{ id: 'job', title: 'Festival' }], locations: [{ id: 'origin', name: 'Almacén', formatted_address: 'Calle Origen 1' }, { id: 'destination', name: 'Recinto', formatted_address: 'Calle Destino 2' }],
    });
    const sheet = workbook.getWorksheet('Datos completos')!;
    expect(sheet.columnCount).toBe(30);
    expect(sheet.getRow(4).values).toEqual([undefined, plan.id, 'Equipo', 'Festival', 6, new Date('2026-09-30T14:00:00Z'), new Date('2026-09-30T16:00:00Z'),
      'Almacén', 'Calle Origen 1', 'Recinto', 'Calle Destino 2', 'Furgoneta 1', '1234 ABC', 'Furgoneta', 8, 'Ana García', '600123456', 'Pendiente', 'Sí', 'Hotel', 'Calle Hotel 10',
      new Date('2026-09-30T00:00Z'), new Date('2026-10-03T00:00Z'), 0, 3, 3, 6, 'Confirmada', 'Recoger en la puerta lateral', new Date('2026-09-30T12:00Z'), 'Traslado y hotel']);
  });
  it('keeps the complete transfer record when only the hotel coincides with the month', async () => {
    const workbook = await createPersonnelReport([plan], '2026-10-01', '2026-10-31', [], [], { jobs: [], locations: [] });
    expect(workbook.getWorksheet('Traslados')?.rowCount).toBe(3);
    expect(workbook.getWorksheet('Datos completos')?.getCell('AD4').value).toBe('Hotel');
    expect(workbook.getWorksheet('Datos completos')?.getCell('D4').value).toBe(6);
  });
  it('includes a hotel stay across months independently of the transfer', () => {
    const result = personnelPeriodRows([plan], '2026-10-01', '2026-10-31');
    expect(result.transfers).toEqual([]);
    expect(result.hotels).toEqual([plan]);
    expect(personnelPeriodRows([plan], '2026-10-03', '2026-10-04').hotels).toEqual([]);
  });
  it('uses Madrid midnight and excludes exact non-overlapping boundaries', () => {
    expect(personnelPeriodRows([{ ...plan, starts_at: '2026-09-30T22:00:00Z', ends_at: '2026-09-30T23:00:00Z' }], '2026-10-01', '2026-10-01').transfers).toHaveLength(1);
    expect(personnelPeriodRows([{ ...plan, ends_at: '2026-09-30T22:00:00Z' }], '2026-10-01', '2026-10-01').transfers).toHaveLength(0);
  });
  it('requires enough rooms and vehicle/driver for confirmation', () => {
    expect(validatePersonnelPlan(plan, [], [])).toBeNull();
    expect(validatePersonnelPlan({ ...plan, double_rooms: 2 }, [], [])).toContain('habitaciones');
    expect(validatePersonnelPlan({ ...plan, status: 'confirmed' }, [], [])).toContain('conductor');
  });
  it('rejects nonexistent Madrid times at the spring clock change', () => {
    expect(() => personnelLocalInstant('2026-03-29T02:30')).toThrow();
    expect(personnelLocalInstant('2026-10-01T14:00')).toBe('2026-10-01T12:00:00.000Z');
  });
  it('writes numeric rooms and real Excel dates, excluding cancelled people from totals', async () => {
    const workbook = await createPersonnelReport([plan, { ...plan, id: 'e1000000-0000-0000-0000-000000000002', status: 'cancelled' }], '2026-09-01', '2026-09-30', [], [], { jobs: [], locations: [] });
    expect(workbook.getWorksheet('Resumen')?.getCell('B5').value).toBe(6);
    expect(workbook.getWorksheet('Traslados')?.getCell('C4').value).toEqual(new Date('2026-09-30T14:00:00Z'));
    expect(workbook.getWorksheet('Hoteles')?.getCell('I4').value).toBe(3);
  });
});
