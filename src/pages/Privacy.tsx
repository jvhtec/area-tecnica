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
            Última actualización: Julio 2026
          </p>
        </header>

        {/* Content */}
        <main className="prose prose-slate dark:prose-invert max-w-none">
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
              Responsable y contacto
            </h2>
            <p className="text-slate-600 dark:text-slate-300">
              El responsable del tratamiento es la entidad de Sector Pro identificada en tu relación contractual o documentación de pago. Para ejercer tus derechos o consultar cualquier tratamiento, escribe a info@sector-pro.com.
            </p>
          </section>

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
            <p className="text-slate-600 dark:text-slate-300 mt-4">
              Tratamos estos datos para gestionar medidas precontractuales y contratos, cumplir obligaciones fiscales y laborales, y proteger la plataforma frente a fraude o uso indebido. Cuando el tratamiento se base en interés legítimo, puedes solicitar información u oponerte.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
              Proveedores y transferencias
            </h2>
            <p className="text-slate-600 dark:text-slate-300">
              Utilizamos proveedores necesarios para alojamiento y base de datos (Supabase), entrega web (Cloudflare), correo (Brevo), operaciones técnicas (Flex), mensajería (WAHA/WhatsApp), mapas (Google Maps o Mapbox) y notificaciones móviles (Apple o Web Push). El acceso se limita a la finalidad del servicio y las transferencias internacionales se someten a las garantías ofrecidas por cada proveedor y a la normativa aplicable.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
              Tus derechos
            </h2>
            <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
              <li><strong>Ver tus datos:</strong> Inicia sesion en tu perfil</li>
              <li><strong>Actualizar tus datos:</strong> Edita tu perfil en cualquier momento</li>
              <li><strong>Eliminar u oponerte al tratamiento:</strong> Solicítalo desde Perfil → Eliminar mi cuenta o escribe a info@sector-pro.com. Verificaremos tu identidad y confirmaremos el alcance antes de ejecutar la solicitud.</li>
              <li><strong>Reclamar:</strong> Puedes acudir a la Agencia Española de Protección de Datos (AEPD).</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
              Retencion de datos
            </h2>
            <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
              <li><strong>Usuarios activos:</strong> Conservados mientras trabajes con nosotros</li>
              <li><strong>Solicitudes de eliminación:</strong> Tras verificar y aprobar la solicitud, eliminamos o anonimizamos los datos que ya no sean necesarios. Los registros fiscales, laborales o de pago se conservan durante los plazos legales aplicables (habitualmente hasta 7 años).</li>
              <li><strong>Copias de seguridad y proveedores:</strong> Los datos residuales desaparecen conforme a los ciclos de retención y borrado de cada sistema; no se usan para nuevas finalidades.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
              Decisiones automatizadas
            </h2>
            <p className="text-slate-600 dark:text-slate-300">
              Sector Pro puede ordenar o recomendar candidatos para facilitar la planificación, pero una persona responsable decide las asignaciones. No se adoptan decisiones con efectos jurídicos basadas únicamente en tratamiento automatizado.
            </p>
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
