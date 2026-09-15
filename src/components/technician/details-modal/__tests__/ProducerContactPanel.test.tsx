// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";

import { ProducerContactPanel } from "@/components/technician/details-modal/ProducerContactPanel";
import type { Theme } from "@/components/technician/types";
import { renderWithProviders } from "@/test/renderWithProviders";

const theme = {
  bg: "bg-slate-950",
  nav: "bg-slate-900",
  card: "bg-slate-900",
  textMain: "text-white",
  textMuted: "text-slate-400",
  accent: "bg-blue-600",
  input: "bg-slate-800",
  modalOverlay: "bg-black/70",
  divider: "border-slate-800",
  danger: "text-red-500",
  success: "text-green-500",
  warning: "text-yellow-500",
  cluster: "bg-white text-black",
} as Theme;

const contact = {
  job_id: "job-1",
  producer_id: "producer-1",
  display_name: "Ana Ruiz",
  phone: "+34600111222",
  email: "ana@sector-pro.com",
};

const renderPanel = (props: Partial<React.ComponentProps<typeof ProducerContactPanel>> = {}) =>
  renderWithProviders(
    <ProducerContactPanel
      contacts={[contact]}
      isDark
      isLoading={false}
      jobTitle="Festival Río"
      theme={theme}
      {...props}
    />,
  );

describe("ProducerContactPanel", () => {
  it("renders nothing when the job has no claimed producer", () => {
    const { container } = renderPanel({ contacts: [] });

    expect(container).toBeEmptyDOMElement();
  });

  it("still renders while the contacts are loading", () => {
    renderPanel({ contacts: [], isLoading: true });

    expect(screen.getByText("Cargando responsable...")).toBeInTheDocument();
  });

  it("pluralises the heading when several producers carry the job", () => {
    renderPanel({
      contacts: [contact, { ...contact, producer_id: "producer-2", display_name: "Luis Pérez" }],
    });

    expect(screen.getByText("Responsables de producción")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Escribir por WhatsApp a/ })).toHaveLength(2);
  });

  it("gives every shortcut an accessible name so icon buttons stay usable on mobile", () => {
    renderPanel();

    expect(screen.getByRole("link", { name: "Escribir por WhatsApp a Ana Ruiz" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Llamar a Ana Ruiz" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Enviar un correo a Ana Ruiz" })).toBeInTheDocument();
  });

  it("drops the phone shortcuts when the producer has no usable number", () => {
    renderPanel({ contacts: [{ ...contact, phone: null }] });

    expect(screen.queryByRole("link", { name: /WhatsApp/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Llamar/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Enviar un correo a Ana Ruiz" })).toBeInTheDocument();
  });

  it("says so when the producer profile carries no contact details at all", () => {
    renderPanel({ contacts: [{ ...contact, phone: null, email: null }] });

    expect(screen.getByText("Sin datos de contacto en su perfil")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("omits the prefilled message when the job has no title", () => {
    renderPanel({ jobTitle: null });

    expect(screen.getByRole("link", { name: "Escribir por WhatsApp a Ana Ruiz" })).toHaveAttribute(
      "href",
      "https://wa.me/34600111222",
    );
  });
});
