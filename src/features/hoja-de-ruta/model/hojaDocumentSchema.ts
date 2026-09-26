import { z } from "zod";

const optionalText = z.string().optional();
const optionalPhone = optionalText.refine(
  (value) => !value || /^[+0-9() .-]{7,25}$/.test(value),
  "Introduce un teléfono válido.",
);
const optionalEmail = optionalText.refine(
  (value) => !value || z.string().email().safeParse(value).success,
  "Introduce un correo electrónico válido.",
);
const optionalDni = optionalText.refine(
  (value) => !value || /^(?:[0-9]{8}|[XYZ][0-9]{7})[A-Za-z]$/.test(value.trim()),
  "Introduce un DNI o NIE válido.",
);
const optionalDateTime = optionalText;

const contactSchema = z.object({
  phone: optionalPhone,
  email: optionalEmail,
}).passthrough();

const staffSchema = z.object({
  dni: optionalDni,
  phone: optionalPhone,
}).passthrough();

const travelSchema = z.object({
  departure_time: optionalDateTime,
  arrival_time: optionalDateTime,
}).passthrough().superRefine((travel, context) => {
  if (
    travel.departure_time
    && travel.arrival_time
    && new Date(travel.arrival_time).getTime() < new Date(travel.departure_time).getTime()
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["arrival_time"],
      message: "La llegada no puede ser anterior a la salida.",
    });
  }
});

const accommodationSchema = z.object({
  check_in: optionalDateTime,
  check_out: optionalDateTime,
}).passthrough().superRefine((accommodation, context) => {
  if (
    accommodation.check_in
    && accommodation.check_out
    && new Date(accommodation.check_out).getTime() < new Date(accommodation.check_in).getTime()
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["check_out"],
      message: "El check-out no puede ser anterior al check-in.",
    });
  }
});

export const hojaDocumentSchema = z.object({
  eventData: z.object({
    eventName: z.string().trim().min(1, "El nombre del evento es obligatorio."),
    eventDates: z.string().trim().min(1, "Las fechas del evento son obligatorias."),
    venue: z.object({
      name: z.string().trim().min(1, "El nombre del recinto es obligatorio."),
      address: z.string().trim().min(1, "La dirección del recinto es obligatoria."),
    }).passthrough(),
    contacts: z.array(contactSchema),
    staff: z.array(staffSchema),
    auxiliaryStaffSetupQty: z.number().int().nonnegative().optional(),
    auxiliaryStaffDismantleQty: z.number().int().nonnegative().optional(),
  }).passthrough(),
  travelArrangements: z.array(travelSchema),
  accommodations: z.array(accommodationSchema),
});

export type HojaDocumentValidationValues = z.input<typeof hojaDocumentSchema>;
