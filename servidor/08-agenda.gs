/* ---------------- agenda ---------------- */

function listarEventos() {
  const agora = new Date();
  const ini = new Date(agora.getTime() - 7 * 864e5);
  const fim = new Date(agora.getTime() + 90 * 864e5);
  return CalendarApp.getDefaultCalendar().getEvents(ini, fim).slice(0, 80).map(e => ({
    id: e.getId(), titulo: e.getTitle(), data: e.getStartTime().toISOString(),
  }));
}
