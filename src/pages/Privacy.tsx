import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const Privacy = () => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Back link */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al inicio
        </Link>

        {/* Header */}
        <header className="mb-10">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Politica de Privacidad
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            Ultima actualizacion: Enero 2026
          </p>
        </header>

        {/* Content */}
        <main className="prose prose-slate dark:prose-invert max-w-none">
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
              Como recopilamos tus datos
            </h2>
            <p className="text-slate-600 dark:text-slate-300 mb-4">
              Nos proporcionas tu informacion cuando:
            </p>
            <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
              <li>Nos envias tu CV</li>
              <li>Nos llamas sobre oportunidades de trabajo</li>
              <li>Visitas nuestra oficina y solicitas que te agreguemos a nuestra base de datos de tecnicos</li>
            </ul>
            <p className="text-slate-600 dark:text-slate-300 mt-4">
              Te agregamos a Sector Pro para gestionar asignaciones de trabajo y comunicarnos contigo sobre oportunidades.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
              Que datos almacenamos
            </h2>
            <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
              <li>Informacion de contacto (nombre, email, telefono)</li>
              <li>Habilidades y experiencia</li>
              <li>Historial de trabajo con nosotros</li>
              <li>Disponibilidad</li>
              <li>Informacion de pago</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
              Por que lo almacenamos
            </h2>
            <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
              <li>Para ofrecerte oportunidades de trabajo</li>
              <li>Para gestionar la programacion de tecnicos</li>
              <li>Para procesar pagos</li>
              <li>Para mantener el historial de trabajo</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
              Tus derechos
            </h2>
            <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
              <li><strong>Ver tus datos:</strong> Inicia sesion en tu perfil</li>
              <li><strong>Actualizar tus datos:</strong> Edita tu perfil en cualquier momento</li>
              <li><strong>Eliminar tu cuenta:</strong> Perfil → Eliminar cuenta</li>
              <li><strong>Preguntas:</strong> Contacta con nosotros</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
              Retencion de datos
            </h2>
            <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
              <li><strong>Usuarios activos:</strong> Conservados mientras trabajes con nosotros</li>
              <li><strong>Cuentas eliminadas:</strong> Datos personales eliminados inmediatamente, registros de pago conservados 7 años por cumplimiento fiscal/legal</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
              Contacto
            </h2>
            <p className="text-slate-600 dark:text-slate-300">
              Para consultas relacionadas con tus datos:{" "}
              <a
                href="mailto:info@sector-pro.com"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                info@sector-pro.com
              </a>
            </p>
          </section>
        </main>

        {/* Footer */}
        <footer className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
            &copy; {new Date().getFullYear()} Sector Pro. Todos los derechos reservados.
          </p>
        </footer>
      </div>
    </div>
  );
};

export default Privacy;
